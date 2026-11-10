<?php
define('ABSPATH',__DIR__.'/');
class WP_Error {public $message;function __construct($c,$m,$d=null){$this->message=$m;}}
function is_wp_error($v){return $v instanceof WP_Error;}
function sanitize_text_field($v){return trim(strip_tags($v));}
class SBS_Finishing {static function error($c,$m){return new WP_Error($c,$m);}}
require dirname(__DIR__).'/includes/class-sbs-intake.php';
function check($v,$message){if(!$v)throw new Exception($message);}
foreach(array('SB','MB','TT','PW') as $series){$i=SBS_Intake::validate($series,'Play With My Tail');check($i['series']===$series&&$i['artwork_name']==='Play With My Tail','Valid identity lost');check(!isset($i['production_id']),'Studio allocated an ID');}
check(is_wp_error(SBS_Intake::validate('XX','Artwork')),'Unsupported series accepted');
check(is_wp_error(SBS_Intake::validate('SB','   ')),'Blank name accepted');
$r=SBS_Intake::export_record(array('title'=>'MB Original Madam'),'MB');check($r['artwork_name']==='Original Madam','Duplicate series prefix retained');
$r=SBS_Intake::export_record(array('title'=>'Old title','series'=>'PW','artwork_name'=>'New Name','intake_identity_version'=>1),'SB');check($r['series']==='PW'&&$r['artwork_name']==='New Name','Saved intake identity did not control export');
check($r['package_title']==='New Name','New package ignored artwork name');$legacy=SBS_Intake::export_record(array('title'=>'MB Original Madam'),'MB');check($legacy['package_title']==='MB Original Madam','Legacy checkpoint naming changed');
$r['status']='Awaiting Review';check(SBS_Intake::complete($r,array('verified'=>true))['status']==='Awaiting Review','Missing register verification marked complete');
check(SBS_Intake::complete($r,array('verified'=>true,'register'=>array('verified'=>true)))['status']===SBS_Intake::COMPLETE,'Verified export did not mark Studio Complete');
check(strpos(SBS_Intake::report($r),'Series: PW')!==false,'Report identity missing');
echo "Intake series/name validation, legacy identity, no ID allocation and verified-only handoff passed.\n";
