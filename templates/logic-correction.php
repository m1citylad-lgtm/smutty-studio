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
        <div class="sbs-lc-checks"><button type="button" class="sbs-button" data-lc-pass="whole" disabled>Check whole image</button><button type="button" class="sbs-button" data-lc-pass="regions" disabled>Check enlarged regions</button><button type="button" class="sbs-button" data-lc-pass="character" disabled>Check SmuttyBear consistency</button></div>
        <p class="sbs-lc-note">The whole image and overlapping enlarged regions are checked separately. Reference consistency runs only when you select an approved reference.</p>
    </section>
    <section class="sbs-card"><h2 class="sbs-stage-heading">C. Findings</h2><div id="sbs-lc-findings" aria-live="polite"><p class="sbs-lc-empty-findings">No checks run yet.</p></div></section>
    <section class="sbs-card"><h2 class="sbs-stage-heading">D. Keep a correction separately</h2><p>Upload a corrected copy here to save it as a new version. The original stays unchanged.</p><label for="sbs-lc-version-file">Corrected copy<input id="sbs-lc-version-file" type="file" accept="image/png,image/jpeg,image/webp"></label><label for="sbs-lc-version-label">Version note<input id="sbs-lc-version-label" type="text" maxlength="150" placeholder="For example: corrected left arm"></label><button type="button" class="sbs-button" id="sbs-lc-save-version" disabled>Save as separate version</button><label for="sbs-lc-version">Current version<select id="sbs-lc-version" disabled></select></label>
    </section>
</section>
