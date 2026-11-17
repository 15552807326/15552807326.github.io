// Navigation is native anchor navigation; no simulated scrolling or focus traps.
function start() {
  const header=document.querySelector('.atlas-header');
  const toggle=header?.querySelector('.atlas-nav-toggle');
  const nav=header?.querySelector('#atlas-primary-links');
  if(!toggle||!nav)return;
  toggle.dataset.wired='';
  const expanded=()=>toggle.getAttribute('aria-expanded')==='true';
  const close=()=>toggle.setAttribute('aria-expanded','false');
  toggle.addEventListener('click',()=>toggle.setAttribute('aria-expanded',String(!expanded())));
  nav.addEventListener('click',e=>{
    const link=e.target.closest('a[href^="#"]');if(!link||!expanded())return;
    close();
    const dest=document.getElementById(link.hash.slice(1));if(dest){if(!dest.hasAttribute('tabindex'))dest.tabIndex=-1;dest.focus({preventScroll:true});}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded()){close();toggle.focus();}});
  document.addEventListener('pointerdown',e=>{if(!header.contains(e.target)&&expanded())close();});
  header.addEventListener('focusout',e=>{if(e.relatedTarget&&!header.contains(e.relatedTarget))close();});
  matchMedia('(max-width:920px)').addEventListener('change',close);
  addEventListener('hashchange',close);

  // Develop the existing CFD plate once, leaving the type and its contrast untouched.
  const cover=document.querySelector('#publications .outputs-heading');
  const wash=cover?.querySelector('.atlas-pressure-mask');
  if(wash && 'IntersectionObserver' in window && matchMedia('(prefers-reduced-motion:no-preference) and (forced-colors:none)').matches){
    cover.dataset.plate='silver';
    const io=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      io.disconnect();cover.dataset.plate='developing';
      const finish=()=>{delete cover.dataset.plate;};
      wash.addEventListener('animationend',finish,{once:true});setTimeout(finish,1800);
    },{threshold:0.18});io.observe(cover);
  }

  const dialog=document.querySelector('#atlas-model-dialog');
  const frame=dialog?.querySelector('#parafoil-stage-frame');
  const trigger=document.querySelector('[data-atlas-model-open]');
  if(!frame||!trigger)return;
  trigger.addEventListener('click',()=>{
    if(!dialog.showModal){location.assign(frame.dataset.src);return;}
    dialog.showModal();
    if(!frame.hasAttribute('src'))frame.setAttribute('src',frame.dataset.src);
    dialog.querySelector('[data-atlas-model-close]')?.focus({preventScroll:true});
  });
  dialog.querySelector('[data-atlas-model-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  // Inside the same-origin iframe, Escape should work even when the canvas owns focus.
  frame.addEventListener('load',()=>{frame.contentDocument?.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog.open){e.preventDefault();dialog.close();}});});
  dialog.addEventListener('close',()=>{frame.contentWindow?.postMessage({type:'stage-visibility',visible:false},location.origin);trigger.focus({preventScroll:true});});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
