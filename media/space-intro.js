/* Local assets only. No tracking, sound, remote API or homepage content replacement. */
(() => {
  'use strict';
  const DURATION = 5000;
  const KEY = 'yj-personal-universe-v1';
  const params = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const replayRequested = params.get('intro') === 'replay';
  const inspect = local && params.get('intro') === 'inspect';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v-a)/(b-a))); return t*t*(3-2*t); };
  let finishCurrent = () => {};
  let rendererModule, flightModule;

  function ensureOverlay() {
    if (document.getElementById('space-intro')) return;
    const overlay=document.createElement('div');
    overlay.id='space-intro';overlay.className='space-intro';overlay.hidden=true;
    for(const id of ['space-intro-canvas','space-intro-flight']) {
      const canvas=document.createElement('canvas');canvas.id=id;canvas.setAttribute('aria-hidden','true');overlay.append(canvas);
    }
    const skip=document.createElement('button');skip.id='space-intro-skip';skip.type='button';skip.textContent='跳过动画';overlay.append(skip);
    const progress=document.createElement('span');progress.className='space-intro-progress';progress.setAttribute('aria-hidden','true');overlay.append(progress);
    document.body.append(overlay);
  }

  async function start(force = false) {
    ensureOverlay();
    const boot = window.__spaceIntroBoot;
    const root = document.documentElement;
    const overlay = document.getElementById('space-intro');
    const page = document.getElementById('top');
    const canvas = document.getElementById('space-intro-canvas');
    const skip = document.getElementById('space-intro-skip');
    if (!overlay || !page || !canvas || !skip) return;
    if (overlay.dataset.running === 'true') return;
    const navigation = performance.getEntriesByType('navigation')[0];
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch { /* Private mode is fine. */ }
    if (boot?.cancelled || (boot && !boot.shouldPlay && !force) || reduced.matches || forced.matches ||
        (!force && (location.hash || navigation?.type === 'back_forward' || scrollY > 12 || seen))) {
      boot?.release('bypass');
      return;
    }
    if (document.hidden) {
      const resume = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', resume);
        start(force);
      };
      document.addEventListener('visibilitychange', resume);
      return;
    }
    boot?.claim();

    let disposed = false, universe, flight, frame = 0, fallbackTimer, loadTimer;
    let startTime = 0, seekTime = null, firstFrame = true;
    const previousFocus = document.activeElement;
    const previousInert = page.inert;
    const previousOverflow = document.body.style.overflow;
    const progress = overlay.querySelector('.space-intro-progress');
    const phase = value => { if (overlay.dataset.phase !== value) overlay.dataset.phase = value; };
    const stateEvent = () => document.dispatchEvent(new Event('space-intro-state'));

    function finish(reason = 'complete') {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(fallbackTimer); clearTimeout(loadTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
      removeEventListener('pagehide', onPageHide);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      reduced.removeEventListener('change', onPreference);
      forced.removeEventListener('change', onPreference);
      skip.removeEventListener('click', onSkip);
      document.removeEventListener('space-intro-boot-skip', onSkip);
      const hadFocus = overlay.contains(document.activeElement);
      if (hadFocus) document.activeElement.blur();
      overlay.hidden = true;
      overlay.classList.remove('space-intro-arriving');
      root.classList.remove('space-intro-active', 'space-intro-unfold');
      ['--space-page-angle','--space-page-scale','--space-page-light'].forEach(k => root.style.removeProperty(k));
      ['--arrival-radius','--arrival-feather'].forEach(k => overlay.style.removeProperty(k));
      page.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      overlay.dataset.running = 'false';
      phase(reason);
      const failed = ['fallback','load-timeout'].includes(reason);
      if (failed && boot) boot.fail(reason);
      else boot?.release(reason);
      if (reason === 'complete' || reason === 'skipped') {
        try { sessionStorage.setItem(KEY, '1'); } catch { /* No storage required. */ }
      }
      try { universe?.dispose(); } catch { /* Never block the underlying homepage. */ }
      try { flight?.dispose(); } catch { /* Ignore cleanup failures. */ }
      if (hadFocus && !['complete','timeout','background','navigation'].includes(reason)) {
        const target = previousFocus !== document.body && previousFocus?.isConnected
          ? previousFocus : page.querySelector('a[aria-label="返回首页"]');
        target?.focus({preventScroll:true});
      }
      stateEvent();
      dispatchEvent(new Event('resize'));
    }
    function onSkip() { finish('skipped'); }
    function onVisibility() { if (document.hidden && !firstFrame) finish('background'); }
    function onPageHide() { finish('navigation'); }
    function onContextLost(event) { event.preventDefault(); finish('fallback'); }
    function onPreference() { if (reduced.matches || forced.matches) finish('reduced-motion'); }
    function onKey(event) {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); finish('skipped'); }
      // The background is inert; keep keyboard focus on the one visible action.
      if (event.key === 'Tab') { event.preventDefault(); skip.focus({preventScroll:true}); }
    }
    function onResize() { try { universe?.resize(); flight?.resize(); } catch { finish('fallback'); } }
    function render(now) {
      if (disposed) return;
      if (document.hidden && firstFrame) {
        frame = requestAnimationFrame(render);
        return;
      }
      // Never drop the boot cover if the cinematic stylesheet failed to load.
      if (firstFrame && getComputedStyle(overlay).position !== 'fixed') {
        finish('fallback');
        return;
      }
      if (!overlay.isConnected || document.getElementById('space-intro') !== overlay) {
        finish('hydration-recovery');
        start(true);
        return;
      }
      if (!startTime) startTime = now;
      const seconds = seekTime === null ? Math.min(5, (now-startTime)/1000) : seekTime;
      try { universe.render(seconds); flight?.render(seconds); } catch { finish('fallback'); return; }
      // Reveal the real homepage radially from the landing point on the planet.
      const arrival = smooth(4.04, 5, seconds);
      progress.style.transform = `scaleX(${seconds/5})`;
      overlay.dataset.elapsed = seconds.toFixed(2);
      phase(seconds < 1.25 ? 'stars' : seconds < 3.1 ? 'approach' : seconds < 4.04 ? 'surface' : 'unfold');
      if (arrival > 0) {
        overlay.classList.add('space-intro-arriving');
        const startedUnfold = !root.classList.contains('space-intro-unfold');
        root.classList.add('space-intro-unfold');
        if (startedUnfold) stateEvent();
        const radius = Math.hypot(innerWidth, innerHeight)*.57*arrival;
        overlay.style.setProperty('--arrival-radius', `${radius.toFixed(1)}px`);
        overlay.style.setProperty('--arrival-feather', `${(12 + 32*arrival).toFixed(1)}px`);
        root.style.setProperty('--space-page-angle', `${(8*(1-arrival)).toFixed(2)}deg`);
        root.style.setProperty('--space-page-scale', String(.91+.09*arrival));
        root.style.setProperty('--space-page-light', String(.55+.45*arrival));
      } else {
        overlay.classList.remove('space-intro-arriving');
        root.classList.remove('space-intro-unfold');
      }
      if (firstFrame) {
        firstFrame = false;
        clearTimeout(loadTimer);
        overlay.hidden = false;
        overlay.dataset.running = 'true';
        page.inert = true;
        root.classList.add('space-intro-active');
        document.body.style.overflow = 'hidden';
        skip.focus({preventScroll:true});
        stateEvent();
        // Both WebGL layers have submitted a frame; swap covers atomically.
        boot?.release('ready');
        // A main-thread error or paused frame must not leave an inaccessible screen.
        if (!inspect) fallbackTimer = setTimeout(() => finish('timeout'), DURATION + 800);
      }
      if (seconds >= 5) finish('complete');
      else frame = requestAnimationFrame(render);
    }
    finishCurrent = finish;
    skip.addEventListener('click', onSkip);
    document.addEventListener('space-intro-boot-skip', onSkip);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('keydown', onKey);
    addEventListener('resize', onResize, {passive:true});
    addEventListener('pagehide', onPageHide);
    canvas.addEventListener('webglcontextlost', onContextLost);
    reduced.addEventListener('change', onPreference);
    forced.addEventListener('change', onPreference);
    // Keep the synchronous cover in place until we can actually paint the scene.
    // A slow/failed load leaves an explicit Skip choice, never flashes the page.
    loadTimer = setTimeout(() => finish('load-timeout'), 15000);
    try {
      rendererModule ||= import('/media/space-universe.js?v=7719804bb463');
      const { createUniverse } = await rendererModule;
      if (disposed) return;
      universe = await createUniverse(canvas);
      if (disposed) { universe.dispose(); return; }
      universe.resize();
      const flightCanvas=document.getElementById('space-intro-flight');
      if(flightCanvas){
        flightModule ||= import('/media/space-flight.js?v=44b4e7636ac3');
        try {
          const {createFlight}=await flightModule;
          if(disposed)return;
          flight=await createFlight(flightCanvas);
          if(disposed){flight.dispose();return;}
        }catch(error){if(local)console.warn('Parafoil entrance unavailable:',error.message);finish('fallback');return;}
      }
      // Do not interrupt someone who started browsing while assets were loading.
      if(disposed)return;
      if(!inspect && scrollY > 12 && !boot?.shouldPlay){finish('browsing');return;}
      if(!overlay.isConnected || document.getElementById('space-intro')!==overlay){
        finish('hydration-recovery');
        start(true);
        return;
      }
      if (inspect) {
        seekTime = Math.max(0, Math.min(4.99, Number(params.get('at')) || 0));
        window.__spaceIntro.seek = seconds => { seekTime = Math.max(0,Math.min(5,seconds)); };
      }
      frame = requestAnimationFrame(render);
    } catch (error) {
      if (local) console.warn('Space intro unavailable:', error.message);
      finish('fallback');
    }
  }
  function ready() {
    if (local) window.__spaceIntro = { replay: () => { finishCurrent('replay'); start(true); }, finish: () => finishCurrent('test') };
    // This is a frozen React document export. Wait for its first hydrated host,
    // then two paint turns, so our independent layer never alters the SSR tree
    // that React is still matching. If the app cannot hydrate, just leave it alone.
    const deadline=performance.now()+4500;
    function afterHydration(){
      const page=document.getElementById('top');
      const attached=page && Object.keys(page).some(key=>key.startsWith('__reactFiber$'));
      if(attached){requestAnimationFrame(()=>requestAnimationFrame(()=>start(replayRequested || inspect)));return;}
      if(performance.now()<deadline)setTimeout(afterHydration,40);
      else window.__spaceIntroBoot?.fail('page-loading');
    }
    afterHydration();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
  else ready();
})();
