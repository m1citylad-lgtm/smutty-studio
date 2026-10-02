<?php

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

wp_clear_scheduled_hook('sbs_cleanup_sessions');
wp_clear_scheduled_hook('sbs_process_export');
delete_transient('sbs_release_feed');

global $wpdb;
$sessions = $wpdb->prefix . 'sbs_sessions';
$wpdb->query("DELETE FROM {$sessions}");

// Character packs, projects, private assets and encrypted settings are retained
// intentionally so reinstalling the plugin cannot destroy a creative workspace.
