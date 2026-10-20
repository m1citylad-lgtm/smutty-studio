<section class="sbs-panel sbs-af" data-panel="finishing" aria-labelledby="sbs-af-title">
    <h1 id="sbs-af-title" tabindex="-1">Artwork Finishing</h1>
    <p class="sbs-af-notice"><strong>Local Artwork Finishing.</strong> Files stay in private Studio storage. Download the package when ready. Local finishing approval does not approve production.</p>
    <div class="sbs-grid two">
        <section class="sbs-card"><h2>1. Choose artwork</h2>
            <form id="sbs-af-upload">
                <label for="sbs-af-name">Artwork title <span class="sbs-af-required">Required</span><input id="sbs-af-name" type="text" maxlength="190" spellcheck="true" autocapitalize="sentences" required aria-required="true"></label>
                <label for="sbs-af-file">Browse device — Files / My Files<input id="sbs-af-file" type="file" accept=".png,.jpg,.jpeg,.webp,application/octet-stream" aria-describedby="sbs-af-file-help"></label>
                <label for="sbs-af-gallery-file">Browse Photos / Gallery on this device<input id="sbs-af-gallery-file" type="file" accept="image/*" aria-describedby="sbs-af-file-help"></label>
                <p id="sbs-af-file-help">Choose either Files / My Files or Photos / Gallery. PNG, JPEG or WebP; up to 20 MB and 40 million pixels. Photos / Gallery uses the image picker offered by your browser and tablet. Google Drive is a separate future connection.</p>
            <button type="submit" class="sbs-button primary">Store untouched original locally</button>
            <p id="sbs-af-upload-status" role="status" aria-live="polite" aria-atomic="true">No artwork upload completed yet.</p>
            </form>
            <label for="sbs-af-resume">Resume local artwork<select id="sbs-af-resume"><option value="">Choose a workspace</option></select></label>
            <button id="sbs-af-refresh" class="sbs-button" type="button">Refresh workspaces</button>
        </section>
        <section class="sbs-card"><h2>2. Choose a stage</h2>
            <label for="sbs-af-method">Processing option<select id="sbs-af-method"><option value="inspect">Inspect — exact byte copy, no image changes</option><option value="resize">Fit down to print box — preserve aspect ratio, no crop</option><option disabled>Conservative AI upscale — adapter pending</option><option disabled>Sharpen / denoise / edge cleaning — preservation validation pending</option><option disabled>Background removal — deliberate background protection pending</option></select></label>
            <div class="sbs-grid two"><label for="sbs-af-width">Print width (inches)<input id="sbs-af-width" type="number" min="1" max="30" step="0.25" value="15"></label><label for="sbs-af-height">Print height (inches)<input id="sbs-af-height" type="number" min="1" max="30" step="0.25" value="18"></label></div>
            <p>300 PPI target; 4500 × 5400 pixels at 15 × 18 inches. Fit down never enlarges or distorts. Source detail and colour must be reviewed. Local processing uses no paid provider.</p>
            <label for="sbs-af-notes">Correction notes for this version<textarea id="sbs-af-notes" rows="4" maxlength="6000" spellcheck="true" autocapitalize="sentences" placeholder="Dictate details to check. Notes are recorded; they do not instruct AI or redraw this image."></textarea></label>
            <p id="sbs-af-stage-help">1. Choose the processing option and press “Queue selected stage.” 2. When it is queued, press “Run queued local stage.” You can cancel before running.</p>
            <button id="sbs-af-prepare" class="sbs-button" type="button" disabled>1. Queue selected stage</button>
            <p class="sbs-af-then" aria-hidden="true">Then ↓</p>
            <button id="sbs-af-run" class="sbs-button primary" type="button" disabled>2. Run queued local stage</button>
            <button id="sbs-af-cancel" class="sbs-button" type="button" disabled>Cancel queued stage</button>
            <p>Cancel is available before running. A running local server operation finishes as a separate version; the original is retained. Retry by queuing the stage again.</p>
        </section>
    </div>
    <section class="sbs-card"><h2>3. Compare and review</h2>
        <p id="sbs-af-next" class="sbs-af-notice">Next action: upload or resume artwork.</p>
        <label for="sbs-af-versions">Version history<select id="sbs-af-versions"><option value="">No candidates yet</option></select></label>
        <div class="sbs-af-review-controls"><label for="sbs-af-zoom">Comparison zoom (display only)<select id="sbs-af-zoom" aria-describedby="sbs-af-zoom-help"><option value="1">Fit</option><option value="2">2×</option><option value="4">4×</option></select></label>
        <label for="sbs-af-proof">Garment proof background<select id="sbs-af-proof" aria-describedby="sbs-af-proof-help"><option value="checker">Checkerboard</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div>
        <p id="sbs-af-zoom-help">Zoom changes only how large the preview appears. It does not upscale or change the image.</p>
        <p id="sbs-af-proof-help">Choose Light, inspect the candidate, then choose Dark and inspect it again. This changes the preview background only.</p>
        <div class="sbs-af-compare" id="sbs-af-compare"><figure><figcaption>Untouched original</figcaption><div class="sbs-af-viewport" tabindex="0" aria-label="Original image — scroll when magnified"><img id="sbs-af-original" alt="" hidden></div></figure><figure><figcaption>Selected candidate</figcaption><div class="sbs-af-viewport" tabindex="0" aria-label="Candidate image — scroll when magnified"><img id="sbs-af-candidate" alt="" hidden></div><a id="sbs-af-candidate-download" class="sbs-button" hidden download>Download selected candidate</a></figure></div>
        <div id="sbs-af-progress" role="status" aria-live="polite" aria-atomic="true">No operation running.</div>
        <progress id="sbs-af-progress-bar" aria-label="Local finishing operation" hidden></progress>
        <div id="sbs-af-qa"></div>
        <fieldset id="sbs-af-checks"><legend>Human review of this candidate</legend>
            <label><input type="checkbox" data-af-check="identity"> I checked face, character identity, composition, stars and fur against the original.</label>
            <label><input type="checkbox" data-af-check="lettering"> I checked all wording, lettering and small details.</label>
            <label><input type="checkbox" data-af-check="texture"> I checked alpha edges, halos, deliberate backgrounds, halftone and distress.</label>
            <label><input type="checkbox" data-af-check="garments"> I inspected the candidate on both Light and Dark backgrounds and at the intended print size.</label>
            <label><input type="checkbox" data-af-check="warnings"> I reviewed the quality warnings and accept any unresolved limitations for this local candidate.</label>
        </fieldset>
        <button id="sbs-af-approve" class="sbs-button primary" type="button" disabled>Approve this local finishing version</button>
        <label for="sbs-af-package-name">ZIP download filename (editable)<input id="sbs-af-package-name" type="text" maxlength="150" autocomplete="off" aria-describedby="sbs-af-package-name-help"></label>
        <p id="sbs-af-package-name-help">Suggested from the artwork title. You may change it before building the ZIP. Studio adds a version and date to prevent confusing duplicate downloads.</p>
        <button id="sbs-af-export" class="sbs-button" type="button" disabled>Build approved local package</button>
        <a id="sbs-af-package" class="sbs-button" hidden download>Download local package</a>
        <p>Download contains the untouched original, candidate, metadata, checksums and report; WebP preview when supported. It is not a final production master.</p>
    </section>
</section>
<section class="sbs-panel sbs-af" data-panel="catalogue" aria-labelledby="sbs-af-catalogue-title">
    <h1 id="sbs-af-catalogue-title">Artwork Catalogue</h1>
    <p>Local workspaces are processing records, not production approvals or a second catalogue. Studio does not update Drive registers.</p>
        <div id="sbs-af-local-catalogue"><label for="sbs-af-search">Search by artwork title or local workspace reference<input id="sbs-af-search" type="search"></label><p id="sbs-af-counts" role="status"></p><div id="sbs-af-records"></div></div>
    </section>
