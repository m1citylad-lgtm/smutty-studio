(function () {
    'use strict';
    function recentSix(generations, selectedUuid) {
        var recent = generations.slice(0, 6), selected = generations.find(function (g) { return g.uuid === selectedUuid; });
        if (selected && !recent.some(function (g) { return g.uuid === selectedUuid; })) { recent = generations.slice(0, 5).concat([selected]); }
        return recent.slice().reverse();
    }
    function branch(generations, uuid) {
        var byId = {}, visited = {}, result = [], current = generations.find(function (g) { return g.uuid === uuid; });
        generations.forEach(function (g) { byId[g.id] = g; });
        while (current && !visited[current.uuid]) { visited[current.uuid] = true; result.unshift(current); current = byId[current.parent_id]; }
        return result;
    }
    function classifyTransparency(data) {
        if(!data||!data.length||data.length%4)throw new Error('Decoded pixels are unavailable');
        var clear=false,partial=false;
        for(var i=3;i<data.length;i+=4){if(data[i]===0)clear=true;else if(data[i]<255)partial=true;}
        return partial?'Partial alpha':clear?'Genuine transparency':'Opaque';
    }
    function designBrief(project, generation) {
        if (!project) return '';
        var key=generation?generation.uuid:'initial', saved=project.concept.design_briefs||{};
        if(Object.prototype.hasOwnProperty.call(saved,key))return saved[key];
        var path=generation?branch(project.generations||[],generation.uuid).reverse():[];
        for(var i=0;i<path.length;i++){if(path[i].freestyle_brief!=null)return path[i].freestyle_brief;}
        return project.concept.original_brief||'';
    }
    function supportReport(job, project, version) {
        var p=job.payload||{},e=job.error||{},d=e.moderation_details||{},source=(project.generations||[]).find(function(g){return g.id===Number(p.parent_id||p.generation_id);});
        return ['Smutty Studio — request for review of a possible false positive',
            'Please review the recorded rejection. I am not assuming that the decision was an error.',
            'Studio version: '+(version||'See live header'),'Project: '+project.title,'Project UUID: '+project.uuid,
            'Job UUID: '+job.uuid,'Date (UTC): '+(job.created_at||'Not supplied'),
            'Provider: '+(job.provider||'Not supplied'),'Model: '+(p.model||'Not recorded'),
            'Action: '+(p.action||job.type||'Not supplied'),'Status: '+job.status,
            'Source generation UUID: '+(source?source.uuid:'No source / not recorded'),
            'Source asset UUID: '+(source&&source.asset_uuid||'Not recorded'),
            'Error code: '+(e.code||'Not supplied'),'Provider response ID: '+(e.response_id||'Not supplied'),
            'Image call ID: '+(e.image_call_id||'Not supplied'),
            'Moderation stage: '+(d.moderation_stage||'Not supplied'),'Categories: '+((d.categories||[]).join(', ')||'Not supplied'),
            'Provider message: '+(e.message||'Not supplied'),
            '\nUnapplied instruction:\n'+(p.freestyle_instruction||p.scene_prompt||'Not recorded'),
            '\nDesign brief sent:\n'+(p.freestyle_brief!=null?p.freestyle_brief:'Not recorded for this older request'),
            '\nEffective prompt sent:\n'+(p.prompt||'Not recorded'),
            '\nThis report does not submit or retry a generation. Existing artwork is retained.'
        ].join('\n');
    }
    function init(ctx) {
        var el=ctx.el, esc=ctx.esc, active='', chosen={}, jobs={}, pending=false, redo={}, choice='', loaded='', draftLoaded='', seenComplete={},supportKey='',fileOperation='',refsKey='',referenceChoices=[];
        function read(key, fallback) { try { return window.localStorage.getItem('sbs-freestyle:'+key) || fallback; } catch(e) { return fallback; } }
        function save(key,value) { try { window.localStorage.setItem('sbs-freestyle:'+key,value); } catch(e) {} }
        active=read('session','');choice=read('new-character','');
        function projects() { return ctx.state.projects.filter(function(p){return p.concept && p.concept.type==='freestyle';}); }
        function project() { return projects().find(function(p){return p.uuid===active;}) || null; }
        function generations() { var p=project();return p?(p.generations||[]).filter(function(g){return g.asset_url;}):[]; }
        function selected() { var p=project(),gs=generations();return gs.find(function(g){return g.uuid===(chosen[active]||read('selected:'+active,'')||p.concept.active_generation_uuid);}) || gs[0] || null; }
        function isJob(job) { return !!(job.payload && (job.payload.purpose==='freestyle' || ctx.state.projects.some(function(p){return p.id===Number(job.payload.project_id) && p.concept && p.concept.type==='freestyle';}))); }
        function jobRows() { var p=project(),all={};(p&&p.jobs||[]).forEach(function(j){all[j.uuid]=j;});Object.keys(jobs).forEach(function(k){var j=jobs[k];if(p&&j.payload&&Number(j.payload.project_id)===p.id)all[k]=j;});return Object.keys(all).map(function(k){return all[k];}); }
        function busy() {return pending || jobRows().some(function(j){return !['completed','failed','blocked','cancelled'].includes(j.status);});}
        var styleChoices=JSON.parse(el('sbs-fs-style').getAttribute('data-styles')||'{}'),legacyStyles=JSON.parse(el('sbs-fs-style').getAttribute('data-legacy-styles')||'{}'),appliedStyles=['house'],stylesPending=false;
        function settings() {var bg=el('sbs-fs-background').value;return {style:appliedStyles[0],styles:appliedStyles.slice(),treatment:el('sbs-fs-treatment').value,background:bg==='opaque'?'opaque':'transparent',transparency:bg==='transparent-print'?'print':bg==='transparent-soft'?'soft':'standard',size:el('sbs-fs-size').value,width:15,height:18,dpi:300};}
        function rememberedStyles(){var values;try{values=JSON.parse(read('last-styles','null'));}catch(e){}if(!Array.isArray(values))values=[read('last-style','house')];values=values.filter(function(key,index){return !!styleChoices[key]&&values.indexOf(key)===index;});return values.length?values:['house'];}
        function rememberedStyle(){return rememberedStyles()[0];}
        function paintStyles(){
            var choices=Object.assign({},styleChoices);appliedStyles.forEach(function(key){if(!choices[key]&&legacyStyles[key])choices[key]='Saved style: '+legacyStyles[key];});
            el('sbs-fs-style-choices').innerHTML=Object.keys(choices).map(function(key){return '<label class="sbs-fs-style-choice"><input type="checkbox" value="'+esc(key)+'"'+(appliedStyles.includes(key)?' checked':'')+'> <span>'+esc(choices[key])+'</span></label>';}).join('');
            el('sbs-fs-style').value=appliedStyles[0];stylesPending=false;el('sbs-fs-style-pending').textContent='';
            el('sbs-fs-style-summary').textContent='Drawing styles — '+appliedStyles.length+' applied';
            el('sbs-fs-styles-applied').textContent=appliedStyles.length+' style'+(appliedStyles.length===1?'':'s')+' applied: '+appliedStyles.map(function(key){return choices[key]||key;}).join(' + ');
        }
        function applySettings(s) {
            s=s||{};var values=Array.isArray(s.styles)?s.styles:s.style?[s.style]:['house'];appliedStyles=values.filter(function(key,index){return !!(styleChoices[key]||legacyStyles[key])&&values.indexOf(key)===index;});if(!appliedStyles.length)appliedStyles=['house'];paintStyles();el('sbs-fs-style-menu').open=false;
            ['treatment','size'].forEach(function(k){if(s[k]!=null)el('sbs-fs-'+k).value=s[k];});
            el('sbs-fs-background').value=s.background==='opaque'?'opaque':s.transparency==='print'?'transparent-print':s.transparency==='soft'?'transparent-soft':s.transparency==='print'?'transparent-print':'transparent';
        }
        function importedSource(){var p=project(),g=selected();return p&&g?branch(p.generations||[],g.uuid).find(function(v){return v.action==='upload';}):null;}
        function referenceAssets(){return (project()&&project().assets||[]).filter(function(a){return a.role==='freestyle_reference';});}
        function referenceSelection(){if(refsKey!==active){refsKey=active;try{referenceChoices=JSON.parse(read('references:'+active,'[]'));}catch(e){referenceChoices=[];}if(!Array.isArray(referenceChoices))referenceChoices=[];}return referenceChoices.filter(function(uuid){return referenceAssets().some(function(a){return a.uuid===uuid;});});}
        function uploadFile(file,mode,parent){
            if(busy())return Promise.resolve();if(!file){ctx.showMessage('Choose an image file first.',true);return Promise.resolve();}
            if(file.size>20*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){ctx.showMessage('Choose a PNG, JPEG or WebP image up to 20 MB.',true);return Promise.resolve();}
            var previousActive=active;var form=new FormData();form.append('file',file);form.append('mode',mode);form.append('project_uuid',active);form.append('pack_uuid',el('sbs-fs-character').value);form.append('title',el('sbs-fs-title').value);form.append('label',el('sbs-fs-upload-label').value||file.name);form.append('settings',JSON.stringify(settings()));if(parent)form.append('parent_uuid',parent);
            preserveInputs();pending=true;fileOperation='Saving uploaded '+(mode==='reference'?'reference':'artwork copy')+'…';el('sbs-fs-file-status').textContent=fileOperation;render();
            return ctx.api('freestyle/upload',{method:'POST',body:form}).then(function(data){var uploadDraft=el('sbs-fs-instruction').value;
                ctx.replaceProject(data.project);active=data.project.uuid;save('session',active);loaded=mode==='reference'&&previousActive===active?active:'';if(!previousActive){save('draft:'+active+':initial',uploadDraft);}
                if(data.generation_uuid){chosen[active]=data.generation_uuid;save('selected:'+active,data.generation_uuid);redo[active]=[];save('allow-edit:'+active,'no');}
                if(mode==='reference'){refsKey=active;try{referenceChoices=JSON.parse(read('references:'+active,'[]'));}catch(e){referenceChoices=[];}if(!Array.isArray(referenceChoices))referenceChoices=[];if(referenceChoices.length<6)referenceChoices.push(data.asset.uuid);save('references:'+active,JSON.stringify(referenceChoices));}
                el('sbs-fs-upload-file').value='';el('sbs-fs-file-status').textContent=mode==='reference'?'Reference saved. Tick it below to guide the next generation.':'Artwork saved as a separate version. No generation or upscale was run.';return true;
            }).catch(function(error){el('sbs-fs-file-status').textContent='Upload failed: '+error.message;ctx.handleError(error);return false;}).finally(function(){pending=false;fileOperation='';render();});
        }
        function currentDraftKey() {var g=selected();return 'draft:'+(active||'new')+':'+(g?g.uuid:'initial');}
        function preserveInputs(){save(currentDraftKey(),el('sbs-fs-instruction').value);}
        function jobByUuid(uuid){return jobRows().find(function(j){return j.uuid===uuid;});}
        function restoreInstruction(uuid) {
            var j=jobByUuid(uuid),g=selected();if(!j||busy())return;
            if(el('sbs-fs-instruction').value.trim()){ctx.showMessage('Your unsent instruction is safe. Clear or save it before restoring the failed instruction.',true);return;}
            if(Number(j.payload.parent_id||0)!==Number(g&&g.id||0)){ctx.showMessage('Select the source image for this failed instruction first. Your current image and draft are unchanged.',true);return;}
            el('sbs-fs-instruction').value=j.payload.freestyle_instruction||'';
            save(currentDraftKey(),el('sbs-fs-instruction').value);el('sbs-fs-instruction').focus();render();
            ctx.showMessage('Failed instruction restored for editing. Nothing has been submitted.');
        }
        async function inspectTransparency(generation) {
            var status=el('sbs-fs-transparency');if(!selected()||selected().uuid!==generation.uuid)return;status.textContent='Transparency: Not checked';status.dataset.state='unknown';
            try {
                var image=new Image();image.src=generation.asset_url;await image.decode();
                var total=image.naturalWidth*image.naturalHeight;if(!image.naturalWidth||!image.naturalHeight||total>32000000)throw new Error('Image too large to inspect');
                var canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
                var context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Pixel inspection unavailable');
                context.drawImage(image,0,0);var result=classifyTransparency(context.getImageData(0,0,canvas.width,canvas.height).data);
                if(selected()&&selected().uuid===generation.uuid){status.textContent='Transparency: '+result;status.dataset.state=result==='Opaque'?'opaque':result==='Partial alpha'?'partial':'transparent';}
            } catch(error) {if(selected()&&selected().uuid===generation.uuid){status.textContent='Transparency: Not checked';status.dataset.state='unknown';}}
        }
        function showSupport(uuid) {
            var j=jobByUuid(uuid),p=project();if(!j||!p)return;
            supportKey=active;el('sbs-fs-support-text').value=supportReport(j,p,el('sbs-app').getAttribute('data-version'));el('sbs-fs-support').hidden=false;el('sbs-fs-support-text').focus();
        }
        function setSelection(uuid,persist) {
            preserveInputs();
            chosen[active]=uuid;save('selected:'+active,uuid);
            var g=selected();if(g&&g.freestyle_settings)applySettings(g.freestyle_settings);
            render();
            if(persist&&project())ctx.post('freestyle/select',{project_uuid:active,generation_uuid:uuid}).then(ctx.replaceProject).catch(ctx.handleError);
        }
        function onJob(job) {
            jobs[job.uuid]=job;
            if(job.status==='completed'&&job.result&&job.result.generation_uuid&&!seenComplete[job.uuid]){
                seenComplete[job.uuid]=true;
                var p=ctx.state.projects.find(function(p){return p.id===Number(job.payload.project_id);});
                if(p){var parent=(p.generations||[]).find(function(g){return Number(g.id)===Number(job.payload.parent_id||0);}),previousUuid=parent&&parent.uuid||'',draftKey='draft:'+p.uuid+':'+(previousUuid||'initial'),draft=read(draftKey,''),submitted=String(job.payload.freestyle_instruction||'').trim(),stillOnParent=p.uuid===active&&currentDraftKey()===draftKey;if(stillOnParent)draft=el('sbs-fs-instruction').value;if(submitted&&draft.trim()===submitted){save(draftKey,'');if(stillOnParent)el('sbs-fs-instruction').value='';}chosen[p.uuid]=job.result.generation_uuid;save('selected:'+p.uuid,job.result.generation_uuid);redo[p.uuid]=[];loadFreestyleSources(true);}
            }
        }
        function startNew(pack) {
            if(pending)return;
            preserveInputs();active='';choice=pack||'';save('new-character',choice);loaded='';save('session','');
            el('sbs-fs-title').value='';el('sbs-fs-instruction').value=read('draft:new:initial','');
            applySettings({style:rememberedStyle(),styles:rememberedStyles(),treatment:'vintage',background:'transparent',transparency:'print',size:'1024x1536',width:15,height:18});render();
        }
        function stage(letter,done,text) {var node=el('sbs-fs-step-'+letter);node.classList.toggle('done',done);node.querySelector('strong').textContent=(done?'✓ ':'○ ')+text;}
        var freestyleSources=[],sourcesLoaded=false,sourcesBusy=false;
        async function loadFreestyleSources(force) {
            if(sourcesBusy||(!force&&sourcesLoaded))return;sourcesBusy=true;
            var list=el('sbs-fs-finishing-sources');list.textContent='Loading completed Freestyle images…';
            try{var result=await ctx.api('finishing/freestyle-sources');freestyleSources=result.sources||[];sourcesLoaded=true;paintFreestyleSources();}
            catch(error){list.textContent='Freestyle images could not be loaded. Try opening Freestyle again.';}
            finally{sourcesBusy=false;}
        }
        function paintFreestyleSources() {
            var list=el('sbs-fs-finishing-sources');list.replaceChildren();
            if(!freestyleSources.length){list.textContent='No completed Freestyle images yet.';return;}
            freestyleSources.forEach(function(source){
                var row=document.createElement('article');row.className='sbs-fs-source-row';
                var image=document.createElement('img');image.src=source.asset_url;image.alt='';image.loading='lazy';
                var details=document.createElement('div');var title=document.createElement('strong');title.textContent=source.project_title||'Freestyle image';
                var meta=document.createElement('p');meta.textContent='Version '+source.version_number+' · '+new Date(source.created_at).toLocaleString();
                var button=document.createElement('button');button.type='button';button.className='sbs-button';button.textContent='Open in Artwork Finishing';button.setAttribute('aria-label','Open '+title.textContent+', version '+source.version_number+', in Artwork Finishing');button.disabled=busy();
                button.addEventListener('click',async function(){button.disabled=true;var status=el('sbs-fs-handoff-status');status.textContent='Copying this image and its history into Artwork Finishing…';try{var response=await fetch(el('sbs-app').getAttribute('data-rest')+'finishing/freestyle-source',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-SBS-Request':'studio','X-SBS-Finishing':el('sbs-app').getAttribute('data-finishing-csrf')},body:JSON.stringify({project_uuid:source.project_uuid,generation_uuid:source.uuid})});var record=await response.json();if(!response.ok)throw new Error(record.message||'Source could not be copied.');status.textContent='Copied to Artwork Finishing. The source and history are unchanged; this is not print approval.';window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:record}));var tab=document.querySelector('[data-primary-tab="finishing"]');if(tab)tab.click();}catch(error){status.textContent='Could not open this image: '+error.message;button.disabled=false;}});
                details.appendChild(title);details.appendChild(meta);details.appendChild(button);row.appendChild(image);row.appendChild(details);list.appendChild(row);
            });
        }
        function render() {
            if(!el('sbs-fs-panel') && !el('sbs-freestyle-panel'))return;
            var p=project(),g=selected(),gs=generations(),running=busy()||!!(chosen[active]&&!gs.some(function(image){return image.uuid===chosen[active];}));
            if(active&&!p&&ctx.state.freestyleReady){active='';save('session','');}
            var session=el('sbs-fs-session');session.innerHTML='<option value="">New experiment</option>'+projects().map(function(p){return '<option value="'+esc(p.uuid)+'">'+esc(p.title)+'</option>';}).join('');session.value=active;
            var character=el('sbs-fs-character');character.innerHTML='<option value="">No character — completely new idea</option>'+ctx.state.packs.filter(function(p){return p.uuid!==ctx.state.freestylePackUuid;}).map(function(p){return '<option value="'+esc(p.uuid)+'">'+esc(p.name)+'</option>';}).join('');
            character.value=p?(p.concept.character_uuid||''):choice;
            if(loaded!==(p?active:'new')) {
                loaded=p?active:'new';el('sbs-fs-title').value=read('title:'+(active||'new'),p?p.title:'');
                applySettings(p?p.concept.settings:{style:rememberedStyle(),styles:rememberedStyles(),treatment:'vintage',background:'transparent',transparency:'print',size:'1024x1536',width:15,height:18});
            }
            var nextDraftKey=currentDraftKey();if(draftLoaded!==nextDraftKey){draftLoaded=nextDraftKey;el('sbs-fs-instruction').value=read(nextDraftKey,'');}el('sbs-fs-support').hidden=supportKey!==active||!supportKey;
            var thumbs=el('sbs-fs-thumbnails');thumbs.innerHTML=recentSix(gs,g&&g.uuid).map(function(image){var n=gs.length-gs.findIndex(function(x){return x.uuid===image.uuid;});var isSelected=!!g&&g.uuid===image.uuid;return '<button type="button" class="sbs-fs-thumbnail'+(isSelected?' selected':'')+'" data-fs-image="'+esc(image.uuid)+'" aria-pressed="'+(isSelected?'true':'false')+'" aria-label="Version '+n+(isSelected?', selected':'')+'"><img src="'+esc(image.asset_url)+'" alt="Version '+n+'"><span>Version '+n+(isSelected?' · Selected':'')+'</span></button>';}).join('');
            thumbs.querySelectorAll('[data-fs-image]').forEach(function(button){button.addEventListener('click',function(){redo[active]=[];setSelection(button.getAttribute('data-fs-image'),true);});});
            el('sbs-fs-empty').hidden=!!g;el('sbs-fs-zoom').hidden=!g;
            if(g&&el('sbs-fs-image').getAttribute('src')!==g.asset_url){el('sbs-fs-transparency').textContent='Transparency: Not checked';el('sbs-fs-transparency').dataset.state='unknown';el('sbs-fs-image').src=g.asset_url;}
            if(!g){el('sbs-fs-image').removeAttribute('src');el('sbs-fs-image-info').textContent='';el('sbs-fs-transparency').textContent='Transparency: Not checked';el('sbs-fs-transparency').dataset.state='unknown';}
            var path=g?branch(gs,g.uuid):[];
            var original=importedSource(),allowed=read('allow-edit:'+active,'no')==='yes';el('sbs-fs-edit-lock').hidden=!original;el('sbs-fs-allow-edit').checked=allowed;if(original){el('sbs-fs-original').href=original.asset_url;}
            var refs=referenceSelection();el('sbs-fs-references').innerHTML=referenceAssets().map(function(a){return '<label class="sbs-fs-reference"><input type="checkbox" data-fs-ref="'+esc(a.uuid)+'"'+(refs.includes(a.uuid)?' checked':'')+'><img src="'+esc(a.url)+'" alt=""><span>'+esc(a.label||a.filename)+'</span></label>';}).join('');
            el('sbs-fs-references').querySelectorAll('[data-fs-ref]').forEach(function(box){box.disabled=running;box.addEventListener('change',function(){var values=Array.from(el('sbs-fs-references').querySelectorAll('input:checked')).map(function(x){return x.getAttribute('data-fs-ref');});if(values.length>6){box.checked=false;ctx.showMessage('Select up to six references.',true);return;}referenceChoices=values;save('references:'+active,JSON.stringify(values));});});
            el('sbs-fs-upload').disabled=running;
            el('sbs-fs-background-note').textContent=el('sbs-fs-background').value==='opaque'?'Background: opaque. A solid or scenic background becomes part of the image.':el('sbs-fs-background').value==='transparent-soft'?'Background: transparent with soft edges or effects. Check partial transparency before printing.':el('sbs-fs-background').value==='transparent'?'Background: transparent cutout. Inspect the natural edges.':'Background: transparent, solid print colour. Empty areas show the shirt; artwork colours should stay solid.';
            el('sbs-fs-core-brief').textContent='Saved core brief: '+(designBrief(p,g)||'No core brief saved yet.');
            el('sbs-fs-conversation').innerHTML=path.map(function(turn,index){return '<li><strong>Instruction '+(index+1)+(turn.action==='upscale'?' · upscale':'')+'</strong><p>'+esc(turn.freestyle_instruction||(turn.action==='upscale'?'AI upscale '+turn.quality:turn.action==='upload'?'Uploaded original — unchanged':turn.action==='background_remove'?'Flat background removed into a separate copy':'Initial design'))+'</p></li>';}).join('')||'<li>Describe your first idea below.</li>';
            el('sbs-fs-undo').disabled=running||!g||!gs.some(function(x){return x.id===g.parent_id;});el('sbs-fs-redo').disabled=running||!(redo[active]||[]).length;
            var rows=jobRows().sort(function(a,b){return a.id-b.id;}),activeJobs=rows.filter(function(j){return !['completed','failed','blocked','cancelled'].includes(j.status);});
            if(!activeJobs.length)activeJobs=rows.slice(-1);
            var statusMarkup=(pending?'<p role="status">'+(fileOperation||'Submitting your instruction…')+'</p><progress max="100" aria-label="'+(fileOperation||'Submitting instruction')+'"></progress>':'')+activeJobs.map(function(j){var done=j.status==='completed', live=!['completed','failed','blocked','cancelled'].includes(j.status);var status=done?'Completed — 100%':j.status==='running'?'Generating — provider does not supply a measured percentage':j.status==='submitted'||j.status==='queued'?'Queued — waiting for provider':j.status;return '<p role="status">'+esc(status)+'</p>'+(live||done?'<progress max="100"'+(done?' value="100"':'')+' aria-label="'+esc(status)+'"></progress>':'')+(j.poll_error?'<p>Connection interrupted; retrying.</p>':'')+(j.error&&j.error.message?'<p>'+esc(j.error.message)+'</p>':'')+(j.error&&j.error.moderation_details?'<details><summary>Safety check details</summary><p>Stage: '+esc(j.error.moderation_details.moderation_stage||'unknown')+'</p><p>Provider categories: '+esc((j.error.moderation_details.categories||[]).join(', ')||'Not supplied')+'</p><p>These are broad provider labels, not a judgement about your intent.</p></details>':'')+(j.status==='failed'&&j.provider==='openai'&&!(j.error&&j.error.diagnostics_version===2)?'<button type="button" class="sbs-button" data-fs-explain="'+esc(j.uuid)+'">Show provider failure details</button>':'')+(['failed','blocked'].includes(j.status)&&j.payload&&j.payload.freestyle_instruction?'<p><strong>Unapplied instruction:</strong> '+esc(j.payload.freestyle_instruction)+'</p><button type="button" class="sbs-button" data-fs-restore="'+esc(j.uuid)+'">Restore failed instruction</button>':'')+(['failed','blocked'].includes(j.status)?'<button type="button" class="sbs-button" data-fs-support="'+esc(j.uuid)+'">Prepare support review details</button>':'')+(live?'<button type="button" class="sbs-button" data-fs-cancel="'+esc(j.uuid)+'">Cancel generation</button>':'');}).join('');
            ['sbs-fs-progress','sbs-fs-submit-status'].forEach(function(id){el(id).innerHTML=statusMarkup;el(id).querySelectorAll('[data-fs-restore]').forEach(function(b){b.addEventListener('click',function(){restoreInstruction(b.getAttribute('data-fs-restore'));});});el(id).querySelectorAll('[data-fs-support]').forEach(function(b){b.addEventListener('click',function(){showSupport(b.getAttribute('data-fs-support'));});});el(id).querySelectorAll('[data-fs-explain]').forEach(function(b){b.addEventListener('click',function(){b.disabled=true;ctx.api('jobs/'+b.getAttribute('data-fs-explain')+'?explain=1').then(function(j){onJob(j);render();}).catch(function(error){b.disabled=false;ctx.handleError(error);});});});el(id).querySelectorAll('[data-fs-cancel]').forEach(function(b){b.addEventListener('click',function(){ctx.api('jobs/'+b.getAttribute('data-fs-cancel'),{method:'DELETE'}).then(function(j){onJob(j);render();}).catch(ctx.handleError);});});});
            el('sbs-fs-submit').disabled=running||!!(original&&!allowed);el('sbs-fs-submit').textContent=g?'Apply next instruction to selected image':'Create one image';
            el('sbs-fs-character').disabled=pending;el('sbs-fs-session').disabled=pending;el('sbs-fs-new').disabled=pending;
            var latestJob=rows[rows.length-1],failedTurn=latestJob&&['failed','blocked'].includes(latestJob.status)&&latestJob.payload&&latestJob.payload.purpose==='freestyle'&&(!g||Number(latestJob.payload.parent_id)===g.id);
            stage('a',true,(p?p.concept.character_uuid:choice)?'Character selected':'New composition');stage('b',!!g,g?'Image ready':'Waiting for first image');stage('c',!!g&&!running&&!failedTurn&&!el('sbs-fs-instruction').value.trim(),running?(fileOperation||'Generating'):failedTurn?'Instruction not applied':el('sbs-fs-instruction').value.trim()?'Draft ready to submit':g?'Instructions applied':'Ready for your idea');stage('d',!!g,g?'Image ready to open in Artwork Finishing':'Choose an image to continue to Artwork Finishing');
        }
        function submit(event) {
            event.preventDefault();if(busy())return;if(importedSource()&&read('allow-edit:'+active,'no')!=='yes'){ctx.showMessage('Uploaded artwork is protected. Tick Allow AI editing only if you want a separate edited copy.',true);return;}if(stylesPending){ctx.showMessage('Press Apply styles before generating.',true);el('sbs-fs-style-apply').focus();return;}
            var instruction=el('sbs-fs-instruction').value.trim(),g=selected(),s=settings(),brief=g?designBrief(project(),g):instruction,finishing=!!importedSource();
            if(instruction.length<3){ctx.showMessage('Describe your idea or next change first.',true);el('sbs-fs-instruction').focus();return;}
            save('last-style',s.style);save('last-styles',JSON.stringify(s.styles));preserveInputs();pending=true;render();
            ctx.post('freestyle',{project_uuid:active,parent_uuid:g?g.uuid:'',pack_uuid:el('sbs-fs-character').value,title:el('sbs-fs-title').value,instruction:instruction,design_brief:brief,settings:s,reference_uuids:referenceSelection(),finishing:finishing}).then(function(data){var wasNew=!active;ctx.replaceProject(data.project);active=data.project.uuid;if(finishing)save('allow-edit:'+active,'no');save('session',active);loaded=active;el('sbs-fs-title').value=data.project.title;save('title:'+active,data.project.title);save('title:new','');save(currentDraftKey(),el('sbs-fs-instruction').value);draftLoaded=currentDraftKey();if(wasNew)save('draft:new:initial','');ctx.trackJobs(data.jobs||[]);}).catch(ctx.handleError).finally(function(){pending=false;render();});
        }
        el('sbs-fs-support-copy').addEventListener('click',function(){
            var text=el('sbs-fs-support-text').value;
            if(window.navigator&&window.navigator.clipboard&&window.navigator.clipboard.writeText){window.navigator.clipboard.writeText(text).then(function(){ctx.showMessage('Support details copied. Review them before sharing with OpenAI support.');}).catch(function(){el('sbs-fs-support-text').focus();el('sbs-fs-support-text').select();ctx.showMessage('Select Copy from your keyboard or browser menu.');});}
            else{el('sbs-fs-support-text').focus();el('sbs-fs-support-text').select();ctx.showMessage('Select Copy from your keyboard or browser menu.');}
        });
        el('sbs-fs-upload-form').addEventListener('submit',function(event){event.preventDefault();uploadFile(el('sbs-fs-upload-file').files[0],el('sbs-fs-upload-mode').value);});
        el('sbs-fs-allow-edit').addEventListener('change',function(){save('allow-edit:'+active,this.checked?'yes':'no');render();});
        el('sbs-fs-background').addEventListener('change',render);
        el('sbs-fs-form').addEventListener('submit',submit);
        el('sbs-fs-instruction').addEventListener('input',function(){save(currentDraftKey(),this.value);var g=selected(),running=busy(),last=jobRows().sort(function(a,b){return a.id-b.id;}).slice(-1)[0],failed=last&&['failed','blocked'].includes(last.status)&&last.payload&&last.payload.purpose==='freestyle'&&Number(last.payload.parent_id||0)===Number(g&&g.id||0);stage('c',!!g&&!running&&!failed&&!this.value.trim(),running?(fileOperation||'Generating'):this.value.trim()?'Draft ready to submit':failed?'Instruction not applied':g?'Instructions applied':'Ready for your idea');});
        el('sbs-fs-title').addEventListener('input',function(){save('title:'+(active||'new'),this.value);});
        el('sbs-fs-style-choices').addEventListener('change',function(){stylesPending=true;el('sbs-fs-style-pending').textContent='Choices changed — press Apply styles to use them.';});
        el('sbs-fs-style-apply').addEventListener('click',function(){
            var values=Array.from(el('sbs-fs-style-choices').querySelectorAll('input:checked')).map(function(input){return input.value;});
            if(!values.length){el('sbs-fs-style-pending').textContent='Tick at least one style, then Apply styles.';return;}
            appliedStyles=values;save('last-styles',JSON.stringify(values));save('last-style',values[0]);paintStyles();el('sbs-fs-style-menu').open=false;el('sbs-fs-style-summary').focus();
        });
        el('sbs-fs-new').addEventListener('click',function(){startNew('');});
        el('sbs-fs-character').addEventListener('change',function(){var next=this.value;if(project())startNew(next);else{choice=next;save('new-character',choice);render();}});
        el('sbs-fs-session').addEventListener('change',function(){var next=this.value;if(!next){startNew('');return;}preserveInputs();active=next;save('session',active);loaded='';render();});
        el('sbs-fs-undo').addEventListener('click',function(){var g=selected(),parent=g&&generations().find(function(x){return x.id===g.parent_id;});if(parent){(redo[active]||(redo[active]=[])).push(g.uuid);setSelection(parent.uuid,true);}});
        el('sbs-fs-redo').addEventListener('click',function(){var uuid=(redo[active]||[]).pop();if(uuid)setSelection(uuid,true);});
        el('sbs-fs-zoom').addEventListener('click',function(){var g=selected();if(g)ctx.zoom(g.asset_url,'Freestyle selected image');});
        el('sbs-fs-image').addEventListener('load',function(){var g=selected();el('sbs-fs-image-info').textContent=g?this.naturalWidth+' × '+this.naturalHeight+' source pixels · '+(this.naturalWidth/300).toFixed(2)+' × '+(this.naturalHeight/300).toFixed(2)+' inches at 300 PPI before layout.':'';if(g)inspectTransparency(g);});
        if(typeof document!=='undefined')document.querySelectorAll('[data-primary-tab="freestyle"]').forEach(function(tab){tab.addEventListener('click',function(){loadFreestyleSources(true);});});
        render();loadFreestyleSources(false);return {render:render,isJob:isJob,onJob:onJob,restoreInstruction:restoreInstruction,showSupport:showSupport,open:function(uuid){preserveInputs();active=uuid;loaded='';save('session',uuid);render();}};
    }
    window.SBSFreestyle={init:init,recentSix:recentSix,branch:branch,designBrief:designBrief,classifyTransparency:classifyTransparency,supportReport:supportReport};
})();
