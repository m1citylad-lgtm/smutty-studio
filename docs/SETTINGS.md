# Studio Settings

Version 0.2.43 moves access to the previously wp-admin-only controls into the top-level Settings tab, replacing the old Updates navigation item.

- **A. Studio access and providers:** URL slug, shared password, OpenAI key and text/image models, Replicate token/model and estimated cost, HTTPS update feed and bearer token.
- **B. Workspace backups and imports:** whole workspace or selected project export, recent jobs with actual stored percentage/status and ZIP downloads, storage file count/bytes, and existing validated workspace import. Press Refresh progress to update export status. Imports preserve conflicting local records as separate versions; credentials/passwords are excluded.
- **C. Diagnostics:** on-demand environment, storage protection, database, image libraries, upload limit, HTTP loopback, provider/password and trusted update key checks. These are environment checks, not paid provider requests.
- **D. Software updates and rollback:** existing signed-release upload/feed install, backups and rollback, retaining short-lived shared-password reconfirmation.

## Administrator protection

A–C require both a Studio session to view the shell and a WordPress account with `manage_options`. The sign-in button uses the normal WordPress login flow (including site authentication plugins) and returns to Studio Settings. A shared Studio password alone does not expose credentials or grant administrator access. Existing admin-post actions still enforce their original capability and WordPress nonce. No new credential-reading REST endpoints are introduced. Secret fields are blank and never render saved token values. Blank values preserve existing keys; server constants/environment credentials continue to override saved values.

Settings forms use existing handlers and return to `?settings=1` after save/export/import. Validation of password length, feed HTTPS and credential encryption happens before saving any options. Password changes revoke Studio/update sessions. URL changes redirect to the new Studio URL. Use a trusted personal device for administrator sign-in and sign out of WordPress afterwards on a shared device.

The wp-admin screens remain available for recovery. Creative tabs, provider generation behavior and original artwork records are unchanged. No archive was imported and no password, API key or artwork was changed during deployment verification.

## Checks

`php tools/test-settings.php` exercises denied administrator access, nonce rejection, invalid settings leaving options untouched, encrypted key writes, blank key preservation, and returning to the new Studio URL. Existing PHP/JavaScript regression suites also run in GitHub Actions. Live verification must distinguish the locked Studio view from administrator-only save/import/diagnostics operations.
