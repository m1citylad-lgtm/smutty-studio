<?php
if (!defined('ABSPATH')) { exit; }

/** Server-only OAuth scaffold. Deliberately contains NO Drive or Sheets write API. */
final class SBS_Google_Drive
{
    const SCOPE = 'https://www.googleapis.com/auth/drive.file';
    public static function register_routes()
    {
        register_rest_route(SBS_REST::NS, '/finishing/google/file-metadata', array('methods'=>'POST', 'callback'=>array(__CLASS__,'metadata'), 'permission_callback'=>array('SBS_Finishing','permission')));
        foreach(array('/status'=>array('GET','status'),'/configure'=>array('POST','configure'),'/connect'=>array('POST','connect'),'/disconnect'=>array('POST','disconnect'),'/callback'=>array('GET','callback')) as $path=>$route){
            register_rest_route(SBS_REST::NS,'/finishing/google'.$path,array('methods'=>$route[0],'callback'=>array(__CLASS__,$route[1]),'permission_callback'=>array('SBS_Finishing','permission')));
        }
    }
    public static function metadata($request)
    {
        return SBS_Google_Drive_Transport::file_metadata($request->get_param('file_id'));
    }
    public static function redirect_uri(){return rest_url(SBS_REST::NS.'/finishing/google/callback');}
    private static function client_id(){return (string)get_option('sbs_google_client_id','');}
    private static function secret(){return SBS_Crypto::decrypt((string)get_option('sbs_google_client_secret',''));}
    private static function tokens(){return json_decode(SBS_Crypto::decrypt((string)get_option('sbs_google_tokens','')),true) ?: array();}
    public static function status()
    {
        $t=self::tokens();
        return array('configured'=>(bool)(self::client_id()&&self::secret()),'connected'=>!empty($t['refresh_token']), 'access_expired'=>!empty($t)&&($t['expires_at']??0)<=time(),'redirect_uri'=>self::redirect_uri(),'scope'=>self::SCOPE,'drive_route_enabled'=>false,'writes_enabled'=>false,'message'=>'OAuth scaffold only. Drive selection, reads, AF allocation and all remote writes remain disabled.');
    }
    public static function configure($request)
    {
        if(!is_ssl()){return SBS_Finishing::error('https','Google client settings require HTTPS.',403);}
        if(self::tokens()){return SBS_Finishing::error('disconnect','Disconnect before changing the OAuth client.',409);}
        $id=$request->get_param('client_id');$secret=$request->get_param('client_secret');
        if(!is_string($id)||!preg_match('/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/D',$id)||strlen($id)>255||!is_string($secret)||strlen($secret)>1000){return SBS_Finishing::error('client','Enter the web application client ID and client secret.');}
        $encrypted=$secret!==''?SBS_Crypto::encrypt($secret):(string)get_option('sbs_google_client_secret','');
        if(!$encrypted||!SBS_Crypto::decrypt($encrypted)){return SBS_Finishing::error('crypto','Encrypted storage is unavailable or the client secret is missing.',503);}
        update_option('sbs_google_client_secret',$encrypted,false);update_option('sbs_google_client_id',$id,false);
        update_option('sbs_google_generation',bin2hex(random_bytes(16)),false);
        return self::status();
    }
    public static function connect()
    {
        if(!is_ssl()||!self::client_id()||!self::secret()){return SBS_Finishing::error('config','Configure an HTTPS Google web application client first.',409);}
        $state=bin2hex(random_bytes(32));$verifier=rtrim(strtr(base64_encode(random_bytes(48)),'+/','-_'),'=');
        $encrypted=SBS_Crypto::encrypt($verifier);if(!$encrypted){return SBS_Finishing::error('crypto','Encrypted storage is unavailable.',503);}
        $generation=bin2hex(random_bytes(16));update_option('sbs_google_generation',$generation,false);
        set_transient('sbs_google_state_'.hash('sha256',$state),array('session'=>hash('sha256',(string)($_COOKIE[SBS_Auth::COOKIE]??'')),'verifier'=>$encrypted,'generation'=>$generation),600);
        return array('authorization_url'=>'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query(array('client_id'=>self::client_id(),'redirect_uri'=>self::redirect_uri(),'response_type'=>'code','scope'=>self::SCOPE,'access_type'=>'offline','prompt'=>'consent','state'=>$state,'code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'='),'code_challenge_method'=>'S256'),'', '&',PHP_QUERY_RFC3986));
    }
    private static function result($result)
    {
        $url=home_url('/'.SBS_Plugin::studio_slug().'/?settings=1&google='.$result);
        $response=new WP_REST_Response(null,303);
        $response->header('Location',$url);$response->header('Cache-Control','no-store');$response->header('Referrer-Policy','no-referrer');return $response;
    }
    public static function callback($request)
    {
        if(!is_ssl()){return self::result('https-required');}
        $state=$request->get_param('state');
        if(!is_string($state)||!preg_match('/^[a-f0-9]{64}$/D',$state)){return self::result('invalid-state');}
        // Serialize callback/disconnect to avoid storing a token after disconnect.
        if(!SBS_Storage::ensure_directories()){return self::result('storage-unavailable');}
        $lock=fopen(SBS_Storage::base_dir().'/tmp/google-oauth.lock','c');
        if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return self::result('retry');}
        try{
            $key='sbs_google_state_'.hash('sha256',$state);$saved=get_transient($key);
            if(!is_array($saved)||!hash_equals($saved['session'],hash('sha256',(string)($_COOKIE[SBS_Auth::COOKIE]??'')))||!hash_equals($saved['generation'],(string)get_option('sbs_google_generation',''))){return self::result('invalid-state');}
            delete_transient($key);
            if($request->get_param('error')){return self::result('denied');}
            $code=$request->get_param('code');$verifier=SBS_Crypto::decrypt($saved['verifier']);
            if(!is_string($code)||strlen($code)>4096||!$code||!$verifier){return self::result('invalid-code');}
            $response=wp_remote_post('https://oauth2.googleapis.com/token',array('timeout'=>20,'redirection'=>0,'body'=>array('client_id'=>self::client_id(),'client_secret'=>self::secret(),'code'=>$code,'code_verifier'=>$verifier,'grant_type'=>'authorization_code','redirect_uri'=>self::redirect_uri())));
            if(is_wp_error($response)||wp_remote_retrieve_response_code($response)!==200){return self::result('exchange-failed');}
            $t=json_decode(wp_remote_retrieve_body($response),true);
            if(!is_array($t)||empty($t['access_token'])||empty($t['refresh_token'])||($t['token_type']??'')!=='Bearer'||!in_array(self::SCOPE,explode(' ',(string)($t['scope']??'')),true)){return self::result('consent-incomplete');}
            $stored=array('access_token'=>$t['access_token'],'refresh_token'=>$t['refresh_token'],'expires_at'=>time()+max(0,(int)($t['expires_in']??0)),'scope'=>self::SCOPE);
            $encrypted=SBS_Crypto::encrypt(wp_json_encode($stored));if(!$encrypted){return self::result('storage-failed');}
            update_option('sbs_google_tokens',$encrypted,false);
            if(!hash_equals($encrypted,(string)get_option('sbs_google_tokens',''))){return self::result('storage-failed');}
            return self::result('connected');
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function disconnect()
    {
        if(!SBS_Storage::ensure_directories()){return SBS_Finishing::error('storage','Private storage is unavailable.',503);}
        $lock=fopen(SBS_Storage::base_dir().'/tmp/google-oauth.lock','c');
        if(!$lock||!flock($lock,LOCK_EX|LOCK_NB)){if($lock){fclose($lock);}return SBS_Finishing::error('busy','OAuth is busy. Retry disconnect.',409);}
        try{
            $t=self::tokens();delete_option('sbs_google_tokens');update_option('sbs_google_generation',bin2hex(random_bytes(16)),false);
            $revoked=true;
            if(!empty($t['refresh_token'])){$result=wp_remote_post('https://oauth2.googleapis.com/revoke',array('timeout'=>15,'redirection'=>0,'body'=>array('token'=>$t['refresh_token'])));$revoked=!is_wp_error($result)&&wp_remote_retrieve_response_code($result)===200;}
            $status=self::status();$status['remote_revocation_confirmed']=$revoked;$status['message']=$revoked?'Disconnected. Local tokens removed.':'Local tokens removed. Google revocation was not confirmed; remove the app in Google Account permissions.';return $status;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}
