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
