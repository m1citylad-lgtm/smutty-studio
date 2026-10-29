# Studio Update Log

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
