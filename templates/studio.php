<!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Smutty Studio</title>
    <?php wp_print_styles(array('sbs-studio', 'sbs-studio-hierarchy')); ?>
</head>
<body class="sbs-body">
<div id="sbs-app" class="sbs-shell" data-rest="<?php echo esc_url(rest_url('smutty-bear/v1/')); ?>" data-authenticated="<?php echo SBS_Auth::is_authenticated() ? '1' : '0'; ?>" data-slug="<?php echo esc_attr(SBS_Plugin::studio_slug()); ?>" data-version="<?php echo esc_attr(SBS_VERSION); ?>">
    <header class="sbs-header">
        <nav id="sbs-primary-nav" class="sbs-primary-tabs" aria-label="Main studio areas" <?php echo SBS_Auth::is_authenticated() ? '' : 'hidden'; ?>>
            <button data-primary-tab="characters" class="active">Characters</button>
            <button data-primary-tab="usage">Usage</button>
            <button data-primary-tab="updates">Updates</button>
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
                <nav class="sbs-tabs" aria-label="Studio sections">
                    <button data-tab="characters" class="active">Description</button>
                    <button data-tab="development">Visual Development</button>
                    <button data-tab="references">Reference</button>
                    <button data-tab="create">Idea Room</button>
                    <button data-tab="projects">Creations</button>
                    <button data-tab="canvas">Merch Canvas</button>
                </nav>
                <div class="sbs-character-commands"><button id="sbs-new-pack" class="sbs-button primary">New character</button><button id="sbs-fork-pack" class="sbs-button" disabled>Create new version</button></div>
            </div>
            </div>

            <section class="sbs-panel" data-panel="create">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">IDEA ROOM</p><h1>Turn a cheeky thought into a scene</h1></div><span class="sbs-pill">Strong innuendo · non-explicit</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128161;</span><div><strong>Use the Idea Room to develop artwork.</strong> Start with a rough joke, choose or edit one of the suggested concepts, then generate drafts. The selected character description and relevant references are included automatically.</div></aside>
                <div class="sbs-grid two">
                    <article class="sbs-card">
                        <p class="sbs-context-note">Creating for <strong id="sbs-idea-character-name">the selected character</strong></p>
                        <label>Rough idea<textarea id="sbs-idea" rows="6" placeholder="Smutty Bear proudly polishing an absurdly oversized garden hose at a seaside caravan..."></textarea></label>
                        <button id="sbs-ideas-button" class="sbs-button primary">Suggest three concepts</button>
                    </article>
                    <article class="sbs-card">
                        <h2>Concepts</h2>
                        <div id="sbs-concepts" class="sbs-concepts"><p class="sbs-muted">Your three editable visual jokes will appear here.</p></div>
                    </article>
                </div>
                <article class="sbs-card sbs-prompt-card">
                    <div class="sbs-inline-heading"><h2>Scene prompt</h2><span>The current character identity and references are added automatically.</span></div>
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

            <section class="sbs-panel active" data-panel="characters">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CHARACTER DESCRIPTION</p><h1>Description</h1></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#9998;</span><div><strong>This is the character's source of truth.</strong> Define the personality, appearance, essential traits, exclusions, humour boundary and palette manually. Reference analysis can suggest changes, but nothing replaces these fields until you approve it.</div></aside>
                <div id="sbs-pack-description" class="sbs-card"><p class="sbs-muted">Choose a character above or create a new character.</p></div>
            </section>

            <section class="sbs-panel" data-panel="development">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">TEXT TO VISUAL IDENTITY</p><h1>Visual Development</h1></div><span class="sbs-pill">Description → concepts → references</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#127912;</span><div><strong>Build and approve the character here.</strong> Generate concepts from a text-only Description when needed, refine and choose one seed, create the first reference set, then generate one or more consistency sheets and accept the strongest candidate without leaving this tab.</div></aside>
                <div id="sbs-development-root"><p class="sbs-muted">Choose a character above or create a new character.</p></div>
            </section>

            <section class="sbs-panel" data-panel="references">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CHARACTER GROUNDING</p><h1>Reference Material</h1></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128444;</span><div><strong>Manage the character's visual source material here.</strong> Upload existing authorised artwork, inspect or remove accepted Visual Development assets, and request optional Description suggestions. Approval generation and review remain in Visual Development.</div></aside>
                <div id="sbs-pack-references" class="sbs-card"><p class="sbs-muted">Choose a character above or create a new character.</p></div>
            </section>

            <section class="sbs-panel" data-panel="projects">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">CREATIONS</p><h1>Refine, polish and upscale <span id="sbs-creations-character-name"></span></h1></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128444;</span><div><strong>Creations contains the selected character's project history.</strong> Open a project to compare drafts, choose an image for refinement, polish or upscale it, inspect it at full size, and remove unwanted results or complete project sets.</div></aside>
                <div class="sbs-grid project-layout"><div id="sbs-project-list" class="sbs-project-list"></div><div id="sbs-project-detail" class="sbs-card"><p class="sbs-muted">Choose a project to inspect its generation tree.</p></div></div>
            </section>

            <section class="sbs-panel" data-panel="canvas">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">MERCHANDISE COMPOSER</p><h1>Compose artwork for <span id="sbs-canvas-character-name"></span></h1></div><div class="sbs-row"><button id="sbs-canvas-save" class="sbs-button primary">Save design</button><button id="sbs-canvas-export" class="sbs-button accent">Export PNG</button></div></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128085;</span><div><strong>Use Merch Canvas to assemble production artwork.</strong> Add creations or references, arrange layers, add text and shapes, set the physical print size and DPI, then save the editable design back to its project or export a transparent PNG.</div></aside>
                <div class="sbs-canvas-layout">
                    <aside class="sbs-canvas-tools sbs-card">
                        <label>Project<select id="sbs-canvas-project"></select></label>
                        <fieldset class="sbs-media-picker"><legend>Creations</legend><input id="sbs-canvas-creation" type="hidden" value=""><div id="sbs-canvas-creation-gallery" class="sbs-media-gallery"><p class="sbs-muted">Choose a project to browse its creations.</p></div></fieldset>
                        <button id="sbs-add-creation" class="sbs-button full">Add creation</button>
                        <hr>
                        <div class="sbs-tool-grid"><button data-tool="text">Text</button><button data-tool="rect">Rectangle</button><button data-tool="circle">Circle</button><button data-tool="upload">Upload</button><button data-tool="group">Group</button><button data-tool="ungroup">Ungroup</button></div>
                        <input id="sbs-canvas-upload" type="file" accept="image/png,image/jpeg,image/webp,font/ttf,font/otf,font/woff,font/woff2" hidden>
                        <label>Fill / text colour<input id="sbs-object-colour" type="color" value="#f4e0ad"></label>
                        <label>Font family<input id="sbs-font-family" type="text" value="Arial"></label>
                        <div class="sbs-tool-grid"><button data-tool="crop-square">Square crop</button><button data-tool="mask-circle">Circle mask</button><button data-tool="mask-rect">Rectangle mask</button><button data-tool="mask-clear">Clear mask</button><button data-tool="duplicate">Duplicate</button></div>
                    </aside>
                    <div class="sbs-canvas-stage"><div class="sbs-canvas-scroll"><canvas id="sbs-design-canvas" width="900" height="900"></canvas></div><div class="sbs-canvas-status"><button data-tool="undo">Undo</button><button data-tool="redo">Redo</button><span id="sbs-canvas-message">Ready</span></div></div>
                    <aside class="sbs-layers sbs-card"><h2>Layers</h2><div id="sbs-layer-list"></div><div class="sbs-tool-grid"><button data-tool="front">To front</button><button data-tool="back">To back</button><button data-tool="lock">Lock</button><button data-tool="hide">Hide</button><button data-tool="delete" class="sbs-danger-tool">Delete layer</button></div><div class="sbs-layer-reference"><fieldset class="sbs-media-picker"><legend>Reference</legend><input id="sbs-canvas-reference" type="hidden" value=""><div id="sbs-canvas-reference-gallery" class="sbs-media-gallery"><p class="sbs-muted">Choose a character to browse its references.</p></div></fieldset><button id="sbs-add-reference" class="sbs-button full">Add reference</button></div><div class="sbs-print-settings"><h3>Print setup</h3><label>Print width (in)<input id="sbs-print-width" type="number" min="1" max="40" step="0.25" value="12"></label><label>Print height (in)<input id="sbs-print-height" type="number" min="1" max="40" step="0.25" value="12"></label><label>DPI<input id="sbs-print-dpi" type="number" min="72" max="600" step="1" value="300"></label><p id="sbs-print-readout" class="sbs-muted">3600 × 3600 px target</p><label class="sbs-check"><input id="sbs-transparent" type="checkbox" checked> Transparent background</label><label class="sbs-check"><input id="sbs-guides" type="checkbox" checked> Show safe/bleed guides</label><label class="sbs-check"><input id="sbs-snapping" type="checkbox" checked> Snap objects to grid and centre</label></div></aside>
                </div>
            </section>
            </div>

            <section class="sbs-panel" data-panel="usage">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">USAGE LEDGER</p><h1>Provider activity by character</h1></div><span class="sbs-pill">Calculated estimates, not invoices</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128200;</span><div><strong>Usage attributes provider activity to each character.</strong> Review generation, analysis and upscale operations together with their usage-derived estimated costs. Provider invoices remain authoritative.</div></aside>
                <div id="sbs-usage-summary" class="sbs-metric-grid"></div><div class="sbs-card"><table class="sbs-table"><thead><tr><th>Date</th><th>Character</th><th>Provider</th><th>Operation</th><th>Estimated USD</th></tr></thead><tbody id="sbs-usage-rows"></tbody></table></div>
            </section>

            <section class="sbs-panel" data-panel="updates">
                <div class="sbs-panel-heading"><div><p class="sbs-kicker">SIGNED RELEASES</p><h1>Updates</h1></div><span class="sbs-pill">Password reconfirmation required</span></div>
                <aside class="sbs-tab-help"><span aria-hidden="true">&#128274;</span><div><strong>Update the Studio without WordPress or FTP access.</strong> Re-enter the shared Studio password to start a short update session. Release files and checksums are verified before installation.</div></aside>
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
        <ol class="sbs-guide-steps">
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128100;</span><b>1</b></div><div><h3>Choose the character</h3><p>Select a character and version from the tray. Everything beneath it—ideas, creations, references, designs and usage—is scoped to that selection.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#9998;</span><b>2</b></div><div><h3>Write the description</h3><p>Describe the intended identity manually. Treat the Description tab as the authoritative creative brief, including non-negotiable traits and things to avoid.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#127912;</span><b>3</b></div><div><h3>Develop a visual seed</h3><p>If no artwork exists, generate four character concepts from the Description, refine the strongest option and select it as the persistent visual seed.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128444;</span><b>4</b></div><div><h3>Build visual grounding</h3><p>Generate or upload references under precise roles. Review generated face, body, expression, outfit and style results individually, accepting only images that remain on-model.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#9989;</span><b>5</b></div><div><h3>Test consistency</h3><p>At the bottom of Visual Development, generate as many approval-sheet candidates as needed, enlarge and inspect every view, then accept one genuinely on-model sheet. It is stored under Reference automatically; accepting another makes that one current.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128161;</span><b>6</b></div><div><h3>Create and refine</h3><p>Develop a joke in Idea Room, generate drafts, then use Creations to select, refine, polish or upscale the strongest result.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128085;</span><b>7</b></div><div><h3>Compose merchandise</h3><p>Combine artwork, references, typography and shapes in Merch Canvas. Save the editable design to its project and export at the required print dimensions.</p></div></li>
            <li><div class="sbs-guide-illustration"><span aria-hidden="true">&#128274;</span><b>8</b></div><div><h3>Install updates</h3><p>Open the top-level Updates tab, reconfirm the shared Studio password, then install a release ZIP or a newer release from the private feed. Corrupted, incompatible or incorrectly structured packages are rejected automatically.</p></div></li>
        </ol>
        <div class="sbs-guide-tip"><strong>Safe working rule:</strong> changing the saved character identity invalidates the previous approval. Generate and review a fresh approval sheet before relying on it for future work.</div>
    </dialog>
    <footer class="sbs-footer">Private creative workspace · Generated imagery remains subject to provider policies</footer>
</div>
<?php wp_print_scripts(array('sbs-fabric', 'sbs-studio')); ?>
</body>
</html>
