(function () {
    'use strict';
    function matches(record, query) {
        return [record.title, record.uuid, record.af_id || ''].join(' ').toLowerCase().includes(query.toLowerCase());
    }
    function canApprove(record) { return !!record && record.status === 'Awaiting Review' && !!record.current_version; }
    function init() {
        var root=document.getElementById('sbs-app');if(!root || root.getAttribute('data-authenticated')!=='1')return;
        var current=null, records=[], busy=false, selectedFile=null, exportPickerOpen=false, proofPreviewUrl=null, proofSourceKey='', proofRenderedKey='', activePrintQA=null;
        var el=function(id){return document.getElementById(id);};
        function message(text,error){el('sbs-af-progress').textContent=text;el('sbs-af-progress').setAttribute('role',error?'alert':'status');}
        function uploadMessage(text,state){var status=el('sbs-af-upload-status');status.textContent=text;status.dataset.state=state||'info';status.setAttribute('role',state==='error'?'alert':'status');}
        async function api(path,data){
            var options={credentials:'same-origin',headers:{'X-SBS-Request':'studio','X-SBS-Finishing':root.getAttribute('data-finishing-csrf')}};
            if(data){options.method='POST';options.body=data instanceof FormData?data:JSON.stringify(data);if(!(data instanceof FormData))options.headers['Content-Type']='application/json';}
            var response=await fetch(root.getAttribute('data-rest')+'finishing'+path,options),result;
            try{result=await response.json();}catch(e){throw new Error('Unexpected server response. Check the workspace before retrying.');}
            if(!response.ok)throw new Error(result.message||'Request failed. Original retained.');return result;
        }
        function checks(){var result={};document.querySelectorAll('[data-af-check]').forEach(function(n){result[n.getAttribute('data-af-check')]=n.checked;});return result;}
        function resetChecks(){document.querySelectorAll('[data-af-check]').forEach(function(n){n.checked=false;});el('sbs-af-package').hidden=true;el('sbs-af-package').removeAttribute('href');}
        function controls(){
            el('sbs-af-prepare').disabled=busy||!current;
            el('sbs-af-run').disabled=busy||!current||!current.pending;
            el('sbs-af-cancel').disabled=busy||!current||!current.pending;
            el('sbs-af-approve').disabled=busy||!canApprove(current)||!Object.values(checks()).every(Boolean);
            el('sbs-af-export').disabled=busy||exportPickerOpen||!current||!current.approval;
            el('sbs-af-versions').disabled=busy;el('sbs-af-resume').disabled=busy;
            document.querySelectorAll('#sbs-af-upload input,#sbs-af-upload button').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-open]').forEach(function(n){n.disabled=busy;});
            el('sbs-af-progress-bar').hidden=!busy;
        }
        function buttonBusy(button,on){if(!button)return;if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;button.setAttribute('aria-busy','true');}button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function operation(fn,text,button,onError){if(busy)return;busy=true;buttonBusy(button,true);controls();message(text);try{await fn();}catch(error){message(error.message,true);if(onError)onError(error);}finally{busy=false;controls();buttonBusy(button,false);}}
        function fileSize(size){return (size/(1024*1024)).toFixed(2)+' MB';}
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
        function image(id,asset,alt){var img=el(id);img.hidden=!asset;if(asset){img.src=asset.url;img.alt=alt;}else{img.removeAttribute('src');img.alt='';}}
        function refreshPrintStatus(){
            var q=activePrintQA,status=el('sbs-af-print-status');
            if(!q){status.textContent='HOLD — no image data is available for the print-size check.';status.dataset.state='review';return;}
            var width=Number(el('sbs-af-width').value),height=Number(el('sbs-af-height').value);
            if(!isFinite(width)||!isFinite(height)||width<=0||height<=0){status.textContent='HOLD — enter a valid print width and height.';status.dataset.state='review';return;}
            var ppi=Math.min(Number(q.width)/width,Number(q.height)/height);
            var size=width+' × '+height+' inches';
            status.dataset.state='review';
            status.textContent=ppi>=300
                ?'Pixel-size check: '+ppi.toFixed(1)+' PPI at '+size+'; meets the 300 PPI dimension target. This does not prove source detail or print quality. Review all four proofs.'
                :'REVIEW: '+ppi.toFixed(1)+' PPI at '+size+'; below the 300 PPI dimension target. This check does not add detail or upscale the image. Review the four proofs and consider a separately validated upscale.';
        }
        function renderPrintProof(q,asset,isCandidate){
            var section=el('sbs-af-print-proof');
            section.hidden=!asset;activePrintQA=q||null;
            if(!asset){el('sbs-af-print-proof-title').textContent='Four-colour print check';refreshPrintStatus();return;}
            el('sbs-af-print-proof-title').textContent=isCandidate?'Four-colour candidate proof':'Four-colour source proof';
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
                    el('sbs-af-print-status').textContent='The four-colour preview could not be rendered. Use the original/candidate comparison above.';
                }
            }
            source.addEventListener('load',drawPreview,{once:true});
            if(source.complete&&source.naturalWidth)drawPreview();
        }
        function friendlyName(title){return (title||'Artwork').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019']/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,110)||'Artwork';}
        function render(){
            resetChecks();var nameField=el('sbs-af-package-name');var workspaceKey=current?current.uuid:'';if(nameField.dataset.workspace!==workspaceKey){nameField.value=current?friendlyName(current.title)+'-local-finishing.zip':'';nameField.dataset.workspace=workspaceKey;}var v=current&&current.versions.find(function(v){return v.uuid===current.current_version;});
            image('sbs-af-original',current&&current.original,'Untouched original: '+(current?current.title:''));image('sbs-af-candidate',v&&v.asset,'Candidate version '+(v?v.number:''));
            var candidateLink=el('sbs-af-candidate-download');candidateLink.hidden=!v;if(v){candidateLink.href=v.asset.url;}else{candidateLink.removeAttribute('href');}
            el('sbs-af-next').textContent=current?'Next action: '+current.next_action+' — '+current.status+' — local '+current.uuid:'Next action: upload or resume artwork.';
            el('sbs-af-versions').replaceChildren();
            var opt=document.createElement('option');opt.value='';opt.textContent='Choose a version';el('sbs-af-versions').appendChild(opt);
            (current?current.versions:[]).slice().reverse().forEach(function(v){var o=document.createElement('option');o.value=v.uuid;o.textContent='Version '+v.number+' — '+v.options.method+' — '+v.created_at;el('sbs-af-versions').appendChild(o);});
            el('sbs-af-versions').value=current?current.current_version||'':'';
            var qa=el('sbs-af-qa');qa.replaceChildren();
            if(current){var q=v?v.qa:current.original_qa,p=document.createElement('p');p.textContent=q.width+' × '+q.height+' px; '+q.mime+'; '+q.alpha+(v?'; effective '+q.effective_ppi+' PPI at '+v.options.width+' × '+v.options.height+' inches.':'.');qa.appendChild(p);
                var integrity=document.createElement('p');integrity.textContent=v?(v.comparison.byte_identical?'Candidate is byte-identical to original.':'Pixels have changed. Aligned side-by-side human comparison required.')+' Automated structural/text/face detection: not run.':'Original SHA-256: '+current.original.sha256;qa.appendChild(integrity);
                var list=document.createElement('ul');q.warnings.forEach(function(w){var item=document.createElement('li');item.textContent=w;list.appendChild(item);});qa.appendChild(list);renderPrintProof(q,v?v.asset:current.original,!!v);
                if(v&&v.options.notes){var notes=document.createElement('p');notes.textContent='Recorded review notes: '+v.options.notes;qa.appendChild(notes);}
            }
            controls();
        }
        function catalogue(){
            var list=el('sbs-af-records');list.replaceChildren();var found=records.filter(function(r){return matches(r,el('sbs-af-search').value);}),counts={};records.forEach(function(r){counts[r.status]=(counts[r.status]||0)+1;});
            el('sbs-af-counts').textContent=found.length+' local workspaces shown (newest update first). '+Object.keys(counts).map(function(k){return k+': '+counts[k];}).join('; ');
            found.forEach(function(r){var article=document.createElement('article');article.className='sbs-card';var title=document.createElement('h2');title.textContent=r.title;article.appendChild(title);var p=document.createElement('p');p.textContent='Local '+r.uuid+' · '+r.status+' · Next action: '+r.next_action+' · Metadata: '+r.metadata_status;article.appendChild(p);var button=document.createElement('button');button.className='sbs-button';button.type='button';button.setAttribute('data-af-open',r.uuid);button.textContent='Open in Finishing';button.disabled=busy;button.addEventListener('click',function(){if(busy)return;current=r;render();document.querySelector('[data-primary-tab="finishing"]').click();el('sbs-af-title').focus();});article.appendChild(button);list.appendChild(article);});
        }
        async function refresh(){var data=await api('');records=data.records;var select=el('sbs-af-resume');select.replaceChildren();var empty=document.createElement('option');empty.value='';empty.textContent='Choose a workspace';select.appendChild(empty);records.forEach(function(r){var o=document.createElement('option');o.value=r.uuid;o.textContent=r.title+' — '+r.status;select.appendChild(o);});if(current){current=records.find(function(r){return r.uuid===current.uuid;})||current;select.value=current.uuid;}catalogue();}
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
            if(type==='run'&&current.pending&&current.pending.replicate_prediction_id){
                message('AI upscale is processing on Replicate. The untouched original remains unchanged.');
                var attempts=0;
                while(current.pending&&current.pending.replicate_prediction_id&&attempts<60){
                    await new Promise(function(resolve){window.setTimeout(resolve,2000);});
                    var poll=await api('/'+current.uuid+'/action',{action:'poll',revision:current.revision});
                    current=poll;render();attempts++;
                    if(current.processing_error){message(current.processing_error,true);break;}
                    if(current.pending&&current.pending.replicate_prediction_id){message('AI upscale is still processing. The original remains unchanged.');}
                }
                if(current.pending&&current.pending.replicate_prediction_id){message('Replicate is still processing. Do not run another upscale. You can cancel the current stage after this check stops.');}
                else if(!current.processing_error){await refresh();render();message('AI upscale finished. Compare the candidate with the untouched original before approval.');}
            }else{
                await refresh();render();
                message(type==='approve'?'Local finishing version approved. SB production and Drive remain unchanged.':'Stage '+type+' complete.');
            }
        }
        el('sbs-af-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-gallery-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-upload').addEventListener('submit',function(event){event.preventDefault();var submitter=event.submitter||this.querySelector('button[type=submit]'),uploaded=null;uploadMessage('Saving the untouched original in private Studio storage…');operation(async function(){var f=selectedFile||el('sbs-af-file').files[0]||el('sbs-af-gallery-file').files[0];if(!f)throw new Error('Choose one image using Photos / Gallery or Files / My Files first.');if(f.size>20*1024*1024)throw new Error('This file is '+fileSize(f.size)+'. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.');var data=new FormData();data.append('file',f);data.append('title',el('sbs-af-name').value);current=await api('/upload',data);uploaded=current;await refresh();render();selectedFile=null;el('sbs-af-upload').reset();var saved='Saved successfully: “'+current.title+'”. Workspace '+current.uuid+'. The original is unchanged; no AF number was allocated.';message(saved);uploadMessage(saved,'success');},'Uploading original to private Studio storage…',submitter,function(error){if(uploaded){var saved='Original saved successfully: “'+uploaded.title+'”. Workspace '+uploaded.uuid+'. The workspace list did not refresh: '+error.message+' Do not upload it again; press Refresh workspaces.';uploadMessage(saved,'success');}else{uploadMessage('Upload not confirmed: '+error.message,'error');}});});
        el('sbs-af-prepare').addEventListener('click',function(){var button=this;operation(function(){return action('prepare',{options:{method:el('sbs-af-method').value,width:Number(el('sbs-af-width').value),height:Number(el('sbs-af-height').value),notes:el('sbs-af-notes').value}});},'Queueing selected stage…',button);});
        ['run','cancel','approve'].forEach(function(type){el('sbs-af-'+type).addEventListener('click',function(){var button=this;operation(function(){return action(type,type==='approve'?{checks:checks()}:{});},type==='run'?'Running local stage. The original remains untouched…':'Processing '+type+'…',button);});});
        el('sbs-af-export').addEventListener('click',function(){var button=this;if(busy||exportPickerOpen||!current||!current.approval)return;choosePackageFolder().then(function(folder){if(folder===undefined)return;operation(function(){return action('export',{filename:el('sbs-af-package-name').value},folder);},folder?'Building ZIP and saving to the chosen folder…':'Building approved local package…',button);});});
        el('sbs-af-versions').addEventListener('change',function(){var uuid=this.value,button=this;if(uuid)operation(function(){return action('select',{version:uuid});},'Selecting version; new approval will be required…',button);});
        el('sbs-af-resume').addEventListener('change',function(){var uuid=this.value,button=this;if(!uuid||busy)return;operation(async function(){current=await api('/'+uuid);render();message('Workspace resumed from private storage.');},'Loading workspace…',button);});
        el('sbs-af-refresh').addEventListener('click',function(){var button=this;operation(async function(){await refresh();render();message('Local workspaces refreshed.');},'Refreshing workspaces…',button);});
        document.querySelectorAll('[data-af-check]').forEach(function(n){n.addEventListener('change',controls);});
        el('sbs-af-zoom').addEventListener('change',function(){var width=Number(this.value)*100+'%';['sbs-af-original','sbs-af-candidate'].forEach(function(id){el(id).style.width=width;});document.querySelectorAll('[data-af-proof-image]').forEach(function(img){img.style.width=width;});});
        ['sbs-af-width','sbs-af-height'].forEach(function(id){el(id).addEventListener('input',refreshPrintStatus);});
        // Scroll together for aligned comparison at matching relative image coordinates.
        var syncing=false;document.querySelectorAll('.sbs-af-viewport').forEach(function(view){view.addEventListener('scroll',function(){if(syncing)return;syncing=true;document.querySelectorAll('.sbs-af-viewport').forEach(function(other){if(other!==view){other.scrollLeft=view.scrollLeft;other.scrollTop=view.scrollTop;}});requestAnimationFrame(function(){syncing=false;});});});
        el('sbs-af-proof').addEventListener('change',function(){el('sbs-af-compare').setAttribute('data-proof',this.value);});
        el('sbs-af-search').addEventListener('input',catalogue);
        var googleBusy=false,googleState={configured:false,connected:false};
        function googleControls(){el('sbs-google-connect').disabled=googleBusy||!googleState.configured||googleState.connected;el('sbs-google-reconnect').disabled=googleBusy||!googleState.configured;el('sbs-google-disconnect').disabled=googleBusy||!googleState.connected;el('sbs-google-refresh').disabled=googleBusy;el('sbs-google-config').querySelectorAll('input,button').forEach(function(n){n.disabled=googleBusy;});}
        function googlePaint(s,prefix){googleState={configured:!!s.configured,connected:!!s.connected};el('sbs-google-status').textContent=(prefix||'')+(s.connected?'Google sign-in is connected'+(s.access_expired?' (reconnect required)':''):s.configured?'Client settings are saved; Google sign-in is not connected yet.':'Client settings are not saved; Google sign-in is not connected.')+' '+s.message;el('sbs-google-redirect').textContent=s.redirect_uri;googleControls();}
        function googleButtonBusy(button,on,label){if(!button)return;if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;}button.textContent=label||'Processing…';button.setAttribute('aria-busy','true');button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function google(fn,progress,button){if(googleBusy)return;googleBusy=true;googleButtonBusy(button,true);googleControls();if(progress){el('sbs-google-status').textContent=progress+' Please wait.';}try{await fn();}catch(e){el('sbs-google-status').textContent='Google settings could not be checked or saved: '+e.message;}finally{googleBusy=false;googleButtonBusy(button,false);googleControls();}}
        el('sbs-google-refresh').addEventListener('click',function(){var button=this;google(async function(){googlePaint(await api('/google/status'));},'Checking saved Google settings…',button);});
        el('sbs-google-config').addEventListener('submit',function(e){e.preventDefault();var button=this.querySelector('button[type="submit"]');google(async function(){try{googlePaint(await api('/google/configure',{client_id:el('sbs-google-client').value.trim(),client_secret:el('sbs-google-secret').value}),'Settings saved securely. ');}finally{el('sbs-google-secret').value='';}},'Saving encrypted Google settings…',button);});
        ['connect','reconnect'].forEach(function(type){el('sbs-google-'+type).addEventListener('click',function(){var button=this;google(async function(){var result=await api('/google/connect',{}),url=new URL(result.authorization_url);if(url.protocol!=='https:'||url.hostname!=='accounts.google.com')throw new Error('Invalid Google sign-in address.');window.location.assign(url.href);},'Opening Google sign-in…',button);});});
        el('sbs-google-disconnect').addEventListener('click',function(){var button=this;google(async function(){googlePaint(await api('/google/disconnect',{}));},'Disconnecting Google Drive…',button);});
        document.querySelectorAll('[data-primary-tab]').forEach(function(button){button.addEventListener('click',function(){var tab=button.getAttribute('data-primary-tab');if(tab==='finishing'||tab==='catalogue'){operation(async function(){await refresh();if(tab==='finishing')render();message('Local workspaces loaded.');},'Loading local workspaces…');}if(tab==='settings'){google(async function(){googlePaint(await api('/google/status'));},'Checking saved Google settings…');}});});
        if(root.getAttribute('data-open-settings')==='1')google(async function(){googlePaint(await api('/google/status'));},'Checking saved Google settings…');
        render();
    }
    if(typeof window!=='undefined')window.SBSFinishing={matches:matches,canApprove:canApprove,init:init};
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
}());
