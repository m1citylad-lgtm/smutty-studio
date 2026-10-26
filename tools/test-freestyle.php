Warning: truncated output (original token count: 4472)
Total output lines: 90

<?php
error_reporting(E_ALL & ~E_DEPRECATED);
define('ABSPATH',__DIR__.'/');const ARRAY_A='ARRAY_A';
function sanitize_key($v){return preg_replace('/[^a-z0-9_\-]/','',strtolower((string)$v));}
function sanitize_text_field($v){return trim(strip_tags((string)$v));}function sanitize_textarea_field($v){return sanitize_text_field($v);}
function wp_json_encode($v){return json_encode($v);}function is_wp_error($v){return $v instanceof WP_Error;}function rest_ensure_response($v){return new WP_REST_Response($v);}
function current_time($format,$utc=false){return $format==='mysql'?'2026-10-17 12:00:00':'2026-10-17 12:00';}
$options=[];function get_option($k,$fallback=''){global $options;return $options[$k]??$fallback;}function update_option($k,$v,$autoload=false){global $options;$options[$k]=$v;}
class WP_Error {public $code;public function __construct($c,$m,$d=[]){$this->code=$c;}}
class WP_REST_Response {private $data;public function __construct($d){$this->data=$d;}public function get_data(){return $this->data;}}
class WP_REST_Request implements ArrayAccess {public $params=[];public function __construct($m){}public function set_param($k,$v){$this->params[$k]=$v;}public function get_param($k){return $this->params[$k]??null;}public function get_file_params(){return $this->params['_files']??[];}public function offsetExists($k):bool{return isset($this->params[$k]);}public function offsetGet($k){return $this->get_param($k);}public function offsetSet($k,$v):void{$this->set_param($k,$v);}public function offsetUnset($k):void{unset($this->params[$k]);}}
class SBS_DB {public static $rows=[];public static $packs=['bear'=>['id'=>2,'uuid'=>'bear','status'=>'draft','current_version'=>1]];public static function table($t){return $t;}public static function row_by_uuid($table,$uuid){return self::$rows[$table][$uuid]??self::$packs[$uuid]??null;}}
class SBS_REST {
 const NS='smutty-bear/v1';public static $projects=[],$sent=[];
 public static function create_pack($r){$uuid='neutral';SBS_DB::$packs[$uuid]=['uuid'=>$uuid,'status'=>'draft'];return rest_ensure_response(SBS_DB::$packs[$uuid]);}
 public static function create_project($r){if(!isset(SBS_DB::$packs[$r['pack_uuid']]))return new WP_Error('missing_pack','Missing');$p=['id'=>10,'uuid'=>'experiment','pack_uuid'=>$r['pack_uuid'],'title'=>$r['title'],'concept'=>$r['concept'],'generations'=>[],'jobs'=>[]];self::$projects[$p['uuid']]=$p;return rest_ensure_response($p);}
 public static function project($r){return isset(self::$projects[$r['uuid']])?rest_ensure_response(self::$projects[$r['uuid']]):new WP_Error('missing','Missing');}
 public static function generate($r){self::$sent[]=$r->params;return rest_ensure_response(['jobs'=>[['uuid'=>'job','status'=>'submitted','payload'=>['project_id'=>10,'purpose'=>'freestyle']]]]);}
}
class FakeDB {public $updates=[],$insert_id=500;public function insert($table,$row){$this->insert_id++;if($table==='generations'){$row['id']=$this->insert_id;$row['asset_url']='/uploaded.png';SBS_REST::$projects['experiment']['generations'][]=$row;}return 1;}public function update($t,$data,$where){$this->updates[]=[$t,$data,$where];if($t==='packs')SBS_DB::$packs[$where['uuid']]=array_merge(SBS_DB::$packs[$where['uuid']],$data);if($t==='projects')foreach(SBS_REST::$projects as &$p){if($p['id']===$where['id']&&isset($data['concept_json']))$p['concept']=json_decode($data['concept_json'],true);}return 1;}public function prepare($q,...$args){return $q;}public function get_row($q,$format){if(strpos($q,'FROM pack_versions')!==false)return ['id'=>1,'identity_json'=>'{"tests_approved":true}'];$p=SBS_REST::$projects['experiment'];$p['concept_json']=json_encode($p['concept']);return $p;}public function get_var($q){return 'g3';}}
$wpdb=new FakeDB();require __DIR__.'/../includes/class-sbs-freestyle.php';
function check($v,$m){if(!$v)throw new Exception($m);}function req($params){$r=new WP_REST_Request('POST');foreach($params as $k=>$v)$r[$k]=$v;return $r;}
check(count(SBS_Freestyle::styles())===14,'Must include all 14 user-selected styles');foreach(SBS_Freestyle::styles() as $id=>$label){check(!is_wp_error(SBS_Freestyle::settings(['style'=>$id])),'Selected style rejected: '.$id);$style_prompt=SBS_Freestyle::compose_prompt([], 'Create one image', 'generate', SBS_Freestyle::settings(['style'=>$id]));check(strpos($style_prompt,$label)!==false,'Selected style missing from prompt');}check(!isset(SBS_Freestyle::styles()['watercolour']) && !isset(SBS_Freestyle::styles()['ink-sketch']), 'Unselected style still in new dropdown');check(!is_wp_error(SBS_Freestyle::settings(['style'=>'watercolour'])), 'Saved legacy style rejected');$defaults=SBS_Freestyle::settings([]);check($defaults['background']==='transparent'&&$defaults['transparency']==='print'&&$defaults['dpi']===300&&$defaults['width']===16.0&&$defaults['height']===18.0,'Print defaults incorrect');
check(is_wp_error(SBS_Freestyle::settings(['style'=>'invented'])),'Unknown style accepted');check(is_wp_error(SBS_Freestyle::settings(['width'=>0])),'Invalid print dimensions accepted');
$blend=SBS_Freestyle::settings(['styles'=>['beefcake','comic','beefcake'],'background'=>'transparent','transparency'=>'print']);
check($blend['styles']===['beefcake','comic'] && $blend['style']==='beefcake', 'Style combination lost or duplicated');
$blend_prompt=SBS_Freestyle::compose_prompt([], 'Keep the costume', 'edit', $blend);
check(strpos($blend_prompt,'Vintage beefcake + Comic book')!==false && strpos($blend_prompt,'Dramatic illustrated characters')!==false && strpos($blend_prompt,'Blend all selected styles')!==false && strpos($blend_prompt,'solid opaque print colours')!==false,'Blended prompt or print transparency missing');
check(is_wp_error(SBS_Freestyle::settings(['styles'=>[]])) && is_wp_error(SBS_Freestyle::settings(['styles'=>['beefcake','unknown']])) && is_wp_error(SBS_Freestyle::settings(['styles'=>'comic'])) && is_wp_error(SBS_Freestyle::settings(['styles'=>[[]]])), 'Invalid combination accepted');
check(is_wp_error(SBS_…1472 tokens truncated…neration prompt\n";

// Real upload controller, with only storage/database transport stubbed.
function wp_generate_uuid4(){static $n=0;return 'test-upload-'.(++$n);}
class SBS_Storage {
 public static $assets=[];
 public static function asset_by_uuid($uuid){return self::$assets[$uuid]??null;}
 public static function store_upload($file,$owner,$id,$role,$label){$uuid='asset-'.count(self::$assets);$a=['uuid'=>$uuid,'id'=>100+count(self::$assets),'owner_type'=>$owner,'owner_id'=>$id,'role'=>$role,'label'=>$label,'mime'=>'image/png','sha256'=>hash_file('sha256',$file['tmp_name'])];self::$assets[$uuid]=$a;return $a;}
}
$temp=tempnam(sys_get_temp_dir(),'sbs-upload-');file_put_contents($temp,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6j0AAAAASUVORK5CYII='));
$file=['name'=>'original.png','tmp_name'=>$temp,'size'=>filesize($temp),'error'=>0];
$before_calls=count(SBS_REST::$sent);
$up=req(['_files'=>['file'=>$file],'project_uuid'=>'experiment','mode'=>'reference','settings'=>'{}','label'=>'Waistband fit only']);
$reference=SBS_Freestyle::upload($up)->get_data();check(count(SBS_REST::$projects['experiment']['generations'])===0,'Reference upload became artwork');check(count(SBS_REST::$sent)===$before_calls,'Upload generated an image');
$refs=SBS_Freestyle::references(SBS_REST::$projects['experiment'],[$reference['asset']['uuid']]);check(count($refs)===1&&$refs[0]['label']==='Waistband fit only','Uploaded reference not available');
SBS_Storage::$assets['foreign']=['uuid'=>'foreign','owner_type'=>'project','owner_id'=>999,'role'=>'freestyle_reference','mime'=>'image/png'];check(is_wp_error(SBS_Freestyle::references(SBS_REST::$projects['experiment'],['foreign'])),'Foreign project reference accepted');
check(is_wp_error(SBS_Freestyle::references(SBS_REST::$projects['experiment'],array_fill(0,7,$reference['asset']['uuid']))),'Reference cap missing');
$up['mode']='artwork';$art=SBS_Freestyle::upload($up)->get_data();$original_generation=SBS_REST::$projects['experiment']['generations'][0];
check($original_generation['action']==='upload' && $original_generation['provider']==='local' && $original_generation['job_id']===null,'Original was sent through generation');check($art['asset']['sha256']===hash_file('sha256',$temp),'Upload did not preserve original bytes');
check($art['project']['concept']['local_versions'][$art['generation_uuid']]['settings']['transparency']==='print','Imported artwork settings missing');
$up['mode']='background_removed';$up['parent_uuid']=$art['generation_uuid'];$copy=SBS_Freestyle::upload($up)->get_data();$versions=SBS_REST::$projects['experiment']['generations'];check(count($versions)===2 && $versions[0]===$original_generation && $versions[1]['parent_id']===$original_generation['id'],'Background copy replaced original or lost Undo parent');
check(count(SBS_REST::$sent)===$before_calls,'Local background copy called a provider');
$up['parent_uuid']='foreign';check(is_wp_error(SBS_Freestyle::upload($up)),'Foreign background source accepted');
$up['mode']='reference';$up['parent_uuid']='';$up->params['_files']['file']['size']=21*1024*1024;check(is_wp_error(SBS_Freestyle::upload($up)),'Oversized file accepted');
$up->params['_files']['file']=$file;$up->params['_files']['file']['error']=1;check(is_wp_error(SBS_Freestyle::upload($up)),'Failed PHP upload accepted');
$up['_files']=[];check(is_wp_error(SBS_Freestyle::upload($up)),'Missing file accepted');unlink($temp);
echo "PASS: reference isolation, file validation, unchanged upload, zero-provider import, local-copy lineage and original preservation\n";
// Exercise real generation assembly: edit source remains first, references are scoped and snapshotted.
class SBS_OpenAI {public static $sent;public static function image_model(){return 'mock';}public static function submit_image($prompt,$ids,$options){self::$sent=[$prompt,$ids,$options];return ['id'=>'mock','status'=>'queued'];}}
$source=file_get_contents(__DIR__.'/../includes/class-sbs-rest.php');$start=strpos($source,'    public static function generate($request)');$end=strpos($source,'    public static function upscale($request)',$start);$method=substr($source,$start,$end-$start);
eval('class FreestyleGenerationHarness {public static $payload;private static function validate_scene($s){return true;}private static function create_provider_job($t,$p,$payload){self::$payload=$payload;return ["id"=>1];}private static function job_by_id($id){return ["id"=>$id];}public static function present_job($job){return $job;}' . $method . '}');
$raw=SBS_REST::$projects['experiment'];$raw['pack_version_id']=1;$raw['concept_json']=json_encode($raw['concept']);SBS_DB::$rows['projects']['experiment']=$raw;SBS_DB::$rows['generations']['source']=$original_generation;SBS_DB::$rows['generations']['source']['uuid']='source';
class RefDB extends FakeDB {public function get_col($q){return [88];}}$wpdb=new RefDB();
$gen=req(['project_uuid'=>'experiment','parent_uuid'=>'source','purpose'=>'freestyle','prompt'=>'Correct only the waistband fit.','freestyle_settings'=>[],'freestyle_brief'=>'Keep the composition.','freestyle_reference_uuids'=>[$reference['asset']['uuid']],'freestyle_finishing'=>true,'background'=>'transparent']);
FreestyleGenerationHarness::generate($gen);check(SBS_OpenAI::$sent[1]===[$original_generation['output_asset_id'],$reference['asset']['id'],88],'Source/reference ordering lost');check(strpos(SBS_OpenAI::$sent[0],'Waistband fit only')!==false && strpos(SBS_OpenAI::$sent[0],'FINISHING EXISTING ARTWORK')!==false,'Reference or preserve guidance missing');check(FreestyleGenerationHarness::$payload['freestyle_reference_uuids']===[$reference['asset']['uuid']],'Reference snapshot missing');
$gen['freestyle_reference_uuids']=['foreign'];check(is_wp_error(FreestyleGenerationHarness::generate($gen)),'Generation accepted another experiment reference');
echo "PASS: selected source first, user reference assembly, immutable request snapshot and finishing guidance\n";
