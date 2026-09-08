/* Async gallery/controller regression, using fake media + Web Animations in jsdom.
   Browser checks remain necessary for GPU pixels and perceived motion. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.PAWEB_TEST_MODULES?path.join(process.env.PAWEB_TEST_MODULES,'jsdom'):'jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'scripts/gallery.js'),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({reduced=false,stored}={}) {
  const dom=new JSDOM(html,{url:'http://127.0.0.1:18900/index.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,animations=[],mounts=[],listeners=new Set(),observers=[];
  if(stored)w.localStorage.setItem('pa-ambient-motion',stored);
  const media={matches:reduced,addEventListener(type,fn){listeners.add(fn);}};
  w.matchMedia=()=>media;
  w.HTMLElement.prototype.getBoundingClientRect=()=>({top:80,bottom:700,width:900,height:620});
  w.HTMLElement.prototype.scrollTo=()=>{};
  w.IntersectionObserver=class {constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}};
  w.HTMLElement.prototype.animate=function(frames,options) {
    let resolve,reject,settled=false;
    const animation={element:this,frames,options,cancelled:false,
      finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
      finish(){if(!settled){settled=true;resolve();}},
      cancel(){this.cancelled=true;if(!settled){settled=true;reject(new Error('cancelled'));}}
    };
    animations.push(animation);return animation;
  };
  const roster=[1,2,3].map(id=>({id,name:'Student '+id,academy:'A',role:'Support',teamPosition:'Back',attackType:'Mystic',defenseType:'Light',weapon:'HG',rarity:3,img:'portrait.png',kivoId:id}));
  w.PA_MEDIA_CATALOG={students:Object.fromEntries(roster.map(student=>[student.id,{portrait:'portrait.png',models:[{type:'body',ready:true,file:student.id+'.glb',files:[]}],spines:[]}]))};
  w.eval(source);
  const viewer={mount(container,item,options){
    let resolve,reject;
    const canvas=d.createElement('canvas');container.append(canvas);
    const mounted={disposed:false,resetCount:0,paused:false,fit:options.fit,
      dispose(){this.disposed=true;canvas.remove();},
      getAnimations:()=>['Victory_Start','Victory_End','Pickup'],getAnimation:()=> 'Victory_Start',
      setPaused(value){this.paused=value;},resetCamera(){this.resetCount++;this.fit='cover';},canPickUp:()=>true,
      setFit(value){this.fit=value;},getFit(){return this.fit;}
    };
    const job={container,item,options,mounted,resolve:()=>resolve(mounted),fail(){mounted.dispose();reject(new Error('Test asset unavailable'));}};
    mounts.push(job);
    return new Promise((yes,no)=>{resolve=yes;reject=no;});
  }};
  const gallery=w.PAGallery.create(d.querySelector('#characterShowcase'),{
    getName:c=>c.name,getEnglishName:c=>c.name,getContent:()=>({desc:'Profile'}),localize:v=>v,
    onSelect(){},openDetails(){},loadImage(el,src,label){el.src=src;el.alt=label;},loadViewer:async()=>viewer
  });
  gallery.update(roster,'cn');
  observers.forEach(observer=>observer.fn([{target:d.querySelector('#characters'),isIntersecting:true}]));
  return {w,d,dom,gallery,roster,mounts,animations,observers,
    async ready(){await flush();mounts.at(-1).resolve();await flush();},
    async finish(){animations.filter(a=>!a.cancelled).forEach(a=>a.finish());await flush();},
    reduce(value){media.matches=value;listeners.forEach(fn=>fn({matches:value}));},
    hide(value){Object.defineProperty(d,'hidden',{configurable:true,value});d.dispatchEvent(new w.Event('visibilitychange'));}
  };
}
(async()=>{
  const f=fixture();await f.ready();
  assert.equal(f.d.querySelector('.showcase-player').inert,false);
  assert.equal(f.d.querySelector('.showcase-player').dataset.reveal,undefined);
  assert.ok(f.animations.some(a=>a.options.duration===380 && a.frames[0].opacity===0));
  assert.equal(f.mounts[0].mounted.resetCount,0,'Entrance must not reset camera');
  await f.finish();
  f.gallery.select(2);
  const leave=f.animations.at(-1);
  assert.equal(leave.options.duration,140);
  assert.equal(f.mounts[0].mounted.disposed,false,'Old model survives the short exit');
  assert.equal(f.d.querySelector('.showcase-player').inert,true);
  f.gallery.select(3);
  assert.ok(leave.cancelled,'Fast selection cancels the old exit');
  await f.finish();
  assert.equal(f.mounts.length,2,'Intermediate selection never mounts');
  assert.equal(f.mounts[1].item.file,'3.glb');
  assert.equal(f.mounts[0].mounted.disposed,true);
  await f.ready();await f.finish();
  assert.equal(f.d.querySelector('.showcase-name').textContent,'Student 3');
  f.gallery.select(2);await f.finish();
  const late=f.mounts.at(-1);
  f.gallery.select(1);await flush();
  assert.ok(late.options.signal.aborted,'Pending media is cancelled on another selection');
  const latest=f.mounts.at(-1);
  assert.notEqual(latest.container,late.container);
  assert.equal(late.container.isConnected,false);
  latest.resolve();await flush();late.resolve();await flush();
  assert.ok(late.mounted.disposed);
  assert.ok(!latest.mounted.disposed);
  assert.equal(f.d.querySelectorAll('.showcase-player canvas').length,1);
  assert.equal(f.d.querySelector('.showcase-name').textContent,'Student 1');
  const before=f.mounts.length,animationCount=f.animations.length;
  f.gallery.update(f.roster,'en');
  assert.equal(f.mounts.length,before,'Language changes do not remount');
  assert.equal(f.animations.length,animationCount,'Language changes do not restart entrances');
  assert.equal(f.d.querySelector('#ambientMotionToggle').textContent,'Pause background motion');
  f.gallery.update(f.roster,'jp');
  assert.equal(f.d.querySelector('#ambientMotionToggle').textContent,'背景の動きを止める');
  f.gallery.select(3);f.gallery.update([],'cn');await flush();
  assert.equal(f.gallery.selectedId,undefined);
  assert.equal(f.d.querySelectorAll('.showcase-player canvas').length,0);
  assert.equal(f.d.querySelector('.showcase-player').inert,false);
  assert.ok(f.animations.every(a=>a.cancelled),'Empty filter cancels every pending animation');
  console.log('PASS Ready-only entrance, old-model exit, latest selection wins, stale mount isolation, language changes and empty-filter cleanup');

  f.gallery.update(f.roster,'cn');await f.ready();
  f.reduce(true);await flush();
  assert.ok(f.animations.every(a=>a.cancelled));
  assert.equal(f.d.documentElement.dataset.ambientMotion,'paused');
  assert.ok(f.d.querySelector('#ambientMotionToggle').disabled);
  const reducedCount=f.animations.length;
  f.gallery.select(2);await f.ready();
  assert.equal(f.animations.length,reducedCount);
  assert.equal(f.d.querySelector('.showcase-player').dataset.reveal,undefined);
  assert.equal(f.d.querySelector('.showcase-player').inert,false);
  assert.equal(f.mounts.at(-1).mounted.paused,true);
  f.reduce(false);
  f.d.querySelector('#ambientMotionToggle').click();
  assert.equal(f.w.localStorage.getItem('pa-ambient-motion'),'paused');
  assert.equal(f.d.documentElement.dataset.ambientMotion,'paused');
  f.d.querySelector('#ambientMotionToggle').click();
  assert.equal(f.d.documentElement.dataset.ambientMotion,'running');
  f.hide(true);assert.equal(f.d.documentElement.dataset.ambientMotion,'paused');
  f.hide(false);assert.equal(f.d.documentElement.dataset.ambientMotion,'running');
  f.observers[0].fn([{target:f.d.querySelector('#characters'),isIntersecting:false}]);
  assert.equal(f.d.documentElement.dataset.ambientMotion,'paused','Offscreen ambient layer pauses');
  f.w.dispatchEvent(new f.w.Event('pagehide'));
  assert.equal(f.d.querySelectorAll('.showcase-player canvas').length,0);
  f.dom.window.close();
  const saved=fixture({stored:'paused'});await saved.ready();
  assert.equal(saved.d.documentElement.dataset.ambientMotion,'paused');
  saved.w.dispatchEvent(new saved.w.Event('pagehide'));saved.dom.window.close();
  console.log('PASS Reduced-motion changes, pause preference persistence, background visibility/offscreen pause and page cleanup');

  const portrait=fixture();await portrait.ready();await portrait.finish();
  portrait.d.querySelector('[data-mode="portrait"]').click();await flush();
  const illustration=portrait.d.querySelector('.showcase-portrait');
  assert.equal(illustration.dataset.reveal,'pending');
  const portraitCount=portrait.animations.length;
  illustration.dispatchEvent(new portrait.w.Event('load'));await flush();
  assert.equal(illustration.dataset.reveal,undefined);
  assert.ok(portrait.animations.length>portraitCount,'Illustration animates after load');
  portrait.gallery.select(2);await flush();
  portrait.d.querySelector('[data-mode="model"]').click();await portrait.ready();
  const modelCount=portrait.animations.length;
  illustration.dispatchEvent(new portrait.w.Event('load'));await flush();
  assert.equal(portrait.animations.length,modelCount,'Stale image load cannot animate a new model');
  assert.equal(portrait.d.querySelectorAll('.showcase-player canvas').length,1);
  portrait.hide(true);await flush();
  assert.ok(portrait.animations.every(a=>a.cancelled));
  assert.equal(portrait.d.querySelector('.showcase-player').inert,false);
  portrait.w.dispatchEvent(new portrait.w.Event('pagehide'));portrait.dom.window.close();
  console.log('PASS Image-ready entrance, cancelled image callbacks, switching media modes and hidden-tab reveal cleanup');

  const lobby=fixture();
  // The fixture uses fake media; add a lobby while preserving the same controller.
  lobby.w.PA_MEDIA_CATALOG.students[1].spines=[{ready:true,skel:'lobby.skel',atlas:'lobby.atlas',files:[]}];
  await lobby.ready();await lobby.finish();
  lobby.gallery.openPreview(1,'spine');await lobby.ready();await lobby.finish();
  const session=lobby.mounts.at(-1).mounted,loadCount=lobby.mounts.length;
  const viewport=lobby.d.querySelector('.showcase-viewport'),aperture=lobby.d.querySelector('.lobby-window');
  assert.equal(lobby.d.querySelector('.showcase-player').parentElement,aperture);
  assert.equal(lobby.d.querySelector('.showcase-portrait').parentElement,aperture);
  const expandButton=lobby.d.querySelector('button.showcase-fullscreen');
  assert.equal(expandButton.parentElement,lobby.d.querySelector('.lobby-photo-current'),'Expand button belongs to the moving photo');
  const frameCount=lobby.animations.length;
  assert.equal(lobby.d.querySelector('.showcase-viewport').dataset.mode,'spine');
  assert.equal(lobby.d.querySelector('.lobby-fit').hidden,false);
  lobby.d.querySelector('[data-lobby-fit="contain"]').click();
  assert.equal(session.fit,'contain');assert.equal(lobby.mounts.length,loadCount);
  lobby.gallery.update(lobby.roster,'en');
  assert.equal(lobby.d.querySelector('[data-lobby-fit="contain"]').textContent,'Full scene');
  assert.equal(session.fit,'contain');assert.equal(lobby.mounts.length,loadCount);
  lobby.d.querySelector('.showcase-reset').click();assert.equal(session.fit,'cover');
  assert.equal(lobby.d.querySelector('[data-lobby-fit="cover"]').getAttribute('aria-pressed'),'true');
  lobby.gallery.update(lobby.roster,'jp');
  assert.equal(lobby.d.querySelector('[data-lobby-fit="cover"]').textContent,'フレームに合わせる');
  assert.equal(lobby.animations.length,frameCount,'Fit, reset and language changes do not replay the photo frame');
  lobby.d.querySelector('[data-mode="model"]').click();await lobby.ready();await lobby.finish();
  assert.equal(lobby.d.querySelector('.lobby-fit').hidden,true);
  assert.equal(lobby.d.querySelector('.showcase-viewport').dataset.mode,'model');
  assert.equal(lobby.d.querySelector('.showcase-player').parentElement,viewport);
  assert.equal(lobby.d.querySelector('.showcase-portrait').parentElement,viewport);
  assert.equal(expandButton.parentElement,viewport,'Model mode restores the original expand control location');
  lobby.w.dispatchEvent(new lobby.w.Event('pagehide'));lobby.dom.window.close();
  console.log('PASS Lobby framing controls, three languages, no reload on fit changes, reset and borderless model-mode recovery');

  const photo=fixture();
  photo.roster.forEach(c=>{photo.w.PA_MEDIA_CATALOG.students[c.id].spines=[{ready:true,skel:c.id+'.skel',atlas:'lobby.atlas',files:[]}];});
  await photo.ready();await photo.finish();
  const photoViewport=photo.d.querySelector('.showcase-viewport'),currentPhoto=photo.d.querySelector('.lobby-photo-current');
  const photoWindow=photo.d.querySelector('.lobby-window');
  const paperAnimations=()=>photo.animations.filter(a=>a.element.matches('.lobby-photo,.lobby-paper-back,.lobby-pin,.lobby-tape'));
  const lobbyMotionStart=photo.animations.length;
  photo.gallery.openPreview(1,'spine');await flush();
  assert.equal(paperAnimations().length,0,'No arrival before the lobby is ready');
  await photo.ready();
  assert.deepEqual(paperAnimations().map(a=>a.options.duration),[540,600,600]);
  assert.equal(paperAnimations()[0].frames.at(-1).transform,'none');
  assert.equal(photo.mounts.at(-1).mounted.resetCount,0);
  await photo.finish();
  assert.ok(paperAnimations().every(a=>a.cancelled),'Settled frame leaves no filled effects');
  const oldLobby=photo.mounts.at(-1),beforeSwap=paperAnimations().length;
  photo.gallery.select(2);await flush();
  const intermediate=photo.mounts.at(-1),oldPhoto=photo.d.querySelector('.lobby-photo-outgoing');
  assert.equal(photoViewport.dataset.lobbySwap,'loading');
  assert.equal(paperAnimations().length,beforeSwap,'Wait for the new lobby before exchanging paper');
  assert.equal(oldLobby.mounted.disposed,false,'Current lobby survives the whole next load');
  assert.equal(oldLobby.mounted.paused,true,'Retained canvas does not keep animating');
  assert.ok(oldPhoto.contains(oldLobby.container),'Transfer the real canvas, never a blank clone');
  assert.equal(oldPhoto.getAttribute('aria-hidden'),'true');assert.equal(oldPhoto.inert,true);
  const oldExpand=oldPhoto.querySelector('.lobby-expand-echo');
  assert.equal(oldExpand.tagName,'SPAN');assert.equal(oldExpand.getAttribute('aria-hidden'),'true');
  assert.equal(photo.d.querySelectorAll('button.showcase-fullscreen').length,1,'Only one live fullscreen action');
  assert.equal(currentPhoto.inert,true,'The invisible incoming button must not receive focus during preload');
  assert.equal(photo.d.querySelector('.showcase-player').parentElement,photoWindow);
  photo.gallery.select(3);
  await flush();
  assert.ok(intermediate.options.signal.aborted,'Rapid selection aborts the unfinished second lobby');
  assert.equal(photo.d.querySelector('.lobby-photo-outgoing'),oldPhoto,'Keep the visible photo while replacing a pending load');
  intermediate.resolve();await flush();
  assert.ok(intermediate.mounted.disposed);
  assert.equal(paperAnimations().length,beforeSwap,'Stale loads never trigger the exchange');
  await photo.ready();
  assert.equal(photo.mounts.at(-1).item.skel,'3.skel');
  assert.equal(photoViewport.dataset.lobbySwap,'swapping');
  assert.equal(currentPhoto.inert,false);
  const exchange=paperAnimations().slice(beforeSwap).filter(a=>a.element.matches('.lobby-photo'));
  assert.equal(exchange.length,2);
  assert.ok(exchange.every(a=>a.options.duration===980));
  assert.equal(exchange[0].element,oldPhoto);assert.equal(exchange[1].element,currentPhoto);
  assert.ok(exchange[0].element.contains(oldExpand));
  assert.ok(exchange[1].element.contains(photo.d.querySelector('button.showcase-fullscreen')),'Both expand icons follow their own paper motion');
  assert.ok(exchange[0].frames[1].transform.includes('-23%'));
  assert.ok(exchange[1].frames[1].transform.includes('12%'));
  assert.ok(exchange[0].frames[0].zIndex>exchange[1].frames[0].zIndex);
  assert.ok(exchange[0].frames.at(-1).zIndex<exchange[1].frames.at(-1).zIndex,'Second photo really takes front');
  assert.ok(!photo.animations.slice(lobbyMotionStart).some(a=>a.element===photoWindow || a.element.matches('.lobby-paper-front,.showcase-player')),'Exchange whole photos, not unframed art');
  assert.equal(oldLobby.mounted.disposed,false,'Retain old photo through the exchange');
  await photo.finish();
  assert.ok(oldLobby.mounted.disposed);assert.ok(oldLobby.options.signal.aborted);
  assert.equal(photoViewport.dataset.lobbySwap,undefined);
  assert.equal(photo.d.querySelectorAll('.lobby-photo-outgoing').length,0);
  assert.equal(photo.d.querySelectorAll('.showcase-viewport canvas').length,1);
  assert.equal(photo.d.querySelectorAll('.lobby-expand-echo').length,0,'Outgoing icon is removed with its sheet');
  photo.gallery.select(2);await photo.ready();
  photo.d.dispatchEvent(new photo.w.Event('fullscreenchange'));await flush();
  assert.ok(paperAnimations().every(a=>a.cancelled),'Fullscreen cancels frame transforms');
  assert.equal(photo.d.querySelectorAll('.lobby-photo-outgoing').length,0);
  assert.equal(currentPhoto.inert,false,'Cancelling motion leaves the real fullscreen button usable');
  await photo.finish();
  photo.gallery.select(1);await photo.ready();
  const interrupted=paperAnimations().filter(a=>!a.cancelled),secondOld=photo.d.querySelector('.lobby-photo-outgoing');
  photo.gallery.select(3);await flush();
  assert.ok(interrupted.every(a=>a.cancelled),'An in-flight exchange can be replaced');
  assert.equal(secondOld.isConnected,false);
  assert.equal(photo.d.querySelectorAll('.lobby-photo-outgoing').length,1,'Never accumulate outgoing sheets');
  await photo.ready();
  photo.observers.at(-1).fn([{isIntersecting:false}]);await flush();
  assert.ok(paperAnimations().every(a=>a.cancelled),'Leaving the workspace settles the frame');
  photo.observers.at(-1).fn([{isIntersecting:true}]);
  await photo.finish();photo.gallery.select(1);await photo.ready();
  photo.hide(true);await flush();
  assert.ok(paperAnimations().every(a=>a.cancelled),'Hidden tabs do not keep paper animations alive');
  photo.hide(false);photo.reduce(true);await flush();
  const staticCount=paperAnimations().length;
  photo.gallery.select(2);await photo.ready();
  assert.equal(paperAnimations().length,staticCount,'Reduced motion uses a static frame');
  photo.reduce(false);photo.gallery.select(1);await flush();
  photo.w.console.warn=()=>{};
  photo.mounts.at(-1).fail();await flush();
  assert.ok(photo.d.querySelector('.lobby-photo-outgoing'),'Load failure retains the previous photo');
  assert.equal(photo.d.querySelector('.showcase-message').hidden,false);
  photo.d.querySelector('.showcase-recovery button').click();await photo.ready();await photo.finish();
  assert.equal(photo.d.querySelector('.showcase-message').hidden,true);
  assert.equal(photo.d.querySelectorAll('.lobby-photo-outgoing').length,0,'Retry recovers and cleans the retained photo');
  photo.gallery.select(3);await photo.ready();
  photo.gallery.update([],'cn');await flush();
  assert.ok(paperAnimations().every(a=>a.cancelled),'Empty results clear all paper effects');
  photo.w.dispatchEvent(new photo.w.Event('pagehide'));photo.dom.window.close();
  console.log('PASS Two real photos, preload-before-swap, opposing vertical motion and depth exchange, retained old canvas, fast/stale loads, retry and fullscreen/offscreen/hidden/reduced-motion cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
