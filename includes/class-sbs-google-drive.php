<?php
if (!defined('ABSPATH')) { exit; }

/** Server-only Google authentication and verified direct artwork transfer. */
final class SBS_Google_Drive
{
    const SCOPE = 'https://www.googleapis.com/auth/drive.file';
    const ARCHIVE_FOLDER='1_hOrq7rpnZHn5T2-eGWDNiT4hXNguRRV';
    private static function access_token()
    {
        $t=self::tokens();if(empty($t['refresh_token'])){return SBS_Finishing::error('drive_login','Connect the Smutty Bear Google account before saving.',401);}
        if(!empty($t['access_token'])&&($t['expires_at']??0)>time()+60){return $t['access_token'];}$generation=(string)get_option('sbs_google_generation','');
        $r=wp_remote_post('https://oauth2.googleapis.com/token',array('timeout'=>30,'redirection'=>0,'body'=>array('client_id'=>self::client_id(),'client_secret'=>self::secret(),'refresh_token'=>$t['refresh_token'],'grant_type'=>'refresh_token')));
        if(is_wp_error($r)||wp_remote_retrieve_response_code($r)!==200){return SBS_Finishing::error('drive_refresh','Google sign-in expired. Reconnect the Smutty Bear account.',401);}$body=json_decode(wp_remote_retrieve_body($r),true);
        if(empty($body['access_token'])||$generation!==(string)get_option('sbs_google_generation','')||empty(self::tokens()['refresh_token'])){return SBS_Finishing::error('drive_token','Google sign-in changed. Connect again.',409);}
        $t['access_token']=$body['access_token'];$t['expires_at']=time()+(int)($body['expires_in']??3600);$stored=SBS_Crypto::encrypt(wp_json_encode($t));if(!$stored){return SBS_Finishing::error('drive_storage','Could not store Google sign-in.',503);}update_option('sbs_google_tokens',$stored,false);return $t['access_token'];
    }
    private static function api($method,$url,$token,$body=null,$headers=array())
    {
        $args=array('method'=>$method,'timeout'=>90,'redirection'=>0,'headers'=>array_merge(array('Authorization'=>'Bearer '.$token),$headers));if($body!==null){$args['body']=$body;}$r=wp_remote_request($url,$args);return is_wp_error($r)?SBS_Finishing::error('drive_network','Drive could not be reached. Retry the transfer to continue safely.',502):$r;
    }
    private static function matches_package($meta,$package)
    {
        $path=SBS_Storage::absolute_path($package);return is_array($meta)&&!empty($meta['id'])&&empty($meta['trashed'])&&($meta['mimeType']??'')==='application/zip'&&in_array(self::ARCHIVE_FOLDER,$meta['parents']??array(),true)&&(int)($meta['size']??0)===filesize($path)&&hash_equals(hash_file('md5',$path),(string)($meta['md5Checksum']??''));
    }
    private static function drive_id($token)
    {
        $r=self::api('GET','https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',$token);if(is_wp_error($r)){return $r;}$data=json_decode(wp_remote_retrieve_body($r),true);return !empty($data['ids'][0])?$data['ids'][0]:SBS_Finishing::error('drive_id','Drive did not reserve a file reference.',502);
    }
    private static function checked_folder($token)
    {
        $r=self::api('GET','https://www.googleapis.com/drive/v3/files/'.self::ARCHIVE_FOLDER.'?fields=id,mimeType,trashed,capabilities(canAddChildren)',$token);if(is_wp_error($r)){return $r;}$folder=json_decode(wp_remote_retrieve_body($r),true);
        if(wp_remote_retrieve_response_code($r)!==200||!empty($folder['trashed'])||($folder['mimeType']??'')!=='application/vnd.google-apps.folder'||empty($folder['capabilities']['canAddChildren'])){return SBS_Finishing::error('drive_folder','Studio cannot add files to the Smutty Bear artwork folder. Reconnect the account or grant access to that folder.',403);}return $folder;
    }
    private static function matches_asset($meta,$asset,$name,$parent)
    {
        $path=SBS_Storage::absolute_path($asset);return is_file($path)&&is_array($meta)&&!empty($meta['id'])&&empty($meta['trashed'])&&($meta['name']??'')===$name&&($meta['mimeType']??'')===(string)$asset['mime']&&in_array($parent,$meta['parents']??array(),true)&&(int)($meta['size']??-1)===(int)filesize($path)&&hash_equals(hash_file('md5',$path),(string)($meta['md5Checksum']??''));
    }
    private static function create_artwork_folder($token,&$state,$key,$name,$workspace,$candidate)
    {
        $fields='id,name,mimeType,parents,webViewLink,trashed';
        if(!empty($state['folder_id'])){$id=$state['folder_id'];$check=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($id).'?fields='.rawurlencode($fields),$token);if(is_wp_error($check)){return $check;}$check_code=wp_remote_retrieve_response_code($check);if($check_code===200){$meta=json_decode(wp_remote_retrieve_body($check),true);if(!empty($meta['trashed'])||($meta['name']??'')!==$name||($meta['mimeType']??'')!=='application/vnd.google-apps.folder'||!in_array(self::ARCHIVE_FOLDER,$meta['parents']??array(),true)){return SBS_Finishing::error('drive_folder_mismatch','The reserved artwork folder differs from this transfer. Keep the files and review it before retrying.',409);}return $meta;}if($check_code!==404){return SBS_Finishing::error('drive_folder_check','Could not verify the reserved artwork folder. Retry the transfer.',502);}}
        else{$id=self::drive_id($token);if(is_wp_error($id)){return $id;}$state['folder_id']=$id;$state['folder_name']=$name;update_option($key,$state,false);}
        $payload=array('id'=>$id,'name'=>$name,'mimeType'=>'application/vnd.google-apps.folder','parents'=>array(self::ARCHIVE_FOLDER),'appProperties'=>array('studioWorkspace'=>$workspace,'candidateSha256'=>$candidate));
        $create=self::api('POST','https://www.googleapis.com/drive/v3/files?fields='.rawurlencode($fields),$token,wp_json_encode($payload),array('Content-Type'=>'application/json; charset=UTF-8'));
        if(is_wp_error($create)){return $create;}$code=wp_remote_retrieve_response_code($create);if($code===409){$create=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($id).'?fields='.rawurlencode($fields),$token);if(is_wp_error($create)){return $create;}$code=wp_remote_retrieve_response_code($create);}
        if(!in_array($code,array(200,201),true)){return SBS_Finishing::error('drive_folder_create','Drive could not create the artwork folder. Retry to continue the same transfer.',502);}$meta=json_decode(wp_remote_retrieve_body($create),true);if(!is_array($meta)||($meta['id']??'')!==$id||($meta['mimeType']??'')!=='application/vnd.google-apps.folder'||!in_array(self::ARCHIVE_FOLDER,$meta['parents']??array(),true)){return SBS_Finishing::error('drive_folder_verify','The artwork folder could not be verified in the main Smutty Bear Drive folder.',502);}return $meta;
    }
    private static function upload_artifact($token,&$state,$key,$folder_id,$candidate,$artifact,$base_name)
    {
        $type=(string)$artifact['type'];$asset=$artifact['asset'];$path=SBS_Storage::absolute_path($asset);if(!is_file($path)||!hash_equals((string)$asset['sha256'],hash_file('sha256',$path))){return SBS_Finishing::error('drive_source','A local transfer file is missing or changed. Keep the workspace and retry after reviewing it.',409);}
        $name=$base_name.'-'.$artifact['suffix'];$mime=(string)$artifact['mimeType'];$size=filesize($path);$md5=hash_file('md5',$path);$saved=$state['files'][$type]??array();$fields='id,name,mimeType,parents,size,md5Checksum,webViewLink,trashed';
        if(!empty($saved['id'])){$check=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($saved['id']).'?fields='.rawurlencode($fields),$token);if(is_wp_error($check)){return $check;}if(wp_remote_retrieve_response_code($check)===200){$meta=json_decode(wp_remote_retrieve_body($check),true);if(!self::matches_asset($meta,$asset,$name,$folder_id)){return SBS_Finishing::error('drive_file_mismatch','A Drive file differs from the approved artwork. Keep both copies and review before retrying.',409);}return $meta;}if(wp_remote_retrieve_response_code($check)!==404){return SBS_Finishing::error('drive_file_check','Could not verify a reserved Drive file. Retry the transfer.',502);}}
        else{$id=self::drive_id($token);if(is_wp_error($id)){return $id;}$saved=array('id'=>$id,'sha256'=>$asset['sha256'],'name'=>$name,'mimeType'=>$mime,'size'=>$size);$state['files'][$type]=$saved;update_option($key,$state,false);}
        if(!empty($saved['sha256'])&&(!hash_equals((string)$saved['sha256'],(string)$asset['sha256'])||($saved['name']??'')!==$name||($saved['mimeType']??'')!==$mime)){return SBS_Finishing::error('drive_source_changed','This transfer was started with different artwork details. Start a new approved transfer.',409);}
        if(empty($saved['session'])){$meta=array('id'=>$saved['id'],'name'=>$name,'mimeType'=>$mime,'parents'=>array($folder_id),'appProperties'=>array('studioWorkspace'=>$state['workspace'],'candidateSha256'=>$candidate,'artifactType'=>$type));$start=self::api('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields='.rawurlencode($fields),$token,wp_json_encode($meta),array('Content-Type'=>'application/json; charset=UTF-8','X-Upload-Content-Type'=>$mime,'X-Upload-Content-Length'=>(string)$size));if(is_wp_error($start)){return $start;}$session=wp_remote_retrieve_header($start,'location');if(wp_remote_retrieve_response_code($start)!==200||!is_string($session)||!preg_match('#^https://www\.googleapis\.com/upload/drive/v3/files\?#',$session)){return SBS_Finishing::error('drive_session','Drive could not start an individual file upload. Retry the transfer.',502);}$saved['session']=$session;$state['files'][$type]=$saved;update_option($key,$state,false);}
        $probe=self::api('PUT',$saved['session'],$token,'',array('Content-Length'=>'0','Content-Range'=>'bytes */'.$size));if(is_wp_error($probe)){return $probe;}$code=wp_remote_retrieve_response_code($probe);$offset=0;
        if($code===404||$code===410){unset($saved['session']);$state['files'][$type]=$saved;update_option($key,$state,false);return SBS_Finishing::error('drive_expired','A Drive upload session expired. Press Transfer files again to resume safely.',409);}
        if($code===308){$range=wp_remote_retrieve_header($probe,'range');if(preg_match('/bytes=0-(\d+)/',(string)$range,$m)){$offset=(int)$m[1]+1;}}elseif(!in_array($code,array(200,201),true)){return SBS_Finishing::error('drive_progress','Could not check an individual upload. Retry the transfer.',502);}
        if($code===308){$stream=fopen($path,'rb');if(!$stream){return SBS_Finishing::error('drive_read','Could not read an individual transfer file.',503);}try{while($offset<$size){fseek($stream,$offset);$chunk=fread($stream,8*1024*1024);if($chunk===false||$chunk===''){return SBS_Finishing::error('drive_read','Could not read the complete transfer file.',503);}$end=$offset+strlen($chunk)-1;$up=self::api('PUT',$saved['session'],$token,$chunk,array('Content-Type'=>$mime,'Content-Length'=>(string)strlen($chunk),'Content-Range'=>'bytes '.$offset.'-'.$end.'/'.$size));if(is_wp_error($up)){return $up;}$code=wp_remote_retrieve_response_code($up);if(in_array($code,array(200,201),true)){break;}$range=wp_remote_retrieve_header($up,'range');if($code!==308||!preg_match('/bytes=0-(\d+)/',(string)$range,$m)||(int)$m[1]+1<=$offset){return SBS_Finishing::error('drive_upload','An individual upload is incomplete. Press Transfer files to resume it.',502);}$offset=(int)$m[1]+1;}}finally{fclose($stream);}}
        $check=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($saved['id']).'?fields='.rawurlencode($fields),$token);if(is_wp_error($check)){return $check;}$meta=json_decode(wp_remote_retrieve_body($check),true);if(!self::matches_asset($meta,$asset,$name,$folder_id)){return SBS_Finishing::error('drive_verify','A transferred file failed its folder, size or checksum check. Retry the transfer.',502);}unset($saved['session']);$saved['verified']=true;$state['files'][$type]=$saved;update_option($key,$state,false);return $meta;
    }
    private static function csv_row($values)
    {
        $stream=fopen('php://temp','r+');fputcsv($stream,$values);rewind($stream);$line=stream_get_contents($stream);fclose($stream);return $line;
    }
    private static function update_register($token,$rows)
    {
        $lock_key='sbs_drive_production_register_lock';$previous=get_option($lock_key,array());if(is_array($previous)&&!empty($previous['at'])&&time()-(int)$previous['at']>300){delete_option($lock_key);}$lock=array('token'=>wp_generate_uuid4(),'at'=>time());if(!add_option($lock_key,$lock,'','no')){return SBS_Finishing::error('drive_register_busy','The production register is being updated. Retry the file transfer in a moment.',409);}
        try{$id=(string)get_option('sbs_drive_production_register_id','');$csv="UTC date,Artwork folder,Artwork title,Prefix,Version,Artifact type,File name,MIME type,Bytes,SHA-256,Drive file ID,Drive URL,Workspace ID,Approval UTC,Transfer status,Production status\r\n";$fields='id,name,mimeType,parents,size,md5Checksum,webViewLink,trashed';
            if($id!==''){$meta=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($id).'?fields='.rawurlencode($fields),$token);if(is_wp_error($meta)){return $meta;}if(wp_remote_retrieve_response_code($meta)!==200){return SBS_Finishing::error('drive_register_check','Could not open the existing Smutty Bear production register.',502);}$info=json_decode(wp_remote_retrieve_body($meta),true);if(!empty($info['trashed'])||($info['name']??'')!=='Studio Production Register.csv'||($info['mimeType']??'')!=='text/csv'||!in_array(self::ARCHIVE_FOLDER,$info['parents']??array(),true)){return SBS_Finishing::error('drive_register_mismatch','The saved Drive register reference is not the expected register. It was left unchanged.',409);}$download=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($id).'?alt=media',$token);if(is_wp_error($download)){return $download;}if(wp_remote_retrieve_response_code($download)!==200){return SBS_Finishing::error('drive_register_read','Could not read the existing production register.',502);}$csv=wp_remote_retrieve_body($download);if($csv===''||strpos($csv,'Drive file ID')===false){return SBS_Finishing::error('drive_register_format','The existing production register has an unexpected format and was not changed.',409);}}
            foreach($rows as $row){if(strpos($csv,(string)$row['id'])!==false){continue;}$csv.=self::csv_row($row['values']);}
            if($id===''){$id=self::drive_id($token);if(is_wp_error($id)){return $id;}update_option('sbs_drive_production_register_id',$id,false);$boundary='sbs'.wp_generate_password(24,false,false);$meta=array('id'=>$id,'name'=>'Studio Production Register.csv','mimeType'=>'text/csv','parents'=>array(self::ARCHIVE_FOLDER));$body='--'.$boundary."\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".wp_json_encode($meta)."\r\n--".$boundary."\r\nContent-Type: text/csv; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n".$csv."\r\n--".$boundary."--";$write=self::api('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields='.rawurlencode($fields),$token,$body,array('Content-Type'=>'multipart/related; boundary='.$boundary));}
            else{$write=self::api('PATCH','https://www.googleapis.com/upload/drive/v3/files/'.rawurlencode($id).'?uploadType=media&fields='.rawurlencode($fields),$token,$csv,array('Content-Type'=>'text/csv; charset=UTF-8'));}
            if(is_wp_error($write)){return $write;}if(!in_array(wp_remote_retrieve_response_code($write),array(200,201),true)){return SBS_Finishing::error('drive_register_write','The files are in Drive, but the production register could not be updated. Retry Transfer files to complete the register.',502);}$info=json_decode(wp_remote_retrieve_body($write),true);if(empty($info['id'])){$check=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($id).'?fields='.rawurlencode($fields),$token);if(is_wp_error($check)){return $check;}$info=json_decode(wp_remote_retrieve_body($check),true);}if(empty($info['id'])||(int)($info['size']??-1)!==strlen($csv)||!hash_equals(hash('md5',$csv),(string)($info['md5Checksum']??''))){return SBS_Finishing::error('drive_register_verify','The production register update could not be verified. Retry Transfer files.',502);}update_option('sbs_drive_production_register_id',$id,false);return array('id'=>$id,'url'=>$info['webViewLink']??'','verified'=>true);
        }finally{$held=get_option($lock_key,array());if(is_array($held)&&hash_equals((string)($held['token']??''),(string)$lock['token'])){delete_option($lock_key);}}
    }
    public static function save_artifacts($artifacts,$workspace,$candidate,$approval_stamp,$title,$prefix,$version,$run)
    {
        $token=self::access_token();if(is_wp_error($token)){return $token;}$parent=self::checked_folder($token);if(is_wp_error($parent)){return $parent;}
        $prefix=strtoupper((string)$prefix);if(!preg_match('/^[A-Z]{2}$/D',$prefix)){return SBS_Finishing::error('drive_prefix','Enter a two-letter artwork prefix before transferring files.',400);}
        $slug=remove_accents((string)$title);$slug=trim(preg_replace('/[^A-Za-z0-9]+/','-',(string)$slug),'-');$slug=substr($slug?:'Artwork',0,90);$slug=rtrim($slug,'-');$version=max(1,(int)$version);$run=max(1,(int)$run);$base=$prefix.'-'.$slug.'-v'.$version.'-R'.str_pad((string)$run,2,'0',STR_PAD_LEFT);$folderName=$base;
        $key='sbs_drive_transfer_'.hash('sha256',$workspace.'|'.$candidate.'|'.$approval_stamp.'|'.$prefix.'|'.$base);$state=get_option($key,array());if(!is_array($state)){$state=array();}$state['workspace']=$workspace;$state['base']=$base;$state['files']=$state['files']??array();update_option($key,$state,false);
        $folder=self::create_artwork_folder($token,$state,$key,$folderName,$workspace,$candidate);if(is_wp_error($folder)){return $folder;}$results=array();$rows=array();
        $rows[]=array('id'=>$folder['id'],'values'=>array(gmdate('c'),$folderName,(string)$title,$prefix,$version,'run_folder',$folderName,'application/vnd.google-apps.folder',0,$candidate,$folder['id'],$folder['webViewLink']??'',$workspace,$approval_stamp,'Verified','Studio Complete — Awaiting Production'));
        foreach($artifacts as $artifact){$meta=self::upload_artifact($token,$state,$key,$folder['id'],$candidate,$artifact,$base);if(is_wp_error($meta)){return $meta;}$type=(string)$artifact['type'];$results[]=array('type'=>$type,'id'=>$meta['id'],'name'=>$meta['name'],'mimeType'=>$meta['mimeType'],'size'=>(int)$meta['size'],'sha256'=>$artifact['asset']['sha256'],'url'=>$meta['webViewLink']??'');$rows[]=array('id'=>$meta['id'],'values'=>array(gmdate('c'),$folderName,(string)$title,$prefix,$version,$type,$meta['name'],$meta['mimeType'],(int)$meta['size'],$artifact['asset']['sha256'],$meta['id'],$meta['webViewLink']??'',$workspace,$approval_stamp,'Verified','Studio Complete — Awaiting Production'));}
        $register=self::update_register($token,$rows);if(is_wp_error($register)){return $register;}
        return array('id'=>$folder['id'],'name'=>$folderName,'url'=>$folder['webViewLink']??'','verified'=>true,'candidate_sha256'=>$candidate,'approval_at'=>$approval_stamp,'files'=>$results,'register'=>$register,'at'=>gmdate('c'));
    }
    public static function save_package($package,$workspace,$candidate,$approval_stamp='')
    {
        $token=self::access_token();if(is_wp_error($token)){return $token;}
        $response=self::api('GET','https://www.googleapis.com/drive/v3/files/'.self::ARCHIVE_FOLDER.'?fields=id,mimeType,trashed,capabilities(canAddChildren)',$token);if(is_wp_error($response)){return $response;}$folder=json_decode(wp_remote_retrieve_body($response),true);
        if(wp_remote_retrieve_response_code($response)!==200||!empty($folder['trashed'])||($folder['mimeType']??'')!=='application/vnd.google-apps.folder'||empty($folder['capabilities']['canAddChildren'])){return SBS_Finishing::error('drive_folder','Studio does not have Google access to the Smutty Studio ZIP archive folder. Download the ZIP for now; reconnect or grant that folder to Studio before direct saving.',403);}
        $key='sbs_archive_'.hash('sha256',$workspace.'|'.$candidate.'|'.$package['filename'].'|'.$approval_stamp);$saved=get_option($key,array());$fields='id,name,mimeType,parents,size,md5Checksum,webViewLink,trashed';
        if(!empty($saved['package'])){$p=$saved['package'];$path=SBS_Storage::absolute_path($p);if(is_file($path)&&hash_equals($p['sha256'],hash_file('sha256',$path))){$package=$p;}else{return SBS_Finishing::error('drive_source','The archived upload source is missing. Keep the local ZIP and review this workspace.',409);}}
        if(!empty($saved['id'])){
            $check=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($saved['id']).'?fields='.rawurlencode($fields),$token);if(is_wp_error($check)){return $check;}
            if(wp_remote_retrieve_response_code($check)===200){$meta=json_decode(wp_remote_retrieve_body($check),true);if(!self::matches_package($meta,$package)){return SBS_Finishing::error('drive_mismatch','The saved ZIP differs. Keep both copies and review before retrying.',409);}return self::archive_result($meta,$package,$candidate);}
            if(wp_remote_retrieve_response_code($check)!==404){return SBS_Finishing::error('drive_check','Could not verify the reserved Drive file. Retry Save ZIP.',502);}
        }else{
            $ids=self::api('GET','https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',$token);if(is_wp_error($ids)){return $ids;}$data=json_decode(wp_remote_retrieve_body($ids),true);if(empty($data['ids'][0])){return SBS_Finishing::error('drive_id','Drive did not reserve a file reference.',502);}$saved=array('id'=>$data['ids'][0],'package'=>$package);update_option($key,$saved,false);
        }
        $path=SBS_Storage::absolute_path($package);$size=filesize($path);
        if(empty($saved['session'])){
            $meta=array('id'=>$saved['id'],'name'=>$package['filename'],'mimeType'=>'application/zip','parents'=>array(self::ARCHIVE_FOLDER),'appProperties'=>array('studioWorkspace'=>$workspace,'candidateSha256'=>$candidate));$start=self::api('POST','https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields='.rawurlencode($fields),$token,wp_json_encode($meta),array('Content-Type'=>'application/json; charset=UTF-8','X-Upload-Content-Type'=>'application/zip','X-Upload-Content-Length'=>(string)$size));if(is_wp_error($start)){return $start;}$session=wp_remote_retrieve_header($start,'location');
            if(wp_remote_retrieve_response_code($start)!==200||!is_string($session)||!preg_match('#^https://www\.googleapis\.com/upload/drive/v3/files\?#',$session)){return SBS_Finishing::error('drive_session','Drive could not start this upload.',502);}$saved['session']=$session;update_option($key,$saved,false);
        }
        $probe=self::api('PUT',$saved['session'],$token,'',array('Content-Length'=>'0','Content-Range'=>'bytes */'.$size));if(is_wp_error($probe)){return $probe;}$code=wp_remote_retrieve_response_code($probe);$offset=0;
        if($code===404||$code===410){unset($saved['session']);update_option($key,$saved,false);return SBS_Finishing::error('drive_expired','Upload session expired. Press Save ZIP again; its file reference is retained.',409);}
        if($code===308){$range=wp_remote_retrieve_header($probe,'range');if(preg_match('/bytes=0-(\d+)/',(string)$range,$m)){$offset=(int)$m[1]+1;}}
        elseif($code!==200&&$code!==201){return SBS_Finishing::error('drive_progress','Could not check upload progress. Retry Save ZIP.',502);}
        if($code===308){$stream=fopen($path,'rb');if(!$stream){return SBS_Finishing::error('drive_read','Could not read the ZIP.',503);}try{while($offset<$size){fseek($stream,$offset);$chunk=fread($stream,8*1024*1024);if($chunk===false||$chunk===''){return SBS_Finishing::error('drive_read','Could not read the complete ZIP.',503);}$end=$offset+strlen($chunk)-1;$upload=self::api('PUT',$saved['session'],$token,$chunk,array('Content-Type'=>'application/zip','Content-Length'=>(string)strlen($chunk),'Content-Range'=>'bytes '.$offset.'-'.$end.'/'.$size));if(is_wp_error($upload)){return $upload;}$code=wp_remote_retrieve_response_code($upload);if(in_array($code,array(200,201),true)){break;}$range=wp_remote_retrieve_header($upload,'range');if($code!==308||!preg_match('/bytes=0-(\d+)/',(string)$range,$m)||(int)$m[1]+1<=$offset){return SBS_Finishing::error('drive_upload','Upload is incomplete. Press Save ZIP to resume.',502);}$offset=(int)$m[1]+1;}}finally{fclose($stream);}}
        $check=self::api('GET','https://www.googleapis.com/drive/v3/files/'.rawurlencode($saved['id']).'?fields='.rawurlencode($fields),$token);if(is_wp_error($check)){return $check;}$meta=json_decode(wp_remote_retrieve_body($check),true);if(!self::matches_package($meta,$package)){return SBS_Finishing::error('drive_verify','ZIP size, folder and checksum could not all be confirmed. Retry Save ZIP to verify.',502);}return self::archive_result($meta,$package,$candidate);
    }
    private static function archive_result($meta,$package,$candidate){return array('id'=>$meta['id'],'url'=>$meta['webViewLink']??'','candidate_sha256'=>$candidate,'package_sha256'=>$package['sha256'],'verified'=>true,'at'=>gmdate('c'));}
    public static function register_routes()
    {
        foreach(array('/status'=>array('GET','status'),'/configure'=>array('POST','configure'),'/connect'=>array('POST','connect'),'/disconnect'=>array('POST','disconnect'),'/callback'=>array('GET','callback')) as $path=>$route){
            register_rest_route(SBS_REST::NS,'/finishing/google'.$path,array('methods'=>$route[0],'callback'=>array(__CLASS__,$route[1]),'permission_callback'=>array('SBS_Finishing','permission')));
        }
    }
    public static function redirect_uri(){return rest_url(SBS_REST::NS.'/finishing/google/callback');}
    private static function client_id(){return (string)get_option('sbs_google_client_id','');}
    private static function secret(){return SBS_Crypto::decrypt((string)get_option('sbs_google_client_secret',''));}
    private static function tokens(){return json_decode(SBS_Crypto::decrypt((string)get_option('sbs_google_tokens','')),true) ?: array();}
    public static function status()
    {
        $t=self::tokens();
        return array('configured'=>(bool)(self::client_id()&&self::secret()),'connected'=>!empty($t['refresh_token']), 'access_expired'=>!empty($t)&&($t['expires_at']??0)<=time(),'redirect_uri'=>self::redirect_uri(),'scope'=>self::SCOPE,'drive_route_enabled'=>true,'writes_enabled'=>true,'message'=>'Transfer approved artwork files to Drive when the connected account has access to the Smutty Bear folder.');
    }
    public static function configure($request)
    {
        if(!is_ssl()){return SBS_Finishing::error('https','Google client settings require HTTPS.',403);}
        if(self::tokens()){return SBS_Finishing::error('disconnect','Disconnect before changing the OAuth client.',409);}
        $id=$request->get_param('client_id');$secret=$request->get_param('client_secret');
        if(!is_string($id)||!preg_match('/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/D',$id)||strlen($id)>255||!is_string($secret)||strlen($secret)>1000){return SBS_Finishing::error('client','Enter the web application client ID and client secret.');}
        $encrypted=$secret!==''?SBS_Crypto::encrypt($secret):(string)get_option('sbs_google_client_secret','');
        if(!$encrypted||!SBS_Crypto::decrypt($encrypted)){return SBS_Finishing::error('crypto','Encrypted storage is unavailable or the client secret is missing.',503);}
        update_option('sbs_google_client_secret',$encrypted,false);update_option('sbs_google_client_id',$id,false);
        update_option('sbs_google_generation',bin2hex(random_bytes(16)),false);
        return self::status();
    }
    public static function connect()
    {
        if(!is_ssl()||!self::client_id()||!self::secret()){return SBS_Finishing::error('config','Configure an HTTPS Google web application client first.',409);}
        $state=bin2hex(random_bytes(32));$verifier=rtrim(strtr(base64_encode(random_bytes(48)),'+/','-_'),'=');
        $encrypted=SBS_Crypto::encrypt($verifier);if(!$encrypted){return SBS_Finishing::error('crypto','Encrypted storage is unavailable.',503);}
        $generation=bin2hex(random_bytes(16));update_option('sbs_google_generation',$generation,false);
        set_transient('sbs_google_state_'.hash('sha256',$state),array('session'=>hash('sha256',(string)($_COOKIE[SBS_Auth::COOKIE]??'')),'verifier'=>$encrypted,'generation'=>$generation),600);
        return array('authorization_url'=>'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query(array('client_id'=>self::client_id(),'redirect_uri'=>self::redirect_uri(),'response_type'=>'code','scope'=>self::SCOPE,'access_type'=>'offline','prompt'=>'consent','state'=>$state,'code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'='),'code_challenge_method'=>'S256'),'', '&',PHP_QUERY_RFC3986));
    }
    private static function result($result)
    {
        $url=home_url('/'.SBS_Plugin::studio_slug().'/?settings=1&google='.$result);
        $response=new WP_REST_Response(null,303);
        $response->header('Location',$url);$response->header('Cache-Control','no-store');$response->header('Referrer-Policy','no-referrer');return $response;
    }
    public static function callback($request)
    {
        if(!is_ssl()){return self::result('https-required');}
        $state=$request->get_param('state');
        if(!is_string($state)||!preg_match('/^[a-f0-9]{64}$/D',$state)){return self::result('invalid-state');}
        // Serialize callback/disconnect to avoid storing a token after disconnect.
        if(!SBS_Storage::ensure_directories()){return self::result('storage-unavailable');}
        $lock=fopen(SBS_Storage::base_dir().'/tmp/google-oauth.lock','c');
        if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::result('retry');}
        try{
            $key='sbs_google_state_'.hash('sha256',$state);$saved=get_transient($key);
            if(!is_array($saved)||!hash_equals($saved['session'],hash('sha256',(string)($_COOKIE[SBS_Auth::COOKIE]??'')))||!hash_equals($saved['generation'],(string)get_option('sbs_google_generation',''))){return self::result('invalid-state');}
            delete_transient($key);
            if($request->get_param('error')){return self::result('denied');}
            $code=$request->get_param('code');$verifier=SBS_Crypto::decrypt($saved['verifier']);
            if(!is_string($code)||strlen($code)>4096||!$code||!$verifier){return self::result('invalid-code');}
            $response=wp_remote_post('https://oauth2.googleapis.com/token',array('timeout'=>20,'redirection'=>0,'body'=>array('client_id'=>self::client_id(),'client_secret'=>self::secret(),'code'=>$code,'code_verifier'=>$verifier,'grant_type'=>'authorization_code','redirect_uri'=>self::redirect_uri())));
            if(is_wp_error($response)||wp_remote_retrieve_response_code($response)!==200){return self::result('exchange-failed');}
            $t=json_decode(wp_remote_retrieve_body($response),true);
            if(!is_array($t)||empty($t['access_token'])||empty($t['refresh_token'])||($t['token_type']??'')!=='Bearer'||!in_array(self::SCOPE,explode(' ',(string)($t['scope']??'')),true)){return self::result('consent-incomplete');}
            $stored=array('access_token'=>$t['access_token'],'refresh_token'=>$t['refresh_token'],'expires_at'=>time()+max(0,(int)($t['expires_in']??0)),'scope'=>self::SCOPE);
            $encrypted=SBS_Crypto::encrypt(wp_json_encode($stored));if(!$encrypted){return self::result('storage-failed');}
            update_option('sbs_google_tokens',$encrypted,false);
            if(!hash_equals($encrypted,(string)get_option('sbs_google_tokens',''))){return self::result('storage-failed');}
            return self::result('connected');
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function disconnect()
    {
        if(!SBS_Storage::ensure_directories()){return SBS_Finishing::error('storage','Private storage is unavailable.',503);}
        $lock=fopen(SBS_Storage::base_dir().'/tmp/google-oauth.lock','c');
        if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return SBS_Finishing::error('busy','OAuth is busy. Retry disconnect.',409);}
        try{
            $t=self::tokens();delete_option('sbs_google_tokens');update_option('sbs_google_generation',bin2hex(random_bytes(16)),false);
            $revoked=true;
            if(!empty($t['refresh_token'])){$result=wp_remote_post('https://oauth2.googleapis.com/revoke',array('timeout'=>15,'redirection'=>0,'body'=>array('token'=>$t['refresh_token'])));$revoked=!is_wp_error($result)&&wp_remote_retrieve_response_code($result)===200;}
            $status=self::status();$status['remote_revocation_confirmed']=$revoked;$status['message']=$revoked?'Disconnected. Local tokens removed.':'Local tokens removed. Google revocation was not confirmed; remove the app in Google Account permissions.';return $status;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}

