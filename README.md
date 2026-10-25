# Smutty Studio

Smutty Studio is a privately distributed WordPress plugin. Its update client
verifies the release checksum and every file in the ZIP, makes a backup,
installs the update, performs a version check, and rolls back a failed install.

## Publishing updates

This repository includes a tag-driven release pipeline in
`.github/workflows/publish-release.yml`. Once its one-time setup is complete,
the normal release process is:

1. Change the plugin and update both version declarations in
   `smutty-bear-studio.php` to a version that has not already been released.
   An existing release is never overwritten by this workflow.
2. Validate JavaScript (`node --check assets/js/studio.js`) and run the export
   regression checks (`node tools/test-export.cjs`).
3. Commit and push the complete change to the repository's main branch.
4. Confirm the GitHub release succeeded, install it through Studio → Updates
   (or the WordPress updater), and verify the installed version and live result.
   A commit or GitHub release alone does not update an existing installation.

The workflow creates the matching tag, builds the exact plugin ZIP and release
feed, and attaches both to a GitHub Release in this repository. The release ZIP
contains the repository's GitHub feed URL, so WordPress will offer subsequent
versions through its normal plugin updater without feed configuration. No
command line, signing key, or GitHub secret setup is required.

### Existing installations and custom feeds

An installation older than 0.2.18 must be given the feed once under **Studio →
Settings → Private update-feed URL**:
`https://github.com/OWNER/REPOSITORY/releases/latest/download/release-feed.json`,
replacing `OWNER/REPOSITORY` with this repository's GitHub location. Once it
installs 0.2.18 or later, official release packages carry that default. The
setting remains available as an override for mirrors or private feeds. Leave
the bearer token empty for public GitHub releases; a private repository needs
a separate authenticated release host instead.

There are no repository secrets and no separate release server. The workflow
publishes updates rather than writing directly into the live plugin directory,
preserving checksum checks, backups, health checks, and rollback. Enable
WordPress auto-updates for the plugin if releases should install without an
administrator clicking **Update now**.

### Build a release locally

The same artifacts can be built without GitHub Actions:

```bash
tools/build-release.sh https://updates.example.com/smutty-studio
```

Artifacts are written to `build/release/`. The script refuses malformed
versions, mismatched plugin version declarations, and a dirty working tree (set
`SBS_ALLOW_DIRTY=1` only for local testing).

### Visual Development corrections (v0.2.31)

Images now keep their actions, actual job status and independent **Image Correction Instructions** together. Corrections create review candidates using the original image and preserve accepted references. Drafts persist in the same browser until cleared. See [Visual Development workflow](docs/VISUAL_DEVELOPMENT.md) for usage, progress limitations, tests and deployment verification.

### Freestyle sandbox (v0.2.33)

The top-level **Freestyle** tab provides optional-character generation, eight drawing styles, T-shirt treatments, conversational edits, six recent thumbnails and Undo/Redo. Designs move explicitly into the existing upscale/print workflow. Defaults are opaque backgrounds and a 16 × 18 inch / 300 PPI print target. See [Freestyle workflow](docs/FREESTYLE.md) for history preservation, quality checks, limitations and tests.

### Studio Settings (v0.2.45)

The top-level **Settings** tab contains Studio access/password, OpenAI and Replicate credentials/models, update feed, workspace export/import, storage usage, diagnostics and software updates/rollback. Settings unlocks with the existing Studio sign-in. Forms check the Studio session, a session-bound anti-forgery token and a WordPress nonce; no separate administrator login is required. The existing wp-admin screen remains a recovery route. See [Settings](docs/SETTINGS.md).

### Artwork Finishing test workspace (v0.2.47)

The Artwork Finishing tab supports separate Photos/Gallery and Files/My Files choices, private local intake, a clear file-size limit warning, image inspection, conservative fit-down resizing, side-by-side review and local approval. Review checkboxes stay beside readable text at narrow widths; actions show progress and a saved result. The two local processing steps are numbered. The top navigation no longer inserts information buttons between tabs. This remains a local test workspace: Google Drive selection/storage, permanent AF numbering, and catalogue writes are not active. Local approval does not approve SB production. The original upload remains unchanged.

