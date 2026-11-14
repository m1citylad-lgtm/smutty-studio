const assert=require('node:assert/strict'),fs=require('node:fs');
const {palette,homography,inverse,point,frame,cropRect,recolour,composite,artRect,detectMask}=require('../assets/js/mockups.js');
assert.equal(palette.length,19);assert.equal(palette[7][1],'#BED4E9');
const quad=[[.2,.15],[.8,.2],[.7,.85],[.25,.8]],m=homography(quad),inv=inverse(m);
[[0,0],[1,0],[1,1],[0,1]].forEach((p,i)=>point(m,...p).forEach((v,k)=>assert.ok(Math.abs(v-quad[i][k])<1e-9)));
for(const p of [[.5,.5],[.23,.78]])point(inv,...point(m,...p)).forEach((v,k)=>assert.ok(Math.abs(v-p[k])<1e-9));
for(let a=0;a<9;a++){const f=frame(800,600,.5625,a);assert.equal(f.width,800);assert.ok(f.height>=600);assert.equal(f.x,0);assert.equal(f.y,Math.round((f.height-600)*Math.floor(a/3)/2));}
assert.deepEqual(frame(600,800,2,2),{width:1600,height:800,x:1000,y:0});
for(const r of [1,.8,.75,2/3,.5625,16/9,1.91,4/3]){const c=cropRect(900,1200,r);assert.ok(Math.abs(c.width/c.height-r)<1e-10);assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=900.001&&c.y+c.height<=1200.001);}
const source=new Uint8ClampedArray([220,215,210,255,80,90,100,255,0,0,0,0]),mask=new Uint8ClampedArray([255,255,255,255,0,0,0,0,0,0,0,0]);
const out=recolour(source.slice(),mask,'#DD2120');assert.notDeepEqual(out.slice(0,3),source.slice(0,3));assert.deepEqual(out.slice(4),source.slice(4));assert.equal(out[3],255);
const w=100,h=120,photo=new Uint8ClampedArray(w*h*4),shirt=new Uint8ClampedArray(w*h*4);for(let i=0;i<photo.length;i+=4){photo[i]=photo[i+1]=photo[i+2]=220;photo[i+3]=255;if(i/4%w>20&&i/4%w<80){shirt[i+3]=255;}}
const artwork=new Uint8ClampedArray(20*30*4);for(let i=0;i<artwork.length;i+=4){artwork[i]=200;artwork[i+1]=20;artwork[i+3]=255;}
const d=photo.slice(),snapshot=artwork.slice(),p={x:.5,y:.5,width:.6},q=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],s=composite(d,photo,shirt,w,h,artwork,20,30,q,p);assert.ok(s.ink>100);assert.deepEqual(artwork,snapshot);assert.equal(d[0],photo[0]);assert.equal(d[3],255);
const r=artRect(p,20,30,q,w,h);assert.ok(Math.abs(r.height/r.width-(30/20)*(w/h))<1e-9,'Aspect ratio distorted');
const detected=detectMask(photo,w,h,.5,.4);assert.ok(detected.some((v,i)=>i%4===3&&v));assert.equal(detected[3],0);
const template=fs.readFileSync('templates/mockups.php','utf8');assert.match(template,/Finish &amp; Check/);assert.match(template,/<button type="button" id="sbs-mu-download" class="sbs-button primary">Download<\/button>/);assert.ok(!/id="sbs-mu-download"[^>]*(disabled|hidden)/.test(template));
assert.ok(template.indexOf('id="sbs-mu-search"')<template.indexOf('id="sbs-mu-artwork"'));
const php=fs.readFileSync('templates/studio.php','utf8');assert.match(php,/data-primary-tab="settings"[\s\S]*data-primary-tab="mockups"/);assert.match(php,/wp_print_scripts\([\s\S]*'sbs-mockups'/);assert.match(php,/wp_print_styles\([\s\S]*'sbs-mockups'/);
const stylesheet=fs.readFileSync('assets/css/mockups.css','utf8');
const mockupJs=fs.readFileSync('assets/js/mockups.js','utf8');
assert.match(template,/Bright luminous green shading shows the selected shirt fabric, NOT the print area/);
assert.match(mockupJs,/m\.data\[i\]=57;m\.data\[i\+1\]=255;m\.data\[i\+2\]=20;m\.data\[i\+3\]=Math\.round\(m\.data\[i\+3\]\*\.58\)/);
assert.match(stylesheet,/#sbs-mu-cal-canvas\{max-height:none;border:0\}/);
assert.match(stylesheet,/#sbs-mockups #sbs-mu-cal-dialog\{border:0;box-shadow:none\}/);
console.log('Mock-ups: palette, projective geometry, nine anchors, crop ratios, mask-only recolour, protected artwork/alpha, vivid green calibration mask, frameless editor and independent download passed.');
