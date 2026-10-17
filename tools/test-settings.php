<?php
// Exercise the real admin handlers with isolated WordPress/storage doubles.
define('ABSPATH', __DIR__);
class StopAction extends Exception {}
$allowed=true; $nonce=true; $authenticated=true; $options=['sbs_studio_slug'=>'smutty-studio','sbs_openai_api_key'=>'existing-encrypted']; $writes=[]; $redirect='';
function current_user_can($cap){global $allowed;return $cap==='manage_options' && $allowed;}
function check_admin_referer($action){global $nonce;if(!$nonce)throw new StopAction('nonce');}
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
class SBS_Replicate {const DEFAULT_VERSION='model-version';}
class SBS_Crypto {static $fail=false;static function encrypt($value){return self::$fail?false:'encrypted:'.$value;}}
class SBS_Auth {static function is_authenticated(){global $authenticated;return $authenticated;}static function set_password($password){update_option('sbs_password_hash','hashed');return true;}}
require __DIR__.'/../includes/class-sbs-admin.php';
function check($condition,$message){if(!$condition)throw new Exception($message);}
function save(){try{SBS_Admin::save_settings();}catch(StopAction $e){return $e->getMessage();}throw new Exception('Expected action termination');}
$_POST=['sbs_return_studio'=>'1'];
$allowed=false;check(save()==='denied' && !$writes,'Non-admin could write');
ob_start();SBS_Admin::render_studio_settings();$locked=ob_get_clean();
check(strpos($locked,'Sign in as administrator')!==false,'No administrator sign-in route');
check(strpos($locked,'existing-encrypted')===false && strpos($locked,'openai_api_key')===false,'Locked view exposed settings');
$authenticated=false;ob_start();SBS_Admin::render_studio_settings();check(ob_get_clean()==='','Unauthenticated page rendered controls');$authenticated=true;
$allowed=true;$nonce=false;check(save()==='nonce' && !$writes,'Bad nonce could write');$nonce=true;
$_POST['studio_password']='short';save();check(!$writes,'Weak password partially saved options');
unset($_POST['studio_password']);$_POST['update_feed_url']='http://unsafe.test/feed';save();check(!$writes,'HTTP feed partially saved options');
$_POST['update_feed_url']='';$_POST['openai_api_key']='new-private-key';SBS_Crypto::$fail=true;save();check(!$writes,'Failed encryption partially saved options');
SBS_Crypto::$fail=false;$_POST['studio_slug']='new-studio';save();
check($options['sbs_openai_api_key']==='encrypted:new-private-key','Key was not encrypted');
check(strpos($redirect,'https://example.test/new-studio/?settings=1')===0,'Did not return to new Studio URL');
check(strpos($redirect,'new-private-key')===false,'Redirect exposed key');
$_POST['openai_api_key']='';save();check($options['sbs_openai_api_key']==='encrypted:new-private-key','Blank key overwrote saved key');
echo "PASS: admin capability, nonce, locked rendering, pre-save validation, encrypted credentials, blank preservation and safe Studio return\n";