### Full-screen garment proof viewer (v0.2.56)

Artwork Finishing includes 12 colour proof backgrounds and a full-screen viewer that opens the original or candidate asset directly for detailed inspection. Pinch zoom, one-finger panning, Reset, Close and a horizontally scrollable colour toolbar are supported. Viewer colour changes affect only the display background. See [Print Production Workflow](docs/PRINT_PRODUCTION_WORKFLOW.md).

### Focused AI review (v0.2.65)

AI findings can open a full-screen 4× view centred on an approximate reported location. Switch between Original and Candidate, then scroll to pan. No marker covers the artwork. If the report has no location, the view starts at the image centre. Help text across Studio tabs is shorter while retaining important safety, privacy and cost notes.

### Digital finishing preflight (v0.2.66)

Artwork Finishing adds an explicit **Prepare print PNG** local stage. It uses the selected candidate (otherwise the original), converts valid embedded ICC profiles through Imagick, embeds the bundled sRGB profile, writes 8-bit RGBA PNG and 300 PPI metadata, and preserves originals. Untagged RGB is assumed sRGB with a visible review warning; unsupported/invalid colour declarations fail safely. GD-only hosts accept PNGs with known/assumed sRGB; non-PNG/profile conversion requires Imagick.

Optional transparent target canvases fit, centre and pad without stretching, cropping or enlarging artwork pixels. The metadata shows the resulting artwork footprint in inches; a larger canvas does not invent detail. Print sizes remain editable.

**Refresh technical checks** analyses the selected candidate without paid provider calls or pixel changes and clears local approval for renewed review. Bounded alpha samples can flag representative detached marks, enclosed openings and pale partial-alpha pixels. These are possible concerns, including intentional halftone/distress/counters/fades; they are never automatically removed. View area opens the existing 4× viewer without covering artwork with markers. Sampling can miss small defects. Low-memory hosts report sampling unavailable instead of risking a full-image decode.

Approved local ZIPs include `finishing-qa.json` and `checksums.sha256`. The manifest records source/candidate hashes, export metadata, print target, generation/processing provenance, advisory findings and PASS/REVIEW/HOLD digital checks. It never grants production approval. The read-only production adapter reuses finishing checks only for approved matching bytes/target and requests selective rechecks after changed pixels or print size, plus brand placement and garment variants. Screen garment colours are contrast previews, not physical printer proofs.

### Transparency indicators (v0.2.69)

Freestyle and Artwork Finishing show a compact, high-contrast transparency status beneath each image. The status is decoded from image pixels: red means opaque, amber means partial alpha, green means transparent with no partial-alpha pixels, and grey means not checked. A thin colour bar, white-on-dark status pill and white text key make the result visible without taking much screen space. Artwork Finishing checks both the untouched original and selected candidate. Opaque checkerboard pixels remain opaque; the preview background is never used to infer transparency.

New OpenAI generations retain requested model/quality/size separately from provider-reported model/quality/size and actual decoded native pixels. Unknown provider revisions/maxima remain unknown. This release does not introduce new Freestyle models or query imaginary capability endpoints; live model-capability adapters and reference/outfit profiles remain deferred until Artwork Finishing owner acceptance.

Validation: the existing release gates plus real PNG conversion, alpha/white-ink preservation, no-upscale canvas, selected-candidate lineage, QA reuse/invalidation and checksum-verified ZIP tests run with both Imagick and GD-only.


### Print fit and in-context review decisions (v0.2.86)

Artwork Finishing now defaults to a 16 × 18 inch chest-print box and calculates effective PPI after proportional fit, alongside the artwork's maximum 300-PPI dimensions. The resolution guide is green at 300 PPI or above, amber from 250–299 PPI, and red below 250 PPI. Technical and AI findings share one review area, where each finding can be recorded as intentional, false alarm or unresolved, opened for in-place correction, or used to reject the candidate while preserving its history. Local approval remains separate from production approval.
