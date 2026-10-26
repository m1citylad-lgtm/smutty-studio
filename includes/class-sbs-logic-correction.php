<?php

if (!defined('ABSPATH')) { exit; }

/** Standalone, non-destructive visual logic review workspaces. */
final class SBS_Logic_Correction
{
    public static function register_routes()
    {
        $base = array('permission_callback' => array('SBS_REST', 'permission'));
        register_rest_route(SBS_REST::NS, '/logic-correction', array(array_merge($base, array('methods' => 'GET', 'callback' => array(__CLASS__, 'listing')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/references', array(array_merge($base, array('methods' => 'GET', 'callback' => array(__CLASS__, 'references')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/checks', array(array_merge($base, array('methods' => 'GET', 'callback' => array(__CLASS__, 'checks'))), array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'save_checks')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/upload', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'upload')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})', array(array_merge($base, array('methods' => 'GET', 'callback' => array(__CLASS__, 'get')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/version', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'add_version')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/review', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'review')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/repair', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'start_repair')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/repair/(?P<job_uuid>[a-f0-9\-]{36})', array(array_merge($base, array('methods' => 'GET', 'callback' => array(__CLASS__, 'poll_repair'))), array_merge($base, array('methods' => 'DELETE', 'callback' => array(__CLASS__, 'discard_repair')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/repair/(?P<job_uuid>[a-f0-9\-]{36})/accept', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'accept_repair')))));
    }

    private static function directory()
    {
        if (!SBS_Storage::ensure_directories()) { return new WP_Error('logic_storage', 'Private image storage is unavailable.', array('status' => 503)); }
        $path = SBS_Storage::base_dir() . '/logic-correction';
        if (!is_dir($path) && !wp_mkdir_p($path)) { return new WP_Error('logic_storage', 'The Logic Correction workspace could not be created.', array('status' => 503)); }
        return $path;
    }

    private static function record_path($uuid)
    {
        if (!is_string($uuid) || !preg_match('/^[a-f0-9-]{36}$/D', $uuid)) { return new WP_Error('logic_uuid', 'Invalid Logic Correction workspace.'); }
        $dir = self::directory();
        return is_wp_error($dir) ? $dir : $dir . '/' . $uuid . '.json';
    }

    private static function read_record($path)
    {
        $record = is_readable($path) ? json_decode(file_get_contents($path), true) : null;
        return is_array($record) && ($record['schema'] ?? 0) === 1 ? $record : new WP_Error('logic_missing', 'Logic Correction workspace not found.', array('status' => 404));
    }

    private static function save_record($path, $record)
    {
        $tmp = $path . '.' . wp_generate_password(12, false, false) . '.tmp';
        $json = wp_json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || file_put_contents($tmp, $json, LOCK_EX) !== strlen($json)) { @unlink($tmp); return new WP_Error('logic_save', 'The Logic Correction workspace could not be saved.'); }
        @chmod($tmp, 0640);
        if (!rename($tmp, $path)) { @unlink($tmp); return new WP_Error('logic_save', 'The Logic Correction workspace could not be committed.'); }
        return $record;
    }

    public static function listing()
    {
        $dir = self::directory(); if (is_wp_error($dir)) { return $dir; }
        $records = array();
        foreach (glob($dir . '/*.json') ?: array() as $path) {
            $record = self::read_record($path); if (!is_wp_error($record)) { $records[] = $record; }
        }
        usort($records, function ($a, $b) { return strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? '')); });
        return array('records' => array_slice($records, 0, 100), 'references' => self::approved_references(), 'checks' => self::saved_checks());
    }

    public static function checks() { return array('checks' => self::saved_checks()); }

    public static function save_checks($request)
    {
        $input = $request->get_param('checks');
        if (!is_array($input)) { return new WP_Error('logic_checks_invalid', 'Focused checks must be supplied as a list.', array('status' => 400)); }
        $checks = array();
        foreach (array_slice($input, 0, 20) as $item) {
            $item = sanitize_textarea_field((string) $item);
            $item = trim(preg_replace('/\s+/', ' ', $item));
            if ($item !== '') { $checks[] = substr($item, 0, 180); }
        }
        update_option('sbs_logic_correction_checks', array_values(array_unique($checks)), false);
        return array('checks' => self::saved_checks());
    }

    private static function saved_checks()
    {
        $saved = get_option('sbs_logic_correction_checks', array());
        if (!is_array($saved)) { return array(); }
        $checks = array();
        foreach (array_slice($saved, 0, 20) as $item) {
            $item = trim(sanitize_textarea_field((string) $item));
            if ($item !== '') { $checks[] = substr($item, 0, 180); }
        }
        return array_values(array_unique($checks));
    }

    public static function references()
    {
        return array('references' => self::approved_references());
    }

    private static function approved_references()
    {
        global $wpdb;
        $rows = $wpdb->get_results("SELECT p.uuid,p.name,v.id AS version_id,v.identity_json FROM " . SBS_DB::table('packs') . " p JOIN " . SBS_DB::table('pack_versions') . " v ON v.pack_id=p.id AND v.version=p.current_version WHERE p.status='ready' AND v.status='ready' ORDER BY p.name ASC", ARRAY_A);
        $result = array();
        foreach ((array) $rows as $row) {
            $identity = json_decode($row['identity_json'], true);
            if (!is_array($identity) || empty($identity['tests_approved']) || ($identity['library_status'] ?? '') === 'archived') { continue; }
            $assets = $wpdb->get_results($wpdb->prepare("SELECT id,role FROM " . SBS_DB::table('assets') . " WHERE owner_type='pack_version' AND owner_id=%d AND role IN ('master_reference','face','full_body','generated_reference') ORDER BY CASE role WHEN 'face' THEN 1 WHEN 'full_body' THEN 2 WHEN 'master_reference' THEN 3 ELSE 4 END,id ASC LIMIT 6", (int) $row['version_id']), ARRAY_A);
            if (!$assets) { continue; }
            $result[] = array('uuid' => $row['uuid'], 'name' => $row['name'], 'count' => count($assets));
        }
        return $result;
    }

    public static function get($request)
    {
        $path = self::record_path((string) $request['uuid']); if (is_wp_error($path)) { return $path; }
        return self::read_record($path);
    }

    public static function upload($request)
    {
        $files = $request->get_file_params();
        $file = $files['file'] ?? array();
        $title = sanitize_text_field((string) $request->get_param('title'));
        if ($title === '') { return new WP_Error('logic_title', 'Enter a short title for this image.', array('status' => 400)); }
        $asset = self::store_image($file, 'original', $title, ''); if (is_wp_error($asset)) { return $asset; }
        $uuid = wp_generate_uuid4();
        $now = gmdate('c');
        $record = array('schema' => 1, 'uuid' => $uuid, 'title' => $title, 'original' => $asset, 'versions' => array(), 'current_version' => 'original', 'reports' => array(), 'created_at' => $now, 'updated_at' => $now);
        $record['versions'][] = array('uuid' => 'original', 'number' => 1, 'label' => 'Untouched original', 'asset' => $asset, 'created_at' => $now);
        $asset = self::attach_to_record($asset, $uuid);
        $record['original'] = $asset; $record['versions'][0]['asset'] = $asset;
        $path = self::record_path($uuid); if (is_wp_error($path)) { return $path; }
        return self::save_record($path, $record);
    }

    public static function add_version($request)
    {
        $path = self::record_path((string) $request['uuid']); if (is_wp_error($path)) { return $path; }
        $record = self::read_record($path); if (is_wp_error($record)) { return $record; }
        $files = $request->get_file_params(); $file = $files['file'] ?? array();
        $asset = self::store_image($file, 'correction', $record['title'], $record['uuid']); if (is_wp_error($asset)) { return $asset; }
        $asset = self::attach_to_record($asset, $record['uuid']);
        $version_uuid = wp_generate_uuid4();
        $label = sanitize_text_field((string) $request->get_param('label'));
        $version = array('uuid' => $version_uuid, 'number' => count($record['versions']) + 1, 'label' => $label !== '' ? $label : 'Uploaded corrected copy', 'asset' => $asset, 'created_at' => gmdate('c'));
        $record['versions'][] = $version; $record['current_version'] = $version_uuid; $record['updated_at'] = gmdate('c');
        return self::save_record($path, $record);
    }

    private static function attach_to_record($asset, $record_uuid)
    {
        global $wpdb;
        $width = isset($asset['width']) ? (int) $asset['width'] : 0; $height = isset($asset['height']) ? (int) $asset['height'] : 0;
        $asset['metadata']['logic_workspace_uuid'] = $record_uuid;
        $wpdb->update(SBS_DB::table('assets'), array('metadata_json' => wp_json_encode($asset['metadata'])), array('id' => (int) $asset['id']));
        $stored = SBS_Storage::get_asset((int) $asset['id']);
        if ($stored && $width && $height) { $stored['width'] = $width; $stored['height'] = $height; }
        return $stored;
    }

    private static function store_image($file, $role, $title, $record_uuid)
    {
        if (!empty($file['size']) && (int) $file['size'] > 20 * MB_IN_BYTES) { return new WP_Error('logic_file_large', 'Choose an image up to 20 MB.'); }
        $asset = SBS_Storage::store_upload($file, 'logic_check', 0, $role, $title);
        if (is_wp_error($asset)) { return $asset; }
        $path = SBS_Storage::absolute_path($asset);
        $dimensions = $path ? @getimagesize($path) : false;
        if (!$dimensions || (int) $dimensions[0] * (int) $dimensions[1] > 20000000) {
            SBS_Storage::delete_asset((int) $asset['id']);
            return new WP_Error('logic_image_size', 'This image is too large to inspect safely. Choose an image with up to 20 million pixels.', array('status' => 413));
        }
        $asset['width'] = (int) $dimensions[0]; $asset['height'] = (int) $dimensions[1];
        if ($record_uuid !== '') { $asset = self::attach_to_record($asset, $record_uuid); $asset['width'] = (int) $dimensions[0]; $asset['height'] = (int) $dimensions[1]; }
        return $asset;
    }

    public static function review($request)
    {
        $path = self::record_path((string) $request['uuid']); if (is_wp_error($path)) { return $path; }
        $record = self::read_record($path); if (is_wp_error($record)) { return $record; }
        $version_uuid = sanitize_text_field((string) $request->get_param('version_uuid'));
        $version = null; foreach ($record['versions'] as $item) { if (($item['uuid'] ?? '') === $version_uuid) { $version = $item; break; } }
        if (!$version) { return new WP_Error('logic_version', 'Select a saved image version first.', array('status' => 400)); }
        $pass = sanitize_key((string) $request->get_param('pass'));
        if (!in_array($pass, array('whole', 'regions', 'character', 'custom'), true)) { return new WP_Error('logic_pass', 'Choose one of the listed visual checks.', array('status' => 400)); }
        $pack_uuid = sanitize_text_field((string) $request->get_param('character_uuid'));
        if ($pass === 'character' && $pack_uuid === '') { return new WP_Error('logic_reference', 'Choose an approved character reference before running this check.', array('status' => 400)); }
        if ($pass === 'custom' && !self::saved_checks()) { return new WP_Error('empty_logic_checks', 'Add at least one saved focused check first.', array('status' => 400)); }
        $source = self::raw_asset((string) $version['asset']['uuid'], (string) $record['uuid']); if (is_wp_error($source)) { return $source; }
        $images = self::review_images($source['path'], $pass);
        if (is_wp_error($images)) { return $images; }
        $identity = array();
        if ($pass === 'character') {
            $reference = self::pack_reference_images($pack_uuid);
            if (is_wp_error($reference)) { return $reference; }
            $images = array_merge(array_slice($images, 0, 1), $reference['images']); $identity = $reference['identity'];
        }
        if ($pass === 'custom') { $images = self::review_images($source['path'], 'regions'); if (is_wp_error($images)) { return $images; } }
        $report = SBS_OpenAI::review_logic_correction($pass, $images, $identity, self::saved_checks());
        if (is_wp_error($report)) { return $report; }
        if (!isset($record['reports'][$version_uuid]) || !is_array($record['reports'][$version_uuid])) { $record['reports'][$version_uuid] = array(); }
        $record['reports'][$version_uuid][$pass] = $report; $record['updated_at'] = gmdate('c');
        $saved = self::save_record($path, $record); return is_wp_error($saved) ? $saved : array('record' => $saved, 'report' => $report);
    }

    private static function job_path($workspace, $job)
    {
        $dir = self::directory();
        if (is_wp_error($dir)) { return $dir; }
        $jobs = $dir . '/jobs';
        if (!is_dir($jobs)) { wp_mkdir_p($jobs); @file_put_contents($jobs . '/index.php', "<?php http_response_code(404); exit;\n"); }
        return $jobs . '/' . $workspace . '-' . $job . '.json';
    }

    private static function read_job($workspace, $job)
    {
        $path = self::job_path($workspace, $job);
        if (is_wp_error($path)) { return $path; }
        $data = is_readable($path) ? json_decode(file_get_contents($path), true) : null;
        return is_array($data) && ($data['workspace'] ?? '') === $workspace ? $data : new WP_Error('logic_repair_missing', 'This correction preview is no longer available.', array('status' => 404));
    }

    private static function save_job($workspace, $job, $data)
    {
        $path = self::job_path($workspace, $job);
        if (is_wp_error($path)) { return $path; }
        $tmp = $path . '.tmp';
        $json = wp_json_encode($data, JSON_UNESCAPED_SLASHES);
        if (!is_string($json) || file_put_contents($tmp, $json, LOCK_EX) !== strlen($json) || !rename($tmp, $path)) { @unlink($tmp); return new WP_Error('logic_repair_save', 'The correction preview could not be saved.'); }
        @chmod($path, 0640);
        return $data;
    }

    public static function start_repair($request)
    {
        $workspace = (string) $request['uuid'];
        $path = self::record_path($workspace); if (is_wp_error($path)) { return $path; }
        $record = self::read_record($path); if (is_wp_error($record)) { return $record; }
        $version_uuid = sanitize_text_field((string) $request->get_param('version_uuid'));
        $version = null; foreach ($record['versions'] as $item) { if (($item['uuid'] ?? '') === $version_uuid) { $version = $item; break; } }
        if (!$version) { return new WP_Error('logic_version', 'Select a saved image version first.', array('status' => 400)); }
        $prompt = sanitize_textarea_field((string) $request->get_param('prompt'));
        if (strlen($prompt) < 4 || strlen($prompt) > 500) { return new WP_Error('logic_repair_prompt', 'Describe the local correction in 4 to 500 characters.', array('status' => 400)); }
        $mask_url = (string) $request->get_param('mask');
        if (!preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $mask_url, $match) || strlen($match[1]) > 12 * 1024 * 1024) { return new WP_Error('logic_repair_mask', 'Paint a correction area before requesting a preview.', array('status' => 400)); }
        $mask_bytes = base64_decode($match[1], true); $mask = $mask_bytes !== false ? @imagecreatefromstring($mask_bytes) : false;
        $source = self::raw_asset((string) $version['asset']['uuid'], $workspace); if (is_wp_error($source)) { return $source; }
        $source_bytes = @file_get_contents($source['path']); $image = $source_bytes !== false ? @imagecreatefromstring($source_bytes) : false;
        if (!$mask || !$image || !function_exists('imagecreatetruecolor')) { if ($mask) { imagedestroy($mask); } if ($image) { imagedestroy($image); } return new WP_Error('logic_repair_gd', 'This server needs GD image support to create a local correction preview.', array('status' => 503)); }
        $width = imagesx($image); $height = imagesy($image);
        if (imagesx($mask) !== $width || imagesy($mask) !== $height || $width * $height > 20000000) { imagedestroy($mask); imagedestroy($image); return new WP_Error('logic_repair_dimensions', 'The correction mask does not match the selected image.', array('status' => 400)); }
        $bounds = $request->get_param('bounds');
        if (!is_array($bounds) || !isset($bounds['x'],$bounds['y'],$bounds['right'],$bounds['bottom'])) { imagedestroy($mask); imagedestroy($image); return new WP_Error('logic_repair_bounds', 'The correction area is invalid.', array('status' => 400)); }
        $left = max(0, min($width - 1, (int) $bounds['x'])); $top = max(0, min($height - 1, (int) $bounds['y']));
        $right = max($left + 1, min($width, (int) $bounds['right'])); $bottom = max($top + 1, min($height, (int) $bounds['bottom']));
        $cropW = $right - $left; $cropH = $bottom - $top;
        if ($cropW * $cropH > 2000000) { imagedestroy($mask); imagedestroy($image); return new WP_Error('logic_repair_area', 'Choose a smaller local area (up to 2 million pixels).', array('status' => 413)); }
        $scale = min(1, 1536 / max($cropW, $cropH)); $outW = max(1, (int) round($cropW * $scale)); $outH = max(1, (int) round($cropH * $scale));
        $crop = imagecreatetruecolor($outW, $outH); imagecopyresampled($crop, $image, 0, 0, $left, $top, $outW, $outH, $cropW, $cropH);
        ob_start(); imagepng($crop); $cropBytes = ob_get_clean();
        $cropMask = imagecreatetruecolor($outW, $outH); imagealphablending($cropMask, false); imagesavealpha($cropMask, true);
        $transparent = imagecolorallocatealpha($cropMask, 0, 0, 0, 127); imagefill($cropMask, 0, 0, $transparent);
        imagecopyresampled($cropMask, $mask, 0, 0, $left, $top, $outW, $outH, $cropW, $cropH);
        ob_start(); imagepng($cropMask); $maskPng = ob_get_clean(); imagedestroy($cropMask);
        $cropAsset = SBS_Storage::store_bytes($cropBytes, 'repair-source.png', 'image/png', 'logic_check', 0, 'repair_source', 'Temporary local correction source');
        imagedestroy($crop); imagedestroy($image);
        if (is_wp_error($cropAsset)) { imagedestroy($mask); return $cropAsset; }
        imagedestroy($mask);
        $maskAsset = SBS_Storage::store_bytes($maskPng, 'repair-mask.png', 'image/png', 'logic_check', 0, 'repair_mask', 'Temporary local correction mask');
        if (is_wp_error($maskAsset)) { SBS_Storage::delete_asset((int) $cropAsset['id']); return $maskAsset; }
        $cropAsset = self::attach_to_record($cropAsset, $workspace); $maskAsset = self::attach_to_record($maskAsset, $workspace);
        $job = wp_generate_uuid4();
        $payload = array('workspace'=>$workspace,'job'=>$job,'version_uuid'=>$version_uuid,'source_uuid'=>$version['asset']['uuid'],'source_sha256'=>$version['asset']['sha256'],'crop_uuid'=>$cropAsset['uuid'],'mask_uuid'=>$maskAsset['uuid'],'bounds'=>array('x'=>$left,'y'=>$top,'width'=>$cropW,'height'=>$cropH,'out_width'=>$outW,'out_height'=>$outH),'prompt'=>$prompt,'status'=>'pending','created_at'=>gmdate('c'));
        $saved = self::save_job($workspace, $job, $payload); if (is_wp_error($saved)) { SBS_Storage::delete_asset((int)$cropAsset['id']); SBS_Storage::delete_asset((int)$maskAsset['id']); return $saved; }
        $response = SBS_OpenAI::submit_image('Edit the first image as a local illustration correction. The second image is a black/white mask showing pixels the user wants changed. ' . $prompt . ' Preserve composition, style and all details outside the marked region. Return the same crop framing.', array((int)$cropAsset['id'], (int)$maskAsset['id']), array('action'=>'edit','quality'=>'medium','size'=>'auto','background'=>'opaque'));
        if (is_wp_error($response)) { self::cleanup_job_assets($payload); @unlink(self::job_path($workspace, $job)); return $response; }
        $payload['response_id'] = (string) ($response['id'] ?? '');
        if ($payload['response_id'] === '') { self::cleanup_job_assets($payload); @unlink(self::job_path($workspace, $job)); return new WP_Error('logic_repair_provider', 'The image provider did not create a correction job.'); }
        self::save_job($workspace, $job, $payload);
        return array('job_uuid'=>$job,'status'=>'pending');
    }

    public static function poll_repair($request)
    {
        $workspace = (string) $request['uuid']; $jobId = (string) $request['job_uuid'];
        $job = self::read_job($workspace, $jobId); if (is_wp_error($job)) { return $job; }
        if ($job['status'] === 'ready') { return array('status'=>'ready','preview'=>SBS_Storage::asset_by_uuid($job['preview_uuid'])); }
        if ($job['status'] === 'failed') { return new WP_Error('logic_repair_failed', $job['error'] ?? 'The local correction failed.', array('status'=>422)); }
        $response = SBS_OpenAI::poll($job['response_id']); if (is_wp_error($response)) { return $response; }
        $parsed = SBS_OpenAI::parse_image_response($response);
        if (($parsed['status'] ?? '') === 'queued' || ($parsed['status'] ?? '') === 'in_progress') { return array('status'=>'pending'); }
        if (($parsed['status'] ?? '') !== 'completed') { $job['status']='failed'; $job['error']=$parsed['error']['message'] ?? 'The image provider could not complete this correction.'; self::save_job($workspace,$jobId,$job); return new WP_Error('logic_repair_failed',$job['error'],array('status'=>422)); }
        $source = self::raw_asset($job['source_uuid'], $workspace); $maskAsset = self::raw_asset($job['mask_uuid'], $workspace);
        if (is_wp_error($source) || is_wp_error($maskAsset) || !hash_equals($job['source_sha256'], hash_file('sha256',$source['path']))) { return new WP_Error('logic_repair_source', 'The selected source version changed or is unavailable.'); }
        $orig = @imagecreatefromstring(file_get_contents($source['path'])); $mask = @imagecreatefromstring(file_get_contents($maskAsset['path'])); $generated = @imagecreatefromstring($parsed['bytes']);
        if (!$orig || !$mask || !$generated) { return new WP_Error('logic_repair_decode','The correction preview could not be decoded.'); }
        $b=$job['bounds']; $patch=imagecreatetruecolor($b['width'],$b['height']); imagecopyresampled($patch,$generated,0,0,0,0,$b['width'],$b['height'],imagesx($generated),imagesy($generated));
        for ($y=0;$y<$b['height'];$y++) { for ($x=0;$x<$b['width'];$x++) { $mx=$x+$b['x']; $my=$y+$b['y']; $m=imagecolorat($mask,$mx,$my); $alpha=($m >> 24) & 0x7F; $coverage=1-($alpha/127); if ($coverage<=0.01) { continue; } $old=imagecolorat($orig,$mx,$my); $new=imagecolorat($patch,$x,$y); $a=imagecolorsforindex($orig,$old); $n=imagecolorsforindex($patch,$new); $r=(int)round($a['red']*(1-$coverage)+$n['red']*$coverage); $g=(int)round($a['green']*(1-$coverage)+$n['green']*$coverage); $bl=(int)round($a['blue']*(1-$coverage)+$n['blue']*$coverage); imagesetpixel($orig,$mx,$my,imagecolorallocate($orig,$r,$g,$bl)); } }
        ob_start(); imagepng($orig); $final=ob_get_clean(); imagedestroy($orig); imagedestroy($mask); imagedestroy($generated); imagedestroy($patch);
        $asset=SBS_Storage::store_bytes($final,'local-correction-preview.png','image/png','logic_check',0,'repair_preview','AI local correction preview');
        if (is_wp_error($asset)) { return $asset; }
        $asset=self::attach_to_record($asset,$workspace); $job['status']='ready'; $job['preview_uuid']=$asset['uuid']; self::save_job($workspace,$jobId,$job);
        return array('status'=>'ready','preview'=>$asset);
    }

    private static function cleanup_job_assets($job)
    {
        foreach (array('crop_uuid','mask_uuid') as $key) { if (empty($job[$key])) { continue; } $asset=SBS_Storage::asset_by_uuid($job[$key]); if ($asset && ($asset['owner_type'] ?? '')==='logic_check' && ($asset['metadata']['logic_workspace_uuid'] ?? '')===($job['workspace'] ?? '')) { SBS_Storage::delete_asset((int)$asset['id']); } }
    }

    public static function discard_repair($request)
    {
        $workspace=(string)$request['uuid']; $jobId=(string)$request['job_uuid']; $job=self::read_job($workspace,$jobId); if (is_wp_error($job)) { return $job; }
        if (!empty($job['response_id']) && $job['status']==='pending') { SBS_OpenAI::cancel($job['response_id']); }
        self::cleanup_job_assets($job);
        if (!empty($job['preview_uuid'])) { $asset=SBS_Storage::asset_by_uuid($job['preview_uuid']); if ($asset && ($asset['metadata']['logic_workspace_uuid'] ?? '')===$workspace) { SBS_Storage::delete_asset((int)$asset['id']); } }
        @unlink(self::job_path($workspace,$jobId)); return array('discarded'=>true);
    }

    public static function accept_repair($request)
    {
        $workspace=(string)$request['uuid']; $jobId=(string)$request['job_uuid']; $job=self::read_job($workspace,$jobId); if (is_wp_error($job)) { return $job; }
        if (($job['status'] ?? '')!=='ready') { return new WP_Error('logic_repair_pending','Wait for the correction preview before saving it.',array('status'=>409)); }
        $path=self::record_path($workspace); $record=self::read_record($path); if (is_wp_error($record)) { return $record; }
        $sourceFound=false; foreach ($record['versions'] as $version) { if (($version['uuid']??'')===$job['version_uuid'] && ($version['asset']['uuid']??'')===$job['source_uuid']) { $sourceFound=true; } }
        $asset=SBS_Storage::asset_by_uuid($job['preview_uuid']); if (!$sourceFound || !$asset || ($asset['metadata']['logic_workspace_uuid']??'')!==$workspace) { return new WP_Error('logic_repair_source','The source version or preview is unavailable.'); }
        $label=sanitize_text_field((string)$request->get_param('label')); $record['versions'][]=array('uuid'=>wp_generate_uuid4(),'number'=>count($record['versions'])+1,'label'=>$label?:'AI local correction','asset'=>$asset,'created_at'=>gmdate('c')); $record['current_version']=$record['versions'][count($record['versions'])-1]['uuid']; $record['updated_at']=gmdate('c');
        $saved=self::save_record($path,$record); if (is_wp_error($saved)) { return $saved; }
        self::cleanup_job_assets($job); @unlink(self::job_path($workspace,$jobId)); return $saved;
    }

    private static function raw_asset($asset_uuid, $record_uuid)
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM " . SBS_DB::table('assets') . " WHERE uuid=%s AND owner_type='logic_check'", $asset_uuid), ARRAY_A);
        if (!$row) { return new WP_Error('logic_asset', 'The selected image could not be found.'); }
        $metadata = json_decode($row['metadata_json'], true);
        if (!is_array($metadata) || !hash_equals($record_uuid, (string) ($metadata['logic_workspace_uuid'] ?? ''))) { return new WP_Error('logic_asset', 'The selected image does not belong to this workspace.', array('status' => 403)); }
        $path = SBS_Storage::base_dir() . '/' . ltrim($row['relative_path'], '/');
        if (!is_readable($path) || !hash_equals((string) $row['sha256'], hash_file('sha256', $path))) { return new WP_Error('logic_asset_integrity', 'The saved image failed its integrity check.'); }
        return array('path' => $path, 'mime' => $row['mime'], 'filename' => $row['filename']);
    }

    private static function review_images($path, $pass)
    {
        if (!function_exists('imagecreatefromstring') || !function_exists('imagewebp')) { return new WP_Error('logic_image_tools', 'This server needs GD with WebP support for focused image checks.', array('status' => 503)); }
        $bytes = @file_get_contents($path); $source = $bytes !== false ? @imagecreatefromstring($bytes) : false;
        if (!$source) { return new WP_Error('logic_image_decode', 'The saved image could not be prepared for visual review.'); }
        $width = imagesx($source); $height = imagesy($source); $regions = array();
        if ($pass === 'whole' || $pass === 'character') { $regions[] = array('label' => 'whole', 'bounds' => array('x' => 0, 'y' => 0, 'width' => 1, 'height' => 1)); }
        if ($pass === 'regions') {
            $regions = array(
                array('label' => 'top-left enlarged region', 'bounds' => array('x' => 0, 'y' => 0, 'width' => .56, 'height' => .56)),
                array('label' => 'top-right enlarged region', 'bounds' => array('x' => .44, 'y' => 0, 'width' => .56, 'height' => .56)),
                array('label' => 'bottom-left enlarged region', 'bounds' => array('x' => 0, 'y' => .44, 'width' => .56, 'height' => .56)),
                array('label' => 'bottom-right enlarged region', 'bounds' => array('x' => .44, 'y' => .44, 'width' => .56, 'height' => .56)),
            );
        }
        $images = array();
        foreach ($regions as $region) {
            $box = $region['bounds']; $left = (int) floor($box['x'] * $width); $top = (int) floor($box['y'] * $height);
            $crop_w = min($width - $left, max(1, (int) ceil($box['width'] * $width))); $crop_h = min($height - $top, max(1, (int) ceil($box['height'] * $height)));
            $scale = min(1, 1500 / max($crop_w, $crop_h)); $out_w = max(1, (int) round($crop_w * $scale)); $out_h = max(1, (int) round($crop_h * $scale));
            $crop = imagecreatetruecolor($out_w, $out_h); imagealphablending($crop, false); imagesavealpha($crop, true); $clear = imagecolorallocatealpha($crop, 0, 0, 0, 127); imagefill($crop, 0, 0, $clear);
            imagecopyresampled($crop, $source, 0, 0, $left, $top, $out_w, $out_h, $crop_w, $crop_h);
            ob_start(); imagewebp($crop, null, 88); $encoded = ob_get_clean(); imagedestroy($crop);
            if (!is_string($encoded) || $encoded === '') { imagedestroy($source); return new WP_Error('logic_image_encode', 'A focused review image could not be encoded.'); }
            $images[] = array('label' => $region['label'], 'bounds' => $box, 'data_url' => 'data:image/webp;base64,' . base64_encode($encoded));
        }
        imagedestroy($source);
        return $images;
    }

    private static function pack_reference_images($pack_uuid)
    {
        global $wpdb;
        $pack = $wpdb->get_row($wpdb->prepare('SELECT p.uuid,p.name,p.status AS pack_status,v.id AS version_id,v.identity_json,v.status AS version_status FROM ' . SBS_DB::table('packs') . ' p JOIN ' . SBS_DB::table('pack_versions') . ' v ON v.pack_id=p.id AND v.version=p.current_version WHERE p.uuid=%s', $pack_uuid), ARRAY_A);
        if (!$pack) { return new WP_Error('logic_reference', 'That character reference is not available.'); }
        $identity = json_decode($pack['identity_json'], true);
        if (!is_array($identity) || empty($identity['tests_approved']) || $pack['pack_status'] !== 'ready' || $pack['version_status'] !== 'ready' || ($identity['library_status'] ?? '') === 'archived') {
            return new WP_Error('logic_reference_unapproved', 'Choose an active character with an approved reference sheet.');
        }
        $rows = $wpdb->get_results($wpdb->prepare("SELECT id,filename,relative_path FROM " . SBS_DB::table('assets') . " WHERE owner_type='pack_version' AND owner_id=%d AND role IN ('face','full_body','master_reference','generated_reference') ORDER BY CASE role WHEN 'face' THEN 1 WHEN 'full_body' THEN 2 WHEN 'master_reference' THEN 3 ELSE 4 END,id ASC LIMIT 3", (int) $pack['version_id']), ARRAY_A);
        if (!$rows) { return new WP_Error('logic_reference_missing', 'This approved character has no saved visual reference images.'); }
        $images = array();
        foreach ($rows as $index => $row) {
            $path = SBS_Storage::base_dir() . '/' . ltrim($row['relative_path'], '/');
            $prepared = self::review_images($path, 'whole'); if (is_wp_error($prepared)) { continue; }
            $image = $prepared[0]; $image['label'] = 'approved reference ' . ($index + 1); $images[] = $image;
        }
        if (!$images) { return new WP_Error('logic_reference_missing', 'The approved character references could not be prepared.'); }
        $identity = array_intersect_key($identity, array_flip(array('name','summary','locked_traits','exclusions','palette')));
        return array('identity' => $identity, 'images' => $images);
    }
}
