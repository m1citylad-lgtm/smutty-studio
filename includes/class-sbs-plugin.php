<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Plugin
{
    private static $instance;

    public static function instance()
    {
        if (!self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public static function activate()
    {
        SBS_DB::install();
        SBS_Storage::ensure_directories();
        if (get_option('sbs_studio_slug', null) === null) {
            update_option('sbs_studio_slug', 'smutty-studio', false);
        }
        update_option('sbs_plugin_version', SBS_VERSION, false);
        self::seed_smutty_bear();
        self::register_rewrites();
        flush_rewrite_rules(false);
    }

    public static function deactivate()
    {
        flush_rewrite_rules(false);
    }

    public function boot()
    {
        add_action('init', array(__CLASS__, 'register_rewrites'));
        add_action('init', array(__CLASS__, 'maybe_flush_rewrites'), 99);
        add_filter('query_vars', array($this, 'query_vars'));
        add_action('template_redirect', array($this, 'template_redirect'));
        add_action('rest_api_init', array('SBS_REST', 'register_routes'));
        add_action('admin_menu', array('SBS_Admin', 'register_menu'));
        add_action('admin_init', array('SBS_Admin', 'register_actions'));
        add_action('admin_enqueue_scripts', array('SBS_Admin', 'enqueue'));
        add_action('sbs_cleanup_sessions', array('SBS_Auth', 'cleanup'));
        add_action('sbs_process_export', array('SBS_Portability', 'process_export_job'));
        add_filter('pre_set_site_transient_update_plugins', array('SBS_Updater', 'inject_update'));
        add_filter('upgrader_pre_download', array('SBS_Updater', 'authenticated_download'), 10, 4);
        add_filter('upgrader_pre_install', array('SBS_Updater', 'pre_install_backup'), 10, 2);
        add_action('upgrader_process_complete', array('SBS_Updater', 'process_complete'), 10, 2);
        add_filter('upload_mimes', array('SBS_Storage', 'allowed_mimes'));

        if (!wp_next_scheduled('sbs_cleanup_sessions')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'sbs_cleanup_sessions');
        }

        if (get_option('sbs_db_version') !== SBS_DB_VERSION) {
            SBS_DB::install();
        }
        self::maybe_upgrade_settings();
    }

    public static function register_rewrites()
    {
        $slug = self::studio_slug();
        add_rewrite_rule('^' . preg_quote($slug, '/') . '/?$', 'index.php?sbs_studio=1', 'top');
        add_rewrite_rule('^' . preg_quote($slug, '/') . '/asset/([a-f0-9\-]+)/?$', 'index.php?sbs_asset=$matches[1]', 'top');
    }

    public static function maybe_flush_rewrites()
    {
        if (get_option('sbs_flush_rewrite_rules') !== '1') {
            return;
        }
        flush_rewrite_rules(false);
        delete_option('sbs_flush_rewrite_rules');
    }

    public function query_vars($vars)
    {
        $vars[] = 'sbs_studio';
        $vars[] = 'sbs_asset';
        return $vars;
    }

    public function template_redirect()
    {
        $asset_uuid = get_query_var('sbs_asset');
        if ($asset_uuid) {
            SBS_Storage::serve_asset($asset_uuid);
            exit;
        }

        if (!get_query_var('sbs_studio')) {
            return;
        }

        nocache_headers();
        header('X-Robots-Tag: noindex, nofollow, noarchive', true);
        header('Referrer-Policy: same-origin', true);
        header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:", true);

        wp_enqueue_style('sbs-studio', SBS_PLUGIN_URL . 'assets/css/studio.css', array(), SBS_VERSION);
        wp_enqueue_style('sbs-studio-hierarchy', SBS_PLUGIN_URL . 'assets/css/studio-hierarchy.css', array('sbs-studio'), SBS_VERSION);
        wp_enqueue_script('sbs-fabric', SBS_PLUGIN_URL . 'assets/vendor/fabric.min.js', array(), '5.3.0', true);
        wp_enqueue_script('sbs-studio', SBS_PLUGIN_URL . 'assets/js/studio.js', array('sbs-fabric'), SBS_VERSION, true);

        include SBS_PLUGIN_DIR . 'templates/studio.php';
        exit;
    }

    public static function studio_slug()
    {
        $slug = self::sanitize_studio_slug(get_option('sbs_studio_slug', 'smutty-studio'));
        return $slug ? $slug : 'smutty-studio';
    }

    public static function sanitize_studio_slug($slug)
    {
        $slug = trim((string) $slug, " \t\n\r\0\x0B/");
        $slug = preg_replace('/\s+/', '-', $slug);
        $slug = preg_replace('/[^A-Za-z0-9_-]/', '', $slug);
        return substr($slug, 0, 80);
    }

    private static function maybe_upgrade_settings()
    {
        $installed = (string) get_option('sbs_plugin_version', '');
        if ($installed === SBS_VERSION) {
            return;
        }
        $current_slug = get_option('sbs_studio_slug', null);
        if ($current_slug === null || $current_slug === '' || in_array($current_slug, array('SmuttyBear', 'smuttybear'), true)) {
            update_option('sbs_studio_slug', 'smutty-studio', false);
        }
        if ($installed === '' || version_compare($installed, '0.2.0', '<')) {
            global $wpdb;
            $wpdb->update(SBS_DB::table('pack_versions'), array('status' => 'ready'), array('status' => 'locked'));
            $wpdb->update(SBS_DB::table('packs'), array('status' => 'ready'), array('status' => 'locked'));
            $pack_count = (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . SBS_DB::table('packs'));
            if ($pack_count === 1) {
                $only_version = (int) $wpdb->get_var('SELECT id FROM ' . SBS_DB::table('pack_versions') . ' ORDER BY version DESC LIMIT 1');
                if ($only_version) {
                    $wpdb->query($wpdb->prepare('UPDATE ' . SBS_DB::table('usage') . ' SET pack_version_id = %d WHERE pack_version_id IS NULL', $only_version));
                }
            }
        }
        update_option('sbs_flush_rewrite_rules', '1', false);
        update_option('sbs_plugin_version', SBS_VERSION, false);
    }

    private static function seed_smutty_bear()
    {
        global $wpdb;
        $packs = SBS_DB::table('packs');
        if ((int) $wpdb->get_var("SELECT COUNT(*) FROM {$packs}") > 0) {
            return;
        }

        $now = current_time('mysql', true);
        $pack_uuid = wp_generate_uuid4();
        $wpdb->insert($packs, array(
            'uuid' => $pack_uuid,
            'name' => 'Smutty Bear',
            'description' => 'Cheeky, confident adult anthropomorphic bear in a vintage illustrated style.',
            'status' => 'ready',
            'current_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $pack_id = (int) $wpdb->insert_id;

        $identity = array(
            'schema_version' => 1,
            'name' => 'Smutty Bear',
            'adult' => true,
            'tests_approved' => true,
            'locked_traits' => array(
                'Adult anthropomorphic brown bear with a muscular athletic build',
                'Long, correctly shaped bear muzzle; heavy dark brows; blue-grey eyes',
                'Warm brown textured fur with vintage hand-inked shading',
                'Cheeky, confident grin and expressive face',
                'Brown cap as the main identity look',
                'Open orange and cream floral shirt',
                'Fitted red retro running shorts with cream piping',
                'Full rounded furry tail, never a small round pom-pom',
                'Warm retro printed palette with slight grain and distress',
            ),
            'exclusions' => array(
                'No childlike or ambiguous age presentation',
                'No explicit sexual activity or visible genitals',
                'No grey fur, short muzzle, round ball tail, oversized body fat, or baggy modern shorts',
                'Do not redraw supplied logos or add unrequested text',
                'Avoid photorealism, 3D rendering, anime, or modern vector-flat styling',
            ),
            'humour_boundary' => 'Strong adult innuendo and bawdy visual comedy without explicit sexual imagery.',
            'palette' => array('#9b542e', '#d8783c', '#f3c17c', '#1e1a13', '#df2d17', '#f4e0ad', '#517c91'),
        );

        $versions = SBS_DB::table('pack_versions');
        $version_uuid = wp_generate_uuid4();
        $wpdb->insert($versions, array(
            'uuid' => $version_uuid,
            'pack_id' => $pack_id,
            'version' => 1,
            'status' => 'ready',
            'identity_json' => wp_json_encode($identity),
            'created_at' => $now,
            'locked_at' => null,
        ));
        $version_id = (int) $wpdb->insert_id;

        $source = SBS_PLUGIN_DIR . 'assets/reference/smutty-bear-character-sheet.jpeg';
        if (is_readable($source)) {
            SBS_Storage::import_bundled_asset($source, 'pack_version', $version_id, 'master_reference', 'Smutty Bear character and brand reference sheet');
            $sheet = file_get_contents($source);
            $logos = array(
                array('Round badge logo', array('x' => 18, 'y' => 680, 'width' => 190, 'height' => 130)),
                array('Wide brand badge', array('x' => 208, 'y' => 680, 'width' => 385, 'height' => 110)),
                array('Website banner', array('x' => 595, 'y' => 680, 'width' => 265, 'height' => 105)),
            );
            foreach ($logos as $logo) {
                SBS_Storage::store_bytes($sheet, 'smutty-bear-logo-source.jpeg', 'image/jpeg', 'pack_version', $version_id, 'logo', $logo[0], array('exact_use' => true, 'crop' => $logo[1], 'source' => 'authoritative_character_sheet'));
            }
        }
    }
}
