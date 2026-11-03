<?php
if(!defined('ABSPATH')){exit;}

/** Guided actions run under the existing finishing workspace lock and revision. */
final class SBS_Finishing_Flow
{
    public static function source($r){$v=SBS_Finishing::current($r);return $v?$v['asset']:$r['original'];}
    public static function review($r)
    {
        $review=$r['flow']['review']??array();$hash=self::source($r)['sha256'];$seen=array();
        while(!isset($seen[$hash])){
            if(($review['sha256']??'')===$hash){return $review;}$seen[$hash]=true;$parent=null;
            foreach($r['versions'] as $v){if($v['asset']['sha256']===$hash&&in_array($v['options']['method']??'',array('inspect','upscale','resize','print_png'),true)){$parent=$v['options']['source_sha256']??null;break;}}
            if(!$parent){break;}$hash=$parent;
        }return array();
    }
    public static function findings($review){$out=array();foreach(($review['passes']??array()) as $pass){foreach(($pass['findings']??array()) as $f){$out[]=$f;}}return $out;}
    public static function gate($r)
    {
        $review=self::review($r);foreach(array('whole','regions','custom') as $pass){if(empty($review['passes'][$pass])){return SBS_Finishing::error('flow_review','Complete the artwork check before approval.',409);}}
        if(!empty($review['character'])&&empty($review['passes']['character'])){return SBS_Finishing::error('flow_character','Complete the selected character check.',409);}
        foreach(self::findings($review) as $f){if(!in_array($review['decisions'][$f['id']]??'',array('intentional','false_alarm'),true)){return SBS_Finishing::error('flow_actions','Fix or review every artwork action before approval.',409);}}
        $p=$r['flow']['pixels']??array();if(($p['sha256']??'')!==self::source($r)['sha256']||empty($p['alpha']['clear'])||(!empty($p['remaining'])&&empty($p['reviewed']))){return SBS_Finishing::error('flow_pixels','Complete the final pixel scan and review remaining marks.',409);}
        $v=SBS_Finishing::current($r);if(!$v||empty($v['ai_review'])){return SBS_Finishing::error('flow_final','Run the final original/candidate comparison.',409);}return true;
    }
    public static function handles($action){return in_array($action,array('flow_review','flow_decision','flow_pixels','flow_repair','flow_poll','flow_keep','flow_reject','flow_drive'),true);}
    public static function handle($r,$request)
    {
        $action=$request->get_param('action');$asset=self::source($r);$path=SBS_Storage::absolute_path($asset);
        if(!is_file($path)||!hash_equals($asset['sha256'],hash_file('sha256',$path))){return SBS_Finishing::error('flow_source','Selected artwork changed. Refresh before continuing.',409);}
        if(!empty($r['pending'])&&!in_array($action,array('flow_poll','flow_keep','flow_reject'),true)){return SBS_Finishing::error('flow_busy','Finish or cancel the waiting action first.',409);}
        if($action==='flow_review'){
            $pass=sanitize_key((string)$request->get_param('pass'));if(!in_array($pass,array('whole','regions','custom','character'),true)){return SBS_Finishing::error('flow_pass','Choose a listed check.');}
            $notes=sanitize_textarea_field((string)$request->get_param('notes'));if(strlen($notes)>12000){return SBS_Finishing::error('flow_notes','Shorten the artwork instructions.');}
            $character=sanitize_text_field((string)$request->get_param('character'));$refs=array();
            if($pass==='character'){$refs=SBS_Logic_Correction::pack_reference_images($character);if(is_wp_error($refs)){return $refs;}}
            $images=SBS_Logic_Correction::review_images($path,$pass==='custom'?'regions':$pass);if(is_wp_error($images)){return $images;}
            if($refs){$images=array_merge(array_slice($images,0,1),$refs['images']);}
            $checks=SBS_Logic_Correction::checks();$rules=array_merge($checks['checks'],array('Skin, clothes and boots must look normal: flag unwanted repeated scale or mesh patterns. Preserve natural body hair.','Preserve intentional smoke, lace, hair, feathers, fades and all intended opaque printed colours including white.'));
            if($notes!==''){$rules[]='Artwork-specific instructions and exact wording: '.$notes;}
            $report=SBS_OpenAI::review_logic_correction($pass,$images,$refs['identity']??array(),$rules);if(is_wp_error($report)){return $report;}
            $review=self::review($r);if(!$review||$pass==='whole'){$review=array('sha256'=>$asset['sha256'],'character'=>$character,'notes'=>$notes,'passes'=>array(),'decisions'=>array());}
            if(($review['notes']??'')!==$notes||($review['character']??'')!==$character){return SBS_Finishing::error('flow_changed','Instructions changed during checking. Run the artwork check again.',409);}
            $review['passes'][$pass]=$report;$r['flow']['review']=$review;$r['approval']=null;$r['next_action']='Step 3: fix or review the artwork action list';
        }elseif($action==='flow_decision'||$action==='flow_repair'){
            $review=self::review($r);$finding=null;$id=(string)$request->get_param('finding');foreach(self::findings($review) as $f){if($f['id']===$id){$finding=$f;break;}}
            if(!$finding){return SBS_Finishing::error('flow_finding','This finding is stale. Check the selected artwork again.',409);}
            if($action==='flow_decision'){
                $decision=sanitize_key((string)$request->get_param('decision'));if(!in_array($decision,array('intentional','false_alarm','unresolved'),true)){return SBS_Finishing::error('flow_decision','Choose a listed review decision.');}
                $r['flow']['review']['decisions'][$id]=$decision;$r['approval']=null;
            }else{
                $job=SBS_Finishing_Image::prepare($asset,$finding['bbox'],$r['title']);if(is_wp_error($job)){return $job;}
                $prompt='Correct only this local issue: '.$finding['action'].' Preserve face, expression, lettering, costume, style, ordinary skin/clothing/boot surfaces and natural body hair. Keep smoke and soft transparency. Return the same framing with a transparent background. '.substr($review['notes']??'',0,1200);
                $response=SBS_OpenAI::submit_image($prompt,array((int)$job['crop']['id']),array('action'=>'edit','quality'=>'high','size'=>'auto','background'=>'transparent','mask_asset_id'=>(int)$job['mask']['id']));if(is_wp_error($response)){return $response;}
                if(empty($response['id'])){return SBS_Finishing::error('flow_provider','No repair tracking reference was returned.',502);}
                $job['kind']='flow_repair';$job['response_id']=$response['id'];$job['source_sha256']=$asset['sha256'];$job['source_version']=$r['current_version'];$job['finding']=$id;$r['pending']=$job;$r['approval']=null;$r['next_action']='Step 3: wait for the repair preview';
            }
        }elseif(in_array($action,array('flow_poll','flow_keep','flow_reject'),true)){
            $job=$r['pending']??array();if(($job['kind']??'')!=='flow_repair'||$job['source_sha256']!==$asset['sha256']){return SBS_Finishing::error('flow_job','No repair matches the selected artwork.',409);}
            if($action==='flow_reject'){unset($r['pending']);return $r;}
            if($action==='flow_poll'){
                if(!empty($job['preview'])){return $r;}$response=SBS_OpenAI::poll($job['response_id']);if(is_wp_error($response)){return $response;}$parsed=SBS_OpenAI::parse_image_response($response);
                if(in_array($parsed['status'],array('queued','in_progress'),true)){return $r;}
                if($parsed['status']!=='completed'){$r['flow']['repair_error']=$parsed['error']['message']??'Repair did not finish.';unset($r['pending']);return $r;}
                $bytes=SBS_Finishing_Image::compose($path,$parsed['bytes'],$job['bounds']);if(is_wp_error($bytes)){return $bytes;}
                $preview=SBS_Storage::store_bytes($bytes,'local-repair-preview.png','image/png','finishing',0,'repair_preview',$r['title']);if(is_wp_error($preview)){return $preview;}$r['pending']['preview']=$preview;$r['next_action']='Step 3: compare the repair preview, then Keep or Reject';
            }else{
                if(empty($job['preview'])){return SBS_Finishing::error('flow_preview','Wait for the repair preview before keeping it.',409);}
                $options=SBS_Finishing::options(array('width'=>$request->get_param('width')?:14,'height'=>$request->get_param('height')?:16));if(is_wp_error($options)){return $options;}
                $options['method']='local_ai_repair';$options['source_sha256']=$asset['sha256'];$options['source_version']=$job['source_version'];$options['edit_bounds']=$job['bounds'];$options['model']=SBS_OpenAI::image_model();
                $qa=SBS_Finishing::inspect($job['preview'],$options);if(is_wp_error($qa)){return $qa;}
                $v=array('uuid'=>wp_generate_uuid4(),'number'=>count($r['versions'])+1,'asset'=>$job['preview'],'qa'=>$qa,'options'=>$options,'created_at'=>gmdate('c'),'source_version_uuid'=>$job['source_version'],'comparison'=>array('byte_identical'=>false,'geometry'=>array('status'=>'proportional')));
                $r['versions'][]=$v;$r['current_version']=$v['uuid'];$r['approval']=null;$r['status']='Awaiting Review';unset($r['pending']);$r['next_action']='Step 3: check the corrected artwork again';
            }
        }elseif($action==='flow_pixels'){
            if((string)$request->get_param('sha256')!==$asset['sha256']){return SBS_Finishing::error('flow_pixels_stale','Artwork changed. Repeat the pixel scan.',409);}$count=$request->get_param('remaining');if(!is_numeric($count)||$count<0){return SBS_Finishing::error('flow_pixels_count','The pixel scan did not finish.');}
            $alpha=$request->get_param('alpha');$total=0;foreach(array('clear','partial','opaque') as $k){if(!is_array($alpha)||!isset($alpha[$k])||!is_int($alpha[$k])||$alpha[$k]<0){return SBS_Finishing::error('flow_alpha','The full pixel scan did not return valid transparency counts.');}$total+=$alpha[$k];}$size=getimagesize($path);if($total!==$size[0]*$size[1]){return SBS_Finishing::error('flow_alpha_size','Pixel counts do not match the selected image. Repeat the scan.',409);}
            $r['flow']['pixels']=array('sha256'=>$asset['sha256'],'remaining'=>(int)$count,'alpha'=>$alpha,'reviewed'=>$request->get_param('reviewed')===true,'at'=>gmdate('c'));$r['approval']=null;
        }elseif($action==='flow_drive'){
            if(empty($r['approval'])||$r['approval']['version']!==$r['current_version']){return SBS_Finishing::error('flow_approval','Approve the selected version before archiving.',409);}
            $package=SBS_Finishing::package($r,$request->get_param('filename'));if(is_wp_error($package)){return $package;}$archive=SBS_Google_Drive::save_package($package,$r['uuid'],$asset['sha256'],$r['approval']['at']??'');if(is_wp_error($archive)){return $archive;}$r['flow']['archive']=$archive;$ids=array_column($r['flow']['archive_history']??array(),'id');if(!in_array($archive['id'],$ids,true)){$r['flow']['archive_history'][]=$archive;}$r['next_action']='Finished: ZIP saved and verified in Smutty Bear Google Drive';
        }return $r;
    }
}
