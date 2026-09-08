/* Offline DOM regression checks. Requires jsdom as a development-only dependency.
   PAWEB_TEST_MODULES may point to a temporary node_modules directory. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require(process.env.PAWEB_TEST_MODULES ? path.join(process.env.PAWEB_TEST_MODULES,'jsdom') : 'jsdom');
const root = path.resolve(__dirname,'..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const errors=[];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError',error=>errors.push(error));
const dom = new JSDOM(html,{url:'https://paweb.test/index.html',runScripts:'outside-only',virtualConsole});
dom.reconfigure({url:'file:///'+root.replaceAll('\\','/')+'/index.html'});
const {window:w}=dom, d=w.document;
w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
w.requestAnimationFrame=()=>0;
w.cancelAnimationFrame=()=>{};
w.HTMLElement.prototype.scrollTo=function(options){if(options.top!==undefined)this.scrollTop=options.top;if(options.left!==undefined)this.scrollLeft=options.left;};
w.HTMLElement.prototype.scrollBy=function(options){this.scrollLeft+=options.left || 0;this.scrollTop+=options.top || 0;};
w.fetch=()=>{throw new Error('No network is allowed in this test');};
for(const script of d.querySelectorAll('script')) {
  const src=script.getAttribute('src');
  if(src && /^https?:/.test(src)) throw new Error('Unexpected remote script');
  const content=src ? fs.readFileSync(path.join(root,src),'utf8') : script.textContent;
  w.eval(content+(content.includes('const translations =') ? '\nwindow.__testTranslations = translations; window.__testRoster = characters;' : ''));
}
function click(selector){const el=d.querySelector(selector);assert.ok(el,'Missing '+selector);el.click();}
function check(name,fn){fn();console.log('PASS',name);}
check('Site skin retains section order, supplied artwork and real content',()=>{
  const styles=[...d.querySelectorAll('link[rel="stylesheet"]')].map(el=>el.getAttribute('href'));
  assert.equal(styles.at(-1),'styles/site-motion.css');
  assert.ok(styles.indexOf('styles/site-backgrounds.css')<styles.indexOf('styles/site-motion.css'));
  assert.ok(styles.indexOf('styles/atlas-ui.css')<styles.indexOf('styles/site-backgrounds.css'));
  assert.ok(styles.indexOf('styles/button-art.css')<styles.indexOf('styles/atlas-frames.css'));
  assert.ok(styles.indexOf('styles/atlas-frames.css')<styles.indexOf('styles/atlas-ui.css'));
  assert.ok(styles.indexOf('styles/site-ui.css')<styles.indexOf('styles/button-art.css'));
  assert.ok(fs.existsSync(path.join(root,styles.at(-1))));
  assert.deepEqual([...d.querySelectorAll('main > section')].map(el=>el.id),['home','announcements','trailers','characters']);
  assert.equal(d.querySelector('.brand-logo').getAttribute('src'),'assets/ui/project-archive-logo.png');
  assert.equal(d.querySelectorAll('.announce-action').length,3);
  assert.equal(d.querySelectorAll('.trailer-card').length,4);
});
check('Base background skin is local and leaves homepage rules alone',()=>{
  const background=fs.readFileSync(path.join(root,'styles/site-backgrounds.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(background,/#home|\.hero|:root|https?:|position\s*:\s*fixed|animation\s*:/);
  assert.match(background,/pointer-events\s*:\s*none/);
  assert.match(background,/forced-colors\s*:\s*active/);
  const svg=new JSDOM(fs.readFileSync(path.join(root,'assets/ui/archive-triangles.svg'),'utf8'),{contentType:'image/svg+xml'});
  assert.equal(svg.window.document.documentElement.getAttribute('viewBox'),'0 0 1440 900');
  assert.equal(svg.window.document.querySelectorAll('script,image,foreignObject').length,0);
  assert.equal(svg.window.document.querySelectorAll('use').length,9,'Wrap the triangle mask at every tile edge');
  svg.window.close();
});
check('Ambient motion keeps a translated pause control and reduced-motion fallback',()=>{
  const motion=fs.readFileSync(path.join(root,'styles/site-motion.css'),'utf8');
  assert.match(motion,/prefers-reduced-motion:reduce/);
  assert.match(motion,/animation-play-state:paused/);
  assert.match(motion,/pointer-events:none/);
  const button=d.querySelector('#ambientMotionToggle');
  assert.ok(button.disabled,'System reduced motion takes priority');
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.ok(button.textContent.length>0);
});
check('Generated control artwork retains labels and local assets',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/ui/generated-buttons/prompts.json'),'utf8'));
  assert.equal(manifest.assets.length,10);
  for(const asset of manifest.assets) {
    const bytes=fs.readFileSync(path.join(root,asset.file));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.ok(asset.prompt.length>100);
  }
  for(const el of d.querySelectorAll('.strip-arrow,.showcase-prev,.showcase-next,.showcase-fullscreen,.modal-close,#themeToggle')) {
    assert.ok(el.getAttribute('aria-label')?.trim(),'Image-only controls need a real accessible label');
  }
  assert.ok(['play','pause'].includes(d.querySelector('.showcase-pause').dataset.artIcon));
  assert.equal(d.querySelector('.showcase-fullscreen').dataset.expanded,'false');
});
check('Kei defaults to the actual body; companion stays selectable without changing the catalog',()=>{
  const record=w.PA_MEDIA_CATALOG.students[16],original=record.models.map(m=>m.id).join(',');
  const variants=w.PAGallery.modelVariants(record);
  assert.equal(variants[0].id,501);
  assert.equal(variants[1].id,502);
  assert.equal(record.models.map(m=>m.id).join(','),original,'Source order remains untouched');
  assert.equal(w.PAGallery.modelVariants({models:[{type:'body',ready:false,file:'missing.glb'}]}).length,0);
});
check('3D is the default; direct files retain illustration and HTTP setup guidance',()=>{
  assert.equal(d.querySelector('button[data-mode="model"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('.page-model-stage').hidden,true);
  assert.match(d.querySelector('.showcase-message').textContent,/HTTP/);
  assert.equal(d.querySelector('.showcase-portrait').hidden,false);
  click('button[data-mode="portrait"]');
  dom.reconfigure({url:'https://paweb.test/index.html'});
});
check('Header, upper academy ribbon, central stage, lower student dock',()=>{
  assert.equal(d.querySelectorAll('.header > .brand').length,1);
  assert.equal(d.querySelectorAll('.header > .utility-controls').length,1);
  assert.equal(d.querySelectorAll('.academy-band #academyCards').length,1);
  assert.equal(d.querySelectorAll('.student-dock #charGrid').length,1);
  assert.equal(d.querySelectorAll('.character-scene #characterShowcase').length,1);
  assert.equal(d.querySelectorAll('.character-scene > .page-model-stage').length,1,'Model layer belongs to the scrolling scene, not the window');
  assert.equal(d.querySelectorAll('.academy-card').length,13);
  assert.equal(d.querySelectorAll('#characterProfileSlot .showcase-info').length,1);
  assert.equal(d.querySelectorAll('#characterModeSlot .showcase-modes').length,1);
  assert.equal(d.querySelectorAll('#characterShowcase .showcase-info').length,0);
  const ids=[...d.querySelectorAll('[id]')].map(el=>el.id);assert.equal(ids.length,new Set(ids).size);
});
check('Academy cards filter membership, preserve focus and localize',()=>{
  const roster=w.__testRoster;
  for(const card of d.querySelectorAll('.academy-card')) {
    card.focus();card.click();
    const academy=card.dataset.academy;
    const expected=roster.filter(c=>academy==='all' || c.academy===academy);
    assert.equal(d.querySelectorAll('.char-card').length,expected.length,academy);
    assert.equal(d.querySelectorAll('.academy-card[aria-pressed="true"]').length,1);
    assert.equal(d.activeElement,card);
    const actualIds=[...d.querySelectorAll('.char-card')].map(c=>Number(c.dataset.characterId));
    assert.deepEqual(actualIds,Array.from(expected,c=>c.id));
    assert.ok(fs.existsSync(path.join(root,card.querySelector('.academy-emblem').getAttribute('src'))));
  }
  click('.academy-card[data-academy="瓦尔基里"]');
  assert.equal(d.querySelector('#sceneEmpty').hidden,false);
  assert.equal(d.querySelector('#characterBackdrop').hidden,true);
  click('.academy-card[data-academy="海兰德"]');
  assert.equal(d.querySelector('#sceneEmpty').hidden,true);
  assert.deepEqual([...d.querySelectorAll('.char-card')].map(c=>Number(c.dataset.characterId)),[10,30]);
  click('[data-language="en"]');
  assert.match(d.querySelector('#selectedAcademyTitle').textContent,/Highlander/i);
  assert.equal(d.querySelector('.academy-card[aria-pressed="true"]').dataset.academy,'海兰德');
  click('[data-language="cn"]');
  click('.academy-card[data-academy="歌赫娜"]');
  const search=d.querySelector('#searchInput');search.value='not-a-student';search.dispatchEvent(new w.Event('input'));
  click('#clearStudentFilters');
  assert.equal(d.querySelector('#academySelect').value,'歌赫娜');
  assert.ok(d.querySelectorAll('.char-card').length>0);
  const first=d.querySelector('.academy-card[data-academy="all"]');first.focus();
  first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(d.querySelector('#academySelect').value,'歌赫娜');
  click('.academy-card[data-academy="all"]');
  click('.char-card[data-character-id="11"]');
});
check('37 students, Hina selected, local portrait',()=>{
  assert.equal(d.querySelectorAll('.char-card').length,37);
  assert.equal(d.querySelector('.char-card[aria-pressed="true"]').dataset.characterId,'11');
  assert.match(d.querySelector('.showcase-portrait').getAttribute('src'),/^assets\/media\/portraits\//);
});
check('Game-style HUD uses actual role, formation, attack and armor data',()=>{
  assert.equal(d.querySelectorAll('link[href="styles/game-ui.css"]').length,1);
  for(const student of w.__testRoster) {
    click('.char-card[data-character-id="'+student.id+'"]');
    const facts=d.querySelector('.showcase-facts');
    assert.equal(facts.children.length,5);
    for(const [field,value] of [['role',student.role],['formation',student.teamPosition],['attack',student.attackType],['defense',student.defenseType],['weapon',student.weapon]]) {
      const item=facts.querySelector('[data-fact="'+field+'"]');
      assert.equal(item.dataset.tone,value);
      assert.ok(item.querySelector('dd .hud-value').textContent.length>0);
      assert.equal(item.querySelector('svg').getAttribute('aria-hidden'),'true');
    }
    const card=d.querySelector('.char-card[data-character-id="'+student.id+'"]');
    assert.equal(card.querySelector('.roster-role').textContent,card.querySelector('.tag.role').textContent);
    assert.equal(card.querySelector('.roster-attack').dataset.tone,student.attackType);
    assert.equal(d.querySelector('.showcase-profile-head .showcase-stars').textContent.length,student.rarity);
  }
  click('.char-card[data-character-id="11"]');
});
check('Three languages update selection, details, and description',()=>{
  for(const lang of ['en','jp','cn']) {
    click('[data-language="'+lang+'"]');
    assert.equal(d.querySelector('[data-fact="attack"] dt').textContent,{en:'Attack Type',jp:'攻撃タイプ',cn:'攻击类型'}[lang]);
    assert.equal(d.querySelector('[data-fact="formation"] dt').textContent,{en:'Position',jp:'ポジション',cn:'站位'}[lang]);
    const name=d.querySelector('.showcase-name').textContent;
    assert.ok(name.length>0);assert.equal(d.querySelectorAll('.char-card[aria-pressed="true"]').length,1);
    click('.showcase-details');
    assert.equal(d.querySelector('#modalName').textContent,name);
    assert.ok(d.querySelector('.description-section p').textContent.length>5);
    assert.ok(d.querySelector('.notes-section li').textContent.length>5);
    if(lang==='en') {assert.match(name,/Hina/);assert.doesNotMatch(d.querySelector('.description-section p').textContent,/[\u4e00-\u9fff]/);}
    click('#closeModal');
    assert.equal(d.activeElement,d.querySelector('.showcase-details'));
  }
});
check('Roster selection and arrow keys',()=>{
  click('.char-card[data-character-id="1"]');
  assert.equal(d.querySelector('.char-card[aria-pressed="true"]').dataset.characterId,'1');
  d.querySelector('.char-card[data-character-id="1"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.equal(d.querySelector('.char-card[aria-pressed="true"]').dataset.characterId,'2');
  click('.showcase-next');assert.equal(d.querySelector('.char-card[aria-pressed="true"]').dataset.characterId,'3');
});
check('Filters, empty results, and recovery',()=>{
  const search=d.querySelector('#searchInput');search.value='zzzz-no-student';search.dispatchEvent(new w.Event('input'));
  assert.equal(d.querySelectorAll('.char-card').length,0);assert.equal(d.querySelector('#characterShowcase').hidden,true);
  assert.equal(d.querySelector('#characterProfileSlot').hidden,true);
  search.value='Hina (Dress)';search.dispatchEvent(new w.Event('input'));
  assert.equal(d.querySelectorAll('.char-card').length,1);assert.equal(d.querySelector('#characterShowcase').hidden,false);
  assert.equal(d.querySelector('#characterProfileSlot').hidden,false);
  search.value='';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.char-card').length,37);
});
check('Day/night theme and announcements',()=>{
  const original=d.documentElement.dataset.theme;click('#themeToggle');assert.notEqual(d.documentElement.dataset.theme,original);
  click('.announce-action');assert.equal(d.querySelector('#modal').dataset.mode,'announcement');assert.match(w.location.hash,/announcement\//);click('#closeModal');
});
check('Local-file preview provides a working setup link and preserves the illustration',()=>{
  dom.reconfigure({url:'file:///'+root.replaceAll('\\','/')+'/index.html'});
  click('button[data-mode="model"]');assert.match(d.querySelector('.showcase-message').textContent,/HTTP/);
  assert.equal(d.querySelector('.showcase-portrait').hidden,false);
  assert.equal(d.querySelector('.showcase-controls').hidden,true);
  const preview=new URL(d.querySelector('.showcase-recovery a').href);
  assert.equal(preview.origin,'http://127.0.0.1:18900');
  assert.equal(preview.searchParams.get('preview'),'model');
  assert.equal(preview.searchParams.get('student'),d.querySelector('.char-card[aria-pressed="true"]').dataset.characterId);
  for(const lang of ['en','jp','cn']) {
    click('[data-language="'+lang+'"]');
    assert.match(d.querySelector('.showcase-message').textContent,/start-preview.cmd/);
    assert.equal(d.querySelector('.showcase-controls').hidden,true);
  }
  click('button[data-mode="spine"]');assert.match(d.querySelector('.showcase-message').textContent,/HTTP/);
  assert.equal(new URL(d.querySelector('.showcase-recovery a').href).searchParams.get('preview'),'spine');
  click('.showcase-recovery button');assert.equal(d.querySelector('.showcase-message').hidden,true);
  assert.equal(d.querySelector('button[data-mode="portrait"]').getAttribute('aria-pressed'),'true');
});
check('All static translation keys have CN/EN/JP values',()=>{
  const dictionaries=w.__testTranslations;
  for(const element of d.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-aria]')) {
    const key=element.dataset.i18n || element.dataset.i18nHtml || element.dataset.i18nAria;
    for(const lang of ['cn','en','jp']) assert.equal(typeof dictionaries[lang][key],'string',lang+': '+key);
  }
});
assert.deepEqual(errors.map(error=>error.message),[]);
console.log('All offline DOM checks passed. This does not verify browser layout or WebGL rendering.');
w.close();
