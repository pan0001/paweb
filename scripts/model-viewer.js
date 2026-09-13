/**
 * Lazy 3D preview for Kivo's self-contained body GLBs.
 * This module and every runtime dependency are local; no CDN is contacted.
 */
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/GLTFLoader.js';
import { OrbitControls } from '../assets/vendor/three/OrbitControls.js';
import { prepareMaterials, prepareAnimations, attachMouth, bindHalo, setMouthFrame, MOUTH_ATLAS } from './ba-model-materials.js';
import { createToonRenderer } from './toon-renderer.js';

// Bounds must not depend on a prior WebGL render. Offscreen/paused first loads
// still need current skin matrices before Box3 applies vertex bone transforms.
export function getModelBounds(object) {
  object.updateWorldMatrix(true, false);
  // updateMatrixWorld also refreshes SkinnedMesh.bindMatrixInverse after the
  // normalization wrapper is scaled; updateWorldMatrix alone does not.
  object.updateMatrixWorld(true);
  object.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update(); });
  const box=new THREE.Box3(),point=new THREE.Vector3();
  // Box3.setFromObject includes hidden meshes, so an unusable auxiliary skin
  // would still poison the entire first-frame camera fit with NaN coordinates.
  object.traverseVisible(node=>{
    const position=node.geometry?.getAttribute('position');
    if(!position) return;
    for(let index=0;index<position.count;index++) {
      if(node.isMesh) node.getVertexPosition(index,point);
      else point.fromBufferAttribute(position,index);
      point.applyMatrix4(node.matrixWorld);
      if(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) box.expandByPoint(point);
    }
  });
  return box;
}

// Yuuka's toy lands in front of her after Victory_Start. A standing-only fit
// clips Peroro at the bottom. Cache the union once, without following the pose
// or moving the user's camera during an interaction.
export function includeModelPropBounds(root, clips, bounds) {
  const toy=root.getObjectByName('CH0284_SkillProp_Outline');
  const end=clips.find(clip=>clip.name==='CH0284_Victory_End');
  if (!toy?.isSkinnedMesh || toy.parent?.name!=='CH0284_1' || !end) return bounds;
  const mixer=new THREE.AnimationMixer(root);
  try {
    mixer.clipAction(end).play();mixer.update(0);
    return bounds.clone().union(getModelBounds(root));
  } finally {
    mixer.stopAllAction();mixer.uncacheRoot(root);root.updateMatrixWorld(true);
  }
}

// Exact suffixes deliberately exclude paired/Random/Camera variants. Some exports
// also contain another costume's Pickup; prefer the current victory clip's prefix.
export function selectModelAnimations(clips) {
  const usable = clips.filter(clip => clip.duration > 0 && Number.isFinite(clip.duration));
  const end = usable.find(clip => /_Victory_End$/i.test(clip.name));
  const prefix = end?.name.replace(/Victory_End$/i, '');
  const find = pattern => usable.find(clip => pattern.test(clip.name) && (!prefix || clip.name.startsWith(prefix)))
    || usable.find(clip => pattern.test(clip.name));
  return {
    start: find(/_Victory_Start$/i), end,
    pickup: find(/_(?:Formation_)?Pick_?up$/i),
    idle: find(/_Formation_Idle$/i) || find(/_Normal_Idle$/i) || find(/_Cafe_Idle$/i) || usable[0]
  };
}

