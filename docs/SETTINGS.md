# Studio Settings

Version 0.2.45 moves access to the previously wp-admin-only controls into the top-level Settings tab, replacing the old Updates navigation item.

- **A. Studio access and providers:** URL slug, shared password, OpenAI key and text/image models, Replicate token/model and estimated cost, HTTPS update feed and bearer token.
- **B. Workspace backups and imports:** whole workspace or selected project export, recent jobs with actual stored percentage/status and ZIP downloads, storage file count/bytes, and existing validated workspace import. Press Refresh progress to update export status. Imports preserve conflicting local records as separate versions; credentials/passwords are excluded.
- **C. Diagnostics:** on-demand environment, storage protection, database, image libraries, upload limit, HTTP loopback, provider/password and trusted update key checks. These are environment checks, not paid provider requests.
- **D. Software updates and rollback:** existing signed-release upload/feed install, backups and rollback, retaining short-lived shared-password reconfirmation.

## Studio access protection

A–C unlock with the existing shared Studio sign-in; no WordPress administrator login is required. Anyone with that Studio password can manage these settings. Forms require a currently valid Studio session, an anti-forgery token bound by HMAC to that exact session cookie using a server-only WordPress salt, and the original WordPress action nonce. A token from another Studio session is rejected. Login reloads the shell so these server-rendered controls become available immediately. Logged-out page views render no settings controls.

Only settings/save, workspace export and workspace import accept this form authorization. Dashboard entry points still require `manage_options`, and update installation/rollback retain their separate existing short-lived Studio-password reconfirmation. No credential-reading REST endpoints are introduced. Secret fields stay blank; saved keys are never rendered. Blank values preserve existing credentials, and server constants retain precedence.

Settings forms use existing handlers and return to `?settings=1` after save/export/import. Validation of password length, feed HTTPS and credential encryption happens before saving any options. Password changes revoke Studio/update sessions. URL changes redirect to the new Studio URL. Keep the shared Studio password private; it now also grants settings access.

The wp-admin screens remain available for recovery. Creative tabs, provider generation behavior and original artwork records are unchanged. No archive was imported and no password, API key or artwork was changed during deployment verification.

## Checks

`php tools/test-settings.php` exercises logged-out and cross-session denial, forged token and nonce rejection, dashboard capability and update isolation, invalid settings leaving options untouched, encrypted key writes, blank key preservation, and returning to the new Studio URL. Existing PHP/JavaScript regression suites also run in GitHub Actions. Live verification includes settings visibility without WordPress login.

Front-end forms use a plugin-owned submit button renderer, avoiding the dashboard-only WordPress `submit_button()` dependency.
