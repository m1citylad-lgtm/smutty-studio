<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_DB
{
    public static function table($name)
    {
        global $wpdb;
        return $wpdb->prefix . 'sbs_' . $name;
    }

    public static function tables()
    {
        return array('packs', 'pack_versions', 'assets', 'projects', 'generations', 'jobs', 'canvases', 'sessions', 'login_attempts', 'usage');
    }

    public static function install()
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();

        $sql = array();
        $sql[] = 'CREATE TABLE ' . self::table('packs') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            name varchar(190) NOT NULL,
            description text NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'draft',
            current_version int(10) unsigned NOT NULL DEFAULT 1,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), KEY status (status)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('pack_versions') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            pack_id bigint(20) unsigned NOT NULL,
            version int(10) unsigned NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'draft',
            identity_json longtext NOT NULL,
            created_at datetime NOT NULL,
            locked_at datetime NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), UNIQUE KEY pack_version (pack_id,version), KEY status (status)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('assets') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            owner_type varchar(32) NOT NULL,
            owner_id bigint(20) unsigned NOT NULL,
            role varchar(48) NOT NULL,
            label varchar(190) NOT NULL DEFAULT '',
            filename varchar(255) NOT NULL,
            relative_path varchar(500) NOT NULL,
            mime varchar(100) NOT NULL,
            sha256 char(64) NOT NULL,
            bytes bigint(20) unsigned NOT NULL DEFAULT 0,
            metadata_json longtext NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), KEY owner (owner_type,owner_id), KEY role (role), KEY sha256 (sha256)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('projects') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            pack_version_id bigint(20) unsigned NOT NULL,
            title varchar(190) NOT NULL,
            concept_json longtext NULL,
            current_generation_id bigint(20) unsigned NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), KEY pack_version (pack_version_id)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('jobs') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            type varchar(32) NOT NULL,
            status varchar(24) NOT NULL DEFAULT 'queued',
            provider varchar(32) NOT NULL,
            external_id varchar(190) NULL,
            payload_json longtext NOT NULL,
            result_json longtext NULL,
            error_json longtext NULL,
            progress tinyint(3) unsigned NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), KEY status (status), KEY external_id (external_id)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('generations') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            project_id bigint(20) unsigned NOT NULL,
            parent_id bigint(20) unsigned NULL,
            job_id bigint(20) unsigned NULL,
            action varchar(24) NOT NULL,
            provider varchar(32) NOT NULL,
            model varchar(100) NOT NULL,
            prompt longtext NOT NULL,
            revised_prompt longtext NULL,
            refs_json longtext NULL,
            output_asset_id bigint(20) unsigned NULL,
            quality varchar(24) NOT NULL,
            size varchar(32) NOT NULL,
            usage_json longtext NULL,
            cost_estimate decimal(12,6) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), KEY project (project_id), KEY parent (parent_id), KEY job (job_id)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('canvases') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            uuid char(36) NOT NULL,
            project_id bigint(20) unsigned NOT NULL,
            name varchar(190) NOT NULL,
            document_json longtext NOT NULL,
            preview_asset_id bigint(20) unsigned NULL,
            created_at datetime NOT NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY uuid (uuid), KEY project (project_id)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('sessions') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            token_hash char(64) NOT NULL,
            ip_hash char(64) NOT NULL,
            expires_at datetime NOT NULL,
            created_at datetime NOT NULL,
            last_seen_at datetime NOT NULL,
            PRIMARY KEY (id), UNIQUE KEY token_hash (token_hash), KEY expires_at (expires_at)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('login_attempts') . " (
            key_hash char(64) NOT NULL,
            attempts int(10) unsigned NOT NULL DEFAULT 0,
            blocked_until datetime NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY (key_hash), KEY blocked_until (blocked_until)
        ) {$charset};";
        $sql[] = 'CREATE TABLE ' . self::table('usage') . " (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            job_id bigint(20) unsigned NULL,
            pack_version_id bigint(20) unsigned NULL,
            provider varchar(32) NOT NULL,
            metric varchar(64) NOT NULL,
            quantity decimal(20,6) NOT NULL DEFAULT 0,
            unit varchar(32) NOT NULL,
            estimated_cost decimal(12,6) NOT NULL DEFAULT 0,
            currency char(3) NOT NULL DEFAULT 'USD',
            details_json longtext NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY (id), KEY job (job_id), KEY pack_version (pack_version_id), KEY provider (provider), KEY created_at (created_at)
        ) {$charset};";

        foreach ($sql as $statement) {
            dbDelta($statement);
        }
        update_option('sbs_db_version', SBS_DB_VERSION, false);
    }

    public static function row_by_uuid($table, $uuid)
    {
        global $wpdb;
        $name = self::table($table);
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$name} WHERE uuid = %s", $uuid), ARRAY_A);
    }
}
