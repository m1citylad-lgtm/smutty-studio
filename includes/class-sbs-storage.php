<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Storage
{
    public static function base_dir()
    {
        if (defined('SBS_PRIVATE_DATA_DIR') && SBS_PRIVATE_DATA_DIR) {
            return untrailingslashit(wp_normalize_path(SBS_PRIVATE_DATA_DIR));
        }
        return untrailingslashit(wp_normalize_path(WP_CONTENT_DIR . '/smutty-bear-private'));
    }

    public static function ensure_directories()
    {
        $base = self::base_dir();
        foreach (array('', '/assets', '/exports', '/imports', '/updates', '/updates/backups', '/tmp') as $suffix) {
            if (!is_dir($base . $suffix)) {
                wp_mkdir_p($base . $suffix);
            }
        }
        self::write_protection_files($base);
        return is_dir($base) && is_writable($base);
    }

    private static function write_protection_files($base)
    {
        $files = array(
            '.htaccess' => "Require all denied\nDeny from all\n",
            'web.config' => "<?xml version=\"1.0\" encoding=\"UTF-8\"?><configuration><system.webServer><security><authorization><remove users=\"*\" roles=\"\" verbs=\"\"/><add accessType=\"Deny\" users=\"*\"/></authorization></security></system.webServer></configuration>",
            'index.php' => "<?php http_response_code(404); exit;\n",
        );
        foreach ($files as $name => $contents) {
            $path = $base . '/' . $name;
            if (!file_exists($path)) {
                @file_put_contents($path, $contents, LOCK_EX);
            }
        }
    }

    public static function import_bundled_asset($source, $owner_type, $owner_id, $role, $label)
    {
        $contents = file_get_contents($source);
        if ($contents === false) {
            return new WP_Error('asset_read_failed', 'Could not read bundled reference asset.');
        }
        $mime = function_exists('mime_content_type') ? mime_content_type($source) : 'image/jpeg';
        return self::store_bytes($contents, basename($source), $mime ?: 'image/jpeg', $owner_type, $owner_id, $role, $label);
    }

    public static function store_upload($file, $owner_type, $owner_id, $role, $label)
    {
        if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return new WP_Error('invalid_upload', 'The uploaded file is invalid.');
        }
        $check = wp_check_filetype_and_ext($file['tmp_name'], $file['name'], self::allowed_mimes());
        $mime = !empty($check['type']) ? $check['type'] : '';
        $allowed = array_values(self::allowed_mimes());
        if (!in_array($mime, $allowed, true)) {
            return new WP_Error('invalid_type', 'Unsupported file type.');
        }
        if (strpos($mime, 'image/') === 0 && !@getimagesize($file['tmp_name'])) {
            return new WP_Error('invalid_image', 'The uploaded image could not be validated.');
        }
        $bytes = file_get_contents($file['tmp_name']);
        if ($bytes === false) {
            return new WP_Error('asset_read_failed', 'Could not read the uploaded file.');
        }
        return self::store_bytes($bytes, sanitize_file_name($file['name']), $mime, $owner_type, $owner_id, $role, $label);
    }

    public static function store_bytes($bytes, $filename, $mime, $owner_type, $owner_id, $role, $label, $metadata = array())
    {
        global $wpdb;
        if (!self::ensure_directories()) {
            return new WP_Error('storage_unavailable', 'Private storage is not writable.');
        }
        $uuid = wp_generate_uuid4();
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!$ext) {
            $map = array('image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'font/ttf' => 'ttf', 'font/otf' => 'otf', 'font/woff' => 'woff', 'font/woff2' => 'woff2');
            $ext = isset($map[$mime]) ? $map[$mime] : 'bin';
        }
        $relative = 'assets/' . gmdate('Y/m') . '/' . $uuid . '.' . preg_replace('/[^a-z0-9]/', '', $ext);
        $absolute = self::base_dir() . '/' . $relative;
        wp_mkdir_p(dirname($absolute));
        if (file_put_contents($absolute, $bytes, LOCK_EX) === false) {
            return new WP_Error('asset_write_failed', 'Could not write the private asset.');
        }
        @chmod($absolute, 0640);
        $wpdb->insert(SBS_DB::table('assets'), array(
            'uuid' => $uuid,
            'owner_type' => sanitize_key($owner_type),
            'owner_id' => (int) $owner_id,
            'role' => sanitize_key($role),
            'label' => sanitize_text_field($label),
            'filename' => sanitize_file_name($filename),
            'relative_path' => $relative,
            'mime' => sanitize_mime_type($mime),
            'sha256' => hash('sha256', $bytes),
            'bytes' => strlen($bytes),
            'metadata_json' => wp_json_encode($metadata),
            'created_at' => current_time('mysql', true),
        ));
        if (!$wpdb->insert_id) {
            @unlink($absolute);
            return new WP_Error('asset_db_failed', 'Could not register the private asset.');
        }
        return self::get_asset((int) $wpdb->insert_id);
    }

    public static function store_file($source, $filename, $mime, $owner_type, $owner_id, $role, $label, $metadata = array())
    {
        global $wpdb;
        if (!is_readable($source) || !self::ensure_directories()) {
            return new WP_Error('asset_read_failed', 'The source file is unavailable.');
        }
        $uuid = wp_generate_uuid4();
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $relative = 'assets/' . gmdate('Y/m') . '/' . $uuid . '.' . preg_replace('/[^a-z0-9]/', '', $ext ?: 'bin');
        $absolute = self::base_dir() . '/' . $relative;
        wp_mkdir_p(dirname($absolute));
        if (!copy($source, $absolute)) {
            return new WP_Error('asset_write_failed', 'Could not copy the file into private storage.');
        }
        @chmod($absolute, 0640);
        $wpdb->insert(SBS_DB::table('assets'), array(
            'uuid' => $uuid, 'owner_type' => sanitize_key($owner_type), 'owner_id' => (int) $owner_id,
            'role' => sanitize_key($role), 'label' => sanitize_text_field($label), 'filename' => sanitize_file_name($filename),
            'relative_path' => $relative, 'mime' => sanitize_mime_type($mime), 'sha256' => hash_file('sha256', $absolute),
            'bytes' => filesize($absolute), 'metadata_json' => wp_json_encode($metadata), 'created_at' => current_time('mysql', true),
        ));
        if (!$wpdb->insert_id) {
            @unlink($absolute);
            return new WP_Error('asset_db_failed', 'Could not register the private file.');
        }
        return self::get_asset((int) $wpdb->insert_id);
    }

    public static function get_asset($id)
    {
        global $wpdb;
        $table = SBS_DB::table('assets');
        $asset = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id), ARRAY_A);
        return $asset ? self::present($asset) : null;
    }

    public static function asset_by_uuid($uuid)
    {
        global $wpdb;
        $table = SBS_DB::table('assets');
        $asset = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE uuid = %s", $uuid), ARRAY_A);
        return $asset ? self::present($asset) : null;
    }

    public static function delete_asset($id)
    {
        global $wpdb;
        $table = SBS_DB::table('assets');
        $asset = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", (int) $id), ARRAY_A);
        if (!$asset) {
            return true;
        }
        $base = realpath(self::base_dir());
        $path = self::base_dir() . '/' . ltrim($asset['relative_path'], '/');
        $real = realpath($path);
        if ($real && $base && strpos(wp_normalize_path($real), wp_normalize_path($base) . '/') === 0 && is_file($real)) {
            if (!@unlink($real)) {
                return new WP_Error('asset_delete_failed', 'The private asset file could not be deleted.');
            }
        }
        $wpdb->delete($table, array('id' => (int) $asset['id']), array('%d'));
        return true;
    }

    public static function present($asset)
    {
        $asset['id'] = (int) $asset['id'];
        $asset['owner_id'] = (int) $asset['owner_id'];
        $asset['bytes'] = (int) $asset['bytes'];
        $asset['url'] = home_url('/' . SBS_Plugin::studio_slug() . '/asset/' . $asset['uuid'] . '/');
        $asset['metadata'] = !empty($asset['metadata_json']) ? json_decode($asset['metadata_json'], true) : array();
        if (!is_array($asset['metadata'])) {
            $asset['metadata'] = array();
        }
        foreach (array('openai_file_id', 'openai_file_cached_at', 'openai_response_id', 'replicate_prediction_id', 'remote_id') as $private_key) {
            unset($asset['metadata'][$private_key]);
        }
        unset($asset['relative_path'], $asset['metadata_json']);
        return $asset;
    }

    public static function absolute_path($asset)
    {
        $row = is_array($asset) ? $asset : self::get_asset((int) $asset);
        if (!$row) {
            return '';
        }
        if (!empty($row['relative_path'])) {
            return self::base_dir() . '/' . ltrim($row['relative_path'], '/');
        }
        global $wpdb;
        $table = SBS_DB::table('assets');
        $relative = $wpdb->get_var($wpdb->prepare("SELECT relative_path FROM {$table} WHERE id = %d", (int) $row['id']));
        return $relative ? self::base_dir() . '/' . ltrim($relative, '/') : '';
    }

    public static function serve_asset($uuid)
    {
        if (!SBS_Auth::is_authenticated() && !current_user_can('manage_options')) {
            status_header(403);
            exit;
        }
        global $wpdb;
        $table = SBS_DB::table('assets');
        $asset = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE uuid = %s", $uuid), ARRAY_A);
        if (!$asset) {
            status_header(404);
            exit;
        }
        $path = self::base_dir() . '/' . ltrim($asset['relative_path'], '/');
        $real = realpath($path);
        $base = realpath(self::base_dir());
        if (!$real || !$base || strpos(wp_normalize_path($real), wp_normalize_path($base) . '/') !== 0 || !is_readable($real)) {
            status_header(404);
            exit;
        }
        nocache_headers();
        header('X-Content-Type-Options: nosniff');
        header('X-Robots-Tag: noindex, nofollow, noarchive', true);
        header('Content-Type: ' . $asset['mime']);
        header('Content-Length: ' . filesize($real));
        $disposition = in_array($asset['mime'], array('application/zip', 'application/octet-stream'), true) ? 'attachment' : 'inline';
        header('Content-Disposition: ' . $disposition . '; filename="' . rawurlencode($asset['filename']) . '"');
        readfile($real);
        exit;
    }

    public static function allowed_mimes($mimes = null)
    {
        $private_mimes = array(
            'png' => 'image/png',
            'jpg|jpeg|jpe' => 'image/jpeg',
            'webp' => 'image/webp',
            'ttf' => 'font/ttf',
            'otf' => 'font/otf',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'zip' => 'application/zip',
        );
        return is_array($mimes) ? array_merge($mimes, $private_mimes) : $private_mimes;
    }

    public static function data_url($asset_id)
    {
        global $wpdb;
        $table = SBS_DB::table('assets');
        $asset = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", (int) $asset_id), ARRAY_A);
        if (!$asset) {
            return new WP_Error('missing_asset', 'Reference asset not found.');
        }
        $path = self::base_dir() . '/' . ltrim($asset['relative_path'], '/');
        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            return new WP_Error('asset_read_failed', 'Reference asset could not be read.');
        }
        return 'data:' . $asset['mime'] . ';base64,' . base64_encode($bytes);
    }
}
