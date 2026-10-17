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

Live reinspection of the police-officer edit returned the provider's structured `moderation_blocked` error with **output** stage and **sexual** category. This identifies the broad output/downstream classification; it does not identify a specific word or prove a particular visual feature caused the block. No new generation was submitted during this investigation.

## v0.2.36 — editable briefs and failure recovery

- **Current design brief** sits in stage C above the next instruction. New experiments use the first idea when this field is blank; existing designs initially show their original brief. Users can edit or explicitly clear it. The current brief is included alongside each next instruction, with the newest explicit change taking priority. No automatic rewriting or policy-filter change is performed.
- **Save design brief** saves to Studio for the selected source image, without generation. Unsent edits are also kept in this browser. A later version receives the brief snapshot used for its generation; selecting an older version restores that branch's brief rather than borrowing a newer branch's constraints. Failed generations never replace a successful version. Upscales retain the source brief snapshot.
- **Help me describe a pose change** provides optional concrete guidance about limb positions, expression, costume and details to preserve. It does not modify or submit the user's text.
- **Restore failed instruction** fills the next-instruction box only when it is empty and the selected image matches the failed request's source. An existing unsent draft is retained. Restoration never generates automatically.
- **Prepare support review details** produces a readonly, copyable report for the selected failed job with its exact recorded prompt, instruction, brief, identifiers and optional moderation stage/category. No keys, session data or unrelated job payload fields are included. Users review and send it themselves; the application does not contact support.

Brief save uses the existing authenticated/same-origin permission check. Briefs are stored in project concept metadata and immutable job snapshots; no database migration is required. Legacy jobs without a recorded brief remain labelled as such in support reports. These controls improve context, recovery and diagnosis; they do not guarantee that a blocked image edit will be accepted.

### Live verification and v0.2.37 status wording

On the live site, recovery refused to overwrite an unsent verification draft, then restored the exact recorded failed instruction into an empty box without resubmitting. Preparing and copying the support report succeeded; it included the recorded output/sexual classification and exact effective prompt. The temporary instruction text was cleared afterwards. The original police-officer image remained the only successful version.

Saving a brief on version 3 of the private teapot verification experiment left all three images intact. Undo restored version 1's original brief; Redo returned to version 3's saved brief. v0.2.37 distinguishes **Saving design brief** from generation activity while that save is in flight. No additional image generation, upscale or support message was submitted during these checks.

## v0.2.39 — user-selected drawing styles

The user chose 14 styles, superseding the earlier limit of 10: SmuttyBear house style, Classic cartoon, Caricature, Bold vector mascot, Comic book, Pop art, Storybook illustration, Vintage pin-up, Vintage beefcake, Retro advertising, Pulp magazine, 1960s psychedelic, 1970s disco, and Traditional tattoo flash. Each has explicit visual prompt guidance. Treatments remain separate. Vector mascot is a vector-like drawing style; generation still returns a raster PNG.

The new dropdown contains those 14 choices. Removed styles remain valid for historical designs and appear as a single **Saved style: …** option only when that older setting is loaded. No saved artwork or job settings are rewritten. The last selected style is remembered if still on the current list; a removed remembered style defaults to SmuttyBear house style for a new experiment. House style follows supplied approved references when available; without references it supplies a broad retro illustration direction and does not claim an exact reference match or introduce an unselected existing character. The existing opaque/300-PPI defaults and low image moderation remain.

## v0.2.40 — combine drawing styles and transparent defaults

Stage C now has an accessible native disclosure containing labelled checkboxes for all 14 styles. Tick one or more, then **Apply styles**. The closed summary gives the applied count; the adjacent live text lists the names joined by “+”. Apply does not generate. Unapplied changes block submission until applied; an empty combination is rejected. Large labels and native checkbox keyboard behaviour support touch/magnification. The last applied combination is remembered in this browser. Historical single-style settings (including removed styles) still load without rewriting artwork. Each image/job stores its own combination and rollback restores those settings.

Generation includes every chosen style's direction and asks for a coherent blend in one image. No numeric weighting is implied; the user can describe priorities in the instruction. New experiments default to transparent cutout. Background choices are transparent cutout, transparent with solid print colours, transparent with soft edges/effects, and opaque. The two extra transparency treatments are prompt guidance, not additional provider alpha modes or guaranteed pixel processing: all transparent choices send `background=transparent` with PNG output. Soft effects may produce partial alpha unsuitable for some T-shirt processes; inspect and run print preflight. Saved opaque images retain their settings. 300 PPI is unchanged and independent of transparency. Other tabs' background settings remain unchanged.

Regression coverage checks combined request payloads and prompts, Apply without generation, rejection of empty/unapplied choices, remembered combinations, legacy single-style/opaque settings, transparent defaults and treatment-to-provider mapping. Live dropdown testing does not require paid image generation.

## v0.2.41 — section C clarity and imported artwork

- Saved conversation text and readonly support details use a muted panel blue, distinct from editable navy fields. Saved history is explicitly labelled read only and keyboard-focusable. Scrollable history, textareas and section status boxes request a 5 px orange scrollbar in Chromium; native overlay visibility remains browser/OS controlled.
- Drawing styles sit above a single three-column row: **Treatment / Background / Format**. Fields can shrink without forcing page-wide overflow. Format choices are Portrait, Square and Landscape; new experiments default to Portrait and **Transparent - solid print colour**. Historical background/format values are retained. A full-width background explanation remains readable if a native select truncates its selected label.
- Studio action buttons (`.sbs-button`) use pill-shaped borders and gold text. Navigation tabs, thumbnail selectors and image zoom controls retain their established shapes. Disabled controls retain their muted state.
- Stage C.1 uploads one PNG/JPEG/WebP at a time (20 MB / 40 MP maximum, potentially lower server limits). **Reference only** attaches a project-scoped asset; tick up to six to include in the next generation. Labels explain which details to follow. The selected edit source remains the first provider input, followed by selected uploaded references and character references; unrelated experiments' assets are rejected. Jobs record the chosen reference UUIDs. Upload alone does not invoke providers or modify approved character reference libraries.
- **Existing artwork** stores original bytes unchanged and registers a local source version in the main window and history. It can be downloaded unchanged, upscaled via the existing Real-ESRGAN route, or reviewed and sent to Creations/Merch Canvas. AI editing is initially locked for branches descended from an upload; the explicit Allow AI editing checkbox unlocks a separate candidate. Such cleanup can change details. A finishing prompt preserves source composition/style instead of applying the selectors as permission to restyle. No upload is automatically generated, upscaled or published.
- Stage D offers **Remove a flat-colour background without AI**. User chooses colour/tolerance; a browser-side flood fill clears only matching pixels connected to the image boundary and saves a new PNG version with its exact source as parent. It does not erase enclosed matching regions. It preserves RGB and untouched alpha in the decoded working pixel data; browser PNG re-encoding is not byte identity. The untouched uploaded original remains stored. No match creates no new file. The tool is capped at 32 MP for memory, can leave fringes or erase edge-connected matching artwork, and is not automatic segmentation of complex scenes. Inspect and Undo if needed. Processing status counts examined connected pixels; no simulated generation percentage.
- Imported local-version settings/briefs are stored in concept metadata; upscale jobs now retain source settings. Upload failures preserve drafts and report that saving failed. No database migration or new paid service is required.

Automated coverage exercises upload validation, project reference isolation, selected-source input order, zero-provider imports/copies, original hashes/history, per-version settings, frontend edit opt-in, dictated-draft preservation, and flood fill with enclosed holes/RGB preservation. Paid generation/upscaling and Android/Brave device testing are separate from these checks.
