<?php
if (!defined('ABSPATH')) { exit; }

/** A small sandbox controller using the existing project, generation and job tables. */
final class SBS_Freestyle
{
    public static function register_routes()
    {
        foreach (array('' => 'turn', '/select' => 'select', '/promote' => 'promote', '/brief' => 'save_brief', '/upload' => 'upload') as $suffix => $callback) {
            register_rest_route(SBS_REST::NS, '/freestyle' . $suffix, array('methods' => 'POST', 'callback' => array(__CLASS__, $callback), 'permission_callback' => array('SBS_REST', 'permission')));
        }
    }

    public static function styles()
    {
        return array(
            'house' => 'SmuttyBear house style', 'cartoon' => 'Classic cartoon',
            'caricature' => 'Caricature', 'mascot' => 'Bold vector mascot',
            'comic' => 'Comic book', 'pop-art' => 'Pop art', 'storybook' => 'Storybook illustration',
            'pin-up' => 'Vintage pin-up', 'beefcake' => 'Vintage beefcake',
            'retro-advertising' => 'Retro advertising', 'pulp' => 'Pulp magazine',
            'psychedelic' => '1960s psychedelic', 'disco' => '1970s disco',
            'tattoo-flash' => 'Traditional tattoo flash',
        );
    }

    public static function legacy_styles()
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
        $raw_styles = $input['styles'] ?? array($input['style'] ?? 'house');
        if (!is_array($raw_styles) || !$raw_styles || count($raw_styles) > 22) {
            return new WP_Error('invalid_freestyle_styles', 'Select at least one available drawing style.', array('status' => 400));
        }
        foreach ($raw_styles as $value) { if (!is_string($value)) { return new WP_Error('invalid_freestyle_styles', 'Invalid drawing style.', array('status'=>400)); } }
        $selected_styles = array_values(array_unique(array_map('sanitize_key', $raw_styles)));
        $style = $selected_styles[0];
        $treatment = sanitize_key($input['treatment'] ?? 'vintage');
        $size = sanitize_text_field($input['size'] ?? '1024x1536');
        $all_styles = self::styles() + self::legacy_styles();
        if (array_diff($selected_styles, array_keys($all_styles)) || !isset(self::treatments()[$treatment]) || !in_array($size, array('1024x1536', '1024x1024', '1536x1024'), true)) {
            return new WP_Error('invalid_freestyle_settings', 'Choose one of the available styles, treatments and image formats.', array('status' => 400));
        }
        $width = (float) ($input['width'] ?? 15);
        $height = (float) ($input['height'] ?? 18);
        if (!is_finite($width) || !is_finite($height) || $width < 1 || $height < 1 || $width > 30 || $height > 30) {
            return new WP_Error('invalid_freestyle_print_size', 'Print width and height must be between 1 and 30 inches.', array('status' => 400));
        }
        $background = $input['background'] ?? 'transparent';
        $transparency = $input['transparency'] ?? (isset($input['background']) ? 'standard' : 'print');
        if (!in_array($background, array('transparent', 'opaque'), true) || !in_array($transparency, array('standard', 'print', 'soft'), true)) {
            return new WP_Error('invalid_freestyle_background', 'Choose an available background and transparency treatment.', array('status'=>400));
        }
        return array('styles' => $selected_styles, 'transparency' => $transparency, 'style' => $style, 'treatment' => $treatment, 'size' => $size, 'background' => $background, 'width' => $width, 'height' => $height, 'dpi' => 300);
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

    public static function validate_brief($value)
    {
        if (!is_string($value) || strlen($value) > 24000 || preg_match_all('/./us', $value) > 12000) {
            return new WP_Error('invalid_freestyle_brief', 'Keep the design brief within 12000 characters (24000 UTF-8 bytes).', array('status'=>400));
        }
        return sanitize_textarea_field($value);
    }

    public static function brief_for($project, $generation_uuid = '')
    {
        $key = $generation_uuid ?: 'initial';
        $saved = $project['concept']['design_briefs'] ?? array();
        if (array_key_exists($key, $saved)) { return $saved[$key]; }
        $by_id = array();
        $current = null;
        foreach ($project['generations'] as $generation) {
            $by_id[$generation['id']] = $generation;
            if ($generation['uuid'] === $generation_uuid) { $current = $generation; }
        }
        $visited = array();
        while ($current && empty($visited[$current['id']])) {
            $visited[$current['id']] = true;
            // An explicitly empty brief is meaningful; do not resurrect old instructions.
            if (isset($current['freestyle_brief'])) { return $current['freestyle_brief']; }
            $current = $by_id[$current['parent_id'] ?? 0] ?? null;
        }
        return $project['concept']['original_brief'] ?? '';
    }

