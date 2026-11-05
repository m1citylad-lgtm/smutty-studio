'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/js/transparency-correction.js','utf8'),context);
const scan=context.window.SBSPrintVisibility.analyze;
const w=600,h=600,target={width:2,height:2};
function image(){return new Uint8ClampedArray(w*h*4);}
function rect(d,x,y,rw,rh,c=[90,35,15,255]){for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)d.set(c,(yy*w+xx)*4);}
function body(d){rect(d,150,100,250,220);}
(async()=>{
 let data=image();body(data);for(let y=350;y<550;y+=10)for(let x=50;x<550;x+=10)rect(data,x,y,1,1);rect(data,80,80,2,2);
 let result=await scan(data,w,h,target);assert.equal(result.markers.length,0,'Isolated pixels or tiny disconnected specks became print warnings');
 // Alpha-zero RGB is invisible and must never become a print defect.
 for(let i=0;i<data.length;i+=4)if(data[i+3]===0){data[i]=255;data[i+1]=0;data[i+2]=200;}
 assert.equal((await scan(data,w,h,target)).markers.length,0,'Hidden RGB was flagged');
 data=image();body(data);rect(data,50,400,12,12);result=await scan(data,w,h,target);
 assert.equal(result.markers.length,1,'Visible detached block was missed');assert.equal(result.markers[0].categories[0],'stray_pixel');assert.ok(result.markers[0].widthMm>1&&result.markers[0].widthMm<1.1);
 assert.equal((await scan(data,w,h,{width:.5,height:.5})).markers.length,0,'Same mark was not filtered when printed smaller');
 data=image();body(data);rect(data,50,400,50,1);result=await scan(data,w,h,target);assert.equal(result.markers.length,1,'Long thin detached line was missed');
 data=image();body(data);rect(data,180,99,60,1,[240,0,240,200]);result=await scan(data,w,h,target);assert.ok(result.markers.some(m=>m.categories[0]==='edge_fringe'),'Continuous contrasting edge was missed');
 data=image();body(data);rect(data,180,99,2,1,[240,0,240,200]);assert.equal((await scan(data,w,h,target)).markers.length,0,'Tiny edge speck was flagged');
 data=image();body(data);rect(data,50,400,60,60,[150,150,150,110]);const before=new Uint8ClampedArray(data);result=await scan(data,w,h,target);
 assert.equal(result.markers.length,1,'Broad partial-alpha effect was missed or duplicated');assert.equal(result.markers[0].categories[0],'solid_opacity');assert.equal(result.markers[0].advisory,true);assert.deepEqual(data,before,'Scanning altered smoke alpha or source pixels');
 data=image();body(data);rect(data,50,400,12,12);rect(data,70,400,12,12);result=await scan(data,w,h,target);assert.equal(result.markers.length,1,'Neighbouring related areas were not grouped');
 const doubled=new Uint8ClampedArray(1200*1200*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++)doubled.set(data.subarray((y*w+x)*4,(y*w+x)*4+4),((y*2+yy)*1200+x*2+xx)*4);
 const high=await scan(doubled,1200,1200,target);assert.equal(high.markers.length,result.markers.length,'Resolution changed the physical screening result');assert.ok(Math.abs(high.markers[0].widthMm-result.markers[0].widthMm)<.01,'Printed dimensions changed with resolution');
 await assert.rejects(scan(data,w,h,{width:-1,height:2}),/print size/);
 console.log('PASS: print-size-aware connected blocks/lines, isolated-pixel and invisible-RGB suppression, smoke review without alpha edits, grouping and resolution invariance.');
})().catch(e=>{console.error(e);process.exitCode=1;});
