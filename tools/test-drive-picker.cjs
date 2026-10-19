'use strict';
// Run the shipped UI controller with a small DOM/Google/HTTP harness. No network.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Element {
  constructor(id=''){this.id=id;this.value='';this.textContent='';this.disabled=false;this.hidden=false;this.dataset={};this.attributes={};this.listeners={};this.children=[];this.style={};this.files=[];}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  hasAttribute(k){return k in this.attributes;}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  trigger(k){for(const fn of this.listeners[k]||[])fn.call(this,{preventDefault(){},submitter:this.submit});}
  click(){if(!this.disabled)this.trigger('click');}
  appendChild(n){this.children.push(n);}
  replaceChildren(){this.children=[];}
  querySelector(){return this.submit??=new Element('submit-'+this.id);}
  querySelectorAll(){return [this.submit??=new Element('submit-'+this.id)];}
  reset(){this.value='';}
  focus(){this.focused=true;}
}
const ids=[...new Set([...fs.readFileSync('templates/finishing.php','utf8').matchAll(/id="([^"]+)"/g),...fs.readFileSync('templates/finishing-settings.php','utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]))];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));elements['sbs-app']=new Element('sbs-app');
const app=elements['sbs-app'];app.setAttribute('data-authenticated','1');app.setAttribute('data-rest','/api/');app.setAttribute('data-finishing-csrf','TEST_CSRF');
const checkboxes=['identity','lettering','texture','garments','warnings'].map(k=>{const n=new Element(k);n.setAttribute('data-af-check',k);n.checked=false;return n;});
const doc={readyState:'loading',getElementById(id){assert.ok(elements[id],'Unknown UI element '+id);return elements[id];},querySelectorAll(q){return q==='[data-af-check]'?checkboxes:[];},createElement(){return new Element();},addEventListener(){},head:new Element()};
const qa={width:5,height:7,mime:'image/png',alpha:'opaque',effective_ppi:1,warnings:[]};
const original={url:'/local/original',sha256:'hash',filename:'original.png'};
let record={uuid:'00000000-0000-4000-a000-000000000000',title:'Disposable image',status:'Awaiting Finishing',revision:1,original,original_qa:qa,versions:[],current_version:null,approval:null,links:{idea_ids:[],sb_id:''},next_action:'Choose a stage',drive:{}};
let pickerCallback,pickerSize,viewMode,disposed=0,calls=[],failure='',refreshFailure=false;
const picker={Response:{ACTION:'action',DOCUMENTS:'docs'},Action:{PICKED:'picked',CANCEL:'cancel'},Document:{ID:'id',NAME:'name'},ViewId:{DOCS:'docs',FOLDERS:'folders'},DocsViewMode:{LIST:'list'}};
picker.DocsView=class {setSelectFolderEnabled(v){this.folder=v;}setIncludeFolders(){}setMimeTypes(v){assert.equal(v,'image/png,image/jpeg,image/webp');}setMode(v){viewMode=v;}};
picker.PickerBuilder=class {
  addView(v){this.view=v;return this;}setOAuthToken(v){assert.equal(v,'TEST_ACCESS');return this;}setDeveloperKey(){return this;}setAppId(){return this;}setOrigin(v){assert.equal(v,'https://studio.example.test');return this;}setTitle(){return this;}
  setSize(w,h){pickerSize=[w,h];return this;}setCallback(fn){pickerCallback=fn;return this;}build(){return {setVisible(){},dispose(){disposed++;}};}
};
async function fetch(url,options){
  const data=options.body?JSON.parse(options.body):null;calls.push({url,data,options});
  assert.equal(options.credentials,'same-origin');assert.equal(options.headers['X-SBS-Finishing'],'TEST_CSRF');
  if(failure&&url.endsWith(failure))return {ok:false,json:async()=>({message:'Simulated request failure'})};
  let result;
  if(url.endsWith('/google/picker'))result={access_token:'TEST_ACCESS',api_key:'TEST_RESTRICTED_KEY',app_id:'123456789012'};
  else if(url.endsWith('/import-drive'))result=record;
  else if(url.endsWith('/save-drive')){record={...record,revision:record.revision+1,drive:{verified:true,approved_master_file_id:'saved_package_000001',candidate_sha256:'hash'}};result=record;}
  else if(url.endsWith('/finishing')){if(refreshFailure)throw new Error('Simulated refresh failure');result={records:[record]};}
  else if(url.endsWith('/'+record.uuid))result=record;
  else if(url.endsWith('/action')){
    assert.equal(data.action,'approve');assert.deepEqual(data.checks,Object.fromEntries(checkboxes.map(n=>[n.id,true])));
    record={...record,status:'Finishing Approved (local only)',approval:{scope:'local_finishing_only'}};result=record;
  } else throw new Error('Unexpected URL '+url);
  return {ok:true,json:async()=>result};
}
const context={window:{google:{picker},innerWidth:320,innerHeight:480,location:{protocol:'https:',host:'studio.example.test'}},google:{picker},document:doc,fetch,FormData:class{},AbortController,URL,setTimeout,clearTimeout,requestAnimationFrame:fn=>fn()};
vm.runInNewContext(fs.readFileSync('assets/js/finishing.js','utf8'),context);context.window.SBSFinishing.init();
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
(async()=>{
  const browse=elements['sbs-af-drive-browse'];browse.click();await flush();
  assert.equal(browse.getAttribute('aria-busy'),'true',elements['sbs-af-progress'].textContent);assert.equal(viewMode,'list');assert.deepEqual(pickerSize,[296,432]);
  pickerCallback({action:'loaded'});await flush();assert.equal(browse.getAttribute('aria-busy'),'true','Non-terminal Picker action released controls');
  pickerCallback({action:'cancel'});await flush();assert.equal(browse.hasAttribute('aria-busy'),false);assert.match(elements['sbs-af-progress'].textContent,/cancelled/);
  browse.click();await flush();pickerCallback({action:'picked',docs:[{id:'disposable_image_png',name:'Disposable.png'}]});await flush();
  assert.equal(elements['sbs-af-drive-id'].value,'disposable_image_png');assert.equal(elements['sbs-af-drive-import'].querySelector().disabled,false);
  const form=elements['sbs-af-drive-import'];form.trigger('submit');await flush();assert.match(elements['sbs-af-drive-status'].textContent,/imported successfully/);assert.equal(elements['sbs-af-original'].src,'/local/original');
  record={...record,status:'Awaiting Review',current_version:'candidate',versions:[{uuid:'candidate',number:1,asset:original,qa,options:{method:'inspect',width:15,height:18},comparison:{byte_identical:true}}]};
  elements['sbs-af-resume'].value=record.uuid;elements['sbs-af-resume'].trigger('change');await flush();assert.equal(elements['sbs-af-approve'].disabled,true);
  checkboxes.forEach(n=>{n.checked=true;n.trigger('change');});assert.equal(elements['sbs-af-approve'].disabled,false);elements['sbs-af-approve'].click();await flush();
  const folder=elements['sbs-af-drive-folder'];folder.click();await flush();pickerCallback({action:'picked',docs:[{id:'disposable_folder_01',name:'Disposable test folder'}]});await flush();
  assert.equal(elements['sbs-af-save-drive'].disabled,false);elements['sbs-af-save-drive'].click();await flush();
  assert.match(elements['sbs-af-drive-folder-status'].textContent,/saved and checksum verified/);assert.equal(elements['sbs-af-drive-package'].href,'https://drive.google.com/file/d/saved_package_000001/view');assert.equal(elements['sbs-af-drive-package'].hidden,false);
  refreshFailure=true;elements['sbs-af-save-drive'].click();await flush();assert.match(elements['sbs-af-drive-folder-status'].textContent,/Package saved and verified/);refreshFailure=false;
  failure='/google/picker';browse.click();await flush();assert.equal(browse.disabled,false);assert.equal(browse.hasAttribute('aria-busy'),false);assert.match(elements['sbs-af-drive-status'].textContent,/Simulated request failure/);
  assert.equal(elements['sbs-af-progress'].getAttribute('role'),'alert');assert.equal(calls.filter(c=>c.url.endsWith('/google/connect')).length,0,'UI repeated Google authentication');assert.ok(disposed>=3);
  assert.doesNotMatch(Object.values(elements).map(n=>n.textContent).join(' '),/TEST_ACCESS|TEST_RESTRICTED_KEY/,'Token/key appeared in UI');
  console.log('PASS: Picker selected/cancelled/loaded/failure flows, 320px layout sizing, progress controls, CSRF headers, import UI, human-review gating, approved save link, truthful saved-but-refresh-failed status, no repeated authentication. Simulated DOM/Google/HTTP; Android and live Picker remain untested.');
})().catch(error=>{console.error(error);process.exitCode=1;});
