<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_Portability
{
    const SCHEMA = 1;

    public static function queue_export($scope = 'workspace', $project_uuid = '')
    {
        global $wpdb;
        if (!class_exists('ZipArchive')) {
            return new WP_Error('zip_unavailable', 'The PHP ZipArchive extension is required for exports.', array('status' => 503));
        }
        if ($scope === 'project' && (!$project_uuid || !SBS_DB::row_by_uuid('projects', $project_uuid))) {
            return new WP_Error('missing_export_project', 'Choose a valid project for a selective export.', array('status' => 400));
        }
        $now = current_time('mysql', true);
        $uuid = wp_generate_uuid4();
        $wpdb->insert(SBS_DB::table('jobs'), array(
            'uuid' => $uuid, 'type' => 'export', 'status' => 'queued', 'provider' => 'local', 'external_id' => null,
            'payload_json' => wp_json_encode(array('scope' => $scope === 'project' ? 'project' : 'workspace', 'project_uuid' => sanitize_text_field($project_uuid))), 'result_json' => null, 'error_json' => null,
            'progress' => 0, 'created_at' => $now, 'updated_at' => $now,
        ));
        $id = (int) $wpdb->insert_id;
        wp_schedule_single_event(time(), 'sbs_process_export', array($id));
        spawn_cron();
        return array('id' => $id, 'uuid' => $uuid, 'status' => 'queued');
    }

    public static function process_export_job($job_id)
    {
        global $wpdb;
        $jobs = SBS_DB::table('jobs');
        $job = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$jobs} WHERE id = %d", (int) $job_id), ARRAY_A);
        if (!$job || $job['status'] === 'completed') {
            return;
        }
        $wpdb->update($jobs, array('status' => 'running', 'progress' => 10, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job_id));
        $payload = json_decode($job['payload_json'], true);
        $built = self::build_export((int) $job_id, $payload['scope'] ?? 'workspace', $payload['project_uuid'] ?? '');
        if (is_wp_error($built)) {
            $wpdb->update($jobs, array('status' => 'failed', 'error_json' => wp_json_encode(array('code' => $built->get_error_code(), 'message' => $built->get_error_message())), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job_id));
            return;
        }
        $asset = SBS_Storage::store_file($built, basename($built), 'application/zip', 'job', (int) $job_id, 'export', 'Portable workspace export', array('schema_version' => self::SCHEMA));
        @unlink($built);
        if (is_wp_error($asset)) {
            $wpdb->update($jobs, array('status' => 'failed', 'error_json' => wp_json_encode(array('message' => $asset->get_error_message())), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job_id));
            return;
        }
        $wpdb->update($jobs, array('status' => 'completed', 'result_json' => wp_json_encode(array('asset_uuid' => $asset['uuid'], 'filename' => $asset['filename'])), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job_id));
    }

    public static function build_export($job_id = 0, $scope = 'workspace', $project_uuid = '')
    {
        global $wpdb;
        if (!class_exists('ZipArchive')) {
            return new WP_Error('zip_unavailable', 'The PHP ZipArchive extension is required.');
        }
        SBS_Storage::ensure_directories();
        $filename = 'smutty-bear-workspace-' . gmdate('Ymd-His') . '-' . substr(wp_generate_uuid4(), 0, 8) . '.zip';
        $path = SBS_Storage::base_dir() . '/exports/' . $filename;
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return new WP_Error('export_open_failed', 'Could not create the export archive.');
        }
        $tables = array('packs', 'pack_versions', 'assets', 'projects', 'generations', 'jobs', 'canvases', 'usage');
        $records = array();
        foreach ($tables as $table) {
            $records[$table] = $wpdb->get_results('SELECT * FROM ' . SBS_DB::table($table), ARRAY_A);
        }
        if ($scope === 'project') {
            $records = self::filter_project_records($records, $project_uuid);
            if (is_wp_error($records)) {
                $zip->close();
                @unlink($path);
                return $records;
            }
        }
        foreach ($records['jobs'] as &$job) {
            $job['external_id'] = null;
            if (!in_array($job['status'], array('completed', 'failed', 'blocked', 'cancelled'), true)) {
                $job['status'] = 'cancelled';
            }
            $job['result_json'] = self::scrub_remote_values($job['result_json']);
        }
        unset($job);

        foreach ($records['assets'] as &$asset) {
            $asset['metadata_json'] = self::scrub_asset_metadata($asset['metadata_json']);
        }
        unset($asset);

        $asset_files = array();
        foreach ($records['assets'] as &$asset) {
            $absolute = SBS_Storage::base_dir() . '/' . ltrim($asset['relative_path'], '/');
            if (!is_readable($absolute)) {
                $zip->close();
                @unlink($path);
                return new WP_Error('export_asset_missing', 'A private asset is missing or unreadable: ' . sanitize_text_field($asset['filename']));
            }
            $ext = strtolower(pathinfo($asset['filename'], PATHINFO_EXTENSION));
            $archive_path = 'assets/' . $asset['uuid'] . ($ext ? '.' . preg_replace('/[^a-z0-9]/', '', $ext) : '.bin');
            $zip->addFile($absolute, $archive_path);
            $asset['archive_path'] = $archive_path;
            $asset_files[$archive_path] = array('sha256' => hash_file('sha256', $absolute), 'bytes' => filesize($absolute));
            unset($asset['relative_path']);
        }
        unset($asset);

        $settings = array();
        foreach (array('sbs_studio_slug', 'sbs_text_model', 'sbs_image_model', 'sbs_replicate_model_version', 'sbs_replicate_cost_per_image') as $option) {
            $settings[$option] = get_option($option, null);
        }
        $manifest = array(
            'schema' => 'smutty-bear-portable-archive',
            'schema_version' => self::SCHEMA,
            'plugin_version' => SBS_VERSION,
            'created_at' => gmdate('c'),
            'site' => home_url('/'),
            'scope' => $scope === 'project' ? array('type' => 'project', 'uuid' => $project_uuid) : array('type' => 'workspace'),
            'settings' => $settings,
            'records' => $records,
            'files' => $asset_files,
            'excluded' => array('API credentials', 'studio password', 'sessions', 'login attempts', 'release-feed credentials', 'remote provider IDs'),
        );
        $zip->addFromString('manifest.json', wp_json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $zip->close();
        if (!is_readable($path)) {
            return new WP_Error('export_failed', 'The export archive was not created.');
        }
        return $path;
    }

    public static function import_archive($zip_path)
    {
        global $wpdb;
        if (!class_exists('ZipArchive')) {
            return new WP_Error('zip_unavailable', 'The PHP ZipArchive extension is required.');
        }
        $zip = new ZipArchive();
        if ($zip->open($zip_path) !== true) {
            return new WP_Error('invalid_archive', 'The workspace archive could not be opened.');
        }
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (!self::safe_archive_path($name)) {
                $zip->close();
                return new WP_Error('unsafe_archive', 'The archive contains an unsafe path.');
            }
        }
        $manifest_raw = $zip->getFromName('manifest.json');
        $manifest = json_decode($manifest_raw, true);
        if (!$manifest || ($manifest['schema'] ?? '') !== 'smutty-bear-portable-archive' || (int) ($manifest['schema_version'] ?? 0) !== self::SCHEMA) {
            $zip->close();
            return new WP_Error('unsupported_archive', 'The workspace archive schema is not supported.');
        }
        if (empty($manifest['records']) || !is_array($manifest['records']) || !isset($manifest['records']['assets'])) {
            $zip->close();
            return new WP_Error('invalid_archive_records', 'The workspace archive record set is incomplete.');
        }
        $expected_entries = array('manifest.json');
        $total_bytes = 0;
        foreach ((array) ($manifest['files'] ?? array()) as $name => $details) {
            if (!self::safe_archive_path($name) || strpos($name, 'assets/') !== 0 || !isset($details['sha256'], $details['bytes'])) {
                $zip->close();
                return new WP_Error('invalid_archive_manifest', 'The workspace archive file manifest is invalid.');
            }
            $contents = $zip->getFromName($name);
            if ($contents === false || strlen($contents) !== (int) $details['bytes'] || !hash_equals((string) $details['sha256'], hash('sha256', $contents))) {
                $zip->close();
                return new WP_Error('archive_checksum_failed', 'An archived asset failed checksum validation.');
            }
            $expected_entries[] = $name;
            $total_bytes += (int) $details['bytes'];
        }

        $actual_entries = array();
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (substr($name, -1) !== '/') {
                $actual_entries[] = $name;
            }
        }
        sort($actual_entries);
        sort($expected_entries);
        if ($actual_entries !== $expected_entries) {
            $zip->close();
            return new WP_Error('unexpected_archive_files', 'The workspace archive contains files not declared in its manifest.');
        }
        $free = @disk_free_space(SBS_Storage::base_dir());
        if ($free !== false && $free < ($total_bytes * 2 + 20 * MB_IN_BYTES)) {
            $zip->close();
            return new WP_Error('insufficient_disk_space', 'There is not enough free disk space to stage and import this workspace.');
        }

        $staging = SBS_Storage::base_dir() . '/imports/' . wp_generate_uuid4();
        if (!wp_mkdir_p($staging)) {
            $zip->close();
            return new WP_Error('import_stage_failed', 'Could not create the protected import staging directory.');
        }
        $staged_assets = array();
        $allowed_mimes = array_values(SBS_Storage::allowed_mimes());
        foreach ((array) $manifest['records']['assets'] as $row) {
            $archive_path = isset($row['archive_path']) ? $row['archive_path'] : '';
            if (!$archive_path || !isset($manifest['files'][$archive_path]) || !in_array($row['mime'], $allowed_mimes, true)
                || !hash_equals((string) $manifest['files'][$archive_path]['sha256'], (string) $row['sha256'])
                || (int) $manifest['files'][$archive_path]['bytes'] !== (int) $row['bytes']) {
                self::remove_staging($staging);
                $zip->close();
                return new WP_Error('invalid_archived_asset', 'An archived asset has an invalid path or MIME type.');
            }
            $contents = $zip->getFromName($archive_path);
            $staged_path = $staging . '/' . (int) $row['id'] . '.asset';
            if ($contents === false || file_put_contents($staged_path, $contents, LOCK_EX) === false) {
                self::remove_staging($staging);
                $zip->close();
                return new WP_Error('import_stage_failed', 'An archived asset could not be staged.');
            }
            if (strpos($row['mime'], 'image/') === 0 && !@getimagesize($staged_path)) {
                self::remove_staging($staging);
                $zip->close();
                return new WP_Error('invalid_archived_image', 'An archived image failed content validation.');
            }
            $staged_assets[(int) $row['id']] = $staged_path;
        }

        $records = $manifest['records'];
        $maps = array('packs' => array(), 'pack_versions' => array(), 'projects' => array(), 'jobs' => array(), 'generations' => array(), 'canvases' => array(), 'assets' => array());
        $created_files = array();
        $wpdb->query('START TRANSACTION');
        try {
            foreach ((array) $records['packs'] as $row) {
                $old = (int) $row['id'];
                $existing = SBS_DB::row_by_uuid('packs', $row['uuid']);
                if ($existing && ($existing['name'] !== $row['name'] || $existing['description'] !== $row['description'])) {
                    $row['uuid'] = wp_generate_uuid4();
                    $existing = null;
                }
                if ($existing) {
                    $maps['packs'][$old] = (int) $existing['id'];
                    continue;
                }
                unset($row['id']);
                $wpdb->insert(SBS_DB::table('packs'), $row);
                self::require_insert($wpdb);
                $maps['packs'][$old] = (int) $wpdb->insert_id;
            }
            foreach ((array) $records['pack_versions'] as $row) {
                $old = (int) $row['id'];
                $row['pack_id'] = $maps['packs'][(int) $row['pack_id']];
                $existing = SBS_DB::row_by_uuid('pack_versions', $row['uuid']);
                if ($existing && $existing['identity_json'] !== $row['identity_json']) {
                    $row['uuid'] = wp_generate_uuid4();
                    $row['version'] = 1 + (int) $wpdb->get_var($wpdb->prepare('SELECT MAX(version) FROM ' . SBS_DB::table('pack_versions') . ' WHERE pack_id = %d', $row['pack_id']));
                    $existing = null;
                }
                if ($existing) {
                    $maps['pack_versions'][$old] = (int) $existing['id'];
                    continue;
                }
                unset($row['id']);
                $wpdb->insert(SBS_DB::table('pack_versions'), $row);
                self::require_insert($wpdb);
                $maps['pack_versions'][$old] = (int) $wpdb->insert_id;
                $current_version = (int) $wpdb->get_var($wpdb->prepare('SELECT current_version FROM ' . SBS_DB::table('packs') . ' WHERE id = %d', (int) $row['pack_id']));
                if ((int) $row['version'] >= $current_version) {
                    $wpdb->update(SBS_DB::table('packs'), array('current_version' => (int) $row['version'], 'status' => $row['status'], 'updated_at' => current_time('mysql', true)), array('id' => (int) $row['pack_id']));
                }
            }
            foreach ((array) $records['projects'] as $row) {
                $old = (int) $row['id'];
                $row['pack_version_id'] = $maps['pack_versions'][(int) $row['pack_version_id']];
                $row['current_generation_id'] = null;
                $existing = SBS_DB::row_by_uuid('projects', $row['uuid']);
                if ($existing && ((int) $existing['pack_version_id'] !== (int) $row['pack_version_id'] || $existing['title'] !== $row['title'] || $existing['concept_json'] !== $row['concept_json'])) {
                    $row['uuid'] = wp_generate_uuid4();
                    $existing = null;
                }
                if ($existing) {
                    $maps['projects'][$old] = (int) $existing['id'];
                    continue;
                }
                unset($row['id']);
                $wpdb->insert(SBS_DB::table('projects'), $row);
                self::require_insert($wpdb);
                $maps['projects'][$old] = (int) $wpdb->insert_id;
            }
            foreach ((array) $records['jobs'] as $row) {
                $old = (int) $row['id'];
                $existing = SBS_DB::row_by_uuid('jobs', $row['uuid']);
                if ($existing && ($existing['type'] !== $row['type'] || $existing['provider'] !== $row['provider'] || $existing['payload_json'] !== $row['payload_json'])) {
                    $row['uuid'] = wp_generate_uuid4();
                    $existing = null;
                }
                if ($existing) {
                    $maps['jobs'][$old] = (int) $existing['id'];
                    continue;
                }
                unset($row['id']);
                $row['external_id'] = null;
                $wpdb->insert(SBS_DB::table('jobs'), $row);
                self::require_insert($wpdb);
                $maps['jobs'][$old] = (int) $wpdb->insert_id;
            }
            $generation_links = array();
            foreach ((array) $records['generations'] as $row) {
                $old = (int) $row['id'];
                $generation_links[$old] = array('parent_id' => $row['parent_id'], 'output_asset_id' => $row['output_asset_id'], 'refs_json' => $row['refs_json']);
                $row['project_id'] = $maps['projects'][(int) $row['project_id']];
                $row['job_id'] = $row['job_id'] && isset($maps['jobs'][(int) $row['job_id']]) ? $maps['jobs'][(int) $row['job_id']] : null;
                $row['parent_id'] = null;
                $row['output_asset_id'] = null;
                $existing = SBS_DB::row_by_uuid('generations', $row['uuid']);
                if ($existing && ((int) $existing['project_id'] !== (int) $row['project_id'] || $existing['model'] !== $row['model'] || $existing['prompt'] !== $row['prompt'])) {
                    $row['uuid'] = wp_generate_uuid4();
                    $existing = null;
                }
                if ($existing) {
                    $maps['generations'][$old] = (int) $existing['id'];
                    continue;
                }
                unset($row['id']);
                $wpdb->insert(SBS_DB::table('generations'), $row);
                self::require_insert($wpdb);
                $maps['generations'][$old] = (int) $wpdb->insert_id;
            }
            $canvas_links = array();
            foreach ((array) $records['canvases'] as $row) {
                $old = (int) $row['id'];
                $canvas_links[$old] = $row['preview_asset_id'];
                $row['project_id'] = $maps['projects'][(int) $row['project_id']];
                $row['preview_asset_id'] = null;
                $existing = SBS_DB::row_by_uuid('canvases', $row['uuid']);
                if ($existing && ((int) $existing['project_id'] !== (int) $row['project_id'] || $existing['document_json'] !== $row['document_json'])) {
                    $row['uuid'] = wp_generate_uuid4();
                    $existing = null;
                }
                if ($existing) {
                    $maps['canvases'][$old] = (int) $existing['id'];
                    continue;
                }
                unset($row['id']);
                $wpdb->insert(SBS_DB::table('canvases'), $row);
                self::require_insert($wpdb);
                $maps['canvases'][$old] = (int) $wpdb->insert_id;
            }
            foreach ((array) $records['assets'] as $row) {
                $old = (int) $row['id'];
                $existing = SBS_DB::row_by_uuid('assets', $row['uuid']);
                if ($existing && hash_equals($existing['sha256'], $row['sha256'])) {
                    $maps['assets'][$old] = (int) $existing['id'];
                    continue;
                }
                if ($existing) {
                    $row['uuid'] = wp_generate_uuid4();
                }
                $owner_groups = array(
                    'pack_version' => 'pack_versions',
                    'project' => 'projects',
                    'generation' => 'generations',
                    'canvas' => 'canvases',
                    'job' => 'jobs',
                );
                $owner_group = isset($owner_groups[$row['owner_type']]) ? $owner_groups[$row['owner_type']] : '';
                $owner_map = $owner_group && isset($maps[$owner_group]) ? $maps[$owner_group] : array();
                $row['owner_id'] = isset($owner_map[(int) $row['owner_id']]) ? $owner_map[(int) $row['owner_id']] : 0;
                $contents = isset($staged_assets[$old]) ? file_get_contents($staged_assets[$old]) : false;
                if ($contents === false) {
                    throw new Exception('A staged import asset is missing.');
                }
                $ext = strtolower(pathinfo($row['filename'], PATHINFO_EXTENSION));
                $relative = 'assets/' . gmdate('Y/m') . '/' . $row['uuid'] . ($ext ? '.' . preg_replace('/[^a-z0-9]/', '', $ext) : '.bin');
                $absolute = SBS_Storage::base_dir() . '/' . $relative;
                wp_mkdir_p(dirname($absolute));
                if (file_put_contents($absolute, $contents, LOCK_EX) === false) {
                    throw new Exception('Could not write an imported asset.');
                }
                $created_files[] = $absolute;
                unset($row['id'], $row['archive_path']);
                $row['relative_path'] = $relative;
                $wpdb->insert(SBS_DB::table('assets'), $row);
                self::require_insert($wpdb);
                $maps['assets'][$old] = (int) $wpdb->insert_id;
            }
            foreach ($generation_links as $old => $links) {
                $refs = json_decode($links['refs_json'], true);
                $mapped_refs = array();
                foreach ((array) $refs as $reference) {
                    $reference_id = is_array($reference) && isset($reference['asset_id']) ? (int) $reference['asset_id'] : (int) $reference;
                    if (isset($maps['assets'][$reference_id])) {
                        if (is_array($reference)) {
                            $reference['asset_id'] = $maps['assets'][$reference_id];
                            $mapped_refs[] = $reference;
                        } else {
                            $mapped_refs[] = $maps['assets'][$reference_id];
                        }
                    }
                }
                $wpdb->update(SBS_DB::table('generations'), array(
                    'parent_id' => $links['parent_id'] && isset($maps['generations'][(int) $links['parent_id']]) ? $maps['generations'][(int) $links['parent_id']] : null,
                    'output_asset_id' => $links['output_asset_id'] && isset($maps['assets'][(int) $links['output_asset_id']]) ? $maps['assets'][(int) $links['output_asset_id']] : null,
                    'refs_json' => wp_json_encode($mapped_refs),
                ), array('id' => $maps['generations'][$old]));
            }
            foreach ((array) $records['projects'] as $row) {
                if ($row['current_generation_id'] && isset($maps['generations'][(int) $row['current_generation_id']])) {
                    $wpdb->update(SBS_DB::table('projects'), array('current_generation_id' => $maps['generations'][(int) $row['current_generation_id']]), array('id' => $maps['projects'][(int) $row['id']]));
                }
            }
            foreach ($canvas_links as $old => $preview_id) {
                if ($preview_id && isset($maps['assets'][(int) $preview_id])) {
                    $wpdb->update(SBS_DB::table('canvases'), array('preview_asset_id' => $maps['assets'][(int) $preview_id]), array('id' => $maps['canvases'][$old]));
                }
            }
            foreach ((array) $records['usage'] as $row) {
                unset($row['id']);
                $row['job_id'] = $row['job_id'] && isset($maps['jobs'][(int) $row['job_id']]) ? $maps['jobs'][(int) $row['job_id']] : null;
                $row['pack_version_id'] = !empty($row['pack_version_id']) && isset($maps['pack_versions'][(int) $row['pack_version_id']]) ? $maps['pack_versions'][(int) $row['pack_version_id']] : null;
                $wpdb->insert(SBS_DB::table('usage'), $row);
            }
            foreach ((array) ($manifest['settings'] ?? array()) as $key => $value) {
                if (in_array($key, array('sbs_studio_slug', 'sbs_text_model', 'sbs_image_model', 'sbs_replicate_model_version', 'sbs_replicate_cost_per_image'), true)) {
                    update_option($key, $value, false);
                }
            }
            $wpdb->query('COMMIT');
        } catch (Exception $e) {
            $wpdb->query('ROLLBACK');
            $zip->close();
            foreach ($created_files as $created_file) {
                @unlink($created_file);
            }
            self::remove_staging($staging);
            return new WP_Error('import_failed', $e->getMessage());
        }
        $zip->close();
        self::remove_staging($staging);
        return array('imported' => true, 'schema_version' => self::SCHEMA);
    }

    private static function scrub_remote_values($json)
    {
        if (!$json) {
            return null;
        }
        $data = json_decode($json, true);
        if (!is_array($data)) {
            return null;
        }
        foreach (array('response_id', 'prediction', 'submitted') as $key) {
            unset($data[$key]);
        }
        return wp_json_encode($data);
    }

    private static function filter_project_records($records, $project_uuid)
    {
        $project_rows = array_values(array_filter($records['projects'], function ($row) use ($project_uuid) { return $row['uuid'] === $project_uuid; }));
        if (!$project_rows) {
            return new WP_Error('missing_export_project', 'The selected project could not be found.');
        }
        $project = $project_rows[0];
        $project_id = (int) $project['id'];
        $version_id = (int) $project['pack_version_id'];
        $versions = array_values(array_filter($records['pack_versions'], function ($row) use ($version_id) { return (int) $row['id'] === $version_id; }));
        if (!$versions) {
            return new WP_Error('missing_export_pack', 'The selected project character version could not be found.');
        }
        $pack_id = (int) $versions[0]['pack_id'];
        $packs = array_values(array_filter($records['packs'], function ($row) use ($pack_id) { return (int) $row['id'] === $pack_id; }));
        if ($packs) {
            $packs[0]['current_version'] = (int) $versions[0]['version'];
        }
        $generations = array_values(array_filter($records['generations'], function ($row) use ($project_id) { return (int) $row['project_id'] === $project_id; }));
        $canvases = array_values(array_filter($records['canvases'], function ($row) use ($project_id) { return (int) $row['project_id'] === $project_id; }));
        $generation_ids = array_map(function ($row) { return (int) $row['id']; }, $generations);
        $canvas_ids = array_map(function ($row) { return (int) $row['id']; }, $canvases);
        $job_ids = array_values(array_unique(array_filter(array_map(function ($row) { return $row['job_id'] ? (int) $row['job_id'] : 0; }, $generations))));
        $jobs = array_values(array_filter($records['jobs'], function ($row) use ($job_ids) { return in_array((int) $row['id'], $job_ids, true); }));
        $assets = array_values(array_filter($records['assets'], function ($row) use ($version_id, $project_id, $generation_ids, $canvas_ids, $job_ids) {
            $owner = (int) $row['owner_id'];
            return ($row['owner_type'] === 'pack_version' && $owner === $version_id)
                || ($row['owner_type'] === 'project' && $owner === $project_id)
                || ($row['owner_type'] === 'generation' && in_array($owner, $generation_ids, true))
                || ($row['owner_type'] === 'canvas' && in_array($owner, $canvas_ids, true))
                || ($row['owner_type'] === 'job' && in_array($owner, $job_ids, true));
        }));
        $usage = array_values(array_filter($records['usage'], function ($row) use ($job_ids) { return $row['job_id'] && in_array((int) $row['job_id'], $job_ids, true); }));
        return array('packs' => $packs, 'pack_versions' => $versions, 'assets' => $assets, 'projects' => $project_rows, 'generations' => $generations, 'jobs' => $jobs, 'canvases' => $canvases, 'usage' => $usage);
    }

    private static function scrub_asset_metadata($json)
    {
        if (!$json) {
            return null;
        }
        $data = json_decode($json, true);
        if (!is_array($data)) {
            return null;
        }
        foreach (array('openai_response_id', 'openai_file_id', 'replicate_prediction_id', 'remote_id') as $key) {
            unset($data[$key]);
        }
        return wp_json_encode($data);
    }

    private static function safe_archive_path($path)
    {
        return $path && strpos($path, "\0") === false && strpos(str_replace('\\', '/', $path), '../') === false && !preg_match('#^(?:[A-Za-z]:|/)#', $path);
    }

    private static function require_insert($wpdb)
    {
        if (!$wpdb->insert_id) {
            throw new Exception($wpdb->last_error ? $wpdb->last_error : 'A database record could not be imported.');
        }
    }

    private static function remove_staging($directory)
    {
        $imports = realpath(SBS_Storage::base_dir() . '/imports');
        $target = realpath($directory);
        if (!$imports || !$target || strpos(wp_normalize_path($target), wp_normalize_path($imports) . '/') !== 0) {
            return;
        }
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($target, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($target);
    }
}
