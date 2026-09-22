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
  assert.equal(d.querySelectorAll('.announce-action').length,4);
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
  const homeButton=d.querySelector('#heroMotionToggle');
  assert.equal(homeButton.disabled,button.disabled);
  assert.equal(homeButton.textContent,button.textContent);
  assert.equal(homeButton.getAttribute('aria-pressed'),button.getAttribute('aria-pressed'));
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
check('38 students, Hina selected, local portrait',()=>{
  assert.equal(d.querySelectorAll('.char-card').length,38);
  assert.equal(d.querySelector('.char-card[aria-pressed="true"]').dataset.characterId,'11');
  assert.match(d.querySelector('.showcase-portrait').getAttribute('src'),/^assets\/media\/portraits\//);
});
check('Azusa combines source values without inventing legacy stats or mixing charge with cooldown',()=>{
  const azusa=w.__testRoster.find(s=>s.id===38);
  assert.equal(azusa.kivoId,3);assert.equal(azusa.role,'输出');assert.equal(azusa.position,'游击');
  assert.equal(JSON.stringify(azusa.stats),JSON.stringify({hp:100,halo:150,total:250,gunDamage:'17 / 22.1',magazine:30,fireRate:600,critMultiplier:1.3,aimMovePenalty:.2}));
  assert.equal(azusa.skills[0].cooldown,'6s');assert.equal(azusa.skills[0].stacks,5);
  assert.equal(azusa.skills[1].charge,600);assert.equal(azusa.skills[1].cooldown,undefined);
  assert.equal(azusa.skills[2].name,'严酷的训练');assert.doesNotMatch(azusa.skills[2].desc,/瞄准弱点|蓄能/);
  const charge={cn:'充能值：600',en:'Charge: 600',jp:'チャージ値：600'};
  const timing={cn:'冷却：6s · 5 层',en:'Cooldown: 6s · 5 stacks',jp:'クールダウン：6s · 5 スタック'};
  for(const lang of ['cn','en','jp']) {
    click('[data-language="'+lang+'"]');
    click('.char-card[data-character-id="38"]');click('.showcase-details');
    assert.equal(d.querySelectorAll('.stat-box').length,8);
    for(const key of azusa.statFields)assert.ok(w.__testTranslations[lang]['stat.'+key]);
    if(lang!=='cn') {
      assert.equal(w.PA_CHARACTER_TRANSLATIONS[lang][38].notes.length,3);
      for(let i=0;i<3;i++)assert.ok(w.PA_SKILL_TRANSLATIONS[lang]['38:'+i]?.desc);
    }
    click('.dossier-skill-tiles button:nth-child(2)');
    assert.equal(d.querySelector('.skill-card:not([hidden]) .skill-cooldown').textContent,charge[lang]);
    click('#dossier-skill-tab-0');
    assert.equal(d.querySelector('.skill-card:not([hidden]) .skill-cooldown').textContent,timing[lang]);
    click('#closeModal');
  }
  click('[data-language="cn"]');click('.char-card[data-character-id="11"]');
});
check('Control / Flashpoint switch scopes selection, academy counts, search and all three languages',()=>{
  const ids=()=>[...d.querySelectorAll('.char-card')].map(el=>Number(el.dataset.characterId)).sort((a,b)=>a-b);
  click('.academy-card[data-academy="圣三一"]');
  d.querySelector('#searchInput').value='Azusa';
  click('[data-roster-mode="flashpoint"]');
  assert.deepEqual(ids(),[7,12,15,21,24,25]);
  assert.equal(d.querySelector('#rosterModeNotice').hidden,false);
  assert.equal(d.querySelector('#searchInput').value,'');
  assert.equal(d.querySelector('#academySelect').value,'all');
  for(const lang of ['en','jp','cn']) {
    click('[data-language="'+lang+'"]');
    assert.deepEqual(ids(),[7,12,15,21,24,25]);
    assert.equal(d.querySelector('[data-roster-mode="flashpoint"]').getAttribute('aria-pressed'),'true');
    assert.equal(d.querySelector('.academy-card[data-academy="all"] .academy-count').textContent,w.t('academy.count',{count:6}));
    click('.char-card[data-character-id="12"]');click('.showcase-details');
    assert.equal(d.querySelector('#modalName').textContent,w.t('mode.hoshino'));
    assert.equal(d.querySelector('.dossier-mode-notice').textContent,w.t('mode.notice'));
    click('#closeModal');
  }
  click('.academy-card[data-academy="千禧年"]');assert.deepEqual(ids(),[21,24]);
  const search=d.querySelector('#searchInput');search.value='Mika';search.dispatchEvent(new w.Event('input'));
  assert.equal(ids().length,0);click('#clearStudentFilters');assert.deepEqual(ids(),[21,24]);
  const switcher=d.querySelector('[data-roster-mode="flashpoint"]');switcher.focus();
  switcher.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  assert.equal(ids().length,38);assert.equal(d.querySelector('#rosterModeNotice').hidden,true);
  assert.equal(d.activeElement.dataset.rosterMode,'control');
  click('.char-card[data-character-id="11"]');
});
check('Roster corner badges show role icons and retain attack-type colors',()=>{
  const kinds={输出:'attack',坦克:'defense',辅助:'heal',治疗:'heal'};
  for(const card of d.querySelectorAll('#charGrid .char-card')){
    const badge=card.querySelector('.roster-attack');
    const expected=d.createElement('div');expected.innerHTML=w.PAGallery.icon(kinds[card.dataset.role]);
    assert.equal(badge.querySelector('svg').outerHTML,expected.firstElementChild.outerHTML);
    assert.equal(badge.dataset.tone,card.dataset.attack);
    assert.ok(badge.title.includes(card.dataset.role));
  }
});
check('All four trailers switch platform by language without losing selection',()=>{
  const ids=['BV18NHWzXEbX','BV1ESudzfE5N','BV1mUTMzTECN','BV15C55znEH8'];
  const yt=['FekdUUn3cIo','6J3IQ5VhRVQ','YamYqKh7jLI','oZ2mTczpaZY'];
  for(let i=0;i<4;i++){
    click('[data-language="cn"]');d.querySelectorAll('.trailer-card')[i].click();
    assert.ok(d.querySelector('#trailerFrame').src.includes(ids[i]));
    assert.ok(d.querySelector('#trailerExternalLink').href.includes(ids[i]));
    assert.ok(d.querySelectorAll('.trailer-thumb img')[i].src.includes('hdslb.com'));
    for(const lang of ['en','jp']){
      click('[data-language="'+lang+'"]');
      assert.ok(d.querySelector('#trailerFrame').src.includes('youtube-nocookie.com/embed/'+yt[i]));
      assert.equal(d.querySelectorAll('.trailer-card')[i].getAttribute('aria-pressed'),'true');
      assert.ok(!d.querySelector('#trailerFrame').src.includes('autoplay=1'));
    }
    click('[data-language="cn"]');
    assert.ok(d.querySelector('#trailerFrame').src.includes(ids[i]));
    assert.ok(d.querySelector('#trailerFrame').src.includes('autoplay=0'));
  }
  click('.trailer-card');
});
check('Mode impact replaces rapid transitions and respects motion preferences',()=>{
  const originalMedia=w.matchMedia;
  const oldAmbient=d.documentElement.dataset.ambientEnabled;
  Object.defineProperty(d,'hidden',{configurable:true,value:false});
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  d.documentElement.dataset.ambientEnabled='true';
  w.playRosterModeBurst('flashpoint');
  const first=d.querySelector('.mode-burst');
  assert.ok(first);assert.equal(first.getAttribute('aria-hidden'),'true');
  assert.equal(first.querySelectorAll('.mode-burst-shard').length,28);
  assert.equal(first.querySelectorAll('.mode-burst-ray').length,20);
  w.playRosterModeBurst('control');
  assert.equal(first.isConnected,false);
  assert.equal(d.querySelectorAll('.mode-burst').length,1);
  assert.equal(d.querySelector('.mode-burst').dataset.mode,'control');
  d.querySelector('.mode-burst').dispatchEvent(new w.Event('animationend'));
  assert.equal(d.querySelector('.mode-burst'),null);
  w.matchMedia=originalMedia;
  w.playRosterModeBurst('flashpoint');
  assert.equal(d.querySelector('.mode-burst'),null,'Reduced motion skips the impact');
  d.documentElement.dataset.ambientEnabled=oldAmbient;
  delete d.hidden;
});
check('Flashpoint announcement retains map, role rules and timing in all languages',()=>{
  for(const lang of ['cn','en','jp']) {
    click('[data-language="'+lang+'"]');click('.announce-action');
    assert.match(w.location.hash,/flashpoint-20260808/);
    assert.match(d.querySelector('#modalStars').textContent,/2026\.08\.08/);
    const copy=d.querySelector('#modalBody').textContent;
    for(const token of ['100%','20%','75','15%','10%','Support','Skirmisher','Assassin'])assert.ok(copy.includes(token),token);
    assert.equal(d.querySelectorAll('.announcement-copy').length,14);
    assert.equal(d.querySelector('.announcement-hero').getAttribute('src'),'assets/ui/announcements/flashpoint-20260808.png');
    click('#closeModal');
  }
  click('[data-language="cn"]');
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
check('Dossier retains all 38 profiles and 114 skills in three languages',()=>{
  const skin=fs.readFileSync(path.join(root,'styles/dossier.css'),'utf8');
  for(const tone of new Set(w.__testRoster.map(student=>student.attackType)))assert.ok(skin.includes('[data-attack="'+tone+'"]'),tone);
  assert.match(skin,/prefers-reduced-motion:reduce/);assert.match(skin,/forced-colors:active/);
  const tabNames={cn:['基本信息','技能档案','使用备注'],en:['Overview','Skills','Field Notes'],jp:['基本情報','スキル','運用メモ']};
  const statKeys=['hp','attack','defense','speed','range','critRate','reloadTime'];
  for(const lang of ['cn','en','jp']) {
    click('[data-language="'+lang+'"]');
    for(const student of w.__testRoster) {
      click('.char-card[data-character-id="'+student.id+'"]');click('.showcase-details');
      assert.deepEqual([...d.querySelectorAll('.dossier-tab')].map(el=>el.textContent),tabNames[lang]);
      assert.equal(d.querySelectorAll('.dossier-panel:not([hidden])').length,1);
      assert.equal(d.querySelector('#dossier-panel-0').hidden,false,'New profile starts at overview');
      assert.equal(d.querySelectorAll('.basic-section .info-item').length,9);
      assert.deepEqual([...d.querySelectorAll('.stat-box strong')].map(el=>el.textContent),Array.from(student.statFields || statKeys,key=>String(student.stats[key]??'-')));
      assert.equal(d.querySelector('.dossier-weapon-copy strong').textContent,student.weaponName);
      for(const selector of ['#modalStars','.field-rarity strong','.char-card[data-character-id="'+student.id+'"] .card-stars','.showcase-stars']) {
        const stars=d.querySelector(selector+' .rarity-stars');assert.ok(stars,selector);
        assert.equal(stars.querySelectorAll('.rarity-star:not(.is-empty)').length,student.rarity);
        assert.equal(stars.querySelectorAll('.rarity-star').length,selector==='.showcase-stars'?student.rarity:5);
        assert.equal(stars.getAttribute('aria-label'),w.t('field.rarity')+': '+student.rarity);
        assert.equal(stars.textContent,selector==='.showcase-stars'?'★'.repeat(student.rarity):w.getStars(student.rarity));
        for(const star of stars.children)assert.equal(star.getAttribute('aria-hidden'),'true');
      }
      assert.equal(d.querySelectorAll('.dossier-skill-tiles button').length,student.skills.length);
      student.skills.forEach((raw,index)=>{
        const icon=w.PA_SKILL_ICONS[student.id][index];
        const tiles=[d.querySelector('.dossier-skill-tiles button:nth-child('+(index+1)+')'),d.querySelector('#dossier-skill-tab-'+index)];
        for(const tile of tiles) {
          assert.equal(tile.querySelector('.dossier-skill-art').getAttribute('src'),icon.file);
          assert.equal(tile.dataset.iconKey,icon.key);assert.equal(tile.dataset.iconMatch,icon.match);
          assert.equal(Boolean(tile.querySelector('.dossier-icon-reference')),icon.match!=='name');
        }
        click('.dossier-skill-tiles button:nth-child('+(index+1)+')');
        const expected=w.getLocalizedSkill(student,raw,index),card=d.querySelector('.skill-card:not([hidden])');
        assert.equal(d.querySelector('#dossier-panel-1').hidden,false);
        assert.equal(d.querySelectorAll('.skill-card:not([hidden])').length,1);
        assert.equal(card.querySelector('.skill-head strong').textContent,expected.name);
        assert.equal(card.querySelector('p').textContent,expected.desc);
        assert.equal(card.querySelector('.skill-cooldown').textContent,w.getSkillTiming(expected));
        assert.equal(d.activeElement.id,'dossier-skill-tab-'+index);
        click('#dossier-tab-0');
      });
      click('.dossier-detail-toggle');assert.equal(d.querySelector('#dossier-basic-fields').hidden,false);
      click('.dossier-detail-toggle');assert.equal(d.querySelector('#dossier-basic-fields').hidden,true);
      click('.dossier-weapon .dossier-action');assert.equal(d.querySelector('#dossier-basic-fields').hidden,false);
      click('.dossier-guide .dossier-action');assert.equal(d.querySelector('#dossier-panel-2').hidden,false);
      assert.equal(d.querySelector('.description-section p').textContent,w.getLocalizedCharacterContent(student).desc);
      const ids=[...d.querySelectorAll('#modal [id]')].map(el=>el.id);assert.equal(new Set(ids).size,ids.length);
      for(const tab of d.querySelectorAll('#modal [role="tab"]')) {
        const panel=d.getElementById(tab.getAttribute('aria-controls'));
        assert.ok(panel);assert.equal(panel.getAttribute('aria-labelledby'),tab.id);
      }
      click('#closeModal');assert.equal(d.activeElement,d.querySelector('.showcase-details'));
    }
  }
  click('[data-language="cn"]');click('.char-card[data-character-id="11"]');
});
check('Dossier keyboard tabs and live translation preserve the selected view',()=>{
  click('.showcase-details');
  const key=(selector,value)=>d.querySelector(selector).dispatchEvent(new w.KeyboardEvent('keydown',{key:value,bubbles:true}));
  key('#dossier-tab-0','ArrowRight');assert.equal(d.activeElement.id,'dossier-tab-1');
  key('#dossier-tab-1','End');assert.equal(d.activeElement.id,'dossier-tab-2');
  key('#dossier-tab-2','Home');assert.equal(d.activeElement.id,'dossier-tab-0');
  key('#dossier-tab-0','ArrowLeft');assert.equal(d.activeElement.id,'dossier-tab-2');
  click('#dossier-tab-1');key('#dossier-skill-tab-0','End');
  assert.equal(d.activeElement.id,'dossier-skill-tab-2');
  click('[data-language="en"]');
  assert.equal(d.querySelector('#dossier-panel-1').hidden,false);
  assert.equal(d.querySelector('#dossier-skill-2').hidden,false);
  assert.equal(d.querySelector('#dossier-tab-1').textContent,'Skills');
  assert.doesNotMatch(d.querySelector('#dossier-skill-2').textContent,/[\u4e00-\u9fff]/);
  key('#dossier-skill-tab-2','ArrowRight');assert.equal(d.activeElement.id,'dossier-skill-tab-0');
  click('#closeModal');click('.showcase-details');
  assert.equal(d.querySelector('#dossier-tab-0').getAttribute('aria-selected'),'true');
  assert.equal(d.querySelector('#dossier-basic-fields').hidden,true);
  click('#closeModal');click('[data-language="cn"]');
});
check('Broken skill artwork falls back without hiding skill text or disabling interaction',()=>{
  click('.showcase-details');
  const tile=d.querySelector('.dossier-skill-tiles button'),image=tile.querySelector('img');
  image.dispatchEvent(new w.Event('error'));
  assert.equal(tile.querySelector('img'),null);assert.ok(tile.querySelector('svg'));
  assert.equal(tile.querySelector('.dossier-skill-badge').classList.contains('has-art'),false);
  tile.click();assert.equal(d.querySelector('#dossier-panel-1').hidden,false);
  click('#closeModal');
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
  search.value='';search.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.char-card').length,38);
});
check('Day/night theme and announcements',()=>{
  const original=d.documentElement.dataset.theme;click('#themeToggle');assert.notEqual(d.documentElement.dataset.theme,original);
  click('.announce-action');assert.equal(d.querySelector('#modal').dataset.mode,'announcement');assert.match(w.location.hash,/announcement\//);
  assert.equal(d.querySelectorAll('#modal .dossier-shell').length,0,'Announcements retain their own layout');click('#closeModal');
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
