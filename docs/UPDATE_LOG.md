# v0.4.3 — Upscale failure recovery (5 November 2026)

Prepared; live validation pending. The v0.4.2 upscale failure was reproduced while polling an existing 1024 × 1536 source job. Exact server fatal remains unconfirmed.

- Request WordPress’s configured image-processing memory allowance before finishing actions; release enlarged PNG bytes before QA decoding.
- Catch PHP engine errors as structured REST errors, retaining saved versions and provider tracking for recovery.
- Record memory/time-limit fatal failures in authenticated Settings diagnostics; detailed exception text stays in the server PHP log.
- Replace raw WordPress HTML in action errors with a readable recovery message.
- A failed poll never submits another paid prediction automatically.

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

