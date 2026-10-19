(function () {
    'use strict';
    function matches(record, query) {
        return [record.title, record.uuid, record.af_id || '', record.links.sb_id].concat(record.links.idea_ids).join(' ').toLowerCase().includes(query.toLowerCase());
    }
    function canApprove(record) { return !!record && record.status === 'Awaiting Review' && !!record.current_version; }
    function init() {
        var root=document.getElementById('sbs-app');if(!root || root.getAttribute('data-authenticated')!=='1')return;
        var current=null, records=[], busy=false;
        var el=function(id){return document.getElementById(id);};
        function message(text,error){el('sbs-af-progress').textContent=text;el('sbs-af-progress').setAttribute('role',error?'alert':'status');}
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
            el('sbs-af-export').disabled=busy||!current||!current.approval;
            el('sbs-af-versions').disabled=busy;el('sbs-af-resume').disabled=busy;
            document.querySelectorAll('#sbs-af-upload input,#sbs-af-upload button').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-open]').forEach(function(n){n.disabled=busy;});
            el('sbs-af-progress-bar').hidden=!busy;
        }
        async function operation(fn,text){if(busy)return;busy=true;controls();message(text);try{await fn();}catch(error){message(error.message,true);}finally{busy=false;controls();}}
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
            controls();
        }
        function catalogue(){
            var list=el('sbs-af-records');list.replaceChildren();var found=records.filter(function(r){return matches(r,el('sbs-af-search').value);}),counts={};records.forEach(function(r){counts[r.status]=(counts[r.status]||0)+1;});
            el('sbs-af-counts').textContent=found.length+' local workspaces shown (newest update first). '+Object.keys(counts).map(function(k){return k+': '+counts[k];}).join('; ');
            found.forEach(function(r){var article=document.createElement('article');article.className='sbs-card';var title=document.createElement('h2');title.textContent=r.title;article.appendChild(title);var p=document.createElement('p');p.textContent='Local '+r.uuid+' · '+r.status+' · Next action: '+r.next_action+' · IDEA: '+(r.links.idea_ids.join(', ')||'TBC')+' · SB: '+(r.links.sb_id||'TBC')+' (unverified links) · Metadata: '+r.metadata_status;article.appendChild(p);var button=document.createElement('button');button.className='sbs-button';button.type='button';button.setAttribute('data-af-open',r.uuid);button.textContent='Open in Finishing';button.disabled=busy;button.addEventListener('click',function(){if(busy)return;current=r;render();document.querySelector('[data-primary-tab="finishing"]').click();el('sbs-af-title').focus();});article.appendChild(button);list.appendChild(article);});
        }
        async function refresh(){var data=await api('');records=data.records;var select=el('sbs-af-resume');select.replaceChildren();var empty=document.createElement('option');empty.value='';empty.textContent='Choose a workspace';select.appendChild(empty);records.forEach(function(r){var o=document.createElement('option');o.value=r.uuid;o.textContent=r.title+' — '+r.status;select.appendChild(o);});if(current){current=records.find(function(r){return r.uuid===current.uuid;})||current;select.value=current.uuid;}catalogue();}
        async function action(type,extra){var data=Object.assign({action:type,revision:current.revision},extra||{});var result=await api('/'+current.uuid+'/action',data);if(type==='export'){el('sbs-af-package').href=result.package.url;el('sbs-af-package').hidden=false;message('Local package ready. No Drive save or catalogue update.');}else{current=result;await refresh();render();message(type==='approve'?'Local finishing version approved. SB production and Drive remain unchanged.':'Local stage '+type+' complete.');}}
        el('sbs-af-upload').addEventListener('submit',function(event){event.preventDefault();operation(async function(){var f=el('sbs-af-file').files[0];if(!f)throw new Error('Choose an image file.');if(f.size>20*1024*1024)throw new Error('Choose an image up to 20 MB.');var data=new FormData();data.append('file',f);data.append('title',el('sbs-af-name').value);data.append('ideas',el('sbs-af-ideas').value);data.append('sb',el('sbs-af-sb').value);current=await api('/upload',data);await refresh();render();message('Untouched original stored locally. No AF number allocated.');},'Uploading original to private Studio storage…');});
        el('sbs-af-prepare').addEventListener('click',function(){operation(function(){return action('prepare',{options:{method:el('sbs-af-method').value,width:Number(el('sbs-af-width').value),height:Number(el('sbs-af-height').value),notes:el('sbs-af-notes').value}});},'Queuing stage…');});
        ['run','cancel','approve','export'].forEach(function(type){el('sbs-af-'+type).addEventListener('click',function(){operation(function(){return action(type,type==='approve'?{checks:checks()}:{});},type==='run'?'Running local stage. The original remains untouched…':'Working on local '+type+'…');});});
        el('sbs-af-versions').addEventListener('change',function(){var uuid=this.value;if(uuid)operation(function(){return action('select',{version:uuid});},'Selecting version; new approval will be required…');});
        el('sbs-af-resume').addEventListener('change',function(){var uuid=this.value;if(!uuid||busy)return;operation(async function(){current=await api('/'+uuid);render();message('Workspace resumed from private storage.');},'Loading workspace…');});
        el('sbs-af-refresh').addEventListener('click',function(){operation(async function(){await refresh();render();message('Local workspaces refreshed.');},'Refreshing…');});
        document.querySelectorAll('[data-af-check]').forEach(function(n){n.addEventListener('change',controls);});
        el('sbs-af-zoom').addEventListener('change',function(){var width=Number(this.value)*100+'%';['sbs-af-original','sbs-af-candidate'].forEach(function(id){el(id).style.width=width;});});
        // Scroll together for aligned comparison at matching relative image coordinates.
        var syncing=false;document.querySelectorAll('.sbs-af-viewport').forEach(function(view){view.addEventListener('scroll',function(){if(syncing)return;syncing=true;document.querySelectorAll('.sbs-af-viewport').forEach(function(other){if(other!==view){other.scrollLeft=view.scrollLeft;other.scrollTop=view.scrollTop;}});requestAnimationFrame(function(){syncing=false;});});});
        el('sbs-af-proof').addEventListener('change',function(){el('sbs-af-compare').setAttribute('data-proof',this.value);});
        el('sbs-af-search').addEventListener('input',catalogue);
        ['local','sb'].forEach(function(which){el('sbs-af-show-'+which).addEventListener('click',function(){el('sbs-af-local-catalogue').hidden=which!=='local';el('sbs-af-sb-catalogue').hidden=which!=='sb';el('sbs-af-show-local').setAttribute('aria-pressed',String(which==='local'));el('sbs-af-show-sb').setAttribute('aria-pressed',String(which==='sb'));});});
        var googleBusy=false;
        function googlePaint(s){el('sbs-google-status').textContent=(s.connected?'Google OAuth grant stored'+(s.access_expired?' (access token expired; reconnect required in this scaffold)':''):s.configured?'Client configured; not connected':'Not configured; not connected')+'. '+s.message;el('sbs-google-redirect').textContent=s.redirect_uri;el('sbs-google-connect').disabled=!s.configured||s.connected;el('sbs-google-reconnect').disabled=!s.configured;el('sbs-google-disconnect').disabled=!s.connected;}
        async function google(fn){if(googleBusy)return;googleBusy=true;document.querySelectorAll('#sbs-google-config input,#sbs-google-config button,[id^="sbs-google-"]button').forEach(function(n){n.disabled=true;});try{await fn();}catch(e){el('sbs-google-status').textContent=e.message;}finally{googleBusy=false;document.querySelectorAll('#sbs-google-config input,#sbs-google-config button').forEach(function(n){n.disabled=false;});}}
        el('sbs-google-refresh').addEventListener('click',function(){google(async function(){googlePaint(await api('/google/status'));});});
        el('sbs-google-config').addEventListener('submit',function(e){e.preventDefault();google(async function(){try{googlePaint(await api('/google/configure',{client_id:el('sbs-google-client').value.trim(),client_secret:el('sbs-google-secret').value}));}finally{el('sbs-google-secret').value='';}});});
        ['connect','reconnect'].forEach(function(type){el('sbs-google-'+type).addEventListener('click',function(){google(async function(){var result=await api('/google/connect',{}),url=new URL(result.authorization_url);if(url.protocol!=='https:'||url.hostname!=='accounts.google.com')throw new Error('Invalid Google sign-in address.');window.location.assign(url.href);});});});
        el('sbs-google-disconnect').addEventListener('click',function(){google(async function(){googlePaint(await api('/google/disconnect',{}));});});
        document.querySelectorAll('[data-primary-tab]').forEach(function(button){button.addEventListener('click',function(){var tab=button.getAttribute('data-primary-tab');if(tab==='finishing'||tab==='catalogue'){operation(async function(){await refresh();if(tab==='finishing')render();message('Local workspaces loaded.');},'Loading local workspaces…');}if(tab==='settings'){google(async function(){googlePaint(await api('/google/status'));});}});});
        if(root.getAttribute('data-open-settings')==='1')google(async function(){googlePaint(await api('/google/status'));});
        render();
    }
    if(typeof window!=='undefined')window.SBSFinishing={matches:matches,canApprove:canApprove,init:init};
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
}());
