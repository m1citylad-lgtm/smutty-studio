<?php
define('ABSPATH', __DIR__ . '/');
define('SBS_VERSION', 'test');
class SBS_Crypto { public static function setting($constant,$option) { return 'local-test-placeholder'; } }
function get_option($key,$fallback) { return $fallback; }
function sanitize_text_field($value) { return (string)$value; }
function wp_json_encode($value) { return json_encode($value); }
function home_url($path) { return 'https://example.invalid' . $path; }
class WP_Error { private $code; private $message; public function __construct($code='error',$message='Error') { $this->code=$code; $this->message=$message; } public function get_error_code() { return $this->code; } public function get_error_message() { return $this->message; } }
function is_wp_error($value) { return $value instanceof WP_Error; }
$captured_requests = array();
function wp_remote_request($url,$args) { global $captured_requests,$mock_response_body,$capture_large_request,$large_review_summary; if (!empty($capture_large_request)) { $payload=json_decode($args['body'],true); $content=$payload['input'][0]['content']??array(); $data_url=$content[2]['image_url']??''; $prefix='data:image/png;base64,'; $decoded=(strpos($data_url,$prefix)===0)?base64_decode(substr($data_url,strlen($prefix)),true):false; $large_review_summary=array('body_bytes'=>strlen($args['body']),'mime_ok'=>strpos($data_url,$prefix)===0,'decoded_sha256'=>is_string($decoded)?hash('sha256',$decoded):'','image_type'=>$content[2]['type']??''); unset($payload,$content,$data_url,$decoded); $captured_requests[]=array('url'=>$url,'args'=>array('body_bytes'=>strlen($args['body']))); } else { $captured_requests[]=array('url'=>$url,'args'=>$args); } return array('body'=>isset($mock_response_body)?$mock_response_body:'{"id":"resp_test","status":"queued"}'); }
function wp_remote_retrieve_body($response) { return $response['body']; }
function wp_remote_retrieve_response_code($response) { return 200; }
function wp_remote_retrieve_header($response,$key) { return ''; }

function sanitize_textarea_field($value) { return trim(strip_tags($value)); }
require __DIR__ . '/../includes/class-sbs-openai.php';
class SBS_Storage {
    public static $assets = array();
    public static function data_url($asset_id) { $bytes=isset(self::$assets[$asset_id])?self::$assets[$asset_id]:'unchanged-image-' . (int)$asset_id; return 'data:image/png;base64,' . base64_encode($bytes); }
}
function check($condition, $message) { if (!$condition) { throw new Exception($message); } }
function png_test_chunk($type,$data) { return pack('N',strlen($data)) . $type . $data . hash('crc32b',$type.$data,true); }
$image = array('type'=>'image_generation_call', 'result'=>base64_encode('original PNG bytes'));
$refusal = array('type'=>'message', 'content'=>array(array('type'=>'refusal', 'refusal'=>'Cannot edit this image.')));
$text = array('type'=>'message', 'content'=>array(array('type'=>'output_text', 'text'=>'Please clarify the requested correction.')));
check(SBS_OpenAI::parse_image_response(array('status'=>'in_progress'))['status']==='in_progress', 'Running response ended early');
$result = SBS_OpenAI::parse_image_response(array('status'=>'completed', 'output'=>array($refusal)));
check($result['error']['code']==='moderation_blocked' && strpos($result['error']['message'], 'Cannot edit')!==false, 'Refusal explanation lost');
$result = SBS_OpenAI::parse_image_response(array('status'=>'completed', 'output'=>array($text)));
check($result['error']['code']==='no_generated_image' && strpos($result['error']['message'], 'Please clarify')!==false, 'Text-only explanation lost');
$result = SBS_OpenAI::parse_image_response(array('status'=>'completed', 'output'=>array($refusal,$image)));
check($result['status']==='completed' && $result['bytes']==='original PNG bytes', 'Valid image no longer preferred');
$result = SBS_OpenAI::parse_image_response(array('status'=>'failed','error'=>array('code'=>'quota','message'=>'Quota reached')));
check($result['error']['code']==='quota', 'Provider failure overwritten');
$result = SBS_OpenAI::parse_image_response(array('status'=>'completed','output'=>array()));
check(strpos($result['error']['message'], 'No explanation')!==false, 'Missing explanation misclassified');
$tool_error = array('type'=>'image_generation_call','id'=>'ig_test','status'=>'failed','error'=>array('code'=>'moderation_blocked','message'=>'Blocked by safety check','moderation_details'=>array('moderation_stage'=>'output','categories'=>array('sexual'))));
$result = SBS_OpenAI::parse_image_response(array('id'=>'resp_test','status'=>'completed','output'=>array($tool_error,$text)));
check($result['error']['code']==='moderation_blocked' && $result['error']['moderation_details']['moderation_stage']==='output' && $result['error']['moderation_details']['categories']===array('sexual'), 'Structured tool-level evidence lost');
check($result['error']['response_id']==='resp_test' && $result['error']['image_call_id']==='ig_test', 'Support identifiers lost');
$result = SBS_OpenAI::parse_image_response(array('status'=>'completed','output'=>array($tool_error,$image)));
check($result['status']==='completed' && $result['bytes']==='original PNG bytes', 'Tool error incorrectly hid a valid image');
echo "PASS: image bytes, pending requests, refusals, text-only explanations and provider errors\n";

