<?php
if (!defined('ABSPATH')) { exit; }

/** A small sandbox controller using the existing project, generation and job tables. */
final class SBS_Freestyle
{
    public static function register_routes()
    {
        foreach (array('' => 'turn', '/select' => 'select', '/promote' => 'promote') as $suffix => $callback) {
            register_rest_route(SBS_REST::NS, '/freestyle' . $suffix, array('methods' => 'POST', 'callback' => array(__CLASS__, $callback), 'permission_callback' => array('SBS_REST', 'permission')));
        }
    }

    public static function styles()
    {
        return array('cartoon' => 'Cartoon', 'illustration' => 'Clean illustration', 'ink-sketch' => 'Ink sketch', 'pencil-sketch' => 'Pencil sketch', 'comic' => 'Comic book', 'pop-art' => 'Pop art', 'watercolour' => 'Watercolour', 'linocut' => 'Woodcut / linocut');
    }

    public static function treatments()
    {
        return array('vintage' => 'Vintage 70/20/10', 'clean' => 'Clean solid print', 'halftone' => 'Halftone shading', 'distressed' => 'Light distressed print');
    }

    public static function settings($input)
    {
        $input = is_array($input) ? $input : array();
        $style = sanitize_key($input['style'] ?? 'cartoon');
        $treatment = sanitize_key($input['treatment'] ?? 'vintage');
        $size = sanitize_text_field($input['size'] ?? '1024x1536');
        if (!isset(self::styles()[$style]) || !isset(self::treatments()[$treatment]) || !in_array($size, array('1024x1536', '1024x1024', '1536x1024'), true)) {
            return new WP_Error('invalid_freestyle_settings', 'Choose one of the available styles, treatments and image formats.', array('status' => 400));
        }
        $width = (float) ($input['width'] ?? 15);
        $height = (float) ($input['height'] ?? 18);
        if (!is_finite($width) || !is_finite($height) || $width < 1 || $height < 1 || $width > 30 || $height > 30) {
            return new WP_Error('invalid_freestyle_print_size', 'Print width and height must be between 1 and 30 inches.', array('status' => 400));
        }
        return array('style' => $style, 'treatment' => $treatment, 'size' => $size, 'background' => ($input['background'] ?? '') === 'transparent' ? 'transparent' : 'opaque', 'width' => $width, 'height' => $height, 'dpi' => 300);
    }

    private static function data($response)
    {
        return is_wp_error($response) ? $response : ($response instanceof WP_REST_Response ? $response->get_data() : $response);
    }

    public static function project($uuid)
    {
        $request = new WP_REST_Request('GET');
        $request->set_param('uuid', $uuid);
        $project = self::data(SBS_REST::project($request));
        return !is_wp_error($project) && ($project['concept']['type'] ?? '') === 'freestyle' ? $project : new WP_Error('missing_freestyle', 'Freestyle experiment not found.', array('status' => 404));
    }

    private static function neutral_pack()
    {
        $uuid = get_option('sbs_freestyle_pack_uuid', '');
        $pack = $uuid ? SBS_DB::row_by_uuid('packs', $uuid) : null;
        if ($pack) { return $uuid; }
        $request = new WP_REST_Request('POST');
        $request->set_param('name', 'Freestyle compositions');
        $request->set_param('description', 'An independent new composition. Do not borrow any existing Studio character. Follow the complete user brief and chosen style.');
        $created = self::data(SBS_REST::create_pack($request));
        if (is_wp_error($created)) { return $created; }
        global $wpdb;
        $wpdb->update(SBS_DB::table('packs'), array('status' => 'sandbox'), array('uuid' => $created['uuid']));
        update_option('sbs_freestyle_pack_uuid', $created['uuid'], false);
        return $created['uuid'];
    }

