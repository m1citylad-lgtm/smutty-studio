(function () {
    'use strict';

    function init() {
        var root = document.getElementById('sbs-app');
        var panel = document.getElementById('sbs-logic-correction-panel');
        if (!root || !panel || panel.dataset.ready) { return; }
        panel.dataset.ready = '1';

        var $ = function (id) { return document.getElementById(id); };
        var workspace = $('sbs-lc-workspace');
        var version = $('sbs-lc-version');
        var selected = null;
        var records = [];
        var checks = [];
        var viewer = $('sbs-lc-viewer');
        var scale = 1;
        var tx = 0;
        var ty = 0;
        var pointers = new Map();
        var dragStart = null;
        var repairFinding = null;
        var repairJob = '';
        var repairTimer = 0;
        var repairBounds = null;
        var painting = false;

        function api(path, data, method) {
            var options = {
                method: method || (data ? 'POST' : 'GET'),
                credentials: 'same-origin',
                headers: {
                    'X-SBS-Request': 'studio',
                    'X-SBS-Finishing': root.getAttribute('data-finishing-csrf')
                }
            };
            if (data instanceof FormData) { options.body = data; }
            else if (data !== undefined && data !== null) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            }
            return fetch(root.getAttribute('data-rest') + 'logic-correction' + path, options).then(function (response) {
                return response.json().then(function (body) {
                    if (!response.ok) { throw new Error(body.message || 'Request failed'); }
                    return body;
                });
            });
        }

        function status(message, error) {
            $('sbs-lc-status').textContent = message;
            $('sbs-lc-status').setAttribute('role', error ? 'alert' : 'status');
        }

        function assetUrl(asset) { return asset && asset.url || ''; }

        function updateControls() {
            var ready = !!selected;
            $('sbs-lc-run-all').disabled = !ready;
            $('sbs-lc-save-version').disabled = !ready;
            $('sbs-lc-open-viewer').disabled = !ready;
            $('sbs-lc-version').disabled = !ready;
        }

        function renderChecks() {
            var list = $('sbs-lc-custom-checks');
            list.innerHTML = '';
            if (!checks.length) {
                var empty = document.createElement('p');
                empty.textContent = 'No extra checks saved. Add any checks you want included by default.';
                list.appendChild(empty);
                return;
            }
            checks.forEach(function (text, index) {
                var row = document.createElement('div');
                row.className = 'sbs-lc-custom-check';
                var label = document.createElement('label');
                label.textContent = 'Check ' + (index + 1);
                var input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 180;
                input.value = text;
                input.setAttribute('aria-label', 'Focused check ' + (index + 1));
                label.appendChild(input);
                var remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'sbs-button';
                remove.textContent = 'Remove';
                remove.addEventListener('click', function () {
                    checks.splice(index, 1);
                    renderChecks();
                    $('sbs-lc-check-status').textContent = 'Unsaved changes. Save focused checks to keep them.';
                });
                row.appendChild(label);
                row.appendChild(remove);
                list.appendChild(row);
            });
        }

        function currentVersion() {
            if (!selected) { return null; }
            return selected.versions.find(function (item) { return item.uuid === version.value; }) || selected.versions[0];
        }

        function render() {
            workspace.innerHTML = '<option value="">Choose an image</option>';
            records.forEach(function (record) {
                var option = document.createElement('option');
                option.value = record.uuid;
                option.textContent = record.title;
                workspace.appendChild(option);
            });
            if (!selected) {
                $('sbs-lc-preview').hidden = true;
                $('sbs-lc-empty').hidden = false;
                $('sbs-lc-findings').textContent = 'No image selected.';
                updateControls();
                return;
            }
            workspace.value = selected.uuid;
            version.innerHTML = '';
            selected.versions.forEach(function (item) {
                var option = document.createElement('option');
                option.value = item.uuid;
                option.textContent = 'Version ' + item.number + ' — ' + item.label;
                version.appendChild(option);
            });
            version.value = selected.current_version;
            var active = currentVersion();
            selected.activeVersion = active;
            var src = assetUrl(active && active.asset);
            $('sbs-lc-preview').src = src;
            $('sbs-lc-preview').hidden = !src;
            $('sbs-lc-empty').hidden = !!src;
            renderFindings(selected.reports && selected.reports[active.uuid] || {});
            updateControls();
        }

        function renderFindings(reports) {
            var list = $('sbs-lc-findings');
            list.innerHTML = '';
            var all = [];
            Object.keys(reports || {}).forEach(function (pass) {
                (reports[pass].findings || []).forEach(function (finding) { all.push({ finding: finding, pass: pass }); });
            });
            if (!all.length) {
                var empty = document.createElement('p');
                empty.textContent = 'No findings yet. Run all checks to review this image.';
                list.appendChild(empty);
                return;
            }
            all.forEach(function (item) {
                var finding = item.finding;
                var card = document.createElement('article');
                card.className = 'sbs-lc-finding ' + (finding.severity === 'concern' ? 'concern' : 'review');
                var heading = document.createElement('strong');
                heading.textContent = finding.severity === 'concern' ? 'Concern' : 'Needs review';
                card.appendChild(heading);
                var detail = document.createElement('p');
                detail.textContent = (finding.category ? finding.category + ': ' : '') + finding.issue;
                card.appendChild(detail);
                if (finding.action) {
                    var action = document.createElement('p');
                    action.textContent = 'Inspect: ' + finding.action;
                    card.appendChild(action);
                }
                var actions = document.createElement('div');
                actions.className = 'sbs-lc-finding-actions';
                var view = document.createElement('button');
                view.type = 'button';
                view.className = 'sbs-button';
                view.textContent = 'View marked area';
                view.addEventListener('click', function () { openViewer(finding); });
                actions.appendChild(view);
                var fix = document.createElement('button');
                fix.type = 'button';
                fix.className = 'sbs-button';
                fix.textContent = 'Fix this area';
                fix.disabled = !finding.bbox;
                fix.addEventListener('click', function () { openRepair(finding); });
                actions.appendChild(fix);
                card.appendChild(actions);
                list.appendChild(card);
            });
        }

        function load() {
            return api('').then(function (data) {
                records = data.records || [];
                checks = Array.isArray(data.checks) ? data.checks.slice(0, 20) : [];
                var reference = $('sbs-lc-reference');
                var previousReference = reference.value;
                reference.innerHTML = '<option value="">No character reference</option>';
                (data.references || []).forEach(function (item) {
                    var option = document.createElement('option');
                    option.value = item.uuid;
                    option.textContent = item.name + ' (' + item.count + ' references)';
                    reference.appendChild(option);
                });
                if (Array.from(reference.options).some(function (option) { return option.value === previousReference; })) { reference.value = previousReference; }
                if (selected) { selected = records.find(function (record) { return record.uuid === selected.uuid; }) || selected; }
                renderChecks();
                render();
            });
        }

        function chooseFile() { return $('sbs-lc-file').files[0] || $('sbs-lc-camera').files[0]; }

        function busyButton(button, label, action) {
            if (button.disabled) { return Promise.resolve(); }
            var original = button.innerHTML;
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = '<span class="sbs-lc-spinner" aria-hidden="true"></span> ' + label;
            return Promise.resolve().then(action).then(function (result) {
                button.innerHTML = '<span class="sbs-lc-tick" aria-hidden="true">✓</span> Complete';
                window.setTimeout(function () {
                    button.innerHTML = original;
                    button.removeAttribute('aria-busy');
                    updateControls();
                }, 1400);
                return result;
            }).catch(function (error) {
                button.innerHTML = original;
                button.removeAttribute('aria-busy');
                status(error.message, true);
                updateControls();
            });
        }

        $('sbs-lc-upload').addEventListener('click', function () {
            var file = chooseFile();
            var title = $('sbs-lc-title-input').value.trim();
            if (!file) { status('Choose a file or photo first.', true); return; }
            if (!title) { title = file.name.replace(/\.[^.]+$/, ''); $('sbs-lc-title-input').value = title; }
            var form = new FormData();
            form.append('file', file);
            form.append('title', title);
            busyButton(this, 'Uploading image', function () {
                return api('/upload', form).then(function (record) {
                    selected = record;
                    return load().then(function () { status('Original uploaded and preserved.'); });
                });
            });
        });

        workspace.addEventListener('change', function () {
            selected = records.find(function (record) { return record.uuid === workspace.value; }) || null;
            render();
        });
        version.addEventListener('change', function () {
            if (selected) { selected.current_version = version.value; render(); }
        });

        $('sbs-lc-add-check').addEventListener('click', function () {
            checks.push('');
            renderChecks();
            var inputs = $('sbs-lc-custom-checks').querySelectorAll('input');
            if (inputs.length) { inputs[inputs.length - 1].focus(); }
            $('sbs-lc-check-status').textContent = 'Unsaved changes. Save focused checks to keep them.';
        });
        $('sbs-lc-save-checks').addEventListener('click', function () {
            var values = Array.from($('sbs-lc-custom-checks').querySelectorAll('input')).map(function (input) { return input.value.trim(); }).filter(Boolean);
            busyButton(this, 'Saving checks', function () {
                return api('/checks', { checks: values }).then(function (data) {
                    checks = data.checks || [];
                    renderChecks();
                    $('sbs-lc-check-status').textContent = 'Focused checks saved and will run automatically.';
                });
            });
        });

        $('sbs-lc-run-all').addEventListener('click', function () {
            if (!selected) { return; }
            var chosen = $('sbs-lc-reference').value;
            var passes = ['whole', 'regions'];
            if (chosen) { passes.push('character'); }
            if (checks.some(function (item) { return item.trim(); })) { passes.push('custom'); }
            var button = this;
            var errors = [];
            var run = Promise.resolve();
            passes.forEach(function (pass, index) {
                run = run.then(function () {
                    button.innerHTML = '<span class="sbs-lc-spinner" aria-hidden="true"></span> Check ' + (index + 1) + ' of ' + passes.length;
                    $('sbs-lc-status').textContent = 'Running ' + passLabel(pass) + '…';
                    return api('/' + selected.uuid + '/review', {
                        version_uuid: selected.activeVersion.uuid,
                        pass: pass,
                        character_uuid: pass === 'character' ? chosen : ''
                    }).then(function (data) {
                        selected = data.record;
                        render();
                    }).catch(function (error) { errors.push(passLabel(pass) + ': ' + error.message); });
                });
            });
            busyButton(button, 'Starting checks', function () {
                return run.then(function () {
                    if (errors.length) { status('Some checks could not run: ' + errors.join(' · '), true); }
                    else { status('All selected checks are complete. Review findings before correcting anything.'); }
                });
            });
        });

        function passLabel(pass) {
            return { whole: 'whole-image check', regions: 'enlarged-region checks', character: 'character-reference check', custom: 'focused checks' }[pass] || pass;
        }

        $('sbs-lc-save-version').addEventListener('click', function () {
            var file = $('sbs-lc-version-file').files[0];
            if (!file) { status('Choose a corrected copy first.', true); return; }
            var form = new FormData();
            form.append('file', file);
            form.append('label', $('sbs-lc-version-label').value || 'Corrected copy');
            busyButton(this, 'Saving version', function () {
                return api('/' + selected.uuid + '/version', form).then(function (record) {
                    selected = record;
                    return load().then(function () { status('Saved as a separate version. Original retained.'); });
                });
            });
        });

        function transform() {
            var content = $('sbs-lc-viewer-content');
            if (content) { content.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; }
        }

        function openViewer(finding) {
            if (!selected) { return; }
            var active = currentVersion();
            $('sbs-lc-viewer-image').src = assetUrl(active.asset);
            var markers = $('sbs-lc-viewer-markers');
            markers.innerHTML = '';
            if (finding && finding.bbox) {
                var box = document.createElement('button');
                box.type = 'button';
                box.className = 'sbs-lc-marker ' + (finding.severity === 'concern' ? 'concern' : 'review');
                box.style.left = (finding.bbox.x * 100) + '%';
                box.style.top = (finding.bbox.y * 100) + '%';
                box.style.width = (finding.bbox.width * 100) + '%';
                box.style.height = (finding.bbox.height * 100) + '%';
                box.setAttribute('aria-label', 'Suspected area: ' + finding.issue);
                box.addEventListener('click', function (event) { event.stopPropagation(); zoomTo(finding.bbox); });
                markers.appendChild(box);
                $('sbs-lc-viewer-caption').textContent = finding.issue + ' · marker is approximate.';
            } else { $('sbs-lc-viewer-caption').textContent = 'Markers show approximate areas to inspect.'; }
            scale = 1; tx = 0; ty = 0; transform();
            viewer.showModal();
        }

        function zoomTo(box) {
            scale = 1; tx = 0; ty = 0; transform();
            var stage = $('sbs-lc-viewer-stage').getBoundingClientRect();
            var image = $('sbs-lc-viewer-image').getBoundingClientRect();
            var centerX = image.left + image.width * (box.x + box.width / 2);
            var centerY = image.top + image.height * (box.y + box.height / 2);
            scale = 3; tx = stage.left + stage.width / 2 - centerX; ty = stage.top + stage.height / 2 - centerY; transform();
        }

        $('sbs-lc-open-viewer').addEventListener('click', function () { openViewer(null); });
        $('sbs-lc-viewer-close').addEventListener('click', function () { viewer.close(); });
        $('sbs-lc-viewer-reset').addEventListener('click', function () { scale = 1; tx = 0; ty = 0; transform(); });
        var viewerStage = $('sbs-lc-viewer-stage');
        var pinch = null;
        viewerStage.addEventListener('pointerdown', function (event) {
            viewerStage.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.size === 1) { dragStart = { x: event.clientX, y: event.clientY, tx: tx, ty: ty }; }
            else if (pointers.size === 2) {
                var points = Array.from(pointers.values());
                pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale: scale };
            }
        });
        viewerStage.addEventListener('pointermove', function (event) {
            if (!pointers.has(event.pointerId)) { return; }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.size === 2) {
                var points = Array.from(pointers.values());
                var distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
                if (pinch && pinch.distance) { scale = Math.max(1, Math.min(6, pinch.scale * distance / pinch.distance)); transform(); }
            } else if (pointers.size === 1 && dragStart) {
                tx = dragStart.tx + event.clientX - dragStart.x;
                ty = dragStart.ty + event.clientY - dragStart.y;
                transform();
            }
        });
        ['pointerup', 'pointercancel'].forEach(function (name) {
            viewerStage.addEventListener(name, function (event) {
                pointers.delete(event.pointerId); pinch = null;
                if (pointers.size === 1) {
                    var point = Array.from(pointers.values())[0];
                    dragStart = { x: point.x, y: point.y, tx: tx, ty: ty };
                } else { dragStart = null; }
            });
        });
        viewerStage.addEventListener('wheel', function (event) {
            event.preventDefault();
            scale = Math.max(1, Math.min(6, scale * (event.deltaY < 0 ? 1.15 : .87)));
            transform();
        }, { passive: false });

        function openRepair(finding) {
            if (!selected || !finding.bbox) { return; }
            repairFinding = finding;
            repairJob = '';
            repairBounds = null;
            $('sbs-lc-repair-finding').textContent = finding.issue;
            $('sbs-lc-repair-prompt').value = 'Correct only the painted area: ' + finding.issue + '. Keep the surrounding pose, character, style, colours and lighting unchanged.';
            $('sbs-lc-repair-result').textContent = 'Paint over the pixels to change. Only those painted pixels will be replaced in the saved preview.';
            $('sbs-lc-repair-controls').hidden = false;
            $('sbs-lc-repair-preview-actions').hidden = true;
            $('sbs-lc-repair-preview').hidden = true;
            $('sbs-lc-repair-image').hidden = false;
            $('sbs-lc-repair-image').src = assetUrl(currentVersion().asset);
            $('sbs-lc-repair-image').onload = setupRepairCanvas;
            $('sbs-lc-repair-dialog').showModal();
        }

        function setupRepairCanvas() {
            var image = $('sbs-lc-repair-image');
            var mask = $('sbs-lc-repair-mask');
            var overlay = $('sbs-lc-repair-overlay');
            mask.width = image.naturalWidth; mask.height = image.naturalHeight;
            overlay.width = image.naturalWidth; overlay.height = image.naturalHeight;
            var maskContext = mask.getContext('2d');
            var overlayContext = overlay.getContext('2d');
            maskContext.clearRect(0, 0, mask.width, mask.height);
            overlayContext.clearRect(0, 0, overlay.width, overlay.height);
            repairBounds = null;
            $('sbs-lc-brush-readout').textContent = $('sbs-lc-brush-size').value + '%';
        }

        function repairPoint(event) {
            var rect = $('sbs-lc-repair-mask').getBoundingClientRect();
            var mask = $('sbs-lc-repair-mask');
            return { x: Math.max(0, Math.min(mask.width, (event.clientX - rect.left) * mask.width / rect.width)), y: Math.max(0, Math.min(mask.height, (event.clientY - rect.top) * mask.height / rect.height)) };
        }

        function paintSegment(from, to) {
            var mask = $('sbs-lc-repair-mask');
            var overlay = $('sbs-lc-repair-overlay');
            var size = Math.max(8, Math.min(mask.width, mask.height) * (Number($('sbs-lc-brush-size').value) / 100));
            [[mask.getContext('2d'), '#ffffff'], [overlay.getContext('2d'), 'rgba(31,190,255,.48)']].forEach(function (entry) {
                var context = entry[0];
                context.strokeStyle = entry[1]; context.fillStyle = entry[1]; context.lineWidth = size; context.lineCap = 'round'; context.lineJoin = 'round';
                context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
                context.beginPath(); context.arc(to.x, to.y, size / 2, 0, Math.PI * 2); context.fill();
            });
            var pad = size / 2;
            var bounds = { x: Math.max(0, Math.min(from.x, to.x) - pad), y: Math.max(0, Math.min(from.y, to.y) - pad), right: Math.min(mask.width, Math.max(from.x, to.x) + pad), bottom: Math.min(mask.height, Math.max(from.y, to.y) + pad) };
            if (!repairBounds) { repairBounds = bounds; }
            else {
                repairBounds.x = Math.min(repairBounds.x, bounds.x); repairBounds.y = Math.min(repairBounds.y, bounds.y);
                repairBounds.right = Math.max(repairBounds.right, bounds.right); repairBounds.bottom = Math.max(repairBounds.bottom, bounds.bottom);
            }
        }

        var maskCanvas = $('sbs-lc-repair-mask');
        var lastPoint = null;
        maskCanvas.addEventListener('pointerdown', function (event) {
            event.preventDefault(); maskCanvas.setPointerCapture(event.pointerId); painting = true;
            lastPoint = repairPoint(event); paintSegment(lastPoint, lastPoint);
        });
        maskCanvas.addEventListener('pointermove', function (event) {
            if (!painting) { return; }
            var point = repairPoint(event); paintSegment(lastPoint, point); lastPoint = point;
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (name) {
            maskCanvas.addEventListener(name, function () { painting = false; lastPoint = null; });
        });
        $('sbs-lc-brush-size').addEventListener('input', function () { $('sbs-lc-brush-readout').textContent = this.value + '%'; });
        $('sbs-lc-clear-mask').addEventListener('click', function () { setupRepairCanvas(); });

        function pollRepair() {
            if (!repairJob) { return Promise.resolve(); }
            return api('/' + selected.uuid + '/repair/' + repairJob).then(function (job) {
                if (job.status === 'pending') {
                    $('sbs-lc-repair-result').textContent = 'AI is preparing the local correction preview…';
                    repairTimer = window.setTimeout(pollRepair, 2500);
                    return;
                }
                if (job.status !== 'ready' || !job.preview) { throw new Error(job.message || 'The correction preview could not be created.'); }
                $('sbs-lc-repair-image').hidden = true;
                $('sbs-lc-repair-preview').src = assetUrl(job.preview);
                $('sbs-lc-repair-preview').hidden = false;
                $('sbs-lc-repair-controls').hidden = true;
                $('sbs-lc-repair-preview-actions').hidden = false;
                $('sbs-lc-repair-result').textContent = 'Preview ready. The original is unchanged. Undo it or save as a separate version.';
            }).catch(function (error) { $('sbs-lc-repair-result').textContent = error.message; });
        }

        $('sbs-lc-generate-repair').addEventListener('click', function () {
            var mask = $('sbs-lc-repair-mask');
            if (!selected || !repairBounds || !mask.width || !mask.height) { $('sbs-lc-repair-result').textContent = 'Paint over the area you want corrected first.'; return; }
            var prompt = $('sbs-lc-repair-prompt').value.trim();
            if (prompt.length < 4) { $('sbs-lc-repair-result').textContent = 'Describe the correction first.'; return; }
            var width = mask.width, height = mask.height;
            var padX = Math.max(32, (repairBounds.right - repairBounds.x) * .35);
            var padY = Math.max(32, (repairBounds.bottom - repairBounds.y) * .35);
            var bounds = { x: Math.max(0, repairBounds.x - padX), y: Math.max(0, repairBounds.y - padY), right: Math.min(width, repairBounds.right + padX), bottom: Math.min(height, repairBounds.bottom + padY) };
            bounds.width = bounds.right - bounds.x; bounds.height = bounds.bottom - bounds.y;
            var button = this;
            button.disabled = true;
            button.innerHTML = '<span class="sbs-lc-spinner" aria-hidden="true"></span> Sending correction';
            $('sbs-lc-repair-result').textContent = 'Sending a local crop for editing. This uses the configured image model and may incur usage charges.';
            api('/' + selected.uuid + '/repair', {
                version_uuid: currentVersion().uuid,
                prompt: prompt,
                bounds: { x: Math.round(bounds.x), y: Math.round(bounds.y), right: Math.round(bounds.right), bottom: Math.round(bounds.bottom) },
                mask: mask.toDataURL('image/png')
            }).then(function (job) {
                repairJob = job.job_uuid;
                if (!repairJob) { throw new Error(job.message || 'The repair request could not be started.'); }
                return pollRepair();
            }).catch(function (error) { $('sbs-lc-repair-result').textContent = error.message; }).finally(function () {
                button.disabled = false;
                button.innerHTML = 'Create AI preview';
            });
        });

        $('sbs-lc-undo-repair').addEventListener('click', function () {
            if (!repairJob || !selected) { $('sbs-lc-repair-dialog').close(); return; }
            var button = this;
            button.disabled = true;
            api('/' + selected.uuid + '/repair/' + repairJob, null, 'DELETE').catch(function () {}).finally(function () {
                window.clearTimeout(repairTimer); repairJob = ''; setupRepairCanvas();
                $('sbs-lc-repair-preview').hidden = true; $('sbs-lc-repair-image').hidden = false;
                $('sbs-lc-repair-controls').hidden = false; $('sbs-lc-repair-preview-actions').hidden = true;
                $('sbs-lc-repair-result').textContent = 'Preview discarded. The original is unchanged.';
                button.disabled = false;
            });
        });

        $('sbs-lc-save-repair').addEventListener('click', function () {
            if (!repairJob || !selected) { return; }
            var button = this;
            button.disabled = true;
            button.innerHTML = '<span class="sbs-lc-spinner" aria-hidden="true"></span> Saving version';
            api('/' + selected.uuid + '/repair/' + repairJob + '/accept', { label: 'AI local correction' }).then(function (record) {
                selected = record; repairJob = '';
                return load().then(function () {
                    $('sbs-lc-repair-dialog').close();
                    status('AI correction saved as a separate version. Original retained.');
                });
            }).catch(function (error) { $('sbs-lc-repair-result').textContent = error.message; }).finally(function () {
                button.disabled = false; button.innerHTML = 'Save as separate version';
            });
        });

        $('sbs-lc-repair-close').addEventListener('click', function () { closeRepair(); });
        $('sbs-lc-repair-dialog').addEventListener('cancel', function () { closeRepair(); });
        function closeRepair() {
            window.clearTimeout(repairTimer);
            if (repairJob && selected) { api('/' + selected.uuid + '/repair/' + repairJob, null, 'DELETE').catch(function () {}); }
            repairJob = '';
            $('sbs-lc-repair-dialog').close();
        }

        load().catch(function (error) { status(error.message, true); });
    }

    document.addEventListener('DOMContentLoaded', init);
    if (document.readyState !== 'loading') { init(); }
    window.SBSLogicCorrection = { init: init };
})();