// Animation time, not wall-clock timers, drives transitions, so pause, hidden tabs
// and reduced motion cannot skip an intro or complete an interaction offscreen.
export const MODEL_TRANSITION_SECONDS = 0.24;
export function createModelAnimationPlayer(mixer, clips, onChange = () => {}) {
  const choices = selectModelAnimations(clips);
  const rest = choices.end || choices.idle;
  let action = null, next = null, finished = false, disposed = false;
  const outgoing = [];
  const release = old => {
    old.stop();
    mixer.uncacheAction(old.getClip());
  };
  function blend(time) {
    let outgoingWeight = 0;
    for (let i = outgoing.length - 1; i >= 0; i--) {
      const entry = outgoing[i];
      const progress = THREE.MathUtils.clamp((time - entry.start) / entry.duration, 0, 1);
      if (progress >= 1) {
        release(entry.action); outgoing.splice(i, 1);
      } else {
        // Smoothstep eases both ends of the fade, with no change to clip speed.
        const weight = entry.weight * (1 - progress * progress * (3 - 2 * progress));
        entry.action.setEffectiveWeight(weight);
        outgoingWeight += weight;
      }
    }
    action?.setEffectiveWeight(Math.max(0, 1 - outgoingWeight));
  }
  function play(clip, once = false, after = null) {
    if (disposed || !clip) return false;
    const duration = Math.min(MODEL_TRANSITION_SECONDS, Math.max(0, clip.duration) / 4);
    if (action) {
      const weight = action.getEffectiveWeight();
      if (weight > 0 && duration > 0) outgoing.push({action, weight, start:mixer.time, duration});
      else release(action);
    }
    // A separate action can restart Pickup while its previous instance fades out.
    // Share immutable tracks, but never reset the outgoing action or source clip.
    const instance = new THREE.AnimationClip(clip.name, clip.duration, clip.tracks, clip.blendMode);
    action = mixer.clipAction(instance);
    next = after; finished = false;
    action.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.play();
    blend(mixer.time);
    mixer.update(0);
    onChange(clip.name);
    return true;
  }
  const onFinished = event => { if (event.action === action && next) finished = true; };
  mixer.addEventListener('finished', onFinished);
  return {
    start: () => choices.start ? play(choices.start, true, rest) : play(rest),
    pickUp: () => play(choices.pickup, true, rest),
    setAnimation: name => play(clips.find(clip => clip.name === name)),
    getAnimation: () => action?.getClip().name || '',
    canPickUp: () => !!choices.pickup,
    update(delta) {
      if (disposed) return;
      blend(mixer.time + delta * mixer.timeScale);
      mixer.update(delta);
      // Do not re-enter AnimationMixer.update from its finished event listener.
      if (finished) play(next);
    },
    dispose() {
      disposed = true; finished = false; next = null;
      mixer.removeEventListener('finished', onFinished);
      outgoing.forEach(entry => release(entry.action)); outgoing.length = 0;
      if (action) release(action);
      action = null;
    }
  };
}

// A tap must begin and end on the character. Dragging, pinching, wheel zoom and
// cancelled touch scrolling must never be interpreted as a Pickup interaction.
export function bindModelInteraction(element, hitTest, activate) {
  const pointers = new Set();
  let tap = null;
  function down(event) {
    pointers.add(event.pointerId);
    if (pointers.size !== 1 || event.button !== 0 || event.isPrimary === false) { tap = null; return; }
    tap = hitTest(event) ? {id:event.pointerId, x:event.clientX, y:event.clientY} : null;
  }
  function move(event) {
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 7) tap = null;
  }
  function up(event) {
    move(event);
    const clicked = tap?.id === event.pointerId && pointers.size === 1;
    pointers.delete(event.pointerId); tap = null;
    if (clicked && hitTest(event)) activate();
  }
  function cancel(event) { pointers.delete(event.pointerId); tap = null; }
  function wheel() { tap = null; }
  function key(event) {
    if (event.target !== element || !['Enter',' '].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) activate();
  }
  const listeners = {pointerdown:down, pointermove:move, pointerup:up, pointercancel:cancel, lostpointercapture:cancel, wheel, keydown:key};
  // Capture precedes OrbitControls' releasePointerCapture on pointerup.
  const capture = {capture:true};
  for (const [type, handler] of Object.entries(listeners)) element.addEventListener(type, handler, capture);
  return () => {
    for (const [type, handler] of Object.entries(listeners)) element.removeEventListener(type, handler, capture);
    tap = null; pointers.clear();
  };
}

function releaseObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.filter(Boolean).forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach(geometry => geometry.dispose());
  skeletons.forEach(skeleton => skeleton.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => {
    texture.dispose();
    // GLTFLoader uses ImageBitmap where available; GPU disposal alone does not close it.
    texture.source?.data?.close?.();
  });
}

