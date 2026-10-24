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
        var root=document.getElementById('sbs-app');if(!root || root.getAttribute('data-authenticated')!=='1')return;
        var current=null, records=[], busy=false, activeStageMethod='', selectedFile=null, selectedMethod='inspect', exportPickerOpen=false, proofPreviewUrl=null, proofSourceKey='', proofRenderedKey='', activePrintQA=null, activeProofAssetUrl='', flatPreviewBlob=null, flatPreviewUrl=null, flatPreviewKey='';
        var el=function(id){return document.getElementById(id);},catalogueReturnFocus=null,catalogueSelected=new Set();
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
            el('sbs-af-prepare').disabled=busy||!current||!!current.pending;
            el('sbs-af-run').disabled=busy||!current||!current.pending||!!current.pending.replicate_prediction_id;
            el('sbs-af-cancel').disabled=busy||!current||!current.pending;
            el('sbs-af-approve').disabled=busy||!canApprove(current)||!Object.values(checks()).every(Boolean);
            el('sbs-af-export').disabled=busy||exportPickerOpen||!current||!current.approval;
            el('sbs-af-ai-review-run').disabled=busy||!current||!current.current_version;el('sbs-af-refresh-qa').disabled=busy||!current||!current.current_version;
            var selectedVersion=current&&current.versions.find(function(v){return v.uuid===current.current_version;});
            var canFlat=!!current&&!current.pending;el('sbs-af-flat-sample').disabled=busy||!canFlat;el('sbs-af-flat-preview').disabled=busy||!canFlat;el('sbs-af-flat-remove').disabled=busy||!canFlat||!flatPreviewBlob||flatPreviewKey!==flatKey();
            el('sbs-af-flat-undo').disabled=busy||!selectedVersion||(selectedVersion.options&&selectedVersion.options.method)!=='flat_background';
            el('sbs-af-versions').disabled=busy;el('sbs-af-resume').disabled=busy;
            document.querySelectorAll('#sbs-af-upload input,#sbs-af-upload button').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-open]').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-rename]').forEach(function(n){n.disabled=busy;});
            document.querySelectorAll('[data-af-delete],[data-af-record-select]').forEach(function(n){n.disabled=busy;});
            el('sbs-af-delete-selected').disabled=busy||catalogueSelected.size===0;
            el('sbs-af-progress-bar').hidden=!busy;
        }
        function stageLabel(method){return ({inspect:'Inspect',resize:'Fit down to print box',print_png:'Prepare print PNG',upscale:'AI upscale'})[method]||'selected stage';}
        function updateStageButtons(){
            document.querySelectorAll('[data-af-method]').forEach(function(button){
                var method=button.getAttribute('data-af-method'),spinner=button.querySelector('.sbs-af-stage-spinner'),done=button.querySelector('.sbs-af-stage-done');
                var running=!!(busy&&activeStageMethod===method),completed=!!(current&&current.versions&&current.versions.some(function(version){return version.options&&version.options.method===method;}));
                if(spinner)spinner.hidden=!running;
                if(done)done.hidden=running||!completed;
                if(running){button.setAttribute('aria-busy','true');button.setAttribute('aria-label',button.querySelector('.sbs-af-stage-button-label').textContent+' — running');}
                else{button.removeAttribute('aria-busy');button.setAttribute('aria-label',button.querySelector('.sbs-af-stage-button-label').textContent+(completed?' — completed':''));}
                button.dataset.stageState=running?'running':completed?'complete':'idle';
            });
        }
        function updateStepButtons(){
            var queued=!!(current&&current.pending),hasVersion=!!(current&&current.current_version),approved=!!(current&&current.approval&&current.approval.version===current.current_version),queuedLabel=queued?stageLabel(current.pending.method):stageLabel(selectedMethod);
            el('sbs-af-prepare').textContent=queued?'✓ 2. '+stageLabel(current.pending.method)+' queued':'2. Queue '+stageLabel(selectedMethod);
            el('sbs-af-run').textContent=queued&&current.pending.replicate_prediction_id?'3. Waiting for Replicate result':queued?'3. Run '+stageLabel(current.pending.method):hasVersion?'✓ 3. Stage complete':'3. Run '+queuedLabel;
            el('sbs-af-approve').textContent=approved?'✓ 6. Approved locally':'6. Approve this local version';
            updateStageButtons();
        }
        function buttonBusy(button,on){if(!button)return;if(on){if(!button.hasAttribute('aria-busy')){button.dataset.previousLabel=button.textContent;button.setAttribute('aria-busy','true');}button.disabled=true;}else{button.removeAttribute('aria-busy');if(button.dataset.previousLabel){button.textContent=button.dataset.previousLabel;delete button.dataset.previousLabel;}}}
        async function operation(fn,text,button,onError){if(busy)return;activeStageMethod=button&&button.id==='sbs-af-run'&&current&&current.pending?current.pending.method:'';busy=true;buttonBusy(button,true);controls();updateStepButtons();message(text);try{await fn();}catch(error){message(error.message,true);if(onError)onError(error);}finally{busy=false;activeStageMethod='';el('sbs-af-progress-bar').removeAttribute('value');controls();buttonBusy(button,false);updateStepButtons();}}
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
            var ppi=Math.min(Number(q.width)/width,Number(q.height)/height);
            var size=width+' × '+height+' in';
            if(ppi>=300){status.dataset.state='ok';status.textContent='PPI: '+ppi.toFixed(1)+' | Target: 300 | Now: '+size;return;}
            var suggestedWidth=Number(q.width)/300,suggestedHeight=Number(q.height)/300;
            status.dataset.state='warning';
            status.textContent='PPI: '+ppi.toFixed(1)+' | Target: 300 | Now: '+size+' | Max: '+suggestedWidth.toFixed(2)+' × '+suggestedHeight.toFixed(2)+' in';
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
                    el('sbs-af-print-status').textContent='The four-colour preview could not be rendered. Use the original/candidate comparison above.';
                }
            }
            source.addEventListener('load',drawPreview,{once:true});
            if(source.complete&&source.naturalWidth)drawPreview();
        }
        var viewer=el('sbs-af-proof-viewer'), viewerStage=el('sbs-af-proof-stage'), viewerImage=el('sbs-af-proof-large'), viewerScale=1, viewerX=0, viewerY=0, viewerPointers=new Map(), viewerStart=null, viewerOpener=null;
        var aiFocus=el('sbs-af-ai-focus'), aiFocusStage=el('sbs-af-ai-focus-stage'), aiFocusImage=null, aiFocusMoveState=null, aiFocusData=null, aiFocusOpener=null, aiFocusSide='candidate';
        function positionAiFocusImage(){
            if(aiFocus.hidden||!aiFocusImage.complete||!aiFocusImage.naturalWidth)return;
            var bounds=aiFocusStage.getBoundingClientRect(),base=Math.min(bounds.width/aiFocusImage.naturalWidth,bounds.height/aiFocusImage.naturalHeight),scale=base*4;
            var width=aiFocusImage.naturalWidth*scale,height=aiFocusImage.naturalHeight*scale;
            aiFocusImage.style.width=width+'px';aiFocusImage.style.height=height+'px';aiFocusImage.style.maxWidth='none';aiFocusImage.style.maxHeight='none';
            requestAnimationFrame(function(){var fx=aiFocusData&&aiFocusData.focus?aiFocusData.focus.x:.5,fy=aiFocusData&&aiFocusData.focus?aiFocusData.focus.y:.5;aiFocusStage.scrollLeft=Math.max(0,Math.min(aiFocusStage.scrollWidth-aiFocusStage.clientWidth,fx*width-aiFocusStage.clientWidth/2));aiFocusStage.scrollTop=Math.max(0,Math.min(aiFocusStage.scrollHeight-aiFocusStage.clientHeight,fy*height-aiFocusStage.clientHeight/2));});
        }
        function setAiFocusSide(side){
            if(!aiFocusData)return;aiFocusSide=side;var imageNode=el(side==='original'?'sbs-af-original':'sbs-af-candidate');
            if(!imageNode||!imageNode.src)return;
            if(aiFocusMoveState){aiFocusMoveState.parent.insertBefore(aiFocusMoveState.node,aiFocusMoveState.next&&aiFocusMoveState.next.parentNode===aiFocusMoveState.parent?aiFocusMoveState.next:null);aiFocusMoveState.node.style.cssText=aiFocusMoveState.cssText;aiFocusMoveState.node.alt=aiFocusMoveState.alt;aiFocusMoveState.node.hidden=aiFocusMoveState.hidden;aiFocusMoveState.node.onload=aiFocusMoveState.onload;aiFocusMoveState=null;}
            aiFocusMoveState={node:imageNode,parent:imageNode.parentNode,next:imageNode.nextSibling,cssText:imageNode.style.cssText,alt:imageNode.alt,hidden:imageNode.hidden,onload:imageNode.onload};aiFocusImage=imageNode;aiFocusImage.hidden=false;
            aiFocusImage.alt=(side==='original'?'Untouched original':'Finishing candidate')+' — enlarged view of '+aiFocusData.area;
            el('sbs-af-ai-focus-original').setAttribute('aria-pressed',side==='original'?'true':'false');el('sbs-af-ai-focus-candidate').setAttribute('aria-pressed',side==='candidate'?'true':'false');
            aiFocusImage.onload=positionAiFocusImage;aiFocusStage.appendChild(aiFocusImage);aiFocusStage.scrollLeft=0;aiFocusStage.scrollTop=0;
            if(aiFocusImage.complete)positionAiFocusImage();
        }
        function openAiFocus(finding,opener){
            var version=current&&current.versions.find(function(v){return v.uuid===current.current_version;});if(!current||!current.original||!version||!version.asset)return;
            var focus=finding.focus&&isFinite(Number(finding.focus.x))&&isFinite(Number(finding.focus.y))&&Number(finding.focus.x)>=0&&Number(finding.focus.x)<=1&&Number(finding.focus.y)>=0&&Number(finding.focus.y)<=1?{x:Number(finding.focus.x),y:Number(finding.focus.y)}:null;
            aiFocusData={area:finding.area||'Flagged area',focus:focus,original:current.original,candidate:version.asset};aiFocusOpener=opener||document.activeElement;
            el('sbs-af-ai-focus-title').textContent=aiFocusData.area;el('sbs-af-ai-focus-note').textContent=focus?'AI-estimated location. No marker covers the artwork. View is 4×; scroll to pan.':'No AI location was saved. View starts at image centre; scroll to pan.';
            if(finding.method==='sampled_alpha'){el('sbs-af-ai-focus-note').textContent='Approximate sampled location. May be intentional. View is 4×; scroll to pan. No marker covers the artwork.';}aiFocus.hidden=false;document.body.style.overflow='hidden';setAiFocusSide('candidate');el('sbs-af-ai-focus-close').focus();
        }
        function closeAiFocus(){if(aiFocus.hidden)return;aiFocus.hidden=true;if(aiFocusMoveState){aiFocusMoveState.parent.insertBefore(aiFocusMoveState.node,aiFocusMoveState.next&&aiFocusMoveState.next.parentNode===aiFocusMoveState.parent?aiFocusMoveState.next:null);aiFocusMoveState.node.style.cssText=aiFocusMoveState.cssText;aiFocusMoveState.node.alt=aiFocusMoveState.alt;aiFocusMoveState.node.hidden=aiFocusMoveState.hidden;aiFocusMoveState.node.onload=aiFocusMoveState.onload;aiFocusMoveState=null;}aiFocusImage=null;aiFocusStage.scrollLeft=0;aiFocusStage.scrollTop=0;aiFocusData=null;document.body.style.overflow='';if(aiFocusOpener&&aiFocusOpener.focus)aiFocusOpener.focus();}
        el('sbs-af-ai-focus-original').addEventListener('click',function(){setAiFocusSide('original');});el('sbs-af-ai-focus-candidate').addEventListener('click',function(){setAiFocusSide('candidate');});el('sbs-af-ai-focus-close').addEventListener('click',closeAiFocus);
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
        function renderAiReview(version){
            var section=el('sbs-af-ai-review'),button=el('sbs-af-ai-review-run'),report=el('sbs-af-ai-review-report'),status=el('sbs-af-ai-status');
            section.hidden=!version;button.disabled=busy||!version;report.replaceChildren();
            if(!version)return;
            if(status.dataset.version!==version.uuid){status.dataset.version=version.uuid;status.dataset.state='';status.textContent=version.ai_review?'Comparison complete. See the report below.':'Not run. This check is optional.';}
            if(!version.ai_review){if(status.dataset.state!=='error'&&status.textContent.indexOf('Comparing')!==0){status.dataset.state='';status.textContent='Not run. This check is optional.';}var prompt=document.createElement('p');prompt.textContent='No AI comparison has been run.';report.appendChild(prompt);return;}
            var result=version.ai_review,findings=(result.findings||[]).filter(function(finding){return finding.severity!=='info';});
            status.dataset.state=result.overall==='unable'?'review':'success';
            status.textContent=findings.length?'AI check: '+findings.length+' area'+(findings.length===1?'':'s')+' to inspect.':result.overall==='unable'?'AI could not assess the image reliably.':'AI check: no specific issues flagged.';
            if(!findings.length){var none=document.createElement('p');none.textContent=result.overall==='unable'?'Try the 4× comparison and inspect the artwork manually.':'No specific issues flagged. AI can miss defects.';report.appendChild(none);return;}
            var findingsHeading=document.createElement('h4');findingsHeading.textContent='Areas to inspect';report.appendChild(findingsHeading);
            var zoomHelp=document.createElement('p');zoomHelp.className='sbs-af-ai-zoom-help';zoomHelp.textContent='View area opens the image at 4× and centres on the AI estimate when available. No marker covers the artwork.';report.appendChild(zoomHelp);
            var findingsList=document.createElement('ol');findingsList.className='sbs-af-review-points sbs-af-ai-findings';
            findings.forEach(function(finding,index){var item=document.createElement('li');item.dataset.severity=finding.severity;var heading=document.createElement('strong');heading.textContent=(index+1)+'. '+finding.area;item.appendChild(heading);var issue=document.createElement('p');issue.textContent=finding.issue+' Check: '+finding.action;item.appendChild(issue);var zoomButton=document.createElement('button');zoomButton.type='button';zoomButton.className='sbs-button sbs-af-ai-zoom-button';zoomButton.textContent='View area';zoomButton.setAttribute('aria-label','Open 4× view centred on '+finding.area);zoomButton.addEventListener('click',function(){openAiFocus(finding,zoomButton);});item.appendChild(zoomButton);findingsList.appendChild(item);});
            report.appendChild(findingsList);
        }
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
            if(geometry.status!=='proportional'){flags.push('Image proportions need review.');}
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
            var queuedCost=current&&current.pending&&current.pending.method==='upscale'?Number(current.pending.estimated_provider_cost||0):0;
            el('sbs-af-stage-help').textContent=queuedCost>0?'No provider request has been sent yet. Running this queued upscale will send the selected image to Replicate Real-ESRGAN. Estimated cost: $'+queuedCost.toFixed(3)+' for this image; actual provider billing may vary. You can cancel instead.':'Choose or resume a workspace, set the print target, choose a stage, then queue and run it. The untouched original stays unchanged.';var nameField=el('sbs-af-package-name');var workspaceKey=current?current.uuid:'';if(nameField.dataset.workspace!==workspaceKey){nameField.value=current?friendlyName(current.title)+'-local-finishing.zip':'';nameField.dataset.workspace=workspaceKey;}var v=current&&current.versions.find(function(v){return v.uuid===current.current_version;});
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
            var qa=el('sbs-af-qa');qa.replaceChildren();
            if(current){var q=v?v.qa:current.original_qa,p=document.createElement('p');p.textContent=q.width+' × '+q.height+' px; '+q.mime+'; '+q.alpha+(v?'; effective '+q.effective_ppi+' PPI at '+v.options.width+' × '+v.options.height+' inches.':'.');qa.appendChild(p);
                var integrity=document.createElement('p');integrity.textContent=v?(v.comparison.byte_identical?'Candidate is byte-identical to original.':'Pixels have changed. Aligned side-by-side human comparison required.')+' AI visual comparison: '+(v.ai_review?'completed; see advisory report below.':'not run.'):'Original SHA-256: '+current.original.sha256;qa.appendChild(integrity);
                var pointsHeading=document.createElement('h3');pointsHeading.className='sbs-af-review-points-title';pointsHeading.textContent='Warnings and points to check';qa.appendChild(pointsHeading);
                var points=document.createElement('ol');points.className='sbs-af-review-points';
                q.warnings.forEach(function(w){var item=document.createElement('li');item.textContent=w;points.appendChild(item);});
                if(v&&v.comparison.geometry&&(v.comparison.geometry.status!=='proportional'||v.comparison.geometry.transparency_sample_matches===false)){var geometry=v.comparison.geometry,geometryLine=document.createElement('li');geometryLine.textContent='Automatic geometry check: '+geometry.message+(geometry.nonuniform_scale_percent!==undefined?' Width scale '+geometry.width_scale+'×; height scale '+geometry.height_scale+'×; difference '+geometry.nonuniform_scale_percent+'%.':'')+(geometry.transparency_sample_matches!==undefined?(' Sampled alpha status '+(geometry.transparency_sample_matches?'matches':'differs')+' between original and candidate.'): '');points.appendChild(geometryLine);}
                if(v&&v.options.notes){var notes=document.createElement('li');notes.textContent='Recorded review note: '+v.options.notes;points.appendChild(notes);}
                if(points.children.length){qa.appendChild(points);}else{pointsHeading.remove();}
                var pixel=q.pixel_review||{};if(pixel.findings&&pixel.findings.length){var heading=document.createElement('h3');heading.textContent='Technical areas to inspect (sampled)';qa.appendChild(heading);pixel.findings.forEach(function(finding){var row=document.createElement('p');row.textContent=finding.issue+' '+finding.action;var view=document.createElement('button');view.type='button';view.className='sbs-button';view.textContent='View area';view.setAttribute('aria-label','Open 4× view centred on '+finding.area);view.disabled=!v;view.addEventListener('click',function(){openAiFocus(finding,view);});row.appendChild(view);qa.appendChild(row);});}
                var meta=q.export_metadata;if(meta){var details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent='File and colour metadata';body.textContent='Profile: '+meta.profile+'; PNG channels: '+(meta.png_color_type===6?'RGBA':meta.png_color_type||'not PNG')+'; depth: '+(meta.bit_depth||'?')+' bits; tagged PPI: '+(meta.ppi_x||'not set')+' × '+(meta.ppi_y||'not set')+'. '+(pixel.limitation||'');if(q.print_export&&q.print_export.artwork_pixels){body.textContent+=' Artwork footprint: '+(q.print_export.artwork_pixels[0]/300).toFixed(2)+' × '+(q.print_export.artwork_pixels[1]/300).toFixed(2)+' inches on the target canvas; no artwork upscaling.';}details.append(summary,body);qa.appendChild(details);}
                renderPrintProof(q,v?v.asset:current.original,!!v);
            }
            updateStepButtons();renderAiReview(v);renderHandoff(v);
            controls();
        }
        async function deleteRecords(uuids){
            uuids=Array.from(new Set(uuids||[]));if(!uuids.length||busy)return;
            var status=el('sbs-af-delete-status');
            operation(async function(){
                status.textContent='Checking exact record and file dependencies…';
                var plan=await api('/delete-plan',{uuids:uuids});
                if(!plan.safe){status.textContent='Nothing was deleted. Selected: '+plan.record_count+' record(s), '+plan.file_count+' associated file(s). Files pending, shared or not safely verified: '+(plan.blocked||[]).join('; ');return;}
                var titleList=(plan.records||[]).map(function(r){return r.title;}).join(', ');
                var prompt='Delete '+plan.record_count+' catalogue record(s) and '+plan.file_count+' associated artwork/file(s)?\n\n'+titleList+'\n\nThis cannot be undone. Projects, shared files and backups are checked separately and will be preserved.';
                if(!window.confirm(prompt)){status.textContent='Deletion cancelled. Nothing changed.';return;}
                var revisions={};(plan.records||[]).forEach(function(r){revisions[r.uuid]=r.revision;});
                var result=await api('/delete',{uuids:uuids,revisions:revisions,confirmed:true,record_count:plan.record_count,file_count:plan.file_count});
                uuids.forEach(function(uuid){catalogueSelected.delete(uuid);});if(current&&uuids.includes(current.uuid)){current=null;}
                await refresh();render();
                if(result.cleanup_pending&&result.cleanup_pending.length){status.textContent='Deleted '+result.deleted_records+' record(s) and '+result.deleted_files+' file(s). Cleanup still needs attention for '+result.cleanup_pending.length+' staged file(s): '+result.cleanup_pending.join(', ');}
                else{status.textContent='Deleted '+result.deleted_records+' catalogue record(s) and '+result.deleted_files+' associated file(s). Unselected records, shared assets, other projects and backups were preserved.';}
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
        async function refresh(){var data=await api('');records=data.records;var select=el('sbs-af-resume');select.replaceChildren();var empty=document.createElement('option');empty.value='';empty.textContent='Choose a workspace';select.appendChild(empty);records.forEach(function(r){var o=document.createElement('option');o.value=r.uuid;o.textContent=r.title+' — '+r.status;select.appendChild(o);});if(current){current=records.find(function(r){return r.uuid===current.uuid;})||current;select.value=current.uuid;}catalogue();}
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
        document.querySelectorAll('[data-af-method]').forEach(function(button){button.addEventListener('click',function(){selectedMethod=button.getAttribute('data-af-method');document.querySelectorAll('[data-af-method]').forEach(function(other){var active=other===button;other.setAttribute('aria-pressed',active?'true':'false');var card=other.closest('[data-af-stage-card]');if(card)card.classList.toggle('is-selected',active);});el('sbs-af-stage-help').textContent=current?'Selected: '+stageLabel(selectedMethod)+'. Next: press Queue selected stage, then Run queued stage. Watch the spinner; a tick confirms it finished. The original remains preserved.':'Selected: '+stageLabel(selectedMethod)+'. Choose or resume a workspace first, then queue selected stage and run it.';updateStepButtons();});});
        el('sbs-af-prepare').addEventListener('click',function(){var button=this;operation(function(){return action('prepare',{options:{method:selectedMethod,width:Number(el('sbs-af-width').value),height:Number(el('sbs-af-height').value),notes:el('sbs-af-notes').value,print_canvas:el('sbs-af-print-canvas').checked}});},'Queueing '+stageLabel(selectedMethod)+'…',button);});
        el('sbs-af-flat-sample').addEventListener('click',sampleFlatBackground);
        el('sbs-af-flat-preview').addEventListener('click',function(){var button=this;operation(previewFlatBackground,'Preparing a local pixel preview…',button);});
        el('sbs-af-flat-remove').addEventListener('click',removeFlatBackground);
        ['sbs-af-flat-colour','sbs-af-flat-colour-2','sbs-af-flat-use-second','sbs-af-flat-tolerance'].forEach(function(id){el(id).addEventListener('input',clearFlatPreview);el(id).addEventListener('change',clearFlatPreview);});
        el('sbs-af-flat-undo').addEventListener('click',function(){var button=this;operation(async function(){await action('undo_flat_background');el('sbs-af-flat-status').textContent='Source version restored. The removal copy remains in history and can be selected again.';message('Source restored. The processed copy remains available in version history.');},'Restoring the source version…',button,function(error){el('sbs-af-flat-status').textContent=error.message;el('sbs-af-flat-status').setAttribute('role','alert');});});
        el('sbs-af-refresh-qa').addEventListener('click',function(){var button=this;operation(function(){return action('refresh_qa');},'Refreshing local technical checks…',button);});
        el('sbs-af-ai-review-run').addEventListener('click',function(){var button=this,status=el('sbs-af-ai-status');status.dataset.state='';status.textContent='Comparing images… This may take a moment.';operation(function(){return action('ai_review');},'Comparing images with OpenAI…',button,function(error){status.dataset.state='error';status.textContent='Comparison not completed: '+error.message;});});
        ['run','cancel','approve'].forEach(function(type){el('sbs-af-'+type).addEventListener('click',function(){var button=this;operation(function(){return action(type,type==='approve'?{checks:checks()}:{});},type==='run'?'Running local stage. The original remains untouched…':'Processing '+type+'…',button);});});
        el('sbs-af-export').addEventListener('click',function(){var button=this;if(busy||exportPickerOpen||!current||!current.approval)return;choosePackageFolder().then(function(folder){if(folder===undefined)return;operation(function(){return action('export',{filename:el('sbs-af-package-name').value},folder);},folder?'Building ZIP and saving to the chosen folder…':'Building approved local package…',button);});});
        el('sbs-af-versions').addEventListener('change',function(){var uuid=this.value,button=this;if(uuid)operation(function(){return action('select',{version:uuid});},'Selecting version; new approval will be required…',button);});
        el('sbs-af-resume').addEventListener('change',function(){var uuid=this.value,button=this;if(!uuid||busy)return;operation(async function(){current=await api('/'+uuid);render();if(current.pending&&current.pending.replicate_prediction_id){message('Resumed the existing Replicate upscale. Checking its status; do not queue another request.');await pollReplicate();}else{message('Workspace resumed from private storage.');}},'Loading workspace…',button);});
        el('sbs-af-refresh').addEventListener('click',function(){var button=this;operation(async function(){await refresh();render();message('Local workspaces refreshed.');},'Refreshing workspaces…',button);});
        document.querySelectorAll('[data-af-check]').forEach(function(n){n.addEventListener('change',controls);});
        document.querySelectorAll('[data-af-check]').forEach(function(n){n.addEventListener('change',function(){renderHandoff(current&&current.versions.find(function(v){return v.uuid===current.current_version;}));});});
        el('sbs-af-copy-handoff').addEventListener('click',async function(){var field=el('sbs-af-handoff-text');try{await navigator.clipboard.writeText(field.value);message('ChatGPT handoff copied. Attach the Studio ZIP when you paste it into ChatGPT.');}catch(error){field.focus();field.select();message('Select and copy the highlighted handoff text, then attach the Studio ZIP in ChatGPT.',true);}});
        el('sbs-af-zoom').addEventListener('change',function(){var width=Number(this.value)*100+'%';['sbs-af-original','sbs-af-candidate'].forEach(function(id){el(id).style.width=width;});document.querySelectorAll('[data-af-proof-image]').forEach(function(img){img.style.width=width;});});
        ['sbs-af-width','sbs-af-height'].forEach(function(id){el(id).addEventListener('input',refreshPrintStatus);});
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
        window.addEventListener('sbs-finishing-open',function(event){if(!event.detail)return;current=event.detail;render();message('Freestyle image copied byte for byte. Source settings, instructions and history are saved. This image is not approved for printing.');});
        render();
        refresh().then(function(){render();message('Local workspaces loaded.');}).catch(function(error){render();message('Workspaces could not be loaded at startup: '+error.message,true);});
    }
    if(typeof window!=='undefined')window.SBSFinishing={matches:matches,canApprove:canApprove,classifyTransparency:classifyTransparency,init:init};
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
}());
