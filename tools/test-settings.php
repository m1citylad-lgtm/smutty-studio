<?php
// Exercise the real admin handlers with isolated WordPress/storage doubles.
define('ABSPATH', __DIR__);
define('ARRAY_A', 'ARRAY_A');
class StopAction extends Exception {}
$allowed=true; $nonce=true; $authenticated=true; $options=['sbs_studio_slug'=>'smutty-studio','sbs_openai_api_key'=>'existing-encrypted']; $writes=[]; $redirect='';
function current_user_can($cap){global $allowed;return $cap==='manage_options' && $allowed;}
function check_admin_referer($action){global $nonce;if(!$nonce)throw new StopAction('nonce');}
function esc_html($v){return htmlspecialchars((string)$v,ENT_QUOTES);}
function esc_attr($v){return esc_html($v);}
function wp_nonce_field($action){echo '<input type="hidden" name="_wpnonce" value="test-wp-nonce">';}
function delete_option($key){}
function size_format($value){return $value.' bytes';}
function wp_salt($scheme){return 'test-server-only-salt';}
function wp_die($message,$status=0){throw new StopAction('denied');}
function wp_unslash($value){return $value;}
function esc_url_raw($value){return trim($value);}
function wp_parse_url($value,$part){return parse_url($value,$part);}
function sanitize_text_field($value){return strip_tags($value);}
function update_option($key,$value,$autoload=false){global $options,$writes;$options[$key]=$value;$writes[]=$key;}
function get_option($key,$default=''){global $options;return $options[$key]??$default;}
function flush_rewrite_rules($hard){ }
function delete_transient($key){ }
function is_wp_error($value){return false;}
function home_url($path){return 'https://example.test'.$path;}
function admin_url($path){return 'https://example.test/wp-admin/'.$path;}
function add_query_arg($args,$value=null,$url=null){if(!is_array($args)){$args=[$args=>$value];}else{$url=$value;}return $url.'?'.http_build_query($args);}
function wp_safe_redirect($url){global $redirect;$redirect=$url;throw new StopAction('redirect');}
function esc_url($value){return htmlspecialchars($value,ENT_QUOTES);}
function wp_login_url($url){return 'https://example.test/wp-login.php?redirect_to='.rawurlencode($url);}
class SBS_Plugin {static function studio_slug(){return get_option('sbs_studio_slug','smutty-studio');}static function sanitize_studio_slug($value){return trim(strtolower($value),'/');}}
class SBS_Replicate {const DEFAULT_VERSION='model-version';static function is_configured(){return true;}}
class SBS_OpenAI {static function is_configured(){return true;}}
class SBS_DB {static function table($table){return $table;}}
class SettingsDB {function get_results($q,$format){return [];}function get_row($q,$format){return ['files'=>0,'bytes'=>0];}}
$wpdb=new SettingsDB();
class SBS_Crypto {static function setting($a,$b){return '';}static $fail=false;static function encrypt($value){return self::$fail?false:'encrypted:'.$value;}}
class SBS_Auth {const COOKIE="sbs_studio_session";static function is_authenticated(){global $authenticated;return $authenticated;}static function set_password($password){update_option('sbs_password_hash','hashed');return true;}}
require __DIR__.'/../includes/class-sbs-admin.php';
function check($condition,$message){if(!$condition)throw new Exception($message);}
function save(){try{SBS_Admin::save_settings();}catch(StopAction $e){return $e->getMessage();}throw new Exception('Expected action termination');}
$_COOKIE[SBS_Auth::COOKIE]='test-session';
$token=hash_hmac('sha256','studio-settings|test-session',wp_salt('nonce'));
$_POST=['sbs_return_studio'=>'1','_sbs_session_nonce'=>$token];
$allowed=false;$authenticated=false;check(save()==='denied' && !$writes,'Logged-out Studio session could write');
ob_start();SBS_Admin::render_studio_settings();check(ob_get_clean()==='','Logged-out view exposed controls');
$authenticated=true;
ob_start();SBS_Admin::render_studio_settings();$html=ob_get_clean();
check(strpos($html,'Sign in as administrator')===false,'Studio user still requires administrator sign-in');
check(substr_count($html,'name="sbs_return_studio"')===3 && substr_count($html,'name="_sbs_session_nonce"')===3,'Forms missing session protection');
check(strpos($html,'Save settings')!==false && strpos($html,'Validate and import')!==false && strpos($html,'Run / refresh diagnostics')!==false,'Front-end controls incomplete');
check(strpos($html,'existing-encrypted')===false,'Saved API key rendered');
$_POST['_sbs_session_nonce']='forged';check(save()==='denied' && !$writes,'Forged session token could write');
$_POST['_sbs_session_nonce']=$token;$_COOKIE[SBS_Auth::COOKIE]='different-session';check(save()==='denied' && !$writes,'Token from another session could write');
$_COOKIE[SBS_Auth::COOKIE]='test-session';$nonce=false;check(save()==='nonce' && !$writes,'Bad WordPress nonce could write');$nonce=true;
// Shared Studio access does not unlock the separate wp-admin entry point.
unset($_POST['sbs_return_studio']);check(save()==='denied' && !$writes,'Non-admin bypassed dashboard protection');$_POST['sbs_return_studio']='1';
try{SBS_Admin::rollback();throw new Exception('Studio settings token unlocked plugin rollback');}catch(StopAction $e){check($e->getMessage()==='denied','Wrong rollback guard');}
$_POST['studio_password']='short';save();check(!$writes,'Weak password partially saved options');
unset($_POST['studio_password']);$_POST['update_feed_url']='http://unsafe.test/feed';save();check(!$writes,'HTTP feed partially saved options');
$_POST['update_feed_url']='';$_POST['openai_api_key']='new-private-key';SBS_Crypto::$fail=true;save();check(!$writes,'Failed encryption partially saved options');
SBS_Crypto::$fail=false;$_POST['studio_slug']='new-studio';save();
check($options['sbs_openai_api_key']==='encrypted:new-private-key','Key was not encrypted');
check(strpos($redirect,'https://example.test/new-studio/?settings=1')===0,'Did not return to new Studio URL');
check(strpos($redirect,'new-private-key')===false,'Redirect exposed key');
$_POST['openai_api_key']='';save();check($options['sbs_openai_api_key']==='encrypted:new-private-key','Blank key overwrote saved key');
echo "PASS: Studio session, session-bound CSRF, dashboard capability, update isolation, nonce, pre-save validation, encrypted credentials, blank preservation and safe Studio return\n";
