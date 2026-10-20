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

assert.match(plugin, /Version: 0\.2\.52/);
assert.match(plugin, /define\('SBS_VERSION', '0\.2\.52'\)/);

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

assert.match(template, /1\. Queue selected stage/);
assert.match(template, /2\. Run queued local stage/);
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
assert.match(template, /does not upscale or change the image/);
assert.match(template, /Choose Light, inspect the candidate, then choose Dark/);
assert.match(template, /data-af-check="garments"[^>]*> I inspected the candidate on both Light and Dark backgrounds/);
assert.match(css, /\.sbs-af-review-controls\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.doesNotMatch(finishing, /sbs-af-(ideas|sb|original-download|show-sb|sb-catalogue)/);
assert.match(finishing, /data\.append\('title',el\('sbs-af-name'\)\.value\)/);
console.log('Artwork Finishing checks passed.');

assert.match(template, /Build and save approved local package/);
assert.match(template, /Smutty Studio ZIP files/);
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
