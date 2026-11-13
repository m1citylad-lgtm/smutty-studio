'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const svg='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect x="30" y="30" width="140" height="180" fill="#b05b25"/></svg>').toString('base64');
let record={uuid:'aaaaaaaa-0000-4000-8000-000000000001',title:'Disposable workflow test',original:{id:1,uuid:'asset-original',filename:'source.png',mime:'image/png',sha256:'original',url:svg},original_qa:{width:4200,height:4800,effective_ppi:300,alpha:'Transparency detected (sampled)',warnings:[],pixel_review:{status:'sampled',findings:[]},export_metadata:{}},versions:[],current_version:null,status:'Awaiting Finishing',next_action:'Check artwork',revision:1,audit:[]};
let preferences={revision:0,series:{SB:'Smutty Bear',MB:'Madam Butterfly',TT:'Torsotopia',PW:'Piston Works'},profiles:{},workspaces:{}};
let failPass=null,pollFailure=null,pollStages=[];const calls=[],seenLocalStages=[];
function mockAction(p){calls.push(p.action+(p.pass?':'+p.pass:''));
 if(p.action==='prepare'){record.pending=p.options;record.status='Queued';}
 else if(p.action==='run'){const method=record.pending.method;record.versions.push({uuid:'version-'+(record.versions.length+1),number:record.versions.length+1,asset:{...record.original,sha256:method==='inspect'?'original':'print-hash'},qa:{...record.original_qa},comparison:{byte_identical:method==='inspect',geometry:{status:'proportional'}},options:{...record.pending,source_sha256:record.current_version?record.versions.find(v=>v.uuid===record.current_version).asset.sha256:'original'}});record.current_version=record.versions.at(-1).uuid;record.pending=null;record.status='Awaiting Review';}
 else if(p.action==='poll'&&pollStages.length){const stage=pollStages.shift();seenLocalStages.push(stage);if(stage==='complete'){const old=record.versions.find(v=>v.uuid===record.current_version);record.versions.push({...old,uuid:'completed-upscale',number:record.versions.length+1,asset:{...old.asset,sha256:'completed-upscale'},qa:{...old.qa,width:1200,height:1200},options:{method:'upscale',width:2,height:2,source_sha256:old.asset.sha256}});record.current_version='completed-upscale';record.pending=null;record.status='Awaiting Review';record.next_action='Prepare final print PNG';}else{record.pending.local_stage=stage;record.next_action=stage==='candidate'?'Joined output saved; restoring source transparency':'Checking the saved upscale dimensions and transparency';}}
 else if(p.action==='flow_review'){if(p.pass===failPass)return {error:'Simulated provider failure'};if(p.pass==='whole')record.flow={review:{sha256:record.versions.find(v=>v.uuid===record.current_version).asset.sha256,passes:{},decisions:{},character:p.character,notes:p.notes}};record.flow.review.passes[p.pass]={summary:'Checked',findings:[]};}
 else if(p.action==='flow_pixels')record.flow.pixels={sha256:p.sha256,remaining:p.remaining,reviewed:p.reviewed,alpha:p.alpha,policy:p.policy,target:p.target,accepted_ids:p.accepted_ids||[]};
 else if(p.action==='ai_review')record.versions.find(v=>v.uuid===record.current_version).ai_review={summary:'Compared',findings:[]};
 else if(p.action==='flow_decision')record.flow.review.decisions[p.finding]=p.decision;
 else if(p.action==='review_finding'){const v=record.versions.find(v=>v.uuid===record.current_version);v.review_decisions=v.review_decisions||{};v.review_decisions[p.finding_id]={decision:p.decision};}
 else if(p.action==='approve')record.approval={at:'2026-11-03T22:15:00Z',version:record.current_version,sha256:record.versions.find(v=>v.uuid===record.current_version).asset.sha256};
 else if(p.action==='final_begin'){const a=record.versions.find(v=>v.uuid===record.current_version)?.asset||record.original;record.final_print={clean:a,clean_qa:record.original_qa,target:[p.width,p.height],stage1_approval:record.approval,finished:null,branded:null,brand_decision:null,proofs:[],settings:{}};}
 else if(p.action==='final_keep'){const f=record.final_print;f.finished={asset:f.clean,source_sha256:f.clean.sha256,settings:{preset:'original'},technical:{status:'PASS',reasons:[]},visual:{status:'REVIEW',reason:'Original selected by owner; no additional treatment.'},approval:f.stage1_approval?{sha256:f.clean.sha256}:null,finish_status:'APPROVED_NO_ADDITIONAL_FINISH'};}
 else if(p.action==='final_brand'){record.final_print.brand_decision='APPROVED_NO_LOGO';}
 else if(p.action==='final_settings'){record.final_print.settings=p.settings;record.final_print.proofs=[];}
 else if(p.action==='final_proofs'){record.final_print.proofs=['black','white','red','navy'].map(c=>({asset:{url:svg,sha256:'proof-'+c},colour:c,note:'Visual reference',source_sha256:record.final_print.finished.asset.sha256}));}
 else if(p.action==='final_export'){record.final_print.archive={verified:true,url:'https://drive.google.com/drive/folders/test',register:{verified:true,url:'https://drive.google.com/file/d/register/view'}};}
 else if(p.action==='flow_drive')record.flow.archive={approval_at:record.approval.at,verified:true,candidate_sha256:'print-hash',name:'DW-Disposable-Workflow-v2-R01',files:[{id:'file-1'},{id:'file-2'}],url:'https://drive.google.com/drive/folders/test',register:{verified:true,url:'https://drive.google.com/file/d/register/view'}};
 record.revision++;return record;
}
(async()=>{
 const args={headless:true};if(process.env.SBS_CHROMIUM_PATH){args.executablePath=process.env.SBS_CHROMIUM_PATH;args.args=['--no-sandbox','--disable-dev-shm-usage'];}
 const browser=await chromium.launch(args);try{
 const page=await browser.newPage({viewport:{width:1024,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__sbsBlips=0;window.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={};}resume(){this.state='running';return Promise.resolve();}createOscillator(){return{frequency:{setValueAtTime(){}},connect(){},start(){window.__sbsBlips++;},stop(){}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};});
 await page.route('**/api/**',async route=>{let data,url=route.request().url();if(url.endsWith('/preferences')){if(route.request().method()==='POST'){const q=route.request().postDataJSON();if(q.revision!==preferences.revision)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Settings changed elsewhere'})});if(q.operation==='commit')preferences.workspaces[q.workspace]={...q.settings,preset:q.preset};else if(q.operation==='series_add'){if(preferences.series[q.code])return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Code already used'})});preferences.series[q.code]=q.name;}else if(q.operation==='profile_save'){const id=Object.values(q.settings).join('-');preferences.profiles[id]={id,name:id,settings:q.settings};}else if(q.operation==='profile_rename')preferences.profiles[q.id].name=q.name;else if(q.operation==='profile_delete')delete preferences.profiles[q.id];preferences.revision++;}data=preferences;}else if(url.endsWith('/final-library'))data={items:[]};else if(url.endsWith('/google/status'))data={configured:false,connected:false};else if(url.endsWith('/references'))data={references:[]};else if(url.endsWith('/checks'))data={checks:[]};else if(url.endsWith('/action')){const payload=route.request().postDataJSON();if(payload.action==='poll'&&pollFailure){calls.push('poll');return route.fulfill({status:500,contentType:'text/html',body:pollFailure});}data=mockAction(payload);}else if(url.endsWith('/finishing'))data={records:[record]};else data=record;await route.fulfill({status:data.error?500:200,contentType:'application/json',body:JSON.stringify(data.error?{message:data.error}:data)});});
 let html=read('templates/finishing.php').replace("<?php require SBS_PLUGIN_DIR . 'templates/final-print.php'; ?>",read('templates/final-print.php')).replace("<?php require SBS_PLUGIN_DIR . 'templates/finishing-flow.php'; ?>",read('templates/finishing-flow.php')).replace(/<\?php[\s\S]*?\?>/g,'');
 const styles=['studio.css','studio-theme.css','finishing.css','transparency-correction.css','finishing-flow.css','final-print.css'].map(n=>'<style>'+read('assets/css/'+n)+'</style>').join(''),scripts=['flat-background.js','finishing.js','transparency-correction.js','finishing-flow.js','final-print.js','treatment.js'].map(n=>'<script>'+read('assets/js/'+n)+'</script>').join('');
 const fixtureHtml='<!doctype html><html><head><meta charset="utf-8"><base href="http://studio.test/"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'</head><body id="sbs-studio-page"><main id="sbs-app" data-rest="http://studio.test/api/" data-authenticated="1" data-finishing-csrf="test">'+html+read('templates/finishing-settings.php').replace(/<\?php[\s\S]*?\?>/g,'')+'</main>'+scripts+'</body></html>';
 await page.route('http://studio.test/',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixtureHtml}));await page.route('**/assets/mockups/**',route=>route.fulfill({contentType:'image/svg+xml',body:Buffer.from(svg.split(',')[1],'base64')}));await page.goto('http://studio.test/');
 assert.deepEqual(errors,[]);assert.match(await page.locator('#sbs-flow-step-1 .sbs-flow-status').textContent(),/Next.*Choose your artwork/);assert.equal(await page.locator('[data-flow-step]').count(),6);const titles=await page.locator('[data-flow-step] h2:visible').allTextContents();assert.deepEqual(titles,['1. Choose artwork and print size','2. Check the artwork','3. Fix the action list','4. Upscale and prepare the print file','5. Check the finished artwork','6. Approve and transfer your files']);
 await page.locator('#sbs-flow-connect').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-google-setup').open);assert.equal(await page.locator('#sbs-flow-google-setup').getAttribute('open'),'');assert.match(await page.locator('#sbs-google-status').textContent(),/One-time Google Drive setup/);assert.equal(await page.locator('#sbs-google-connect').isEnabled(),false);
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 await page.locator('#sbs-flow-check').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-check-status').textContent.includes('Check complete'),null,{timeout:10000}).catch(async e=>{console.error('Check debug',await page.locator('#sbs-flow-check-status').textContent(),await page.locator('#sbs-af-progress').textContent(),calls,errors);throw e;});
 assert.equal(await page.locator('#sbs-af-completion-sound').isChecked(),true,'Completion sound should default on');await page.waitForFunction(()=>window.__sbsBlips===2);const soundCount=await page.evaluate(()=>window.__sbsBlips);await page.locator('#sbs-af-completion-sound').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await page.locator('#sbs-af-completion-sound').isChecked(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('sbs-af-completion-sound')),'off');await page.locator('#sbs-flow-check').click();await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__sbsBlips),soundCount,'Muted completion sound played');await page.locator('#sbs-af-completion-sound').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await page.locator('#sbs-af-completion-sound').isChecked(),true);
 assert.deepEqual(calls.filter(x=>x.startsWith('flow_review')),['flow_review:whole','flow_review:regions','flow_review:custom','flow_review:whole','flow_review:regions','flow_review:custom']);assert.equal(await page.locator('[data-af-method="print_png"]').isEnabled(),true,'Optional print-area scan blocked preparation');
 await page.locator('#sbs-af-correction-open').click();await page.waitForFunction(()=>document.getElementById('sbs-af-correction-open').dataset.state==='done');await page.locator('#sbs-af-correction-close').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-next-title').textContent.includes('Upscale if needed'));
 assert.equal(await page.locator('[data-af-method="upscale"]').isEnabled(),false,'Enough pixels must skip paid enlargement');await page.locator('[data-af-method="print_png"]').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-next-title').textContent.includes('final check'));
 await page.locator('#sbs-af-ai-review-run').click();await page.waitForFunction(()=>document.getElementById('sbs-af-ai-status').textContent.includes('Comparison complete'),null,{timeout:8000}).catch(async e=>{console.error('Comparison debug',await page.locator('#sbs-af-ai-status').textContent(),await page.locator('#sbs-af-progress').textContent(),calls,errors);throw e;});await page.locator('#sbs-flow-final-pixels').click();await page.waitForFunction(()=>document.getElementById('sbs-af-correction-open').dataset.state==='done');await page.locator('#sbs-af-correction-close').click();for(const box of await page.locator('[data-af-check]').all())await box.check();
 await page.waitForFunction(()=>!document.getElementById('sbs-af-approve').disabled);await page.locator('#sbs-af-approve').click();await page.waitForFunction(()=>!document.getElementById('sbs-flow-drive').disabled);assert.equal(await page.locator('#sbs-flow-prefix').evaluate(el=>el.value),'DW');await page.locator('#sbs-flow-drive').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-drive-status').textContent.includes('Finished'));assert.match(await page.locator('#sbs-flow-drive-status').textContent(),/2 individual files.*DW-Disposable-Workflow-v2-R01/);assert.equal(await page.locator('#sbs-flow-drive-link').getAttribute('href'),'https://drive.google.com/drive/folders/test');assert.equal(await page.locator('#sbs-flow-register-link').getAttribute('href'),'https://drive.google.com/file/d/register/view');
 // Reproduce Purple's independent action-list/final-report decisions and refresh cycle.
 record.approval=null;
 record.flow.review.passes.whole.findings=[{id:'texture',category:'Texture',issue:'Cap texture may be intentional',action:'Inspect the cap',bbox:{x:0,y:0,width:.2,height:.2}}];
 record.flow.review.decisions={};
 const finalVersion=record.versions.find(v=>v.uuid===record.current_version);
 finalVersion.ai_review={summary:'Review',overall:'review',findings:[{id:'shoulder',area:'Shoulder',severity:'concern',issue:'Check the shoulder edge',action:'Inspect',focus:{x:.5,y:.5}}]};
 finalVersion.review_decisions={};
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 assert.match(await page.locator('#sbs-flow-next-title').textContent(),/Review 1 artwork action/);
 await page.locator('#sbs-flow-list').getByRole('button',{name:'This is intentional',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#sbs-flow-list li').dataset.reviewState==='resolved');
 assert.match(await page.locator('#sbs-flow-actions-status').textContent(),/All artwork actions resolved/);
 await page.locator('#sbs-af-ai-review-report').getByRole('button',{name:'Accept as intentional',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('sbs-af-ai-status').textContent.includes('0 unresolved; 1 resolved'));
 assert.equal(await page.locator('#sbs-af-ai-review-report [data-review-state="resolved"] details').count(),1);
 assert.equal(await page.locator('#sbs-af-ai-review-report').getByText('ACTION NEEDED — review before approval',{exact:true}).count(),0);
 await page.locator('#sbs-af-refresh').click();
 await page.waitForFunction(()=>!document.getElementById('sbs-af-refresh').disabled);
 assert.match(await page.locator('#sbs-af-ai-status').textContent(),/0 unresolved; 1 resolved/);
 assert.equal(record.flow.review.decisions.texture,'intentional');
 assert.equal(finalVersion.review_decisions.shoulder.decision,'intentional');
 const versionBeforeCheck=record.current_version,versionsBeforeCheck=record.versions.length;
 await page.locator('[data-af-method="inspect"]').click();
 await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 assert.equal(record.current_version,versionBeforeCheck,'Read-only file check changed the selected version');
 assert.equal(record.versions.length,versionsBeforeCheck,'Read-only file check added another version');
 assert.equal(finalVersion.review_decisions.shoulder.decision,'intentional');
 // A scan of the same image must not withdraw the owner's intentional-mark decision.
 record.flow.pixels={sha256:'print-hash',remaining:2,reviewed:true,policy:'print-impact-v1',target:{width:14,height:16},alpha:{clear:1,partial:0,opaque:47999}};
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sbs:pixel-scan',{detail:{workspace:'aaaaaaaa-0000-4000-8000-000000000001',sha256:'print-hash',remaining:2,policy:'print-impact-v1',target:{width:14,height:16},alpha:{clear:1,partial:0,opaque:47999}}})));
 await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 assert.equal(record.flow.pixels.reviewed,true,'Same-image rescan reset the intentional marks');
 const other=JSON.parse(JSON.stringify(record));other.uuid='bbbbbbbb-0000-4000-8000-000000000002';other.title='Different artwork';other.flow.review.decisions={};other.versions.find(v=>v.uuid===other.current_version).review_decisions={};
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),other);
 assert.match(await page.locator('#sbs-flow-next-title').textContent(),/Review 1 artwork action/,'Different artwork inherited resolved state');
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 console.log('UI regression: accepted findings collapse, final warning counts clear, decisions survive refresh/rescan and other artwork keeps its own unresolved decisions.');
 // Real canvas fixture: a microscopic dot and broad partial-alpha smoke.
 const fixtureUrl=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=600;const x=c.getContext('2d');x.fillStyle='#903010';x.fillRect(150,100,250,220);x.fillRect(10,10,1,1);x.fillStyle='rgba(150,150,150,0.43)';x.fillRect(50,400,60,60);return c.toDataURL('image/png');});
 record=JSON.parse(JSON.stringify(record));record.uuid='cccccccc-0000-4000-8000-000000000003';record.title='Print visibility fixture';record.approval=null;
 record.original={...record.original,sha256:'visibility-fixture',url:fixtureUrl};record.original_qa={...record.original_qa,width:600,height:600,effective_ppi:300};
 record.versions=[{uuid:'visibility-version',number:1,asset:record.original,qa:record.original_qa,comparison:{byte_identical:true,geometry:{status:'proportional'}},options:{method:'print_png',width:2,height:2,source_sha256:'visibility-fixture'},ai_review:{overall:'clear',findings:[]}}];record.current_version='visibility-version';
 record.flow={review:{sha256:'visibility-fixture',passes:{whole:{findings:[]},regions:{findings:[]},custom:{findings:[]}},decisions:{}}};
 await page.locator('#sbs-af-width').fill('2');await page.locator('#sbs-af-height').fill('2');
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 await page.locator('#sbs-flow-final-pixels').click();await page.waitForFunction(()=>document.getElementById('sbs-af-correction-open').dataset.state==='done');
 assert.match(await page.locator('#sbs-af-correction-status').textContent(),/Scan complete — 1 possible print area/);
 assert.equal(await page.locator('#sbs-af-correction-list button').count(),1,'Microscopic dot became an individual issue');
 await page.locator('#sbs-af-correction-list button').click();assert.match(await page.locator('#sbs-af-correction-status').textContent(),/possible smoke, fade or texture.*5.1.*Centred at 4×/);
 assert.equal(await page.locator('.sbs-correction-marker:visible').count(),1,'Viewer displays more than the selected issue');
 assert.equal(await page.locator('[data-sbs-correction-kind="solid_opacity"]').isVisible(),false,'Smoke offers an opacity-restoration action');
 assert.equal(await page.locator('#sbs-af-correction-run-all').isVisible(),false,'Ambiguous effects offer bulk cleanup');
 await page.locator('#sbs-af-correction-accept').click();await page.locator('#sbs-af-correction-close').click();await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy()).catch(async e=>{console.error('Print save debug',await page.locator('#sbs-af-progress').textContent(),await page.locator('#sbs-flow-repair-status').textContent(),calls.slice(-8),errors,record.flow.pixels);throw e;});
 assert.equal(record.flow.pixels.policy,'print-impact-v1');assert.equal(record.flow.pixels.remaining,0);assert.ok(record.flow.pixels.accepted_ids.length===1,'Intentional area decision not saved');
 assert.equal(record.versions.length,1,'Reviewing smoke created an edited candidate');assert.equal(record.original.url,fixtureUrl,'Smoke review changed image bytes');
 await page.locator('#sbs-flow-final-pixels').click();await page.waitForFunction(()=>document.getElementById('sbs-af-correction-open').dataset.state==='done');
 assert.match(await page.locator('#sbs-af-correction-list button').textContent(),/Reviewed/,'Accepted effect was forgotten on reopen');await page.locator('#sbs-af-correction-close').click();await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 console.log('UI: one-pixel filtering, grouped smoke advisory, centred 4× view, no automatic opacity/bulk fix, saved intentional review and unchanged image verified.');
 // A failed check of an existing paid job must stop visibly, never resubmit it.
 record.pending={method:'upscale',replicate_prediction_id:'saved-paid-job'};record.status='AI upscale processing on Replicate';
 pollFailure='<p>There has been a critical error on this website.</p>';
 await page.locator('#sbs-af-refresh').click();await page.waitForFunction(()=>!document.getElementById('sbs-af-refresh').disabled);
 const beforeUpscaleCalls=calls.length;
 await page.locator('#sbs-af-resume').selectOption(record.uuid);
 await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 assert.match(await page.locator('#sbs-flow-next-title').textContent(),/Processing stopped.*Diagnostics/);
 assert.match(await page.locator('[data-af-stage-report="upscale"]').textContent(),/existing job are retained/);
 assert.doesNotMatch(await page.locator('[data-af-stage-report="upscale"]').textContent(),/<p>|critical error on this website/);
 assert.equal(await page.locator('[data-af-method="upscale"]').isEnabled(),false);
 assert.equal(record.pending.replicate_prediction_id,'saved-paid-job');
 assert.deepEqual(calls.slice(beforeUpscaleCalls),['poll'],'Recovery started another paid request');
 // Reopening repeats only the existing status check; a different artwork has no old failure.
 await page.locator('#sbs-af-refresh').click();await page.waitForFunction(()=>!document.getElementById('sbs-af-refresh').disabled);await page.locator('#sbs-af-resume').selectOption(record.uuid);await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 assert.match(await page.locator('#sbs-flow-next-title').textContent(),/Processing stopped/);
 const freshArtwork={...record,uuid:'dddddddd-0000-4000-8000-000000000004',pending:null};
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),freshArtwork);
 assert.doesNotMatch(await page.locator('#sbs-flow-next-title').textContent(),/Processing stopped/);
 assert.equal(await page.locator('[data-af-stage-report="upscale"]').isVisible(),false);
 console.log('UI: WordPress HTML failure becomes readable, polling stops, existing paid job is retained, reopen only checks status, and other artwork has no stale error.');
 // Saved local finishing stages progress automatically without another run/prepare request.
 pollFailure=null;pollStages=['candidate','checks','complete'];record.pending.local_stage='assemble';record.next_action='All enlarged sections saved; joining the existing outputs';
 await page.locator('#sbs-af-refresh').click();await page.waitForFunction(()=>!document.getElementById('sbs-af-refresh').disabled);
 const beforeLocalCalls=calls.length;await page.locator('#sbs-af-resume').selectOption(record.uuid);
 await page.waitForFunction(()=>document.getElementById('sbs-af-progress').textContent.includes('restoring source transparency'));
 assert.equal(await page.locator('[data-af-method="upscale"] .sbs-af-stage-spinner').isVisible(),true,'Saved-job resume has no visible progress');
 await page.reload();await page.waitForFunction(()=>window.SBSFinishingBridge&&window.SBSFinishingBridge.getState()&&window.SBSFinishingBridge.getState().pending);
 assert.equal(await page.evaluate(()=>window.SBSFinishingBridge.getState().pending.replicate_prediction_id),'saved-paid-job','Page refresh changed the saved job');assert.equal(await page.evaluate(()=>window.SBSFinishingBridge.isBusy()),true,'Page refresh did not resume progress');assert.equal(await page.locator('[data-af-method="upscale"] .sbs-af-stage-spinner').isVisible(),true,'Page refresh lost the running indicator');
 await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 assert.deepEqual(seenLocalStages,['candidate','checks','complete']);assert.deepEqual(calls.slice(beforeLocalCalls),['poll','poll','poll'],'Local recovery submitted another upscale');
 assert.equal(record.current_version,'completed-upscale');assert.equal(record.pending,null);
 assert.match(await page.locator('[data-af-stage-report="upscale"]').textContent(),/Completed/);
 assert.match(await page.locator('#sbs-af-progress').textContent(),/AI upscale finished/);
 console.log('UI: existing local finishing stages survive a real page reload with the same job, show progress/spinner, save completion and consume only status polls with no prepare/run requests.');
 fs.mkdirSync('build/ui-check',{recursive:true});await page.screenshot({path:'build/ui-check/desktop.png',fullPage:true});await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'build/ui-check/tablet.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Tablet layout overflows horizontally');
 await page.locator('#sbs-af-clear').click();assert.match(await page.locator('#sbs-flow-next-title').textContent(),/Choose your artwork/);assert.equal(await page.locator('#sbs-flow-drive').isEnabled(),false);assert.equal(await page.locator('#sbs-flow-list li').count(),0);assert.equal(await page.locator('#sbs-flow-drive-status').textContent(),'');assert.match(await page.locator('#sbs-flow-step-1 .sbs-flow-status').textContent(),/Next.*Choose your artwork/);assert.equal(await page.locator('#sbs-flow-preview').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('UI: six ordered sections, actual button flow through review/pixel scan/print/final check/approval/archive, and New artwork reset passed.');
 // New stages integrate with the same bridge and preserve the original six-step workflow.
 record.pending=null;record.approval={at:'saved',sha256:record.versions.find(v=>v.uuid===record.current_version).asset.sha256};
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 record.final_print={clean:record.versions.find(v=>v.uuid===record.current_version).asset,target:[1,1],finished:null,branded:null,proofs:[],settings:{}};await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 const paidBefore=calls.filter(x=>['prepare','run'].includes(x)).length;
 await page.getByRole('tab',{name:'2 Final Finish',exact:true}).click();
 await page.waitForFunction(()=>!!window.SBSFinishingBridge.getState().final_print&&!window.SBSFinishingBridge.isBusy());
 assert.notDeepEqual(record.final_print.target,[1,1],'Old treatment print target was not refreshed');assert.equal(await page.locator('#sbs-final-clean').getAttribute('src'),record.final_print.clean.url);assert.equal(await page.locator('#sbs-final-candidate').getAttribute('src'),record.final_print.clean.url);assert.equal(await page.locator('#sbs-final-assess').isEnabled(),true);await page.locator('#sbs-final-preset').selectOption('original');assert.equal(await page.locator('#sbs-final-assess').isEnabled(),false);await page.locator('#sbs-final-preset').selectOption('vintage');assert.equal(await page.locator('#sbs-final-assess').isEnabled(),true);
 await page.locator('#sbs-final-keep').click();await page.waitForFunction(()=>document.querySelector('[role=tab][aria-selected=true]').textContent==='3 Logo & Mockup');
 assert.equal(await page.locator('#sbs-final-download-file').inputValue(),'');
 assert.equal(await page.locator('#sbs-final-download-link').isVisible(),false);
 const downloadVersion=record.current_version,downloadCalls=calls.length;
 await page.locator('#sbs-final-download-file').selectOption('original:'+record.original.sha256);
 assert.equal(await page.locator('#sbs-final-download-link').getAttribute('href'),record.original.url);
 assert.equal(await page.locator('#sbs-final-download-link').getAttribute('download'),'source.png');
 const selectedDownload=page.waitForEvent('download');await page.locator('#sbs-final-download-link').click();const downloaded=await selectedDownload;
 assert.equal(downloaded.suggestedFilename(),'source.png');assert.deepEqual(fs.readFileSync(await downloaded.path()),Buffer.from(record.original.url.split(',')[1],'base64'),'Downloaded bytes differ from the explicitly selected source');
 assert.equal(record.current_version,downloadVersion);assert.equal(calls.length,downloadCalls,'Choosing a download sent a workspace mutation');
 await page.getByRole('tab',{name:'2 Final Finish',exact:true}).click();
 assert.equal(await page.locator('#sbs-final-treatment-download').getAttribute('href'),record.final_print.finished.asset.url);
 assert.equal(await page.locator('#sbs-final-treatment-download').textContent(),'Download kept-original PNG');
 await page.getByRole('tab',{name:'3 Logo & Mockup',exact:true}).click();
 assert.equal(record.final_print.finished.asset.sha256,record.final_print.clean.sha256,'Keep Original changed the selected bytes');assert.equal(record.final_print.finished.finish_status,'APPROVED_NO_ADDITIONAL_FINISH');
 assert.equal(calls.filter(x=>['prepare','run'].includes(x)).length,paidBefore,'Stage re-entry reran upscaling');
 await page.getByRole('tab',{name:'2 Final Finish',exact:true}).click();
 // Numeric controls are visible without opening a hidden panel.
 await page.locator('#sbs-final-preset').selectOption('vintage');await page.locator('#sbs-final-effect-tone').evaluate(e=>{e.value='20';e.dispatchEvent(new Event('input'));});
 await page.locator('#sbs-final-commit').click();await page.waitForFunction(()=>document.getElementById('sbs-final-committed').textContent==='Applied: 20 / 0 / 0 / 0');
 const beforePreview=JSON.stringify(record),previewCalls=calls.length;
 await page.locator('#sbs-final-apply').click();await page.waitForFunction(()=>document.getElementById('sbs-final-treatment-message').textContent.includes('Preview ready'));
 assert.equal(JSON.stringify(record),beforePreview,'Preview mutated saved workspace');assert.equal(calls.length,previewCalls);
 assert.equal(await page.locator('#sbs-final-save-preview').isEnabled(),true);
 await page.locator('#sbs-final-fullscreen').click();assert.equal(await page.locator('#sbs-final-view-dialog').isVisible(),true);
 await page.locator('#sbs-final-view-in').click();assert.match(await page.locator('#sbs-final-view-state').textContent(),/130%/);
 await page.locator('#sbs-final-view-toggle').click();await page.waitForFunction(()=>document.getElementById('sbs-final-view-state').textContent.startsWith('Source'));assert.match(await page.locator('#sbs-final-view-state').textContent(),/Source.*130%/);
 await page.locator('#sbs-final-view-close').click();await page.locator('#sbs-final-reset-effects').click();await page.locator('#sbs-final-commit').click();await page.waitForFunction(()=>document.getElementById('sbs-final-committed').textContent==='Applied: 0 / 0 / 0 / 0');
 await page.locator('#sbs-final-apply').click();await page.waitForFunction(()=>document.getElementById('sbs-final-treatment-message').textContent.includes('Preview ready'));
 assert.equal(await page.locator('#sbs-final-save-preview').isEnabled(),false,'Zero effect created redundant save');
 // Exact input, stepper isolation, explicit apply and persisted reload.
 for(const [k,v] of Object.entries({tone:40,fade:30,halftone:30,distress:10}))await page.locator('#sbs-final-effect-'+k).fill(String(v));
 assert.equal(await page.locator('#sbs-final-apply').isEnabled(),false,'Uncommitted edits allowed preview');
 await page.locator('[data-effect="tone"][data-delta="1"]').click();assert.equal(await page.locator('#sbs-final-effect-tone').inputValue(),'41');assert.equal(await page.locator('#sbs-final-effect-fade').inputValue(),'30');
 await page.locator('[data-effect="tone"][data-delta="-1"]').click();await page.locator('#sbs-final-commit').click();await page.waitForFunction(()=>document.getElementById('sbs-final-committed').textContent==='Applied: 40 / 30 / 30 / 10');
 await page.locator('#sbs-final-profile-save').click();await page.waitForFunction(()=>document.getElementById('sbs-final-profile-status').textContent.includes('Profile saved'));
 assert.deepEqual(preferences.profiles['40-30-30-10'].settings,{tone:40,fade:30,halftone:30,distress:10});
 // Re-render and asynchronous assessment must leave manually applied values alone.
 record.final_print.assessment={key:'new-assessment',preset:'vintage',status:'recommended',reason:'Try these',settings:{tone:1,fade:2,halftone:3,distress:4}};
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 assert.equal(await page.locator('#sbs-final-effect-tone').inputValue(),'40','Assessment replaced manual values');
 await page.locator('#sbs-final-use-recommendation').click();assert.equal(await page.locator('#sbs-final-effect-tone').inputValue(),'1');assert.equal(preferences.workspaces[record.uuid].tone,40);
 await page.locator('#sbs-final-profile').selectOption('40-30-30-10');page.once('dialog',d=>d.accept());await page.locator('#sbs-final-profile-load').click();await page.waitForFunction(()=>document.getElementById('sbs-final-committed').textContent==='Applied: 40 / 30 / 30 / 10');
 await page.locator('#sbs-final-effect-tone').fill('101');await page.locator('#sbs-final-commit').click();assert.match(await page.locator('#sbs-final-treatment-message').textContent(),/whole number/);
 await page.locator('#sbs-final-effect-tone').fill('40');await page.locator('#sbs-final-commit').click();await page.waitForFunction(()=>document.getElementById('sbs-final-apply').disabled===false);
 await page.locator('#sbs-final-entry > summary').click();await page.locator('[data-series-add="sbs-final-import-series"]').click();await page.locator('#sbs-series-name').fill('Dragonfly');await page.locator('#sbs-series-code').fill('DF');await page.locator('#sbs-series-save').click();await page.waitForFunction(()=>!document.getElementById('sbs-series-dialog').open);
 assert.equal(await page.locator('#sbs-final-import-series').inputValue(),'DF');assert.match(await page.locator('#sbs-af-series').textContent(),/Dragonfly/);
 await page.reload();await page.waitForFunction(()=>document.getElementById('sbs-af-series').textContent.includes('Dragonfly'));
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);await page.getByRole('tab',{name:'2 Final Finish',exact:true}).click();await page.waitForFunction(()=>document.getElementById('sbs-final-effect-tone').value==='40');assert.equal(await page.locator('#sbs-final-effect-distress').inputValue(),'10');
 for(const width of [1024,512,400]){await page.setViewportSize({width,height:900});if(width===512)await page.screenshot({path:'build/ui-check/numeric-controls-zoom.png',fullPage:true});const over=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);assert.equal(over,false,'Horizontal overflow at '+width);}
 await page.setViewportSize({width:1024,height:900});
 await page.getByRole('tab',{name:'3 Logo & Mockup',exact:true}).click();
 await page.locator('#sbs-final-save-brand').click();await page.waitForFunction(()=>window.SBSFinishingBridge.getState().final_print.brand_decision==='APPROVED_NO_LOGO'&&!window.SBSFinishingBridge.isBusy());
 await page.locator('#sbs-final-proofs').click();await page.waitForFunction(()=>document.querySelectorAll('#sbs-final-proofs-list figure').length===4);
 assert.match(await page.locator('#sbs-final-placement').textContent(),/UNKNOWN/);
 await page.locator('#sbs-final-package-review').check();await page.locator('#sbs-final-export').click();await page.waitForFunction(()=>!!window.SBSFinishingBridge.getState().final_print.archive&&!window.SBSFinishingBridge.isBusy());
 assert.equal(await page.getByRole('link',{name:'Open Studio Package',exact:true}).count(),1);
 await page.locator('#sbs-final-product').selectOption('premium');await page.waitForFunction(()=>document.getElementById('sbs-final-placement').textContent.includes('Premium'));
 assert.equal(await page.locator('#sbs-final-export').isEnabled(),false,'Unsaved placement retained an export tick');
 await page.setViewportSize({width:410,height:820});await page.screenshot({path:'build/ui-check/final-print-high-zoom.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'New stages overflow at narrow/high-zoom width');
 await page.getByRole('tab',{name:'1 Prepare & Check',exact:true}).click();assert.equal(await page.locator('[data-flow-step]').count(),6);
 await page.locator('#sbs-af-clear').click();await page.getByRole('tab',{name:'2 Final Finish',exact:true}).click();assert.equal(await page.locator('#sbs-final-apply').isEnabled(),false);assert.equal(await page.locator('#sbs-final-export').isEnabled(),false);assert.equal(await page.locator('#sbs-final-download-link').isVisible(),false);assert.equal(await page.locator('#sbs-final-download-file').inputValue(),'');assert.deepEqual(errors,[]);
 console.log('UI: three internal stages, direct re-entry without upscale, unchanged/no-duplicate source, no-logo decision, four proof assets, export links, unsaved-placement invalidation and new-artwork isolation passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
