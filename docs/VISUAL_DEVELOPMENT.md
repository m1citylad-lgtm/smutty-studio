# Visual Development workflow — v0.2.30

Updated 17 October 2026.

## Working with images

The existing numbered gold stages remain: 2.1 Choose the look, 2.2 Build the reference set, and 2.3 Approve the character. Each candidate keeps its image, existing selection/acceptance/removal actions, local generation status, and Image Correction Instructions together. Generation buttons for a reference type or approval sheet are below that section's images. A concept's Master acceptance action is below the selected concept.

Each completed concept, reference candidate and approval candidate has its own correction draft and **Regenerate with Corrections** button. Enter only the intended changes, identifying anything that must stay unchanged. Correction uses the existing OpenAI image-edit transport with that exact source image first, its original size/quality/background, and the same reference purpose. It appends one new candidate to the same project. AI edits can still change unmentioned details, so inspect the result.

Original candidates remain visible while work runs. Correcting an image does not replace its accepted reference, change the selected seed, or accept a new approval checkpoint. These remain explicit decisions. Existing deletion confirmation and accepted-source protections remain in place.

Correction notes are scoped by character UUID, version, and source-image UUID. They survive redraws, tab changes, reloads, generation completion and failures in the same browser. Use **Clear instructions** to remove a draft. Drafts are not synchronized across browsers/devices; clearing site storage also removes them. If persistent browser storage is unavailable, notes survive only within the current page session.

## Truthful local progress

Status belongs beside the relevant image or generation section. It follows returned server job states: submission, queued, running, completed, failed, blocked or cancelled. OpenAI does not supply a measured rendering percentage through this integration. Pending work uses an indeterminate native progress bar; only successful completion displays 100%. The old server values 5/10/55 are job-stage markers and are deliberately not displayed as rendering percentages. No client timer simulates progress.

Connection errors keep the previous known status and retry rather than falsely declaring provider failure. The previous image and correction draft remain available. While a correction field is focused, status nodes update without replacing that input; new image cards are drawn when editing focus leaves the field. This protects Android typing/dictation from polling redraws.

## Components and validation

- `assets/js/studio.js`: local progress, image-scoped persisted drafts, correction dispatch, candidate layout and polling behavior.
- `includes/class-sbs-rest.php`: authenticated/same-origin `POST /generations/{uuid}/development/correct`. Validates source, project type, allowed purpose and instructions; routes through the existing image-edit generation system.
- `assets/css/studio-theme.css`: responsive candidate cards, large controls and the existing navy/cream/copper/gold theme.
- `tools/test-development.cjs`: draft isolation, reload/clear, routing, progress accuracy, markup ordering, submission failures and preservation tests.
- `tools/test-development.php`: handler validation and transport capture without provider calls or production writes.
- `tools/test-export.cjs`: existing export and artwork-preservation regression checks.

The release workflow runs PHP syntax checks plus these regressions before building/publishing a new version. PHP is not installed in the local editing container; the workflow supplies the PHP validation environment. Browser verification covers actual loaded version, controls, persistence and one unaccepted correction candidate. Physical Android/Brave devices and their dictation keyboards are not available in the cloud test environment.

## Publishing

A push to GitHub `main` triggers `.github/workflows/publish-release.yml`, which validates source, builds the versioned WordPress plugin ZIP/feed and creates a GitHub release. This workflow does not itself contain a WordPress deployment step. Earlier releases have reached growinsane.com through an existing external deployment mechanism. Verify the live header, matching stylesheet/script versions, authenticated UI and correction response after publishing; a successful GitHub release alone is not proof of live installation. If automatic synchronization does not occur, use the established authenticated Updates installation flow. Never change its security settings just to deploy.
