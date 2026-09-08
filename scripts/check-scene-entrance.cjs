/* Viewport and lifecycle regression. Does not simulate WebGL or claim pixel QA. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require(path.join(process.env.PAWEB_TEST_MODULES || '', 'jsdom'));
const source=fs.readFileSync(path.join(__dirname,'ui-motion.js'),'utf8');
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function fixture({supported=true,io=true,reduced=false}={}) {
  const dom=new JSDOM(`<!doctype html><body><button id="outside">Navigation</button>
    <section id="characters">
      <div class="academy-heading">Choose a school</div>
      <div class="academy-navigation"><button class="strip-arrow">Prev</button>
        <div class="academy-cards">${Array.from({length:4},(_,i)=>`<button class="academy-card"><span class="academy-card-content">School ${i}</span></button>`).join('')}</div>
        <button class="strip-arrow">Next</button></div>
      <div id="characterProfileSlot"><aside class="showcase-info"><button>Profile</button></aside></div>
      <div id="characterModeSlot"><button>3D</button></div>
      <div class="showcase-viewport"><div class="showcase-player"><canvas role="button" tabindex="0"></canvas></div><div class="showcase-message" hidden>Loading</div></div>
      <div class="showcase-controls"><select><option>Victory_End</option></select></div>
      <div class="dock-heading"><input placeholder="Search"></div>
      <div class="student-strip-wrap"><button class="strip-arrow">Prev</button><div id="charGrid">${Array.from({length:4},(_,i)=>`<article role="button" tabindex="0" class="char-card card-enter" aria-pressed="${i===0}"><div class="avatar">Student ${i}</div></article>`).join('')}</div><button class="strip-arrow">Next</button></div>
      <div class="dock-bottom">Keyboard hints</div>
    </section></body>`,{runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,animations=[],observers=[],rects=new WeakMap(),preferences=new Map();
  const rect=(top=150,left=20,width=160,height=60)=>({top,bottom:top+height,left,right:left+width,width,height});
  w.HTMLElement.prototype.getBoundingClientRect=function(){return rects.get(this)||rect();};
  const section=d.querySelector('#characters');rects.set(section,rect(100,0,900,1200));
  for(const selector of ['.academy-cards','#charGrid']) {
    const strip=d.querySelector(selector);rects.set(strip,rect(150,100,450));
    [...strip.children].forEach((card,i)=>rects.set(card,rect(150,105+i*180,170)));
  }
  w.matchMedia=query=>{
    if(!preferences.has(query))preferences.set(query,{matches:query.includes('reduced-motion')&&reduced,listeners:new Set(),addEventListener(type,listener){this.listeners.add(listener);}});
    return preferences.get(query);
  };
  if(supported)w.Element.prototype.animate=function(frames,options){
    let resolve,reject;
    const a={element:this,frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){this.cancelled=true;reject(Error('cancelled'));},finish(){resolve();}};
    animations.push(a);return a;
  };
  if(io)w.IntersectionObserver=class {
    targets=new Set();constructor(callback,options){this.callback=callback;this.options=options;observers.push(this);}
    observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}
  };
  w.eval(source);const motion=w.PAInterfaceMotion.create();motion.observeCharacterScene();
  const parts=observers.find(o=>o.options?.rootMargin==='-84px 0px -24px 0px');
  const visits=observers.find(o=>o.options?.rootMargin==='80px 0px 80px 0px');
  return {dom,w,d,animations,observers,motion,rects,rect,section,parts,visits,
    enter(selectors){parts.callback(selectors.map(s=>({target:d.querySelector(s),isIntersecting:true})));},
    leave(){rects.set(section,rect(-1400,0,900,1200));visits.callback([{target:section,isIntersecting:false}]);},
    return(){rects.set(section,rect(100,0,900,1200));visits.callback([{target:section,isIntersecting:true}]);},
    change(query,value){const p=w.matchMedia(query);p.matches=value;p.listeners.forEach(fn=>fn());}
  };
}
(async()=>{
  const f=fixture();
  const top=['.academy-heading','.academy-navigation','#characterProfileSlot','#characterModeSlot','.showcase-viewport','.showcase-controls'];
  const dock=['.dock-heading','.student-strip-wrap','.dock-bottom'];
  const count=f.observers.length;f.motion.observeCharacterScene();assert.equal(f.observers.length,count,'Observer setup is idempotent');
  assert.equal(f.parts.targets.size,9);
  assert.equal(f.animations.length,0,'No prehidden or offscreen entry');
  f.enter(top);
  const first=f.animations.slice();
  assert.ok(first.some(a=>a.element.id==='characterProfileSlot' && a.frames[0].translate==='-34px 8px'));
  assert.ok(first.some(a=>a.element.matches('.showcase-viewport')));
  assert.ok(first.every(a=>!a.element.matches('canvas,.showcase-player,.showcase-info,.showcase-portrait') && !('transform' in a.frames[0])),'Only outer DOM surfaces; preserve gallery transforms/camera and model clips');
  const schools=first.filter(a=>a.element.matches('.academy-card'));
  assert.equal(schools.length,3,'Exclude horizontally clipped cards');
  assert.deepEqual(schools.map(a=>a.options.delay),[40,82,124]);
  assert.ok(first.every(a=>a.options.delay+a.options.duration<1000));
  f.enter(top);assert.equal(f.animations.length,first.length,'No repeated entries from observer noise');
  first.forEach(a=>a.finish());await flush();
  assert.ok(first.every(a=>a.cancelled),'Release filled effects after finishing');
  f.enter(dock);
  assert.equal(f.animations.filter(a=>a.element.matches('.char-card')).length,3);
  assert.ok([...f.d.querySelectorAll('.char-card')].slice(0,3).every(el=>!el.classList.contains('card-enter')));
  assert.equal(f.d.querySelector('.char-card').getAttribute('aria-pressed'),'true');
  console.log('PASS Staggered schools, profile/modes/model/controls, deferred mobile dock, clipped-card filtering and original selection/transform preservation');

  const before=f.animations.length;
  f.parts.callback([{target:f.d.querySelector('.academy-heading'),isIntersecting:false}]);
  f.enter(['.academy-heading']);assert.equal(f.animations.length,before,'Small scroll reversals do not replay');
  f.leave();assert.ok(f.animations.every(a=>a.cancelled));f.return();f.enter(top);
  assert.ok(f.animations.length>before,'A full section leave permits a new visit');
  let current=f.animations.at(-1);
  f.d.querySelector('#characterModeSlot button').dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true}));
  assert.ok(current.cancelled,'Pointer interaction settles the entire entrance immediately');
  f.leave();f.return();f.enter(top);current=f.animations.at(-1);
  f.d.querySelector('canvas').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.ok(current.cancelled,'Keyboard interaction settles entrance without intercepting the action');
  console.log('PASS One entrance per visit, full leave/reentry replay, pointer and keyboard cleanup');

  f.leave();f.return();f.d.querySelector('.showcase-message').hidden=false;
  const loadingCount=f.animations.length;f.enter(['.showcase-viewport']);assert.equal(f.animations.length,loadingCount,'Loading/error panel is not faded or hidden');
  f.d.querySelector('.showcase-message').hidden=true;
  f.leave();f.return();f.d.querySelector('#characterProfileSlot button').focus();
  f.enter(['#characterProfileSlot']);assert.equal(f.animations.length,loadingCount,'Never animate an already focused region');
  f.d.querySelector('#outside').focus();f.leave();f.return();f.enter(top);
  f.d.querySelector('#characterProfileSlot button').focus();
  assert.ok(f.animations.filter(a=>a.element.id==='characterProfileSlot').at(-1).cancelled);
  f.motion.select(f.d.querySelector('.academy-card'));
  assert.ok(f.animations.filter(a=>a.element.matches('.showcase-viewport')).every(a=>a.cancelled),'Student/school selection settles parent entrance before gallery transitions');
  console.log('PASS Loading/error readability, focused controls and interaction/selection coordination');

  for(const query of ['(prefers-reduced-motion: reduce)','(forced-colors: active)']) {
    f.leave();f.return();f.enter(top);f.change(query,true);
    assert.ok(f.animations.every(a=>a.cancelled));
    f.leave();f.return();const n=f.animations.length;f.enter(top);assert.equal(f.animations.length,n);
    f.change(query,false);
  }
  f.leave();f.return();f.enter(top);
  Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert.ok(f.animations.every(a=>a.cancelled));
  Object.defineProperty(f.d,'hidden',{configurable:true,value:false});
  f.leave();f.return();f.enter(top);f.w.dispatchEvent(new f.w.Event('pagehide'));
  assert.ok(f.animations.every(a=>a.cancelled));
  f.dom.window.close();
  for(const options of [{supported:false},{io:false},{reduced:true}]) {
    const fallback=fixture(options);if(fallback.parts)fallback.enter(top);
    assert.equal(fallback.animations.length,0);
    assert.ok([...fallback.d.querySelectorAll('#characters *')].every(el=>!el.style.opacity && !el.hidden || el.classList.contains('showcase-message')));
    fallback.dom.window.close();
  }
  console.log('PASS Reduced motion, forced colors, hidden tabs, page exit and missing APIs leave the interface fully usable');
})().catch(error=>{console.error(error);process.exitCode=1;});
