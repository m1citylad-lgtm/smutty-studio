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
    // Only erase matching background connected to an image edge. RGB and all other alpha stay unchanged.
    async function eraseConnectedBackground(data,width,height,rgb,tolerance,onProgress) {
        var total=width*height;if(!width||!height||total>32000000||data.length!==total*4)throw new Error('Background removal supports images up to 32 million pixels.');
        var seen=new Uint8Array(total),queue=new Uint32Array(total),head=0,tail=0,removed=0;
        function add(i){if(seen[i])return;seen[i]=1;var p=i*4;if(data[p+3]===0 || (Math.abs(data[p]-rgb[0])<=tolerance&&Math.abs(data[p+1]-rgb[1])<=tolerance&&Math.abs(data[p+2]-rgb[2])<=tolerance))queue[tail++]=i;}
        for(var x=0;x<width;x++){add(x);add((height-1)*width+x);}for(var y=0;y<height;y++){add(y*width);add(y*width+width-1);}
        while(head<tail){var stop=Math.min(head+65536,tail);while(head<stop){var i=queue[head++],p=i*4;if(data[p+3]){data[p+3]=0;removed++;}var x=i%width;if(x)add(i-1);if(x<width-1)add(i+1);if(i>=width)add(i-width);if(i<total-width)add(i+width);}
            if(onProgress){onProgress(head,total);await new Promise(function(resolve){setTimeout(resolve,0);});}
        }
        return removed;
    }
    function init(ctx) {
        var el=ctx.el, esc=ctx.esc, active='', chosen={}, jobs={}, pending=false, redo={}, choice='', loaded='', seenComplete={},briefLoaded='',briefDrafts={},supportKey='',savingBrief=false,fileOperation='',refsKey='',referenceChoices=[];
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
        function settings() {var bg=el('sbs-fs-background').value;return {style:appliedStyles[0],styles:appliedStyles.slice(),treatment:el('sbs-fs-treatment').value,background:bg==='opaque'?'opaque':'transparent',transparency:bg==='transparent-print'?'print':bg==='transparent-soft'?'soft':'standard',size:el('sbs-fs-size').value,width:Number(el('sbs-fs-width').value),height:Number(el('sbs-fs-height').value),dpi:300};}
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
            ['treatment','size','width','height'].forEach(function(k){if(s[k]!=null)el('sbs-fs-'+k).value=s[k];});
            el('sbs-fs-background').value=s.background==='opaque'?'opaque':s.transparency==='print'?'transparent-print':s.transparency==='soft'?'transparent-soft':s.transparency==='print'?'transparent-print':'transparent';
        }
        function importedSource(){var p=project(),g=selected();return p&&g?branch(p.generations||[],g.uuid).find(function(v){return v.action==='upload';}):null;}
        function referenceAssets(){return (project()&&project().assets||[]).filter(function(a){return a.role==='freestyle_reference';});}
        function referenceSelection(){if(refsKey!==active){refsKey=active;try{referenceChoices=JSON.parse(read('references:'+active,'[]'));}catch(e){referenceChoices=[];}if(!Array.isArray(referenceChoices))referenceChoices=[];}return referenceChoices.filter(function(uuid){return referenceAssets().some(function(a){return a.uuid===uuid;});});}
        function uploadFile(file,mode,parent){
            if(busy())return Promise.resolve();if(!file){ctx.showMessage('Choose an image file first.',true);return Promise.resolve();}
            if(file.size>20*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){ctx.showMessage('Choose a PNG, JPEG or WebP image up to 20 MB.',true);return Promise.resolve();}
            var previousActive=active,uploadDraft=el('sbs-fs-instruction').value,uploadBrief=el('sbs-fs-brief').value;var form=new FormData();form.append('file',file);form.append('mode',mode);form.append('project_uuid',active);form.append('pack_uuid',el('sbs-fs-character').value);form.append('title',el('sbs-fs-title').value);form.append('label',el('sbs-fs-upload-label').value||file.name);form.append('settings',JSON.stringify(settings()));if(parent)form.append('parent_uuid',parent);
            preserveInputs();pending=true;fileOperation='Saving uploaded '+(mode==='reference'?'reference':'artwork copy')+'…';el('sbs-fs-file-status').textContent=fileOperation;render();
            return ctx.api('freestyle/upload',{method:'POST',body:form}).then(function(data){
                ctx.replaceProject(data.project);active=data.project.uuid;save('session',active);loaded=mode==='reference'&&previousActive===active?active:'';if(!previousActive){save('draft:'+active,uploadDraft);save('brief:'+active+':'+(data.generation_uuid||'initial'),JSON.stringify(uploadBrief));}
                if(data.generation_uuid){chosen[active]=data.generation_uuid;save('selected:'+active,data.generation_uuid);redo[active]=[];save('allow-edit:'+active,'no');}
                if(mode==='reference'){refsKey=active;try{referenceChoices=JSON.parse(read('references:'+active,'[]'));}catch(e){referenceChoices=[];}if(!Array.isArray(referenceChoices))referenceChoices=[];if(referenceChoices.length<6)referenceChoices.push(data.asset.uuid);save('references:'+active,JSON.stringify(referenceChoices));}
                el('sbs-fs-upload-file').value='';el('sbs-fs-file-status').textContent=mode==='reference'?'Reference saved. Tick it below to guide the next generation.':'Artwork saved as a separate version. No generation or upscale was run.';return true;
            }).catch(function(error){el('sbs-fs-file-status').textContent='Upload failed: '+error.message;ctx.handleError(error);return false;}).finally(function(){pending=false;fileOperation='';render();});
        }
        async function removeFlatBackground(){
            var g=selected();if(!g||busy())return;var source=g.uuid,tolerance=Number(el('sbs-fs-remove-tolerance').value),colour=el('sbs-fs-remove-colour').value;
            if(!Number.isFinite(tolerance)||tolerance<0||tolerance>100){ctx.showMessage('Choose a colour tolerance between 0 and 100.',true);return;}
            pending=true;fileOperation='Checking connected background…';render();
            try{
                var img=new Image();img.src=g.asset_url;await img.decode();if(img.naturalWidth*img.naturalHeight>32000000)throw new Error('This image is too large for tablet background removal (32 million pixels maximum).');
                var canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;var paint=canvas.getContext('2d',{willReadFrequently:true});paint.drawImage(img,0,0);var pixels=paint.getImageData(0,0,canvas.width,canvas.height),rgb=[1,3,5].map(function(n){return parseInt(colour.slice(n,n+2),16);});
                var removed=await eraseConnectedBackground(pixels.data,canvas.width,canvas.height,rgb,tolerance,function(checked,total){el('sbs-fs-remove-status').textContent='Checked '+checked.toLocaleString()+' connected background pixels out of '+total.toLocaleString()+' image pixels.';});
                if(!removed){el('sbs-fs-remove-status').textContent='No matching edge-connected background found. Try another colour or tolerance. Nothing was changed.';return;}
                paint.putImageData(pixels,0,0);var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/png');});if(!blob)throw new Error('Could not save the PNG copy.');
                pending=false;fileOperation='';var saved=await uploadFile(new File([blob],'background-removed-copy.png',{type:'image/png'}),'background_removed',source);el('sbs-fs-remove-status').textContent=saved?'Background copy saved. Inspect the result; Undo restores the previous image.':'The copy could not be saved. Your source image is unchanged.';
            }catch(error){el('sbs-fs-remove-status').textContent=error.message;ctx.handleError(error);}finally{pending=false;fileOperation='';render();}
        }
        function currentDraftKey() {return 'draft:'+(active||'new');}
        function briefKey() {var g=selected();return (active||'new')+':'+(g?g.uuid:'initial');}
        function storeBrief() {var key=briefKey(),value=el('sbs-fs-brief').value;if(value===designBrief(project(),selected())){delete briefDrafts[key];save('brief:'+key,'null');}else{briefDrafts[key]=value;save('brief:'+key,JSON.stringify(value));}}
        function loadBrief(key,fallback) {if(Object.prototype.hasOwnProperty.call(briefDrafts,key))return briefDrafts[key];try{var value=JSON.parse(read('brief:'+key,'null'));return typeof value==='string'?value:fallback;}catch(e){return fallback;}}
        function preserveInputs(){save(currentDraftKey(),el('sbs-fs-instruction').value);if(briefLoaded)storeBrief();}
        function jobByUuid(uuid){return jobRows().find(function(j){return j.uuid===uuid;});}
        function restoreInstruction(uuid) {
            var j=jobByUuid(uuid),g=selected();if(!j||busy())return;
            if(el('sbs-fs-instruction').value.trim()){ctx.showMessage('Your unsent instruction is safe. Clear or save it before restoring the failed instruction.',true);return;}
            if(Number(j.payload.parent_id||0)!==Number(g&&g.id||0)){ctx.showMessage('Select the source image for this failed instruction first. Your current image and draft are unchanged.',true);return;}
            el('sbs-fs-instruction').value=j.payload.freestyle_instruction||'';
            save(currentDraftKey(),el('sbs-fs-instruction').value);el('sbs-fs-instruction').focus();render();
            ctx.showMessage('Failed instruction restored for editing. Nothing has been submitted.');
        }
        function showSupport(uuid) {
            var j=jobByUuid(uuid),p=project();if(!j||!p)return;
            supportKey=active;el('sbs-fs-support-text').value=supportReport(j,p,el('sbs-app').getAttribute('data-version'));el('sbs-fs-support').hidden=false;el('sbs-fs-support-text').focus();
        }
        function setSelection(uuid,persist) {
            if(briefLoaded)storeBrief();
            chosen[active]=uuid;save('selected:'+active,uuid);el('sbs-fs-reviewed').checked=read('review:'+uuid,'')==='yes';
            var g=selected();if(g&&g.freestyle_settings)applySettings(g.freestyle_settings);
            render();
            if(persist&&project())ctx.post('freestyle/select',{project_uuid:active,generation_uuid:uuid}).then(ctx.replaceProject).catch(ctx.handleError);
        }
        function onJob(job) {
            jobs[job.uuid]=job;
            if(job.status==='completed'&&job.result&&job.result.generation_uuid&&!seenComplete[job.uuid]){
                seenComplete[job.uuid]=true;
                var p=ctx.state.projects.find(function(p){return p.id===Number(job.payload.project_id);});
                if(p){chosen[p.uuid]=job.result.generation_uuid;save('selected:'+p.uuid,job.result.generation_uuid);redo[p.uuid]=[];if(p.uuid===active)el('sbs-fs-reviewed').checked=false;}
            }
        }
        function startNew(pack) {
            if(pending)return;
            preserveInputs();active='';choice=pack||'';save('new-character',choice);loaded='';save('session','');
            el('sbs-fs-title').value='';el('sbs-fs-instruction').value=read('draft:new','');el('sbs-fs-reviewed').checked=false;
            applySettings({style:rememberedStyle(),styles:rememberedStyles(),treatment:'vintage',background:'transparent',transparency:'print',size:'1024x1536',width:15,height:18});render();
        }
        function stage(letter,done,text) {var node=el('sbs-fs-step-'+letter);node.classList.toggle('done',done);node.querySelector('strong').textContent=(done?'✓ ':'○ ')+text;}
        function render() {
            if(!el('sbs-fs-panel') && !el('sbs-freestyle-panel'))return;
            var p=project(),g=selected(),gs=generations(),running=busy()||!!(chosen[active]&&!gs.some(function(image){return image.uuid===chosen[active];}));
            if(active&&!p&&ctx.state.freestyleReady){active='';save('session','');}
            var session=el('sbs-fs-session');session.innerHTML='<option value="">New experiment</option>'+projects().map(function(p){return '<option value="'+esc(p.uuid)+'">'+esc(p.title)+'</option>';}).join('');session.value=active;
            var character=el('sbs-fs-character');character.innerHTML='<option value="">No character — completely new idea</option>'+ctx.state.packs.filter(function(p){return p.uuid!==ctx.state.freestylePackUuid;}).map(function(p){return '<option value="'+esc(p.uuid)+'">'+esc(p.name)+'</option>';}).join('');
            character.value=p?(p.concept.character_uuid||''):choice;
            if(loaded!==(p?active:'new')) {
                loaded=p?active:'new';el('sbs-fs-title').value=read('title:'+(active||'new'),p?p.title:'');
                el('sbs-fs-instruction').value=read(currentDraftKey(),'');
                applySettings(p?p.concept.settings:{style:rememberedStyle(),styles:rememberedStyles(),treatment:'vintage',background:'transparent',transparency:'print',size:'1024x1536',width:15,height:18});
                el('sbs-fs-reviewed').checked=!!g&&read('review:'+g.uuid,'')==='yes';
            }
            var nextBriefKey=briefKey();if(briefLoaded!==nextBriefKey){briefLoaded=nextBriefKey;el('sbs-fs-brief').value=loadBrief(nextBriefKey,designBrief(p,g));el('sbs-fs-brief-status').textContent='This brief belongs to the selected image branch.';}
            el('sbs-fs-brief-save').disabled=running;el('sbs-fs-support').hidden=supportKey!==active||!supportKey;
            var thumbs=el('sbs-fs-thumbnails');thumbs.innerHTML=recentSix(gs,g&&g.uuid).map(function(image){var n=gs.length-gs.findIndex(function(x){return x.uuid===image.uuid;});return '<button type="button" class="sbs-fs-thumbnail'+(g&&g.uuid===image.uuid?' selected':'')+'" data-fs-image="'+esc(image.uuid)+'" aria-pressed="'+(g&&g.uuid===image.uuid?'true':'false')+'" aria-label="Restore version '+n+'"><img src="'+esc(image.asset_url)+'" alt="Version '+n+'"><span>Version '+n+'</span></button>';}).join('');
            thumbs.querySelectorAll('[data-fs-image]').forEach(function(button){button.addEventListener('click',function(){redo[active]=[];setSelection(button.getAttribute('data-fs-image'),true);});});
            el('sbs-fs-empty').hidden=!!g;el('sbs-fs-zoom').hidden=!g;
            if(g&&el('sbs-fs-image').getAttribute('src')!==g.asset_url)el('sbs-fs-image').src=g.asset_url;
            if(!g){el('sbs-fs-image').removeAttribute('src');el('sbs-fs-image-info').textContent='';}
            var path=g?branch(gs,g.uuid):[];
            var original=importedSource(),allowed=read('allow-edit:'+active,'no')==='yes';el('sbs-fs-edit-lock').hidden=!original;el('sbs-fs-allow-edit').checked=allowed;if(original){el('sbs-fs-original').href=original.asset_url;}
            var refs=referenceSelection();el('sbs-fs-references').innerHTML=referenceAssets().map(function(a){return '<label class="sbs-fs-reference"><input type="checkbox" data-fs-ref="'+esc(a.uuid)+'"'+(refs.includes(a.uuid)?' checked':'')+'><img src="'+esc(a.url)+'" alt=""><span>'+esc(a.label||a.filename)+'</span></label>';}).join('');
            el('sbs-fs-references').querySelectorAll('[data-fs-ref]').forEach(function(box){box.disabled=running;box.addEventListener('change',function(){var values=Array.from(el('sbs-fs-references').querySelectorAll('input:checked')).map(function(x){return x.getAttribute('data-fs-ref');});if(values.length>6){box.checked=false;ctx.showMessage('Select up to six references.',true);return;}referenceChoices=values;save('references:'+active,JSON.stringify(values));});});
            el('sbs-fs-upload').disabled=running;el('sbs-fs-remove-background').disabled=running||!g;
            el('sbs-fs-background-note').textContent=el('sbs-fs-background').value==='opaque'?'Background: opaque. A solid or scenic background becomes part of the image.':el('sbs-fs-background').value==='transparent-soft'?'Background: transparent with soft edges or effects. Check partial transparency before printing.':el('sbs-fs-background').value==='transparent'?'Background: transparent cutout. Inspect the natural edges.':'Background: transparent, solid print colour. Empty areas show the shirt; artwork colours should stay solid.';
            el('sbs-fs-conversation').innerHTML=path.map(function(turn,index){return '<li><strong>Instruction '+(index+1)+(turn.action==='upscale'?' · upscale':'')+'</strong><p>'+esc(turn.freestyle_instruction||(turn.action==='upscale'?'AI upscale '+turn.quality:turn.action==='upload'?'Uploaded original — unchanged':turn.action==='background_remove'?'Flat background removed into a separate copy':'Initial design'))+'</p></li>';}).join('')||'<li>Describe your first idea below.</li>';
            el('sbs-fs-undo').disabled=running||!g||!gs.some(function(x){return x.id===g.parent_id;});el('sbs-fs-redo').disabled=running||!(redo[active]||[]).length;
            var rows=jobRows().sort(function(a,b){return a.id-b.id;}),activeJobs=rows.filter(function(j){return !['completed','failed','blocked','cancelled'].includes(j.status);});
            if(!activeJobs.length)activeJobs=rows.slice(-1);
            var statusMarkup=(pending?'<p role="status">'+(savingBrief?'Saving design brief…':fileOperation||'Submitting your instruction…')+'</p><progress max="100" aria-label="'+(savingBrief?'Saving design brief':fileOperation||'Submitting instruction')+'"></progress>':'')+activeJobs.map(function(j){var done=j.status==='completed', live=!['completed','failed','blocked','cancelled'].includes(j.status);var status=done?'Completed — 100%':j.status==='running'?'Generating — provider does not supply a measured percentage':j.status==='submitted'||j.status==='queued'?'Queued — waiting for provider':j.status;return '<p role="status">'+esc(status)+'</p>'+(live||done?'<progress max="100"'+(done?' value="100"':'')+' aria-label="'+esc(status)+'"></progress>':'')+(j.poll_error?'<p>Connection interrupted; retrying.</p>':'')+(j.error&&j.error.message?'<p>'+esc(j.error.message)+'</p>':'')+(j.error&&j.error.moderation_details?'<details><summary>Safety check details</summary><p>Stage: '+esc(j.error.moderation_details.moderation_stage||'unknown')+'</p><p>Provider categories: '+esc((j.error.moderation_details.categories||[]).join(', ')||'Not supplied')+'</p><p>These are broad provider labels, not a judgement about your intent.</p></details>':'')+(j.status==='failed'&&j.provider==='openai'&&!(j.error&&j.error.diagnostics_version===2)?'<button type="button" class="sbs-button" data-fs-explain="'+esc(j.uuid)+'">Show provider failure details</button>':'')+(['failed','blocked'].includes(j.status)&&j.payload&&j.payload.freestyle_instruction?'<p><strong>Unapplied instruction:</strong> '+esc(j.payload.freestyle_instruction)+'</p><button type="button" class="sbs-button" data-fs-restore="'+esc(j.uuid)+'">Restore failed instruction</button>':'')+(['failed','blocked'].includes(j.status)?'<button type="button" class="sbs-button" data-fs-support="'+esc(j.uuid)+'">Prepare support review details</button>':'')+(live?'<button type="button" class="sbs-button" data-fs-cancel="'+esc(j.uuid)+'">Cancel generation</button>':'');}).join('');
            ['sbs-fs-progress','sbs-fs-submit-status'].forEach(function(id){el(id).innerHTML=statusMarkup;el(id).querySelectorAll('[data-fs-restore]').forEach(function(b){b.addEventListener('click',function(){restoreInstruction(b.getAttribute('data-fs-restore'));});});el(id).querySelectorAll('[data-fs-support]').forEach(function(b){b.addEventListener('click',function(){showSupport(b.getAttribute('data-fs-support'));});});el(id).querySelectorAll('[data-fs-explain]').forEach(function(b){b.addEventListener('click',function(){b.disabled=true;ctx.api('jobs/'+b.getAttribute('data-fs-explain')+'?explain=1').then(function(j){onJob(j);render();}).catch(function(error){b.disabled=false;ctx.handleError(error);});});});el(id).querySelectorAll('[data-fs-cancel]').forEach(function(b){b.addEventListener('click',function(){ctx.api('jobs/'+b.getAttribute('data-fs-cancel'),{method:'DELETE'}).then(function(j){onJob(j);render();}).catch(ctx.handleError);});});});
            el('sbs-fs-submit').disabled=running||!!(original&&!allowed);el('sbs-fs-submit').textContent=g?'Apply next instruction to selected image':'Create one image';
            ['sbs-fs-upscale-2','sbs-fs-upscale-4'].forEach(function(id){el(id).disabled=running||!g||!(ctx.state.providers&&ctx.state.providers.replicate);});
            el('sbs-fs-promote').disabled=running||!g||!el('sbs-fs-reviewed').checked;
            el('sbs-fs-character').disabled=pending;el('sbs-fs-session').disabled=pending;el('sbs-fs-new').disabled=pending;
            el('sbs-fs-upscale-note').textContent=!ctx.state.freestyleReady?'Checking upscaler availability…':ctx.state.providers&&ctx.state.providers.replicate?'Upscaling uses the existing Replicate service. Inspect the result before print.':'AI upscaling is not configured yet. The administrator must configure Replicate to enable these buttons.';
            var latestJob=rows[rows.length-1],failedTurn=latestJob&&['failed','blocked'].includes(latestJob.status)&&latestJob.payload&&latestJob.payload.purpose==='freestyle'&&(!g||Number(latestJob.payload.parent_id)===g.id);
            var s=settings();el('sbs-fs-print-target').textContent=Math.round(s.width*300)+' × '+Math.round(s.height*300)+' pixels at 300 PPI';
            stage('a',true,(p?p.concept.character_uuid:choice)?'Character selected':'New composition');stage('b',!!g,g?'Image ready':'Waiting for first image');stage('c',!!g&&!running&&!failedTurn&&!el('sbs-fs-instruction').value.trim(),savingBrief?'Saving design brief':running?'Generating':failedTurn?'Instruction not applied':el('sbs-fs-instruction').value.trim()?'Draft ready to submit':g?'Instructions applied':'Ready for your idea');stage('d',!!(p&&g&&p.concept.merch_ready&&p.concept.visual_review_generation_uuid===g.uuid),p&&g&&p.concept.merch_ready&&p.concept.visual_review_generation_uuid===g.uuid?'Sent to print workflow':'Review and finish');
        }
        function submit(event) {
            event.preventDefault();if(busy())return;if(importedSource()&&read('allow-edit:'+active,'no')!=='yes'){ctx.showMessage('Uploaded artwork is protected. Tick Allow AI editing only if you want a separate edited copy.',true);return;}if(stylesPending){ctx.showMessage('Press Apply styles before generating.',true);el('sbs-fs-style-apply').focus();return;}
            var instruction=el('sbs-fs-instruction').value.trim(),g=selected(),s=settings(),brief=el('sbs-fs-brief').value;
            if(instruction.length<3){ctx.showMessage('Describe your idea or next change first.',true);el('sbs-fs-instruction').focus();return;}
            if(!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<1||s.height<1||s.width>30||s.height>30){ctx.showMessage('Choose print dimensions between 1 and 30 inches.',true);return;}
            if(!g&&!brief.trim()){brief=instruction;el('sbs-fs-brief').value=brief;}
            save('last-style',s.style);save('last-styles',JSON.stringify(s.styles));preserveInputs();pending=true;render();
            ctx.post('freestyle',{project_uuid:active,parent_uuid:g?g.uuid:'',pack_uuid:el('sbs-fs-character').value,title:el('sbs-fs-title').value,instruction:instruction,design_brief:brief,settings:s,reference_uuids:referenceSelection(),finishing:!!importedSource()}).then(function(data){ctx.replaceProject(data.project);active=data.project.uuid;briefLoaded=briefKey();storeBrief();save('brief:new:initial','null');delete briefDrafts['new:initial'];save('session',active);loaded=active;el('sbs-fs-title').value=data.project.title;save('title:'+active,data.project.title);save('title:new','');if(el('sbs-fs-instruction').value.trim()===instruction)el('sbs-fs-instruction').value='';save(currentDraftKey(),el('sbs-fs-instruction').value);save('draft:new','');ctx.trackJobs(data.jobs||[]);}).catch(ctx.handleError).finally(function(){pending=false;render();});
        }
        function upscale(scale) {
            var g=selected();if(!g||busy())return;pending=true;render();ctx.post('jobs/upscale',{generation_uuid:g.uuid,scale:scale}).then(function(data){ctx.trackJobs(data.jobs||[data]);}).catch(function(error){ctx.handleError(error);return ctx.api('projects/'+active).then(function(p){ctx.replaceProject(p);}).catch(ctx.handleError);}).finally(function(){pending=false;render();});
        }
        el('sbs-fs-brief').addEventListener('input',function(){storeBrief();el('sbs-fs-brief-status').textContent='Draft kept in this browser. Save it or submit the next instruction to save it to Studio.';});
        el('sbs-fs-brief-save').addEventListener('click',function(){
            if(busy())return;var p=project(),g=selected(),key=briefKey(),value=el('sbs-fs-brief').value;storeBrief();
            if(!p){el('sbs-fs-brief-status').textContent='Brief kept for this new experiment. It will be saved with your first generation.';return;}
            pending=true;savingBrief=true;render();ctx.post('freestyle/brief',{project_uuid:p.uuid,generation_uuid:g?g.uuid:'',design_brief:value}).then(function(updated){ctx.replaceProject(updated);if(briefKey()===key){storeBrief();el('sbs-fs-brief-status').textContent=el('sbs-fs-brief').value===value?'Design brief saved to Studio for this image.':'Earlier brief saved; your newer draft is kept in this browser.';}}).catch(ctx.handleError).finally(function(){pending=false;savingBrief=false;render();});
        });
        el('sbs-fs-support-copy').addEventListener('click',function(){
            var text=el('sbs-fs-support-text').value;
            if(window.navigator&&window.navigator.clipboard&&window.navigator.clipboard.writeText){window.navigator.clipboard.writeText(text).then(function(){ctx.showMessage('Support details copied. Review them before sharing with OpenAI support.');}).catch(function(){el('sbs-fs-support-text').focus();el('sbs-fs-support-text').select();ctx.showMessage('Select Copy from your keyboard or browser menu.');});}
            else{el('sbs-fs-support-text').focus();el('sbs-fs-support-text').select();ctx.showMessage('Select Copy from your keyboard or browser menu.');}
        });
        el('sbs-fs-upload-form').addEventListener('submit',function(event){event.preventDefault();uploadFile(el('sbs-fs-upload-file').files[0],el('sbs-fs-upload-mode').value);});
        el('sbs-fs-remove-background').addEventListener('click',removeFlatBackground);
        el('sbs-fs-allow-edit').addEventListener('change',function(){save('allow-edit:'+active,this.checked?'yes':'no');render();});
        el('sbs-fs-background').addEventListener('change',render);
        el('sbs-fs-form').addEventListener('submit',submit);
        el('sbs-fs-instruction').addEventListener('input',function(){save(currentDraftKey(),this.value);var g=selected(),running=busy(),last=jobRows().sort(function(a,b){return a.id-b.id;}).slice(-1)[0],failed=last&&['failed','blocked'].includes(last.status)&&last.payload&&last.payload.purpose==='freestyle'&&Number(last.payload.parent_id||0)===Number(g&&g.id||0);stage('c',!!g&&!running&&!failed&&!this.value.trim(),savingBrief?'Saving design brief':running?'Generating':this.value.trim()?'Draft ready to submit':failed?'Instruction not applied':g?'Instructions applied':'Ready for your idea');});
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
        el('sbs-fs-image').addEventListener('load',function(){var g=selected();el('sbs-fs-image-info').textContent=g?this.naturalWidth+' × '+this.naturalHeight+' source pixels · '+(this.naturalWidth/300).toFixed(2)+' × '+(this.naturalHeight/300).toFixed(2)+' inches at 300 PPI before layout. Check transparency in Merch Canvas.':'';});
        el('sbs-fs-upscale-2').addEventListener('click',function(){upscale(2);});el('sbs-fs-upscale-4').addEventListener('click',function(){upscale(4);});
        ['width','height'].forEach(function(k){el('sbs-fs-'+k).addEventListener('input',render);});
        el('sbs-fs-reviewed').addEventListener('change',function(){var g=selected();if(g)save('review:'+g.uuid,this.checked?'yes':'no');render();});
        el('sbs-fs-promote').addEventListener('click',function(){var g=selected();if(!g||busy()||!el('sbs-fs-reviewed').checked)return;pending=true;render();ctx.post('freestyle/promote',{project_uuid:active,generation_uuid:g.uuid,settings:settings(),reviewed:true}).then(function(p){ctx.replaceProject(p);return ctx.loadBootstrap().then(function(){ctx.openProject(p.uuid,g.uuid);ctx.showMessage('Selected design is in Creations. Upscale if needed, then use Merch Canvas and run print preflight.');});}).catch(ctx.handleError).finally(function(){pending=false;render();});});
        render();return {render:render,isJob:isJob,onJob:onJob,restoreInstruction:restoreInstruction,showSupport:showSupport,open:function(uuid){preserveInputs();active=uuid;loaded='';save('session',uuid);render();}};
    }
    window.SBSFreestyle={init:init,recentSix:recentSix,branch:branch,designBrief:designBrief,supportReport:supportReport,eraseConnectedBackground:eraseConnectedBackground};
})();
