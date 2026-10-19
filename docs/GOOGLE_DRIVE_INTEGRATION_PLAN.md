# Google Drive integration — implementation and acceptance plan

Status: candidate **0.2.49** on `feature/drive-finishing-integration`, draft PR #6. No merge or deployment authorised. Live Studio remains 0.2.48; actual Picker and Drive transfers are not verified.

## Confirmed baseline
- On 19 October 2026 the owner confirmed Google permissions were checked and accepted, and Studio reported a successful Google connection. Do not repeat authentication as a setup prerequisite.
- The current allowed redirect URI already matches the Studio Settings value, including `www`. The earlier redirect mismatch is no longer the current blocker.
- Scope stays `https://www.googleapis.com/auth/drive.file`; selected-file access is enforced by Google. ChatGPT's separate Drive connection is not used to test the Studio connection.
- Existing draft AF register: `1LQQAciLLM77nQTiUqaQcOvrpFlUyAWFymX3jWIt8Kb8`. No AF/SB identifier or register changes are enabled.

## Implemented and reviewed
- Encrypted token refresh, expiry margin, refresh/disconnect lock, explicit expired/revoked errors, no-store Picker token endpoint and existing session/CSRF protection.
- Picker image search/selection and destination folder selection with the existing narrow scope. List mode avoids thumbnails that the scope does not authorise. Dialog dimensions follow the viewport. Loaded notifications keep controls busy until a selection/cancel/error. A naming collision between the OAuth UI helper and the Google Picker namespace was corrected.
- Adding a restricted Picker browser key preserves the working OAuth connection. Replacing the OAuth client still requires disconnecting. Expired access tokens refresh automatically on use.
- PNG/JPEG/WebP import checks MIME, byte count, dimensions, MD5 and the stored original SHA-256. Duplicate imports reopen the same UUID workspace. Invalid/null/array IDs are rejected before deduplication.
- Explicit human local approval precedes package saving. The original/candidate contents and metadata stay in the ZIP. Local approval has no SB production effect.
- Create-only Drive upload reserves a Google file ID and persists the exact ZIP plus upload intent locally before sending. A lost response retries the same ID; Google 409 is followed by parent/size/MD5/operation verification. Completed saves are checked against Drive again; missing or changed files are reported instead of stale success.
- A saved-package link is shown beside the save controls and survives reopening. Persistent messages and button spinners cover selection, import, save, errors and saved-but-list-refresh-failed results. Requests and Picker loading have bounded waits.
- No Sheets, AF/SB allocation, catalogue writes, Final Production writes or website publication.

## Tests completed locally
A temporary local PHP 8.3 runtime with GD and ZipArchive was obtained from Ubuntu packages for this development workspace. Nothing was installed or configured on the live WordPress host.

- Syntax of PHP source and JavaScript assets; all existing `tools/test-*.php` and `tools/test-*.cjs` regressions.
- `php tools/test-drive-integration.php`: real encryption, asset storage, finishing and transport handlers against isolated DB/HTTP doubles. Exercises token expiry/refresh/revocation and locking, connected Picker-key saving, session/CSRF, PNG/JPEG/WebP original preservation and deduplication, workspace reopen, incomplete review refusal, approved ZIP contents, lost-upload-response recovery without duplicates, saved-file checksums, deleted/changed remote file, denied folder/image, read-only destination, oversized file, MIME mismatch, corrupt download, pixel limit, stale revision and tampered original.
- `node tools/test-drive-picker.cjs`: shipped UI controller against simulated DOM/Google/HTTP. Exercises loading/selection/cancel/error, 320px viewport sizing, human-review button gating, import, verified save link, progress reset, saved-but-refresh-failed feedback, CSRF headers and no repeated authentication.
- Added GitHub Actions coverage for the isolated Drive tests on PHP 7.4 (declared minimum) and 8.3. Current-run results must be read from PR #6.

These tests do not establish live Google file access or Android visual acceptance.

## Remaining setup and live acceptance
1. Enable Google Picker API in the existing `smutty-studio` project and create a browser API key restricted to `https://www.growinsane.com/*` and `https://docs.google.com/*`, and to Google Picker API and Google Drive API. Never paste OAuth secrets or tokens into chat.
2. After owner approval, use the established backup/update process to install candidate 0.2.49. Enter the Picker key in Studio Settings with the client-secret field blank so the successful Google connection is preserved.
3. Select disposable PNG/JPEG/WebP files with Picker, import and reopen them, inspect/process/compare them, complete explicit local human review, export ZIP, select an explicitly authorised disposable destination and save. Verify actual Drive files, ZIP contents and hashes, and safe repeated save. Test expiration/errors without unnecessarily disconnecting the working account.
4. Test Android Chrome with magnification and confirm readable checklist, picker navigation, touch controls and persistent messages.

The remote Cloud Browser returned Site Unavailable for Google Cloud, including one reload, on 19 October. Owner Cloud setup is therefore required; this does not mean the owner's existing Studio Google connection failed.

The OAuth client secret previously shared in chat remains a separately recorded owner security action; replacement values must be entered directly in Studio. This development task does not change working credentials.

## Release gate
All essential automated checks, reviewed PR and recoverable backup before installation; explicit owner approval before merging or installing. Actual Google and Android acceptance follows the approved installation because live 0.2.48 does not contain the new transfer code. Do not mark live Drive integration complete from OAuth success or simulated tests alone.