    public static function turn($request)
    {
        global $wpdb;
        $instruction = sanitize_textarea_field($request->get_param('instruction'));
        if (strlen(trim($instruction)) < 3 || strlen($instruction) > 16000) {
            return new WP_Error('missing_freestyle_instruction', 'Enter an idea or correction between 3 and 16000 characters.', array('status' => 400));
        }
        $settings = self::settings($request->get_param('settings'));
        if (is_wp_error($settings)) { return $settings; }
        $uuid = sanitize_text_field($request->get_param('project_uuid'));
        $parent_uuid = sanitize_text_field($request->get_param('parent_uuid'));
        if ($uuid) {
            $project = self::project($uuid);
            if (is_wp_error($project)) { return $project; }
            foreach ($project['jobs'] as $job) {
                if (!in_array($job['status'], array('completed','failed','blocked','cancelled'), true)) {
                    return new WP_Error('freestyle_busy', 'Wait for the current experiment generation to finish.', array('status' => 409));
                }
            }
            if (!empty($project['generations']) && !$parent_uuid) {
                return new WP_Error('freestyle_parent_required', 'Choose an image to continue from, or start a new experiment.', array('status' => 400));
            }
        } else {
            if ($parent_uuid) { return new WP_Error('invalid_freestyle_parent', 'Start a new experiment without a source image.', array('status' => 400)); }
            $pack_uuid = sanitize_text_field($request->get_param('pack_uuid'));
            if (!$pack_uuid) { $pack_uuid = self::neutral_pack(); }
            if (is_wp_error($pack_uuid)) { return $pack_uuid; }
            $create = new WP_REST_Request('POST');
            $create->set_param('pack_uuid', $pack_uuid);
            $create->set_param('title', sanitize_text_field($request->get_param('title')) ?: 'Freestyle ' . current_time('Y-m-d H:i'));
            $create->set_param('concept', array('type'=>'freestyle', 'original_brief'=>$instruction, 'character_uuid'=>sanitize_text_field($request->get_param('pack_uuid')), 'settings'=>$settings, 'merch_ready'=>false));
            $project = self::data(SBS_REST::create_project($create));
            if (is_wp_error($project)) { return $project; }
        }
        if ($parent_uuid && !array_filter($project['generations'], function ($generation) use ($parent_uuid) { return $generation['uuid'] === $parent_uuid && !empty($generation['asset_url']); })) {
            return new WP_Error('invalid_freestyle_parent', 'Choose a completed image from this experiment.', array('status' => 400));
        }
        $concept = $project['concept'];
        $concept['settings'] = $settings;
        $wpdb->update(SBS_DB::table('projects'), array('title'=>sanitize_text_field($request->get_param('title')) ?: $project['title'], 'concept_json'=>wp_json_encode($concept), 'updated_at'=>current_time('mysql',true)), array('id'=>$project['id']));
        $generation = new WP_REST_Request('POST');
        $generation->set_param('project_uuid', $project['uuid']);
        $generation->set_param('parent_uuid', $parent_uuid);
        $generation->set_param('prompt', $instruction);
        $generation->set_param('freestyle_settings', $settings);
        $generation->set_param('purpose', 'freestyle');
        $generation->set_param('count', 1);
        $generation->set_param('quality', 'high');
        $generation->set_param('size', $settings['size']);
        $generation->set_param('background', $settings['background']);
        $generated = self::data(SBS_REST::generate($generation));
        if (is_wp_error($generated)) { return $generated; }
        return rest_ensure_response(array('project'=>self::project($project['uuid']), 'jobs'=>$generated['jobs']));
    }

    public static function select($request)
    {
        global $wpdb;
        $project = self::project(sanitize_text_field($request->get_param('project_uuid')));
        if (is_wp_error($project)) { return $project; }
        $uuid = sanitize_text_field($request->get_param('generation_uuid'));
        $selected = array_values(array_filter($project['generations'], function ($generation) use ($uuid) { return $generation['uuid'] === $uuid && !empty($generation['asset_url']); }));
        if (!$selected) { return new WP_Error('invalid_freestyle_selection', 'Choose a completed image from this experiment.', array('status'=>400)); }
        $concept = $project['concept'];
        $concept['active_generation_uuid'] = $uuid;
        $wpdb->update(SBS_DB::table('projects'), array('concept_json'=>wp_json_encode($concept)), array('id'=>$project['id']));
        return rest_ensure_response(self::project($project['uuid']));
    }

