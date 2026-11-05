'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const svg='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect x="30" y="30" width="140" height="180" fill="#b05b25"/></svg>').toString('base64');
let record={uuid:'aaaaaaaa-0000-4000-8000-000000000001',title:'Disposable workflow test',original:{id:1,uuid:'asset-original',filename:'source.png',mime:'image/png',sha256:'original',url:svg},original_qa:{width:4200,height:4800,effective_ppi:300,alpha:'Transparency detected (sampled)',warnings:[],pixel_review:{status:'sampled',findings:[]},export_metadata:{}},versions:[],current_version:null,status:'Awaiting Finishing',next_action:'Check artwork',revision:1,audit:[]};
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
 else if(p.action==='flow_drive')record.flow.archive={approval_at:record.approval.at,verified:true,candidate_sha256:'print-hash',url:'https://drive.google.com/file/d/test/view'};
 record.revision++;return record;
}
(async()=>{
 const args={headless:true};if(process.env.SBS_CHROMIUM_PATH){args.executablePath=process.env.SBS_CHROMIUM_PATH;args.args=['--no-sandbox','--disable-dev-shm-usage'];}
 const browser=await chromium.launch(args);try{
 const page=await browser.newPage({viewport:{width:1024,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{let data,url=route.request().url();if(url.endsWith('/google/status'))data={configured:false,connected:false};else if(url.endsWith('/references'))data={references:[]};else if(url.endsWith('/checks'))data={checks:[]};else if(url.endsWith('/action')){const payload=route.request().postDataJSON();if(payload.action==='poll'&&pollFailure){calls.push('poll');return route.fulfill({status:500,contentType:'text/html',body:pollFailure});}data=mockAction(payload);}else if(url.endsWith('/finishing'))data={records:[record]};else data=record;await route.fulfill({status:data.error?500:200,contentType:'application/json',body:JSON.stringify(data.error?{message:data.error}:data)});});
 let html=read('templates/finishing.php').replace(/<\?php require SBS_PLUGIN_DIR .*?\?>/,read('templates/finishing-flow.php')).replace(/<\?php[\s\S]*?\?>/g,'');
 const styles=['studio.css','studio-theme.css','finishing.css','transparency-correction.css','finishing-flow.css'].map(n=>'<style>'+read('assets/css/'+n)+'</style>').join(''),scripts=['flat-background.js','finishing.js','transparency-correction.js','finishing-flow.js'].map(n=>'<script>'+read('assets/js/'+n)+'</script>').join('');
 await page.setContent('<!doctype html><html><head><base href="http://studio.test/"><meta name="viewport" content="width=device-width,initial-scale=1">'+styles+'</head><body><main id="sbs-app" data-rest="http://studio.test/api/" data-authenticated="1" data-finishing-csrf="test">'+html+read('templates/finishing-settings.php').replace(/<\?php[\s\S]*?\?>/g,'')+'</main>'+scripts+'</body></html>');
 assert.deepEqual(errors,[]);assert.match(await page.locator('#sbs-flow-step-1 .sbs-flow-status').textContent(),/Next.*Choose your artwork/);assert.equal(await page.locator('[data-flow-step]').count(),6);const titles=await page.locator('[data-flow-step] h2:visible').allTextContents();assert.deepEqual(titles,['1. Choose artwork and print size','2. Check the artwork','3. Fix the action list','4. Upscale and prepare the print file','5. Check the finished artwork','6. Approve and save your ZIP']);
 await page.locator('#sbs-flow-connect').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-google-setup').open);assert.equal(await page.locator('#sbs-flow-google-setup').getAttribute('open'),'');assert.match(await page.locator('#sbs-google-status').textContent(),/One-time Google Drive setup/);assert.equal(await page.locator('#sbs-google-connect').isEnabled(),false);
 await page.evaluate(r=>window.dispatchEvent(new CustomEvent('sbs-finishing-open',{detail:r})),record);
 await page.locator('#sbs-flow-check').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-check-status').textContent.includes('Check complete'),null,{timeout:10000}).catch(async e=>{console.error('Check debug',await page.locator('#sbs-flow-check-status').textContent(),await page.locator('#sbs-af-progress').textContent(),calls,errors);throw e;});
 assert.deepEqual(calls.filter(x=>x.startsWith('flow_review')),['flow_review:whole','flow_review:regions','flow_review:custom']);assert.equal(await page.locator('[data-af-method="print_png"]').isEnabled(),true,'Optional print-area scan blocked preparation');
 await page.locator('#sbs-af-correction-open').click();await page.waitForFunction(()=>document.getElementById('sbs-af-correction-open').dataset.state==='done');await page.locator('#sbs-af-correction-close').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-next-title').textContent.includes('Upscale if needed'));
 assert.equal(await page.locator('[data-af-method="upscale"]').isEnabled(),false,'Enough pixels must skip paid enlargement');await page.locator('[data-af-method="print_png"]').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-next-title').textContent.includes('final check'));
 await page.locator('#sbs-af-ai-review-run').click();await page.waitForFunction(()=>document.getElementById('sbs-af-ai-status').textContent.includes('Comparison complete'),null,{timeout:8000}).catch(async e=>{console.error('Comparison debug',await page.locator('#sbs-af-ai-status').textContent(),await page.locator('#sbs-af-progress').textContent(),calls,errors);throw e;});await page.locator('#sbs-flow-final-pixels').click();await page.waitForFunction(()=>document.getElementById('sbs-af-correction-open').dataset.state==='done');await page.locator('#sbs-af-correction-close').click();for(const box of await page.locator('[data-af-check]').all())await box.check();
 await page.waitForFunction(()=>!document.getElementById('sbs-af-approve').disabled);await page.locator('#sbs-af-approve').click();await page.waitForFunction(()=>!document.getElementById('sbs-flow-drive').disabled);await page.locator('#sbs-flow-drive').click();await page.waitForFunction(()=>document.getElementById('sbs-flow-drive-status').textContent.includes('Finished'));
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
 await page.waitForFunction(()=>!window.SBSFinishingBridge.isBusy());
 assert.deepEqual(seenLocalStages,['candidate','checks','complete']);assert.deepEqual(calls.slice(beforeLocalCalls),['poll','poll','poll'],'Local recovery submitted another upscale');
 assert.equal(record.current_version,'completed-upscale');assert.equal(record.pending,null);
 assert.match(await page.locator('[data-af-stage-report="upscale"]').textContent(),/Completed/);
 assert.match(await page.locator('#sbs-af-progress').textContent(),/AI upscale finished/);
 console.log('UI: existing local finishing stages show progress/spinner, save completion and consume only status polls with no prepare/run requests.');
 fs.mkdirSync('build/ui-check',{recursive:true});await page.screenshot({path:'build/ui-check/desktop.png',fullPage:true});await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'build/ui-check/tablet.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Tablet layout overflows horizontally');
 await page.locator('#sbs-af-clear').click();assert.match(await page.locator('#sbs-flow-next-title').textContent(),/Choose your artwork/);assert.equal(await page.locator('#sbs-flow-drive').isEnabled(),false);assert.equal(await page.locator('#sbs-flow-list li').count(),0);assert.equal(await page.locator('#sbs-flow-drive-status').textContent(),'');assert.match(await page.locator('#sbs-flow-step-1 .sbs-flow-status').textContent(),/Next.*Choose your artwork/);assert.equal(await page.locator('#sbs-flow-preview').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('UI: six ordered sections, actual button flow through review/pixel scan/print/final check/approval/archive, and New artwork reset passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
