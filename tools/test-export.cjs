const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/studio.js', 'utf8');
const exportCode = source.slice(source.indexOf('    function clearExportDownloads()'), source.indexOf('    function bindLogoControls()'));
function fixture({ both = true, override = true, invalid = false, failAt = 0 } = {}) {
  const nodes = new Map(), messages = [], snapshots = [], revoked = [], blobs = new Map();
  const node = () => ({ children: [], dataset: {}, hidden: true, disabled: false, textContent: '', replaceChildren() {this.children = [];}, append(...items) {this.children.push(...items);}, appendChild(item) {this.children.push(item);}, scrollIntoView() {} });
  const el = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  for (const [id, value] of Object.entries({'sbs-print-width': 6, 'sbs-print-height': invalid ? 9 : 6, 'sbs-print-dpi': 300, 'sbs-print-method': 'dtg', 'sbs-visual-treatment': 'custom'})) el(id).value = value;
  el('sbs-transparent').checked = true; el('sbs-export-both').checked = both; el('sbs-manual-override').checked = override;
  const objects = [{sbsType:'creation',type:'image',name:'Original artwork',width:2048,height:2048,scaleX:.3,scaleY:.3,visible:true}, {sbsType:'exact_asset',name:'Copper signature',width:3000,height:472,scaleX:.1,scaleY:.1,visible:true}, {sbsType:'exact_asset',name:'Already hidden logo',visible:false}, {sbsType:'guide',visible:true}, {sbsType:'guide',visible:false}];
  const original = JSON.stringify(objects);
  const canvas = {width:900,height:900,getObjects:()=>objects,renderAll(){},toCanvasElement(multiplier,options){
    assert.equal(multiplier,1); assert.equal(options.enableRetinaScaling,false);
    const visible=objects.filter(o=>o.visible!==false).map(o=>o.name||o.sbsType); snapshots.push(visible);
    const index=snapshots.length;
    return {toBlob(callback,type){assert.equal(type,'image/png');setImmediate(()=>callback(index===failAt?null:new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')],{type})));}};
  }};
  const context = {Blob,Promise,Number,Math,Date,setTimeout,clearTimeout,console,state:{canvas,activeProject:{title:'Test artwork'}},exportDownloadUrls:[],el,ensureCanvas(){},buttonBusy(button,busy){button.disabled=busy;},updateCanvasControls(){},showMessage(message,error){messages.push({message,error});},window:{confirm:()=>true},URL:{createObjectURL(blob){const key='blob:test-'+blobs.size;blobs.set(key,blob);return key;},revokeObjectURL(url){revoked.push(url);}},document:{createElement:()=>node()}};
  vm.createContext(context); vm.runInContext(exportCode,context);
  return {context,nodes,el,objects,original,messages,snapshots,revoked,blobs};
}
(async()=>{
  const dual=fixture(); await dual.context.exportCanvas();
  assert.equal(dual.snapshots.length,2);
  assert.deepEqual(dual.snapshots[0],['Original artwork','Copper signature']); assert.deepEqual(dual.snapshots[1],['Original artwork']);
  assert.equal(JSON.stringify(dual.objects),dual.original,'Original artwork, guides and logo visibility must be preserved');
  const links=dual.el('sbs-export-downloads').children.filter(n=>n.download);
  assert.equal(links.length,2); assert.deepEqual(links.map(l=>l.download),['Test-artwork-composition.png','Test-artwork-logo-free-composition.png']);
  assert.ok(links.every(l=>l.href.startsWith('blob:'))); assert.equal(dual.el('sbs-export-downloads').hidden,false);
  assert.match(dual.messages.at(-1).message,/no print-size or PPI preparation/);
  await dual.context.exportCanvas(); assert.equal(dual.revoked.length,2,'Regenerating must release old download objects');
  const single=fixture({both:false}); await single.context.exportCanvas(); assert.equal(single.snapshots.length,1); assert.equal(single.el('sbs-export-downloads').children.filter(n=>n.download).length,1);
  const legacy=fixture({override:false,invalid:true}); await legacy.context.exportCanvas(); assert.equal(legacy.snapshots.length,2,'Legacy print dimensions and preflight state do not block composition export');
  const failure=fixture({failAt:2}); await failure.context.exportCanvas(); assert.equal(JSON.stringify(failure.objects),failure.original,'Failed logo-free encoding must restore the original'); assert.equal(failure.el('sbs-export-downloads').hidden,true); assert.equal(failure.el('sbs-canvas-export').disabled,false); assert.ok(failure.messages.at(-1).error);
  console.log('PASS: composition-size PNG export, logo-free copy, print-prep separation, cleanup and source-preserving failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
