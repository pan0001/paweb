/** CPU transform regression. Texture decoding is stubbed; no GPU claims here. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/GLTFLoader.js';
import {prepareAnimations,bindHalo} from './ba-model-materials.js';
import {getModelBounds,createModelAnimationPlayer} from './model-viewer.js';
const base=new URL('../',import.meta.url);
const target='assets/media/models/404/Kayoko_Original.glb';
const momoiTarget='assets/media/models/421/Momoi_Original.glb';
const catalog=JSON.parse(await readFile(new URL('assets/media/catalog.json',base),'utf8'));
const files=[...new Set(Object.values(catalog.students).flatMap(s=>s.models.filter(m=>m.type==='body').map(m=>m.file)))];
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
async function load(file) {
  const bytes=await readFile(new URL(file,base));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function dispose(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    if(o.skeleton)skeletons.add(o.skeleton);
    for(const m of [o.material].flat().filter(Boolean)) {
      materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
    }
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  textures.forEach(t=>{t.dispose();t.image?.close?.();});skeletons.forEach(s=>s.dispose());
}
try {
  // Reproduce the user's oversized camera bounds with the uncorrected clips.
  const broken=await load(target);
  bindHalo(broken.scene);
  const brokenMixer=new THREE.AnimationMixer(broken.scene);
  brokenMixer.clipAction(broken.animations.find(c=>/_Formation_Idle$/.test(c.name))).play();
  brokenMixer.update(0);
  const oldHeight=getModelBounds(broken.scene).getSize(new THREE.Vector3()).y;
  assert.ok(oldHeight>.02,'Original idle must reproduce the detached high halo');
  brokenMixer.stopAllAction();brokenMixer.uncacheRoot(broken.scene);dispose(broken.scene);

  let changed=0,unchangedModels=0;
  for(const file of files) {
    const gltf=await load(file),root=gltf.scene;
    const original=JSON.stringify(gltf.animations.map(c=>c.toJSON()));
    const clips=prepareAnimations(root,gltf.animations);
    assert.equal(JSON.stringify(gltf.animations.map(c=>c.toJSON())),original,'Never mutate the source animation objects');
    if(file===momoiTarget) { dispose(root);continue; }
    if(file!==target) {
      assert.equal(clips,gltf.animations,file+': no animation changes for other models');
      unchangedModels++;dispose(root);continue;
    }
    const halo=root.getObjectByName('HaloRoot'),mesh=root.getObjectByName('Kayoko_Original_Halo');
    const head=root.getObjectByName('Bip001_Head');
    assert.equal(clips.length,gltf.animations.length);
    for(let c=0;c<clips.length;c++) {
      const src=gltf.animations[c],fixed=clips[c];
      if(fixed!==src)changed++;
      assert.equal(fixed.name,src.name);assert.equal(fixed.duration,src.duration);assert.equal(fixed.blendMode,src.blendMode);
      assert.equal(fixed.tracks.length,src.tracks.length);
      for(let t=0;t<fixed.tracks.length;t++) {
        const a=src.tracks[t],b=fixed.tracks[t];
        assert.equal(a.name,b.name);assert.equal(a.getInterpolation(),b.getInterpolation());assert.deepEqual(a.times,b.times);
        if(a.name==='Kayoko_Original_Halo.position') {
          for(let i=0;i<b.values.length;i+=3)assert.ok(new THREE.Vector3().fromArray(b.values,i).distanceTo(mesh.position)<1e-8);
        } else assert.deepEqual(a.values,b.values,'Body, face, weapon and other animation keys must stay exact');
      }
    }
    assert.equal(changed,15,'Recognize exactly 15 redundant constant position tracks');
    assert.ok(prepareAnimations(root,clips).every((c,i)=>c===clips[i]),'Repeated preparation must not subtract the offset twice');
    // A real moving halo position is not this constant rest-space export defect.
    const moving=new THREE.AnimationClip('moving',1,[new THREE.VectorKeyframeTrack('Kayoko_Original_Halo.position',[0,1],[0,.01081659086,-.0030203145,0,.01181659086,-.0030203145])]);
    assert.equal(prepareAnimations(root,[moving])[0],moving);
    bindHalo(root);assert.equal(halo.parent,head);
    getModelBounds(root);
    const relative=head.worldToLocal(mesh.getWorldPosition(new THREE.Vector3()));
    const mixer=new THREE.AnimationMixer(root);
    let fixedHeight=0;
    for(const clip of clips) {
      mixer.stopAllAction();const action=mixer.clipAction(clip).play();
      for(const time of [0,clip.duration/2,Math.max(0,clip.duration-.001)]) {
        action.time=time;mixer.update(0);getModelBounds(root);
        const point=head.worldToLocal(mesh.getWorldPosition(new THREE.Vector3()));
        assert.ok(point.distanceTo(relative)<1e-7,clip.name+': halo must retain its authored head-relative offset');
      }
      if(/_Formation_Idle$/.test(clip.name)) {
        action.time=0;mixer.update(0);fixedHeight=getModelBounds(root).getSize(new THREE.Vector3()).y;
        assert.ok(fixedHeight<.014&&fixedHeight>.01,'Default fit should include a nearby halo, not double the body height');
      }
    }
    // Crossfading a repaired track into an untracked idle must not pop the halo.
    mixer.stopAllAction();
    const from=mixer.clipAction(clips.find(c=>/_Formation_Idle$/.test(c.name))).play();mixer.update(.2);
    const to=mixer.clipAction(clips.find(c=>/_Normal_Idle$/.test(c.name))).reset().play();from.crossFadeTo(to,.2,false);
    for(let i=0;i<6;i++) {
      mixer.update(.05);getModelBounds(root);
      assert.ok(head.worldToLocal(mesh.getWorldPosition(new THREE.Vector3())).distanceTo(relative)<1e-7);
    }
    mixer.stopAllAction();mixer.uncacheRoot(root);
    const player=createModelAnimationPlayer(mixer,clips);
    const checkBlendedHalo=()=>{
      getModelBounds(root);
      assert.ok(head.worldToLocal(mesh.getWorldPosition(new THREE.Vector3())).distanceTo(relative)<1e-7,'Smooth transitions must preserve the corrected head-relative halo');
    };
    player.start();
    player.update(clips.find(c=>/_Victory_Start$/.test(c.name)).duration+.01);
    for(let i=0;i<20;i++) {
      if(i===3||i===5)player.pickUp();
      player.update(.02);checkBlendedHalo();
    }
    player.update(clips.find(c=>/_Formation_Pickup$/.test(c.name)).duration+.01);
    for(let i=0;i<15;i++){player.update(.02);checkBlendedHalo();}
    player.dispose();mixer.uncacheRoot(root);dispose(root);
    console.log(`PASS Kayoko: ${changed} corrected tracks, ${clips.length} clips × 3 poses, crossfade and first-fit height ${oldHeight.toFixed(6)} → ${fixedHeight.toFixed(6)}`);
  }
  assert.equal(unchangedModels,37);
  console.log('PASS All other 37 GLBs keep their original animation arrays; source clips and non-halo keys are unchanged');

  const brokenMomoi=await load(momoiTarget);
  bindHalo(brokenMomoi.scene);
  const oldMixer=new THREE.AnimationMixer(brokenMomoi.scene);
  oldMixer.clipAction(brokenMomoi.animations.find(c=>/_Formation_Idle$/.test(c.name))).play();oldMixer.update(0);
  const oldMomoiHeight=getModelBounds(brokenMomoi.scene).getSize(new THREE.Vector3()).y;
  assert.ok(oldMomoiHeight>.02,'Momoi previously framed the halo twice as high');
  oldMixer.stopAllAction();oldMixer.uncacheRoot(brokenMomoi.scene);dispose(brokenMomoi.scene);

  const momoi=await load(momoiTarget),root=momoi.scene;
  const original=JSON.stringify(momoi.animations.map(c=>c.toJSON()));
  const halo=root.getObjectByName('HaloRoot'),mesh=root.getObjectByName('Momoi_Original_Halo');
  const clips=prepareAnimations(root,momoi.animations);
  assert.equal(JSON.stringify(momoi.animations.map(c=>c.toJSON())),original);
  assert.equal(clips.filter((c,i)=>c!==momoi.animations[i]).length,2);
  for(let c=0;c<clips.length;c++) {
    const src=momoi.animations[c],fixed=clips[c];
    assert.equal(fixed.duration,src.duration);assert.equal(fixed.tracks.length,src.tracks.length);
    for(let t=0;t<fixed.tracks.length;t++) {
      const a=src.tracks[t],b=fixed.tracks[t];
      assert.equal(a.name,b.name);assert.deepEqual(a.times,b.times);
      if(a.name==='Momoi_Original_Halo.position') {
        for(let i=0;i<b.values.length;i+=3) {
          const restored=new THREE.Vector3().fromArray(b.values,i).applyMatrix4(halo.matrix);
          assert.ok(restored.distanceTo(new THREE.Vector3().fromArray(a.values,i))<1e-8,'Preserve authored character-space offset');
        }
      } else assert.deepEqual(a.values,b.values,'Do not alter body/face/weapon animation');
    }
  }
  assert.ok(prepareAnimations(root,clips).every((c,i)=>c===clips[i]),'Momoi correction is idempotent');
  const moving=new THREE.AnimationClip('Momoi_Original_Victory_End',1,[new THREE.VectorKeyframeTrack('Momoi_Original_Halo.position',[0,1],[0,.009990663267672062,-.0018911899533122778,0,.010990663267672062,-.0018911899533122778])]);
  assert.equal(prepareAnimations(root,[moving])[0],moving,'Do not rewrite truly animated offsets');
  bindHalo(root);
  const head=halo.parent,mixer=new THREE.AnimationMixer(root);
  let momoiHeight;
  for(const clip of clips) {
    mixer.stopAllAction();const action=mixer.clipAction(clip).play();
    for(const time of [0,clip.duration/2,Math.max(0,clip.duration-.001)]) {
      action.time=time;mixer.update(0);const box=getModelBounds(root);
      assert.ok(Number.isFinite(box.getSize(new THREE.Vector3()).length()));
      assert.ok(head.worldToLocal(mesh.getWorldPosition(new THREE.Vector3())).length()<.006,'Halo must stay near the head in every clip');
      if(/_Formation_Idle$/.test(clip.name))momoiHeight=box.getSize(new THREE.Vector3()).y;
    }
  }
  assert.ok(momoiHeight>.01 && momoiHeight<.014);
  mixer.stopAllAction();mixer.uncacheRoot(root);
  const player=createModelAnimationPlayer(mixer,clips);player.start();
  let last;
  for(let step=0;step<600;step++) {
    if(step===230 || step===240)player.pickUp();
    player.update(1/60);getModelBounds(root);
    const local=head.worldToLocal(mesh.getWorldPosition(new THREE.Vector3()));
    if(last)assert.ok(local.distanceTo(last)<.00004,'Halo must not pop between Start, End and Pickup');
    last=local;
  }
  player.dispose();mixer.uncacheRoot(root);dispose(root);
  console.log(`PASS Momoi: two corrected tracks, ${clips.length} clips, repeated Pickup blends; first-fit height ${oldMomoiHeight.toFixed(6)} → ${momoiHeight.toFixed(6)}`);
} finally { delete globalThis.self;delete globalThis.createImageBitmap; }
