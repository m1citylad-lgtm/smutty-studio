<?php
if (!defined('ABSPATH')) { exit; }
/** Isolated local repair jobs. Originals and historical template records are immutable. */
final class SBS_Studio_Tools
{
    public static function register_routes() {
        foreach(array('repairs'=>array('GET','repairs'),'artwork'=>array('GET','artwork'),'fit'=>array('POST','fit'),'source'=>array('POST','source'),'fix'=>array('POST','fix')) as $path=>$route) {
            register_rest_route(SBS_REST::NS,'/tools/'.$path,array('methods'=>$route[0],'callback'=>array(__CLASS__,$route[1]),'permission_callback'=>array('SBS_Finishing','permission')));
        }
    }
    private static function error($message,$status=422) { return SBS_Finishing::error('tools',$message,$status); }
    public static function artwork() { $lib=SBS_Mockups::library(); return array('artwork'=>$lib['artwork']); }
    public static function fit($q) {
        $photo=(string)$q->get_param('photo');
        if(strlen($photo)>3000000||!preg_match('#^data:image/jpeg;base64,[A-Za-z0-9+/=]+$#D',$photo)) { return self::error('Choose a photo again.'); }
        if($q->get_param('consent')!==true) { return self::error('Confirm the provider cost before analysing the photo.'); }
        // Cache geometry only, never the source photo. Lock prevents concurrent paid retries.
        $key='sbs_fit_'.hash('sha256',SBS_VERSION.'|'.$photo); $cached=get_transient($key);if($cached){return $cached;}
        if(!add_option($key.'_lock',time(),'','no')) { return self::error('This photo is already being analysed. Wait before trying again.',409); }
        try { $r=SBS_OpenAI::fit_garment($photo);if(!is_wp_error($r)){set_transient($key,$r,HOUR_IN_SECONDS);}return $r; }
        finally { delete_option($key.'_lock'); }
    }
    public static function repairs() {
        $paths=glob(SBS_Storage::base_dir().'/fix/*.json')?:array();usort($paths,function($a,$b){return filemtime($b)<=>filemtime($a);});$repairs=array();
        foreach(array_slice($paths,0,100) as $path){$job=json_decode(@file_get_contents($path),true);$id=basename($path,'.json');if(!preg_match('/^[a-f0-9-]{36}$/D',$id)||!is_array($job)||!in_array($job['status']??'',array('submitting','pending','ready','accepted','uncertain'),true)||empty($job['source'])||!SBS_Final_Print::intact($job['source'])){continue;}$repairs[]=array('id'=>$id,'status'=>$job['status'],'source'=>$job['source'],'mask'=>$job['mask']??null,'preview'=>$job['preview']??null,'workspace'=>$job['workspace']??null,'replacement'=>$job['replacement']??'','created_at'=>$job['created_at']??'');}
        return array('repairs'=>$repairs);
    }
    public static function source($q) {
        if(!class_exists('Imagick')) { return self::error('Fix needs the server image tools.'); }
        $f=$q->get_file_params()['file']??array();
        if(!$f){$asset=SBS_Storage::get_asset((int)$q->get_param('source'));if(!$asset||!SBS_Final_Print::intact($asset)){return self::error('The selected source is unavailable.');}$path=SBS_Storage::absolute_path($asset);}else{
            if(empty($f['tmp_name'])||!empty($f['error'])||($f['size']??0)>67108864){return self::error('Choose a PNG, JPEG or WebP up to 64 MB.');}$path=$f['tmp_name'];
        }
        $s=@getimagesize($path);if(!$s||!in_array($s['mime'],array('image/png','image/jpeg','image/webp'),true)||$s[0]*$s[1]>20000000){return self::error('Fix accepts PNG, JPEG or WebP up to 20 million pixels.');}
        if($f){$asset=SBS_Storage::store_upload($f,'fix',0,'fix_original',sanitize_text_field($f['name']));if(is_wp_error($asset)){return $asset;}}
        $probe=new Imagick($path);if(!in_array($probe->getImageColorspace(),array(Imagick::COLORSPACE_RGB,Imagick::COLORSPACE_SRGB),true)){return self::error('Choose RGB artwork for a protected repair. No AI request was made.');}if($probe->getNumberImages()!==1){return self::error('Choose a single-frame image.');}
        if($probe->getImageOrientation()>Imagick::ORIENTATION_TOPLEFT){$probe->autoOrientImage();$probe->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);$probe->setImageFormat('png');$normalized=SBS_Storage::store_bytes($probe->getImageBlob(),'fix-oriented-source.png','image/png','fix',0,'fix_oriented_original','Orientation-correct source; original file retained',array('original_asset_id'=>$asset['id']));if(is_wp_error($normalized)){return $normalized;}$asset=$normalized;}
        $probe->clear();return array('asset'=>$asset);
    }
    private static function save($path,$job) {
        $text=wp_json_encode($job);$tmp=$path.'.tmp';if(file_put_contents($tmp,$text,LOCK_EX)!==strlen($text)||!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('The repair checkpoint could not be saved.');}@chmod($path,0640);
    }
    /** Blend only selected pixels, then verify the serialized result against every protected pixel. */
    public static function protected_patch($source,$mask,$generated,$b) {
        $w=$source->getImageWidth();$h=$source->getImageHeight();
        if($mask->getImageWidth()!==$w||$mask->getImageHeight()!==$h){throw new RuntimeException('Selection dimensions do not match the original.');}
        if(!in_array($source->getImageColorspace(),array(Imagick::COLORSPACE_RGB,Imagick::COLORSPACE_SRGB),true)){throw new RuntimeException('Use an RGB source for a protected repair.');}
        $result=clone $source;$result->setImageAlphaChannel(Imagick::ALPHACHANNEL_SET);
        $generated->resizeImage($b['w'],$b['h'],Imagick::FILTER_LANCZOS,1,false);$generated->setImageAlphaChannel(Imagick::ALPHACHANNEL_SET);
        $profile=$source->getImageProfiles('icc',true);if(isset($profile['icc'])){$generated->profileImage('icc',$profile['icc']);}
        $selected=0;
        for($y=0;$y<$h;$y++) {
            $m=$mask->exportImagePixels(0,$y,$w,1,'A',Imagick::PIXEL_DOUBLE);$row=$source->exportImagePixels(0,$y,$w,1,'RGBA',Imagick::PIXEL_DOUBLE);$change=false;
            $patch=($y>=$b['y']&&$y<$b['y']+$b['h'])?$generated->exportImagePixels(0,$y-$b['y'],$b['w'],1,'RGBA',Imagick::PIXEL_DOUBLE):null;
            foreach($m as $x=>$coverage){if($coverage<=0){continue;}if(!$patch||$x<$b['x']||$x>=$b['x']+$b['w']){throw new RuntimeException('Selection exceeds the repair context.');}$selected++;$change=true;$i=$x*4;$j=($x-$b['x'])*4;$alpha=$row[$i+3]*(1-$coverage)+$patch[$j+3]*$coverage;for($k=0;$k<3;$k++){$row[$i+$k]=$alpha>0?($row[$i+$k]*$row[$i+3]*(1-$coverage)+$patch[$j+$k]*$patch[$j+3]*$coverage)/$alpha:0;}$row[$i+3]=$alpha;}
            if($change){$result->importImagePixels(0,$y,$w,1,'RGBA',Imagick::PIXEL_DOUBLE,$row);}
        }
        if(!$selected){throw new RuntimeException('Paint an area to fix first.');}
        $depth=$source->getImageDepth()>8?16:8;$result->setImageDepth($depth);$result->setOption('png:bit-depth',(string)$depth);$result->setImageFormat('png');$result->setOption('png:color-type','6');$result->setImagePage(0,0,0,0);$bytes=$result->getImageBlob();$check=new Imagick();$check->readImageBlob($bytes);$tolerance=1/65535/2;
        for($y=0;$y<$h;$y++){$m=$mask->exportImagePixels(0,$y,$w,1,'A',Imagick::PIXEL_DOUBLE);$old=$source->exportImagePixels(0,$y,$w,1,'RGBA',Imagick::PIXEL_DOUBLE);$new=$check->exportImagePixels(0,$y,$w,1,'RGBA',Imagick::PIXEL_DOUBLE);foreach($m as $x=>$coverage){if($coverage>0){continue;}for($k=0;$k<4;$k++){if(abs($old[$x*4+$k]-$new[$x*4+$k])>$tolerance){throw new RuntimeException('Protected pixels changed at '.$x.','.$y.' channel '.$k.' ('.$old[$x*4+$k].' / '.$new[$x*4+$k].'). No repair was saved.');}}}}
        foreach($profile as $name=>$value){if($check->getImageProfile($name)!==$value){throw new RuntimeException('The colour profile could not be preserved.');}}
        $before=$source->getImageResolution();$after=$check->getImageResolution();$bu=$source->getImageUnits()===Imagick::RESOLUTION_PIXELSPERCENTIMETER?2.54:1;$au=$check->getImageUnits()===Imagick::RESOLUTION_PIXELSPERCENTIMETER?2.54:1;foreach(array('x','y') as $axis){if(abs($before[$axis]*$bu-$after[$axis]*$au)>.03){throw new RuntimeException('Image resolution metadata could not be preserved.');}}
        $check->clear();$result->clear();return $bytes;
    }
    public static function fix($q) {
        if(!class_exists('Imagick')){return self::error('Fix needs the server image tools.');}
        @set_time_limit(180);$id=(string)$q->get_param('job');if(!preg_match('/^[a-f0-9-]{36}$/D',$id)){return self::error('Start a new repair.');}
        SBS_Storage::ensure_directories();$dir=SBS_Storage::base_dir().'/fix';if(!is_dir($dir)){wp_mkdir_p($dir);}$path=$dir.'/'.$id.'.json';$lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::error('This repair is already being processed.',409);}
        try {
            $job=is_file($path)?json_decode(file_get_contents($path),true):null;$op=$q->get_param('operation');
            if(!$job) {
                if($op!=='start'||$q->get_param('consent')!==true){return self::error('Start a repair and confirm the provider cost.');}
                $a=SBS_Storage::get_asset((int)$q->get_param('source'));if(!$a||!SBS_Final_Print::intact($a)||!in_array($a['mime'],array('image/png','image/jpeg','image/webp'),true)){return self::error('The selected original is unavailable.');}
                $source=new Imagick(SBS_Storage::absolute_path($a));if(!in_array($source->getImageColorspace(),array(Imagick::COLORSPACE_RGB,Imagick::COLORSPACE_SRGB),true)){return self::error('Choose RGB artwork for a protected repair. No AI request was made.');}if($source->getNumberImages()!==1||$source->getImageWidth()*$source->getImageHeight()>20000000){return self::error('Use a single image up to 20 million pixels.');}
                $maskUrl=(string)$q->get_param('mask');if(strlen($maskUrl)>16000000||!preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#D',$maskUrl,$match)){return self::error('Paint a selection first.');}
                $mask=new Imagick();$mask->readImageBlob(base64_decode($match[1],true));$w=$source->getImageWidth();$h=$source->getImageHeight();if($mask->getImageWidth()!==$w||$mask->getImageHeight()!==$h){return self::error('Selection dimensions do not match the original.');}
                $left=$w;$top=$h;$right=-1;$bottom=-1;for($y=0;$y<$h;$y++){foreach($mask->exportImagePixels(0,$y,$w,1,'A',Imagick::PIXEL_DOUBLE) as $x=>$v){if($v>0){$left=min($left,$x);$right=max($right,$x);$top=min($top,$y);$bottom=max($bottom,$y);}}}if($right<0){return self::error('Paint an area first.');}
                $b=array('x'=>max(0,$left-96),'y'=>max(0,$top-96));$b['w']=min($w,$right+97)-$b['x'];$b['h']=min($h,$bottom+97)-$b['y'];if($b['w']*$b['h']>4000000){return self::error('Select a smaller local area; repair context is limited to four million pixels.');}
                $crop=clone $source;$crop->cropImage($b['w'],$b['h'],$b['x'],$b['y']);$crop->setImagePage(0,0,0,0);$crop->setImageFormat('png');
                $providerMask=clone $mask;$providerMask->cropImage($b['w'],$b['h'],$b['x'],$b['y']);$providerMask->setImagePage(0,0,0,0);$providerMask->negateImage(false,Imagick::CHANNEL_ALPHA);$providerMask->setImageFormat('png');
                $input=SBS_Storage::store_bytes($crop->getImageBlob(),'fix-context.png','image/png','fix',0,'fix_context','Repair context');$pm=SBS_Storage::store_bytes($providerMask->getImageBlob(),'fix-provider-mask.png','image/png','fix',0,'fix_mask','Provider edit mask');$savedMask=SBS_Storage::store_bytes($mask->getImageBlob(),'fix-selection.png','image/png','fix',0,'fix_selection','Confirmed selection');foreach(array($input,$pm,$savedMask) as $asset){if(is_wp_error($asset)){return $asset;}}
                $replacement=sanitize_textarea_field((string)$q->get_param('replacement'));if(strlen($replacement)>500){return self::error('Keep the replacement instruction under 500 characters.');}
                $job=array('status'=>'submitting','source'=>$a,'mask'=>$savedMask,'bounds'=>$b,'replacement'=>$replacement,'created_at'=>gmdate('c'));self::save($path,$job);
                $prompt=($replacement!==''?'Replace only the selected object with: '.$replacement:'Remove only the selected object and naturally complete the surrounding background, including transparency where appropriate.').' Preserve the same crop framing, art style, correct anatomy, lettering and colour. Preserve all unselected details. Normal skin, clothes and boots must remain normal.';
                $response=SBS_OpenAI::submit_image($prompt,array($input['id']),array('purpose'=>'local_fix','action'=>'edit','quality'=>'high','size'=>'auto','background'=>'transparent','mask_asset_id'=>$pm['id']));
                if(is_wp_error($response)){ $job['status']='uncertain';self::save($path,$job);return $response; }$job['response_id']=$response['id']??'';self::save($path,$job);
            }
            if($op==='cancel') {if(!empty($job['response_id'])&&empty($job['preview'])){$cancel=SBS_OpenAI::cancel($job['response_id']);if(is_wp_error($cancel)){return $cancel;}}$job['status']='cancelled';self::save($path,$job);return array('status'=>'cancelled');}
            if($op==='accept') {
                if(empty($job['preview'])||!in_array($job['status'],array('ready','accepted'),true)){return self::error('Wait for a verified preview before saving.');}
                if(empty($job['workspace'])){$record=SBS_Finishing::import_fix($job['source'],$job['preview'],(string)$q->get_param('title'),(string)$q->get_param('series'),$id);if(is_wp_error($record)){return $record;}$job['workspace']=$record['uuid'];$job['status']='accepted';self::save($path,$job);}
                return array('status'=>'accepted','workspace'=>$job['workspace'],'preview'=>$job['preview']);
            }
            if(in_array($job['status'],array('cancelled','uncertain','failed'),true)){return self::error($job['error']??'This request stopped. An uncertain provider submission will not be charged again automatically.');}
            if(!empty($job['preview'])){return array('status'=>'ready','preview'=>$job['preview'],'outside_selection'=>'PASS — all protected pixels verified');}
            if(empty($job['response_id'])){return self::error('Provider submission is uncertain. This request will not be repeated automatically.');}
            if(empty($job['generated'])) {
                $response=SBS_OpenAI::poll($job['response_id']);if(is_wp_error($response)){return $response;}$p=SBS_OpenAI::parse_image_response($response);if(in_array($p['status']??'',array('queued','in_progress'),true)){return array('status'=>'pending');}
                if(($p['status']??'')!=='completed'){$job['status']='failed';$job['error']=$p['error']['message']??'The provider could not complete this repair.';self::save($path,$job);return self::error($job['error']);}
                $g=SBS_Storage::store_bytes($p['bytes'],'fix-generated.png','image/png','fix',0,'fix_generated','Unapproved provider patch');if(is_wp_error($g)){return $g;}$job['generated']=$g;self::save($path,$job);
            }
            if(!SBS_Final_Print::intact($job['source'])||!SBS_Final_Print::intact($job['mask'])){return self::error('The original or selection failed its checksum.');}
            $source=new Imagick(SBS_Storage::absolute_path($job['source']));$mask=new Imagick(SBS_Storage::absolute_path($job['mask']));$gen=new Imagick(SBS_Storage::absolute_path($job['generated']));
            $bytes=self::protected_patch($source,$mask,$gen,$job['bounds']);$a=SBS_Storage::store_bytes($bytes,'fix-preview.png','image/png','fix',0,'fix_preview','Verified local repair',array('outside_selection_verified'=>true,'source_sha256'=>$job['source']['sha256']));if(is_wp_error($a)){return $a;}$job['preview']=$a;$job['status']='ready';self::save($path,$job);return array('status'=>'ready','preview'=>$a,'outside_selection'=>'PASS — all protected pixels verified');
        } catch(Throwable $e){return self::error($e->getMessage());} finally {flock($lock,LOCK_UN);fclose($lock);}
    }
}
