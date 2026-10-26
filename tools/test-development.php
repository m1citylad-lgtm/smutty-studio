<?php
// Exercise the real correction handler with a captured generation transport.
// No provider calls, production database, or artwork writes occur in this test.
error_reporting(E_ALL & ~E_DEPRECATED);
const ARRAY_A = 'ARRAY_A';
function sanitize_text_field($v) { return trim(strip_tags((string) $v)); }
function sanitize_textarea_field($v) { return sanitize_text_field($v); }
class WP_Error { public $code; public function __construct($code, $message, $data) { $this->code=$code; } }
class WP_REST_Request implements ArrayAccess {
    public $params=[];
    public function __construct($method) {}
    public function set_param($k,$v) {$this->params[$k]=$v;}
    public function get_param($k) {return $this->params[$k] ?? null;}
    public function offsetExists($k): bool {return isset($this->params[$k]);}
    public function offsetGet($k) {return $this->get_param($k);}
    public function offsetSet($k,$v): void {$this->set_param($k,$v);}
    public function offsetUnset($k): void {unset($this->params[$k]);}
}
class SBS_DB {
    public static $generation;
    public static function row_by_uuid($table,$uuid) {return self::$generation && self::$generation['uuid']===$uuid ? self::$generation : null;}
    public static function table($table) {return $table;}
}
class FakeDB {
    public $project;
    public function prepare($query,...$args) {return $query;}
    public function get_row($query,$format) {return $this->project;}
    public function get_var($query) {return json_encode(['size'=>'1536x1024','quality'=>'high','background'=>'opaque']);}
}
$source=file_get_contents(__DIR__.'/../includes/class-sbs-rest.php');
$start=strpos($source,'    public static function correct_development_image(');
$end=strpos($source,'    public static function generate_development_references(',$start);
$method=substr($source,$start,$end-$start);
eval('class CorrectionHarness { public static $purpose; public static $sent; private static function generation_purpose($g) {return self::$purpose;} private static function development_reference_config() {return ["face"=>["purpose"=>"development_reference_face"],"full_body"=>["purpose"=>"development_reference_full_body"],"expression"=>["purpose"=>"development_reference_expression"],"outfit"=>["purpose"=>"development_reference_outfit"],"style"=>["purpose"=>"development_reference_style"]];} public static function generate($request) {self::$sent=$request->params;return self::$sent;}' . $method . '}');
function check($condition,$message) {if (!$condition) {throw new Exception($message);}}
$wpdb=new FakeDB();
SBS_DB::$generation=['id'=>10,'uuid'=>'source-image','project_id'=>20,'output_asset_id'=>30,'job_id'=>40];
$wpdb->project=['uuid'=>'source-project','concept_json'=>json_encode(['type'=>'character_visual_development'])];
$request=new WP_REST_Request('POST');$request['uuid']='source-image';$request['instruction']='Correct only the ear. Keep everything else.';
$original=serialize([SBS_DB::$generation,$wpdb->project]);
foreach (['development_concept','development_concept_refinement','development_reference_face','development_reference_full_body','development_reference_expression','development_reference_outfit','development_reference_style','character_approval'] as $purpose) {
    CorrectionHarness::$purpose=$purpose;
    $wpdb->project['concept_json']=json_encode(['type'=>$purpose==='character_approval'?'character_pack_test':'character_visual_development']);
    $result=CorrectionHarness::correct_development_image($request);
    check(is_array($result),'Allowed development purpose rejected');
    check($result['parent_uuid']==='source-image','Wrong source image');
    check($result['project_uuid']==='source-project','Wrong project');
    check($result['purpose']===($purpose==='development_concept'?'development_concept_refinement':$purpose),'Correction escaped the image section');
    check($result['size']==='1536x1024' && $result['quality']==='high','Original generation settings lost');
    check($result['count']===1,'Correction should make one new candidate');
    check(strpos($result['prompt'],'Correct only the ear.')!==false,'Correction notes missing');
}
CorrectionHarness::$purpose='scene';check(CorrectionHarness::correct_development_image($request) instanceof WP_Error,'Scene accepted by development-only route');
CorrectionHarness::$purpose='development_reference_face';check(CorrectionHarness::correct_development_image($request) instanceof WP_Error,'Mismatched project type accepted');
$wpdb->project['concept_json']=json_encode(['type'=>'character_visual_development']);
$request['instruction']='';check(CorrectionHarness::correct_development_image($request) instanceof WP_Error,'Blank instruction accepted');
$request['instruction']=str_repeat('x',12001);check(CorrectionHarness::correct_development_image($request) instanceof WP_Error,'Oversized instruction accepted');
$request['uuid']='missing';check(CorrectionHarness::correct_development_image($request) instanceof WP_Error,'Missing source accepted');
$request['uuid']='source-image';SBS_DB::$generation['output_asset_id']=null;check(CorrectionHarness::correct_development_image($request) instanceof WP_Error,'Unfinished source accepted');
SBS_DB::$generation['output_asset_id']=30;
check(serialize([SBS_DB::$generation,$wpdb->project])===$original,'Original generation or project changed');
echo "PASS: correction handler purpose/project validation, exact parent and prompt, preserved settings, invalid input rejection and read-only source handling\n";
