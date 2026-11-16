(function(){'use strict';
const palette=[['Black','#101010'],['White','#FAFAFA'],['Light Grey Heather','#B1B2B6'],['Charcoal Heather','#4B4B57'],['Navy','#0E152F'],['Royal Blue','#2F4CB4'],['Cream / Off-white Heather','#F7F4E8'],['Pale Blue','#BED4E9'],['Red','#DD2120'],['Purple','#531963'],['Burgundy','#5A1F33'],['Golden Yellow','#FFCF6D'],['Orange','#F89F2B'],['Warm Dark Grey','#494440'],['Lime / Apple Green','#A1C740'],['Green','#0E8C38'],['Olive Green','#3E532C'],['Very Dark Forest Green','#12290C'],['Light Pink','#FFC7CA']];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function homography(q){const a=[],b=[];[[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{const [x,y]=q[i];a.push([u,v,1,0,0,0,-x*u,-x*v]);b.push(x);a.push([0,0,0,u,v,1,-y*u,-y*v]);b.push(y);});for(let i=0;i<8;i++){let pivot=i;for(let k=i+1;k<8;k++)if(Math.abs(a[k][i])>Math.abs(a[pivot][i]))pivot=k;[a[i],a[pivot]]=[a[pivot],a[i]];[b[i],b[pivot]]=[b[pivot],b[i]];const f=a[i][i];if(Math.abs(f)<1e-10)throw Error('Print-area corners overlap. Recalibrate this photo.');for(let j=i;j<8;j++)a[i][j]/=f;b[i]/=f;for(let k=0;k<8;k++)if(k!==i){const f=a[k][i];for(let j=i;j<8;j++)a[k][j]-=f*a[i][j];b[k]-=f*b[i];}}return [...b,1];}
function inverse(m){const [a,b,c,d,e,f,g,h,i]=m,k=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d],det=a*k[0]+b*k[3]+c*k[6];if(Math.abs(det)<1e-12)throw Error('Print-area geometry is invalid.');return k.map(v=>v/det);}
function point(m,x,y){const z=m[6]*x+m[7]*y+m[8];return [(m[0]*x+m[1]*y+m[2])/z,(m[3]*x+m[4]*y+m[5])/z];}
// Transfer a print rectangle from a photographed reference shirt to a saved
// template by shirt-relative coordinates. This avoids asking vision to guess
// an absolute print size on each new photograph.
function mapQuadBetweenPlanes(printQuad,referenceShirtQuad,targetShirtQuad){const from=inverse(homography(referenceShirtQuad)),to=homography(targetShirtQuad);return printQuad.map(p=>point(to,...point(from,p[0],p[1])));}
function quadBoundsInPlane(quad,plane){const inv=inverse(homography(plane)),pts=quad.map(p=>point(inv,p[0],p[1])),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
function frame(w,h,ratio,anchor=4){const width=Math.max(w,Math.ceil(h*ratio)),height=Math.max(h,Math.ceil(w/ratio));return {width,height,x:Math.round((width-w)*(anchor%3)/2),y:Math.round((height-h)*Math.floor(anchor/3)/2)};}
function cropRect(w,h,ratio,crop={cx:.5,cy:.5,scale:1}){let width=Math.min(w,h*ratio)*clamp(crop.scale,.15,1),height=width/ratio;return {x:clamp(crop.cx*w-width/2,0,w-width),y:clamp(crop.cy*h-height/2,0,h-height),width,height};}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function recolour(data,mask,hex){const colour=rgb(hex);for(let i=0;i<data.length;i+=4){const a=mask[i+3]/255;if(!a)continue;const l=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])/255;for(let k=0;k<3;k++){const v=colour[k]*Math.pow(l,.85)+(.04*Math.pow(l,8))*(255-colour[k]);data[i+k]=Math.round(data[i+k]*(1-a)+clamp(v,0,255)*a);}}return data;}
function artRect(p,aw,ah,quad,w,h){const qw=Math.hypot((quad[1][0]-quad[0][0])*w,(quad[1][1]-quad[0][1])*h),qh=Math.hypot((quad[3][0]-quad[0][0])*w,(quad[3][1]-quad[0][1])*h),height=p.width*ah/aw*qw/Math.max(qh,1);return {x:p.x-p.width/2,y:p.y-height/2,width:p.width,height};}
function composite(data,original,mask,w,h,art,aw,ah,quad,p){const inv=inverse(homography(quad)),r=artRect(p,aw,ah,quad,w,h);let ink=0,off=0,contrast=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const [u,v]=point(inv,x/w,y/h),sx=(u-r.x)/r.width*aw,sy=(v-r.y)/r.height*ah;if(sx<0||sy<0||sx>=aw||sy>=ah)continue;const ai=(Math.floor(sy)*aw+Math.floor(sx))*4,at=(y*w+x)*4,alpha=art[ai+3]/255;if(alpha<.04)continue;ink++;if(mask[at+3]<100)off++;const a=alpha*mask[at+3]/255,light=(.2126*original[at]+.7152*original[at+1]+.0722*original[at+2])/255,shade=.40+.60*Math.pow(light,.7);const il=.2126*art[ai]+.7152*art[ai+1]+.0722*art[ai+2],bl=.2126*data[at]+.7152*data[at+1]+.0722*data[at+2];contrast+=Math.abs(il-bl);for(let k=0;k<3;k++)data[at+k]=Math.round(data[at+k]*(1-a)+art[ai+k]*shade*a);}return {ink,off,meanContrast:ink?contrast/ink:0,rect:r};}
function detectMask(data,w,h,sx,sy){const result=new Uint8ClampedArray(w*h*4),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=clamp(Math.floor(sy*h),0,h-1)*w+clamp(Math.floor(sx*w),0,w-1),head=0,tail=1;queue[0]=start;seen[start]=1;const at=start*4,seed=(data[at]+data[at+1]+data[at+2])/3;while(head<tail){const n=queue[head++],i=n*4,x=n%w,y=Math.floor(n/w),l=(data[i]+data[i+1]+data[i+2])/3,sat=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);if(l<Math.max(45,seed-110)||sat>80||Math.abs(l-seed)>120||x<w*.06||x>w*.94||y<h*.08||y>h*.97||!data[i+3])continue;result[i]=result[i+1]=result[i+2]=255;result[i+3]=255;for(const next of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<h-1?n+w:-1])if(next>=0&&!seen[next]){seen[next]=1;queue[tail++]=next;}}return result;}
// A bounded colour/edge-aware suggestion, never an automatic garment classifier.
function smartRegion(pixels,w,h,x,y,mask,remove=false){
 x=clamp(Math.round(x),0,w-1);y=clamp(Math.round(y),0,h-1);
 const seen=new Uint8Array(w*h),region=new Uint8Array(w*h),queue=new Int32Array(w*h),start=y*w+x,seed=start*4;
 const radius=Math.max(8,Math.round(Math.min(w,h)*.16));let head=0,tail=1,count=0,bounded=false;queue[0]=start;seen[start]=1;
 while(head<tail){const n=queue[head++],at=n*4,px=n%w,py=Math.floor(n/w);if(!pixels[at+3]||(remove&&mask[at+3]<16))continue;
  if(Math.hypot(px-x,py-y)>radius){bounded=true;continue;}
  if(Math.max(...[0,1,2].map(k=>Math.abs(pixels[at+k]-pixels[seed+k])))>38)continue;
  region[n]=1;count++;
  for(const next of [px>0?n-1:-1,px<w-1?n+1:-1,py>0?n-w:-1,py<h-1?n+w:-1])if(next>=0&&!seen[next]){
   const ni=next*4;if(Math.max(...[0,1,2].map(k=>Math.abs(pixels[ni+k]-pixels[at+k])))>30)continue;seen[next]=1;queue[tail++]=next;
  }
 }
 return {region,count,bounded};
}
window.SBSPhotoMath={homography,inverse,point,mapQuadBetweenPlanes,quadBoundsInPlane,smartRegion};
})();
