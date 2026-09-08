/** Actual OBJ/MTL attachment and animation regression; no GPU pixel claims. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/GLTFLoader.js';
import {MIKA_HALO_FILES,createMikaHalo,attachMikaHalo} from './mika-halo.js';
import {prepareMaterials,prepareAnimations,bindHalo} from './ba-model-materials.js';
import {getModelBounds,createModelAnimationPlayer,loadReplacementHalo} from './model-viewer.js';
import {applyCelShading} from './toon-renderer.js';

const base=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('assets/media/catalog.json',base),'utf8'));
for(const file of Object.values(MIKA_HALO_FILES)) {
  const entry=catalog.files.find(item=>new URL(item.path,base).href===file.href);
  const bytes=await readFile(file);
  assert.equal(bytes.length,entry.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  if(process.argv.includes('--online')) {
    const response=await fetch(entry.url,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),entry.sha256,'Current Kivo file matches local original');
  }
}
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const bytes=await readFile(new URL('assets/media/models/227/CH0069.glb',base));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const root=gltf.scene;
prepareMaterials(root);const clips=prepareAnimations(root,gltf.animations);bindHalo(root);
const texture=new THREE.Texture({width:370,height:320});texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
const obj=await readFile(MIKA_HALO_FILES.obj,'utf8'),mtl=await readFile(MIKA_HALO_FILES.mtl,'utf8');
const replacement=createMikaHalo(obj,mtl,texture);
const original=root.getObjectByName('CH0069_Halo'),geometry=original.geometry;
const body=root.getObjectByName('CH0069_Body');
const before=getModelBounds(root).getSize(new THREE.Vector3());
assert.equal(attachMikaHalo(root,replacement),true);
assert.equal(original.visible,false);assert.equal(original.geometry,geometry);
assert.equal(replacement.parent.name,'HaloRoot');assert.equal(replacement.userData.paSourceModel,201);
assert.equal(attachMikaHalo(root,replacement),false,'No duplicate attachment');
assert.equal(body.visible,true,'Body stays intact');
const after=getModelBounds(root).getSize(new THREE.Vector3());
assert.ok(after.y/before.y>.85 && after.y/before.y<1.15,'Replacement must not inflate camera bounds');
let meshes=0,vertices=0;
replacement.traverse(mesh=>{
  if(!mesh.isMesh)return;meshes++;vertices+=mesh.geometry.attributes.position.count;
  for(const material of [mesh.material].flat()) {
    assert.ok(material.isMeshBasicMaterial && material.userData.paHalo);
    assert.equal(material.toneMapped,false);assert.match(material.name,/Halo/);
    if(material.map) {
      assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);
      assert.equal(material.map.source,texture.source);
    }
  }
});
assert.equal(meshes,23);assert.ok(vertices>250000);
applyCelShading(root);
replacement.traverse(mesh=>{if(mesh.isMesh)assert.ok(!mesh.material.userData.paCel,'No body shading on self-lit halo');});
const head=replacement.parent.parent;
getModelBounds(root);const local=head.worldToLocal(replacement.getWorldPosition(new THREE.Vector3()));
const mixer=new THREE.AnimationMixer(root);
for(const clip of clips) {
  mixer.stopAllAction();const action=mixer.clipAction(clip).play();
  for(const t of [0,clip.duration/2,Math.max(0,clip.duration-.001)]) {
    action.time=t;mixer.update(0);root.updateMatrixWorld(true);
    assert.ok(head.worldToLocal(replacement.getWorldPosition(new THREE.Vector3())).distanceTo(local)<1e-7,clip.name);
    assert.equal(original.visible,false);
  }
}
mixer.stopAllAction();mixer.uncacheRoot(root);
const player=createModelAnimationPlayer(mixer,clips);player.start();
for(let step=0;step<600;step++) {
  if(step===230 || step===240)player.pickUp();
  player.update(1/60);root.updateMatrixWorld(true);
  assert.ok(head.worldToLocal(replacement.getWorldPosition(new THREE.Vector3())).distanceTo(local)<1e-7);
}
player.dispose();mixer.uncacheRoot(root);
assert.equal(attachMikaHalo(new THREE.Group(),replacement),false,'Other students are untouched');
console.log(`PASS Mika: source hashes, ${meshes} OBJ meshes / ${vertices} vertices, MTL colours/textures, ${clips.length} animations and smooth head-following; original geometry retained`);

// Exercise actual optional loading, including cleanup when one of three requests
// fails after another has already decoded a bitmap. No network in these cases.
const savedFetch=globalThis.fetch,savedBitmap=globalThis.createImageBitmap;
let closed=0;
globalThis.createImageBitmap=async()=>({width:370,height:320,close(){closed++;}});
const fixture=()=>{
  const root=new THREE.Group(),body=new THREE.Group(),anchor=new THREE.Group();
  body.name='CH0069';anchor.name='HaloRoot';root.add(body);body.add(anchor);
  const original=new THREE.Mesh(new THREE.BoxGeometry(.003,.001,.002),new THREE.MeshBasicMaterial());
  original.name='CH0069_Halo';anchor.add(original);
  return {root,original};
};
let failObj=false;
globalThis.fetch=async(url,{signal}={})=>{
  signal?.throwIfAborted();
  if(url.href===MIKA_HALO_FILES.obj.href)return new Response(failObj?'unavailable':obj,{status:failObj?503:200});
  if(url.href===MIKA_HALO_FILES.mtl.href)return new Response(mtl);
  if(url.href===MIKA_HALO_FILES.texture.href)return new Response(new Uint8Array([1]));
  throw new Error('Unexpected resource: '+url);
};
try {
  const failed=fixture();failObj=true;
  await assert.rejects(()=>loadReplacementHalo(failed.root,new AbortController().signal),/503/);
  assert.equal(failed.original.visible,true);assert.equal(failed.root.getObjectByName('PA_Mika_Halo'),undefined);
  assert.equal(closed,1,'Close the successfully decoded bitmap when OBJ fails');
  const cancelled=fixture(),controller=new AbortController();controller.abort();
  await assert.rejects(()=>loadReplacementHalo(cancelled.root,controller.signal),{name:'AbortError'});
  assert.equal(cancelled.original.visible,true);
  assert.equal(closed,1,'Pre-aborted requests must not decode another texture');
  failObj=false;const successful=fixture();
  await loadReplacementHalo(successful.root,new AbortController().signal);
  assert.equal(successful.original.visible,false);
  assert.equal(successful.root.getObjectByName('PA_Mika_Halo').userData.paSourceModel,201);
  assert.equal(closed,1,'Attached root owns the bitmap until the viewer is disposed');
  const untouched=new THREE.Group();
  await loadReplacementHalo(untouched,new AbortController().signal);assert.equal(untouched.children.length,0);
  console.log('PASS Optional halo loader: successful attachment, HTTP failure preserves original, late texture cleanup, pre-abort and non-Mika no-op');
} finally {globalThis.fetch=savedFetch;globalThis.createImageBitmap=savedBitmap;}
