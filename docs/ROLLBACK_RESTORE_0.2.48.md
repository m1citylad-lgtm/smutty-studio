# Smutty Studio rollback repair and restore

Updated: 2026-10-19 — final status after live verification

## Completed and verified

- The first rollback attempt failed with invalid_manifest_size. Investigation found that internally created backup ZIPs lacked the release manifest expected by the installer.
- PR #9 corrected backup manifest handling, added validation for older file-only backups, and retained rejection of unsafe archives.
- The v0.2.48 local Artwork Finishing feature baseline was restored in release v0.2.50. The installed release is labelled 0.2.50 because the updater cannot install a lower-numbered 0.2.48 over 0.2.49.
- PR #9 merged as commit 7fb2bc90950af4376f34833290b6fe8e512cac00. GitHub release workflow run #51 succeeded and published release v0.2.50 with release-feed.json and smutty-bear-studio-0.2.50.zip.
- The live Studio page was checked on 2026-10-19 and displayed v0.2.50. This confirms installation of the corrected release.
- Repository regression checks covered backup creation, restoring legacy file-only backups, invalid-backup rejection, and recovery after a failed installation. Local artwork/export checks also passed before release.

## Current workflow and limits

The owner approved retiring Google Picker and direct Drive transfer from the active workflow. Use Android Files / My Files to import artwork, process and review locally, approve the local finishing candidate, download the artwork/package, then upload the package into ChatGPT for Drive filing and documentation. The live page retains disabled Google controls marked deferred; transfer is not active.

The owner returned a local-finishing ZIP on 2026-10-19, confirming that a download was produced. Its contents were not inspected. The public Studio page was signed out during the final check, so authenticated local processing was not repeated. Local finishing approval is not final production approval.

AI upscaling, sharpening/denoising and background removal remain pending development. Friendly artwork-title ZIP filenames are an approved documentation requirement only and are not implemented by this release.

## Historical note

At the time of the initial rollback investigation, the live site was still at v0.2.49 and the installation test had not been performed. That status was superseded: live v0.2.50 was confirmed on 2026-10-19. Do not follow the earlier planned installation steps as outstanding work.

A later documentation-only push to main triggered workflow run #52, which failed. This occurred after v0.2.50 was published and did not change the v0.2.50 release.

## References

- Release v0.2.50: https://github.com/m1citylad-lgtm/smutty-studio/releases/tag/v0.2.50
- PR #9: https://github.com/m1citylad-lgtm/smutty-studio/pull/9
- Successful release workflow run #51: https://github.com/m1citylad-lgtm/smutty-studio/actions/runs/39325280034
- Live Studio: https://www.growinsane.com/smutty-studio/
