Warning: truncated output (original token count: 38298)
Total output lines: 1329

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
    function showSessionExpired() {
        var login = el('sbs-login'), workspace = el('sbs-workspace'), nav = el('sbs-primary-nav'), guide = el('sbs-guide-open');
        if (workspace) { workspace.hidden = true; }
        if (nav) { nav.hidden = true; }
        if (guide) { guide.hidden = true; }
        if (login) {
            login.hidden = false;
            var message = login.querySelector('.sbs-form-message');
            if (message) { message.textContent = 'Studio session expired. Sign in again to reload your saved workspaces.'; }
        }
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
                if (!response.ok) { if (response.status === 401 && data.code === 'studio_auth_required') { showSessionExpired(); } throw new Error(data.message || 'Request failed.'); }
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
                ['finishing', 'catalogue', 'logic-correction'].forEach(function (area) { document.querySelector('[data-panel="' + area + '"]').classList.toggle('active', target === area); });
                if (target === 'freestyle' && freestyle) { freestyle.render(); }
                if (target === 'usage') { loadUsage(); }
                if (target === 'settings') { loadUpdates(); }
            });
        });
    }

    function bindTabs() {
        var menu = el('sbs-character-page-menu');
        document.querySelectorAll('.sbs-tabs button').forEach(function (button) {
            button.addEventListener('click', function () {
                document.querySelectorAll('.sbs-tabs button').forEach(function (item) { item.classList.toggle('active', item === button); });
                document.querySelectorAll('.sbs-tabs button').forEach(function (item) { item.removeAttribute('aria-current'); });
                button.setAttribute('aria-current', 'page');
                document.querySelectorAll('.sbs-panel').forEach(function (panel) { panel.classList.toggle('active', panel.getAttribute('data-panel') === button.getAttribute('data-tab')); });
                el('sbs-character-page-current').textContent = button.textContent.replace(/^\s*\d+\.\s*/, '').trim();
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
        var filter = el('sbs-character-library-filter'), list = el('…32298 tokens truncated…sabled;
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
            document.querySelectorAll('.sbs-af[data-panel="finishing"] .sbs-info-button').forEach(function (button) { button.remove(); });
            document.querySelectorAll('button:not(.sbs-info-button):not(.sbs-fs-thumbnail):not(.sbs-image-zoom):not(.sbs-modal-close):not(#sbs-explain-close)').forEach(function (button) {
                // Keep compact navigation, Catalogue, and Finishing free from extra information buttons.
                if (button.closest('.sbs-primary-tabs')) { return; }
                if (button.closest('.sbs-character-page-menu')) { return; }
                if (button.closest('.sbs-af[data-panel="catalogue"]')) { return; }
                if (button.closest('.sbs-af[data-panel="finishing"]')) { return; }
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
