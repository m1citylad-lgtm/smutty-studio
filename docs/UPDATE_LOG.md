# v0.4.10 — Complete the Drive run register (7 November 2026)

Implementation in progress; PHP/JavaScript/browser regressions and signed publication pending.

- Extend the `Studio Production Register.csv` created by v0.4.9 with an explicit row for each run folder, plus one row for every individual artifact. Keep the folder row linked to the same prefix/title/version/repeat name as the files.
- Add separate `Transfer status` and `Production status` fields. A successful upload is recorded as `Verified` and begins at `Awaiting inspection`, so the register can continue through later inspection and production steps.
- Preserve idempotent retries: re-running a successful transfer must not duplicate the folder or artifact rows. A lost response after a successful register write must be safe to retry.
- This is a CSV register written by the Studio's existing Drive connection, not a native Google Sheet. The request allowed a register in any form; keeping CSV avoids asking the owner to grant a new Google Sheets OAuth scope. It remains readable/editable from Drive for later ChatGPT review and status updates.
- The owner still needs to verify Drive permissions and complete one real approved-artwork transfer after the signed release is installed. No live file-transfer test is claimed yet.

# v0.4.9 — Direct Artwork Finishing transfer and Drive register (7 November 2026)

Published and confirmed on the live Studio page as v0.4.9 on 7 November 2026. PHP/JavaScript and guided browser workflows passed in GitHub Actions. Real account Drive transfer and register update remain unverified.

- Replace the final Google Drive ZIP upload action with individual verified uploads: original artwork, selected final artwork, metadata, finishing QA, SHA-256 checksums and a short transfer report. The Studio does not assemble a ZIP for this Drive path; the optional local ZIP download remains available as a manual backup.
- Create each output folder with the two-letter prefix first, followed by a readable title, version and repeat number, for example `MB-Madam-Butterfly-v3-R01`. Suggest the two letters from the artwork title and let the owner edit them. Do not put a date at the start of the folder name.
- Maintain `Studio Production Register.csv` in the main Smutty Bear Drive folder, with one row per verified transferred file, including folder, artwork/version, artifact type, filename, MIME type, size, SHA-256, Drive file ID/link, Studio workspace and approval time.
- Resume uploads using retained Drive file IDs and resumable sessions, verify each file by parent folder, name, size and MD5 against its local source, and make retries idempotent. Update the register under an atomic WordPress option lock and avoid duplicate register rows when an earlier update succeeded but its response was lost.
- Make the Drive folder and register links available in the finishing completion state and the ChatGPT handoff. Folder creation, file transfer and register update are separate verified steps; a register failure remains visible and can be retried without creating duplicate artwork files.
- Live Google Drive connection, folder permissions, resumable retry and register update still require a real owner-account transfer after the signed package is published. No live artwork transfer is claimed before that check.

# v0.4.8 — Gentle Artwork Finishing completion sound (7 November 2026)

Published and confirmed on the live Studio page as v0.4.8 on 7 November 2026. PHP/JavaScript and guided browser workflows passed in GitHub Actions. Signed installer backup creation and authenticated owner-device playback remain unobserved; the live page currently shows the Studio sign-in screen.

- Add a short two-note, locally synthesized bamboo-like cue after Artwork Finishing actions reach success or failure. The cue plays once after the visual status updates and never during the processing spinner.
- Add an accessible on/off control, enabled by default and persisted in the browser. Keep visual success/error feedback authoritative; audio is supplemental and no external service or credits are used.
- Stage-button spinner/tick/error states and the square issue marker without a centre dot are already present in v0.4.7 source. They still need current owner-device acceptance before the older log items can be closed.

# v0.4.7 — Resume upscale finishing within the server time limit (5 November 2026)

