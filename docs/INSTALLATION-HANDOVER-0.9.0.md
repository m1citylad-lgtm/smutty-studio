# Studio 0.9.0 implementation and installation handover

Prepared on 14 November 2026 in PR https://github.com/m1citylad-lgtm/smutty-studio/pull/76.

Status: implementation branch; not merged, signed, installed or accepted on the live site. The last observed live version is 0.8.1. Do not mark the complete historical changelog installed from this document.

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

## Continue installation

1. Obtain explicit permission to tick the live Studio adult-confirmation checkbox. Automatic approval review rejected this checkbox on 14 November; do not bypass it. Password entry itself was allowed. Keep credentials in browserAuth, never chat or model-visible tools.
2. Check the latest PR head and both CI jobs. Resolve failures before merging.
3. Merge the reviewed head. Verify the signed release workflow, then install through the authenticated Studio updater if needed. Do not claim an installer action or backup without observing it.
4. Verify the authenticated live version and the Fix, Mock-ups and navigation screens. Run non-destructive checks with disposable artwork; avoid modifying production approvals or registers.
5. Record installed and verified items separately from remaining actual-provider/physical-device acceptance. Keep outstanding research and unsupported integrations open.
