/* DOM/timing regression only; does not replace visual browser inspection. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM} = require(process.env.PAWEB_TEST_MODULES ? path.join(process.env.PAWEB_TEST_MODULES,'jsdom') : 'jsdom');
const source = fs.readFileSync(path.join(__dirname,'ui-motion.js'),'utf8');
const flush = async () => { for (let i=0;i<5;i++) await Promise.resolve(); };

function fixture({reduced=false,supported=true,io=true}={}) {
  const dom = new JSDOM(`<!doctype html><body>
    <button class="strip-arrow" style="position:static">Next</button>
    <button class="showcase-fullscreen" style="position:absolute">Expand</button>
    <button class="showcase-pause" disabled>Pause</button>
    <button class="clear-filters" aria-disabled="true">Clear</button>
    <div class="showcase-player"><canvas tabindex="0" role="button"></canvas></div>
    <button class="academy-card"><span class="academy-card-content">Academy</span></button>
    <article class="char-card" role="button"><div class="avatar">Student</div></article>
    <div id="cards"><article><button>Notice</button></article><article><button>Second</button></article></div>
  </body>`, {runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, d=w.document, animations=[], observers=[], preferences=new Map();
  w.matchMedia=query => {
    if (!preferences.has(query)) preferences.set(query, {
      matches:query.includes('reduced-motion') && reduced, listeners:new Set(),
      addEventListener(type, listener) { this.listeners.add(listener); }
    });
    return preferences.get(query);
  };
  w.HTMLElement.prototype.getBoundingClientRect=()=>({left:20,right:120,top:40,bottom:80,width:100,height:40});
  if (supported) w.Element.prototype.animate=function(frames, options) {
    let resolve, reject;
    const a={element:this,frames,options,cancelled:false,
      finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
      finish(){resolve();},cancel(){this.cancelled=true;reject(new Error('cancelled'));}
    };
    animations.push(a);
    return a;
  };
  if (io) w.IntersectionObserver=class {
    targets=new Set();
    constructor(callback){this.callback=callback;observers.push(this);}
    observe(target){this.targets.add(target);}
    unobserve(target){this.targets.delete(target);}
  };
  w.eval(source);
  const motion=w.PAInterfaceMotion.create();
  return {dom,w,d,motion,animations,observers,
    click(selector,init={}) {
      const el=typeof selector==='string'?d.querySelector(selector):selector;
      el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1,clientX:45,clientY:60,...init}));
    },
    change(query,value) {
      const media=w.matchMedia(query);media.matches=value;media.listeners.forEach(fn=>fn({matches:value}));
    },
    hide(value) {
      Object.defineProperty(d,'hidden',{configurable:true,value});d.dispatchEvent(new w.Event('visibilitychange'));
    },
    enter(cards) {observers[0].callback([...cards].map(target=>({target,isIntersecting:true})));}
  };
}

(async () => {
  const f=fixture();
  let clicks=0;
  f.d.querySelector('.strip-arrow').addEventListener('click',()=>clicks++);
  f.click('.strip-arrow');
  assert.equal(clicks,1,'Decoration does not intercept the action');
  assert.equal(f.d.querySelector('.strip-arrow').textContent,'Next');
  assert.equal(f.d.querySelector('.ui-tap-clip').getAttribute('aria-hidden'),'true');
  assert.equal(f.d.querySelector('.ui-tap-wave').style.left,'25%');
  assert.equal(f.d.querySelector('.ui-tap-wave').style.top,'50%');
  assert.ok(f.d.querySelector('.ui-tap-anchor'));
  const first=f.animations[0];
  for(let i=0;i<15;i++) f.click('.strip-arrow',{detail:0});
  await flush();
  assert.equal(f.d.querySelectorAll('.ui-tap-clip').length,1,'Repeated clicks replace rather than accumulate ripples');
  assert.equal(f.d.querySelector('.ui-tap-wave').style.left,'50%','Keyboard activation starts at the center');
  assert.ok(first.cancelled);
  f.animations.at(-1).finish();await flush();
  assert.equal(f.d.querySelectorAll('.ui-tap-clip,.ui-tap-anchor').length,0);
  f.click('.showcase-fullscreen');
  assert.equal(f.d.querySelector('.showcase-fullscreen').style.position,'absolute');
  assert.ok(!f.d.querySelector('.showcase-fullscreen').classList.contains('ui-tap-anchor'));
  f.animations.at(-1).finish();await flush();
  const before=f.animations.length;
  f.click('.showcase-player canvas');
  f.click('.showcase-pause');
  f.click('.clear-filters');
  f.click('.strip-arrow',{ctrlKey:true});
  f.click('.strip-arrow',{button:1});
  assert.equal(f.animations.length,before,'Canvas, disabled and modified clicks stay untouched');
  console.log('PASS Pointer/keyboard ripples, original actions, decorative accessibility, rapid-click cleanup and exclusions');

  f.motion.select(f.d.querySelector('.academy-card'));
  assert.equal(f.animations.at(-1).element.className,'academy-card-content');
  const selected=f.animations.at(-1);
  f.motion.select(f.d.querySelector('.academy-card'));
  assert.ok(selected.cancelled);
  f.motion.select(f.d.querySelector('.char-card'));
  assert.equal(f.animations.at(-1).element.className,'avatar');
  assert.equal(f.animations.at(-1).frames.at(-1).scale,'1');
  assert.equal(f.animations.at(-1).options.duration,330);
  f.hide(true);await flush();
  assert.ok(f.animations.every(a=>a.cancelled));
  f.hide(false);
  console.log('PASS Selection rebounds use inner surfaces and preserve layout/canvas transforms');

  const cards=[...f.d.querySelector('#cards').children];
  f.motion.observeCards(cards);
  assert.equal(f.observers[0].targets.size,2);
  assert.ok(cards.every(card=>!card.hasAttribute('style')),'Waiting content is immediately readable');
  f.enter(cards);
  assert.equal(f.animations.at(-2).options.delay,0);
  assert.equal(f.animations.at(-1).options.delay,65);
  assert.equal(f.animations.at(-1).options.duration,420);
  assert.equal(f.observers[0].targets.size,0,'Entrances run only on first intersection');
  f.motion.observeCards(cards);
  assert.equal(f.observers[0].targets.size,0,'Same cards never replay');
  const second=f.animations.at(-1);
  cards[1].querySelector('button').focus();
  assert.ok(second.cancelled,'Focus restores the fully visible card immediately');
  const firstEntrance=f.animations.at(-2);
  cards[0].remove();
  const replacement=f.d.createElement('article');f.d.querySelector('#cards').append(replacement);
  f.motion.observeCards([replacement]);
  assert.ok(firstEntrance.cancelled,'Rebuilding content cancels its detached entrance');
  replacement.remove();f.motion.observeCards([]);
  assert.equal(f.observers[0].targets.size,0,'Rebuilds release detached observer targets');
  console.log('PASS Visible-only staggered entrances, no pre-hidden content, one-shot observation, focus and rebuild cleanup');

  f.click('.strip-arrow');
  f.change('(prefers-reduced-motion: reduce)',true);await flush();
  assert.equal(f.d.querySelectorAll('.ui-tap-clip').length,0);
  const reducedCount=f.animations.length;
  f.click('.strip-arrow');f.motion.select(f.d.querySelector('.academy-card'));
  assert.equal(f.animations.length,reducedCount);
  f.change('(prefers-reduced-motion: reduce)',false);
  f.click('.strip-arrow');
  f.change('(forced-colors: active)',true);await flush();
  assert.equal(f.d.querySelectorAll('.ui-tap-clip').length,0);
  f.change('(forced-colors: active)',false);
  f.click('.strip-arrow');f.hide(true);await flush();
  assert.equal(f.d.querySelectorAll('.ui-tap-clip').length,0);
  f.hide(false);f.click('.strip-arrow');f.w.dispatchEvent(new f.w.Event('pagehide'));await flush();
  assert.equal(f.d.querySelectorAll('.ui-tap-clip').length,0);
  console.log('PASS Live reduced-motion/high-contrast changes, background tab and page-exit cleanup');
  f.dom.window.close();

  for(const options of [{supported:false},{io:false},{reduced:true}]) {
    const fallback=fixture(options);
    const fallbackCards=[...fallback.d.querySelector('#cards').children];
    fallback.motion.observeCards(fallbackCards);
    assert.ok(fallbackCards.every(card=>!card.hasAttribute('style')));
    fallback.click('.strip-arrow');
    if(options.supported===false || options.reduced) assert.equal(fallback.animations.length,0);
    fallback.dom.window.close();
  }
  console.log('PASS Missing APIs and initial reduced motion retain usable static controls/content');
})().catch(error=>{console.error(error);process.exitCode=1;});
