<?php
/** Real finishing/storage/crypto/transport handlers, with isolated DB and HTTP doubles.
 * No network, account credentials, production files or registers are touched. */
error_reporting(E_ALL);
define('ABSPATH', __DIR__);
define('ARRAY_A', 'ARRAY_A');
define('SBS_PRIVATE_DATA_DIR',sys_get_temp_dir().'/sbs-drive-test-'.bin2hex(random_bytes(8)));
class WP_Error {
    public $code,$message,$data;
    function __construct($c,$m,$d=array()){$this->code=$c;$this->message=$m;$this->data=$d;}
    function get_error_data(){return $this->data;}
}
class WP_REST_Response {
    public $data,$headers=array();function __construct($d){$this->data=$d;}
    function header($k,$v){$this->headers[$k]=$v;}
}
class Request extends ArrayObject {
    public $method,$headers;
    function __construct($p=array(),$m='POST',$h=array()){parent::__construct($p);$this->method=$m;$this->headers=$h;}
    function get_param($k){return $this[$k]??null;}
    function get_method(){return $this->method;}
    function get_header($k){return $this->headers[$k]??null;}
}
class SBS_REST {const NS='smutty-bear/v1';static $authenticated=true;static function permission($r){return self::$authenticated;}}
class SBS_Auth {const COOKIE='test_studio_session';}
class SBS_Plugin {static function studio_slug(){return 'smutty-studio';}}
class SBS_DB {static function table($name){if($name!=='assets')throw new Exception('Unexpected production table');return $name;}}
class AssetDB {
    public $insert_id=0,$rows=array();
    function insert($table,$r){$this->insert_id++;$r['id']=$this->insert_id;$this->rows[$r['id']]=$r;return 1;}
    function prepare($q,...$args){return array($q,$args);}
    function get_row($q,$format){return $this->rows[$q[1][0]]??null;}
    function get_var($q){return $this->rows[$q[1][0]]['relative_path']??null;}
    function delete($table,$where,$format){unset($this->rows[$where['id']]);return 1;}
}
$wpdb=new AssetDB();$options=array();$routes=array();$ssl=true;$remote=array();$fault='';$refreshes=0;$creates=0;$posts=0;$reserves=0;
function check($v,$why){if(!$v)throw new Exception($why);}
function good($v,$why){if($v instanceof WP_Error)throw new Exception($why.': '.$v->message);return $v;}
function error_is($v,$status,$why){check($v instanceof WP_Error && ($v->data['status']??null)===$status,$why);}
function is_wp_error($v){return $v instanceof WP_Error;}
function wp_salt($v){return 'DISPOSABLE_TEST_SALT_'.$v;}
function wp_json_encode($v,$flags=0){return json_encode($v,$flags);}
function get_option($k,$d=''){global $options;return $options[$k]??$d;}
function update_option($k,$v,$autoload=false){global $options;$old=$options[$k]??null;$options[$k]=$v;return $v!==$old;}
function delete_option($k){global $options;unset($options[$k]);}
function is_ssl(){global $ssl;return $ssl;}
function sanitize_file_name($v){return preg_replace('/[^A-Za-z0-9._-]/','-',(string)$v);}
function sanitize_text_field($v){return trim(strip_tags((string)$v));}
function sanitize_textarea_field($v){return sanitize_text_field($v);}
function sanitize_key($v){return preg_replace('/[^a-z0-9_-]/','',strtolower($v));}
function sanitize_mime_type($v){return $v;}
function current_time($v,$utc){return gmdate('Y-m-d H:i:s');}
function home_url($p){return 'https://studio.example.test'.$p;}
function rest_url($p){return home_url('/wp-json/'.$p);}
function wp_normalize_path($p){return $p;}
function untrailingslashit($p){return rtrim($p,'/');}
function wp_mkdir_p($p){return is_dir($p)||mkdir($p,0700,true);}
function wp_generate_uuid4(){$h=bin2hex(random_bytes(16));return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-a'.substr($h,17,3).'-'.substr($h,20);}
function register_rest_route($ns,$path,$config){global $routes;$routes[$path]=$config;}
function wp_remote_retrieve_response_code($r){return $r['status']??0;}
function wp_remote_retrieve_body($r){return $r['body']??'';}
function response($data,$status=200){return array('status'=>$status,'body'=>is_string($data)?$data:json_encode($data));}
function wp_remote_get($url,$args){
    global $remote,$fault,$reserves;
    check(strpos($url,'https://www.googleapis.com/drive/v3/files')===0,'Unexpected GET destination');
    check(($args['redirection']??null)===0,'GET follows redirects with credentials');
    if(strpos($url,'/generateIds?')!==false){$reserves++;return response(array('ids'=>array('reserved_file_'.str_pad($reserves,10,'0',STR_PAD_LEFT))));}
    $id=basename(parse_url($url,PHP_URL_PATH));parse_str(parse_url($url,PHP_URL_QUERY)??'',$query);
    if($fault==='denied')return response(array(),403);
    if(!isset($remote[$id]))return response(array(),404);
    if(($query['alt']??'')==='media')return response($fault==='bad-download'?'corrupt':$remote[$id]['bytes']);
    $meta=$remote[$id]['meta'];if($fault==='wrong-checksum')$meta['md5Checksum']=str_repeat('0',32);
    return response($meta);
}
function wp_remote_post($url,$args){
    global $remote,$fault,$refreshes,$creates,$posts;
    check(($args['redirection']??null)===0,'POST follows redirects with credentials');
    if($url==='https://oauth2.googleapis.com/token'){
        $refreshes++;if($fault==='refresh-denied')return response(array('error'=>'invalid_grant'),400);
        return response(array('access_token'=>'DISPOSABLE_ACCESS_TOKEN','token_type'=>'Bearer','expires_in'=>3600,'scope'=>SBS_Google_Drive::SCOPE));
    }
    check(strpos($url,'https://www.googleapis.com/upload/drive/v3/files?')===0,'Unexpected POST destination');$posts++;
    preg_match('/boundary=([^;]+)/',$args['headers']['Content-Type'],$m);$parts=explode('--'.$m[1],$args['body']);
    $json=explode("\r\n\r\n",$parts[1],2)[1];$meta=json_decode(trim($json),true);
    $bytes=substr(explode("\r\n\r\n",$parts[2],2)[1],0,-2);$id=$meta['id'];
    check(isset($meta['appProperties']['sbs_operation']),'Missing upload operation reference');
    if(isset($remote[$id]))return response(array(),409);
    $creates++;$meta['mimeType']='application/zip';$meta['size']=strlen($bytes);$meta['md5Checksum']=md5($bytes);
    $remote[$id]=array('meta'=>$meta,'bytes'=>$bytes);
    if($fault==='lost-response')return new WP_Error('timeout','Simulated lost response');
    return response(array('id'=>$id),201);
}
require __DIR__.'/../includes/class-sbs-crypto.php';
require __DIR__.'/../includes/class-sbs-storage.php';
require __DIR__.'/../includes/class-sbs-google-drive.php';
require __DIR__.'/../includes/class-sbs-google-drive-transport.php';
require __DIR__.'/../includes/class-sbs-finishing.php';
function tokens($expiry){update_option('sbs_google_tokens',SBS_Crypto::encrypt(json_encode(array('refresh_token'=>'DISPOSABLE_REFRESH_TOKEN','access_token'=>'DISPOSABLE_ACCESS_TOKEN','expires_at'=>$expiry))));}
function act($record,$action,$extra=array()) {return SBS_Finishing::action(new Request(array_merge(array('uuid'=>$record['uuid'],'revision'=>$record['revision'],'action'=>$action),$extra)));}
function save_to_drive($record,$folder='disposable_folder_01'){return SBS_Finishing::save_drive(new Request(array('uuid'=>$record['uuid'],'revision'=>$record['revision'],'folder_id'=>$folder)));}
function remove_tree($dir){if(!is_dir($dir))return;foreach(scandir($dir) as $f){if($f==='.'||$f==='..')continue;$p=$dir.'/'.$f;if(is_dir($p))remove_tree($p);else unlink($p);}rmdir($dir);}
register_shutdown_function(function(){remove_tree(SBS_PRIVATE_DATA_DIR);});
check(extension_loaded('gd')&&class_exists('ZipArchive'),'Tests require PHP GD and ZipArchive');
$_COOKIE[SBS_Auth::COOKIE]='DISPOSABLE_SESSION';
SBS_Finishing::register_routes();SBS_Google_Drive::register_routes();
foreach($routes as $r){check($r['permission_callback']===array('SBS_Finishing','permission'),'Drive route missing session/CSRF guard');}
SBS_REST::$authenticated=false;check(!SBS_Finishing::permission(new Request()),'Anonymous request accepted');SBS_REST::$authenticated=true;
error_is(SBS_Finishing::permission(new Request()),403,'Missing CSRF accepted');
check(SBS_Finishing::permission(new Request(array(),'POST',array('x-sbs-finishing'=>SBS_Finishing::csrf())))===true,'Valid CSRF rejected');
$csrf=SBS_Finishing::csrf();$_COOKIE[SBS_Auth::COOKIE]='OTHER_SESSION';error_is(SBS_Finishing::permission(new Request(array(),'POST',array('x-sbs-finishing'=>$csrf))),403,'Cross-session CSRF accepted');$_COOKIE[SBS_Auth::COOKIE]='DISPOSABLE_SESSION';
$id='123456789012-test.apps.googleusercontent.com';
good(SBS_Google_Drive::configure(new Request(array('client_id'=>$id,'client_secret'=>'DISPOSABLE_CLIENT_SECRET'))),'Initial configuration');
tokens(time()+3600);$before=$options['sbs_google_tokens'];$generation=$options['sbs_google_generation'];
good(SBS_Google_Drive::configure(new Request(array('client_id'=>$id,'client_secret'=>'','picker_api_key'=>str_repeat('x',39)))),'Add Picker without reconnect');
check($before===$options['sbs_google_tokens']&&$generation===$options['sbs_google_generation'],'Picker setup invalidated working Google connection');
error_is(SBS_Google_Drive::configure(new Request(array('client_id'=>$id,'client_secret'=>'replacement'))),409,'OAuth replacement allowed while connected');
$ssl=false;error_is(SBS_Google_Drive::configure(new Request()),403,'HTTP configuration allowed');$ssl=true;
$picker=good(SBS_Google_Drive::picker(),'Picker settings');check($picker->headers['Cache-Control']==='no-store, private'&&$picker->data['app_id']==='123456789012','Picker response cache or app ID incorrect');
check(strpos(json_encode(SBS_Google_Drive::status()),'DISPOSABLE_')===false,'Status exposes token or secret');
tokens(time()-10);good(SBS_Google_Drive_Transport::access_token(),'Token refresh');check($refreshes===1,'Expired token not refreshed');
good(SBS_Google_Drive_Transport::access_token(),'Cached token');check($refreshes===1,'Valid token refreshed unnecessarily');
tokens(time()-10);$fault='refresh-denied';error_is(SBS_Google_Drive_Transport::access_token(),401,'Revoked refresh token accepted');$fault='';tokens(time()+3600);
$remote['disposable_folder_01']=array('meta'=>array('id'=>'disposable_folder_01','mimeType'=>'application/vnd.google-apps.folder','capabilities'=>array('canAddChildren'=>true)));
error_is(SBS_Finishing::import_drive(new Request(array('file_id'=>null))),400,'Null file ID accepted');
error_is(SBS_Finishing::import_drive(new Request(array('file_id'=>array('bad')))),400,'Array file ID accepted');
$im=imagecreatetruecolor(5,7);imagefilledrectangle($im,0,0,4,6,imagecolorallocate($im,80,100,200));
foreach(array('png'=>'image/png','jpeg'=>'image/jpeg','webp'=>'image/webp') as $format=>$mime){
    ob_start();$fn='image'.$format;$fn($im);$bytes=ob_get_clean();$file='disposable_image_'.$format;
    $remote[$file]=array('bytes'=>$bytes,'meta'=>array('id'=>$file,'name'=>'test.'.$format,'mimeType'=>$mime,'size'=>strlen($bytes),'md5Checksum'=>md5($bytes)));
    $request=new Request(array('file_id'=>$file,'title'=>'Disposable '.$format,'ideas'=>'IDEA-001','sb'=>''));
    $r=good(SBS_Finishing::import_drive($request),'Import '.$format);check($r['af_id']===null&&$r['source_route']==='google_drive','Import allocated an AF reference');
    check(file_get_contents(SBS_Storage::absolute_path($r['original']))===$bytes,'Original bytes changed');
    $asset_count=count($wpdb->rows);$same=good(SBS_Finishing::import_drive($request),'Duplicate import');check($same['uuid']===$r['uuid']&&count($wpdb->rows)===$asset_count,'Duplicate workspace/asset created');
    error_is(save_to_drive($r),409,'Unapproved image saved');
    $r=good(act($r,'prepare',array('options'=>array('method'=>'inspect'))),'Prepare');
    $r=good(act($r,'run'),'Process');check(count($r['versions'])===1&&$r['versions'][0]['asset']['sha256']===$r['original']['sha256'],'Inspect altered original or version missing');
    error_is(act($r,'approve',array('checks'=>array('identity'=>true))),400,'Incomplete human review accepted');
    $checks=array_fill_keys(array('identity','lettering','texture','garments','warnings'),true);
    $r=good(act($r,'approve',array('checks'=>$checks)),'Local approval');check($r['approval']['scope']==='local_finishing_only'&&$r['af_id']===null,'Approval changed production policy');
    $export=good(act($r,'export'),'Package export');$zip=new ZipArchive();check($zip->open(SBS_Storage::absolute_path($export['package']))===true,'Invalid ZIP');
    check($zip->getFromName('original/'.$r['original']['filename'])===$bytes,'ZIP original changed');
    check($zip->getFromName('candidate/'.$r['versions'][0]['asset']['filename'])===$bytes,'ZIP candidate changed');$zip->close();
    $fault='lost-response';$start=$creates;error_is(save_to_drive($r),503,'Lost response incorrectly reported success');check($creates===$start+1,'Upload never created');
    $disk=good(SBS_Finishing::get(new Request(array('uuid'=>$r['uuid']),'GET')),'Reopen after interrupted save');check(!empty($disk['drive']['pending_save']['file_id']),'Upload intent not persisted');
    $fault='';$saved=good(save_to_drive($disk),'Safe retry');check($creates===$start+1,'Lost response retry created duplicate');
    check($saved['drive']['verified']&&$saved['drive']['package_sha256']===hash('sha256',$remote[$saved['drive']['approved_master_file_id']]['bytes']),'Saved package integrity missing');
    $again=good(save_to_drive($saved),'Repeat verified save');check(!empty($again['drive_save_already_complete'])&&$creates===$start+1,'Repeat save created duplicate');
    $fault='wrong-checksum';error_is(save_to_drive($saved),409,'Changed remote package reported verified');$fault='';
    $remote_id=$saved['drive']['approved_master_file_id'];$backup=$remote[$remote_id];unset($remote[$remote_id]);error_is(save_to_drive($saved),404,'Deleted remote package reported saved');$remote[$remote_id]=$backup;
    check(good(SBS_Finishing::get(new Request(array('uuid'=>$saved['uuid']),'GET')),'Reopen saved workspace')['drive']['approved_master_file_id']===$remote_id,'Saved link lost after reopen');
    file_put_contents(SBS_Storage::absolute_path($saved['original']),'tampered');error_is(save_to_drive($saved),409,'Tampered original exported');
}
imagedestroy($im);
// Expiry lock and absent-token failures preserve the stored connection.
tokens(time()-1);$lock=fopen(SBS_PRIVATE_DATA_DIR.'/tmp/google-oauth.lock','c');flock($lock,LOCK_EX);
error_is(SBS_Google_Drive_Transport::access_token(),409,'Concurrent refresh ignored lock');flock($lock,LOCK_UN);fclose($lock);
$stored_tokens=$options['sbs_google_tokens'];delete_option('sbs_google_tokens');error_is(SBS_Google_Drive_Transport::access_token(),401,'Disconnected token accepted');update_option('sbs_google_tokens',$stored_tokens);tokens(time()+3600);
$sample='disposable_image_png';$remote['bad_image_00001']=$remote[$sample];$remote['bad_image_00001']['meta']['id']='bad_image_00001';
$remote['bad_image_00001']['meta']['md5Checksum']=str_repeat('0',32);error_is(SBS_Google_Drive_Transport::image_bytes('bad_image_00001'),409,'Invalid image checksum accepted');
$remote['bad_image_00001']['meta']['size']=20971521;error_is(SBS_Google_Drive_Transport::image_bytes('bad_image_00001'),400,'Oversized image accepted');
$remote['bad_image_00001']['meta']['size']=strlen($remote[$sample]['bytes']);$remote['bad_image_00001']['meta']['md5Checksum']=md5($remote[$sample]['bytes']);$remote['bad_image_00001']['meta']['mimeType']='image/jpeg';error_is(SBS_Google_Drive_Transport::image_bytes('bad_image_00001'),400,'MIME mismatch accepted');
$fault='bad-download';error_is(SBS_Google_Drive_Transport::image_bytes($sample),409,'Corrupt downloaded bytes accepted');$fault='';
$pixel_bytes=$remote[$sample]['bytes'];$pixel_bytes=substr_replace($pixel_bytes,pack('NN',100000,100000),16,8);$pixel_bytes=substr_replace($pixel_bytes,pack('N',crc32(substr($pixel_bytes,12,17))),29,4);
$remote['pixel_bomb_000001']=array('bytes'=>$pixel_bytes,'meta'=>array('id'=>'pixel_bomb_000001','mimeType'=>'image/png','size'=>strlen($pixel_bytes),'md5Checksum'=>md5($pixel_bytes)));error_is(SBS_Google_Drive_Transport::image_bytes('pixel_bomb_000001'),400,'Image exceeds pixel limit');
$stale=$saved;$stale['revision']--;error_is(save_to_drive($stale),409,'Stale revision accepted');
$fault='denied';error_is(SBS_Google_Drive_Transport::image_bytes($sample),403,'Denied image imported');$fault='';
$remote['disposable_folder_01']['meta']['capabilities']['canAddChildren']=false;
error_is(SBS_Google_Drive_Transport::upload_new('disposable_folder_01','test.zip','application/zip','bytes',str_repeat('a',64),'reserved_test_001'),403,'Read-only folder upload attempted');
check(count(glob(SBS_PRIVATE_DATA_DIR.'/finishing/*.json'))===3,'Unexpected workspace count');
echo "PASS: real PHP crypto/storage/finishing/Drive handlers; session and CSRF; connected Picker-key setup; token refresh/revocation; PNG/JPEG/WebP untouched imports and duplicate prevention; workspace reopen; explicit human review; ZIP contents; durable upload retry and checksum verification; denied/read-only/oversize/MIME/tamper/deleted-file failures. HTTP and DB are isolated test doubles; no live Google access tested.\n";
