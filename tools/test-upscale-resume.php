<?php
/** Actual PNGs + persisted action calls; provider requests are local stubs. */
define('ABSPATH',__DIR__.'/');define('SBS_PLUGIN_DIR',dirname(__DIR__).'/');
class WP_Error {public $code;public $message;function __construct($c,$m,$d=null){$this->code=$c;$this->message=$m;}function get_error_code(){return $this->code;}function get_error_message(){return $this->message;}}
function is_wp_error($v){return $v instanceof WP_Error;}function sanitize_key($v){return $v;}function sanitize_text_field($v){return $v;}function sanitize_textarea_field($v){return $v;}
function wp_json_encode($v,$flags=0){return json_encode($v,$flags);}function wp_generate_uuid4(){return bin2hex(random_bytes(16));}function get_option($k,$d=null){return $GLOBALS['settings'][$k]??$d;}function update_option($k,$v,$a=false){$GLOBALS['settings'][$k]=$v;}
function check_resume($ok,$why){if(!$ok)throw new Exception($why);}
class SBS_Finishing_Flow {static function handles($action){return false;}}
class SBS_Storage {
 static $roles=array();static $assets=array();static $fail_save=false;static $fail_checks=false;
 static function ensure_directories(){return true;}static function base_dir(){return $GLOBALS['tmp'];}
 static function absolute_path($a){if(self::$fail_checks&&($a['role']??'')==='finishing_candidate'){self::$fail_checks=false;throw new Error('Injected failure during final image checks');}return $a['path'];}
 static function store_bytes($bytes,$name,$mime,$owner,$id,$role,$title,$meta=array()){
  self::$roles[$role]=(self::$roles[$role]??0)+1;if($role==='finishing_candidate'&&self::$fail_save){self::$fail_save=false;throw new Error('Maximum execution time of 30 seconds exceeded');}
  $id=count(self::$assets)+1;$path=self::base_dir().'/asset-'.$id.'-'.$name;file_put_contents($path,$bytes);
  $a=array('id'=>$id,'uuid'=>'asset-'.$id,'path'=>$path,'filename'=>$name,'mime'=>$mime,'role'=>$role,'sha256'=>hash('sha256',$bytes),'metadata_json'=>json_encode($meta));self::$assets[$id]=$a;return $a;
 }
 static function store_file($p,$name,$mime,$owner,$id,$role,$title){return self::store_bytes(file_get_contents($p),$name,$mime,$owner,$id,$role,$title);}
}
class SBS_Replicate {
 const DEFAULT_VERSION='fixture';static $polls=0;static $downloads=0;static $submits=0;static $bytes='';
 static function poll($id){self::$polls++;return array('id'=>$id,'status'=>'succeeded','output'=>'https://replicate.delivery/local-fixture','metrics'=>array('predict_time'=>1));}
 static function fetch_output($url){self::$downloads++;return self::$bytes;}
 static function submit($id,$scale){self::$submits++;return array('id'=>'next-section-id','status'=>'processing');}
}
class ResumeRequest implements ArrayAccess {
 private $uuid;private $revision;private $action;function __construct($u,$r,$a='poll'){$this->uuid=$u;$this->revision=$r;$this->action=$a;}
 function get_param($k){return $k==='action'?$this->action:($k==='revision'?$this->revision:null);}function offsetExists($k):bool{return true;}function offsetGet($k){return $this->uuid;}function offsetSet($k,$v):void{}function offsetUnset($k):void{}
}
require SBS_PLUGIN_DIR.'includes/class-sbs-finishing.php';require SBS_PLUGIN_DIR.'includes/class-sbs-print-qa.php';require SBS_PLUGIN_DIR.'includes/class-sbs-finishing-image.php';require SBS_PLUGIN_DIR.'includes/class-sbs-finishing-tiles.php';
$tmp=sys_get_temp_dir().'/sbs-resume-'.bin2hex(random_bytes(4));mkdir($tmp);mkdir($tmp.'/finishing');mkdir($tmp.'/tmp');ini_set('error_log',$tmp.'/error.log');
function load_resume($uuid){return json_decode(file_get_contents($GLOBALS['tmp'].'/finishing/'.$uuid.'.json'),true);}
function poll_resume($uuid,$action='poll'){$r=load_resume($uuid);return SBS_Finishing::action(new ResumeRequest($uuid,$r['revision'],$action));}
function fixture_image($w,$h){$im=new Imagick();$im->newImage($w,$h,new ImagickPixel('transparent'),'png');$im->setImageDepth(8);$im->setOption('png:color-type','6');$d=new ImagickDraw();$d->setFillColor('#a05020');$d->rectangle(20,20,$w-20,$h-20);$d->setFillColor('white');$d->rectangle(30,30,39,39);$d->setFillColor('rgba(140,150,160,0.4)');$d->rectangle(45,25,55,35);$im->drawImage($d);return $im;}
function write_record($im,$uuid){$a=SBS_Storage::store_bytes($im->getImagesBlob(),'original.png','image/png','finishing',0,'original','Test');$options=array('method'=>'upscale','width'=>14,'height'=>16,'scale'=>2,'source_asset'=>$a,'source_sha256'=>$a['sha256'],'replicate_prediction_id'=>'existing-paid-job');$r=array('uuid'=>$uuid,'title'=>'Resume fixture','revision'=>1,'original'=>$a,'original_qa'=>SBS_Finishing::inspect($a,$options),'versions'=>array(),'current_version'=>null,'pending'=>$options,'audit'=>array(),'status'=>'AI upscale processing on Replicate');file_put_contents($GLOBALS['tmp'].'/finishing/'.$uuid.'.json',json_encode($r));return $r;}
try{
 $uuid='11111111-0000-4000-8000-000000000001';$im=fixture_image(100,80);$r=write_record($im,$uuid);$hash=$r['original']['sha256'];$remote=clone $im;$remote->resizeImage(200,160,Imagick::FILTER_LANCZOS,1);$remote->setImageAlphaChannel(Imagick::ALPHACHANNEL_DEACTIVATE);SBS_Replicate::$bytes=$remote->getImagesBlob();
 set_time_limit(30);$r=poll_resume($uuid);check_resume(!is_wp_error($r)&&$r['pending']['local_stage']==='download','Completed provider result was not checkpointed');check_resume((int)ini_get('max_execution_time')===120,'Upscale did not request its bounded time allowance');
 check_resume(SBS_Replicate::$downloads===0&&SBS_Replicate::$submits===0,'Provider result check performed extra work');
 $r=poll_resume($uuid);check_resume($r['pending']['local_stage']==='candidate'&&SBS_Replicate::$downloads===1,'Download checkpoint missing');
 check_resume(is_wp_error(poll_resume($uuid,'prepare'))&&is_wp_error(poll_resume($uuid,'run')),'Pending job could be replaced or resubmitted');
 $saved=file_get_contents($tmp.'/finishing/'.$uuid.'.json');SBS_Storage::$fail_save=true;$failed=poll_resume($uuid);check_resume(is_wp_error($failed)&&file_get_contents($tmp.'/finishing/'.$uuid.'.json')===$saved,'Timed-out candidate saving altered the job');
 $r=poll_resume($uuid);check_resume($r['pending']['local_stage']==='checks'&&!$r['versions'],'Saved candidate was not checkpointed before QA');$candidate=$r['pending']['candidate_draft']['asset'];$attempts=SBS_Storage::$roles['finishing_candidate'];
 SBS_Storage::$fail_checks=true;check_resume(is_wp_error(poll_resume($uuid)),'Injected final-check failure did not surface');$r=poll_resume($uuid);check_resume(!is_wp_error($r)&&empty($r['pending'])&&count($r['versions'])===1,'Final checks could not resume');
 check_resume(SBS_Storage::$roles['finishing_candidate']===$attempts&&SBS_Replicate::$downloads===1&&SBS_Replicate::$polls===1&&SBS_Replicate::$submits===0,'Resume repeated image preparation, downloading or paid provider work');
 $v=$r['versions'][0];check_resume($v['qa']['width']===200&&$v['qa']['height']===160&&$v['options']['width']===14&&$v['options']['height']===16,'Pixels or intended print target changed');
 $out=new Imagick($candidate['path']);check_resume($out->getImagePixelColor(0,0)->getColorValue(Imagick::COLOR_ALPHA)<.01,'Clear alpha lost');check_resume($out->getImagePixelColor(68,68)->getColorValue(Imagick::COLOR_ALPHA)>.99,'Opaque white ink lost');$a=$out->getImagePixelColor(100,60)->getColorValue(Imagick::COLOR_ALPHA);check_resume($a>.3&&$a<.5,'Partial fade changed');check_resume(hash_file('sha256',$r['original']['path'])===$hash,'Original changed');check_resume(load_resume($uuid)['current_version']===$v['uuid'],'Saved result did not reopen');
 echo "PASS: persisted single-image stages, timeout/save and QA retries, one provider poll/download, zero duplicate paid requests, image dimensions, target, clear/partial alpha, opaque ink and reopening\n";
 // Resume the pre-v0.4.7 layout at its last tile, then split joining, candidate and QA.
 $uuid='22222222-0000-4000-8000-000000000002';$im=fixture_image(1300,80);$r=write_record($im,$uuid);$tiles=SBS_Finishing_Tiles::plan(1300,80);
 foreach($tiles as $i=>&$t){$part=clone $im;$part->cropImage($t['crop_width'],$t['crop_height'],$t['left'],$t['top']);$part->setImagePage(0,0,0,0);$part->resizeImage($t['crop_width']*2,$t['crop_height']*2,Imagick::FILTER_LANCZOS,1);$part->setImageAlphaChannel(Imagick::ALPHACHANNEL_DEACTIVATE);$bytes=$part->getImagesBlob();if($i<count($tiles)-1)$t['output']=SBS_Storage::store_bytes($bytes,'section.png','image/png','finishing',0,'upscale_section','Test');else SBS_Replicate::$bytes=$bytes;$part->clear();}unset($t);
 $r['pending']['tiles']=$tiles;$r['pending']['tile_index']=count($tiles)-1;file_put_contents($tmp.'/finishing/'.$uuid.'.json',json_encode($r));$before=SBS_Replicate::$polls;
 $r=poll_resume($uuid);check_resume($r['pending']['local_stage']==='assemble'&&empty($r['pending']['local_asset']),'Last section was not saved before joining');
 $r=poll_resume($uuid);check_resume($r['pending']['local_stage']==='candidate'&&getimagesize($r['pending']['local_asset']['path'])[0]===2600,'Joined image was not saved separately');
 $r=poll_resume($uuid);check_resume($r['pending']['local_stage']==='checks','Candidate did not checkpoint before QA');$r=poll_resume($uuid);check_resume(empty($r['pending'])&&$r['versions'][0]['qa']['width']===2600&&$r['versions'][0]['qa']['height']===160,'Tiled result dimensions wrong');
 check_resume(SBS_Replicate::$polls===$before+1&&SBS_Replicate::$submits===0,'Legacy tile recovery repeated provider work');
 echo "PASS: legacy last-tile recovery, separate section/join/candidate/check checkpoints, native dimensions and zero paid submissions\n";
 // Advancing a non-final section persists it before preparing/submitting the next one.
 $r['pending']=array('method'=>'upscale','width'=>14,'height'=>16,'scale'=>2,'source_asset'=>$r['original'],'tiles'=>$tiles,'tile_index'=>0,'replicate_prediction_id'=>'finished-first-section');$r=SBS_Finishing_Tiles::advance($r,array());check_resume($r['pending']['local_stage']==='next_section'&&SBS_Replicate::$submits===0,'Section advance submitted the next job before persistence');
 $r=SBS_Finishing_Tiles::submit_next($r);check_resume(!is_wp_error($r)&&empty($r['pending']['local_stage'])&&$r['pending']['replicate_prediction_id']==='next-section-id'&&SBS_Replicate::$submits===1,'Next-section submission did not resume its checkpoint');
 echo "PASS: next section submission separated from completed-section saving\n";
}finally{set_time_limit(0);$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);foreach($it as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($tmp);}
