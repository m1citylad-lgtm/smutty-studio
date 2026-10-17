# Smutty Studio — T-shirt production workflow (2026-10-17)

## Default rules
- Vintage treatment: 70% clean retro illustration, 20% selective halftone, 10% restrained distress. These are creative guidelines, not literal measured pixel proportions.
- Print method: DTG by default; DTF optional. Supplier choices: Redbubble and Gelato. Do not assume either supports a particular DTF workflow without a product-specific specification.
- Print target: 4500 × 5400 pixels, 300 PPI at 15 × 18 inches, transparent PNG where appropriate. A 300-PPI target field is not proof of embedded PPI metadata or of actual sharpness.
- Manual override is allowed for preflight warnings. Hard structural errors still block export. Every export carries a JSON report.
- Preserve original generated image and editable canvas. Export separate branded and logo-free PNGs.

## Production stages
1. Choose approved character reference and scene; create artwork.
2. Assess visual treatment; keep face, lettering and key outlines crisp. The current Studio provides a prominent review notice but does not yet implement computer-vision treatment recommendations.
3. Refine/polish as needed; inspect changes to face, lettering, edges and intended composition. AI upscaling may hallucinate details.
4. Choose garment, product, provider, and DTG/DTF process. Obtain the actual product's artwork specifications from Redbubble or Gelato.
5. Import the approved Exact logo reference. Place, scale and rotate on the canvas; save the editable version. Contour-warping is not yet implemented.
6. Run preflight. It checks output dimensions, aspect ratio, blank canvas, image-layer enlargement, transparency selection, and some logo sizing risks. It does not scan pixel halos, embedded resolution metadata, legibility, actual sharpness, gamut, printer underbase, or provider compliance.
7. Review artwork on black, white, red and blue backgrounds at 100% and target print size. This is a required manual stage until a four-background proof is implemented.
8. For warnings, either correct and recheck or use the explicit manual override; override is recorded in JSON and never relabels warnings as passed.
9. Export PNG variants and report. Inspect actual exported files for dimensions, alpha transparency, softness, halo pixels, colour and lettering.
10. Upload to selected supplier, review its placement/print preview, order a physical sample, and approve before general sale.

## Known remaining gaps
- Pixel-level inspection and automatic defect correction are not implemented.
- Provider-specific export profiles need verified per-product specifications, including any colour/profile and transparency requirements.
- Advanced curved/contour-following logo treatment, separate logo library, 4-background proof generator and automatic vintage treatment recommendations are not implemented.
- In-browser preflight does not certify the actual exported PNG. Production sign-off requires checking the downloaded file and a physical print sample.
- Browser multi-download permissions may prevent one or more PNG/report downloads. Verify files individually.
