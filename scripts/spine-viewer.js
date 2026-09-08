/**
 * Project Archive's lazy memory-lobby adapter.
 * The unmodified, pinned runtime and its full license are in
 * assets/vendor/spine/4.2.120/. A Spine Editor license is required for integration.
 * Serve this project over HTTP(S): browsers block local-file module/asset fetches.
 */

const RUNTIME_VERSION = '4.2.120';
const RUNTIME_URL = new URL('../assets/vendor/spine/4.2.120/spine-player.min.mjs', import.meta.url);
const activeMounts = new WeakMap();
let runtimePromise;

function viewerError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import(RUNTIME_URL.href).catch(error => {
      runtimePromise = undefined;
      throw viewerError('runtime', 'The local Spine runtime could not be loaded.', error);
    });
  }
  return runtimePromise;
}

/** Prefer the actual lobby loop, not Dummy / Start_Idle / a mouth-only track. */
export function chooseIdleAnimation(names) {
  return names.find(name => /^idle(?:_?0?1)?$/i.test(name))
    || names.find(name => /idle/i.test(name) && !/start|intro|end|_m$/i.test(name))
    || names.find(name => !/dummy|start|intro|_m$/i.test(name))
    || names[0]
    || '';
}

function boundsOfSlot(slot, runtime) {
  const attachment = slot.getAttachment();
  if (!attachment || !slot.bone.active || slot.color.a <= 0.001 || attachment.color?.a <= 0.001) return null;
  const vertices = [];
  if (attachment instanceof runtime.RegionAttachment) {
    attachment.computeWorldVertices(slot, vertices, 0, 2);
  } else if (attachment instanceof runtime.MeshAttachment) {
    attachment.computeWorldVertices(slot, 0, attachment.worldVerticesLength, vertices, 0, 2);
  } else {
    return null;
  }
  let x = Infinity, y = Infinity, right = -Infinity, top = -Infinity;
  for (let i = 0; i < vertices.length; i += 2) {
    x = Math.min(x, vertices[i]);
    y = Math.min(y, vertices[i + 1]);
    right = Math.max(right, vertices[i]);
    top = Math.max(top, vertices[i + 1]);
  }
  const bounds = { x, y, width: right - x, height: top - y };
  return validViewport(bounds) ? bounds : null;
}

function validViewport(value) {
  return value && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(value[key]))
    && value.width > 0 && value.height > 0;
}

/**
 * BA lobbies can contain several intro scenes parked far outside the main scene.
 * Spine's generic bounds include those scenes (Hina's are over 16,000 units wide).
 * Fit the central background where available, otherwise visible non-intro art.
 * A verified per-lobby viewport in the manifest always wins over this heuristic.
 */
export function getLobbyViewport(skeleton, runtime, override) {
  if (validViewport(override)) return { ...override };
  const candidates = [];
  for (const slot of skeleton.drawOrder) {
    // Some exports (notably dress Hina) put the *main* BG under intro_02.
    // Attachment names identify detached panels more reliably than ancestor names.
    if (/intro|start_/i.test(slot.data.name)) continue;
    const bounds = boundsOfSlot(slot, runtime);
    if (bounds) candidates.push({ name: slot.data.name, bounds });
  }
  const backgrounds = candidates.filter(item => /^(?:bg|background)(?:[_\s\d]|$)/i.test(item.name)
    && !/light|bloom|snow|particle|screen|(?:^|_)fx(?:_|$)/i.test(item.name));
  // A background may be split into walls/bed/etc. (Mika). Merge its connected
  // pieces, not just BG_01; detached intro panels must not shrink the main scene.
  backgrounds.sort((a,b)=>Number(!/^(?:bg|background)$/i.test(a.name))-Number(!/^(?:bg|background)$/i.test(b.name))
    || Math.abs(a.bounds.x+a.bounds.width/2)-Math.abs(b.bounds.x+b.bounds.width/2));
  if (backgrounds.length) {
    let result={...backgrounds.shift().bounds}, changed=true;
    while(changed) {
      changed=false;
      for(let i=backgrounds.length-1;i>=0;i--) {
        const b=backgrounds[i].bounds;
        if(b.x<=result.x+result.width && b.x+b.width>=result.x && b.y<=result.y+result.height && b.y+b.height>=result.y) {
          result=unionBounds([result,b]);backgrounds.splice(i,1);changed=true;
        }
      }
    }
    return result;
  }
  if (!candidates.length) return null;
  return unionBounds(candidates.map(item=>item.bounds));
}

