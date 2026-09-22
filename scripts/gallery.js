/* Display-first student gallery. Heavy viewers are imported only on selection. */
(() => {
  const copy = {
    cn:{portrait:'立绘',model:'3D 模型',spine:'记忆大厅',details:'查看完整资料',previous:'上一位学生',next:'下一位学生',academy:'所属学院',role:'战斗定位',weapon:'武器',loading:'正在准备展示…',error:'暂时无法加载。你仍可查看立绘，或前往 Kivo 查看。',unavailable:'这位学生暂无对应的公开资源',fileProtocol:'动态展示需要本地 HTTP 服务。请按 README 的运行方式打开本站；立绘仍可直接查看。',variant:'展示版本',animation:'动画',pause:'暂停',play:'播放',reset:'重置视角',source:'在 Kivo 查看 ↗',files:'素材文件',download:'下载文件',empty:'没有符合筛选条件的学生',modelHint:'拖动旋转 · 滚轮或双指缩放',spineHint:'记忆大厅 · 可选择动画',portraitHint:'CHARACTER ILLUSTRATION',body:'角色本体',halo:'光环',version:'版本',idle:'默认动画',fullscreen:'全屏展示',exitFullscreen:'退出全屏',available:'本地资源',noFiles:'暂无可下载的本地文件'},
    en:{portrait:'Illustration',model:'3D Model',spine:'Recollection Lobby',details:'Full profile',previous:'Previous student',next:'Next student',academy:'ACADEMY',role:'ROLE',weapon:'WEAPON',loading:'Preparing the scene…',error:'The scene could not load. View the illustration or open Kivo instead.',unavailable:'No public resource is available for this student',fileProtocol:'Animated previews need a local HTTP server. Follow the README to run the site; illustrations still work here.',variant:'Variant',animation:'Animation',pause:'Pause',play:'Play',reset:'Reset view',source:'Open in Kivo ↗',files:'Asset files',download:'Download file',empty:'No students match these filters',modelHint:'Drag to rotate · Scroll or pinch to zoom',spineHint:'Recollection lobby · Select an animation',portraitHint:'CHARACTER ILLUSTRATION',body:'Character',halo:'Halo',version:'Version',idle:'Default animation',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',available:'LOCAL ASSETS',noFiles:'No local files available'},
    jp:{portrait:'立ち絵',model:'3Dモデル',spine:'メモリアルロビー',details:'詳しいプロフィール',previous:'前の生徒',next:'次の生徒',academy:'所属学園',role:'役割',weapon:'武器',loading:'表示を準備しています…',error:'読み込めませんでした。立ち絵を見るか、Kivoで確認できます。',unavailable:'この生徒の公開リソースはありません',fileProtocol:'動的プレビューにはローカルHTTPサーバーが必要です。READMEの手順で開いてください。立ち絵はこのまま見られます。',variant:'表示バージョン',animation:'アニメーション',pause:'一時停止',play:'再生',reset:'視点をリセット',source:'Kivoで見る ↗',files:'素材ファイル',download:'ダウンロード',empty:'条件に一致する生徒がいません',modelHint:'ドラッグで回転 · スクロールやピンチで拡大',spineHint:'メモリアルロビー · アニメーションを選択',portraitHint:'CHARACTER ILLUSTRATION',body:'生徒モデル',halo:'光輪',version:'バージョン',idle:'デフォルト',fullscreen:'全画面表示',exitFullscreen:'全画面を終了',available:'ローカル素材',noFiles:'ローカルファイルがありません'}
  };
  // Recovery copy is grouped separately from the profile and animation labels.
  const previewCopy = {
    cn:{fileProtocol:'当前是直接打开的 HTML 文件，模型和大厅需要 HTTP 预览。请在项目文件夹双击 start-preview.cmd，保持启动窗口开启，再点击下方入口。',openPreview:'打开本地预览 ↗',retry:'重新加载',returnPortrait:'返回立绘',webglError:'浏览器未能创建 3D 绘图环境（WebGL）。请在支持 WebGL 的浏览器中打开本地预览，并检查硬件加速是否可用。',loadError:'模型或依赖加载失败。请确认预览服务仍在运行，且 assets/media 与 assets/vendor 文件夹完整。'},
    en:{fileProtocol:'This HTML file was opened directly. Models and lobbies need an HTTP preview. Double-click start-preview.cmd in the project folder, keep its window open, then use the link below.',openPreview:'Open local preview ↗',retry:'Retry loading',returnPortrait:'Back to illustration',webglError:'The browser could not create a WebGL context. Open the local preview in a WebGL-capable browser and check hardware acceleration availability.',loadError:'The model or a dependency could not load. Check that the preview server is running and assets/media and assets/vendor are present.'},
    jp:{fileProtocol:'HTMLファイルを直接開いています。モデルとロビーにはHTTPプレビューが必要です。プロジェクト内の start-preview.cmd をダブルクリックし、起動ウィンドウを開いたまま下のリンクを押してください。',openPreview:'ローカルプレビューを開く ↗',retry:'再読み込み',returnPortrait:'立ち絵に戻る',webglError:'WebGLの描画環境を作成できませんでした。WebGL対応ブラウザーでローカルプレビューを開き、ハードウェアアクセラレーションが利用できるか確認してください。',loadError:'モデルまたは依存ファイルを読み込めませんでした。プレビューサーバーの起動状態と assets/media・assets/vendor フォルダーを確認してください。'}
  };
  const profileCopy={
    cn:{formation:'站位',attack:'攻击类型',defense:'防御类型',rarity:'星级'},
    en:{formation:'Position',attack:'Attack Type',defense:'Defense Type',rarity:'Rarity'},
    jp:{formation:'ポジション',attack:'攻撃タイプ',defense:'防御タイプ',rarity:'レアリティ'}
  };
  const interactionCopy={
    cn:{pickupHint:'点击角色播放 Pick Up',pickupLabel:'拾起互动',pickupKeys:'按 Enter 或空格播放 Pick Up；暂停时将在恢复播放后继续'},
    en:{pickupHint:'Click the character for Pick Up',pickupLabel:'Pick Up interaction',pickupKeys:'Press Enter or Space for Pick Up; when paused, resume playback to continue'},
    jp:{pickupHint:'生徒をタップして Pick Up',pickupLabel:'つまみ上げモーション',pickupKeys:'Enter またはスペースで Pick Up。一時停止中は再生を再開すると続きます'}
  };
  const ambientCopy={
    cn:{pause:'暂停背景动效',play:'开启背景动效',system:'背景静止 · 跟随系统设置'},
    en:{pause:'Pause background motion',play:'Enable background motion',system:'Static background · system preference'},
    jp:{pause:'背景の動きを止める',play:'背景の動きを有効にする',system:'背景停止 · システム設定に従う'}
  };
  const modelCopy={cn:{carrier:'附属模型'},en:{carrier:'Companion model'},jp:{carrier:'付属モデル'}};
  const lobbyCopy={
    cn:{fitLabel:'大厅显示方式',cover:'填满相框',contain:'完整画面'},
    en:{fitLabel:'Lobby framing',cover:'Fill frame',contain:'Full scene'},
    jp:{fitLabel:'ロビー表示',cover:'フレームに合わせる',contain:'全体を表示'}
  };
  const isCarrier=item=>/_Carrier(?:_|\.|$)/i.test(item.name || item.file || '');
  function modelVariants(record) {
    return (record.models || []).filter(item=>item.type==='body' && item.ready && /\.glb$/i.test(item.file))
      .sort((a,b)=>Number(isCarrier(a))-Number(isCarrier(b)));
  }
  function createAmbientMotion(reduced) {
    const buttons=[...document.querySelectorAll('#ambientMotionToggle,#heroMotionToggle')];
    const forcedColors=window.matchMedia('(forced-colors: active)');
    let enabled=true, language='cn';
    const visible=new Set();
    try { enabled=localStorage.getItem('pa-ambient-motion')!=='paused'; } catch { /* Private browsing can disable storage. */ }
    function sync() {
      const staticMode=reduced.matches || forcedColors.matches;
      const active=enabled && !staticMode;
      const inView=!('IntersectionObserver' in window) || visible.size>0;
      document.documentElement.dataset.ambientMotion=active && !document.hidden && inView ? 'running' : 'paused';
      document.documentElement.dataset.ambientEnabled=String(active);
      for(const button of buttons) {
        button.disabled=staticMode;
        button.setAttribute('aria-pressed',String(active));
        button.dataset.motion=active?'running':'paused';
        button.textContent=ambientCopy[language][staticMode?'system':active?'pause':'play'];
      }
      document.dispatchEvent(new CustomEvent('pa:ambient-change'));
    }
    buttons.forEach(button=>button.addEventListener('click',()=>{
      enabled=!enabled;
      try {localStorage.setItem('pa-ambient-motion',enabled?'running':'paused');} catch { /* Keep the current choice in memory. */ }
      sync();
    }));
    if('IntersectionObserver' in window) {
      const observer=new IntersectionObserver(entries=>{
        for(const entry of entries) {if(entry.isIntersecting)visible.add(entry.target);else visible.delete(entry.target);}
        sync();
      });
      document.querySelectorAll('main > section:not(#home),#about').forEach(el=>observer.observe(el));
    }
    document.addEventListener('visibilitychange',sync);
    reduced.addEventListener?.('change',sync);
    forcedColors.addEventListener?.('change',sync);
    sync();
    return {update(nextLanguage){language=nextLanguage;sync();}};
  }
  const iconPaths={
    role:'<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
    attack:'<path d="m6 18 12-12 2-3-3 2L5 17m-2-3 7 7M3 21l3-3"/>',
    defense:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="M12 7v9"/>',
    heal:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" fill="currentColor" stroke="none"/>',
    formation:'<path d="M4 6h16M4 12h12M4 18h8"/>',
    weapon:'<path d="M3 7h17v5H9l-2 7H3l2-7H3Zm17 2h2M9 12h5v4H8"/>'
  };
  function icon(kind) {
    return `<svg class="hud-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconPaths[kind] || iconPaths.role}</svg>`;
  }
  function roleIcon(role) {
    return icon(({输出:'attack',坦克:'defense',辅助:'heal',治疗:'heal'})[role] || 'role');
  }
  // One source of truth for both the school ribbon and the student's backdrop.
  const academyEmblems=Object.freeze({all:6,'歌赫娜':3,'千禧年':4,'阿拜多斯':1,'圣三一':2,'瓦尔基里':8,'阿里乌斯':10,'海兰德':24,'红冬':5,'山海经':7,'百鬼夜行':9,SRT:11,'狂猎艺术':14});
  const academyEmblem=academy=>academyEmblems[academy] ? `assets/ui/academies/${academyEmblems[academy]}.png` : '';
  window.PAGallery = {create,icon,roleIcon,modelVariants,academyEmblem};
  function create(host, helpers) {
    host.innerHTML = `
      <div class="showcase-main">
        <div class="showcase-modes" role="group">
          <button type="button" data-mode="portrait" aria-pressed="true"></button>
          <button type="button" data-mode="model" aria-pressed="false"></button>
          <button type="button" data-mode="spine" aria-pressed="false"></button>
        </div>
        <div class="showcase-viewport">
          <div class="lobby-frame-art" aria-hidden="true"><span class="lobby-paper-back"></span></div>
          <div class="lobby-photo lobby-photo-current">
            <div class="lobby-frame-art" aria-hidden="true"><span class="lobby-paper-front"></span><span class="lobby-pin"></span><span class="lobby-tape"></span></div>
            <div class="lobby-window"></div>
          </div>
          <div class="academy-backdrop" aria-hidden="true">
            <div class="academy-crest-anchor">
              <div class="academy-crest-orbit"></div>
              <div class="academy-crest-layer academy-crest-previous" hidden></div>
              <div class="academy-crest-layer academy-crest-current" hidden></div>
            </div>
          </div>
          <div class="showcase-watermark" aria-hidden="true">ARCHIVE</div>
          <img class="showcase-portrait" alt="">
          <div class="showcase-player"></div>
          <div class="showcase-message" role="status" aria-live="polite" hidden></div>
          <button class="showcase-fullscreen" type="button" aria-label="全屏展示">⛶</button>
          <span class="showcase-visual-label" aria-hidden="true"></span>
        </div>
        <div class="showcase-controls" hidden>
          <div class="lobby-fit" role="group" hidden><button type="button" data-lobby-fit="cover" aria-pressed="true"></button><button type="button" data-lobby-fit="contain" aria-pressed="false"></button></div>
          <label class="variant-field"><span data-label="variant"></span><select class="showcase-variant"></select></label>
          <label class="animation-field"><span data-label="animation"></span><select class="showcase-animation"></select></label>
          <button class="showcase-pause" type="button"></button>
          <button class="showcase-reset" type="button"></button>
        </div>
      </div>
      <aside class="showcase-info">
        <div class="showcase-profile-head">
          <div class="showcase-registration" aria-hidden="true">STUDENT ARCHIVE <span class="showcase-number">011</span></div>
          <h3 class="showcase-name" aria-live="polite"></h3>
          <div class="showcase-header-meta"><div class="showcase-academy"></div><div class="showcase-stars" role="img"></div></div>
        </div>
        <dl class="showcase-facts"></dl>
        <p class="showcase-description"></p>
        <button class="btn btn-primary showcase-details" type="button"></button>
        <a class="showcase-source" target="_blank" rel="noopener noreferrer"></a>
        <details class="showcase-downloads"><summary></summary><div class="showcase-file-list"></div></details>
        <div class="showcase-pagination"><button class="showcase-prev" type="button">←</button><span class="showcase-position"></span><button class="showcase-next" type="button">→</button></div>
      </aside>`;
    const find = selector=>host.querySelector(selector);
    const elements = Object.fromEntries(['portrait','player','message','name','number','academy','stars','description','facts','details','source','prev','next','position','variant','animation','pause','reset','fullscreen','controls','visual-label','viewport','file-list','downloads'].map(name=>[name,find('.showcase-'+name)]));
    const modeButtons = [...host.querySelectorAll('[data-mode]')];
    const fitGroup=find('.lobby-fit'), fitButtons=[...fitGroup.querySelectorAll('button')];
    const lobbyWindow=find('.lobby-window');
    const lobbyPhoto=find('.lobby-photo-current');
    const lobbyBack=find('.lobby-paper-back'), lobbyPin=find('.lobby-pin');
    // Academy navigation sits above; the student strip sits below the open stage.
    document.getElementById('characterModeSlot').append(find('.showcase-modes'));
    document.getElementById('characterProfileSlot').append(find('.showcase-info'));
    const backdrop = document.getElementById('characterBackdrop');
    const watermark = find('.showcase-watermark');
    const viewportHome=elements.viewport.parentElement;
    const pageStage=document.createElement('div');
    pageStage.className='page-model-stage';pageStage.hidden=true;
    const workspace=host.closest('.character-workspace');
    const scene=host.closest('.character-scene');
    scene.prepend(pageStage);
    let stageActive=false;
    function syncStage() {
      const enabled=!!selected && mode==='model' && location.protocol!=='file:';
      pageStage.hidden=!enabled;
      document.body.classList.toggle('page-model-active',enabled);
      const rect=pageStage.getBoundingClientRect();
      const active=enabled
        && (document.fullscreenElement===elements.viewport || (rect.top < innerHeight*.65 && rect.bottom > innerHeight*.35));
      if (active!==stageActive) { stageActive=active;session?.setPaused(!active || document.hidden || paused); }
    }
    function placeViewport() {
      const fullPage=mode==='model' && location.protocol!=='file:';
      if (fullPage && elements.viewport.parentElement!==pageStage) pageStage.append(elements.viewport);
      if (!fullPage && elements.viewport.parentElement!==viewportHome) viewportHome.insertBefore(elements.viewport,elements.controls);
      // Keep the hole stationary while only its contents fade/slide. Both move
      // together when the entire photo frame lifts; other viewer DOM is unchanged.
      const mediaParent=mode==='spine'?lobbyWindow:elements.viewport;
      for(const element of [elements.portrait,elements.player]) {
        if(element.parentElement===mediaParent)continue;
        if(mode==='spine')mediaParent.append(element);
        else mediaParent.insertBefore(element,elements.message);
      }
      const accessoryParent=mode==='spine'?lobbyPhoto:elements.viewport;
      for(const element of [elements['visual-label'],elements.fullscreen]) {
        if(element.parentElement!==accessoryParent)accessoryParent.append(element);
      }
      syncStage();
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ambientMotion=createAmbientMotion(reduced);
    const loadViewer=helpers.loadViewer || (view=>import(view==='model' ? './model-viewer.js' : './spine-viewer.js'));
    const info=document.querySelector('#characterProfileSlot .showcase-info');
    const sceneAnimations=new Map();
    function canTransition() {
      const rect=scene.getBoundingClientRect();
      return !reduced.matches && !document.hidden && typeof elements.player.animate==='function'
        && rect.bottom>0 && rect.top<innerHeight;
    }
    // This independent timeline survives the media viewer's short exit/async mount.
    // It animates decoration only: never the camera, canvas, controls or skeleton.
    const academyBackdrop=find('.academy-backdrop');
    const crestCurrent=find('.academy-crest-current');
    const crestPrevious=find('.academy-crest-previous');
    const crestOrbit=find('.academy-crest-orbit');
    const academyTransition=document.createElement('div');
    academyTransition.className='academy-transition';
    academyTransition.setAttribute('aria-hidden','true');
    academyTransition.innerHTML='<div class="academy-wipe"></div><div class="academy-wipe-edge"></div><div class="academy-burst"></div>';
    workspace.append(academyTransition);
    const academyAnimations=new Map(), crestImages=new Map();
    const forcedColors=window.matchMedia('(forced-colors: active)');
    let academyRevision=0, academyMotionEpoch=0, crestAcademy=null, academyFilter=null;
    function cancelAcademyMotion() {
      for(const animation of academyAnimations.values()) animation.cancel();
      academyAnimations.clear();
      crestPrevious.hidden=true;crestPrevious.replaceChildren();
      delete workspace.dataset.academyTransition;
    }
    function animateAcademy(element,frames,duration,delay=0,easing='cubic-bezier(.16,.78,.22,1)') {
      const animation=element.animate(frames,{duration,delay,fill:'both',easing});
      academyAnimations.set(element,animation);
      animation.finished.catch(()=>{}).then(()=>{
        if(academyAnimations.get(element)!==animation)return;
        academyAnimations.delete(element);animation.cancel();
        if(element===crestPrevious){crestPrevious.hidden=true;crestPrevious.replaceChildren();}
        if(!academyAnimations.size)delete workspace.dataset.academyTransition;
      });
    }
    function loadCrest(academy) {
      const source=academyEmblem(academy);
      if(!source)return Promise.resolve(null);
      if(!crestImages.has(source)) {
        const promise=new Promise(resolve=>{
          const img=new Image();img.alt='';img.decoding='async';img.draggable=false;
          img.onload=()=>{img.onload=img.onerror=null;resolve(img);};
          img.onerror=()=>{img.onload=img.onerror=null;crestImages.delete(source);resolve(null);};
          img.src=source;
        });
        crestImages.set(source,promise);
      }
      return crestImages.get(source);
    }
    function sweepAcademy() {
      workspace.dataset.academyTransition='running';
      animateAcademy(academyTransition.querySelector('.academy-wipe'),[
        {opacity:0,transform:'translateX(-130%) skewX(-18deg)',offset:0},
        {opacity:.85,offset:.28},{opacity:.55,offset:.66},
        {opacity:0,transform:'translateX(350%) skewX(-18deg)',offset:1}
      ],980,0,'cubic-bezier(.45,0,.2,1)');
      animateAcademy(academyTransition.querySelector('.academy-wipe-edge'),[
        {opacity:0,transform:'translateX(-180%) skewX(-18deg)',offset:0},
        {opacity:.7,offset:.25},{opacity:0,transform:'translateX(2100%) skewX(-18deg)',offset:1}
      ],1000,70,'cubic-bezier(.45,0,.2,1)');
      animateAcademy(academyTransition.querySelector('.academy-burst'),[
        {opacity:0,scale:.42,offset:0},{opacity:.6,offset:.25},{opacity:0,scale:1.38,offset:1}
      ],1050,40);
    }
    function setAcademyBackdrop(academy,{major=false}={}) {
      if(crestAcademy===academy && !major)return;
      crestAcademy=academy;
      const current=++academyRevision;
      const motionEpoch=academyMotionEpoch;
      cancelAcademyMotion();
      academyBackdrop.dataset.academy=academy || '';
      const moving=canTransition() && !forcedColors.matches;
      // No delayed sweep after a cold image download; start it with the selection.
      if(major && moving)sweepAcademy();
      if(!academyEmblem(academy)) {
        crestCurrent.hidden=true;crestCurrent.replaceChildren();return;
      }
      const oldImage=crestCurrent.querySelector('img');
      const source=academyEmblem(academy);
      if(oldImage && oldImage.getAttribute('src')!==source) {
        crestPrevious.replaceChildren(oldImage);crestPrevious.hidden=false;
        if(moving)animateAcademy(crestPrevious,[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(-70px) scale(.88) rotate(-9deg)'}],320);
        else {crestPrevious.hidden=true;crestPrevious.replaceChildren();}
        crestCurrent.hidden=true;
      }
      const started=performance.now();
      void loadCrest(academy).then(img=>{
        if(current!==academyRevision)return;
        if(!img){crestCurrent.hidden=true;crestCurrent.replaceChildren();return;}
        crestCurrent.replaceChildren(img.cloneNode());crestCurrent.hidden=false;
        // Scrolling away/reduced motion/late image responses settle without a flash.
        if(!moving || motionEpoch!==academyMotionEpoch || !canTransition() || forcedColors.matches || performance.now()-started>1200)return;
        animateAcademy(crestCurrent,[
          {opacity:0,transform:major?'translateX(95px) scale(1.2) rotate(12deg)':'translateX(28px) scale(1.04)'},
          {opacity:1,transform:'none'}
        ],major?880:480,major?60:0);
        if(major)animateAcademy(crestOrbit,[{opacity:.1,transform:'rotate(-45deg) scale(.8)'},{opacity:1,transform:'rotate(-18deg)'}],1020);
      });
    }
    function settleAcademyMotion() {
      cancelAcademyMotion();
      // Keep pending image completion useful, but prevent it from starting motion.
      // A later selection still owns the revision and replaces any stale image.
      academyMotionEpoch++;
    }
    function cancelSceneMotion() {
      for(const animation of sceneAnimations.values()) animation.cancel();
      sceneAnimations.clear();
    }
    function animateScene(element,frames,options) {
      sceneAnimations.get(element)?.cancel();
      const animation=element.animate(frames,{fill:'both',...options});
      sceneAnimations.set(element,animation);
      return animation.finished.catch(()=>{}).then(()=>{
        if(sceneAnimations.get(element)===animation) {sceneAnimations.delete(element);animation.cancel();}
      });
    }
    const lobbyAnimations=new Map();
    let lobbyOutgoing=null;
    function releaseLobbyOutgoing() {
      if(lobbyOutgoing) {
        lobbyOutgoing.controller?.abort();lobbyOutgoing.session.dispose();lobbyOutgoing.photo.remove();lobbyOutgoing=null;
      }
      delete elements.viewport.dataset.lobbySwap;
      lobbyPhoto.inert=false;
    }
    function cancelLobbyMotion({keepOutgoing=false}={}) {
      for(const animation of lobbyAnimations.values())animation.cancel();
      lobbyAnimations.clear();
      if(!keepOutgoing)releaseLobbyOutgoing();
    }
    function animateLobbyPart(element,frames,duration) {
      const animation=element.animate(frames,{duration,fill:'both',easing:'cubic-bezier(.2,.75,.25,1)'});
      lobbyAnimations.set(element,animation);
      return animation.finished.catch(()=>{}).then(()=>{
        if(lobbyAnimations.get(element)!==animation)return;
        lobbyAnimations.delete(element);animation.cancel();
      });
    }
    function canSwapLobby() {
      const rect=elements.viewport.getBoundingClientRect();
      return mode==='spine' && !document.fullscreenElement && !forcedColors.matches && canTransition()
        && rect.bottom>0 && rect.top<innerHeight;
    }
    function retainLobbyPhoto() {
      cancelLobbyMotion({keepOutgoing:true});
      if(session) {
        releaseLobbyOutgoing();
        // Transfer the actual old canvas instead of cloning an empty WebGL canvas
        // or capturing a bitmap. Only two viewer sessions can exist during a swap.
        const photo=document.createElement('div');photo.className='lobby-photo lobby-photo-outgoing';
        photo.setAttribute('aria-hidden','true');photo.inert=true;
        const windowCopy=lobbyWindow.cloneNode(false);
        const media=document.createElement('div');media.className='lobby-outgoing-media';
        media.append(...elements.player.childNodes);windowCopy.append(media);
        // The outgoing photo carries a decorative copy of the expand icon.
        // Keep a single real button/listener, attached to the incoming photo.
        const expandIcon=document.createElement('span');expandIcon.className='showcase-fullscreen lobby-expand-echo';
        expandIcon.setAttribute('aria-hidden','true');expandIcon.textContent='⛶';
        photo.append(lobbyPhoto.querySelector('.lobby-frame-art').cloneNode(true),windowCopy,elements['visual-label'].cloneNode(true),expandIcon);
        elements.viewport.append(photo);
        session.setPaused(true);
        lobbyOutgoing={photo,session,controller};session=null;controller=null;
      }
      elements.viewport.dataset.lobbySwap='loading';
      lobbyPhoto.inert=true;
    }
    function animateLobbyFrame(direction=1) {
      if(!canSwapLobby()){cancelLobbyMotion();return;}
      if(lobbyOutgoing) {
        const outgoing=lobbyOutgoing;
        cancelLobbyMotion({keepOutgoing:true});
        elements.viewport.dataset.lobbySwap='swapping';
        // Both complete photos keep their own aperture and mat. Separate first,
        // exchange depth halfway through, then the loaded back photo takes front.
        const backPose=getComputedStyle(lobbyBack).transform || 'translate(8px,8px) rotate(2.4deg)';
        const oldLift=`translateY(-23%) rotate(${-direction*3}deg) scale(.99)`;
        const newDip=`translate(8px,12%) rotate(${direction*3}deg) scale(.985)`;
        const duration=980;
        const oldMotion=animateLobbyPart(outgoing.photo,[
          {transform:'none',zIndex:3,offset:0},
          {transform:oldLift,zIndex:3,offset:.43},
          {transform:oldLift,zIndex:3,offset:.49},
          {transform:oldLift,zIndex:1,offset:.5},
          {transform:backPose,zIndex:1,offset:1}
        ],duration);
        const newMotion=animateLobbyPart(lobbyPhoto,[
          {transform:backPose,zIndex:2,offset:0},
          {transform:newDip,zIndex:2,offset:.43},
          {transform:newDip,zIndex:2,offset:.49},
          {transform:newDip,zIndex:4,offset:.5},
          {transform:'none',zIndex:4,offset:1}
        ],duration);
        for(const decoration of outgoing.photo.querySelectorAll('.lobby-pin,.lobby-tape,.lobby-expand-echo')) {
          void animateLobbyPart(decoration,[{opacity:1,offset:0},{opacity:1,offset:.45},{opacity:0,offset:.82},{opacity:0,offset:1}],duration);
        }
        void Promise.all([oldMotion,newMotion]).then(()=>{
          if(lobbyOutgoing===outgoing)releaseLobbyOutgoing();
        });
        return;
      }
      cancelLobbyMotion();
      // First opening has no previous photo to exchange. A restrained arrival
      // moves the whole assembly; the aperture never moves relative to its mat.
      void animateLobbyPart(lobbyPhoto,[{transform:'translateY(12px) rotate(-.7deg)',opacity:0},{transform:'none',opacity:1}],540);
      void animateLobbyPart(lobbyBack,[{rotate:'0deg'},{rotate:`${direction*.8}deg`,offset:.4},{rotate:'0deg'}],600);
      void animateLobbyPart(lobbyPin,[{rotate:'-6deg'},{rotate:'2deg',offset:.65},{rotate:'0deg'}],600);
    }
    function enterScene(element,direction,current) {
      if(current!==requestId) return;
      delete elements.player.dataset.reveal;
      delete elements.portrait.dataset.reveal;
      elements.player.inert=false;
      if(mode==='spine') {
        lobbyPhoto.inert=false;
        animateLobbyFrame(direction);
        return;
      }
      if(!canTransition()) return;
      // Animate the visual surface, never the viewport/camera or the model's bones.
      void animateScene(element,[{opacity:0,transform:`translateX(${direction*28}px)`},{opacity:1,transform:'none'}],
        {duration:380,easing:'cubic-bezier(.2,.75,.25,1)'});
      void animateScene(watermark,[{opacity:.25,transform:`translateX(${direction*12}px)`},{opacity:1,transform:'none'}],
        {duration:460,easing:'ease-out'});
    }
    let list = [], language = 'cn', selected = null, mode = 'model', variantIndex = 0;
    let controller = null, session = null, requestId = 0, paused = reduced.matches, messageKey = null;
    let lobbyFit='cover';
    const text = key=>lobbyCopy[language]?.[key] || modelCopy[language]?.[key] || interactionCopy[language]?.[key] || profileCopy[language]?.[key] || previewCopy[language]?.[key] || copy[language]?.[key] || copy.cn[key];
    const record = ()=>window.PA_MEDIA_CATALOG?.students?.[selected?.id] || {};
    const variants = ()=>mode === 'model' ? modelVariants(record()) : (record().spines || []).filter(item=>item.ready);
    function tell(key) {
      messageKey=key;
      elements.message.replaceChildren();
      elements.message.hidden=!key;
      if(!key) return;
      const description=document.createElement('p');description.textContent=text(key);
      elements.message.append(description);
      if(key==='loading') return;
      const actions=document.createElement('div');actions.className='showcase-recovery';
      if(key==='fileProtocol') {
        const link=document.createElement('a');
        const url=new URL('http://127.0.0.1:18900/index.html');
        url.searchParams.set('student',selected.id);url.searchParams.set('preview',mode);url.hash='characters';
        link.href=url.href;link.textContent=text('openPreview');actions.append(link);
      } else if(['error','webglError','loadError'].includes(key)) {
        const retry=document.createElement('button');retry.type='button';retry.textContent=text('retry');
        retry.addEventListener('click',show);actions.append(retry);
      }
      const back=document.createElement('button');back.type='button';back.textContent=text('returnPortrait');
      back.addEventListener('click',()=>{mode='portrait';variantIndex=0;show();});actions.append(back);
      elements.message.append(actions);
    }
    const releaseMedia = ()=>{
      controller?.abort(); controller=null;
      session?.dispose(); session=null;
      elements.player.replaceChildren();
      elements.animation.replaceChildren();
    };
    const stop = ()=>{
      requestId++;
      cancelSceneMotion();cancelLobbyMotion();settleAcademyMotion();releaseMedia();
      delete elements.player.dataset.reveal;delete elements.portrait.dataset.reveal;elements.player.inert=false;
    };
    function updateText() {
      if(!selected) return;
      const media = record();
      host.dataset.academy = selected.academy;
      host.dataset.mode = mode;
      elements.viewport.dataset.mode=mode;
      pageStage.dataset.mode=mode;
      const name = helpers.getName(selected);
      watermark.textContent = helpers.getEnglishName(selected).toUpperCase();
      const background = media.lobbyImage || '';
      backdrop.hidden=!background;
      if(backdrop.dataset.source !== background) {
        backdrop.dataset.source=background;
        if(background) backdrop.src=background;
      }
      elements.name.textContent = name;
      elements.portrait.alt = name;
      elements.number.textContent = String(selected.id).padStart(3,'0');
      elements.academy.textContent = helpers.localize(selected.academy);
      elements.stars.textContent = '★'.repeat(selected.rarity);
      if(helpers.renderStars) elements.stars.innerHTML = helpers.renderStars(selected.rarity, selected.rarity);
      elements.stars.setAttribute('aria-label',text('rarity')+': '+selected.rarity);
      elements.description.textContent = helpers.getContent(selected).desc;
      elements.facts.replaceChildren();
      for(const [label,value] of [['role',selected.role],['attack',selected.attackType],['formation',selected.teamPosition],['defense',selected.defenseType],['weapon',selected.weapon]]) {
        const item = document.createElement('div'), dt=document.createElement('dt'), dd=document.createElement('dd');
        item.dataset.fact=label;item.dataset.tone=value;
        dt.textContent=text(label);dt.className='sr-only';dd.innerHTML=icon(label);
        const valueText=document.createElement('span');valueText.className='hud-value';valueText.textContent=helpers.localize(value);
        dd.append(valueText);item.append(dt,dd);elements.facts.append(item);
      }
      elements.details.textContent = text('details');
      elements.source.textContent = text('source');
      elements.source.href = media.source || 'https://kivo.wiki/student/'+selected.kivoId;
      elements.prev.setAttribute('aria-label',text('previous'));
      elements.next.setAttribute('aria-label',text('next'));
      elements.prev.disabled=elements.next.disabled=list.length < 2;
      elements.position.textContent = String(list.findIndex(item=>item.id===selected.id)+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0');
      elements.pause.textContent = text(paused ? 'play' : 'pause');
      elements.pause.dataset.artIcon = paused ? 'play' : 'pause';
      elements.reset.textContent = text('reset');
      elements.fullscreen.setAttribute('aria-label',text(document.fullscreenElement ? 'exitFullscreen' : 'fullscreen'));
      elements.fullscreen.dataset.expanded = String(Boolean(document.fullscreenElement));
      elements.visualLabel = elements['visual-label'];
      elements.visualLabel.textContent = mode==='model' && !document.fullscreenElement ? ({cn:'拖动旋转 · Ctrl + 滚轮缩放 · 滚轮浏览页面',en:'Drag to rotate · Ctrl + scroll to zoom · Scroll to browse',jp:'ドラッグで回転 · Ctrl＋スクロールで拡大 · スクロールでページ移動'}[language]) : text(mode+'Hint');
      if(mode==='model' && session?.canPickUp?.()) {
        elements.visualLabel.textContent=text('pickupHint')+' · '+elements.visualLabel.textContent;
        const canvas=elements.player.querySelector('canvas');
        canvas?.setAttribute('aria-label',helpers.getName(selected)+' · '+text('pickupLabel'));
        canvas?.setAttribute('aria-description',text('pickupKeys'));
      }
      elements.controls.hidden = mode === 'portrait' || location.protocol === 'file:';
      fitGroup.hidden=mode!=='spine';fitGroup.setAttribute('aria-label',text('fitLabel'));
      fitButtons.forEach(button=>{
        button.textContent=text(button.dataset.lobbyFit);
        button.setAttribute('aria-pressed',String(button.dataset.lobbyFit===lobbyFit));
        button.disabled=mode!=='spine' || !session?.setFit;
      });
      if(mode==='spine')elements.visualLabel.textContent=text('spine')+' · '+helpers.getName(selected);
      host.querySelectorAll('[data-label]').forEach(el=>el.textContent=text(el.dataset.label));
      modeButtons.forEach(button=>{
        button.textContent=text(button.dataset.mode);
        button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
        const available=button.dataset.mode==='portrait' || (button.dataset.mode==='model' ? (media.models || []).some(item=>item.type==='body' && item.ready) : (media.spines || []).some(item=>item.ready));
        button.disabled=!available;
        button.title=available ? text(button.dataset.mode) : text('unavailable');
      });
      const items=variants();
      elements.variant.replaceChildren(...items.map((item,i)=>new Option(mode==='model'
        ? text(isCarrier(item)?'carrier':'body')+' · '+(item.name || item.file.split('/').pop()).replace(/_Body$/i,'')
        : text('version')+' '+(i+1),String(i))));
      elements.variant.value=String(variantIndex);
      elements.variant.closest('label').hidden=items.length < 2;
      elements.downloads.querySelector('summary').textContent=text('files');
      elements['file-list'].replaceChildren();
      const files=[...(media.models || []).flatMap(item=>item.files),...(media.spines || []).flatMap(item=>item.files)];
      for(const file of [...new Set(files)]) {
        const a=document.createElement('a');a.href=file;a.download=file.split('/').pop();a.textContent=a.download;a.title=text('download'); elements['file-list'].append(a);
      }
      if(!files.length) elements['file-list'].textContent=text('noFiles');
      if(messageKey) tell(messageKey);
    }
    async function show({transition=false,direction=1}={}) {
      const current=++requestId;
      const swapping=(transition || lobbyOutgoing) && elements.viewport.dataset.mode==='spine'
        && (session || lobbyOutgoing) && canSwapLobby();
      if(swapping)retainLobbyPhoto();
      else cancelLobbyMotion();
      const outgoing=!elements.player.hidden && session ? elements.player
        : !elements.portrait.hidden && elements.portrait.complete && elements.portrait.naturalWidth ? elements.portrait : null;
      if(!swapping && transition && outgoing && canTransition()) {
        const style=getComputedStyle(outgoing);
        const start={opacity:style.opacity || '1',transform:style.transform || 'none'};
        elements.player.inert=true;
        await animateScene(outgoing,[start,{opacity:0,transform:`translateX(${-direction*20}px)`}],{duration:140,easing:'ease-in'});
        if(current!==requestId) return;
      }
      cancelSceneMotion();releaseMedia();
      if(!selected) return;
      delete elements.player.dataset.reveal;delete elements.portrait.dataset.reveal;elements.player.inert=false;
      updateText();
      placeViewport();
      elements.portrait.hidden = mode !== 'portrait';
      elements.player.hidden = mode === 'portrait';
      elements.pause.disabled=elements.reset.disabled=elements.animation.disabled=true;
      if(transition && canTransition()) void animateScene(info,[{opacity:.4,transform:'translateY(9px)'},{opacity:1,transform:'none'}],{duration:300,easing:'ease-out'});
      controller=new AbortController();
      const signal=controller.signal;
      helpers.loadImage(elements.portrait,record().portrait || selected.img,helpers.getName(selected));
      const revealPortrait=()=>enterScene(elements.portrait,direction,current);
      if(mode === 'portrait') {
        tell(null);
        if(canTransition()) elements.portrait.dataset.reveal='pending';
        if(elements.portrait.complete && elements.portrait.naturalWidth) revealPortrait();
        else elements.portrait.addEventListener('load',revealPortrait,{once:true,signal});
        return;
      }
      const item=variants()[variantIndex];
      if(!item) {tell('unavailable');return;}
      if(location.protocol==='file:') {
        // Keep the illustration behind actionable setup guidance instead of a blank stage.
        helpers.loadImage(elements.portrait,record().portrait || selected.img,helpers.getName(selected));
        elements.portrait.hidden=false;elements.player.hidden=true;elements.controls.hidden=true;
        tell('fileProtocol');return;
      }
      elements.player.dataset.reveal='pending';elements.player.inert=true;
      // A private mount target isolates late async work from the next student's DOM.
      const mediaHost=document.createElement('div');mediaHost.className='showcase-media';
      elements.player.append(mediaHost);
      tell('loading');
      try {
        const viewer = await loadViewer(mode);
        if(current!==requestId) return;
        const mounted=await viewer.mount(mediaHost,item,{signal,reducedMotion:reduced.matches,fit:lobbyFit,onAnimationChange(name){
          if(current===requestId) elements.animation.value=name;
        },onStatus(status){
          if(current!==requestId) return;
          if(status.state==='loading' && status.total>0) {
            const statusLine=elements.message.querySelector('p');
            if(statusLine)statusLine.textContent=text('loading')+' '+Math.min(100,Math.round(status.loaded/status.total*100))+'%';
          }
        }});
        if(current!==requestId) {mounted.dispose();return;}
        session=mounted;
        const animations=mounted.getAnimations();
        elements.animation.replaceChildren(...animations.map(animation=>new Option(typeof animation==='string' ? animation : animation.name,typeof animation==='string' ? animation : animation.name)));
        if(mounted.getAnimation?.()) elements.animation.value=mounted.getAnimation();
        paused=reduced.matches;
        mounted.setPaused(document.hidden || paused || (mode==='model' && !stageActive));
        elements.pause.disabled=!animations.length;elements.animation.disabled=!animations.length;elements.reset.disabled=false;
        updateText();tell(null);
        enterScene(elements.player,direction,current);
      } catch(error) {if(current===requestId && error.name!=='AbortError') {
        delete elements.player.dataset.reveal;elements.player.inert=false;
        tell(/webgl|gl context|context creation/i.test(error.message) ? 'webglError' : 'loadError');
        console.warn('Student preview unavailable:',error);
      }}
    }
    function select(id,motionDirection=0,academySwitch=false) {
      const next=list.find(item=>item.id===id);
      if(!next || selected?.id===id) return;
      const previous=selected;
      const direction=motionDirection || (list.findIndex(item=>item.id===id)>=list.findIndex(item=>item.id===selected?.id)?1:-1);
      selected=next;variantIndex=0;
      setAcademyBackdrop(selected.academy,{major:academySwitch});
      helpers.onSelect(id);
      const card=document.querySelector('.char-card[data-character-id="'+id+'"]');
      if(card) {
        const roster=card.parentElement;
        const left=card.offsetLeft-roster.offsetLeft;
        if(left < roster.scrollLeft || left+card.offsetWidth > roster.scrollLeft+roster.clientWidth) roster.scrollTo({left:Math.max(0,left-roster.clientWidth/2+card.offsetWidth/2),behavior:reduced.matches?'instant':'smooth'});
      }
      if(mode!=='portrait' && !variants().length) mode='portrait';
      void show({transition:!!previous,direction});
    }
    function step(direction) {if(list.length) select(list[(list.findIndex(item=>item.id===selected?.id)+direction+list.length)%list.length].id,direction);}
    modeButtons.forEach(button=>button.addEventListener('click',()=>{if(mode===button.dataset.mode)return;mode=button.dataset.mode;variantIndex=0;show();}));
    elements.prev.addEventListener('click',()=>step(-1));elements.next.addEventListener('click',()=>step(1));
    elements.details.addEventListener('click',()=>selected && helpers.openDetails(selected,elements.details));
    elements.variant.addEventListener('change',()=>{variantIndex=Number(elements.variant.value);show();});
    elements.animation.addEventListener('change',()=>{session?.setAnimation(elements.animation.value);});
    elements.pause.addEventListener('click',()=>{paused=!paused;session?.setPaused(paused);updateText();});
    elements.reset.addEventListener('click',()=>{session?.resetCamera();if(mode==='spine'){lobbyFit='cover';updateText();}});
    fitButtons.forEach(button=>button.addEventListener('click',()=>{
      if(mode!=='spine' || !session?.setFit)return;
      lobbyFit=button.dataset.lobbyFit;session.setFit(lobbyFit);updateText();
    }));
    elements.fullscreen.addEventListener('click',async()=>{
      try {if(document.fullscreenElement) await document.exitFullscreen();else await elements.viewport.requestFullscreen();}catch{ /* Fullscreen may be unavailable in embedded browsers. */ }
      updateText();
    });
    document.addEventListener('fullscreenchange',()=>{cancelLobbyMotion();settleAcademyMotion();updateText();syncStage();});
    window.addEventListener('scroll',syncStage,{passive:true});
    window.addEventListener('resize',syncStage);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelSceneMotion();cancelLobbyMotion();settleAcademyMotion();}session?.setPaused(document.hidden || paused || (mode==='model' && !stageActive));});
    document.addEventListener('keydown',event=>{
      if(event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea,[contenteditable="true"]') || document.querySelector('.modal.open')) return;
      const bounds=host.getBoundingClientRect();
      if(bounds.bottom < 120 || bounds.top > innerHeight*.7) return;
      if(event.key.toLowerCase()==='q' || event.key.toLowerCase()==='e') {event.preventDefault();step(event.key.toLowerCase()==='e'?1:-1);}
    });
    reduced.addEventListener?.('change',()=>{if(reduced.matches){cancelSceneMotion();cancelLobbyMotion();settleAcademyMotion();paused=true;session?.setPaused(true);updateText();}});
    forcedColors.addEventListener?.('change',()=>{if(forcedColors.matches){cancelLobbyMotion();settleAcademyMotion();}});
    if('IntersectionObserver' in window) {
      new IntersectionObserver(entries=>{syncStage();if(!entries[0].isIntersecting){cancelLobbyMotion();settleAcademyMotion();}if(mode!=='model')session?.setPaused(!entries[0].isIntersecting || document.hidden || paused);},{threshold:0}).observe(workspace);
    }
    window.addEventListener('pagehide',stop);
    return {
      get selectedId(){return selected?.id;},select,
      openPreview(id,view) {
        if(!['model','spine'].includes(view) || !list.some(item=>item.id===id)) return;
        select(id);mode=view;variantIndex=0;show();
      },
      update(nextList,nextLanguage,nextAcademyFilter='all') {
        const academySwitch=academyFilter!==null && academyFilter!==nextAcademyFilter;
        academyFilter=nextAcademyFilter;
        list=nextList;language=nextLanguage;
        ambientMotion.update(language);
        document.getElementById('characterModeSlot').hidden=!list.length;
        document.getElementById('characterProfileSlot').hidden=!list.length;
        document.getElementById('sceneEmpty').hidden=!!list.length;
        if(!list.length) {setAcademyBackdrop(null);stop();selected=null;host.hidden=true;backdrop.hidden=true;syncStage();return;}
        host.hidden=false;
        const next=list.find(item=>item.id===selected?.id) || list.find(item=>item.id===11) || list[0];
        if(selected?.id!==next.id) select(next.id,0,academySwitch);
        else {updateText();setAcademyBackdrop(selected.academy,{major:academySwitch});}
      }
    };
  }
})();