async function loadLocalTexture(url,signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Texture request failed (${response.status}).`);
  const blob = await response.blob();
  let texture;
  if (typeof createImageBitmap === 'function') {
    texture = new THREE.Texture(await createImageBitmap(blob, {premultiplyAlpha:'none',colorSpaceConversion:'none'}));
  } else {
    const url=URL.createObjectURL(blob);
    try { texture=await new THREE.TextureLoader().loadAsync(url); }
    finally { URL.revokeObjectURL(url); }
  }
  if (signal.aborted) {
    texture.dispose();texture.source?.data?.close?.();
    throw new DOMException('Texture loading cancelled.', 'AbortError');
  }
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

async function loadMouthTexture(signal) {
  const texture=await loadLocalTexture(MOUTH_ATLAS,signal);
  setMouthFrame(texture);
  return texture;
}

export async function loadReplacementHalo(root,signal) {
  if(!root.getObjectByName('CH0069') || !root.getObjectByName('CH0069_Halo'))return;
  const {MIKA_HALO_FILES,createMikaHalo,attachMikaHalo}=await import('./mika-halo.js');
  const readText=async url=>{
    const response=await fetch(url,{signal});
    if(!response.ok)throw new Error(`Halo request failed (${response.status}).`);
    return response.text();
  };
  let texture,replacement;
  try {
    // allSettled ensures resources that finish after a sibling failure are owned.
    const results=await Promise.allSettled([
      readText(MIKA_HALO_FILES.obj),readText(MIKA_HALO_FILES.mtl),loadLocalTexture(MIKA_HALO_FILES.texture,signal)
    ]);
    if(results[2].status==='fulfilled')texture=results[2].value;
    const failed=results.find(item=>item.status==='rejected');
    if(failed)throw failed.reason;
    if(signal.aborted)throw new DOMException('Halo loading cancelled.','AbortError');
    replacement=createMikaHalo(results[0].value,results[1].value,texture);
    if(attachMikaHalo(root,replacement)) {
      replacement=null; // Root owns geometry, materials and texture-source clones.
      texture.dispose();texture=null;
    }
  } finally {
    releaseObject(replacement);
    texture?.dispose();texture?.source?.data?.close?.();
  }
}

async function readModel(url, signal, status) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Model request failed (${response.status}).`);
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      status({ state: 'loading', loaded, total, progress: total ? loaded / total : 0 });
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return bytes.buffer;
}

/**
 * @param {HTMLElement} container Empty stage owned by this viewer.
 * @param {{file: string, name?: string}} model Catalog model, with a local GLB path.
 * @param {{onStatus?: Function, onAnimationChange?: Function, reducedMotion?: boolean, signal?: AbortSignal}} options
 * @returns {Promise<{dispose: Function, setAnimation: Function, getAnimations: Function,
 * getAnimation: Function, resetCamera: Function, setPaused: Function, isPaused: Function}>}
 */
