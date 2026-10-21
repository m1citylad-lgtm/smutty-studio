# Smutty Studio — T-shirt production workflow (2026-10-17)

## Default rules
- Vintage treatment: 70% clean retro illustration, 20% selective halftone, 10% restrained distress. These are creative guidelines, not literal measured pixel proportions.
- Print method: DTG by default; DTF optional. Supplier choices: Redbubble and Gelato. Do not assume either supports a particular DTF workflow without a product-specific specification.
- Print target: 4500 × 5400 pixels, 300 PPI at 15 × 18 inches, transparent PNG where appropriate. Since v0.2.32, final PNG export writes a valid pHYs density chunk at the chosen DPI (300 by default). This label does not add source detail or prove actual sharpness.
- Manual override is allowed for preflight warnings. Hard structural errors still block export. Every export carries a JSON report.
- Preserve original generated image and editable canvas. Export separate branded and logo-free PNGs.

## Production stages
1. Choose approved character reference and scene; create artwork.
2. Assess visual treatment; keep face, lettering and key outlines crisp. The current Studio provides a prominent review notice but does not yet implement computer-vision treatment recommendations.
3. Refine/polish as needed; inspect changes to face, lettering, edges and intended composition. AI upscaling may hallucinate details.
4. Choose garment, product, provider, and DTG/DTF process. Obtain the actual product's artwork specifications from Redbubble or Gelato.
5. Import the approved Exact logo reference. Place, scale and rotate on the canvas; save the editable version. Contour-warping is not yet implemented.
6. Run preflight. It checks output dimensions, aspect ratio, blank canvas, effective source PPI/enlargement, sampled canvas and image-layer alpha, transparency selection, and some logo sizing risks. It warns about opaque image layers on a transparent canvas and semi-transparent DTF pixels. It does not certify all pixel halos, legibility, actual sharpness, gamut, printer underbase, or provider compliance.
7. Review artwork on black, white, red and blue backgrounds at 100% and target print size. This is a required manual stage until a four-background proof is implemented.
8. For warnings, either correct and recheck or use the explicit manual override; override is recorded in JSON and never relabels warnings as passed.
9. Export PNG variants and report. Inspect actual exported files for dimensions, alpha transparency, softness, halo pixels, colour and lettering.
10. Upload to selected supplier, review its placement/print preview, order a physical sample, and approve before general sale.

## Known remaining gaps
- Pixel-level inspection and automatic defect correction are not implemented.
- Provider-specific export profiles need verified per-product specifications, including any colour/profile and transparency requirements.
- Advanced curved/contour-following logo treatment, separate logo library, 4-background proof generator and automatic vintage treatment recommendations are not implemented.
- In-browser preflight does not certify the actual exported PNG. Production sign-off requires checking the downloaded file and a physical print sample.
- Export creates separate download links for the branded PNG, optional logo-free PNG and JSON report. Download each file individually and verify it before printing. No automatic multi-download permission is required.

## Approved SmuttyBear signature and logo assets (verified 17 October)
- 12 transparent signature PNG masters (Plain / Contour / Pill × Black / Copper / Cream / White): Drive ID 1xZ8c-qYT78MWG0bV1K9M5mPNULyUPqlB, ZIP SmuttyBear_Design_Signature_PRINT_Masters.zip. ZIP contents inspected and all 12 names present.
- Retro wordmark masters: Drive ID 1-STGiDjkbMSte_vBI5RBglVtP5JHiQGh.
- Main Brand Badge transparent print master: Drive ID 1ei6f0yZOUa2wHvFDi8Hf3ENElvAezhD-.
- Main character-series logo: Drive ID 1_b2eVSUwSZf1gQclb5bAdOD8R2ecKU1u.
- Default signature per Global T-shirt Production Guide (updated Oct 14): plain condensed sans-serif smuttybear.com in copper, centred beneath artwork, proportional sizing, no pill. Approved variants can be selected according to contrast and composition. Exact font family, numeric weight, tracking and point size are not documented and must not be invented.
- The current Studio includes a branding-family choice saved in the canvas document, but it DOES NOT automatically load or substitute the approved PNG master. User must upload the actual master as an Exact logo reference before placement. Do not silently typeset a substitute font or substitute a different asset.
- The approved logo-free master must be preserved independently; branded output is a derivative. Approved logos should not be generatively warped.

## Release 0.2.26 — 17 October 2026
- Packages all production controls added after the original 0.2.25 release.
- Uses approved #0B1B35 navy for the top header and primary navigation, including the active tab. The gold character tray remains unchanged.
- Renders PNG files as browser Blob downloads with persistent individual links instead of large data-URL auto-downloads.
- Restores artwork, logo and guide visibility even if PNG encoding fails; no source artwork is saved or replaced by exporting.
- Export regression checks: run `node tools/test-export.cjs` from the repository root.
- Publishing requires a new version in both declarations in smutty-bear-studio.php; publishing to GitHub is followed by a verified install through Studio Updates and a live check.

