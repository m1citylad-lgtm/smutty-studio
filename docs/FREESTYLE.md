# Freestyle — v0.2.33

Added 17 October 2026. Freestyle is a new top-level tab alongside Characters, Usage and Updates. It uses the existing WordPress application, OpenAI generation/edit transport, Replicate upscaling, projects and merchandise composer. No replacement application or ZIP-upload feature is involved.

## A. Choose a starting point

The character dropdown starts at **No character — completely new idea**, independent of the character selected elsewhere in Studio. Select an existing character to use its identity and approved reference images. With no character, the prompt uses a neutral brief and excludes all character-pack reference assets; a previous or current character cannot silently leak into the new composition.

Name the experiment if useful. Choose an earlier experiment from the session dropdown. Changing character starts a separate experiment, preserving the previous one. New experiments default to opaque backgrounds and remember the last drawing style. An unfinished prompt, name and starting-character choice survive reloads in the same browser.

Character-free drafts use an internal neutral project container hidden from the ordinary character list. When explicitly sent to Creations, they become available under **Freestyle compositions**. This is a composition group, not an automatically approved character identity. Existing-character experiments appear under that character when sent to Creations.

## B. Compare and restore images

One large preview shows the selected design. The strip shows six recent image versions, including a selected older version if required. Select any thumbnail to restore it. Undo follows that image's actual parent; Redo returns through undo navigation. Editing an older image branches from that exact image, retaining all later designs. The conversation displays only the instructions on the selected image's ancestry, so abandoned branches do not become misleading instructions for the current design.

All existing image records remain stored. The six-thumbnail display does not delete older images or approved artwork. Experiments are persisted on the server. Selected images are stored server-side; draft text, last style and transient Redo navigation use browser storage. Clearing browser storage removes those browser preferences, not the saved artwork.

## C. Give conversational instructions

Type or dictate the complete initial idea, including the character, environment, slogan and style. **Create one image** submits exactly one candidate. Subsequent instructions use **Apply next instruction to selected image** to edit the displayed source. Instructions are saved with each resulting image and shown as a conversation. The old preview stays visible during generation; focused text input is not rebuilt by polling.

Eight drawing styles: Cartoon, Clean illustration, Ink sketch, Pencil sketch, Comic book, Pop art, Watercolour, and Woodcut / linocut. The last chosen style is remembered for the next new experiment.

Four independent T-shirt treatments: Vintage 70/20/10, Clean solid print, Halftone shading, and Light distressed print. Vintage means 70% clean retro illustration, 20% selective halftone shading and 10% restrained distressing. These are actual generation instructions, not a measured pixel analysis. The chosen drawing style takes precedence over the old house-style default. Requested slogans are permitted; always inspect the generated spelling.

The image-format options are portrait, square and landscape. **Opaque** is the default; **Transparent cutout** is an explicit option. Transparency and print density are independent.

Job status is local to Freestyle and follows actual provider/server state. Active jobs use indeterminate native progress; completion displays 100%. Existing stage-marker percentages are not presented as measured rendering progress. A cancel action uses the existing server job cancellation route. Provider failures leave the original and draft intact; generation/upscale may incur the configured provider's usual charges.

## D. Finish for print

The initial standard is **15 × 18 inches at 300 PPI**, giving **4500 × 5400 output pixels**. Width and height are adjustable from 1–30 inches; 300 PPI is the fixed standard here. Draft generation is native provider resolution and may need upscaling. A density label alone adds no detail.

The 2×/4× AI upscale buttons use the existing Replicate integration and become unavailable with a clear explanation if it is not configured. Upscaled candidates enter the same image history, preserving the source. Transparency can change during upscaling, so inspect it again.

Review the selected image's wording, composition and visible details, then explicitly **Send selected image to Creations for print finishing**. This does not approve it for print, accept a character reference, or overwrite a saved design. The selected image and chosen print settings are handed to the existing workflow. **New print layout from selected image** creates an unsaved layout independent of any earlier saved designs; existing unsaved canvas work requires confirmation before clearing.

For a new Freestyle layout, Merch Canvas contains the selected source without cropping, fits it inside safe margins, applies the chosen print aspect ratio/dimensions, and carries over opaque/transparent background choice and treatment. Existing saved artboard dimensions and transparency are restored when reopening a saved design. Saving a new layout creates a new design record.

