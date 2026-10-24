<!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Smutty Studio</title>
    <?php wp_print_styles(array('sbs-studio', 'sbs-studio-hierarchy', 'sbs-studio-theme', 'sbs-finishing')); ?>
</head>
<body id="sbs-studio-page" class="sbs-body">
<div id="sbs-app" class="sbs-shell" data-rest="<?php echo esc_url(rest_url('smutty-bear/v1/')); ?>" data-authenticated="<?php echo SBS_Auth::is_authenticated() ? '1' : '0'; ?>" data-slug="<?php echo esc_attr(SBS_Plugin::studio_slug()); ?>" data-version="<?php echo esc_attr(SBS_VERSION); ?>" data-finishing-csrf="<?php echo SBS_Auth::is_authenticated() ? esc_attr(SBS_Finishing::csrf()) : ''; ?>" data-open-settings="<?php echo isset($_GET['settings']) ? '1' : '0'; ?>">
    <header class="sbs-header">
        <nav id="sbs-primary-nav" class="sbs-primary-tabs" aria-label="Main studio areas" <?php echo SBS_Auth::is_authenticated() ? '' : 'hidden'; ?>>
            <button data-primary-tab="finishing" class="active">Finishing</button>
            <button data-primary-tab="freestyle">Freestyle</button>
            <button data-primary-tab="catalogue">Catalogue</button>
            <button data-primary-tab="characters">Characters</button>
            <button data-primary-tab="usage">Usage</button>
            <button data-primary-tab="settings">Settings</button>
        </nav>
        <div class="sbs-header-right"><div class="sbs-header-brand"><div class="sbs-wordmark"><span>Smutty Studio</span></div><span class="sbs-version">v<?php echo esc_html(SBS_VERSION); ?></span></div><button id="sbs-guide-open" class="sbs-guide-open" type="button" <?php echo SBS_Auth::is_authenticated() ? '' : 'hidden'; ?>><span aria-hidden="true">?</span> Guide</button></div>
    </header>

    <main>
        <section id="sbs-login" class="sbs-login" <?php echo SBS_Auth::is_authenticated() ? 'hidden' : ''; ?>>
            <div class="sbs-login-card">
                <p class="sbs-kicker">PRIVATE WORKSPACE</p>
                <h1>Smile out loud.</h1>
                <p>This studio creates adult, cheeky illustrated comedy. It is not intended for minors.</p>
                <form id="sbs-login-form">
                    <label>Studio password<input type="password" name="password" required autocomplete="current-password"></label>
                    <label class="sbs-check"><input type="checkbox" name="adult_confirmed" required> I confirm that I am an adult.</label>
                    <button class="sbs-button primary" type="submit">Enter studio</button>
                    <p class="sbs-form-message" aria-live="polite"></p>
                </form>
            </div>
        </section>

        <section id="sbs-workspace" <?php echo SBS_Auth::is_authenticated() ? '' : 'hidden'; ?>>
            <div id="sbs-global-message" class="sbs-global-message" hidden aria-live="polite"></div>

            <div id="sbs-character-area">
            <div class="sbs-character-tray">
            <div class="sbs-character-context">
                <div class="sbs-character-selector"><p class="sbs-kicker">CURRENT CHARACTER</p><label class="sbs-context-select"><select id="sbs-current-pack" aria-label="Current character"></select></label></div>
                <div class="sbs-character-page-picker">
                <div class="sbs-character-page-heading">Character pages · <strong id="sbs-character-page-current">Description</strong></div>
                <nav class="sbs-tabs sbs-character-page-menu" id="sbs-character-page-menu" aria-label="Character pages">
                    <button data-tab="library">Character</button>
                    <button data-tab="characters" class="active" aria-current="page"><span class="sbs-stage-number">1.</span> Description</button>
                    <button data-tab="development"><span class="sbs-stage-number">2.</span> Visual Development</button>
                    <button data-tab="canvas"><span class="sbs-stage-number">3.</span> Composition Tool</button>
                    <button data-tab="references">Reference</button>
                    <button data-tab="projects">Creations</button>
                    <button data-tab="create" hidden>Idea Room</button>
                </nav>
                </div>
                <div class="sbs-character-commands"><button id="sbs-new-pack" class="sbs-button primary">New character</button><button id="sbs-fork-pack" class="sbs-button" disabled>Create new version</button></div>
            </div>
            </div>

            <section class="sbs-panel" data-panel="create" hidden>
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">IDEA ROOM</p><h1><span class="sbs-stage-number">4.</span> Turn a cheeky thought into a scene</h1></div><span class="sbs-pill">Strong innuendo · non-explicit</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128161;</span><div><strong>Use the Idea Room to develop artwork.</strong> Start with a rough joke, choose or edit one of the suggested concepts, then generate drafts. The selected character description and relevant references are included automatically.</div></aside>
                <div class="sbs-grid two">
                    <article class="sbs-card">
                        <h2 class="sbs-stage-heading"><span class="sbs-stage-number">4.1</span> Write the idea</h2><p class="sbs-stage-decision"><strong>Decision:</strong> What is the joke or scene you want to create?</p><p class="sbs-context-note">Creating for <strong id="sbs-idea-character-name">the selected character</strong></p>
                        <label>Rough idea<textarea id="sbs-idea" rows="6" placeholder="Smutty Bear proudly polishing an absurdly oversized garden hose at a seaside caravan..."></textarea></label>
                        <button id="sbs-ideas-button" class="sbs-button primary">Suggest three concepts</button>
                    </article>
                    <article class="sbs-card">
                        <h2 class="sbs-stage-heading"><span class="sbs-stage-number">4.2</span> Choose a concept</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Choose one suggestion, edit it, or write your own scene.</p>
                        <div id="sbs-concepts" class="sbs-concepts"><p class="sbs-muted">Your three editable visual jokes will appear here.</p></div>
                    </article>
                </div>
                <article class="sbs-card sbs-prompt-card">
                    <div class="sbs-inline-heading"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">4.3</span> Confirm and generate drafts</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Check the prompt, title, format and background before generating.</p><span>The current character identity and references are added automatically.</span></div>
                    <label><textarea id="sbs-scene-prompt" rows="7" placeholder="Choose a concept or write the full scene directly."></textarea></label>
                    <div class="sbs-row wrap">
                        <label>Project title<input id="sbs-project-title" type="text" placeholder="Seaside hose poster"></label>
                        <label>Format<select id="sbs-size"><option value="1024x1024">Square 1024</option><option value="1024x1536">Portrait</option><option value="1536x1024">Landscape</option><option value="2048x2048">2K square</option></select></label>
                        <label>Background<select id="sbs-background"><option value="opaque">Scene / opaque</option><option value="transparent">Transparent merch asset</option></select></label>
                        <button id="sbs-generate" class="sbs-button accent">Generate four drafts</button>
                    </div>
                    <details><summary>Effective prompt preview</summary><pre id="sbs-effective-prompt">Generated after submission.</pre></details>
                </article>
                <div id="sbs-live-jobs" class="sbs-job-grid"></div>
            </section>

            <section class="sbs-panel" data-panel="characters">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CHARACTER DESCRIPTION</p><h1><span class="sbs-stage-number">1.</span> Description</h1></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#9998;</span><div><strong>Set the character's identity.</strong> Add key traits, exclusions, humour and colours. AI suggestions never replace your description unless you approve them.</div></aside>
                <div id="sbs-pack-description" class="sbs-card"><p class="sbs-muted">Choose a character above or create a new character.</p></div>
            </section>

            <section class="sbs-panel" data-panel="library">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CHARACTER LIBRARY</p><h1>Review and manage characters</h1></div></div>
                <p class="sbs-muted">New or imported characters start as Needs review. Only Active characters appear in Freestyle. Archiving hides a character while keeping its saved work.</p>
                <label for="sbs-character-library-filter">Show characters<select id="sbs-character-library-filter"><option value="needs_review">Needs review</option><option value="in_development">In development</option><option value="active">Active</option><option value="archived">Archived</option><option value="all">All characters</option></select></label>
                <p id="sbs-character-library-status" role="status" aria-live="polite"></p>
                <div id="sbs-character-library-list" class="sbs-character-library-list"></div>
            </section>

            <section class="sbs-panel" data-panel="development">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">TEXT TO VISUAL IDENTITY</p><h1><span class="sbs-stage-number">2.</span> Visual Development</h1></div><span class="sbs-pill">Description → concepts → references</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#127912;</span><div><strong>Build the visual reference here.</strong> Generate concepts, choose a seed, add references and approve the best consistency sheet.</div></aside>
                <div id="sbs-development-root"><p class="sbs-muted">Choose a character above or create a new character.</p></div>
            </section>

            <section class="sbs-panel" data-panel="references">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CHARACTER GROUNDING</p><h1><span class="sbs-stage-number">3.</span> Reference Material</h1></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128444;</span><div><strong>Manage character references.</strong> Upload, review or remove references. Description suggestions are optional. Approve new images in Visual Development.</div></aside>
                <div id="sbs-pack-references" class="sbs-card"><p class="sbs-muted">Choose a character above or create a new character.</p></div>
            </section>

            <section class="sbs-panel" data-panel="projects">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CREATIONS</p><h1><span class="sbs-stage-number">5.</span> Refine, polish and upscale <span id="sbs-creations-character-name"></span></h1></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128444;</span><div><strong>Review saved images.</strong> Open a project to compare, refine or upscale images. You can inspect or remove results.</div></aside>
                <div class="sbs-grid project-layout"><section><h2 class="sbs-stage-heading"><span class="sbs-stage-number">5.1</span> Choose a project</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Which set of creations do you want to work on?</p><div id="sbs-project-list" class="sbs-project-list"></div></section><div id="sbs-project-detail" class="sbs-card"><p class="sbs-muted">Choose a project to inspect its generation tree.</p></div></div>
            </section>

            <section class="sbs-panel" data-panel="canvas">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">COMPOSITION TOOL</p><h1><span class="sbs-stage-number">6.</span> Compose artwork for <span id="sbs-canvas-character-name"></span></h1></div></div>
                <section id="sbs-export-downloads" class="sbs-export-downloads" aria-labelledby="sbs-export-downloads-title" aria-live="polite" hidden></section>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128085;</span><div><strong>Compose artwork.</strong> Add images, text and shapes in layers. Save the editable composition or export a PNG; prepare and check print files in Artwork Finishing.</div></aside>
                <div class="sbs-canvas-layout">
                    <aside class="sbs-canvas-tools sbs-card"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">6.1</span> Choose artwork</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Choose a project and creation, then add it to the canvas.</p>
                        <label>Project<select id="sbs-canvas-project"></select></label>
                        <fieldset class="sbs-media-picker"><legend>Creations</legend><input id="sbs-canvas-creation" type="hidden" value=""><div id="sbs-canvas-creation-gallery" class="sbs-media-gallery"><p class="sbs-muted">Choose a project to browse its creations.</p></div></fieldset>
                        <button id="sbs-add-creation" class="sbs-button full">Add creation</button>
                        <hr>
                        <h2 class="sbs-stage-heading"><span class="sbs-stage-number">6.2</span> Compose the artwork</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Add text, shapes or uploads; choose which changes the design needs.</p><div class="sbs-tool-grid"><button data-tool="text">Text</button><button data-tool="rect">Rectangle</button><button data-tool="circle">Circle</button><button data-tool="upload">Upload</button><button data-tool="group">Group</button><button data-tool="ungroup">Ungroup</button></div>
                        <input id="sbs-canvas-upload" type="file" accept="image/png,image/jpeg,image/webp,font/ttf,font/otf,font/woff,font/woff2" hidden>
                        <label>Fill / text colour<input id="sbs-object-colour" type="color" value="#f4e0ad"></label>
                        <label>Font family<input id="sbs-font-family" type="text" value="Arial"></label>
                        <div class="sbs-tool-grid"><button data-tool="crop-square">Square crop</button><button data-tool="mask-circle">Circle mask</button><button data-tool="mask-rect">Rectangle mask</button><button data-tool="mask-clear">Clear mask</button><button data-tool="duplicate">Duplicate</button></div>
                    </aside>
                    <div class="sbs-canvas-stage"><div class="sbs-canvas-scroll"><canvas id="sbs-design-canvas" width="900" height="900"></canvas></div><div class="sbs-canvas-status"><button data-tool="undo">Undo</button><button data-tool="redo">Redo</button><span id="sbs-canvas-message">Ready</span></div></div>
                    <aside class="sbs-layers sbs-card"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">6.3</span> Arrange layers</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Select a layer to position, resize, reorder, hide or lock it.</p><div id="sbs-layer-list"></div><div class="sbs-tool-grid"><button data-tool="front">To front</button><button data-tool="back">To back</button><button data-tool="lock">Lock</button><button data-tool="hide">Hide</button><button data-tool="delete" class="sbs-danger-tool">Delete layer</button></div><div class="sbs-layer-reference"><fieldset class="sbs-media-picker"><legend>Reference</legend><input id="sbs-canvas-reference" type="hidden" value=""><div id="sbs-canvas-reference-gallery" class="sbs-media-gallery"><p class="sbs-muted">Choose a character to browse its references.</p></div></fieldset><button id="sbs-add-reference" class="sbs-button full">Add reference</button></div><div class="sbs-card sbs-logo-tools"><h3 class="sbs-stage-heading"><span class="sbs-stage-number">6.4</span> Choose and place branding</h3><p class="sbs-stage-decision"><strong>Decision:</strong> Use the recommended plain copper signature, another approved logo, or a logo-free version.</p><p class="sbs-muted"><strong>Approved signature presets:</strong> Plain (preferred), Contour (for natural artwork curves), Pill (fallback for legibility). Each has Black, White, Cream and Copper approved PNG masters. Upload the genuine master as an Exact logo reference; do not retype it with a substitute font. Default current T-shirt signature: plain copper smuttybear.com, centred beneath artwork, proportional scale. The exact original font family and point size are not documented; preserve the approved master image.</p><label>Brand mark family<select id="sbs-brand-family"><option value="plain-copper">Plain signature — Copper (default)</option><option value="plain-black">Plain signature — Black</option><option value="plain-white">Plain signature — White</option><option value="plain-cream">Plain signature — Cream</option><option value="contour">Contour signature — approved master</option><option value="pill">Pill signature — approved master</option><option value="retro">Retro wordmark — approved master</option><option value="badge">Full main brand badge — approved master</option><option value="custom">Other approved graphic logo</option></select></label><p class="sbs-muted">Upload logos as Exact logo references, then use Add reference to place one on the canvas. Keep an original logo-free export alongside the branded version.</p><div class="sbs-row wrap"><button id="sbs-logo-center" class="sbs-button" type="button">Centre selected logo</button><button id="sbs-logo-rotate-left" class="sbs-button" type="button">Rotate −15°</button><button id="sbs-logo-rotate-right" class="sbs-button" type="button">Rotate +15°</button></div><label>Logo horizontal position (%)<input id="sbs-logo-x" type="range" min="0" max="100" value="50"></label><label>Logo vertical position (%)<input id="sbs-logo-y" type="range" min="0" max="100" value="50"></label><label>Logo width (%)<input id="sbs-logo-size" type="range" min="5" max="100" value="30"></label><p class="sbs-muted">Curved lettering needs editable text on a path. Warping image logos is not supported.</p><label class="sbs-check"><input id="sbs-export-both" type="checkbox" checked> Export branded and logo-free copies</label></div><section class="sbs-card sbs-composition-options"><h3>Composition options</h3><label class="sbs-check"><input id="sbs-transparent" type="checkbox"> Transparent background</label><label class="sbs-check"><input id="sbs-guides" type="checkbox" checked> Show safe/bleed guides</label><label class="sbs-check"><input id="sbs-snapping" type="checkbox" checked> Snap objects to grid and centre</label></section><div class="sbs-print-settings" hidden><h3 class="sbs-stage-heading"><span class="sbs-stage-number">6.5</span> Set up the print</h3><p class="sbs-stage-decision"><strong>Decision:</strong> Choose the print method, treatment, dimensions, DPI and background.</p><label>Print method<select id="sbs-print-method"><option value="dtg">DTG — Direct to Garment</option><option value="dtf">DTF — Direct to Film</option></select></label><p id="sbs-method-advice" class="sbs-muted">DTG: check gradients, transparency and garment colour. Check supplier rules.</p><div class="sbs-card" id="sbs-treatment-review"><h3>Visual treatment review</h3><p id="sbs-treatment-review-message" role="status">REVIEW REQUIRED — 70/20/10 is the default creative treatment, not a verified analysis of the artwork. Inspect facial features, lettering, halftone dots, distressed areas and fine edges before print approval.</p></div><label>Artwork treatment<select id="sbs-visual-treatment"><option value="vintage-70-20-10">SmuttyBear vintage 70/20/10</option><option value="clean">Clean illustration</option><option value="custom">Custom / already treated</option></select></label><p class="sbs-muted">Default: 70% clean retro, 20% halftone, 10% distress. This is a style guide, not a pixel ratio or automatic edit.</p><label>Print width (in)<input id="sbs-print-width" type="number" min="1" max="40" step="0.25" value="12"></label><label>Print height (in)<input id="sbs-print-height" type="number" min="1" max="40" step="0.25" value="12"></label><label>DPI<input id="sbs-print-dpi" type="number" min="72" max="600" step="1" value="300"></label><p id="sbs-print-readout" class="sbs-muted">3600 × 3600 px target</p></div><div class="sbs-card" id="sbs-print-qa" hidden><h3 class="sbs-stage-heading"><span class="sbs-stage-number">6.6</span> Check print quality</h3><p class="sbs-stage-decision"><strong>Decision:</strong> Run preflight, inspect the artwork and resolve warnings before export.</p><p class="sbs-muted">Run preflight before export. It checks file settings, not visual quality or supplier approval.</p><button id="sbs-run-preflight" class="sbs-button" type="button">Run print preflight</button><p id="sbs-preflight-results" role="status">Not checked. Export is blocked until a preflight check has run.</p><label class="sbs-check"><input type="checkbox" id="sbs-manual-override"> I have reviewed the artwork and accept responsibility for any unresolved warnings (manual override)</label><p class="sbs-muted">A dated report downloads with the artwork. Override does not turn failed checks into passes.</p></div></aside>
                </div>
                <section class="sbs-card sbs-workflow-finish"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">6.7</span> Save and export</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Save an editable design, export the chosen versions, then inspect the downloaded files.</p><div class="sbs-row"><button id="sbs-canvas-save" class="sbs-button primary">Save design</button><button id="sbs-canvas-export" class="sbs-button accent">Export PNG</button></div></section>
            </section>
            </div>

            <section class="sbs-panel" data-panel="freestyle" id="sbs-freestyle-panel" aria-labelledby="sbs-freestyle-title">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">PLAY · EXPERIMENT · REFINE</p><h1 id="sbs-freestyle-title">Freestyle</h1></div><button type="button" id="sbs-fs-new" class="sbs-button">New experiment</button></div>
                <ol class="sbs-fs-steps" aria-label="Freestyle stages"><li id="sbs-fs-step-a"><span class="sbs-stage-number">A</span> Choose starting point <strong>Not started</strong></li><li id="sbs-fs-step-b"><span class="sbs-stage-number">B</span> Create and compare <strong>Not started</strong></li><li id="sbs-fs-step-c"><span class="sbs-stage-number">C</span> Give instructions <strong>Not started</strong></li><li id="sbs-fs-step-d"><span class="sbs-stage-number">D</span> Finish for print <strong>Not started</strong></li></ol>
                <section class="sbs-card"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">A.</span> Choose a starting point</h2><div class="sbs-grid two"><label for="sbs-fs-character">Character (optional)<select id="sbs-fs-character"><option value="">No character — completely new idea</option></select></label><label for="sbs-fs-session">Open experiment<select id="sbs-fs-session"><option value="">New experiment</option></select></label></div><label for="sbs-fs-title">Experiment / project name<input id="sbs-fs-title" type="text" maxlength="150" placeholder="Give this experiment a name"></label><p class="sbs-muted">No character starts a new design. Changing character starts a separate experiment.</p><p class="sbs-muted">Choose the character, drawing style, treatment, format, background and any reference images for this experiment.</p><div class="sbs-fs-style-picker"><input type="hidden" id="sbs-fs-style" data-styles="<?php echo esc_attr(wp_json_encode(SBS_Freestyle::styles())); ?>" data-legacy-styles="<?php echo esc_attr(wp_json_encode(SBS_Freestyle::legacy_styles())); ?>"><details id="sbs-fs-style-menu"><summary id="sbs-fs-style-summary">Drawing styles — 1 applied</summary><fieldset><legend>Tick styles to combine</legend><div id="sbs-fs-style-choices"></div></fieldset><button type="button" id="sbs-fs-style-apply" class="sbs-button">Apply styles</button><p id="sbs-fs-style-pending" role="status"></p></details><p id="sbs-fs-styles-applied" aria-live="polite"></p></div><div class="sbs-fs-options"><label for="sbs-fs-treatment">Treatment<select id="sbs-fs-treatment"><?php foreach (SBS_Freestyle::treatments() as $value => $label) { ?><option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option><?php } ?></select></label><label for="sbs-fs-background">Background<select id="sbs-fs-background"><option value="transparent-print">Transparent — solid print colour (default)</option><option value="transparent">Transparent cutout</option><option value="transparent-soft">Transparent — soft edges / effects</option><option value="opaque">Opaque — solid or scenic background</option></select></label><label for="sbs-fs-size">Format<select id="sbs-fs-size"><option value="1024x1536">Portrait</option><option value="1024x1024">Square</option><option value="1536x1024">Landscape</option></select></label></div><p id="sbs-fs-background-note" class="sbs-muted"></p><p class="sbs-muted">Vintage treatment means 70% clean retro, 20% halftone shading and 10% restrained distressing. This guides generation; inspect the result. Your last applied combination of drawing styles is remembered. Tick choices, then press Apply styles. Transparency treatments guide generation; inspect the PNG alpha; use Artwork Finishing for print checks. Soft edges can be unsuitable for T-shirt printing.</p><section class="sbs-fs-files"><h3 class="sbs-stage-heading"><span class="sbs-stage-number">C.1</span> Add a reference or existing artwork</h3><p>References guide details such as clothing. Existing artwork stays unchanged when uploaded. Upload one file at a time.</p><form id="sbs-fs-upload-form"><div class="sbs-grid two"><label for="sbs-fs-upload-file">Image file<input type="file" id="sbs-fs-upload-file" accept="image/png,image/jpeg,image/webp" required></label><label for="sbs-fs-upload-mode">Use this file as<select id="sbs-fs-upload-mode"><option value="reference">Reference only — clothing / style guide</option><option value="artwork">Existing artwork — keep original unchanged</option></select></label></div><label for="sbs-fs-upload-label">Reference label / what to follow<input id="sbs-fs-upload-label" type="text" maxlength="200" placeholder="For example: follow the waistband fit only" spellcheck="true"></label><button type="submit" class="sbs-button" id="sbs-fs-upload">Upload reference / artwork</button></form><p id="sbs-fs-file-status" role="status"></p><div id="sbs-fs-references" aria-label="References for this experiment"></div><p class="sbs-muted">PNG, JPEG or WebP up to 20 MB. Select up to six references. Uploading does not generate or upscale. Selectors do not alter uploaded files.</p></section></section>
                <section class="sbs-card sbs-fs-preview"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">B.</span> Your image and six recent versions</h2><div id="sbs-fs-thumbnails" class="sbs-fs-thumbnails" aria-label="Six recent designs"></div><p id="sbs-fs-empty">Your first image will appear here.</p><button id="sbs-fs-zoom" type="button" class="sbs-image-zoom" hidden aria-label="Enlarge selected Freestyle image"><img id="sbs-fs-image" alt="Selected Freestyle design"></button><p id="sbs-fs-image-info" class="sbs-muted"></p><div id="sbs-fs-transparency" class="sbs-transparency-indicator" role="status" aria-live="polite" aria-atomic="true" data-state="unknown"><span class="sbs-transparency-bar" aria-hidden="true"></span><span class="sbs-transparency-label">Transparency: Not checked</span></div><p class="sbs-transparency-key">Red = opaque · Amber = partial alpha · Green = transparent with no partial alpha · Grey = not checked</p><div class="sbs-section-actions"><button type="button" id="sbs-fs-undo" class="sbs-button" disabled>Undo — previous image</button><button type="button" id="sbs-fs-redo" class="sbs-button" disabled>Redo</button></div><div id="sbs-fs-progress" class="sbs-section-progress" aria-live="polite"></div></section>
                <section class="sbs-card sbs-fs-conversation"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">C.</span> Tell me what to create or change</h2><p class="sbs-muted">Saved instructions are read only. Add changes below.</p><ol id="sbs-fs-conversation" tabindex="0" aria-label="Saved instructions for this image branch — read only"></ol><p class="sbs-muted">The composer below starts as your brief, then clears after a successful image and becomes the next change to try. Saved brief and instruction history remain with each image branch.</p><p id="sbs-fs-core-brief" class="sbs-muted">No saved core brief yet.</p><details><summary>Help me describe a pose change</summary><p>Say what to change and what to keep. AI may still alter other details, so review the result.</p></details><div id="sbs-fs-edit-lock" hidden><p class="sbs-locked-text">Uploaded artwork stays unchanged unless you enable AI editing. You can upscale it or send it to print finishing.</p><label class="sbs-check"><input type="checkbox" id="sbs-fs-allow-edit"> Allow AI to edit this artwork for the next instruction. It may change details; review the result.</label><a id="sbs-fs-original" class="sbs-button" download>Download unchanged uploaded original</a></div><form id="sbs-fs-form"><label for="sbs-fs-instruction">Your idea or next instruction<textarea id="sbs-fs-instruction" rows="5" maxlength="12000" spellcheck="true" autocapitalize="sentences" placeholder="Describe the character, setting, slogan and style. For a change, say what to keep and what to alter."></textarea></label><button id="sbs-fs-submit" class="sbs-button primary" type="submit">Create one image</button><div id="sbs-fs-submit-status" class="sbs-section-progress" aria-live="polite"></div><p class="sbs-muted">Each generation or upscale may cost provider credits. Earlier images stay available.</p></form><div id="sbs-fs-support" hidden><label for="sbs-fs-support-text">Support review details<textarea id="sbs-fs-support-text" rows="12" readonly spellcheck="false"></textarea></label><p class="sbs-muted">Contains your prompt and diagnostic IDs. Review before sharing; nothing is sent automatically.</p><button id="sbs-fs-support-copy" type="button" class="sbs-button">Copy support details</button></div></section>
                <section class="sbs-card sbs-fs-handoff"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">D.</span> Artwork Finishing</h2><p>Choose a Freestyle image to open as a separate source in Artwork Finishing. The original image, saved settings, instructions and version history stay unchanged. Opening a source does not approve it for printing.</p><h3>Freestyle images</h3><div id="sbs-fs-finishing-sources" aria-live="polite" aria-label="Freestyle images, newest first"><p class="sbs-muted">Loading completed Freestyle images…</p></div><p id="sbs-fs-handoff-status" role="status" aria-live="polite"></p></section>
            </section>

            <section class="sbs-panel" data-panel="usage">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">USAGE LEDGER</p><h1>Provider activity by character</h1></div><span class="sbs-pill">Calculated estimates, not invoices</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128200;</span><div><strong>Usage by character.</strong> Costs are estimates. Check provider invoices for actual charges.</div></aside>
                <div id="sbs-usage-summary" class="sbs-metric-grid"></div><div class="sbs-card"><table class="sbs-table"><thead><tr><th>Date</th><th>Character</th><th>Provider</th><th>Operation</th><th>Estimated USD</th></tr></thead><tbody id="sbs-usage-rows"></tbody></table></div>
            </section>

            <?php include SBS_PLUGIN_DIR . 'templates/finishing.php'; ?>
            <section class="sbs-panel" data-panel="settings">
                <?php include SBS_PLUGIN_DIR . 'templates/finishing-settings.php'; ?>
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">STUDIO MANAGEMENT</p><h1>Settings</h1></div><span class="sbs-pill">Studio sign-in required</span></div>
                <div id="sbs-settings-admin" class="sbs-settings-admin"><?php SBS_Admin::render_studio_settings(); ?></div>
                <h2 class="sbs-stage-heading"><span class="sbs-stage-number">D.</span> Software updates and rollback</h2>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128274;</span><div><strong>Install or restore a Studio version.</strong> Confirm the Studio password. Release files are verified before installation.</div></aside>
                <div id="sbs-update-root" class="sbs-update-root"><article class="sbs-card"><p class="sbs-muted">Open this tab to check update access.</p></article></div>
            </section>
        </section>
    </main>
    <dialog id="sbs-image-modal" class="sbs-image-modal" aria-labelledby="sbs-image-modal-caption">
        <button id="sbs-image-modal-close" class="sbs-modal-close" type="button" aria-label="Close image preview">×</button>
        <img id="sbs-image-modal-image" src="" alt="Enlarged creation">
        <p id="sbs-image-modal-caption"></p>
    </dialog>
    <dialog id="sbs-guide-dialog" class="sbs-guide-dialog" aria-labelledby="sbs-guide-title">
        <button id="sbs-guide-close" class="sbs-modal-close" type="button" aria-label="Close studio guide">×</button>
        <div class="sbs-guide-hero"><img src="<?php echo esc_url(SBS_PLUGIN_URL . 'assets/reference/smutty-bear-character-sheet.jpeg'); ?>" alt="Smutty Bear character and brand reference sheet"><div><p class="sbs-kicker">ILLUSTRATED WORKFLOW</p><h2 id="sbs-guide-title">How to use Smutty Studio</h2><p>Build a dependable character first, then create, refine and compose artwork without losing its identity.</p></div></div>
        <div class="sbs-workflow-map"><h3>1. Character development</h3><div class="sbs-workflow-steps"><span>New character</span><span>Description: identity, traits, exclusions and palette</span><span>Visual Development: concepts and visual seed</span><span>Reference: face, body, expressions and outfits</span><span>Consistency approval sheet</span></div><p>Approve a consistency sheet before using the character as a reference. Recheck it after identity changes.</p></div>
        <div class="sbs-workflow-map"><h3>2. Supporting assets and reference material</h3><div class="sbs-workflow-steps"><span>Prepare authorised images</span><span>Upload reference</span><span>Choose role: face, body, expression, outfit, style or logo</span><span>Review and accept</span><span>Use relevant references during creation</span></div><p>Add scenery as an image layer in Composition Tool. Character reference roles are not a scenery library.</p></div>
        <div class="sbs-workflow-map"><h3>3. Artwork production</h3><div class="sbs-workflow-steps"><span>Freestyle: describe and refine an idea</span><span>Generate and compare versions</span><span>Generate four drafts</span><span>Creations: select a draft</span><span>Refine or polish</span><span>Optional AI upscale 2× or 4×</span><span>Inspect dimensions and transparency</span></div><p>Polish may change details. Upscale enlarges the image with Replicate. Neither guarantees print quality.</p></div>
        <div class="sbs-workflow-map"><h3>4. Composition</h3><div class="sbs-workflow-steps"><span>Composition Tool</span><span>Add artwork, references, scenery, text and shapes</span><span>Arrange and mask layers</span><span>Save editable design</span><span>Export PNG</span></div><p>Use Artwork Finishing for print sizing, technical checks and package preparation.</p></div>
        <ol class="sbs-guide-steps">
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128100;</span><b>1</b></div><div><h3>Choose the character</h3><p>Choose a character. Ideas, images, references and usage below apply to it.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#9998;</span><b>2</b></div><div><h3>Write the description</h3><p>Describe the character's key traits and what to avoid. This is the main identity record.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#127912;</span><b>3</b></div><div><h3>Develop a visual seed</h3><p>Create four concepts, refine one and save it as the visual seed.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128444;</span><b>4</b></div><div><h3>Build visual grounding</h3><p>Add references for face, body, expression, outfit or style. Accept only images that match the character.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#9989;</span><b>5</b></div><div><h3>Test consistency</h3><p>Generate and inspect consistency sheets. Accept the best match; it becomes the current Reference sheet.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128161;</span><b>6</b></div><div><h3>Create and refine</h3><p>Create and refine images in Freestyle.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128085;</span><b>7</b></div><div><h3>Compose merchandise</h3><p>Arrange artwork in Composition Tool. Save the composition or export a PNG; check print readiness in Artwork Finishing.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128274;</span><b>8</b></div><div><h3>Install updates</h3><p>Open Settings and confirm your password. Install a verified release ZIP or feed update.</p></div></li>
        </ol>
        <div class="sbs-guide-tip"><strong>Safe working rule:</strong> changing the saved character identity invalidates the previous approval. Generate and review a fresh approval sheet before relying on it for future work.</div>
    </dialog>
    <footer class="sbs-footer">Private creative workspace · Image filtering: Less restrictive (OpenAI low) · Provider content rules still apply</footer>
</div>
<?php wp_print_scripts(array('sbs-fabric', 'sbs-studio', 'sbs-freestyle', 'sbs-finishing')); ?>
</body>
</html>
