const assert=require('node:assert/strict');
const {pixels}=require('../assets/js/treatment.js');
const source=new Uint8ClampedArray([100,120,160,255,30,60,90,128,0,0,0,0,240,220,200,255]);
const zero={tone:0,fade:0,halftone:0,distress:0};
assert.deepEqual(pixels(source.slice(),2,2,zero),source);
const s={tone:40,fade:20,halftone:30,distress:20},out=pixels(source.slice(),2,2,s);
for(let i=3;i<source.length;i+=4)assert.equal(out[i],source[i]);
assert.notDeepEqual(out,source);
assert.deepEqual(pixels(source.slice(),2,2,s),out,'Preview is not deterministic');
assert.deepEqual(pixels(source.slice(),2,2,zero),source,'Reducing strengths did not restore source');
console.log('Pixel treatment: zero identity, preserved alpha, deterministic reversible source-based previews passed.');

const {differences}=require('../assets/js/treatment.js');
assert.equal(differences(source,source).count,0);
const w=300,h=300,flat=new Uint8ClampedArray(w*h*4);for(let i=0;i<flat.length;i+=4){flat[i]=90;flat[i+1]=100;flat[i+2]=110;flat[i+3]=255;}
const wear=pixels(flat.slice(),w,h,{...zero,distress:100});
assert.ok(new Set(Array.from({length:w*h},(_,i)=>wear[i*4])).size>10,'Ink wear lacks varied density');
const dots=pixels(flat.slice(),w,h,{...zero,halftone:100});
let repeated=0;for(let y=0;y<h-4;y++)for(let x=0;x<w-4;x++)if(dots[(y*w+x)*4]===dots[((y+4)*w+x+4)*4])repeated++;
assert.ok(repeated<(w-4)*(h-4)*.98,'Halftone repeats as an exact small digital tile');
for(const effect of ['tone','fade','halftone','distress'])assert.ok(differences(flat,pixels(flat.slice(),w,h,{...zero,[effect]:100})).count>0,effect+' made no distinct contribution');
console.log('Varied ink density, non-repeating screen, individual effect contributions and exact difference detection passed.');
