<section class="sbs-panel sbs-lc" data-panel="logic-correction" id="sbs-logic-correction-panel" aria-labelledby="sbs-lc-title">
    <div class="sbs-panel-heading"><div><p class="sbs-kicker">VISUAL REVIEW · ORIGINAL PRESERVED</p><h1 id="sbs-lc-title">Logic Correction</h1></div></div>
    <p class="sbs-lc-intro">Check anatomy, objects, accessories and scene placement. Findings are suggestions to inspect; uncertain cases stay marked “Needs review.” Images are never changed by this check.</p>
    <section class="sbs-card"><h2 class="sbs-stage-heading">A. Choose an image</h2>
        <label for="sbs-lc-title-input">Image name<input id="sbs-lc-title-input" type="text" maxlength="150" placeholder="Give this image a name"></label>
        <div class="sbs-lc-file-row"><label for="sbs-lc-file">Browse files<input id="sbs-lc-file" type="file" accept="image/png,image/jpeg,image/webp"></label><label for="sbs-lc-camera">Photos / gallery<input id="sbs-lc-camera" type="file" accept="image/*" capture="environment"></label></div>
        <button type="button" class="sbs-button" id="sbs-lc-upload">Upload image</button>
        <label for="sbs-lc-workspace">Saved image<select id="sbs-lc-workspace"><option value="">Choose an image</option></select></label>
        <p id="sbs-lc-status" role="status" aria-live="polite"></p>
    </section>
    <section class="sbs-card"><h2 class="sbs-stage-heading">B. Review the image</h2><div class="sbs-lc-selected"><img id="sbs-lc-preview" alt="Selected image preview" hidden><p id="sbs-lc-empty">Upload or choose a saved image to begin.</p><button type="button" class="sbs-button" id="sbs-lc-open-viewer" disabled>Open image viewer</button></div>
        <label for="sbs-lc-reference">Approved SmuttyBear reference<select id="sbs-lc-reference"><option value="">No reference check</option></select></label>
        <p class="sbs-lc-note">The full image and four enlarged areas are checked. A selected approved character is checked too. Your saved focused checks run after these checks.</p>
        <button type="button" class="sbs-button sbs-lc-run-all" id="sbs-lc-run-all" disabled>Run all checks</button>
    </section>
    <section class="sbs-card sbs-lc-focused">
        <h2 class="sbs-stage-heading">Focused checks</h2>
        <p class="sbs-lc-note">Add checks that should be included automatically every time. For example: “Bear ears must sit below hats, not blend into them.”</p>
        <div id="sbs-lc-custom-checks" class="sbs-lc-custom-checks" aria-live="polite"></div>
        <div class="sbs-lc-check-tools"><button type="button" class="sbs-button" id="sbs-lc-add-check">Add a focused check</button><button type="button" class="sbs-button" id="sbs-lc-save-checks">Save focused checks</button></div>
        <p id="sbs-lc-check-status" class="sbs-lc-check-status" role="status" aria-live="polite"></p>
    </section>
    <section class="sbs-card"><h2 class="sbs-stage-heading">C. Findings</h2><div id="sbs-lc-findings" aria-live="polite"><p class="sbs-lc-empty-findings">No checks run yet.</p></div></section>
    <section class="sbs-card"><h2 class="sbs-stage-heading">D. Keep a correction separately</h2><p>Upload a corrected copy here to save it as a new version. The original stays unchanged.</p><label for="sbs-lc-version-file">Corrected copy<input id="sbs-lc-version-file" type="file" accept="image/png,image/jpeg,image/webp"></label><label for="sbs-lc-version-label">Version note<input id="sbs-lc-version-label" type="text" maxlength="150" placeholder="For example: corrected left arm"></label><button type="button" class="sbs-button" id="sbs-lc-save-version" disabled>Save as separate version</button><label for="sbs-lc-version">Current version<select id="sbs-lc-version" disabled></select></label>
    </section>
</section>

<dialog class="sbs-lc-repair" id="sbs-lc-repair-dialog" aria-labelledby="sbs-lc-repair-title">
    <div class="sbs-lc-repair-head"><div><h2 id="sbs-lc-repair-title">Fix this area</h2><p id="sbs-lc-repair-finding"></p></div><button type="button" class="sbs-button" id="sbs-lc-repair-close">Close</button></div>
    <p class="sbs-lc-note">Paint over only the part to change, then describe the correction. The rest of the image is restored from the original. AI edits can still look wrong, so inspect the preview.</p>
    <div class="sbs-lc-repair-stage" id="sbs-lc-repair-stage"><div class="sbs-lc-repair-canvas-wrap"><img id="sbs-lc-repair-image" alt="Image area to correct"><canvas id="sbs-lc-repair-mask" aria-label="Painted correction mask"></canvas><canvas id="sbs-lc-repair-overlay" aria-hidden="true"></canvas></div><img id="sbs-lc-repair-preview" alt="AI correction preview" hidden></div>
    <div class="sbs-lc-repair-controls" id="sbs-lc-repair-controls">
        <label for="sbs-lc-brush-size">Brush size <input id="sbs-lc-brush-size" type="range" min="2" max="18" value="7"> <span id="sbs-lc-brush-readout">7%</span></label>
        <button type="button" class="sbs-button" id="sbs-lc-clear-mask">Clear painted area</button>
        <label for="sbs-lc-repair-prompt">Describe the correction<textarea id="sbs-lc-repair-prompt" rows="3" maxlength="500" placeholder="For example: reshape the elbow naturally; keep the arm pose, fur and lighting the same."></textarea></label>
        <button type="button" class="sbs-button" id="sbs-lc-generate-repair">Create AI preview</button>
    </div>
    <div class="sbs-lc-repair-result" id="sbs-lc-repair-result" role="status" aria-live="polite"></div>
    <div class="sbs-lc-repair-preview-actions" id="sbs-lc-repair-preview-actions" hidden><button type="button" class="sbs-button" id="sbs-lc-undo-repair">Undo preview</button><button type="button" class="sbs-button" id="sbs-lc-save-repair">Save as separate version</button></div>
</dialog>
