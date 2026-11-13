<?php
define('ABSPATH',__DIR__.'/');
class WP_Error {public $message;function __construct($c,$m,$d=null){$this->message=$m;}}
function get_option($k,$d=array()){return $GLOBALS['test_options'][$k]??$d;}
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

class PreferenceRequest {private $p;function __construct($p){$this->p=$p;}function get_param($k){return $this->p[$k]??null;}}
$p=SBS_Studio_Preferences::read();
$p=SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>0,'operation'=>'series_add','code'=>'df','name'=>'Dragonfly')));check($p['series']['DF']==='Dragonfly','Custom series not added');
$GLOBALS['test_options']['sbs_studio_preferences']=$p;
check(SBS_Intake::validate('DF','Wings')['series_name']==='Dragonfly','New series blocked at intake');
check(is_wp_error(SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>1,'operation'=>'series_add','code'=>'DF','name'=>'Other')))),'Duplicate code accepted');
check(is_wp_error(SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>1,'operation'=>'series_add','code'=>'ZZ','name'=>'dragonfly')))),'Duplicate name accepted');
$values=array('tone'=>40,'fade'=>30,'halftone'=>30,'distress'=>10);
$p=SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>1,'operation'=>'profile_save','settings'=>$values)));check($p['profiles']['40-30-30-10']['settings']===$values,'Profile values changed');
check(is_wp_error(SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>1,'operation'=>'profile_save','settings'=>$values)))),'Stale revision overwrote settings');
check(is_wp_error(SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>2,'operation'=>'profile_save','settings'=>$values)))),'Duplicate profile saved');
check(is_wp_error(SBS_Studio_Preferences::strengths(array_merge($values,array('tone'=>101)))),'Out-of-range accepted');
check(is_wp_error(SBS_Studio_Preferences::strengths(array_merge($values,array('tone'=>'40')))),'Unvalidated numeric string accepted');
$p=SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>2,'operation'=>'commit','workspace'=>'aaaaaaaa-0000-4000-8000-000000000001','preset'=>'vintage','settings'=>$values)));check($p['workspaces']['aaaaaaaa-0000-4000-8000-000000000001']['tone']===40,'Committed values not retained');
$p=SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>3,'operation'=>'profile_rename','id'=>'40-30-30-10','name'=>'My vintage')));check($p['profiles']['40-30-30-10']['name']==='My vintage','Rename failed');
check(is_wp_error(SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>4,'operation'=>'profile_delete','id'=>'40-30-30-10')))),'Unconfirmed delete accepted');
$p=SBS_Studio_Preferences::change($p,new PreferenceRequest(array('revision'=>4,'operation'=>'profile_delete','id'=>'40-30-30-10','confirm'=>true)));check(!$p['profiles'],'Delete failed');
echo "Custom series, immutable built-ins, duplicate handling, validation, profile CRUD and concurrent revision protection passed.\n";