// Exercise the real request builder with a local HTTP stub; no provider calls or credentials.
foreach (array('generate','edit') as $action) {
    SBS_OpenAI::submit_image('Preserve the illustration.', array(), array('action'=>$action,'quality'=>'high','size'=>'1024x1536','background'=>'transparent'));
    $request=end($captured_requests);
    $payload=json_decode($request['args']['body'],true);
    $tool=$payload['tools'][0];
    check($tool['type']==='image_generation' && $tool['moderation']==='low' && $tool['action']===$action, 'Lowest supported moderation missing from image request');
    check($tool['quality']==='high' && $tool['size']==='1024x1536' && $tool['background']==='transparent', 'Moderation change altered image settings');
    check(!isset($payload['moderation']), 'Image setting placed on the wrong API object');
}
echo "PASS: generation and edit requests explicitly use low image moderation, preserving quality, size and transparency\n";

// Large finishing reviews use exact image bytes as data URLs, bypassing the
// provider's 32 MB file-URL limit without editing or resizing either asset.
$mock_response_body=json_encode(array('output_text'=>json_encode(array('summary'=>'Reviewed','overall'=>'review','findings'=>array(
    array('severity'=>'info','area'=>'Clean lettering','issue'=>'No change spotted','action'=>'No action needed'),
    array('severity'=>'concern','area'=>'Outer edge','issue'=>'Coloured flecks are visible','action'=>'Check against the intended garment colour','focus'=>array('x'=>0.82,'y'=>0.16)),
    array('severity'=>'review','area'=>'Lettering','issue'=>'Fine detail may be altered','action'=>'Inspect the lettering','focus'=>array('x'=>2,'y'=>0.5)),
)))));
$review=SBS_OpenAI::review_finishing_artwork(101,202,'Large PNG review');
check(!is_wp_error($review) && $review['summary']==='Reviewed', 'Full-resolution AI review did not parse');
check(count($review['findings'])===2 && $review['findings'][0]['severity']==='concern', 'Non-actionable AI notes were not removed');
check($review['findings'][0]['focus']===array('x'=>0.82,'y'=>0.16), 'Valid image focus was not preserved');
check(!isset($review['findings'][1]['focus']), 'Out-of-range image focus was accepted');
$request=end($captured_requests);
$payload=json_decode($request['args']['body'],true);
$review_content=$payload['input'][0]['content'];
check($review_content[1]['type']==='input_image' && $review_content[1]['image_url']==='data:image/png;base64,' . base64_encode('unchanged-image-101'), 'Original was not sent as an unchanged data URL');
check($review_content[2]['type']==='input_image' && $review_content[2]['image_url']==='data:image/png;base64,' . base64_encode('unchanged-image-202'), 'Candidate was not sent as an unchanged data URL');
check(!isset($review_content[1]['file_id']) && !isset($review_content[2]['file_id']), 'Large review still uses file URLs');
echo "PASS: finishing comparison sends both unchanged full-resolution assets as data URLs\n";

// Exercise the oversized path with a valid, disposable 50 MiB transparent PNG.
// The HTTP stub captures the request locally; no provider, account key or credits are used.
$large_png="\x89PNG\r\n\x1a\n";
$large_png.=png_test_chunk('IHDR',pack('N',1).pack('N',1)."\x08\x06\x00\x00\x00");
$large_png.=png_test_chunk('iTXt',"Fixture\0\0\0\0\0".str_repeat('x',50*1024*1024));
$large_png.=png_test_chunk('IDAT',gzcompress("\0\0\0\0\0"));
$large_png.=png_test_chunk('IEND','');
check(strlen($large_png)>50*1024*1024, 'Oversized transparent PNG fixture was not created');
SBS_Storage::$assets[202]=$large_png;
$capture_large_request=true;
$captured_before=count($captured_requests);
$review=SBS_OpenAI::review_finishing_artwork(101,202,'Oversized transparent fixture');
$capture_large_request=false;
check(!is_wp_error($review), 'Oversized PNG review request could not be prepared');
check(count($captured_requests)===$captured_before+1, 'Oversized PNG did not produce one local stub request');
check($large_review_summary['mime_ok'] && $large_review_summary['image_type']==='input_image', 'Oversized PNG was not sent as an image data URL');
check($large_review_summary['decoded_sha256']===hash('sha256',$large_png), 'Oversized PNG bytes were not preserved in the provider request');
check($large_review_summary['body_bytes']>50*1024*1024, 'Oversized PNG payload was truncated');
unset($review,$large_png);
SBS_Storage::$assets=array();
echo "PASS: 50 MiB transparent PNG is preserved in a local stub request without provider use\n";

