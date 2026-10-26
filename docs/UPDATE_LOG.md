# Studio Update Log

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
**Status:** Planned; not included in v0.2.96.

Bring **“6. Approve this local version”** into line with the stage buttons:

- Use the same black starting appearance as other enabled action buttons, so it does not look inactive.
- Show a spinner and processing state while local approval is being saved.
- After success, show a prominent green tick on the right side of the button.
- Keep the normal disabled appearance only when approval is genuinely blocked by missing checks or unresolved findings.
- Preserve the distinction between local finishing approval and production approval.