function unionBounds(bounds) {
  const x = Math.min(...bounds.map(item => item.x));
  const y = Math.min(...bounds.map(item => item.y));
  return {
    x, y,
    width: Math.max(...bounds.map(item => item.x + item.width)) - x,
    height: Math.max(...bounds.map(item => item.y + item.height)) - y
  };
}

/** Match a photo frame without stretching the artwork; cover crops symmetrically. */
export function fitLobbyViewport(bounds,width,height,fit='cover') {
  if(!validViewport(bounds) || !(width>0) || !(height>0) || !Number.isFinite(width+height))return null;
  if(fit==='contain')return {...bounds};
  const aspect=width/height;
  const fittedWidth=Math.min(bounds.width,bounds.height*aspect);
  const fittedHeight=fittedWidth/aspect;
  return {x:bounds.x+(bounds.width-fittedWidth)/2,y:bounds.y+(bounds.height-fittedHeight)/2,width:fittedWidth,height:fittedHeight};
}

/**
 * @param {HTMLElement} container Dedicated, already-sized media host.
 * @param {object} spine Local manifest record: {skel, atlas, version, name, viewport?}.
 * @param {object} options {onStatus({state, code?, message?}), reducedMotion, signal?, fit?:'cover'|'contain'}.
 * @returns {Promise<{dispose:Function,setAnimation:Function,getAnimations:Function,
 *   getAnimation:Function,resetCamera:Function,setPaused:Function,isPaused:Function}>}
 */
