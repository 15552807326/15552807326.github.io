function startWingStudy() {
  const plate=document.querySelector('#pro-intro .atlas-hero-plate');
  const range=plate?.querySelector('#wing-study-split');
  if(!range)return;
  const picture=plate.querySelector('.wing-study-lines');
  const surface=range.parentElement;
  let awake=false,started=false,touched=false,frame=0,available=false,drag=null;
  const reduced=matchMedia('(prefers-reduced-motion:reduce), (forced-colors:active)');
  const paint=(amount)=>{
    const n=Math.max(0,Math.min(100,amount));range.value=String(Math.round(n));
    plate.style.setProperty('--wing-split',n.toFixed(2)+'%');
    range.setAttribute('aria-valuetext','结构线描 '+Math.round(n)+'%，织物外观 '+(100-Math.round(n))+'%');
  };
  function stop(){cancelAnimationFrame(frame);frame=0;}
  function quiet(){stop(); started=true;}
  function maybe(){
    if(started||!available||!awake||document.hidden||touched||reduced.matches)return;
    const boot=window.__spaceIntroBoot,root=document.documentElement;
    if((boot&&!boot.released)||root.classList.contains('space-intro-active'))return;
    started=true;
    const begin=performance.now();
    function tick(now){
      if(touched||document.hidden||reduced.matches||!awake){paint(52);return;}
      const t=Math.min(1,(now-begin)/1600),f=t*t*(3-2*t);
      paint(87-35*f);if(t<1)frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  // Controls always interrupt motion synchronously; no second sweep after a manual inspection.
  range.addEventListener('input',()=>{touched=true;quiet();paint(Number(range.value));});
  range.addEventListener('pointerdown',()=>{touched=true;quiet();});
  range.addEventListener('keydown',()=>{touched=true;quiet();});
  const seam=surface.querySelector('.wing-study-rule');seam.style.pointerEvents='auto';seam.style.cursor='ew-resize';seam.style.touchAction='pan-y';
  seam.addEventListener('pointerdown',e=>{touched=true;quiet();drag=e.pointerId;range.focus({preventScroll:true});seam.setPointerCapture(e.pointerId);});
  seam.addEventListener('pointermove',e=>{if(e.pointerId!==drag)return;const b=surface.getBoundingClientRect();paint((e.clientX-b.left)*100/b.width);});
  for(const type of ['pointercancel','pointerup','lostpointercapture'])seam.addEventListener(type,()=>{drag=null;});
  new IntersectionObserver(entries=>{awake=entries[0].isIntersecting;maybe();},{threshold:.1}).observe(plate);
  for(const ev of ['space-intro-state','space-intro-boot-skip','visibilitychange'])document.addEventListener(ev,()=>requestAnimationFrame(maybe));
  reduced.addEventListener('change',()=>{if(reduced.matches){stop();if(!touched)paint(52);}else maybe();});
  picture.decode().then(()=>{available=true;maybe();}).catch(()=>{surface.querySelector('.wing-study-instrument').hidden=true;range.hidden=true;});
  paint(52);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startWingStudy,{once:true});else startWingStudy();
