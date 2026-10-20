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

## Next release request — full-screen proof inspection (20 October 2026)
- Make each black, white, red and navy proof image tappable/clickable to open a full-screen viewer.
- Provide accessible zoom-in and zoom-out controls (plus pinch zoom where supported), and a clear close/back action.
- Keep the selected proof background visible behind transparent pixels; never alter the artwork or exported package.
- Verify on the user's Android tablet at magnified display size. Check that edge halos, unwanted colour show-through and transparency defects can be inspected before approval.
