<?php
define('ABSPATH',__DIR__.'/');class WP_Error {public $message;function __construct($c,$m,$d=null){$this->message=$m;}}
function is_wp_error($v){return $v instanceof WP_Error;}function wp_json_encode($v){return json_encode($v);}function get_option($k,$d=null){return $GLOBALS['settings'][$k]??$d;}function update_option($k,$v,$a=false){$GLOBALS['settings'][$k]=$v;}function wp_remote_retrieve_response_code($r){return $r['code'];}function wp_remote_retrieve_body($r){return $r['body']??'';}function wp_remote_retrieve_header($r,$h){return $r['headers'][strtolower($h)]??'';}
class SBS_Crypto {static function decrypt($x){return $x;}static function encrypt($x){return $x;}}
class SBS_Storage {static function absolute_path($a){return $a['path'];}}
class SBS_Finishing {static function error($c,$m,$status=400){return new WP_Error($c,$m,array('status'=>$status));}}
function response_drive($code,$data=array(),$headers=array()){return array('code'=>$code,'body'=>json_encode($data),'headers'=>$headers);}
function wp_remote_request($url,$args)
{
 $s=&$GLOBALS['remote'];$method=$args['method'];
 if(strpos($url,'files/'.SBS_Google_Drive::ARCHIVE_FOLDER.'?')!==false)return response_drive(200,array('id'=>SBS_Google_Drive::ARCHIVE_FOLDER,'mimeType'=>'application/vnd.google-apps.folder','capabilities'=>array('canAddChildren'=>true)));
 if(strpos($url,'generateIds')!==false){$s['ids']++;return response_drive(200,array('ids'=>array('reserved-file')));}
 if($method==='GET'){if(!$s['done'])return response_drive(404);return response_drive(200,array('id'=>'reserved-file','mimeType'=>'application/zip','parents'=>array(SBS_Google_Drive::ARCHIVE_FOLDER),'size'=>$s['size'],'md5Checksum'=>$s['bad_hash']?'bad':$s['md5'],'webViewLink'=>'https://drive.google.com/file/d/reserved-file/view'));}
 if($method==='POST'){$s['sessions']++;$meta=json_decode($args['body'],true);if($meta['id']!=='reserved-file'||$meta['parents']!==array(SBS_Google_Drive::ARCHIVE_FOLDER))throw new Exception('Wrong destination or reserved ID');return response_drive(200,array(),array('location'=>'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'));}
 if($args['headers']['Content-Length']==='0'){if($s['done'])return response_drive(200);return response_drive(308,array(),$s['offset']?array('range'=>'bytes=0-'.($s['offset']-1)):array());}
 if(!preg_match('#bytes (\d+)-(\d+)/(\d+)#',$args['headers']['Content-Range'],$m))throw new Exception('Missing resumable byte range');if((int)$m[1]!==$s['offset'])throw new Exception('Retry duplicated or skipped bytes');$s['offset']+=(int)strlen($args['body']);$s['chunks']++;
 if($s['fail_once']){$s['fail_once']=false;return new WP_Error('network','Simulated interrupted reply');}
 if($s['offset']===$s['size']){$s['done']=true;return response_drive(200);}return response_drive(308,array(),array('range'=>'bytes=0-'.($s['offset']-1)));
}
require dirname(__DIR__).'/includes/class-sbs-google-drive.php';
$file=tempnam(sys_get_temp_dir(),'drive-test-');file_put_contents($file,str_repeat('Z',9*1024*1024));$package=array('path'=>$file,'filename'=>'Test-v1.zip','sha256'=>hash_file('sha256',$file));$GLOBALS['settings']=array('sbs_google_tokens'=>json_encode(array('refresh_token'=>'test','access_token'=>'test','expires_at'=>time()+3600)));$GLOBALS['remote']=array('ids'=>0,'sessions'=>0,'chunks'=>0,'offset'=>0,'done'=>false,'size'=>filesize($file),'md5'=>hash_file('md5',$file),'fail_once'=>true,'bad_hash'=>false);
try{$first=SBS_Google_Drive::save_package($package,'work','candidate');if(!is_wp_error($first))throw new Exception('Interrupted upload was reported successful');$next=SBS_Google_Drive::save_package($package,'work','candidate');if(is_wp_error($next)||empty($next['verified']))throw new Exception('Upload did not resume and verify');$again=SBS_Google_Drive::save_package($package,'work','candidate');if(is_wp_error($again)||$GLOBALS['remote']['ids']!==1||$GLOBALS['remote']['sessions']!==1||$GLOBALS['remote']['chunks']!==2)throw new Exception('Retry created duplicate files or repeated upload');$GLOBALS['remote']['bad_hash']=true;if(!is_wp_error(SBS_Google_Drive::save_package($package,'work','candidate')))throw new Exception('A mismatched ZIP checksum was accepted');echo "Drive: interrupted upload resumes with one file ID, exact byte ranges, verified folder/size/checksum, and no duplicate upload.\n";}finally{unlink($file);}
