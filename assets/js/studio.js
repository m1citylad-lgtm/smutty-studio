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
        var menu = el('sbs-character-page-menu');
        var trigger = el('sbs-character-page-trigger');
        function closeMenu(returnFocus) {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            if (returnFocus) { trigger.focus(); }
        }
        trigger.addEventListener('click', function () {
            var opening = menu.hidden;
            menu.hidden = !opening;
            trigger.setAttribute('aria-expanded', opening ? 'true' : 'false');
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !menu.hidden) { closeMenu(true); }
        });
        document.querySelectorAll('.sbs-tabs button').forEach(function (button) {
            button.addEventListener('click', function () {
                document.querySelectorAll('.sbs-tabs button').forEach(function (item) { item.classList.toggle('active', item === button); });
                document.querySelectorAll('.sbs-tabs button').forEach(function (item) { item.removeAttribute('aria-current'); });
                button.setAttribute('aria-current', 'page');
                document.querySelectorAll('.sbs-panel').forEach(function (panel) { panel.classList.toggle('active', panel.getAttribute('data-panel') === button.getAttribute('data-tab')); });
                el('sbs-character-page-current').textContent = button.textContent.replace(/^\s*\d+\.\s*/, '').trim();
                closeMenu(false);
                if (button.getAttribute('data-tab') === 'development') { renderDevelopment(); }
                if (button.getAttribute('data-tab') === 'library') { renderCharacterLibrary(); }
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
            renderPackOptions(); renderPacks(); renderPackEditor(); renderDevelopment(); renderProjects(); renderUsage(state.usage); renderCanvasOptions(); renderCharacterContext(); renderCharacterLibrary();
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

    function renderCharacterLibrary() {
        var list = el('sbs-character-library-list'), filter = el('sbs-character-library-filter');
        if (!list || !filter) { return; }
        var characters = state.packs.filter(function (pack) { return pack.uuid !== state.freestylePackUuid; });
        if (filter.value !== 'all') { characters = characters.filter(function (pack) { return pack.library_status === filter.value; }); }
        if (!characters.length) { list.innerHTML = '<p class="sbs-muted">No characters in this group.</p>'; return; }
        var statusLabels = {needs_review:'Needs review',in_development:'In development',active:'Active',archived:'Archived'};
        list.innerHTML = characters.map(function (pack) {
            var preferredRoles = ['face','full_body','imported_reference','master_reference','reference','generated_reference','expression','outfit','palette','style'];
            var image = preferredRoles.map(function (role) { return (pack.assets || []).find(function (asset) { return asset.role === role && /^image\/(png|jpeg|webp)$/.test(asset.mime || ''); }); }).find(Boolean) || (pack.assets || []).find(function (asset) { return /^image\/(png|jpeg|webp)$/.test(asset.mime || ''); });
            var selected = state.selectedPack && state.selectedPack.uuid === pack.uuid;
            var count = Number(pack.project_count || 0), usageCount = Number(pack.usage_count || 0);
            return '<article class="sbs-character-library-card" data-library-uuid="'+esc(pack.uuid)+'"><div class="sbs-character-library-image">'+(image?'<img src="'+esc(image.url)+'" alt="Reference image for '+esc(pack.name)+'">':'<span>No reference image</span>')+'</div><div class="sbs-character-library-fields"><p class="sbs-kicker">'+esc(statusLabels[pack.library_status]||'Needs review')+(selected?' · Current character':'')+'</p><label>Character name<input type="text" data-library-name value="'+esc(pack.name)+'" maxlength="190"></label><label>Status<select data-library-status><option value="needs_review"'+(pack.library_status==='needs_review'?' selected':'')+'>Needs review</option><option value="in_development"'+(pack.library_status==='in_development'?' selected':'')+'>In development</option><option value="active"'+(pack.library_status==='active'?' selected':'')+'>Active</option><option value="archived"'+(pack.library_status==='archived'?' selected':'')+'>Archived</option></select></label><p class="sbs-muted">'+(count?esc(count)+' saved work set(s) use this character. ':'')+(usageCount?esc(usageCount)+' usage record(s). ':'')+((count||usageCount)?'Archive to keep this history.':'No saved work history.')+'</p><div class="sbs-row wrap"><button type="button" class="sbs-button" data-library-action="save">Save changes</button><button type="button" class="sbs-button" data-library-action="view">Open character</button><button type="button" class="sbs-button danger" data-library-action="delete"'+((count||usageCount)?' disabled title="Archive instead to preserve saved work"':'')+'>Delete character</button></div></div></article>';
        }).join('');
    }

    function bindCharacterLibrary() {
        var filter = el('sbs-character-library-filter'), list = el('sbs-character-library-list');
        if (!filter || !list) { return; }
        filter.addEventListener('change', renderCharacterLibrary);
        list.addEventListener('click', function (event) {
            var button = event.target.closest('[data-library-action]');
            if (!button) { return; }
            var card = button.closest('[data-library-uuid]'), uuid = card && card.getAttribute('data-library-uuid');
            var pack = state.packs.find(function (item) { return item.uuid === uuid; });
            if (!pack) { return; }
            var action = button.getAttribute('data-library-action');
            if (action === 'view') { selectPack(uuid); activateTab('characters'); return; }
            if (action === 'save') {
                var name = card.querySelector('[data-library-name]').value.trim(), status = card.querySelector('[data-library-status]').value;
                if (!name) { showMessage('Enter a character name.', true); return; }
                buttonBusy(button, true);
                patch('packs/' + uuid, {name:name,description:pack.description||'',library_status:status}).then(function () { return loadBootstrap(); }).then(function () { showMessage('Character details and status saved.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
                return;
            }
            if (action === 'delete') {
                if (Number(pack.project_count || 0) || Number(pack.usage_count || 0)) { showMessage('This character has saved work or usage history. Archive it to keep that history safe.', true); return; }
                if (!window.confirm('Permanently delete '+pack.name+' and its stored Character reference images? Freestyle projects and their originals are not changed.')) { return; }
                buttonBusy(button, true);
                remove('packs/' + uuid).then(function () { return loadBootstrap(); }).then(function () { showMessage('Character and its Character reference images deleted.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
            }
        });
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
            (referenceSections || '<p class="sbs-muted">Upload a master sheet or individual references.</p>') + '<section class="sbs-workflow-part"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">3.3</span> Optional description suggestions</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Request suggestions only if needed; review and choose what to apply.</p><div class="sbs-row wrap sbs-character-actions"><button id="sbs-analyse-pack" class="sbs-button primary" title="Create reviewable suggestions without changing the saved description">Suggest description from references</button></div>' + analysisSuggestionMarkup(pack) + '</section>';
        el('sbs-pack-properties').addEventListener('submit', savePackProperties);
        var upload = el('sbs-pack-upload');
        if (upload) { upload.addEventListener('submit', uploadPackAsset); }
        bindCreationActions(referenceBox);
        referenceBox.querySelectorAll('[data-delete-reference]').forEach(function (button) { button.addEventListener('click', function () { deletePackReference(button.getAttribute('data-delete-reference')); }); });
        var suggestionForm = el('sbs-analysis-suggestion-form');
        if (suggestionForm) {
            var applySelected = el('sbs-apply-selected-suggestion');
            suggestionForm.querySelectorAll('input[name="suggested_field"]').forEach(function (checkbox) { checkbox.addEventListener('change', function () { applySelected.disabled = !suggestionForm.querySelector('input[name="suggested_field"]:checked'); }); });
            applySelected.addEventListener('click', function () { applyAnalysisSuggestion(Array.prototype.map.call(suggestionForm.querySelectorAll('input[name="suggested_field"]:checked'), function (checkbox) { return checkbox.value; }), applySelected); });
            el('sbs-apply-all-suggestion').addEventListener('click', function () { applyAnalysisSuggestion(Array.prototype.map.call(suggestionForm.querySelectorAll('input[name="suggested_field"]'), function (checkbox) { return checkbox.value; }), this); });
            el('sbs-discard-suggestion').addEventListener('click', function () { state.analysisSuggestion = null; renderPackEditor(); });
        }
        if (el('sbs-analyse-pack')) { el('sbs-analyse-pack').addEventListener('click', function () { var button = this; buttonBusy(button, true); post('packs/' + pack.uuid + '/analyse').then(function (data) { state.analysisSuggestion = { packUuid: pack.uuid, proposal: data.suggestion || {} }; renderPackEditor(); showMessage('Suggestions are ready to review. Nothing has been changed.'); }).catch(handleError).finally(function () { buttonBusy(el('sbs-analyse-pack'), false); }); }); }
    }
    function replacePack(pack) { var index = state.packs.findIndex(function (item) { return item.uuid === pack.uuid; }); if (index >= 0) { state.packs[index] = pack; } else { state.packs.unshift(pack); } selectPack(pack.uuid); return pack; }
    function lines(value, splitCommas) { return String(value || '').split(splitCommas ? /[\r\n,]+/ : /[\r\n]+/).map(function (item) { return item.trim(); }).filter(Boolean); }
    function savePackProperties(event) {
        event.preventDefault(); var form = event.currentTarget, button = form.querySelector('button[type="submit"]'); buttonBusy(button, true);
        patch('packs/' + state.selectedPack.uuid, { name: form.name.value, description: form.description.value, identity: { summary: form.summary.value, locked_traits: lines(form.locked_traits.value, false), exclusions: lines(form.exclusions.value, false), humour_boundary: form.humour_boundary.value, palette: lines(form.palette.value, true) } }).then(function (pack) { state.analysisSuggestion = null; replacePack(pack); showMessage('Character properties saved.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }
    function uploadPackAsset(event) {
        event.preventDefault(); var form = event.currentTarget, data = new FormData(form); buttonBusy(form.querySelector('button'), true);
        api('packs/' + state.selectedPack.uuid + '/assets', { method: 'POST', body: data }).then(function (pack) { state.analysisSuggestion = null; return replacePack(pack); }).then(function () { showMessage('Reference material updated.'); }).catch(handleError).finally(function () { buttonBusy(form.querySelector('button'), false); });
    }
    function deletePackReference(uuid) {
        if (!window.confirm('Remove this reference from the current character version?')) { return; }
        remove('packs/' + state.selectedPack.uuid + '/assets/' + uuid).then(function (pack) { state.analysisSuggestion = null; return replacePack(pack); }).then(function () { showMessage('Reference removed.'); }).catch(handleError);
    }

    var developmentRoles = [
        { role: 'face', purpose: 'development_reference_face', title: 'Face and facial proportions', icon: '&#128578;', description: 'Front and three-quarter portraits preserving the defining face, muzzle, eyes, brows and ears.' },
        { role: 'full_body', purpose: 'development_reference_full_body', title: 'Full-body turnaround', icon: '&#128100;', description: 'Front, three-quarter, side and rear views with consistent anatomy, silhouette, tail and clothing fit.' },
        { role: 'expression', purpose: 'development_reference_expression', title: 'Expression sheet', icon: '&#128516;', description: 'A controlled set of recurring expressions without changing the underlying face.' },
        { role: 'outfit', purpose: 'development_reference_outfit', title: 'Outfit details', icon: '&#128085;', description: 'Signature clothing from front and rear with construction and fit details.' },
        { role: 'style', purpose: 'development_reference_style', title: 'Palette and illustration style', icon: '&#127912;', description: 'Approved colours, line work, shading, texture and material treatment.' }
    ];
    function developmentProjects() { return state.selectedPack ? state.projects.filter(function (project) { return project.pack_uuid === state.selectedPack.uuid && project.concept && project.concept.type === 'character_visual_development'; }) : []; }
    function approvalProjects() { return state.selectedPack ? state.projects.filter(function (project) { return project.pack_uuid === state.selectedPack.uuid && project.concept && project.concept.type === 'character_pack_test'; }) : []; }
    function activeDevelopmentProject() {
        var projects = developmentProjects();
        var project = projects.find(function (item) { return item.uuid === state.developmentProjectUuid; }) || projects[0] || null;
        state.developmentProjectUuid = project ? project.uuid : '';
        return project;
    }
    function replaceProject(project) {
        var index = state.projects.findIndex(function (item) { return item.uuid === project.uuid; });
        if (index >= 0) { state.projects[index] = project; } else { state.projects.unshift(project); }
        return project;
    }
    function isDevelopmentPurpose(purpose) { return /^development_/.test(String(purpose || '')) || purpose === 'character_approval'; }
    function developmentPurpose(job) { return job && job.payload ? job.payload.purpose || '' : ''; }
    function acceptedDevelopmentAsset(role, generationUuid) {
        return state.selectedPack && (state.selectedPack.assets || []).find(function (asset) {
            return asset.role === role && asset.metadata && asset.metadata.origin === 'visual_development' && (!generationUuid || asset.metadata.source_generation_uuid === generationUuid);
        });
    }
    function acceptedApprovalAsset(generationUuid) {
        return state.selectedPack && (state.selectedPack.assets || []).find(function (asset) {
            var metadata = asset.metadata || {};
            return asset.role === 'generated_reference' && metadata.source_generation_uuid === generationUuid && (metadata.origin === 'character_approval' || asset.label === 'Approved generated character model sheet');
        });
    }
    function hasVisualIdentityReference() {
        return !!(state.selectedPack && (state.selectedPack.assets || []).some(function (asset) { return ['master_reference', 'face', 'full_body'].indexOf(asset.role) >= 0; }));
    }
    function developmentJobRows(project) {
        var jobs = {};
        (project && project.jobs || []).forEach(function (job) { jobs[job.uuid] = job; });
        Object.keys(state.developmentJobs).forEach(function (uuid) {
            var job = state.developmentJobs[uuid];
            if (project && job.payload && Number(job.payload.project_id) === Number(project.id)) { jobs[uuid] = job; }
        });
        return Object.keys(jobs).map(function (uuid) { return jobs[uuid]; });
    }
    function approvalJobRows() {
        var jobs = {};
        approvalProjects().forEach(function (project) {
            (project.jobs || []).forEach(function (job) { if (developmentPurpose(job) === 'character_approval') { jobs[job.uuid] = job; } });
        });
        Object.keys(state.developmentJobs).forEach(function (uuid) {
            var job = state.developmentJobs[uuid];
            if (developmentPurpose(job) === 'character_approval' && (!job.pack_uuid || !state.selectedPack || job.pack_uuid === state.selectedPack.uuid)) { jobs[uuid] = job; }
        });
        return Object.keys(jobs).map(function (uuid) { return jobs[uuid]; });
    }
    function utcTimestamp(value) { return value ? Date.parse(String(value).replace(' ', 'T') + 'Z') || 0 : 0; }
    function approvalSectionMarkup(identity, visualReady) {
        var entries = [];
        approvalProjects().forEach(function (project) {
            (project.generations || []).filter(function (generation) { return generation.purpose === 'character_approval' && generation.asset_url; }).forEach(function (generation) {
                entries.push({ project: project, generation: generation });
            });
        });
        entries.sort(function (left, right) { return utcTimestamp(right.generation.created_at) - utcTimestamp(left.generation.created_at); });
        var groundingUpdatedAt = identity.grounding_updated_at || identity.approval_invalidated_at || '';
        var allApprovalJobs = approvalJobRows();
        var approvalBusy = allApprovalJobs.some(function (job) { return ['completed', 'failed', 'blocked', 'cancelled'].indexOf(job.status) < 0; });
        var cards = entries.map(function (entry, index) {
            var generation = entry.generation;
            var stale = !!(groundingUpdatedAt && utcTimestamp(generation.created_at) < utcTimestamp(groundingUpdatedAt));
            var acceptedAsset = acceptedApprovalAsset(generation.uuid);
            var current = !!(identity.tests_approved && identity.approved_test_generation_uuid === generation.uuid && acceptedAsset);
            var status = current ? '&#10003; Accepted approval sheet' : stale ? 'Needs regeneration' : 'Ready for review';
            var note = current ? 'This is the single current approval checkpoint.' : stale ? 'The Description or References changed after this sheet was made.' : 'Inspect every view, then accept this sheet if the identity is consistent.';
            return '<article class="sbs-approval-card ' + (current ? 'accepted' : '') + '"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(generation.asset_url) + '" data-zoom-caption="Character approval sheet ' + (entries.length - index) + '"><img src="' + esc(generation.asset_url) + '" alt="Character approval sheet"></button><div class="sbs-approval-card-body"><strong>' + status + '</strong><p>' + note + '</p><div class="sbs-creation-actions"><button type="button" class="sbs-button accent" data-accept-approval="' + esc(generation.uuid) + '" ' + (current || stale || approvalBusy ? 'disabled' : '') + '>' + (current ? '&#10003; Accepted' : 'Accept this sheet') + '</button><button type="button" class="sbs-remove-creation" data-delete-approval-project="' + esc(entry.project.uuid) + '" data-approval-generation="' + esc(generation.uuid) + '" data-accepted-asset="' + esc(acceptedAsset ? acceptedAsset.uuid : '') + '" data-approval-current="' + (current ? '1' : '0') + '" title="Delete this approval sheet"><span aria-hidden="true">&#128465;</span> Delete</button></div>' + imageCorrectionMarkup(generation, 'Approval sheet ' + (entries.length - index), allApprovalJobs) + '</div></article>';
        }).join('');
        var gallery = cards ? '<div class="sbs-approval-gallery">' + cards + '</div>' : '<p class="sbs-muted">No approval sheets have been generated for this character version yet.</p>';
        return '<section class="sbs-development-section sbs-approval-section"><div class="sbs-inline-heading"><div><h2 class="sbs-stage-heading"><span class="sbs-stage-number">2.3</span> Approve the character</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Inspect all views in a consistency sheet; accept it only when the identity is correct.</p></div></div><p class="sbs-context-note">Generate and retain multiple review candidates. Accept one as the current checkpoint; accepting another replaces only the approved-sheet reference, not the candidate history or uploaded references.</p><div class="sbs-approval-content">' + gallery + '<div class="sbs-section-actions"><button id="sbs-generate-approval" class="sbs-button primary" ' + (visualReady && !approvalBusy ? '' : 'disabled title="' + (approvalBusy ? 'An approval sheet is already being generated' : 'Accept or upload a Master, Face or Full-body reference first') + '"') + '>' + (approvalBusy ? 'Generating approval sheet…' : entries.length ? 'Generate another sheet' : 'Generate approval sheet') + '</button></div>' + developmentProgressMarkup(allApprovalJobs.filter(function (job) { return !job.payload.parent_id; }), 'Approval sheet', 'approval') + '</div></section>';
    }
    // Drafts belong to a particular character version and source image.
    var developmentDrafts = {}, developmentSubmitting = {}, developmentRenderPending = false;
    function correctionKey(generationUuid) {
        return 'sbs-image-correction:' + state.selectedPack.uuid + ':v' + state.selectedPack.current_version + ':' + generationUuid;
    }
    function correctionDraft(key) {
        if (Object.prototype.hasOwnProperty.call(developmentDrafts, key)) { return developmentDrafts[key]; }
        try { return window.localStorage.getItem(key) || ''; } catch (error) { return ''; }
    }
    function saveCorrectionDraft(key, value) {
        developmentDrafts[key] = value;
        try { if (value) { window.localStorage.setItem(key, value); } else { window.localStorage.removeItem(key); } } catch (error) { /* Keep the in-session draft if storage is unavailable. */ }
    }
    function developmentScope(scope) { return state.selectedPack.uuid + ':v' + state.selectedPack.current_version + ':' + state.developmentProjectUuid + ':' + scope; }
    function isDevelopmentSubmitting(scope) { return !!developmentSubmitting[developmentScope(scope)]; }
    function developmentJobActive(job) { return ['completed', 'failed', 'blocked', 'cancelled'].indexOf(job.status) < 0; }
    function imageCorrectionJobs(jobs, generation) {
        return jobs.filter(function (job) { return job.payload && Number(job.payload.parent_id) === Number(generation.id) && developmentPurpose(job) === (generation.purpose === 'development_concept' ? 'development_concept_refinement' : generation.purpose); });
    }
    function developmentProgressMarkup(jobs, label, scope) {
        var ordered = jobs.slice().sort(function (a,b) { return Number(a.id) - Number(b.id); });
        var active = ordered.filter(developmentJobActive);
        var rows = active.length ? active : ordered.slice(-1);
        var submitting = isDevelopmentSubmitting(scope) ? '<p role="status">Submitting ' + esc(label) + '…</p><progress max="100" aria-label="Submitting ' + esc(label) + '"></progress>' : '';
        return '<div class="sbs-section-progress" aria-label="' + esc(label) + ' generation status" aria-live="polite">' + submitting + rows.map(function (job) {
            var active = developmentJobActive(job), completed = job.status === 'completed';
            var status = completed ? 'Completed — 100%' : job.status === 'running' ? 'Generating — percentage not supplied by provider' : job.status === 'submitted' || job.status === 'queued' ? 'Queued — waiting for provider' : job.status;
            return '<div class="sbs-local-job" data-development-job="' + esc(job.uuid) + '"><p role="status">' + esc(status) + '</p>' + (active || completed ? '<progress max="100"' + (completed ? ' value="100"' : '') + ' aria-label="' + esc(label + ': ' + status) + '"></progress>' : '') + (job.poll_error ? '<p>Connection interrupted; retrying status check. ' + esc(job.poll_error) + '</p>' : '') + (job.error && job.error.message ? '<p>' + esc(job.error.message) + '</p>' : '') + (active ? '<button type="button" class="sbs-button" data-cancel-job="' + esc(job.uuid) + '">Cancel generation</button>' : '') + '</div>';
        }).join('') + (!rows.length && !submitting ? '<p role="status">No generation running for this image.</p>' : '') + '</div>';
    }
    function imageCorrectionMarkup(generation, label, jobs) {
        var key = correctionKey(generation.uuid), id = 'sbs-correction-' + generation.uuid;
        var active = isDevelopmentSubmitting(generation.uuid) || imageCorrectionJobs(jobs, generation).some(developmentJobActive);
        return developmentProgressMarkup(imageCorrectionJobs(jobs, generation), label, generation.uuid) + '<div class="sbs-image-corrections"><label for="' + esc(id) + '">Image Correction Instructions<span class="sbs-correction-context">' + esc(label) + '</span></label><textarea id="' + esc(id) + '" data-correction-key="' + esc(key) + '" rows="4" maxlength="12000" spellcheck="true" autocapitalize="sentences" aria-describedby="' + esc(id) + '-hint" placeholder="Describe only what should change. Say which details must stay the same.">' + esc(correctionDraft(key)) + '</textarea><p id="' + esc(id) + '-hint" class="sbs-muted">Applies only to this image. The original and accepted references remain until you explicitly choose a new result. Instructions are kept in this browser until cleared.</p><div class="sbs-correction-actions"><button type="button" class="sbs-button primary" data-correct-development="' + esc(generation.uuid) + '"' + (active ? ' disabled' : '') + '>Regenerate with Corrections</button><button type="button" class="sbs-button" data-clear-correction="' + esc(id) + '">Clear instructions</button></div></div>';
    }
    function submitDevelopment(scope, path, payload, onSuccess) {
        var scopeKey = developmentScope(scope);
        if (developmentSubmitting[scopeKey]) { return Promise.resolve(); }
        developmentSubmitting[scopeKey] = true; renderDevelopment();
        return post(path, payload).then(function (data) { if (onSuccess) { onSuccess(data); } trackJobs(data.jobs || []); }).catch(handleError).finally(function () { delete developmentSubmitting[scopeKey]; renderDevelopment(); });
    }
    function correctDevelopmentImage(generationUuid) {
        var input = el('sbs-correction-' + generationUuid), instruction = input ? input.value.trim() : '';
        if (instruction.length < 3) { showMessage('Enter Image Correction Instructions for this image first.', true); if (input) { input.focus(); } return Promise.resolve(); }
        saveCorrectionDraft(input.getAttribute('data-correction-key'), input.value);
        return submitDevelopment(generationUuid, 'generations/' + generationUuid + '/development/correct', { instruction: instruction }, function () { showMessage('Correction started for this image. The original remains available.'); });
    }
    function renderDevelopment() {
        var box = el('sbs-development-root'), focus = document.activeElement;
        var saved = box && focus && box.contains(focus) && focus.matches('textarea[data-correction-key]') ? {id:focus.id, start:focus.selectionStart, end:focus.selectionEnd, scroll:focus.scrollTop} : null;
        if (saved) {
            developmentRenderPending = true;
            box.querySelectorAll('[data-development-job]').forEach(function (node) {
                var uuid = node.getAttribute('data-development-job');
                var job = state.developmentJobs[uuid];
                if (!job) { return; }
                var holder = document.createElement('div');
                holder.innerHTML = developmentProgressMarkup([job], 'This image', 'status-only');
                var update = holder.querySelector('[data-development-job]');
                if (update) { node.innerHTML = update.innerHTML; }
                node.querySelectorAll('[data-cancel-job]').forEach(function (button) { button.addEventListener('click', function () { api('jobs/' + uuid, { method:'DELETE' }).then(function (updated) { state.developmentJobs[uuid]=updated; renderDevelopment(); }).catch(handleError); }); });
            });
            return;
        }
        developmentRenderPending = false;
        renderDevelopmentContents();
    }
    function renderDevelopmentContents() {
        var box = el('sbs-development-root');
        if (!box) { return; }
        var pack = state.selectedPack;
        if (!pack) { box.innerHTML = '<p class="sbs-muted">Choose a character above or create a new character.</p>'; return; }
        var projects = developmentProjects(), project = activeDevelopmentProject(), identity = pack.identity || {};
        var briefReady = String(pack.description || '').trim().length >= 10 || !!String(identity.summary || '').trim() || !!(identity.locked_traits || []).length;
        var seedUuid = project && project.concept ? project.concept.selected_seed_uuid || '' : '';
        var seed = project ? (project.generations || []).find(function (generation) { return generation.uuid === seedUuid; }) : null;
        var approvedGenerationExists = approvalProjects().some(function (approvalProject) { return (approvalProject.generations || []).some(function (generation) { return generation.uuid === identity.approved_test_generation_uuid; }); });
        var visualReady = hasVisualIdentityReference(), approvalReady = !!(identity.tests_approved && identity.approved_test_generation_uuid && approvedGenerationExists && acceptedApprovalAsset(identity.approved_test_generation_uuid));
        var progress = [
            { number: '1', label: 'Brief ready', done: briefReady },
            { number: '2.1', label: 'Visual seed chosen', done: !!seed },
            { number: '2.2', label: 'References accepted', done: visualReady },
            { number: '2.3', label: 'Approval sheet accepted', done: approvalReady }
        ].map(function (step, index) { return '<li class="' + (step.done ? 'done' : '') + '"><span>' + esc(step.number) + '</span>' + esc(step.label) + '</li>'; }).join('');
        var sessionOptions = projects.map(function (item, index) { return '<option value="' + esc(item.uuid) + '" ' + (project && item.uuid === project.uuid ? 'selected' : '') + '>' + esc(item.title) + ' · run ' + (projects.length - index) + '</option>'; }).join('');
        var toolbar = '<div class="sbs-development-toolbar"><div><p class="sbs-kicker">CHARACTER-BUILDING PROGRESS</p><ol class="sbs-development-progress">' + progress + '</ol></div><div class="sbs-development-session">' + (projects.length ? '<label>Development history<select id="sbs-development-session">' + sessionOptions + '</select></label>' : '') + '</div></div>';
        var startButton = '<button id="sbs-start-development" class="sbs-button primary" ' + (briefReady ? '' : 'disabled title="Complete the Description first"') + '>' + (projects.length ? 'Start new concept round' : 'Generate four concepts') + '</button>';
        if (!project) {
            box.innerHTML = toolbar + '<article class="sbs-card sbs-development-empty"><span aria-hidden="true">&#127912;</span><h2 class="sbs-stage-heading"><span class="sbs-stage-number">2.1</span> Generate and choose a look</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Generate concepts from the saved brief, then select and accept a visual seed.</p><p>Save a useful Description, then generate four deliberately separate concept directions. Nothing becomes an official reference until you select, review and accept it.</p><div class="sbs-section-actions">' + startButton + '</div>' + developmentProgressMarkup([], 'Concepts', 'concepts') + '</article><section class="sbs-development-section"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">2.2</span> Build the reference set</h2><p class="sbs-stage-decision"><strong>Decision:</strong> After choosing a visual seed, generate and accept the reference views that define the character.</p><p class="sbs-muted">Reference generation controls appear here after the first concept round. Existing authorised references can also be uploaded in 3. Reference.</p></section>' + approvalSectionMarkup(identity, visualReady);
            bindDevelopmentActions(null);
            return;
        }
        var conceptGenerations = (project.generations || []).filter(function (generation) { return generation.purpose === 'development_concept' || generation.purpose === 'development_concept_refinement'; });
        var conceptCards = conceptGenerations.map(function (generation) {
            var selected = generation.uuid === seedUuid, acceptedMaster = acceptedDevelopmentAsset('master_reference', generation.uuid);
            return '<article class="sbs-development-concept ' + (selected ? 'selected' : '') + '"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(generation.asset_url) + '" data-zoom-caption="Visual development concept"><img src="' + esc(generation.asset_url) + '" alt="Character concept"></button><footer><span>' + (generation.purpose === 'development_concept_refinement' ? 'Refined concept' : 'Initial concept') + '</span><div class="sbs-creation-actions"><button type="button" class="sbs-select-creation sbs-select-seed ' + (selected ? 'is-selected' : '') + '" data-select-seed="' + esc(generation.uuid) + '" ' + (selected ? 'disabled' : '') + '>' + (selected ? '&#10003; Visual seed' : 'Select visual seed') + '</button><button type="button" class="sbs-remove-creation" data-delete-generation="' + esc(generation.uuid) + '" ' + (acceptedMaster ? 'disabled title="Remove the accepted Master reference first"' : '') + '><span aria-hidden="true">&#128465;</span> Remove</button>' + (selected ? '<button id="sbs-accept-master" class="sbs-button accent"' + (acceptedMaster ? ' disabled' : '') + '>' + (acceptedMaster ? 'Accepted Master reference' : 'Accept seed as Master reference') + '</button>' : '') + '</div>' + imageCorrectionMarkup(generation, 'Concept candidate', developmentJobRows(project)) + '</footer></article>';
        }).join('');
        var conceptSection = '<section class="sbs-development-section"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">2.1</span> Choose the look</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Select a visual seed, correct if needed, then explicitly accept the Master reference.</p><div class="sbs-development-concepts">' + (conceptCards || '<p class="sbs-muted">Concepts will appear here.</p>') + '</div><div class="sbs-section-actions">' + startButton + '</div>' + developmentProgressMarkup(developmentJobRows(project).filter(function (job) { return developmentPurpose(job) === 'development_concept' && !job.payload.parent_id; }), 'Concepts', 'concepts') + '</section>';
        var slotSections = developmentRoles.map(function (slot) {
            var results = (project.generations || []).filter(function (generation) { return generation.purpose === slot.purpose; });
            var resultCards = results.map(function (generation) {
                var accepted = acceptedDevelopmentAsset(slot.role, generation.uuid);
                return '<article class="sbs-development-result ' + (accepted ? 'accepted' : '') + '"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(generation.asset_url) + '" data-zoom-caption="' + esc(slot.title) + '"><img src="' + esc(generation.asset_url) + '" alt="' + esc(slot.title) + '"></button><div><button type="button" class="sbs-button sbs-accept-development" data-accept-development="' + esc(generation.uuid) + '" data-reference-role="' + esc(slot.role) + '" ' + (accepted ? 'disabled' : '') + '>' + (accepted ? '&#10003; Accepted' : 'Accept this result') + '</button><button type="button" class="sbs-remove-creation" data-delete-generation="' + esc(generation.uuid) + '" ' + (accepted ? 'disabled title="Remove the accepted Reference asset first"' : 'title="Remove this development result"') + '><span aria-hidden="true">&#128465;</span></button></div>' + imageCorrectionMarkup(generation, slot.title, developmentJobRows(project)) + '</article>';
            }).join('');
            return '<article class="sbs-development-slot"><header><span class="sbs-development-slot-icon" aria-hidden="true">' + slot.icon + '</span><div><h3>' + esc(slot.title) + '</h3><p>' + esc(slot.description) + '</p></div></header><div class="sbs-development-results">' + (resultCards || '<p class="sbs-muted">No result generated yet.</p>') + '</div><div class="sbs-section-actions"><button type="button" class="sbs-button" data-generate-development-role="' + esc(slot.role) + '" ' + (seed ? '' : 'disabled') + '>' + (results.length ? 'Regenerate' : 'Generate') + '</button></div>' + developmentProgressMarkup(developmentJobRows(project).filter(function (job) { return developmentPurpose(job) === slot.purpose && Number(job.payload.parent_id) === Number(seed && seed.id); }), slot.title, slot.role) + '</article>';
        }).join('');
        var missingRoles = developmentRoles.filter(function (slot) { return !(project.generations || []).some(function (generation) { return generation.purpose === slot.purpose; }); }).map(function (slot) { return slot.role; });
        var referencesSection = '<section class="sbs-development-section"><div class="sbs-inline-heading"><div><h2 class="sbs-stage-heading"><span class="sbs-stage-number">2.2</span> Build the reference set</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Generate missing views, inspect each result and accept the suitable references.</p></div></div><div class="sbs-development-slots">' + slotSections + '</div><div class="sbs-section-actions"><button id="sbs-generate-missing-references" class="sbs-button primary" data-missing-roles="' + esc(missingRoles.join(',')) + '" ' + (seed && missingRoles.length ? '' : 'disabled') + '>Generate all missing</button></div>' + developmentProgressMarkup([], 'Reference set submission', 'references') + '</section>';
        var approvalSection = approvalSectionMarkup(identity, visualReady);
        box.innerHTML = toolbar + conceptSection + referencesSection + approvalSection;
        bindDevelopmentActions(project);
    }
    function bindDevelopmentActions(project) {
        var box = el('sbs-development-root');
        if (!box) { return; }
        if (el('sbs-development-session')) { el('sbs-development-session').addEventListener('change', function () { state.developmentProjectUuid = this.value; renderDevelopment(); }); }
        if (el('sbs-start-development')) { el('sbs-start-development').addEventListener('click', startDevelopment); }
        box.querySelectorAll('[data-select-seed]').forEach(function (button) { button.addEventListener('click', function () { selectDevelopmentSeed(project, button.getAttribute('data-select-seed'), button); }); });
        if (el('sbs-refine-development')) { el('sbs-refine-development').addEventListener('click', function () { refineDevelopment(project, this); }); }
        if (el('sbs-accept-master')) { el('sbs-accept-master').addEventListener('click', function () { acceptDevelopment(project.concept.selected_seed_uuid, 'master_reference', this); }); }
        box.querySelectorAll('[data-generate-development-role]').forEach(function (button) { button.addEventListener('click', function () { generateDevelopmentReferences(project, [button.getAttribute('data-generate-development-role')], button); }); });
        if (el('sbs-generate-missing-references')) { el('sbs-generate-missing-references').addEventListener('click', function () { generateDevelopmentReferences(project, (this.getAttribute('data-missing-roles') || '').split(',').filter(Boolean), this); }); }
        box.querySelectorAll('[data-accept-development]').forEach(function (button) { button.addEventListener('click', function () { acceptDevelopment(button.getAttribute('data-accept-development'), button.getAttribute('data-reference-role'), button); }); });
        if (el('sbs-generate-approval')) { el('sbs-generate-approval').addEventListener('click', function () { generateApprovalSheet(this); }); }
        box.querySelectorAll('[data-accept-approval]').forEach(function (button) { button.addEventListener('click', function () { acceptApprovalSheet(button.getAttribute('data-accept-approval'), button); }); });
        box.querySelectorAll('[data-delete-approval-project]').forEach(function (button) { button.addEventListener('click', function () { deleteApprovalSheet(button.getAttribute('data-delete-approval-project'), button.getAttribute('data-approval-generation'), button.getAttribute('data-accepted-asset'), button.getAttribute('data-approval-current') === '1', button); }); });
        box.querySelectorAll('[data-cancel-job]').forEach(function (button) { button.addEventListener('click', function () { api('jobs/' + button.getAttribute('data-cancel-job'), { method: 'DELETE' }).then(function (job) { state.developmentJobs[job.uuid] = job; renderDevelopment(); }).catch(handleError); }); });
        box.querySelectorAll('[data-correction-key]').forEach(function (input) { input.addEventListener('input', function () { saveCorrectionDraft(input.getAttribute('data-correction-key'), input.value); }); input.addEventListener('blur', function () { setTimeout(function () { if (developmentRenderPending) { renderDevelopment(); } }, 0); }); });
        box.querySelectorAll('[data-correct-development]').forEach(function (button) { button.addEventListener('click', function () { correctDevelopmentImage(button.getAttribute('data-correct-development')); }); });
        box.querySelectorAll('[data-clear-correction]').forEach(function (button) { button.addEventListener('click', function () { var input=el(button.getAttribute('data-clear-correction')); saveCorrectionDraft(input.getAttribute('data-correction-key'), ''); input.value=''; input.focus(); }); });
        bindCreationActions(box);
    }
    function startDevelopment() {
        if (!state.selectedPack) { return; }
        submitDevelopment('concepts', 'packs/' + state.selectedPack.uuid + '/development', {}, function (data) { replaceProject(data.project); state.developmentProjectUuid = data.project.uuid; showMessage('Four visual concepts are being generated.'); });
    }
    function selectDevelopmentSeed(project, uuid, button) {
        buttonBusy(button, true);
        api('projects/' + project.uuid + '/development', { method: 'PATCH', body: JSON.stringify({ selected_seed_uuid: uuid }) }).then(function (updated) { replaceProject(updated); renderDevelopment(); showMessage('Visual seed selected.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }
    function refineDevelopment(project, button) {
        var instruction = el('sbs-development-refinement').value.trim();
        if (!instruction) { showMessage('Describe the refinement first.', true); return; }
        buttonBusy(button, true);
        post('projects/' + project.uuid + '/development/refine', { generation_uuid: project.concept.selected_seed_uuid, instruction: instruction }).then(function (data) { trackJobs(data.jobs || []); showMessage('The refined concept is being generated.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }
    function generateDevelopmentReferences(project, roles, button) {
        if (!roles.length || !project) { return; }
        var scope = roles.length === 1 ? roles[0] : 'references';
        submitDevelopment(scope, 'projects/' + project.uuid + '/development/references', { roles: roles }, function (data) { showMessage(data.errors && Object.keys(data.errors).length ? 'Some reference jobs could not be started.' : 'Reference generation started.', !!(data.errors && Object.keys(data.errors).length)); });
    }
    function acceptDevelopment(generationUuid, role, button) {
        if (!state.selectedPack) { return; }
        buttonBusy(button, true);
        post('packs/' + state.selectedPack.uuid + '/development/accept', { generation_uuid: generationUuid, role: role, replace_existing: true }).then(function (pack) { replacePack(pack); showMessage(role === 'master_reference' ? 'Visual seed accepted as the Master reference.' : 'Generated reference accepted.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }
    function generateApprovalSheet(button) {
        if (!state.selectedPack) { return; }
        submitDevelopment('approval', 'packs/' + state.selectedPack.uuid + '/test', {}, function () { showMessage('The approval sheet is being generated in this section.'); });
    }
    function acceptApprovalSheet(generationUuid, button) {
        if (!state.selectedPack) { return; }
        buttonBusy(button, true);
        post('packs/' + state.selectedPack.uuid + '/approve-tests', { generation_uuid: generationUuid }).then(function (pack) { replacePack(pack); showMessage('This approval sheet is now the current accepted checkpoint.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }
    function deleteApprovalSheet(projectUuid, generationUuid, acceptedAssetUuid, approvalCurrent, button) {
        if (!state.selectedPack) { return; }
        var hasStoredReference = !!acceptedAssetUuid;
        var warning = approvalCurrent ? 'Delete the currently accepted approval sheet? Its Generated reference will also be removed and character approval will no longer be current. This cannot be undone.' : hasStoredReference ? 'Delete this previously accepted approval sheet and its stored Generated reference? This cannot be undone.' : 'Delete this approval-sheet candidate? This cannot be undone.';
        if (!window.confirm(warning)) { return; }
        buttonBusy(button, true);
        var operation = hasStoredReference ? remove('packs/' + state.selectedPack.uuid + '/assets/' + acceptedAssetUuid).then(function () { return remove('projects/' + projectUuid); }) : remove('projects/' + projectUuid);
        operation.then(function () {
            delete state.developmentJobs[generationUuid];
            return loadBootstrap();
        }).then(function () { showMessage(approvalCurrent ? 'Accepted sheet removed; choose another current sheet or generate a new one.' : 'Approval-sheet candidate deleted.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }

    function bindCharacters() {
        el('sbs-new-pack').addEventListener('click', function () {
            var name = window.prompt('Character name'); if (!name) { return; }
            var description = window.prompt('Describe the adult character, personality and visual style') || '';
            post('packs', { name: name, description: description }).then(function (pack) { state.packs.unshift(pack); selectPack(pack.uuid); activateTab('characters'); }).catch(handleError);
        });
        el('sbs-current-pack').addEventListener('change', function () { selectPack(this.value); });
        el('sbs-fork-pack').addEventListener('click', function () {
            if (!state.selectedPack) { return; }
            var button = this; buttonBusy(button, true);
            post('packs/' + state.selectedPack.uuid + '/fork').then(function (pack) { replacePack(pack); activateTab('characters'); showMessage('New editable character version created.'); }).catch(handleError).finally(function () { buttonBusy(button, false); renderCharacterContext(); });
        });
    }

    function bindCreate() {
        el('sbs-ideas-button').addEventListener('click', function () {
            var button = this, pack = state.selectedPack ? state.selectedPack.uuid : '', idea = el('sbs-idea').value.trim();
            if (!pack || !idea) { showMessage('Choose a character and enter a rough idea.', true); return; }
            buttonBusy(button, true);
            post('concepts', { pack_uuid: pack, idea: idea }).then(function (data) { renderConcepts(data.concepts || []); }).catch(handleError).finally(function () { buttonBusy(button, false); });
        });
        el('sbs-generate').addEventListener('click', generateDrafts);
        el('sbs-scene-prompt').addEventListener('input', updatePromptPreview);
    }
    function renderConcepts(concepts) {
        var box = el('sbs-concepts');
        box.innerHTML = concepts.map(function (concept, index) { return '<article class="sbs-concept" data-concept="' + index + '"><h3>' + esc(concept.title) + '</h3><p>' + esc(concept.joke) + '</p><small>' + esc(concept.composition) + '</small></article>'; }).join('');
        box.querySelectorAll('[data-concept]').forEach(function (card) { card.addEventListener('click', function () { state.concept = concepts[Number(card.getAttribute('data-concept'))]; el('sbs-scene-prompt').value = state.concept.scene_prompt || ''; el('sbs-project-title').value = state.concept.title || ''; box.querySelectorAll('.sbs-concept').forEach(function (item) { item.classList.toggle('selected', item === card); }); updatePromptPreview(); }); });
    }
    function updatePromptPreview() {
        var pack = state.selectedPack, scene = el('sbs-scene-prompt').value.trim(), identity = pack && pack.identity ? pack.identity : {};
        var traits = (identity.locked_traits || []).map(function (trait) { return '- ' + trait; }).join('\n');
        var exclusions = (identity.exclusions || []).map(function (item) { return '- ' + item; }).join('\n');
        el('sbs-effective-prompt').textContent = 'CURRENT CHARACTER IDENTITY — MUST PRESERVE:\n' + (traits || '- Add character traits in Character setup') + '\n\nEDITABLE SCENE REQUEST:\n' + (scene || '[Enter or choose a scene]') + '\n\nHOUSE TONE:\nClearly adult, cheeky, confident and bawdy. Strong innuendo is welcome; no visible genitals or depicted sex acts.\n\nDO NOT USE:\n' + exclusions;
    }
    function generateDrafts() {
        var packUuid = state.selectedPack ? state.selectedPack.uuid : '', prompt = el('sbs-scene-prompt').value.trim(), title = el('sbs-project-title').value.trim() || 'Untitled project';
        if (!packUuid || !prompt) { showMessage('Choose a character and enter a scene prompt.', true); return; }
        var button = el('sbs-generate'); buttonBusy(button, true);
        post('projects', { pack_uuid: packUuid, title: title, concept: state.concept || {} }).then(function (created) {
            state.activeProject = created;
            return post('jobs/generate', { project_uuid: created.uuid, prompt: prompt, count: 4, quality: 'medium', size: el('sbs-size').value, background: el('sbs-background').value });
        }).then(function (data) {
            el('sbs-effective-prompt').textContent = data.effective_prompt || '';
            trackJobs(data.jobs || []);
        }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }

    function trackJobs(jobs) {
        var ordinary = [];
        (jobs || []).forEach(function (job) {
            if (freestyle && freestyle.isJob(job)) { freestyle.onJob(job); } else if (isDevelopmentPurpose(developmentPurpose(job))) { state.developmentJobs[job.uuid] = job; } else { ordinary.push(job); }
        });
        if (ordinary.length) { renderLiveJobs(ordinary); }
        renderDevelopment();
        if (freestyle) { freestyle.render(); }
        pollJobs(jobs || []);
    }
    function renderLiveJobs(jobs) {
        var box = el('sbs-live-jobs');
        jobs = jobs.filter(function (job) { return !(freestyle && freestyle.isJob(job)) && !isDevelopmentPurpose(developmentPurpose(job)) && (!job.pack_uuid || !state.selectedPack || job.pack_uuid === state.selectedPack.uuid); });
        jobs.forEach(function (job) {
            var current = box.querySelector('[data-job="' + job.uuid + '"]');
            if (!current) { current = document.createElement('article'); current.className = 'sbs-job'; current.setAttribute('data-job', job.uuid); box.prepend(current); }
            if (job.status === 'completed' && job.result && job.result.asset_url) {
                current.innerHTML = '<div class="sbs-job-result"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(job.result.asset_url) + '" data-zoom-caption="Completed Idea Room result"><img src="' + esc(job.result.asset_url) + '" alt="Generated draft"></button><div class="sbs-creation-meta"><p>Completed · click image to enlarge</p>' + (job.result.generation_uuid ? '<button type="button" class="sbs-remove-creation" data-delete-generation="' + esc(job.result.generation_uuid) + '" title="Remove this image"><span aria-hidden="true">🗑</span> Remove</button>' : '') + '</div></div>';
            } else if (job.status === 'completed') {
                current.innerHTML = '<div><strong>Completed</strong><p>The resulting artwork has been removed.</p></div>';
            } else if (job.status === 'failed' || job.status === 'blocked') {
                current.innerHTML = '<div><strong>' + esc(job.status) + '</strong><p>' + esc((job.error && job.error.message) || 'The provider did not complete this request.') + '</p></div>';
            } else {
                current.innerHTML = '<div style="width:100%"><span class="sbs-spinner"></span><p>' + esc(job.status) + '</p><div class="sbs-progress"><span style="width:' + Number(job.progress || 5) + '%"></span></div><button class="sbs-button ghost" data-cancel-job="' + esc(job.uuid) + '">Cancel</button></div>';
            }
        });
        box.querySelectorAll('[data-cancel-job]').forEach(function (button) { button.addEventListener('click', function () { api('jobs/' + button.getAttribute('data-cancel-job'), { method: 'DELETE' }).then(function (job) { renderLiveJobs([job]); }).catch(handleError); }); });
        bindCreationActions(box);
    }
    function refreshFreestyleProject(job) {
        var p=state.projects.find(function(p){return job.payload&&p.id===Number(job.payload.project_id);});
        if(!p)return Promise.resolve();
        return api('projects/'+p.uuid).then(function(updated){replaceProject(updated);if(state.activeProject&&state.activeProject.uuid===updated.uuid)state.activeProject=updated;if(freestyle)freestyle.render();}).catch(handleError);
    }
    function pollJobs(jobs) {
        var pending = jobs.filter(function (job) { return !['completed', 'failed', 'blocked', 'cancelled'].includes(job.status); });
        if (!pending.length) { if(freestyle&&jobs.some(function(job){return freestyle.isJob(job);})){jobs.filter(function(job){return freestyle.isJob(job);}).forEach(refreshFreestyleProject);}else{refreshProjects();} return; }
        pending.forEach(function (job) {
            if (state.polling[job.uuid]) { return; }
            state.polling[job.uuid] = true;
            (function tick(current) {
                setTimeout(function () {
                    api('jobs/' + current.uuid).catch(function (error) { return (isDevelopmentPurpose(developmentPurpose(current)) || (freestyle && freestyle.isJob(current))) ? Object.assign({}, current, { poll_error: error.message }) : { uuid: current.uuid, status: 'failed', error: { message: error.message } }; }).then(function (updated) {
                        if (freestyle && freestyle.isJob(updated)) { freestyle.onJob(updated); freestyle.render(); } else if (isDevelopmentPurpose(developmentPurpose(updated))) { state.developmentJobs[updated.uuid] = updated; renderDevelopment(); } else { renderLiveJobs([updated]); }
                        if (['completed', 'failed', 'blocked', 'cancelled'].includes(updated.status)) { delete state.polling[updated.uuid]; if(freestyle&&freestyle.isJob(updated)){refreshFreestyleProject(updated);}else{refreshProjects();} } else { tick(updated); }
                    });
                }, 2500);
            })(job);
        });
    }

    function renderProjects() {
        var list = el('sbs-project-list'), projects = characterProjects();
        if (!projects.length) { state.activeProject = null; state.selectedGeneration = null; list.innerHTML = '<p class="sbs-muted">No creations for this character yet.</p>'; el('sbs-project-detail').innerHTML = '<p class="sbs-muted">Generate the first set in Idea Room.</p>'; return; }
        if (!state.activeProject || !projects.some(function (project) { return project.uuid === state.activeProject.uuid; })) { state.activeProject = projects[0]; state.selectedGeneration = null; }
        list.innerHTML = projects.map(function (project) { var itemCount = (project.generations || []).length + (project.designs || []).length; return '<article class="sbs-project-card ' + (state.activeProject && project.uuid === state.activeProject.uuid ? 'active' : '') + '" data-project="' + esc(project.uuid) + '"><button type="button" class="sbs-project-delete" data-delete-project="' + esc(project.uuid) + '" title="Delete creation set" aria-label="Delete creation set">🗑</button><h3>' + esc(project.title) + '</h3><small>v' + esc(project.pack_version || '') + ' · ' + itemCount + ' creation' + (itemCount === 1 ? '' : 's') + '</small></article>'; }).join('');
        list.querySelectorAll('[data-project]').forEach(function (card) { card.addEventListener('click', function () { var next = state.projects.find(function (item) { return item.uuid === card.getAttribute('data-project'); }); if (!state.activeProject || !next || state.activeProject.uuid !== next.uuid) { resetCanvasProject(); } state.activeProject = next; state.selectedGeneration = null; renderProjects(); renderProjectDetail(); renderCanvasOptions(); }); });
        list.querySelectorAll('[data-delete-project]').forEach(function (button) { button.addEventListener('click', function (event) { event.stopPropagation(); deleteProjectSet(button.getAttribute('data-delete-project')); }); });
        renderProjectDetail();
    }
    function characterProjects() { return state.selectedPack ? state.projects.filter(function (project) { return project.pack_uuid === state.selectedPack.uuid && (!project.concept || ['character_pack_test', 'character_visual_development'].indexOf(project.concept.type) < 0 && (project.concept.type !== 'freestyle' || project.concept.merch_ready)); }) : []; }
    function deleteProjectSet(uuid) {
        var project = state.projects.find(function (item) { return item.uuid === uuid; });
        if (!project || !window.confirm('Delete “' + project.title + '” and all of its generated images, canvas designs and uploaded project assets? This cannot be undone.')) { return; }
        remove('projects/' + uuid).then(function () {
            state.projects = state.projects.filter(function (item) { return item.uuid !== uuid; });
            if (state.activeProject && state.activeProject.uuid === uuid) { state.activeProject = null; state.selectedGeneration = null; state.canvasUuid = ''; }
            renderProjects(); renderCanvasOptions(); showMessage('Creation set deleted.');
        }).catch(handleError);
    }
    function renderProjectDetail() {
        var project = state.activeProject, box = el('sbs-project-detail');
        if (!project) { return; }
        var generationCards = (project.generations || []).map(function (generation) {
            var caption = generation.action + ' · ' + generation.quality + ' · ' + project.title, selected = state.selectedGeneration && state.selectedGeneration.uuid === generation.uuid;
            return '<article class="sbs-generation ' + (selected ? 'selected' : '') + '" data-generation="' + esc(generation.uuid) + '"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(generation.asset_url) + '" data-zoom-caption="' + esc(caption) + '"><img src="' + esc(generation.asset_url) + '" alt=""></button><footer><span>' + esc(generation.action) + ' · ' + esc(generation.quality) + '<br>' + money(generation.cost_estimate) + '</span><div class="sbs-creation-actions"><button type="button" class="sbs-select-creation ' + (selected ? 'is-selected' : '') + '" data-select-generation="' + esc(generation.uuid) + '" aria-pressed="' + (selected ? 'true' : 'false') + '" ' + (selected ? 'disabled' : '') + '>' + (selected ? '✓ Selected for refinement' : 'Select for refinement') + '</button><button type="button" class="sbs-remove-creation" data-delete-generation="' + esc(generation.uuid) + '" title="Remove this image"><span aria-hidden="true">🗑</span> Remove</button></div></footer></article>';
        }).join('');
        var designCards = (project.designs || []).filter(function (design) { return design.preview_url; }).map(function (design) {
            return '<article class="sbs-generation sbs-saved-design"><button type="button" class="sbs-image-zoom" data-zoom-image="' + esc(design.preview_url) + '" data-zoom-caption="' + esc(design.name + ' · saved composition') + '"><img src="' + esc(design.preview_url) + '" alt=""></button><footer><span>Composition<br>' + esc(design.updated_at) + '</span><div class="sbs-creation-actions"><button type="button" class="sbs-remove-creation" data-delete-design="' + esc(design.uuid) + '" title="Remove this saved design"><span aria-hidden="true">🗑</span> Remove</button></div></footer></article>';
        }).join('');
        var cards = generationCards + designCards;
        box.innerHTML = '<h2 class="sbs-stage-heading"><span class="sbs-stage-number">5.2</span> Inspect and select a creation</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Compare the images and select one to refine or use on the canvas.</p><div class="sbs-inline-heading"><div><p class="sbs-kicker">' + esc(project.pack_name || '') + '</p><h2>' + esc(project.title) + '</h2></div><button id="sbs-open-canvas" class="sbs-button">Open in canvas</button>' + (project.concept && project.concept.type==='freestyle' ? '<button type="button" id="sbs-new-freestyle-canvas" class="sbs-button">New composition from selected image</button>' : '') + '</div><div class="sbs-generation-grid sbs-creation-gallery">' + (cards || '<p class="sbs-muted">No completed creations yet.</p>') + '</div><div class="sbs-card" style="margin-top:18px"><h2 class="sbs-stage-heading"><span class="sbs-stage-number">5.3</span> Refine or finish the image</h2><p class="sbs-stage-decision"><strong>Decision:</strong> Choose refinement, polish or upscale if needed; inspect the result before opening the canvas.</p><label>Refinement instruction<textarea id="sbs-refine-prompt" rows="4" placeholder="Change one thing at a time and say what must stay unchanged."></textarea></label><div class="sbs-row wrap"><button id="sbs-refine" class="sbs-button primary">Refine selected</button><button id="sbs-polish" class="sbs-button accent">High-quality polish</button><button id="sbs-upscale-2" class="sbs-button">AI upscale 2×</button><button id="sbs-upscale-4" class="sbs-button">AI upscale 4×</button></div></div>';
        box.querySelectorAll('[data-select-generation]').forEach(function (button) { button.addEventListener('click', function () { state.selectedGeneration = project.generations.find(function (gen) { return gen.uuid === button.getAttribute('data-select-generation'); }); renderProjectDetail(); }); });
        bindCreationActions(box);
        el('sbs-refine').addEventListener('click', function () { refineSelected(false); });
        el('sbs-polish').addEventListener('click', function () { refineSelected(true); });
        el('sbs-upscale-2').addEventListener('click', function () { upscaleSelected(2); });
        el('sbs-upscale-4').addEventListener('click', function () { upscaleSelected(4); });
        el('sbs-open-canvas').addEventListener('click', function () { activateTab('canvas'); renderCanvasOptions(); });
        if(el('sbs-new-freestyle-canvas'))el('sbs-new-freestyle-canvas').addEventListener('click',function(){
            if(!state.selectedGeneration){showMessage('Select an image for the new composition.',true);return;}
            if(state.canvas&&!state.canvasUuid&&state.canvas.getObjects().some(function(o){return o.sbsType!=='guide';})&&!window.confirm('Start a new composition? Save the current unsaved canvas first if you want to keep it.'))return;
            ensureCanvas();resetCanvasProject();state.freestyleNewCanvas=true;activateTab('canvas');prepareFreestyleCanvas();
        });
        updateProjectActionControls();
    }
    function bindCreationActions(scope) {
        scope.querySelectorAll('[data-zoom-image]').forEach(function (button) {
            if (button.dataset.sbsBound) { return; }
            button.dataset.sbsBound = '1';
            button.addEventListener('click', function (event) { event.stopPropagation(); openImageModal(button.getAttribute('data-zoom-image'), button.getAttribute('data-zoom-caption') || 'Creation preview'); });
        });
        scope.querySelectorAll('[data-delete-generation]').forEach(function (button) {
            if (button.dataset.sbsBound) { return; }
            button.dataset.sbsBound = '1';
            button.addEventListener('click', function (event) { event.stopPropagation(); deleteGeneration(button.getAttribute('data-delete-generation'), button.closest('[data-job]')); });
        });
        scope.querySelectorAll('[data-delete-design]').forEach(function (button) {
            if (button.dataset.sbsBound) { return; }
            button.dataset.sbsBound = '1';
            button.addEventListener('click', function (event) { event.stopPropagation(); deleteDesign(button.getAttribute('data-delete-design')); });
        });
    }
    function openImageModal(url, caption) {
        var modal = el('sbs-image-modal');
        el('sbs-image-modal-image').src = url;
        el('sbs-image-modal-caption').textContent = caption || '';
        if (typeof modal.showModal === 'function') { modal.showModal(); } else { modal.setAttribute('open', 'open'); }
    }
    function closeImageModal() {
        var modal = el('sbs-image-modal');
        if (typeof modal.close === 'function' && modal.open) { modal.close(); } else { modal.removeAttribute('open'); }
        el('sbs-image-modal-image').src = '';
    }
    function bindImageModal() {
        var modal = el('sbs-image-modal');
        el('sbs-image-modal-close').addEventListener('click', closeImageModal);
        modal.addEventListener('click', function (event) { if (event.target === modal) { closeImageModal(); } });
        modal.addEventListener('close', function () { el('sbs-image-modal-image').src = ''; });
    }
    function bindGuide() {
        var dialog = el('sbs-guide-dialog'), openButton = el('sbs-guide-open'), closeButton = el('sbs-guide-close');
        if (!dialog || !openButton || !closeButton) { return; }
        function closeGuide() { if (typeof dialog.close === 'function' && dialog.open) { dialog.close(); } else { dialog.removeAttribute('open'); } }
        openButton.addEventListener('click', function () { if (typeof dialog.showModal === 'function') { dialog.showModal(); } else { dialog.setAttribute('open', 'open'); } });
        closeButton.addEventListener('click', closeGuide);
        dialog.addEventListener('click', function (event) { if (event.target === dialog) { closeGuide(); } });
    }
    function deleteGeneration(uuid, liveCard) {
        if (!uuid || !window.confirm('Delete this image from the project? Usage history will be retained, but the image file cannot be recovered.')) { return; }
        remove('generations/' + uuid).then(function () {
            if (state.selectedGeneration && state.selectedGeneration.uuid === uuid) { state.selectedGeneration = null; }
            if (liveCard) { liveCard.remove(); }
            return refreshProjects();
        }).then(function () { showMessage('Image removed from the project.'); }).catch(handleError);
    }
    function deleteDesign(uuid) {
        if (!uuid || !window.confirm('Delete this saved composition? The editable design and its preview cannot be recovered.')) { return; }
        remove('canvases/' + uuid).then(function () {
            if (state.canvasUuid === uuid) { state.canvasUuid = ''; }
            return refreshProjects();
        }).then(function () { showMessage('Saved design removed from the project.'); }).catch(handleError);
    }
    function updateProjectActionControls() {
        var hasSelection = !!state.selectedGeneration;
        ['sbs-refine', 'sbs-polish', 'sbs-upscale-2', 'sbs-upscale-4'].forEach(function (id) { if (el(id)) { el(id).disabled = !hasSelection; } });
        if (el('sbs-upscale-2')) { el('sbs-upscale-2').disabled = !hasSelection || !state.providers.replicate; }
        if (el('sbs-upscale-4')) { el('sbs-upscale-4').disabled = !hasSelection || !state.providers.replicate; }
    }
    function refineSelected(polish) {
        if (!state.selectedGeneration) { showMessage('Select an image first.', true); return; }
        var instruction = el('sbs-refine-prompt').value.trim();
        if (!instruction) { instruction = polish ? 'Polish this exact image for premium merchandise printing. Preserve the character identity, scene, composition, palette and joke. Improve linework, texture, edge quality and finish only.' : ''; }
        if (!instruction) { showMessage('Enter a refinement instruction.', true); return; }
        if(state.activeProject.concept && state.activeProject.concept.type==='freestyle'){
            post('freestyle',{project_uuid:state.activeProject.uuid,parent_uuid:state.selectedGeneration.uuid,instruction:instruction,settings:state.selectedGeneration.freestyle_settings||state.activeProject.concept.settings}).then(function(data){replaceProject(data.project);freestyle.open(data.project.uuid);activateTab('freestyle');trackJobs(data.jobs||[]);}).catch(handleError);return;
        }
        post('jobs/generate', { project_uuid: state.activeProject.uuid, parent_uuid: state.selectedGeneration.uuid, prompt: instruction, count: 1, quality: polish ? 'high' : 'medium', size: polish ? '2048x2048' : state.selectedGeneration.size, background: 'opaque' }).then(function (data) { activateTab('create'); trackJobs(data.jobs); }).catch(handleError);
    }
    function upscaleSelected(scale) {
        if (!state.selectedGeneration) { showMessage('Select an image first.', true); return; }
        if (!state.providers.replicate) { showMessage('Replicate is not configured for upscaling.', true); return; }
        post('jobs/upscale', { generation_uuid: state.selectedGeneration.uuid, scale: scale }).then(function (job) { var p=state.projects.find(function(p){return job.payload&&p.id===Number(job.payload.project_id);});if(p&&p.concept&&p.concept.type==='freestyle'){freestyle.open(p.uuid);activateTab('freestyle');}else{activateTab('create');} trackJobs([job]); }).catch(handleError);
    }
    function refreshProjects() { var activeUuid = state.activeProject ? state.activeProject.uuid : '', selectedUuid = state.selectedGeneration ? state.selectedGeneration.uuid : ''; return loadBootstrap().then(function () { state.activeProject = activeUuid ? state.projects.find(function (p) { return p.uuid === activeUuid; }) || null : state.activeProject; state.selectedGeneration = state.activeProject && selectedUuid ? (state.activeProject.generations || []).find(function (generation) { return generation.uuid === selectedUuid; }) || null : null; renderProjects(); renderCanvasOptions(); }); }

    function loadUsage() { api('usage').then(function (data) { state.usage = data; renderUsage(data); }).catch(handleError); }
    function renderUsage(usage) {
        var summary = el('sbs-usage-summary'); if (!summary) { return; }
        summary.innerHTML = (usage.providers || []).map(function (provider) { return '<div class="sbs-metric"><span>' + esc(provider.provider) + '</span><strong>' + money(provider.estimated_cost) + '</strong><small>' + esc(provider.operations) + ' operations</small></div>'; }).join('') || '<p class="sbs-muted">No billable activity has been recorded.</p>';
        var rows = el('sbs-usage-rows'); if (rows) { rows.innerHTML = (usage.rows || []).map(function (row) { return '<tr><td>' + esc(row.created_at) + '</td><td>' + esc((row.pack_name || 'Unassigned') + (row.pack_version ? ' · v' + row.pack_version : '')) + '</td><td>' + esc(row.provider) + '</td><td>' + esc(row.metric) + '</td><td>' + money(row.estimated_cost) + '</td></tr>'; }).join(''); }
    }

    function loadUpdates() {
        var rootBox = el('sbs-update-root');
        if (!rootBox) { return Promise.resolve(); }
        rootBox.innerHTML = '<article class="sbs-card sbs-update-loading"><span class="sbs-spinner"></span><p>Checking update access…</p></article>';
        return api('updates/status').then(function (status) { state.updateStatus = status; renderUpdates(status); return status; }).catch(handleError);
    }
    function updateBytes(value) {
        var bytes = Number(value || 0), units = ['B', 'KB', 'MB', 'GB'], index = 0;
        while (bytes >= 1024 && index < units.length - 1) { bytes /= 1024; index += 1; }
        return (index ? bytes.toFixed(1) : Math.round(bytes)) + ' ' + units[index];
    }
    function renderUpdates(status) {
        var rootBox = el('sbs-update-root');
        if (!rootBox) { return; }
        if (!status.configured) {
            rootBox.innerHTML = '<article class="sbs-card sbs-update-lock-card"><span class="sbs-update-lock-icon" aria-hidden="true">&#128274;</span><div><h2>Studio access has not been configured</h2><p>A WordPress administrator must set the shared Studio password under <strong>Smutty Bear Studio → Settings</strong> before front-end updates can be used.</p></div></article>';
            return;
        }
        if (!status.authorized) {
            rootBox.innerHTML = '<article class="sbs-card sbs-update-lock-card"><span class="sbs-update-lock-icon" aria-hidden="true">&#128274;</span><div><p class="sbs-kicker">PRIVILEGED ACTION</p><h2>Reconfirm the Studio password</h2><p>For protection against an unattended Studio session, re-enter the same shared password used to enter the Studio. Update access lasts ' + esc(status.session_minutes || 15) + ' minutes and is rate-limited.</p><form id="sbs-update-unlock" class="sbs-update-unlock"><label>Studio password<input type="password" name="password" required minlength="8" autocomplete="current-password"></label><button class="sbs-button primary" type="submit">Unlock Updates</button><p class="sbs-form-message" aria-live="polite"></p></form></div></article>';
            el('sbs-update-unlock').addEventListener('submit', unlockUpdates);
            return;
        }
        var release = status.release || null;
        var releaseMessage = status.feed_error ? '<p class="sbs-update-error">' + esc(status.feed_error) + '</p>' : !status.feed_configured ? '<p class="sbs-muted">No private update feed is configured. Signed ZIP upload remains available.</p>' : !release ? '<p class="sbs-muted">No release information is available.</p>' : '<div class="sbs-release-summary"><strong>Feed version ' + esc(release.version || 'unknown') + '</strong><span class="sbs-pill">' + (release.available ? 'Update available' : 'Current') + '</span><p>' + esc(release.release_notes || 'No release notes supplied.') + '</p><small>Requires WordPress ' + esc(release.requires_wp || '5.8.17') + '+ and PHP ' + esc(release.requires_php || '7.4') + '+.</small></div>';
        var backupOptions = (status.backups || []).map(function (backup) { return '<option value="' + esc(backup.name) + '">' + esc(backup.name + ' · ' + updateBytes(backup.bytes)) + '</option>'; }).join('');
        var auditRows = (status.audit || []).map(function (row) { var details = Object.keys(row.details || {}).map(function (key) { return key + ': ' + row.details[key]; }).join(', '); return '<tr><td>' + esc(row.created_at) + '</td><td>' + esc(row.action.replace(/_/g, ' ')) + '</td><td><span class="sbs-update-status ' + esc(row.status) + '">' + esc(row.status) + '</span></td><td>' + esc(details) + '</td></tr>'; }).join('');
        rootBox.innerHTML = '<div class="sbs-update-toolbar"><div><strong>Privileged update access is unlocked</strong><span>Expires automatically after ' + esc(status.session_minutes || 15) + ' minutes.</span></div><button id="sbs-update-lock" class="sbs-button">Lock now</button></div>' + (status.health_notice ? '<div class="sbs-update-health">' + esc(status.health_notice) + '</div>' : '') + '<div class="sbs-metric-grid sbs-update-metrics"><div class="sbs-metric"><span>Installed</span><strong>v' + esc(status.installed_version) + '</strong><small>Studio plugin</small></div><div class="sbs-metric"><span>Trusted keys</span><strong>' + esc(status.trusted_key_count) + '</strong><small>Required for every release</small></div><div class="sbs-metric"><span>Runtime</span><strong>PHP ' + esc(status.php_version) + '</strong><small>WordPress ' + esc(status.wordpress_version) + '</small></div></div><div class="sbs-update-grid"><article class="sbs-card"><div class="sbs-inline-heading"><div><p class="sbs-kicker">PRIVATE FEED</p><h2>Release feed</h2></div><button id="sbs-update-check" class="sbs-button" ' + (status.feed_configured ? '' : 'disabled') + '>Check now</button></div>' + releaseMessage + '<button id="sbs-update-install-feed" class="sbs-button accent full" ' + (release && release.available ? '' : 'disabled') + '>Install verified feed release</button></article><article class="sbs-card"><p class="sbs-kicker">SIGNED PACKAGE</p><h2>Upload release ZIP</h2><p>Only packages signed by a trusted bundled key and compatible with this server can be installed.</p><form id="sbs-update-upload"><label>Signed release ZIP<input type="file" name="release_zip" accept=".zip,application/zip" required></label><button class="sbs-button primary" type="submit">Verify and install</button></form></article><article class="sbs-card"><p class="sbs-kicker">RECOVERY</p><h2>Rollback</h2><p>Restore one of the three retained verified plugin backups. Creative data and private assets remain separate.</p><form id="sbs-update-rollback"><label>Backup<select name="backup" ' + (backupOptions ? '' : 'disabled') + '>' + (backupOptions || '<option>No backups available</option>') + '</select></label><button class="sbs-button" type="submit" ' + (backupOptions ? '' : 'disabled') + '>Restore selected backup</button></form></article></div><article class="sbs-card sbs-update-audit"><h2>Recent update activity</h2><div class="sbs-table-scroll"><table class="sbs-table"><thead><tr><th>Date</th><th>Action</th><th>Status</th><th>Details</th></tr></thead><tbody>' + (auditRows || '<tr><td colspan="4">No update activity recorded yet.</td></tr>') + '</tbody></table></div></article>';
        el('sbs-update-lock').addEventListener('click', lockUpdates);
        el('sbs-update-check').addEventListener('click', checkUpdates);
        el('sbs-update-install-feed').addEventListener('click', installFeedUpdate);
        el('sbs-update-upload').addEventListener('submit', uploadStudioUpdate);
        el('sbs-update-rollback').addEventListener('submit', rollbackStudioUpdate);
    }
    function unlockUpdates(event) {
        event.preventDefault();
        var form = event.currentTarget, button = form.querySelector('button'), message = form.querySelector('.sbs-form-message');
        buttonBusy(button, true); message.textContent = 'Checking…';
        post('updates/unlock', { password: form.password.value }).then(function (status) { state.updateStatus = status; renderUpdates(status); showMessage('Update controls unlocked for a short session.'); }).catch(function (error) { message.textContent = error.message; }).finally(function () { buttonBusy(button, false); });
    }
    function lockUpdates() {
        var button = el('sbs-update-lock'); buttonBusy(button, true);
        post('updates/lock').then(function (status) { state.updateStatus = status; renderUpdates(status); showMessage('Update controls locked.'); }).catch(handleError).finally(function () { buttonBusy(button, false); });
    }
    function checkUpdates() {
        var button = el('sbs-update-check'); buttonBusy(button, true);
        post('updates/check').then(function (status) { state.updateStatus = status; renderUpdates(status); showMessage(status.release && status.release.available ? 'A signed update is available.' : 'No newer signed release was found.'); }).catch(function (error) { handleError(error); loadUpdates(); }).finally(function () { buttonBusy(button, false); });
    }
    function installFeedUpdate() {
        var release = state.updateStatus && state.updateStatus.release;
        if (!release || !release.available || !window.confirm('Install signed version ' + release.version + '? The plugin will be backed up and health-checked automatically.')) { return; }
        var button = el('sbs-update-install-feed'); buttonBusy(button, true);
        post('updates/install-feed').then(function (result) { finishStudioUpdate('Signed version ' + result.version + ' was installed successfully. Reloading…'); }).catch(function (error) { handleError(error); loadUpdates(); }).finally(function () { buttonBusy(button, false); });
    }
    function uploadStudioUpdate(event) {
        event.preventDefault();
        var form = event.currentTarget, file = form.release_zip.files[0];
        if (!file) { showMessage('Choose a signed release ZIP.', true); return; }
        if (!window.confirm('Verify and install “' + file.name + '”? The existing plugin will be backed up first.')) { return; }
        var button = form.querySelector('button'), data = new FormData(form); buttonBusy(button, true);
        api('updates/install-upload', { method: 'POST', body: data }).then(function (result) { finishStudioUpdate('Signed version ' + result.version + ' was installed successfully. Reloading…'); }).catch(function (error) { handleError(error); loadUpdates(); }).finally(function () { buttonBusy(button, false); });
    }
    function rollbackStudioUpdate(event) {
        event.preventDefault();
        var form = event.currentTarget, backup = form.backup.value;
        if (!backup || !window.confirm('Restore “' + backup + '”? The currently installed code will first be retained as a recovery backup.')) { return; }
        var button = form.querySelector('button'); buttonBusy(button, true);
        post('updates/rollback', { backup: backup }).then(function (result) { finishStudioUpdate('Rollback to version ' + result.version + ' completed. Reloading…'); }).catch(function (error) { handleError(error); loadUpdates(); }).finally(function () { buttonBusy(button, false); });
    }
    function finishStudioUpdate(message) {
        showMessage(message);
        window.setTimeout(function () { window.location.reload(); }, 1400);
    }

    function ensureCanvas() {
        if (state.canvas || !window.fabric) { return; }
        state.canvas = new fabric.Canvas('sbs-design-canvas', { preserveObjectStacking: true, selection: true, backgroundColor: '#ffffff' });
        state.canvas.on('selection:created', renderLayers); state.canvas.on('selection:updated', renderLayers); state.canvas.on('selection:cleared', renderLayers);
        state.canvas.on('object:added', captureCanvas); state.canvas.on('object:modified', captureCanvas); state.canvas.on('object:removed', captureCanvas);
        state.canvas.on('object:moving', snapObject);
        addGuides(); captureCanvas(); bindCanvasTools(); updatePrintReadout();
    }
    function bindCanvasTools() {
        document.querySelectorAll('[data-tool]').forEach(function (button) { button.addEventListener('click', function () { canvasTool(button.getAttribute('data-tool')); }); });
        el('sbs-add-creation').addEventListener('click', addSelectedCreation);
        el('sbs-add-reference').addEventListener('click', addSelectedReference);
        el('sbs-canvas-upload').addEventListener('change', canvasUpload);
        el('sbs-object-colour').addEventListener('input', function () { var obj = state.canvas.getActiveObject(); if (obj) { if (obj.type === 'i-text' || obj.type === 'text') { obj.set('fill', this.value); } else { obj.set('fill', this.value); } state.canvas.requestRenderAll(); captureCanvas(); } });
        el('sbs-font-family').addEventListener('change', function () { var obj = state.canvas.getActiveObject(); if (obj && (obj.type === 'i-text' || obj.type === 'text')) { obj.set('fontFamily', this.value); state.canvas.requestRenderAll(); captureCanvas(); } });
        ['sbs-print-width', 'sbs-print-height', 'sbs-print-dpi'].forEach(function (id) { el(id).addEventListener('input', updatePrintReadout); });
        el('sbs-transparent').addEventListener('change', function () { state.canvas.setBackgroundColor(this.checked ? null : '#ffffff', state.canvas.renderAll.bind(state.canvas)); });
        el('sbs-guides').addEventListener('change', function () { setGuidesVisible(this.checked); });
        el('sbs-canvas-project').addEventListener('change', function () { state.activeProject = state.projects.find(function (project) { return project.uuid === el('sbs-canvas-project').value; }); resetCanvasProject(); renderCanvasOptions(); loadProjectFonts(); loadLatestCanvas(); });
        el('sbs-canvas-save').addEventListener('click', saveCanvas);
        el('sbs-canvas-export').addEventListener('click', exportCanvas);
        updateCanvasControls();
    }
    function renderCanvasOptions() {
        var projectSelect = el('sbs-canvas-project'), creationSelect = el('sbs-canvas-creation'), creationGallery = el('sbs-canvas-creation-gallery'), referenceSelect = el('sbs-canvas-reference'), referenceGallery = el('sbs-canvas-reference-gallery'), projects = characterProjects(); if (!projectSelect || !creationSelect || !creationGallery || !referenceSelect || !referenceGallery) { return; }
        var previousCreation = creationSelect.value, previousReference = referenceSelect.value;
        projectSelect.innerHTML = projects.map(function (project) { return '<option value="' + esc(project.uuid) + '">' + esc(project.title) + '</option>'; }).join('') || '<option value="">No creations for this character</option>';
        if (!state.activeProject || !projects.some(function (project) { return project.uuid === state.activeProject.uuid; })) { state.activeProject = projects[0] || null; }
        if (state.activeProject) { projectSelect.value = state.activeProject.uuid; }
        var gens = state.activeProject ? state.activeProject.generations || [] : [];
        var designs = state.activeProject ? state.activeProject.designs || [] : [];
        var creationItems = gens.map(function (gen) { return { value: 'generation:' + gen.uuid, url: gen.asset_url, badge: 'Image', label: gen.action + ' · ' + gen.quality }; }).concat(designs.filter(function (design) { return design.preview_url; }).map(function (design) { return { value: 'design:' + design.uuid, url: design.preview_url, badge: 'Design', label: design.name || 'Saved design' }; }));
        var preferredCreation = state.selectedGeneration && gens.some(function (gen) { return gen.uuid === state.selectedGeneration.uuid; }) ? 'generation:' + state.selectedGeneration.uuid : previousCreation;
        renderMediaGallery(creationSelect, creationGallery, creationItems, preferredCreation, 'This project has no completed creations.');
        var references = state.selectedPack ? state.selectedPack.assets || [] : [];
        var referenceItems = references.map(function (asset) { return { value: 'reference:' + asset.uuid, url: asset.url, badge: roleLabel(asset.role), label: asset.label || 'Unlabelled reference' }; });
        renderMediaGallery(referenceSelect, referenceGallery, referenceItems, previousReference, 'This character has no reference images.');
        updateCanvasControls();
        loadProjectFonts();
    }
    function renderMediaGallery(select, gallery, items, preferred, emptyMessage) {
        if (!items.some(function (item) { return item.value === preferred; })) { preferred = items.length ? items[0].value : ''; }
        select.value = preferred;
        gallery.innerHTML = items.length ? items.map(function (item) { return '<button type="button" class="sbs-media-item ' + (item.value === preferred ? 'selected' : '') + '" data-media-value="' + esc(item.value) + '" aria-pressed="' + (item.value === preferred ? 'true' : 'false') + '"><img src="' + esc(item.url) + '" alt=""><span class="sbs-media-badge">' + esc(item.badge) + '</span><strong>' + esc(item.label) + '</strong></button>'; }).join('') : '<p class="sbs-muted">' + esc(emptyMessage) + '</p>';
        gallery.querySelectorAll('[data-media-value]').forEach(function (button) { button.addEventListener('click', function () { select.value = button.getAttribute('data-media-value'); gallery.querySelectorAll('[data-media-value]').forEach(function (item) { var selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', selected ? 'true' : 'false'); }); updateCanvasControls(); }); });
    }
    function selectedCreation() {
        var select = el('sbs-canvas-creation'); if (!select || !select.value || !state.activeProject) { return null; }
        var parts = select.value.split(':'), type = parts[0], uuid = parts[1];
        if (type === 'generation') { var generation = (state.activeProject.generations || []).find(function (item) { return item.uuid === uuid; }); return generation ? { url: generation.asset_url, label: generation.action + ' · ' + generation.quality, sbsType: 'artwork', maxWidth: 700 } : null; }
        if (type === 'design') { var design = (state.activeProject.designs || []).find(function (item) { return item.uuid === uuid; }); return design && design.preview_url ? { url: design.preview_url, label: design.name || 'Saved design', sbsType: 'saved_design', maxWidth: 700 } : null; }
        return null;
    }
    function selectedReference() { var select = el('sbs-canvas-reference'); if (!select || !select.value || !state.selectedPack) { return null; } var uuid = select.value.split(':')[1]; return (state.selectedPack.assets || []).find(function (item) { return item.uuid === uuid; }) || null; }
    function resetCanvasProject() {
        state.canvasUuid = '';
        if (!state.canvas) { return; }
        state.historyLock = true;
        el('sbs-transparent').checked=false;state.canvas.setBackgroundColor('#ffffff',state.canvas.renderAll.bind(state.canvas));
        state.canvas.getObjects().filter(function (object) { return object.sbsType !== 'guide'; }).forEach(function (object) { state.canvas.remove(object); });
        state.historyLock = false; state.canvas.discardActiveObject(); state.canvas.requestRenderAll(); state.history = []; state.redo = []; renderLayers(); updateCanvasControls();
    }
    function addSelectedCreation() { ensureCanvas(); var creation = selectedCreation(); if (!creation) { showMessage('Choose a creation first.', true); return; } addCanvasImage(creation); }
    function addSelectedReference() { ensureCanvas(); var reference = selectedReference(); if (!reference) { showMessage('Choose a reference image first.', true); return; } addCanvasImage({ url: reference.url, label: reference.label || roleLabel(reference.role), sbsType: reference.role === 'logo' ? 'exact_asset' : 'reference_asset', maxWidth: 420, metadata: reference.metadata || {} }); }
    function addCanvasImage(source) { fabric.Image.fromURL(source.url, function (img) { var settings = { left: 100, top: 100, name: source.label, sbsType: source.sbsType }; if (source.metadata && source.metadata.crop) { settings.cropX = Number(source.metadata.crop.x); settings.cropY = Number(source.metadata.crop.y); settings.width = Number(source.metadata.crop.width); settings.height = Number(source.metadata.crop.height); } img.set(settings); if(source.fit){img.scaleToWidth(Math.min(state.canvas.width*.8,state.canvas.height*.8*img.width/img.height));img.set({left:state.canvas.width/2,top:state.canvas.height/2,originX:'center',originY:'center'});}else{img.scaleToWidth(Math.min(source.maxWidth || 700, state.canvas.width * .8));} state.canvas.add(img).setActiveObject(img); state.canvas.requestRenderAll(); }); }
    function canvasTool(tool) {
        ensureCanvas(); var canvas = state.canvas, obj = canvas.getActiveObject();
        if (tool === 'text') { var text = new fabric.IText('SMILE OUT LOUD', { left: 130, top: 120, fill: el('sbs-object-colour').value, fontFamily: el('sbs-font-family').value, fontWeight: 'bold', fontSize: 64, name: 'Text' }); canvas.add(text).setActiveObject(text); }
        if (tool === 'rect') { var rect = new fabric.Rect({ left: 180, top: 180, width: 260, height: 160, fill: el('sbs-object-colour').value, name: 'Rectangle' }); canvas.add(rect).setActiveObject(rect); }
        if (tool === 'circle') { var circle = new fabric.Circle({ left: 220, top: 220, radius: 100, fill: el('sbs-object-colour').value, name: 'Circle' }); canvas.add(circle).setActiveObject(circle); }
        if (tool === 'upload') { el('sbs-canvas-upload').click(); }
        if (tool === 'delete' && obj) { if (obj.type === 'activeSelection') { obj.getObjects().forEach(function (item) { canvas.remove(item); }); } else { canvas.remove(obj); } canvas.discardActiveObject(); }
        if (tool === 'duplicate' && obj) { obj.clone(function (copy) { copy.set({ left: obj.left + 25, top: obj.top + 25, name: (obj.name || obj.type) + ' copy' }); canvas.add(copy).setActiveObject(copy); }); }
        if (tool === 'front' && obj) { obj.bringToFront(); guidesToFront(); }
        if (tool === 'back' && obj) { obj.sendToBack(); }
        if (tool === 'lock' && obj) { var lock = !obj.lockMovementX; obj.set({ lockMovementX: lock, lockMovementY: lock, lockScalingX: lock, lockScalingY: lock, lockRotation: lock, selectable: true }); }
        if (tool === 'hide' && obj) { obj.set('visible', false); canvas.discardActiveObject(); }
        if (tool === 'crop-square' && obj && obj.type === 'image') { var side = Math.min(obj.width, obj.height); obj.set({ cropX: Math.max(0, (obj.width - side) / 2), cropY: Math.max(0, (obj.height - side) / 2), width: side, height: side }); }
        if (tool === 'mask-circle' && obj && obj.type === 'image') { obj.set('clipPath', new fabric.Circle({ radius: Math.min(obj.width, obj.height) / 2, originX: 'center', originY: 'center' })); }
        if (tool === 'mask-rect' && obj && obj.type === 'image') { obj.set('clipPath', new fabric.Rect({ width: obj.width * .8, height: obj.height * .65, rx: 24, ry: 24, originX: 'center', originY: 'center' })); }
        if (tool === 'mask-clear' && obj) { obj.set('clipPath', null); }
        if (tool === 'group' && obj && obj.type === 'activeSelection') { var group = obj.toGroup(); group.set('name', 'Group'); }
        if (tool === 'ungroup' && obj && obj.type === 'group') { obj.toActiveSelection(); }
        if (tool === 'undo') { undoCanvas(); }
        if (tool === 'redo') { redoCanvas(); }
        canvas.requestRenderAll(); renderLayers(); captureCanvas();
        updateCanvasControls();
    }
    function canvasUpload(event) {
        var file = event.target.files[0]; if (!file) { return; }
        if (/font\//.test(file.type) || /\.(ttf|otf|woff2?)$/i.test(file.name)) {
            var family = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _-]/g, '');
            var fontData = new FormData(); fontData.append('file', file); fontData.append('project_uuid', state.activeProject ? state.activeProject.uuid : ''); fontData.append('role', 'canvas_font'); fontData.append('label', family);
            api('assets', { method: 'POST', body: fontData }).then(function (asset) {
                if (state.activeProject) { state.activeProject.assets = state.activeProject.assets || []; state.activeProject.assets.push(asset); }
                return loadFontAsset(asset, family);
            }).then(function () { el('sbs-font-family').value = family; showMessage('Font uploaded and attached to this project.'); }).catch(handleError);
        } else {
            var data = new FormData(); data.append('file', file); data.append('project_uuid', state.activeProject ? state.activeProject.uuid : ''); data.append('role', 'canvas_asset'); data.append('label', file.name);
            api('assets', { method: 'POST', body: data }).then(function (asset) { if (state.activeProject) { state.activeProject.assets = state.activeProject.assets || []; state.activeProject.assets.push(asset); } fabric.Image.fromURL(asset.url, function (img) { img.set({ left: 140, top: 140, name: file.name, sbsType: 'uploaded_asset' }); img.scaleToWidth(450); state.canvas.add(img).setActiveObject(img); }); }).catch(handleError);
        }
        event.target.value = '';
    }
    function loadProjectFonts() {
        if (!state.activeProject) { return; }
        (state.activeProject.assets || []).filter(function (asset) { return asset.role === 'canvas_font' || /^font\//.test(asset.mime || ''); }).forEach(function (asset) { loadFontAsset(asset, asset.label || asset.filename.replace(/\.[^.]+$/, '')); });
    }
    function loadFontAsset(asset, family) {
        family = String(family || 'Project Font').replace(/[^A-Za-z0-9 _-]/g, '');
        if (state.loadedFonts[asset.uuid]) { return Promise.resolve(family); }
        var face = new FontFace(family, 'url("' + asset.url.replace(/"/g, '') + '")');
        return face.load().then(function (loaded) { document.fonts.add(loaded); state.loadedFonts[asset.uuid] = family; var select = el('sbs-font-family'); if (select && select.tagName === 'SELECT' && !Array.prototype.some.call(select.options, function (option) { return option.value === family; })) { var option = document.createElement('option'); option.value = family; option.textContent = family; select.appendChild(option); } return family; });
    }
    function addGuides() {
        var canvas = state.canvas, margin = 54;
        var bleed = new fabric.Rect({ left: 18, top: 18, width: canvas.width - 36, height: canvas.height - 36, fill: 'transparent', stroke: '#df2d17', strokeWidth: 2, strokeDashArray: [9, 6], selectable: false, evented: false, excludeFromExport: true, name: 'Bleed guide', sbsType: 'guide' });
        var safe = new fabric.Rect({ left: margin, top: margin, width: canvas.width - margin * 2, height: canvas.height - margin * 2, fill: 'transparent', stroke: '#efb23d', strokeWidth: 2, strokeDashArray: [6, 6], selectable: false, evented: false, excludeFromExport: true, name: 'Safe area', sbsType: 'guide' });
        state.historyLock = true; canvas.add(bleed, safe); state.historyLock = false; guidesToFront();
    }
    function snapObject(event) {
        if (!el('sbs-snapping') || !el('sbs-snapping').checked || !event.target) { return; }
        var object = event.target, grid = 10, centreX = state.canvas.width / 2, centreY = state.canvas.height / 2;
        object.set({ left: Math.round(object.left / grid) * grid, top: Math.round(object.top / grid) * grid });
        var objectCentre = object.getCenterPoint();
        if (Math.abs(objectCentre.x - centreX) < 8) { object.setPositionByOrigin(new fabric.Point(centreX, objectCentre.y), 'center', 'center'); }
        objectCentre = object.getCenterPoint();
        if (Math.abs(objectCentre.y - centreY) < 8) { object.setPositionByOrigin(new fabric.Point(objectCentre.x, centreY), 'center', 'center'); }
    }
    function guidesToFront() { state.canvas.getObjects().filter(function (obj) { return obj.sbsType === 'guide'; }).forEach(function (guide) { guide.bringToFront(); }); }
    function setGuidesVisible(visible) { state.canvas.getObjects().filter(function (obj) { return obj.sbsType === 'guide'; }).forEach(function (guide) { guide.visible = visible; }); state.canvas.requestRenderAll(); }
    function captureCanvas() {
        if (!state.canvas || state.historyLock) { return; }
        clearTimeout(state._historyTimer); state._historyTimer = setTimeout(function () { var json = JSON.stringify(state.canvas.toJSON(['name', 'sbsType', 'excludeFromExport'])); if (state.history[state.history.length - 1] !== json) { state.history.push(json); if (state.history.length > 40) { state.history.shift(); } state.redo = []; } renderLayers(); updateCanvasControls(); }, 120);
    }
    function undoCanvas() { if (state.history.length < 2) { return; } var current = state.history.pop(); state.redo.push(current); loadCanvasJson(state.history[state.history.length - 1]); }
    function redoCanvas() { if (!state.redo.length) { return; } var next = state.redo.pop(); state.history.push(next); loadCanvasJson(next); }
    function loadCanvasJson(json) { state.historyLock = true; state.canvas.loadFromJSON(json, function () { state.historyLock = false; state.canvas.renderAll(); renderLayers(); }); }
    function renderLayers() {
        if (!state.canvas) { return; }
        var active = state.canvas.getActiveObject(), list = el('sbs-layer-list');
        var layers = state.canvas.getObjects().map(function (obj, index) { return { object: obj, index: index }; }).filter(function (item) { return item.object.sbsType !== 'guide'; }).reverse();
        list.innerHTML = layers.map(function (item) { var obj = item.object; return '<div class="sbs-layer ' + (obj === active ? 'active' : '') + '" data-layer="' + item.index + '"><span>' + (obj.visible === false ? '○' : '●') + '</span><span class="sbs-layer-name">' + esc(obj.name || obj.type) + '</span><span>' + (obj.lockMovementX ? '🔒' : '') + '</span></div>'; }).join('') || '<p class="sbs-muted">No layers yet.</p>';
        list.querySelectorAll('[data-layer]').forEach(function (row) { row.addEventListener('click', function () { var obj = state.canvas.item(Number(row.getAttribute('data-layer'))); if (obj) { obj.visible = true; state.canvas.setActiveObject(obj); state.canvas.requestRenderAll(); renderLayers(); } }); });
        updateCanvasControls();
    }
    function updateCanvasControls() {
        var canvas = state.canvas, active = canvas ? canvas.getActiveObject() : null, hasProject = !!state.activeProject, hasObject = !!active && active.sbsType !== 'guide';
        var isImage = hasObject && active.type === 'image', isText = hasObject && (active.type === 'i-text' || active.type === 'text'), isMulti = hasObject && active.type === 'activeSelection', isGroup = hasObject && active.type === 'group';
        if (el('sbs-canvas-project')) { el('sbs-canvas-project').disabled = !characterProjects().length; }
        if (el('sbs-canvas-creation')) { el('sbs-canvas-creation').disabled = !selectedCreation(); }
        if (el('sbs-canvas-reference')) { el('sbs-canvas-reference').disabled = !selectedReference(); }
        if (el('sbs-add-creation')) { el('sbs-add-creation').disabled = !hasProject || !selectedCreation(); }
        if (el('sbs-add-reference')) { el('sbs-add-reference').disabled = !hasProject || !selectedReference(); }
        if (el('sbs-canvas-save')) { el('sbs-canvas-save').disabled = !hasProject || !canvas; }
        if (el('sbs-canvas-export')) { el('sbs-canvas-export').disabled = !canvas || !canvas.getObjects().some(function (obj) { return obj.sbsType !== 'guide'; }); }
        if (el('sbs-object-colour')) { el('sbs-object-colour').disabled = !hasObject || (!isText && typeof active.fill === 'undefined'); }
        if (el('sbs-font-family')) { el('sbs-font-family').disabled = !isText; }
        var validity = { text: hasProject, rect: hasProject, circle: hasProject, upload: hasProject, group: isMulti, ungroup: isGroup, 'crop-square': isImage, 'mask-circle': isImage, 'mask-rect': isImage, 'mask-clear': isImage && !!active.clipPath, duplicate: hasObject, delete: hasObject, front: hasObject, back: hasObject, lock: hasObject, hide: hasObject, undo: !!canvas && state.history.length > 1, redo: !!canvas && state.redo.length > 0 };
        document.querySelectorAll('[data-tool]').forEach(function (button) { var tool = button.getAttribute('data-tool'); if (Object.prototype.hasOwnProperty.call(validity, tool)) { button.disabled = !validity[tool]; } });
    }
    function updatePrintReadout() { var width = Number(el('sbs-print-width').value || 0), height = Number(el('sbs-print-height').value || 0), dpi = Number(el('sbs-print-dpi').value || 0); el('sbs-print-readout').textContent = Math.round(width * dpi) + ' × ' + Math.round(height * dpi) + ' px target'; var review=el('sbs-treatment-review-message');if(review){var treatment=el('sbs-visual-treatment').value;review.textContent='REVIEW REQUIRED — '+(treatment==='vintage-70-20-10'?'70/20/10 vintage treatment':treatment==='clean'?'Clean illustration':'Custom or already-treated artwork')+' is selected. Inspect lettering, facial features, fine edges, halftone dots and distress before print approval. This setting records intent and does not automatically alter the image.';} }
    function canvasDocument() { return { schema_version: 1, character: state.selectedPack ? { uuid: state.selectedPack.uuid, name: state.selectedPack.name, version: state.selectedPack.current_version } : null, project_uuid: state.activeProject ? state.activeProject.uuid : '', artboard: { width: state.canvas.width, height: state.canvas.height, transparent: el('sbs-transparent').checked }, print: { width_inches: Number(el('sbs-print-width').value), height_inches: Number(el('sbs-print-height').value), dpi: Number(el('sbs-print-dpi').value), method: el('sbs-print-method').value, visual_treatment: el('sbs-visual-treatment').value, brand_mark: el('sbs-brand-family').value }, fabric: state.canvas.toJSON(['name', 'sbsType', 'excludeFromExport']) }; }
    function saveCanvas() {
        if (!state.activeProject) { showMessage('Choose a project first.', true); return; }
        var guides = state.canvas.getObjects().filter(function (obj) { return obj.sbsType === 'guide'; }), visible = guides.map(function (obj) { return obj.visible; }); guides.forEach(function (obj) { obj.visible = false; }); state.canvas.renderAll();
        var preview = state.canvas.toDataURL({ format: 'png', multiplier: .45 }); guides.forEach(function (obj, i) { obj.visible = visible[i]; }); state.canvas.renderAll();
        post('canvases', { uuid: state.canvasUuid, project_uuid: state.activeProject.uuid, pack_uuid: state.selectedPack ? state.selectedPack.uuid : '', name: state.activeProject.title + ' composition', document: canvasDocument(), preview: preview }).then(function (canvas) { state.canvasUuid = canvas.uuid; el('sbs-canvas-message').textContent = 'Saved ' + new Date().toLocaleTimeString(); return refreshProjects(); }).then(function () { showMessage('Composition saved to the project and added to Creations.'); }).catch(handleError);
    }
    function loadLatestCanvas() {
        if (!state.activeProject || !state.canvas) { return; }
        api('canvases?project_uuid=' + encodeURIComponent(state.activeProject.uuid)).then(function (rows) { if (!rows.length) { prepareFreestyleCanvas(); return; } var canvas = rows[0]; state.canvasUuid = canvas.uuid; if(canvas.document.artboard){state.canvas.setDimensions({width:Number(canvas.document.artboard.width)||900,height:Number(canvas.document.artboard.height)||900});el('sbs-transparent').checked=!!canvas.document.artboard.transparent;} state.historyLock = true; state.canvas.loadFromJSON(canvas.document.fabric, function () { state.historyLock = false; state.canvas.renderAll(); state.history = [JSON.stringify(canvas.document.fabric)]; renderLayers(); }); if (canvas.document.print) { el('sbs-print-method').value = canvas.document.print.method || 'dtg'; el('sbs-visual-treatment').value = canvas.document.print.visual_treatment || 'vintage-70-20-10'; el('sbs-brand-family').value = canvas.document.print.brand_mark || 'plain-copper'; el('sbs-print-width').value = canvas.document.print.width_inches; el('sbs-print-height').value = canvas.document.print.height_inches; el('sbs-print-dpi').value = canvas.document.print.dpi; updatePrintReadout(); } }).catch(handleError);
    }
    function prepareFreestyleCanvas() {
        var p=state.activeProject;if(!p||!p.concept||p.concept.type!=='freestyle'||!p.concept.merch_ready||!state.canvas)return;
        if(state.canvas.getObjects().some(function(o){return o.sbsType!=='guide';}))return;
        var settings=p.concept.settings||{},w=Number(settings.width||15),h=Number(settings.height||18),cw=900*Math.min(1,w/h),ch=cw*h/w;
        state.historyLock=true;state.canvas.getObjects().forEach(function(o){state.canvas.remove(o);});state.canvas.setDimensions({width:cw,height:ch});
        el('sbs-print-width').value=w;el('sbs-print-height').value=h;el('sbs-print-dpi').value=300;el('sbs-transparent').checked=settings.background==='transparent';
        el('sbs-visual-treatment').value=settings.treatment==='vintage'?'vintage-70-20-10':settings.treatment==='clean'?'clean':'custom';
        state.canvas.setBackgroundColor(el('sbs-transparent').checked?null:'#ffffff',state.canvas.renderAll.bind(state.canvas));addGuides();state.historyLock=false;updatePrintReadout();
        var g=state.selectedGeneration||p.generations.find(function(g){return g.uuid===p.concept.active_generation_uuid;})||p.generations[0];
        if(g)addCanvasImage({url:g.asset_url,label:p.title,sbsType:'artwork',fit:true});
    }
    var sbsPreflight = null;
    function runPrintPreflight() {
        ensureCanvas();
        var w=Math.round(Number(el('sbs-print-width').value)*Number(el('sbs-print-dpi').value));
        var h=Math.round(Number(el('sbs-print-height').value)*Number(el('sbs-print-dpi').value));
        var dpi=Number(el('sbs-print-dpi').value);
        var issues=[],warnings=[],sourceChecks=[],objects=state.canvas.getObjects().filter(function(o){return o.sbsType!=='guide' && o.visible!==false;});
        var scaleX=w/state.canvas.width,scaleY=h/state.canvas.height;
        if (!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1) issues.push('Invalid print dimensions');
        if (Math.abs(scaleX-scaleY)>0.001) issues.push('Print aspect ratio differs from artboard');
        if (dpi<300) warnings.push('Target print density is below 300 PPI');
        if (w<4500||h<5400) warnings.push('Below SmuttyBear default 4500 x 5400 pixel master target; supplier specifications may differ');
        if (!el('sbs-transparent').checked) warnings.push('Background is opaque; transparency is usually required for cutout T-shirt designs');
        if (!objects.length) issues.push('Canvas has no visible artwork');
        if (w*h>60000000) warnings.push('Large export may exhaust browser memory');
        objects.forEach(function(o) {
            if (o.type==='image' && o.width && o.height) {
                var sx=Math.abs(o.scaleX||1)*scaleX,sy=Math.abs(o.scaleY||1)*scaleY;
                if (sx>1.05||sy>1.05) warnings.push('Image layer '+(o.name||'unnamed')+' is enlarged beyond source pixels; target 300 PPI may need upscaling');
                var sourceCheck={name:o.name||'unnamed',effective_ppi:Math.round(dpi/Math.max(sx,sy)),alpha:'unverified'};
                try {
                    var source=o._originalElement||(o.getElement&&o.getElement()),sampler=document.createElement('canvas');sampler.width=128;sampler.height=128;var sc=sampler.getContext('2d');
                    sc.drawImage(source,o.cropX||0,o.cropY||0,o.width,o.height,0,0,128,128);var sourcePixels=sc.getImageData(0,0,128,128).data,sourceClear=0,sourcePartial=0;
                    for(var si=3;si<sourcePixels.length;si+=4){if(sourcePixels[si]===0)sourceClear++;else if(sourcePixels[si]<255)sourcePartial++;}
                    sourceCheck.alpha=sourceClear?'transparent':sourcePartial?'semi-transparent':'opaque';
                    if(el('sbs-transparent').checked&&!sourceClear)warnings.push('Image layer '+sourceCheck.name+' has no fully transparent sampled pixels; a transparent canvas does not remove an opaque image background');
                    if(el('sbs-print-method').value==='dtf'&&sourcePartial)warnings.push('Image layer '+sourceCheck.name+' contains semi-transparent pixels; inspect DTF edges');
                } catch(error){sourceCheck.alpha='unverified';}
                sourceChecks.push(sourceCheck);

            }
            if (o.sbsType==='exact_asset' && (o.width||0)*Math.abs(o.scaleX||1)*scaleX<200) warnings.push('Logo '+(o.name||'unnamed')+' is small; inspect legibility');
        });
        if (el('sbs-print-method').value==='dtf') warnings.push('DTF: inspect isolated dots, small details, transfer edges and supplier minimum feature sizes');
        else warnings.push('DTG: inspect halftones, gradients, garment contrast and underbase requirements');
        warnings.push('Inspect slogan spelling, facial details, print edges and supplier-specific requirements; visual perfection is not automatically verified');
        var alphaCheck={status:'unverified'},savedGuideStates=[];
        try {
            var guideObjects=state.canvas.getObjects().filter(function(o){return o.sbsType==='guide';});savedGuideStates=guideObjects.map(function(o){return o.visible;});guideObjects.forEach(function(o){o.visible=false;});
            var sample=state.canvas.toCanvasElement(Math.min(1,256/Math.max(state.canvas.width,state.canvas.height)),{enableRetinaScaling:false}),pixels=sample.getContext('2d').getImageData(0,0,sample.width,sample.height).data,clear=0,partial=0;
            for(var a=3;a<pixels.length;a+=4){if(pixels[a]===0)clear++;else if(pixels[a]<255)partial++;}
            alphaCheck={status:'sampled',transparent_pixels:clear,semi_transparent_pixels:partial,total_sampled:pixels.length/4};
            if(el('sbs-transparent').checked&&!clear)warnings.push('Transparent background requested but no fully transparent pixels were detected in the sample');
            if(el('sbs-print-method').value==='dtf'&&partial)warnings.push('Semi-transparent pixels detected: inspect alpha edges and halftone dots for DTF');
        } catch(error){warnings.push('Transparency could not be sampled; inspect the exported PNG manually');}
        finally {if(typeof guideObjects!=='undefined')guideObjects.forEach(function(o,i){o.visible=savedGuideStates[i];});state.canvas.renderAll();}
        var report={created_at:new Date().toISOString(),method:el('sbs-print-method').value,treatment:el('sbs-visual-treatment').value,output_pixels:{width:w,height:h},target_ppi:dpi,transparent_requested:el('sbs-transparent').checked,transparency_check:alphaCheck,source_checks:sourceChecks,errors:issues,warnings:warnings,automatic_verdict:issues.length?'FAIL':warnings.length?'REVIEW':'PASS',manual_override:false};
        sbsPreflight=report;
        el('sbs-preflight-results').textContent=report.automatic_verdict+' — '+(issues.length?issues.join('; ')+'; ':'')+warnings.join('; ');
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
                if (blob && blob.size) { resolve(blob); }
                else { reject(new Error('The browser could not create this composition PNG. Try reducing the canvas dimensions or image complexity.')); }
            }, 'image/png');
        });
    }
    function showExportDownloads(files) {
        var box = el('sbs-export-downloads');
        var heading = document.createElement('h2');
        heading.id = 'sbs-export-downloads-title'; heading.textContent = 'Your downloads are ready';
        var note = document.createElement('p');
        note.textContent = 'Download each file below. These are composition copies at the artboard dimensions; no print size or PPI has been prepared. Use Artwork Finishing for print checks. Preparing another export replaces these links.';
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
        ensureCanvas();
        var exportWidth=state.canvas.width,exportHeight=state.canvas.height;
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
            return state.canvas.toCanvasElement(1, { enableRetinaScaling: false });
        }
        buttonBusy(button, true);
        try {
            var files = [{ name: basename + '-composition.png', label: 'Download composition PNG ('+exportWidth+' × '+exportHeight+' px)', blob: await pngBlob(snapshot()) }];
            if (both) {
                logos.forEach(function (obj) { obj.visible = false; });
                files.push({ name: basename + '-logo-free-composition.png', label: 'Download logo-free composition PNG', blob: await pngBlob(snapshot()) });
            }
            showExportDownloads(files);
            showMessage('Composition PNG ready at the artboard size ('+exportWidth+' × '+exportHeight+' px). It has no print-size or PPI preparation; use Artwork Finishing for print checks.');
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
    function buttonBusy(button, busy) {
        if (!button) { return; }
        if (busy) {
            if (!button.hasAttribute('aria-busy')) {
                button.dataset.label = button.textContent;
                button.dataset.wasDisabled = button.disabled ? '1' : '0';
            }
            button.setAttribute('aria-busy', 'true');
            button.disabled = true;
            button.textContent = 'Processing…';
        } else {
            button.removeAttribute('aria-busy');
            if (button.dataset.label !== undefined) { button.textContent = button.dataset.label; delete button.dataset.label; }
            button.disabled = button.dataset.wasDisabled === '1';
            delete button.dataset.wasDisabled;
        }
    }
    function handleError(error) { showMessage(error.message || String(error), true); }

    document.addEventListener('DOMContentLoaded', function () {
        bindLogin(); bindPrimaryTabs(); bindTabs(); bindCharacters(); bindCharacterLibrary(); bindCreate(); bindImageModal(); bindGuide();
        installStudioHelp(); installImageSpecifications();
        freestyle = window.SBSFreestyle.init({state:state,el:el,esc:esc,api:api,post:post,loadBootstrap:loadBootstrap,replaceProject:replaceProject,trackJobs:trackJobs,showMessage:showMessage,handleError:handleError,zoom:openImageModal,openProject:function(uuid,generationUuid){
            if(state.canvas && !state.canvasUuid && state.canvas.getObjects().some(function(o){return o.sbsType!=='guide';}) && (!state.activeProject || state.activeProject.uuid!==uuid) && !window.confirm('Open this project and clear the current unsaved canvas? Save that canvas first if you want to keep it.'))return;
            var project=state.projects.find(function(p){return p.uuid===uuid;});if(!project)return;
            selectPack(project.pack_uuid);resetCanvasProject();state.activeProject=project;state.selectedGeneration=project.generations.find(function(g){return g.uuid===generationUuid;});renderProjects();renderCanvasOptions();activateTab('projects');
        }});
        bindLogoControls();
        if (el('sbs-run-preflight')) { el('sbs-run-preflight').addEventListener('click',runPrintPreflight); }
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
            'sbs-canvas-export': 'Export PNG renders the assembled composition at its artboard dimensions. It does not set print size or PPI; use Artwork Finishing for print preparation.',
            'sbs-canvas-save': 'Save design stores the editable composition so it can be reopened later.',
            'sbs-guide-open': 'Open the illustrated guide and workflow diagrams for character development, reference assets, image creation and composition.'
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
                // Keep the compact main navigation free of extra information
                // buttons. Other controls retain their contextual help.
                if (button.closest('.sbs-primary-tabs')) { return; }
                if (button.closest('.sbs-character-page-menu')) { return; }
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
