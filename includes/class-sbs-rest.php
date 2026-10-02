<?php

if (!defined('ABSPATH')) {
    exit;
}

final class SBS_REST
{
    const NS = 'smutty-bear/v1';

    public static function register_routes()
    {
        register_rest_route(self::NS, '/auth/login', array('methods' => 'POST', 'callback' => array(__CLASS__, 'login'), 'permission_callback' => '__return_true'));
        register_rest_route(self::NS, '/auth/logout', array('methods' => 'POST', 'callback' => array(__CLASS__, 'logout'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/auth/me', array('methods' => 'GET', 'callback' => array(__CLASS__, 'me'), 'permission_callback' => '__return_true'));
        register_rest_route(self::NS, '/bootstrap', array('methods' => 'GET', 'callback' => array(__CLASS__, 'bootstrap'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/updates/status', array('methods' => 'GET', 'callback' => array(__CLASS__, 'updates_status'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/updates/unlock', array('methods' => 'POST', 'callback' => array(__CLASS__, 'updates_unlock'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/updates/lock', array('methods' => 'POST', 'callback' => array(__CLASS__, 'updates_lock'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/updates/check', array('methods' => 'POST', 'callback' => array(__CLASS__, 'updates_check'), 'permission_callback' => array(__CLASS__, 'update_permission')));
        register_rest_route(self::NS, '/updates/install-feed', array('methods' => 'POST', 'callback' => array(__CLASS__, 'updates_install_feed'), 'permission_callback' => array(__CLASS__, 'update_permission')));
        register_rest_route(self::NS, '/updates/install-upload', array('methods' => 'POST', 'callback' => array(__CLASS__, 'updates_install_upload'), 'permission_callback' => array(__CLASS__, 'update_permission')));
        register_rest_route(self::NS, '/updates/rollback', array('methods' => 'POST', 'callback' => array(__CLASS__, 'updates_rollback'), 'permission_callback' => array(__CLASS__, 'update_permission')));

        register_rest_route(self::NS, '/packs', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'packs'), 'permission_callback' => array(__CLASS__, 'permission')),
            array('methods' => 'POST', 'callback' => array(__CLASS__, 'create_pack'), 'permission_callback' => array(__CLASS__, 'permission')),
        ));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/fork', array('methods' => 'POST', 'callback' => array(__CLASS__, 'fork_pack'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)', array('methods' => 'PATCH', 'callback' => array(__CLASS__, 'update_pack'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/assets', array('methods' => 'POST', 'callback' => array(__CLASS__, 'upload_pack_asset'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/assets/(?P<asset_uuid>[a-f0-9\-]+)', array('methods' => 'DELETE', 'callback' => array(__CLASS__, 'delete_pack_asset'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/analyse', array('methods' => 'POST', 'callback' => array(__CLASS__, 'analyse_pack'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/development', array('methods' => 'POST', 'callback' => array(__CLASS__, 'start_development'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/development/accept', array('methods' => 'POST', 'callback' => array(__CLASS__, 'accept_development_reference'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/test', array('methods' => 'POST', 'callback' => array(__CLASS__, 'test_pack'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/approve-tests', array('methods' => 'POST', 'callback' => array(__CLASS__, 'approve_pack_tests'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/packs/(?P<uuid>[a-f0-9\-]+)/lock', array('methods' => 'POST', 'callback' => array(__CLASS__, 'lock_pack'), 'permission_callback' => array(__CLASS__, 'permission')));

        register_rest_route(self::NS, '/concepts', array('methods' => 'POST', 'callback' => array(__CLASS__, 'concepts'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/projects', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'projects'), 'permission_callback' => array(__CLASS__, 'permission')),
            array('methods' => 'POST', 'callback' => array(__CLASS__, 'create_project'), 'permission_callback' => array(__CLASS__, 'permission')),
        ));
        register_rest_route(self::NS, '/projects/(?P<uuid>[a-f0-9\-]+)', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'project'), 'permission_callback' => array(__CLASS__, 'permission')),
            array('methods' => 'DELETE', 'callback' => array(__CLASS__, 'delete_project'), 'permission_callback' => array(__CLASS__, 'permission')),
        ));
        register_rest_route(self::NS, '/projects/(?P<uuid>[a-f0-9\-]+)/development', array('methods' => 'PATCH', 'callback' => array(__CLASS__, 'select_development_seed'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/projects/(?P<uuid>[a-f0-9\-]+)/development/refine', array('methods' => 'POST', 'callback' => array(__CLASS__, 'refine_development_seed'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/projects/(?P<uuid>[a-f0-9\-]+)/development/references', array('methods' => 'POST', 'callback' => array(__CLASS__, 'generate_development_references'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/generations/(?P<uuid>[a-f0-9\-]+)', array('methods' => 'DELETE', 'callback' => array(__CLASS__, 'delete_generation'), 'permission_callback' => array(__CLASS__, 'permission')));

        register_rest_route(self::NS, '/jobs/generate', array('methods' => 'POST', 'callback' => array(__CLASS__, 'generate'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/jobs/upscale', array('methods' => 'POST', 'callback' => array(__CLASS__, 'upscale'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/jobs/(?P<uuid>[a-f0-9\-]+)', array('methods' => 'GET', 'callback' => array(__CLASS__, 'job'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/jobs/(?P<uuid>[a-f0-9\-]+)', array('methods' => 'DELETE', 'callback' => array(__CLASS__, 'cancel_job'), 'permission_callback' => array(__CLASS__, 'permission')));

        register_rest_route(self::NS, '/canvases', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'canvases'), 'permission_callback' => array(__CLASS__, 'permission')),
            array('methods' => 'POST', 'callback' => array(__CLASS__, 'save_canvas'), 'permission_callback' => array(__CLASS__, 'permission')),
        ));
        register_rest_route(self::NS, '/canvases/(?P<uuid>[a-f0-9\-]+)', array(
            array('methods' => 'GET', 'callback' => array(__CLASS__, 'canvas'), 'permission_callback' => array(__CLASS__, 'permission')),
            array('methods' => 'DELETE', 'callback' => array(__CLASS__, 'delete_canvas'), 'permission_callback' => array(__CLASS__, 'permission')),
        ));
        register_rest_route(self::NS, '/assets', array('methods' => 'POST', 'callback' => array(__CLASS__, 'upload_asset'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/usage', array('methods' => 'GET', 'callback' => array(__CLASS__, 'usage'), 'permission_callback' => array(__CLASS__, 'permission')));
        register_rest_route(self::NS, '/exports', array('methods' => 'POST', 'callback' => array(__CLASS__, 'create_export'), 'permission_callback' => array(__CLASS__, 'permission')));
    }

    public static function permission($request)
    {
        if (!SBS_Auth::is_authenticated()) {
            return new WP_Error('studio_auth_required', 'Studio authentication is required.', array('status' => 401));
        }
        if ($request instanceof WP_REST_Request && !in_array($request->get_method(), array('GET', 'HEAD', 'OPTIONS'), true)) {
            if ($request->get_header('x-sbs-request') !== 'studio' || !self::same_origin($request)) {
                return new WP_Error('invalid_studio_request', 'The request could not be verified.', array('status' => 403));
            }
        }
        return true;
    }

    public static function update_permission($request)
    {
        $studio_permission = self::permission($request);
        if (is_wp_error($studio_permission)) {
            return $studio_permission;
        }
        if (!SBS_Auth::is_update_authenticated()) {
            return new WP_Error('update_auth_required', 'Re-enter the Studio password to continue with updates.', array('status' => 403));
        }
        return true;
    }

    public static function login($request)
    {
        if (!self::same_origin($request)) {
            return new WP_Error('invalid_origin', 'The request origin is not allowed.', array('status' => 403));
        }
        $result = SBS_Auth::login((string) $request->get_param('password'), (bool) $request->get_param('adult_confirmed'));
        return is_wp_error($result) ? $result : rest_ensure_response(array('authenticated' => true));
    }

    public static function logout()
    {
        SBS_Auth::logout();
        return rest_ensure_response(array('authenticated' => false));
    }

    public static function me()
    {
        return rest_ensure_response(array('authenticated' => SBS_Auth::is_authenticated(), 'password_set' => SBS_Auth::password_is_set()));
    }

    public static function bootstrap()
    {
        return rest_ensure_response(array(
            'packs' => self::pack_list(),
            'projects' => self::project_list(),
            'active_jobs' => self::active_job_list(),
            'usage' => self::usage_summary(),
            'providers' => array('openai' => SBS_OpenAI::is_configured(), 'replicate' => SBS_Replicate::is_configured()),
            'defaults' => array('draft_count' => 4, 'quality' => 'medium', 'size' => '1024x1024', 'polish_quality' => 'high'),
        ));
    }

    public static function updates_status()
    {
        return rest_ensure_response(self::update_status_data(false));
    }

    public static function updates_unlock($request)
    {
        $result = SBS_Auth::update_login((string) $request->get_param('password'));
        SBS_Updater::audit('unlock', is_wp_error($result) ? 'failed' : 'success', is_wp_error($result) ? array('reason' => $result->get_error_code()) : array());
        return is_wp_error($result) ? $result : rest_ensure_response(self::update_status_data(false));
    }

    public static function updates_lock()
    {
        SBS_Auth::update_logout();
        SBS_Updater::audit('lock', 'success');
        return rest_ensure_response(self::update_status_data(false));
    }

    public static function updates_check()
    {
        delete_transient('sbs_release_feed');
        $release = SBS_Updater::release_feed(true);
        SBS_Updater::audit('feed_check', is_wp_error($release) ? 'failed' : 'success', is_wp_error($release) ? array('reason' => $release->get_error_code()) : array('version' => !empty($release['version']) ? $release['version'] : 'none'));
        if (is_wp_error($release)) {
            return $release;
        }
        return rest_ensure_response(self::update_status_data(false));
    }

    public static function updates_install_feed()
    {
        $result = SBS_Updater::install_feed_release();
        SBS_Updater::audit('install_feed', is_wp_error($result) ? 'failed' : 'success', is_wp_error($result) ? array('reason' => $result->get_error_code()) : array('version' => $result['version']));
        return is_wp_error($result) ? $result : rest_ensure_response($result);
    }

    public static function updates_install_upload($request)
    {
        $files = $request->get_file_params();
        if (empty($files['release_zip']['tmp_name']) || !is_uploaded_file($files['release_zip']['tmp_name'])) {
            SBS_Updater::audit('install_upload', 'failed', array('reason' => 'missing_release_zip'));
            return new WP_Error('missing_release_zip', 'Choose a signed release ZIP.', array('status' => 400));
        }
        if (empty($files['release_zip']['name']) || strtolower(pathinfo($files['release_zip']['name'], PATHINFO_EXTENSION)) !== 'zip' || (!empty($files['release_zip']['size']) && (int) $files['release_zip']['size'] > 100 * MB_IN_BYTES)) {
            SBS_Updater::audit('install_upload', 'failed', array('reason' => 'invalid_release_zip'));
            return new WP_Error('invalid_release_zip', 'The release must be a ZIP file no larger than 100 MB.', array('status' => 400));
        }
        $result = SBS_Updater::install_uploaded($files['release_zip']['tmp_name'], false);
        SBS_Updater::audit('install_upload', is_wp_error($result) ? 'failed' : 'success', is_wp_error($result) ? array('reason' => $result->get_error_code()) : array('version' => $result['version']));
        return is_wp_error($result) ? $result : rest_ensure_response($result);
    }

    public static function updates_rollback($request)
    {
        $backup = sanitize_file_name((string) $request->get_param('backup'));
        $result = SBS_Updater::rollback($backup);
        SBS_Updater::audit('rollback', is_wp_error($result) ? 'failed' : 'success', is_wp_error($result) ? array('reason' => $result->get_error_code()) : array('package' => $backup, 'version' => $result['version']));
        return is_wp_error($result) ? $result : rest_ensure_response($result);
    }

    public static function packs()
    {
        return rest_ensure_response(self::pack_list());
    }

    public static function create_pack($request)
    {
        global $wpdb;
        $name = sanitize_text_field($request->get_param('name'));
        $description = sanitize_textarea_field($request->get_param('description'));
        if (!$name) {
            return new WP_Error('missing_name', 'Enter a character name.', array('status' => 400));
        }
        $now = current_time('mysql', true);
        $uuid = wp_generate_uuid4();
        $wpdb->insert(SBS_DB::table('packs'), array(
            'uuid' => $uuid,
            'name' => $name,
            'description' => $description,
            'status' => 'draft',
            'current_version' => 1,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        $pack_id = (int) $wpdb->insert_id;
        $identity = array(
            'schema_version' => 1,
            'name' => $name,
            'summary' => $description,
            'adult' => true,
            'locked_traits' => array(),
            'exclusions' => array('No childlike or ambiguous age presentation', 'No visible genitals or depicted sex acts'),
            'palette' => array(),
            'humour_boundary' => 'Strong adult innuendo without explicit sexual imagery.',
        );
        $wpdb->insert(SBS_DB::table('pack_versions'), array(
            'uuid' => wp_generate_uuid4(),
            'pack_id' => $pack_id,
            'version' => 1,
            'status' => 'draft',
            'identity_json' => wp_json_encode($identity),
            'created_at' => $now,
            'locked_at' => null,
        ));
        return rest_ensure_response(self::pack_by_uuid($uuid));
    }

    public static function fork_pack($request)
    {
        global $wpdb;
        $pack = SBS_DB::row_by_uuid('packs', $request['uuid']);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $versions = SBS_DB::table('pack_versions');
        $source = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$versions} WHERE pack_id = %d ORDER BY version DESC LIMIT 1", (int) $pack['id']), ARRAY_A);
        $version = ((int) $source['version']) + 1;
        $forked_identity = json_decode($source['identity_json'], true);
        $forked_identity['tests_approved'] = false;
        unset($forked_identity['approved_test_generation_uuid']);
        $wpdb->insert($versions, array(
            'uuid' => wp_generate_uuid4(),
            'pack_id' => (int) $pack['id'],
            'version' => $version,
            'status' => 'draft',
            'identity_json' => wp_json_encode($forked_identity),
            'created_at' => current_time('mysql', true),
            'locked_at' => null,
        ));
        $new_version_id = (int) $wpdb->insert_id;
        $assets = SBS_DB::table('assets');
        $source_assets = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d", (int) $source['id']), ARRAY_A);
        foreach ($source_assets as $asset) {
            $path = SBS_Storage::base_dir() . '/' . ltrim($asset['relative_path'], '/');
            if (is_readable($path)) {
                SBS_Storage::store_bytes(file_get_contents($path), $asset['filename'], $asset['mime'], 'pack_version', $new_version_id, $asset['role'], $asset['label'], json_decode($asset['metadata_json'], true) ?: array());
            }
        }
        $wpdb->update(SBS_DB::table('packs'), array('status' => 'draft', 'current_version' => $version, 'updated_at' => current_time('mysql', true)), array('id' => (int) $pack['id']));
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function update_pack($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $name = sanitize_text_field($request->get_param('name'));
        $description = sanitize_textarea_field($request->get_param('description'));
        if (!$name) {
            return new WP_Error('missing_name', 'Enter a character name.', array('status' => 400));
        }
        $identity = json_decode($pack['identity_json'], true);
        $incoming = $request->get_param('identity');
        if (!is_array($identity)) {
            $identity = array();
        }
        $identity_before = $identity;
        if (is_array($incoming)) {
            if (isset($incoming['summary'])) {
                $identity['summary'] = sanitize_textarea_field($incoming['summary']);
            }
            if (isset($incoming['humour_boundary'])) {
                $identity['humour_boundary'] = sanitize_textarea_field($incoming['humour_boundary']);
            }
            foreach (array('locked_traits', 'exclusions') as $list_key) {
                if (isset($incoming[$list_key]) && is_array($incoming[$list_key])) {
                    $identity[$list_key] = array_values(array_filter(array_map('sanitize_text_field', $incoming[$list_key])));
                }
            }
            if (isset($incoming['palette']) && is_array($incoming['palette'])) {
                $identity['palette'] = array_values(array_filter(array_map('sanitize_text_field', $incoming['palette'])));
            }
        }
        $identity['name'] = $name;
        $identity['adult'] = true;
        $identity_changed = wp_json_encode($identity_before) !== wp_json_encode($identity) || $description !== $pack['description'] || $name !== $pack['name'];
        if ($identity_changed) {
            $grounding_updated_at = current_time('mysql', true);
            $identity['tests_approved'] = false;
            $identity['approval_invalidated_at'] = $grounding_updated_at;
            $identity['grounding_updated_at'] = $grounding_updated_at;
            unset($identity['approved_test_generation_uuid']);
        }
        $wpdb->update(SBS_DB::table('packs'), array('name' => $name, 'description' => $description, 'status' => 'ready', 'updated_at' => current_time('mysql', true)), array('id' => (int) $pack['id']));
        $wpdb->update(SBS_DB::table('pack_versions'), array('identity_json' => wp_json_encode($identity), 'status' => 'ready', 'locked_at' => null), array('id' => (int) $pack['version_id']));
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function upload_pack_asset($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_Error('missing_file', 'Choose a reference file.', array('status' => 400));
        }
        $role = sanitize_key($request->get_param('role') ?: 'reference');
        $asset = SBS_Storage::store_upload($files['file'], 'pack_version', (int) $pack['version_id'], $role, sanitize_text_field($request->get_param('label')));
        if (is_wp_error($asset)) {
            return $asset;
        }
        if ((bool) $request->get_param('replace_role')) {
            $assets = SBS_DB::table('assets');
            $old_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d AND role = %s AND id <> %d", (int) $pack['version_id'], $role, (int) $asset['id']));
            foreach ($old_ids as $old_id) {
                SBS_Storage::delete_asset((int) $old_id);
            }
        }
        self::invalidate_pack_approval((int) $pack['version_id']);
        $wpdb->update(SBS_DB::table('packs'), array('status' => 'ready', 'updated_at' => current_time('mysql', true)), array('id' => (int) $pack['id']));
        $wpdb->update(SBS_DB::table('pack_versions'), array('status' => 'ready', 'locked_at' => null), array('id' => (int) $pack['version_id']));
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function delete_pack_asset($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $assets = SBS_DB::table('assets');
        $asset = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$assets} WHERE uuid = %s AND owner_type = 'pack_version' AND owner_id = %d", sanitize_text_field($request['asset_uuid']), (int) $pack['version_id']), ARRAY_A);
        if (!$asset) {
            return new WP_Error('missing_asset', 'Reference asset not found.', array('status' => 404));
        }
        $metadata = json_decode($asset['metadata_json'], true);
        $is_approval_asset = $asset['role'] === 'generated_reference' && ((is_array($metadata) && !empty($metadata['origin']) && $metadata['origin'] === 'character_approval') || ($asset['label'] === 'Approved generated character model sheet' && is_array($metadata) && !empty($metadata['source_generation_uuid'])));
        $deleted = SBS_Storage::delete_asset((int) $asset['id']);
        if (is_wp_error($deleted)) {
            return $deleted;
        }
        if ($is_approval_asset) {
            self::clear_pack_approval((int) $pack['version_id']);
        } else {
            self::invalidate_pack_approval((int) $pack['version_id']);
        }
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function analyse_pack($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $assets = SBS_DB::table('assets');
        $asset_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d ORDER BY id ASC", (int) $pack['version_id']));
        $saved_identity = json_decode($pack['identity_json'], true);
        $result = SBS_OpenAI::analyse_character($pack['description'], is_array($saved_identity) ? $saved_identity : array(), $asset_ids);
        if (is_wp_error($result)) {
            return $result;
        }
        self::record_usage(null, 'openai', 'character_analysis', 1, 'request', 0, $result['usage'], (int) $pack['version_id']);
        return rest_ensure_response(array(
            'suggestion' => $result['identity'],
            'usage' => $result['usage'],
        ));
    }

    public static function start_development($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $identity = json_decode($pack['identity_json'], true);
        $brief = trim($pack['description'] . ' ' . (is_array($identity) && !empty($identity['summary']) ? $identity['summary'] : ''));
        if (strlen($brief) < 10 && (empty($identity['locked_traits']) || !is_array($identity['locked_traits']))) {
            return new WP_Error('development_brief_missing', 'Add a useful character description or identity traits before generating visual concepts.', array('status' => 400));
        }
        $now = current_time('mysql', true);
        $project_uuid = wp_generate_uuid4();
        $concept = array(
            'schema_version' => 1,
            'type' => 'character_visual_development',
            'stage' => 'concepts',
            'selected_seed_uuid' => '',
            'accepted' => array(),
        );
        $wpdb->insert(SBS_DB::table('projects'), array(
            'uuid' => $project_uuid,
            'pack_version_id' => (int) $pack['version_id'],
            'title' => $pack['name'] . ' v' . (int) $pack['current_version'] . ' visual development',
            'concept_json' => wp_json_encode($concept),
            'current_generation_id' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        if (!$wpdb->insert_id) {
            return new WP_Error('development_project_failed', 'Could not create the visual-development session.', array('status' => 500));
        }
        $internal = new WP_REST_Request('POST');
        $internal->set_param('project_uuid', $project_uuid);
        $internal->set_param('prompt', "SAVED CHARACTER BRIEF:\n" . $pack['description'] . "\n\nCreate one clean visual-development concept for this recurring character. Show one coherent, clearly adult character design as a full-body three-quarter presentation with the face clearly readable on a plain warm neutral studio background. Concentrate on distinctive facial structure, proportions, silhouette, signature clothing, palette and illustration treatment. This is character design exploration, not a scene or joke. Do not add other characters, model-sheet panels, lettering or logos.");
        $internal->set_param('count', 4);
        $internal->set_param('quality', 'medium');
        $internal->set_param('size', '1024x1024');
        $internal->set_param('background', 'opaque');
        $internal->set_param('purpose', 'development_concept');
        $generated = self::generate($internal);
        if (is_wp_error($generated)) {
            return $generated;
        }
        $data = self::response_data($generated);
        $data['project'] = self::project_by_uuid($project_uuid);
        return rest_ensure_response($data);
    }

    public static function select_development_seed($request)
    {
        global $wpdb;
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request['uuid']));
        $concept = $project ? json_decode($project['concept_json'], true) : array();
        if (!$project || !is_array($concept) || empty($concept['type']) || $concept['type'] !== 'character_visual_development') {
            return new WP_Error('missing_development', 'Visual-development session not found.', array('status' => 404));
        }
        $seed_uuid = sanitize_text_field($request->get_param('selected_seed_uuid'));
        $generation = SBS_DB::row_by_uuid('generations', $seed_uuid);
        if (!$generation || (int) $generation['project_id'] !== (int) $project['id'] || !$generation['output_asset_id']) {
            return new WP_Error('invalid_development_seed', 'Choose a completed concept from this development session.', array('status' => 400));
        }
        $purpose = self::generation_purpose($generation);
        if (!in_array($purpose, array('development_concept', 'development_concept_refinement'), true)) {
            return new WP_Error('invalid_development_seed', 'Only a concept or concept refinement can become the visual seed.', array('status' => 400));
        }
        $concept['selected_seed_uuid'] = $seed_uuid;
        $concept['stage'] = 'seed_selected';
        $wpdb->update(SBS_DB::table('projects'), array('concept_json' => wp_json_encode($concept), 'updated_at' => current_time('mysql', true)), array('id' => (int) $project['id']));
        return rest_ensure_response(self::project_by_uuid($project['uuid']));
    }

    public static function refine_development_seed($request)
    {
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request['uuid']));
        $concept = $project ? json_decode($project['concept_json'], true) : array();
        if (!$project || !is_array($concept) || empty($concept['type']) || $concept['type'] !== 'character_visual_development') {
            return new WP_Error('missing_development', 'Visual-development session not found.', array('status' => 404));
        }
        $seed_uuid = sanitize_text_field($request->get_param('generation_uuid'));
        if (!$seed_uuid) {
            $seed_uuid = !empty($concept['selected_seed_uuid']) ? sanitize_text_field($concept['selected_seed_uuid']) : '';
        }
        $seed = SBS_DB::row_by_uuid('generations', $seed_uuid);
        if (!$seed || (int) $seed['project_id'] !== (int) $project['id'] || !$seed['output_asset_id']) {
            return new WP_Error('invalid_development_seed', 'Select a completed visual seed before refining it.', array('status' => 400));
        }
        $instruction = sanitize_textarea_field($request->get_param('instruction'));
        if (strlen(trim($instruction)) < 3) {
            return new WP_Error('missing_refinement', 'Describe the change to make to the selected visual seed.', array('status' => 400));
        }
        $internal = new WP_REST_Request('POST');
        $internal->set_param('project_uuid', $project['uuid']);
        $internal->set_param('parent_uuid', $seed_uuid);
        $internal->set_param('prompt', 'Refine the selected character concept as follows: ' . $instruction . "\nPreserve every unmentioned identity feature, keep one full-body clearly adult character on a plain warm neutral studio background, and do not add text, logos, extra characters or a narrative scene.");
        $internal->set_param('count', 1);
        $internal->set_param('quality', 'medium');
        $internal->set_param('size', '1024x1024');
        $internal->set_param('background', 'opaque');
        $internal->set_param('purpose', 'development_concept_refinement');
        return self::generate($internal);
    }

    public static function generate_development_references($request)
    {
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request['uuid']));
        $concept = $project ? json_decode($project['concept_json'], true) : array();
        if (!$project || !is_array($concept) || empty($concept['type']) || $concept['type'] !== 'character_visual_development') {
            return new WP_Error('missing_development', 'Visual-development session not found.', array('status' => 404));
        }
        $seed_uuid = !empty($concept['selected_seed_uuid']) ? sanitize_text_field($concept['selected_seed_uuid']) : '';
        $seed = $seed_uuid ? SBS_DB::row_by_uuid('generations', $seed_uuid) : null;
        if (!$seed || (int) $seed['project_id'] !== (int) $project['id'] || !$seed['output_asset_id']) {
            return new WP_Error('invalid_development_seed', 'Select a completed visual seed before building references.', array('status' => 400));
        }
        $config = self::development_reference_config();
        $requested = $request->get_param('roles');
        $requested = is_array($requested) ? array_values(array_unique(array_map('sanitize_key', $requested))) : array(sanitize_key($request->get_param('role')));
        $requested = array_values(array_filter($requested, function ($role) use ($config) { return isset($config[$role]); }));
        if (!$requested) {
            return new WP_Error('missing_development_roles', 'Choose at least one reference type to generate.', array('status' => 400));
        }
        $jobs = array();
        $errors = array();
        foreach ($requested as $role) {
            $details = $config[$role];
            $internal = new WP_REST_Request('POST');
            $internal->set_param('project_uuid', $project['uuid']);
            $internal->set_param('parent_uuid', $seed_uuid);
            $internal->set_param('prompt', $details['prompt']);
            $internal->set_param('count', 1);
            $internal->set_param('quality', 'medium');
            $internal->set_param('size', $details['size']);
            $internal->set_param('background', 'opaque');
            $internal->set_param('purpose', $details['purpose']);
            $generated = self::generate($internal);
            if (is_wp_error($generated)) {
                $errors[$role] = $generated->get_error_message();
                continue;
            }
            $data = self::response_data($generated);
            if (!empty($data['jobs']) && is_array($data['jobs'])) {
                $jobs = array_merge($jobs, $data['jobs']);
            }
        }
        if (!$jobs && $errors) {
            return new WP_Error('development_references_failed', implode(' ', array_values($errors)), array('status' => 502, 'roles' => $errors));
        }
        return rest_ensure_response(array('jobs' => $jobs, 'errors' => $errors));
    }

    public static function accept_development_reference($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $generation_uuid = sanitize_text_field($request->get_param('generation_uuid'));
        $role = sanitize_key($request->get_param('role'));
        $allowed_roles = array('master_reference', 'face', 'full_body', 'expression', 'outfit', 'style');
        if (!in_array($role, $allowed_roles, true)) {
            return new WP_Error('invalid_reference_role', 'This visual-development result cannot be accepted into that role.', array('status' => 400));
        }
        $generation = SBS_DB::row_by_uuid('generations', $generation_uuid);
        $project = $generation ? $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . SBS_DB::table('projects') . ' WHERE id = %d', (int) $generation['project_id']), ARRAY_A) : null;
        $concept = $project ? json_decode($project['concept_json'], true) : array();
        if (!$generation || !$project || (int) $project['pack_version_id'] !== (int) $pack['version_id'] || empty($concept['type']) || $concept['type'] !== 'character_visual_development' || !$generation['output_asset_id']) {
            return new WP_Error('invalid_development_result', 'Choose a completed result from this character version.', array('status' => 400));
        }
        $purpose = self::generation_purpose($generation);
        $expected = $role === 'master_reference' ? array('development_concept', 'development_concept_refinement') : array('development_reference_' . $role);
        if (!in_array($purpose, $expected, true)) {
            return new WP_Error('development_role_mismatch', 'That result was generated for a different reference role.', array('status' => 400));
        }
        $assets_table = SBS_DB::table('assets');
        $existing_rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$assets_table} WHERE owner_type = 'pack_version' AND owner_id = %d AND role = %s ORDER BY id ASC", (int) $pack['version_id'], $role), ARRAY_A);
        foreach ($existing_rows as $existing) {
            $metadata = json_decode($existing['metadata_json'], true);
            if (is_array($metadata) && !empty($metadata['source_generation_uuid']) && $metadata['source_generation_uuid'] === $generation_uuid) {
                return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
            }
        }
        $source = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$assets_table} WHERE id = %d", (int) $generation['output_asset_id']), ARRAY_A);
        $path = $source ? SBS_Storage::absolute_path($source) : '';
        if (!$source || !$path || !is_readable($path)) {
            return new WP_Error('development_asset_missing', 'The selected generated image could not be read.', array('status' => 500));
        }
        $config = self::development_reference_config();
        $label = $role === 'master_reference' ? 'Accepted visual seed' : $config[$role]['label'];
        $stored = SBS_Storage::store_bytes(file_get_contents($path), 'generated-' . $role . '.png', $source['mime'], 'pack_version', (int) $pack['version_id'], $role, $label, array(
            'origin' => 'visual_development',
            'development_project_uuid' => $project['uuid'],
            'source_generation_uuid' => $generation_uuid,
            'development_purpose' => $purpose,
        ));
        if (is_wp_error($stored)) {
            return $stored;
        }
        $replace_existing = $request->get_param('replace_existing') !== false;
        if ($replace_existing) {
            foreach ($existing_rows as $existing) {
                $metadata = json_decode($existing['metadata_json'], true);
                if (is_array($metadata) && !empty($metadata['origin']) && $metadata['origin'] === 'visual_development') {
                    SBS_Storage::delete_asset((int) $existing['id']);
                }
            }
        }
        if (empty($concept['accepted']) || !is_array($concept['accepted'])) {
            $concept['accepted'] = array();
        }
        $concept['accepted'][$role] = $generation_uuid;
        $concept['stage'] = 'references_started';
        $wpdb->update(SBS_DB::table('projects'), array('concept_json' => wp_json_encode($concept), 'updated_at' => current_time('mysql', true)), array('id' => (int) $project['id']));
        self::invalidate_pack_approval((int) $pack['version_id']);
        $wpdb->update(SBS_DB::table('packs'), array('updated_at' => current_time('mysql', true)), array('id' => (int) $pack['id']));
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function test_pack($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $identity = json_decode($pack['identity_json'], true);
        if (empty($identity['locked_traits'])) {
            return new WP_Error('identity_not_ready', 'Prepare the identity pack before generating approval views.', array('status' => 400));
        }
        $assets = SBS_DB::table('assets');
        $visual_reference = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d AND role IN ('master_reference','face','full_body') LIMIT 1", (int) $pack['version_id']));
        if (!$visual_reference) {
            return new WP_Error('visual_reference_required', 'Accept or upload a Master, Face or Full-body reference before generating the approval sheet.', array('status' => 400));
        }
        $now = current_time('mysql', true);
        $uuid = wp_generate_uuid4();
        $wpdb->insert(SBS_DB::table('projects'), array(
            'uuid' => $uuid,
            'pack_version_id' => (int) $pack['version_id'],
            'title' => $pack['name'] . ' v' . (int) $pack['current_version'] . ' approval sheet',
            'concept_json' => wp_json_encode(array('type' => 'character_pack_test')),
            'current_generation_id' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        if (!$wpdb->insert_id) {
            return new WP_Error('test_project_failed', 'Could not create the character test project.', array('status' => 500));
        }
        $internal = new WP_REST_Request('POST');
        $internal->set_param('project_uuid', $uuid);
        $internal->set_param('prompt', 'Create one clean character approval model sheet with clearly separated panels: full-body front, three-quarter, side profile and rear views; face close-up; standard smile, cheeky grin, wink, laugh and playful expressions; signature outfit details; palette and fur/ink texture detail. Use a plain warm neutral background. Keep all anatomy and clothing non-explicit and make every view consistent enough for identity approval. Do not include words or logos.');
        $internal->set_param('count', 1);
        $internal->set_param('quality', 'medium');
        $internal->set_param('size', '1536x1024');
        $internal->set_param('background', 'opaque');
        $internal->set_param('purpose', 'character_approval');
        return self::generate($internal);
    }

    public static function approve_pack_tests($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $generations = SBS_DB::table('generations');
        $projects = SBS_DB::table('projects');
        $assets = SBS_DB::table('assets');
        $generation_uuid = sanitize_text_field($request->get_param('generation_uuid'));
        if (!$generation_uuid) {
            return new WP_Error('missing_approval_sheet', 'Choose the approval sheet you want to accept.', array('status' => 400));
        }
        $selected = $wpdb->get_row($wpdb->prepare("SELECT g.id AS generation_id, g.uuid AS generation_uuid, g.created_at AS generation_created_at, g.job_id, p.id AS project_id, p.uuid AS project_uuid, p.concept_json, a.relative_path, a.mime FROM {$generations} g JOIN {$projects} p ON p.id = g.project_id JOIN {$assets} a ON a.id = g.output_asset_id WHERE g.uuid = %s AND p.pack_version_id = %d LIMIT 1", $generation_uuid, (int) $pack['version_id']), ARRAY_A);
        $concept = $selected ? json_decode($selected['concept_json'], true) : array();
        if (!$selected || !is_array($concept) || empty($concept['type']) || $concept['type'] !== 'character_pack_test' || self::generation_purpose($selected) !== 'character_approval') {
            return new WP_Error('invalid_approval_sheet', 'Choose a completed approval sheet from this character version.', array('status' => 400));
        }
        $identity = json_decode($pack['identity_json'], true);
        $grounding_updated_at = !empty($identity['grounding_updated_at']) ? $identity['grounding_updated_at'] : (!empty($identity['approval_invalidated_at']) ? $identity['approval_invalidated_at'] : '');
        if ($grounding_updated_at && strtotime($selected['generation_created_at'] . ' UTC') < strtotime($grounding_updated_at . ' UTC')) {
            return new WP_Error('approval_sheet_stale', 'The character changed after this approval sheet was generated. Generate and review a fresh sheet first.', array('status' => 409));
        }
        $approval_assets = array();
        $existing_reference = null;
        $asset_rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d AND role = 'generated_reference' ORDER BY id ASC", (int) $pack['version_id']), ARRAY_A);
        foreach ($asset_rows as $asset_row) {
            $metadata = json_decode($asset_row['metadata_json'], true);
            $is_approval_asset = (is_array($metadata) && !empty($metadata['origin']) && $metadata['origin'] === 'character_approval') || ($asset_row['label'] === 'Approved generated character model sheet' && is_array($metadata) && !empty($metadata['source_generation_uuid']));
            if (!$is_approval_asset) {
                continue;
            }
            $approval_assets[] = $asset_row;
            if (!empty($metadata['source_generation_uuid']) && $metadata['source_generation_uuid'] === $selected['generation_uuid']) {
                $existing_reference = $asset_row;
            }
        }
        if (!$existing_reference) {
            $path = SBS_Storage::base_dir() . '/' . ltrim($selected['relative_path'], '/');
            if (!is_readable($path)) {
                return new WP_Error('test_asset_missing', 'The completed approval artwork could not be read.', array('status' => 500));
            }
            $reference = SBS_Storage::store_bytes(file_get_contents($path), 'generated-character-model-sheet.png', $selected['mime'], 'pack_version', (int) $pack['version_id'], 'generated_reference', 'Approved generated character model sheet', array(
                'origin' => 'character_approval',
                'source_generation_uuid' => $selected['generation_uuid'],
                'approval_project_uuid' => $selected['project_uuid'],
            ));
            if (is_wp_error($reference)) {
                return $reference;
            }
        }
        foreach ($approval_assets as $approval_asset) {
            if (!$existing_reference || (int) $approval_asset['id'] !== (int) $existing_reference['id']) {
                $deleted = SBS_Storage::delete_asset((int) $approval_asset['id']);
                if (is_wp_error($deleted)) {
                    return $deleted;
                }
            }
        }
        $identity['tests_approved'] = true;
        $identity['approved_test_generation_uuid'] = $selected['generation_uuid'];
        unset($identity['approval_invalidated_at']);
        $wpdb->update(SBS_DB::table('pack_versions'), array('identity_json' => wp_json_encode($identity)), array('id' => (int) $pack['version_id']));
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function lock_pack($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid($request['uuid'], true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Character pack not found.', array('status' => 404));
        }
        $identity = json_decode($pack['identity_json'], true);
        if (empty($identity['adult']) || empty($identity['locked_traits']) || empty($identity['tests_approved'])) {
            return new WP_Error('incomplete_pack', 'Prepare the identity, generate the approval sheet, and explicitly approve its tests before locking this version.', array('status' => 400));
        }
        $now = current_time('mysql', true);
        $wpdb->update(SBS_DB::table('pack_versions'), array('status' => 'ready', 'locked_at' => null), array('id' => (int) $pack['version_id']));
        $wpdb->update(SBS_DB::table('packs'), array('status' => 'ready', 'updated_at' => $now), array('id' => (int) $pack['id']));
        return rest_ensure_response(self::pack_by_uuid($pack['uuid']));
    }

    public static function concepts($request)
    {
        $pack = self::pack_by_uuid(sanitize_text_field($request->get_param('pack_uuid')), true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Choose a character pack.', array('status' => 404));
        }
        $idea = sanitize_textarea_field($request->get_param('idea'));
        if (strlen($idea) < 3) {
            return new WP_Error('missing_idea', 'Describe the joke or scene.', array('status' => 400));
        }
        $boundary = self::validate_scene($idea);
        if (is_wp_error($boundary)) {
            return $boundary;
        }
        $result = SBS_OpenAI::create_concepts($idea, json_decode($pack['identity_json'], true));
        if (is_wp_error($result)) {
            return $result;
        }
        self::record_usage(null, 'openai', 'concept_generation', 1, 'request', 0, $result['usage'], (int) $pack['version_id']);
        return rest_ensure_response($result);
    }

    public static function projects()
    {
        return rest_ensure_response(self::project_list());
    }

    public static function create_project($request)
    {
        global $wpdb;
        $pack = self::pack_by_uuid(sanitize_text_field($request->get_param('pack_uuid')), true);
        if (!$pack) {
            return new WP_Error('missing_pack', 'Choose a character pack.', array('status' => 400));
        }
        $title = sanitize_text_field($request->get_param('title'));
        if (!$title) {
            $title = 'Untitled project';
        }
        $now = current_time('mysql', true);
        $uuid = wp_generate_uuid4();
        $wpdb->insert(SBS_DB::table('projects'), array(
            'uuid' => $uuid,
            'pack_version_id' => (int) $pack['version_id'],
            'title' => $title,
            'concept_json' => wp_json_encode($request->get_param('concept') ?: array()),
            'current_generation_id' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ));
        return rest_ensure_response(self::project_by_uuid($uuid));
    }

    public static function project($request)
    {
        $project = self::project_by_uuid($request['uuid']);
        return $project ? rest_ensure_response($project) : new WP_Error('missing_project', 'Project not found.', array('status' => 404));
    }

    public static function delete_project($request)
    {
        global $wpdb;
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request['uuid']));
        if (!$project) {
            return new WP_Error('missing_project', 'Project not found.', array('status' => 404));
        }
        $generations = SBS_DB::table('generations');
        $canvases = SBS_DB::table('canvases');
        $jobs = SBS_DB::table('jobs');
        $usage = SBS_DB::table('usage');
        $generation_ids = array_map('intval', $wpdb->get_col($wpdb->prepare("SELECT id FROM {$generations} WHERE project_id = %d", (int) $project['id'])));
        $generation_uuids = $wpdb->get_col($wpdb->prepare("SELECT uuid FROM {$generations} WHERE project_id = %d", (int) $project['id']));
        if ($generation_uuids) {
            $accepted_assets = $wpdb->get_results("SELECT metadata_json FROM " . SBS_DB::table('assets') . " WHERE owner_type = 'pack_version' AND metadata_json IS NOT NULL", ARRAY_A);
            foreach ($accepted_assets as $accepted_asset) {
                $metadata = json_decode($accepted_asset['metadata_json'], true);
                if (is_array($metadata) && !empty($metadata['source_generation_uuid']) && in_array($metadata['source_generation_uuid'], $generation_uuids, true)) {
                    return new WP_Error('project_generation_is_reference', 'Remove or replace the accepted character reference before deleting its source approval sheet.', array('status' => 409));
                }
            }
        }
        $canvas_ids = array_map('intval', $wpdb->get_col($wpdb->prepare("SELECT id FROM {$canvases} WHERE project_id = %d", (int) $project['id'])));
        $job_ids = array_map('intval', $wpdb->get_col($wpdb->prepare("SELECT job_id FROM {$generations} WHERE project_id = %d AND job_id IS NOT NULL", (int) $project['id'])));
        $job_rows = $wpdb->get_results("SELECT id, status, payload_json FROM {$jobs}", ARRAY_A);
        foreach ($job_rows as $job_row) {
            $payload = json_decode($job_row['payload_json'], true);
            if (is_array($payload) && isset($payload['project_id']) && (int) $payload['project_id'] === (int) $project['id']) {
                if (!in_array($job_row['status'], array('completed', 'failed', 'blocked', 'cancelled'), true)) {
                    return new WP_Error('project_jobs_active', 'This creation still has an active job. Cancel it or wait for it to finish before deleting the set.', array('status' => 409));
                }
                $job_ids[] = (int) $job_row['id'];
            }
        }
        $job_ids = array_values(array_unique(array_filter($job_ids)));
        $asset_conditions = array($wpdb->prepare("(owner_type = 'project' AND owner_id = %d)", (int) $project['id']));
        if ($generation_ids) {
            $asset_conditions[] = "(owner_type = 'generation' AND owner_id IN (" . implode(',', $generation_ids) . '))';
        }
        if ($canvas_ids) {
            $asset_conditions[] = "(owner_type = 'canvas' AND owner_id IN (" . implode(',', $canvas_ids) . '))';
        }
        if ($job_ids) {
            $asset_conditions[] = "(owner_type = 'job' AND owner_id IN (" . implode(',', $job_ids) . '))';
        }
        $asset_ids = $wpdb->get_col('SELECT id FROM ' . SBS_DB::table('assets') . ' WHERE ' . implode(' OR ', $asset_conditions));
        foreach ($asset_ids as $asset_id) {
            $deleted = SBS_Storage::delete_asset((int) $asset_id);
            if (is_wp_error($deleted)) {
                return $deleted;
            }
        }
        if ($job_ids) {
            $ids = implode(',', $job_ids);
            $wpdb->query($wpdb->prepare("UPDATE {$usage} SET job_id = NULL, pack_version_id = COALESCE(pack_version_id, %d) WHERE job_id IN ({$ids})", (int) $project['pack_version_id']));
            $wpdb->query("DELETE FROM {$jobs} WHERE id IN ({$ids})");
        }
        $wpdb->delete($generations, array('project_id' => (int) $project['id']), array('%d'));
        $wpdb->delete($canvases, array('project_id' => (int) $project['id']), array('%d'));
        $wpdb->delete(SBS_DB::table('projects'), array('id' => (int) $project['id']), array('%d'));
        return rest_ensure_response(array('deleted' => true, 'uuid' => $project['uuid']));
    }

    public static function delete_generation($request)
    {
        global $wpdb;
        $generation = SBS_DB::row_by_uuid('generations', sanitize_text_field($request['uuid']));
        if (!$generation) {
            return new WP_Error('missing_generation', 'Creation not found.', array('status' => 404));
        }
        $accepted_assets = $wpdb->get_results("SELECT metadata_json FROM " . SBS_DB::table('assets') . " WHERE owner_type = 'pack_version' AND metadata_json IS NOT NULL", ARRAY_A);
        foreach ($accepted_assets as $accepted_asset) {
            $metadata = json_decode($accepted_asset['metadata_json'], true);
            if (is_array($metadata) && !empty($metadata['source_generation_uuid']) && $metadata['source_generation_uuid'] === $generation['uuid']) {
                return new WP_Error('generation_is_reference', 'Remove or replace the accepted character reference before deleting its source development image.', array('status' => 409));
            }
        }
        $jobs = SBS_DB::table('jobs');
        $active_rows = $wpdb->get_results("SELECT payload_json FROM {$jobs} WHERE status NOT IN ('completed','failed','blocked','cancelled')", ARRAY_A);
        foreach ($active_rows as $active_row) {
            $payload = json_decode($active_row['payload_json'], true);
            if (is_array($payload) && ((!empty($payload['parent_id']) && (int) $payload['parent_id'] === (int) $generation['id']) || (!empty($payload['generation_id']) && (int) $payload['generation_id'] === (int) $generation['id']))) {
                return new WP_Error('generation_in_use', 'This image is being used by an active job. Cancel it or wait for it to finish before deleting the image.', array('status' => 409));
            }
        }
        if (!empty($generation['output_asset_id'])) {
            $deleted = SBS_Storage::delete_asset((int) $generation['output_asset_id']);
            if (is_wp_error($deleted)) {
                return $deleted;
            }
        }
        if (!empty($generation['job_id'])) {
            $job_result = $wpdb->get_var($wpdb->prepare("SELECT result_json FROM {$jobs} WHERE id = %d", (int) $generation['job_id']));
            $job_result = $job_result ? json_decode($job_result, true) : array();
            if (!is_array($job_result)) {
                $job_result = array();
            }
            unset($job_result['asset_uuid'], $job_result['generation_id']);
            $job_result['artwork_removed'] = true;
            $wpdb->update($jobs, array('result_json' => wp_json_encode($job_result)), array('id' => (int) $generation['job_id']));
        }
        $table = SBS_DB::table('generations');
        $wpdb->update($table, array('parent_id' => null), array('parent_id' => (int) $generation['id']), array('%d'), array('%d'));
        $wpdb->delete($table, array('id' => (int) $generation['id']), array('%d'));
        $projects = SBS_DB::table('projects');
        $current = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$table} WHERE project_id = %d ORDER BY created_at DESC, id DESC LIMIT 1", (int) $generation['project_id']));
        $project_row = $wpdb->get_row($wpdb->prepare("SELECT concept_json FROM {$projects} WHERE id = %d", (int) $generation['project_id']), ARRAY_A);
        $project_update = array('current_generation_id' => $current ? (int) $current : null, 'updated_at' => current_time('mysql', true));
        if ($project_row) {
            $concept = json_decode($project_row['concept_json'], true);
            if (is_array($concept) && !empty($concept['selected_seed_uuid']) && $concept['selected_seed_uuid'] === $generation['uuid']) {
                $concept['selected_seed_uuid'] = '';
                $concept['stage'] = 'concepts';
                $project_update['concept_json'] = wp_json_encode($concept);
            }
        }
        $wpdb->update($projects, $project_update, array('id' => (int) $generation['project_id']));
        return rest_ensure_response(array('deleted' => true, 'uuid' => $generation['uuid']));
    }

    public static function generate($request)
    {
        global $wpdb;
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request->get_param('project_uuid')));
        if (!$project) {
            return new WP_Error('missing_project', 'Project not found.', array('status' => 404));
        }
        $versions = SBS_DB::table('pack_versions');
        $version = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$versions} WHERE id = %d", (int) $project['pack_version_id']), ARRAY_A);
        $identity = json_decode($version['identity_json'], true);
        $scene = sanitize_textarea_field($request->get_param('prompt'));
        $boundary = self::validate_scene($scene);
        if (is_wp_error($boundary)) {
            return $boundary;
        }
        $parent = null;
        $parent_uuid = sanitize_text_field($request->get_param('parent_uuid'));
        if ($parent_uuid) {
            $parent = SBS_DB::row_by_uuid('generations', $parent_uuid);
            if (!$parent || (int) $parent['project_id'] !== (int) $project['id']) {
                return new WP_Error('invalid_parent', 'The selected parent generation is invalid.', array('status' => 400));
            }
        }
        $action = $parent ? 'edit' : 'generate';
        $prompt = self::compose_prompt($identity, $scene, $action);
        $asset_ids = array();
        if ($parent && $parent['output_asset_id']) {
            $asset_ids[] = (int) $parent['output_asset_id'];
        }
        $assets = SBS_DB::table('assets');
        $reference_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d AND role <> 'logo' ORDER BY CASE role WHEN 'face' THEN 1 WHEN 'full_body' THEN 2 WHEN 'master_reference' THEN 3 WHEN 'generated_reference' THEN 4 WHEN 'outfit' THEN 5 WHEN 'style' THEN 6 ELSE 9 END, id ASC LIMIT 8", (int) $version['id']));
        $asset_ids = array_merge($asset_ids, array_map('intval', $reference_ids));
        $count = $parent ? 1 : max(1, min(4, (int) ($request->get_param('count') ?: 4)));
        $quality = sanitize_key($request->get_param('quality') ?: 'medium');
        $size = sanitize_text_field($request->get_param('size') ?: '1024x1024');
        $background = $request->get_param('background') === 'transparent' ? 'transparent' : 'opaque';
        $purpose = sanitize_key($request->get_param('purpose') ?: 'scene');
        $allowed_purposes = array('scene', 'character_approval', 'development_concept', 'development_concept_refinement', 'development_reference_face', 'development_reference_full_body', 'development_reference_expression', 'development_reference_outfit', 'development_reference_style');
        if (!in_array($purpose, $allowed_purposes, true)) {
            $purpose = 'scene';
        }
        $jobs = array();
        for ($i = 0; $i < $count; $i++) {
            $job = self::create_provider_job('generation', 'openai', array(
                'project_id' => (int) $project['id'],
                'parent_id' => $parent ? (int) $parent['id'] : null,
                'prompt' => $prompt,
                'scene_prompt' => $scene,
                'asset_ids' => $asset_ids,
                'action' => $action,
                'quality' => $quality,
                'size' => $size,
                'background' => $background,
                'model' => SBS_OpenAI::image_model(),
                'purpose' => $purpose,
            ));
            if (is_wp_error($job)) {
                return $job;
            }
            $submitted = SBS_OpenAI::submit_image($prompt, $asset_ids, array('action' => $action, 'quality' => $quality, 'size' => $size, 'background' => $background));
            if (is_wp_error($submitted)) {
                self::fail_job($job['id'], $submitted);
                $jobs[] = self::job_by_id($job['id']);
                continue;
            }
            $wpdb->update(SBS_DB::table('jobs'), array(
                'status' => isset($submitted['status']) ? sanitize_key($submitted['status']) : 'submitted',
                'external_id' => isset($submitted['id']) ? sanitize_text_field($submitted['id']) : '',
                'result_json' => wp_json_encode(array('submitted' => $submitted)),
                'progress' => 5,
                'updated_at' => current_time('mysql', true),
            ), array('id' => $job['id']));
            $jobs[] = self::job_by_id($job['id']);
        }
        return rest_ensure_response(array('jobs' => array_map(array(__CLASS__, 'present_job'), $jobs), 'effective_prompt' => $prompt));
    }

    public static function upscale($request)
    {
        global $wpdb;
        $generation = SBS_DB::row_by_uuid('generations', sanitize_text_field($request->get_param('generation_uuid')));
        if (!$generation || !$generation['output_asset_id']) {
            return new WP_Error('missing_generation', 'Choose a completed generation to upscale.', array('status' => 404));
        }
        $scale = in_array((int) $request->get_param('scale'), array(2, 4), true) ? (int) $request->get_param('scale') : 2;
        $job = self::create_provider_job('upscale', 'replicate', array(
            'generation_id' => (int) $generation['id'],
            'project_id' => (int) $generation['project_id'],
            'asset_id' => (int) $generation['output_asset_id'],
            'scale' => $scale,
        ));
        if (is_wp_error($job)) {
            return $job;
        }
        $submitted = SBS_Replicate::submit((int) $generation['output_asset_id'], $scale);
        if (is_wp_error($submitted)) {
            self::fail_job($job['id'], $submitted);
            return $submitted;
        }
        $wpdb->update(SBS_DB::table('jobs'), array(
            'status' => in_array($submitted['status'] ?? '', array('succeeded', 'failed', 'canceled'), true) ? sanitize_key($submitted['status']) : 'running',
            'external_id' => sanitize_text_field($submitted['id'] ?? ''),
            'result_json' => wp_json_encode(array('submitted' => $submitted)),
            'progress' => 10,
            'updated_at' => current_time('mysql', true),
        ), array('id' => $job['id']));
        return rest_ensure_response(self::present_job(self::job_by_id($job['id'])));
    }

    public static function job($request)
    {
        $job = SBS_DB::row_by_uuid('jobs', $request['uuid']);
        if (!$job) {
            return new WP_Error('missing_job', 'Job not found.', array('status' => 404));
        }
        if (!in_array($job['status'], array('completed', 'failed', 'blocked', 'cancelled'), true)) {
            $job = self::poll_job($job);
        }
        return is_wp_error($job) ? $job : rest_ensure_response(self::present_job($job));
    }

    public static function cancel_job($request)
    {
        global $wpdb;
        $job = SBS_DB::row_by_uuid('jobs', $request['uuid']);
        if (!$job) {
            return new WP_Error('missing_job', 'Job not found.', array('status' => 404));
        }
        if (in_array($job['status'], array('completed', 'failed', 'blocked', 'cancelled'), true)) {
            return rest_ensure_response(self::present_job($job));
        }
        if ($job['external_id']) {
            $cancelled = $job['provider'] === 'openai' ? SBS_OpenAI::cancel($job['external_id']) : ($job['provider'] === 'replicate' ? SBS_Replicate::cancel($job['external_id']) : true);
            if (is_wp_error($cancelled)) {
                return $cancelled;
            }
        }
        $wpdb->update(SBS_DB::table('jobs'), array('status' => 'cancelled', 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
        return rest_ensure_response(self::present_job(self::job_by_id((int) $job['id'])));
    }

    public static function upload_asset($request)
    {
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_Error('missing_file', 'Choose a file.', array('status' => 400));
        }
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request->get_param('project_uuid')));
        if (!$project) {
            return new WP_Error('missing_project', 'Choose a project before uploading a canvas asset.', array('status' => 400));
        }
        $owner_id = (int) $project['id'];
        $asset = SBS_Storage::store_upload($files['file'], 'project', $owner_id, sanitize_key($request->get_param('role') ?: 'canvas_asset'), sanitize_text_field($request->get_param('label')));
        return is_wp_error($asset) ? $asset : rest_ensure_response($asset);
    }

    public static function canvases($request)
    {
        global $wpdb;
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request->get_param('project_uuid')));
        if (!$project) {
            return rest_ensure_response(array());
        }
        $table = SBS_DB::table('canvases');
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$table} WHERE project_id = %d ORDER BY updated_at DESC", (int) $project['id']), ARRAY_A);
        return rest_ensure_response(array_map(array(__CLASS__, 'present_canvas'), $rows));
    }

    public static function canvas($request)
    {
        $row = SBS_DB::row_by_uuid('canvases', $request['uuid']);
        return $row ? rest_ensure_response(self::present_canvas($row)) : new WP_Error('missing_canvas', 'Canvas not found.', array('status' => 404));
    }

    public static function delete_canvas($request)
    {
        global $wpdb;
        $row = SBS_DB::row_by_uuid('canvases', sanitize_text_field($request['uuid']));
        if (!$row) {
            return new WP_Error('missing_canvas', 'Saved design not found.', array('status' => 404));
        }
        $assets = SBS_DB::table('assets');
        $asset_ids = $wpdb->get_col($wpdb->prepare("SELECT id FROM {$assets} WHERE owner_type = 'canvas' AND owner_id = %d", (int) $row['id']));
        foreach ($asset_ids as $asset_id) {
            $deleted = SBS_Storage::delete_asset((int) $asset_id);
            if (is_wp_error($deleted)) {
                return $deleted;
            }
        }
        $wpdb->delete(SBS_DB::table('canvases'), array('id' => (int) $row['id']), array('%d'));
        $wpdb->update(SBS_DB::table('projects'), array('updated_at' => current_time('mysql', true)), array('id' => (int) $row['project_id']));
        return rest_ensure_response(array('deleted' => true, 'uuid' => $row['uuid']));
    }

    public static function save_canvas($request)
    {
        global $wpdb;
        $project = SBS_DB::row_by_uuid('projects', sanitize_text_field($request->get_param('project_uuid')));
        if (!$project) {
            return new WP_Error('missing_project', 'Project not found.', array('status' => 404));
        }
        $pack_uuid = sanitize_text_field($request->get_param('pack_uuid'));
        if ($pack_uuid) {
            $actual_pack = $wpdb->get_var($wpdb->prepare('SELECT p.uuid FROM ' . SBS_DB::table('pack_versions') . ' v JOIN ' . SBS_DB::table('packs') . ' p ON p.id = v.pack_id WHERE v.id = %d', (int) $project['pack_version_id']));
            if (!$actual_pack || !hash_equals((string) $actual_pack, $pack_uuid)) {
                return new WP_Error('canvas_character_mismatch', 'The selected creation does not belong to the current character.', array('status' => 409));
            }
        }
        $document = $request->get_param('document');
        if (!is_array($document) || empty($document['schema_version']) || empty($document['fabric'])) {
            return new WP_Error('invalid_canvas', 'The canvas document is invalid.', array('status' => 400));
        }
        $table = SBS_DB::table('canvases');
        $uuid = sanitize_text_field($request->get_param('uuid'));
        $existing = $uuid ? SBS_DB::row_by_uuid('canvases', $uuid) : null;
        if ($existing && (int) $existing['project_id'] !== (int) $project['id']) {
            return new WP_Error('canvas_project_mismatch', 'This saved design belongs to a different creation.', array('status' => 409));
        }
        $now = current_time('mysql', true);
        $data = array(
            'project_id' => (int) $project['id'],
            'name' => sanitize_text_field($request->get_param('name') ?: 'Merch design'),
            'document_json' => wp_json_encode($document),
            'updated_at' => $now,
        );
        if ($existing) {
            $wpdb->update($table, $data, array('id' => (int) $existing['id']));
            $id = (int) $existing['id'];
        } else {
            $uuid = wp_generate_uuid4();
            $data['uuid'] = $uuid;
            $data['created_at'] = $now;
            $wpdb->insert($table, $data);
            $id = (int) $wpdb->insert_id;
        }
        $preview = (string) $request->get_param('preview');
        if (preg_match('#^data:image/png;base64,#', $preview)) {
            $bytes = base64_decode(substr($preview, strpos($preview, ',') + 1), true);
            if ($bytes !== false && strlen($bytes) <= 25 * 1024 * 1024) {
                $asset = SBS_Storage::store_bytes($bytes, 'canvas-preview.png', 'image/png', 'canvas', $id, 'preview', 'Canvas preview');
                if (!is_wp_error($asset)) {
                    $old_preview_id = $existing && !empty($existing['preview_asset_id']) ? (int) $existing['preview_asset_id'] : 0;
                    $wpdb->update($table, array('preview_asset_id' => (int) $asset['id']), array('id' => $id));
                    if ($old_preview_id && $old_preview_id !== (int) $asset['id']) {
                        SBS_Storage::delete_asset($old_preview_id);
                    }
                }
            }
        }
        $wpdb->update(SBS_DB::table('projects'), array('updated_at' => $now), array('id' => (int) $project['id']));
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$table} WHERE id = %d", $id), ARRAY_A);
        return rest_ensure_response(self::present_canvas($row));
    }

    public static function usage($request)
    {
        return rest_ensure_response(self::usage_summary(true, sanitize_text_field($request->get_param('pack_uuid'))));
    }

    public static function create_export($request)
    {
        $scope = $request->get_param('scope') === 'project' ? 'project' : 'workspace';
        $job = SBS_Portability::queue_export($scope, sanitize_text_field($request->get_param('project_uuid')));
        return is_wp_error($job) ? $job : rest_ensure_response($job);
    }

    private static function poll_job($job)
    {
        global $wpdb;
        if (!$job['external_id']) {
            return $job;
        }
        if ($job['provider'] === 'openai') {
            $response = SBS_OpenAI::poll($job['external_id']);
            if (is_wp_error($response)) {
                if ((int) ($response->get_error_data()['status'] ?? 0) >= 500 || $response->get_error_code() === 'http_request_failed') {
                    return $job;
                }
                self::fail_job((int) $job['id'], $response);
                return self::job_by_id((int) $job['id']);
            }
            $parsed = SBS_OpenAI::parse_image_response($response);
            if (in_array($parsed['status'], array('queued', 'in_progress'), true)) {
                $wpdb->update(SBS_DB::table('jobs'), array('status' => $parsed['status'] === 'queued' ? 'submitted' : 'running', 'progress' => $parsed['status'] === 'queued' ? 10 : 55, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
                return self::job_by_id((int) $job['id']);
            }
            if ($parsed['status'] !== 'completed') {
                $error = $parsed['error'];
                $status = (($error['code'] ?? '') === 'moderation_blocked') ? 'blocked' : 'failed';
                $wpdb->update(SBS_DB::table('jobs'), array('status' => $status, 'error_json' => wp_json_encode($error), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
                return self::job_by_id((int) $job['id']);
            }
            self::complete_openai_job($job, $parsed);
            return self::job_by_id((int) $job['id']);
        }
        if ($job['provider'] === 'replicate') {
            $response = SBS_Replicate::poll($job['external_id']);
            if (is_wp_error($response)) {
                return $job;
            }
            $status = $response['status'] ?? 'processing';
            if (in_array($status, array('starting', 'processing'), true)) {
                $wpdb->update(SBS_DB::table('jobs'), array('status' => 'running', 'progress' => 60, 'result_json' => wp_json_encode($response), 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
                return self::job_by_id((int) $job['id']);
            }
            if ($status !== 'succeeded') {
                $wpdb->update(SBS_DB::table('jobs'), array('status' => $status === 'canceled' ? 'cancelled' : 'failed', 'error_json' => wp_json_encode(array('message' => $response['error'] ?? 'Upscale failed.')), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
                return self::job_by_id((int) $job['id']);
            }
            self::complete_replicate_job($job, $response);
            return self::job_by_id((int) $job['id']);
        }
        return $job;
    }

    private static function complete_openai_job($job, $parsed)
    {
        global $wpdb;
        $payload = json_decode($job['payload_json'], true);
        if (!function_exists('getimagesizefromstring') || !@getimagesizefromstring($parsed['bytes'])) {
            self::fail_job((int) $job['id'], new WP_Error('invalid_generated_image', 'OpenAI returned data that was not a valid image.'));
            return;
        }
        $asset = SBS_Storage::store_bytes($parsed['bytes'], 'generated-' . $job['uuid'] . '.png', 'image/png', 'job', (int) $job['id'], 'generation', 'Generated artwork', array('openai_response_id' => $parsed['response_id']));
        if (is_wp_error($asset)) {
            self::fail_job((int) $job['id'], $asset);
            return;
        }
        $cost = SBS_OpenAI::estimate_cost($parsed['usage']);
        $wpdb->insert(SBS_DB::table('generations'), array(
            'uuid' => wp_generate_uuid4(),
            'project_id' => (int) $payload['project_id'],
            'parent_id' => !empty($payload['parent_id']) ? (int) $payload['parent_id'] : null,
            'job_id' => (int) $job['id'],
            'action' => sanitize_key($payload['action']),
            'provider' => 'openai',
            'model' => sanitize_text_field($payload['model']),
            'prompt' => $payload['prompt'],
            'revised_prompt' => $parsed['revised_prompt'],
            'refs_json' => wp_json_encode(self::reference_snapshots($payload['asset_ids'])),
            'output_asset_id' => (int) $asset['id'],
            'quality' => sanitize_key($payload['quality']),
            'size' => sanitize_text_field($payload['size']),
            'usage_json' => wp_json_encode($parsed['usage']),
            'cost_estimate' => $cost,
            'created_at' => current_time('mysql', true),
        ));
        $generation_id = (int) $wpdb->insert_id;
        $wpdb->update(SBS_DB::table('assets'), array('owner_type' => 'generation', 'owner_id' => $generation_id), array('id' => (int) $asset['id']));
        $wpdb->update(SBS_DB::table('projects'), array('current_generation_id' => $generation_id, 'updated_at' => current_time('mysql', true)), array('id' => (int) $payload['project_id']));
        $wpdb->update(SBS_DB::table('jobs'), array('status' => 'completed', 'result_json' => wp_json_encode(array('generation_id' => $generation_id, 'asset_uuid' => $asset['uuid'], 'response_id' => $parsed['response_id'])), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
        $project = $wpdb->get_row($wpdb->prepare('SELECT pack_version_id FROM ' . SBS_DB::table('projects') . ' WHERE id = %d', (int) $payload['project_id']), ARRAY_A);
        self::record_usage((int) $job['id'], 'openai', 'image_generation', 1, 'image', $cost, $parsed['usage'], $project ? (int) $project['pack_version_id'] : null);
    }

    private static function complete_replicate_job($job, $response)
    {
        global $wpdb;
        $payload = json_decode($job['payload_json'], true);
        $url = is_array($response['output'] ?? null) ? reset($response['output']) : ($response['output'] ?? '');
        $bytes = SBS_Replicate::fetch_output($url);
        if (is_wp_error($bytes)) {
            self::fail_job((int) $job['id'], $bytes);
            return;
        }
        if (!function_exists('getimagesizefromstring') || !@getimagesizefromstring($bytes)) {
            self::fail_job((int) $job['id'], new WP_Error('invalid_upscale_image', 'The upscale provider returned data that was not a valid image.'));
            return;
        }
        $asset = SBS_Storage::store_bytes($bytes, 'upscaled-' . $job['uuid'] . '.png', 'image/png', 'job', (int) $job['id'], 'upscale', 'AI upscale');
        if (is_wp_error($asset)) {
            self::fail_job((int) $job['id'], $asset);
            return;
        }
        $parent = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . SBS_DB::table('generations') . ' WHERE id = %d', (int) $payload['generation_id']), ARRAY_A);
        $cost = (float) get_option('sbs_replicate_cost_per_image', '0.002');
        $wpdb->insert(SBS_DB::table('generations'), array(
            'uuid' => wp_generate_uuid4(), 'project_id' => (int) $payload['project_id'], 'parent_id' => (int) $parent['id'], 'job_id' => (int) $job['id'],
            'action' => 'upscale', 'provider' => 'replicate', 'model' => 'nightmareai/real-esrgan', 'prompt' => $parent['prompt'], 'revised_prompt' => '',
            'refs_json' => wp_json_encode(self::reference_snapshots(array((int) $payload['asset_id']))), 'output_asset_id' => (int) $asset['id'], 'quality' => $payload['scale'] . 'x', 'size' => 'upscaled',
            'usage_json' => wp_json_encode($response['metrics'] ?? array()), 'cost_estimate' => $cost, 'created_at' => current_time('mysql', true),
        ));
        $generation_id = (int) $wpdb->insert_id;
        $wpdb->update(SBS_DB::table('assets'), array('owner_type' => 'generation', 'owner_id' => $generation_id), array('id' => (int) $asset['id']));
        $wpdb->update(SBS_DB::table('projects'), array('current_generation_id' => $generation_id, 'updated_at' => current_time('mysql', true)), array('id' => (int) $payload['project_id']));
        $wpdb->update(SBS_DB::table('jobs'), array('status' => 'completed', 'result_json' => wp_json_encode(array('generation_id' => $generation_id, 'asset_uuid' => $asset['uuid'], 'prediction' => $response)), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $job['id']));
        $project = $wpdb->get_row($wpdb->prepare('SELECT pack_version_id FROM ' . SBS_DB::table('projects') . ' WHERE id = %d', (int) $payload['project_id']), ARRAY_A);
        self::record_usage((int) $job['id'], 'replicate', 'upscale', 1, 'image', $cost, $response['metrics'] ?? array(), $project ? (int) $project['pack_version_id'] : null);
    }

    private static function create_provider_job($type, $provider, $payload)
    {
        global $wpdb;
        $now = current_time('mysql', true);
        $uuid = wp_generate_uuid4();
        $ok = $wpdb->insert(SBS_DB::table('jobs'), array(
            'uuid' => $uuid, 'type' => $type, 'status' => 'queued', 'provider' => $provider, 'external_id' => null,
            'payload_json' => wp_json_encode($payload), 'result_json' => null, 'error_json' => null, 'progress' => 0, 'created_at' => $now, 'updated_at' => $now,
        ));
        return $ok ? array('id' => (int) $wpdb->insert_id, 'uuid' => $uuid) : new WP_Error('job_create_failed', 'Could not create the background job.');
    }

    private static function fail_job($id, $error)
    {
        global $wpdb;
        $data = is_wp_error($error) ? array('code' => $error->get_error_code(), 'message' => $error->get_error_message(), 'details' => $error->get_error_data()) : (array) $error;
        $status = ($data['code'] ?? '') === 'moderation_blocked' ? 'blocked' : 'failed';
        $wpdb->update(SBS_DB::table('jobs'), array('status' => $status, 'error_json' => wp_json_encode($data), 'progress' => 100, 'updated_at' => current_time('mysql', true)), array('id' => (int) $id));
    }

    private static function compose_prompt($identity, $scene, $action)
    {
        $traits = implode("\n- ", array_map('sanitize_text_field', (array) ($identity['locked_traits'] ?? array())));
        $exclusions = implode("\n- ", array_map('sanitize_text_field', (array) ($identity['exclusions'] ?? array())));
        $summary = sanitize_textarea_field($identity['summary'] ?? '');
        $humour = sanitize_textarea_field($identity['humour_boundary'] ?? '');
        $palette = implode(', ', array_map('sanitize_text_field', (array) ($identity['palette'] ?? array())));
        $verb = $action === 'edit' ? 'Edit Image 1 while preserving the exact character identity and everything not requested below.' : 'Draw a new merchandise-ready illustration using the supplied character and style references.';
        return $verb . "\n\nCHARACTER SUMMARY:\n" . $summary
            . "\n\nLOCKED CHARACTER IDENTITY — MUST PRESERVE:\n- " . $traits
            . "\n\nAPPROVED PALETTE:\n" . $palette
            . "\n\nSCENE REQUEST:\n" . $scene
            . "\n\nHOUSE TONE:\n" . ($humour ? $humour . "\n" : '') . "Clearly adult, cheeky, confident and bawdy. Strong innuendo is welcome, but the image must remain non-explicit: no visible genitals and no depicted sex acts."
            . "\n\nDO NOT USE:\n- " . $exclusions
            . "\n\nOUTPUT CONSTRAINTS:\nOne polished illustration. Preserve the supplied hand-inked vintage print style, facial identity, body proportions and palette. No added words, signatures, watermarks or redrawn logos. Keep important artwork clear of the outer 6% trim-safe margin.";
    }

    private static function validate_scene($scene)
    {
        $lower = strtolower($scene);
        if (preg_match('/\b(child|children|kid|kids|minor|underage|schoolgirl|schoolboy|teen|teenage|cub)\b/i', $lower)) {
            return new WP_Error('adult_only', 'All characters in this studio must be unambiguously adult.', array('status' => 400));
        }

        // Generated concepts often restate the boundary (for example, "no visible
        // genitals"). Remove clear negative constraints before checking for an
        // affirmative request; otherwise safe prompts are rejected by their own
        // safety wording.
        $negative_clause = '/\b(?:no|without)\b(?:(?!\b(?:but|however|although)\b)[^.;\r\n])*(?:[.;]|$)/i';
        $affirmative = preg_replace($negative_clause, '', $lower);
        $negative_boundary = '/\b(?:avoid(?:ing)?|exclude(?:s|d|ing)?|never\s+(?:show|showing|depict|depicting|include|including)|not\s+(?:showing|depicting|including)|do\s+not\s+(?:show|depict|include)|must\s+not\s+(?:show|depict|include))\s+(?:(?:any|actual|depicted|visible|explicit|graphic|sexual)\s+){0,4}(?:genitals?|penetration|sexual\s+intercourse|sex\s+acts?|sexual\s+acts?|explicit\s+sex|oral\s+sex|anal\s+sex|masturbat(?:e|es|ed|ing|ion))\b/i';
        $affirmative = preg_replace($negative_boundary, '', $affirmative);
        if (preg_match('/\b(visible genitals?|penetration|sexual intercourse|explicit sex|oral sex|anal sex|masturbat(?:e|es|ed|ing|ion))\b/i', $affirmative)) {
            return new WP_Error('non_explicit_only', 'Keep the request to strong innuendo without visible genitals or depicted sex acts.', array('status' => 400));
        }
        return true;
    }

    private static function pack_list()
    {
        global $wpdb;
        $packs = $wpdb->get_results('SELECT * FROM ' . SBS_DB::table('packs') . ' ORDER BY updated_at DESC', ARRAY_A);
        return array_map(function ($pack) { return self::pack_by_uuid($pack['uuid']); }, $packs);
    }

    private static function pack_by_uuid($uuid, $raw = false)
    {
        global $wpdb;
        $packs = SBS_DB::table('packs');
        $versions = SBS_DB::table('pack_versions');
        $row = $wpdb->get_row($wpdb->prepare("SELECT p.*, v.id AS version_id, v.uuid AS version_uuid, v.status AS version_status, v.identity_json, v.locked_at FROM {$packs} p JOIN {$versions} v ON v.pack_id = p.id AND v.version = p.current_version WHERE p.uuid = %s", $uuid), ARRAY_A);
        if (!$row) {
            return null;
        }
        if ($raw) {
            return $row;
        }
        $assets = SBS_DB::table('assets');
        $asset_rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$assets} WHERE owner_type = 'pack_version' AND owner_id = %d ORDER BY id ASC", (int) $row['version_id']), ARRAY_A);
        $row['id'] = (int) $row['id'];
        $row['version_id'] = (int) $row['version_id'];
        $row['current_version'] = (int) $row['current_version'];
        $row['identity'] = json_decode($row['identity_json'], true);
        $row['assets'] = array_map(array('SBS_Storage', 'present'), $asset_rows);
        unset($row['identity_json']);
        return $row;
    }

    private static function project_list()
    {
        global $wpdb;
        $rows = $wpdb->get_results('SELECT uuid FROM ' . SBS_DB::table('projects') . ' ORDER BY updated_at DESC', ARRAY_A);
        return array_values(array_filter(array_map(function ($row) { return self::project_by_uuid($row['uuid']); }, $rows)));
    }

    private static function active_job_list()
    {
        global $wpdb;
        $table = SBS_DB::table('jobs');
        $rows = $wpdb->get_results("SELECT * FROM {$table} WHERE status NOT IN ('completed','failed','blocked','cancelled') AND type IN ('generation','upscale','export') ORDER BY created_at ASC LIMIT 100", ARRAY_A);
        return array_map(array(__CLASS__, 'present_job'), $rows);
    }

    private static function project_by_uuid($uuid)
    {
        global $wpdb;
        $project = SBS_DB::row_by_uuid('projects', $uuid);
        if (!$project) {
            return null;
        }
        $generations_table = SBS_DB::table('generations');
        $assets_table = SBS_DB::table('assets');
        $jobs_table = SBS_DB::table('jobs');
        $generations = $wpdb->get_results($wpdb->prepare("SELECT g.*, a.uuid AS asset_uuid, a.filename AS asset_filename, j.payload_json AS job_payload_json FROM {$generations_table} g LEFT JOIN {$assets_table} a ON a.id = g.output_asset_id LEFT JOIN {$jobs_table} j ON j.id = g.job_id WHERE g.project_id = %d ORDER BY g.created_at DESC", (int) $project['id']), ARRAY_A);
        foreach ($generations as &$generation) {
            $generation['id'] = (int) $generation['id'];
            $generation['parent_id'] = $generation['parent_id'] ? (int) $generation['parent_id'] : null;
            $generation['cost_estimate'] = (float) $generation['cost_estimate'];
            $generation['asset_url'] = $generation['asset_uuid'] ? home_url('/' . SBS_Plugin::studio_slug() . '/asset/' . $generation['asset_uuid'] . '/') : '';
            $generation['usage'] = json_decode($generation['usage_json'], true);
            $job_payload = !empty($generation['job_payload_json']) ? json_decode($generation['job_payload_json'], true) : array();
            $generation['purpose'] = is_array($job_payload) && !empty($job_payload['purpose']) ? sanitize_key($job_payload['purpose']) : 'scene';
            unset($generation['usage_json'], $generation['job_payload_json']);
        }
        unset($generation);
        $version = $wpdb->get_row($wpdb->prepare('SELECT v.*, p.uuid AS pack_uuid, p.name AS pack_name FROM ' . SBS_DB::table('pack_versions') . ' v JOIN ' . SBS_DB::table('packs') . ' p ON p.id = v.pack_id WHERE v.id = %d', (int) $project['pack_version_id']), ARRAY_A);
        $project['id'] = (int) $project['id'];
        $project['pack_version_id'] = (int) $project['pack_version_id'];
        $project['concept'] = json_decode($project['concept_json'], true);
        $project['generations'] = $generations;
        $project_jobs = array();
        if (is_array($project['concept']) && !empty($project['concept']['type']) && in_array($project['concept']['type'], array('character_visual_development', 'character_pack_test'), true)) {
            $job_pattern = '%' . $wpdb->esc_like('"project_id":' . (int) $project['id'] . ',') . '%';
            $all_job_rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$jobs_table} WHERE payload_json LIKE %s ORDER BY created_at ASC", $job_pattern), ARRAY_A);
            foreach ($all_job_rows as $job_row) {
                $job_payload = json_decode($job_row['payload_json'], true);
                if (is_array($job_payload) && !empty($job_payload['project_id']) && (int) $job_payload['project_id'] === (int) $project['id']) {
                    $project_jobs[] = self::present_job($job_row);
                }
            }
        }
        $project['jobs'] = $project_jobs;
        $canvas_rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . SBS_DB::table('canvases') . ' WHERE project_id = %d ORDER BY updated_at DESC', (int) $project['id']), ARRAY_A);
        $project['designs'] = array_map(array(__CLASS__, 'present_canvas'), $canvas_rows);
        $project_assets = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$assets_table} WHERE owner_type = 'project' AND owner_id = %d ORDER BY created_at ASC", (int) $project['id']), ARRAY_A);
        $project['assets'] = array_map(array('SBS_Storage', 'present'), $project_assets);
        $project['pack_uuid'] = $version ? $version['pack_uuid'] : '';
        $project['pack_name'] = $version ? $version['pack_name'] : '';
        $project['pack_version'] = $version ? (int) $version['version'] : null;
        $exact_assets = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$assets_table} WHERE owner_type = 'pack_version' AND owner_id = %d AND role = 'logo' ORDER BY created_at ASC", (int) $project['pack_version_id']), ARRAY_A);
        $project['exact_assets'] = array_map(array('SBS_Storage', 'present'), $exact_assets);
        unset($project['concept_json']);
        return $project;
    }

    private static function job_by_id($id)
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . SBS_DB::table('jobs') . ' WHERE id = %d', (int) $id), ARRAY_A);
    }

    private static function present_job($job)
    {
        global $wpdb;
        $job['id'] = (int) $job['id'];
        $job['progress'] = (int) $job['progress'];
        $job['payload'] = json_decode($job['payload_json'], true);
        $job['result'] = json_decode($job['result_json'], true);
        $job['error'] = json_decode($job['error_json'], true);
        unset($job['payload_json'], $job['result_json'], $job['error_json'], $job['external_id']);
        if (!empty($job['result']['asset_uuid'])) {
            $job['result']['asset_url'] = home_url('/' . SBS_Plugin::studio_slug() . '/asset/' . $job['result']['asset_uuid'] . '/');
        }
        if (!empty($job['result']['generation_id'])) {
            $generation_uuid = $wpdb->get_var($wpdb->prepare('SELECT uuid FROM ' . SBS_DB::table('generations') . ' WHERE id = %d', (int) $job['result']['generation_id']));
            if ($generation_uuid) {
                $job['result']['generation_uuid'] = $generation_uuid;
            }
        }
        if (!empty($job['payload']['project_id'])) {
            $character = $wpdb->get_row($wpdb->prepare('SELECT p.uuid, p.name FROM ' . SBS_DB::table('projects') . ' pr JOIN ' . SBS_DB::table('pack_versions') . ' v ON v.id = pr.pack_version_id JOIN ' . SBS_DB::table('packs') . ' p ON p.id = v.pack_id WHERE pr.id = %d', (int) $job['payload']['project_id']), ARRAY_A);
            if ($character) {
                $job['pack_uuid'] = $character['uuid'];
                $job['pack_name'] = $character['name'];
            }
        }
        return $job;
    }

    private static function present_canvas($row)
    {
        $row['id'] = (int) $row['id'];
        $row['project_id'] = (int) $row['project_id'];
        $row['document'] = json_decode($row['document_json'], true);
        unset($row['document_json']);
        if ($row['preview_asset_id']) {
            $asset = SBS_Storage::get_asset((int) $row['preview_asset_id']);
            $row['preview_url'] = $asset ? $asset['url'] : '';
        }
        return $row;
    }

    private static function record_usage($job_id, $provider, $metric, $quantity, $unit, $cost, $details, $pack_version_id = null)
    {
        global $wpdb;
        $wpdb->insert(SBS_DB::table('usage'), array(
            'job_id' => $job_id, 'pack_version_id' => $pack_version_id, 'provider' => $provider, 'metric' => $metric, 'quantity' => $quantity, 'unit' => $unit,
            'estimated_cost' => $cost, 'currency' => 'USD', 'details_json' => wp_json_encode($details), 'created_at' => current_time('mysql', true),
        ));
    }

    private static function response_data($response)
    {
        if ($response instanceof WP_REST_Response) {
            return $response->get_data();
        }
        return is_array($response) ? $response : array();
    }

    private static function generation_purpose($generation)
    {
        global $wpdb;
        if (empty($generation['job_id'])) {
            return 'scene';
        }
        $payload_json = $wpdb->get_var($wpdb->prepare('SELECT payload_json FROM ' . SBS_DB::table('jobs') . ' WHERE id = %d', (int) $generation['job_id']));
        $payload = $payload_json ? json_decode($payload_json, true) : array();
        return is_array($payload) && !empty($payload['purpose']) ? sanitize_key($payload['purpose']) : 'scene';
    }

    private static function development_reference_config()
    {
        return array(
            'face' => array(
                'label' => 'Accepted face and facial proportions',
                'purpose' => 'development_reference_face',
                'size' => '1024x1024',
                'prompt' => 'Using the selected concept as the authoritative visual seed, create a clean face reference sheet for exactly the same clearly adult character. Include a large front portrait and three-quarter portrait with identical muzzle, eyes, brows, ears, facial proportions, fur treatment and recognisable expression style. Plain warm neutral background, no body redesign, no scene, no lettering and no logos.',
            ),
            'full_body' => array(
                'label' => 'Accepted full-body turnaround',
                'purpose' => 'development_reference_full_body',
                'size' => '1536x1024',
                'prompt' => 'Using the selected concept as the authoritative visual seed, create a clean full-body turnaround for exactly the same clearly adult character. Show separated front, three-quarter, side and rear views at consistent scale with identical anatomy, proportions, tail, clothing fit and silhouette. Plain warm neutral background, no scene, no lettering and no logos.',
            ),
            'expression' => array(
                'label' => 'Accepted expression sheet',
                'purpose' => 'development_reference_expression',
                'size' => '1536x1024',
                'prompt' => 'Using the selected concept as the authoritative visual seed, create a clean expression sheet for exactly the same clearly adult character. Show separated close-ups for neutral, standard smile, cheeky grin, wink, laugh and playful confidence while preserving the exact face, muzzle, eyes, brows, ears and rendering style. Plain warm neutral background, no lettering and no logos.',
            ),
            'outfit' => array(
                'label' => 'Accepted outfit details',
                'purpose' => 'development_reference_outfit',
                'size' => '1024x1024',
                'prompt' => 'Using the selected concept as the authoritative visual seed, create a clean outfit construction reference for exactly the same clearly adult character. Show the signature outfit from front and rear plus close details of distinctive garments, fit, piping, fastenings and accessories. Preserve body proportions and illustration style. Plain warm neutral background, no scene, no lettering and no logos.',
            ),
            'style' => array(
                'label' => 'Accepted palette and illustration style',
                'purpose' => 'development_reference_style',
                'size' => '1024x1024',
                'prompt' => 'Using the selected concept as the authoritative visual seed, create a clean visual style reference for exactly the same clearly adult character. Include one faithful portrait, compact unlabelled colour swatches, and close details demonstrating the exact line work, shading, print texture, fur treatment and approved palette. Plain warm neutral background, no words and no logos.',
            ),
        );
    }

    private static function invalidate_pack_approval($version_id)
    {
        global $wpdb;
        $versions = SBS_DB::table('pack_versions');
        $identity_json = $wpdb->get_var($wpdb->prepare("SELECT identity_json FROM {$versions} WHERE id = %d", (int) $version_id));
        $identity = $identity_json ? json_decode($identity_json, true) : array();
        if (!is_array($identity)) {
            $identity = array();
        }
        $identity['tests_approved'] = false;
        $grounding_updated_at = current_time('mysql', true);
        $identity['approval_invalidated_at'] = $grounding_updated_at;
        $identity['grounding_updated_at'] = $grounding_updated_at;
        unset($identity['approved_test_generation_uuid']);
        $wpdb->update($versions, array('identity_json' => wp_json_encode($identity)), array('id' => (int) $version_id));
    }

    private static function clear_pack_approval($version_id)
    {
        global $wpdb;
        $versions = SBS_DB::table('pack_versions');
        $identity_json = $wpdb->get_var($wpdb->prepare("SELECT identity_json FROM {$versions} WHERE id = %d", (int) $version_id));
        $identity = $identity_json ? json_decode($identity_json, true) : array();
        if (!is_array($identity)) {
            $identity = array();
        }
        $identity['tests_approved'] = false;
        unset($identity['approved_test_generation_uuid'], $identity['approval_invalidated_at']);
        $wpdb->update($versions, array('identity_json' => wp_json_encode($identity)), array('id' => (int) $version_id));
    }

    private static function reference_snapshots($asset_ids)
    {
        global $wpdb;
        $table = SBS_DB::table('assets');
        $snapshots = array();
        foreach (array_unique(array_map('intval', (array) $asset_ids)) as $asset_id) {
            $row = $wpdb->get_row($wpdb->prepare("SELECT id, uuid, role, sha256 FROM {$table} WHERE id = %d", $asset_id), ARRAY_A);
            if ($row) {
                $snapshots[] = array('asset_id' => (int) $row['id'], 'uuid' => $row['uuid'], 'role' => $row['role'], 'sha256' => $row['sha256']);
            }
        }
        return $snapshots;
    }

    private static function usage_summary($include_rows = false, $pack_uuid = '')
    {
        global $wpdb;
        $table = SBS_DB::table('usage');
        $versions = SBS_DB::table('pack_versions');
        $packs = SBS_DB::table('packs');
        $joins = " FROM {$table} u LEFT JOIN {$versions} v ON v.id = u.pack_version_id LEFT JOIN {$packs} p ON p.id = v.pack_id";
        $where = $pack_uuid ? $wpdb->prepare(' WHERE p.uuid = %s', $pack_uuid) : '';
        $summary = $wpdb->get_results("SELECT u.provider, SUM(u.estimated_cost) AS estimated_cost, COUNT(*) AS operations{$joins}{$where} GROUP BY u.provider", ARRAY_A);
        $result = array('providers' => $summary, 'currency' => 'USD', 'label' => 'Usage-derived estimate');
        if ($include_rows) {
            $result['rows'] = $wpdb->get_results("SELECT u.*, p.uuid AS pack_uuid, p.name AS pack_name, v.version AS pack_version{$joins}{$where} ORDER BY u.created_at DESC LIMIT 500", ARRAY_A);
        }
        return $result;
    }

    private static function update_status_data($force_feed)
    {
        global $wp_version;
        $authorized = SBS_Auth::is_update_authenticated();
        $data = array(
            'configured' => SBS_Auth::update_access_is_configured(),
            'authorized' => $authorized,
            'installed_version' => SBS_VERSION,
            'wordpress_version' => (string) $wp_version,
            'php_version' => PHP_VERSION,
            'feed_configured' => trim((string) get_option('sbs_update_feed_url', '')) !== '',
            'trusted_key_count' => count(SBS_Updater::public_keys()),
            'session_minutes' => (int) (SBS_Auth::UPDATE_SESSION_SECONDS / MINUTE_IN_SECONDS),
        );
        if (!$authorized) {
            return $data;
        }
        $release = $data['feed_configured'] ? ((bool) $force_feed ? SBS_Updater::release_feed(true) : get_transient('sbs_release_feed')) : null;
        if (is_wp_error($release)) {
            $data['feed_error'] = $release->get_error_message();
        } elseif (is_array($release)) {
            $data['release'] = array(
                'version' => sanitize_text_field($release['version'] ?? ''),
                'requires_wp' => sanitize_text_field($release['requires_wp'] ?? ''),
                'requires_php' => sanitize_text_field($release['requires_php'] ?? ''),
                'tested' => sanitize_text_field($release['tested'] ?? ''),
                'release_notes' => sanitize_textarea_field($release['release_notes'] ?? ''),
                'available' => !empty($release['version']) && version_compare((string) $release['version'], SBS_VERSION, '>'),
            );
        }
        $data['backups'] = SBS_Updater::backups();
        $data['health_notice'] = sanitize_text_field((string) get_option('sbs_update_health_notice', ''));
        $data['audit'] = array_map(function ($row) {
            return array(
                'created_at' => sanitize_text_field($row['created_at'] ?? ''),
                'action' => sanitize_key($row['action'] ?? ''),
                'status' => sanitize_key($row['status'] ?? ''),
                'details' => isset($row['details']) && is_array($row['details']) ? $row['details'] : array(),
            );
        }, SBS_Updater::audit_records(12));
        return $data;
    }

    private static function same_origin($request)
    {
        $origin = $request instanceof WP_REST_Request ? $request->get_header('origin') : '';
        $referer = $request instanceof WP_REST_Request ? $request->get_header('referer') : '';
        $source = $origin ? $origin : $referer;
        if (!$source) {
            return true;
        }
        $expected = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
        $actual = strtolower((string) wp_parse_url($source, PHP_URL_HOST));
        return $expected && $actual && hash_equals($expected, $actual);
    }
}
