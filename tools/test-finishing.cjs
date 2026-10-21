'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const template = read('templates/finishing.php');
const settingsTemplate = read('templates/finishing-settings.php');
const css = read('assets/css/finishing.css');
const theme = read('assets/css/studio-theme.css');
const finishing = read('assets/js/finishing.js');
const studio = read('assets/js/studio.js');
const backend = read('includes/class-sbs-finishing.php');
const plugin = read('smutty-bear-studio.php');

assert.match(plugin, /Version: 0\.2\.62/);
assert.match(plugin, /define\('SBS_VERSION', '0\.2\.62'\)/);

// The two choices intentionally call separate Android/browser file pickers.
assert.match(template, /id="sbs-af-file"[^>]*type="file"[^>]*accept="\.png,\.jpg,\.jpeg,\.webp,application\/octet-stream"/);
assert.match(template, /id="sbs-af-gallery-file"[^>]*type="file"[^>]*accept="image\/\*"/);
assert.match(finishing, /sbs-af-gallery-file/);
assert.match(finishing, /selectedFile\|\|el\('sbs-af-file'\)\.files\[0\]\|\|el\('sbs-af-gallery-file'\)\.files\[0\]/);

// Regression for the empty review box: global inputs are 100% wide, so the
// checkbox must have its own fixed column and the text must have room to wrap.
assert.match(css, /input\[type=checkbox\][^{]*\{[^}]*width:28px[^}]*flex:0 0 28px/);
assert.match(css, /fieldset label\{[^}]*grid-template-columns:28px minmax\(0,1fr\)/);
assert.match(css, /@media\(max-width:750px\)\{\.sbs-af-compare\{grid-template-columns:minmax\(0,1fr\)/);

assert.match(template, /2\. Queue selected stage/);
assert.match(template, /3\. Run queued stage/);
assert.match(template, /Then ↓/);
assert.match(finishing, /20\*1024\*1024/);
assert.match(finishing, /selectedFile=null;input\.value='';var warning='This file is '/);
assert.match(finishing, /fileSize\(f\.size\).*20 MB/s);
assert.match(backend, /This file is '.*The limit is 20 MB/s);
assert.match(finishing, /Workspace '\+current\.uuid/);
assert.match(template, /id="sbs-af-upload-status" role="status" aria-live="polite"/);
assert.match(finishing, /Saved successfully: “'\+current\.title/);
assert.match(finishing, /Upload not confirmed: '\+error\.message/);
assert.match(finishing, /function operation\(fn,text,button,onError\)/);
assert.match(finishing, /button\.setAttribute\('aria-busy','true'\)/);
assert.match(settingsTemplate, /Studio sign-in required\. Sign in above before saving or checking Google settings\./);
assert.match(settingsTemplate, /SBS_Google_Drive::redirect_uri\(\)/);
assert.match(finishing, /Settings saved securely\. /);
assert.match(finishing, /Checking saved Google settings…/);
assert.match(finishing, /Google settings could not be checked or saved:/);
assert.match(finishing, /googleControls\(\).*googleBusy\|\|!googleState\.configured\|\|googleState\.connected/s);
assert.match(settingsTemplate, /id="sbs-google-status" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(theme, /select option:checked/);
assert.match(theme, /background: #101827;\s+color: #fff3d4;/);
assert.match(studio, /if \(button\.closest\('\.sbs-primary-tabs'\)\) \{ return; \}/);
assert.match(studio, /button\.textContent = 'Processing…'/);
assert.match(theme, /\[aria-busy="true"\]::before/);

// Simple local workflow UI: no reference entry, Drive transfer, or redundant original download.
assert.doesNotMatch(template, /sbs-af-(ideas|sb)|sbs-af-original-download|Select from Google Drive|Save Approved Artwork to Drive/);
assert.match(template, /Artwork title <span class="sbs-af-required">Required<\/span>[^\n]*required aria-required="true"/);
assert.match(template, /Comparison zoom \(display only\)/);
assert.match(template, /Preview zoom only; it does not change the image/);
assert.match(template, /Check the image on light and dark backgrounds/);
assert.match(template, /data-af-check="garments"[^>]*> I inspected the candidate on all 12 garment-colour proof backgrounds/);
assert.match(template, /id="sbs-af-print-proof"[^>]*hidden/);
assert.match(template, /id="sbs-af-handoff"/);
assert.match(template, /Copy ChatGPT handoff/);
assert.match(template, /id="sbs-af-ai-status" role="status"/);
assert.match(template, /4\. Run AI comparison \(optional\)/);
assert.match(template, /7\. Build approved ZIP/);
assert.match(template, /Garment-colour proof backgrounds/);
assert.match(template, /id="sbs-af-proof-viewer"[^>]*aria-modal="true"/);
assert.match(template, /id="sbs-af-proof-reset"/);
assert.match(template, /id="sbs-af-proof-close"/);
assert.equal((template.match(/data-viewer-color=/g) || []).length, 12);
assert.match(finishing, /viewerImage\.src=activeProofAssetUrl/);
assert.match(finishing, /pointerdown/);
assert.match(finishing, /pointermove/);
assert.match(finishing, /function resetViewer/);
assert.match(css, /overflow-x:auto/);
assert.match(css, /touch-action:none/);
assert.ok(template.indexOf('data-proof-color="black"') < template.indexOf('data-proof-color="white"'));
assert.ok(template.indexOf('data-proof-color="white"') < template.indexOf('data-proof-color="red"'));
assert.ok(template.indexOf('data-proof-color="red"') < template.indexOf('data-proof-color="navy"'));
assert.match(finishing, /function refreshPrintStatus/);
assert.match(finishing, /PPI: '\+ppi\.toFixed\(1\)\+' \| Target: 300 \| Now: '\+size\+' \| Max:/);
assert.match(finishing, /canvas\.toBlob/);
assert.match(css, /grid-auto-flow:column;grid-auto-columns:minmax\(82vw,1fr\);overflow-x:auto/);
assert.match(css, /\.sbs-af-review-controls\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.doesNotMatch(finishing, /sbs-af-(ideas|sb|original-download|show-sb|sb-catalogue)/);
assert.match(finishing, /data\.append\('title',el\('sbs-af-name'\)\.value\)/);
console.log('Artwork Finishing checks passed.');

assert.match(template, /7\. Build approved ZIP/);
assert.match(template, /id="sbs-af-package-help"/);
assert.match(finishing, /showDirectoryPicker/);
assert.match(finishing, /startIn:'downloads'/);
assert.match(finishing, /folder\.getDirectoryHandle\('Smutty Studio ZIP files',\{create:true\}\)/);
assert.match(finishing, /uniquePackageName/);
assert.match(finishing, /getFileHandle\(candidate\)/);
assert.match(finishing, /Folder selection cancelled\. No ZIP package was built\./);
assert.match(finishing, /Download local package to save it through your browser/);

assert.match(finishing, /Choose a folder for the ZIP/);
assert.match(finishing, /response\.body\.pipeTo/);

// Replicate upscale is explicitly supported by the existing adapter and remains a separate review candidate.
assert.match(template, /value="upscale"[^>]*>AI upscale — Replicate Real-ESRGAN/);
assert.match(backend, /SBS_Replicate::is_configured\(\)/);
assert.match(backend, /SBS_Replicate::submit\(\$r\['original'\]\['id'\],\$scale\)/);
assert.match(backend, /SBS_Replicate::poll\(/);
assert.match(backend, /SBS_Replicate::cancel\(/);
assert.match(backend, /nightmareai\/real-esrgan/);
assert.match(read('includes/class-sbs-replicate.php'), /'face_enhance' => false/);
assert.match(backend, /40-million-pixel candidate limit/);
assert.match(backend, /original is unchanged/);
assert.match(finishing, /Do not run another upscale/);

assert.match(backend, /\$r\['original_qa'\]\['width'\].*\$pw/);
assert.match(finishing, /sbs-af-prepare'\)\.disabled=busy\|\|!current\|\|!!current\.pending/);
assert.match(finishing, /sbs-af-run'\)\.disabled=busy\|\|!current\|\|!current\.pending\|\|!!current\.pending\.replicate_prediction_id/);
assert.match(template, /4\. Run AI comparison \(optional\)/);
assert.match(template, /id="sbs-af-ai-status" role="status"/);
assert.match(template, /never changes the images/);
assert.match(backend, /\$action==='ai_review'/);
assert.match(backend, /geometry_report\(\$r\['original'\],\$asset,\$r\['original_qa'\],\$qa\)/);
assert.match(backend, /nonuniform_scale_percent/);
assert.match(backend, /transparency_sample_matches/);
assert.match(read('includes/class-sbs-openai.php'), /review_finishing_artwork/);
assert.match(read('includes/class-sbs-openai.php'), /You only report observations; you never edit or generate images/);
assert.match(finishing, /function renderAiReview/);
assert.match(finishing, /function renderHandoff\(version\)/);
assert.match(finishing, /var sx=Number\(q\.width\)\/Number\(sourceQA\.width\),sy=Number\(q\.height\)\/Number\(sourceQA\.height\)/);
assert.match(finishing, /Suggested maximum: '\+suggested/);
assert.match(finishing, /Original: '\+\(sourceQA\.width\|\|'\?'\)/);
assert.match(finishing, /PASS — digital checks clear; print quality is not guaranteed/);
assert.match(finishing, /REVIEW — .*need attention/);
assert.match(finishing, /SMUTTY STUDIO — CHATGPT ARTWORK HANDOFF/);
assert.match(finishing, /navigator\.clipboard\.writeText/);
assert.match(finishing, /PPI: '\+ppi\.toFixed\(1\)\+' \| Target: 300 \| Now: '\+size\+' \| Max:/);
assert.match(finishing, /Comparison not completed: '\+error\.message/);
assert.match(finishing, /✓ 2\. Stage queued/);
assert.match(finishing, /✓ 3\. Stage complete/);
assert.match(finishing, /✓ 6\. Approved locally/);
assert.match(finishing, /Please compare the attached original\/ and candidate\//);
assert.match(finishing, /Focus check: '\+finding\.action/);
assert.match(finishing, /Comparing images with OpenAI/);
assert.match(backend, /geometry'=>self::geometry_report/);
assert.match(finishing, /AI visual comparison: /);
assert.match(finishing, /Warnings and points to check/);
assert.match(finishing, /className='sbs-af-review-points'/);
assert.match(finishing, /className='sbs-af-review-points sbs-af-ai-findings'/);
assert.match(css, /\.sbs-af-review-points\{[^}]*color:#ffe08a/);
assert.match(css, /\.sbs-af-proof-grid \.sbs-info-button,\.sbs-af-proof-viewer \.sbs-info-button\{display:none!important\}/);
assert.match(finishing, /PPI: '\+ppi\.toFixed\(1\)\+' \| Target: 300 \| Now: '\+size\+' \| Max:/);
assert.match(finishing, /var suggestedWidth=Number\(q\.width\)\/300,suggestedHeight=Number\(q\.height\)\/300/);
assert.match(css, /#sbs-af-print-status\[data-state="warning"\]::before\{background:#ff5a5f/);
assert.match(css, /#sbs-af-print-status\{padding:\.2rem 0;border:0/);
