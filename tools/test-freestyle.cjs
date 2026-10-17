const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('assets/js/freestyle.js','utf8'),storage=new Map();
const context={window:{localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}},console,Number,Object,Promise};vm.createContext(context);vm.runInContext(source,context);
const api=context.window.SBSFreestyle;
const gens=Array.from({length:9},(_,i)=>({id:9-i,uuid:'g'+(9-i),parent_id:8-i||null,asset_url:'/g'+(9-i)+'.png',freestyle_instruction:'Instruction '+(9-i),action:'edit',size:'1024x1536'}));
const original=JSON.stringify(gens);
assert.equal(api.recentSix(gens,'g9').length,6);assert.equal(api.recentSix(gens,'g9')[5].uuid,'g9');assert.ok(api.recentSix(gens,'g1').some(g=>g.uuid==='g1'));
assert.deepEqual(Array.from(api.branch(gens,'g4'),g=>g.uuid),['g1','g2','g3','g4']);assert.equal(JSON.stringify(gens),original);
const nodes=new Map();function node(id){if(nodes.has(id))return nodes.get(id);const n={id,value:'',innerHTML:'',textContent:'',hidden:false,disabled:false,checked:false,attrs:{},handlers:{},classList:{toggle(){}},addEventListener(e,f){this.handlers[e]=f;},getAttribute(k){return this.attrs[k]||null;},removeAttribute(k){delete this.attrs[k];},querySelector(){return this.strong||(this.strong={textContent:''});},querySelectorAll(){return [];},focus(){}};Object.defineProperty(n,'src',{get(){return n.attrs.src;},set(v){n.attrs.src=v;}});nodes.set(id,n);return n;}
['style','treatment','background','size','width','height'].forEach((key,i)=>node('sbs-fs-'+key).value=['cartoon','vintage','opaque','1024x1536','15','18'][i]);
let project={id:101,uuid:'p1',title:'New composition',pack_uuid:'neutral',concept:{type:'freestyle',character_uuid:'',settings:{style:'cartoon',treatment:'vintage',background:'opaque',size:'1024x1536',width:15,height:18}},generations:[],jobs:[]};
const calls=[],messages=[],state={packs:[{uuid:'bear',name:'Smutty Bear'}],projects:[],selectedPack:{uuid:'bear'},freestylePackUuid:'neutral'};
const ctx={state,el:node,esc:x=>String(x??''),showMessage:(m,e)=>messages.push({m,e}),handleError:e=>{throw e;},api:async()=>{},replaceProject:p=>{const i=state.projects.findIndex(x=>x.uuid===p.uuid);if(i<0)state.projects.push(p);else state.projects[i]=p;},trackJobs(){},zoom(){},loadBootstrap:async()=>{},openProject(){},post:async(path,body)=>{calls.push({path,body});if(path==='freestyle')return {project,jobs:[]};return project;}};
const controller=api.init(ctx);assert.equal(node('sbs-fs-character').value,'','Global selected character must not leak into a new sandbox');assert.equal(node('sbs-fs-background').value,'opaque');
(async()=>{
 node('sbs-fs-form').handlers.submit({preventDefault(){}});assert.equal(calls.length,0);
 node('sbs-fs-instruction').value='A new adult character on a seaside stage with the slogan Smile Out Loud';node('sbs-fs-style').value='ink-sketch';node('sbs-fs-style').handlers.change.call(node('sbs-fs-style'));
 node('sbs-fs-form').handlers.submit({preventDefault(){}});await new Promise(setImmediate);
 assert.equal(calls[0].body.pack_uuid,'');assert.equal(calls[0].body.parent_uuid,'');assert.equal(calls[0].body.settings.dpi,300);assert.equal(calls[0].body.settings.background,'opaque');assert.equal(calls[0].body.settings.style,'ink-sketch');
 project.generations=gens;controller.onJob({uuid:'finished',id:77,status:'completed',payload:{project_id:101,purpose:'freestyle'},result:{generation_uuid:'g9'}});controller.render();
 assert.equal(node('sbs-fs-image').src,'/g9.png');assert.equal(controller.isJob({payload:{project_id:101}}),true,'Upscale must stay in the sandbox');assert.equal(controller.isJob({payload:{project_id:999}}),false);
 node('sbs-fs-undo').handlers.click();await new Promise(setImmediate);assert.equal(node('sbs-fs-image').src,'/g8.png');assert.equal(calls.at(-1).body.generation_uuid,'g8');
 node('sbs-fs-instruction').value='Change only the hat to blue.';node('sbs-fs-form').handlers.submit({preventDefault(){}});await new Promise(setImmediate);
 const turn=calls.filter(c=>c.path==='freestyle').at(-1);assert.equal(turn.body.parent_uuid,'g8','New branch must use the restored source');assert.equal(turn.body.project_uuid,'p1');assert.equal(JSON.stringify(gens),original,'Undo/branch must never delete old images');
 node('sbs-fs-new').handlers.click();assert.equal(node('sbs-fs-style').value,'ink-sketch','Last style must carry into a new experiment');assert.equal(node('sbs-fs-background').value,'opaque','A new experiment must default to opaque');assert.equal(node('sbs-fs-character').value,'');
 assert.equal(node('sbs-fs-promote').disabled,true,'No image/review cannot be sent to print workflow');
 console.log('PASS: six-version history, branch ancestry, optional character isolation, one-image request, 300-PPI/opaque defaults, undo, exact-parent edits and remembered style');
})().catch(e=>{console.error(e);process.exit(1);});
