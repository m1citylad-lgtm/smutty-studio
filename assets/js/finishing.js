(function () {
    'use strict';
    function matches(record, query) {
        return [record.title, record.uuid, record.af_id || '', record.links.sb_id].concat(record.links.idea_ids).join(' ').toLowerCase().includes(query.toLowerCase());
    }
    function canApprove(record) { return !!record && record.status === 'Awaiting Review' && !!record.current_version; }
    function init() {
        var root=document.getElementById('sbs-app');if(!root || root.getAttribute('data-authenticated')!=='1')return;
        var current=null, records=[], busy=false, selectedFile=null, driveFolder=null, pickerLoad=null;
        var el=function(id){return document.getElementById(id);};
        function message(text,error){el('sbs-af-progress').textContent=text;el('sbs-af-progress').setAttribute('role',error?'alert':'status');}
        function uploadMessage(text,state){var status=el('sbs-af-upload-status');status.textContent=text;status.dataset.state=state||'info';status.setAttribute('role',state==='error'?'alert':'status');}
        async function api(path,data){
            var options={credentials:'same-origin',headers:{'X-SBS-Request':'studio','X-SBS-Finishing':root.getAttribute('data-finishing-csrf')}};
            if(data){options.method='POST';options.body=data instanceof FormData?data:JSON.stringify(data);if(!(data instanceof FormData))options.headers['Content-Type']='application/json';}
            var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},120000),response,result;
            options.signal=controller.signal;
            try{response=await fetch(root.getAttribute('data-rest')+'finishing'+path,options);}catch(error){throw new Error(error.name==='AbortError'?'The request timed out. Refresh this workspace before retrying; a save may have finished.':'Studio could not be reached. Check your connection and refresh this workspace before retrying.');}finally{clearTimeout(timer);}
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
            el('sbs-af-export').disabled=busy||!current||!current.approval;
            el('sbs-af-save-drive').disabled=busy||!current||!current.approval||!driveFolder;
            el('sbs-af-drive-browse').disabled=busy;
            el('sbs-af-drive-import').querySelector('button[type=submit]').disabled=busy||!el('sbs-af-drive-id').value;
            el('sbs-af-drive-folder').disabled=busy;
            el('sbs-af-versions').disabled=busy;el('sbs-af-resume').disabled=busy;
            document.querySelectorAll('#sbs-af-upload input,#sbs-af-upload button').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-open]').forEach(function(n){n.disabled=busy;});
            el('sbs-af-progress-bar').hidden=!busy;
        }
        function buttonBusy(button,on){if(!button)return;if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;button.setAttribute('aria-busy','true');}button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function operation(fn,text,button,onError){if(busy)return;busy=true;buttonBusy(button,true);controls();message(text);try{await fn();}catch(error){message(error.message,true);if(onError)onError(error);}finally{busy=false;controls();buttonBusy(button,false);}}
        function fileSize(size){return (size/(1024*1024)).toFixed(2)+' MB';}
        function chooseFile(input){var file=input.files&&input.files[0];selectedFile=file||null;if(!file){message('No file selected. Choose Photos / Gallery or Files / My Files.',true);uploadMessage('No file selected. Choose an image to continue.');return;}var other=el(input.id==='sbs-af-file'?'sbs-af-gallery-file':'sbs-af-file');other.value='';if(file.size>20*1024*1024){selectedFile=null;input.value='';var warning='This file is '+fileSize(file.size)+'. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.';message(warning,true);uploadMessage(warning,'error');return;}var selected=file.name+' selected ('+fileSize(file.size)+'). Press Store untouched original locally to continue.';message(selected);uploadMessage(selected);}
        function image(id,asset,alt){var img=el(id);img.hidden=!asset;if(asset){img.src=asset.url;img.alt=alt;}else{img.removeAttribute('src');img.alt='';}}
        function render(){
            resetChecks();var v=current&&current.versions.find(function(v){return v.uuid===current.current_version;});
            image('sbs-af-original',current&&current.original,'Untouched original: '+(current?current.title:''));image('sbs-af-candidate',v&&v.asset,'Candidate version '+(v?v.number:''));
            var link=el('sbs-af-original-download');link.hidden=!current;if(current){link.href=current.original.url;}else{link.removeAttribute('href');}
            var candidateLink=el('sbs-af-candidate-download');candidateLink.hidden=!v;if(v){candidateLink.href=v.asset.url;}else{candidateLink.removeAttribute('href');}
            el('sbs-af-next').textContent=current?'Next action: '+current.next_action+' — '+current.status+' — local '+current.uuid:'Next action: upload or resume artwork.';
            el('sbs-af-versions').replaceChildren();
            var opt=document.createElement('option');opt.value='';opt.textContent='Choose a version';el('sbs-af-versions').appendChild(opt);
            (current?current.versions:[]).slice().reverse().forEach(function(v){var o=document.createElement('option');o.value=v.uuid;o.textContent='Version '+v.number+' — '+v.options.method+' — '+v.created_at;el('sbs-af-versions').appendChild(o);});
            el('sbs-af-versions').value=current?current.current_version||'':'';
            var qa=el('sbs-af-qa');qa.replaceChildren();
            if(current){var q=v?v.qa:current.original_qa,p=document.createElement('p');p.textContent=q.width+' × '+q.height+' px; '+q.mime+'; '+q.alpha+(v?'; effective '+q.effective_ppi+' PPI at '+v.options.width+' × '+v.options.height+' inches.':'.');qa.appendChild(p);
                var integrity=document.createElement('p');integrity.textContent=v?(v.comparison.byte_identical?'Candidate is byte-identical to original.':'Pixels have changed. Aligned side-by-side human comparison required.')+' Automated structural/text/face detection: not run.':'Original SHA-256: '+current.original.sha256;qa.appendChild(integrity);
                var list=document.createElement('ul');q.warnings.forEach(function(w){var item=document.createElement('li');item.textContent=w;list.appendChild(item);});qa.appendChild(list);
                if(v&&v.options.notes){var notes=document.createElement('p');notes.textContent='Recorded review notes: '+v.options.notes;qa.appendChild(notes);}
            }
            var driveLink=el('sbs-af-drive-package'),drive=current&&current.drive;
            var saved=!!(v&&drive&&drive.verified&&drive.candidate_sha256===v.asset.sha256&&/^[A-Za-z0-9_-]{10,200}$/.test(drive.approved_master_file_id||''));
            driveLink.hidden=!saved;
            if(saved){driveLink.href='https://drive.google.com/file/d/'+encodeURIComponent(drive.approved_master_file_id)+'/view';}else{driveLink.removeAttribute('href');}
            controls();
        }
        function catalogue(){
            var list=el('sbs-af-records');list.replaceChildren();var found=records.filter(function(r){return matches(r,el('sbs-af-search').value);}),counts={};records.forEach(function(r){counts[r.status]=(counts[r.status]||0)+1;});
            el('sbs-af-counts').textContent=found.length+' local workspaces shown (newest update first). '+Object.keys(counts).map(function(k){return k+': '+counts[k];}).join('; ');
            found.forEach(function(r){var article=document.createElement('article');article.className='sbs-card';var title=document.createElement('h2');title.textContent=r.title;article.appendChild(title);var p=document.createElement('p');p.textContent='Local '+r.uuid+' · '+r.status+' · Next action: '+r.next_action+' · IDEA: '+(r.links.idea_ids.join(', ')||'TBC')+' · SB: '+(r.links.sb_id||'TBC')+' (unverified links) · Metadata: '+r.metadata_status;article.appendChild(p);var button=document.createElement('button');button.className='sbs-button';button.type='button';button.setAttribute('data-af-open',r.uuid);button.textContent='Open in Finishing';button.disabled=busy;button.addEventListener('click',function(){if(busy)return;current=r;render();document.querySelector('[data-primary-tab="finishing"]').click();el('sbs-af-title').focus();});article.appendChild(button);list.appendChild(article);});
        }
        async function refresh(){var data=await api('');records=data.records;var select=el('sbs-af-resume');select.replaceChildren();var empty=document.createElement('option');empty.value='';empty.textContent='Choose a workspace';select.appendChild(empty);records.forEach(function(r){var o=document.createElement('option');o.value=r.uuid;o.textContent=r.title+' — '+r.status;select.appendChild(o);});if(current){current=records.find(function(r){return r.uuid===current.uuid;})||current;select.value=current.uuid;}catalogue();}
        async function action(type,extra){var data=Object.assign({action:type,revision:current.revision},extra||{});var result=await api('/'+current.uuid+'/action',data);if(type==='export'){el('sbs-af-package').href=result.package.url;el('sbs-af-package').hidden=false;message('Local package ready. No Drive save or catalogue update.');}else{current=result;await refresh();render();message(type==='approve'?'Local finishing version approved. SB production and Drive remain unchanged.':'Local stage '+type+' complete.');}}
        function loadPicker(){
            if(window.google&&window.google.picker){return Promise.resolve();}
            if(pickerLoad){return pickerLoad;}
            pickerLoad=new Promise(function(resolve,reject){
                var timer=setTimeout(function(){reject(new Error('Google Drive picker took too long to load. Check your connection and try again.'));},20000);
                var done=function(fn){return function(value){clearTimeout(timer);fn(value);};};
                var script=document.createElement('script');script.src='https://apis.google.com/js/api.js';script.async=true;script.onload=function(){
                    if(!window.gapi){clearTimeout(timer);reject(new Error('Google Drive picker could not load.'));return;}
                    window.gapi.load('picker',{callback:done(resolve),onerror:done(function(){reject(new Error('Google Drive picker could not load.'));}),timeout:15000,ontimeout:done(function(){reject(new Error('Google Drive picker took too long to load. Try again.'));})});
                };script.onerror=done(function(){reject(new Error('Google Drive picker could not load. Check the connection and try again.'));});document.head.appendChild(script);
            }).catch(function(error){pickerLoad=null;throw error;});
            return pickerLoad;
        }
        function openDrivePicker(mode){
            var button=el(mode==='folder'?'sbs-af-drive-folder':'sbs-af-drive-browse');
            operation(async function(){
                var settings=await api('/google/picker',{});
                await loadPicker();
                el(mode==='folder'?'sbs-af-drive-folder-status':'sbs-af-drive-status').textContent='Google Drive selection is open. Choose an item or cancel to return to Studio.';
                await new Promise(function(resolve,reject){
                    try{
                        var view;
                        if(mode==='folder'){
                            view=new google.picker.DocsView(google.picker.ViewId.FOLDERS);
                            view.setSelectFolderEnabled(true);view.setIncludeFolders(true);
                        }else{
                            view=new google.picker.DocsView(google.picker.ViewId.DOCS);
                            view.setMimeTypes('image/png,image/jpeg,image/webp');view.setIncludeFolders(false);
                        }
                        view.setMode(google.picker.DocsViewMode.LIST);
                        var picker=new google.picker.PickerBuilder().addView(view)
                            .setOAuthToken(settings.access_token).setDeveloperKey(settings.api_key)
                            .setAppId(settings.app_id).setOrigin(window.location.protocol+'//'+window.location.host)
                            .setSize(Math.max(160,Math.min(900,window.innerWidth-24)),Math.max(160,Math.min(600,window.innerHeight-48)))
                            .setTitle(mode==='folder'?'Choose a Google Drive folder for the approved package':'Choose an artwork image from Google Drive')
                            .setCallback(function(data){
                                var actionName=data[google.picker.Response.ACTION];
                                if(actionName!==google.picker.Action.PICKED&&actionName!==google.picker.Action.CANCEL&&actionName!=='error'){return;}
                                if(actionName==='error'){picker.dispose();reject(new Error('Google Drive could not open the selection window. Check the Picker settings and try again.'));return;}
                                if(actionName===google.picker.Action.PICKED){
                                    var doc=(data[google.picker.Response.DOCUMENTS]||[])[0]||{};
                                    var id=doc[google.picker.Document.ID],name=doc[google.picker.Document.NAME]||'selected item';
                                    if(!id){picker.dispose();button.focus();reject(new Error('Google did not return the selected item.'));return;}
                                    if(mode==='folder'){
                                        driveFolder={id:id,name:name};el('sbs-af-drive-folder-status').textContent='Drive save folder selected: '+name+'.';
                                        controls();message('Drive folder selected. The package will only be saved after you press the save button.');
                                    }else{
                                        el('sbs-af-drive-id').value=id;
                                        if(!el('sbs-af-name').value.trim()){el('sbs-af-name').value=name.replace(/\.[^.]+$/,'');}
                                        el('sbs-af-drive-status').textContent='Selected from Google Drive: '+name+'. Press Import selected Drive image as untouched original.';
                                        controls();message('Drive image selected. It has not been imported yet.');
                                    }
                                }else if(actionName===google.picker.Action.CANCEL){
                                    message('Google Drive selection cancelled. Nothing was changed.');
                                }
                                picker.dispose();button.focus();resolve();
                            }).build();
                        picker.setVisible(true);
                    }catch(error){reject(error);}
                });
            },mode==='folder'?'Opening Google Drive folders…':'Opening Google Drive images…',button,function(error){el(mode==='folder'?'sbs-af-drive-folder-status':'sbs-af-drive-status').textContent=error.message;});
        }
        el('sbs-af-drive-browse').addEventListener('click',function(){openDrivePicker('image');});
        el('sbs-af-drive-folder').addEventListener('click',function(){openDrivePicker('folder');});
        el('sbs-af-drive-import').addEventListener('submit',function(event){
            event.preventDefault();
            var form=this,button=form.querySelector('button[type=submit]'),saved=null;
            operation(async function(){
                var status=el('sbs-af-drive-status');
                status.textContent='Checking Drive access and importing untouched original…';
                var id=el('sbs-af-drive-id').value.trim();
                if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw new Error('Enter a valid Google Drive file ID.');
                saved=await api('/import-drive',{file_id:id,title:el('sbs-af-name').value,
                    ideas:el('sbs-af-ideas').value,sb:el('sbs-af-sb').value});
                current=saved;status.textContent=saved.already_imported?'This image was already imported. Reopened existing workspace '+saved.uuid+'. No duplicate was created.':'Original imported successfully. Workspace '+saved.uuid+'. No AF ID assigned.';
                await refresh();render();form.reset();el('sbs-af-drive-id').value='';form.querySelector('button[type=submit]').disabled=true;
            },'Importing image from Google Drive…',button,function(error){
                el('sbs-af-drive-status').textContent=saved
                    ?'Original saved locally as '+saved.uuid+'. Refresh workspaces before retrying. '+error.message
                    :'Drive import not confirmed: '+error.message;
            });
        });
        el('sbs-af-save-drive').addEventListener('click',function(){
            var button=this,saved=null;
            operation(async function(){
                if(!driveFolder)throw new Error('Choose a Google Drive save folder first.');
                saved=await api('/save-drive',{uuid:current.uuid,revision:current.revision,folder_id:driveFolder.id});
                current=saved;await refresh();render();
                var status=el('sbs-af-drive-folder-status');
                status.textContent=saved.drive_save_already_complete?'This approved package was already saved and verified in '+driveFolder.name+'.':'Approved package saved and checksum verified in '+driveFolder.name+'.';
                message(status.textContent+' Local finishing approval only; production status is unchanged.');
            },'Saving and verifying the approved package in Google Drive…',button,function(error){
                el('sbs-af-drive-folder-status').textContent=saved?'Package saved and verified. The workspace list did not refresh. Press Refresh workspaces. '+error.message:'Drive save not confirmed: '+error.message+' Refresh workspaces before retrying.';
            });
        });
        el('sbs-af-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-gallery-file').addEventListener('change',function(){chooseFile(this);});
        el('sbs-af-upload').addEventListener('submit',function(event){event.preventDefault();var submitter=event.submitter||this.querySelector('button[type=submit]'),uploaded=null;uploadMessage('Saving the untouched original in private Studio storage…');operation(async function(){var f=selectedFile||el('sbs-af-file').files[0]||el('sbs-af-gallery-file').files[0];if(!f)throw new Error('Choose one image using Photos / Gallery or Files / My Files first.');if(f.size>20*1024*1024)throw new Error('This file is '+fileSize(f.size)+'. The limit is 20 MB. Choose a smaller copy; your original file will not be changed.');var data=new FormData();data.append('file',f);data.append('title',el('sbs-af-name').value);data.append('ideas',el('sbs-af-ideas').value);data.append('sb',el('sbs-af-sb').value);current=await api('/upload',data);uploaded=current;await refresh();render();selectedFile=null;el('sbs-af-upload').reset();var saved='Saved successfully: “'+current.title+'”. Workspace '+current.uuid+'. The original is unchanged; no AF number was allocated.';message(saved);uploadMessage(saved,'success');},'Uploading original to private Studio storage…',submitter,function(error){if(uploaded){var saved='Original saved successfully: “'+uploaded.title+'”. Workspace '+uploaded.uuid+'. The workspace list did not refresh: '+error.message+' Do not upload it again; press Refresh workspaces.';uploadMessage(saved,'success');}else{uploadMessage('Upload not confirmed: '+error.message,'error');}});});
        el('sbs-af-prepare').addEventListener('click',function(){var button=this;operation(function(){return action('prepare',{options:{method:el('sbs-af-method').value,width:Number(el('sbs-af-width').value),height:Number(el('sbs-af-height').value),notes:el('sbs-af-notes').value}});},'Queueing selected stage…',button);});
        ['run','cancel','approve','export'].forEach(function(type){el('sbs-af-'+type).addEventListener('click',function(){var button=this;operation(function(){return action(type,type==='approve'?{checks:checks()}:{});},type==='run'?'Running local stage. The original remains untouched…':'Processing '+type+'…',button);});});
        el('sbs-af-versions').addEventListener('change',function(){var uuid=this.value,button=this;if(uuid)operation(function(){return action('select',{version:uuid});},'Selecting version; new approval will be required…',button);});
        el('sbs-af-resume').addEventListener('change',function(){var uuid=this.value,button=this;if(!uuid||busy)return;operation(async function(){current=await api('/'+uuid);render();message('Workspace resumed from private storage.');},'Loading workspace…',button);});
        el('sbs-af-refresh').addEventListener('click',function(){var button=this;operation(async function(){await refresh();render();message('Local workspaces refreshed.');},'Refreshing workspaces…',button);});
        document.querySelectorAll('[data-af-check]').forEach(function(n){n.addEventListener('change',controls);});
        el('sbs-af-zoom').addEventListener('change',function(){var width=Number(this.value)*100+'%';['sbs-af-original','sbs-af-candidate'].forEach(function(id){el(id).style.width=width;});});
        // Scroll together for aligned comparison at matching relative image coordinates.
        var syncing=false;document.querySelectorAll('.sbs-af-viewport').forEach(function(view){view.addEventListener('scroll',function(){if(syncing)return;syncing=true;document.querySelectorAll('.sbs-af-viewport').forEach(function(other){if(other!==view){other.scrollLeft=view.scrollLeft;other.scrollTop=view.scrollTop;}});requestAnimationFrame(function(){syncing=false;});});});
        el('sbs-af-proof').addEventListener('change',function(){el('sbs-af-compare').setAttribute('data-proof',this.value);});
        el('sbs-af-search').addEventListener('input',catalogue);
        ['local','sb'].forEach(function(which){el('sbs-af-show-'+which).addEventListener('click',function(){el('sbs-af-local-catalogue').hidden=which!=='local';el('sbs-af-sb-catalogue').hidden=which!=='sb';el('sbs-af-show-local').setAttribute('aria-pressed',String(which==='local'));el('sbs-af-show-sb').setAttribute('aria-pressed',String(which==='sb'));});});
        var googleBusy=false,googleState={configured:false,connected:false};
        function googleControls(){el('sbs-google-connect').disabled=googleBusy||!googleState.configured||googleState.connected;el('sbs-google-reconnect').disabled=googleBusy||!googleState.configured;el('sbs-google-disconnect').disabled=googleBusy||!googleState.connected;el('sbs-google-refresh').disabled=googleBusy;el('sbs-google-config').querySelectorAll('input,button').forEach(function(n){n.disabled=googleBusy;});}
        function googlePaint(s,prefix){googleState={configured:!!s.configured,connected:!!s.connected};if(s.client_id){el('sbs-google-client').value=s.client_id;}el('sbs-google-status').textContent=(prefix||'')+(s.connected?'Google sign-in is connected'+(s.access_expired?' (the connection will refresh automatically when needed)':''):s.configured?'Client settings are saved; Google sign-in is not connected yet.':'Client settings are not saved; Google sign-in is not connected.')+' '+s.message+(s.picker_configured?' Google Picker is configured.':' Google Picker browser key is still needed.');el('sbs-google-redirect').textContent=s.redirect_uri;googleControls();}
        function googleButtonBusy(button,on,label){if(!button)return;if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;}button.textContent=label||'Processing…';button.setAttribute('aria-busy','true');button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function googleOperation(fn,progress,button){if(googleBusy)return;googleBusy=true;googleButtonBusy(button,true);googleControls();if(progress){el('sbs-google-status').textContent=progress+' Please wait.';}try{await fn();}catch(e){el('sbs-google-status').textContent='Google settings could not be checked or saved: '+e.message;}finally{googleBusy=false;googleButtonBusy(button,false);googleControls();}}
        el('sbs-google-refresh').addEventListener('click',function(){var button=this;googleOperation(async function(){googlePaint(await api('/google/status'));},'Checking saved Google settings…',button);});
        el('sbs-google-config').addEventListener('submit',function(e){e.preventDefault();var button=this.querySelector('button[type="submit"]');googleOperation(async function(){try{googlePaint(await api('/google/configure',{client_id:el('sbs-google-client').value.trim(),client_secret:el('sbs-google-secret').value,picker_api_key:el('sbs-google-picker-key').value}),'Settings saved securely. ');}finally{el('sbs-google-secret').value='';el('sbs-google-picker-key').value='';}},'Saving encrypted Google settings…',button);});
        ['connect','reconnect'].forEach(function(type){el('sbs-google-'+type).addEventListener('click',function(){var button=this;googleOperation(async function(){var result=await api('/google/connect',{}),url=new URL(result.authorization_url);if(url.protocol!=='https:'||url.hostname!=='accounts.google.com')throw new Error('Invalid Google sign-in address.');window.location.assign(url.href);},'Opening Google sign-in…',button);});});
        el('sbs-google-disconnect').addEventListener('click',function(){var button=this;googleOperation(async function(){googlePaint(await api('/google/disconnect',{}));},'Disconnecting Google Drive…',button);});
        document.querySelectorAll('[data-primary-tab]').forEach(function(button){button.addEventListener('click',function(){var tab=button.getAttribute('data-primary-tab');if(tab==='finishing'||tab==='catalogue'){operation(async function(){await refresh();if(tab==='finishing')render();message('Local workspaces loaded.');},'Loading local workspaces…');}if(tab==='settings'){googleOperation(async function(){googlePaint(await api('/google/status'));},'Checking saved Google settings…');}});});
        if(root.getAttribute('data-open-settings')==='1')googleOperation(async function(){googlePaint(await api('/google/status'));},'Checking saved Google settings…');
        render();
    }
    if(typeof window!=='undefined')window.SBSFinishing={matches:matches,canApprove:canApprove,init:init};
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
}());
