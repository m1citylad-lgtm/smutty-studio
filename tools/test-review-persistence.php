<?php
define('ABSPATH', __DIR__);
class WP_Error {public $message;function __construct($code,$message,$data=null){$this->message=$message;}}
function is_wp_error($v){return $v instanceof WP_Error;}
function sanitize_key($v){return $v;}
function sanitize_textarea_field($v){return $v;}
function sanitize_text_field($v){return $v;}
function wp_json_encode($v){return json_encode($v);}
class SBS_Storage {static function absolute_path($a){return $a['path'];}}
class SBS_Finishing {
 static function current($r){foreach($r['versions'] as $v){if($v['uuid']===$r['current_version'])return $v;}return null;}
 static function error($c,$m,$status=400){return new WP_Error($c,$m);}
}
class SBS_Logic_Correction {
 static $rules=array('Check lettering');static $decoded=0;
 static function checks(){return array('checks'=>self::$rules);}
 static function review_images($path,$pass){self::$decoded++;return array('local test image');}
}
class SBS_OpenAI {
 static $calls=0;
 static function review_logic_correction($pass,$images,$identity,$rules){self::$calls++;return array('findings'=>array(array('id'=>'new-'.self::$calls,'issue'=>'Review texture')));}
}
class ReviewRequest {private $v;function __construct($v){$this->v=$v;}function get_param($k){return $this->v[$k]??null;}}
require __DIR__.'/../includes/class-sbs-finishing-flow.php';
function check_review($ok,$why){if(!$ok)throw new Exception($why);}
function review_action($r,$data){$out=SBS_Finishing_Flow::handle($r,new ReviewRequest($data));check_review(!is_wp_error($out),'Unexpected failure: '.($out->message??''));return $out;}
$path=tempnam(sys_get_temp_dir(),'sbs-review-');
try {
 file_put_contents($path,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='));
 $asset=array('path'=>$path,'sha256'=>hash_file('sha256',$path));
 $r=array('uuid'=>'purple','original'=>$asset,'versions'=>array(),'current_version'=>null,'flow'=>array('review'=>array('sha256'=>$asset['sha256'],'notes'=>'','character'=>'','passes'=>array('whole'=>array('findings'=>array(array('id'=>'existing','issue'=>'Review texture')))),'decisions'=>array('existing'=>'intentional'))));
 $request=array('action'=>'flow_review','pass'=>'whole','notes'=>'','character'=>'');
 $saved=review_action($r,$request);
 check_review(SBS_OpenAI::$calls===0&&SBS_Logic_Correction::$decoded===0,'Saved review caused image decoding or a paid request');
 check_review($saved['flow']['review']['decisions']['existing']==='intentional','Legacy accepted finding was lost');
 $again=review_action(json_decode(json_encode($saved),true),$request);
 check_review($again['flow']['review']===$saved['flow']['review'],'Reload changed the saved report');
 $more=review_action($saved,array_merge($request,array('pass'=>'regions')));
 check_review($more['flow']['review']['decisions']['existing']==='intentional','Resuming an incomplete check erased decisions');
 $fresh=review_action($saved,array_merge($request,array('fresh'=>true)));
 check_review(empty($fresh['flow']['review']['decisions']),'Explicit fresh check retained old decisions');
 $changed=review_action($saved,array_merge($request,array('notes'=>'New instructions')));
 check_review(empty($changed['flow']['review']['decisions']),'Changed instructions reused decisions');
 SBS_Logic_Correction::$rules=array('New rule');$changed=review_action($saved,$request);
 check_review(empty($changed['flow']['review']['decisions']),'Changed saved rules reused decisions');
 $changed=$saved;$changed['flow']['review']['sha256']='other-art';$changed=review_action($changed,$request);
 check_review(empty($changed['flow']['review']['decisions']),'Changed artwork reused decisions');
 $pixel=array('action'=>'flow_pixels','sha256'=>$asset['sha256'],'remaining'=>2,'alpha'=>array('clear'=>1,'partial'=>0,'opaque'=>0),'reviewed'=>true);
 $saved=review_action($saved,$pixel);$pixel['reviewed']=false;
 $again=review_action(json_decode(json_encode($saved),true),$pixel);
 check_review($again['flow']['pixels']['reviewed']===true,'Same-image rescan forgot intentional marks');
 $pixel['remaining']=3;$changed=review_action($saved,$pixel);
 check_review($changed['flow']['pixels']['reviewed']===false,'Changed findings inherited acceptance');
 $pixel['remaining']=2;$pixel['alpha']=array('clear'=>0,'partial'=>1,'opaque'=>0);$changed=review_action($saved,$pixel);
 check_review($changed['flow']['pixels']['reviewed']===false,'Changed transparency inherited acceptance');
 $changed=$saved;$changed['flow']['pixels']['sha256']='other-art';$pixel['alpha']=array('clear'=>1,'partial'=>0,'opaque'=>0);$changed=review_action($changed,$pixel);
 check_review($changed['flow']['pixels']['reviewed']===false,'Another image inherited acceptance');
 echo "PASS: saved/legacy review and pixel acceptance survive reload/rescan; no duplicate paid check; changed artwork, instructions, rules and scan results require review.\n";
} finally {unlink($path);}
