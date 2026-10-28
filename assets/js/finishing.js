(function () {
    'use strict';
    function matches(record, query) {
        return [record.title, record.uuid, record.af_id || ''].join(' ').toLowerCase().includes(query.toLowerCase());
    }
    function canApprove(record) { return !!record && record.status === 'Awaiting Review' && !!record.current_version; }
    function classifyTransparency(data) {
        if(!data||!data.length||data.length%4)throw new Error('Decoded pixels are unavailable');
        var clear=false,partial=false;
        for(var i=3;i<data.length;i+=4){if(data[i]===0)clear=true;else if(data[i]<255)partial=true;}
        return partial?'Partial alpha':clear?'Genuine transparency':'Opaque';
    }
    function init() {
        var root=document.getElementById('sbs-app');if(!root)return;
        var current=null, records=[], busy=false, activeStageMethod='', selectedFile=null, selectedMethod='inspect', exportPickerOpen=false, proofPreviewUrl=null, proofSourceKey='', proofRenderedKey='', activePrintQA=null, activeProofAssetUrl='', flatPreviewBlob=null, flatPreviewUrl=null, flatPreviewKey='', refreshPromise=null, stageRunState={};
        var uiStateKey='sbs-af-session-v1:'+location.pathname, savedUiState=(function(){try{return JSON.parse(sessionStorage.getItem(uiStateKey)||'{}');}catch(e){return {};}})(),lastCheckKey='';
        if(savedUiState.stage&&['inspect','upscale','print_png','resize'].includes(savedUiState.stage))selectedMethod=savedUiState.stage;
        var el=function(id){return document.getElementById(id);},catalogueReturnFocus=null,catalogueSelected=new Set();
        function message(text,error){el('sbs-af-progress').textContent=text;el('sbs-af-progress').setAttribute('role',error?'alert':'status');}
        function showSessionExpired(){var login=el('sbs-login'),workspace=el('sbs-workspace'),nav=el('sbs-primary-nav'),guide=el('sbs-guide-open');if(workspace)workspace.hidden=true;if(nav)nav.hidden=true;if(guide)guide.hidden=true;if(login){login.hidden=false;var note=login.querySelector('.sbs-form-message');if(note)note.textContent='Studio session expired. Sign in again to reload your saved workspaces.';}}
        function uploadMessage(text,state){var status=el('sbs-af-upload-status');status.textContent=text;status.dataset.state=state||'info';status.setAttribute('role',state==='error'?'alert':'status');}
        async function api(path,data){
            var options={credentials:'same-origin',headers:{'X-SBS-Request':'studio','X-SBS-Finishing':root.getAttribute('data-finishing-csrf')}};
            if(data){options.method='POST';options.body=data instanceof FormData?data:JSON.stringify(data);if(!(data instanceof FormData))options.headers['Content-Type']='application/json';}
            var response=await fetch(root.getAttribute('data-rest')+'finishing'+path,options),result;
            try{result=await response.json();}catch(e){throw new Error('Unexpected server response. Check the workspace before retrying.');}
            if(!response.ok){if(response.status===401&&result.code==='studio_auth_required'){showSessionExpired();}throw new Error(result.message||'Request failed. Original retained.');}return result;
        }
        function saveUiState(){try{var reviewChecks={};document.querySelectorAll('[data-af-check]').forEach(function(n){reviewChecks[n.getAttribute('data-af-check')]=n.checked;});sessionStorage.setItem(uiStateKey,JSON.stringify({workspace:current?current.uuid:(el('sbs-af-resume')&&el('sbs-af-resume').value)||savedUiState.workspace||'',stage:selectedMethod,width:el('sbs-af-width')&&el('sbs-af-width').value||'14',height:el('sbs-af-height')&&el('sbs-af-height').value||'16',printCanvas:!!(el('sbs-af-print-canvas')&&el('sbs-af-print-canvas').checked),notes:el('sbs-af-notes')&&el('sbs-af-notes').value||'',checkKey:current?current.uuid+':'+(current.current_version||''):'',checks:reviewChecks}));}catch(e){}}
        function paintRefresh(state,error){var button=el('sbs-af-refresh');if(!button)return;var label=el('sbs-af-refresh-label'),spinner=el('sbs-af-refresh-spinner'),done=el('sbs-af-refresh-done'),status=el('sbs-af-workspace-status');spinner.hidden=state!=='busy';done.hidden=state!=='done';button.disabled=state==='busy'||busy;button.dataset.state=state;if(state==='busy'){label.textContent='Refreshing workspaces';button.setAttribute('aria-busy','true');if(status)status.textContent='Checking saved workspaces…';}else if(state==='done'){label.textContent='Workspaces refreshed';button.removeAttribute('aria-busy');if(status)status.textContent=records.length?records.length+' saved workspace'+(records.length===1?'':'s')+' found.':'No saved workspaces found. Check Studio sign-in and private storage.';}else{label.textContent='Refresh workspaces';button.removeAttribute('aria-busy');if(status)status.textContent='Could not load saved workspaces: '+(error||'please try again.');}if(error)message('Workspace refresh failed: '+error,true);}
        function checks(){var result={};document.querySelectorAll('[data-af-check]').forEach(function(n){result[n.getAttribute('data-af-check')]=n.checked;});return result;}
        function resetChecks(){var key=current?current.uuid+':'+(current.current_version||''):'';if(key!==lastCheckKey){document.querySelectorAll('[data-af-check]').forEach(function(n){n.checked=false;});lastCheckKey=key;}el('sbs-af-package').hidden=true;el('sbs-af-package').removeAttribute('href');}
        function controls(){
            document.querySelectorAll('[data-af-method]').forEach(function(button){button.disabled=busy||!current;});
            el('sbs-af-export').disabled=busy||exportPickerOpen||!current||!current.approval;
            el('sbs-af-ai-review-run').disabled=busy||!current||!current.current_version;el('sbs-af-refresh-qa').disabled=busy||!current||!current.current_version;
            var selectedVersion=current&&current.versions.find(function(v){return v.uuid===current.current_version;}),reviewFindings=selectedVersion?Array.from(selectedVersion.qa&&selectedVersion.qa.pixel_review&&selectedVersion.qa.pixel_review.findings||[]).concat(selectedVersion.ai_review&&selectedVersion.ai_review.findings||[]):[],hasUnresolved=reviewFindings.some(function(f){var d=(selectedVersion.review_decisions||{})[f.id];return !d||d.decision==='unresolved';});
            el('sbs-af-approve').disabled=busy||!canApprove(current)||!Object.values(checks()).every(Boolean)||hasUnresolved||!!(selectedVersion&&selectedVersion.review_disposition==='rejected');
            el('sbs-af-edit-open').disabled=busy||editorOpening||!selectedVersion||!!(current&&current.pending);el('sbs-af-trim').disabled=busy||trimOpening||!selectedVersion||!!(current&&current.pending);
            var canFlat=!!current&&!current.pending;el('sbs-af-flat-sample').disabled=busy||!canFlat;el('sbs-af-flat-preview').disabled=busy||!canFlat;el('sbs-af-flat-remove').disabled=busy||!canFlat||!flatPreviewBlob||flatPreviewKey!==flatKey();
            el('sbs-af-flat-undo').disabled=busy||!selectedVersion||(selectedVersion.options&&selectedVersion.options.method)!=='flat_background';
            el('sbs-af-versions').disabled=busy;el('sbs-af-resume').disabled=busy;
            document.querySelectorAll('#sbs-af-upload input,#sbs-af-upload button').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-open]').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-rename]').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-delete],[data-af-record-select]').forEach(function(n){n.disabled=busy;});
            el('sbs-af-delete-selected').disabled=busy||catalogueSelected.size===0;
            if(el('sbs-af-refresh'))el('sbs-af-refresh').disabled=busy||el('sbs-af-refresh').dataset.state==='busy';
            if(el('sbs-af-editor')){el('sbs-af-editor-close').disabled=busy;el('sbs-af-editor').querySelectorAll('button,input').forEach(function(n){if(n.id!=='sbs-af-editor-close')n.disabled=busy;});el('sbs-af-editor-canvas').style.pointerEvents=busy?'none':'auto';el('sbs-af-edit-undo').disabled=busy||!editor.undo.length;el('sbs-af-edit-redo').disabled=busy||!editor.redo.length;el('sbs-af-edit-save').disabled=busy||!editor.dirty;}
            if(el('sbs-af-trim-dialog'))el('sbs-af-trim-dialog').querySelectorAll('button').forEach(function(n){n.disabled=busy;});
            el('sbs-af-progress-bar').hidden=!busy;
        }
        function stageLabel(method){return ({inspect:'Inspect',resize:'Fit down to print box',print_png:'Prepare print PNG',upscale:'AI upscale'})[method]||'selected stage';}
        function stageVersion(method){
            if(!current||!Array.isArray(current.versions))return null;
            for(var i=current.versions.length-1;i>=0;i--){var version=current.versions[i];if(version.options&&version.options.method===method)return version;}
            return null;
        }
        function stageReportText(version){
            var qa=version&&version.qa||{},parts=[];
            var width=Number(qa.width||version&&version.asset&&version.asset.width||0),height=Number(qa.height||version&&version.asset&&version.asset.height||0);
            if(width&&height)parts.push(width+' × '+height+' px');
            if(Number.isFinite(Number(qa.effective_ppi)))parts.push(Number(qa.effective_ppi).toFixed(1)+' PPI at '+Number(version.options.width||14)+' × '+Number(version.options.height||16)+' in');
            return parts.join(' · ')||'Stage completed.';
        }
        function setStageReport(method,state,text){
            var report=document.querySelector('[data-af-stage-report="'+method+'"]');if(!report)return;
            report.dataset.state=state;report.querySelector('.sbs-af-stage-report-text').textContent=text;report.hidden=false;
        }
        function updateStageButtons(){
            document.querySelectorAll('[data-af-method]').forEach(function(button){
                var method=button.getAttribute('data-af-method'),spinner=button.querySelector('.sbs-af-stage-spinner'),done=button.querySelector('.sbs-af-stage-done'),version=stageVersion(method),runState=stageRunState[method]||{},running=!!(busy&&activeStageMethod===method),failed=runState.state==='error',completed=!!version&&!failed;
                if(spinner)spinner.hidden=!running;
                if(done)done.hidden=running||!completed;
                if(running){button.setAttribute('aria-busy','true');button.setAttribute('aria-label',button.querySelector('.sbs-af-stage-button-label').textContent+' — processing');setStageReport(method,'info','Processing…');}
                else{
                    button.removeAttribute('aria-busy');
                    button.setAttribute('aria-label',button.querySelector('.sbs-af-stage-button-label').textContent+(completed?' — completed':''));
                    if(failed){setStageReport(method,'error','Needs attention: '+String(runState.message||'The stage did not complete.').slice(0,180));}
                    else if(version){
                        var warnings=Array.isArray(version.qa&&version.qa.warnings)?version.qa.warnings:[];
                        if(warnings.length){var warning=String(warnings[0]);setStageReport(method,'error','Needs attention: '+warning+(warnings.length>1?' (+'+(warnings.length-1)+' more)':''));}
                        else{setStageReport(method,'success','Completed: '+stageReportText(version));}
                    }
                }
                button.dataset.stageState=running?'running':failed?'error':completed?'complete':'idle';
                button.disabled=busy||!current;
            });
        }
        function updateStepButtons(){
            var approved=!!(current&&current.approval&&current.approval.version===current.current_version);
            el('sbs-af-approve').textContent=approved?'✓ 6. Approved locally':'6. Approve this local version';
            updateStageButtons();
        }
        function buttonBusy(button,on){if(!button)return;if(button.querySelector('.sbs-af-stage-button-label')){button.disabled=on;if(on)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');return;}if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;button.setAttribute('aria-busy','true');}button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function operation(fn,text,button,onError){if(busy)return;activeStageMethod=button&&button.getAttribute('data-af-method')?button.getAttribute('data-af-method'):button&&button.id==='sbs-af-run'&&current&&current.pending?current.pending.method:'';busy=true;buttonBusy(button,true);controls();updateStepButtons();message(text);try{await fn();}catch(error){message(error.message,true);if(onError)onError(error);}finally{busy=false;activeStageMethod='';el('sbs-af-progress-bar').removeAttribute('value');controls();buttonBusy(button,false);updateStepButtons();}}
        function fileSize(size){return (size/(1024*1024)).toFixed(2)+' MB';}
        function flatColors(){var colors=[[1,3,5].map(function(n){return parseInt(el('sbs-af-flat-colour').value.slice(n,n+2),16);})];if(el('sbs-af-flat-use-second').checked){colors.push([1,3,5].map(function(n){return parseInt(el('sbs-af-flat-colour-2').value.slice(n,n+2),16);}));}return colors;}
        function flatKey(){return JSON.stringify([current&&current.uuid,current&&current.current_version||'original',flatColors(),Number(el('sbs-af-flat-tolerance').value)]);}
        function clearFlatPreview(){flatPreviewBlob=null;flatPreviewKey='';if(flatPreviewUrl){URL.revokeObjectURL(flatPreviewUrl);flatPreviewUrl=null;}el('sbs-af-flat-preview-box').hidden=true;el('sbs-af-flat-preview-image').removeAttribute('src');controls();}
        function colorHex(rgb){return '#'+rgb.map(function(v){return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');}).join('');}
        async function sourceImage(){if(!current)throw new Error('Choose or resume artwork first.');var version=current.current_version||'original',entry=version==='original'?null:current.versions.find(function(v){return v.uuid===version;}),asset=entry?entry.asset:current.original;if(!asset||!asset.url)throw new Error('The selected source image could not be found. Refresh the workspace and try again.');var img=new Image();img.src=asset.url;await img.decode();if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>32000000)throw new Error('This local operation supports images up to 32 million pixels. The source was not changed.');return {img:img,version:version,width:img.naturalWidth,height:img.naturalHeight};}
        async function sampleFlatBackground(){var status=el('sbs-af-flat-samples');clearFlatPreview();try{var source=await sourceImage(),w=source.width,h=source.height,span=Math.max(2,Math.min(32,Math.floor(Math.min(w,h)*.04))),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;var ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Pixel sampling is unavailable in this browser.');ctx.drawImage(source.img,0,0);var data=ctx.getImageData(0,0,w,h).data;function avg(x0,y0){var rr=0,gg=0,bb=0,n=0,clear=0,samples=[];for(var y=y0;y<y0+span;y+=Math.max(1,Math.floor(span/12)))for(var x=x0;x<x0+span;x+=Math.max(1,Math.floor(span/12))){var i=(y*w+x)*4;if(data[i+3]===0){clear++;continue;}var c=[data[i],data[i+1],data[i+2]];samples.push(c);rr+=c[0];gg+=c[1];bb+=c[2];n++;}var rgb=n?[rr/n,gg/n,bb/n]:null,mixed=!!rgb&&samples.some(function(c){return Math.sqrt(c.reduce(function(sum,v,i){return sum+Math.pow(v-rgb[i],2);},0))>26;});return {rgb:rgb,clear:clear/(n+clear||1),mixed:mixed};}var edge=[avg(0,0),avg(w-span,0),avg(0,h-span),avg(w-span,h-span)];if(edge.some(function(a){return !a.rgb||a.clear>.5||a.mixed;})){status.textContent='Corner pixels are transparent or mixed with artwork. Sampling is uncertain; choose colours manually. No colour was selected.';return;}function dist(a,b){return Math.sqrt(a.reduce(function(sum,v,i){return sum+Math.pow(v-b[i],2);},0));}var groups=[];edge.forEach(function(sample,index){var g=groups.find(function(item){return dist(item.rgb,sample.rgb)<26;});if(g){g.indices.push(index);g.rgb=g.rgb.map(function(v,i){return (v*(g.indices.length-1)+sample.rgb[i])/g.indices.length;});}else groups.push({rgb:sample.rgb.slice(),indices:[index]});});if(groups.length===1){el('sbs-af-flat-colour').value=colorHex(groups[0].rgb);el('sbs-af-flat-use-second').checked=false;status.textContent='Corners are consistent. Suggested plain background '+colorHex(groups[0].rgb)+'. Review the image and press Preview before saving a copy.';return;}var diagonals=groups.length===2&&groups[0].indices.length===2&&groups[1].indices.length===2&&((groups[0].indices.includes(0)&&groups[0].indices.includes(3))||(groups[0].indices.includes(1)&&groups[0].indices.includes(2)))&&dist(groups[0].rgb,groups[1].rgb)>30;if(diagonals){el('sbs-af-flat-colour').value=colorHex(groups[0].rgb);el('sbs-af-flat-colour-2').value=colorHex(groups[1].rgb);el('sbs-af-flat-use-second').checked=true;status.textContent='Two alternating corner colours detected as a possible checkerboard: '+colorHex(groups[0].rgb)+' and '+colorHex(groups[1].rgb)+'. This is only a suggestion. Inspect and adjust both colours, then preview.';return;}status.textContent='Corner samples disagree or may include artwork. Sampling is uncertain; choose the background colour(s) manually. No colour was selected.';}catch(error){status.textContent='Sampling unavailable: '+error.message;}}
        async function previewFlatBackground(){var status=el('sbs-af-flat-status'),tolerance=Number(el('sbs-af-flat-tolerance').value);clearFlatPreview();if(!Number.isInteger(tolerance)||tolerance<0||tolerance>100){status.textContent='Choose a colour tolerance from 0 to 100.';return;}try{var source=await sourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;var paint=canvas.getContext('2d',{willReadFrequently:true});if(!paint)throw new Error('This browser could not prepare a pixel preview.');paint.drawImage(source.img,0,0);var pixels=paint.getImageData(0,0,source.width,source.height),colors=flatColors(),bar=el('sbs-af-progress-bar');bar.removeAttribute('value');var removed=await window.SBSFlatBackground.eraseConnectedBackground(pixels.data,source.width,source.height,colors,tolerance,function(checked){status.textContent='Previewing edge-connected pixels: '+checked.toLocaleString()+' checked.';});if(!removed){status.textContent='No selected colour matched at the image edge. Nothing changed. Adjust colours or tolerance and preview again.';return;}paint.putImageData(pixels,0,0);flatPreviewBlob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/png');});if(!flatPreviewBlob)throw new Error('Preview PNG could not be created.');flatPreviewKey=flatKey();flatPreviewUrl=URL.createObjectURL(flatPreviewBlob);el('sbs-af-flat-preview-image').src=flatPreviewUrl;el('sbs-af-flat-preview-summary').textContent=removed.toLocaleString()+' edge-connected pixels removed. Source '+source.width+' × '+source.height+' px; selected colour(s) '+colors.map(colorHex).join(' and ')+'. This preview is not saved yet.';el('sbs-af-flat-preview-box').hidden=false;status.textContent='Preview ready. Inspect edge details carefully; then choose Save preview as separate PNG copy if correct.';}catch(error){status.textContent=error.message;status.setAttribute('role','alert');}}
        async function removeFlatBackground(){var status=el('sbs-af-flat-status'),button=el('sbs-af-flat-remove');if(!flatPreviewBlob||flatPreviewKey!==flatKey()){status.textContent='Preview the current source, colours and tolerance before saving.';return;}operation(async function(){var sourceVersion=current.current_version||'original';if(flatPreviewBlob.size>20*1024*1024)throw new Error('The PNG preview is '+fileSize(flatPreviewBlob.size)+'. The current Studio limit is 20 MB, so no copy was saved. The source is unchanged.');status.textContent='Saving the separate PNG copy…';var data=new FormData();data.append('action','flat_background');data.append('revision',String(current.revision));data.append('source_version',sourceVersion);data.append('colour',el('sbs-af-flat-colour').value);data.append('colour2',el('sbs-af-flat-colour-2').value);data.append('use_second',String(el('sbs-af-flat-use-second').checked));data.append('tolerance',String(el('sbs-af-flat-tolerance').value));data.append('file',new File([flatPreviewBlob],'candidate-flat-background.png',{type:'image/png'}));current=await api('/'+current.uuid+'/action',data);clearFlatPreview();await refresh();render();var saved=current.versions.find(function(v){return v.uuid===current.current_version;});status.textContent='Copy saved as version '+(saved?saved.number:'')+'. Inspect the edges. Undo restores the source; the copy stays in history.';status.setAttribute('role','status');message('Flat-colour removal copy saved. Compare it with the untouched source.');},'Saving the inspected background-removal preview…',button,function(error){status.textContent=error.message;status.setAttribute('role','alert');});}
        function choosePackageFolder(){
            if(!window.isSecureContext||typeof window.showDirectoryPicker!=='function')return Promise.resolve(null);
            exportPickerOpen=true;controls();message('Choose a folder for the ZIP. Select Downloads to use the Smutty Studio ZIP files folder.');
            var picker;
            try{picker=window.showDirectoryPicker({id:'sbs-local-finishing-packages',mode:'readwrite',startIn:'downloads'});}catch(error){picker=Promise.reject(error);}
            return picker.then(async function(folder){
                if(folder.name&&folder.name.toLowerCase()==='downloads'){return await folder.getDirectoryHandle('Smutty Studio ZIP files',{create:true});}
                return folder;
            }).catch(function(error){
                if(error&&error.name==='AbortError'){message('Folder selection cancelled. No ZIP package was built.');return undefined;}
                message('Folder selection is unavailable. The browser download option will be used.',true);return null;
            }).finally(function(){exportPickerOpen=false;controls();});
        }
        async function uniquePackageName(folder,filename){
            var base=filename.replace(/\.zip$/i,'')||'Artwork-local-finishing';
            for(var index=1;index<=100;index++){
                var candidate=(index===1?base:base+'-'+index)+'.zip';
                try{await folder.getFileHandle(candidate);}
                catch(error){if(error&&error.name==='NotFoundError')return candidate;throw error;}
            }
            throw new Error('A unique filename could not be found in this folder.');
        }
        async function savePackageInFolder(folder,pkg){
            var filename=await uniquePackageName(folder,pkg.filename);
            var response=await fetch(pkg.url,{credentials:'same-origin'});
            if(!response.ok)throw new Error('The package was built, but the ZIP could not be read for saving.');
            var handle=await folder.getFileHandle(filename,{create:true});
            var writable=await handle.createWritable();
            try{if(response.body&&typeof response.body.pipeTo==='function'){await response.body.pipeTo(writable);}else{await writable.write(await response.blob());await writable.close();}}
            catch(error){try{await writable.abort();}catch(ignore){}throw new Error('The package was built, but it could not be written to the chosen folder.');}
            return filename;
        }
        function chooseFile(input){var file=input.files&&input.files[0];selectedFile=file||null;if(!file){message('No file selected. Choose Photos / Gallery or Files / My Files.',true);uploadMessage('No file selected. Choose an image to continue.');return;}var other=el(input.id==='sbs-af-file'?'sbs-af-gallery-file':'sbs-af-file');other.value='';if(file.size>20*1024*1024){selectedFile=null;input.value='';var warning='This file is '+fileSize(file.size)+'. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.';message(warning,true);uploadMessage(warning,'error');return;}var selected=file.name+' selected ('+fileSize(file.size)+'). Press Store untouched original locally to continue.';message(selected);uploadMessage(selected);}
        function setTransparency(id,result){var box=el(id);box.dataset.state=result==='Opaque'?'opaque':result==='Partial alpha'?'partial':result==='Genuine transparency'?'transparent':'unknown';box.querySelector('.sbs-transparency-label').textContent='Transparency: '+result;}
        async function inspectTransparency(imageId,indicatorId){
            var img=el(imageId),box=el(indicatorId),source=img.getAttribute('src');box.hidden=!source;
            if(!source){box.dataset.inspectKey='';setTransparency(indicatorId,'Not checked');return;}
            if(box.dataset.inspectKey===source)return;
            box.dataset.inspectKey=source;setTransparency(indicatorId,'Not checked');
            try{await img.decode();if(img.getAttribute('src')!==source||box.dataset.inspectKey!==source)return;var width=img.naturalWidth,height=img.naturalHeight,total=width*height;if(!width||!height||total>32000000)throw new Error('Pixel inspection unavailable');var canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;var context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Pixel inspection unavailable');context.drawImage(img,0,0);var result=classifyTransparency(context.getImageData(0,0,width,height).data);if(img.getAttribute('src')===source&&box.dataset.inspectKey===source)setTransparency(indicatorId,result);}
            catch(error){if(img.getAttribute('src')===source&&box.dataset.inspectKey===source)setTransparency(indicatorId,'Not checked');}
        }
        function image(id,asset,alt){var img=el(id);img.hidden=!asset;if(asset){if(img.getAttribute('src')!==asset.url)img.src=asset.url;img.alt=alt;}else{img.removeAttribute('src');img.alt='';}}
        function refreshPrintStatus(){
            var q=activePrintQA,status=el('sbs-af-print-status');
            if(!q){status.textContent='PPI: unavailable | Target: 300';status.dataset.state='warning';return;}
            var width=Number(el('sbs-af-width').value),height=Number(el('sbs-af-height').value);
            if(!isFinite(width)||!isFinite(height)||width<=0||height<=0){status.textContent='PPI: unavailable | Enter a valid print size';status.dataset.state='warning';return;}
            var pxW=Number(q.width),pxH=Number(q.height),ppi=Math.max(pxW/width,pxH/height);
            var fitW=Math.min(width,height*pxW/pxH),fitH=Math.min(height,width*pxH/pxW),suggestedWidth=pxW/300,suggestedHeight=pxH/300;
            status.dataset.state=ppi>=300?'ok':ppi>=250?'review':'fail';
            var rating=ppi>=300?'GREEN — 300 PPI target met':ppi>=250?'AMBER — 250–299 PPI; review image detail':'RED FLAG — below 250 PPI; reduce print size or consider upscaling';
            status.textContent=rating+' · '+ppi.toFixed(1)+' PPI when fitted inside '+width+' × '+height+' in (artwork '+fitW.toFixed(2)+' × '+fitH.toFixed(2)+' in). At 300 PPI: '+suggestedWidth.toFixed(2)+' × '+suggestedHeight.toFixed(2)+' in.';
        }
        function renderPrintProof(q,asset,isCandidate){
            var section=el('sbs-af-print-proof');
            section.hidden=!asset;activePrintQA=q||null;
            if(!asset){el('sbs-af-print-proof-title').textContent='Four-colour print check';refreshPrintStatus();return;}
            el('sbs-af-print-proof-title').textContent=isCandidate?'Garment-colour candidate proof':'Garment-colour source proof';
            activeProofAssetUrl=asset.url;
            refreshPrintStatus();
            var key=(asset.uuid||asset.url||'')+'|'+(isCandidate?'candidate':'original');
            if(proofSourceKey===key&&proofPreviewUrl)return;
            proofSourceKey=key;proofRenderedKey='';
            var source=el(isCandidate?'sbs-af-candidate':'sbs-af-original');
            function drawPreview(){
                if(proofSourceKey!==key||proofRenderedKey===key||!source.naturalWidth||!source.naturalHeight)return;
                proofRenderedKey=key;
                try{
                    var scale=Math.min(1,512/source.naturalWidth,512/source.naturalHeight);
                    var canvas=document.createElement('canvas');
                    canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
                    canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
                    var context=canvas.getContext('2d');
                    if(!context)throw new Error('Canvas unavailable');
                    context.drawImage(source,0,0,canvas.width,canvas.height);
                    function showPreview(url){
                        if(proofSourceKey!==key)return;
                        if(proofPreviewUrl&&proofPreviewUrl.indexOf('blob:')===0)URL.revokeObjectURL(proofPreviewUrl);
                        proofPreviewUrl=url;
                        document.querySelectorAll('[data-af-proof-image]').forEach(function(img){
                            img.src=url;img.alt='Artwork on '+img.getAttribute('data-af-proof-image')+' proof background';img.hidden=false;
                            img.style.width=Number(el('sbs-af-zoom').value)*100+'%';
                        });
                    }
                    if(typeof canvas.toBlob==='function'){
                        canvas.toBlob(function(blob){if(blob)showPreview(URL.createObjectURL(blob));else showPreview(canvas.toDataURL('image/png'));},'image/png');
                    }else{showPreview(canvas.toDataURL('image/png'));}
                }catch(error){
                    document.querySelectorAll('[data-af-proof-image]').forEach(function(img){img.hidden=true;img.removeAttribute('src');});
                    el('sbs-af-proof-status').textContent='The four-colour preview could not be rendered. Use the original/candidate comparison above.';
                }
            }
            source.addEventListener('load',drawPreview,{once:true});
            if(source.complete&&source.naturalWidth)drawPreview();
        }
        var viewer=el('sbs-af-proof-viewer'), viewerStage=el('sbs-af-proof-stage'), viewerImage=el('sbs-af-proof-large'), viewerScale=1, viewerX=0, viewerY=0, viewerPointers=new Map(), viewerStart=null, viewerOpener=null;
        var aiFocus=el('sbs-af-ai-focus'), aiFocusStage=el('sbs-af-ai-focus-stage'), aiFocusImage=null, aiFocusMoveState=null, aiFocusData=null, aiFocusOpener=null, aiFocusSide='candidate', aiFocusZoom=4, aiFocusCenter=null, aiFocusPointers=new Map(), aiFocusGesture=null, aiFocusTap=null, aiFocusNoteBase='';
        var autoCleanupState={};
        function aiFocusFit(image){var bounds=aiFocusStage.getBoundingClientRect();return Math.min(bounds.width/image.naturalWidth,bounds.height/image.naturalHeight);}
        function aiFocusClampScroll(){aiFocusStage.scrollLeft=Math.max(0,Math.min(aiFocusStage.scrollWidth-aiFocusStage.clientWidth,aiFocusStage.scrollLeft));aiFocusStage.scrollTop=Math.max(0,Math.min(aiFocusStage.scrollHeight-aiFocusStage.clientHeight,aiFocusStage.scrollTop));}
        function updateAiFocusMarker(width,height){
            var marker=el('sbs-af-ai-focus-marker');
            if(!aiFocusData||!aiFocusData.focus||!width||!height){marker.setAttribute('hidden','');return;}
            var naturalW=aiFocusImage&&aiFocusImage.naturalWidth||width,naturalH=aiFocusImage&&aiFocusImage.naturalHeight||height;
            var box=cleanupFocusBox(naturalW,naturalH,aiFocusData.focus);
            marker.style.width=(box.w/naturalW*width)+'px';marker.style.height=(box.h/naturalH*height)+'px';
            marker.style.left=(box.x/naturalW*width)+'px';marker.style.top=(box.y/naturalH*height)+'px';marker.removeAttribute('hidden');
        }
        function positionAiFocusImage(){
            if(aiFocus.hidden||!aiFocusImage||!aiFocusImage.complete||!aiFocusImage.naturalWidth)return;
            var base=aiFocusFit(aiFocusImage),initialScale=base*4,scale=initialScale*(aiFocusZoom/4),width=aiFocusImage.naturalWidth*scale,height=aiFocusImage.naturalHeight*scale;
            aiFocusImage.style.width=width+'px';aiFocusImage.style.height=height+'px';aiFocusImage.style.maxWidth='none';aiFocusImage.style.maxHeight='none';aiFocusImage.style.margin='0';
            var marker=el('sbs-af-ai-focus-marker');aiFocusStage.appendChild(marker);updateAiFocusMarker(width,height);
            requestAnimationFrame(function(){var center=aiFocusCenter||aiFocusData&&aiFocusData.focus||{x:.5,y:.5};aiFocusStage.scrollLeft=Math.max(0,Math.min(aiFocusStage.scrollWidth-aiFocusStage.clientWidth,center.x*width-aiFocusStage.clientWidth/2));aiFocusStage.scrollTop=Math.max(0,Math.min(aiFocusStage.scrollHeight-aiFocusStage.clientHeight,center.y*height-aiFocusStage.clientHeight/2));});
        }
        function saveAiFocusView(){
            if(!aiFocusImage||!aiFocusImage.naturalWidth)return;
            var width=aiFocusImage.naturalWidth*aiFocusFit(aiFocusImage)*aiFocusZoom,height=aiFocusImage.naturalHeight*aiFocusFit(aiFocusImage)*aiFocusZoom;
            aiFocusCenter={x:Math.max(0,Math.min(1,(aiFocusStage.scrollLeft+aiFocusStage.clientWidth/2)/width)),y:Math.max(0,Math.min(1,(aiFocusStage.scrollTop+aiFocusStage.clientHeight/2)/height))};
        }
        function setAiFocusSide(side){
            if(!aiFocusData)return;saveAiFocusView();var imageNode=el(side==='original'?'sbs-af-original':'sbs-af-candidate');if(!imageNode||!imageNode.src)return;aiFocusSide=side;
            if(aiFocusMoveState){aiFocusMoveState.parent.insertBefore(aiFocusMoveState.node,aiFocusMoveState.next&&aiFocusMoveState.next.parentNode===aiFocusMoveState.parent?aiFocusMoveState.next:null);aiFocusMoveState.node.style.cssText=aiFocusMoveState.cssText;aiFocusMoveState.node.alt=aiFocusMoveState.alt;aiFocusMoveState.node.hidden=aiFocusMoveState.hidden;aiFocusMoveState.node.onload=aiFocusMoveState.onload;aiFocusMoveState=null;}
            aiFocusMoveState={node:imageNode,parent:imageNode.parentNode,next:imageNode.nextSibling,cssText:imageNode.style.cssText,alt:imageNode.alt,hidden:imageNode.hidden,onload:imageNode.onload};aiFocusImage=imageNode;aiFocusImage.hidden=false;
            aiFocusImage.alt=(side==='original'?'Untouched original':'Finishing candidate')+' — enlarged view of '+aiFocusData.area;
            el('sbs-af-ai-focus-original').setAttribute('aria-pressed',side==='original'?'true':'false');el('sbs-af-ai-focus-candidate').setAttribute('aria-pressed',side==='candidate'?'true':'false');el('sbs-af-ai-focus-viewing').textContent='Viewing: '+(side==='original'?'Original':'Candidate');
            aiFocusImage.onload=positionAiFocusImage;aiFocusStage.appendChild(aiFocusImage);if(aiFocusImage.complete)positionAiFocusImage();
        }
        function updateAiFocusNote(){el('sbs-af-ai-focus-note').textContent=aiFocusNoteBase+' Current zoom: '+aiFocusZoom.toFixed(1)+'×.';}
        function openAiFocus(finding,opener){
            var version=current&&current.versions.find(function(v){return v.uuid===current.current_version;});if(!current||!current.original||!version||!version.asset)return;
            var focus=finding.focus&&isFinite(Number(finding.focus.x))&&isFinite(Number(finding.focus.y))&&Number(finding.focus.x)>=0&&Number(finding.focus.x)<=1&&Number(finding.focus.y)>=0&&Number(finding.focus.y)<=1?{x:Number(finding.focus.x),y:Number(finding.focus.y)}:null;
            aiFocusData={area:finding.area||'Flagged area',focus:focus,original:current.original,candidate:version.asset,finding:finding};aiFocusOpener=opener||document.activeElement;aiFocusZoom=4;aiFocusCenter=focus||{x:.5,y:.5};aiFocusPointers.clear();aiFocusGesture=null;aiFocusTap=null;
            el('sbs-af-ai-focus-title').textContent=aiFocusData.area;aiFocusNoteBase=focus?'AI-estimated location. A yellow outline marks the approximate area and follows it as you zoom and pan; it is not an exact defect boundary. Starts at 4×; pinch to zoom, drag to pan, tap to compare.':'No AI location was saved. No area outline is available. Starts at 4×; pinch to zoom, drag to pan, tap to compare.';
            if(finding.method==='sampled_alpha')aiFocusNoteBase='Approximate sampled point; it may be intentional. A yellow outline marks the nearby area, not the defect boundary. Starts at 4×; pinch to zoom, drag to pan, tap to compare.';updateAiFocusNote();
            aiFocus.hidden=false;document.body.style.overflow='hidden';setAiFocusSide('candidate');el('sbs-af-ai-focus-close').focus();
        }
        function closeAiFocus(){if(aiFocus.hidden)return;aiFocus.hidden=true;if(aiFocusMoveState){aiFocusMoveState.parent.insertBefore(aiFocusMoveState.node,aiFocusMoveState.next&&aiFocusMoveState.next.parentNode===aiFocusMoveState.parent?aiFocusMoveState.next:null);aiFocusMoveState.node.style.cssText=aiFocusMoveState.cssText;aiFocusMoveState.node.alt=aiFocusMoveState.alt;aiFocusMoveState.node.hidden=aiFocusMoveState.hidden;aiFocusMoveState.node.onload=aiFocusMoveState.onload;aiFocusMoveState=null;}aiFocusImage=null;aiFocusStage.scrollLeft=0;aiFocusStage.scrollTop=0;aiFocusData=null;aiFocusCenter=null;aiFocusPointers.clear();aiFocusGesture=null;aiFocusTap=null;el('sbs-af-ai-focus-marker').setAttribute('hidden','');document.body.style.overflow='';if(aiFocusOpener&&aiFocusOpener.focus)aiFocusOpener.focus();}
        el('sbs-af-ai-focus-original').addEventListener('click',function(){setAiFocusSide('original');});el('sbs-af-ai-focus-candidate').addEventListener('click',function(){setAiFocusSide('candidate');});el('sbs-af-ai-focus-close').addEventListener('click',closeAiFocus);
        document.querySelectorAll('[data-af-finding-decision]').forEach(function(button){button.addEventListener('click',function(){if(!aiFocusData||!aiFocusData.finding)return;var finding=aiFocusData.finding;closeAiFocus();reviewFinding(finding,button.getAttribute('data-af-finding-decision'));});});
        el('sbs-af-focus-fix').addEventListener('click',function(){if(!aiFocusData||!aiFocusData.finding)return;var finding=aiFocusData.finding;closeAiFocus();openArtworkEditor(finding);});
        function aiFocusPoint(event){var rect=aiFocusStage.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
        function beginAiFocusGesture(){var points=Array.from(aiFocusPointers.values()).slice(0,2);if(points.length<2||!aiFocusImage)return;var mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance=Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)),factor=aiFocusFit(aiFocusImage)*aiFocusZoom;aiFocusGesture={distance:distance,zoom:aiFocusZoom,anchorX:(aiFocusStage.scrollLeft+mid.x)/factor,anchorY:(aiFocusStage.scrollTop+mid.y)/factor};}
        function aiFocusPointerDown(event){if(!aiFocusData||event.target.closest('button'))return;event.preventDefault();aiFocusStage.setPointerCapture(event.pointerId);var p=aiFocusPoint(event);aiFocusPointers.set(event.pointerId,p);if(aiFocusPointers.size===1)aiFocusTap={id:event.pointerId,x:p.x,y:p.y,left:aiFocusStage.scrollLeft,top:aiFocusStage.scrollTop,moved:false};else{aiFocusTap=null;if(aiFocusPointers.size===2)beginAiFocusGesture();}}
        function aiFocusPointerMove(event){if(!aiFocusPointers.has(event.pointerId))return;event.preventDefault();var p=aiFocusPoint(event);aiFocusPointers.set(event.pointerId,p);if(aiFocusPointers.size>=2){if(!aiFocusGesture)beginAiFocusGesture();var points=Array.from(aiFocusPointers.values()).slice(0,2),mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance=Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y));aiFocusZoom=Math.max(1,Math.min(12,aiFocusGesture.zoom*distance/aiFocusGesture.distance));updateAiFocusNote();var base=aiFocusFit(aiFocusImage),width=aiFocusImage.naturalWidth*base*aiFocusZoom,height=aiFocusImage.naturalHeight*base*aiFocusZoom;aiFocusImage.style.width=width+'px';aiFocusImage.style.height=height+'px';updateAiFocusMarker(width,height);aiFocusStage.scrollLeft=aiFocusGesture.anchorX*base*aiFocusZoom-mid.x;aiFocusStage.scrollTop=aiFocusGesture.anchorY*base*aiFocusZoom-mid.y;aiFocusClampScroll();return;}if(aiFocusTap&&aiFocusTap.id===event.pointerId){var dx=p.x-aiFocusTap.x,dy=p.y-aiFocusTap.y;if(Math.hypot(dx,dy)>8)aiFocusTap.moved=true;if(aiFocusTap.moved){aiFocusStage.scrollLeft=aiFocusTap.left-dx;aiFocusStage.scrollTop=aiFocusTap.top-dy;}}}
        function aiFocusPointerEnd(event,cancel){if(!aiFocusPointers.has(event.pointerId))return;var wasMulti=aiFocusPointers.size>1,tap=aiFocusTap&&aiFocusTap.id===event.pointerId&&!aiFocusTap.moved&&!cancel;aiFocusPointers.delete(event.pointerId);if(wasMulti){aiFocusGesture=null;aiFocusTap=null;if(aiFocusPointers.size===1){var remaining=Array.from(aiFocusPointers.entries())[0];aiFocusTap={id:remaining[0],x:remaining[1].x,y:remaining[1].y,left:aiFocusStage.scrollLeft,top:aiFocusStage.scrollTop,moved:true};}}else if(tap){aiFocusTap=null;setAiFocusSide(aiFocusSide==='candidate'?'original':'candidate');}else aiFocusTap=null;if(aiFocusPointers.size===0){aiFocusGesture=null;try{aiFocusStage.releasePointerCapture(event.pointerId);}catch(error){}}}
        aiFocusStage.addEventListener('pointerdown',aiFocusPointerDown);aiFocusStage.addEventListener('pointermove',aiFocusPointerMove);aiFocusStage.addEventListener('pointerup',function(event){aiFocusPointerEnd(event,false);});aiFocusStage.addEventListener('pointercancel',function(event){aiFocusPointerEnd(event,true);});aiFocusStage.addEventListener('lostpointercapture',function(event){aiFocusPointerEnd(event,true);});
        aiFocusStage.addEventListener('keydown',function(event){if(event.key==='Home'){event.preventDefault();aiFocusStage.scrollTo({left:0,top:0,behavior:'smooth'});}else if(event.key==='End'){event.preventDefault();aiFocusStage.scrollTo({left:aiFocusStage.scrollWidth,top:aiFocusStage.scrollHeight,behavior:'smooth'});}});
        function paintViewerTransform(){viewerImage.style.transform='translate3d('+viewerX+'px,'+viewerY+'px,0) scale('+viewerScale+')';}
        function resetViewer(){viewerScale=1;viewerX=0;viewerY=0;paintViewerTransform();}
        function selectViewerColor(color){viewer.dataset.color=color;document.querySelectorAll('[data-viewer-color]').forEach(function(button){var selected=button.getAttribute('data-viewer-color')===color;button.setAttribute('aria-pressed',selected?'true':'false');});}
        function openProofViewer(color,opener){if(!activeProofAssetUrl)return;viewerOpener=opener||document.activeElement;viewerImage.src=activeProofAssetUrl;selectViewerColor(color);resetViewer();viewer.hidden=false;document.body.style.overflow='hidden';el('sbs-af-proof-close').focus();}
        function closeProofViewer(){if(viewer.hidden)return;viewer.hidden=true;document.body.style.overflow='';viewerImage.removeAttribute('src');viewerPointers.clear();if(viewerOpener&&viewerOpener.focus)viewerOpener.focus();}
        function pointDistance(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
        function stagePoint(event){var rect=viewerStage.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
        viewerStage.addEventListener('pointerdown',function(event){if(viewer.hidden)return;event.preventDefault();viewerStage.setPointerCapture(event.pointerId);var point=stagePoint(event);viewerPointers.set(event.pointerId,point);if(viewerPointers.size===1){viewerStart={type:'pan',x:point.x,y:point.y,baseX:viewerX,baseY:viewerY};}else if(viewerPointers.size===2){var points=Array.from(viewerPointers.values());viewerStart={type:'pinch',distance:Math.max(1,pointDistance(points[0],points[1])),scale:viewerScale,x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2,baseX:viewerX,baseY:viewerY};}});
        viewerStage.addEventListener('pointermove',function(event){if(!viewerPointers.has(event.pointerId)||!viewerStart)return;event.preventDefault();viewerPointers.set(event.pointerId,stagePoint(event));var points=Array.from(viewerPointers.values());if(points.length>=2){var start=viewerStart;if(start.type!=='pinch'){start={type:'pinch',distance:Math.max(1,pointDistance(points[0],points[1])),scale:viewerScale,x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2,baseX:viewerX,baseY:viewerY};viewerStart=start;}var centerX=(points[0].x+points[1].x)/2,centerY=(points[0].y+points[1].y)/2,nextScale=Math.max(1,Math.min(8,start.scale*pointDistance(points[0],points[1])/start.distance)),rect=viewerStage.getBoundingClientRect(),localX=(start.x-rect.width/2-start.baseX)/start.scale,localY=(start.y-rect.height/2-start.baseY)/start.scale;viewerScale=nextScale;viewerX=centerX-rect.width/2-localX*nextScale;viewerY=centerY-rect.height/2-localY*nextScale;}else if(viewerScale>1){var p=points[0];viewerX=viewerStart.baseX+p.x-viewerStart.x;viewerY=viewerStart.baseY+p.y-viewerStart.y;}paintViewerTransform();});
        function releaseViewerPointer(event){viewerPointers.delete(event.pointerId);if(viewerPointers.size===1){var entry=Array.from(viewerPointers.values())[0];viewerStart={type:'pan',x:entry.x,y:entry.y,baseX:viewerX,baseY:viewerY};}else if(!viewerPointers.size)viewerStart=null;}
        viewerStage.addEventListener('pointerup',releaseViewerPointer);viewerStage.addEventListener('pointercancel',releaseViewerPointer);viewerStage.addEventListener('lostpointercapture',releaseViewerPointer);
        document.querySelectorAll('.sbs-af-proof-swatch').forEach(function(button){button.addEventListener('click',function(){openProofViewer(button.getAttribute('data-proof-color'),button);});});
        document.querySelectorAll('[data-viewer-color]').forEach(function(button){button.addEventListener('click',function(){selectViewerColor(button.getAttribute('data-viewer-color'));});});
        el('sbs-af-proof-reset').addEventListener('click',resetViewer);el('sbs-af-proof-close').addEventListener('click',closeProofViewer);
        document.addEventListener('keydown',function(event){if(event.key==='Escape'){if(!aiFocus.hidden){event.preventDefault();closeAiFocus();}else if(!viewer.hidden){event.preventDefault();closeProofViewer();}}});
        viewerImage.addEventListener('load',resetViewer);
        function friendlyName(title){return (title||'Artwork').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019']/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,110)||'Artwork';}
        function cleanupFocusBox(width,height,focus){
            var side=Math.max(64,Math.min(180,Math.min(width,height)*.08));
            side=Math.min(side,width,height);
            var x=Math.max(0,Math.min(width-side,Math.round(Number(focus.x)*width-side/2)));
            var y=Math.max(0,Math.min(height-side,Math.round(Number(focus.y)*height-side/2)));
            return {x:x,y:y,w:side,h:side};
        }
        function medianChannel(values){values.sort(function(a,b){return a-b;});return values[Math.floor(values.length/2)]||0;}
        async function runAutomaticSquareCleanup(finding,button,status){
            var version=selectedCandidate();
            if(!current||!version||!finding.focus)throw new Error('Select a candidate and a flagged area first.');
            button.disabled=true;status.dataset.state='busy';status.textContent='Working…';
            message('Checking only the highlighted square. The original is unchanged.');
            try{
                var image=new Image();image.src=version.asset.url;await image.decode();
                var canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
                var ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Automatic cleanup is unavailable in this browser.');
                ctx.drawImage(image,0,0);
                var before=ctx.getImageData(0,0,canvas.width,canvas.height),source=before.data;
                var box=cleanupFocusBox(canvas.width,canvas.height,finding.focus),out=new Uint8ClampedArray(source);
                var changed=0,remaining=0,readX=box.x,readY=box.y;
                function inspectPass(input,write){
                    var edits=0,pending=[];
                    for(var y=box.y;y<box.y+box.h;y++){
                        for(var x=box.x;x<box.x+box.w;x++){
                            var i=(y*canvas.width+x)*4,a=input[i+3];if(a===0||a===255)continue;
                            var rs=[],gs=[],bs=[];
                            for(var ny=Math.max(box.y,y-2);ny<=Math.min(box.y+box.h-1,y+2);ny++){
                                for(var nx=Math.max(box.x,x-2);nx<=Math.min(box.x+box.w-1,x+2);nx++){
                                    if(nx===x&&ny===y)continue;var ni=(ny*canvas.width+nx)*4;
                                    if(input[ni+3]===255){rs.push(input[ni]);gs.push(input[ni+1]);bs.push(input[ni+2]);}
                                }
                            }
                            if(rs.length<5)continue;
                            var mr=medianChannel(rs),mg=medianChannel(gs),mb=medianChannel(bs),distance=Math.max(Math.abs(input[i]-mr),Math.abs(input[i+1]-mg),Math.abs(input[i+2]-mb));
                            if(distance>42){remaining++;if(write)pending.push([i,mr,mg,mb,a]);}
                            
                        }
                    }
                    pending.forEach(function(p){if(input[p[0]]!==p[1]||input[p[0]+1]!==p[2]||input[p[0]+2]!==p[3]||input[p[0]+3]!==p[4]){edits++;if(write){out[p[0]]=p[1];out[p[0]+1]=p[2];out[p[0]+2]=p[3];out[p[0]+3]=p[4];}}});
                    return edits;
                }
                inspectPass(source,true);changed=0;
                for(var py=box.y;py<box.y+box.h;py++)for(var px=box.x;px<box.x+box.w;px++){var pi=(py*canvas.width+px)*4;if(source[pi]!==out[pi]||source[pi+1]!==out[pi+1]||source[pi+2]!==out[pi+2]||source[pi+3]!==out[pi+3])changed++;}
                remaining=0;inspectPass(out,false);
                for(var oy=0;oy<canvas.height;oy++)for(var ox=0;ox<canvas.width;ox++){
                    if(ox>=box.x&&ox<box.x+box.w&&oy>=box.y&&oy<box.y+box.h)continue;
                    var oi=(oy*canvas.width+ox)*4;if(source[oi]!==out[oi]||source[oi+1]!==out[oi+1]||source[oi+2]!==out[oi+2]||source[oi+3]!==out[oi+3])throw new Error('Safety check stopped the save because pixels outside the highlighted square changed.');
                }
                if(!changed){status.dataset.state='warning';status.textContent='No safe changes found. Don’t repeat this pass.';button.disabled=true;message('No edge pixels could be changed safely. The original and candidate are unchanged.');return;}
                var after=ctx.createImageData(canvas.width,canvas.height);after.data.set(out);ctx.putImageData(after,0,0);
                var blob=await new Promise(function(resolve,reject){canvas.toBlob(function(b){b?resolve(b):reject(new Error('Could not prepare the new PNG copy.'));},'image/png');});
                await saveImageEdit(blob,'touchup',version.uuid,button);
                var state=autoCleanupState[finding.id]||(autoCleanupState[finding.id]={passes:0,changed:0,stopped:false});
                state.passes++;state.changed+=changed;state.remaining=remaining;state.sourceVersion=version.uuid;
                state.stopped=remaining===0||state.passes>=2;
                status.dataset.state=remaining?'warning':'success';
                status.textContent=remaining?'Pass '+state.passes+' changed '+changed+' pixels; issues remain. Compare the copy before deciding.':'Pass '+state.passes+' checked. No matching colour fringe remains in this square; compare before saving.';
                button.disabled=state.stopped;
                render();
                var overall=el('sbs-af-ai-status');overall.dataset.state=remaining?'review':'success';overall.textContent=status.textContent;
                message(status.textContent,remaining>0);
            }catch(error){status.dataset.state='fail';status.textContent='Fix not saved; check the original and try again later.';button.disabled=false;message(error.message,true);throw error;}
        }
        function renderAiReview(version){
            var section=el('sbs-af-ai-review'),button=el('sbs-af-ai-review-run'),report=el('sbs-af-ai-review-report'),status=el('sbs-af-ai-status');
            section.hidden=!version;button.disabled=busy||!version;report.replaceChildren();
            if(!version)return;
            if(status.dataset.version!==version.uuid){status.dataset.version=version.uuid;status.dataset.state='';status.textContent=version.ai_review?'Comparison complete. See the report below.':'Not run. This check is optional.';}
            var reject=document.createElement('button');reject.type='button';reject.className='sbs-button';reject.textContent='Reject this candidate (keep in history)';reject.disabled=busy||version.review_disposition==='rejected';reject.addEventListener('click',function(){if(window.confirm('Reject this candidate? Its version and artwork will remain in history, and it cannot be approved.'))operation(function(){return action('reject_candidate');},'Marking candidate rejected; history is preserved…',reject);});report.appendChild(reject);
            if(!version.ai_review){if(status.dataset.state!=='error'&&status.textContent.indexOf('Comparing')!==0){status.dataset.state='';status.textContent='Not run. This check is optional.';}var prompt=document.createElement('p');prompt.textContent='No AI comparison has been run. AI review is optional.';report.appendChild(prompt);return;}
            var result=version.ai_review,findings=(result.findings||[]).filter(function(finding){return finding.severity!=='info';});
            status.dataset.state=result.overall==='unable'?'review':'success';
            status.textContent=findings.length?'AI check: '+findings.length+' area'+(findings.length===1?'':'s')+' to inspect.':result.overall==='unable'?'AI could not assess the image reliably.':'AI check: no specific issues flagged.';
            if(!findings.length){var none=document.createElement('p');none.textContent=result.overall==='unable'?'Try the 4× comparison and inspect the artwork manually.':'No specific issues flagged. AI can miss defects.';report.appendChild(none);return;}
            var findingsHeading=document.createElement('h4');findingsHeading.textContent='Areas to inspect';report.appendChild(findingsHeading);
            var zoomHelp=document.createElement('p');zoomHelp.className='sbs-af-ai-zoom-help';zoomHelp.textContent='View area opens at 4×. The outlined square is also the limit for automatic cleanup.';report.appendChild(zoomHelp);
            var findingsList=document.createElement('ol');findingsList.className='sbs-af-review-points sbs-af-ai-findings';
            findings.forEach(function(finding,index){
                var item=document.createElement('li');item.dataset.severity=finding.severity;
                var heading=document.createElement('strong');heading.textContent=(index+1)+'. '+finding.area;item.appendChild(heading);
                var severity=document.createElement('p');severity.className='sbs-af-finding-status';severity.textContent=finding.severity==='concern'?'ACTION NEEDED — review before approval':'REVIEW — AI suggestion; confirm against the original';item.appendChild(severity);
                var issue=document.createElement('p');issue.textContent=finding.issue+' Next: '+finding.action;item.appendChild(issue);
                var saved=(version.review_decisions||{})[finding.id],state=document.createElement('p');state.className='sbs-af-finding-decision';state.textContent=saved?'Your review: '+saved.decision.replace('_',' '):'Not confirmed as a defect until you review it.';item.appendChild(state);
                var cleanupStatus=document.createElement('p');cleanupStatus.className='sbs-af-cleanup-status';cleanupStatus.dataset.state='not-run';cleanupStatus.setAttribute('role','status');cleanupStatus.setAttribute('aria-live','polite');
                var cleanup=autoCleanupState[finding.id];cleanupStatus.textContent=cleanup?(cleanup.stopped?'No further automatic passes recommended.':cleanup.remaining===0&&cleanup.passes?'Checked after '+cleanup.passes+' pass(es). Compare the copy.':'Ready. No automatic repeat.'): 'Not run. This careful check only changes the flagged square.';item.appendChild(cleanupStatus);
                var row=document.createElement('div');row.className='sbs-af-finding-actions';row.setAttribute('role','group');row.setAttribute('aria-label','Steps for '+finding.area);
                function addButton(label,callback,disabled){var b=document.createElement('button');b.type='button';b.className='sbs-button';b.textContent=label;b.disabled=!!disabled||busy;b.addEventListener('click',callback);row.appendChild(b);return b;}
                var zoomButton=addButton('1. View square',function(){openAiFocus(finding,zoomButton);},false);zoomButton.classList.add('sbs-af-ai-zoom-button');
                var cleanupButton=addButton('2. Auto-clean square',function(){runAutomaticSquareCleanup(finding,cleanupButton,cleanupStatus).catch(function(){});},!finding.focus||!!(cleanup&&cleanup.stopped));
                function addArrow(){var arrow=document.createElement('span');arrow.className='sbs-af-step-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='→';row.appendChild(arrow);}
                addArrow();
                addButton('3. Compare copy',function(){var view=el('sbs-af-ai-focus-candidate');openAiFocus(finding,view);},false);
                addArrow();
                addButton('4. Recheck artwork',function(){operation(function(){return action('ai_review');},'Rechecking the edited copy…',button);},false);
                addArrow();
                addButton('Accept as intentional',function(){reviewFinding(finding,'intentional');},!finding.id);
                addButton('False alarm',function(){reviewFinding(finding,'false_alarm');},!finding.id);
                addButton('Leave unresolved',function(){reviewFinding(finding,'unresolved');},!finding.id);
                item.appendChild(row);findingsList.appendChild(item);
            });
            report.appendChild(findingsList);
        }
        function reviewFinding(finding,decision){if(!finding.id)return;var button=document.activeElement;operation(function(){return action('review_finding',{finding_id:finding.id,decision:decision});},'Saving finding review…',button);}
        function renderHandoff(version){
            var status=el('sbs-af-readiness'),text=el('sbs-af-handoff-text'),copy=el('sbs-af-copy-handoff');
            if(!current||!version){status.dataset.state='fail';status.textContent='FAIL — select a candidate before handoff.';text.value='Upload artwork and select a finishing candidate first.';copy.disabled=true;return;}
            copy.disabled=false;
            var q=version.qa||{},sourceQA=current.original_qa||{},geometry=version.comparison&&version.comparison.geometry||{},review=version.ai_review||null;
            if((!isFinite(Number(geometry.width_scale))||!isFinite(Number(geometry.height_scale)))&&Number(sourceQA.width)>0&&Number(sourceQA.height)>0&&Number(q.width)>0&&Number(q.height)>0){
                var sx=Number(q.width)/Number(sourceQA.width),sy=Number(q.height)/Number(sourceQA.height),mismatch=Math.abs(sx-sy)/Math.max(sx,sy)*100;
                geometry={status:mismatch<=0.2?'proportional':'review',width_scale:sx,height_scale:sy,nonuniform_scale_percent:mismatch,message:mismatch<=0.2?'Original and candidate dimensions changed proportionally. This cannot detect local warping.':'Original and candidate dimensions changed by different proportions; inspect for stretch or crop.'};
            }
            var ppi=Number(q.effective_ppi),width=Number(version.options&&version.options.width),height=Number(version.options&&version.options.height);
            var flags=[];
            var suggested=isFinite(Number(q.width))&&isFinite(Number(q.height))?(Number(q.width)/300).toFixed(2)+' × '+(Number(q.height)/300).toFixed(2)+' inches':'not available';
            if(!isFinite(ppi)||ppi<300){flags.push('PPI is '+(isFinite(ppi)?ppi.toFixed(1):'unverified')+'; 300 target. Suggested maximum: '+suggested+' at 300 PPI.');}
            if(geometry.status!=='proportional'&&geometry.status!=='trimmed'){flags.push('Image proportions need review.');}
            var sourceAlpha=String(sourceQA.alpha||'Unknown'),candidateAlpha=String(q.alpha||'Unknown');
            var alphaClass=function(value){if(/unknown|unverified|could not/i.test(value))return 'unknown';if(/partial|semi-transparent/i.test(value))return 'partial';if(/opaque|no transparency/i.test(value))return 'opaque';if(/transparent/i.test(value))return 'transparent';return 'unknown';};
            var alphaMatches=typeof geometry.transparency_sample_matches==='boolean'?geometry.transparency_sample_matches:(alphaClass(sourceAlpha)!=='unknown'&&alphaClass(sourceAlpha)===alphaClass(candidateAlpha));
            if(!alphaMatches){flags.push('Transparency samples differ or could not be matched.');}
            if(!review){flags.push('AI comparison has not been run.');}
            else if(review.overall!=='clear'){flags.push('AI comparison needs review ('+(review.overall||'unknown')+').');}
            else if((review.findings||[]).some(function(f){return f.severity==='review'||f.severity==='concern';})){flags.push('AI comparison returned areas to inspect.');}
            if(!Object.values(checks()).every(Boolean)&&!(current.approval&&current.approval.version===version.uuid&&Object.values(current.approval.checks||{}).every(Boolean))){flags.push('Human review checklist is incomplete.');}
            if(current.qa_manifest){flags=Object.keys(current.qa_manifest.checks).filter(function(key){return current.qa_manifest.checks[key]!=='PASS';}).map(function(key){return key.replace(/_/g,' ')+': '+current.qa_manifest.checks[key];});}
            status.dataset.state=flags.length?'review':'pass';
            status.textContent=flags.length?'REVIEW — '+flags.length+' item'+(flags.length===1?'':'s')+' need attention.':'PASS — digital checks clear; print quality is not guaranteed.';
            var lines=['SMUTTY STUDIO — CHATGPT ARTWORK HANDOFF','Artwork: '+(current.title||'Untitled'),'Original: '+(sourceQA.width||'?')+' × '+(sourceQA.height||'?')+' px','Candidate: version '+(version.number||'?')+' — '+(q.width||'?')+' × '+(q.height||'?')+' px, '+(q.mime||'unknown format'),'Print size: '+(isFinite(width)&&isFinite(height)?width+' × '+height+' inches':'not set'),'Effective resolution: '+(isFinite(ppi)?ppi.toFixed(1)+' PPI':'not verified')+'; target 300 PPI. Suggested maximum: '+suggested,'Transparency: '+sourceAlpha+' → '+candidateAlpha+'; sampled status '+(alphaMatches?'matches':'differs / unknown'),'Proportions: '+(geometry.message||'not verified'),'AI comparison: '+(review?((review.overall||'unknown')+' — '+(review.summary||'No summary')):'not run'),'Readiness: '+(current.qa_manifest?current.qa_manifest.overall:(flags.length?'REVIEW':'PASS'))];
            if(flags.length){lines.push('Items to check:');flags.forEach(function(flag,index){lines.push((index+1)+'. '+flag);});}
            if(review&&Array.isArray(review.findings)&&review.findings.some(function(f){return f.severity!=='info';})){lines.push('AI findings needing attention:');review.findings.filter(function(f){return f.severity!=='info';}).forEach(function(f,index){lines.push((index+1)+'. '+(f.area||'Area')+' — '+(f.issue||'Inspect this area')+' Check: '+(f.action||'Review manually'));});}
            lines.push('Please compare the attached original/ and candidate/ files. Inspect the flagged areas, fine detail, lettering, face, edge halos, transparency and garment-colour proofs. Do not alter the original. Recommend a correction only if needed; describe any change before making it. This report is advisory and does not certify printer output.');
            if(current.qa_manifest){var manifest=current.qa_manifest;lines.push('Finishing QA manifest: '+manifest.overall+' — included as finishing-qa.json in the ZIP.','Candidate SHA-256: '+manifest.candidate_sha256,'Reuse checks only for identical bytes and the same print target. Recheck altered artwork, placement, brand assets and garment variants.','Screen garment colours are contrast previews, not physical print proofs.');status.dataset.state=manifest.overall.toLowerCase();status.textContent=manifest.overall+' — digital finishing only; production approval is separate.';}
            text.value=lines.join('\n');
        }
        function render(){
            if(flatPreviewBlob&&flatPreviewKey!==flatKey())clearFlatPreview();
            resetChecks();
            el('sbs-af-stage-help').textContent='Run each stage with its button. AI upscale may use paid credits; the untouched original stays unchanged.';var nameField=el('sbs-af-package-name');var workspaceKey=current?current.uuid:'';if(nameField.dataset.workspace!==workspaceKey){nameField.value=current?friendlyName(current.title)+'-local-finishing.zip':'';nameField.dataset.workspace=workspaceKey;}var v=current&&current.versions.find(function(v){return v.uuid===current.current_version;});
            image('sbs-af-original',current&&current.original,'Untouched original: '+(current?current.title:''));image('sbs-af-candidate',v&&v.asset,'Candidate version '+(v?v.number:''));
            inspectTransparency('sbs-af-original','sbs-af-original-transparency');inspectTransparency('sbs-af-candidate','sbs-af-candidate-transparency');
            var candidateLink=el('sbs-af-candidate-download');candidateLink.hidden=!v;if(v){candidateLink.href=v.asset.url;}else{candidateLink.removeAttribute('href');}
            el('sbs-af-next').textContent=current?'Next action: '+current.next_action+' — '+current.status+' — local '+current.uuid:'Next action: upload or resume artwork.';
            var sourceDetails=el('sbs-af-freestyle-source'),freestyle=current&&current.freestyle_source;
            sourceDetails.hidden=!freestyle;
            if(freestyle){el('sbs-af-freestyle-source-summary').textContent=(freestyle.project_title||'Freestyle project')+' · version '+freestyle.version_number+' · '+(freestyle.created_at||'date not recorded')+' · source SHA-256 '+freestyle.source_sha256;
                el('sbs-af-freestyle-source-settings').textContent='Saved settings: '+JSON.stringify(freestyle.settings||{})+' · References: '+((freestyle.references||[]).join(', ')||'none recorded');
                var history=el('sbs-af-freestyle-source-lineage');history.replaceChildren();(freestyle.lineage||[]).forEach(function(turn,index){var item=document.createElement('li');item.textContent='Version '+(index+1)+' — '+(turn.action||'image')+(turn.instruction?': '+turn.instruction:'')+(turn.brief?' · saved core brief: '+turn.brief:'');history.appendChild(item);});
            }

            el('sbs-af-versions').replaceChildren();
            var opt=document.createElement('option');opt.value='';opt.textContent='Choose a version';el('sbs-af-versions').appendChild(opt);
            (current?current.versions:[]).slice().reverse().forEach(function(v){var o=document.createElement('option'),source=v.source_version_uuid?current.versions.find(function(parent){return parent.uuid===v.source_version_uuid;}):null,from=v.options&&v.options.method==='flat_background'?' — from '+(source?'version '+source.number:'original'):'';o.value=v.uuid;o.textContent='Version '+v.number+' — '+v.options.method+from+' — '+v.created_at;el('sbs-af-versions').appendChild(o);});
            el('sbs-af-versions').value=current?current.current_version||'':'';
            var qa=el('sbs-af-qa'),aiSection=el('sbs-af-ai-review');qa.replaceChildren();
            if(current){var q=v?v.qa:current.original_qa,p=document.createElement('p');p.textContent=q.width+' × '+q.height+' px; '+q.mime+'; '+q.alpha+(v?'; effective '+q.effective_ppi+' PPI at '+v.options.width+' × '+v.options.height+' inches.':'.');qa.appendChild(p);
                var integrity=document.createElement('p');integrity.textContent=v?(v.comparison.byte_identical?'Candidate is byte-identical to original.':'Pixels have changed. Aligned side-by-side human comparison required.')+' AI visual comparison: '+(v.ai_review?'completed; see advisory report below.':'not run.'):'Original SHA-256: '+current.original.sha256;qa.appendChild(integrity);
                var pointsHeading=document.createElement('h3');pointsHeading.className='sbs-af-review-points-title';pointsHeading.textContent='Warnings and points to check';qa.appendChild(pointsHeading);
                var points=document.createElement('ol');points.className='sbs-af-review-points';
                q.warnings.filter(function(w){return !/^Pixel dimensions are below 300 PPI/i.test(w);}).forEach(function(w){var item=document.createElement('li'),kind=/Prepare a print PNG/i.test(w)?'ACTION NEEDED':'REVIEW';item.textContent=kind+' — '+w;points.appendChild(item);});
                if(v&&v.comparison.geometry&&(v.comparison.geometry.status!=='proportional'||v.comparison.geometry.transparency_sample_matches===false)){var geometry=v.comparison.geometry,geometryLine=document.createElement('li');geometryLine.textContent='REVIEW — Automatic geometry check: '+geometry.message+(geometry.nonuniform_scale_percent!==undefined?' Width scale '+geometry.width_scale+'×; height scale '+geometry.height_scale+'×; difference '+geometry.nonuniform_scale_percent+'%.':'')+(geometry.transparency_sample_matches!==undefined?(' Sampled alpha status '+(geometry.transparency_sample_matches?'matches':'differs')+' between original and candidate.'): '');points.appendChild(geometryLine);}
                if(v&&v.options.notes){var notes=document.createElement('li');notes.textContent='INFORMATION ONLY — Recorded review note: '+v.options.notes;points.appendChild(notes);}
                if(points.children.length){qa.appendChild(points);}else{pointsHeading.remove();}
                var pixel=q.pixel_review||{};if(pixel.findings&&pixel.findings.length){var heading=document.createElement('h3');heading.textContent='Sampled transparency flags';qa.appendChild(heading);pixel.findings.forEach(function(finding){var row=document.createElement('div');row.className='sbs-af-ai-findings';var severity=document.createElement('p');severity.className='sbs-af-finding-status';severity.textContent='REVIEW — this sampled point may be intentional';row.appendChild(severity);var issue=document.createElement('p');issue.textContent=finding.issue+' Next: '+finding.action;row.appendChild(issue);var decision=(v&&v.review_decisions||{})[finding.id];var state=document.createElement('p');state.className='sbs-af-finding-decision';state.textContent=decision?'Your review: '+decision.decision.replace('_',' '):'Not confirmed as a defect until you review it.';row.appendChild(state);var actions=document.createElement('div');actions.className='sbs-af-finding-actions';var view=document.createElement('button');view.type='button';view.className='sbs-button';view.textContent='View area';view.setAttribute('aria-label','Open 4× view centred on '+finding.area);view.disabled=!v;view.addEventListener('click',function(){openAiFocus(finding,view);});actions.appendChild(view);[['Accept as intentional','intentional'],['False alarm','false_alarm'],['Leave unresolved','unresolved']].forEach(function(pair){var b=document.createElement('button');b.type='button';b.className='sbs-button';b.textContent=pair[0];b.disabled=!v||!finding.id;b.addEventListener('click',function(){reviewFinding(finding,pair[1]);});actions.appendChild(b);});var fix=document.createElement('button');fix.type='button';fix.className='sbs-button';fix.textContent='Fix here';fix.disabled=!v||!finding.focus;fix.addEventListener('click',function(){closeAiFocus();openArtworkEditor(finding);});actions.appendChild(fix);row.appendChild(actions);qa.appendChild(row);});}
                var meta=q.export_metadata;if(meta){var details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent='File and colour metadata';body.textContent='Profile: '+meta.profile+'; PNG channels: '+(meta.png_color_type===6?'RGBA':meta.png_color_type||'not PNG')+'; depth: '+(meta.bit_depth||'?')+' bits; tagged PPI: '+(meta.ppi_x||'not set')+' × '+(meta.ppi_y||'not set')+'. '+(pixel.limitation||'');if(q.print_export&&q.print_export.artwork_pixels){body.textContent+=' Artwork footprint: '+(q.print_export.artwork_pixels[0]/300).toFixed(2)+' × '+(q.print_export.artwork_pixels[1]/300).toFixed(2)+' inches on the target canvas; no artwork upscaling.';}details.append(summary,body);qa.appendChild(details);}
                renderPrintProof(q,v?v.asset:current.original,!!v);
            }
            qa.appendChild(aiSection);updateStepButtons();renderAiReview(v);renderHandoff(v);
            controls();
        }
        async function deleteRecords(uuids){
            uuids=Array.from(new Set(uuids||[]));if(!uuids.length||busy)return;
            var status=el('sbs-af-delete-status');
            operation(async function(){
                status.textContent='Checking exact record and file dependencies…';
                var plan=await api('/delete-plan',{uuids:uuids});
                if(!plan.safe){status.textContent='Nothing can be deleted safely. '+(plan.blocked||[]).join('; ');return;}
                var titleList=(plan.eligible_records||[]).map(function(r){return r.title;}).join(', ');
                var preserved=(plan.preserved_files||[]).map(function(file){return file.filename+' — '+file.reason;});
                var blocked=(plan.blocked_records||[]).map(function(record){return record.title+' — '+(record.reasons||[]).join(', ');});
                var prompt='Delete '+plan.record_count+' eligible record(s) out of '+plan.selected_count+' selected?\n\n'+titleList+'\n\nAssociated files eligible for deletion: '+plan.file_count+'\nOutstanding jobs to cancel first: '+plan.jobs_to_cancel+'\nFiles that must be preserved: '+plan.preserved_file_count+(preserved.length?'\n'+preserved.join('\n'):'')+(blocked.length?'\n\nRecords that will be left unchanged:\n'+blocked.join('\n'):'')+'\n\nThis cannot be undone. Unrelated artwork, projects and backups are preserved.';
                if(!window.confirm(prompt)){status.textContent='Deletion cancelled. Nothing changed.';return;}
                var revisions={};(plan.records||[]).forEach(function(r){revisions[r.uuid]=r.revision;});
                var result=await api('/delete',{uuids:uuids,revisions:revisions,confirmed:true,record_count:plan.record_count,file_count:plan.file_count,jobs_to_cancel:plan.jobs_to_cancel,preserved_file_count:plan.preserved_file_count});
                (result.deleted_uuids||[]).forEach(function(uuid){catalogueSelected.delete(uuid);});if(current&&result.deleted_uuids&&result.deleted_uuids.includes(current.uuid)){current=null;}
                await refresh();render();
                var summary='Deleted '+result.deleted_records+' record(s) and '+result.deleted_files+' associated file(s).';
                if(result.preserved_files&&result.preserved_files.length){summary+=' Preserved '+result.preserved_files.length+' shared or referenced file(s).';}
                if(result.cleanup_pending&&result.cleanup_pending.length){summary+=' Cleanup still needs attention for '+result.cleanup_pending.length+' staged file(s): '+result.cleanup_pending.join(', ');}
                if(result.blocked_records&&result.blocked_records.length){summary+=' Left '+result.blocked_records.length+' record(s) unchanged: '+result.blocked_records.map(function(record){return record.title+' — '+(record.reasons||[]).join(', ');}).join('; ');}
                if(!result.deleted_records&&result.blocked_records&&result.blocked_records.length){summary='Nothing was deleted. '+result.blocked_records.map(function(record){return record.title+' — '+(record.reasons||[]).join(', ');}).join('; ');}
                status.textContent=summary;
            },'Checking the selected catalogue records…',null,function(error){status.textContent='Deletion not completed: '+error.message;});
        }
        function catalogue(){
            var list=el('sbs-af-records'),status=el('sbs-af-filter-status'),next=el('sbs-af-filter-next');list.replaceChildren();
            function fill(select,values,placeholder){var selected=select.value,unique=Array.from(new Set(values.filter(Boolean))).sort();select.replaceChildren(new Option(placeholder,''));unique.forEach(function(value){select.add(new Option(value,value));});if(unique.includes(selected))select.value=selected;}
            fill(status,records.map(function(r){return r.status;}),'Any status');fill(next,records.map(function(r){return r.next_action;}),'Any next task');
            function alpha(r){var value=String((r.original_qa||{}).alpha||'').toLowerCase();return value.indexOf('partial')>=0?'partial':value.indexOf('no transparency')>=0?'opaque':value.indexOf('transparency detected')>=0?'transparent':'unknown';}
            var found=records.filter(function(r){return matches(r,el('sbs-af-search').value)&&(!status.value||r.status===status.value)&&(!next.value||r.next_action===next.value)&&(!el('sbs-af-filter-alpha').value||alpha(r)===el('sbs-af-filter-alpha').value);}),counts={};records.forEach(function(r){counts[r.status]=(counts[r.status]||0)+1;});
            el('sbs-af-counts').textContent=found.length+' of '+records.length+' local workspaces shown (newest update first). '+Object.keys(counts).map(function(k){return k+': '+counts[k];}).join('; ');
            el('sbs-af-delete-selected').textContent='Delete '+catalogueSelected.size+' selected record(s)';el('sbs-af-delete-selected').disabled=busy||catalogueSelected.size===0;
            found.forEach(function(r){
                var article=document.createElement('article');article.className='sbs-af-catalogue-row sbs-card';
                var pick=document.createElement('label');pick.className='sbs-af-catalogue-pick';var check=document.createElement('input');check.type='checkbox';check.checked=catalogueSelected.has(r.uuid);check.setAttribute('data-af-record-select','1');check.setAttribute('aria-label','Select '+r.title+' for deletion');check.addEventListener('change',function(){if(this.checked)catalogueSelected.add(r.uuid);else catalogueSelected.delete(r.uuid);el('sbs-af-delete-selected').textContent='Delete '+catalogueSelected.size+' selected record(s)';el('sbs-af-delete-selected').disabled=busy||catalogueSelected.size===0;});pick.append(check,document.createTextNode('Select record'));
                var remove=document.createElement('button');remove.className='sbs-button sbs-danger-tool';remove.type='button';remove.textContent='Delete record';remove.setAttribute('data-af-delete',r.uuid);remove.disabled=busy;remove.addEventListener('click',function(){deleteRecords([r.uuid]);});
                var selection=document.createElement('div');selection.className='sbs-af-catalogue-selection';selection.append(pick,remove);
                var title=document.createElement('h2');title.textContent=r.title;var rename=document.createElement('button');rename.className='sbs-button';rename.type='button';rename.textContent='Rename';rename.setAttribute('data-af-rename','1');rename.disabled=busy;rename.addEventListener('click',function(){var value=window.prompt('Rename this catalogue record. Artwork bytes and history will stay unchanged.',r.title);if(value===null||!value.trim()||value.trim()===r.title)return;operation(async function(){await api('/'+r.uuid+'/rename',{revision:r.revision,title:value.trim()});await refresh();message('Catalogue title updated. Artwork bytes and history were not changed.');},'Saving catalogue title…',rename);});
                var titleRow=document.createElement('div');titleRow.className='sbs-af-catalogue-title-row';titleRow.append(title,rename);
                var details=document.createElement('div');details.className='sbs-af-catalogue-details';details.append(titleRow);
                [["Workspace",r.uuid],["Status",r.status],["Next task",r.next_action],["Transparency",(r.original_qa||{}).alpha||'Not checked'],["Updated",r.updated_at],["Metadata",r.metadata_status]].forEach(function(pair){var line=document.createElement('p');line.className='sbs-af-catalogue-field';var label=document.createElement('strong');label.textContent=pair[0];var value=document.createElement('span');value.textContent=pair[1]||'—';line.append(label,value);details.appendChild(line);});
                var thumb=document.createElement('button');thumb.type='button';thumb.className='sbs-af-catalogue-thumbnail';thumb.setAttribute('aria-label','Open artwork preview for '+r.title);thumb.disabled=!r.original||!r.original.url;
                if(r.original&&r.original.url){var img=document.createElement('img');img.src=r.original.url;img.alt='';img.loading='lazy';thumb.appendChild(img);}else{thumb.textContent='No preview';}
                thumb.addEventListener('click',function(){if(!r.original||!r.original.url)return;catalogueReturnFocus=this;var modal=el('sbs-af-catalogue-viewer');el('sbs-af-catalogue-viewer-title').textContent=r.title;el('sbs-af-catalogue-viewer-image').src=r.original.url;modal.hidden=false;el('sbs-af-catalogue-viewer-close').focus();});
                var open=document.createElement('button');open.className='sbs-button';open.type='button';open.setAttribute('data-af-open',r.uuid);open.textContent='Open in Finishing';open.disabled=busy;open.addEventListener('click',function(){if(busy)return;current=r;render();document.querySelector('[data-primary-tab="finishing"]').click();el('sbs-af-title').focus();});
                var preview=document.createElement('div');preview.className='sbs-af-catalogue-preview';preview.append(thumb,open);
                article.append(selection,titleRow,details,preview);list.appendChild(article);
            });
        }
        async function refresh(){if(refreshPromise)return refreshPromise;paintRefresh('busy');refreshPromise=(async function(){var data=await api('');records=data.records||[];var select=el('sbs-af-resume');select.replaceChildren();var empty=document.createElement('option');empty.value='';empty.textContent='Choose a workspace';select.appendChild(empty);records.slice().reverse().forEach(function(r){var o=document.createElement('option');o.value=r.uuid;o.textContent=r.title+' — '+r.status;select.appendChild(o);});if(current){current=records.find(function(r){return r.uuid===current.uuid;})||current;select.value=current.uuid;}else if(savedUiState.workspace){select.value=savedUiState.workspace;}catalogue();saveUiState();paintRefresh('done');return records;})().catch(function(error){paintRefresh('error',error.message);throw error;}).finally(function(){refreshPromise=null;});return refreshPromise;}
        var editor={canvas:el('sbs-af-editor-canvas'),ctx:null,source:null,sourceVersion:'',width:0,height:0,tool:'erase',stroke:null,undo:[],redo:[],historyBytes:0,dirty:false,pointers:new Map(),gesture:null,multiTouch:false,cursorPoint:null},trimPreview=null,editorOpening=false,trimOpening=false;
        function analyzeAlpha(img){var w=img.naturalWidth,h=img.naturalHeight,c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d',{willReadFrequently:true});if(!x)throw new Error('This browser cannot inspect image transparency.');x.drawImage(img,0,0);var minX=w,minY=h,maxX=-1,maxY=-1,clear=false,partial=false,block=64;for(var y=0;y<h;y+=block){var rows=Math.min(block,h-y),d=x.getImageData(0,y,w,rows).data;for(var yy=0;yy<rows;yy++)for(var xx=0;xx<w;xx++){var a=d[(yy*w+xx)*4+3];if(a===0){clear=true;continue;}if(a<255)partial=true;if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;var iy=y+yy;if(iy<minY)minY=iy;if(iy>maxY)maxY=iy;}}c.width=1;c.height=1;return {clear:clear,partial:partial,bounds:maxX<0?null:{left:minX,top:minY,right:maxX,bottom:maxY},width:w,height:h};}
        function selectedCandidate(){return current&&current.current_version&&current.versions.find(function(v){return v.uuid===current.current_version;});}
        function closeArtworkEditor(force){if(busy)return;if(editor.dirty&&!force&&!window.confirm('Discard unsaved touch-up marks? The candidate in version history is unchanged.'))return;el('sbs-af-editor').hidden=true;editor.canvas.width=1;editor.canvas.height=1;editor.source=null;editor.ctx=null;editor.undo=[];editor.redo=[];editor.historyBytes=0;editor.pointers.clear();editor.gesture=null;editor.multiTouch=false;editor.cursorPoint=null;el('sbs-af-brush-cursor').hidden=true;editor.dirty=false;el('sbs-af-editor-status').textContent='Choose a transparent candidate to enable cleanup and trim.';el('sbs-af-edit-open').focus();}
        function editorButtons(){el('sbs-af-edit-undo').disabled=!editor.undo.length;el('sbs-af-edit-redo').disabled=!editor.redo.length;el('sbs-af-edit-save').disabled=!editor.dirty||busy;}
        function editorScale(){var w=editor.width,h=editor.height,viewport=el('sbs-af-editor-viewport'),fit=Math.min(1,(viewport.clientWidth||w)/Math.max(1,w),(viewport.clientHeight||h)/Math.max(1,h)),zoom=Number(el('sbs-af-editor-zoom').value)/100,scale=fit*zoom;editor.canvas.style.width=Math.max(1,Math.round(w*scale))+'px';editor.canvas.style.height=Math.max(1,Math.round(h*scale))+'px';el('sbs-af-editor-zoom-value').textContent=el('sbs-af-editor-zoom').value+'% of fit';if(editor.cursorPoint)updateBrushCursor(editor.cursorPoint);}
        function applyEditorBackground(){el('sbs-af-editor-viewport').dataset.background=el('sbs-af-editor-background').value;}
        async function openArtworkEditor(finding){if(busy||editorOpening)return;var v=selectedCandidate();if(!current||!v){el('sbs-af-edit-status').textContent='Run Inspect first so there is a candidate to edit.';return;}editorOpening=true;controls();el('sbs-af-edit-status').textContent='Checking candidate transparency…';try{var img=new Image();img.src=v.asset.url;await img.decode();var alpha=analyzeAlpha(img);if(!alpha.clear){el('sbs-af-edit-status').textContent='This candidate has no fully transparent pixels. Cleanup tools are only for transparent-background artwork.';return;}editor.source=img;editor.sourceVersion=v.uuid;editor.width=img.naturalWidth;editor.height=img.naturalHeight;editor.canvas.width=editor.width;editor.canvas.height=editor.height;editor.ctx=editor.canvas.getContext('2d',{willReadFrequently:true});if(!editor.ctx)throw new Error('Canvas editing is unavailable in this browser.');editor.ctx.drawImage(img,0,0);editor.tool='erase';editor.stroke=null;editor.pointers.clear();editor.gesture=null;editor.multiTouch=false;editor.cursorPoint=null;el('sbs-af-brush-cursor').hidden=true;editor.undo=[];editor.redo=[];editor.historyBytes=0;editor.dirty=false;el('sbs-af-tool-erase').setAttribute('aria-pressed','true');el('sbs-af-tool-restore').setAttribute('aria-pressed','false');applyEditorBackground();el('sbs-af-editor-status').textContent='Transparent background confirmed. Erase stray pixels, or restore pixels from this unchanged candidate. Use two fingers to pan and pinch to zoom up to 1000%; the brush outline shows its affected diameter. Scroll bars move left/right and up/down. Your edits remain a separate draft until saved.';el('sbs-af-editor').hidden=false;if(finding&&finding.focus)el('sbs-af-editor-zoom').value='400';editorScale();if(finding&&finding.focus){requestAnimationFrame(function(){var vp=el('sbs-af-editor-viewport'),rect=editor.canvas.getBoundingClientRect(),scale=rect.width/editor.width;vp.scrollLeft=Math.max(0,finding.focus.x*editor.width*scale-vp.clientWidth/2);vp.scrollTop=Math.max(0,finding.focus.y*editor.height*scale-vp.clientHeight/2);});}editorButtons();el('sbs-af-editor-close').focus();}catch(error){el('sbs-af-edit-status').textContent='Editor could not open: '+error.message;}finally{editorOpening=false;controls();}}
        function updateBrushCursor(event){var cursor=el('sbs-af-brush-cursor'),viewport=el('sbs-af-editor-viewport');if(!editor.ctx||!event||!cursor)return;var vr=viewport.getBoundingClientRect(),cr=editor.canvas.getBoundingClientRect();if(event.clientX<cr.left||event.clientX>cr.right||event.clientY<cr.top||event.clientY>cr.bottom){cursor.hidden=true;editor.cursorPoint=null;return;}var diameter=Math.max(8,Number(el('sbs-af-brush-width').value)*(cr.width/Math.max(1,editor.width)));editor.cursorPoint={clientX:event.clientX,clientY:event.clientY};cursor.hidden=false;cursor.style.width=diameter+'px';cursor.style.height=diameter+'px';cursor.style.left=(viewport.scrollLeft+event.clientX-vr.left-diameter/2)+'px';cursor.style.top=(viewport.scrollTop+event.clientY-vr.top-diameter/2)+'px';}
        function editorPointerDown(event){if(!editor.ctx)return;if(event.pointerType==='touch'){editor.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(editor.pointers.size>=2){event.preventDefault();el('sbs-af-brush-cursor').hidden=true;editor.cursorPoint=null;if(editor.stroke)finishEditStroke(null,true);editor.multiTouch=true;el('sbs-af-editor-viewport').setPointerCapture(event.pointerId);beginEditorGesture();return;}if(editor.multiTouch)return;}updateBrushCursor(event);if(event.target!==editor.canvas||event.button>0||editor.stroke)return;startEditStroke(event);}
        function editorPointerMove(event){if(event.pointerType==='touch'&&editor.pointers.has(event.pointerId)){editor.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(editor.multiTouch){event.preventDefault();updateEditorGesture();return;}}updateBrushCursor(event);continueEditStroke(event);}
        function editorPointerUp(event,cancel){if(event.pointerType==='touch'&&editor.pointers.has(event.pointerId)){var wasMulti=editor.multiTouch;editor.pointers.delete(event.pointerId);if(wasMulti){event.preventDefault();if(editor.pointers.size<2)editor.gesture=null;if(editor.pointers.size===0)editor.multiTouch=false;el('sbs-af-brush-cursor').hidden=true;editor.cursorPoint=null;return;}}finishEditStroke(event,cancel);if(event.pointerType==='touch'){el('sbs-af-brush-cursor').hidden=true;editor.cursorPoint=null;}}
        function editorTile(stroke,tx,ty){var key=tx+':'+ty;if(stroke.tiles.has(key))return true;if(stroke.tiles.size>=512){stroke.overflow=true;return false;}var x=tx*128,y=ty*128,w=Math.min(128,editor.width-x),h=Math.min(128,editor.height-y);if(w<=0||h<=0)return false;stroke.tiles.set(key,{x:x,y:y,width:w,height:h,before:editor.ctx.getImageData(x,y,w,h)});return true;}
        function paintStamp(cx,cy,r){var ctx=editor.ctx,soft=Number(el('sbs-af-brush-soft').value)/100,strength=Number(el('sbs-af-brush-strength').value)/100,left=Math.max(0,Math.floor(cx-r)),top=Math.max(0,Math.floor(cy-r)),right=Math.min(editor.width,Math.ceil(cx+r)),bottom=Math.min(editor.height,Math.ceil(cy+r));for(var ty=Math.floor(top/128);ty<=Math.floor((bottom-1)/128);ty++)for(var tx=Math.floor(left/128);tx<=Math.floor((right-1)/128);tx++)if(!editorTile(editor.stroke,tx,ty))return;var w=right-left,h=bottom-top,p=ctx.getImageData(left,top,w,h),src=null;if(editor.tool==='restore'){var temp=document.createElement('canvas');temp.width=w;temp.height=h;var t=temp.getContext('2d',{willReadFrequently:true});t.drawImage(editor.source,left,top,w,h,0,0,w,h);src=t.getImageData(0,0,w,h).data;}
            var data=p.data;for(var y=0;y<h;y++)for(var x=0;x<w;x++){var dx=left+x-cx,dy=top+y-cy,dist=Math.sqrt(dx*dx+dy*dy);if(dist>r)continue;var edge=soft===0?1:Math.max(0,Math.min(1,(r-dist)/(r*soft||1)));edge=edge*edge*(3-2*edge);var f=strength*edge;if(f<=0)continue;var i=(y*w+x)*4;if(editor.tool==='erase'){data[i+3]=Math.round(data[i+3]*(1-f));}else{var sa=(src[i+3]/255)*f,da=data[i+3]/255,oa=sa+da*(1-sa);if(oa>0){for(var c=0;c<3;c++)data[i+c]=Math.round((src[i+c]*sa+data[i+c]*da*(1-sa))/oa);data[i+3]=Math.round(oa*255);}}}
            ctx.putImageData(p,left,top);
        }
        function editorPoint(event){var rect=editor.canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(editor.width,(event.clientX-rect.left)*editor.width/rect.width)),y:Math.max(0,Math.min(editor.height,(event.clientY-rect.top)*editor.height/rect.height))};}
        function beginEditorGesture(){var points=Array.from(editor.pointers.values()).slice(0,2);if(points.length<2)return;var viewport=el('sbs-af-editor-viewport'),rect=viewport.getBoundingClientRect(),mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance=Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)),scale=editor.width?editor.canvas.getBoundingClientRect().width/editor.width:1;editor.gesture={distance:distance,zoom:Number(el('sbs-af-editor-zoom').value),anchorX:(viewport.scrollLeft+mid.x-rect.left)/scale,anchorY:(viewport.scrollTop+mid.y-rect.top)/scale};}
        function updateEditorGesture(){if(!editor.gesture||editor.pointers.size<2)return;var points=Array.from(editor.pointers.values()).slice(0,2),viewport=el('sbs-af-editor-viewport'),rect=viewport.getBoundingClientRect(),mid={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},distance=Math.max(1,Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)),zoom=Math.max(50,Math.min(1000,editor.gesture.zoom*distance/editor.gesture.distance));el('sbs-af-editor-zoom').value=String(Math.round(zoom));editorScale();var scale=editor.width?editor.canvas.getBoundingClientRect().width/editor.width:1;viewport.scrollLeft=editor.gesture.anchorX*scale-(mid.x-rect.left);viewport.scrollTop=editor.gesture.anchorY*scale-(mid.y-rect.top);}
        function startEditStroke(event){if(!editor.ctx||event.button>0||editor.stroke)return;event.preventDefault();editor.canvas.setPointerCapture(event.pointerId);editor.stroke={tiles:new Map(),overflow:false,last:editorPoint(event),pointerId:event.pointerId};paintStamp(editor.stroke.last.x,editor.stroke.last.y,Number(el('sbs-af-brush-width').value)/2);}
        function continueEditStroke(event){if(!editor.stroke||editor.stroke.pointerId!==event.pointerId)return;event.preventDefault();var next=editorPoint(event),last=editor.stroke.last,dx=next.x-last.x,dy=next.y-last.y,d=Math.sqrt(dx*dx+dy*dy),spacing=Math.max(1,Number(el('sbs-af-brush-width').value)/4),steps=Math.max(1,Math.ceil(d/spacing));for(var i=1;i<=steps;i++){var f=i/steps;paintStamp(last.x+dx*f,last.y+dy*f,Number(el('sbs-af-brush-width').value)/2);if(editor.stroke.overflow)break;}editor.stroke.last=next;}
        function finishEditStroke(event,cancel){if(!editor.stroke||(event&&editor.stroke.pointerId!==event.pointerId))return;var stroke=editor.stroke;editor.stroke=null;if(cancel||stroke.overflow){stroke.tiles.forEach(function(tile){editor.ctx.putImageData(tile.before,tile.x,tile.y);});el('sbs-af-editor-status').textContent=stroke.overflow?'That stroke covered too large an area to keep a safe undo copy. It was reversed; use shorter strokes.':'Stroke cancelled and reversed.';return;}var patches=[],bytes=0;stroke.tiles.forEach(function(tile){tile.after=editor.ctx.getImageData(tile.x,tile.y,tile.width,tile.height);bytes+=tile.before.data.byteLength+tile.after.data.byteLength;patches.push(tile);});if(!patches.length)return;editor.undo.push({patches:patches,bytes:bytes});editor.historyBytes+=bytes;editor.redo=[];while(editor.historyBytes>64*1024*1024&&editor.undo.length>1){editor.historyBytes-=editor.undo.shift().bytes;}editor.dirty=true;el('sbs-af-editor-status').textContent='Draft changed. Undo is available; save creates a new version and leaves the source untouched.';editorButtons();}
        function applyHistory(record,side){record.patches.forEach(function(p){editor.ctx.putImageData(p[side],p.x,p.y);});}
        function undoEdit(){if(!editor.undo.length)return;var item=editor.undo.pop();applyHistory(item,'before');editor.redo.push(item);editor.dirty=editor.undo.length>0;editorButtons();}
        function redoEdit(){if(!editor.redo.length)return;var item=editor.redo.pop();applyHistory(item,'after');editor.undo.push(item);editor.dirty=true;editorButtons();}
        async function openTrimPreview(){if(busy||trimOpening)return;var v=selectedCandidate();if(!current||!v){el('sbs-af-edit-status').textContent='Run Inspect first so there is a candidate to trim.';return;}trimOpening=true;controls();el('sbs-af-edit-status').textContent='Checking candidate transparency…';try{var img=new Image();img.src=v.asset.url;await img.decode();var alpha=analyzeAlpha(img);if(!alpha.clear||!alpha.bounds){el('sbs-af-edit-status').textContent='Auto-trim is available only for a candidate with a transparent background.';return;}var b=alpha.bounds,x=Math.max(0,b.left-2),y=Math.max(0,b.top-2),right=Math.min(alpha.width,b.right+3),bottom=Math.min(alpha.height,b.bottom+3),w=right-x,h=bottom-y;if(x===0&&y===0&&right===alpha.width&&bottom===alpha.height){el('sbs-af-edit-status').textContent='No transparent margins found to trim.';return;}var c=el('sbs-af-trim-canvas'),ctx=c.getContext('2d');c.width=w;c.height=h;ctx.drawImage(img,x,y,w,h,0,0,w,h);trimPreview={sourceVersion:v.uuid,image:img,x:x,y:y,width:w,height:h};el('sbs-af-trim-summary').textContent='Preview: '+alpha.width+' × '+alpha.height+' px → '+w+' × '+h+' px. All pixels with alpha above zero are kept, with up to 2 transparent pixels around the visible artwork.';el('sbs-af-trim-status').textContent='This changes the canvas bounds only: no rescaling and no visible pixels removed. Cancel to keep the current canvas.';el('sbs-af-trim-dialog').hidden=false;el('sbs-af-trim-save').focus();}catch(error){el('sbs-af-edit-status').textContent='Could not inspect transparency: '+error.message;}finally{trimOpening=false;controls();}}
        async function saveImageEdit(blob,kind,sourceVersion,button){if(!current||!sourceVersion)throw new Error('Select the source candidate again before saving.');if(blob.size>64*1024*1024)throw new Error('The PNG copy is '+fileSize(blob.size)+'. Edited copies can be up to 64 MB; no copy was saved.');var before=current.current_version,data=new FormData(),saved=false,refreshError='';data.append('action','edit_candidate');data.append('revision',String(current.revision));data.append('source_version',sourceVersion);data.append('edit_kind',kind);data.append('file',new File([blob],kind==='touchup'?'candidate-touchup.png':'candidate-trimmed.png',{type:'image/png'}));if(kind==='touchup')el('sbs-af-editor-status').textContent='Saving a new candidate version…';await operation(async function(){current=await api('/'+current.uuid+'/action',data);saved=!!current&&current.current_version!==before;if(!saved)throw new Error('Studio did not confirm a new candidate version. Your draft remains open.');render();saveUiState();try{await refresh();render();saveUiState();}catch(error){refreshError=error.message;}var text=kind==='touchup'?'Touch-up saved as a new candidate version. The source remains unchanged.':'Trimmed copy saved as a new candidate version. The source canvas remains in version history.';if(refreshError)text+=' Workspace list refresh failed: '+refreshError;message(text,!!refreshError);if(kind==='touchup')el('sbs-af-editor-status').textContent='Saved successfully as a new candidate version. Closing the editor will keep the saved version.';},kind==='touchup'?'Saving edited copy…':'Saving trimmed copy…',button,function(error){if(kind==='touchup')el('sbs-af-editor-status').textContent=saved?'Your copy was saved, but the workspace list did not refresh: '+error.message:'Save failed: '+error.message+' Your draft and source are unchanged; try Save as new version again.';});return saved;}
        function saveTouchup(){if(!editor.dirty)return;el('sbs-af-editor-status').textContent='Preparing the edited PNG…';editor.canvas.toBlob(function(blob){if(!blob){el('sbs-af-editor-status').textContent='PNG export failed. The draft remains open; the source is unchanged.';return;}var button=el('sbs-af-edit-save');saveImageEdit(blob,'touchup',editor.sourceVersion,button).then(function(saved){if(saved){editor.dirty=false;closeArtworkEditor(true);}}).catch(function(error){el('sbs-af-editor-status').textContent='Save failed: '+error.message+' Your draft and source are unchanged.';});},'image/png');}
        async function pollReplicate(){
            message('AI upscale is processing on Replicate. The untouched original remains unchanged.');
            var attempts=0;
            while(current&&current.pending&&current.pending.replicate_prediction_id&&attempts<60){
                await new Promise(function(resolve){window.setTimeout(resolve,2000);});
                var poll=await api('/'+current.uuid+'/action',{action:'poll',revision:current.revision});
                current=poll;render();attempts++;
                if(current.processing_error){message(current.processing_error,true);return;}
                if(current.pending&&current.pending.replicate_prediction_id){message('AI upscale is still processing. The original remains unchanged.');}
            }
            if(current&&current.pending&&current.pending.replicate_prediction_id){message('Replicate is still processing. Do not run another upscale. You can cancel the current stage after this check stops.');}
            else if(current&&!current.processing_error){await refresh();render();message('AI upscale finished. Compare the candidate with the untouched original before approval.');}
        }
        async function action(type,extra,saveFolder){
            var data=Object.assign({action:type,revision:current.revision},extra||{});
            var result=await api('/'+current.uuid+'/action',data);
            if(type==='export'){
                el('sbs-af-package').href=result.package.url;el('sbs-af-package').setAttribute('download',result.package.filename);
                if(saveFolder){try{var savedName=await savePackageInFolder(saveFolder,result.package);el('sbs-af-package').hidden=true;message('Package saved to the chosen folder as '+savedName+'. No Drive save or catalogue update.');}catch(error){el('sbs-af-package').hidden=false;message('The package was built but folder saving failed. Use Download local package to save it through your browser instead. '+error.message,true);}}
                else{el('sbs-af-package').hidden=false;message('Local package ready: '+result.package.filename+'. Use Download local package to save it through your browser. No Drive save or catalogue update.');}
                return;
            }
            current=result;render();
            if(type==='run'&&current.pending&&current.pending.replicate_prediction_id){await pollReplicate();}
            else{
                await refresh();render();
                message(type==='approve'?'Local finishing version approved. SB production and Drive remain unchanged.':type==='ai_review'?'AI comparison saved. Check its advisory findings alongside the original, candidate and garment proofs.':'Stage '+type+' complete.');
            }
        }
        el('sbs-af-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-gallery-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-upload').addEventListener('submit',function(event){event.preventDefault();var submitter=event.submitter||this.querySelector('button[type=submit]'),uploaded=null;uploadMessage('Saving the untouched original in private Studio storage…');operation(async function(){var f=selectedFile||el('sbs-af-file').files[0]||el('sbs-af-gallery-file').files[0];if(!f)throw new Error('Choose one image using Photos / Gallery or Files / My Files first.');if(f.size>20*1024*1024)throw new Error('This file is '+fileSize(f.size)+'. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.');var data=new FormData();data.append('file',f);data.append('title',el('sbs-af-name').value);current=await api('/upload',data);uploaded=current;await refresh();render();selectedFile=null;el('sbs-af-upload').reset();var saved='Saved successfully: “'+current.title+'”. Workspace '+current.uuid+'. The original is unchanged; no AF number was allocated.';message(saved);uploadMessage(saved,'success');},'Uploading original to private Studio storage…',submitter,function(error){if(uploaded){var saved='Original saved successfully: “'+uploaded.title+'”. Workspace '+uploaded.uuid+'. The workspace list did not refresh: '+error.message+' Do not upload it again; press Refresh workspaces.';uploadMessage(saved,'success');}else{uploadMessage('Upload not confirmed: '+error.message,'error');}});});
        async function runStage(method,button){
            if(!current||busy)return;
            stageRunState[method]={state:'running'};updateStageButtons();
            var previousCount=(current.versions||[]).length;
            operation(async function(){
                await action('prepare',{options:{method:method,width:Number(el('sbs-af-width').value),height:Number(el('sbs-af-height').value),notes:el('sbs-af-notes').value,print_canvas:el('sbs-af-print-canvas').checked}});
                if(!current||!current.pending||current.pending.method!==method)throw new Error('Studio did not confirm that this stage was queued.');
                await action('run');
                if(current&&current.processing_error)throw new Error(current.processing_error);
                if(!current||!Array.isArray(current.versions)||current.versions.length<=previousCount||!current.versions[current.versions.length-1].options||current.versions[current.versions.length-1].options.method!==method)throw new Error('Studio did not save a completed result for this stage.');
                stageRunState[method]={state:'complete'};updateStageButtons();
            },'Running '+stageLabel(method)+'…',button,function(error){stageRunState[method]={state:'error',message:error.message};updateStageButtons();});
        }
        document.querySelectorAll('[data-af-method]').forEach(function(button){button.addEventListener('click',function(){runStage(button.getAttribute('data-af-method'),button);});});
        el('sbs-af-flat-sample').addEventListener('click',sampleFlatBackground);
        el('sbs-af-flat-preview').addEventListener('click',function(){var button=this;operation(previewFlatBackground,'Preparing a local pixel preview…',button);});
        el('sbs-af-flat-remove').addEventListener('click',removeFlatBackground);
        el('sbs-af-edit-open').addEventListener('click',openArtworkEditor);el('sbs-af-trim').addEventListener('click',openTrimPreview);
        el('sbs-af-editor-close').addEventListener('click',function(){closeArtworkEditor(false);});el('sbs-af-tool-erase').addEventListener('click',function(){editor.tool='erase';this.setAttribute('aria-pressed','true');el('sbs-af-tool-restore').setAttribute('aria-pressed','false');});el('sbs-af-tool-restore').addEventListener('click',function(){editor.tool='restore';this.setAttribute('aria-pressed','true');el('sbs-af-tool-erase').setAttribute('aria-pressed','false');});
        el('sbs-af-brush-width').addEventListener('input',function(){el('sbs-af-brush-width-value').textContent=this.value+' px';});el('sbs-af-brush-soft').addEventListener('input',function(){el('sbs-af-brush-soft-value').textContent=this.value+'%';});el('sbs-af-brush-strength').addEventListener('input',function(){el('sbs-af-brush-strength-value').textContent=this.value+'%';});el('sbs-af-editor-zoom').addEventListener('input',editorScale);el('sbs-af-editor-background').addEventListener('change',applyEditorBackground);window.addEventListener('resize',function(){if(!el('sbs-af-editor').hidden)editorScale();});
        el('sbs-af-editor-viewport').addEventListener('pointerdown',editorPointerDown);el('sbs-af-editor-viewport').addEventListener('pointermove',editorPointerMove);el('sbs-af-editor-viewport').addEventListener('pointerup',function(e){editorPointerUp(e,false);});el('sbs-af-editor-viewport').addEventListener('pointercancel',function(e){editorPointerUp(e,true);});el('sbs-af-editor-canvas').addEventListener('lostpointercapture',function(e){if(editor.stroke&&editor.stroke.pointerId===e.pointerId)finishEditStroke(e,true);});el('sbs-af-edit-undo').addEventListener('click',undoEdit);el('sbs-af-edit-redo').addEventListener('click',redoEdit);el('sbs-af-edit-save').addEventListener('click',saveTouchup);
        function closeTrimPreview(){el('sbs-af-trim-dialog').hidden=true;trimPreview=null;el('sbs-af-trim-canvas').width=1;el('sbs-af-trim-canvas').height=1;el('sbs-af-trim').focus();}el('sbs-af-trim-close').addEventListener('click',closeTrimPreview);el('sbs-af-trim-cancel').addEventListener('click',closeTrimPreview);el('sbs-af-trim-save').addEventListener('click',function(){if(!trimPreview)return;var source=trimPreview.sourceVersion,button=this;el('sbs-af-trim-canvas').toBlob(function(blob){if(!blob){el('sbs-af-trim-status').textContent='PNG export failed. No copy was saved; the source is unchanged.';return;}saveImageEdit(blob,'trim_transparent',source,button).then(function(saved){if(saved)closeTrimPreview();else el('sbs-af-trim-status').textContent='Trim was not saved. The preview remains available; the source is unchanged.';}).catch(function(error){el('sbs-af-trim-status').textContent='Trim failed: '+error.message+' The source is unchanged.';});},'image/png');});
        ['sbs-af-flat-colour','sbs-af-flat-colour-2','sbs-af-flat-use-second','sbs-af-flat-tolerance'].forEach(function(id){el(id).addEventListener('input',clearFlatPreview);el(id).addEventListener('change',clearFlatPreview);});
        el('sbs-af-flat-undo').addEventListener('click',function(){var button=this;operation(async function(){await action('undo_flat_background');el('sbs-af-flat-status').textContent='Source version restored. The removal copy remains in history and can be selected again.';message('Source restored. The processed copy remains available in version history.');},'Restoring the source version…',button,function(error){el('sbs-af-flat-status').textContent=error.message;el('sbs-af-flat-status').setAttribute('role','alert');});});
        el('sbs-af-refresh-qa').addEventListener('click',function(){var button=this;operation(function(){return action('refresh_qa');},'Refreshing local technical checks…',button);});
        el('sbs-af-approve').addEventListener('click',function(){var button=this;if(button.disabled||busy||!current)return;operation(function(){return action('approve',{checks:checks()});},'Recording local approval…',button);});
        el('sbs-af-ai-review-run').addEventListener('click',function(){var button=this,status=el('sbs-af-ai-status');status.dataset.state='';status.textContent='Comparing images… This may take a moment.';operation(function(){return action('ai_review');},'Comparing images with OpenAI…',button,function(error){status.dataset.state='error';status.textContent='Comparison not completed: '+error.message;});});
        el('sbs-af-export').addEventListener('click',function(){var button=this;if(busy||exportPickerOpen||!current||!current.approval)return;choosePackageFolder().then(function(folder){if(folder===undefined)return;operation(function(){return action('export',{filename:el('sbs-af-package-name').value},folder);},folder?'Building ZIP and saving to the chosen folder…':'Building approved local package…',button);});});
        el('sbs-af-versions').addEventListener('change',function(){var uuid=this.value,button=this;if(uuid)operation(function(){return action('select',{version:uuid});},'Selecting version; new approval will be required…',button);});
        el('sbs-af-resume').addEventListener('change',function(){var uuid=this.value,button=this;if(!uuid||busy)return;operation(async function(){current=await api('/'+uuid);render();saveUiState();if(current.pending&&current.pending.replicate_prediction_id){message('Resumed the existing Replicate upscale. Checking its status; do not queue another request.');await pollReplicate();}else{message('Workspace resumed from private storage.');}},'Loading workspace…',button);});
        el('sbs-af-refresh').addEventListener('click',async function(){try{await refresh();render();message('Local workspaces refreshed.');}catch(error){message('Workspaces could not be refreshed: '+error.message,true);}});
        document.querySelectorAll('[data-af-check]').forEach(function(n){n.addEventListener('change',function(){saveUiState();controls();renderHandoff(current&&current.versions.find(function(v){return v.uuid===current.current_version;}));});});
        el('sbs-af-copy-handoff').addEventListener('click',async function(){var field=el('sbs-af-handoff-text');try{await navigator.clipboard.writeText(field.value);message('ChatGPT handoff copied. Attach the Studio ZIP when you paste it into ChatGPT.');}catch(error){field.focus();field.select();message('Select and copy the highlighted handoff text, then attach the Studio ZIP in ChatGPT.',true);}});
        el('sbs-af-zoom').addEventListener('change',function(){var width=Number(this.value)*100+'%';['sbs-af-original','sbs-af-candidate'].forEach(function(id){el(id).style.width=width;});document.querySelectorAll('[data-af-proof-image]').forEach(function(img){img.style.width=width;});});
        ['sbs-af-width','sbs-af-height'].forEach(function(id){el(id).addEventListener('input',function(){refreshPrintStatus();saveUiState();});});
        ['sbs-af-notes','sbs-af-print-canvas'].forEach(function(id){el(id).addEventListener('input',saveUiState);el(id).addEventListener('change',saveUiState);});
        // Scroll together for aligned comparison at matching relative image coordinates.
        var syncing=false;document.querySelectorAll('.sbs-af-viewport').forEach(function(view){view.addEventListener('scroll',function(){if(syncing)return;syncing=true;document.querySelectorAll('.sbs-af-viewport').forEach(function(other){if(other!==view){other.scrollLeft=view.scrollLeft;other.scrollTop=view.scrollTop;}});requestAnimationFrame(function(){syncing=false;});});});
        el('sbs-af-proof').addEventListener('change',function(){el('sbs-af-compare').setAttribute('data-proof',this.value);});
        el('sbs-af-search').addEventListener('input',catalogue);
        var catalogueInfoToggle=el('sbs-af-catalogue-info-toggle'),catalogueInfo=el('sbs-af-catalogue-info-popover');
        catalogueInfoToggle.addEventListener('click',function(){catalogueInfo.hidden=!catalogueInfo.hidden;catalogueInfoToggle.setAttribute('aria-expanded',catalogueInfo.hidden?'false':'true');});
        document.addEventListener('click',function(event){if(!event.target.closest('.sbs-af-catalogue-info')&&!catalogueInfo.hidden){catalogueInfo.hidden=true;catalogueInfoToggle.setAttribute('aria-expanded','false');}});
        document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!catalogueInfo.hidden){catalogueInfo.hidden=true;catalogueInfoToggle.setAttribute('aria-expanded','false');catalogueInfoToggle.focus();}});
        ['sbs-af-filter-status','sbs-af-filter-next','sbs-af-filter-alpha'].forEach(function(id){el(id).addEventListener('change',catalogue);});
        el('sbs-af-delete-selected').addEventListener('click',function(){deleteRecords(Array.from(catalogueSelected));});
        function closeCatalogueViewer(){el('sbs-af-catalogue-viewer').hidden=true;el('sbs-af-catalogue-viewer-image').removeAttribute('src');if(catalogueReturnFocus&&catalogueReturnFocus.isConnected)catalogueReturnFocus.focus();}
        el('sbs-af-catalogue-viewer-close').addEventListener('click',closeCatalogueViewer);
        el('sbs-af-catalogue-viewer').addEventListener('click',function(event){if(event.target===this)closeCatalogueViewer();});
        document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!el('sbs-af-catalogue-viewer').hidden)closeCatalogueViewer();});
        document.querySelectorAll('[data-primary-tab]').forEach(function(button){button.addEventListener('click',function(){var tab=button.getAttribute('data-primary-tab');if(tab==='finishing'||tab==='catalogue'){operation(async function(){await refresh();if(tab==='finishing')render();message('Local workspaces loaded.');},'Loading local workspaces…');}});});
        window.addEventListener('sbs-finishing-open',function(event){if(!event.detail)return;current=event.detail;render();message('Freestyle image copied byte for byte. Source settings, instructions and history are saved. This image is not approved for printing.');});
        var legacyTarget=(Number(savedUiState.width||16)===16&&Number(savedUiState.height||18)===18);if(savedUiState.width&&!legacyTarget)el('sbs-af-width').value=savedUiState.width;if(savedUiState.height&&!legacyTarget)el('sbs-af-height').value=savedUiState.height;if(savedUiState.notes)el('sbs-af-notes').value=savedUiState.notes;if(savedUiState.printCanvas)el('sbs-af-print-canvas').checked=true;
        document.querySelectorAll('[data-af-method]').forEach(function(button){var active=button.getAttribute('data-af-method')===selectedMethod;button.setAttribute('aria-pressed',active?'true':'false');var card=button.closest('[data-af-stage-card]');if(card)card.classList.toggle('is-selected',active);});
        window.addEventListener('pagehide',saveUiState);window.addEventListener('beforeunload',saveUiState);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){saveUiState();}else if(document.visibilityState==='visible'&&!busy){refresh().then(function(){render();}).catch(function(){});}});
        render();
        refresh().then(async function(){var restoreId=savedUiState.workspace;if(restoreId&&!current&&records.some(function(record){return record.uuid===restoreId;})){current=await api('/'+restoreId);el('sbs-af-resume').value=restoreId;var checkKey=current.uuid+':'+(current.current_version||'');if(savedUiState.checkKey===checkKey&&savedUiState.checks){document.querySelectorAll('[data-af-check]').forEach(function(n){var key=n.getAttribute('data-af-check');n.checked=!!savedUiState.checks[key];});lastCheckKey=checkKey;}render();saveUiState();if(current.pending&&current.pending.replicate_prediction_id){message('Restored the existing upscale and checking its status. No new upscale was started.');await pollReplicate();}else if(current.pending){message('Workspace restored with a queued stage. It has not been run again.');}else{message('Your previous Finishing workspace has been restored.');}}else{render();message('Local workspaces loaded.');}}).catch(function(error){render();message('Workspaces could not be loaded at startup: '+error.message,true);});
    }
    if(typeof window!=='undefined')window.SBSFinishing={matches:matches,canApprove:canApprove,classifyTransparency:classifyTransparency,init:init};
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
}());
