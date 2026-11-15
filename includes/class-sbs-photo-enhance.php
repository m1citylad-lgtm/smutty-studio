<?php
if (!defined('ABSPATH')) { exit; }
/** Photo-only preparation; the print graphic is never sent to a generation model. */
final class SBS_Photo_Enhance
{
    public static function register_routes() {
        register_rest_route(SBS_REST::NS,'/tools/photo-providers',array('methods'=>'GET','callback'=>array(__CLASS__,'providers'),'permission_callback'=>array('SBS_Finishing','permission')));
        register_rest_route(SBS_REST::NS,'/tools/photo-enhance',array('methods'=>'POST','callback'=>array(__CLASS__,'job'),'permission_callback'=>array('SBS_Finishing','permission')));
    }
    public static function surface($grid) {
        if(!is_array($grid)||count($grid)!==25){return null;}$clean=array();foreach($grid as $p){if(!is_array($p)||count($p)!==2||!is_numeric($p[0])||!is_numeric($p[1])||!is_finite((float)$p[0])||!is_finite((float)$p[1])||$p[0]<0||$p[0]>1||$p[1]<0||$p[1]>1){return null;}$clean[]=array((float)$p[0],(float)$p[1]);}
        for($y=0;$y<4;$y++){for($x=0;$x<4;$x++){$a=$clean[$y*5+$x];$b=$clean[$y*5+$x+1];$c=$clean[($y+1)*5+$x+1];$d=$clean[($y+1)*5+$x];foreach(array(array($a,$b,$c),array($a,$c,$d)) as $t){if(($t[1][0]-$t[0][0])*($t[2][1]-$t[0][1])-($t[1][1]-$t[0][1])*($t[2][0]-$t[0][0])<.00001){return null;}}}}
        return $clean;
    }
    public static function providers() {
        @set_time_limit(180);$list=array();if(SBS_OpenAI::is_configured()){$list[]=array('id'=>'openai','label'=>'OpenAI — '.SBS_OpenAI::image_model());}
        $key='sbs_photo_models_'.substr(hash('sha256',SBS_Replicate::api_key()),0,16);$known=get_transient($key);
        if($known===false){$known=array();if(SBS_Replicate::is_configured()){foreach(array('openai/gpt-image-2.6-sunburst','google/nano-banana-2','google/nano-banana-2.1') as $model){$schema=SBS_Replicate::photo_schema($model);if(!is_wp_error($schema)){$known[]=array('id'=>'replicate:'.$model,'label'=>'Replicate — '.$model);}}}set_transient($key,$known,3600);}
        return array('providers'=>array_merge($list,$known),'default'=>'openai','note'=>'Available photo-edit schemas checked against configured providers. Results require visual review; no model is declared a benchmark winner.');
    }
    private static function save($path,$job) {
        $text=wp_json_encode($job);$tmp=$path.'.tmp';if(file_put_contents($tmp,$text,LOCK_EX)!==strlen($text)||!rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('The photo request checkpoint could not be saved.');}@chmod($path,0640);
    }
    public static function job($q) {
        @set_time_limit(180);$id=(string)$q->get_param('job');if(!preg_match('/^[a-f0-9-]{36}$/D',$id)){return SBS_Finishing::error('photo_job','Start a new photo request.');}
        SBS_Storage::ensure_directories();$dir=SBS_Storage::base_dir().'/photo-prep';if(!is_dir($dir)){wp_mkdir_p($dir);}$path=$dir.'/'.$id.'.json';$lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return SBS_Finishing::error('photo_busy','This photo request is already running.',409);}
        try {
            $job=is_file($path)?json_decode(file_get_contents($path),true):null;$op=$q->get_param('operation');
            if(!$job){
                if($op!=='start'||$q->get_param('consent')!==true){return SBS_Finishing::error('photo_consent','Confirm provider usage before preparing the photo.');}
                $photo=(string)$q->get_param('photo');if(strlen($photo)>8000000||!preg_match('#^data:image/jpeg;base64,([A-Za-z0-9+/=]+)$#D',$photo,$m)){return SBS_Finishing::error('photo_input','Choose a photo again.');}$size=@getimagesizefromstring(base64_decode($m[1],true));if(!$size||$size[0]*$size[1]>4000000){return SBS_Finishing::error('photo_input','Use a working photo up to four million pixels.');}
                $provider=(string)$q->get_param('provider');$schema=null;if($provider!=='openai'){$schema=SBS_Replicate::photo_schema(substr($provider,0,10)==='replicate:'?substr($provider,10):'');if(is_wp_error($schema)){return $schema;}}elseif(!SBS_OpenAI::is_configured()){return SBS_Finishing::error('photo_provider','OpenAI is not configured.');}
                $instructions=sanitize_textarea_field((string)$q->get_param('instructions'));if(strlen($instructions)>1000){return SBS_Finishing::error('photo_prompt','Keep photo instructions under 1000 characters.');}
                $prompt='Refine this existing blank T-shirt marketing photograph for natural photographic lighting, believable fabric folds and a clear chest print region. The supplied image is authoritative for scene type and contents. If it is a garment-only flat lay, keep it a flat lay: do not introduce a person, mannequin, face, neck, hands or other body parts. If an adult subject is already present, preserve that subject, identity, pose, correct anatomy and normal skin, clothing and shoes. Preserve the original shirt colour, garment silhouette, background, composition and framing. Do not turn a flat lay into a model photograph or replace an existing model. Do not add graphics, logos, lettering, patterns, props or extra objects. No T-shirt artwork is supplied; a protected exact PNG will be added later. '.$instructions;
                // Store only job identity and input hash, never the photograph or image bytes.
                $job=array('status'=>'submitting','provider'=>$provider,'photo_sha256'=>hash('sha256',$photo),'created_at'=>gmdate('c'));self::save($path,$job);
                $response=$provider==='openai'?SBS_OpenAI::submit_photo($photo,$prompt):SBS_Replicate::submit_photo($schema,$photo,$prompt);
                if(is_wp_error($response)){$job['status']='uncertain';self::save($path,$job);return $response;}
                $job['response_id']=$response['id']??'';$job['status']=$job['response_id']?'pending':'uncertain';self::save($path,$job);
            }
            if($op==='cancel'){if(!empty($job['response_id'])&&$job['status']==='pending'){$r=$job['provider']==='openai'?SBS_OpenAI::cancel($job['response_id']):SBS_Replicate::cancel($job['response_id']);if(is_wp_error($r)){return $r;}}$job['status']='cancelled';self::save($path,$job);return array('status'=>'cancelled');}
            if(in_array($job['status'],array('submitting','uncertain','failed','cancelled'),true)||empty($job['response_id'])){return SBS_Finishing::error('photo_state','This request stopped or its submission is uncertain. No automatic second paid request was sent.');}
            $r=$job['provider']==='openai'?SBS_OpenAI::poll($job['response_id']):SBS_Replicate::poll($job['response_id']);if(is_wp_error($r)){return $r;}
            if($job['provider']==='openai'){$parsed=SBS_OpenAI::parse_image_response($r);if(in_array($parsed['status'],array('queued','in_progress'),true)){return array('status'=>'pending');}if($parsed['status']!=='completed'){$job['status']='failed';self::save($path,$job);return SBS_Finishing::error('photo_failed',$parsed['error']['message']??'Photo preparation failed.');}$bytes=$parsed['bytes'];}
            else {if(in_array($r['status']??'',array('starting','processing'),true)){return array('status'=>'pending');}if(($r['status']??'')!=='succeeded'){$job['status']='failed';self::save($path,$job);return SBS_Finishing::error('photo_failed','The photo provider could not finish this request.');}$url=is_array($r['output'])?reset($r['output']):$r['output'];$bytes=SBS_Replicate::fetch_output($url);if(is_wp_error($bytes)){$job['status']='output_unavailable';self::save($path,$job);return $bytes;}}
            $size=@getimagesizefromstring($bytes);if(!$size||!in_array($size['mime'],array('image/png','image/jpeg','image/webp'),true)||$size[0]*$size[1]>20000000||strlen($bytes)>24000000){return SBS_Finishing::error('photo_output','The provider returned an unsupported photo. Original retained.');}
            $job['status']='ready';self::save($path,$job);return array('status'=>'ready','photo'=>'data:'.$size['mime'].';base64,'.base64_encode($bytes),'provider'=>$job['provider'],'note'=>'Generated photograph requires review. Your artwork was not sent to the image provider.');
        }catch(Throwable $e){return SBS_Finishing::error('photo_error',$e->getMessage());}finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}
