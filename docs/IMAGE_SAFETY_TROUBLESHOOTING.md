# Image safety failures — investigation and recovery

Recorded 17 October 2026. Incident: Freestyle, “Pole dancing police officer”.

## What happened

The first design completed. A later edit requested: “Make his position more flamboyant but still very masculine.” The selected source remained saved, with only one successful version. The provider's explanatory text reported that its image safety filter blocked the edit. A second, deeper inspection in v0.2.35 recovered the structured image-tool error:

| Field | Recorded value |
| --- | --- |
| Error code | `moderation_blocked` |
| Moderation stage | `output` |
| Public category | `sexual` |
| Provider support request ID | `wfr_01a14a14f6647097a26a0359f52bf92d` |

The provider therefore identified a sexual-content safety block during generated-output/downstream checks. It did not report an input-stage block. The rejected generated result is not available in Studio, so its exact appearance and triggering visual detail remain unknown. The support request ID is an identifier, not an API credential.

This establishes a provider safety rejection, rather than a Replicate credit, CSS, publishing, or missing-original-image problem. It does **not** establish that the word “flamboyant”, masculinity, sexual orientation, or a particular artist triggered the rejection. Nor does it prove that the artwork violates policy. A false positive is possible, but not proven.

## What Studio sends on an edit

Code inspected: `SBS_Freestyle::turn`, `SBS_Freestyle::compose_prompt`, `SBS_REST::generate`, and `SBS_OpenAI::submit_image`.

- The exact selected source image is supplied first, with the newest user instruction.
- Chosen style, print treatment, background and print target accompany it.
- The shared request asks for clearly adult, non-explicit illustrated comedy and preservation of unmentioned details.
- When no character is selected, a neutral composition identity is used and existing character reference assets are excluded.
- The visible conversation is an ancestry log. Previous written instructions are not replayed as conversation messages, and `previous_response_id` is not used. Their visual results remain in the source image. This limits conversational continuity but is not evidence of why moderation blocked this edit.
- The original brief's artist reference is therefore not automatically resent verbatim in this later edit. It must not be blamed without evidence.

## Why an initial generation can work and an edit can fail

OpenAI documents checks on prompts and generated images, with optional failure details identifying input or output stage. An edit also supplies an actual image as input. It is a different request from the original text-only generation, and any new generated result is checked too. The initial success therefore does not establish that every later edit will pass. For this incident, the saved provider error explicitly supplies stage `output` and category `sexual`. This points to generated-output/downstream checks; it does not prove that the user's wording or original image is itself prohibited.

For this incident, an undesirable generated result or an output-stage false positive remain possible explanations. An input-stage block is not the diagnosis returned by the provider. The category is confirmed; an exact trigger and whether the decision was correct are not. No attempt has been made to infer an unpublished classifier threshold, and no repeated generation experiments are needed to inspect the saved response.

## Application fixes

| Status | Improvement | Effect |
| --- | --- | --- |
| Live in v0.2.34 | Display refusal/explanatory text instead of only “no generated image” | Reveals provider's explanation |
| Live in v0.2.34 | Keep failed instruction visible; show “Instruction not applied” | Separates failed edits from successful history |
| Live in v0.2.35 | Read errors nested inside `image_generation_call` | Preserves stable error code, optional moderation stage/categories and provider response/tool IDs |
| Live in v0.2.35 | Show optional structured safety details; allow reinspection of older generic errors | Retrieves the existing response without submitting another image generation |
| Existing protection | Preserve original images and explicit source selection | No overwrite or automatic approval on failure |

The v0.2.35 extractor prefers a valid returned image over error-only output items. It does not invent moderation categories from prose. A missing stage/category remains unknown. The UI escapes provider text. No moderation strictness or provider has been changed.

## Recommended next steps

1. **Use exact visual decisions.** Describe intended arm/leg positions, facial expression and costume coverage rather than relying only on broad adjectives. This improves controllability; it is not a promise of passing moderation. Keep the desired result non-explicit, and show any proposed rewritten instruction to the user before submitting it.
2. **Preserve useful context.** An optional, editable current design brief could retain the user's composition/clothing constraints across edits. It must follow the selected branch, avoid leaking another experiment's instructions, and never silently rewrite the user's intent. Not implemented by this investigation.
3. **Improve recovery.** A “Restore failed instruction to input” control could save retyping, without automatically resubmitting or overwriting an unsent draft. Show both local wording and the original provider error; do not automatically retry safety blocks. Not implemented yet.
4. **Use existing non-generative controls where appropriate.** Position, resize, branding and canvas background/export adjustments can use Merch Canvas. Changing a drawn pose requires image editing; canvas transforms cannot redraw anatomy.
5. **Escalate suspected false positives.** Keep the date, source asset ID, job ID, response ID, image-call ID, exact prompt and returned stage/category for a support review. Exclude API keys and session credentials. Sharing artwork or logs with support is a separate user-authorized action. No support message has been sent.
6. **Optional diagnostic precheck.** A standalone moderation assessment can supply additional signals, but cannot predict or override the image generator's own decision or retrospectively prove this failure's trigger. Not implemented or run here.

Adding Replicate credit only enables the separate upscaler. It will not resolve an OpenAI safety rejection. Changing browser, clearing CSS cache, or waiting for deployment is likewise not a remedy for this recorded error.

## Live verification result

The v0.2.35 release workflow and regression checks passed. The published header showed v0.2.35. Inspecting the existing failed job changed its displayed status from generic failed to blocked, and expanding Safety check details showed `Stage: output` and `Provider categories: sexual`. The original single successful version remained selected. No new generation or upscale was submitted, no image was replaced, no moderation setting changed and no provider support message was sent.

## Verification

Parser regression coverage includes successful image bytes, pending responses, top-level provider failures, explicit refusals, text-only responses, missing explanations, nested tool errors and moderation metadata. Freestyle regression coverage checks failed instructions remain unapplied and the selected original stays visible. PHP tests run on GitHub because PHP CLI is unavailable in the local workspace.

## Official sources checked 17 October 2026

- [OpenAI image generation guide — Content Moderation and Handling blocked requests](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI Responses schema — image_generation_call and optional error/moderation_details](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI moderation guide — classification signals and limitations](https://developers.openai.com/api/docs/guides/moderation)

The API reference search exposed the nested tool error fields; the full reference page exceeded the retrieval service's size limit. The image-generation guide was opened and checked directly. Broad public error labels do not expose exact internal classifier triggers.
