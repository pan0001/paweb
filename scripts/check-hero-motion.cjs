/* Offline homepage motion/lifecycle checks, not a visual/GPU benchmark. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.PAWEB_TEST_MODULES?path.join(process.env.PAWEB_TEST_MODULES,'jsdom'):'jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'hero-motion.js'),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture({reduced=false,forced=false,fine=true,enabled=true,io=true,waapi=true,segmenter=true}={}) {
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,hero=d.querySelector('#home');
  const media=new Map(),observers=[],animations=[],frames=new Map();let raf=0;
  d.documentElement.dataset.ambientEnabled=String(enabled);
  if(!segmenter)w.Intl.Segmenter=undefined;
  w.matchMedia=query=>{
    if(!media.has(query))media.set(query,{matches:query.includes('reduced-motion')?reduced:query.includes('forced-colors')?forced:fine,
      listeners:new Set(),addEventListener(type,fn){this.listeners.add(fn);}});
    return media.get(query);
  };
  w.Element.prototype.getBoundingClientRect=()=>({left:0,top:0,right:1000,bottom:600,width:1000,height:600});
  w.requestAnimationFrame=fn=>{frames.set(++raf,fn);return raf;};
  w.cancelAnimationFrame=id=>frames.delete(id);
  if(io)w.IntersectionObserver=class {constructor(fn){this.fn=fn;this.targets=new Set();observers.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}};
  if(waapi)w.Element.prototype.animate=function(keyframes,options){
    let resolve,reject;
    const a={element:this,keyframes,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
      cancel(){this.cancelled=true;reject(new Error('cancelled'));},finish(){resolve();}};
    animations.push(a);return a;
  };
  w.eval(source);w.PAHeroMotion.create();
  return {w,d,dom,hero,animations,observers,frames,
    enter(value){observers[0].fn([{target:hero,isIntersecting:value}]);},
    change(query,value){const m=w.matchMedia(query);m.matches=value;m.listeners.forEach(fn=>fn());},
    enabled(value){d.documentElement.dataset.ambientEnabled=String(value);d.dispatchEvent(new w.Event('pa:ambient-change'));},
    hide(value){Object.defineProperty(d,'hidden',{configurable:true,value});d.dispatchEvent(new w.Event('visibilitychange'));},
    move(type='mouse'){const event=new w.MouseEvent('pointermove',{clientX:900,clientY:500,bubbles:true});Object.defineProperty(event,'pointerType',{value:type});hero.dispatchEvent(event);},
    tick(){const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(0));}
  };
}
(async()=>{
  const f=fixture(),title=f.hero.querySelector('h1').innerHTML,titleText=f.hero.querySelector('h1').textContent,art=f.hero.querySelector('.hero-art');
  assert.equal(f.hero.dataset.heroMotion,'paused');
  assert.equal(f.animations.length,0,'No entrance before visible');
  f.enter(true);assert.equal(f.hero.dataset.heroMotion,'running');
  assert.ok(f.animations.some(a=>a.element===art));
  const actionAnimations=f.animations.filter(a=>a.element.matches('.hero-actions .btn'));
  assert.deepEqual(actionAnimations.map(a=>a.options.delay),[390,455,520]);
  assert.equal(f.hero.querySelector('h1').textContent,titleText);
  assert.ok(f.hero.querySelectorAll('.hero-glyph').length>5);
  assert.ok(f.hero.querySelector('h1').getAttribute('aria-label').includes('每一次相遇'));
  assert.ok([...f.hero.querySelectorAll('.hero-glyph-run')].every(run=>run.getAttribute('aria-hidden')==='true'));
  assert.ok(f.animations.every(a=>a.options.duration+a.options.delay<1500));
  const count=f.animations.length;f.enter(true);assert.equal(f.animations.length,count,'No duplicate entry');
  f.w.PAHeroMotion.create();assert.equal(f.observers.length,2,'Mount is idempotent');
  f.hero.querySelector('.hero-actions a').focus();await flush();assert.ok(f.animations.every(a=>a.cancelled));
  assert.equal(f.hero.querySelector('h1').innerHTML,title,'Focus restores original text nodes');
  assert.equal(f.hero.querySelector('h1').getAttribute('aria-label'),null);
  f.move();f.move();assert.equal(f.frames.size,1,'Pointer moves batch into one frame');f.tick();
  assert.match(art.style.translate,/5\.60px/);assert.equal(f.frames.size,0,'No idle RAF loop');
  assert.equal(f.hero.querySelector('.hero-content').style.translate,'','Text and controls never follow pointer');
  f.move();f.enter(false);assert.equal(f.frames.size,0);assert.equal(art.style.translate,'');
  assert.equal(f.hero.dataset.heroMotion,'paused');
  f.hero.querySelector('.hero-actions a').blur();f.enter(true);assert.ok(f.animations.length>count,'Return to homepage replays');
  console.log('PASS Visible-only stagger, preserved text/layout, one visit, focus cancellation and batched pointer parallax');
  f.enabled(false);assert.equal(f.hero.dataset.heroMotion,'paused');await flush();assert.ok(f.animations.every(a=>a.cancelled));
  f.move();assert.equal(f.frames.size,0);f.enabled(true);assert.equal(f.hero.dataset.heroMotion,'running');
  f.hide(true);assert.equal(f.hero.dataset.heroMotion,'paused');f.hide(false);assert.equal(f.hero.dataset.heroMotion,'running');
  f.change('(prefers-reduced-motion: reduce)',true);assert.equal(f.hero.dataset.heroMotion,'paused');
  f.change('(prefers-reduced-motion: reduce)',false);f.change('(forced-colors: active)',true);assert.equal(f.hero.dataset.heroMotion,'paused');
  f.change('(forced-colors: active)',false);
  f.change('(hover: hover) and (pointer: fine) and (min-width: 681px)',false);f.move();assert.equal(f.frames.size,0);
  f.change('(hover: hover) and (pointer: fine) and (min-width: 681px)',true);f.move('touch');assert.equal(f.frames.size,0);
  f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.hero.dataset.heroMotion,'paused');
  f.w.dispatchEvent(new f.w.Event('pageshow'));assert.equal(f.hero.dataset.heroMotion,'running');
  Object.defineProperty(f.d,'fullscreenElement',{configurable:true,value:f.d.body});f.d.dispatchEvent(new f.w.Event('fullscreenchange'));
  assert.equal(f.hero.dataset.heroMotion,'paused');f.dom.window.close();
  console.log('PASS Pause/resume, reduced motion, forced colors, touch exclusions, background/fullscreen and BFCache lifecycle');
  const deferred=fixture(),stat=deferred.hero.querySelector('.hero-panel .stat-card');
  stat.getBoundingClientRect=()=>({top:900,bottom:960,width:120,height:60});
  deferred.enter(true);assert.ok(deferred.observers[1].targets.has(stat));
  assert.ok(!deferred.animations.some(a=>a.element===stat),'Below-screen stats are not animated early');
  stat.getBoundingClientRect=()=>({top:300,bottom:360,width:120,height:60});
  deferred.observers[1].fn([{target:stat,isIntersecting:true}]);
  assert.ok(deferred.animations.some(a=>a.element===stat));
  assert.ok(!deferred.observers[1].targets.has(stat));
  deferred.enter(false);assert.equal(deferred.observers[1].targets.size,0);deferred.dom.window.close();
  console.log('PASS Below-screen homepage content waits for visibility and releases its observers after entry/exit');
  const translated=fixture(),heading=translated.hero.querySelector('h1');translated.enter(true);
  const oldAnimations=[...translated.animations];
  for(const [lang,markup] of [['en','Every encounter.<br><em>A new archive.</em>'],['ja','出会いの数だけ、<br><em>物語がある。</em>'],['zh-CN',title]]) {
    translated.d.documentElement.lang=lang;heading.innerHTML=markup;
    translated.d.dispatchEvent(new translated.w.Event('pa:language-change'));
    assert.equal(heading.querySelectorAll('br').length,1);
    if(lang==='en') {
      assert.equal(heading.getAttribute('aria-label'),'Every encounter. A new archive.');
      assert.ok([...heading.querySelectorAll('.hero-glyph-word')].some(word=>word.textContent==='encounter'));
    }
    const waves=translated.animations.filter(a=>a.element.className==='hero-glyph'&&!a.cancelled);
    assert.ok(waves.length>5);assert.ok(waves.at(-1).options.delay>waves[0].options.delay);
    translated.animations.forEach(a=>a.finish());await flush();
    assert.equal(heading.innerHTML,markup,'Natural completion restores exact localized markup');
    assert.equal(heading.getAttribute('aria-label'),null);
  }
  heading.innerHTML='か\u3099<br><em>👩‍💻</em>';
  translated.d.dispatchEvent(new translated.w.Event('pa:language-change'));
  assert.deepEqual([...heading.querySelectorAll('.hero-glyph')].map(el=>el.textContent),['か\u3099','👩‍💻'],'Combining marks/emoji remain one grapheme');
  heading.innerHTML='新文案<br><em>正在展示</em>';
  translated.d.dispatchEvent(new translated.w.Event('pa:language-change'));
  oldAnimations.forEach(a=>a.finish());await flush();
  assert.equal(heading.textContent,'新文案正在展示','Stale callbacks cannot resurrect old language');
  translated.w.dispatchEvent(new translated.w.Event('resize'));
  assert.equal(heading.innerHTML,'新文案<br><em>正在展示</em>');
  translated.d.dispatchEvent(new translated.w.Event('pa:language-change'));translated.enabled(false);
  assert.equal(heading.querySelectorAll('.hero-glyph').length,0,'Pause cancels and restores immediately');
  translated.dom.window.close();
  console.log('PASS CN/EN/JP glyph waves, words, accessible phrases, Unicode clusters, finish/resize/pause cleanup and translation races');
  const legacy=fixture({segmenter:false});legacy.enter(true);
  assert.equal(legacy.hero.querySelectorAll('.hero-glyph').length,0);
  assert.ok(legacy.animations.some(a=>a.element.matches('h1')),'Missing Segmenter keeps whole-title entrance');
  legacy.enabled(false);await flush();legacy.dom.window.close();
  for(const options of [{reduced:true},{forced:true},{enabled:false},{waapi:false},{io:false}]) {
    const g=fixture(options);if(options.io!==false)g.enter(true);
    if(options.io!==false)assert.equal(g.animations.length,0);
    assert.ok(g.hero.querySelector('h1').textContent.length>0);
    assert.equal(g.hero.querySelectorAll('a[href]').length,4);
    g.enabled(false);await flush();g.dom.window.close();
  }
  const css=fs.readFileSync(path.join(root,'styles/hero-motion.css'),'utf8');
  assert.doesNotMatch(css,/url\(|position:\s*fixed|background-position:|will-change:/);
  assert.match(css,/animation-play-state:paused/);
  assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/forced-colors:active/);
  assert.equal((html.match(/class="hero-atmosphere"/g)||[]).length,1);
  console.log('PASS Missing APIs/static preferences retain content; bounded CSS layers with no new images or fixed overlays');
})().catch(error=>{console.error(error);process.exitCode=1;});
