'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('assets/js/photo-math.js','utf8'),{window});
const M=window.SBSPhotoMath;
const referenceShirt=[[.2,.1],[.8,.15],[.75,.9],[.25,.88]];
const targetShirt=[[.12,.22],[.72,.12],[.8,.82],[.18,.91]];
const print=[[.38,.32],[.58,.34],[.56,.65],[.39,.64]];
const mapped=M.mapQuadBetweenPlanes(print,referenceShirt,targetShirt);
const bounds=M.quadBoundsInPlane(print,referenceShirt);
assert.ok(bounds.width>.3&&bounds.width<.35&&bounds.height>.4&&bounds.height<.45,'Reference print dimensions must be measured within shirt body');
const from=M.inverse(M.homography(referenceShirt)),to=M.homography(targetShirt);
const expected=print.map(([x,y])=>M.point(to,...M.point(from,x,y)));
mapped.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-expected[i][k])<1e-10)));
// Mapping back to the reference garment must recover its original print bounds.
const back=M.mapQuadBetweenPlanes(mapped,targetShirt,referenceShirt);
back.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-print[i][k])<1e-9)));
assert.notDeepEqual(mapped,print,'target template geometry must control the transfer');
console.log('Reference print size and position map deterministically between shirt planes.');
