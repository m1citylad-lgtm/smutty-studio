<?php
if (!defined('ABSPATH')) { exit; }

/** Isolated, local-only finishing workspaces. UUIDs are NOT allocated AF references. */
final class SBS_Finishing
{
    public static function register_routes()
    {
        foreach (array('' => array('GET','listing'), '/upload' => array('POST','upload'), '/(?P<uuid>[a-f0-9-]{36})' => array('GET','get'), '/(?P<uuid>[a-f0-9-]{36})/action' => array('POST','action')) as $path => $route) {
            register_rest_route(SBS_REST::NS, '/finishing'.$path, array('methods'=>$route[0], 'callback'=>array(__CLASS__,$route[1]), 'permission_callback'=>array(__CLASS__,'permission')));
        }
    }
    public static function csrf()
    {
        return hash_hmac('sha256', 'finishing|'.(string)($_COOKIE[SBS_Auth::COOKIE] ?? ''), wp_salt('nonce'));
    }
    public static function permission($request)
    {
        $permission = SBS_REST::permission($request);
        if (is_wp_error($permission) || !$permission) { return $permission; }
        if ($request->get_method() !== 'GET' && !hash_equals(self::csrf(), (string)$request->get_header('x-sbs-finishing'))) {
            return self::error('csrf','Reload Studio and try again.',403);
        }
        return true;
    }
    public static function error($code,$message,$status=400) { return new WP_Error('finishing_'.$code,$message,array('status'=>$status)); }
    private static function directory()
    {
        if (!SBS_Storage::ensure_directories()) { return self::error('storage','Private storage is unavailable.',503); }
        $dir = SBS_Storage::base_dir().'/finishing';
        if (!is_dir($dir) && !wp_mkdir_p($dir)) { return self::error('storage','Cannot create local workspace.',503); }
        return $dir;
    }
    private static function path($uuid)
    {
        if (!is_string($uuid) || !preg_match('/^[a-f0-9-]{36}$/D',$uuid)) { return self::error('uuid','Invalid workspace reference.'); }
        $dir=self::directory(); return is_wp_error($dir)?$dir:$dir.'/'.$uuid.'.json';
    }
    private static function read($path)
    {
        $record=is_file($path)?json_decode(file_get_contents($path),true):null;
        return is_array($record)?$record:self::error('missing','Local workspace not found.',404);
    }
    private static function write($path,$record)
    {
        $tmp=$path.'.'.bin2hex(random_bytes(6)).'.tmp';
        $bytes=wp_json_encode($record,JSON_PRETTY_PRINT);
        if (file_put_contents($tmp,$bytes,LOCK_EX)!==strlen($bytes)) { @unlink($tmp); return self::error('save','Workspace could not be saved.',500); }
        @chmod($tmp,0640);
        if (!rename($tmp,$path)) { @unlink($tmp); return self::error('save','Workspace could not be committed.',500); }
        return $record;
    }
    public static function listing()
    {
        $dir=self::directory(); if(is_wp_error($dir)){return $dir;}
        $records=array();
        foreach (glob($dir.'/*.json') ?: array() as $path) {
            $r=self::read($path); if(!is_wp_error($r)){$records[]=$r;}
        }
        usort($records,function($a,$b){return strcmp($b['updated_at'],$a['updated_at']);});
        return array('mode'=>'local_preview','records'=>array_slice($records,0,200),'drive_writes_enabled'=>false,'af_register'=>'1LQQAciLLM77nQTiUqaQcOvrpFlUyAWFymX3jWIt8Kb8');
    }
    public static function get($request)
    {
        $path=self::path($request['uuid']); return is_wp_error($path)?$path:self::read($path);
    }
    public static function links($ideas,$sb)
    {
        if(!is_array($ideas)||count($ideas)>20||!is_string($sb)){return self::error('links','Use IDEA-### and SB#### references.');}
        foreach($ideas as $id){if(!is_string($id)||!preg_match('/^IDEA-\d{3,}$/D',$id)){return self::error('links','Use IDEA-### references.');}}
        if($sb!==''&&!preg_match('/^SB\d{4,}$/D',$sb)){return self::error('links','Use an existing SB#### reference.');}
        return array('idea_ids'=>array_values(array_unique($ideas)),'sb_id'=>$sb,'verified'=>false);
    }
    public static function options($input)
    {
        if(!is_array($input)){return self::error('options','Invalid processing options.');}
        $method=$input['method']??'inspect';
        if(!in_array($method,array('inspect','resize','sharpen','upscale'),true)){return self::error('method','This stage is not available. No image was changed.');} if($method==='upscale'&&!SBS_Replicate::is_configured()){return self::error('replicate_not_configured','Add your Replicate API token in Studio Settings before using AI upscale. No image was sent or changed.',503);}
        $width=$input['width']??15; $height=$input['height']??18;
        if(!is_numeric($width)||!is_numeric($height)||!is_finite((float)$width)||!is_finite((float)$height)||$width<1||$width>30||$height<1||$height>30){return self::error('size','Choose print dimensions from 1 to 30 inches.');}
        $notes=$input['notes']??'';
        if(!is_string($notes)||strlen($notes)>12000){return self::error('notes','Keep correction notes within 12000 bytes.');}
        return array('method'=>$method,'width'=>(float)$width,'height'=>(float)$height,'ppi'=>300,'notes'=>sanitize_textarea_field($notes),'preserve_texture'=>true,'generative_redraw'=>false,'provider'=>$method==='upscale'?'Replicate':null,'model'=>$method==='upscale'?'nightmareai/real-esrgan':null,'estimated_provider_cost'=>$method==='upscale'?(float)get_option('sbs_replicate_cost_per_image','0.002'):0);
    }
    public static function inspect($asset,$options)
    {
        $path=SBS_Storage::absolute_path($asset); $size=@getimagesize($path);
        if(!$size){return self::error('image','The image could not be inspected.');}
        $ppi=min($size[0]/$options['width'],$size[1]/$options['height']);
        $alpha='Unknown — manual check required';
        if(function_exists('imagecreatefromstring')&&$size[0]*$size[1]<=40000000){
            $im=@imagecreatefromstring(file_get_contents($path));
            if($im){$clear=0;$partial=0;$step=max(1,(int)ceil(sqrt($size[0]*$size[1]/100000)));
                for($y=0;$y<$size[1];$y+=$step){for($x=0;$x<$size[0];$x+=$step){$c=imagecolorsforindex($im,imagecolorat($im,$x,$y));$a=$c['alpha'];if($a===127){$clear++;}elseif($a>0){$partial++;}}}
                $alpha=$partial?'Partial alpha detected (sampled)':($clear?'Transparency detected (sampled)':'No transparency detected (sampled)');imagedestroy($im);
            }
        }
        return array('width'=>$size[0],'height'=>$size[1],'mime'=>$size['mime'],'sha256'=>hash_file('sha256',$path),'effective_ppi'=>round($ppi,1),'alpha'=>$alpha,'warnings'=>array_values(array_filter(array($ppi<300?'Pixel dimensions are below 300 PPI at the selected print size.':null,'Inspect lettering, face, stars, fur, halos, deliberate texture and light/dark garment proofs.','Colour profile, source detail and visual fidelity require manual review; PPI metadata is not proof of quality.'))));
    }
    public static function upload($request)
    {
        $files=$request->get_file_params();$file=$files['file']??array();
        $max_bytes=20*1024*1024;$file_bytes=(int)($file['size']??0);
        if($file_bytes>$max_bytes){return self::error('too_large','This file is '.number_format($file_bytes/1048576,2,'.','').' MB. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.');}
        if(!empty($file['error'])||empty($file['tmp_name'])||!is_readable($file['tmp_name'])){return self::error('upload','The file did not finish uploading. Studio can receive images up to 20 MB. Try a smaller copy and upload again.');}
        $size=@getimagesize($file['tmp_name']);
        if(!$size||!in_array($size['mime']??'',array('image/png','image/jpeg','image/webp'),true)){return self::error('format','Choose a PNG, JPEG or WebP image. The original file was not changed.');}
        if($file_bytes<1||$size[0]*$size[1]>40000000){return self::error('pixels','This image is larger than the 40-million-pixel limit. Choose a smaller copy. The original file was not changed.');}
        $title=$request->get_param('title'); if(!is_string($title)||strlen($title)>500){return self::error('title','Enter a title up to 500 bytes.');}
        $links=self::links(preg_split('/[\s,]+/',trim((string)$request->get_param('ideas')),-1,PREG_SPLIT_NO_EMPTY),(string)$request->get_param('sb'));
        if(is_wp_error($links)){return $links;}
        $options=self::options(array());$uuid=wp_generate_uuid4();$path=self::path($uuid);if(is_wp_error($path)){return $path;}
        $asset=SBS_Storage::store_upload($file,'finishing',0,'finishing_original',$title);
        if(is_wp_error($asset)){return $asset;}
        $qa=self::inspect($asset,$options);if(is_wp_error($qa)){return $qa;}
        $record=array('schema'=>1,'uuid'=>$uuid,'af_id'=>null,'title'=>sanitize_text_field($title)?:$asset['filename'],'links'=>$links,'source_route'=>'device_local','original'=>$asset,'original_qa'=>$qa,'versions'=>array(),'current_version'=>null,'approval'=>null,'metadata_status'=>'TBC','status'=>'Awaiting Finishing','next_action'=>'Choose a local stage and run preview','drive'=>array('original_file_id'=>null,'folder_id'=>null,'approved_master_file_id'=>null,'verified'=>false),'created_at'=>gmdate('c'),'updated_at'=>gmdate('c'),'revision'=>1,'audit'=>array(array('at'=>gmdate('c'),'action'=>'Untouched original stored locally')));
        return self::write($path,$record);
    }
    public static function action($request)
    {
        $path=self::path($request['uuid']);if(is_wp_error($path)){return $path;}
        $lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::error('busy','Workspace is busy. Retry after refreshing.',409);}
        try {
            $r=self::read($path);if(is_wp_error($r)){return $r;}
            if((int)$request->get_param('revision')!==$r['revision']){return self::error('conflict','Workspace changed. Refresh before retrying.',409);}
            $action=$request->get_param('action');
            if($action==='prepare'){
                $o=self::options($request->get_param('options'));if(is_wp_error($o)){return $o;}
                $r['pending']=$o;$r['status']='Queued';$r['approval']=null;$r['next_action']='Run queued local stage or cancel';
            } elseif($action==='cancel'){
                if(empty($r['pending'])){return self::error('state','No queued stage to cancel.');}
                if(!empty($r['pending']['replicate_prediction_id'])){$canceled=SBS_Replicate::cancel($r['pending']['replicate_prediction_id']);if(is_wp_error($canceled)){return $canceled;}}
                unset($r['pending']);$r['processing_error']=null;$r['status']=$r['current_version']?'Awaiting Review':'Awaiting Finishing';$r['next_action']='Review or retry a stage';
            } elseif($action==='run'){
                if(empty($r['pending'])){return self::error('state','Queue a stage first.');}
                if($r['pending']['method']==='upscale'){$r=self::start_upscale($r);if(is_wp_error($r)){return $r;}}
                else{$v=self::process($r,$r['pending']);if(is_wp_error($v)){return $v;}$r['versions'][]=$v;$r['current_version']=$v['uuid'];$r['approval']=null;unset($r['pending']);$r['status']='Awaiting Review';$r['next_action']='Compare original and candidate; complete human review';}
            } elseif($action==='poll'){
                if(empty($r['pending']['replicate_prediction_id'])){return self::error('state','No Replicate upscale is running.');}
                $prediction=SBS_Replicate::poll($r['pending']['replicate_prediction_id']);if(is_wp_error($prediction)){return $prediction;}
                $remote_status=$prediction['status']??'';
                if(in_array($remote_status,array('succeeded','successful'),true)){$v=self::replicate_version($r,$r['pending'],$prediction);if(is_wp_error($v)){return $v;}$r['versions'][]=$v;$r['current_version']=$v['uuid'];$r['approval']=null;unset($r['pending']);$r['status']='Awaiting Review';$r['next_action']='Compare original and AI-upscaled candidate; complete human review';$r['processing_error']=null;}
                elseif(in_array($remote_status,array('failed','canceled'),true)){$r['processing_error']='Replicate upscale '.$remote_status.(!empty($prediction['error'])?': '.sanitize_text_field((string)$prediction['error']):'.').' The original is unchanged. You can retry or choose another stage.';unset($r['pending']);$r['status']=$r['current_version']?'Awaiting Review':'Awaiting Finishing';$r['next_action']='Review the existing version or retry a stage';}
                else{$r['status']='AI upscale processing on Replicate';$r['next_action']='Wait for the Replicate result; the original remains unchanged';}

            } elseif($action==='select'){
                $uuid=$request->get_param('version');$found=false;foreach($r['versions'] as $v){if($v['uuid']===$uuid){$found=true;}}
                if(!$found){return self::error('version','Version not found.');}
                $r['current_version']=$uuid;$r['approval']=null;unset($r['pending']);$r['status']='Awaiting Review';$r['next_action']='Review this version again';
            } elseif($action==='approve'){
                if($r['status']!=='Awaiting Review'){return self::error('state','Run or select a candidate first.');}
                $checks=$request->get_param('checks');
                foreach(array('identity','lettering','texture','garments','warnings') as $check){if(!is_array($checks)||($checks[$check]??false)!==true){return self::error('review','Complete every human review check before local approval.');}}
                $v=self::current($r);if(!$v||!self::intact($r['original'])||!self::intact($v['asset'])){return self::error('integrity','Asset checksum mismatch. Approval refused.',409);}
                $r['approval']=array('version'=>$v['uuid'],'sha256'=>$v['asset']['sha256'],'at'=>gmdate('c'),'checks'=>$checks,'scope'=>'local_finishing_only');$r['status']='Finishing Approved (local only)';$r['next_action']='Download local package; Drive save awaits integration';
            } elseif($action==='export'){
                if(empty($r['approval'])||$r['approval']['version']!==$r['current_version']){return self::error('approval','Approve the current version first.',409);}
                $package=self::package($r,$request->get_param('filename'));if(is_wp_error($package)){return $package;}return array('package'=>$package,'drive_saved'=>false,'catalogue_updated'=>false);
            } else {return self::error('action','Unsupported finishing action.');}
            $r['revision']++;$r['updated_at']=gmdate('c');$r['audit'][]=array('at'=>gmdate('c'),'action'=>$action);
            return self::write($path,$r);
        } finally {flock($lock,LOCK_UN);fclose($lock);}
    }
    private static function start_upscale($r)
    {
        if(!self::intact($r['original'])){return self::error('integrity','Original checksum mismatch. Processing refused.',409);}
        $target=$r['pending']??array();$pw=(float)($target['width']??15);$ph=(float)($target['height']??18);$ppi=min((float)($r['original_qa']['width']??0)/$pw,(float)($r['original_qa']['height']??0)/$ph);
        if($ppi>=300){return self::error('upscale_not_needed','This artwork already meets the 300 PPI pixel-dimension target at the selected print size. Use Inspect; no Replicate credits were used.',409);}
        $dimensions=@getimagesize(SBS_Storage::absolute_path($r['original']));$pixels=$dimensions?(int)$dimensions[0]*(int)$dimensions[1]:0;
        $scale=$ppi>=150?2:4;
        if($pixels*$scale*$scale>40000000&&$scale===4&&$pixels*4<=40000000){$scale=2;}
        if(!$pixels||$pixels*$scale*$scale>40000000){return self::error('upscale_size','This image would exceed Studio’s 40-million-pixel candidate limit at the safe upscale size. No Replicate request was sent.',413);}
        $prediction=SBS_Replicate::submit($r['original']['id'],$scale);if(is_wp_error($prediction)){return $prediction;}
        $status=$prediction['status']??'';
        $r['pending']['scale']=$scale;$r['pending']['provider']='Replicate';$r['pending']['model']='nightmareai/real-esrgan';$r['pending']['estimated_provider_cost']=(float)get_option('sbs_replicate_cost_per_image','0.002');
        if(in_array($status,array('succeeded','successful'),true)){$v=self::replicate_version($r,$r['pending'],$prediction);if(is_wp_error($v)){return $v;}$r['versions'][]=$v;$r['current_version']=$v['uuid'];$r['approval']=null;unset($r['pending']);$r['status']='Awaiting Review';$r['next_action']='Compare original and AI-upscaled candidate; complete human review';$r['processing_error']=null;return $r;}
        if(in_array($status,array('starting','processing','queued'),true)&&!empty($prediction['id'])){$r['pending']['replicate_prediction_id']=sanitize_text_field($prediction['id']);$r['status']='AI upscale processing on Replicate';$r['next_action']='Wait for the Replicate result; the original remains unchanged';$r['processing_error']=null;return $r;}
        return self::error('replicate_failed','Replicate did not start the upscale successfully. The original is unchanged. Check Replicate usage before retrying.',502);
    }
    private static function replicate_version($r,$options,$prediction)
    {
        $url=$prediction['output']??null;if(is_array($url)){$url=reset($url);}
        if(!is_string($url)||$url===''){return self::error('replicate_output','Replicate completed without an image output. The original is unchanged.',502);}
        $bytes=SBS_Replicate::fetch_output($url);if(is_wp_error($bytes)){return $bytes;}
        if(!function_exists('getimagesizefromstring')){return self::error('image','This server cannot validate the Replicate image output. The original is unchanged.',503);}
        $size=@getimagesizefromstring($bytes);$allowed=array('image/png','image/jpeg','image/webp');
        if(!$size||!in_array($size['mime']??'', $allowed, true)||(int)$size[0]*(int)$size[1]>40000000){return self::error('replicate_image','Replicate output is not a supported image within Studio’s 40-million-pixel limit. The original is unchanged.',422);}
        $original_size=@getimagesize(SBS_Storage::absolute_path($r['original']));
        if(!$original_size||($size[0]<=$original_size[0]&&$size[1]<=$original_size[1])){return self::error('replicate_dimensions','Replicate output did not increase either image dimension. No candidate was saved.',422);}
        $ext=$size['mime']==='image/jpeg'?'jpg':($size['mime']==='image/webp'?'webp':'png');
        $asset=SBS_Storage::store_bytes($bytes,'candidate-upscaled.'.$ext,$size['mime'],'finishing',0,'finishing_candidate',$r['title']);if(is_wp_error($asset)){return $asset;}
        $options['provider']='Replicate';$options['model']='nightmareai/real-esrgan';$options['model_version']=get_option('sbs_replicate_model_version',SBS_Replicate::DEFAULT_VERSION);$options['scale']=(int)($options['scale']??4);$options['estimated_provider_cost']=(float)get_option('sbs_replicate_cost_per_image','0.002');
        $qa=self::inspect($asset,$options);if(is_wp_error($qa)){return $qa;}
        if(preg_match('/transparency|partial alpha/i',(string)($r['original_qa']['alpha']??''))&&!preg_match('/transparency|partial alpha/i',(string)$qa['alpha'])){$qa['warnings'][]='The original contains sampled transparency but it was not detected in the AI candidate; inspect alpha edges before approval.';}
        $duration=isset($prediction['metrics']['predict_time'])?(float)$prediction['metrics']['predict_time']:null;
        return array('uuid'=>wp_generate_uuid4(),'number'=>count($r['versions'])+1,'asset'=>$asset,'options'=>$options,'qa'=>$qa,'created_at'=>gmdate('c'),'provider_result'=>array('status'=>'succeeded','prediction_id'=>sanitize_text_field((string)($prediction['id']??'')),'predict_time'=>$duration),'comparison'=>array('byte_identical'=>hash_equals($r['original']['sha256'],$asset['sha256']),'structural_detection'=>'Not run — human review required','text_face_detection'=>'Not run — human review required'));
    }
    public static function current($r){foreach($r['versions'] as $v){if($v['uuid']===$r['current_version']){return $v;}}return null;}
    private static function intact($asset){$path=SBS_Storage::absolute_path($asset);return is_file($path)&&hash_equals($asset['sha256'],hash_file('sha256',$path));}
    private static function process($r,$options)
    {
        if(!self::intact($r['original'])){return self::error('integrity','Original checksum mismatch. Processing refused.',409);}
        // Every repeat starts from the preserved original, avoiding accumulated resampling.
        $path=SBS_Storage::absolute_path($r['original']);$bytes=file_get_contents($path);$mime=$r['original']['mime'];$name=$r['original']['filename'];
        if($options['method']!=='inspect'){
            // Use WordPress's image-editor choice so hosts with Imagick but no
            // GD can still run the same conservative, local resize.
            if(!function_exists('wp_get_image_editor')){return self::error('editor','This WordPress server cannot edit images. The original is retained.',503);}
            $editor=wp_get_image_editor($path);
            if(is_wp_error($editor)){return self::error('editor','WordPress could not open this image with its available image tools. The original is retained.',503);}
            $dimensions=$editor->get_size();$w=(int)($dimensions['width']??0);$h=(int)($dimensions['height']??0);
            if($w<1||$h<1){return self::error('decode','Image dimensions could not be read. The original is retained.');}
            if($options['method']==='resize'){
                $ratio=min($options['width']*300/$w,$options['height']*300/$h);
                // Local resizing is conservative: never invent extra detail or upscale.
                $ratio=min(1,$ratio);$nw=max(1,(int)round($w*$ratio));$nh=max(1,(int)round($h*$ratio));
                // The dimensions already preserve the source aspect ratio, so
                // WordPress must scale without cropping any edge content.
                $resized=$editor->resize($nw,$nh,false);
                if(is_wp_error($resized)){return self::error('resize','WordPress could not resize this image. The original is retained.',503);}
            } else {
                // Avoid unvalidated convolution filters that can damage alpha
                // edges, lettering, or intentional print texture.
                return self::error('sharpen','Sharpening is not enabled until its effect on transparency and print texture can be verified. Use Inspect or Fit down.');
            }
            $tmp=wp_tempnam('sbs-finishing.png');
            if(!$tmp){return self::error('temp','Could not create a temporary image file. The original is retained.',503);}
            $saved=$editor->save($tmp,'image/png');
            if(is_wp_error($saved)||empty($saved['path'])||!is_readable($saved['path'])){@unlink($tmp);return self::error('save','WordPress could not save the resized PNG. The original is retained.',503);}
            $bytes=file_get_contents($saved['path']);
            if(!empty($saved['path'])&&$saved['path']!==$tmp){@unlink($saved['path']);}
            @unlink($tmp);
            if(!is_string($bytes)||$bytes===''){return self::error('save','The resized PNG could not be read. The original is retained.',503);}
            $mime='image/png';$name='candidate.png';
        }
        $asset=SBS_Storage::store_bytes($bytes,$name,$mime,'finishing',0,'finishing_candidate',$r['title']);if(is_wp_error($asset)){return $asset;}
        $qa=self::inspect($asset,$options);if(is_wp_error($qa)){return $qa;}
        return array('uuid'=>wp_generate_uuid4(),'number'=>count($r['versions'])+1,'asset'=>$asset,'options'=>$options,'qa'=>$qa,'created_at'=>gmdate('c'),'comparison'=>array('byte_identical'=>hash_equals($r['original']['sha256'],$asset['sha256']),'structural_detection'=>'Not run — human review required','text_face_detection'=>'Not run — human review required'));
    }
    private static function package_filename($title,$requested,$version)
    {
        $base=is_string($requested)&&trim($requested)!==''?$requested:$title;
        $base=preg_replace('/\.zip$/i','',$base);
        $base=remove_accents($base);
        $base=preg_replace('/[^A-Za-z0-9]+/','-',(string)$base);
        $base=trim($base,'-');
        $base=substr($base?:'Artwork',0,110);
        $base=rtrim($base,'-');
        return $base.'-v'.max(1,(int)$version).'-'.gmdate('Ymd-His').'.zip';
    }
    private static function package($r,$requested_name=null)
    {
        $v=self::current($r);
        if(!$v||!self::intact($r['original'])||!self::intact($v['asset'])||!hash_equals($r['approval']['sha256'],$v['asset']['sha256'])){return self::error('integrity','Package checksum verification failed.',409);}
        if(!class_exists('ZipArchive')){return self::error('zip','The server needs PHP ZipArchive for package downloads.',503);}
        $path=tempnam(SBS_Storage::base_dir().'/tmp','af-');$zip=new ZipArchive();
        if($zip->open($path,ZipArchive::OVERWRITE)!==true){@unlink($path);return self::error('zip','Could not build package.',500);}
        $zip->addFile(SBS_Storage::absolute_path($r['original']),'original/'.$r['original']['filename']);
        $zip->addFile(SBS_Storage::absolute_path($v['asset']),'candidate/'.$v['asset']['filename']);
        $zip->addFromString('metadata.json',wp_json_encode($r,JSON_PRETTY_PRINT));
        $zip->addFromString('report.txt',"LOCAL FINISHING PREVIEW ONLY\nNo AF number allocated. No Drive/catalogue writes. Not an SB production approval.\n".wp_json_encode($v['qa'],JSON_PRETTY_PRINT)."\nOriginal SHA-256: ".$r['original']['sha256']."\nCandidate SHA-256: ".$v['asset']['sha256']."\nHuman local approval: ".$r['approval']['at']);
        if(function_exists('imagewebp')){$im=@imagecreatefromstring(file_get_contents(SBS_Storage::absolute_path($v['asset'])));if($im){$thumb=imagescale($im,min(1200,imagesx($im)));if($thumb){imagesavealpha($thumb,true);ob_start();imagewebp($thumb,null,85);$preview=ob_get_clean();if($preview){$zip->addFromString('preview.webp',$preview);}imagedestroy($thumb);}imagedestroy($im);}}
        if(!$zip->close()){@unlink($path);return self::error('zip','Package could not be completed.',500);}
        $filename=self::package_filename($r['title'],$requested_name,$v['number']);
        $asset=SBS_Storage::store_file($path,$filename,'application/zip','finishing',0,'finishing_package',$r['title']);@unlink($path);return $asset;
    }
}