    public static function save_brief($request)
    {
        global $wpdb;
        $project = self::project(sanitize_text_field($request->get_param('project_uuid')));
        if (is_wp_error($project)) { return $project; }
        $uuid = sanitize_text_field($request->get_param('generation_uuid'));
        if (($uuid && !array_filter($project['generations'], function ($g) use ($uuid) { return $g['uuid'] === $uuid && !empty($g['asset_url']); })) || (!$uuid && !empty($project['generations']))) {
            return new WP_Error('invalid_freestyle_parent', 'Choose a completed image from this experiment.', array('status'=>400));
        }
        $brief = self::validate_brief($request->get_param('design_brief'));
        if (is_wp_error($brief)) { return $brief; }
        $concept = $project['concept'];
        $concept['design_briefs'][$uuid ?: 'initial'] = $brief;
        $wpdb->update(SBS_DB::table('projects'), array('concept_json'=>wp_json_encode($concept), 'updated_at'=>current_time('mysql',true)), array('id'=>$project['id']));
        return rest_ensure_response(self::project($project['uuid']));
    }

    /** Validate project-scoped user references; never accept another experiment's assets. */
    public static function references($project, $uuids)
    {
        if ($uuids === null) { $uuids = array(); }
        if (!is_array($uuids) || count($uuids)>6) { return new WP_Error('invalid_freestyle_references', 'Select up to six image references.', array('status'=>400)); }
        $assets = array();
        foreach ($uuids as $uuid) {
            if (!is_string($uuid)) { return new WP_Error('invalid_freestyle_reference', 'Invalid reference.', array('status'=>400)); }
            $asset = SBS_Storage::asset_by_uuid($uuid);
            if (!$asset || $asset['owner_type']!=='project' || (int)$asset['owner_id']!==(int)$project['id'] || $asset['role']!=='freestyle_reference' || !in_array($asset['mime'], array('image/png','image/jpeg','image/webp'), true)) {
                return new WP_Error('invalid_freestyle_reference', 'Choose references uploaded to this experiment.', array('status'=>400));
            }
            $assets[$uuid] = $asset;
        }
        return array_values($assets);
    }

