<?php
if (!defined('ABSPATH')) { exit; }
/** Web-only compositions. Never rewrites a finishing workspace or production master. */
final class SBS_Mockups
{
    public static function register_routes()
    {
        foreach(array('library'=>array('GET','library'),'upload'=>array('POST','upload'),'template'=>array('POST','template'),'expand'=>array('POST','expand')) as $path=>$r){register_rest_route(SBS_REST::NS,'/mockups/'.$path,array('methods'=>$r[0],'callback'=>array(__CLASS__,$r[1]),'permission_callback'=>array('SBS_Finishing','permission')));}
    }
    private static function error($s,$status=422){return SBS_Finishing::error('mockups',$s,$status);}
    public static function artwork($r)
    {
        foreach(array('branded','finished') as $k){$v=$r['final_print'][$k]??null;if($v&&!empty($v['approval'])&&($v['approval']['sha256']??'')===($v['asset']['sha256']??null)){return $v['asset'];}}
        $approval=$r['approval']??array();foreach($r['versions']??array() as $v){if(($v['uuid']??'')===($approval['version']??null)&&($v['asset']['sha256']??'')===($approval['sha256']??null)){return $v['asset'];}}
        return null;
    }
    public static function library()
    {
        $templates=array_values((array)get_option('sbs_mockup_templates',array()));
        $known=array();foreach($templates as $t){$known[$t['asset']['sha256']]=true;}
        foreach((array)get_option('sbs_final_library',array()) as $t){if(($t['kind']??'')==='template'&&empty($t['archived'])&&empty($known[$t['asset']['sha256']])){$t['revision']=0;$t['mask']=null;$t['calibration']=null;$t['legacy']=true;$templates[]=$t;}}
        $art=array();foreach(glob(SBS_Storage::base_dir().'/finishing/*.json')?:array() as $path){$r=json_decode(@file_get_contents($path),true);if(!is_array($r)){continue;}$a=self::artwork($r);if($a){$art[]=array('id'=>$r['uuid'],'title'=>$r['title'],'series'=>$r['series']??'','asset'=>$a);}}
        return array('templates'=>$templates,'artwork'=>$art,'production_approval'=>false);
    }
    public static function upload($q)
    {
        $file=$q->get_file_params()['file']??null;$kind=$q->get_param('kind');
        if(!in_array($kind,array('template','artwork'),true)||!$file||!empty($file['error'])||($file['size']??0)>64*1024*1024){return self::error('Choose an image up to 64 MB.');}
        $size=@getimagesize($file['tmp_name']);if(!$size||!in_array($size['mime'],array('image/png','image/jpeg','image/webp'),true)||$size[0]*$size[1]>40000000){return self::error('Use a PNG, JPEG or WebP up to 40 million pixels.');}
        $key=(string)$q->get_param('request_id');$lock=null;$path=null;
        if($kind==='template'&&$key!==''){
            if(!preg_match('/^[a-f0-9-]{36}$/D',$key)){return self::error('Choose the photo again to start a valid import.');}
            SBS_Storage::ensure_directories();$dir=SBS_Storage::base_dir().'/mockups';if(!is_dir($dir)){wp_mkdir_p($dir);}$path=$dir.'/import-'.$key.'.json';$lock=fopen($path.'.lock','c');
            if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::error('This photo is already importing. Wait, then retry the same import.',409);}
        }
        try{
            $hash=hash_file('sha256',$file['tmp_name']);
            if($path&&is_file($path)){$saved=json_decode(file_get_contents($path),true);if(!$saved||$saved['sha256']!==$hash){return self::error('This import belongs to a different file. Choose the photo again.',409);}$a=SBS_Storage::get_asset($saved['asset_id']);if(!$a||!SBS_Final_Print::intact($a)){return self::error('The retained photo is unavailable. Choose the photo again.');}return array('asset'=>$a,'width'=>$size[0],'height'=>$size[1],'reused'=>true);}
            $a=SBS_Storage::store_upload($file,'mockups',0,'mockup_'.$kind,sanitize_text_field($file['name']));if(is_wp_error($a)){return $a;}
            if($path&&!self::save_job($path,array('sha256'=>$hash,'asset_id'=>$a['id']))){return self::error('The photo was stored but import tracking could not be saved. Reopen your saved work before retrying.');}
            return array('asset'=>$a,'width'=>$size[0],'height'=>$size[1]);
        }finally{if($lock){flock($lock,LOCK_UN);fclose($lock);}}
    }
    public static function calibration($s)
    {
        if(!is_array($s)||!isset($s['quad'])||!is_array($s['quad'])||count($s['quad'])!==4){return self::error('Set the four print-area corners.');}
        $quad=array();foreach($s['quad'] as $p){if(!is_array($p)||count($p)!==2||!is_numeric($p[0])||!is_numeric($p[1])||!is_finite((float)$p[0])||!is_finite((float)$p[1])||$p[0]<0||$p[0]>1||$p[1]<0||$p[1]>1){return self::error('Keep print-area corners inside the photo.');}$quad[]=array((float)$p[0],(float)$p[1]);}
        $sign=null;for($i=0;$i<4;$i++){$a=$quad[$i];$b=$quad[($i+1)%4];$c=$quad[($i+2)%4];$cross=($b[0]-$a[0])*($c[1]-$b[1])-($b[1]-$a[1])*($c[0]-$b[0]);if(abs($cross)<.0001||($sign!==null&&$cross*$sign<=0)){return self::error('Use four corners in order: top left, top right, bottom right, bottom left. Corners must not cross.');}$sign=$cross;}
        return array('quad'=>$quad,'reviewed'=>true,'perspective'=>'Owner-calibrated approximate photo plane; not physical garment measurement','occlusions'=>'Owner garment mask excludes hands, hair, neck and foreground objects');
    }
    public static function template($q)
    {
        $asset=SBS_Storage::get_asset((int)$q->get_param('asset_id'));$file=$q->get_file_params()['mask']??null;$s=json_decode((string)$q->get_param('calibration'),true);$s=self::calibration($s);
        if(is_wp_error($s)){return $s;}
        if(!$asset||!SBS_Final_Print::intact($asset)||!in_array($asset['mime'],array('image/png','image/jpeg','image/webp'),true)||!$file||!empty($file['error'])||($file['size']??0)>10*1024*1024||$q->get_param('reviewed')!=='1'){return self::error('Review the shirt-only mask and print corners before saving.');}
        $size=@getimagesize($file['tmp_name']);$source=@getimagesize(SBS_Storage::absolute_path($asset));if($source&&class_exists('Imagick')){$probe=new Imagick(SBS_Storage::absolute_path($asset));$probe->autoOrient();$source[0]=$probe->getImageWidth();$source[1]=$probe->getImageHeight();$probe->clear();}if(!$size||$size['mime']!=='image/png'||$size[0]*$size[1]>4000000||!$source||abs($size[0]/$size[1]-$source[0]/$source[1])>.01){return self::error('The mask must be a PNG matching the photo proportions, up to four million pixels.');}
        $label=sanitize_text_field((string)$q->get_param('label'));if($label===''||strlen($label)>180){return self::error('Enter a short template name.');}
        SBS_Storage::ensure_directories();$lock=fopen(SBS_Storage::base_dir().'/mockups-library.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::error('The template library is busy. Try again.');}
        try{$items=(array)get_option('sbs_mockup_templates',array());$id=(string)$q->get_param('id');$old=$items[$id]??null;
            if($old&&((int)$q->get_param('revision')!==$old['revision']||$old['asset']['sha256']!==$asset['sha256'])){return self::error('This template changed elsewhere. Reopen it before saving.',409);}
            if(!$old){$id=wp_generate_uuid4();}
            $mask=SBS_Storage::store_upload($file,'mockups',0,'mockup_mask',$label.' shirt-only mask');if(is_wp_error($mask)){return $mask;}
            $history=$old['history']??array();if($old){$history[]=array('mask'=>$old['mask'],'calibration'=>$old['calibration'],'revision'=>$old['revision']);}
            $item=array('id'=>$id,'label'=>$label,'asset'=>$asset,'mask'=>$mask,'calibration'=>$s,'revision'=>($old['revision']??0)+1,'source_note'=>sanitize_textarea_field((string)$q->get_param('source_note')),'history'=>$history,'created_at'=>$old['created_at']??gmdate('c'));
            $items[$id]=$item;if(!update_option('sbs_mockup_templates',$items,false)){return self::error('The template was not saved. Retry; the original photo is retained.');}return array('template'=>$item);
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function frame($w,$h,$ratio,$anchor)
    {
        if(!is_numeric($ratio)||!is_finite((float)$ratio)||$ratio<.4||$ratio>2.5||$w<1||$h<1){return self::error('Choose an output ratio between 0.4 and 2.5.');}
        if(!is_int($anchor)||$anchor<0||$anchor>8){return self::error('Choose one of the nine anchors.');}
        $ow=max($w,(int)ceil($h*$ratio));$oh=max($h,(int)ceil($w/$ratio));
        if($ow*$oh>9000000||max($ow,$oh)>6000){return self::error('This expanded web canvas is too large. Use a smaller working photo.');}
        return array('width'=>$ow,'height'=>$oh,'x'=>(int)round(($ow-$w)*($anchor%3)/2),'y'=>(int)round(($oh-$h)*floor($anchor/3)/2),'protected_width'=>$w,'protected_height'=>$h);
    }
    /** Paste the protected source back with COPY; even a provider interior redraw cannot change it. */
    public static function restore($generated,$source,$frame)
    {
        $generated->resizeImage($frame['width'],$frame['height'],Imagick::FILTER_LANCZOS,1,false);
        $generated->setImageAlphaChannel(Imagick::ALPHACHANNEL_SET);$generated->compositeImage($source,Imagick::COMPOSITE_COPY,$frame['x'],$frame['y']);$generated->setImagePage(0,0,0,0);$generated->setImageFormat('png32');return $generated;
    }
    private static function save_job($path,$job){$tmp=$path.'.tmp';$s=wp_json_encode($job);if(file_put_contents($tmp,$s,LOCK_EX)!==strlen($s)||!rename($tmp,$path)){@unlink($tmp);return false;}@chmod($path,0640);return true;}
    public static function expand($q)
    {
        if(function_exists('set_time_limit')&&((int)ini_get('max_execution_time')>0)&&(int)ini_get('max_execution_time')<180){@set_time_limit(180);}
        if(!class_exists('Imagick')){return self::error('AI expansion needs the server image tools. Your ordinary mock-up is still downloadable.');}
        $id=(string)$q->get_param('job');if(!preg_match('/^[a-f0-9-]{36}$/D',$id)){return self::error('Start expansion from Finish & Check.');}
        SBS_Storage::ensure_directories();$dir=SBS_Storage::base_dir().'/mockups';if(!is_dir($dir)){wp_mkdir_p($dir);}$path=$dir.'/'.$id.'.json';$lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::error('Expansion is already being checked. Wait and retry.');}
        try{$job=is_file($path)?json_decode(file_get_contents($path),true):null;
            if(!$job){
                if($q->get_param('operation')!=='start'||$q->get_param('consent')!==true||!in_array($q->get_param('mode'),array('smart','scene'),true)){return self::error('Select an expansion mode and intentionally run Finish & Check.');}
                $asset=SBS_Storage::get_asset((int)$q->get_param('asset_id'));if(!$asset||!in_array(($asset['role']??''),array('mockup_template','final_template'),true)||!SBS_Final_Print::intact($asset)){return self::error('Upload a mock-up photo before expanding it.');}
                $source=new Imagick(SBS_Storage::absolute_path($asset));$source->setIteratorIndex(0);$source->autoOrient();if(max($source->getImageWidth(),$source->getImageHeight())>1600){$source->thumbnailImage(1600,1600,true);}$source->setImageFormat('png32');$w=$source->getImageWidth();$h=$source->getImageHeight();
                $frame=self::frame($w,$h,$q->get_param('ratio'),$q->get_param('anchor'));if(is_wp_error($frame)){return $frame;}
                if($frame['width']===$w&&$frame['height']===$h){return array('status'=>'unchanged','frame'=>$frame,'asset'=>$asset);}
                $canvas=new Imagick();$canvas->newImage($frame['width'],$frame['height'],new ImagickPixel('transparent'),'png');$canvas->compositeImage($source,Imagick::COMPOSITE_COPY,$frame['x'],$frame['y']);
                $mask=new Imagick();$mask->newImage($frame['width'],$frame['height'],new ImagickPixel('transparent'),'png');$draw=new ImagickDraw();$draw->setFillColor('white');$draw->rectangle($frame['x'],$frame['y'],$frame['x']+$w-1,$frame['y']+$h-1);$mask->drawImage($draw);
                $input=SBS_Storage::store_bytes($canvas->getImageBlob(),'expansion-input.png','image/png','mockups',0,'mockup_expansion_input','Protected scene input');$m=SBS_Storage::store_bytes($mask->getImageBlob(),'expansion-mask.png','image/png','mockups',0,'mockup_expansion_mask','Protected scene mask');$protected=SBS_Storage::store_bytes($source->getImageBlob(),'protected-photo.png','image/png','mockups',0,'mockup_protected','Protected web-resolution photo');$canvas->clear();$mask->clear();$source->clear();if(is_wp_error($input)||is_wp_error($m)||is_wp_error($protected)){return self::error('Expansion input could not be saved.');}
                $job=array('status'=>'submitting','frame'=>$frame,'source'=>$protected,'mode'=>$q->get_param('mode'),'created_at'=>gmdate('c'));if(!self::save_job($path,$job)){return self::error('Could not save the expansion checkpoint. No AI request was started.');}
                $prompt='Extend only the transparent outer canvas of this photograph. Keep the original rectangle exactly unchanged, including the model, white T-shirt, hands, body and background. Do not add any text, design or logo to the shirt. '.($job['mode']==='smart'?'Continue background and environment only; do not invent additional anatomy.':'Continue the scene naturally, including plausible body continuation where necessary; use normal skin, clothing and shoes, never artificial scale patterns.').' Output a coherent photographic expanded scene. The original interior is protected and will be restored pixel-for-pixel.';
                $extra=sanitize_textarea_field((string)$q->get_param('instructions'));if($extra!==''){$prompt.=' Additional owner scene directions: '.substr($extra,0,1000);}
                $response=SBS_OpenAI::submit_image($prompt,array($input['id']),array('action'=>'edit','purpose'=>'mockup_outpaint','mask_asset_id'=>$m['id'],'quality'=>'medium','size'=>$frame['height']>$frame['width']?'1024x1536':'1536x1024'));
                if(is_wp_error($response)||empty($response['id'])){$job['status']='uncertain';self::save_job($path,$job);return self::error('Expansion submission was not confirmed. Do not start a duplicate paid request; your original mock-up remains downloadable.');}
                $job['response_id']=$response['id'];$job['status']='processing';if(!self::save_job($path,$job)){return self::error('Expansion tracking could not be saved. Do not resubmit.');}
                return array('status'=>'processing','job'=>$id,'frame'=>$frame);
            }
            if($job['status']==='complete'){return array('status'=>'complete','asset'=>$job['asset'],'frame'=>$job['frame'],'review'=>$job['review']??null);}
            if($job['status']!=='processing'){return self::error('This expansion is stopped or uncertain. The existing mock-up remains available; no automatic resubmission is made.');}
            $response=SBS_OpenAI::poll($job['response_id']);if(is_wp_error($response)){return self::error('Could not check expansion yet. Resume this same job; do not submit again.');}$parsed=SBS_OpenAI::parse_image_response($response);
            if(in_array($parsed['status'],array('queued','in_progress'),true)){return array('status'=>'processing','job'=>$id,'frame'=>$job['frame']);}
            if($parsed['status']!=='completed'){$job['status']='failed';self::save_job($path,$job);return self::error('AI did not produce an expanded scene. The normal mock-up is retained for Download.');}
            $size=@getimagesizefromstring($parsed['bytes']);if(!$size||$size[0]*$size[1]>12000000){return self::error('The generated canvas was not a usable image.');}
            $im=new Imagick();$im->readImageBlob($parsed['bytes']);$source=new Imagick(SBS_Storage::absolute_path($job['source']));$im=self::restore($im,$source,$job['frame']);$source->clear();$out=SBS_Storage::store_bytes($im->getImageBlob(),'expanded-web-photo.png','image/png','mockups',0,'mockup_expanded','Expanded scene — web only');$im->clear();if(is_wp_error($out)){return $out;}
            $job['asset']=$out;$job['status']='complete';$job['review']=array('status'=>'NEEDS ATTENTION','message'=>'Inspect generated outer scenery/body continuation. Original photo pixels are restored exactly at web working resolution; this is not approval for production.');if(!self::save_job($path,$job)){return self::error('Expanded result saved but its checkpoint could not be committed. Resume the same job.');}
            // The completed-image checkpoint precedes optional vision review; a timeout never resubmits generation.
            if(SBS_OpenAI::is_configured()){
                try{$url=SBS_Storage::data_url($out['id']);if(!is_wp_error($url)){$review=SBS_OpenAI::review_logic_correction('custom',array(array('label'=>'Expanded mock-up photo','data_url'=>$url)),array(),array('Check only print-visible/normal web-viewing-size problems in this expanded photograph: invented anatomy, extra limbs, body continuation, hands, implausible clothes, background joins and detached-looking shirt/fabric. Do not redraw anything. Original photo pixels were restored, so focus on newly generated outer areas. Report uncertainty, not certainty.'));if(!is_wp_error($review)){$job['review']['findings']=$review['findings'];$job['review']['message']='AI outer-scene observations plus required owner review; not a guarantee.';}}}catch(Throwable $e){$job['review']['message'].=' Visual AI review unavailable; inspect manually.';}
                self::save_job($path,$job);
            }
            return array('status'=>'complete','asset'=>$out,'frame'=>$job['frame'],'review'=>$job['review']);
        }catch(Throwable $e){return self::error('The scene expansion could not finish (' . get_class($e) . ', mock-ups line ' . $e->getLine() . '). Download still offers the last usable composition.');}finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}
