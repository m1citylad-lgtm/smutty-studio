<?php
if (!defined('ABSPATH')) { exit; }

/**
 * Server-only Google Drive transport. Not registered as a public REST route.
 * OAuth credentials stay in the existing encrypted WordPress options.
 * Picker grants per-file access; REST handlers keep imports and package writes
 * behind the existing Studio session and session-bound CSRF check.
 */
final class SBS_Google_Drive_Transport
{
    private static function tokens()
    {
        $raw = SBS_Crypto::decrypt((string) get_option('sbs_google_tokens', ''));
        $tokens = json_decode($raw, true);
        return is_array($tokens) ? $tokens : array();
    }

    private static function error($message, $status = 503)
    {
        return new WP_Error('sbs_drive_transport', $message, array('status' => $status));
    }

    public static function access_token()
    {
        $tokens = self::tokens();
        if (empty($tokens['refresh_token'])) {
            return self::error('Connect Google Drive again.', 401);
        }
        if (!empty($tokens['access_token']) && (int) ($tokens['expires_at'] ?? 0) > time() + 90) {
            return $tokens['access_token'];
        }
        if (!SBS_Storage::ensure_directories()) {
            return self::error('Private storage is unavailable.');
        }
        $handle = @fopen(SBS_Storage::base_dir() . '/tmp/google-oauth.lock', 'c');
        if (!$handle) { return self::error('Google connection is busy. Try again.'); }
        try {
            if (!flock($handle, LOCK_EX | LOCK_NB)) {
                return self::error('Google connection is busy. Try again.', 409);
            }
            // Re-read after acquiring the same lock used by disconnect/callback.
            $tokens = self::tokens();
            if (empty($tokens['refresh_token'])) {
                return self::error('Connect Google Drive again.', 401);
            }
            if (!empty($tokens['access_token']) && (int) ($tokens['expires_at'] ?? 0) > time() + 90) {
                return $tokens['access_token'];
            }
            $client = (string) get_option('sbs_google_client_id', '');
            $secret = SBS_Crypto::decrypt((string) get_option('sbs_google_client_secret', ''));
            if (!$client || !$secret) { return self::error('Google client settings are incomplete.', 409); }
            $response = wp_remote_post('https://oauth2.googleapis.com/token', array(
                'timeout' => 20,
                'redirection' => 0,
                'body' => array(
                    'client_id' => $client,
                    'client_secret' => $secret,
                    'refresh_token' => $tokens['refresh_token'],
                    'grant_type' => 'refresh_token',
                ),
            ));
            if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
                return self::error('Google access expired or could not be refreshed. Reconnect Google Drive.', 401);
            }
            $new = json_decode(wp_remote_retrieve_body($response), true);
            if (!is_array($new) || empty($new['access_token']) || ($new['token_type'] ?? '') !== 'Bearer'
                || (int) ($new['expires_in'] ?? 0) < 1) {
                return self::error('Google returned an invalid connection response.');
            }
            if (!empty($new['scope']) && !in_array(SBS_Google_Drive::SCOPE, explode(' ', $new['scope']), true)) {
                return self::error('Google permissions have changed. Reconnect Google Drive.', 401);
            }
            $tokens['access_token'] = $new['access_token'];
            $tokens['expires_at'] = time() + (int) $new['expires_in'];
            if (!empty($new['refresh_token'])) { $tokens['refresh_token'] = $new['refresh_token']; }
            $encrypted = SBS_Crypto::encrypt(wp_json_encode($tokens));
            if (!$encrypted || !update_option('sbs_google_tokens', $encrypted, false)
                && (string) get_option('sbs_google_tokens', '') !== $encrypted) {
                return self::error('Google credentials could not be saved securely.');
            }
            return $tokens['access_token'];
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Metadata for a file already authorised through Google Picker or created
     * by this application. The Drive API enforces drive.file permissions.
     */
    public static function file_metadata($file_id)
    {
        if (!is_string($file_id) || !preg_match('/^[A-Za-z0-9_-]{10,200}$/D', $file_id)) {
            return self::error('Invalid Google Drive file reference.', 400);
        }
        $token = self::access_token();
        if (is_wp_error($token)) { return $token; }
        $url = 'https://www.googleapis.com/drive/v3/files/' . rawurlencode($file_id)
            . '?supportsAllDrives=true&fields=' . rawurlencode('id,name,mimeType,size,md5Checksum,parents,webViewLink,trashed,appProperties,capabilities(canAddChildren)');
        $response = wp_remote_get($url, array(
            'timeout' => 20,
            'redirection' => 0,
            'headers' => array('Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'),
        ));
        if (is_wp_error($response)) { return self::error('Google Drive could not be reached.'); }
        $status = wp_remote_retrieve_response_code($response);
        if ($status === 401) { return self::error('Reconnect Google Drive.', 401); }
        if ($status === 403 || $status === 404) { return self::error('This file is not accessible to Smutty Studio.', $status); }
        if ($status !== 200) { return self::error('Google Drive could not read the file details.'); }
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($data) || ($data['id'] ?? '') !== $file_id || !empty($data['trashed'])) {
            return self::error('Google Drive returned invalid file details.');
        }
        return $data;
    }