## Release 0.2.56 — full-screen garment proof viewer (21 October 2026)
- Artwork Finishing now shows 12 garment-colour proofs in the requested order. Tapping a proof opens a full-screen viewer that loads the actual original/candidate asset directly; the small proof thumbnails remain previews only.
- Pinch zoom and one-finger panning use touch pointer events. Reset restores fit-to-screen; Close exits. The colour toolbar has square swatches, a selected gold border, horizontal scrolling and a persistent Reset button.
- Switching garment colours changes only the viewer background and retains the zoom and pan position. The toolbar does not label colours visibly; assistive labels remain available.
- Viewer presentation does not edit artwork, transparency, candidate data, generated files or production approval rules. No image generation/upscaling calls are used.
- Validation: JavaScript syntax and `node tools/test-finishing.cjs`; GitHub release workflow also runs the full repository regression suite. Live installation and Android pinch/pan verification remain deployment acceptance checks.
- Owner acceptance update (21 October 2026): the user tested the live garment-colour proof check on the Android tablet, including close-up inspection on red. They report the image looks as expected and there is no unintended colour bleed-through. The supplied zoomed screenshots show lettering, face and edge detail at close range.

## Proof-viewer information buttons — implemented in 0.2.59 (21 October 2026)
- Removed the round black “i” buttons from the garment proof panels and full-screen proof viewer. The 12 colour swatches, selected-colour highlight, horizontal scrolling, Reset and separate Close control remain.

## Release 0.2.57 — Artwork Finishing quality checks (21 October 2026)
- Candidate versions now include an automatic dimension comparison. It reports original and candidate sizes, horizontal and vertical scale, and flags materially non-uniform scaling / aspect-ratio changes. It cannot detect local warping or crops that preserve the same aspect ratio, and does not prove sharpness.
- The same report compares the existing sampled alpha/transparency signal from original and candidate. Sampling is a warning aid, not a pixel-by-pixel halo detector.
- Added a user-triggered AI comparison of the untouched original and selected candidate. The report focuses on line detail, lettering, faces/anatomy, halos/ringing, visible transparency edges and unintended colour spill, while allowing intentional vintage grain, distress and softness. Findings name the area and what to inspect.
- Before starting, the interface says both images will be sent to OpenAI and may use the configured model's API credits. This review only returns text; it does not generate or alter artwork, use Replicate, or change local approval/production rules. It is advisory and can miss defects; human review and garment proofs remain required.
- No AI comparison was run as part of this release validation, so no image API credits were used.
- Validation: JavaScript syntax and `node tools/test-finishing.cjs`. PHP lint is also required in the release workflow; it could not be run in the local environment because PHP CLI is unavailable.

## Release 0.2.58 — clearer numbered finishing review points (21 October 2026)
- Group automatic warnings, geometry/transparency notes and recorded notes under a prominent “Warnings and points to check” heading in Artwork Finishing.
- Present these points as numbered items in high-contrast yellow text. Present AI review findings as a separate numbered yellow list with severity accents.
- Keep the information as visible text; no voice or spoken settings are added.

## Release 0.2.59 — proof controls and print-size warning (21 October 2026)
- Remove automatically injected black information buttons from the garment proof panels and full-screen proof viewer so they do not crowd colour selection controls.
- When a print size is below 300 PPI, highlight the warning in red and show the proportional maximum print dimensions that reach 300 PPI using the candidate's actual pixel dimensions.
- Explain that both width and height must shrink together to preserve proportions, and that a smaller print size raises the PPI value but does not create image detail.

## Next update request — concise accessible text and print warning (21 October 2026)
- Make text boxes, paragraphs, statuses and warnings across Smutty Studio clear, concise and basic. Show only the key fact, problem or action; avoid long explanations.
- Replace the large red print-warning box with a small, high-contrast red dot or flag beside the concise print details.
- Show the actual PPI and the proportional print dimensions needed to reach 300 PPI. Keep these key facts easy to locate and read on a tablet.
- No automated voice or spoken settings are requested.

## Release 0.2.60 — readiness status and ChatGPT handoff (21 October 2026)
- Added a final Artwork Finishing readiness panel before local approval and package download. It reports FAIL when no candidate is selected, REVIEW when checks or human review remain, and PASS only when the available pixel-size, geometry, sampled transparency, AI review and human checklist checks are clear.
- Added a copyable ChatGPT handoff with the original/candidate dimensions, print size and PPI, suggested maximum size for 300 PPI, transparency and geometry results, AI findings and the review points to inspect.
- The report asks ChatGPT to compare the untouched original and candidate, preserve the original and recommend any correction before making changes. It is advisory; it cannot certify printer output.
- This release does not automatically repair image defects. Pixel-level halo detection, provider-specific garment profiles and supplier print simulation remain future work.
- Validation: `node --check assets/js/finishing.js` and `node tools/test-finishing.cjs`.

## Release 0.2.61 — complete handoff dimensions for older workspaces (21 October 2026)
- Calculate proportional scaling and transparency comparison from stored original/candidate image details when older saved versions do not have a geometry report.
- Include both original and candidate pixel dimensions in the ChatGPT handoff and round suggested 300 PPI print dimensions to two decimal places.


## Next update request — numbered actions and completion ticks (21 October 2026)
- Number one-time action buttons in the order they should be pressed.
- After a one-time action succeeds, show a clear tick and disable that button so it cannot be repeated accidentally.
- Leave repeatable actions unnumbered or without a completion tick where appropriate; do not mark them complete after one press.
- Show a clear outcome for actions that fail or do not complete. For example, after pressing “Run AI comparison”, update the status from “not run” only after a successful result; if it fails, show a short error and what to try next.
