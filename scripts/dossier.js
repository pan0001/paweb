/* Game-inspired dossier shell. Reuses the existing localized data sections;
   no invented upgrade levels, equipment inventory or combat statistics. */
(() => {
  const copy={
    cn:{tabs:['基本信息','技能档案','使用备注'],navigation:'资料分类',attributes:'基本属性',details:'详细',hide:'收起',skills:'技能一览',viewSkills:'查看技能',weapon:'专属武器',weaponInfo:'武器资料',notes:'作战指南',viewNotes:'查看备注',archive:'已收录资料',openSkill:'查看技能：',skillHint:'选择技能，查看效果与冷却时间',weaponHint:'武器名称按资料源收录',empty:'暂无技能记录'},
    en:{tabs:['Overview','Skills','Field Notes'],navigation:'Profile sections',attributes:'Base Attributes',details:'Details',hide:'Hide',skills:'Skill Overview',viewSkills:'View Skills',weapon:'Unique Weapon',weaponInfo:'Weapon Info',notes:'Field Guide',viewNotes:'Read Notes',archive:'ARCHIVED DATA',openSkill:'View skill: ',skillHint:'Select a skill to view its effect and cooldown.',weaponHint:'Weapon name as listed in the source',empty:'No skills recorded'},
    jp:{tabs:['基本情報','スキル','運用メモ'],navigation:'プロフィール分類',attributes:'基本ステータス',details:'詳細',hide:'閉じる',skills:'スキル一覧',viewSkills:'スキル詳細',weapon:'固有武器',weaponInfo:'武器情報',notes:'運用ガイド',viewNotes:'メモを読む',archive:'収録データ',openSkill:'スキルを見る：',skillHint:'スキルを選んで効果とクールタイムを確認',weaponHint:'武器名は出典の表記を使用',empty:'スキル情報なし'}
  };
  const iconCopy={
    cn:{source:'原作图标',reference:'原作参考',composite:'组合参考',notice:'图标来自对应角色与装束的原作技能。标有「参考」的项目为改编或组合技能的视觉对应；本站的 E／Q／被动效果与数值保持不变。',missing:'图标暂不可用'},
    en:{source:'Original skill icon',reference:'Reference',composite:'Combined',notice:'Icons come from the same character and outfit in the original game. Reference / Combined labels indicate adapted or combined skills, not identical effects. Project Archive E/Q/passive descriptions and values are unchanged.',missing:'Icon unavailable'},
    jp:{source:'原作スキルアイコン',reference:'原作参考',composite:'複合参考',notice:'同じ生徒・衣装の原作スキルアイコンを使用しています。「参考」は改変・複合スキルの画像対応であり、原作と同じ効果を意味しません。本サイトの E／Q／パッシブ効果と数値は変更していません。',missing:'アイコンを読み込めません'}
  };
  function mount(body,options) {
    const doc=body.ownerDocument,labels={...(copy[options.language]||copy.cn),...(iconCopy[options.language]||iconCopy.cn)};
    const state=options.state||{};
    const sections={};
    for(const name of ['basic','stats','skills','description','notes','source'])
      sections[name]=body.querySelector('.'+name+'-section');
    if(!sections.basic || !sections.stats || !sections.skills)return;
    const skillCards=[...sections.skills.querySelectorAll('.skill-card')];
    const skills=skillCards.filter(card=>card.querySelector('.skill-head'));
    const node=(tag,cls,text)=>{
      const el=doc.createElement(tag);if(cls)el.className=cls;
      if(text!==undefined)el.textContent=text;return el;
    };
    const button=(cls,text)=>{const el=node('button',cls,text);el.type='button';return el;};
    const arrow=()=>{const el=node('span','dossier-arrow');el.setAttribute('aria-hidden','true');return el;};
    const action=(text,fn)=>{
      const el=button('dossier-action');el.append(node('span','',text),arrow());
      el.addEventListener('click',fn);return el;
    };
    const shell=node('div','dossier-shell');
    const tabs=node('div','dossier-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',labels.navigation);
    const content=node('div','dossier-content');
    const panels=labels.tabs.map((label,index)=>{
      const tab=button('dossier-tab',label);tab.id='dossier-tab-'+index;
      tab.setAttribute('role','tab');tab.setAttribute('aria-controls','dossier-panel-'+index);
      const panel=node('div','dossier-panel');panel.id='dossier-panel-'+index;
      panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
      tab.addEventListener('click',()=>selectTab(index));tabs.append(tab);content.append(panel);
      return panel;
    });
    const tabButtons=[...tabs.children];
    function selectTab(index,focus=false) {
      state.dossierTab=index;
      panels.forEach((panel,i)=>{panel.hidden=i!==index;tabButtons[i].setAttribute('aria-selected',String(i===index));tabButtons[i].tabIndex=i===index?0:-1;});
      content.scrollTop=0;
      if(focus)tabButtons[index].focus();
    }
    function keyboardTabs(group,select) {
      group.addEventListener('keydown',event=>{
        const current=[...group.children].indexOf(event.target);if(current<0)return;
        let next=current;
        if(event.key==='ArrowRight')next=(current+1)%group.children.length;
        else if(event.key==='ArrowLeft')next=(current+group.children.length-1)%group.children.length;
        else if(event.key==='Home')next=0;
        else if(event.key==='End')next=group.children.length-1;
        else return;
        event.preventDefault();event.stopPropagation();select(next,true);
      });
    }
    keyboardTabs(tabs,selectTab);

    // First page: stacked white trays, compact stats, skill tiles and weapon strip.
    const overview=panels[0];overview.classList.add('dossier-overview');
    const stats=sections.stats;stats.classList.add('dossier-stats');
    const statsTitle=stats.querySelector('h3');statsTitle.textContent=labels.attributes;
    const statsBar=node('div','dossier-bar');
    const detailsToggle=button('dossier-detail-toggle');
    detailsToggle.setAttribute('aria-controls','dossier-basic-fields');
    const search=node('span','dossier-search');search.setAttribute('aria-hidden','true');
    const detailsLabel=node('span','',labels.details);detailsToggle.append(search,detailsLabel);
    statsBar.append(statsTitle,detailsToggle);stats.prepend(statsBar);
    sections.basic.id='dossier-basic-fields';stats.append(sections.basic);
    function showFacts(open,focus=false) {
      state.dossierFacts=open;sections.basic.hidden=!open;
      detailsToggle.setAttribute('aria-expanded',String(open));detailsLabel.textContent=open?labels.hide:labels.details;
      if(focus){detailsToggle.focus();detailsToggle.scrollIntoView?.({block:'nearest'});}
    }
    detailsToggle.addEventListener('click',()=>showFacts(!state.dossierFacts));
    showFacts(Boolean(state.dossierFacts));
    overview.append(stats);

    let skillIndex=Number.isInteger(state.dossierSkill)&&state.dossierSkill<skills.length?state.dossierSkill:0;
    const skillPreview=node('section','dossier-tray dossier-skill-overview');
    const previewHeading=node('h3','dossier-tray-label',labels.skills);skillPreview.append(previewHeading);
    const previewTiles=node('div','dossier-skill-tiles');
    const skillNav=node('div','dossier-skill-tabs');
    skillNav.setAttribute('role','tablist');skillNav.setAttribute('aria-label',labels.skills);
    const skillGlyph=index=>{
      const badge=node('span','dossier-skill-badge');badge.setAttribute('aria-hidden','true');
      const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 48');
      const path=doc.createElementNS(svg.namespaceURI,'path');
      path.setAttribute('d',[
        'M25 6 12 27h10l-1 15 15-23H25Z',
        'M26 5 12 25l6 5 18-17-1-8ZM11 25l13 13M9 39l8-8',
        'M24 6 39 12v11c0 10-15 19-15 19S9 33 9 23V12ZM24 15v16M16 23h16'
      ][index%3]);
      path.setAttribute('fill',index===0?'currentColor':'none');path.setAttribute('stroke','currentColor');
      path.setAttribute('stroke-width','3');path.setAttribute('stroke-linejoin','round');
      svg.append(path);badge.append(svg);
      const icon=options.skillIcons?.[index];
      if(icon) {
        const img=node('img','dossier-skill-art');img.alt='';img.decoding='async';
        img.addEventListener('error',()=>{img.remove();badge.classList.remove('has-art');badge.title=labels.missing;},{once:true});
        badge.classList.add('has-art');badge.append(img);img.src=icon.file;
      }
      return badge;
    };
    function selectSkill(index,focus=false) {
      skillIndex=index;state.dossierSkill=index;
      skills.forEach((card,i)=>{card.hidden=i!==index;const tab=skillNav.children[i];tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
      if(focus)skillNav.children[index]?.focus();
    }
    skills.forEach((card,index)=>{
      const name=card.querySelector('.skill-head strong').textContent;
      const type=card.querySelector('.skill-head span').textContent;
      function tile(cls) {
        const el=button(cls);el.append(node('span','dossier-skill-type',type),skillGlyph(index),node('span','dossier-skill-name',name));
        const icon=options.skillIcons?.[index];
        if(icon) {
          el.dataset.iconKey=icon.key;el.dataset.iconMatch=icon.match;
          el.title=labels.source+' · '+(icon.sourceTitleCn||icon.sourceTitle);
          if(icon.match!=='name')el.append(node('small','dossier-icon-reference',labels[icon.match]));
        }
        el.setAttribute('aria-label',labels.openSkill+name);return el;
      }
      const preview=tile('dossier-skill-tile');preview.addEventListener('click',()=>{selectTab(1);selectSkill(index,true);});previewTiles.append(preview);
      const tab=tile('dossier-skill-tile');tab.id='dossier-skill-tab-'+index;tab.setAttribute('role','tab');
      card.id='dossier-skill-'+index;card.setAttribute('role','tabpanel');card.setAttribute('aria-labelledby',tab.id);card.tabIndex=0;
      tab.setAttribute('aria-controls',card.id);tab.addEventListener('click',()=>selectSkill(index));skillNav.append(tab);
    });
    if(!skills.length)previewTiles.append(node('p','',labels.empty));
    keyboardTabs(skillNav,selectSkill);
    const skillRow=node('div','dossier-action-row');
    skillRow.append(previewTiles,action(labels.viewSkills,()=>{selectTab(1,true);}));skillPreview.append(skillRow);overview.append(skillPreview);

    const weapon=node('section','dossier-tray dossier-weapon');
    weapon.append(node('h3','dossier-tray-label',labels.weapon));
    const weaponRow=node('div','dossier-action-row');
    const weaponFace=node('div','dossier-weapon-card');
    const weaponIcon=node('span','dossier-weapon-icon');weaponIcon.setAttribute('aria-hidden','true');
    const weaponCopy=node('div','dossier-weapon-copy');
    weaponCopy.append(node('span','dossier-weapon-type',options.weapon),node('strong','',options.weaponName||'—'),node('small','',labels.weaponHint));
    const weaponTypes=node('div','dossier-weapon-tags');weaponTypes.append(node('span','',options.attack),node('span','',options.defense));
    weaponFace.append(weaponIcon,weaponCopy,weaponTypes);
    weaponRow.append(weaponFace,action(labels.weaponInfo,()=>showFacts(true,true)));weapon.append(weaponRow);overview.append(weapon);

    const guide=node('section','dossier-tray dossier-guide');
    const guideCopy=node('div','dossier-guide-copy');guideCopy.append(node('h3','dossier-tray-label',labels.notes),node('p','',sections.description?.querySelector('p')?.textContent||''));
    guide.append(guideCopy,action(labels.viewNotes,()=>selectTab(2,true)));overview.append(guide);
    if(sections.source)overview.append(sections.source);

    // Existing descriptions and cooldowns are retained verbatim, with a real
    // selected skill panel instead of decorative, non-working upgrade buttons.
    sections.skills.prepend(node('p','dossier-skill-hint',labels.skillHint));
    sections.skills.querySelector('h3').remove();
    sections.skills.insertBefore(skillNav,sections.skills.querySelector('.skill-list'));
    if(options.skillIcons?.length)sections.skills.append(node('p','dossier-icon-notice',labels.notice));
    panels[1].append(sections.skills);
    for(const section of [sections.description,sections.notes])if(section)panels[2].append(section);
    const footer=node('div','dossier-footer');footer.append(node('span','',labels.archive),node('span','dossier-footer-marks','○ + × △'));
    shell.append(tabs,content,footer);body.replaceChildren(shell);
    selectSkill(skillIndex);selectTab([0,1,2].includes(state.dossierTab)?state.dossierTab:0);
  }
  window.PADossier={mount};
})();
