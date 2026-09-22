/* Real local Spine files, without a GPU: verify central scene bounds and fitting. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as runtime from '../assets/vendor/spine/4.2.120/spine-player.min.mjs';
import {chooseIdleAnimation,getLobbyViewport,fitLobbyViewport} from './spine-viewer.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const data={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/media/catalog.js'),'utf8'),data);
const viewports=new Map();
let count=0;
for(const student of Object.values(data.window.PA_MEDIA_CATALOG.students)) {
  const lobby=student.spines.find(item=>item.ready);
  if(!lobby)continue;
  const atlas=new runtime.TextureAtlas(fs.readFileSync(path.join(root,lobby.atlas),'utf8'));
  const skeletonData=new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas)).readSkeletonData(fs.readFileSync(path.join(root,lobby.skel)));
  const skeleton=new runtime.Skeleton(skeletonData);
  const state=new runtime.AnimationState(new runtime.AnimationStateData(skeletonData));
  const idle=chooseIdleAnimation(skeletonData.animations.map(a=>a.name));
  state.setAnimation(0,idle,true);state.apply(skeleton);skeleton.updateWorldTransform(runtime.Physics.update);
  const bones=skeleton.bones.map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d]);
  const bounds=getLobbyViewport(skeleton,runtime,lobby.viewport);
  assert.ok(bounds && Object.values(bounds).every(Number.isFinite),student.name);
  assert.ok(bounds.width>100 && bounds.height>100,student.name);
  assert.deepEqual(skeleton.bones.map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d]),bones,'Framing must not pose or mutate bones');
  for(const [width,height] of [[1280,720],[720,1280],[375,230],[1920,600],[400,400]]) {
    const fit=fitLobbyViewport(bounds,width,height,'cover');
    assert.ok(Math.abs(fit.width/fit.height-width/height)<1e-8);
    assert.ok(fit.width<=bounds.width+1e-7 && fit.height<=bounds.height+1e-7);
    assert.ok(Math.abs((fit.x+fit.width/2)-(bounds.x+bounds.width/2))<1e-7);
    assert.ok(Math.abs((fit.y+fit.height/2)-(bounds.y+bounds.height/2))<1e-7);
    assert.deepEqual(fitLobbyViewport(bounds,width,height,'contain'),bounds);
  }
  viewports.set(student.id,bounds);count++;
}
assert.equal(count,38);
const hina=viewports.get(11),mika=viewports.get(22),haruka=viewports.get(7);
assert.ok(hina.width>3400 && hina.width<4000,'Hina central BG, not 16k-wide intro panels');
assert.ok(Math.abs(hina.x+hina.width/2)<100,'Hina central panel stays centered');
assert.ok(mika.width>3300 && mika.width<3700 && mika.x<-1600,'Mika includes left and right background pieces');
assert.ok(Math.abs(mika.x+mika.width/2)<30,'Mika is not centered on the isolated right-hand BG_01');
assert.ok(haruka.width>3300,'Haruka includes the garden, not just one wall');
const override={x:1,y:2,width:100,height:80};
assert.deepEqual(getLobbyViewport({drawOrder:[]},runtime,override),override);
assert.equal(getLobbyViewport({drawOrder:[]},runtime),null);
for(const [w,h] of [[0,720],[1280,0],[-1,20],[Infinity,20]])assert.equal(fitLobbyViewport(override,w,h),null);
assert.equal(fitLobbyViewport(null,1280,720),null);
console.log(`PASS ${count} real default lobbies: central bounds, split backgrounds, non-mutating fit/fill in five aspect ratios, explicit overrides and zero-sized hosts`);