    public static function upload($request)
    {
        global $wpdb;
        $files = $request->get_file_params(); $file = $files['file'] ?? array();
        $mode = $request->get_param('mode') ?: 'reference';
        if (!in_array($mode, array('reference','artwork','background_removed'), true)) { return new WP_Error('invalid_freestyle_upload_mode', 'Choose reference or existing artwork.', array('status'=>400)); }
        $image = !empty($file['tmp_name']) ? @getimagesize($file['tmp_name']) : false;
        if (!$image || !in_array($image['mime'] ?? '', array('image/png','image/jpeg','image/webp'), true) || !empty($file['error']) || empty($file['size']) || $file['size']>20*1024*1024 || $image[0]*$image[1]>40000000) {
            return new WP_Error('invalid_freestyle_upload', 'Choose a PNG, JPEG or WebP image up to 20 MB and 40 million pixels. Large uploads may also be limited by the server.', array('status'=>400));
        }
        $settings = self::settings(json_decode((string)$request->get_param('settings'), true));
        if (is_wp_error($settings)) { return $settings; }
        $uuid = sanitize_text_field($request->get_param('project_uuid'));
        $parent_uuid = sanitize_text_field($request->get_param('parent_uuid'));
        $project = $uuid ? self::project($uuid) : null;
        if (is_wp_error($project)) { return $project; }
        if ($project) { foreach ($project['jobs'] as $job) { if (!in_array($job['status'],array('completed','failed','blocked','cancelled'),true)) { return new WP_Error('freestyle_busy','Wait for this experiment to finish before uploading.',array('status'=>409)); } } }
        $parent = null;
        if ($parent_uuid && $project) { foreach ($project['generations'] as $g) { if ($g['uuid']===$parent_uuid && !empty($g['asset_url'])) { $parent=$g; break; } } }
        if (($parent_uuid && !$parent) || ($mode==='background_removed' && (!$parent || $image['mime']!=='image/png'))) { return new WP_Error('invalid_freestyle_parent', 'Choose a source image in this experiment for the PNG copy.', array('status'=>400)); }
        if (!$project) {
            $pack_uuid = sanitize_text_field($request->get_param('pack_uuid'));
            if (!$pack_uuid) { $pack_uuid=self::neutral_pack(); }
            if (is_wp_error($pack_uuid)) { return $pack_uuid; }
            $create = new WP_REST_Request('POST');
            $create->set_param('pack_uuid',$pack_uuid);
            $create->set_param('title',sanitize_text_field($request->get_param('title')) ?: sanitize_text_field($file['name']));
            $create->set_param('concept',array('type'=>'freestyle','original_brief'=>'','character_uuid'=>sanitize_text_field($request->get_param('pack_uuid')),'settings'=>$settings,'merch_ready'=>false));
            $project=self::data(SBS_REST::create_project($create)); if (is_wp_error($project)) { return $project; }
        }
        $asset=SBS_Storage::store_upload($file,'project',(int)$project['id'],$mode==='reference'?'freestyle_reference':'freestyle_original',sanitize_text_field($request->get_param('label')) ?: sanitize_text_field($file['name']));
        if (is_wp_error($asset)) { return $asset; }
        $generation_uuid='';
        if ($mode!=='reference') {
            $generation_uuid=wp_generate_uuid4();
            $result=$wpdb->insert(SBS_DB::table('generations'),array('uuid'=>$generation_uuid,'project_id'=>(int)$project['id'],'parent_id'=>$parent?(int)$parent['id']:null,'job_id'=>null,'action'=>$mode==='background_removed'?'background_remove':'upload','provider'=>'local','model'=>'original-file','prompt'=>$mode==='background_removed'?'Removed connected flat-colour background into a separate PNG copy.':'Uploaded artwork - original file unchanged.','revised_prompt'=>'','refs_json'=>'[]','output_asset_id'=>(int)$asset['id'],'quality'=>'original','size'=>$image[0].'x'.$image[1],'usage_json'=>'{}','cost_estimate'=>0,'created_at'=>current_time('mysql',true)));
            if ($result===false) { return new WP_Error('freestyle_import_failed','The file was saved, but the artwork version could not be registered. Do not upload again until the administrator checks the saved asset.',array('status'=>500)); }
            $generation_id=(int)$wpdb->insert_id;
            $concept=$project['concept'];$concept['active_generation_uuid']=$generation_uuid;$concept['settings']=$settings;$concept['merch_ready']=false;
            $concept['local_versions'][$generation_uuid]=array('settings'=>$settings,'brief'=>$parent?self::brief_for($project,$parent_uuid):'');
            $wpdb->update(SBS_DB::table('projects'),array('concept_json'=>wp_json_encode($concept),'current_generation_id'=>$generation_id,'updated_at'=>current_time('mysql',true)),array('id'=>(int)$project['id']));
        }
        return rest_ensure_response(array('project'=>self::project($project['uuid']),'asset'=>$asset,'generation_uuid'=>$generation_uuid));
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
        $brief_input = $request->get_param('design_brief');
        if ($brief_input !== null) {
            $brief_input = self::validate_brief($brief_input);
            if (is_wp_error($brief_input)) { return $brief_input; }
        }
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
        $user_references = self::references($project, $request->get_param('reference_uuids'));
        if (is_wp_error($user_references)) { return $user_references; }
        $concept = $project['concept'];
        $concept['settings'] = $settings;
        $brief = $brief_input !== null ? $brief_input : self::brief_for($project, $parent_uuid);
        $concept['design_briefs'][$parent_uuid ?: 'initial'] = $brief;
        $wpdb->update(SBS_DB::table('projects'), array('title'=>sanitize_text_field($request->get_param('title')) ?: $project['title'], 'concept_json'=>wp_json_encode($concept), 'updated_at'=>current_time('mysql',true)), array('id'=>$project['id']));
        $generation = new WP_REST_Request('POST');
        $generation->set_param('project_uuid', $project['uuid']);
        $generation->set_param('parent_uuid', $parent_uuid);
        $generation->set_param('prompt', $instruction);
        $generation->set_param('freestyle_settings', $settings);
        $generation->set_param('freestyle_brief', $brief);
        $generation->set_param('freestyle_reference_uuids', array_column($user_references, 'uuid'));
        $generation->set_param('freestyle_finishing', (bool)$request->get_param('finishing'));
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

    public static function compose_prompt($identity, $instruction, $action, $settings, $brief = '')
    {
        $styles = self::styles() + self::legacy_styles();
        $directions = array(
            'house' => 'Follow supplied approved character/style references where available. Warm, cheeky retro illustrated comedy with expressive adult characters, crisp faces and readable shapes. Without references use this broad visual direction; do not claim an exact reference match or introduce an unselected existing character.',
            'cartoon' => 'Expressive rounded characters, confident outlines and readable comic gestures.',
            'caricature' => 'Deliberately exaggerated facial features and proportions, with a coherent recognisable character.',
            'mascot' => 'Clean vector-like shapes, bold outlines, simplified shading and a strong silhouette. Output remains PNG, not a vector file.',
            'comic' => 'Dramatic illustrated characters, bold ink contours and controlled graphic shading.',
            'pop-art' => 'Bold graphic shapes, flat colour blocks and strong contrast.',
            'storybook' => 'Expressive narrative illustration with readable character acting and a cohesive scene.',
            'pin-up' => 'Playful vintage poster glamour, confident poses and polished retro illustration; clearly adult and non-explicit.',
            'beefcake' => 'Vintage muscular adult fitness-poster illustration with confident poses and sculptural anatomy; non-explicit.',
            'retro-advertising' => 'Classic illustrated advertising with a clear focal subject and an economical poster composition.',
            'pulp' => 'Dramatic vintage magazine-cover illustration with strong lighting, rich colours and energetic composition.',
            'psychedelic' => '1960s-inspired swirling shapes, flowing contours and vivid colour relationships. Stylise only explicitly requested lettering.',
            'disco' => 'Colourful 1970s nightclub-poster styling with energetic movement and rhythmic graphic shapes.',
            'tattoo-flash' => 'Traditional tattoo-flash illustration with strong outlines, limited colours and bold readable forms.',
        );
        $treatment = array('vintage'=>'70% clean retro illustration, 20% selective halftone shading, 10% restrained distressing. This is an artistic direction, not a measured pixel ratio. Keep faces and lettering crisp.', 'clean'=>'Clean opaque print colours and crisp edges with no added distress.', 'halftone'=>'Controlled halftone shading with bold readable shapes; avoid tiny isolated dots.', 'distressed'=>'Light selective print distress, preserving faces, lettering and important outlines.');
        $selected_styles = $settings['styles'] ?? array($settings['style']);
        $style_labels = array(); $style_directions = array();
        foreach ($selected_styles as $key) {
            $style_labels[] = $styles[$key];
            if (isset($directions[$key])) { $style_directions[] = $styles[$key] . ': ' . $directions[$key]; }
        }
        $transparency_directions = array('standard'=>'Keep natural subject edges against true transparent alpha.', 'print'=>'Use solid opaque print colours inside the artwork, crisp edges and fully transparent empty areas. Avoid translucent shadows, glows and faded edge pixels.', 'soft'=>'Allow soft feathered edges and translucent shadows or effects where requested, with true transparent alpha outside the artwork. This requires print preflight and is not guaranteed print-ready.');
        return ($action === 'edit' ? 'Edit the FIRST supplied image. Make only the requested changes and preserve every unmentioned detail. An older selected image may be the branch source; do not use an unrelated newer image.' : 'Create one new illustration following the complete user brief.')
            . "\nCHARACTER GUIDANCE (only supplied character references apply):\n" . wp_json_encode($identity)
            . "\nUSER-EDITABLE DESIGN BRIEF FOR THIS SELECTED IMAGE (continuing composition and clothing requirements; the latest explicit change below takes priority):\n" . $brief
            . "\nLATEST USER REQUEST — takes priority for scene, slogan and intentional style changes:\n" . $instruction
            . "\nCHOSEN DRAWING STYLES: " . implode(" + ", $style_labels)
            . "\nSTYLE DIRECTIONS:\n" . implode("\n", $style_directions)
            . (count($selected_styles)>1 ? "\nBlend all selected styles into one coherent image, not separate panels. Use the latest instruction to resolve conflicts and emphasise the requested features." : "")
            . "\nT-SHIRT TREATMENT: " . $treatment[$settings['treatment']]
            . "\nBACKGROUND: " . ($settings['background'] === 'transparent' ? 'True transparent alpha outside the subject. No checkerboard illustration or background colour. ' . $transparency_directions[$settings['transparency'] ?? 'standard'] : 'Opaque solid or scenic background as requested.')
            . "\nInclude exactly the slogan or lettering explicitly requested; do not invent extra text, signatures or logos. Keep lettering legible and important content inside a 6% safe margin. Clearly adult characters; non-explicit illustration. Produce one image, not a collage of unrelated options. Preserve the chosen drawing style rather than forcing a house vintage style. Print target is " . ($settings['width']*300) . ' × ' . ($settings['height']*300) . ' pixels at 300 PPI; native generation may need later upscaling and inspection.';
    }
}
