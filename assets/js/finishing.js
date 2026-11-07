Warning: truncated output (original token count: 33460)
Total output lines: 694

(function () {
    'use strict';
    function serverErrorMessage(message) {
        return !message||/critical error|<[^>]+>/i.test(message)?'The server could not finish this action. Your saved artwork and existing job are retained. Open Settings → Diagnostics; do not start another paid upscale.':String(message);
    }
    function matches(record, query) {
        return [record.title, record.uuid, record.af_id || ''].join(' ').toLowerCase().includes(query.toLowerCase());
    }
    function findingResolved(decision) { return !!decision && ['intentional','false_alarm'].includes(typeof decision==='string'?decision:decision.decision); }
    function canApprove(record) { return !!record && record.status === 'Awaiting Review' && !!record.current_version; }
    function classifyTransparency(data) {
        if(!data||!data.length||data.length%4)throw new Error('Decoded pixels are unavailable');
        var clear=false,partial=false;
        for(var i=3;i<data.length;i+=4){if(data[i]===0)clear=true;else if(data[i]<255)partial=true;}
        return partial?'Partial alpha':clear?'Genuine transparency':'Opaque';
    }
    function cleanupFocusBox(width,height,focus){
        var side=Math.round(Math.max(64,Math.min(180,Math.min(width,height)*.08)));
        side=Math.min(side,width,height);
        var x=Math.max(0,Math.min(width-side,Math.round(Number(focus.x)*width-side/2)));
        var y=Math.max(0,Math.min(height-side,Math.round(Number(focus.y)*height-side/2)));
        return {x:x,y:y,w:side,h:side};
    }
    function medianChannel(values){values.sort(function(a,b){return a-b;});return values[Math.floor(values.length/2)]||0;}
    function cleanEdgeFringeRegion(data,width,height){
        if(!data||!data.length||data.length!==width*height*4)throw new Error('Decoded pixels are unavailable');
        var source=new Uint8ClampedArray(data),out=new Uint8ClampedArray(data),pending=[];
        function findFringes(input,collect){
            var count=0;
            for(var y=0;y<height;y++)for(var x=0;x<width;x++){
                var i=(y*width+x)*4,a=input[i+3];if(a===0||a===255)continue;
                var rs=[],gs=[],bs=[];
                for(var ny=Math.max(0,y-2);ny<=Math.min(height-1,y+2);ny++)for(var nx=Math.max(0,x-2);nx<=Math.min(width-1,x+2);nx++){
                    if(nx===x&&ny===y)continue;
                    var ni=(ny*width+nx)*4;if(input[ni+3]===255){rs.push(input[ni]);gs.push(input[ni+1]);bs.push(input[ni+2]);}
                }
                if(rs.length<5)continue;
                var mr=medianChannel(rs),mg=medianChannel(gs),mb=medianChannel(bs);
                if(Math.max(Math.abs(input[i]-mr),Math.abs(input[i+1]-mg),Math.abs(input[i+2]-mb))>42){
                    count++;if(collect)pending.push([i,mr,mg,mb]);
                }
            }
            return count;
        }
        findFringes(source,true);
        pending.forEach(function(p){out[p[0]]=p[1];out[p[0]+1]=p[2];out[p[0]+2]=p[3];});
        var changed=0;
        for(var i=0;i<source.length;i+=4)if(source[i]!==out[i]||source[i+1]!==out[i+1]||source[i+2]!==out[i+2])changed++;
        data.set(out);
        return {changed:changed,remaining:findFringes(out,false)};
    }
    function syncReviewControls(root,busy){
        root.querySelectorAll('[data-af-review-blocked]').forEach(function(button){button.disabled=busy||button.dataset.afReviewBlocked==='true';});
    }
    function init() {
        var root=document.getElementById('sbs-app');if(!root)return;
        var current=null, records=[], busy=false, activeStageMethod='', selectedFile=null, selectedMethod='inspect', exportPickerOpen=false, proofPreviewUrl=null, proofSourceKey='', proofRenderedKey='', activePrintQA=null, activeProofAssetUrl='', flatPreviewBlob=null, flatPreviewUrl=null, flatPreviewKey='', refreshPromise=null, stageRunState={}, renderedWorkspaceKey=null, completionAudio=null, completionSound=true;
        var uiStateKey='sbs-af-session-v1:'+location.pathname, savedUiState=(function(){try{return JSON.parse(sessionStorage.getItem(uiStateKey)||'{}');}catch(e){return {};}})(),lastCheckKey='';
        if(savedUiState.stage&&['inspect','upscale','print_png','resize'].includes(savedUiState.stage))selectedMethod=savedUiState.stage;
        var el=function(id){return document.getElementById(id);},catalogueReturnFocus=null,catalogueSelected=new Set();
        try{completionSound=localStorage.getItem('sbs-af-completion-sound')!=='off';}catch(e){}
        function prepareCompletionAudio(){if(!completionSound)return;try{var AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;if(!completionAudio)completionAudio=new AudioContextClass();if(completionAudio.state==='suspended')completionAudio.resume().catch(function(){});}catch(e){}}
        function playCompletionBlip(){if(!completionSound)return;prepareCompletionAudio();if(!completionAudio)return;function play(){if(!completionSound||completionAudio.state!=='running')return;var now=completionAudio.currentTime;[740,990].forEach(function(frequency,index){var oscillator=completionAudio.createOscillator(),gain=completionAudio.createGain(),start=now+index*.115;oscillator.type='triangle';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.045,start+.004);gain.gain.exponentialRampToValueAtTime(.0001,start+.065);oscillator.connect(gain);gain.connect(completionAudio.destination);oscillator.start(start);oscillator.stop(start+.07);});}if(completionAudio.state==='running')play();else completionAudio.resume().then(play).catch(function(){});}
        var completionSoundControl=el('sbs-af-completion-sound');if(completionSoundControl){completionSoundControl.checked=completionSound;completionSoundControl.addEventListener('change',function(){completionSound=completionSoundControl.checked;try{localStorage.setItem('sbs-af-completion-sound',completionSound?'on':'off');}catch(e){}if(completionSound)prepareCompletionAudio();});}
        function message(text,error){el('sbs-af-progress').textContent=text;el('sbs-af-progress').setAttribute('role',error?'alert':'status');}
        function showSessionExpired(){var login=el('sbs-login'),workspace=el('sbs-workspace'),nav=el('sbs-primary-nav'),guide=el('sbs-guide-open');if(workspace)workspace.hidden=true;if(nav)nav.hidden=true;if(guide)guide.hidden=true;if(login){login.hidden=false;var note=login.querySelector('.sbs-form-message');if(note)note.textContent='Studio session expired. Sign in again to reload your saved workspaces.';}}
        function uploadMessage(text,state){var status=el('sbs-af-upload-status');status.textContent=text;status.dataset.state=state||'info';status.setAttribute('role',state==='error'?'alert':'status');}
        async function api(path,data){
            var options={credentials:'same-origin',headers:{'X-SBS-Request':'studio','X-SBS-Finishing':root.getAttribute('data-finishing-csrf')}};
            if(data){options.method='POST';options.body=data instanceof FormData?data:JSON.stringify(data);if(!(data instanceof FormData))options.headers['Content-Type']='application/json';}
            var response=await fetch(root.getAttribute('data-rest')+'finishing'+path,options),result;
            try{result=await response.json();}catch(e){throw new Error(serverErrorMessage());}
            if(!response.ok){if(response.status===401&&result.code==='studio_auth_required'){showSessionExpired();}throw new Error(serverErrorMessage(result.message));}return result;
        }
        function saveUiState(){try{var reviewChecks={};document.querySelectorAll('[data-af-check]').forEach(function(n){reviewChecks[n.getAttribute('data-af-check')]=n.checked;});sessionStorage.setItem(uiStateKey,JSON.stringify({workspace:current?current.uuid:(el('sbs-af-resume')&&el('sbs-af-resume').value)||savedUiState.workspace||'',stage:selectedMethod,width:el('sbs-af-width')&&el('sbs-af-width').value||'14',height:el('sbs-af-height')&&el('sbs-af-height').value||'16',printCanvas:!!(el('sbs-af-print-canvas')&&el('sbs-af-print-canvas').checked),notes:el('sbs-af-notes')&&el('sbs-af-notes').value||'',checkKey:current?current.uuid+':'+(current.current_version||''):'',checks:reviewChecks}));}catch(e){}}
        function paintRefresh(state,error){var button=el('sbs-af-refresh');if(!button)return;var label=el('sbs-af-refresh-label'),spinner=el('sbs-af-refresh-spinner'),done=el('sbs-af-refresh-done'),status=el('sbs-af-workspace-status');spinner.hidden=state!=='busy';done.hidden=state!=='done';button.disabled=state==='busy'||busy;button.dataset.state=state;if(state==='busy'){label.textContent='Refreshing workspaces';button.setAttribute('aria-busy','true');if(status)status.textContent='Checking saved workspaces…';}else if(state==='done'){label.textContent='Workspaces refreshed';button.removeAttribute('aria-busy');if(status)status.textContent=records.length?records.length+' saved workspace'+(records.length===1?'':'s')+' found.':'No saved workspaces found. Check Studio sign-in and private storage.';}else{label.textContent='Refresh workspaces';button.removeAttribute('aria-busy');if(status)status.textContent='Could not load saved workspaces: '+(error||'please try again.');}if(error)message('Workspace refresh failed: '+error,true);}
        function checks(){var result={};document.querySelectorAll('[data-af-check]').forEach(function(n){result[n.getAttribute('data-af-check')]=n.checked;});return result;}
        function resetChecks(){var key=current?current.uuid+':'+(current.current_version||''):'';if(key!==lastCheckKey){document.querySelectorAll('[data-af-check]').forEach(function(n){n.checked=false;});lastCheckKey=key;}el('sbs-af-package').hidden=true;el('sbs-af-package').removeAttribute('href');}
        function reviewControl(button,blocked){button.dataset.afReviewBlocked=String(!!blocked);button.disabled=busy||!!blocked;return button;}
        function controls(){
            syncReviewControls(root,busy);
            document.querySelectorAll('[data-af-method]').forEach(function(button){button.disabled=busy||!current;});
            el('sbs-af-export').disabled=busy||exportPickerOpen||!current||!current.approval;
            var correctionOpen=el('sbs-af-correction-open'),correctionHelp=el('sbs-af-correction-help');
            correctionOpen.disabled=busy||!current||!!(current&&current.pending);
            if(correctionHelp)correctionHelp.textContent=!current?'Upload artwork or resume a saved workspace to enable the full-image scan.':current.pending?'A stage is queued or running. Finish or cancel it before scanning corrections.':busy?'Wait for the current action to finish before scanning.':'Optional: check grouped areas that may matter at the chosen T-shirt print size.';
            el('sbs-af-ai-review-run').disabled=busy||!current||!current.current_version;var freshComparison=el('sbs-af-ai-review-fresh');if(freshComparison)freshComparison.disabled=busy||!current||!current.current_version;el('sbs-af-refresh-qa').disabled=busy||!current||!current.current_version;
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
            el('sbs-af-progress-bar').hidden=!busy;document.dispatchEvent(new CustomEvent('sbs:finishing-state'));
        }
        function stageLabel(method){return ({inspect:'Inspect',resize:'Fit down to print box',print_png:'Prepare print PNG',upscale:'AI upscale'})[method]||'selected stage';}
        function stageVersion(method){
            if(!current||!Array.isArray(current.versions))return null;
            var v=current.versions.find(function(v){return v.uuid===current.current_version;}),seen={};if(method==='inspect')return v||null;
            while(v&&!seen[v.uuid]){seen[v.uuid]=true;if(v.options&&v.options.method===method)return v;var parent=v.options&&v.options.source_sha256;v=current.versions.find(function(x){return x.uuid!==v.uuid&&x.asset.sha256===parent;});}return null;
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
                var method=button.getAttribute('data-af-method'),spinner=button.querySelector('.sbs-af-stage-spinner'),done=button.querySelector('.sbs-af-stage-done'),version=stageVersion(method),runState=stageRunState[method]||{},running=!!(busy&&activeStageMethod===method),failed=runState.state==='error',completed=!!version&&!failed&&!(current&&current.pending&&current.pending.method===method);
                if(spinner)spinner.hidden=!running;
                if(done)done.hidden=running||!completed;
                if(running){button.setAttribute('aria-busy','true');button.setAttribute('aria-label',button.querySelector('.sbs-af-stage-button-label').textContent+' — processing');setStageReport(method,'info','Processing…');}
                else{
                    button.removeAttribute('aria-busy');
                    button.setAttribute('aria-label',button.querySelector('.sbs-af-stage-button-label').textContent+(completed?' — completed':''));
                    if(failed){setStageReport(method,'error','Needs attention: '+String(runState.message||'The stage did not complete.'));}
                    else if(runState.state==='waiting'){setStageReport(method,'info','Still finishing the saved upscale. Reopen this workspace to continue; do not start another paid upscale.');}
                    else if(version){
                        var warnings=Array.isArray(version.qa&&version.qa.warnings)?version.qa.warnings.slice():[];
                        if(method==='upscale')warnings=[];
                        if(method==='inspect'){var q=version.qa||{},ppi=Math.max(Number(q.width)/Number(el('sbs-af-width').value),Number(q.height)/Number(el('sbs-af-height').value));warnings=warnings.filter(function(w){return !/^Pixel dimensions are below 300 PPI/i.test(w);});if(ppi<300)warnings.unshift('Pixel dimensions are below 300 PPI at the selected print size.');}
                        if(warnings.length){var warning=String(warnings[0]);setStageReport(method,'error','Needs attention: '+warning+(warnings.length>1?' (+'+(warnings.length-1)+' more)':''));}
                        else{setStageReport(method,'success',(method==='inspect'?'Checks refreshed: ':'Completed: ')+stageReportText(version)+(method==='upscale'?' — next: prepare the final print PNG.':''));}
                    }
                }
                button.dataset.stageState=running?'running':failed?'error':completed?'complete':'idle';
                button.disabled=busy||!current;
            });
        }
        function updateStepButtons(){
            var approved=!!(current&&current.approval&&current.approval.version===current.current_version);
            var approveButton=el('sbs-af-approve'),approveLabel=approveButton.querySelector('.sbs-af-approve-label'),approveDone=approveButton.querySelector('.sbs-af-approve-done');if(approveLabel)approveLabel.textContent=approved?'Approved — next: save your ZIP':'Approve this finished version';else approveButton.textContent=approved?'Approved — next: save your ZIP':'Approve this finished version';if(approveDone)approveDone.hidden=!approved;
            updateStageButtons();document.dispatchEvent(new CustomEvent('sbs:finishing-state'));
        }
        function buttonBusy(button,on){if(!button)return;if(button.id==='sbs-af-approve'){var label=button.querySelector('.sbs-af-approve-label'),spinner=button.querySelector('.sbs-af-approve-spinner'),done=button.querySelector('.sbs-af-approve-done'),approved=!!(current&&current.approval&&current.approval.version===current.current_version);if(label)label.textContent=on?'Saving local approval…':approved?'Approved — next: save your ZIP':'Approve this finished version';if(spinner)spinner.hidden=!on;if(done)done.hidden=on||!approved;if(on)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');return;}if(button.querySelector('.sbs-af-stage-button-label')){button.disabled=on;if(on)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');return;}if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;button.setAttribute('aria-busy','true');}button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function operation(fn,text,button,onError){if(busy)return;prepareCompletionAudio();activeStageMethod=button&&button.getAttribute('data-af-method')?button.getAttribute('data-af-method'):button&&button.id==='sbs-af-run'&&current&&current.pending?current.pending.method:'';busy=true;buttonBusy(button,true);controls();updateStepButtons();message(text);try{await fn();}catch(error){message(error.message,true);if(onError)onError(error);}finally{busy=false;activeStageMethod='';el('sbs-af-progress-bar').removeAttribute('value');controls();buttonBusy(button,false);updateStepButtons();playCompletionBlip();}}
        function fileSize(size){return (size/(1024*1024)).toFixed(2)+' MB';}
        function flatColors(){var colors=[[1,3,5].map(function(n){return parseInt(el('sbs-af-flat-colour').value.slice(n,n+2),16);})];if(el('sbs-af-flat-use-second').checked){colors.push([1,3,5].map(function(n){return parseInt(el('sbs-af-flat-colour-2').value.slice(n,n+2),16);}));}return colors;}
        function flatKey(){return JSON.stringify([current&&current.uuid,current&&current.current_version||'original',flatColors(),Number(el('sbs-af-flat-tolerance').value)]);}
        function clearFlatPreview(){flatPreviewBlob=null;flatPreviewKey='';if(flatPreviewUrl){URL.revokeObjectURL(flatPreviewUrl);flatPreviewUrl=null;}el('sbs-af-flat-preview-box').hidden=true;el('sbs-af-flat-preview-image').removeAttribute('src');controls();}
        function colorHex(rgb){return '#'+rgb.map(function(v){return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');}).join('');}
        async function sourceImage(){if(!current)throw new Error('Choose or resume artwork first.');var version=current.current_version||'original',entry=version==='original'?null:current.versions.find(function(v){return v.uuid===version;}),asset=entry?entry.asset:current.original;if(!asset||!asset.url)throw new Error('The selected source image could not be found. Refresh the workspace and try again.');var img=new Image();img.src=asset.url;await img.decode();if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>32000000)throw new Error('This local operation supports images up to 32 million pixels. The source was not changed.');return {img:img,version:version,width:img.naturalWidth,height:img.naturalHeight};}
        async function sampleFlatBackground(){var status=el('sbs-af-flat-samples');clearFlatPreview();try{var source=await sourceImage(),w=source.width,h=source.height,span=Math.max(2,Math.min(32,Math.floor(Math.min(w,h)*.04))),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;var ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Pixel sampling is unavailable in this browser.');ctx.drawImage(source.img,0,0);var data=ctx.getImageData(0,0,w,h).data;function avg(x0,y0){var rr=0,gg=0,bb=0,n=0,clear=0,samples=[];for(var y=y0;y<y0+span;y+=Math.max(1,Math.floor(span/12)))for(var x=x0;x<x0+span;x+=Math.max(1,Math.floor(span/12))){var i=(y*w+x)*4;if(data[i+3]===0){clear++;continue;}var c=[data[i],data[i+1],data[i+2]];samples.push(c);rr+=c[0];gg+=c[1];bb+=c[2];n++;}var rgb=n?[rr/n,gg/n,bb/n]:null,mixed=!!rgb&&samples.some(function(c){return Math.sqrt(c.reduce(function(sum,v,i){return sum+Math.pow(v-rgb[i],2);},0))>26;});return {rgb:rgb,clear:clear/(n+clear||1),mixed:mixed};}var edge=[avg(0,0),avg(w-span,0),avg(0,h-span),avg(w-span,h-span)];if(edge.some(function(a){return !a.rgb||a.clear>.5||a.mixed;})){status.textContent='Corner pixels are transparent or mixed with artwork. Sampling is uncertain; choose colours manually. No colour was selected.';return;}function dist(a,b){return Math.sqrt(a.reduce(function(sum,v,i){return sum+Math.pow(v-b[i],2);},0));}var groups=[];edge.forEach(function(sample,index){var g=groups.find(function(item){return dist(item.rgb,sample.rgb)<26;});if(g){g.indices.push(index);g.rgb=g.rgb.map(function(v,i){return (v*(g.indices.length-1)+sample.rgb[i])/g.indices.length;});}else groups.push({rgb:sample.rgb.slice(),indices:[index]});});if(groups.length===1){el('sbs-af-flat-colour').value=colorHex(groups[0].rgb);el('sbs-af-flat-use-second').checked=false;status.textContent='Corners are co…21460 tokens truncated…ction||'Checking the existing upscale. The untouched original remains unchanged.');
            var attempts=0;stageRunState.upscale={state:'running'};
            try{while(current&&current.pending&&current.pending.replicate_prediction_id&&attempts<300){
                await new Promise(function(resolve){window.setTimeout(resolve,2000);});
                var poll=await api('/'+current.uuid+'/action',{action:'poll',revision:current.revision});
                current=poll;render();attempts++;
                if(current.processing_error){stageRunState.upscale={state:'error',message:current.processing_error};updateStageButtons();message(current.processing_error,true);return;}
                if(current.pending&&current.pending.replicate_prediction_id){message(current.next_action||'AI upscale is still processing. The original remains unchanged.');}
            }
            if(current&&current.pending&&current.pending.replicate_prediction_id){stageRunState.upscale={state:'waiting'};message('The saved upscale is still processing. Reopen this workspace to continue. Do not run another upscale.');}
            else if(current&&!current.processing_error){stageRunState.upscale={state:'complete'};await refresh();render();message('AI upscale finished. Compare the candidate with the untouched original before approval.');}
            }catch(error){stageRunState.upscale={state:'error',message:error.message};updateStageButtons();throw error;}finally{activeStageMethod=previousMethod;if(ownsBusy)busy=false;controls();updateStepButtons();}
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
        window.SBSFinishingBridge={getState:function(){return current;},getStageFailure:function(){var s=current&&current.pending&&stageRunState[current.pending.method];return s&&s.state==='error'?s.message:'';},isBusy:function(){return busy;},perform:function(type,data,label,button){return new Promise(function(resolve,reject){if(busy){reject(new Error('Wait for the current action to finish.'));return;}operation(async function(){await action(type,data);var flowMessages={flow_review:'This visual check has been saved.',flow_pixels:'Pixel check saved. Follow the next action above.',flow_decision:'Your decision has been saved.',flow_repair:'Repair requested. Wait for its preview.',flow_keep:'Repair kept. Check the corrected artwork again.',flow_reject:'Repair rejected. The previous image is selected.',flow_drive:'Finished — ZIP saved and verified in Google Drive.'};if(flowMessages[type])message(flowMessages[type]);resolve(current);},label||'Working…',button,reject);});},runStage:async function(method){await runStage(method,document.querySelector('[data-af-method="'+method+'"]'));if(!current||!current.current_version||current.pending)throw new Error('The file check did not finish. Finish or cancel the waiting action.');},viewArea:function(finding){openAiFocus(finding,document.activeElement);}};
        window.SBSFinishingCorrection={
            getState:function(){return current;},
            save:function(blob,categories,sourceVersion){
                return new Promise(function(resolve,reject){
                    if(busy){reject(new Error('Studio is processing another action. Wait for it to finish, then retry.'));return;}
                    var data=new FormData();data.append('action','pixel_correction');data.append('revision',String(current.revision));data.append('source_version',sourceVersion);data.append('categories',JSON.stringify(categories));data.append('file',new File([blob],'candidate-pixel-correction.png',{type:'image/png'}));
                    operation(async function(){current=await api('/'+current.uuid+'/action',data);render();saveUiState();try{await refresh();render();saveUiState();}catch(refreshError){message('Correction was saved, but workspace refresh failed: '+refreshError.message,true);}resolve(current);},'Saving corrected image as a separate version…',el('sbs-af-correction-run-all'),reject);
                });
            },
            undo:function(){
                return new Promise(function(resolve,reject){
                    if(busy){reject(new Error('Studio is processing another action. Wait for it to finish, then retry.'));return;}
                    operation(async function(){current=await api('/'+current.uuid+'/action',{action:'undo_pixel_correction',revision:current.revision});render();try{await refresh();render();}catch(refreshError){message('Undo was applied, but workspace refresh failed: '+refreshError.message,true);}saveUiState();resolve(current);},'Undoing the latest pixel correction…',el('sbs-af-correction-undo'),reject);
                });
            },
            onState:null
        };
        el('sbs-af-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-gallery-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-upload').addEventListener('submit',function(event){event.preventDefault();var submitter=event.submitter||this.querySelector('button[type=submit]'),uploaded=null;uploadMessage('Saving the untouched original in private Studio storage…');operation(async function(){var f=selectedFile||el('sbs-af-file').files[0]||el('sbs-af-gallery-file').files[0];if(!f)throw new Error('Choose one image using Photos / Gallery or Files / My Files first.');if(f.size>20*1024*1024)throw new Error('This file is '+fileSize(f.size)+'. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.');var data=new FormData();data.append('file',f);data.append('title',el('sbs-af-name').value);current=await api('/upload',data);uploaded=current;await refresh();render();selectedFile=null;el('sbs-af-upload').reset();var saved='Saved successfully: “'+current.title+'”. Workspace '+current.uuid+'. The original is unchanged; no AF number was allocated.';message(saved);uploadMessage(saved,'success');},'Uploading original to private Studio storage…',submitter,function(error){if(uploaded){var saved='Original saved successfully: “'+uploaded.title+'”. Workspace '+uploaded.uuid+'. The workspace list did not refresh: '+error.message+' Do not upload it again; press Refresh workspaces.';uploadMessage(saved,'success');}else{uploadMessage('Upload not confirmed: '+error.message,'error');}});});
        async function runStage(method,button){
            if(!current||busy)return;
            var checkedVersion=selectedCandidate();
            if(method==='inspect'&&checkedVersion&&!current.pending&&Number(checkedVersion.options.width)===Number(el('sbs-af-width').value)&&Number(checkedVersion.options.height)===Number(el('sbs-af-height').value)){
                return operation(async function(){await action('refresh_qa');stageRunState.inspect={state:'done'};updateStageButtons();message('File checks refreshed. Your selected version and review decisions are retained.');},'Refreshing file checks without creating another version…',button);
            }
            stageRunState[method]={state:'running'};updateStageButtons();
            var previousCount=(current.versions||[]).length;
            return operation(async function(){
                await action('prepare',{options:{method:method,width:Number(el('sbs-af-width').value),height:Number(el('sbs-af-height').value),notes:el('sbs-af-notes').value,print_canvas:el('sbs-af-print-canvas').checked}});
                if(!current||!current.pending||current.pending.method!==method)throw new Error('Studio did not confirm that this stage was queued.');
                await action('run');
                if(current&&current.processing_error)throw new Error(current.processing_error);
                if(method==='upscale'&&current&&current.pending&&current.pending.replicate_prediction_id){stageRunState[method]={state:'waiting'};updateStageButtons();return;}
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
        var freshComparison=document.createElement('button');freshComparison.id='sbs-af-ai-review-fresh';freshComparison.type='button';freshComparison.className='sbs-button';freshComparison.textContent='Run a fresh comparison (uses credits)';el('sbs-af-ai-review-run').after(freshComparison);freshComparison.addEventListener('click',function(){operation(function(){return action('ai_review',{fresh:true});},'Running a fresh comparison…',this);});
        el('sbs-af-ai-review-run').addEventListener('click',function(){var button=this,status=el('sbs-af-ai-status');status.dataset.state='';status.textContent='Comparing images… This may take a moment.';operation(function(){return action('ai_review');},'Comparing images with OpenAI…',button,function(error){status.dataset.state='error';status.textContent='Comparison not completed: '+error.message;});});
        el('sbs-af-export').addEventListener('click',function(){var button=this;if(busy||exportPickerOpen||!current||!current.approval)return;choosePackageFolder().then(function(folder){if(folder===undefined)return;operation(function(){return action('export',{filename:el('sbs-af-package-name').value},folder);},folder?'Building ZIP and saving to the chosen folder…':'Building approved local package…',button);});});
        el('sbs-af-versions').addEventListener('change',function(){var uuid=this.value,button=this;if(uuid)operation(function(){return action('select',{version:uuid});},'Selecting version; new approval will be required…',button);});
        el('sbs-af-resume').addEventListener('change',function(){var uuid=this.value,button=this;if(!uuid||busy)return;operation(async function(){current=await api('/'+uuid);render();saveUiState();if(current.pending&&current.pending.replicate_prediction_id){message('Resumed the existing Replicate upscale. Checking its status; do not queue another request.');await pollReplicate();}else{message('Workspace resumed from private storage.');}},'Loading workspace…',button);});
        el('sbs-af-refresh').addEventListener('click',async function(){try{await refresh();render();message('Local workspaces refreshed.');}catch(error){message('Workspaces could not be refreshed: '+error.message,true);}});
        el('sbs-af-clear').addEventListener('click',function(){
            if(busy)return;
            current=null;selectedFile=null;stageRunState={};savedUiState.workspace='';savedUiState.checks={};
            el('sbs-af-resume').value='';el('sbs-af-upload').reset();saveUiState();render();
            message('Artwork cleared from the screen. Saved workspaces are still available in the list below.');
            uploadMessage('Selected artwork cleared. The saved workspace was kept.','info');
        });
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
    if(typeof window!=='undefined')window.SBSFinishing={serverErrorMessage:serverErrorMessage,findingResolved:findingResolved,syncReviewControls:syncReviewControls,matches:matches,canApprove:canApprove,classifyTransparency:classifyTransparency,cleanupFocusBox:cleanupFocusBox,cleanEdgeFringeRegion:cleanEdgeFringeRegion,init:init};
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
}());

