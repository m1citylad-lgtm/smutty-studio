(function () {
    'use strict';
    // Physical thresholds are advisory screening defaults, not printer guarantees.
    var PRINT_POLICY='print-impact-v1';
    function printMetrics(w,h,target){
        var width=target&&target.width!=null?Number(target.width):14,height=target&&target.height!=null?Number(target.height):16;
        if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>30||height>30)throw Error('Choose a print size between 0 and 30 inches.');
        var ppi=Math.max(w/width,h/height);
        return {width:width,height:height,ppi:ppi,mmPerPixel:25.4/ppi};
    }
    async function printAnalyze(data,w,h,target,progress){
        if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>32000000||data.length!==w*h*4)throw Error('The print check could not read these image dimensions.');
        var m=printMetrics(w,h,target),mm=m.mmPerPixel,mask=new Uint8Array(w*h),out=[],largestForeground=0,count={edge_fringe:0,stray_pixel:0,solid_opacity:0,alpha_edge:0};
        for(var y=0;y<h;y++){
            for(var x=0;x<w;x++){
                var p=y*w+x,i=p*4,a=data[i+3];
                if(a>=32)mask[p]|=1;
                if(a>=24&&a<240)mask[p]|=4;
                if(a<96||a>=245)continue;
                var n=0,rr=0,gg=0,bb=0;
                for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
                    var nx=x+dx,ny=y+dy;if((!dx&&!dy)||nx<0||ny<0||nx>=w||ny>=h)continue;
                    var ni=(ny*w+nx)*4;if(data[ni+3]>=245){n++;rr+=data[ni];gg+=data[ni+1];bb+=data[ni+2];}
                }
                if(n>=3&&Math.max(Math.abs(data[i]-rr/n),Math.abs(data[i+1]-gg/n),Math.abs(data[i+2]-bb/n))>=60)mask[p]|=2;
            }
            if(progress&&y%96===95)await progress('Checking image pixels',Math.round(y/h*60));
        }
        // A reusable ring queue bounds memory by the current flood-fill frontier.
        var queue=new Int32Array(65536),head=0,tail=0,used=0;
        function push(v){if(used===queue.length){var bigger=new Int32Array(queue.length*2);for(var q=0;q<used;q++)bigger[q]=queue[(head+q)%queue.length];queue=bigger;head=0;tail=used;}queue[tail]=v;tail=(tail+1)%queue.length;used++;}
        var types=[{bit:1,key:'stray_pixel'},{bit:2,key:'edge_fringe'},{bit:4,key:'solid_opacity'}];
        for(var k=0;k<types.length;k++){
            var type=types[k],visited=0;
            for(var start=0;start<mask.length;start++){
                if(!(mask[start]&type.bit))continue;
                var minX=w,minY=h,maxX=-1,maxY=-1,area=0,solid=0;mask[start]&=~type.bit;push(start);
                while(used){
                    var at=queue[head];head=(head+1)%queue.length;used--;var cy=Math.floor(at/w),cx=at-cy*w;
                    minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);area++;if(data[at*4+3]>=245)solid++;
                    for(var yy=Math.max(0,cy-1);yy<=Math.min(h-1,cy+1);yy++)for(var xx=Math.max(0,cx-1);xx<=Math.min(w-1,cx+1);xx++){
                        var next=yy*w+xx;if(mask[next]&type.bit){mask[next]&=~type.bit;push(next);}
                    }
                    if(progress&&++visited%131072===0)await progress('Grouping connected print areas',60+Math.round((k+start/mask.length)*13));
                }
                if(type.bit===1)largestForeground=Math.max(largestForeground,area);
                var pw=(maxX-minX+1)*mm,ph=(maxY-minY+1)*mm,ink=area*mm*mm,span=Math.max(pw,ph),short=Math.min(pw,ph),flag=false;
                if(type.bit===1)flag=area>=4&&solid/area>=.8&&ink<=25&&((short>=.8&&ink>=.3&&span<=12)||(span>=3&&span<=25&&ink>=.12&&area*mm/span>=.5))&&minX>0&&minY>0&&maxX<w-1&&maxY<h-1;
                if(type.bit===2)flag=area>=4&&((short>=.8&&ink>=.3)||(span>=3&&ink>=.12&&area*mm/span>=.5));
                // Narrow antialiasing is not opacity loss. Broad partial-alpha shapes
                // are ambiguous: smoke/fades/texture, or an unwanted transparent patch.
                if(type.bit===4)flag=area>=4&&short>=3&&ink>=1&&ink/span>=.4;
                if(flag){count[type.key]+=area;out.push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,categories:[type.key],counts:{[type.key]:area},widthMm:pw,heightMm:ph,areaMm2:ink,advisory:type.bit!==2});}
            }
        }
        out=out.filter(function(a){return a.categories[0]!=='stray_pixel'||a.counts.stray_pixel<largestForeground;});
        // Merge neighbouring findings of the same kind, rather than drawing a grid.
        var merged=[];
        // Bound work and reading load on heavily textured art. Keep every location
        // inside a labelled group; Next example visits them without hundreds of rows.
        if(out.length>200){types.forEach(function(type){var group=out.filter(function(a){return a.categories[0]===type.key;});if(!group.length)return;group.sort(function(a,b){return b.areaMm2-a.areaMm2;});var representative=Object.assign({},group[0]);representative.similar_count=group.length;representative.examples=group;representative.advisory=true;merged.push(representative);});out=[];}
        out.forEach(function(a){var again=true;while(again){again=false;for(var j=merged.length-1;j>=0;j--){var b=merged[j],gap=1.5/mm;if(a.categories[0]!==b.categories[0]||a.x>b.x+b.w+gap||b.x>a.x+a.w+gap||a.y>b.y+b.h+gap||b.y>a.y+a.h+gap)continue;var right=Math.max(a.x+a.w,b.x+b.w),bottom=Math.max(a.y+a.h,b.y+b.h);a.x=Math.min(a.x,b.x);a.y=Math.min(a.y,b.y);a.w=right-a.x;a.h=bottom-a.y;a.areaMm2+=b.areaMm2;a.counts[a.categories[0]]+=b.counts[b.categories[0]];merged.splice(j,1);again=true;}}merged.push(a);});
        merged.forEach(function(a){a.id='p'+types.find(function(t){return t.key===a.categories[0];}).bit+'-'+a.x+'-'+a.y+'-'+a.w+'-'+a.h;a.widthMm=a.w*mm;a.heightMm=a.h*mm;});
        merged.sort(function(a,b){return b.areaMm2-a.areaMm2;});
        if(progress)await progress('Print-area check complete',100);
        return {markers:merged,count:count,policy:PRINT_POLICY,target:{width:m.width,height:m.height},ppi:m.ppi};
    }
    if(typeof window!=='undefined')window.SBSPrintVisibility={analyze:printAnalyze,metrics:printMetrics,policy:PRINT_POLICY};
    function initializeCorrection(){
    var state=null, baseData=null, workingData=null, canvas=null, ctx=null, baseUrl='', correctedUrl='', baseVersion='original', sourceVersion='original', markers=[], selectedId=null, undoStack=[], completed={}, resolved={}, runningKinds=[], scale=1, fitScale=1, isCorrected=false, busy=false, originalWidth=0, originalHeight=0;
    var names={edge_fringe:'Possible visible colour fringe',stray_pixel:'Detached printed marks',solid_opacity:'Double-check: smoke, fades or texture',alpha_edge:'Hidden colour data'};
    var root=function(id){return document.getElementById(id);};
    var modal=root('sbs-af-correction-dialog'), viewport=root('sbs-af-correction-viewport'), stage=root('sbs-af-correction-stage'), image=root('sbs-af-correction-image'), markerLayer=root('sbs-af-correction-markers'), list=root('sbs-af-correction-list'), status=root('sbs-af-correction-status'), undoButton=root('sbs-af-correction-undo');
    if(!modal)return;
    if(!window.SBSFinishingCorrection){
        var launch=root('sbs-af-correction-open'),help=root('sbs-af-correction-help');
        if(launch){launch.disabled=true;launch.dataset.state='error';}
        if(help)help.textContent='Correction review did not start. Reload Finishing and try again.';
        return;
    }
    canvas=document.createElement('canvas');ctx=canvas.getContext('2d',{willReadFrequently:true});
    function setStatus(text,stateName){status.textContent=text;status.dataset.state=stateName||'info';}
    function setLaunchState(stateName,detail){
        var button=root('sbs-af-correction-open'),label=root('sbs-af-correction-open-label'),spinner=root('sbs-af-correction-open-spinner'),done=root('sbs-af-correction-open-done'),help=root('sbs-af-correction-help');
        if(!button)return;
        var active=window.SBSFinishingCorrection.getState();
        button.dataset.state=stateName;
        button.disabled=stateName==='busy'||!active||!!active.pending;
        if(stateName==='busy')button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
        if(label)label.textContent=stateName==='busy'?'Checking possible print issues…':stateName==='done'?'✓ Print check complete — open review':stateName==='error'?'Scan failed — retry':'Optional: check possible print issues';
        if(spinner)spinner.hidden=stateName!=='busy';
        if(done)done.hidden=stateName!=='done';
        if(help&&detail)help.textContent=detail;
    }
    function assetFor(s){var v=s.current_version&&s.versions.find(function(x){return x.uuid===s.current_version;});return v?v.asset:s.original;}
    function selectedVersion(s){return s.current_version||'original';}
    var scanTarget=null,scanPolicy=PRINT_POLICY;
    function currentTarget(){return {width:Number(root('sbs-af-width').value),height:Number(root('sbs-af-height').value)};}
    async function analyze(data,w,h){return printAnalyze(data,w,h,scanTarget||currentTarget(),async function(label,percent){setStatus('Scanning for possible print issues — '+label+' '+percent+'%','busy');await new Promise(function(resolve){requestAnimationFrame(resolve);});});}
    function markerText(m){var kind=m.categories[0],label=kind==='solid_opacity'?'Double-check: possible smoke, fade or texture':kind==='stray_pixel'?'Double-check: detached printed mark':'Possible visible colour fringe / long edge';var shown=m.focusExample||m;return (m.similar_count?m.similar_count+' similar areas — example '+((m.exampleIndex||0)+1)+': ':'')+label+' · about '+shown.widthMm.toFixed(1)+' × '+shown.heightMm.toFixed(1)+' mm on the T-shirt';}
    function chooseMarker(m){selectedId=m.id;if(m.examples)m.focusExample=m.examples[m.exampleIndex||0];var focus=m.focusExample||m;scale=fitScale*4;renderMarkers();display();viewport.scrollLeft=Math.max(0,(focus.x+focus.w/2)*scale-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,(focus.y+focus.h/2)*scale-viewport.clientHeight/2);setStatus(markerText(m)+'. Centred at 4×. This is a suggestion, not a confirmed defect.','review');}
    function statusFor(kind){if(kind!=='edge_fringe')return 'review';return 'suggested';}
    function isDone(marker,kind){return !!completed[marker.id+':'+kind];}
    function renderCategoryStatuses(){
        var box=root('sbs-af-correction-categories');if(!box)return;box.innerHTML='';
        Object.keys(names).filter(function(k){return k!=='alpha_edge';}).forEach(function(k){
            var relevant=markers.filter(function(m){return m.categories.indexOf(k)>=0;}),left=relevant.filter(function(m){return !isDone(m,k);});
            var stateName=!relevant.length?(resolved[k]?'done':'acceptable'):!left.length?'done':statusFor(k);
            var row=document.createElement('div');row.className='sbs-correction-category-status state-'+stateName;
            var label=document.createElement('span');label.textContent=names[k];
            var state=document.createElement('strong');state.textContent=busy&&runningKinds.indexOf(k)>=0?'⏳ Running':stateName==='done'?'✓ Reviewed':stateName==='acceptable'?'✓ Acceptable':stateName==='review'?'Double-check':'Review';
            row.appendChild(label);row.appendChild(state);box.appendChild(row);
        });
    }
    function renderMarkers(){
        markerLayer.innerHTML='';list.innerHTML='';
        var active=markers;
        active.forEach(function(m,n){
            var focus=m.focusExample||m;var allDone=m.categories.length>0&&m.categories.every(function(k){return isDone(m,k);});
            var needsReview=m.categories.some(function(k){return statusFor(k)==='review'&&!isDone(m,k);});
            var box=document.createElement('button');box.type='button';box.disabled=busy;box.className='sbs-correction-marker'+(m.id===selectedId?' is-selected':'')+(allDone?' state-done':needsReview?' state-review':' state-suggested');box.style.left=(focus.x/originalWidth*100)+'%';box.style.top=(focus.y/originalHeight*100)+'%';box.style.width=(focus.w/originalWidth*100)+'%';box.style.height=(focus.h/originalHeight*100)+'%';box.setAttribute('aria-label','Print issue '+(n+1)+': '+markerText(m));box.hidden=m.id!==selectedId;box.style.display=m.id===selectedId?'block':'none';box.title=box.getAttribute('aria-label');box.addEventListener('click',function(e){e.stopPropagation();chooseMarker(m);});markerLayer.appendChild(box);
            var item=document.createElement('button');item.type='button';item.disabled=busy;item.className='sbs-correction-list-item'+(m.id===selectedId?' is-selected':'')+(allDone?' state-done':'');item.textContent=(n+1)+'. '+(allDone?'Reviewed · ':needsReview?'Double-check · ':'Review · ')+markerText(m);item.addEventListener('click',function(){chooseMarker(m);});list.appendChild(item);
        });
        document.querySelectorAll('[data-sbs-correction-kind]').forEach(function(b){var k=b.getAttribute('data-sbs-correction-kind'),label=names[k];b.textContent=busy&&runningKinds.indexOf(k)>=0?'⏳ Running '+label:label;b.hidden=k!=='edge_fringe';b.disabled=busy||selectedId===null||!markers.some(function(m){return m.id===selectedId&&!m.examples&&m.categories.indexOf(k)>=0&&!isDone(m,k);});});
        var chosen=markers.find(function(m){return m.id===selectedId;}),nextExample=root('sbs-af-correction-next');if(nextExample){nextExample.hidden=!chosen||!chosen.examples;nextExample.disabled=busy;}
        var accept=root('sbs-af-correction-accept');if(accept)accept.textContent=chosen&&chosen.examples?'Keep selected group — intentional':'Keep selected area — intentional';if(accept)accept.disabled=busy||!selectedId||!markers.some(function(m){return m.id===selectedId&&m.categories.some(function(k){return !isDone(m,k);});});
        var runAll=root('sbs-af-correction-run-all');runAll.hidden=true;runAll.textContent=busy&&runningKinds.length?'⏳ Running corrections…':'Run all suggested';runAll.disabled=busy||!active.some(function(m){return m.categories.some(function(k){return !isDone(m,k);});});
        renderCategoryStatuses();
        undoButton.disabled=busy||!undoStack.length;
        if(!active.length){var p=document.createElement('p');p.textContent=scanComplete?'✓ No potentially visible print issues found by this check. Tiny isolated pixels are ignored. This does not guarantee a flawless print.':'No completed scan results yet.';list.appendChild(p);}
    }
    function display(){
        if(!baseData)return;
        var left=viewport.scrollLeft,top=viewport.scrollTop;
        var vw=viewport.clientWidth||640,vh=viewport.clientHeight||480;fitScale=Math.min(vw/originalWidth,vh/originalHeight,1);scale=Math.max(fitScale,scale||fitScale);
        stage.style.width=Math.max(1,Math.round(originalWidth*scale))+'px';stage.style.height=Math.max(1,Math.round(originalHeight*scale))+'px';
        image.src=isCorrected?canvas.toDataURL('image/png'):baseUrl;
        viewport.scrollLeft=left;viewport.scrollTop=top;
    }
    var scanOpener=null,scanComplete=false;
    async function open(){scanOpener=document.activeElement;scanComplete=false;
        state=window.SBSFinishingCorrection.getState();scanTarget=currentTarget();if(!state){setLaunchState('error','Choose or resume artwork first.');setStatus('Choose or resume artwork first.','error');return;}
        var asset=assetFor(state);if(!asset||!asset.url){setLaunchState('error','The selected image is unavailable. Refresh the workspace.');setStatus('The selected image is unavailable. Refresh the workspace.','error');return;}
        busy=true;markers=[];renderMarkers();root('sbs-af-correction-close').disabled=true;modal.setAttribute('aria-busy','true');setLaunchState('busy','Scanning the entire selected image…');
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
            completed={};resolved={};var result=await analyze(workingData,originalWidth,originalHeight);markers=result.markers;var prior=state.flow&&state.flow.pixels;if(prior&&prior.sha256===asset.sha256&&prior.policy===PRINT_POLICY&&prior.target&&prior.target.width===scanTarget.width&&prior.target.height===scanTarget.height){markers.forEach(function(m){if(prior.reviewed||(prior.accepted_ids||[]).includes(m.id))m.categories.forEach(function(k){completed[m.id+':'+k]=true;});});}
            if(latest&&latest.options&&latest.options.method==='pixel_correction'){(latest.options.categories||[]).forEach(function(k){if(!markers.some(function(m){return m.categories.indexOf(k)>=0;}))resolved[k]=true;});}
            renderMarkers();display();scanComplete=true;
            var total=Object.values(result.count).reduce(function(a,b){return a+b;},0);
            setStatus(markers.length?'✓ Scan complete — '+markers.length+' possible print area(s). Tiny isolated pixels are ignored. Select an item for a centred 4× view.':'✓ Scan complete — no potentially visible print issues found. Tiny isolated pixels are ignored; this is not a print guarantee.',markers.length?'review':'ok');
            setLaunchState('done',markers.length?'✓ Print check complete: '+markers.length+' possible print area(s).':'✓ Print check complete: no potentially visible issues found.');
        }catch(error){setStatus(error.message,'error');setLaunchState('error','Scan failed: '+error.message+' You can retry the scan.');}
        busy=false;modal.removeAttribute('aria-busy');root('sbs-af-correction-close').disabled=false;renderMarkers();undoButton.disabled=true;root('sbs-af-correction-close').focus();
    }
    function close(){if(busy){setStatus('Wait for the current scan or save to finish.','busy');return;}modal.hidden=true;document.body.classList.remove('sbs-correction-open');if(scanComplete&&state){var a=assetFor(state),alpha={clear:0,partial:0,opaque:0};for(var i=3;i<workingData.length;i+=4){if(workingData[i]===0)alpha.clear++;else if(workingData[i]===255)alpha.opaque++;else alpha.partial++;}document.dispatchEvent(new CustomEvent('sbs:pixel-scan',{detail:{workspace:state.uuid,sha256:a.sha256,alpha:alpha,policy:PRINT_POLICY,target:scanTarget,accepted_ids:markers.filter(function(m){return m.categories.every(function(k){return isDone(m,k);});}).map(function(m){return m.id;}),remaining:markers.filter(function(m){return m.categories.some(function(k){return !isDone(m,k);});}).length}}));}if(scanOpener&&scanOpener.focus)scanOpener.focus();else root('sbs-af-correction-open').focus();}
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
        var categories=kind==='all'?Object.keys(names).filter(function(k){return k!=='solid_opacity'&&k!=='alpha_edge'&&markers.some(function(m){return m.categories.indexOf(k)>=0&&!isDone(m,k);})}):[kind];runningKinds=categories;renderMarkers();
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
    root('sbs-af-correction-next').addEventListener('click',function(){var m=markers.find(function(m){return m.id===selectedId;});if(m&&m.examples){m.exampleIndex=((m.exampleIndex||0)+1)%m.examples.length;chooseMarker(m);}});root('sbs-af-correction-accept').addEventListener('click',function(){var m=markers.find(function(m){return m.id===selectedId;});if(m){m.categories.forEach(function(k){completed[m.id+':'+k]=true;});renderMarkers();setStatus('✓ Area accepted as intentional. No pixels changed. Close to save your review.','ok');}});root('sbs-af-correction-reset').addEventListener('click',function(){scale=fitScale;display();viewport.scrollLeft=0;viewport.scrollTop=0;});window.SBSFinishingPixels={open:open};root('sbs-af-correction-open').addEventListener('click',open);root('sbs-af-correction-close').addEventListener('click',close);root('sbs-af-correction-undo').addEventListener('click',undo);root('sbs-af-correction-run-all').addEventListener('click',function(){run('all',true);});
    document.querySelectorAll('[data-sbs-correction-kind]').forEach(function(b){b.addEventListener('click',function(){run(this.getAttribute('data-sbs-correction-kind'),false);});});
    stage.addEventListener('click',function(e){if(gestureMoved){gestureMoved=false;return;}if(e.target===stage||e.target===image||e.target===markerLayer)toggle();});
    window.addEventListener('resize',function(){if(!modal.hidden&&baseData){scale=0;display();}});
    var pointers=new Map(),pinchStart=0,scaleStart=1,lastCenter=null,gestureMoved=false;
    viewport.addEventListener('pointerdown',function(e){e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(viewport.setPointerCapture)try{viewport.setPointerCapture(e.pointerId);}catch(ignore){}if(pointers.size===2){var p=Array.from(pointers.values());pinchStart=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);scaleStart=scale;lastCenter={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};gestureMoved=true;}});
    viewport.addEventListener('pointermove',function(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinchStart>0){var p=Array.from(pointers.values()),dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),center={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},ratio=Math.max(1,Math.min(8,scaleStart*dist/pinchStart/fitScale));scale=fitScale*ratio;display();if(lastCenter){viewport.scrollLeft-=center.x-lastCenter.x;viewport.scrollTop-=center.y-lastCenter.y;}lastCenter=center;}});
    ['pointerup','pointercancel'].forEach(function(ev){viewport.addEventListener(ev,function(e){pointers.delete(e.pointerId);if(pointers.size<2){pinchStart=0;lastCenter=null;setTimeout(function(){gestureMoved=false;},350);}});});
    window.SBSFinishingCorrection.onState=function(next){
        var changed=!next||!state||next.uuid!==state.uuid||next.current_version!==state.current_version;
        if(changed)setLaunchState('idle',!next?'Upload artwork or resume a saved workspace to enable the full-image scan.':next.pending?'A stage is queued or running. Finish or cancel it before scanning.':'Artwork is ready to scan.');
        if(!modal.hidden&&next&&state&&next.uuid===state.uuid){state=next;}
        else if(next&&state&&next.uuid!==state.uuid&&!modal.hidden){close();state=next;}
        else{state=next||null;}
    };

    }
    if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initializeCorrection,{once:true});
    else initializeCorrection();}
}());

