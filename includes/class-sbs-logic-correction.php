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
        register_rest_route(SBS_REST::NS, '/logic-correction/upload', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'upload')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})', array(array_merge($base, array('methods' => 'GET', 'callback' => array(__CLASS__, 'get')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/version', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'add_version')))));
        register_rest_route(SBS_REST::NS, '/logic-correction/(?P<uuid>[a-f0-9\-]{36})/review', array(array_merge($base, array('methods' => 'POST', 'callback' => array(__CLASS__, 'review')))));
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
        return array('records' => array_slice($records, 0, 100), 'references' => self::approved_references());
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
        if (!in_array($pass, array('whole', 'regions', 'character'), true)) { return new WP_Error('logic_pass', 'Choose one of the listed visual checks.', array('status' => 400)); }
        $pack_uuid = sanitize_text_field((string) $request->get_param('character_uuid'));
        if ($pass === 'character' && $pack_uuid === '') { return new WP_Error('logic_reference', 'Choose an approved character reference before running this check.', array('status' => 400)); }
        $source = self::raw_asset((string) $version['asset']['uuid'], (string) $record['uuid']); if (is_wp_error($source)) { return $source; }
        $images = self::review_images($source['path'], $pass);
        if (is_wp_error($images)) { return $images; }
        $identity = array();
        if ($pass === 'character') {
            $reference = self::pack_reference_images($pack_uuid);
            if (is_wp_error($reference)) { return $reference; }
            $images = array_merge(array_slice($images, 0, 1), $reference['images']); $identity = $reference['identity'];
        }
        $report = SBS_OpenAI::review_logic_correction($pass, $images, $identity);
        if (is_wp_error($report)) { return $report; }
        if (!isset($record['reports'][$version_uuid]) || !is_array($record['reports'][$version_uuid])) { $record['reports'][$version_uuid] = array(); }
        $record['reports'][$version_uuid][$pass] = $report; $record['updated_at'] = gmdate('c');
        $saved = self::save_record($path, $record); return is_wp_error($saved) ? $saved : array('record' => $saved, 'report' => $report);
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
