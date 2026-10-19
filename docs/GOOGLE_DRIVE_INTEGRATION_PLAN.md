# Google Drive integration — implementation and acceptance plan

Status: development branch only. No production deployment or live Drive writes authorised.

## Confirmed baseline
- Studio 0.2.48; OAuth drive.file scope; connected in owner's screenshot.
- Google Drive class is OAuth-only; finishing class is local-only; catalogue adapter is read-only.
- Existing AF draft register: 1LQQAciLLM77nQTiUqaQcOvrpFlUyAWFymX3jWIt8Kb8.
- AF-first policy unresolved. No AF allocation or catalogue writes.

## Implementation stages
1. Authenticated token refresh with encrypted storage, locking, revoked-token handling and no secret logging.
2. Google Picker for explicitly selected files, respecting drive.file scope limitations. Check Picker API key and app ID requirements.
3. Server-side import of selected PNG/JPEG/WebP with MIME, bytes, pixel, ID and HTTP redirect validation; preserve original checksum.
4. User-confirmed upload of source or approved local package only to explicitly authorised/app-created destinations. Never overwrite by filename.
5. Verify uploaded file ID, parent, size and content checksum, including download-and-hash if needed; handle partial failure and retry.
6. Show visible status/error messages adjacent to actions; test Android Chrome Files/My Files and magnification.
7. Record non-sensitive audit events; no tokens, secrets or image bytes in logs.
8. Leave AF allocation, SB IDs, catalogue and lifecycle tracker untouched until separate owner approval.

## Acceptance tests
- OAuth connected, refresh, revoke, expiry and disconnect.
- Picker access granted/denied, duplicate selection, inaccessible file.
- Import exact original checksum; reject invalid image and oversized file.
- Upload verified parent, content and retry without duplicate or overwrite.
- Local versioning, comparison, cancel, review, download.
- Tablet touch targets, local picker and readable error messages.
- Unauthenticated and invalid-CSRF requests rejected.
- Characters, Freestyle, Catalogue, Usage and Settings regressions.
- Zero changes to AF register, Ideas, SB Catalogue, lifecycle tracker and Final Production.

## Release gate
PHP syntax, JavaScript and regression checks; reviewed pull request; explicit owner approval before merging, production release or any live Drive write. OAuth success alone does not mean Drive integration works.
