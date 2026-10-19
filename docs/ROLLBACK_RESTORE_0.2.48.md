# Smutty Studio rollback repair and 0.2.48 restore

Status: prepared locally; not published, installed, or deployed.

The restore is built from the 0.2.48 source, with the rollback repair. Its package version is 0.2.50 so the existing updater can install it over 0.2.49. The site will display version 0.2.50; the restored features and code baseline come from 0.2.48, plus the repair.

## Findings

- The rollback error occurs because earlier internal backups contain plugin files but no `release.json` manifest.
- The updater now adds a checksum manifest to new backups. For older backups, it checks the ZIP paths, file sizes, symbolic links, duplicate paths, and filename/plugin version match, then stages a temporary package for the existing verifier.
- Signed release checks remain in the existing verification path. The older-backup compatibility path applies only to a named file in the protected internal backup directory.
- Version 0.2.49 added Google Drive integration and related finishing workflow changes. Version 0.2.48 is the earlier code baseline requested for restoration.
- Both versions declare database version 2. Plugin updates replace files in the plugin folder; private artwork files and WordPress database records are stored outside that folder. The uninstall routine also says projects, private assets, and encrypted settings are retained. This supports preservation, but the live site's files and database have not been inspected.

## Verification status

- `git diff --check` passed.
- Automated tests were added for backup creation, restoring an older file-only backup, rejecting an unsafe backup, and restoring the previous plugin after an installation failure.
- The tests could not be run in this workspace because PHP and ZipArchive are unavailable. A GitHub Actions workflow is included to run syntax checks and the tests on PHP 7.4 and 8.3.
- The existing Artwork Finishing and export checks passed in Node.js. These are code checks, not a live tablet acceptance test.
- The 0.2.50 package was built from the 0.2.48 baseline. All 38 packaged files matched the checksums in its manifest, and the default update-feed address is included. The repository's standard release process does not require a signing key.
- The preferred and alternative 0.2.48 ZIP files were not available locally, so neither archive has been inspected. They are not needed for the prepared restore package, which is built from the 0.2.48 GitHub source tag.
- No live artwork import, processing, comparison, approval, or package download tests have been run.

## Deployment sequence

1. Run the automated checks and review the resulting test report.
2. Present the exact package and test results for explicit approval.
3. Only after approval, merge the change to main. GitHub then builds and publishes version 0.2.50 automatically.
4. After approval, install it on the live site. The updater creates a fresh 0.2.49 backup first.
5. Verify the live version and local artwork workflow.

## Outstanding

- Run tests on PHP with ZipArchive enabled.
- Obtain a passing PHP rollback test result before considering release approval.
- Inspect both available backups and confirm which one is restorable.
- The package version will be 0.2.50 because the current updater rejects same-version and older releases. Confirm the user accepts this displayed version number.
- After approval and restore, test Browse Files → Import → Process → Review → Download package.
- Record live test results and remaining issues for documentation reconciliation.