    public static function promote($request)
    {
        global $wpdb;
        if (!$request->get_param('reviewed')) { return new WP_Error('freestyle_review_required', 'Review the selected design before sending it to Creations.', array('status'=>400)); }
        $settings = self::settings($request->get_param('settings'));
        if (is_wp_error($settings)) { return $settings; }
        $selected = self::data(self::select($request));
        if (is_wp_error($selected)) { return $selected; }
        // Publishing into Creations is explicit; generation never accepts artwork.
        $concept = $selected['concept'];
        $concept['merch_ready'] = true;
        $concept['settings'] = $settings;
        $concept['visual_review_generation_uuid'] = $concept['active_generation_uuid'];
        $wpdb->update(SBS_DB::table('projects'), array('concept_json'=>wp_json_encode($concept)), array('id'=>$selected['id']));
        if (empty($concept['character_uuid'])) {
            $wpdb->update(SBS_DB::table('packs'), array('status'=>'draft'), array('uuid'=>$selected['pack_uuid'], 'status'=>'sandbox'));
        }
        return rest_ensure_response(self::project($selected['uuid']));
    }

    public static function completed($project_id, $generation_id)
    {
        global $wpdb;
        $project=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.SBS_DB::table('projects').' WHERE id = %d',(int)$project_id),ARRAY_A);
        $concept=$project?json_decode($project['concept_json'],true):array();
        if(($concept['type']??'')!=='freestyle'){return;}
        $uuid=$wpdb->get_var($wpdb->prepare('SELECT uuid FROM '.SBS_DB::table('generations').' WHERE id = %d',(int)$generation_id));
        if($uuid){$concept['active_generation_uuid']=$uuid;$wpdb->update(SBS_DB::table('projects'),array('concept_json'=>wp_json_encode($concept)),array('id'=>(int)$project_id));}
    }

    public static function compose_prompt($identity, $instruction, $action, $settings)
    {
        $styles = self::styles();
        $treatment = array('vintage'=>'70% clean retro illustration, 20% selective halftone shading, 10% restrained distressing. This is an artistic direction, not a measured pixel ratio. Keep faces and lettering crisp.', 'clean'=>'Clean opaque print colours and crisp edges with no added distress.', 'halftone'=>'Controlled halftone shading with bold readable shapes; avoid tiny isolated dots.', 'distressed'=>'Light selective print distress, preserving faces, lettering and important outlines.');
        return ($action === 'edit' ? 'Edit the FIRST supplied image. Make only the requested changes and preserve every unmentioned detail. An older selected image may be the branch source; do not use an unrelated newer image.' : 'Create one new illustration following the complete user brief.')
            . "\nCHARACTER GUIDANCE (only supplied character references apply):\n" . wp_json_encode($identity)
            . "\nLATEST USER REQUEST — takes priority for scene, slogan and intentional style changes:\n" . $instruction
            . "\nCHOSEN DRAWING STYLE: " . $styles[$settings['style']]
            . "\nT-SHIRT TREATMENT: " . $treatment[$settings['treatment']]
            . "\nBACKGROUND: " . ($settings['background'] === 'transparent' ? 'True transparent alpha outside the subject. No checkerboard illustration or background colour.' : 'Opaque solid or scenic background as requested.')
            . "\nInclude exactly the slogan or lettering explicitly requested; do not invent extra text, signatures or logos. Keep lettering legible and important content inside a 6% safe margin. Clearly adult characters; non-explicit illustration. Produce one image, not a collage of unrelated options. Preserve the chosen drawing style rather than forcing a house vintage style. Print target is " . ($settings['width']*300) . ' × ' . ($settings['height']*300) . ' pixels at 300 PPI; native generation may need later upscaling and inspection.';
    }
}
