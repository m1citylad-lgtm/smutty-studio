Warning: truncated output (original token count: 36684)
Total output lines: 1255

(function () {
    'use strict';

    var root = document.getElementById('sbs-app');
    var boot = root ? { rest: root.getAttribute('data-rest'), authenticated: root.getAttribute('data-authenticated') === '1', slug: root.getAttribute('data-slug'), version: root.getAttribute('data-version') } : {};
    var state = {
        packs: [], projects: [], usage: {}, providers: {}, selectedPack: null, activeProject: null,
        selectedGeneration: null, concept: null, canvas: null, canvasUuid: '', history: [], redo: [], historyLock: false,
        loadedFonts: {}, polling: {}, analysisSuggestion: null, developmentProjectUuid: '', developmentJobs: {}, updateStatus: null
    };

    var freestyle = null;
    function el(id) { return document.getElementById(id); }
    function esc(value) { var node = document.createElement('div'); node.textContent = value == null ? '' : String(value); return node.innerHTML; }
    function money(value) { return '$' + Number(value || 0).toFixed(4); }
    function showMessage(message, error) {
        var box = el('sbs-global-message');
        if (!box) { return; }
        box.textContent = message;
        box.classList.toggle('is-error', !!error);
        box.hidden = false;
        clearTimeout(box._timer);
        box._timer = setTimeout(function () { box.hidden = true; }, 7000);
    }
    function api(path, options) {
        options = options || {};
        var headers = options.headers || {};
        headers['X-SBS-Request'] = 'studio';
        if (!(options.body instanceof FormData)) { headers['Content-Type'] = 'application/json'; }
        options.headers = headers;
        options.credentials = 'same-origin';
        return fetch(boot.rest + path.replace(/^\//, ''), options).then(function (response) {
            return response.text().then(function (text) {
                var data;
                try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text || 'Unexpected server response.' }; }
                if (!response.ok) { throw new Error(data.message || 'Request failed.'); }
                return data;
            });
        });
    }
    function post(path, data) { return api(path, { method: 'POST', body: JSON.stringify(data || {}) }); }
    function patch(path, data) { return api(path, { method: 'PATCH', body: JSON.stringify(data || {}) }); }
    function remove(path) { return api(path, { method: 'DELETE' }); }

    function bindLogin() {
        var form = el('sbs-login-form');
        if (!form) { return; }
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var message = form.querySelector('.sbs-form-message');
            message.textContent = 'Checking…';
            post('auth/login', { password: form.password.value, adult_confirmed: form.adult_confirmed.checked }).then(function () {
                el('sbs-login').hidden = true;
                el('sbs-workspace').hidden = false;
                el('sbs-primary-nav').hidden = false;
                el('sbs-guide-open').hidden = false;
                message.textContent = '';
                window.location.reload();
            }).catch(function (error) { message.textContent = error.message; });
        });
    }

    function bindPrimaryTabs() {
        document.querySelectorAll('.sbs-primary-tabs button').forEach(function (button) {
            button.addEventListener('click', function () {
                var target = button.getAttribute('data-primary-tab');
                document.querySelectorAll('.sbs-primary-tabs button').forEach(function (item) { item.classList.toggle('active', item === button); });
                el('sbs-character-area').hidden = target !== 'characters';
                document.querySelector('[data-panel="usage"]').classList.toggle('active', target === 'usage');
                document.querySelector('[data-panel="settings"]').classList.toggle('active', target === 'settings');
                document.querySelector('[data-panel="freestyle"]').classList.toggle('active', target === 'freestyle');
                ['finishing', 'catalogue'].forEach(function (area) { document.querySelector('[data-panel="' + area + '"]').classList.toggle('active', target === area); });
                if (target === 'freestyle' && freestyle) { freestyle.render(); }
                if (target === 'usage') { loadUsage(); }
                if (target === 'settings') { loadUpdates(); }
            });
        });
    }

    function bindTabs() {
        document.querySelectorAll('.sbs-tabs button').forEach(function (button) {
            button.addEventListener('click', function () {
                document.querySelectorAll('.sbs-tabs button').forEach(function (item) { item.classList.toggle('active', item === button); });
                document.querySelectorAll('.sbs-panel').forEach(function (panel) { panel.classList.toggle('active', panel.getAttribute('data-panel') === button.getAttribute('data-tab')); });
                if (button.getAttribute('data-tab') === 'development') { renderDevelopment(); }
                if (button.getAttribute('data-tab') === 'projects') { renderProjects(); }
                if (button.getAttribute('data-tab') === 'canvas') { ensureCanvas(); renderCanvasOptions(); if(state.freestyleNewCanvas){state.freestyleNewCanvas=false;}else{loadLatestCanvas();} resizeCanvasViewport(); }
                if (button.getAttribute('data-tab') === 'usage') { loadUsage(); }
            });
        });
    }

    function loadBootstrap() {
        return api('bootstrap').then(function (data) {
            var selectedUuid = state.selectedPack ? state.selectedPack.uuid : window.localStorage.getItem('sbs-current-pack');
            state.packs = data.packs || [];
            state.projects = data.projects || [];
            state.usage = data.usage || {};
            state.providers = data.providers || {};
            state.freestylePackUuid = data.freestyle_pack_uuid || "";
            state.freestyleReady = true;
            state.selectedPack = findPack(selectedUuid) || state.packs[0] || null;
            renderPackOptions(); renderPacks(); renderPackEditor(); renderDevelopment(); renderProjects(); renderUsage(state.usage); renderCanvasOptions(); renderCharacterContext();
            if (freestyle) { freestyle.render(); }
            if (data.active_jobs && data.active_jobs.length) { trackJobs(data.active_jobs); }
            if (!state.providers.openai) { showMessage('OpenAI is not configured yet. An administrator can add the API key in the Settings tab.', true); }
        }).catch(function (error) {
            if (/authentication/i.test(error.message)) { window.location.reload(); } else { showMessage(error.message, true); }
        });
    }

    function renderPackOptions() {
        var select = el('sbs-current-pack');
        select.innerHTML = state.packs.length ? state.packs.map(function (pack) { return '<option value="' + esc(pack.uuid) + '">' + esc(pack.name) + ' · v' + pack.current_version + '</option>'; }).join('') : '<option value="">No characters</option>';
        if (state.selectedPack) { select.value = state.selectedPack.uuid; }
        updatePromptPreview();
    }

    function renderCharacterContext() {
        var name = state.selectedPack ? state.selectedPack.name : 'No character selected';
        ['sbs-idea-character-name', 'sbs-creations-character-name', 'sbs-canvas-character-name', 'sbs-usage-character-name'].forEach(function (id) { if (el(id)) { el(id).textContent = name; } });
        if (el('sbs-fork-pack')) { el('sbs-fork-pack').disabled = !state.selectedPack; }
    }

    function selectPack(uuid, persist) {
        var pack = findPack(uuid);
        if (!pack) { return; }
        var changed = !state.selectedPack || state.selectedPack.uuid !== pack.uuid;
        state.selectedPack = pack;
        if (persist !== false) { window.localStorage.setItem('sbs-current-pack', pack.uuid); }
        if (state.activeProject && state.activeProject.pack_uuid !== pack.uuid) { state.activeProject = null; state.selectedGeneration = null; }
        if (changed) { state.analysisSuggestion = null; state.developmentProjectUuid = ''; state.developmentJobs = {}; resetCanvasProject(); if (el('sbs-live-jobs')) { el('sbs-live-jobs').innerHTML = ''; } }
        renderPackOptions(); renderCharacterContext(); renderPacks(); renderPackEditor(); renderDevelopment(); renderProjects(); renderCanvasOptions(); updatePromptPreview();
        if (changed && state.canvas) { loadLatestCanvas(); }
    }

    function renderPacks() {
        return;
    }
    function findPack(uuid) { return state.packs.find(function (pack) { return pack.uuid === uuid; }); }
    function help(text) { return '<span class="sbs-help" tabindex="0" role="note" aria-label="' + esc(text) + '" data-help="' + esc(text) + '">?</span>'; }
    function roleLabel(role) { return String(role || 'reference').replace(/_/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }); }
    function referenceRoleMeta(role) {
        var roles = {
            master_reference: { label: 'Master sheet', icon: '&#128450;' },
            face: { label: 'Face', icon: '&#128578;' },
            full_body: { label: 'Full body', icon: '&#128100;' },
            expression: { label: 'Expression', icon: '&#128516;' },
            outfit: { label: 'Outfit', icon: '&#128085;' },
            palette: { label: 'Palette', icon: '&#127912;' },
            style: { label: 'Style / texture', icon: '&#9998;' },
            logo: { label: 'Exact logo', icon: '&#127991;' },
            generated_reference: { label: 'Generated reference', icon: '&#10024;' }
        };
        return roles[role] || { label: roleLabel(role), icon: '&#128444;' };
    }
    function suggestionText(value) { return Array.isArray(value) ? value.join('\n') : String(value || ''); }
    function analysisSuggestionMarkup(pack) {
        if (!state.analysisSuggestion || state.analysisSuggestion.packUuid !== pack.uuid) { return ''; }
        var proposal = state.analysisSuggestion.proposal || {}, identity = pack.identity || {};
        var fields = [
            { key: 'summary', label: 'Identity summary' },
            { key: 'locked_traits', label: 'Identity traits' },
            { key: 'exclusions', label: 'Exclusions' },
            { key: 'humour_boundary', label: 'Humour and personality boundary' },
            { key: 'palette', label: 'Palette values' }
        ].filter(function (field) { return Object.prototype.hasOwnProperty.call(proposal, field.key); });
        if (!fields.length) { return '<aside class="sbs-analysis-suggestion"><p class="sbs-muted">The analysis did not return any usable description fields.</p></aside>'; }
        var comparisons = fields.map(function (field) {
            var current = suggestionText(identity[field.key]);
            var suggested = suggestionText(proposal[field.key]);
            return '<article class="sbs-suggestion-field"><label class="sbs-suggestion-choice"><input type="checkbox" name="suggested_field" value="' + esc(field.key) + '"><span>' + esc(field.label) + '</span></label><div class="sbs-suggestion-comparison"><div><small>Saved now</small><p>' + esc(current || 'Not set') + '</p></div><div><small>Suggested</small><p>' + esc(suggested || 'Not set') + '</p></div></div></article>';
        }).join('');
        return '<aside class="sbs-analysis-suggestion" aria-labelledby="sbs-suggestion-title"><div class="sbs-inline-heading"><div><p class="sbs-kicker">REVIEW BEFORE APPLYING</p><h3 id="sbs-suggestion-title">Suggested description changes</h3></div><span>Nothing has been changed yet.</span></div><form id="sbs-analysis-suggestion-form">' + comparisons + '<div class="sbs-row wrap sbs-suggestion-actions"><button id="sbs-apply-selected-suggestion" class="sbs-button primary" type="button" disabled>Apply selected</button><button id="sbs-apply-all-suggestion" class="sbs-button" type="button">Apply all</button><button id="sbs-discard-suggestion" class="sbs-button" type="button">Discard</button></div></form></aside>';
    }
    function applyAnalysisSuggestion(keys, button) {
        if (!state.selectedPack || !state.analysisSuggestion || !keys.length) { return; }
        var pack = state.selectedPack, proposal = state.analysisSuggestion.proposal || {}, identity = {};
        keys.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(proposal, key)) { identity[key] = proposal[key]; } });
        buttonBusy(button, true);
        patch('packs/' + pack.uuid, { name: pack.name, description: pack.description || '', identity: identity }).then(function (updated) {
            state.analysisSuggestion = null;
            replacePack(updated);
            showMessage(keys.length === 1 ? 'Suggested field applied.' : 'Suggested fields applied. Review them under Description.');
        }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }

    function renderPackEditor() {
        var descriptionBox = el('sbs-pack-description'), referenceBox = el('sbs-pack-references'), pack = state.selectedPack;
        if (!pack) { descriptionBox.innerHTML = '<p class="sbs-muted">Choose a character.</p>'; referenceBox.innerHTML = '<p class="sbs-muted">Choose a character.</p>'; return; }
        var identity = pack.identity || {};
        var referenceAssets = pack.assets || [];
        var roleOrder = ['master_reference', 'face', 'full_body', 'expression', 'outfit', 'palette', 'style', 'logo'];
        referenceAssets.forEach(function (asset) { if (roleOrder.indexOf(asset.role) < 0) { roleOrder.push(asset.role); } });
        var referenceSections = roleOrder.map(function (role) {
            var groupedAssets = referenceAssets.filter(function (asset) { return asset.role === role; });
            if (!groupedAssets.length) { return ''; }
            var meta = referenceRoleMeta(role);
            var cards = groupedAssets.map(function (asset) {
                var label = asset.label || 'Unlabelled reference';
                return '<figure class="sbs-reference"><div class="sbs-reference-image"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(asset.url) + '" data-zoom-caption="' + esc(meta.label + ' · ' + label) + '"><img src="' + esc(asset.url) + '" alt="' + esc(meta.label + ': ' + label) + '"></button><button type="button" class="sbs-reference-bin" data-delete-reference="' + esc(asset.uuid) + '" title="Delete this reference" aria-label="Delete ' + esc(label) + '"><span aria-hidden="true">&#128465;</span></button></div><figcaption><strong>' + esc(label) + '</strong></figcaption></figure>';
            }).join('');
            return '<section class="sbs-reference-role-section"><h3 class="sbs-reference-role-bubble"><span class="sbs-role-icon" aria-hidden="true">' + meta.icon + '</span><span>' + esc(meta.label) + '</span><small>' + groupedAssets.length + '</small></h3><div class="sbs-reference-grid">' + cards + '</div></section>';
        }).join('');
        descriptionBox.innerHTML = '<form id="sbs-pack-properties" class="sbs-character-properties"><section class="sbs-workflow-part"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">1.1</span> Define the character</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Choose the name, short description and identity summary.</p><div class="sbs-grid two"><label>Character name ' + help('The consistent public name used throughout the studio and in creation records.') + '<input name="name" value="' + esc(pack.name) + '" required></label><label>Short description ' + help('A quick plain-language overview of the character, personality and visual style.') + '<input name="description" value="' + esc(pack.description || '') + '"></label></div><label>Identity summary ' + help('A fuller description of who the character is, how they look and how they should feel in every image.') + '<textarea name="summary" rows="4">' + esc(identity.summary || '') + '</textarea></label></section><section class="sbs-workflow-part"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">1.2</span> Set traits and boundaries</h2><p class="sbs-stage-decision"><strong>Decision:</strong> What must stay consistent, and what must be excluded?</p><div class="sbs-grid two"><label>Identity traits — one per line ' + help('Non-negotiable visual traits to preserve across generations, such as face shape, eyes, proportions, outfit and rendering style.') + '<textarea name="locked_traits" rows="9">' + esc((identity.locked_traits || []).join('\n')) + '</textarea></label><label>Exclusions — one per line ' + help('Things the model must avoid because they would make the character or artwork look wrong.') + '<textarea name="exclusions" rows="9">' + esc((identity.exclusions || []).join('\n')) + '</textarea></label></div><label>Humour and personality boundary ' + help('Describe the character’s attitude and permitted comic tone, including how bawdy or suggestive the humour should be while remaining non-explicit.') + '<textarea name="humour_boundary" rows="3">' + esc(identity.humour_boundary || '') + '</textarea></label></section><section class="sbs-workflow-part"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">1.3</span> Choose colours and save</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Confirm the palette and save the brief before Visual Development.</p><label>Palette values — one per line or comma-separated ' + help('Approved recurring colours. Hex values are most precise, but clear colour names also work.') + '<textarea name="palette" rows="3">' + esc((identity.palette || []).join('\n')) + '</textarea></label><button class="sbs-button primary" type="submit">Save character properties</button></section></form>';
        referenceBox.innerHTML = '<form id="sbs-pack-upload" class="sbs-card sbs-reference-upload"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">3.1</span> Add reference material</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Choose an authorised file, its role and label. Replace a role only when intended.</p><div class="sbs-row wrap"><label>Reference file ' + help('Upload an authorised image that demonstrates this character’s appearance, styling, colours or exact-use branding.') + '<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required></label><label>Role ' + help('Tell the generator what this image is authoritative for so only the most relevant references are used.') + '<select name="role"><option value="master_reference">Master sheet</option><option value="face">Face</option><option value="full_body">Full body</option><option value="expression">Expression</option><option value="outfit">Outfit</option><option value="palette">Palette</option><option value="style">Style / texture</option><option value="logo">Exact logo</option></select></label><label>Label ' + help('A short human-readable note identifying what this reference contains.') + '<input name="label" type="text"></label><label class="sbs-check"><input name="replace_role" type="checkbox" value="1"> Replace existing references in this role ' + help('When selected, the new upload replaces every current reference assigned to the chosen role.') + '</label><button class="sbs-button" type="submit">Upload reference</button></div></form>' + '<h2 class="sbs-stage-heading"><span class="sbs-stage-number">3.2</span> Inspect the reference library</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Check the references below and keep the correct approved versions.</p>' +
            (referenceSections || '<p class="sbs-muted">Upload a master sheet or individual references.</p>') + '<section class="sbs-workflow-part"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">3.3</span> Optional description suggestions</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Request suggestions only if needed; review and choose what to apply.</p><div…26684 tokens truncated…('; ')+'; ':'')+warnings.join('; ');
        return report;
    }
    var exportDownloadUrls = [];
    function clearExportDownloads() {
        exportDownloadUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        exportDownloadUrls = [];
        var box = el('sbs-export-downloads');
        if (box) { box.replaceChildren(); box.hidden = true; }
    }
    async function pngWithResolution(blob, dpi) {
        var input=new Uint8Array(await blob.arrayBuffer());
        if(input.length<33 || input[0]!==137 || input[1]!==80 || input[2]!==78 || input[3]!==71)throw new Error('PNG output could not be verified.');
        var ppm=Math.round(Number(dpi)/0.0254);
        if(!Number.isFinite(ppm)||ppm<1)throw new Error('Invalid PNG print density.');
        var chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);view.setUint32(8,ppm);view.setUint32(12,ppm);chunk[16]=1;
        var crc=0xffffffff;for(var i=4;i<17;i++){crc^=chunk[i];for(var b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(17,(crc^0xffffffff)>>>0);
        var parts=[input.slice(0,8)],offset=8,inserted=false;
        while(offset+12<=input.length){var length=new DataView(input.buffer,input.byteOffset+offset,4).getUint32(0),end=offset+12+length;if(end>input.length)throw new Error('Incomplete PNG output.');var type=String.fromCharCode.apply(null,input.slice(offset+4,offset+8));if(type!=='pHYs')parts.push(input.slice(offset,end));if(type==='IHDR'){parts.push(chunk);inserted=true;}offset=end;}
        if(!inserted||offset!==input.length)throw new Error('Invalid PNG chunk structure.');
        return new Blob(parts,{type:'image/png'});
    }
    function pngBlob(canvas) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (blob && blob.size) { pngWithResolution(blob, Number(el('sbs-print-dpi').value)).then(resolve,reject); }
                else { reject(new Error('The browser could not create the PNG. Try a smaller print size.')); }
            }, 'image/png');
        });
    }
    function showExportDownloads(files) {
        var box = el('sbs-export-downloads');
        var heading = document.createElement('h2');
        heading.id = 'sbs-export-downloads-title'; heading.textContent = 'Your downloads are ready';
        var note = document.createElement('p');
        note.textContent = 'Download each file below. These are copies; the original artwork is unchanged. Check the PNGs before printing. Preparing another export replaces these links.';
        box.append(heading, note);
        files.forEach(function (file) {
            var url = URL.createObjectURL(file.blob), link = document.createElement('a');
            exportDownloadUrls.push(url);
            link.href = url; link.download = file.name; link.textContent = file.label; link.className = 'sbs-button';
            box.appendChild(link);
        });
        box.hidden = false;
        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    async function exportCanvas() {
        clearExportDownloads();
        var report=runPrintPreflight(),override=el('sbs-manual-override').checked;
        if (report.errors.length) { showMessage('Print export blocked: '+report.errors.join('; '),true); return; }
        if (report.warnings.length && !override) { showMessage('Print export blocked pending review. Check the manual override box to acknowledge unresolved warnings.',true); return; }
        report.manual_override=override;
        ensureCanvas();
        var targetW = Math.round(Number(el('sbs-print-width').value) * Number(el('sbs-print-dpi').value));
        var targetH = Math.round(Number(el('sbs-print-height').value) * Number(el('sbs-print-dpi').value));
        if (!targetW || !targetH || targetW < 1 || targetH < 1) { showMessage('Enter valid print dimensions and resolution.', true); return; }
        var ratioW = targetW / state.canvas.width, ratioH = targetH / state.canvas.height;
        if (Math.abs(ratioW-ratioH)>0.001) { showMessage('Print aspect ratio does not match the canvas. Correct the print width and height before export to avoid incorrect dimensions.', true); return; }
        if (targetW * targetH > 60000000 && !window.confirm('This export is over 60 megapixels and may exceed browser memory. Continue?')) { return; }
        var guides = state.canvas.getObjects().filter(function (obj) { return obj.sbsType === 'guide'; });
        var logos = state.canvas.getObjects().filter(function (obj) { return obj.sbsType === 'exact_asset'; });
        var hidden = guides.map(function (obj) { return obj.visible; });
        var logoStates = logos.map(function (obj) { return obj.visible; });
        var button = el('sbs-canvas-export');
        var both = el('sbs-export-both').checked;
        guides.forEach(function (obj) { obj.visible = false; });
        var basename = ((state.activeProject && state.activeProject.title) || 'smutty-bear-artwork').replace(/[^A-Za-z0-9_-]+/g, '-');
        function snapshot() {
            state.canvas.renderAll();
            return state.canvas.toCanvasElement(ratioW, { enableRetinaScaling: false });
        }
        buttonBusy(button, true);
        try {
            var files = [{ name: basename + '-branded.png', label: 'Download branded PNG', blob: await pngBlob(snapshot()) }];
            if (both) {
                logos.forEach(function (obj) { obj.visible = false; });
                files.push({ name: basename + '-logo-free.png', label: 'Download logo-free PNG', blob: await pngBlob(snapshot()) });
            }
            files.push({ name: basename + '-print-preflight.json', label: 'Download print check report', blob: new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }) });
            showExportDownloads(files);
            showMessage('Downloads ready. Select each file to save it. Print warnings remain in the report.');
        } catch (error) { clearExportDownloads(); showMessage('Export failed. ' + (error.message || 'Check browser memory and image access.'), true); }
        finally {
            logos.forEach(function (obj,i) { obj.visible = logoStates[i]; });
            guides.forEach(function (obj,i) { obj.visible = hidden[i]; });
            state.canvas.renderAll(); buttonBusy(button, false); updateCanvasControls();
        }
    }
    function bindLogoControls() {
        function selectedLogo() {
            var obj = state.canvas && state.canvas.getActiveObject();
            if (!obj || obj.sbsType !== 'exact_asset') { showMessage('Select an Exact logo reference on the canvas first.', true); return null; }
            return obj;
        }
        function apply(fn) { var obj = selectedLogo(); if (!obj) { return; } fn(obj); obj.setCoords(); state.canvas.requestRenderAll(); captureCanvas(); }
        el('sbs-logo-center').addEventListener('click',function () { apply(function (obj) { obj.set({left:state.canvas.width/2,originX:'center'}); }); });
        el('sbs-logo-rotate-left').addEventListener('click',function () { apply(function (obj) { obj.rotate((obj.angle||0)-15); }); });
        el('sbs-logo-rotate-right').addEventListener('click',function () { apply(function (obj) { obj.rotate((obj.angle||0)+15); }); });
        el('sbs-logo-x').addEventListener('input',function () { var v=Number(this.value);apply(function(obj){obj.set({left:state.canvas.width*v/100,originX:'center'});}); });
        el('sbs-logo-y').addEventListener('input',function () { var v=Number(this.value);apply(function(obj){obj.set({top:state.canvas.height*v/100,originY:'center'});}); });
        el('sbs-logo-size').addEventListener('input',function () { var v=Number(this.value);apply(function(obj){obj.scaleToWidth(state.canvas.width*v/100);}); });
    }
    function resizeCanvasViewport() { if (state.canvas) { state.canvas.calcOffset(); state.canvas.requestRenderAll(); } }

    function activateTab(name) { if (name === 'freestyle') { document.querySelector('[data-primary-tab="freestyle"]').click(); return; } var primary = document.querySelector('.sbs-primary-tabs button[data-primary-tab="characters"]'); if (primary) { primary.click(); } var button = document.querySelector('.sbs-tabs button[data-tab="' + name + '"]'); if (button) { button.click(); } }
    function buttonBusy(button, busy) { if (!button) { return; } if (busy) { button.dataset.label = button.textContent; button.disabled = true; button.textContent = 'Working…'; } else { button.disabled = false; button.textContent = button.dataset.label || button.textContent; } }
    function handleError(error) { showMessage(error.message || String(error), true); }

    document.addEventListener('DOMContentLoaded', function () {
        bindLogin(); bindPrimaryTabs(); bindTabs(); bindCharacters(); bindCreate(); bindImageModal(); bindGuide();
        installStudioHelp(); installImageSpecifications();
        freestyle = window.SBSFreestyle.init({state:state,el:el,esc:esc,api:api,post:post,loadBootstrap:loadBootstrap,replaceProject:replaceProject,trackJobs:trackJobs,showMessage:showMessage,handleError:handleError,zoom:openImageModal,openProject:function(uuid,generationUuid){
            if(state.canvas && !state.canvasUuid && state.canvas.getObjects().some(function(o){return o.sbsType!=='guide';}) && (!state.activeProject || state.activeProject.uuid!==uuid) && !window.confirm('Open this project and clear the current unsaved canvas? Save that canvas first if you want to keep it.'))return;
            var project=state.projects.find(function(p){return p.uuid===uuid;});if(!project)return;
            selectPack(project.pack_uuid);resetCanvasProject();state.activeProject=project;state.selectedGeneration=project.generations.find(function(g){return g.uuid===generationUuid;});renderProjects();renderCanvasOptions();activateTab('projects');
        }});
        bindLogoControls();
        el('sbs-run-preflight').addEventListener('click',runPrintPreflight);
        el('sbs-visual-treatment').addEventListener('change',updatePrintReadout);
        el('sbs-print-method').addEventListener('change',function () {
            var dtf = this.value === 'dtf';
            el('sbs-method-advice').textContent = dtf ? 'DTF: inspect stray pixels, cutout edges, fine halftone dots and small isolated details; confirm minimum line and gap widths with your transfer printer.' : 'DTG: check gradients, transparency, garment colour and fine detail; confirm ink and underbase requirements with your garment printer.';
        });

        if (boot.authenticated) { loadBootstrap(); }
        if (root && root.getAttribute('data-open-settings') === '1') {
            document.querySelector('[data-primary-tab="settings"]').click();
        }
    });

    // Contextual help and image specifications. These enhancements never change the image files.
    function studioButtonExplanation(button) {
        var id = button.id || '', label = (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim();
        var details = {
            'sbs-upscale-2': 'AI upscale 2× uses Replicate to enlarge the selected image to approximately twice its width and height (four times as many pixels). It may improve apparent detail but does not guarantee print quality or preserve every detail.',
            'sbs-upscale-4': 'AI upscale 4× uses Replicate to enlarge the selected image to approximately four times its width and height (sixteen times as many pixels). It may introduce invented details; inspect the result carefully.',
            'sbs-polish': 'High-quality polish creates a new AI-edited version aimed at improving edges, linework and texture while asking the model to retain the composition. It is not just a resolution increase; details can change.',
            'sbs-refine': 'Refine selected creates a new image using the instruction entered above. Select a draft first and describe the specific change you want.',
            'sbs-canvas-export': 'Export PNG renders the assembled merchandise design as a PNG using the current print settings. Inspect the exported pixel dimensions and transparency before printing.',
            'sbs-canvas-save': 'Save design stores the editable merchandise composition so it can be reopened later.',
            'sbs-guide-open': 'Open the illustrated guide and workflow diagrams for character development, reference assets, image creation and merchandise.'
        };
        if (details[id]) { return details[id]; }
        var explicit = button.getAttribute('title');
        if (explicit) { return explicit; }
        var tool = button.getAttribute('data-tool');
        var toolHelp = {text:'Add an editable text layer.',rect:'Add a rectangle shape.',circle:'Add a circle shape.',upload:'Upload an image layer.',group:'Group selected layers.',ungroup:'Separate grouped layers.',duplicate:'Duplicate the selected layer.',undo:'Undo the previous canvas action.',redo:'Redo an undone canvas action.',front:'Bring the layer to the front.',back:'Send the layer to the back.',lock:'Lock or unlock the selected layer.',hide:'Show or hide the selected layer.',delete:'Remove the selected layer.', 'crop-square':'Crop the selected artwork to a square.', 'mask-circle':'Apply a circular mask.', 'mask-rect':'Apply a rectangular mask.', 'mask-clear':'Remove the mask.'};
        if (toolHelp[tool]) { return toolHelp[tool]; }
        if (/delete|remove|discard/i.test(label)) { return 'Remove the indicated item. Some removals cannot be undone; check any confirmation carefully.'; }
        if (/generate|create|suggest/i.test(label)) { return 'Start the indicated creation or suggestion process. AI generation may incur usage charges; review the output before accepting it.'; }
        if (/accept|approve/i.test(label)) { return 'Mark this candidate as the accepted reference or result for the current step.'; }
        if (/save|apply/i.test(label)) { return 'Save or apply the selected changes to the current item.'; }
        if (/upload|add/i.test(label)) { return 'Add the selected file or item to the current workspace.'; }
        if (/download|export/i.test(label)) { return 'Download or export the selected output using the available settings.'; }
        if (/select|open|view|zoom/i.test(label)) { return 'Select or open the indicated item for inspection or further work.'; }
        if (/cancel|close/i.test(label)) { return 'Close or cancel this operation without applying further changes.'; }
        return label ? 'Action: ' + label + '. This control operates on the current section or selected item.' : 'Open or activate this control.';
    }
    function installStudioHelp() {
        var dialog = document.createElement('dialog');
        dialog.className = 'sbs-explain-dialog';
        dialog.innerHTML = '<div class="sbs-explain-content"><h2 id="sbs-explain-heading">Button information</h2><p id="sbs-explain-text"></p><button type="button" class="sbs-button primary" id="sbs-explain-close">Close</button></div>';
        dialog.setAttribute('aria-labelledby','sbs-explain-heading');
        document.body.appendChild(dialog);
        dialog.querySelector('#sbs-explain-close').addEventListener('click', function () { dialog.close(); });
        dialog.addEventListener('click', function (event) { if (event.target === dialog) { dialog.close(); } });
        function decorate() {
            document.querySelectorAll('button:not(.sbs-info-button):not(.sbs-fs-thumbnail):not(.sbs-image-zoom):not(.sbs-modal-close):not(#sbs-explain-close)').forEach(function (button) {
                if (button.dataset.sbsInfoAttached || button.closest('.sbs-explain-dialog')) { return; }
                button.dataset.sbsInfoAttached = '1';
                var info = document.createElement('button');
                info.type = 'button'; info.className = 'sbs-info-button';
                info.textContent = 'i';
                var name = (button.getAttribute('aria-label') || button.textContent || 'button').trim().replace(/\s+/g,' ');
                info.setAttribute('aria-label', 'Information about ' + name);
                info.setAttribute('title', 'What does this button do?');
                info.addEventListener('click', function (event) {
                    event.preventDefault(); event.stopPropagation();
                    dialog.querySelector('#sbs-explain-heading').textContent = name || 'Button information';
                    dialog.querySelector('#sbs-explain-text').textContent = studioButtonExplanation(button);
                    if (dialog.showModal) { dialog.showModal(); } else { window.alert(studioButtonExplanation(button)); }
                });
                button.insertAdjacentElement('afterend', info);
            });
        }
        var scheduled = false;
        var observer = new MutationObserver(function () { if (!scheduled) { scheduled = true; window.requestAnimationFrame(function () { scheduled = false; decorate(); }); } });
        observer.observe(document.body, {childList:true,subtree:true});
        decorate();
    }
    function installImageSpecifications() {
        function inspect(img) {
            if (!img.naturalWidth || !img.naturalHeight || img.dataset.sbsSpecsDone) { return; }
            if (img.closest('.sbs-guide-dialog') || img.closest('.sbs-image-modal') || img.closest('.sbs-header')) { return; }
            if (!img.closest('.sbs-generation,.sbs-reference,.sbs-approval-card,.sbs-development-result,.sbs-development-concept,.sbs-job-result,.sbs-media-gallery,.sbs-creation-gallery')) { return; }
            img.dataset.sbsSpecsDone = '1';
            var w = img.naturalWidth, h = img.naturalHeight, dpi = 300;
            var ext = (img.currentSrc || img.src || '').split('?')[0].split('.').pop().toLowerCase();
            var format = /^(png|webp|jpe?g|gif)$/.test(ext) ? ext.toUpperCase() : 'Unknown';
            var alpha = 'Not verified';
            if (/^jpe?g$/.test(ext)) { alpha = 'Opaque (JPEG)'; }
            else {
                try {
                    var c = document.createElement('canvas'); c.width = Math.min(w,96); c.height = Math.min(h,96);
                    var ctx = c.getContext('2d', {willReadFrequently:true});
                    ctx.drawImage(img,0,0,c.width,c.height);
                    var pixels = ctx.getImageData(0,0,c.width,c.height).data, transparent = false, partial = false;
                    for (var i=3;i<pixels.length;i+=4) { if (pixels[i]===0) { transparent=true; } else if (pixels[i]<255) { partial=true; } }
                    alpha = transparent && partial ? 'Transparent + semi-transparent pixels' : transparent ? 'Transparent pixels detected' : partial ? 'Semi-transparent pixels detected' : 'Opaque in sampled pixels';
                } catch (error) { alpha = 'Transparency not verifiable in browser'; }
            }
            var text = w+' × '+h+' px · Print at 300 PPI: '+(w/dpi).toFixed(2)+' × '+(h/dpi).toFixed(2)+' in ('+(w/dpi*2.54).toFixed(1)+' × '+(h/dpi*2.54).toFixed(1)+' cm) · PPI: 300 assumed for print · DPI: not verified (printer setting) · '+format+' · '+alpha;
            var line = document.createElement('p'); line.className='sbs-image-specs'; line.textContent=text;
            line.setAttribute('aria-label','Image technical information: '+text);
            var host = img.closest('.sbs-image-zoom') || img;
            host.insertAdjacentElement('afterend',line);
        }
        function scan() { document.querySelectorAll('img').forEach(function (img) { if (img.complete) { inspect(img); } }); }
        document.addEventListener('load',function (event) { if (event.target && event.target.tagName==='IMG') { inspect(event.target); } },true);
        var pending=false;
        new MutationObserver(function () { if (!pending) { pending=true; window.requestAnimationFrame(function () {pending=false;scan();}); } }).observe(document.body,{childList:true,subtree:true});
        scan();
    }
})();
