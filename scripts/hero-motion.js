/* Homepage-only choreography. No timers, new artwork downloads, or WebGL work. */
(() => {
  window.PAHeroMotion={create};
  function create(reduced=window.matchMedia('(prefers-reduced-motion: reduce)')) {
    const hero=document.getElementById('home');
    if(!hero || hero.dataset.motionReady)return;
    hero.dataset.motionReady='true';
    const art=hero.querySelector('.hero-art'), orbit=hero.querySelector('.hero-orbit-anchor');
    const forced=window.matchMedia('(forced-colors: active)');
    const fine=window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 681px)');
    const jobs=new Set(),pending=new Map(),textCleanups=new Set();
    let partsObserver=null;
    let visible=false, visited=false, suspended=false, frame=0, point=null, bounds=null;
    const allowed=()=>visible && !suspended && !document.hidden && !document.fullscreenElement &&
      !reduced.matches && !forced.matches && document.documentElement.dataset.ambientEnabled==='true';

    function finishEntrance() {
      for(const animation of jobs)animation.cancel();
      jobs.clear();
      for(const cleanup of [...textCleanups])cleanup();
      for(const element of pending.keys())partsObserver?.unobserve(element);
      pending.clear();
    }
    function resetPointer() {
      if(frame)cancelAnimationFrame(frame);
      frame=0;point=null;bounds=null;
      art?.style.removeProperty('translate');
      orbit?.style.removeProperty('translate');
    }
    const inViewport=element=>{
      const rect=element.getBoundingClientRect();
      return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight;
    };
    function revealTitle(heading,delay) {
      // Temporary glyph wrappers; keep complete phrases for assistive technology,
      // preserve Latin word wrapping, and restore the original DOM when finished.
      if(typeof Intl.Segmenter!=='function')return false;
      const graphemes=new Intl.Segmenter(document.documentElement.lang,{granularity:'grapheme'});
      const words=new Intl.Segmenter(document.documentElement.lang,{granularity:'word'});
      const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT),nodes=[];
      while(walker.nextNode())nodes.push(walker.currentNode);
      const length=nodes.reduce((count,node)=>count+[...graphemes.segment(node.data)].filter(part=>part.segment.trim()).length,0);
      if(!length || length>96)return false;
      const labelSource=heading.cloneNode(true);
      labelSource.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
      const label=labelSource.textContent.replace(/\s+/g,' ').trim();
      const oldLabel=heading.getAttribute('aria-label'),originals=[],letters=[];
      heading.setAttribute('aria-label',label);
      for(const node of nodes) {
        const parent=node.parentNode,run=document.createElement('span');
        run.className='hero-glyph-run';run.setAttribute('aria-hidden','true');
        for(const word of words.segment(node.data)) {
          let host=run;
          if(/[A-Za-z0-9]/.test(word.segment)) {
            host=document.createElement('span');host.className='hero-glyph-word';run.append(host);
          }
          for(const part of graphemes.segment(word.segment)) {
            if(!part.segment.trim()){host.append(document.createTextNode(part.segment));continue;}
            const letter=document.createElement('span');letter.className='hero-glyph';letter.textContent=part.segment;
            host.append(letter);letters.push(letter);
          }
        }
        originals.push({parent,node,run});node.replaceWith(run);
      }
      let restored=false;
      const restore=()=>{
        if(restored)return;
        restored=true;textCleanups.delete(restore);
        for(const {parent,node,run} of originals)if(run.parentNode===parent && run.isConnected)run.replaceWith(node);
        if(heading.getAttribute('aria-label')===label) {
          if(oldLabel===null)heading.removeAttribute('aria-label');else heading.setAttribute('aria-label',oldLabel);
        }
      };
      textCleanups.add(restore);
      const animations=[];
      letters.forEach((letter,index)=>{
        try {
          const animation=letter.animate([
            {opacity:0,transform:'translateY(.7em) rotate(5deg)'},
            {opacity:1,transform:'translateY(-.035em) rotate(-.5deg)',offset:.76},
            {opacity:1,transform:'translateY(0) rotate(0)'}
          ],{duration:590,delay:delay+index*Math.min(38,520/Math.max(1,letters.length-1)),easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'});
          jobs.add(animation);animations.push(animation);
        }catch { /* The letter is still readable without the animation API. */ }
      });
      Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{
        for(const animation of animations){jobs.delete(animation);animation.cancel();}
        restore();
      });
      return true;
    }
    function revealPart(element,from,delay,duration) {
      if(!allowed() || !inViewport(element) || element.contains(document.activeElement))return;
      if(element.matches('h1') && revealTitle(element,delay))return;
      const baseScale=Number.parseFloat(getComputedStyle(art).scale)||1;
      const frames=element===art
        ? [{opacity:.55,scale:String(baseScale+(fine.matches?.04:.025))},{opacity:1,scale:String(baseScale)}]
        : [{opacity:.18,translate:from},{opacity:1,translate:'0 0'}];
      if(element.matches('.hero-wordmark')) {
        frames[0].clipPath='inset(0 100% 0 0)';frames[1].clipPath='inset(0 0% 0 0)';
      }else if(element.matches('.hero-content > p')) {
        frames[0].clipPath='inset(0 0 100% 0)';frames[1].clipPath='inset(0 0 0% 0)';
      }
      let animation;
      try {animation=element.animate(frames,{duration,delay,easing:'cubic-bezier(.16,.8,.24,1)',fill:'both'});}
      catch {return;}
      jobs.add(animation);
      const clean=()=>{jobs.delete(animation);animation.cancel();};
      animation.finished.then(clean,()=>jobs.delete(animation));
    }
    function reveal() {
      if(visited)return;
      visited=true;
      if(!allowed() || typeof hero.animate!=='function')return;
      const sequence=[
        ['.hero-art','0 0',0,1100],
        ['.hero-wordmark','24px 0',80,620],
        ['.eyebrow','18px 0',150,540],
        ['h1','0 30px',210,760],
        ['.hero-content > p','0 20px',310,620],
        ['.hero-actions .btn','0 16px',390,540],
        ['.hero-coordinate','-24px 0',410,650],
        ['.hero-panel .stat-card','0 16px',490,580],
        ['.hero-scroll','0 10px',550,500]
      ];
      for(const [selector,from,delay,duration] of sequence) {
        hero.querySelectorAll(selector).forEach((element,i)=>{
          if(inViewport(element))revealPart(element,from,delay+i*65,duration);
          else if(partsObserver) {
            pending.set(element,{from,duration,delay:i*65});
            partsObserver.observe(element);
          }
        });
      }
    }
    function sync() {
      const active=allowed();
      hero.dataset.heroMotion=active?'running':'paused';
      if(!active){finishEntrance();resetPointer();}
    }
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
      for(const entry of entries) {
        visible=entry.isIntersecting;
        if(!visible){visited=false;}
        sync();
        if(visible)reveal();
      }
    },{threshold:0}):null;
    if(observer)partsObserver=new IntersectionObserver(entries=>{
      for(const entry of entries) {
        const part=pending.get(entry.target);
        if(!part || !entry.isIntersecting)continue;
        pending.delete(entry.target);partsObserver.unobserve(entry.target);
        revealPart(entry.target,part.from,part.delay,part.duration);
      }
    },{threshold:0});
    if(observer)observer.observe(hero);
    else {visible=true;sync();reveal();}

    function move(event) {
      if(!allowed() || !fine.matches || event.pointerType==='touch' || event.buttons)return;
      bounds ||= hero.getBoundingClientRect();
      point={x:event.clientX,y:event.clientY};
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        if(!point || !allowed() || !bounds.width || !bounds.height)return;
        const x=Math.max(-1,Math.min(1,(point.x-bounds.left)/bounds.width*2-1));
        const y=Math.max(-1,Math.min(1,(point.y-bounds.top)/bounds.height*2-1));
        // At most 7 px. Text/buttons never move with the pointer.
        if(art)art.style.translate=`${(x*7).toFixed(2)}px ${(y*5).toFixed(2)}px`;
        if(orbit)orbit.style.translate=`${(-x*9).toFixed(2)}px ${(-y*7).toFixed(2)}px`;
      });
    }
    hero.addEventListener('pointermove',move,{passive:true});
    hero.addEventListener('pointerleave',resetPointer);
    hero.addEventListener('pointerdown',finishEntrance,{capture:true});
    hero.addEventListener('focusin',finishEntrance);
    hero.addEventListener('keydown',finishEntrance,{capture:true});
    window.addEventListener('scroll',resetPointer,{passive:true});
    window.addEventListener('resize',()=>{resetPointer();finishEntrance();},{passive:true});
    document.addEventListener('pa:language-change',()=>{
      // Translation replaces heading nodes; never restore a previous language.
      finishEntrance();
      if(!allowed() || typeof hero.animate!=='function')return;
      ['.hero-wordmark','h1','.hero-content > p'].forEach((selector,index)=>{
        const element=hero.querySelector(selector);
        if(element)revealPart(element,'0 12px',index*70,620);
      });
    });
    document.addEventListener('pa:ambient-change',sync);
    document.addEventListener('visibilitychange',sync);
    document.addEventListener('fullscreenchange',sync);
    reduced.addEventListener?.('change',sync);
    forced.addEventListener?.('change',sync);
    fine.addEventListener?.('change',resetPointer);
    window.addEventListener('pagehide',()=>{suspended=true;sync();});
    window.addEventListener('pageshow',()=>{suspended=false;sync();});
    sync();
  }
})();
