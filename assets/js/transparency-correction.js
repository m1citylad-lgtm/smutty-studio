(function () {
    'use strict';
    var state=null, baseData=null, workingData=null, canvas=null, ctx=null, baseUrl='', correctedUrl='', baseVersion='original', sourceVersion='original', markers=[], selectedId=null, undoStack=[], completed={}, resolved={}, runningKinds=[], scale=1, fitScale=1, isCorrected=false, busy=false, originalWidth=0, originalHeight=0;
    var names={edge_fringe:'Edge-colour fringe',stray_pixel:'Stray pixels',solid_opacity:'Possible opacity loss',alpha_edge:'Transparency edge'};
    var root=function(id){return document.getElementById(id);};
    var modal=root('sbs-af-correction-dialog'), viewport=root('sbs-af-correction-viewport'), stage=root('sbs-af-correction-stage'), image=root('sbs-af-correction-image'), markerLayer=root('sbs-af-correction-markers'), list=root('sbs-af-correction-list'), status=root('sbs-af-correction-status'), undoButton=root('sbs-af-correction-undo');
    if(!modal||!window.SBSFinishingCorrection)return;
    canvas=document.createElement('canvas');ctx=canvas.getContext('2d',{willReadFrequently:true});
    function setStatus(text,stateName){status.textContent=text;status.dataset.state=stateName||'info';}
    function assetFor(s){var v=s.current_version&&s.versions.find(function(x){return x.uuid===s.current_version;});return v?v.asset:s.original;}
    function selectedVersion(s){return s.current_version||'original';}
    function tileSize(w,h){return Math.max(64,Math.ceil(Math.sqrt(w*h/90)));}
    async function analyze(data,w,h){
        var ts=tileSize(w,h),cols=Math.ceil(w/ts),rows=Math.ceil(h/ts),grid=new Array(cols*rows),count={edge_fringe:0,stray_pixel:0,solid_opacity:0,alpha_edge:0};
        for(var g=0;g<grid.length;g++)grid[g]={edge_fringe:0,stray_pixel:0,solid_opacity:0,alpha_edge:0};
        for(var y=0;y<h;y++){
            for(var x=0;x<w;x++){
                var i=(y*w+x)*4,a=data[i+3],opaque=0,clear=0,rr=0,gg=0,bb=0,n=0;
                for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;var nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;var ni=(ny*w+nx)*4,na=data[ni+3];if(na>=245){opaque++;rr+=data[ni];gg+=data[ni+1];bb+=data[ni+2];n++;}else if(na<=8)clear++;}
                var c=grid[Math.floor(y/ts)*cols+Math.floor(x/ts)];
                if(a>=128&&a<245&&opaque>=5&&n){var mr=rr/n,mg=gg/n,mb=bb/n;if(Math.max(Math.abs(data[i]-mr),Math.abs(data[i+1]-mg),Math.abs(data[i+2]-mb))>42){c.edge_fringe++;count.edge_fringe++;}}
                if(a>=220&&clear>=7){c.stray_pixel++;count.stray_pixel++;}
                if(a>=72&&a<245&&opaque>=6&&clear===0){c.solid_opacity++;count.solid_opacity++;}
                if(a===0&&opaque>=5&&n&&Math.max(Math.abs(data[i]-rr/n),Math.abs(data[i+1]-gg/n),Math.abs(data[i+2]-bb/n))>42){c.alpha_edge++;count.alpha_edge++;}
            }
            if(y%96===95){setStatus('Scanning whole image… '+Math.round(y/h*100)+'%', 'busy');await new Promise(function(resolve){requestAnimationFrame(resolve);});}
        }
        var out=[];
        grid.forEach(function(cell,index){var cats=Object.keys(names).filter(function(k){var threshold=(k==='stray_pixel'||k==='alpha_edge')?1:Math.max(2,Math.floor(ts*ts*.000008));return cell[k]>=threshold;});if(!cats.length)return;var tx=index%cols,ty=Math.floor(index/cols),x=tx*ts,y=ty*ts;out.push({id:'m'+index,x:x,y:y,w:Math.min(ts,w-x),h:Math.min(ts,h-y),categories:cats,counts:cats.reduce(function(o,k){o[k]=cell[k];return o;},{})});});
        return {markers:out,count:count};
    }
    function statusFor(kind){if(kind==='solid_opacity'||kind==='alpha_edge')return 'review';return 'suggested';}
    function isDone(marker,kind){return !!completed[marker.id+':'+kind];}
    function renderCategoryStatuses(){
        var box=root('sbs-af-correction-categories');if(!box)return;box.innerHTML='';
        Object.keys(names).forEach(function(k){
            var relevant=markers.filter(function(m){return m.categories.indexOf(k)>=0;}),left=relevant.filter(function(m){return !isDone(m,k);});
            var stateName=!relevant.length?(resolved[k]?'done':'acceptable'):!left.length?'done':statusFor(k);
            var row=document.createElement('div');row.className='sbs-correction-category-status state-'+stateName;
            var label=document.createElement('span');label.textContent=names[k];
            var state=document.createElement('strong');state.textContent=busy&&runningKinds.indexOf(k)>=0?'⏳ Running':stateName==='done'?'✓ Corrected':stateName==='acceptable'?'✓ Acceptable':stateName==='review'?'Review':'Run';
            row.appendChild(label);row.appendChild(state);box.appendChild(row);
        });
    }
    function renderMarkers(){
        markerLayer.innerHTML='';list.innerHTML='';
        var active=markers;
        active.forEach(function(m,n){
            var allDone=m.categories.length>0&&m.categories.every(function(k){return isDone(m,k);});
            var needsReview=m.categories.some(function(k){return statusFor(k)==='review'&&!isDone(m,k);});
            var box=document.createElement('button');box.type='button';box.className='sbs-correction-marker'+(m.id===selectedId?' is-selected':'')+(allDone?' state-done':needsReview?' state-review':' state-suggested');box.style.left=(m.x/originalWidth*100)+'%';box.style.top=(m.y/originalHeight*100)+'%';box.style.width=(m.w/originalWidth*100)+'%';box.style.height=(m.h/originalHeight*100)+'%';box.setAttribute('aria-label','Issue marker '+(n+1)+': '+m.categories.map(function(k){return names[k];}).join(', '));box.title=box.getAttribute('aria-label');box.addEventListener('click',function(e){e.stopPropagation();selectedId=m.id;renderMarkers();setStatus('Marker '+(n+1)+' selected. Choose a correction button or Run all.', 'info');});markerLayer.appendChild(box);
            var item=document.createElement('button');item.type='button';item.className='sbs-correction-list-item'+(m.id===selectedId?' is-selected':'')+(allDone?' state-done':'');item.textContent=(n+1)+'. '+(allDone?'Corrected · ':needsReview?'Review · ':'Run · ')+m.categories.map(function(k){return names[k]+(isDone(m,k)?' ✓':'');}).join(' · ');item.addEventListener('click',function(){selectedId=m.id;renderMarkers();setStatus('Marker '+(n+1)+' selected.', 'info');});list.appendChild(item);
        });
        document.querySelectorAll('[data-sbs-correction-kind]').forEach(function(b){var k=b.getAttribute('data-sbs-correction-kind'),label=names[k];b.textContent=busy&&runningKinds.indexOf(k)>=0?'⏳ Running '+label:label;b.disabled=busy||selectedId===null||!markers.some(function(m){return m.id===selectedId&&m.categories.indexOf(k)>=0&&!isDone(m,k);});});
        var runAll=root('sbs-af-correction-run-all');runAll.textContent=busy&&runningKinds.length?'⏳ Running corrections…':'Run all suggested';runAll.disabled=busy||!active.some(function(m){return m.categories.some(function(k){return !isDone(m,k);});});
        renderCategoryStatuses();
        undoButton.disabled=busy||!undoStack.length;
        if(!active.length){var p=document.createElement('p');p.textContent='No current issue markers.';list.appendChild(p);}
    }
    function display(){
        if(!baseData)return;
        var left=viewport.scrollLeft,top=viewport.scrollTop;
        var vw=viewport.clientWidth||640,vh=viewport.clientHeight||480;fitScale=Math.min(vw/originalWidth,vh/originalHeight,1);scale=Math.max(fitScale,scale||fitScale);
        stage.style.width=Math.max(1,Math.round(originalWidth*scale))+'px';stage.style.height=Math.max(1,Math.round(originalHeight*scale))+'px';
        image.src=isCorrected?canvas.toDataURL('image/png'):baseUrl;
        viewport.scrollLeft=left;viewport.scrollTop=top;
    }
    async function open(){
        state=window.SBSFinishingCorrection.getState();if(!state){setStatus('Choose or resume artwork first.','error');return;}
        var asset=assetFor(state);if(!asset||!asset.url){setStatus('The selected image is unavailable. Refresh the workspace.','error');return;}
        setStatus('Loading image and scanning for possible corrections…','busy');modal.hidden=false;document.body.classList.add('sbs-correction-open');undoStack=[];selectedId=null;isCorrected=false;scale=0;
        try{
            var latest=state.versions.find(function(v){return v.uuid===state.current_version;}),parentVersion=latest&&latest.options&&latest.options.method==='pixel_correction'?(latest.source_version_uuid||'original'):selectedVersion(state);
            var parent=parentVersion==='original'?state.original:(state.versions.find(function(v){return v.uuid===parentVersion;})||{}).asset;
            var parentImg=new Image();parentImg.src=(parent||asset).url;await parentImg.decode();originalWidth=parentImg.naturalWidth;originalHeight=parentImg.naturalHeight;
            if(!originalWidth||originalWidth*originalHeight>32000000)throw new Error('Image correction supports images up to 32 million pixels.');
            canvas.width=originalWidth;canvas.height=originalHeight;ctx.clearRect(0,0,originalWidth,originalHeight);ctx.drawImage(parentImg,0,0);baseData=ctx.getImageData(0,0,originalWidth,originalHeight);baseVersion=parentVersion;baseUrl=(parent||asset).url;
            if(latest&&latest.options&&latest.options.method==='pixel_correction'){
                var currentImg=new Image();currentImg.src=asset.url;await currentImg.decode();ctx.clearRect(0,0,originalWidth,originalHeight);ctx.drawImage(currentImg,0,0);workingData=ctx.getImageData(0,0,originalWidth,originalHeight).data;sourceVersion=latest.uuid;undoStack=[{data:new Uint8ClampedArray(baseData.data),sourceVersion:baseVersion}];isCorrected=true;
            }else{workingData=new Uint8ClampedArray(baseData.data);sourceVersion=baseVersion;isCorrected=false;}
            completed={};resolved={};var result=await analyze(workingData,originalWidth,originalHeight);markers=result.markers;
            if(latest&&latest.options&&latest.options.method==='pixel_correction'){(latest.options.categories||[]).forEach(function(k){if(!markers.some(function(m){return m.categories.indexOf(k)>=0;}))resolved[k]=true;});}
            renderMarkers();display();
            var total=Object.values(result.count).reduce(function(a,b){return a+b;},0);
            setStatus(markers.length?'Scan found '+markers.length+' marked area(s). Findings are suggestions; inspect before running.':'Scan found no correction areas. Current image appears acceptable for these checks.',markers.length?'review':'ok');
        }catch(error){setStatus(error.message,'error');}
        undoButton.disabled=true;root('sbs-af-correction-close').focus();
    }
    function close(){modal.hidden=true;document.body.classList.remove('sbs-correction-open');root('sbs-af-correction-open').focus();}
    function activeBoxes(kind,all){if(all)return markers.filter(function(m){return m.categories.indexOf(kind)>=0&&!isDone(m,kind);}).map(function(m){return m;});var m=markers.find(function(x){return x.id===selectedId;});return m&&m.categories.indexOf(kind)>=0&&!isDone(m,kind)?[m]:[];}
    async function correctKind(data,kind,boxes){
        var out=new Uint8ClampedArray(data),changed=0,w=originalWidth,h=originalHeight;
        for(var b=0;b<boxes.length;b++){
            var box=boxes[b],x0=Math.max(0,Math.floor(box.x)),y0=Math.max(0,Math.floor(box.y)),x1=Math.min(w,Math.ceil(box.x+box.w)),y1=Math.min(h,Math.ceil(box.y+box.h));
            for(var y=y0;y<y1;y++){
                for(var x=x0;x<x1;x++){
                    var i=(y*w+x)*4,a=data[i+3],vals=[];
                    if(kind==='stray_pixel'&&a>=220){
                        var support=0;for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;var nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<w&&ny<h&&data[(ny*w+nx)*4+3]>8)support++;}
                        if(support<=1){out[i+3]=0;changed++;}
                    }else if(kind==='solid_opacity'&&a>=72&&a<245){
                        var opaque=0,clear=0;for(var dy2=-1;dy2<=1;dy2++)for(var dx2=-1;dx2<=1;dx2++){if(!dx2&&!dy2)continue;var nx2=x+dx2,ny2=y+dy2;if(nx2>=0&&ny2>=0&&nx2<w&&ny2<h){var aa=data[(ny2*w+nx2)*4+3];if(aa>=245)opaque++;else if(aa<=8)clear++;}}
                        if(opaque>=6&&clear===0){out[i+3]=255;changed++;}
                    }else if(kind==='edge_fringe'&&a>=128&&a<245){
                        for(var dy3=-2;dy3<=2;dy3++)for(var dx3=-2;dx3<=2;dx3++){var nx3=x+dx3,ny3=y+dy3;if((dx3||dy3)&&nx3>=0&&ny3>=0&&nx3<w&&ny3<h){var ni=(ny3*w+nx3)*4;if(data[ni+3]===255)vals.push([data[ni],data[ni+1],data[ni+2]]);}}
                        if(vals.length>=5){var sums=[0,0,0];vals.forEach(function(v){for(var c=0;c<3;c++)sums[c]+=v[c];});for(var c2=0;c2<3;c2++)sums[c2]/=vals.length;if(Math.max(Math.abs(data[i]-sums[0]),Math.abs(data[i+1]-sums[1]),Math.abs(data[i+2]-sums[2]))>42){for(var c3=0;c3<3;c3++)out[i+c3]=sums[c3];changed++;}}
                    }else if(kind==='alpha_edge'&&a===0){
                        for(var dy4=-1;dy4<=1;dy4++)for(var dx4=-1;dx4<=1;dx4++){var nx4=x+dx4,ny4=y+dy4;if((dx4||dy4)&&nx4>=0&&ny4>=0&&nx4<w&&ny4<h){var ni2=(ny4*w+nx4)*4;if(data[ni2+3]>=245)vals.push([data[ni2],data[ni2+1],data[ni2+2]]);}}
                        if(vals.length>=5){var sums2=[0,0,0];vals.forEach(function(v2){for(var c4=0;c4<3;c4++)sums2[c4]+=v2[c4];});for(var c5=0;c5<3;c5++){sums2[c5]/=vals.length;if(Math.abs(data[i+c5]-sums2[c5])>42){out[i+c5]=sums2[c5];changed++;}}}
                    }
                }
                if(y%128===127){setStatus('Applying '+names[kind]+'… '+Math.round((b+(y-y0)/(y1-y0))/boxes.length*100)+'%','busy');await new Promise(function(resolve){requestAnimationFrame(resolve);});}
            }
        }
        return {data:out,changed:changed};
    }
    async function run(kind,all){
        if(busy||!baseData)return;if(kind!=='all'&&selectedId===null){setStatus('Select a marker first, then choose its correction.','review');return;}busy=true;
        var categories=kind==='all'?Object.keys(names).filter(function(k){return markers.some(function(m){return m.categories.indexOf(k)>=0&&!isDone(m,k);})}):[kind];runningKinds=categories;renderMarkers();
        var beforeData=new Uint8ClampedArray(workingData),beforeCorrected=isCorrected,oldMarkers=markers.slice(),selectedMarkerId=selectedId;
        var next=new Uint8ClampedArray(workingData),total=0;
        try{
            for(var c=0;c<categories.length;c++){
                var k=categories[c],boxes=activeBoxes(k,kind==='all');if(!boxes.length)continue;
                var result=await correctKind(next,k,boxes);next=result.data;total+=result.changed;
            }
            if(!total){categories.forEach(function(k){categoryReview(k,kind);});setStatus('No pixels met the correction rule in this area. Nothing was changed; keep it under review.','review');return;}
            undoStack.push({data:new Uint8ClampedArray(workingData),sourceVersion:sourceVersion});
            canvas.width=originalWidth;canvas.height=originalHeight;ctx.putImageData(new ImageData(next,originalWidth,originalHeight),0,0);workingData=next;isCorrected=true;display();
            var blob=await new Promise(function(resolve,reject){canvas.toBlob(function(b){b?resolve(b):reject(new Error('Could not prepare the corrected PNG.'));},'image/png');});
            setStatus('Saving corrected copy as a new version…','busy');
            var saved=await window.SBSFinishingCorrection.save(blob,categories,sourceVersion);
            state=saved;sourceVersion=selectedVersion(saved);
            var verification,fresh=[],merged={};
            try{verification=await analyze(workingData,originalWidth,originalHeight);fresh=verification.markers;}catch(recheckError){setStatus('Correction saved as a new version, but the second scan could not finish: '+recheckError.message,'review');renderMarkers();return;}
            fresh.forEach(function(m){merged[m.id]=m;});
            oldMarkers.forEach(function(m){
                m.categories.forEach(function(k){
                    var applied=categories.indexOf(k)>=0&&(kind==='all'||m.id===selectedMarkerId);
                    var remains=fresh.some(function(n){return n.id===m.id&&n.categories.indexOf(k)>=0;});
                    if(applied&&!remains)completed[m.id+':'+k]=true;
                    if(applied&&remains)completed[m.id+':'+k]=false;
                    if(!merged[m.id])merged[m.id]={id:m.id,x:m.x,y:m.y,w:m.w,h:m.h,categories:[],counts:{}};
                    var target=merged[m.id];if(target.categories.indexOf(k)<0)target.categories.push(k);if(m.counts&&m.counts[k])target.counts[k]=m.counts[k];
                });
            });
            markers=Object.keys(merged).map(function(id){return merged[id];});
            categories.forEach(function(k){if(!markers.some(function(m){return m.categories.indexOf(k)>=0&&!isDone(m,k);}))resolved[k]=true;else resolved[k]=false;});
            setStatus(total.toLocaleString()+' pixel adjustment(s) saved as a new version and rescanned. Original preserved.','ok');renderMarkers();
        }catch(error){if(undoStack.length)undoStack.pop();workingData=beforeData;isCorrected=beforeCorrected;ctx.putImageData(new ImageData(workingData,originalWidth,originalHeight),0,0);display();setStatus(error.message,'error');}
        finally{busy=false;runningKinds=[];renderMarkers();}
    }
    function isDoneSet(marker,kind){completed[marker.id+':'+kind]=true;}
    function categoryReview(kind,mode){if(mode==='all'){markers.forEach(function(m){if(m.categories.indexOf(kind)>=0)completed[m.id+':'+kind]=false;});}else if(selectedId)completed[selectedId+':'+kind]=false;}
    async function undo(){
        if(busy||!undoStack.length)return;busy=true;runningKinds=[];renderMarkers();
        try{var previous=undoStack[undoStack.length-1];await window.SBSFinishingCorrection.undo(sourceVersion);undoStack.pop();sourceVersion=previous.sourceVersion;workingData=previous.data;ctx.putImageData(new ImageData(workingData,originalWidth,originalHeight),0,0);isCorrected=undoStack.length>0;display();state=window.SBSFinishingCorrection.getState();setStatus('Last correction undone. The previous version is restored; the saved copy remains in history.','info');var result=await analyze(workingData,originalWidth,originalHeight);markers=result.markers;completed={};resolved={};selectedId=null;renderMarkers();}
        catch(error){setStatus('Undo failed: '+error.message,'error');}
        finally{busy=false;renderMarkers();}
    }
    function toggle(){isCorrected=!isCorrected;display();setStatus(isCorrected?'Showing corrected image. Tap outside the markers to compare with the original.':'Showing original image. Tap outside the markers to return to the corrected image.','info');}
    root('sbs-af-correction-open').addEventListener('click',open);root('sbs-af-correction-close').addEventListener('click',close);root('sbs-af-correction-undo').addEventListener('click',undo);root('sbs-af-correction-run-all').addEventListener('click',function(){run('all',true);});
    document.querySelectorAll('[data-sbs-correction-kind]').forEach(function(b){b.addEventListener('click',function(){run(this.getAttribute('data-sbs-correction-kind'),false);});});
    stage.addEventListener('click',function(e){if(gestureMoved){gestureMoved=false;return;}if(e.target===stage||e.target===image||e.target===markerLayer)toggle();});
    window.addEventListener('resize',function(){if(!modal.hidden&&baseData){scale=0;display();}});
    var pointers=new Map(),pinchStart=0,scaleStart=1,lastCenter=null,gestureMoved=false;
    viewport.addEventListener('pointerdown',function(e){e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(viewport.setPointerCapture)try{viewport.setPointerCapture(e.pointerId);}catch(ignore){}if(pointers.size===2){var p=Array.from(pointers.values());pinchStart=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);scaleStart=scale;lastCenter={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};gestureMoved=true;}});
    viewport.addEventListener('pointermove',function(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinchStart>0){var p=Array.from(pointers.values()),dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),center={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},ratio=Math.max(1,Math.min(8,scaleStart*dist/pinchStart/fitScale));scale=fitScale*ratio;display();if(lastCenter){viewport.scrollLeft-=center.x-lastCenter.x;viewport.scrollTop-=center.y-lastCenter.y;}lastCenter=center;}});
    ['pointerup','pointercancel'].forEach(function(ev){viewport.addEventListener(ev,function(e){pointers.delete(e.pointerId);if(pointers.size<2){pinchStart=0;lastCenter=null;setTimeout(function(){gestureMoved=false;},350);}});});
    window.SBSFinishingCorrection.onState=function(next){if(!modal.hidden&&next&&state&&next.uuid===state.uuid){state=next;}};
}());