Validation passed on 5 November 2026 at source commit bc5bb4ada6966ac7ccf8fb6aed836a833c8793d0, GitHub Actions run 42119943188: PHP 7.4.33 syntax/regressions; actual PNG single/tiled resumed stages; injected save timeout and final-check failure; one provider poll/download and zero duplicate paid submissions during single-image recovery; preserved target/dimensions/clear and partial alpha/opaque white ink; legacy last-tile and next-section sequencing; Imagick/GD print/export/rollback regressions; and Chromium progress/completion plus a real page reload retaining the same workspace/job and running indicator. Signed publication pipeline 42120210960 passed at merge commit 0ac42fbd42c21471109cf0f35bdd1cfdae2cdcaa and published v0.4.7. A fresh Cloud Browser reload of the live Studio reports v0.4.7. The agent session is still at the Studio password screen: the private affected job, its completed saved result and live dimensions/alpha remain unverified; installation mechanism and live backup creation were not observed.

- The supplied refreshed live Diagnostics screenshot (7431.jpg) confirms a PHP execution-time-limit failure: poll / save candidate / class-sbs-storage.php:103, 30-second limit, peak PHP memory 115 MB against 768 MB. That line computes SHA-256 after writing the candidate. The timeout location is confirmed; the share of time spent in earlier image operations is not measured. Memory exhaustion is not the recorded cause.
- Split successful upscale finishing across persisted requests: obtain completed provider output, save the download/last section, join saved sections, restore source alpha and save the candidate, then run final checks and select the completed version. Reopening continues the saved local stage; it does not rerun completed assembly or download/provider work after a later-stage failure.
- Save a completed tile before preparing/submitting the next section. Legacy pending jobs with a provider ID and existing tile outputs enter the new pipeline without starting over. Existing-job prepare/run guards prevent overwriting tracking with another paid upscale. Cancelling a completed provider job during local finishing clears local pending work without attempting a remote cancel.
- Upscale run/poll requests ask PHP for a bounded 120-second allowance when the configured limit is shorter; unlimited or already longer host limits are retained. This changes only the current upscale request and cannot override external proxy/hosting limits. Reference: https://www.php.net/manual/en/function.set-time-limit.php.
- Join sections directly into a temporary private PNG file and register it through file storage, avoiding a full assembled PNG string in PHP alongside the image canvas. Source dimensions, overlap crop/composition, alpha restoration, opaque ink and print targets are preserved.
- Progress shows the current finishing stage, including after a page reload/resume. The bounded polling window allows for the additional saved stages instead of stopping after the old 60 status checks. Failed provider results are errors; a still-pending upscale is not labelled complete. A candidate is selected only after its saved file passes checks; interruptions retain originals and prior versions.
- Tests use actual PNGs and local provider stubs, with injected candidate-save timeout and final-check failure, persisted reopen/retry, legacy final-tile recovery, next-section sequencing, alpha/white ink/dimension/target checks, and browser progress/completion. No paid requests are used in tests.
- Live job completion, final result alpha/dimensions, refresh/reopen and the current installation backup remain unverified while the agent's Studio session is signed out. The signed installer requires a usable rollback backup before replacing files; its regression checks must pass before release.

# v0.4.6 — Upscale failure diagnostics and recovery (5 November 2026)

Validation passed on 5 November 2026 at source commit 0dd889e3987b4db3c688bffe6d090ccfe59f3e61, GitHub Actions run 42113937777: PHP 7.4.33 syntax/regressions, actual memory-limit termination retaining its checkpoint, safe errors, provider/job preservation, duplicate-submit refusal, lock release, WordPress fatal-template hook, Imagick/GD ICC/RGBA/PPI/alpha/ZIP checks and Chromium recovery/artwork-isolation tests. Signed release pipeline 42114157837 passed at merge commit 29c4b423fcf2f4aa873b8e6255806708baab04b3 and published v0.4.6. A fresh Cloud Browser reload of the live Studio subsequently reports v0.4.6. The session remains at the Studio password screen, so the affected private job, its actual fatal, recovery output, dimensions/alpha and reopening have not been validated live. The installation mechanism was not observed. The existing signed-package installer creates a rollback backup before replacing plugin files and refuses installation if that backup fails (source reviewed; rollback regression test passed). Creation of a live backup has not been observed.