export async function mount(container, spine, options = {}) {
  if (!container?.appendChild) throw new TypeError('A media container is required.');
  activeMounts.get(container)?.();
  const { signal, onStatus } = options;
  let player, host, timeout, settled = false, disposed = false;
  let rejectLoad;
  let selectedAnimation = '';
  let animationNames = [];
  let paused = options.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let initialViewport;
  let fitMode=options.fit==='contain'?'contain':'cover';

  const report = (state, error) => {
    if (disposed && state !== 'error') return;
    try { onStatus?.({ state, code: error?.code, message: error?.message }); } catch (error) { console.error(error); }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', dispose);
    document.removeEventListener('visibilitychange', onVisibility);
    if (player) {
      player.stopRendering();
      // The upstream dispose expects its own wrapper to still be in its parent.
      if (player.dom && !player.dom.parentNode && host) host.appendChild(player.dom);
      try { player.dispose(); } catch (error) { console.warn('Spine cleanup:', error); }
    }
    host?.remove();
    if (activeMounts.get(container) === dispose) activeMounts.delete(container);
    if (!settled) rejectLoad?.(viewerError('aborted', 'Memory-lobby loading was cancelled.'));
  };
  const onVisibility = () => {
    if (!player || disposed) return;
    if (document.hidden || paused) player.pause();
    else player.play();
  };
  activeMounts.set(container, dispose);
  signal?.addEventListener('abort', dispose, { once: true });

  try {
    if (signal?.aborted) dispose();
    if (disposed) throw viewerError('aborted', 'Memory-lobby loading was cancelled.');
    if (location.protocol === 'file:') {
      throw viewerError('http-required', 'Start a local HTTP server to play memory lobbies.');
    }
    if (!spine?.skel || !spine?.atlas) {
      throw viewerError('missing-assets', 'This memory lobby has no local skeleton or atlas.');
    }
    if (spine.version && !/^4\.2(?:\.|$)/.test(spine.version)) {
      throw viewerError('unsupported-version', `Spine ${spine.version} is not compatible with the bundled ${RUNTIME_VERSION} runtime.`);
    }
    report('loading');
    const runtime = await loadRuntime();
    if (disposed) throw viewerError('aborted', 'Memory-lobby loading was cancelled.');

    host = document.createElement('div');
    host.className = 'pa-spine-host';
    Object.assign(host.style, { width: '100%', height: '100%', position: 'relative', overflow: 'hidden' });
    container.appendChild(host);

    const controller = {
      dispose,
      getAnimations: () => [...animationNames],
      getAnimation: () => selectedAnimation,
      isPaused: () => paused,
      getFit: () => fitMode,
      setFit(value) {if(!disposed && ['cover','contain'].includes(value))fitMode=value;},
      setPaused(value) {
        if (disposed) return;
        paused = Boolean(value);
        onVisibility();
      },
      setAnimation(name) {
        if (disposed || !animationNames.includes(name)) return false;
        selectedAnimation = name;
        player.skeleton.setToSetupPose();
        player.animationState.clearTracks();
        // Idle continues underneath talk/face overlays, mirroring lobby layering.
        const idle = chooseIdleAnimation(animationNames);
        const overlay = name !== idle && /^(?:talk|pat|look)/i.test(name);
        if (overlay && idle) player.animationState.setAnimation(0, idle, true);
        player.animationState.setAnimation(overlay ? 1 : 0, name, true);
        if (/_a$/i.test(name)) {
          const mouth = name.replace(/_a$/i, '_M');
          const companion = animationNames.find(item => item.toLowerCase() === mouth.toLowerCase());
          if (companion) player.animationState.setAnimation(2, companion, true);
        }
        player.animationState.apply(player.skeleton);
        player.skeleton.updateWorldTransform(runtime.Physics.update);
        onVisibility();
        return true;
      },
      resetCamera() {
        if (disposed || !selectedAnimation) return;
        fitMode='cover';
        Object.assign(config.viewport, initialViewport || {});
        player.setViewport(selectedAnimation);
        // setViewport may pose the skeleton while calculating fallback bounds.
        player.animationState.apply(player.skeleton);
        player.skeleton.updateWorldTransform(runtime.Physics.update);
      }
    };

    const config = {
      skeleton: new URL(spine.skel, document.baseURI).href,
      atlas: new URL(spine.atlas, document.baseURI).href,
      showControls: false,
      interactive: false,
      showLoading: !paused,
      // Kivo's exported lobby atlases use straight alpha; manifest may override.
      premultipliedAlpha: spine.premultipliedAlpha ?? false,
      alpha: true,
      backgroundColor: '#00000000',
      defaultMix: options.reducedMotion ? 0 : 0.2,
      viewport: { padLeft: '0%', padRight: '0%', padTop: '0%', padBottom: '0%', transitionTime: 0 },
      update(loaded) {
        // Called after the runtime resizes and places its camera, before drawing.
        // This also runs while paused, so resize/fullscreen never resets animation.
        const view=fitLobbyViewport(initialViewport,loaded.canvas.width,loaded.canvas.height,fitMode);
        if(!view)return;
        const camera=loaded.sceneRenderer.camera;
        camera.position.x=view.x+view.width/2;camera.position.y=view.y+view.height/2;
        camera.zoom=Math.max(view.width/loaded.canvas.width,view.height/loaded.canvas.height);
      },
      success(loaded) {
        player = loaded;
        if (disposed) { queueMicrotask(() => { try { loaded.dispose(); } catch (_) {} }); return; }
        try {
          const actualVersion = loaded.skeleton.data.version;
          if (actualVersion && !/^4\.2(?:\.|$)/.test(actualVersion)) {
            throw viewerError('unsupported-version', `Unsupported skeleton version: ${actualVersion}.`);
          }
          animationNames = loaded.skeleton.data.animations.map(animation => animation.name);
          selectedAnimation = chooseIdleAnimation(animationNames);
          if (!selectedAnimation) throw viewerError('no-animations', 'This memory lobby contains no animations.');
          loaded.animationState.setAnimation(0, selectedAnimation, true);
          loaded.animationState.apply(loaded.skeleton);
          loaded.skeleton.updateWorldTransform(runtime.Physics.update);
          initialViewport = getLobbyViewport(loaded.skeleton, runtime, spine.viewport);
          if (initialViewport) Object.assign(config.viewport, initialViewport);
          loaded.setViewport(selectedAnimation);
          loaded.animationState.apply(loaded.skeleton);
          loaded.skeleton.updateWorldTransform(runtime.Physics.update);
          loaded.canvas?.setAttribute('aria-label', spine.name || 'Memory lobby');
          loaded.canvas?.setAttribute('role', 'img');
          // Upstream starts playback after success(), so apply pause afterward.
          queueMicrotask(() => {
            if (disposed) return;
            onVisibility();
            clearTimeout(timeout);
            document.addEventListener('visibilitychange', onVisibility);
            settled = true;
            report('ready');
            resolveLoad(controller);
          });
        } catch (error) { fail(error); }
      },
      error(loaded, reason) {
        player = loaded;
        fail(viewerError('render', String(reason || 'The memory lobby could not be rendered.')));
      }
    };

    let resolveLoad;
    const ready = new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
    const fail = error => {
      if (settled || disposed) return;
      settled = true;
      clearTimeout(timeout);
      report('error', error);
      rejectLoad(error);
      queueMicrotask(dispose);
    };
    timeout = setTimeout(() => fail(viewerError('timeout', 'Memory-lobby loading timed out. Try again.')), 60000);
    try { player = new runtime.SpinePlayer(host, config); }
    catch (error) { fail(viewerError('webgl', 'The WebGL player could not start.', error)); }
    return await ready;
  } catch (error) {
    if (!settled && error.code !== 'aborted') report('error', error);
    dispose();
    throw error;
  }
}
