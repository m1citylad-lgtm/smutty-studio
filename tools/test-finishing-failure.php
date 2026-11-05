<?php
define('ABSPATH',__DIR__);
class WP_Error {public $code;public function __construct($code,$message,$data=null){$this->code=$code;}}
function is_wp_error($v){return $v instanceof WP_Error;}
function sanitize_key($s){return $s;}
function wp_raise_memory_limit($context){$GLOBALS['raised']=$context;}
function update_option($key,$value,$autoload){$GLOBALS['options'][$key]=$value;}
class SBS_Storage {static function ensure_directories(){return true;}static function base_dir(){return $GLOBALS['tmp'];}}
class SBS_Finishing_Flow {static function handles($action){throw new Error('Injected image tool failure with /private/path');}}
require __DIR__.'/../includes/class-sbs-finishing.php';
class Request implements ArrayAccess {function get_param($k){return $k==='action'?'poll':1;}function offsetExists($k):bool{return true;}function offsetGet($k){return '12345678-1234-1234-1234-123456789abc';}function offsetSet($k,$v):void{}function offsetUnset($k):void{}}
$tmp=sys_get_temp_dir().'/sbs-failure-'.bin2hex(random_bytes(4));mkdir($tmp);mkdir($tmp.'/finishing');ini_set('error_log',$tmp.'/error.log');$path=$tmp.'/finishing/12345678-1234-1234-1234-123456789abc.json';$bytes=json_encode(array('revision'=>1,'pending'=>array('replicate_prediction_id'=>'existing-paid-job')));file_put_contents($path,$bytes);
try{
 $result=SBS_Finishing::action(new Request());
 if(!is_wp_error($result)||$result->code!=='finishing_processing_failed')throw new Exception('Engine error was not converted to a structured error');
 if(file_get_contents($path)!==$bytes)throw new Exception('Failed polling modified the saved job');
 if(($GLOBALS['raised']??'')!=='image')throw new Exception('Image memory allowance was not requested');
 $failure=$GLOBALS['options']['sbs_finishing_last_failure']??array();
 if(($failure['action']??'')!=='poll'||strpos(json_encode($failure),'/private/path')!==false)throw new Exception('Safe diagnostic missing or private exception text exposed');
 $lock=fopen($path.'.lock','c');if(!flock($lock,LOCK_EX|LOCK_NB))throw new Exception('Workspace lock was not released');flock($lock,LOCK_UN);fclose($lock);
 echo "PASS: engine error containment, safe diagnostics, saved provider tracking, memory allowance and lock release\n";
}finally{foreach(glob($tmp.'/finishing/*') as $f)unlink($f);rmdir($tmp.'/finishing');foreach(glob($tmp.'/*') as $f)unlink($f);rmdir($tmp);}
