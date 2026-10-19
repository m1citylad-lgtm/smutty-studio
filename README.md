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

The top-level **Freestyle** tab provides optional-character generation, eight drawing styles, T-shirt treatments, conversational edits, six recent thumbnails and Undo/Redo. Designs move explicitly into the existing upscale/print workflow. Defaults are opaque backgrounds and a 15 × 18 inch / 300 PPI print target. See [Freestyle workflow](docs/FREESTYLE.md) for history preservation, quality checks, limitations and tests.

### Studio Settings (v0.2.45)

The top-level **Settings** tab contains Studio access/password, OpenAI and Replicate credentials/models, update feed, workspace export/import, storage usage, diagnostics and software updates/rollback. Settings unlocks with the existing Studio sign-in. Forms check the Studio session, a session-bound anti-forgery token and a WordPress nonce; no separate administrator login is required. The existing wp-admin screen remains a recovery route. See [Settings](docs/SETTINGS.md).

### Artwork Finishing test workspace (v0.2.46)

The Artwork Finishing tab supports private local intake, image inspection, conservative fit-down resizing through the WordPress image editor, side-by-side review, local approval and package download. This is a live test workspace: Google Drive selection/storage, permanent AF numbering, and catalogue writes are not active. Local approval does not approve SB production. The original upload remains unchanged.
