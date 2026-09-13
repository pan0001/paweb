/** Real Yuuka prop regression; CPU skinning, source immutability and clip blends. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/GLTFLoader.js';
import {prepareAnimations, prepareYuukaPropAnimations} from './ba-model-materials.js';
import {createModelAnimationPlayer, MODEL_TRANSITION_SECONDS, getModelBounds, includeModelPropBounds} from './model-viewer.js';

const base=new URL('../',import.meta.url);
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
async function load(file) {
  const bytes=await readFile(new URL(file,base));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
function dispose(root) {
  const resources=new Set();
  root.traverse(o=>{
    if(o.geometry)resources.add(o.geometry);
    if(o.skeleton)resources.add(o.skeleton);
    for(const m of [o.material].flat().filter(Boolean)) {
      resources.add(m);
      for(const value of Object.values(m))if(value?.isTexture)resources.add(value);
    }
  });
  resources.forEach(value=>value.dispose());
}

try {
  const file='assets/media/models/354/CH0284.glb';
  const originalBytes=await readFile(new URL(file,base));
  const {scene:root,animations:source}=await load(file);
  const mesh=root.getObjectByName('CH0284_SkillProp_Outline');
  const sourceClips=JSON.stringify(source.map(clip=>clip.toJSON()));
  const geometry=mesh.geometry,skeleton=mesh.skeleton;
  const initialScales=skeleton.bones.map(b=>b.scale.toArray());
  const attributes=Object.values(geometry.attributes).map(a=>[a,Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice()]);
  const expected=new Map([
    ['CH0284_Victory_Start',['bone_wood','bone_peroro_02','bone_knife_01']],
    ['CH0284_Victory_End',['bone_wood','bone_peroro_02']],
    ['CH0284_Normal_Callsign',['bone_wood','bone_peroro_02','bone_knife_01','bone_knife_02','bone_knife_04']],
    ...[1,2,3,4,5].map(n=>['CH0284_Exs_Cutin_0'+n,
      ['bone_wood',...(n===1?['bone_knife_04']:[]),'bone_knife_11','bone_knife_12']])
  ]);
  const fixed=prepareAnimations(root,source);
  assert.equal(prepareYuukaPropAnimations(root,fixed),fixed,'Preparing twice never duplicates tracks');
  let added=0;
  for(let i=0;i<source.length;i++) {
    const before=source[i],after=fixed[i],bones=expected.get(before.name);
    if(!bones){assert.equal(after,before,'Unrelated clips stay identical');continue;}
    assert.equal(after.name,before.name);assert.equal(after.duration,before.duration);
    assert.equal(after.blendMode,before.blendMode);
    before.tracks.forEach((t,j)=>assert.equal(after.tracks[j],t,'Existing curves are shared without rewriting'));
    const tracks=after.tracks.slice(before.tracks.length);
    assert.deepEqual(tracks.map(t=>t.name).sort(),bones.map(n=>n+'.scale').sort());
    for(const track of tracks) {
      assert.deepEqual(Array.from(track.values),[1,1,1,1,1,1]);
      assert.deepEqual(Array.from(track.times),[0,before.duration]);added++;
    }
  }
  assert.equal(added,26);
  assert.deepEqual(skeleton.bones.map(b=>b.scale.toArray()),initialScales,'Rest scales are not globally enlarged');

  const framingMixer=new THREE.AnimationMixer(root);
  const idle=framingMixer.clipAction(fixed.find(c=>c.name==='CH0284_Formation_Idle')).play();
  framingMixer.update(0);
  const standing=getModelBounds(root);
  idle.stop();framingMixer.uncacheRoot(root);
  const transforms=[];
  root.traverse(o=>transforms.push([o,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));
  const framing=includeModelPropBounds(root,fixed,standing);
  assert.ok(framing.containsBox(standing));
  assert.ok(framing.min.y<standing.min.y || framing.max.z>standing.max.z,'Include the toy landing area');
  for(const [o,p,q,s] of transforms) {
    assert.deepEqual(o.position.toArray(),p);assert.deepEqual(o.quaternion.toArray(),q);assert.deepEqual(o.scale.toArray(),s);
  }
  const endAction=framingMixer.clipAction(fixed.find(c=>c.name==='CH0284_Victory_End')).play();
  framingMixer.update(0);assert.ok(framing.containsBox(getModelBounds(root)),'The restored toy fits the cached bounds');
  endAction.stop();framingMixer.uncacheRoot(root);

  // Bounds of vertices rigidly weighted to the barrel bone, using real skinning.
  const woodIndex=skeleton.bones.findIndex(b=>b.name==='bone_wood');
  const vertices=[];
  for(let i=0;i<geometry.attributes.position.count;i++)
    if(geometry.attributes.skinIndex.getX(i)===woodIndex&&geometry.attributes.skinWeight.getX(i)>.999)vertices.push(i);
  assert.ok(vertices.length>100);
  const point=new THREE.Vector3();
  function woodBounds() {
    root.updateMatrixWorld(true);skeleton.update();
    const box=new THREE.Box3();
    for(const i of vertices)box.expandByPoint(mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld));
    assert.ok([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite));
    return box;
  }
  function poseBounds(clip,time) {
    const mixer=new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();mixer.update(time);
    const box=woodBounds();
    mixer.stopAllAction();mixer.uncacheRoot(root);return box;
  }
  for(const [name] of expected) {
    const before=source.find(c=>c.name===name),after=fixed.find(c=>c.name===name);
    for(const time of [0,before.duration/2,before.duration-.001]) {
      const raw=poseBounds(before,time).getSize(new THREE.Vector3());
      const restored=poseBounds(after,time).getSize(new THREE.Vector3());
      for(const axis of ['x','y','z'])assert.ok(Math.abs(restored[axis]/raw[axis]-100)<.001,name+': barrel is full-sized, not 1%');
    }
  }

  const mixer=new THREE.AnimationMixer(root),player=createModelAnimationPlayer(mixer,fixed);
  const wood=root.getObjectByName('bone_wood'),peroro=root.getObjectByName('bone_peroro_02');
  const near=(value,target)=>assert.ok(Math.abs(value-target)<1e-6,`${value} vs ${target}`);
  player.start();player.update(.4);near(wood.scale.x,1);near(peroro.scale.x,1);woodBounds();
  player.update(3);player.update(MODEL_TRANSITION_SECONDS+.01);
  assert.equal(player.getAnimation(),'CH0284_Victory_End');near(wood.scale.x,1);near(peroro.scale.x,1);
  const visibleSize=woodBounds().getSize(new THREE.Vector3()).length();
  for(let repeat=0;repeat<3;repeat++) {
    player.pickUp();player.update(MODEL_TRANSITION_SECONDS/2);
    assert.ok(wood.scale.x>.01&&wood.scale.x<1,'Prop hiding also blends smoothly');
    player.update(MODEL_TRANSITION_SECONDS);near(wood.scale.x,.01);near(peroro.scale.x,.01);
    player.update(11);player.update(MODEL_TRANSITION_SECONDS+.01);
    assert.equal(player.getAnimation(),'CH0284_Victory_End');near(wood.scale.x,1);near(peroro.scale.x,1);
    assert.ok(woodBounds().getSize(new THREE.Vector3()).length()>visibleSize*.99,'Toy returns after every Pickup');
  }
  player.setAnimation('CH0284_Formation_Idle');player.update(.4);near(wood.scale.x,.01);
  player.setAnimation('CH0284_Victory_End');player.update(.4);near(wood.scale.x,1);
  player.dispose();mixer.uncacheRoot(root);
  assert.equal(mesh.geometry,geometry);assert.equal(mesh.skeleton,skeleton);
  for(const [a,bytes] of attributes)assert.deepEqual(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength),bytes);
  assert.equal(JSON.stringify(source.map(clip=>clip.toJSON())),sourceClips);
  assert.deepEqual(await readFile(new URL(file,base)),originalBytes,'Source GLB stays byte-identical');
  dispose(root);
  console.log('PASS Yuuka: 26 missing channels across 8 clips; full-sized barrel, Victory/Pickup blending and immutable source');

  const catalog=JSON.parse(await readFile(new URL('assets/media/catalog.json',base),'utf8'));
  const files=[...new Set(Object.values(catalog.students).flatMap(s=>s.models.filter(m=>m.type==='body'&&m.ready).map(m=>m.file)))];
  let unchanged=0;
  for(const other of files.filter(f=>f!==file)) {
    const gltf=await load(other);
    assert.equal(prepareYuukaPropAnimations(gltf.scene,gltf.animations),gltf.animations,other+' is unaffected');
    dispose(gltf.scene);unchanged++;
  }
  assert.equal(unchanged,38);
  console.log('PASS All 38 other models bypass the Yuuka-specific prop repair');
} finally {delete globalThis.self;delete globalThis.createImageBitmap;}
