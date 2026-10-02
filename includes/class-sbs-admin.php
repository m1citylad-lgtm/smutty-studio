<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Admin
{
    public static function register_menu()
    {
        add_menu_page('Smutty Bear Studio', 'Smutty Bear Studio', 'manage_options', 'smutty-bear-studio', array(__CLASS__, 'render'), 'dashicons-art', 58);
    }

    public static function register_actions()
    {
        add_action('admin_post_sbs_save_settings', array(__CLASS__, 'save_settings'));
        add_action('admin_post_sbs_install_update', array(__CLASS__, 'install_update'));
        add_action('admin_post_sbs_rollback', array(__CLASS__, 'rollback'));
        add_action('admin_post_sbs_export', array(__CLASS__, 'export_workspace'));
        add_action('admin_post_sbs_import', array(__CLASS__, 'import_workspace'));
    }

    public static function enqueue($hook)
    {
        if ($hook !== 'toplevel_page_smutty-bear-studio') {
            return;
        }
        wp_enqueue_style('sbs-admin', SBS_PLUGIN_URL . 'assets/css/admin.css', array(), SBS_VERSION);
    }

    public static function render()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $tab = isset($_GET['tab']) ? sanitize_key(wp_unslash($_GET['tab'])) : 'settings';
        $tabs = array('settings' => 'Settings', 'updates' => 'Updates', 'portability' => 'Portability', 'diagnostics' => 'Diagnostics');
        echo '<div class="wrap sbs-admin"><h1>Smutty Bear Creative Studio</h1><nav class="nav-tab-wrapper">';
        foreach ($tabs as $key => $label) {
            echo '<a class="nav-tab ' . ($tab === $key ? 'nav-tab-active' : '') . '" href="' . esc_url(admin_url('admin.php?page=smutty-bear-studio&tab=' . $key)) . '">' . esc_html($label) . '</a>';
        }
        echo '</nav>';
        self::notice();
        if ($tab === 'updates') {
            self::updates_tab();
        } elseif ($tab === 'portability') {
            self::portability_tab();
        } elseif ($tab === 'diagnostics') {
            self::diagnostics_tab();
        } else {
            self::settings_tab();
        }
        echo '</div>';
    }

    public static function save_settings()
    {
        self::guard('sbs_save_settings');
        $old_slug = SBS_Plugin::studio_slug();
        update_option('sbs_studio_slug', SBS_Plugin::sanitize_studio_slug(wp_unslash($_POST['studio_slug'] ?? 'smutty-studio')), false);
        update_option('sbs_text_model', sanitize_text_field(wp_unslash($_POST['text_model'] ?? 'gpt-6-astra')), false);
        update_option('sbs_image_model', sanitize_text_field(wp_unslash($_POST['image_model'] ?? 'gpt-image-2.5-sunburst')), false);
        update_option('sbs_replicate_model_version', sanitize_text_field(wp_unslash($_POST['replicate_model_version'] ?? SBS_Replicate::DEFAULT_VERSION)), false);
        update_option('sbs_replicate_cost_per_image', (string) max(0, (float) ($_POST['replicate_cost'] ?? 0.002)), false);
        $feed_url = esc_url_raw(wp_unslash($_POST['update_feed_url'] ?? ''));
        if ($feed_url && strtolower((string) wp_parse_url($feed_url, PHP_URL_SCHEME)) !== 'https') {
            self::redirect('settings', 'error', 'The private update feed must use HTTPS.');
        }
        update_option('sbs_update_feed_url', $feed_url, false);
        foreach (array('openai_api_key' => 'sbs_openai_api_key', 'replicate_api_token' => 'sbs_replicate_api_token', 'update_feed_token' => 'sbs_update_feed_token') as $field => $option) {
            $value = trim((string) wp_unslash($_POST[$field] ?? ''));
            if ($value !== '') {
                $encrypted = SBS_Crypto::encrypt($value);
                if ($encrypted) {
                    update_option($option, $encrypted, false);
                } else {
                    self::redirect('settings', 'error', 'OpenSSL AES-GCM is required before API credentials can be stored.');
                }
            }
        }
        $password = (string) wp_unslash($_POST['studio_password'] ?? '');
        if ($password !== '') {
            $result = SBS_Auth::set_password($password);
            if (is_wp_error($result)) {
                self::redirect('settings', 'error', $result->get_error_message());
            }
        }
        if ($old_slug !== SBS_Plugin::studio_slug()) {
            flush_rewrite_rules(false);
        }
        delete_transient('sbs_release_feed');
        self::redirect('settings', 'success', 'Settings saved.');
    }

    public static function install_update()
    {
        self::guard('sbs_install_update');
        if (empty($_FILES['release_zip']['tmp_name']) || !is_uploaded_file($_FILES['release_zip']['tmp_name'])) {
            self::redirect('updates', 'error', 'Choose a signed release ZIP.');
        }
        $result = SBS_Updater::install_uploaded($_FILES['release_zip']['tmp_name'], false);
        SBS_Updater::audit('admin_install_upload', is_wp_error($result) ? 'failed' : 'success', is_wp_error($result) ? array('reason' => $result->get_error_code()) : array('version' => $result['version']));
        self::redirect('updates', is_wp_error($result) ? 'error' : 'success', is_wp_error($result) ? $result->get_error_message() : 'The signed update was installed.');
    }

    public static function rollback()
    {
        self::guard('sbs_rollback');
        $backup = sanitize_file_name(wp_unslash($_POST['backup'] ?? ''));
        $result = SBS_Updater::rollback($backup);
        SBS_Updater::audit('admin_rollback', is_wp_error($result) ? 'failed' : 'success', is_wp_error($result) ? array('reason' => $result->get_error_code()) : array('package' => $backup, 'version' => $result['version']));
        self::redirect('updates', is_wp_error($result) ? 'error' : 'success', is_wp_error($result) ? $result->get_error_message() : 'The selected plugin backup was restored.');
    }

    public static function export_workspace()
    {
        self::guard('sbs_export');
        $scope = isset($_POST['export_scope']) && $_POST['export_scope'] === 'project' ? 'project' : 'workspace';
        $project_uuid = sanitize_text_field(wp_unslash($_POST['project_uuid'] ?? ''));
        $job = SBS_Portability::queue_export($scope, $project_uuid);
        if (is_wp_error($job)) {
            self::redirect('portability', 'error', $job->get_error_message());
        }
        self::redirect('portability', 'success', 'The export was queued. Its progress and download will appear below.');
    }

    public static function import_workspace()
    {
        self::guard('sbs_import');
        if (empty($_FILES['workspace_zip']['tmp_name']) || !is_uploaded_file($_FILES['workspace_zip']['tmp_name'])) {
            self::redirect('portability', 'error', 'Choose a portable workspace ZIP.');
        }
        $result = SBS_Portability::import_archive($_FILES['workspace_zip']['tmp_name']);
        self::redirect('portability', is_wp_error($result) ? 'error' : 'success', is_wp_error($result) ? $result->get_error_message() : 'Workspace imported successfully. API keys and passwords were not changed.');
    }

    private static function settings_tab()
    {
        $studio_url = home_url('/' . SBS_Plugin::studio_slug() . '/');
        echo '<div class="sbs-card"><h2>Studio access</h2><p><a href="' . esc_url($studio_url) . '" target="_blank" rel="noopener">Open the private studio</a></p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('sbs_save_settings');
        echo '<input type="hidden" name="action" value="sbs_save_settings"><table class="form-table"><tbody>';
        self::field('Studio URL slug', 'studio_slug', SBS_Plugin::studio_slug(), 'text', 'The isolated studio route.');
        self::field('New shared password', 'studio_password', '', 'password', 'Leave blank to keep the current password. Minimum eight characters.');
        self::field('OpenAI API key', 'openai_api_key', '', 'password', SBS_OpenAI::is_configured() ? 'Configured. Leave blank to keep it.' : 'Required for concepts and image generation.');
        self::field('Text model', 'text_model', get_option('sbs_text_model', 'gpt-6-astra'), 'text', 'Default: gpt-6-astra');
        self::field('Image model', 'image_model', get_option('sbs_image_model', 'gpt-image-2.5-sunburst'), 'text', 'Default: gpt-image-2.5-sunburst');
        self::field('Replicate API token', 'replicate_api_token', '', 'password', SBS_Replicate::is_configured() ? 'Configured. Leave blank to keep it.' : 'Optional; enables AI upscaling.');
        self::field('Replicate model version', 'replicate_model_version', get_option('sbs_replicate_model_version', SBS_Replicate::DEFAULT_VERSION), 'text', 'Pinned Real-ESRGAN version.');
        self::field('Estimated upscale cost (USD)', 'replicate_cost', get_option('sbs_replicate_cost_per_image', '0.002'), 'number', 'Used only for the local usage-derived ledger.');
        self::field('Private update-feed URL', 'update_feed_url', get_option('sbs_update_feed_url', ''), 'url', 'Optional signed HTTPS feed.');
        self::field('Update-feed bearer token', 'update_feed_token', '', 'password', SBS_Crypto::setting('SBS_UPDATE_FEED_TOKEN', 'sbs_update_feed_token') ? 'Configured. Leave blank to keep it.' : 'Optional.');
        echo '</tbody></table>'; submit_button('Save settings'); echo '</form></div>';
    }

    private static function updates_tab()
    {
        echo '<div class="sbs-grid"><section class="sbs-card"><h2>Install signed update</h2><p>Upload the release ZIP produced by the repository build tool. It is verified and backed up before WordPress replaces the plugin.</p><form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('sbs_install_update');
        echo '<input type="hidden" name="action" value="sbs_install_update"><input type="file" name="release_zip" accept=".zip" required>';
        submit_button('Verify and install', 'primary'); echo '</form></section><section class="sbs-card"><h2>Rollback</h2>';
        $backups = SBS_Updater::backups();
        if (!$backups) {
            echo '<p>No update backups are available yet.</p>';
        } else {
            echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">'; wp_nonce_field('sbs_rollback');
            echo '<input type="hidden" name="action" value="sbs_rollback"><select name="backup">';
            foreach ($backups as $backup) {
                echo '<option value="' . esc_attr($backup['name']) . '">' . esc_html($backup['name'] . ' — ' . size_format($backup['bytes'])) . '</option>';
            }
            echo '</select>'; submit_button('Restore selected backup', 'secondary'); echo '</form>';
        }
        echo '</section></div><div class="sbs-card"><h2>Release feed</h2><p>The optional signed feed is configured under Settings. When a newer verified release is published, it appears on the normal WordPress Plugins screen and in the Studio Updates area.</p><p><strong>Installed version:</strong> ' . esc_html(SBS_VERSION) . '</p><p><strong>Trusted signing keys:</strong> ' . count(SBS_Updater::public_keys()) . '</p><p><strong>Studio update access:</strong> Re-enter the shared Studio password for a short-lived update session.</p></div>';
    }

    private static function portability_tab()
    {
        echo '<div class="sbs-grid"><section class="sbs-card"><h2>Export workspace</h2><p>Downloads packs, references, projects, generations, canvases, fonts, and safe settings. Passwords, sessions, API credentials, feed credentials, and remote provider IDs are excluded.</p><form method="post" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('sbs_export'); echo '<input type="hidden" name="action" value="sbs_export"><p><label>Scope <select name="export_scope"><option value="workspace">Full workspace</option><option value="project">Selected project</option></select></label></p><p><label>Project <select name="project_uuid"><option value="">Choose for selective export</option>';
        global $wpdb;
        $projects = $wpdb->get_results('SELECT uuid, title FROM ' . SBS_DB::table('projects') . ' ORDER BY updated_at DESC', ARRAY_A);
        foreach ($projects as $project) {
            echo '<option value="' . esc_attr($project['uuid']) . '">' . esc_html($project['title']) . '</option>';
        }
        echo '</select></label></p>'; submit_button('Build portable archive'); echo '</form></section>';
        echo '<section class="sbs-card"><h2>Import workspace</h2><p>Validates paths and checksums, stages records, and preserves conflicting local content as separate versions.</p><form method="post" enctype="multipart/form-data" action="' . esc_url(admin_url('admin-post.php')) . '">';
        wp_nonce_field('sbs_import'); echo '<input type="hidden" name="action" value="sbs_import"><input type="file" name="workspace_zip" accept=".zip" required>'; submit_button('Validate and import'); echo '</form></section></div>';
        $jobs = $wpdb->get_results("SELECT * FROM " . SBS_DB::table('jobs') . " WHERE type = 'export' ORDER BY created_at DESC LIMIT 10", ARRAY_A);
        $storage = $wpdb->get_row('SELECT COUNT(*) AS files, COALESCE(SUM(bytes),0) AS bytes FROM ' . SBS_DB::table('assets'), ARRAY_A);
        echo '<div class="sbs-card"><h2>Recent exports</h2><p><strong>Private storage:</strong> ' . esc_html(size_format((int) $storage['bytes'])) . ' across ' . (int) $storage['files'] . ' files. Creative content is retained until explicitly removed.</p><table class="widefat striped"><thead><tr><th>Created</th><th>Status</th><th>Progress</th><th>Download</th></tr></thead><tbody>';
        if (!$jobs) {
            echo '<tr><td colspan="4">No exports have been built yet.</td></tr>';
        }
        foreach ($jobs as $job) {
            $result = json_decode($job['result_json'], true);
            $download = '';
            if ($job['status'] === 'completed' && !empty($result['asset_uuid'])) {
                $download = '<a class="button" href="' . esc_url(home_url('/' . SBS_Plugin::studio_slug() . '/asset/' . $result['asset_uuid'] . '/')) . '">Download ZIP</a>';
            }
            echo '<tr><td>' . esc_html($job['created_at']) . '</td><td>' . esc_html($job['status']) . '</td><td>' . (int) $job['progress'] . '%</td><td>' . $download . '</td></tr>';
        }
        echo '</tbody></table><p><a class="button" href="' . esc_url(admin_url('admin.php?page=smutty-bear-studio&tab=portability')) . '">Refresh progress</a></p></div>';
    }

    private static function diagnostics_tab()
    {
        global $wp_version;
        global $wpdb;
        $loopback = wp_remote_get(home_url('/'), array('timeout' => 5, 'redirection' => 0));
        $private_path = wp_normalize_path(SBS_Storage::base_dir());
        $document_root_real = !empty($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
        $document_root = $document_root_real ? wp_normalize_path($document_root_real) : '';
        $outside_web_root = $document_root && strpos($private_path, trailingslashit($document_root)) !== 0;
        $protected_files = file_exists(SBS_Storage::base_dir() . '/.htaccess') && file_exists(SBS_Storage::base_dir() . '/web.config');
        $table_count = 0;
        foreach (SBS_DB::tables() as $table) {
            if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like(SBS_DB::table($table)))) === SBS_DB::table($table)) {
                $table_count++;
            }
        }
        $checks = array(
            'WordPress 5.8.17 or later' => version_compare($wp_version, '5.8.17', '>='),
            'PHP 7.4 or later' => version_compare(PHP_VERSION, '7.4', '>='),
            'JSON support available' => function_exists('json_encode') && function_exists('json_decode'),
            'cURL or WordPress HTTP transport available' => extension_loaded('curl') || class_exists('WP_Http_Streams'),
            'Private data directory writable' => SBS_Storage::ensure_directories(),
            'Private files outside web root or deny rules present' => $outside_web_root || $protected_files,
            'ZipArchive available' => class_exists('ZipArchive'),
            'OpenSSL AES-GCM available' => function_exists('openssl_encrypt') && in_array('aes-256-gcm', openssl_get_cipher_methods(), true),
            'OpenSSL signature verification available' => function_exists('openssl_verify'),
            'GD or Imagick available' => extension_loaded('gd') || extension_loaded('imagick'),
            'WordPress loopback request succeeds' => !is_wp_error($loopback),
            'Upload limit at least 20 MB' => wp_max_upload_size() >= 20 * MB_IN_BYTES,
            'All plugin data tables present' => $table_count === count(SBS_DB::tables()),
            'OpenAI configured' => SBS_OpenAI::is_configured(),
            'Studio password configured' => SBS_Auth::password_is_set(),
            'At least one trusted update key' => count(SBS_Updater::public_keys()) > 0,
        );
        echo '<div class="sbs-card"><h2>Environment</h2><table class="widefat striped"><tbody>';
        foreach ($checks as $label => $ok) {
            echo '<tr><td>' . esc_html($label) . '</td><td><span class="sbs-status ' . ($ok ? 'ok' : 'bad') . '">' . ($ok ? 'Pass' : 'Needs attention') . '</span></td></tr>';
        }
        echo '</tbody></table><p><strong>Private data path:</strong> <code>' . esc_html(SBS_Storage::base_dir()) . '</code></p><p><strong>Maximum upload:</strong> ' . esc_html(size_format(wp_max_upload_size())) . '</p></div>';
    }

    private static function field($label, $name, $value, $type, $description)
    {
        $step = $type === 'number' ? ' step="0.000001" min="0"' : '';
        echo '<tr><th scope="row"><label for="sbs-' . esc_attr($name) . '">' . esc_html($label) . '</label></th><td><input class="regular-text" id="sbs-' . esc_attr($name) . '" name="' . esc_attr($name) . '" type="' . esc_attr($type) . '" value="' . esc_attr($value) . '"' . $step . ' autocomplete="off"><p class="description">' . esc_html($description) . '</p></td></tr>';
    }

    private static function notice()
    {
        $health_notice = get_option('sbs_update_health_notice', '');
        if ($health_notice) {
            delete_option('sbs_update_health_notice');
            echo '<div class="notice notice-error is-dismissible"><p>' . esc_html($health_notice) . '</p></div>';
        }
        if (empty($_GET['sbs_notice'])) {
            return;
        }
        $type = isset($_GET['sbs_type']) && $_GET['sbs_type'] === 'error' ? 'notice-error' : 'notice-success';
        echo '<div class="notice ' . esc_attr($type) . ' is-dismissible"><p>' . esc_html(wp_unslash($_GET['sbs_notice'])) . '</p></div>';
    }

    private static function guard($nonce)
    {
        if (!current_user_can('manage_options')) {
            wp_die('You do not have permission to manage the studio.', 403);
        }
        check_admin_referer($nonce);
    }

    private static function redirect($tab, $type, $message)
    {
        wp_safe_redirect(add_query_arg(array('page' => 'smutty-bear-studio', 'tab' => $tab, 'sbs_type' => $type, 'sbs_notice' => rawurlencode($message)), admin_url('admin.php')));
        exit;
    }
}
