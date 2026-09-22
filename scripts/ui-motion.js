/* Small, finite UI reactions. No canvas, camera or character animation changes. */
(() => {
  const tapSelector = '.strip-arrow,.showcase-prev,.showcase-next,.showcase-details,' +
    '.showcase-modes button,.showcase-pause,.showcase-reset,.showcase-fullscreen,' +
    '.clear-filters,.modal-close,.lang-btn,.theme-toggle,.nav a,.youtube-link,' +
    '.source-link,.hero-actions .btn,.hero-scroll,#ambientMotionToggle,#heroMotionToggle';

  window.PAInterfaceMotion = {create};
  function create(reduced = window.matchMedia('(prefers-reduced-motion: reduce)')) {
    const active = new Map(), pending = new Set(), seen = new WeakSet();
    let sceneEntrance = null;
    const forcedColors = window.matchMedia('(forced-colors: active)');
    const supported = typeof Element.prototype.animate === 'function';
    const allowed = () => supported && !reduced.matches && !forcedColors.matches && !document.hidden;
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return element.isConnected && rect.width > 0 && rect.height > 0 &&
        rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    };

    function cancel(key) { active.get(key)?.finish(); }
    function clear() { for (const job of [...active.values()]) job.finish(); }
    function animate(key, element, frames, options, cleanup = () => {}) {
      cancel(key);
      // Bound transient layers even during very fast keyboard/pointer input.
      if (active.size >= 24) cancel(active.keys().next().value);
      let animation;
      try { animation = element.animate(frames, {...options, fill:'both'}); }
      catch { cleanup(); return; }
      const job = {finish() {
        if (active.get(key) !== job) return;
        active.delete(key);
        animation.cancel();
        cleanup();
      }};
      active.set(key, job);
      animation.finished.then(job.finish, job.finish);
    }

    const observer = supported && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) { cancel(entry.target); continue; }
        const card = entry.target;
        pending.delete(card);
        observer.unobserve(card);
        seen.add(card);
        // Content is never CSS-hidden while waiting for the observer or an API.
        if (!allowed() || !visible(card) || card.contains(document.activeElement)) continue;
        animate(card, card, [
          {opacity:.35, translate:'0 14px'},
          {opacity:1, translate:'0 0'}
        ], {duration:420, delay:Math.min(index++, 3) * 65, easing:'cubic-bezier(.2,.75,.25,1)'});
      }
    }, {threshold:0, rootMargin:'0px 0px -20px 0px'}) : null;

    function observeCards(cards) {
      // Called after a list is rebuilt (including language changes).
      for (const card of pending) if (!card.isConnected) {
        pending.delete(card);
        observer?.unobserve(card);
      }
      for (const key of active.keys()) if (!key.isConnected) cancel(key);
      if (!observer) return;
      for (const card of cards) if (!seen.has(card) && !pending.has(card)) {
        pending.add(card);
        observer.observe(card);
      }
    }

    function select(card) {
      sceneEntrance?.finish();
      if (!allowed() || !visible(card)) return;
      // Animate the inner paper/avatar, leaving hover transforms and hit areas intact.
      const surface = card.querySelector('.academy-card-content,.avatar,.trailer-thumb');
      if (!surface) return;
      animate(surface, surface, [
        {scale:'1', offset:0}, {scale:'.96', offset:.22},
        {scale:'1.025', offset:.62}, {scale:'1', offset:1}
      ], {duration:330, easing:'ease-out'});
    }

    function tap(event) {
      if (!allowed() || event.button > 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const host = event.target.closest?.(tapSelector);
      if (!host || host.matches(':disabled,[aria-disabled="true"]') || host.closest('[inert]') || !visible(host)) return;
      cancel(host);
      const rect = host.getBoundingClientRect();
      const clip = document.createElement('span'), wave = document.createElement('span');
      clip.className = 'ui-tap-clip';
      clip.setAttribute('aria-hidden', 'true');
      wave.className = 'ui-tap-wave';
      // Percent coordinates remain correct on slightly scaled controls. Keyboard clicks are centered.
      const x = event.detail ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : .5;
      const y = event.detail ? Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) : .5;
      const size = Math.min(600, Math.hypot(rect.width, rect.height) * 2);
      wave.style.cssText = `left:${x*100}%;top:${y*100}%;width:${size}px;height:${size}px;`;
      const anchor = getComputedStyle(host).position === 'static';
      if (anchor) host.classList.add('ui-tap-anchor');
      clip.append(wave);
      host.append(clip);
      animate(host, wave, [
        {opacity:.65, transform:'translate(-50%,-50%) scale(.06)'},
        {opacity:0, transform:'translate(-50%,-50%) scale(1)'}
      ], {duration:460, easing:'cubic-bezier(.16,.7,.3,1)'}, () => {
        clip.remove();
        if (anchor) host.classList.remove('ui-tap-anchor');
      });
    }

    function focus(event) {
      // Tab navigation must never land on a partly transparent/revealing card.
      for (const key of active.keys()) if (key.contains(event.target)) cancel(key);
    }
    function preferenceChanged() { if (!allowed()) clear(); }

    function observeCharacterScene() {
      if (sceneEntrance || !supported || !('IntersectionObserver' in window)) return;
      const section=document.getElementById('characters');
      if(!section)return;
      // Observe small, independently visible regions, not an intersection ratio
      // on the entire tall section. This also works with the stacked mobile UI.
      const regions=[
        ['.academy-heading','-22px 0',0,520],
        ['.academy-navigation','cards',40,560],
        ['#characterProfileSlot','-34px 8px',100,620],
        ['#characterModeSlot','20px -8px',140,480],
        ['.showcase-viewport','22px 12px',160,640],
        ['.showcase-controls','0 18px',200,520],
        ['.dock-heading','-20px 8px',0,520],
        ['.student-strip-wrap','cards',70,560],
        ['.dock-bottom','0 10px',140,440]
      ].map(([selector,from,delay,duration])=>({element:section.querySelector(selector),from,delay,duration}))
        .filter(region=>region.element);
      const entered=new Set(), jobs=new Map();
      const finish = region => {
        for(const [element,owner] of [...jobs])if(!region || owner===region)cancel(element);
      };
      sceneEntrance={finish:()=>finish()};
      const reveal=(element,region,from,delay,duration)=>{
        if(!visible(element) || element.contains(document.activeElement))return;
        // Do not let a still-running legacy CSS arrival fade resume when this
        // stagger completes, or it could flash a student card back to half opacity.
        element.classList.remove('card-enter');
        jobs.set(element,region);
        animate(element,element,[{opacity:.12,translate:from},{opacity:1,translate:'0 0'}],
          {duration,delay,easing:'cubic-bezier(.16,.8,.24,1)'},()=>jobs.delete(element));
      };
      const revealRegion=region=>{
        const element=region.element;
        if(entered.has(element) || !visible(element))return;
        entered.add(element);
        if(!allowed() || document.fullscreenElement || element.contains(document.activeElement))return;
        // Loading/error messages remain fully readable. The gallery owns the
        // ready-only first model/portrait reveal; no new model mounts or clip resets.
        if(element.matches('.showcase-viewport') && element.querySelector('.showcase-message:not([hidden])'))return;
        if(region.from!=='cards') {
          reveal(element,element,region.from,region.delay,region.duration);
          return;
        }
        const strip=element.querySelector('.academy-cards,#charGrid');
        const bounds=strip?.getBoundingClientRect();
        let index=0;
        for(const card of strip?.children || []) {
          const rect=card.getBoundingClientRect();
          if(!visible(card) || rect.right<=bounds.left || rect.left>=bounds.right)continue;
          const from=card.matches('.academy-card')?'18px -14px':'18px 24px';
          reveal(card,element,from,region.delay+Math.min(index++,7)*42,region.duration);
        }
        for(const arrow of element.querySelectorAll('.strip-arrow'))
          reveal(arrow,element,'0 10px',region.delay,420);
      };
      const partsObserver=new IntersectionObserver(entries=>{
        if(document.fullscreenElement)return;
        for(const entry of entries) {
          const region=regions.find(item=>item.element===entry.target);
          if(!region)continue;
          if(entry.isIntersecting)revealRegion(region);
          else finish(region.element);
        }
      },{threshold:0,rootMargin:'-84px 0px -24px 0px'});
      regions.forEach(region=>partsObserver.observe(region.element));
      // A generous exit margin prevents scroll jitter at a section boundary from
      // restarting the UI repeatedly. Only a genuine leave starts another visit.
      const visitObserver=new IntersectionObserver(entries=>{
        if(document.fullscreenElement)return;
        for(const entry of entries)if(!entry.isIntersecting) {
          const rect=section.getBoundingClientRect();
          if(rect.bottom<=-72 || rect.top>=innerHeight+72) {finish();entered.clear();}
        }
      },{threshold:0,rootMargin:'80px 0px 80px 0px'});
      visitObserver.observe(section);
      // Controls must be immediately stable when the user starts interacting.
      section.addEventListener('pointerdown',()=>finish(),{capture:true});
      section.addEventListener('keydown',()=>finish(),{capture:true});
      section.addEventListener('input',()=>finish(),{capture:true});
      section.addEventListener('change',()=>finish(),{capture:true});
      document.addEventListener('fullscreenchange',()=>finish());
      window.addEventListener('pagehide',()=>{finish();entered.clear();});
    }
    document.addEventListener('click', tap);
    document.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', preferenceChanged);
    window.addEventListener('pagehide', clear);
    reduced.addEventListener?.('change', preferenceChanged);
    forcedColors.addEventListener?.('change', preferenceChanged);
    return {select, observeCards, observeCharacterScene};
  }
})();
