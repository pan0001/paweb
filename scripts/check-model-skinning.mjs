/** Reproduce malformed source skins and verify runtime isolation without rewriting assets. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/GLTFLoader.js';
import {isolateInvalidSkinning} from './ba-model-materials.js';
import {getModelBounds} from './model-viewer.js';
const base=new URL('../',import.meta.url);
const expected=new Map([
  ['326/CH0240',['Aru_Dress_Face01','CH0240_BusinessCard_Mesh']],
  ['501/CH0335',['CH0335_Prop_Outlline','brush_01']],
  ['318/CH0225',['CH0225_Item']],['227/CH0069',['CH0069_Weapon001']],
  ['316/CH0222',['CH0222_Food_Outline']],['519/CH0172',['CH0172_SkillProp_Outline']]
]);
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
for(const [file,names] of expected) {
  const bytes=await readFile(new URL('assets/media/models/'+file+'.glb',base));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const root=gltf.scene,original=[];
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(mesh.isSkinnedMesh)mesh.skeleton.update();
    if(mesh.isMesh)original.push({mesh,geometry:mesh.geometry,skeleton:mesh.skeleton,visible:mesh.visible,
      attributes:Object.values(mesh.geometry.attributes).map(a=>({a,buffer:Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice()}))});
  });
  const broken=new THREE.Box3().setFromObject(root,true);
  assert.ok([...broken.min.toArray(),...broken.max.toArray()].some(v=>!Number.isFinite(v)),file+' reproduces poisoned bounds');
  const isolated=isolateInvalidSkinning(root);
  assert.deepEqual(isolated.map(m=>m.name).sort(),names.slice().sort());
  assert.equal(isolateInvalidSkinning(root).length,0,'Idempotent preparation');
  const fixed=getModelBounds(root);
  assert.ok(!fixed.isEmpty() && [...fixed.min.toArray(),...fixed.max.toArray()].every(Number.isFinite));
  for(const entry of original) {
    assert.equal(entry.mesh.geometry,entry.geometry);assert.equal(entry.mesh.skeleton,entry.skeleton);
    if(!names.includes(entry.mesh.name))assert.equal(entry.mesh.visible,entry.visible,'Valid body/face/weapon stay visible');
    for(const {a,buffer} of entry.attributes) assert.deepEqual(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength),buffer,'Never fabricate weights or change vertex data');
    entry.geometry.dispose();entry.mesh.skeleton?.dispose();
    for(const material of [entry.mesh.material].flat()) {
      for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();
    }
  }
  console.log('PASS',file,'isolated',isolated.map(m=>m.name).join(', '));
}
delete globalThis.createImageBitmap;

const scene=new THREE.Group();
const visible=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());
const hidden=new THREE.Mesh(new THREE.BoxGeometry(100,100,100),new THREE.MeshBasicMaterial());
hidden.visible=false;scene.add(visible,hidden);
assert.deepEqual(getModelBounds(scene).getSize(new THREE.Vector3()).toArray(),[1,2,1],'Hidden auxiliary geometry never affects camera fit');
visible.visible=false;assert.ok(getModelBounds(scene).isEmpty(),'An entirely invisible model remains an error, not a invented box');
for(const mesh of [visible,hidden]){mesh.geometry.dispose();mesh.material.dispose();}
console.log('PASS Six real exports / eight invalid skins, unchanged geometry and skeletons, visible-only bounds');
