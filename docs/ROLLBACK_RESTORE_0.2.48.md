# Smutty Studio rollback repair and restore

Updated: 2026-10-19

## Completed

- Corrected the rollback failure. New backups now include the checksum list required by the installer. Older internal backups are checked and safely prepared before restoration; unsafe archives are rejected. Existing release verification remains in place.
- Restored the 0.2.48 artwork workflow and removed the 0.2.49 Google Drive integration.
- Published **0.2.50** because the updater will not install an older-numbered release over 0.2.49. Its features are based on 0.2.48, with the rollback repair.
- GitHub automated checks passed, including backup creation, old-backup rollback, unsafe-backup rejection, recovery after a failed install, PHP checks, and the existing artwork/export checks.
- GitHub published release v0.2.50 with `release-feed.json` and `smutty-bear-studio-0.2.50.zip`. The release build completed successfully.
- Local artwork and export checks passed before publishing.

## Data and recovery

The update changes plugin files. Both versions use database version 2, and private artwork is stored outside the plugin folder. The uninstall code also retains projects, private assets, and encrypted settings. These code checks indicate that an update should leave those items in place; the live site's records and files have not been inspected directly.

The standard installer makes a fresh backup of the currently installed 0.2.49 before installing 0.2.50, preserving a route back to the current release. The two older 0.2.48 ZIPs were not available to inspect and are not needed: the release was built from the repository's 0.2.48 source.

## Still needed

The live site remains at 0.2.49. The browser available for this work is stopped at the Studio password screen, so the update has not been installed and the live workflow has not been tested.

After signing in to the Studio:

1. Open **Settings**.
2. Under **Software updates and rollback**, enter the same Studio password again and choose **Unlock Updates**.
3. Choose **Check now**. Confirm it shows version **0.2.50**, then choose **Install verified feed release**.
4. After the page reloads, confirm the top of the Studio says **v0.2.50**.
5. Test: **Browse Files → Import → Process → Review → Download package**.

The 0.2.49 backup made during installation keeps the current release available for recovery. Google Drive saving is not part of this workflow; download the package and add it to Google Drive yourself.
