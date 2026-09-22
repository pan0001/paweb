/** CPU animation/gesture regression. GLB texture decoding is stubbed, not a GPU test. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {GLTFLoader} from '../assets/vendor/three/GLTFLoader.js';
import {prepareAnimations, bindHalo} from './ba-model-materials.js';
import {selectModelAnimations, createModelAnimationPlayer, bindModelInteraction, MODEL_TRANSITION_SECONDS} from './model-viewer.js';

const clip = (name, duration=1) => new THREE.AnimationClip(name, duration, [new THREE.NumberKeyframeTrack('.position[x]', [0,duration], [0,1])]);
const clips = ['Formation_Idle','Victory_Start','Victory_End','Formation_Pickup','Normal_Idle'].map(name=>clip('Test_'+name));
const root = new THREE.Object3D(), mixer = new THREE.AnimationMixer(root), events=[];
const player = createModelAnimationPlayer(mixer, clips, name=>events.push(name));
const current = name => assert.equal(player.getAnimation(), 'Test_'+name);
player.start(); current('Victory_Start');
player.update(.75);current('Victory_Start');
player.update(.3);current('Victory_End');
player.update(10);current('Victory_End');
assert.equal(events.filter(name=>name.endsWith('Victory_Start')).length,1);
player.pickUp();current('Formation_Pickup');
player.update(.4);player.pickUp();player.update(.7);current('Formation_Pickup');
player.update(.4);current('Victory_End');
player.start();player.update(.1);player.pickUp();player.update(1.1);current('Victory_End');
player.start();player.setAnimation('Test_Normal_Idle');player.update(5);current('Normal_Idle');
assert.equal(player.setAnimation('missing'),false);current('Normal_Idle');
player.pickUp();player.update(1.1);current('Victory_End');
player.start();
for(let i=0;i<100;i++)player.update(0);
current('Victory_Start'); // Pausing means no animation time, not a delayed timer.
const count=events.length;player.dispose();player.update(20);
assert.equal(player.pickUp(),false);assert.equal(player.start(),false);
mixer.update(20);assert.equal(events.length,count);mixer.uncacheRoot(root);

for(const names of [['Formation_Idle'],['Victory_End','Formation_Pickup'],['Victory_Start','Formation_Idle','Formation_Pickup'],[]]) {
  const object=new THREE.Object3D(), mix=new THREE.AnimationMixer(object);
  const list=names.map(n=>clip('Fallback_'+n)), p=createModelAnimationPlayer(mix,list);
  p.start();p.update(2);
  assert.equal(p.getAnimation(),names.includes('Victory_End')?'Fallback_Victory_End':names.length?'Fallback_Formation_Idle':'');
  assert.equal(p.pickUp(),names.includes('Formation_Pickup'));
  p.update(2);p.dispose();mix.uncacheRoot(object);
}
const variants=[clip('Other_Formation_Pickup'),clip('Self_Victory_Start_Interaction'),clip('Self_Victory_End_Random'),clip('Self_Victory_Start',0),clip('Self_Victory_End'),clip('Self_Formation_Pickup')];
assert.equal(selectModelAnimations(variants).start,undefined);
assert.equal(selectModelAnimations(variants).pickup.name,'Self_Formation_Pickup');
console.log('PASS One-shot entrance → looping end, repeated Pickup → end, pause, manual override, missing clips, disposal and exact variant matching');

// Check actual blended transforms, not just the selected clip's name. Repeated
// Pickup must preserve the currently rendered pose even when it restarts itself.
const poseRoot=new THREE.Object3D(), poseMixer=new THREE.AnimationMixer(poseRoot);
const poseClip=(name,from,to=from,duration=1)=>new THREE.AnimationClip('Pose_'+name,duration,[
  new THREE.NumberKeyframeTrack('.position[x]',[0,duration],[from,to]),
  new THREE.QuaternionKeyframeTrack('.quaternion',[0,duration],[0,0,Math.sin(from/40),Math.cos(from/40),0,0,Math.sin(to/40),Math.cos(to/40)])
]);
const poses=[poseClip('Victory_Start',0),poseClip('Victory_End',10),poseClip('Formation_Pickup',-10,-20),poseClip('Normal_Idle',5),poseClip('Short',3,3,.04)];
const originalPoses=JSON.stringify(poses.map(c=>c.toJSON()));
const smooth=createModelAnimationPlayer(poseMixer,poses);
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-6,message+`: ${a} vs ${b}`);
smooth.start();smooth.update(1.01);
assert.equal(smooth.getAnimation(),'Pose_Victory_End');
near(poseRoot.position.x,0,'Entrance endpoint is retained at the switch');
smooth.update(MODEL_TRANSITION_SECONDS/2);
near(poseRoot.position.x,5,'Halfway pose mixes both clips');
near(poseRoot.quaternion.angleTo(new THREE.Quaternion()),.25,'Rotation blends on the shortest quaternion path');
const pausedPose=poseRoot.position.x;
for(let i=0;i<20;i++)smooth.update(0);
near(poseRoot.position.x,pausedPose,'Paused blends never advance');
smooth.pickUp();near(poseRoot.position.x,pausedPose,'Interrupting a fade starts at its current composite pose');
smooth.update(.06);const midPickup=poseRoot.position.x;
smooth.pickUp();near(poseRoot.position.x,midPickup,'Restarting Pickup does not reset the outgoing pose');
for(let i=0;i<30;i++) {
  const before=poseRoot.position.x;smooth.pickUp();
  near(poseRoot.position.x,before,'Rapid interaction preserves pose continuity');
  smooth.update(.02);
  assert.ok(Number.isFinite(poseRoot.position.x));
  assert.ok(poseMixer.stats.actions.inUse<=14,'Only actions inside the short fade window remain active');
}
smooth.update(MODEL_TRANSITION_SECONDS+.01);
assert.equal(poseMixer.stats.actions.inUse,1,'Retired actions are stopped');
assert.equal(poseMixer.stats.actions.total,1,'Retired temporary clips/actions are uncached');
smooth.update(1);assert.equal(smooth.getAnimation(),'Pose_Victory_End');
assert.ok(poseRoot.position.x<0,'Pickup final pose remains at the beginning of its return fade');
smooth.update(MODEL_TRANSITION_SECONDS/2);
assert.ok(poseRoot.position.x>-20&&poseRoot.position.x<10,'Return blends from the clamped final pose');
smooth.update(MODEL_TRANSITION_SECONDS/2+.001);near(poseRoot.position.x,10,'Return settles on victory loop');
smooth.setAnimation('Pose_Normal_Idle');near(poseRoot.position.x,10,'Manual selection also fades');
smooth.update(MODEL_TRANSITION_SECONDS+.01);near(poseRoot.position.x,5,'Manual fade completes');
smooth.setAnimation('Pose_Short');smooth.update(.011);near(poseRoot.position.x,3,'Short clips use a shorter fade');
smooth.pickUp();smooth.update(.04);smooth.dispose();
assert.equal(poseMixer.stats.actions.inUse,0);assert.equal(poseMixer.stats.actions.total,0);
poseMixer.update(10);assert.equal(poseMixer.stats.actions.inUse,0);
assert.equal(JSON.stringify(poses.map(c=>c.toJSON())),originalPoses,'Source keyframes stay immutable');
poseMixer.uncacheRoot(poseRoot);
console.log('PASS Smooth position/quaternion blending, mid-fade interruption, same-clip restart, paused fade, short clips and bounded action cleanup');

const element=new EventTarget();let clicks=0;
const unbind=bindModelInteraction(element,e=>e.clientX>=20&&e.clientX<=80,()=>clicks++);
function send(type,props={}) {
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId:1,button:0,isPrimary:true,clientX:40,clientY:40,...props});
  element.dispatchEvent(event);return event;
}
send('pointerdown');send('pointerup');assert.equal(clicks,1);
send('pointerdown');send('pointermove',{clientX:60});send('pointerup');assert.equal(clicks,1,'Drag back to origin is still a drag');
send('pointerdown');send('pointerup',{clientX:60});assert.equal(clicks,1,'Large release without a move is a drag');
send('pointerdown',{clientX:5});send('pointerup');assert.equal(clicks,1,'Background taps do not count');
send('pointerdown');send('pointerdown',{pointerId:2,isPrimary:false});send('pointerup',{pointerId:2});send('pointerup');assert.equal(clicks,1);
send('pointerdown');send('pointercancel');send('pointerup');assert.equal(clicks,1);
send('pointerdown');send('lostpointercapture');send('pointerup');assert.equal(clicks,1);
send('pointerdown');send('wheel');send('pointerup');assert.equal(clicks,1);
send('pointerdown',{button:2});send('pointerup',{button:2});assert.equal(clicks,1);
assert.equal(send('keydown',{key:'Enter'}).defaultPrevented,true);
send('keydown',{key:' ',repeat:true});assert.equal(clicks,2);
send('keydown',{key:' '});assert.equal(clicks,3);
unbind();send('pointerdown');send('pointerup');send('keydown',{key:'Enter'});assert.equal(clicks,3);
console.log('PASS Mouse/touch tap, background/drag/pinch/cancel/wheel rejection, keyboard activation and listener cleanup');

const base=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('assets/media/catalog.json',base),'utf8'));
const files=[...new Set(Object.values(catalog.students).flatMap(s=>s.models.filter(m=>m.type==='body').map(m=>m.file)))];
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const totals={start:0,end:0,pickup:0};
try {
  for(const file of files) {
    const bytes=await readFile(new URL(file,base));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const object=gltf.scene, animations=prepareAnimations(object,gltf.animations).filter(c=>!/(?:_Cam|_Camera)$/i.test(c.name));
    bindHalo(object);
    const choices=selectModelAnimations(animations), mix=new THREE.AnimationMixer(object);
    for(const key of Object.keys(totals))if(choices[key])totals[key]++;
    const p=createModelAnimationPlayer(mix,animations);
    // Exercise the same reference-pose → entrance sequence as mount. Geometry,
    // materials and halo bounds have their own separate regression checks.
    if(choices.idle)p.setAnimation(choices.idle.name);
    p.start();
    assert.equal(p.getAnimation(),(choices.start||choices.end||choices.idle)?.name||'');
    if(choices.start)p.update(choices.start.duration+.01);
    const resting=(choices.end||choices.idle)?.name||'';
    assert.equal(p.getAnimation(),resting,file+': entrance completion');
    p.update((choices.end?.duration||1)*2.5);assert.equal(p.getAnimation(),resting);
    if(choices.pickup) {
      p.pickUp();assert.equal(p.getAnimation(),choices.pickup.name);
      p.update(choices.pickup.duration/2);
      p.update(choices.pickup.duration/2+.01);assert.equal(p.getAnimation(),resting,file+': Pickup completion');
    }
    p.update(MODEL_TRANSITION_SECONDS+.01);
    assert.equal(mix.stats.actions.inUse,animations.length?1:0,file+': completed fades keep only the loop');
    p.dispose();assert.equal(mix.stats.actions.total,0,file+': no temporary clip cache after disposal');mix.uncacheRoot(object);
    const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
    object.traverse(o=>{
      if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);
      for(const m of [o.material].flat().filter(Boolean)) {
        materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
      }
    });
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    textures.forEach(t=>{t.dispose();t.image?.close?.();});skeletons.forEach(s=>s.dispose());
  }
  assert.deepEqual(totals,{start:38,end:39,pickup:39});
  console.log(`PASS All ${files.length} real GLBs: ${totals.start} standard intros, ${totals.end} victory loops, ${totals.pickup} Pickup clips; missing standard intro/carrier safely fall back`);
} finally { delete globalThis.self;delete globalThis.createImageBitmap; }
