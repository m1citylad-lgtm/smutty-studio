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
function wp_remote_request($url,$args) { global $captured_requests,$mock_response_body; $captured_requests[]=array('url'=>$url,'args'=>$args); return array('body'=>isset($mock_response_body)?$mock_response_body:'{"id":"resp_test","status":"queued"}'); }
function wp_remote_retrieve_body($response) { return $response['body']; }
function wp_remote_retrieve_response_code($response) { return 200; }
function wp_remote_retrieve_header($response,$key) { return ''; }

function sanitize_textarea_field($value) { return trim(strip_tags($value)); }
require __DIR__ . '/../includes/class-sbs-openai.php';
class SBS_Storage {
    public static function data_url($asset_id) { return 'data:image/png;base64,' . base64_encode('unchanged-image-' . (int)$asset_id); }
}
function check($condition, $message) { if (!$condition) { throw new Exception($message); } }
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
$mock_response_body=json_encode(array('output_text'=>json_encode(array('summary'=>'Reviewed','overall'=>'review','findings'=>array()))));
$review=SBS_OpenAI::review_finishing_artwork(101,202,'Large PNG review');
check(!is_wp_error($review) && $review['summary']==='Reviewed', 'Full-resolution AI review did not parse');
$request=end($captured_requests);
$payload=json_decode($request['args']['body'],true);
$review_content=$payload['input'][0]['content'];
check($review_content[1]['type']==='input_image' && $review_content[1]['image_url']==='data:image/png;base64,' . base64_encode('unchanged-image-101'), 'Original was not sent as an unchanged data URL');
check($review_content[2]['type']==='input_image' && $review_content[2]['image_url']==='data:image/png;base64,' . base64_encode('unchanged-image-202'), 'Candidate was not sent as an unchanged data URL');
check(!isset($review_content[1]['file_id']) && !isset($review_content[2]['file_id']), 'Large review still uses file URLs');
echo "PASS: finishing comparison sends both unchanged full-resolution assets as data URLs\n";
