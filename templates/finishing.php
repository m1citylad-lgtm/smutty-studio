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
            <label for="sbs-af-method">Processing option<select id="sbs-af-method"><option value="inspect">Inspect — exact byte copy, no image changes</option><option value="resize">Fit down to print box — preserve aspect ratio, no crop</option><option value="upscale">AI upscale — Replicate Real-ESRGAN (automatic 2× or 4×)</option><option disabled>Sharpen / denoise / edge cleaning — preservation validation pending</option><option disabled>Background removal — deliberate background protection pending</option></select></label>
            <div class="sbs-grid two"><label for="sbs-af-width">Print width (inches)<input id="sbs-af-width" type="number" min="1" max="30" step="0.25" value="15"></label><label for="sbs-af-height">Print height (inches)<input id="sbs-af-height" type="number" min="1" max="30" step="0.25" value="18"></label></div>
            <p>300 PPI is a pixel-dimension target, not proof of print quality. Fit down never enlarges or distorts. Inspect and Fit down stay local. AI upscale sends the original to Replicate, uses your configured credits, and saves its result as a separate candidate; the original stays unchanged. Review text, faces, texture, transparency and all proof backgrounds.</p>
            <label for="sbs-af-notes">Correction notes for this version<textarea id="sbs-af-notes" rows="4" maxlength="6000" spellcheck="true" autocapitalize="sentences" placeholder="Dictate details to check. Notes are recorded; they do not instruct AI or redraw this image."></textarea></label>
            <p id="sbs-af-stage-help">1. Choose the processing option and press “Queue selected stage.” 2. Press “Run queued stage.” For AI upscale, Studio checks progress and saves the finished result locally. The untouched original is retained.</p>
            <button id="sbs-af-prepare" class="sbs-button" type="button" disabled>1. Queue selected stage</button>
            <p class="sbs-af-then" aria-hidden="true">Then ↓</p>
            <button id="sbs-af-run" class="sbs-button primary" type="button" disabled>2. Run queued stage</button>
            <button id="sbs-af-cancel" class="sbs-button" type="button" disabled>Cancel queued stage or upscale</button>
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
        <section id="sbs-af-print-proof" class="sbs-af-print-proof" aria-labelledby="sbs-af-print-proof-title" hidden>
            <h3 id="sbs-af-print-proof-title">Garment-colour print check</h3>
            <p id="sbs-af-print-proof-help">Select any proof image to inspect the full-resolution candidate on that garment colour. These are screen proofs only, not a guarantee of the printed result.</p>
            <p id="sbs-af-print-status" role="status" aria-live="polite" aria-atomic="true">Select artwork to run the pixel-size check.</p>
            <div class="sbs-af-proof-grid" role="group" aria-label="Garment-colour proof backgrounds">
                <figure><figcaption>1. BLACK</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="black" aria-label="Inspect artwork on black"><img data-af-proof-image="black" alt="" hidden></button></figure>
                <figure><figcaption>2. WHITE</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="white" aria-label="Inspect artwork on white"><img data-af-proof-image="white" alt="" hidden></button></figure>
                <figure><figcaption>3. RED</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="red" aria-label="Inspect artwork on red"><img data-af-proof-image="red" alt="" hidden></button></figure>
                <figure><figcaption>4. NAVY</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="navy" aria-label="Inspect artwork on navy"><img data-af-proof-image="navy" alt="" hidden></button></figure>
                <figure><figcaption>5. YELLOW</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="yellow" aria-label="Inspect artwork on yellow"><img data-af-proof-image="yellow" alt="" hidden></button></figure>
                <figure><figcaption>6. ORANGE</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="orange" aria-label="Inspect artwork on orange"><img data-af-proof-image="orange" alt="" hidden></button></figure>
                <figure><figcaption>7. LIGHT GREEN</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="light-green" aria-label="Inspect artwork on light green"><img data-af-proof-image="light-green" alt="" hidden></button></figure>
                <figure><figcaption>8. DARK GREEN</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="dark-green" aria-label="Inspect artwork on dark green"><img data-af-proof-image="dark-green" alt="" hidden></button></figure>
                <figure><figcaption>9. PALE BLUE</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="pale-blue" aria-label="Inspect artwork on pale blue"><img data-af-proof-image="pale-blue" alt="" hidden></button></figure>
                <figure><figcaption>10. LIGHT GREY</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="light-grey" aria-label="Inspect artwork on light grey"><img data-af-proof-image="light-grey" alt="" hidden></button></figure>
                <figure><figcaption>11. DARK GREY</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="dark-grey" aria-label="Inspect artwork on dark grey"><img data-af-proof-image="dark-grey" alt="" hidden></button></figure>
                <figure><figcaption>12. BROWN</figcaption><button type="button" class="sbs-af-proof-swatch" data-proof-color="brown" aria-label="Inspect artwork on brown"><img data-af-proof-image="brown" alt="" hidden></button></figure>
            </div>
        </section>
        <div id="sbs-af-progress" role="status" aria-live="polite" aria-atomic="true">No operation running.</div>
        <progress id="sbs-af-progress-bar" aria-label="Local finishing operation" hidden></progress>
        <div id="sbs-af-qa"></div>
        <section id="sbs-af-ai-review" class="sbs-af-ai-review" aria-labelledby="sbs-af-ai-review-title" hidden>
            <h3 id="sbs-af-ai-review-title">AI quality check</h3>
            <p>Optional visual comparison of the untouched original and selected candidate. Both images are sent to OpenAI using your configured model and may use your OpenAI API credits. The review only reports possible issues; it never changes artwork and does not replace your checks.</p>
            <button id="sbs-af-ai-review-run" class="sbs-button" type="button">Run AI comparison (sends both images to OpenAI)</button>
            <div id="sbs-af-ai-review-report" class="sbs-af-ai-review-report" aria-live="polite"></div>
        </section>
        <fieldset id="sbs-af-checks"><legend>Human review of this candidate</legend>
            <label><input type="checkbox" data-af-check="identity"> I checked face, character identity, composition, stars and fur against the original.</label>
            <label><input type="checkbox" data-af-check="lettering"> I checked all wording, lettering and small details.</label>
            <label><input type="checkbox" data-af-check="texture"> I checked alpha edges, halos, deliberate backgrounds, halftone and distress.</label>
            <label><input type="checkbox" data-af-check="garments"> I inspected the candidate on all 12 garment-colour proof backgrounds and at the intended print size.</label>
            <label><input type="checkbox" data-af-check="warnings"> I reviewed the quality warnings and accept any unresolved limitations for this local candidate.</label>
        </fieldset>
        <button id="sbs-af-approve" class="sbs-button primary" type="button" disabled>Approve this local finishing version</button>
        <label for="sbs-af-package-name">ZIP download filename (editable)<input id="sbs-af-package-name" type="text" maxlength="150" autocomplete="off" aria-describedby="sbs-af-package-name-help"></label>
        <p id="sbs-af-package-name-help">Suggested from the artwork title. You may change it before building the ZIP. Studio adds a version and date to prevent confusing duplicate downloads.</p>
        <button id="sbs-af-export" class="sbs-button" type="button" disabled aria-describedby="sbs-af-package-help">Build and save approved local package</button>
        <a id="sbs-af-package" class="sbs-button" hidden download>Download local package</a>
        <p id="sbs-af-package-help">The ZIP contains the untouched original, candidate, metadata, checksums and report; it is not a final production master. On Android Chrome, choose Downloads to save inside “Smutty Studio ZIP files” (created if needed), or choose an existing folder. If folder access is unavailable, use the browser download link.</p>
    </section>
    <div id="sbs-af-proof-viewer" class="sbs-af-proof-viewer" hidden aria-modal="true" role="dialog" aria-label="Full-screen garment proof viewer">
        <button id="sbs-af-proof-close" class="sbs-af-proof-close" type="button" aria-label="Close proof viewer">×</button>
        <div id="sbs-af-proof-stage" class="sbs-af-proof-stage"><img id="sbs-af-proof-large" alt="Full-resolution artwork proof"></div>
        <div class="sbs-af-proof-toolbar" role="toolbar" aria-label="Garment colours and reset">
            <div class="sbs-af-proof-colours" id="sbs-af-proof-colours" aria-label="Garment colour selection">
                <button type="button" class="sbs-af-colour" data-viewer-color="black" aria-label="Black" title="Black"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="white" aria-label="White" title="White"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="red" aria-label="Red" title="Red"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="navy" aria-label="Navy" title="Navy"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="yellow" aria-label="Yellow" title="Yellow"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="orange" aria-label="Orange" title="Orange"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="light-green" aria-label="Light green" title="Light green"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="dark-green" aria-label="Dark green" title="Dark green"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="pale-blue" aria-label="Pale blue" title="Pale blue"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="light-grey" aria-label="Light grey" title="Light grey"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="dark-grey" aria-label="Dark grey" title="Dark grey"></button>
                <button type="button" class="sbs-af-colour" data-viewer-color="brown" aria-label="Brown" title="Brown"></button>
            </div>
            <button id="sbs-af-proof-reset" type="button" class="sbs-af-proof-reset">Reset</button>
        </div>
    </div>
</section>
<section class="sbs-panel sbs-af" data-panel="catalogue" aria-labelledby="sbs-af-catalogue-title">
    <h1 id="sbs-af-catalogue-title">Artwork Catalogue</h1>
    <p>Local workspaces are processing records, not production approvals or a second catalogue. Studio does not update Drive registers.</p>
        <div id="sbs-af-local-catalogue"><label for="sbs-af-search">Search by artwork title or local workspace reference<input id="sbs-af-search" type="search"></label><p id="sbs-af-counts" role="status"></p><div id="sbs-af-records"></div></div>
    </section>
