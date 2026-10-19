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
const drive = read('includes/class-sbs-google-drive.php');
const transport = read('includes/class-sbs-google-drive-transport.php');
const pluginPhp = read('includes/class-sbs-plugin.php');
const plugin = read('smutty-bear-studio.php');

assert.match(plugin, /Version: 0\.2\.49/);
assert.match(plugin, /define\('SBS_VERSION', '0\.2\.49'\)/);

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
assert.match(template, /id="sbs-af-drive-browse"[^>]*>Browse Google Drive images/);
assert.match(template, /id="sbs-af-drive-folder"[^>]*>Choose Google Drive save folder/);
assert.match(template, /id="sbs-af-save-drive"[^>]*disabled>Save approved package to Google Drive/);
assert.match(finishing, /new google\.picker\.DocsView\(google\.picker\.ViewId\.DOCS\)/);
assert.match(finishing, /setMimeTypes\('image\/png,image\/jpeg,image\/webp'\)/);
assert.match(finishing, /setSelectFolderEnabled\(true\)/);
assert.match(finishing, /api\('\/google\/picker',\{\}\)/);
assert.match(finishing, /No duplicate was created/);
assert.match(finishing, /api\('\/save-drive'/);
assert.match(backend, /'\/import-drive' => array\('POST','import_drive'\)/);
assert.match(backend, /'\/save-drive' => array\('POST','save_drive'\)/);
assert.match(backend, /already_imported/);
assert.match(backend, /Complete human review and approve the current local version before saving/);
assert.match(backend, /approved_master_file_id/);
assert.match(backend, /Human-approved local finishing package uploaded to user-selected Google Drive folder; checksum verified/);
assert.match(transport, /https:\/\/www\.googleapis\.com\/drive\/v3\/files/);
assert.match(transport, /hash_equals\(strtolower\(\$meta\['md5Checksum'\]\), md5\(\$bytes\)\)/);
assert.match(transport, /image\/png','image\/jpeg','image\/webp/);
assert.match(transport, /Google sign-in expired\. Reconnect Google Drive, then try again/);
assert.match(transport, /Google cannot add files to that folder/);
assert.match(transport, /appProperties/);
assert.match(transport, /hash_equals\(strtolower\(\$meta\['md5Checksum'\]\),md5\(\$bytes\)\)/);
assert.match(drive, /const SCOPE = 'https:\/\/www\.googleapis\.com\/auth\/drive\.file'/);
assert.match(drive, /'\/picker'=>array\('POST','picker'\)/);
assert.match(drive, /'access_token'=>\$token/);
assert.match(drive, /'catalogue_writes_enabled'=>false/);
assert.match(pluginPhp, /frame-src https:\/\/docs\.google\.com/);
assert.match(pluginPhp, /https:\/\/apis\.google\.com/);
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