    /** Reserve one ID before saving the local upload intent; retries reuse it. */
    public static function reserve_file_id()
    {
        $token=self::access_token();if(is_wp_error($token)){return $token;}
        $response=wp_remote_get('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',array(
            'timeout'=>20,'redirection'=>0,'headers'=>array('Authorization'=>'Bearer '.$token),
        ));
        if(is_wp_error($response)||wp_remote_retrieve_response_code($response)!==200){return self::error('Google could not prepare a safe upload. Try again.');}
        $data=json_decode(wp_remote_retrieve_body($response),true);$id=$data['ids'][0]??null;
        if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$id)){return self::error('Google did not return a valid upload reference.');}
        return $id;
    }
    public static function verify_upload($file_id,$folder_id,$bytes,$operation_id)
    {
        $meta=self::file_metadata($file_id);if(is_wp_error($meta)){return $meta;}
        if(($meta['mimeType']??'')!=='application/zip'
            || !in_array($folder_id,$meta['parents']??array(),true)
            || (int)($meta['size']??-1)!==strlen($bytes)
            || empty($meta['md5Checksum'])
            || !hash_equals(strtolower($meta['md5Checksum']),md5($bytes))
            || ($meta['appProperties']['sbs_operation']??'')!==$operation_id){
            return self::error('Saved package verification failed. Check the selected Drive folder before retrying.',409);
        }
        return array('id'=>$file_id,'verified'=>true,'sha256'=>hash('sha256',$bytes),
            'url'=>'https://drive.google.com/file/d/'.rawurlencode($file_id).'/view');
    }
    public static function image_bytes($id)
    {
        $meta = self::file_metadata($id);
        if (is_wp_error($meta)) { return $meta; }
        $mime = $meta['mimeType'] ?? '';
        $size = (int) ($meta['size'] ?? 0);
        if (!in_array($mime, array('image/png','image/jpeg','image/webp'), true)
            || $size < 1 || $size > 20971520) {
            return self::error('Select a PNG, JPEG or WebP image under 20 MB.', 400);
        }
        $token = self::access_token();
        if (is_wp_error($token)) { return $token; }
        $response = wp_remote_get('https://www.googleapis.com/drive/v3/files/'.rawurlencode($id).'?alt=media&supportsAllDrives=true', array(
            'timeout'=>45, 'redirection'=>0, 'limit_response_size'=>20971521,
            'headers'=>array('Authorization'=>'Bearer '.$token),
        ));
        if (is_wp_error($response)) { return self::error('Google Drive image could not be reached. Check your connection and try again.'); }
        $download_status=wp_remote_retrieve_response_code($response);
        if ($download_status===401) { return self::error('Google sign-in expired. Reconnect Google Drive, then try again.',401); }
        if ($download_status===403||$download_status===404) { return self::error('Google no longer allows this Studio to read the selected image.',403); }
        if ($download_status!==200) { return self::error('Google Drive image download was not confirmed. No local import was made.'); }
        $bytes = wp_remote_retrieve_body($response);
        if (strlen($bytes)!==$size || empty($meta['md5Checksum'])
            || !preg_match('/^[a-f0-9]{32}$/iD',(string)$meta['md5Checksum'])
            || !hash_equals(strtolower($meta['md5Checksum']), md5($bytes))) {
            return self::error('Downloaded file failed integrity verification.', 409);
        }
        $image = @getimagesizefromstring($bytes);
        if (!$image || ($image['mime']??'')!==$mime || $image[0]*$image[1]>40000000) {
            return self::error('Invalid image dimensions or content.', 400);
        }
        return array('bytes'=>$bytes,'metadata'=>$meta,'sha256'=>hash('sha256',$bytes));
    }
    /** Create at a reserved file ID: Google returns 409 on a completed retry. */
    public static function upload_new($folder_id,$name,$mime,$bytes,$operation_id,$file_id)
    {
        if (!is_string($folder_id) || !preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$folder_id)
            || !is_string($file_id) || !preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$file_id)
            || !is_string($bytes) || strlen($bytes)<1 || strlen($bytes)>52428800
            || $mime!=='application/zip'
            || !is_string($operation_id) || !preg_match('/^[a-f0-9]{64}$/D',$operation_id)) {
            return self::error('Invalid Drive upload request.',400);
        }
        $folder=self::file_metadata($folder_id);if(is_wp_error($folder)){return $folder;}
        if (($folder['mimeType']??'')!=='application/vnd.google-apps.folder') {
            return self::error('The destination is not an authorised folder.',400);
        }
        if(isset($folder['capabilities']['canAddChildren'])&&!$folder['capabilities']['canAddChildren']){
            return self::error('Google cannot add files to that folder. Choose a folder you can edit.',403);
        }
        $token=self::access_token();if(is_wp_error($token)){return $token;}
        $name=sanitize_file_name($name);if(!$name){return self::error('Invalid filename.',400);}
        $boundary='sbs_'.bin2hex(random_bytes(16));
        $body='--'.$boundary."\r\n".'Content-Type: application/json; charset=UTF-8'."\r\n\r\n"
            .wp_json_encode(array('id'=>$file_id,'name'=>$name,'parents'=>array($folder_id),'appProperties'=>array('sbs_operation'=>$operation_id)))."\r\n"
            .'--'.$boundary."\r\n".'Content-Type: '.$mime."\r\n\r\n"
            .$bytes."\r\n".'--'.$boundary."--\r\n";
        $response=wp_remote_post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',array(
            'timeout'=>60,'redirection'=>0,
            'headers'=>array('Authorization'=>'Bearer '.$token,'Content-Type'=>'multipart/related; boundary='.$boundary),
            'body'=>$body,
        ));
        if(is_wp_error($response)){return self::error('Drive could not confirm the upload. Refresh this workspace and retry; Studio will reuse the same upload reference.');}
        $status=wp_remote_retrieve_response_code($response);
        if($status===401){return self::error('Google sign-in expired. Reconnect Google Drive, then retry the same save.',401);}
        if($status===403){return self::error('Google cannot add files to that folder. Choose a folder you can edit.',403);}
        if(!in_array($status,array(200,201,409),true)){return self::error('Upload was not confirmed. Refresh the workspace and retry the same save.');}
        if($status!==409){
            $created=json_decode(wp_remote_retrieve_body($response),true);
            if(!is_array($created)||($created['id']??'')!==$file_id){return self::error('Google returned an unexpected upload reference. Refresh the workspace before retrying.',409);}
        }
        $verified=self::verify_upload($file_id,$folder_id,$bytes,$operation_id);
        if(!is_wp_error($verified)){$verified['recovered_retry']=$status===409;}
        return $verified;
    }
}
