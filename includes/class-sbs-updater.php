<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Updater
{
    const SLUG = 'smutty-bear-studio';
    private static $handling_completion = false;

    public static function verify_package($path, $allow_downgrade = false)
    {
        if (!class_exists('ZipArchive')) {
            return new WP_Error('zip_unavailable', 'ZipArchive is required to verify update packages.');
        }
        if (!function_exists('openssl_verify')) {
            return new WP_Error('signature_unavailable', 'The PHP OpenSSL extension is required to verify update signatures.');
        }
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return new WP_Error('invalid_package', 'The update ZIP could not be opened.');
        }
        if ($zip->numFiles < 3 || $zip->numFiles > 5000) {
            $zip->close();
            return new WP_Error('invalid_package_entries', 'The update package contains an invalid number of entries.');
        }
        $prefix = self::SLUG . '/';
        $archive_files = array();
        $archive_uncompressed_bytes = 0;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entry = $zip->getNameIndex($i);
            if (strlen((string) $entry) > 500 || !self::safe_zip_path($entry) || strpos($entry, $prefix) !== 0) {
                $zip->close();
                return new WP_Error('unsafe_package', 'The update package contains an unexpected or unsafe path.');
            }
            $stat = $zip->statIndex($i);
            $entry_bytes = is_array($stat) && isset($stat['size']) ? (int) $stat['size'] : 0;
            $archive_uncompressed_bytes += $entry_bytes;
            if ($entry_bytes > 100 * MB_IN_BYTES || $archive_uncompressed_bytes > 250 * MB_IN_BYTES) {
                $zip->close();
                return new WP_Error('package_too_large', 'The update package expands beyond the permitted size.');
            }
            if (method_exists($zip, 'getExternalAttributesIndex')) {
                $opsys = 0;
                $attributes = 0;
                if ($zip->getExternalAttributesIndex($i, $opsys, $attributes) && (($attributes >> 16) & 0170000) === 0120000) {
                    $zip->close();
                    return new WP_Error('unsafe_package_link', 'The update package may not contain symbolic links.');
                }
            }
            if (substr($entry, -1) !== '/') {
                $archive_files[] = substr($entry, strlen($prefix));
            }
        }
        $manifest_stat = $zip->statName($prefix . 'release.json');
        $signature_stat = $zip->statName($prefix . 'release.sig');
        if (!$manifest_stat || !$signature_stat || (int) $manifest_stat['size'] > MB_IN_BYTES || (int) $signature_stat['size'] > 16 * KB_IN_BYTES) {
            $zip->close();
            return new WP_Error('invalid_manifest_size', 'The release manifest or signature has an invalid size.');
        }
        $manifest_raw = $zip->getFromName($prefix . 'release.json');
        $signature_raw = $zip->getFromName($prefix . 'release.sig');
        $manifest = json_decode($manifest_raw, true);
        $signature = base64_decode(trim((string) $signature_raw), true);
        if (!$manifest || $signature === false || ($manifest['slug'] ?? '') !== self::SLUG || empty($manifest['key_id']) || empty($manifest['version']) || !preg_match('/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/', $manifest['version'])) {
            $zip->close();
            return new WP_Error('invalid_manifest', 'The release manifest is missing or invalid.');
        }
        $keys = self::public_keys();
        if (empty($keys[$manifest['key_id']])) {
            $zip->close();
            return new WP_Error('unknown_signing_key', 'The package was signed with an untrusted key.');
        }
        if (openssl_verify($manifest_raw, $signature, $keys[$manifest['key_id']], OPENSSL_ALGO_SHA256) !== 1) {
            $zip->close();
            return new WP_Error('signature_failed', 'The update signature is invalid.');
        }
        foreach ((array) ($manifest['files'] ?? array()) as $relative => $expected_hash) {
            if (!self::safe_zip_path($relative) || in_array($relative, array('release.json', 'release.sig'), true)) {
                $zip->close();
                return new WP_Error('invalid_file_manifest', 'The release file manifest is invalid.');
            }
            $bytes = $zip->getFromName($prefix . $relative);
            if ($bytes === false || !hash_equals((string) $expected_hash, hash('sha256', $bytes))) {
                $zip->close();
                return new WP_Error('package_checksum_failed', 'An update file failed checksum validation: ' . sanitize_text_field($relative));
            }
        }
        $listed_files = array_keys((array) ($manifest['files'] ?? array()));
        $listed_files[] = 'release.json';
        $listed_files[] = 'release.sig';
        sort($listed_files);
        sort($archive_files);
        if ($archive_files !== $listed_files || !isset($manifest['files']['smutty-bear-studio.php'])) {
            $zip->close();
            return new WP_Error('unexpected_package_files', 'The update package file list does not exactly match its signed manifest.');
        }
        $zip->close();
        if (version_compare(PHP_VERSION, (string) ($manifest['requires_php'] ?? '7.4'), '<')) {
            return new WP_Error('php_incompatible', 'This update requires PHP ' . sanitize_text_field($manifest['requires_php']) . ' or later.');
        }
        global $wp_version;
        if (version_compare($wp_version, (string) ($manifest['requires_wp'] ?? '5.8.17'), '<')) {
            return new WP_Error('wp_incompatible', 'This update requires WordPress ' . sanitize_text_field($manifest['requires_wp']) . ' or later.');
        }
        if (!$allow_downgrade && version_compare((string) $manifest['version'], SBS_VERSION, '<=')) {
            return new WP_Error('not_newer', 'The uploaded release is not newer than the installed version.');
        }
        $free = @disk_free_space(WP_CONTENT_DIR);
        if ($free !== false && $free < (filesize($path) * 3 + 20 * MB_IN_BYTES)) {
            return new WP_Error('insufficient_disk_space', 'There is not enough free disk space to stage, back up and install this update safely.');
        }
        return $manifest;
    }

    public static function install_uploaded($path, $allow_downgrade = false)
    {
        $verified = self::verify_package($path, $allow_downgrade);
        if (is_wp_error($verified)) {
            return $verified;
        }
        if (!self::acquire_operation_lock()) {
            return new WP_Error('update_busy', 'Another update or rollback is already running. Try again after it finishes.');
        }
        try {
            return self::install_verified_package($path, $verified);
        } finally {
            self::release_operation_lock();
        }
    }

    private static function install_verified_package($path, $verified)
    {
        $backup = self::create_backup();
        if (is_wp_error($backup)) {
            return $backup;
        }
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $skin = new Automatic_Upgrader_Skin();
        $upgrader = new Plugin_Upgrader($skin);
        $result = $upgrader->install($path, array('overwrite_package' => true));
        if (is_wp_error($result) || !$result) {
            self::restore_backup($backup);
            return is_wp_error($result) ? $result : new WP_Error('update_failed', 'WordPress could not install the verified update.');
        }
        if (!self::installed_version_is((string) $verified['version'])) {
            self::restore_backup($backup);
            return new WP_Error('health_check_failed', 'The updated plugin failed its version/file health check and was rolled back.');
        }
        if (!is_plugin_active(SBS_PLUGIN_BASENAME)) {
            $activated = activate_plugin(SBS_PLUGIN_BASENAME);
            if (is_wp_error($activated)) {
                self::restore_backup($backup);
                activate_plugin(SBS_PLUGIN_BASENAME);
                return new WP_Error('activation_failed', 'The update could not be activated and was rolled back.');
            }
        }
        self::prune_backups();
        delete_site_transient('update_plugins');
        delete_transient('sbs_release_feed');
        return array('installed' => true, 'version' => $verified['version'], 'backup' => basename($backup));
    }

    public static function pre_install_backup($response, $hook_extra)
    {
        if (is_wp_error($response) || !self::is_our_update($hook_extra) || get_transient('sbs_update_backup_path')) {
            return $response;
        }
        $backup = self::create_backup();
        if (is_wp_error($backup)) {
            return $backup;
        }
        set_transient('sbs_update_backup_path', $backup, HOUR_IN_SECONDS);
        return $response;
    }

    public static function process_complete($upgrader, $hook_extra)
    {
        if (self::$handling_completion || !self::is_our_update($hook_extra)) {
            return;
        }
        $backup = get_transient('sbs_update_backup_path');
        delete_transient('sbs_update_backup_path');
        $expected = (string) get_transient('sbs_update_expected_version');
        delete_transient('sbs_update_expected_version');
        if ($expected && !self::installed_version_is($expected) && $backup && is_readable($backup)) {
            self::$handling_completion = true;
            self::restore_backup($backup);
            self::$handling_completion = false;
            update_option('sbs_update_health_notice', 'The update failed its post-install health check and the previous plugin package was restored.', false);
            return;
        }
        self::prune_backups();
    }

    public static function create_backup()
    {
        if (!class_exists('ZipArchive')) {
            return new WP_Error('zip_unavailable', 'ZipArchive is required to back up the current plugin.');
        }
        SBS_Storage::ensure_directories();
        $source = untrailingslashit(SBS_PLUGIN_DIR);
        $path = SBS_Storage::base_dir() . '/updates/backups/' . self::SLUG . '-' . SBS_VERSION . '-' . gmdate('Ymd-His') . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return new WP_Error('backup_failed', 'Could not create the pre-update backup.');
        }
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $relative = self::SLUG . '/' . ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($source))), '/');
                $zip->addFile($file->getPathname(), $relative);
            }
        }
        $zip->close();
        return is_readable($path) ? $path : new WP_Error('backup_failed', 'The pre-update backup was not created.');
    }

    public static function backups()
    {
        $files = glob(SBS_Storage::base_dir() . '/updates/backups/' . self::SLUG . '-*.zip');
        if (!$files) {
            return array();
        }
        usort($files, function ($a, $b) { return filemtime($b) - filemtime($a); });
        return array_map(function ($path) {
            return array('name' => basename($path), 'bytes' => filesize($path), 'created_at' => gmdate('c', filemtime($path)));
        }, $files);
    }

    public static function rollback($name)
    {
        $name = basename($name);
        $path = SBS_Storage::base_dir() . '/updates/backups/' . $name;
        if (!preg_match('/^' . preg_quote(self::SLUG, '/') . '-.+\.zip$/', $name) || !is_readable($path)) {
            return new WP_Error('missing_backup', 'The selected rollback package was not found.');
        }
        $result = self::install_uploaded($path, true);
        if (is_wp_error($result)) {
            return $result;
        }
        return array('rolled_back' => true, 'package' => $name, 'version' => $result['version']);
    }

    public static function install_feed_release()
    {
        $release = self::release_feed(true);
        if (is_wp_error($release)) {
            return $release;
        }
        if (!$release) {
            return new WP_Error('feed_not_configured', 'No private release feed is configured.');
        }
        if (empty($release['version']) || version_compare((string) $release['version'], SBS_VERSION, '<=')) {
            return new WP_Error('no_update_available', 'The release feed does not contain a newer version.');
        }
        $tmp = self::download_release_package($release);
        if (is_wp_error($tmp)) {
            return $tmp;
        }
        $result = self::install_uploaded($tmp, false);
        @unlink($tmp);
        return $result;
    }

    public static function inject_update($transient)
    {
        if (!is_object($transient)) {
            $transient = new stdClass();
        }
        $release = self::release_feed();
        if (is_wp_error($release) || !$release || version_compare((string) $release['version'], SBS_VERSION, '<=')) {
            return $transient;
        }
        $item = new stdClass();
        $item->id = 'private:' . self::SLUG;
        $item->slug = self::SLUG;
        $item->plugin = SBS_PLUGIN_BASENAME;
        $item->new_version = $release['version'];
        $item->url = isset($release['homepage']) ? $release['homepage'] : '';
        $item->package = $release['package_url'];
        $item->requires = isset($release['requires_wp']) ? $release['requires_wp'] : '5.8.17';
        $item->requires_php = isset($release['requires_php']) ? $release['requires_php'] : '7.4';
        $item->tested = isset($release['tested']) ? $release['tested'] : '5.8.17';
        $transient->response[SBS_PLUGIN_BASENAME] = $item;
        return $transient;
    }

    public static function authenticated_download($reply, $package, $upgrader, $hook_extra)
    {
        if ($reply !== false || empty($hook_extra['plugin']) || $hook_extra['plugin'] !== SBS_PLUGIN_BASENAME) {
            return $reply;
        }
        $release = self::release_feed();
        if (is_wp_error($release) || empty($release['package_url']) || !hash_equals($release['package_url'], $package)) {
            return $reply;
        }
        $tmp = self::download_release_package($release);
        if (is_wp_error($tmp)) {
            return $tmp;
        }
        $verified = self::verify_package($tmp, false);
        if (is_wp_error($verified)) {
            @unlink($tmp);
            return $verified;
        }
        set_transient('sbs_update_expected_version', (string) $verified['version'], HOUR_IN_SECONDS);
        return $tmp;
    }

    public static function release_feed($force = false)
    {
        $url = trim((string) get_option('sbs_update_feed_url', ''));
        if (!$url || !wp_http_validate_url($url) || strtolower((string) wp_parse_url($url, PHP_URL_SCHEME)) !== 'https') {
            return null;
        }
        if (!$force) {
            $cached = get_transient('sbs_release_feed');
            if (is_array($cached)) {
                return $cached;
            }
        }
        $headers = array();
        $token = SBS_Crypto::setting('SBS_UPDATE_FEED_TOKEN', 'sbs_update_feed_token');
        if ($token) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }
        $response = wp_safe_remote_get($url, array('timeout' => 20, 'redirection' => 2, 'headers' => $headers, 'limit_response_size' => MB_IN_BYTES));
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            return new WP_Error('feed_unavailable', 'The private release feed is unavailable.');
        }
        $envelope = json_decode(wp_remote_retrieve_body($response), true);
        if (!$envelope || empty($envelope['signed']) || empty($envelope['signature']) || empty($envelope['key_id'])) {
            return new WP_Error('invalid_feed', 'The private release feed is invalid.');
        }
        $signed = base64_decode($envelope['signed'], true);
        $signature = base64_decode($envelope['signature'], true);
        $keys = self::public_keys();
        if ($signed === false || $signature === false || empty($keys[$envelope['key_id']]) || !function_exists('openssl_verify') || openssl_verify($signed, $signature, $keys[$envelope['key_id']], OPENSSL_ALGO_SHA256) !== 1) {
            return new WP_Error('feed_signature_failed', 'The private release feed signature is invalid.');
        }
        $release = json_decode($signed, true);
        if (!$release || ($release['slug'] ?? '') !== self::SLUG || empty($release['version']) || !preg_match('/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/', (string) $release['version']) || empty($release['package_url']) || !wp_http_validate_url($release['package_url']) || strtolower((string) wp_parse_url($release['package_url'], PHP_URL_SCHEME)) !== 'https' || (!empty($release['package_sha256']) && !preg_match('/^[a-f0-9]{64}$/i', (string) $release['package_sha256']))) {
            return new WP_Error('invalid_feed_release', 'The signed release record is invalid.');
        }
        set_transient('sbs_release_feed', $release, 6 * HOUR_IN_SECONDS);
        return $release;
    }

    public static function public_keys()
    {
        $keys = file_exists(SBS_PLUGIN_DIR . 'config/update-public-keys.php') ? include SBS_PLUGIN_DIR . 'config/update-public-keys.php' : array();
        if (defined('SBS_UPDATE_PUBLIC_KEYS') && is_array(SBS_UPDATE_PUBLIC_KEYS)) {
            $keys = array_merge($keys, SBS_UPDATE_PUBLIC_KEYS);
        }
        return is_array($keys) ? $keys : array();
    }

    public static function audit($action, $status, $details = array())
    {
        $rows = get_option('sbs_update_audit', array());
        $rows = is_array($rows) ? $rows : array();
        array_unshift($rows, array(
            'created_at' => gmdate('c'),
            'action' => sanitize_key($action),
            'status' => sanitize_key($status),
            'details' => is_array($details) ? array_map('sanitize_text_field', $details) : array(),
            'client_hash' => hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|' . wp_salt('logged_in')),
        ));
        update_option('sbs_update_audit', array_slice($rows, 0, 50), false);
    }

    public static function audit_records($limit = 10)
    {
        $rows = get_option('sbs_update_audit', array());
        return array_slice(is_array($rows) ? $rows : array(), 0, max(1, min(50, (int) $limit)));
    }

    private static function download_release_package($release)
    {
        $package_url = !empty($release['package_url']) ? (string) $release['package_url'] : '';
        if (!$package_url || !wp_http_validate_url($package_url) || strtolower((string) wp_parse_url($package_url, PHP_URL_SCHEME)) !== 'https') {
            return new WP_Error('invalid_package_url', 'The signed release has an invalid package URL.');
        }
        $headers = array();
        $token = SBS_Crypto::setting('SBS_UPDATE_FEED_TOKEN', 'sbs_update_feed_token');
        if ($token) {
            $headers['Authorization'] = 'Bearer ' . $token;
        }
        $tmp = wp_tempnam(self::SLUG . '.zip');
        if (!$tmp) {
            return new WP_Error('update_temp_failed', 'Temporary storage is unavailable for the update package.');
        }
        $response = wp_safe_remote_get($package_url, array('timeout' => 120, 'redirection' => 2, 'headers' => $headers, 'stream' => true, 'filename' => $tmp, 'limit_response_size' => 100 * MB_IN_BYTES));
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            @unlink($tmp);
            return new WP_Error('update_download_failed', 'The signed update package could not be downloaded.');
        }
        if (!is_readable($tmp) || filesize($tmp) <= 0 || filesize($tmp) > 100 * MB_IN_BYTES) {
            @unlink($tmp);
            return new WP_Error('invalid_package_size', 'The downloaded update package is empty or exceeds 100 MB.');
        }
        if (!empty($release['package_sha256']) && !hash_equals(strtolower((string) $release['package_sha256']), hash_file('sha256', $tmp))) {
            @unlink($tmp);
            return new WP_Error('download_checksum_failed', 'The downloaded update package failed checksum validation.');
        }
        return $tmp;
    }

    private static function acquire_operation_lock()
    {
        $option = 'sbs_update_operation_lock';
        $existing = (int) get_option($option, 0);
        if ($existing && $existing > time() - (30 * MINUTE_IN_SECONDS)) {
            return false;
        }
        if ($existing) {
            delete_option($option);
        }
        return add_option($option, time(), '', 'no');
    }

    private static function release_operation_lock()
    {
        delete_option('sbs_update_operation_lock');
    }

    private static function restore_backup($path)
    {
        if (!is_readable($path)) {
            return false;
        }
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
        return $upgrader->install($path, array('overwrite_package' => true));
    }

    private static function installed_version_is($expected)
    {
        $main = WP_PLUGIN_DIR . '/' . self::SLUG . '/smutty-bear-studio.php';
        if (!is_readable($main)) {
            return false;
        }
        if (!function_exists('get_plugin_data')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $data = get_plugin_data($main, false, false);
        return !empty($data['Version']) && version_compare((string) $data['Version'], $expected, '==');
    }

    private static function is_our_update($hook_extra)
    {
        if (!is_array($hook_extra) || ($hook_extra['type'] ?? '') !== 'plugin') {
            return false;
        }
        if (!empty($hook_extra['plugin']) && $hook_extra['plugin'] === SBS_PLUGIN_BASENAME) {
            return true;
        }
        return !empty($hook_extra['plugins']) && in_array(SBS_PLUGIN_BASENAME, (array) $hook_extra['plugins'], true);
    }

    private static function prune_backups()
    {
        $backups = self::backups();
        foreach (array_slice($backups, 3) as $backup) {
            @unlink(SBS_Storage::base_dir() . '/updates/backups/' . $backup['name']);
        }
    }

    private static function safe_zip_path($path)
    {
        $path = str_replace('\\', '/', (string) $path);
        return $path !== '' && strpos($path, "\0") === false && strpos($path, '../') === false && !preg_match('#^(?:[A-Za-z]:|/)#', $path);
    }
}