- A supplied live v0.4.5 screenshot shows a WordPress critical-error response while an upscale remains pending. A second screenshot shows all basic environment checks passing. These checks cannot identify a request-specific fatal. The exact production PHP cause remains unconfirmed; memory exhaustion is not established.
- Port the previously unmerged upscale recovery patch (#51) onto v0.4.5, retaining its print-visible review and decision persistence changes.
- Catch PHP engine exceptions, request WordPress's configured image-processing memory allowance, and reserve a small amount of memory for fatal shutdown diagnostics where PHP permits them. Persist a safe checkpoint before each heavy stage so even immediate process termination retains the last stage reached. Release compressed output/section buffers before further image decoding or joining. No change to alpha restoration, pixel resampling, image dimensions or print targets.
- Diagnostics gains Last finishing failure: safe reason, processing stage, action, exception/error category, PHP source basename/line, configured memory/time limits and peak PHP memory. Raw exception/provider messages, credentials, job IDs and output URLs are excluded from this report and the plugin's diagnostic log entry. PHP's own host logging remains host-controlled. Peak PHP memory does not measure all native Imagick memory.
- Instrument provider checking, section preparation/downloading/joining, output validation, source checking, transparency restoration, saving and final candidate checks. Known image-tool exceptions record their actual stage without exposing raw text.
- Replace critical-error HTML/non-JSON replies with a readable failure instruction. A stopped upscale check is labelled Processing stopped rather than continuing to imply work is running. Reopening a saved job checks its existing ID; starting another upscale against an existing ID is refused. Saved workspace bytes are left untouched by failed polling; originals and previous versions remain available.
- Tests cover an injected PHP engine error, an actual PHP memory-limit termination in a subprocess (including runtimes that skip shutdown callbacks), pre-allocation checkpoint persistence, stage/reason recording, secret exclusion, unchanged job tracking, duplicate-submit refusal, lock release, readable UI failure and artwork isolation. Existing image/print tests must also pass before publication. Test provider calls are local stubs and spend no credits.
- PHP may terminate without running shutdown callbacks. An unfinished checkpoint is explicitly labelled possibly running or interrupted; it identifies a stage, not the cause. The host PHP log may still be needed for the exact fatal. WordPress fatal-template integration uses its documented wp_php_error_message hook without changing the template message (https://developer.wordpress.org/reference/hooks/wp_php_error_message/). PHP hard-OOM shutdown limitations are described in the official advisory https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w.
- The new report cannot recover a fatal that occurred before this version was installed. The existing job must be checked again after installation to capture the real failing stage. Authenticated live recovery, saved result dimensions/alpha, reopening and installation backup remain unverified until access is available. No claim that the underlying production crash is fixed is made by this diagnostic release.

# v0.4.5 — Review what may show on a T-shirt (5 November 2026)

Published v0.4.5; the live Studio login reports v0.4.5 after a fresh page reload on 5 November 2026. Signed release pipeline 42099524034 passed. Authenticated artwork validation remains pending; the installation mechanism and pre-update backup were not inspected in this session.

- Replace grid-cell/single-pixel flags with connected components measured at the selected print box. Starting advisory filters retain compact marks about 0.8 mm across with sufficient ink area, or contrasting continuous lines about 3 mm long. These thresholds are screening defaults, not guarantees of visibility on a particular fabric or printer.
- Suppress isolated pixels, tiny specks, hidden RGB under zero alpha and narrow ordinary antialiasing. Group nearby related areas. Very dense results become labelled groups with every location retained for Next similar area.
- Broad partial transparency is labelled double-check: possible smoke, fade or texture. This is a geometric uncertainty label, not reliable semantic smoke recognition. No automatic opacity restoration or bulk cleanup is offered. Scanning and accepting an effect do not edit pixels.
- Show printed dimensions, a visible scanning/completion state, one selected marker and a centred 4× view. Keep selected area/group as intentional records the decision; unchanged source/policy/print size restores it on reopening.
- The extra print-area scan is optional. Legacy microscopic scan results no longer block approval. If the new scan is used, its potentially visible findings need review; known opaque backgrounds still require attention. Existing artwork-action/final-comparison/human review gates remain.
- Bounded point sampling still supplies alpha statistics but does not pretend a sampled point establishes visible defect size. Previous sampled-point findings remain in technical history, outside the required action list.
- All Studio AI visual-review routes now use the same print-relevance policy: concentrate on visible anatomy, lettering, clipping, blobs and long halos, group related marks, omit microscopic findings, and label possible effects as uncertain. Finishing supplies the print dimensions; other routes explicitly state when dimensions are unknown.
- Originals, saved image versions, print dimensions and genuine alpha remain untouched by this change. Old AI reports are not silently rerun or charged again.
- Validation passed: PHP 7.4.33 syntax, print-policy parsing/filtering, optional-scan gates, saved-decision regressions, Imagick/GD alpha and PNG/export tests, synthetic physical-scale tests and Chromium UI tests. UI evidence includes one-pixel suppression, a single smoke advisory, centred 4× review, no automatic opacity/bulk fix, intentional acceptance surviving reopening, and unchanged image bytes. GitHub Actions run 42099110370 at commit 95900ebfb2e41b83e04cf3085afd370c07f4a3d8. A fresh Cloud Browser reload of https://www.growinsane.com/smutty-studio/ reports Smutty Studio v0.4.5. The session is at the password screen, so no claim is made that SB Muscle Bear Purple or another private workspace has been tested live.

# v0.4.4 — Preserve artwork review decisions (5 November 2026)

Published v0.4.4 on 5 November 2026; live installation and validation pending. Signed release pipeline 42085507330 passed and published smutty-bear-studio-0.4.4.zip. Cloud Browser still shows the unauthenticated v0.4.2 login; no live installation, backup creation or production verification is claimed.

- Reopening the pixel scanner preserves intentional-mark acceptance only for the same image hash, counts and transparency results. Changed results require a new decision.
- Continuing an unchanged artwork check resumes saved reports and their decisions without another paid call. New artwork, instructions or saved rules start a new review. Existing legacy reports retain their saved decisions and acquire a rules snapshot on first continuation.
- Resolved action-list and final-comparison findings collapse into labelled resolved entries; the comparison counts unresolved findings instead of continuing to call accepted findings action needed. Sampled flags show an explicit resolved state.
- A separate fresh-check action intentionally replaces the saved AI report and uses provider credits. Ordinary final comparison reuses the selected version's completed report.
- Step 3 artwork decisions and Step 5 comparison decisions remain separately scoped: they assess different concerns. No fuzzy matching or automatic acceptance of new findings is introduced.
- Repeating the file check at the same print target refreshes technical checks in place instead of creating another candidate that loses its final comparison decisions.
- Original images, version history, pixels, alpha and print dimensions are not modified by this repair.
- Validation passed on 5 November 2026: PHP 7.4.33 syntax and persistence regressions, Imagick/GD alpha and PNG/export checks, and Chromium guided UI regressions covering accept → refresh → rescan, file-check version preservation and artwork isolation. Evidence: GitHub Actions run 42085259484 at commit aef4336b87b6952705994a52a38e29b09c84d916. Live installation is blocked by the unauthenticated Studio browser session; the live login still reports v0.4.2.

# v0.4.2 — Final workflow status checks (3 November 2026)

Step 1 now gives the first instruction immediately. Starting another artwork clears old repair/archive status messages, and saved-archive completion must match the current approval. ZIP report wording reflects the new archive capability. The previously inactive Google connection controls now check status, save encrypted client settings and handle connect/disconnect inside Step 6. Regression and browser-flow checks cover the corrected states.

# v0.4.1 — Standalone finishing assets (3 November 2026)

Corrects the explicit asset list used by Studio's standalone page so the guided workflow and pixel scanner scripts and styles load. The live v0.4.0 check found this omission; regression checks now cover this entry point. Signed release and live verification are tracked separately.

# v0.4.0 — Guided Artwork Finishing (3 November 2026)

Released and installed; live verification identified the standalone asset-list correction in v0.4.1.

- One six-section finishing screen: choose artwork, check artwork, fix the action list, upscale/prepare, final check, approve/save ZIP.
- Clear next-action guidance, written completion states, large controls, saved rules and optional character references within Finishing.
- Existing whole/close-up/custom/character reviews generate the artwork action list. Local AI repairs show Keep/Reject previews; originals and history remain available.
- All processing consumes the selected version. Larger upscale inputs use overlapping native-resolution sections instead of shrinking first. Section count and paid-credit use are shown before starting.
- Local repair composition preserves original pixels outside its allowed rectangle and existing partial alpha inside. Upscaled transparency comes from the selected source, including smoke/fades and opaque white ink.
- Final comparison and matching pixel-review evidence gate approval. New artwork clears the screen without deleting saved records. Old image checks do not authorize new artwork.
- Verified resumable ZIP upload to the existing Smutty Bear archive; retries retain one reserved Drive file ID. Folder, file size and checksum must match before Saved is shown.
- Drive requires the Studio Google connection to have access to the existing archive folder. Local ZIP download remains available. No AF/SB IDs, marketplace publications or production approvals are allocated by this update.
- The experimental legacy Logic Correction tab remains available. Main finishing work now happens in Artwork Finishing.

Validation: existing regression suite plus real-image alpha/outside-patch checks, current-source lineage, state transitions, tile coverage, interrupted Drive upload and browser workflow tests. Provider artwork-quality and owner-device acceptance remain separate from mocked network tests.

# Studio Update Log

## Findings controls unlock after processing
**Recorded:** 30 October 2026
**Status:** Implemented in v0.3.7.

- Refresh dynamically created review controls when processing starts and finishes, retaining per-action restrictions for missing locations, missing finding IDs and stopped cleanups.
- Fix the automatic square cleanup save path to use the existing in-place pixel correction result.
- Regression checks cover unlocking after busy states and preserving genuinely unavailable actions.


## Finishing input size, print colour and automatic status refresh
**Recorded:** 30 October 2026  
**Status:** Implemented in v0.3.6.

- Reduce oversized provider input copies proportionally below 2 million pixels; choose the upscale factor from the actual input size. Keep the original unchanged and record input dimensions.
- Recognise standard sRGB chromaticities in PNGs without an ICC profile and embed the bundled sRGB profile during Step 3. Continue refusing unsupported colour declarations rather than silently changing colours.
- Show Inspect results from the current candidate automatically; report a completed upscale separately from print preparation warnings. Keep the three existing buttons in top-to-bottom order.


## Correction scan activation and feedback
**Recorded:** 29 October 2026  
**Status:** Implemented in v0.3.5.

- Initialise the correction scan after Finishing has exposed its workspace bridge, so the scan button always receives its click handler.
- Show a black ready button, animated spinner while scanning, a green completion tick after a successful scan, and a visible error with a retry path if scanning fails.
- Keep the scan result distinct from a correction: a completed scan means findings are ready to review, not that pixels were changed.


## Finishing workspace reset and correction readiness
**Recorded:** 29 October 2026  
**Status:** Implemented in v0.3.4.

- Add a clear-selection action that removes the current image from the screen and upload form without deleting its saved workspace.
- Reset transient stage indicators when switching between artwork workspaces so one image's run state cannot carry over to another.
- Explain why full-image correction scanning is unavailable, including when artwork is not selected or a stage is queued.


## Whole-image finishing corrections and marked review
**Recorded:** 29 October 2026  
**Status:** Implemented in v0.3.3.

- Add a whole-image inspection workflow for artwork of any subject, including character art and lettering. Detect only correction types that appear necessary; show acceptable or not-needed categories without inviting unnecessary runs.
- Show every detected issue on the original preview with a clear outline marker. Use a square or an oblong sized to fit the issue, centre the issue within it, and do not shade or cover the image inside the marker.
- Provide separate correction actions for relevant cleanup categories, including inconsistent edge colours/fringes, stray pixels, opacity recovery for areas intended to print solid (including lettering), and transparency-edge treatment. Preserve intentional partial transparency such as smoke.
- Let the user select a marker and run the relevant correction on that marked area, or run all suggested corrections across all marked areas in one sweep. Do not require a marker selection for the whole-image sweep.
- Keep the original unchanged. Show the corrected result in the same review window; tapping the image outside markers toggles between original and corrected. Provide undo for the latest correction and keep correction results as a separate version until accepted.
- Support touch pinch-to-zoom and two-finger panning. Fit the image within the available preview area initially; allow scrolling within the image viewport when needed.
- Keep the preview and its controls together in one compact, responsive window, with no navigation required to reach the image, marker list, correction actions, compare control, or undo. Arrange controls compactly to fit the available screen space; confine any necessary scrollbars to the image area.
- Show per-category/per-marker status: red for suggested, amber for uncertain or requiring review, a spinner while running, green when corrected and rechecked or explicitly accepted, and grey when no correction is needed. Update status after each run so completed or acceptable items are not needlessly rerun.

## Catalogue deletion for queued and mixed-status workspaces
**Recorded:** 28 October 2026
**Status:** Implemented in v0.3.0.

- Allow individually safe catalogue records to be deleted together even when other selected records are blocked; identify records left unchanged and why.
- Cancel queued local stages and verified remote upscale jobs before removing their workspace files. Keep a record if a remote job is still active or cancellation cannot be confirmed.
- Preserve shared or externally referenced files, and show eligible files, jobs to cancel, preserved files, and blocked records in the confirmation.
- Stage and commit each record independently, restoring its files if its database or filesystem step fails. Refresh the catalogue and report partial results.

## Planned Logic Correction improvements
**Recorded:** 26 October 2026  
**Status:** Implemented in v0.2.99.

- Add an explicit **Fix this area** action to a finding. Open its marked area, allow a small editable mask and correction instruction, and generate an AI preview limited to that local area.
- Keep every preview separate from the original. Provide **Undo/discard** and save accepted edits as a new version only; never alter the original automatically.
- Change the Logic Correction description/instruction boxes from white to blue, move action buttons outside those boxes so they do not cover text, and remove the small round information buttons.
- Replace the separate check buttons with one **Run all checks** button. Run the whole-image check, then enlarged-region checks, then the approved character-reference check only when a character is selected.
- Add an editable **Focused checks** list. Let the user add, edit, and remove checks (for example, ears fitting below hats without blending into them, or body bugs without human legs). Apply saved checks by default to each inspection, after the standard checks, and show their findings in the same marked review list.
- Add a local AI correction preview with a painted mask, discard/undo, and save-as-new-version controls. The original version remains untouched.

## Logic Correction visual review
**Recorded:** 26 October 2026
**Status:** Implemented in v0.2.98.

- Added a standalone Logic Correction tab immediately before Finishing.
- Added separate whole-image, overlapping enlarged-region, and approved SmuttyBear reference checks.
- Findings show an approximate marker, concise issue and severity; uncertain evidence is labelled “Needs review.”
- The checks never edit the uploaded image. Corrected copies are stored as separate versions.
- Tablet file and photo selection, image zoom/pan, and isolated review storage are supported.

## Candidate selection fix for Inspect and ZIP export
**Recorded:** 25 October 2026
**Status:** Implemented in v0.2.97.

- Inspect now inspects the currently selected version instead of reverting to a copy of the untouched original.
- Local approval and ZIP generation reject a candidate whose file checksum is identical to the original.
- This prevents an unchanged original from being presented as a finished candidate and makes Inspect preserve an upscale already selected.

## Planned for a later build — finishing approval button continuity
**Recorded:** 25 October 2026  
**Status:** Implemented in v0.3.2.

Bring **“6. Approve this local version”** into line with the stage buttons:

- Enabled local approval uses a clear black button treatment; it retains the disabled appearance when checks or unresolved findings block approval.
- Saving displays a spinner and the processing label.
- Successful local approval displays a prominent green tick at the right of the button.
- Local finishing approval remains separate from production approval.

