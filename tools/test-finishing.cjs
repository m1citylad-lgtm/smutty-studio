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

assert.match(plugin, /Version: 0\.2\.50/);
assert.match(plugin, /define\('SBS_VERSION', '0\.2\.50'\)/);

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

console.log('Artwork Finishing checks passed.');
