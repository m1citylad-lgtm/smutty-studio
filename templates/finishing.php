<section class="sbs-panel sbs-af active" data-panel="finishing" aria-labelledby="sbs-af-title">
    <h1 id="sbs-af-title" tabindex="-1">Artwork Finishing</h1>
    <p class="sbs-af-notice"><strong>Local Artwork Finishing.</strong> Files stay in private Studio storage. Download the package when ready. Local finishing approval does not approve production.</p>
    <details id="sbs-af-freestyle-source" hidden><summary>Freestyle source history</summary><p id="sbs-af-freestyle-source-summary"></p><p id="sbs-af-freestyle-source-settings"></p><ol id="sbs-af-freestyle-source-lineage"></ol></details>
    <div class="sbs-grid two">
        <section class="sbs-card"><h2>1. Choose artwork</h2>
            <form id="sbs-af-upload">
                <label for="sbs-af-name">Artwork title <span class="sbs-af-required">Required</span><input id="sbs-af-name" type="text" maxlength="190" spellcheck="true" autocapitalize="sentences" required aria-required="true"></label>
                <label for="sbs-af-file">Browse device — Files / My Files<input id="sbs-af-file" type="file" accept=".png,.jpg,.jpeg,.webp,application/octet-stream" aria-describedby="sbs-af-file-help"></label>
                <label for="sbs-af-gallery-file">Browse Photos / Gallery on this device<input id="sbs-af-gallery-file" type="file" accept="image/*" aria-describedby="sbs-af-file-help"></label>
                <p id="sbs-af-file-help">Choose Files / My Files or Photos / Gallery. PNG, JPEG or WebP up to 20 MB. Drive is not connected.</p>
            <button type="submit" class="sbs-button primary">1. Store untouched original</button>
            <p id="sbs-af-upload-status" role="status" aria-live="polite" aria-atomic="true">No artwork upload completed yet.</p>
            </form>
            <label for="sbs-af-resume">Resume local artwork<select id="sbs-af-resume"><option value="">Choose a workspace</option></select></label>
            <button id="sbs-af-refresh" class="sbs-button" type="button">Refresh workspaces</button>
        </section>
        <section class="sbs-card"><h2>2. Choose a stage</h2>
            <label for="sbs-af-method">Processing option<select id="sbs-af-method"><option value="inspect">Inspect — exact byte copy, no image changes</option><option value="resize">Fit down to print box — preserve aspect ratio, no crop</option><option value="print_png">Prepare print PNG — sRGB, RGBA, 300 PPI</option><option value="upscale">AI upscale — Replicate Real-ESRGAN (automatic 2× or 4×)</option></select></label>
            <div class="sbs-grid two"><label for="sbs-af-width">Print width (inches)<input id="sbs-af-width" type="number" min="1" max="30" step="0.25" value="15"></label><label for="sbs-af-height">Print height (inches)<input id="sbs-af-height" type="number" min="1" max="30" step="0.25" value="18"></label></div>
            <label><input id="sbs-af-print-canvas" type="checkbox"> For Prepare print PNG: fit on a transparent print-size canvas, centred without stretching or enlarging the artwork.</label>
            <p>Prepare print PNG uses the selected candidate, if present. Untagged sources are assumed sRGB; confirm colours manually. Inspect and Fit down stay local. AI upscale sends a copy to Replicate and may cost credits. Original stays unchanged. 300 PPI is a target, not a quality guarantee.</p>
            <details class="sbs-af-flat-background"><summary>Optional: remove a plain background</summary>
                <div class="sbs-af-flat-background-content">
                <p>Local, non-AI operation. It removes selected sampled colours only where connected to the image edge. It can leave fringes or remove edge-touching artwork. Sampling can be uncertain; inspect the preview and saved copy. It does not detect every checkerboard and is not a complex-scene remover.</p>
                <button id="sbs-af-flat-sample" type="button" class="sbs-button" disabled>Sample image corners</button>
                <p id="sbs-af-flat-samples" role="status" aria-live="polite">Choose or resume artwork, then sample its image pixels. The preview background is not sampled.</p>
                <div class="sbs-grid two"><label for="sbs-af-flat-colour">Background colour 1<input id="sbs-af-flat-colour" type="color" value="#ffffff"></label><label for="sbs-af-flat-colour-2">Background colour 2<input id="sbs-af-flat-colour-2" type="color" value="#d0d0d0"></label><label class="sbs-check"><input id="sbs-af-flat-use-second" type="checkbox"> Also remove the second colour</label><label for="sbs-af-flat-tolerance">Colour tolerance (0 = exact, 100 = broader)<input id="sbs-af-flat-tolerance" type="number" min="0" max="100" value="18"></label></div>
                <button id="sbs-af-flat-preview" type="button" class="sbs-button" disabled>Preview edge-colour removal</button>
                <div id="sbs-af-flat-preview-box" class="sbs-af-flat-preview" hidden><strong>Preview only — source unchanged</strong><img id="sbs-af-flat-preview-image" alt="Preview of proposed edge-connected background removal"><p id="sbs-af-flat-preview-summary"></p></div>
                <button id="sbs-af-flat-remove" type="button" class="sbs-button" disabled>Save preview as separate PNG copy</button>
                <button id="sbs-af-flat-undo" type="button" class="sbs-button" disabled>Undo — restore source version</button>
                <p id="sbs-af-flat-status" role="status" aria-live="polite" aria-atomic="true">Choose or resume artwork to use this option.</p>
                </div>
            </details>
            <label for="sbs-af-notes">Correction notes for this version<textarea id="sbs-af-notes" rows="4" maxlength="6000" spellcheck="true" autocapitalize="sentences" placeholder="Dictate details to check. Notes are recorded; they do not instruct AI or redraw this image."></textarea></label>
            <p id="sbs-af-stage-help">Choose a stage. Queue it, then run it. The original stays unchanged.</p>
            <button id="sbs-af-prepare" class="sbs-button" type="button" disabled>2. Queue selected stage</button>
            <p class="sbs-af-then" aria-hidden="true">Then ↓</p>
            <button id="sbs-af-run" class="sbs-button primary" type="button" disabled>3. Run queued stage</button>
            <button id="sbs-af-cancel" class="sbs-button" type="button" disabled>Cancel queued stage or upscale</button>
            <p>Cancel before running. To retry, queue the stage again.</p>
        </section>
    </div>
    <section class="sbs-card"><h2>3. Compare and review</h2>
        <p id="sbs-af-next" class="sbs-af-notice">Next action: upload or resume artwork.</p>
        <label for="sbs-af-versions">Version history<select id="sbs-af-versions"><option value="">No candidates yet</option></select></label>
        <div class="sbs-af-review-controls"><label for="sbs-af-zoom">Comparison zoom (display only)<select id="sbs-af-zoom" aria-describedby="sbs-af-zoom-help"><option value="1">Fit</option><option value="2">2×</option><option value="4">4×</option></select></label>
        <label for="sbs-af-proof">Garment proof background<select id="sbs-af-proof" aria-describedby="sbs-af-proof-help"><option value="checker">Checkerboard</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div>
        <p id="sbs-af-zoom-help">Preview zoom only; it does not change the image.</p>
        <p id="sbs-af-proof-help">Check the image on light and dark backgrounds.</p>
        <p>These on-screen colours check contrast only. They are not physical print proofs or a colour-match guarantee.</p>
        <div class="sbs-af-compare" id="sbs-af-compare"><figure><figcaption>Untouched original</figcaption><div class="sbs-af-viewport" tabindex="0" aria-label="Original image viewport — scroll to inspect"><img id="sbs-af-original" alt="" hidden></div><div id="sbs-af-original-transparency" class="sbs-transparency-indicator" role="status" aria-live="polite" aria-atomic="true" data-state="unknown"><span class="sbs-transparency-bar" aria-hidden="true"></span><span class="sbs-transparency-label">Transparency: Not checked</span></div></figure><figure><figcaption>Selected candidate</figcaption><div class="sbs-af-viewport" tabindex="0" aria-label="Candidate image viewport — scroll to inspect"><img id="sbs-af-candidate" alt="" hidden></div><div id="sbs-af-candidate-transparency" class="sbs-transparency-indicator" role="status" aria-live="polite" aria-atomic="true" data-state="unknown"><span class="sbs-transparency-bar" aria-hidden="true"></span><span class="sbs-transparency-label">Transparency: Not checked</span></div><a id="sbs-af-candidate-download" class="sbs-button" hidden download>Download selected candidate</a></figure></div>
        <p class="sbs-transparency-key">Red = opaque · Amber = partial alpha · Green = transparent with no partial alpha · Grey = not checked</p>
        <section id="sbs-af-print-proof" class="sbs-af-print-proof" aria-labelledby="sbs-af-print-proof-title" hidden>
            <h3 id="sbs-af-print-proof-title">Garment-colour print check</h3>
            <p id="sbs-af-print-proof-help">Tap a proof to inspect it full screen. Screen colours may differ from print.</p>
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
        <button id="sbs-af-refresh-qa" class="sbs-button" type="button">Refresh technical checks — no image changes</button><p>Refreshing checks clears local approval so you can review any new findings.</p>
        <div id="sbs-af-qa"></div>
        <section id="sbs-af-ai-review" class="sbs-af-ai-review" aria-labelledby="sbs-af-ai-review-title" hidden>
            <h3 id="sbs-af-ai-review-title">AI quality check</h3>
            <p>Optional: send both images to OpenAI. This may use credits. It reports issues but does not edit images.</p>
            <button id="sbs-af-ai-review-run" class="sbs-button" type="button">4. Run AI comparison (optional)</button>
            <p id="sbs-af-ai-status" role="status" aria-live="polite" aria-atomic="true">Not run. This check is optional.</p>
            <div id="sbs-af-ai-review-report" class="sbs-af-ai-review-report" aria-live="polite"></div>
        </section>
        <fieldset id="sbs-af-checks"><legend>5. Check this candidate</legend>
            <label><input type="checkbox" data-af-check="identity"> I checked the face, identity and composition against the original.</label>
            <label><input type="checkbox" data-af-check="lettering"> I checked wording and small details.</label>
            <label><input type="checkbox" data-af-check="colour"> I checked colours against the original and accepted any untagged-sRGB assumption.</label>
            <label><input type="checkbox" data-af-check="texture"> I checked transparency, edges, halftone and distress.</label>
            <label><input type="checkbox" data-af-check="garments"> I checked all 12 garment colours and the intended print size.</label>
            <label><input type="checkbox" data-af-check="warnings"> I reviewed the warnings and accept any remaining limits.</label>
        </fieldset>
        <section id="sbs-af-handoff" class="sbs-af-handoff" aria-labelledby="sbs-af-handoff-title">
            <h3 id="sbs-af-handoff-title">Final checks and ChatGPT handoff</h3>
            <p id="sbs-af-readiness" role="status" aria-live="polite" aria-atomic="true" data-state="review">REVIEW — select a candidate to check readiness.</p>
            <label for="sbs-af-handoff-text">Copy this with the ZIP for ChatGPT review<textarea id="sbs-af-handoff-text" rows="9" readonly spellcheck="false"></textarea></label>
            <button id="sbs-af-copy-handoff" class="sbs-button" type="button" disabled>Copy ChatGPT handoff</button>
        </section>
        <button id="sbs-af-approve" class="sbs-button primary" type="button" disabled>6. Approve this local version</button>
        <label for="sbs-af-package-name">ZIP download filename (editable)<input id="sbs-af-package-name" type="text" maxlength="150" autocomplete="off" aria-describedby="sbs-af-package-name-help"></label>
        <p id="sbs-af-package-name-help">Suggested from the artwork title. Studio adds version and date to avoid duplicate names.</p>
        <button id="sbs-af-export" class="sbs-button" type="button" disabled aria-describedby="sbs-af-package-help">7. Build approved ZIP</button>
        <a id="sbs-af-package" class="sbs-button" hidden download>Download local package</a>
        <p id="sbs-af-package-help">ZIP contains the original, candidate, report, finishing-qa.json and file checksums. It is not a final print master.</p>
    </section>
    <div id="sbs-af-ai-focus" class="sbs-af-ai-focus" hidden role="dialog" aria-modal="true" aria-labelledby="sbs-af-ai-focus-title">
        <div class="sbs-af-ai-focus-head">
            <div><h2 id="sbs-af-ai-focus-title">Issue area</h2><p id="sbs-af-ai-focus-note">AI-suggested location; inspect the area manually.</p></div>
            <button id="sbs-af-ai-focus-close" class="sbs-af-ai-focus-close" type="button" aria-label="Close issue view">×</button>
        </div>
        <div class="sbs-af-ai-focus-switch" role="group" aria-label="Image to inspect">
            <button id="sbs-af-ai-focus-original" type="button" class="sbs-button">Original</button>
            <button id="sbs-af-ai-focus-candidate" type="button" class="sbs-button">Candidate</button>
        </div>
        <div id="sbs-af-ai-focus-stage" class="sbs-af-ai-focus-stage" tabindex="0" aria-label="Four-times image view. Scroll to pan around the image."></div>
    </div>
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
        <div id="sbs-af-local-catalogue">
            <label for="sbs-af-search">Search by artwork title or local workspace reference<input id="sbs-af-search" type="search"></label>
            <div class="sbs-af-catalogue-filters">
                <label for="sbs-af-filter-status">Status<select id="sbs-af-filter-status"><option value="">Any status</option></select></label>
                <label for="sbs-af-filter-next">Next task<select id="sbs-af-filter-next"><option value="">Any next task</option></select></label>
                <label for="sbs-af-filter-alpha">Transparency<select id="sbs-af-filter-alpha"><option value="">Any</option><option value="opaque">Opaque</option><option value="partial">Partial alpha</option><option value="transparent">Transparent</option><option value="unknown">Not checked</option></select></label>
            </div>
            <div class="sbs-af-catalogue-batch"><button id="sbs-af-delete-selected" class="sbs-button" type="button" disabled>Delete selected records</button><span id="sbs-af-delete-status" role="status" aria-live="polite"></span></div>
            <p id="sbs-af-counts" role="status" aria-live="polite"></p><div id="sbs-af-records"></div>
        </div>
        <div id="sbs-af-catalogue-viewer" class="sbs-af-catalogue-viewer" hidden role="dialog" aria-modal="true" aria-labelledby="sbs-af-catalogue-viewer-title">
            <div class="sbs-af-catalogue-viewer-panel"><button id="sbs-af-catalogue-viewer-close" class="sbs-button" type="button">Close artwork view</button><h2 id="sbs-af-catalogue-viewer-title"></h2><img id="sbs-af-catalogue-viewer-image" alt="Enlarged catalogue artwork"></div>
        </div>
    </section>
