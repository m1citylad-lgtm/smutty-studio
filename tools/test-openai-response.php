<?php
define('ABSPATH', __DIR__ . '/');
function sanitize_textarea_field($value) { return trim(strip_tags($value)); }
require __DIR__ . '/../includes/class-sbs-openai.php';
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
