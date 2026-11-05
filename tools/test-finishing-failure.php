<?php
/** Engine/fatal containment and recovery use local stubs: no provider requests. */
define('ABSPATH',__DIR__);
class WP_Error {public $code;public $message;public function __construct($code,$message,$data=null){$this->code=$code;$this->message=$message;}function get_error_code(){return $this->code;}function get_error_message(){return $this->message;}}
function is_wp_error($v){return $v instanceof WP_Error;}
function sanitize_key($s){return strtolower(preg_replace('/[^a-zA-Z0-9_-]/','',$s));}
function add_filter($tag,$callback,$priority,$args){$GLOBALS['filters'][$tag][]=$callback;}
function wp_raise_memory_limit($context){$GLOBALS['raised']=$context;}
function update_option($key,$value,$autoload){$GLOBALS['options'][$key]=$value;file_put_contents($GLOBALS['tmp'].'/diagnostic.json',json_encode($value));}
class SBS_Storage {static function ensure_directories(){return true;}static function base_dir(){return $GLOBALS['tmp'];}}
class SBS_Finishing_Flow {static function handles($action){
 if($GLOBALS['mode']==='provider')return false;
 SBS_Finishing::processing_stage('restore_transparency');
 if(in_array($GLOBALS['mode'],array('fatal','wp-fatal'),true)){$large=str_repeat('x',64*1024*1024);}
 throw new Error('Injected failure /private/path Bearer secret-api-key');
}}
class SBS_Replicate {static $submits=0;static function poll($id){return new WP_Error('provider_unavailable','Private provider detail Bearer secret-api-key');}static function submit($id,$scale){self::$submits++;}}
require __DIR__.'/../includes/class-sbs-finishing.php';
class Request implements ArrayAccess {function get_param($k){return $k==='action'?'poll':1;}function offsetExists($k):bool{return true;}function offsetGet($k){return '12345678-1234-1234-1234-123456789abc';}function offsetSet($k,$v):void{}function offsetUnset($k):void{}}
function check_failure($ok,$why){if(!$ok)throw new Exception($why);}
$mode=$argv[1]??'engine';$tmp=$argv[2]??sys_get_temp_dir().'/sbs-failure-'.bin2hex(random_bytes(4));
if(!is_dir($tmp))mkdir($tmp);mkdir($tmp.'/finishing');ini_set('error_log',$tmp.'/error.log');
$path=$tmp.'/finishing/12345678-1234-1234-1234-123456789abc.json';$record=array('revision'=>1,'pending'=>array('method'=>'upscale','replicate_prediction_id'=>'existing-paid-job'),'versions'=>array(),'current_version'=>null);$bytes=json_encode($record);file_put_contents($path,$bytes);
if($mode==='wp-fatal'){register_shutdown_function(function(){foreach(($GLOBALS['filters']['wp_php_error_message']??array()) as $callback){$callback('Critical error',error_get_last());}exit(255);});}
if(in_array($mode,array('fatal','wp-fatal'),true)){echo 'Fatal fixture mode='.$mode.' tmp='.$tmp.PHP_EOL;register_shutdown_function(function(){echo 'Fixture shutdown last='.json_encode(error_get_last()).' options='.json_encode($GLOBALS['options']??null).PHP_EOL;});SBS_Finishing::action(new Request());exit(2);}
try{
 $result=SBS_Finishing::action(new Request());
 check_failure(is_wp_error($result)&&$result->code==='finishing_processing_failed','Engine error was not contained');
 check_failure(file_get_contents($path)===$bytes,'Failed polling modified the saved job');
 check_failure(($GLOBALS['raised']??'')==='image','Image allowance not requested');
 $failure=$GLOBALS['options']['sbs_finishing_last_failure']??array();
 check_failure(($failure['action']??'')==='poll'&&($failure['stage']??'')==='restore_transparency','Failure stage missing');
 check_failure(strpos(json_encode($failure),'secret-api-key')===false&&strpos(json_encode($failure),'/private/path')===false,'Private diagnostic leaked');
 check_failure(strpos(file_get_contents($tmp.'/error.log'),'secret-api-key')===false,'Exception secret copied to plugin log');
 $lock=fopen($path.'.lock','c');check_failure(flock($lock,LOCK_EX|LOCK_NB),'Workspace lock not released');flock($lock,LOCK_UN);fclose($lock);
 $mode='provider';$result=SBS_Finishing::action(new Request());check_failure($result->code==='provider_unavailable','Provider error changed');
 check_failure(($GLOBALS['options']['sbs_finishing_last_failure']['stage']??'')==='provider_status','Provider-stage error not recorded');
 $method=new ReflectionMethod('SBS_Finishing','start_upscale');$method->setAccessible(true);$result=$method->invoke(null,$record);
 check_failure(is_wp_error($result)&&$result->code==='finishing_upscale_exists'&&SBS_Replicate::$submits===0,'Existing job could be submitted again');
 foreach(array('fatal','wp-fatal') as $fatalMode){$fatalDir=$tmp.'/'.$fatalMode;mkdir($fatalDir);$command=escapeshellarg(PHP_BINARY).' -d memory_limit=32M '.escapeshellarg(__FILE__).' '.escapeshellarg($fatalMode).' '.escapeshellarg($fatalDir).' 2>&1';exec($command,$output,$exit);
 check_failure($exit!==0,'Fatal fixture did not reach memory limit');
 $fatal=json_decode(file_get_contents($fatalDir.'/diagnostic.json'),true);if(!$fatal){echo 'Child diagnostic debug: '.implode(' ', $output).' Log: '.(is_file($fatalDir.'/error.log')?file_get_contents($fatalDir.'/error.log'):'missing log').PHP_EOL;}
 check_failure(($fatal['stage']??'')==='restore_transparency'&&strpos($fatal['reason']??'','ran out')!==false,'Real memory fatal did not save safe stage/reason: '.json_encode($fatal).' Child output: '.implode(' ', $output));
 check_failure(file_get_contents($fatalDir.'/finishing/'.basename($path))===$bytes,'Memory fatal changed provider tracking');}
 echo "PASS: engine and real memory-fatal diagnostics, secret exclusion, provider failure stage, retained saved job, duplicate-submit refusal and lock release\n";
}finally{
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($tmp);
}
