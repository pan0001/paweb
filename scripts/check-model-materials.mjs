/** CPU regression with REAL decoded texture pixels, not a browser/WebGL screenshot.
 * Dev dependency: sharp. PAWEB_IMAGE_MODULES can point to an existing node_modules.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/GLTFLoader.js';
import { prepareMaterials,prepareAnimations,attachMouth,bindHalo,setMouthFrame,MOUTH_ATLAS } from './ba-model-materials.js';
import { getModelBounds } from './model-viewer.js';
import { createToonRenderer,TOON_STYLE,OUTLINE_PROFILES,surfaceKind } from './toon-renderer.js';
const require=createRequire(import.meta.url);
const sharp=require(process.env.PAWEB_IMAGE_MODULES ? path.join(process.env.PAWEB_IMAGE_MODULES,'sharp') : 'sharp');
const base=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('assets/media/catalog.json',base),'utf8'));
globalThis.self=globalThis;
globalThis.createImageBitmap=async blob=>{
  const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return {data,width:info.width,height:info.height,close(){this.data=null;}};
};
const atlasBytes=await readFile(MOUTH_ATLAS);
const atlasImage=await createImageBitmap(new Blob([atlasBytes]));
assert.equal(atlasImage.width,2048);assert.equal(atlasImage.height,2048);
let materials=0,mouths=0,halos=0,models=0;
const skipped=[];
const files=[...new Set(Object.values(catalog.students).flatMap(student=>student.models.filter(model=>model.type==='body').map(model=>model.file)))];
const triangleIndices=geometry=>Array.from(geometry.index?.array || Array.from({length:geometry.attributes.position.count},(_,i)=>i));

// Outline bindings must be per source material, not one purple palette per kind.
// This checks shader inputs and a CPU reference of its colour formula, not GPU pixels.
{
  const map=new THREE.DataTexture(new Uint8Array([255,210,70,0,80,210,120,0]),2,1);
  map.colorSpace=THREE.SRGBColorSpace;map.offset.set(.2,.3);map.repeat.set(.5,.75);
  const alternateMap=map.clone();alternateMap.channel=1;
  const geometry=new THREE.PlaneGeometry(), secondUV=geometry.clone();
  secondUV.setAttribute('uv1',secondUV.attributes.uv.clone());
  const warm=new THREE.MeshToonMaterial({name:'Warm_Hair',color:0xffdd77,map});
  const cool=new THREE.MeshToonMaterial({name:'Cool_Hair',color:0x65b7ed,map});
  const skin=new THREE.MeshToonMaterial({name:'Face',color:0xf2c0aa});
  const second=new THREE.MeshToonMaterial({name:'Hair_UV1',map:alternateMap});
  const group=new THREE.Group();
  const inputs=[[warm,geometry],[cool,geometry],[skin,geometry],[second,secondUV],[second,geometry]];
  inputs.forEach(([material,g])=>group.add(new THREE.Mesh(g,material)));
  const originalColors=inputs.map(([m])=>m.color.toArray());
  let passes=0,lines=[],texturesDisposed=0;
  map.addEventListener('dispose',()=>texturesDisposed++);alternateMap.addEventListener('dispose',()=>texturesDisposed++);
  const renderer={autoClear:true,getSize:v=>v.set(100,100),render(){if(++passes%2===0)lines=group.children.map(m=>m.material);}};
  const effect=createToonRenderer(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),group);
  effect.render();
  assert.notEqual(lines[0],lines[1],'Two hair materials cannot share a tint uniform');
  assert.notEqual(lines[3],lines[4],'A missing UV channel must use a separate untextured fallback');
  assert.equal(lines[0].uniforms.map.value,map);assert.equal(lines[0].uniforms.paBaseColor.value,warm.color);
  assert.equal(lines[1].uniforms.paBaseColor.value,cool.color);
  assert.equal(lines[2].uniforms.map.value,null);assert.equal(lines[2].defines.USE_MAP,undefined);
  assert.equal(lines[3].defines.MAP_UV,'uv1');assert.equal(lines[3].defines.USE_UV1,'');
  assert.equal(lines[4].uniforms.map.value,null);
  const oldMatrix=map.matrix.clone();map.offset.x=.6;effect.render();
  assert.ok(!map.matrix.equals(oldMatrix));assert.equal(lines[0].uniforms.mapTransform.value,map.matrix);
  for(const line of lines) {
    assert.equal(line.uniforms.paColor,undefined,'No fixed purple ink uniform');
    assert.match(line.fragmentShader,/texture2D\(map,vMapUv\)\.rgb/,'Use RGB, never BA texture alpha for coverage');
    assert.match(line.fragmentShader,/mix\(vec3\(paLuma\),paBase,paSaturation\)\*paShade/);
    assert.match(line.fragmentShader,/<colorspace_fragment>/);
  }
  for(const profile of Object.values(OUTLINE_PROFILES)) {
    assert.equal(profile.color,undefined);
    const ink=rgb=>{const y=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;return rgb.map(v=>(y*(1-profile.saturation)+v*profile.saturation)*profile.shade);};
    const grey=ink([.8,.8,.8]);assert.ok(Math.abs(grey[0]-grey[2])<1e-12,'Neutral source stays neutral');
    const gold=ink([.9,.65,.15]),green=ink([.15,.65,.3]),pink=ink([.9,.3,.55]);
    assert.ok(gold[0]>gold[1]&&gold[1]>gold[2]);assert.ok(green[1]>green[2]&&green[2]>green[0]);assert.ok(pink[0]>pink[2]&&pink[2]>pink[1]);
  }
  assert.deepEqual(inputs.map(([m])=>m.color.toArray()),originalColors);
  effect.dispose();effect.dispose();assert.equal(texturesDisposed,0,'Outline does not own or dispose shared model maps');
  geometry.dispose();secondUV.dispose();[warm,cool,skin,second].forEach(m=>m.dispose());map.dispose();alternateMap.dispose();
  console.log('PASS Material-local outline RGB, neutral/warm/green/pink hue preservation, UV1, missing-UV fallback, live UV transforms and shared texture ownership');
}

// No renderer has run: a moved bone must already affect the initial camera bounds.
{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(12).fill(0),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
  const bone=new THREE.Bone();mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));
  bone.position.y=4;
  const bounds=getModelBounds(mesh);
  assert.equal(bounds.min.y,4);assert.equal(bounds.max.y,5);
  assert.deepEqual(getModelBounds(mesh).min.toArray(),bounds.min.toArray());
  const wrapper=new THREE.Group();wrapper.add(mesh);wrapper.scale.setScalar(2.8);
  const scaled=getModelBounds(wrapper);
  assert.ok(Math.abs(scaled.getSize(new THREE.Vector3()).y-2.8)<1e-5,'Wrapper scaling must update inverse bind matrices before the first fit');
  mesh.skeleton.dispose();geometry.dispose();mesh.material.dispose();
  console.log('PASS first-frame bounds update bone transforms without a prior WebGL render');
}

try {
  for(const file of files) {
    const bytes=await readFile(new URL(file,base));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
    const root=gltf.scene;
    const originalMeshes=[];
    root.traverse(mesh=>{if(mesh.isMesh)originalMeshes.push({mesh,map:mesh.material.map});});
    const beforeFace=originalMeshes.find(({mesh})=>mesh.isSkinnedMesh && /_(eyemouth|eyemoutn|mouth)$/i.test(mesh.material.name) && !/star/i.test(mesh.name))?.mesh;
    const oldGeometry=beforeFace?.geometry;
    const oldFaceId=beforeFace?.uuid;
    const oldSkeleton=beforeFace?.skeleton;
    materials+=prepareMaterials(root);
    for(const {mesh,map} of originalMeshes) {
      assert.ok(mesh.material.isMeshToonMaterial,file+': '+mesh.material.name);
      assert.equal(mesh.material.map,map,'Preserve embedded texture');
      assert.equal(mesh.material.alphaTest,0);
      if(!/_(eyebrow|alpha)$/i.test(mesh.material.name)) {
        assert.equal(mesh.material.transparent,false);
        assert.equal(mesh.material.vertexColors,false);
        assert.equal(mesh.material.opacity,1);
      }
    }
    const animations=prepareAnimations(root,gltf.animations);
    if(file==='assets/media/models/354/CH0284.glb') {
      assert.equal(animations.filter((clip,i)=>clip!==gltf.animations[i]).length,8);
      gltf.animations.forEach((clip,i)=>clip.tracks.forEach((track,j)=>
        assert.ok(animations[i].tracks[j]===track,'Yuuka keeps all original body/face/prop curves')));
    } else if(!['assets/media/models/404/Kayoko_Original.glb','assets/media/models/421/Momoi_Original.glb'].includes(file))
      assert.ok(animations===gltf.animations,file+': unrelated animation arrays stay unchanged');
    if(bindHalo(root))halos++;
    const mouthTexture=new THREE.Texture(atlasImage);setMouthFrame(mouthTexture);
    const face=attachMouth(root,mouthTexture);
    if(face) {
      mouths++;
      assert.equal(face,beforeFace);assert.equal(face.uuid,oldFaceId);assert.equal(face.skeleton,oldSkeleton);
      assert.deepEqual(triangleIndices(face.geometry).sort((a,b)=>a-b),triangleIndices(oldGeometry).sort((a,b)=>a-b),'Keep every source triangle');
      for(const [name,attribute] of Object.entries(oldGeometry.attributes)) {
        assert.deepEqual(face.geometry.attributes[name].array,attribute.array,'Keep attribute '+name);
        assert.equal(face.geometry.attributes[name].normalized,attribute.normalized);
      }
      assert.equal(face.material[0].map,originalMeshes.find(item=>item.mesh===face).map,'Eyes keep original atlas');
      assert.equal(face.material[1].map,mouthTexture);
      assert.equal(face.material[1].vertexColors,false);
      assert.equal(face.material[1].transparent,true);
      assert.equal(face.geometry.groups.reduce((sum,group)=>sum+group.count,0),face.geometry.index.count);
      assert.ok(face.geometry.groups.at(-1).count>0);
      assert.deepEqual(mouthTexture.repeat.toArray(),[.5,.5]);
      assert.deepEqual(mouthTexture.offset.toArray(),[.5,.875]);
    } else skipped.push(file);

    // The second pass reuses the actual animated objects and restores every
    // material group, including the separately attached mouth, even on failure.
    const saved=originalMeshes.map(({mesh})=>({mesh,material:mesh.material,skeleton:mesh.skeleton,geometry:mesh.geometry}));
    let passes=0,failOutline=false;
    const mockRenderer={autoClear:true,getSize:value=>value.set(1280,720),render(){
      passes++;
      if(passes%2===0) {
        assert.equal(this.autoClear,false);
        const outlines=saved.flatMap(({mesh})=>[mesh.material].flat()).filter(material=>material.name==='PA_SoftOutline');
        assert.ok(outlines.length>0,file);
        for(const material of outlines) {
          const profile=OUTLINE_PROFILES[material.userData.paSurface];
          assert.equal(material.uniforms.paWidth.value,profile.width);
          assert.equal(material.uniforms.paDepthBias.value,profile.bias);
          assert.equal(material.uniforms.paOpacity.value,profile.opacity);
          assert.equal(material.uniforms.paShade.value,profile.shade);
          assert.equal(material.uniforms.paSaturation.value,profile.saturation);
        }
        for(const {mesh,material:source} of saved) {
          const sourceList=[source].flat(),lineList=[mesh.material].flat();
          sourceList.forEach((original,index)=>{
            const line=lineList[index];
            if(line.name!=='PA_SoftOutline')return;
            assert.equal(line.userData.paSourceMaterial,original.uuid);
            assert.equal(line.uniforms.paBaseColor.value,original.color);
            const uv=['uv','uv1','uv2','uv3'][original.map?.channel ?? 0];
            const mapped=original.map && uv && mesh.geometry.hasAttribute(uv);
            assert.equal(line.uniforms.map.value,mapped?original.map:null,file+': original per-material texture');
            if(mapped) {
              assert.equal(line.defines.MAP_UV,uv);assert.equal(line.uniforms.mapTransform.value,original.map.matrix);
              assert.equal(original.map.colorSpace,THREE.SRGBColorSpace,'Original sRGB map is decoded by WebGL, not decoded twice in the outline shader');
              assert.ok(original.map.image.data.length>0,'The actual embedded PNG was decoded');
            }
          });
        }
        assert.match(outlines[0].vertexShader,/<skinning_vertex>/);
        if(failOutline)throw new Error('Test outline interruption');
      }
    }};
    const cel=createToonRenderer(mockRenderer,new THREE.Scene(),new THREE.PerspectiveCamera(),root);
    cel.render();assert.equal(passes,2);assert.equal(mockRenderer.autoClear,true);
    failOutline=true;assert.throws(()=>cel.render(),/Test outline interruption/);
    assert.equal(mockRenderer.autoClear,true);
    for(const entry of saved) {
      assert.equal(entry.mesh.material,entry.material);assert.equal(entry.mesh.skeleton,entry.skeleton);assert.equal(entry.mesh.geometry,entry.geometry);
      for(const material of [entry.material].flat())if(material.userData.paCel) {
        const shader={uniforms:{},fragmentShader:THREE.ShaderLib.toon.fragmentShader};
        material.onBeforeCompile(shader);
        assert.match(shader.fragmentShader,/paWhite/);assert.equal(material.toneMapped,false);
        assert.equal(shader.uniforms.paBrightness.value,TOON_STYLE.brightness);
        const kind=surfaceKind(material.name);
        assert.equal(shader.uniforms.paSurface.value,kind==='hair'?1:kind==='face'?2:0);
        assert.match(shader.fragmentShader,/dot\(normal,directionalLights\[0\]\.direction\)/);
      }
    }
    cel.dispose();cel.dispose();

    if(file==='assets/media/models/391/Ibuki_Original.glb') {
      const neutral=root.getObjectByName('Ibuki_Original_Face_Outline');
      const alternate=root.getObjectByName('Ibuki_Original_Face01_Outline');
      assert.equal(neutral.visible,true,'Keep Ibuki normal eyes and face');
      assert.equal(alternate.visible,false,'Do not stack the squeezed-eye face on the normal face');
      assert.equal(alternate.userData.paInactiveExpression,true);
      assert.equal(face?.name,'Ibuki_Original_Body_4','The separate body primitive, not eye geometry, receives the mouth atlas');
      assert.equal(face.userData.paSeparateMouth,true);
      assert.equal(face.userData.paMouth.islandCount,1);
      assert.equal(face.userData.paMouth.triangles,32);
      assert.equal(face.geometry.groups.length,1);
      assert.equal(face.geometry.groups[0].materialIndex,1);
      const eye=root.getObjectByName('Ibuki_Original_Face_Outline_2');
      assert.ok(!Array.isArray(eye.material),'The normal eye mesh must not be partitioned as a mouth');
      assert.equal(eye.material.map,originalMeshes.find(item=>item.mesh===eye).map);
      const vertex=face.geometry.index.getX(0);
      const mixer=new THREE.AnimationMixer(root);
      for(const clip of gltf.animations) {
        mixer.stopAllAction();const action=mixer.clipAction(clip).play();
        for(const time of [0,clip.duration/2,Math.max(0,clip.duration-.01)]) {
          action.time=time;mixer.update(0);root.updateMatrixWorld(true);face.skeleton.update();
          assert.equal(alternate.visible,false,clip.name+': no accidental re-enable');
          assert.equal(neutral.visible,true,clip.name+': normal face retained');
          assert.ok(face.getVertexPosition(vertex,new THREE.Vector3()).toArray().every(Number.isFinite),clip.name);
        }
      }
      mixer.stopAllAction();mixer.uncacheRoot(root);
      console.log(`PASS Ibuki: mutually exclusive face layers, separate 32-triangle mouth, original eye atlas, ${gltf.animations.length} clips retain the repair`);
    } else {
      root.traverse(object=>{
        assert.ok(!object.userData.paInactiveExpression,'Ibuki face selection must not affect other characters');
        if(file!=='assets/media/models/268/CH0167.glb')
          assert.ok(!object.userData.paSeparateMouth,'Single-island exceptions must stay scoped to Ibuki and Reisa');
      });
    }

    if(file==='assets/media/models/268/CH0167.glb') {
      assert.equal(face?.name,'CH0167_Body_2','Reisa separate mouth must receive the atlas');
      assert.equal(face.userData.paSeparateMouth,true);
      assert.equal(face.userData.paMouth.islandCount,1);
      assert.equal(face.userData.paMouth.triangles,32);
      assert.deepEqual(face.geometry.groups,[{start:0,count:96,materialIndex:1}]);
      for(const name of ['CH0167_Body_Face_Outline_2','CH0167_Eyebrow02']) {
        const eye=root.getObjectByName(name);
        assert.ok(!Array.isArray(eye.material),name+': leave eye and eyebrow primitives alone');
        assert.ok(!eye.userData.paSeparateMouth);
        assert.equal(eye.material.map,originalMeshes.find(item=>item.mesh===eye).map);
      }
      // Sample actual mouth triangles through the shared atlas transform: verify
      // visible coloured mouth pixels AND transparency for blending with skin.
      mouthTexture.updateMatrix();
      let ink=0,clear=0;
      const uv=face.geometry.attributes.uv,indices=face.geometry.index;
      const sample=(u,v)=>{
        const at=new THREE.Vector2(u,v);mouthTexture.transformUv(at);
        const x=Math.min(atlasImage.width-1,Math.floor(at.x*atlasImage.width));
        const y=Math.min(atlasImage.height-1,Math.floor(at.y*atlasImage.height));
        const p=(y*atlasImage.width+x)*4,rgba=atlasImage.data;
        if(rgba[p+3]<10)clear++;
        if(rgba[p+3]>128 && Math.min(rgba[p],rgba[p+1],rgba[p+2])<180)ink++;
      };
      for(let i=0;i<indices.count;i+=3) {
        const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);
        for(let j=0;j<=8;j++)for(let k=0;k<=8-j;k++) {
          const w0=j/8,w1=k/8,w2=1-w0-w1;
          sample(uv.getX(a)*w0+uv.getX(b)*w1+uv.getX(c)*w2,uv.getY(a)*w0+uv.getY(b)*w1+uv.getY(c)*w2);
        }
      }
      assert.ok(ink>0,'The repaired UVs must sample visible mouth detail');
      assert.ok(clear>0,'The surrounding patch must not remain an opaque white disk');
      const vertices=[...new Set(indices.array)];
      const mixer=new THREE.AnimationMixer(root);
      for(const clip of gltf.animations) {
        mixer.stopAllAction();const action=mixer.clipAction(clip).play();
        for(const time of [0,clip.duration/2,Math.max(0,clip.duration-.01)]) {
          action.time=time;mixer.update(0);root.updateMatrixWorld(true);face.skeleton.update();
          assert.equal(face.visible,true);
          for(const vertex of vertices)assert.ok(face.getVertexPosition(vertex,new THREE.Vector3()).toArray().every(Number.isFinite),clip.name);
        }
      }
      mixer.stopAllAction();mixer.uncacheRoot(root);
      console.log(`PASS Reisa: separate 32-triangle mouth, visible atlas ink/transparency, original eyes and skin bindings, ${gltf.animations.length} clips`);
    }

    if(file==='assets/media/models/319/CH0230.glb') {
      assert.ok(face,'Hina mouth must be partitioned');
      assert.equal(face.userData.paMouth.islandCount,7,'Hina has seven disconnected face/eye/mouth islands');
      assert.equal(face.userData.paMouth.triangles,32,'Only the bottom mouth island receives the replacement atlas');
      const body=originalMeshes.find(({mesh})=>/_Body$/i.test(mesh.material?.name || ''))?.mesh;
      assert.ok(body,'Hina body');
      const rgba=body.material.map.image.data;
      let zeroAlpha=0;for(let i=3;i<rgba.length;i+=4)if(rgba[i]===0)zeroAlpha++;
      assert.ok(zeroAlpha/(rgba.length/4)>.99,'Reproduce the original body-alpha hazard using real PNG pixels');
      assert.equal(body.material.transparent,false,'Do not blend away body RGB');
      assert.equal(face.material[0].vertexColors,false,'Do not multiply eyes by zero vertex alpha');
      assert.ok(Array.from(face.geometry.attributes.color.array).length>0);

      const mixer=new THREE.AnimationMixer(root);
      const mouthGroup=face.geometry.groups.at(-1);
      const vertex=face.geometry.index.getX(mouthGroup.start);
      for(const clip of gltf.animations.filter(clip=>!/_Cam(?:era)?$/i.test(clip.name))) {
        mixer.stopAllAction();mixer.clipAction(clip).play();mixer.update(.15);root.updateMatrixWorld(true);face.skeleton.update();
        assert.ok(face.getVertexPosition(vertex,new THREE.Vector3()).toArray().every(Number.isFinite),clip.name);
      }
      mixer.stopAllAction();mixer.uncacheRoot(root);
      console.log(`PASS Hina: ${zeroAlpha} zero-alpha body pixels no longer imply transparency; mouth isolated from 7 face islands; ${gltf.animations.length} animation clips retain the skinned mouth`);
    }
    const geometries=new Set(),usedMaterials=new Set(),textures=new Set();
    root.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      for(const material of [object.material].flat().filter(Boolean)) {
        usedMaterials.add(material);
        for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      }
    });
    geometries.forEach(geometry=>geometry.dispose());usedMaterials.forEach(material=>material.dispose());
    textures.forEach(texture=>{texture.dispose();if(texture.image!==atlasImage)texture.image?.close?.();});
    mouthTexture.dispose();
    models++;
  }
  assert.equal(models,39);
  console.log(`PASS ${models} GLBs: ${materials} materials converted, ${mouths} mouths partitioned, ${halos} halos rebound`);
  console.log('PASS cel shader hooks, skinned outline passes and exception-safe material restoration for all models');
  if(skipped.length)console.log('Embedded face retained (no separable mouth):',skipped.join(', '));
  console.log('Geometry, real texture pixels and material state checks passed. This does not verify GPU rendering.');
} finally {
  atlasImage.close();delete globalThis.self;delete globalThis.createImageBitmap;
}
