(function(){'use strict';
function pixels(data,w,h,s){
 const tone=s.tone/100,fade=s.fade/100,halftone=s.halftone/100,distress=s.distress/100,step=Math.max(4,Math.round(w/350));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!data[i+3])continue;
  let r=data[i],g=data[i+1],b=data[i+2],l=.2126*r+.7152*g+.0722*b;
  r=r*(1-.18*tone)+l*.18*tone+4*tone;g=g*(1-.18*tone)+l*.18*tone;b=b*(1-.18*tone)+l*.18*tone-4*tone;
  const dx=(x%step)-step/2,dy=(y%step)-step/2,dot=dx*dx+dy*dy<(step*.23)*(step*.23)?1:0,shadow=Math.max(0,1-l/255),wear=((Math.imul(x+1,73856093)^Math.imul(y+1,19349663))>>>0)%101<6?1:0;
  const dark=1-dot*shadow*.18*halftone,light=wear*.10*distress;
  for(const [k,v] of [[0,r],[1,g],[2,b]]){const f=(v-128)*(1-.18*fade)+128+5*fade;data[i+k]=Math.round(Math.max(0,Math.min(255,f*dark+(255-f)*light)));}
 }return data;
}
function init(){
 const $=n=>document.getElementById('sbs-final-'+n),bridge=window.SBSFinishingBridge,root=$('finish');if(!root||!bridge)return;
 const fields=['tone','fade','halftone','distress'];let busy=false,epoch=0,sourceKey='',preview=null,previewSettings=null,previewSource='',assessmentKey='';
 const apiBase=document.getElementById('sbs-app').getAttribute('data-rest').replace(/\/$/,''),app=document.getElementById('sbs-app');
 function state(){return bridge.getState();}function final(){return state()&&state().final_print;}function settings(){return Object.fromEntries(fields.map(k=>[k,Number($('effect-'+k).value)]).concat([['preset',$('preset').value]]));}
 function note(s){$('treatment-message').textContent=s;}
 function invalidate(){epoch++;previewSettings=null;$('save-preview').disabled=true;fields.forEach(k=>$('value-'+k).textContent=$('effect-'+k).value+'%');note('Settings changed. Preview treatment to see and save these settings.');}
 fields.forEach(k=>$('effect-'+k).oninput=invalidate);$('preset').addEventListener('change',()=>{assessmentKey='';$('assessment').textContent='Press Assess artwork for recommendations for this treatment.';invalidate();sync();});
 function ready(){const f=final(),r=state(),v=r&&(r.versions||[]).find(v=>v.uuid===r.current_version);return f&&f.clean.sha256===(v?v.asset:r.original).sha256&&Array.isArray(f.target)&&Number(f.target[0])===Number(document.getElementById('sbs-af-width').value)&&Number(f.target[1])===Number(document.getElementById('sbs-af-height').value);}
 function sync(){const f=final(),key=ready()?state().uuid+':'+f.clean.sha256:'';if(key!==sourceKey){sourceKey=key;epoch++;preview=null;previewSettings=null;previewSource='';assessmentKey='';$('save-preview').disabled=true;$('assessment').textContent='Choose a treatment and press Assess artwork.';fields.forEach(k=>{$('effect-'+k).value=0;$('value-'+k).textContent='0%';});}
  const saved=ready()&&f.finished;const download=$('treatment-download');download.hidden=busy||!!previewSettings||!saved;if(previewSettings)$('treatment-download-detail').textContent='This preview is not saved. Save as new candidate to download this result.';else if(saved){download.href=saved.asset.url;download.download=saved.asset.filename;$('treatment-download-detail').textContent='Saved candidate: '+saved.asset.filename+' — '+(saved.approval?'approved':'review before printing');}
  $('assess').disabled=busy||bridge.isBusy()||!ready()||$('preset').value==='original';$('apply').disabled=busy||bridge.isBusy()||!ready();
  const a=f&&f.assessment;if(ready()&&a&&a.preset===$('preset').value&&a.key!==assessmentKey){assessmentKey=a.key;$('assessment').textContent=(a.status==='unchanged'?'No changes recommended':a.status==='unable'?'Unable to assess':'Recommended adjustments')+'\n'+a.reason;fields.forEach(k=>{$('effect-'+k).value=a.settings[k];$('value-'+k).textContent=a.settings[k]+'%';});invalidate();note('Assessment complete. Preview the recommended settings, adjust them, or keep unchanged.');}
 }
 $('assess').onclick=async()=>{if(!ready()||busy)return;busy=true;sync();$('assessment').textContent='Assessing artwork…';note('Assessing the existing artwork. AI analysis may use credits.');try{await bridge.perform('final_assess',{preset:$('preset').value,width:Number(document.getElementById('sbs-af-width').value),height:Number(document.getElementById('sbs-af-height').value)},'Assessing treatment — no image generation…',$('assess'));}catch(e){$('assessment').textContent='Assessment unavailable\n'+e.message;note('Assessment did not complete. '+e.message);}finally{busy=false;sync();}};
 function load(url){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('The source image could not be loaded.'));im.src=url;});}
 $('apply').textContent='Preview treatment';$('apply').onclick=async()=>{
  if(!ready()||busy)return;const f=final(),key=sourceKey,s=settings(),ticket=++epoch;busy=true;sync();note('Preparing a pixel preview from the unchanged source…');
  try{const im=await load(f.clean.url);if(im.naturalWidth*im.naturalHeight>40000000)throw Error('This preview supports up to 40 million pixels.');const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const d=ctx.getImageData(0,0,c.width,c.height);pixels(d.data,c.width,c.height,s);ctx.putImageData(d,0,0);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not prepare the PNG preview.');if(ticket!==epoch||key!==sourceKey)return;preview=c;previewSettings=s;previewSource=f.clean.sha256;$('candidate').src=c.toDataURL('image/png');$('save-preview').disabled=fields.every(k=>s[k]===0);note('Preview ready — not saved. Inspect full screen, adjust the sliders, or save as a new candidate.');}
  catch(e){note(e.message);}finally{busy=false;sync();}
 };
 $('save-preview').onclick=async()=>{
  if(!preview||!previewSettings||busy||!ready())return;const r=state(),key=sourceKey,s={...previewSettings},hash=previewSource;busy=true;$('save-preview').disabled=true;sync();note('Saving the preview as a separate candidate…');
  try{const blob=await new Promise(resolve=>preview.toBlob(resolve,'image/png')),body=new FormData();body.append('action','final_save_preview');body.append('revision',r.revision);body.append('source_sha256',hash);body.append('settings',JSON.stringify(s));body.append('width',document.getElementById('sbs-af-width').value);body.append('height',document.getElementById('sbs-af-height').value);body.append('file',blob,'finished-preview.png');if(key!==sourceKey)throw Error('Workspace changed. Preview again before saving.');const response=await fetch(apiBase+'/finishing/'+r.uuid+'/action',{method:'POST',credentials:'same-origin',headers:{'X-SBS-Request':'studio','X-SBS-Finishing':app.getAttribute('data-finishing-csrf')},body});const data=await response.json();if(!response.ok)throw Error(data.message||'Saving failed.');await bridge.openWorkspace(r.uuid);previewSettings=null;note('Candidate saved. Download it here or review and approve it separately.');}catch(e){note(e.message);$('save-preview').disabled=!previewSettings;}finally{busy=false;sync();}
 };
 $('reset-effects').onclick=()=>{fields.forEach(k=>$('effect-'+k).value=0);invalidate();};
 // Pointer gestures operate on one shared view transform, retained when comparing source/preview.
 let scale=1,tx=0,ty=0,viewOriginal=false,points=new Map(),gesture=null,viewImage=null;
 const dialog=$('view-dialog'),canvas=$('view-canvas');
 function paint(){if(!viewImage)return;const ctx=canvas.getContext('2d');canvas.width=Math.max(300,Math.floor(canvas.clientWidth));canvas.height=Math.max(300,Math.floor(canvas.clientHeight));ctx.clearRect(0,0,canvas.width,canvas.height);const fit=Math.min(canvas.width/viewImage.width,canvas.height/viewImage.height)*scale;ctx.drawImage(viewImage,(canvas.width-viewImage.width*fit)/2+tx,(canvas.height-viewImage.height*fit)/2+ty,viewImage.width*fit,viewImage.height*fit);$('view-state').textContent=(viewOriginal?'Source':'Treatment preview / saved result')+' — '+Math.round(scale*100)+'% of fit view';}
 async function show(){const f=final();if(!ready())return;viewImage=viewOriginal?await load(f.clean.url):preview||await load(f.finished?f.finished.asset.url:f.clean.url);paint();}
 $('fullscreen').onclick=async()=>{if(!ready())return;dialog.showModal();scale=1;tx=ty=0;viewOriginal=false;await show();};$('view-close').onclick=()=>{dialog.close();$('fullscreen').focus();};$('view-toggle').onclick=async()=>{viewOriginal=!viewOriginal;await show();};$('view-fit').onclick=()=>{scale=1;tx=ty=0;paint();};['in','out'].forEach(k=>$('view-'+k).onclick=()=>{scale=Math.max(.25,Math.min(16,scale*(k==='in'?1.3:1/1.3)));paint();});
 canvas.onpointerdown=e=>{points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);gesture=null;};canvas.onpointermove=e=>{if(!points.has(e.pointerId))return;const old=[...points.values()];points.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=[...points.values()];if(now.length===1){tx+=now[0].x-old[0].x;ty+=now[0].y-old[0].y;}else{const d=Math.hypot(now[0].x-now[1].x,now[0].y-now[1].y),before=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y);if(before)scale=Math.max(.25,Math.min(16,scale*d/before));tx+=(now[0].x+now[1].x-old[0].x-old[1].x)/2;ty+=(now[0].y+now[1].y-old[0].y-old[1].y)/2;}paint();};canvas.onpointerup=canvas.onpointercancel=e=>points.delete(e.pointerId);dialog.addEventListener('close',()=>points.clear());
 document.addEventListener('sbs:final-render',sync);document.addEventListener('sbs:finishing-state',sync);sync();
}
if(typeof module!=='undefined')module.exports={pixels};if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})();
