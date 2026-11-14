# Studio 0.9.0 implementation and installation handover

Prepared on 14 November 2026 in PR https://github.com/m1citylad-lgtm/smutty-studio/pull/76.

Status: v0.9.0 LIVE, authenticated and checked on 14 November 2026. PR 76 merged at 0505585cf11e5773bc0c824e583dfd3628b0aca8. Signed release build https://github.com/m1citylad-lgtm/smutty-studio/actions/runs/43623826576 passed. The updater reported Installed v0.9.0 and a fresh authenticated reload showed the new UI. No separate installer-button action was needed or observed. Do not mark the complete historical backlog closed.

## Prepared changes

- New top-level Fix workspace: tablet or stored Studio source; brush add/erase, bounded connected-colour selection, selection undo, multiple marked regions, stable zoom/pan, remove-and-blend default and optional replacement text.
- Paid local inpainting uses an actual provider mask and a context crop. The final PNG is deterministically blended only within the confirmed mask, with no hidden feather margin. Every protected RGBA pixel is compared after serialization; mismatches fail closed. ICC, physical resolution and encoded 8/16-bit depth are preserved and checked. Uncertain provider submissions are checkpointed rather than automatically resubmitted.
- Repair previews remain unapproved. Accept creates a separate Finishing workspace with both the original and repaired version selectable; prior workspaces and production registers are untouched. Repeated acceptance reuses one workspace.
- Active Mock-ups workflow now starts with a temporary local photo and approved artwork. Search, refresh, optional tablet PNG, fit, movement, locked-aspect resizing, four-corner perspective, rotation, undo, zoom, and Finish & Download are available. The source photo is not uploaded or archived. Explicit paid photo analysis sends a reduced photo to the configured vision provider with storage disabled and returns geometry/occlusions. The final graphic is sampled from its own original pixels; no generative graphic redraw is used.
- Previous template/mask records, backend routes and regression fixtures remain retained for rollback but are not the active Mock-ups screen.
- Compact wrapping main navigation, gold active state, accessible cog/£ controls, and shared async feedback for existing request-based actions and the new workspaces. Existing Finishing completion batching and sound preference remain authoritative there.
- The Add series button and persistent name/two-letter-code form already exist in 0.8.1; no duplicate series system was introduced.

## Evidence and remaining acceptance

CI runs PHP 7.4 with GD/Imagick and Chromium. New checks cover native protected pixels, disjoint regions, alpha, bit depth, physical resolution, ICC, source-file checksum, job polling/idempotency/uncertain submission, temporary photo handling, placement/download, repair acceptance, sound-off and pending-job feedback. Existing guided Finishing and legacy Mock-ups regression checks remain enabled.

These are deterministic and stub-provider tests. They do not prove actual AI repair quality or guarantee that garment geometry inferred from a real photograph is correct. A purchased angled-shirt photo, flat lay, shadows/patterns/occlusions and real five-legged-animal/fairground repair must still be reviewed. Advanced creative photo enhancement, dense fold deformation, third-party model comparisons and Canva/Photoshop/Caimera benchmarks are not implemented or claimed complete. No unsupported model names or unverified endpoints were added. A full physical Samsung-tablet audio/gesture and every-button acceptance sweep remains open.

## Live verification and remaining work

The owner explicitly authorised the adult-confirmation checkbox, resolving the earlier automatic-review rejection. Studio and privileged updater sign-in succeeded through secure browserAuth. Both CI jobs passed at 608e3c6883683c6d43d9f5acbcc57ca6297692d2. The updater lists retained 0.8.1 and 0.9.0 backup packages; creating or restoring those backups was not directly performed in this session.

Live checks passed: Fix refreshed workspaces/custom series, loaded the existing MB QA Intake Disposable source, painted a temporary mark and visibly undid it. Mock-ups loaded a synthetic blue-shirt photo temporarily, composited the real approved SB Muscle Bear Red artwork, rotated/undid and completed a web download labelled NOT FOR PRINTING. Finishing Add opened its name/two-letter-code form and was cancelled without adding a test series. Gold selected navigation and accessible cog/£ controls appeared. Refresh/import/export loading and terminal result messages were observed.

No paid AI repair or garment analysis ran during live verification, no repaired candidate was accepted, and no production approvals or registers changed. Actual provider output quality and physical Samsung audio/gesture acceptance remain open, along with the advanced enhancements and comparisons listed above. Continue with those outstanding checks; do not repeat installation of the same version merely because this handover preserves historical implementation notes.
