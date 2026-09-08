/* Deterministic school transitions: fake image loading + WAAPI, real gallery DOM. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.PAWEB_TEST_MODULES?path.join(process.env.PAWEB_TEST_MODULES,'jsdom'):'jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'scripts/gallery.js'),'utf8');
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture({reduced=false,forced=false,waapi=true}={}) {
  const dom=new JSDOM(html,{url:'http://127.0.0.1:18900/index.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,animations=[],images=[],observers=[],mounts=[];
  const queries={};
  w.matchMedia=query=>queries[query] ||= {matches:query.includes('reduced')?reduced:forced,listeners:[],addEventListener(_,fn){this.listeners.push(fn);}};
  w.HTMLElement.prototype.getBoundingClientRect=()=>({top:80,bottom:700,width:900,height:620});
  w.HTMLElement.prototype.scrollTo=()=>{};
  w.IntersectionObserver=class {constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}};
  w.Image=function(){const img=d.createElement('img');images.push(img);return img;};
  if(waapi)w.HTMLElement.prototype.animate=function(frames,options){
    let resolve,reject,settled=false;
    const animation={element:this,frames,options,cancelled:false,
      finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
      finish(){if(!settled){settled=true;resolve();}},
      cancel(){this.cancelled=true;if(!settled){settled=true;reject(new Error('cancelled'));}}
    };animations.push(animation);return animation;
  };
  const roster=['歌赫娜','歌赫娜','千禧年','圣三一'].map((academy,i)=>({id:i+1,academy,name:'Student '+i,rarity:3,img:'portrait.png',kivoId:i+1}));
  w.PA_MEDIA_CATALOG={students:Object.fromEntries(roster.map(c=>[c.id,{portrait:'portrait.png',models:[{type:'body',ready:true,file:c.id+'.glb',files:[]}],spines:[{ready:true,file:'lobby.skel',files:[]}]}]))};
  const viewer={async mount(container,item){
    const canvas=d.createElement('canvas');container.append(canvas);
    const session={item,disposed:false,resets:0,getAnimations:()=>[],setPaused(){},resetCamera(){this.resets++;},dispose(){this.disposed=true;canvas.remove();}};
    mounts.push(session);return session;
  }};
  w.eval(source);
  const gallery=w.PAGallery.create(d.querySelector('#characterShowcase'),{
    getName:c=>c.name,getEnglishName:c=>c.name,getContent:()=>({desc:'Profile'}),localize:v=>v,
    onSelect(){},openDetails(){},loadImage(img,src){img.src=src;},loadViewer:async()=>viewer
  });
  gallery.update(roster,'cn','all');
  return {w,d,dom,gallery,roster,animations,images,observers,mounts,
    crest:()=>d.querySelector('.academy-crest-current img')?.getAttribute('src'),
    effects:()=>animations.filter(a=>a.element.closest('.academy-backdrop,.academy-transition')),
    async load(id,fail=false){const img=images.find(img=>img.getAttribute('src')===`assets/ui/academies/${id}.png` && img.onload);assert.ok(img,'Pending crest '+id);img[fail?'onerror':'onload']();await flush();},
    async finish(){animations.filter(a=>!a.cancelled).forEach(a=>a.finish());await flush();},
    async filter(academy,language='cn'){gallery.update(academy==='all'?roster:roster.filter(c=>c.academy===academy),language,academy);await flush();},
    preference(kind,value){const query=Object.entries(queries).find(([key])=>key.includes(kind))[1];query.matches=value;query.listeners.forEach(fn=>fn());},
    hide(value){Object.defineProperty(d,'hidden',{configurable:true,value});d.dispatchEvent(new w.Event('visibilitychange'));},
    close(){w.dispatchEvent(new w.Event('pagehide'));dom.window.close();}
  };
}
(async()=>{
  const f=fixture();await f.load(3);await f.finish();
  assert.equal(f.crest(),'assets/ui/academies/3.png');
  assert.equal(f.d.querySelectorAll('.academy-backdrop').length,1);
  assert.ok(f.d.querySelector('.page-model-stage .academy-backdrop'),'Crest travels with the open model viewport');
  const mountCount=f.mounts.length,canvas=f.d.querySelector('.showcase-player canvas');
  await f.filter('歌赫娜');
  assert.ok(f.effects().some(a=>a.element.matches('.academy-wipe') && !a.cancelled));
  assert.equal(f.mounts.length,mountCount,'All -> current school must animate without remounting');
  assert.equal(f.d.querySelector('.showcase-player canvas'),canvas);
  assert.ok(f.mounts.every(m=>m.resets===0));
  await f.finish();
  const sameCount=f.effects().length;
  await f.filter('歌赫娜');await f.filter('歌赫娜','jp');
  assert.equal(f.effects().length,sameCount,'Repeated school/language update does not replay');
  f.gallery.select(2);await f.finish();await f.finish();
  assert.equal(f.effects().length,sameCount,'Same school, different student retains its crest');
  await f.filter('all');await f.finish();
  assert.equal(f.crest(),'assets/ui/academies/3.png','All schools still shows the actual student academy');
  f.gallery.select(3);await f.load(4);await f.finish();await f.finish();
  assert.equal(f.crest(),'assets/ui/academies/4.png');
  assert.equal(f.d.querySelector('.academy-crest-previous').children.length,0);
  assert.equal(f.d.querySelector('.character-workspace').dataset.academyTransition,undefined);
  assert.ok(f.effects().every(a=>a.cancelled),'Completed effects release filled animations');
  assert.equal(f.d.querySelectorAll('.showcase-player canvas').length,1);
  console.log('PASS Current-school filtering, all-school student mapping, no model remount/reset, same-school/language stability, settled cleanup');

  // Every actual student's school must resolve to an existing original PNG.
  const academyNames=[...html.matchAll(/academy:\s*"([^"]+)"/g)].map(m=>m[1]);
  assert.equal(academyNames.length,37);
  for(const academy of academyNames)assert.ok(fs.existsSync(path.join(root,f.w.PAGallery.academyEmblem(academy))),academy);
  assert.equal(f.w.PAGallery.academyEmblem('unknown'),'');
  assert.equal(f.w.PAGallery.academyEmblem('all'),'assets/ui/academies/6.png');
  f.d.querySelector('[data-mode="portrait"]').click();await flush();
  assert.ok(f.d.querySelector('.showcase-main .academy-backdrop'),'Same backdrop moves into the illustration stage');
  f.d.querySelector('[data-mode="spine"]').click();await flush();
  assert.equal(f.d.querySelectorAll('.academy-backdrop').length,1,'No duplicated background on lobby switch');
  f.close();
  console.log('PASS All 37 student academies resolve locally; portrait/lobby/model reuse a single decorative viewport layer');

  const fast=fixture();await fast.load(3);await fast.finish();
  await fast.filter('千禧年');
  const cancelled=fast.effects().filter(a=>!a.cancelled);
  await fast.filter('圣三一');
  assert.ok(cancelled.every(a=>a.cancelled));
  await fast.load(2);await fast.load(4);await fast.finish();await fast.finish();
  assert.equal(fast.crest(),'assets/ui/academies/2.png','Late old-school image cannot replace the latest crest');
  assert.equal(fast.d.querySelector('.academy-backdrop').dataset.academy,'圣三一');
  assert.equal(fast.d.querySelectorAll('.academy-backdrop img').length,1);
  await fast.filter('瓦尔基里');
  assert.equal(fast.crest(),undefined,'Empty results cannot retain an unrelated student crest');
  assert.ok(fast.effects().every(a=>a.cancelled));
  await fast.filter('千禧年');await fast.finish();await fast.finish();
  assert.equal(fast.crest(),'assets/ui/academies/4.png','Cached crest recovers from empty filters');
  assert.equal(fast.images.filter(img=>img.getAttribute('src').endsWith('/4.png')).length,1,'Only one image load per successful school');
  fast.close();
  console.log('PASS Rapid switching cancels old effects, guards stale image responses, bounds layers and recovers from empty filters');

  for(const config of [{reduced:true},{forced:true},{waapi:false}]) {
    const s=fixture(config);await s.load(3);await s.filter('千禧年');await s.load(4);await s.finish();await s.finish();
    assert.equal(s.crest(),'assets/ui/academies/4.png');assert.equal(s.effects().length,0);s.close();
  }
  for(const cancel of [f=>f.hide(true),f=>f.preference('reduced',true),f=>f.preference('forced',true),
    f=>f.observers.at(-1).fn([{isIntersecting:false}]),f=>f.d.dispatchEvent(new f.w.Event('fullscreenchange'))]) {
    const s=fixture();await s.load(3);await s.finish();await s.filter('千禧年');
    cancel(s);const count=s.effects().length;await s.load(4);
    assert.ok(s.effects().every(a=>a.cancelled));assert.equal(s.effects().length,count,'Cancelled pending image must not restart an effect');
    assert.equal(s.crest(),'assets/ui/academies/4.png','Static current crest remains after cancellation');s.close();
  }
  const error=fixture();await error.load(3,true);await error.finish();
  assert.equal(error.crest(),undefined);assert.equal(error.d.querySelectorAll('.showcase-player canvas').length,1);
  await error.filter('千禧年');await error.load(4);await error.finish();await error.finish();
  assert.equal(error.crest(),'assets/ui/academies/4.png');error.close();
  console.log('PASS Reduced motion, forced colors, missing API, background/offscreen/fullscreen cleanup and non-blocking image failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