// Record actual native pixels separately from provider-reported settings; no maximum is inferred.
$native_png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==');
$result=SBS_OpenAI::parse_image_response(array('status'=>'completed','model'=>'router-revision','output'=>array(array('type'=>'image_generation_call','model'=>'image-revision','size'=>'auto','quality'=>'high','result'=>base64_encode($native_png)))));
check($result['image_metadata']['actual_pixels']===array('width'=>1,'height'=>1)&&$result['image_metadata']['image_model_reported']==='image-revision'&&$result['image_metadata']['reported_size']==='auto','Native generation dimensions/model metadata lost or inferred from requested size');
echo "PASS: native output metadata distinguishes requested/provider-reported dimensions from decoded pixels\n";

// Print relevance is enforced on actual parsed responses, not only prompt wording.
$report=array('summary'=>'Review','overall'=>'review','findings'=>array(
 array('severity'=>'concern','area'=>'One pixel','issue'=>'Tiny dot','action'=>'Remove','print_relevance'=>'microscopic'),
 array('severity'=>'concern','area'=>'Long outline','issue'=>'Visible continuous fringe','action'=>'Review','print_relevance'=>'visible'),
 array('severity'=>'concern','area'=>'Soft cloud','issue'=>'Transparency could be a defect','action'=>'Make opaque','print_relevance'=>'double_check','possible_effect'=>'smoke')
));
$mock_response_body=json_encode(array('output'=>array(array('type'=>'message','content'=>array(array('type'=>'output_text','text'=>json_encode($report)))))));
$review=SBS_OpenAI::review_finishing_artwork(101,202,'Print relevance',array('width'=>14,'height'=>16));
check(!is_wp_error($review)&&count($review['findings'])===2,'Microscopic finding was not filtered');
check($review['findings'][1]['severity']==='review'&&$review['findings'][1]['possible_effect']==='smoke'&&strpos($review['findings'][1]['action'],'no automatic cleanup')!==false,'Possible smoke was treated as a definite defect or auto-fix');
$payload=json_decode($captured_requests[count($captured_requests)-1]['args']['body'],true);$prompt=$payload['input'][0]['content'][0]['text'];
check(strpos($prompt,'14 by 16 inches')!==false&&strpos($prompt,'Ignore isolated stray pixels')!==false,'Actual print target or global visibility policy missing from provider prompt');
$policy=new ReflectionMethod('SBS_OpenAI','print_review_policy');$policy->setAccessible(true);
check(strpos($policy->invoke(null),'exact print size is not supplied')!==false,'Unknown print dimensions were invented');
echo "PASS: physical print context, microscopic-response filtering and uncertain smoke protected from automatic cleanup.\n";

if(!function_exists('wp_generate_uuid4')){function wp_generate_uuid4(){return bin2hex(random_bytes(16));}}
foreach($report['findings'] as &$f){$f['image_label']='whole';$f['bbox']=array('x'=>.2,'y'=>.2,'width'=>.1,'height'=>.1);$f['category']='Artwork';}unset($f);
$mock_response_body=json_encode(array('output'=>array(array('type'=>'message','content'=>array(array('type'=>'output_text','text'=>json_encode($report)))))));
$logic=SBS_OpenAI::review_logic_correction('whole',array(array('label'=>'whole','data_url'=>'data:image/png;base64,'.base64_encode('fixture'))),array(),array(),array('width'=>14,'height'=>16));
check(!is_wp_error($logic)&&count($logic['findings'])===2,'Logic review retained microscopic findings');
check($logic['findings'][1]['possible_effect']==='smoke'&&strpos($logic['findings'][1]['action'],'No automatic cleanup')!==false,'Logic review recommended automatically changing smoke');
echo "PASS: global Studio logic review applies the same print-visibility and possible-effect policy.\n";
