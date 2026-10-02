# Smutty Studio

Smutty Studio is a privately distributed WordPress plugin. Its update client
verifies the release checksum and every file in the ZIP, makes a backup,
installs the update, performs a version check, and rolls back a failed install.

## Publishing updates

This repository includes a tag-driven release pipeline in
`.github/workflows/publish-release.yml`. Once its one-time setup is complete,
the normal release process is:

1. Change the plugin and update both version declarations in
   `smutty-bear-studio.php`.
2. Commit and push the change.
3. Push the commit to the repository's main branch.

The workflow creates the matching tag, builds the exact plugin ZIP and release
feed, and attaches both to a GitHub Release in this repository. WordPress will
offer the new version through its normal plugin updater after the feed has been
configured. No command line, signing key, or GitHub secret setup is required.

### One-time WordPress configuration

On the WordPress site, set **Studio → Settings → Private update-feed URL** to
`https://github.com/OWNER/REPOSITORY/releases/latest/download/release-feed.json`,
replacing `OWNER/REPOSITORY` with this repository's GitHub location. Leave the
bearer token empty. GitHub Releases must be publicly downloadable; a private
repository needs a separate authenticated release host instead.

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