Preflight now samples exported-canvas alpha and individual image-layer alpha, reports estimated effective source PPI, warns about stretching beyond native pixels, and warns if transparent canvas surrounds an otherwise opaque image. DTF semi-transparent edges require inspection. The existing visual-treatment review, supplier advice and warning override still apply; automatic checks cannot guarantee anatomy, slogan accuracy or printer acceptance.

Final PNG exports include a valid pHYs density chunk matching the chosen print DPI (300 by default), without changing the image/alpha data for metadata alone. PNG dimensions are generated from the actual print width, height and DPI. Branded/logo-free downloads retain the existing separate links and preservation checks. New canvases default to opaque; previously saved transparency remains authoritative.

## Components and tests

- `includes/class-sbs-freestyle.php`: authenticated/same-origin Freestyle turn, select and promote routes; settings validation, one-image requests, source isolation and selected-parent checks.
- `assets/js/freestyle.js`: preview, six thumbnails, Undo/Redo, branch-aware conversation, remembered style, local drafts and print handoff.
- `templates/studio.php`, `assets/css/studio-theme.css`: A–D layout, gold headings, navy/cream theme, large touch/voice-input controls.
- `assets/js/studio.js`: existing job polling integration, new print layout, PNG density metadata and transparency/source-resolution checks.
- `tools/test-freestyle.cjs`, `tools/test-freestyle.php`: history/branching, defaults, exact source, character isolation, settings validation and explicit promotion.
- `tools/test-png-resolution.cjs`: pHYs density, CRC, single-chunk replacement and unchanged PNG image/alpha bytes; independent Pillow decoding also checked locally.
- Existing development and branded/logo-free export regressions continue to run.

GitHub's main-branch release workflow lints PHP/JavaScript and runs these checks before creating the versioned plugin release. The hosting installation mechanism remains external to that workflow; verify the live version and actual UI after publishing. Physical Android, Brave and device dictation are not available in the cloud test environment.

The current Freestyle job status is shown both beside the preview and below the instruction submission button, so it is visible while working at either end of the page. Stage C remains incomplete when the text box contains an unsent draft.

Freestyle background job completion refreshes only its own project. It does not reload the character editor or other tabs and erase unrelated unsaved input. Upscaling a Freestyle image from Creations returns to its local Freestyle progress.

## Live verification — 17 October 2026

The live v0.2.32 page generated one new character-free teapot design with a slogan, applied a second instruction, and retained both versions. Undo restored the exact first asset URL; Redo and thumbnail restoration also worked. A third, transparent-background design branched from version 1. Its conversation included the original instruction and the new branch instruction, excluding the abandoned gold-steam edit; all three thumbnails remained.

Explicit handoff placed the selected candidate in Creations under Freestyle compositions. A new, unsaved print layout carried over the selected source, transparent background and 15 × 18 inch / 300 PPI target. Preflight correctly returned REVIEW for the 1024-pixel source (estimated effective 85 PPI in this layout), and DTF checks flagged semi-transparent edges. A pipeline-only export with a temporary acknowledged warning override independently decoded as 4500 × 5400 RGBA, 299.9994 PPI, with real alpha. The downloaded JSON still recorded REVIEW and the warnings. This is not an approved print master. The temporary override was cleared; no existing saved design was overwritten.

The existing Replicate service rejected the 4× upscale with **insufficient credit**. The source and all versions remained available. Adding credit to that account is required before a full-resolution upscale can be verified; no billing change was made. v0.2.33 also refreshes the local failed job after such a rejected submission so the reason remains visible beside the design/instructions.

PHP syntax/handler tests and JavaScript/history/export/density tests passed on the validation branch before live publication. Physical Android/Brave/dictation testing remains outside the available cloud environment.

## v0.2.34 — provider failure explanations

Completed OpenAI responses can contain a refusal or explanatory text instead of an image. Studio now displays that explanation and keeps the unapplied instruction visible. Existing failed jobs offer **Show provider failure details**, which retrieves the original response without submitting another generation or changing the selected image. If the provider no longer retains the response, inspection can fail; no reason is guessed and no automatic retry is made.

## v0.2.35 — structured safety diagnostics

Studio also reads errors nested inside the image-generation tool output, preserving optional input/output stage, public categories and support identifiers. Older generic failures can be inspected again once with this extractor, without resubmission. See [Image safety investigation and recovery](IMAGE_SAFETY_TROUBLESHOOTING.md) for the police-officer incident, evidence limits and proposed improvements.