export async function mount(container, model, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('A viewer container is required.');
  if (!model?.file) throw new TypeError('A local model file is required.');
  if (location.protocol === 'file:') throw new Error('3D previews require a local HTTP server.');
  const status = value => options.onStatus?.(value);
  const request = new AbortController();
  const signal = options.signal;
  const abortRequest = () => request.abort(signal?.reason);
  if (signal?.aborted) abortRequest();
  else signal?.addEventListener('abort', abortRequest, { once: true });

  let renderer;
  let toonRenderer;
  let controls;
  let root;
  let mixer;
  let animationPlayer;
  let removeInteraction;
  let framingBounds;
  let resizeObserver;
  let intersectionObserver;
  let frame = 0;
  let disposed = false;
  let visible = true;
  let lastTime = 0;
  let paused = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  let clips = [];
  let fitted = false;
  let lastWidth = 0, lastHeight = 0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const wrapper = new THREE.Group();
  scene.add(wrapper);
  // A soft studio rig: open up face/dress shadows without bleaching the textures.
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  scene.add(new THREE.HemisphereLight(0xf1f7ff, 0xdad5e8, .7));
  const keyLight = new THREE.DirectionalLight(0xfff5ec, 1.4);
  keyLight.position.set(3, 4, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xe8f1ff, .6);
  fillLight.position.set(-4, 2, 4);
  scene.add(fillLight);

  function render() {
    if (!disposed && renderer && !document.hidden && visible) {
      if(toonRenderer)toonRenderer.render();else renderer.render(scene,camera);
    }
  }

  function tick(time) {
    frame = 0;
    if (disposed || document.hidden || !visible) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (!paused) animationPlayer?.update(delta);
    render();
    if (!paused && clips.length) frame = requestAnimationFrame(tick);
  }

  function updateLoop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (disposed || document.hidden || !visible) return;
    render();
    if (!paused && clips.length) frame = requestAnimationFrame(tick);
  }

  function resetCamera() {
    if (disposed || !root || !controls) return;
    if (container.clientWidth < 2 || container.clientHeight < 2) { fitted=false; return; }
    const box = framingBounds || getModelBounds(wrapper);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (box.isEmpty() || !Number.isFinite(size.length())) return;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const pageStage = container.closest('.page-model-stage') && !document.fullscreenElement;
    const occupancy = pageStage ? .86 : .85;
    const distance = Math.max(size.y / (2 * tangent * occupancy), size.x / (2 * tangent * camera.aspect * .9)) + size.z / 2;
    camera.clearViewOffset();
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(distance * 0.12, distance * 0.035, distance));
    camera.near = Math.max(distance / 500, 0.001);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.minDistance = distance * 0.25;
    controls.maxDistance = distance * 3;
    controls.update();
    controls.saveState();
    fitted = true;
    render();
  }

  function resize() {
    if (!renderer || disposed) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 2 || height < 2) { fitted=false; return; }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Portrait stages need a fresh fit; preserve user orbit for ordinary resize noise.
    if (root && (!fitted || width!==lastWidth || height!==lastHeight)) resetCamera();
    lastWidth=width;lastHeight=height;
    render();
  }

  function fullscreenResize() { fitted=false; resize(); }

  // A page-wide canvas must not trap normal page scrolling. Ctrl+wheel still zooms.
  function pageWheel(event) {
    if (container.closest('.page-model-stage') && !document.fullscreenElement && !event.ctrlKey) event.stopImmediatePropagation();
  }

  function setAnimation(name) {
    if (disposed || !animationPlayer?.setAnimation(name)) return false;
    render();
    return true;
  }

  function pickUp() {
    if (disposed || !animationPlayer?.pickUp()) return false;
    render();
    return true;
  }

  const raycaster = new THREE.Raycaster();
  function hitModel(event) {
    if (!root || !renderer || disposed) return false;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const point = new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, 1-(event.clientY-rect.top)/rect.height*2);
    if (Math.abs(point.x)>1 || Math.abs(point.y)>1) return false;
    getModelBounds(wrapper);
    const meshes = [];
    root.traverseVisible(object => {
      if (!object.isMesh) return;
      // Skinned bounds otherwise stay cached at an old pose after the first tap.
      if (object.isSkinnedMesh) { object.computeBoundingSphere(); object.computeBoundingBox(); }
      if ([object.material].flat().some(material => material?.visible)) meshes.push(object);
    });
    raycaster.setFromCamera(point, camera);
    return raycaster.intersectObjects(meshes, false).length > 0;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    request.abort();
    signal?.removeEventListener('abort', abortRequest);
    signal?.removeEventListener('abort', dispose);
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', updateLoop);
    window.removeEventListener('resize', resize);
    document.removeEventListener('fullscreenchange', fullscreenResize);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    removeInteraction?.();
    controls?.dispose();
    renderer?.domElement.removeEventListener('wheel', pageWheel, true);
    animationPlayer?.dispose();
    mixer?.stopAllAction();
    if (root) mixer?.uncacheRoot(root);
    toonRenderer?.dispose();
    releaseObject(root);
    wrapper.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
  }

  try {
    status({ state: 'loading', loaded: 0, total: 0, progress: 0 });
    if (request.signal.aborted) throw new DOMException('Model loading cancelled.', 'AbortError');
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.domElement.className = 'model-viewer-canvas';
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', model.name || '3D');
    container.append(renderer.domElement);
    renderer.domElement.addEventListener('wheel',pageWheel,{capture:true,passive:true});
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.75;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.addEventListener('change', render);
    resize();

    const url = new URL(model.file, document.baseURI);
    const bytes = await readModel(url, request.signal, status);
    const gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', url).href);
    root = gltf.scene;
    if (request.signal.aborted) throw new DOMException('Model loading cancelled.', 'AbortError');
    prepareMaterials(root);
    // Repair exported coordinate spaces before halo reparenting or the first fit.
    const animations=prepareAnimations(root,gltf.animations);
    bindHalo(root);
    try {
      await loadReplacementHalo(root,request.signal);
    } catch(error) {
      if(error.name==='AbortError')throw error;
      console.warn('Independent halo unavailable; keeping the embedded halo.',error);
      status({state:'warning',error});
    }
    let mouthTexture;
    try {
      mouthTexture=await loadMouthTexture(request.signal);
      if (attachMouth(root,mouthTexture)) mouthTexture=null; // The root now owns it.
    } catch (error) {
      if (error.name==='AbortError') throw error;
      // A failed expression atlas should not hide an otherwise intact body/eyes.
      console.warn('Mouth expression unavailable; keeping the embedded face texture.',error);
      status({state:'warning',error});
    } finally {
      mouthTexture?.dispose();mouthTexture?.source?.data?.close?.();
    }
    if (request.signal.aborted) throw new DOMException('Model loading cancelled.', 'AbortError');
    wrapper.add(root);
    clips = animations.filter(clip => !/(?:_Cam|_Camera)$/i.test(clip.name));
    mixer = new THREE.AnimationMixer(root);
    // Normalize in a stable standing pose before starting the entrance animation.
    // Interactions/fullscreen changes should not make the camera jump with a pose.
    const initial = selectModelAnimations(clips).idle;
    const referenceAction = initial && mixer.clipAction(initial).play();
    mixer.update(0);
    const box = getModelBounds(root);
    const size = box.getSize(new THREE.Vector3());
    if (box.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0) throw new Error('Model has no renderable geometry.');
    const scale = 2.8 / (size.y || size.length());
    wrapper.scale.setScalar(scale);
    wrapper.position.set(-box.getCenter(new THREE.Vector3()).x * scale, -box.min.y * scale, 0);
    framingBounds = getModelBounds(wrapper);
    referenceAction?.stop();
    framingBounds = includeModelPropBounds(wrapper, clips, framingBounds);
    animationPlayer = createModelAnimationPlayer(mixer, clips, name => options.onAnimationChange?.(name));
    if (animationPlayer.canPickUp()) {
      renderer.domElement.setAttribute('role', 'button');
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('aria-keyshortcuts', 'Enter Space');
      removeInteraction = bindModelInteraction(renderer.domElement, hitModel, pickUp);
    }
    animationPlayer.start();
    toonRenderer=createToonRenderer(renderer,scene,camera,root);
    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) resize();
      updateLoop();
    });
    intersectionObserver.observe(container);
    document.addEventListener('visibilitychange', updateLoop);
    window.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', fullscreenResize);
    signal?.addEventListener('abort', dispose, { once: true });
    updateLoop();
    status({ state: 'ready', progress: 1, animations: clips.map(clip => clip.name) });
    return {
      dispose,
      setAnimation,
      pickUp,
      canPickUp: () => animationPlayer.canPickUp(),
      getAnimations: () => clips.map(clip => clip.name),
      getAnimation: () => animationPlayer.getAnimation(),
      resetCamera,
      setPaused(value) { paused = Boolean(value); updateLoop(); },
      isPaused: () => paused
    };
  } catch (error) {
    dispose();
    if (error.name !== 'AbortError') status({ state: 'error', error });
    throw error;
  }
}
