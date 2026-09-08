/** Read-only inventory + CPU first-frame audit. Use --online to compare public Kivo model lists. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/GLTFLoader.js';
import {prepareMaterials,prepareAnimations,bindHalo} from './ba-model-materials.js';
import {getModelBounds,selectModelAnimations} from './model-viewer.js';
const base=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('assets/media/catalog.json',base),'utf8'));
const students=Object.values(catalog.students);
const problems=[];
const models=new Map(students.flatMap(s=>s.models.filter(m=>m.type==='body').map(m=>[m.file,m])));
const files=new Set(students.flatMap(s=>s.models.flatMap(m=>m.files)));
for(const file of files) {
  try {
    const bytes=await readFile(new URL(file,base));
    const indexed=catalog.files.find(item=>item.path===file);
    if(!indexed || bytes.length!==indexed.bytes || createHash('sha256').update(bytes).digest('hex')!==indexed.sha256)
      problems.push({file,error:'File does not match catalog hash/size'});
  } catch(error) {problems.push({file,error:error.message});}
}
for(const s of students) if(!s.models.some(m=>m.ready && m.type==='body' && /\.glb$/i.test(m.file))) problems.push({student:s.name,error:'No ready GLB body'});
console.log('INVENTORY',students.length,'students',models.size,'GLBs',files.size,'model files',problems.length,'file/coverage problems');

if(process.argv.includes('--online')) {
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<students.length) {
      const s=students[cursor++];
      try {
        const response=await fetch('https://api.kivo.wiki/api/v1/data/students/'+s.kivoId,{signal:AbortSignal.timeout(25000)});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const result=await response.json();
        if(!result.success || !Array.isArray(result.data?.model))throw new Error('No public model list');
        const remote=result.data.model, local=s.models.map(m=>m.id);
        const missing=remote.filter(id=>!local.includes(id));
        console.log('KIVO',s.id,s.name,JSON.stringify({local,remote,missing}));
        if(missing.length)problems.push({student:s.name,error:'Missing public model IDs',missing});
      } catch(error){problems.push({student:s.name,error:'Source audit: '+error.message});}
    }
  }));
}

// Decode geometry/rig only. GPU rendering and texture pixels need separate checks.
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
for(const [file,model] of models) {
  let root,mixer;
  try {
    const bytes=await readFile(new URL(file,base));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    root=gltf.scene;
    prepareMaterials(root);
    const clips=prepareAnimations(root,gltf.animations);
    bindHalo(root);
    mixer=new THREE.AnimationMixer(root);
    const choices=selectModelAnimations(clips);
    for(const [phase,clip] of Object.entries(choices)) {
      if(!clip)continue;
      mixer.stopAllAction();const action=mixer.clipAction(clip).play();
      for(const t of [0,clip.duration/2,Math.max(0,clip.duration-.001)]) {
        action.time=t;mixer.update(0);
        const box=getModelBounds(root);
        if(box.isEmpty() || ![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)) {
          const broken=[];
          root.traverse(node=>{
            if(node.matrixWorld.elements.some(n=>!Number.isFinite(n)))broken.push(node.name);
          });
          problems.push({file,phase,time:t,error:'Non-finite/empty scene bounds',broken:broken.slice(0,8)});
          break;
        }
      }
    }
    if(/CH0335/.test(model.name)) console.log('KEI',model.name,JSON.stringify({animations:clips.length,choices:Object.fromEntries(Object.entries(choices).map(([key,clip])=>[key,clip?.name])),size:getModelBounds(root).getSize(new THREE.Vector3()).toArray()}));
  } catch(error){problems.push({file,error:error.message});}
  finally {
    mixer?.stopAllAction();if(root)mixer?.uncacheRoot(root);
    const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
    root?.traverse(node=>{
      if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);
      for(const material of [node.material].flat().filter(Boolean)){
        materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      }
    });
    geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());textures.forEach(v=>v.dispose());skeletons.forEach(v=>v.dispose());
  }
}
delete globalThis.createImageBitmap;
if(problems.length){console.error(JSON.stringify(problems,null,2));process.exitCode=1;}
else console.log('PASS All indexed bodies and source hashes; idle/victory/pickup bounds remain finite. GPU appearance is not tested.');
