function start(){
  startResearchScroll();
  const track=document.querySelector('#capability-track');
  const prev=document.querySelector('#capability-prev'),next=document.querySelector('#capability-next'),position=document.querySelector('#capability-position');
  if(track&&prev&&next){
    const cards=[...track.children];
    let current=0;
    function update(){const x=track.getBoundingClientRect().x;current=cards.reduce((best,card,i)=>Math.abs(card.getBoundingClientRect().x-x)<Math.abs(cards[best].getBoundingClientRect().x-x)?i:best,0);position.textContent=`${String(current+1).padStart(2,'0')} / 04`;prev.disabled=current===0;next.disabled=current===cards.length-1;}
    function move(direction){const i=Math.max(0,Math.min(cards.length-1,current+direction));track.scrollTo({left:cards[i].offsetLeft-cards[0].offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));track.addEventListener('scroll',update,{passive:true});addEventListener('resize',update);update();
  }
  const frame=document.querySelector('#parafoil-stage-frame');
  if(frame){let visible=false;const send=()=>frame.contentWindow?.postMessage({type:'stage-visibility',visible},location.origin);const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;send();},{rootMargin:'100px'});observer.observe(frame);frame.addEventListener('load',send);addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='stage-ready')send();});}
  const galleryObserver=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.dataset.inView=String(entry.isIntersecting);},{threshold:.1});
  document.querySelectorAll('.direction-gallery').forEach(el=>{el.dataset.inView='false';galleryObserver.observe(el);});
  const nav=[...document.querySelectorAll('.site-header nav a')];
  const targets=nav.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  let scheduled=false;
  function markSection(){scheduled=false;let id='';for(const el of targets)if(el.getBoundingClientRect().top<innerHeight*.45)id=el.id;nav.forEach(a=>{if(a.hash===`#${id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(markSection);}},{passive:true});markSection();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

// Scroll position is the only clock: reversible, no wheel interception or idle animation.
function startResearchScroll(){
  const figures=[...document.querySelectorAll('[data-research-motion]')];
  if(!figures.length||!CSS.supports('position','sticky'))return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const forced=matchMedia('(forced-colors: active)');
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const shots=figures.map(figure=>({figure,viewport:figure.querySelector('.research-motion-viewport'),img:figure.querySelector('img'),cameraFrame:figure.querySelector('.research-camera-frame'),paths:[...figure.querySelectorAll('path')],kind:figure.dataset.researchMotion,failed:false}));
  const sendCamera=(shot,p=shot.progress||0,visible=shot.figure.dataset.motionVisible==='true')=>{if(shot.failed)return;shot.cameraFrame?.contentWindow?.postMessage({type:'research-camera-state',progress:p,visible:visible&&!reduced.matches&&!forced.matches,requestReady:shot.figure.dataset.cameraReady!=='true'},location.origin);};
  let frame=0,measure=true;
  function schedule(resize=false){measure ||= resize;if(!frame)frame=requestAnimationFrame(update);}
  function update(){
    frame=0;
    const disabled=reduced.matches||forced.matches;
    const vh=document.documentElement.clientHeight;
    if(measure){
      const mobile=innerWidth<=560;
      const header=document.querySelector('.site-header')?.getBoundingClientRect().height||60;
      for(const shot of shots){
        const {figure,viewport,img}=shot;
        const width=figure.clientWidth;
        const height=mobile?Math.min(390,Math.max(280,vh*.48)):Math.min(width*941/1672,vh-header-40);
        shot.height=Math.max(180,height);
        shot.top=Math.max(header+12,(vh-shot.height)/2);
        shot.distance=vh*(mobile?.72:1.12)*(shot.kind==='wind'?1.1:shot.kind==='landing'?1.4:1);
        shot.fitW=Math.min(width,shot.height*1672/941);
        shot.fitH=shot.fitW*941/1672;
        shot.progress=undefined;
        figure.style.setProperty('--shot-height',`${shot.height}px`);
        figure.style.setProperty('--shot-distance',`${shot.distance}px`);
        figure.style.setProperty('--shot-top',`${shot.top}px`);
        figure.dataset.motionReady=String(!disabled&&!shot.failed);
        if(disabled||shot.failed){img.style.removeProperty('transform');img.style.removeProperty('opacity');figure.removeAttribute('data-motion-visible');sendCamera(shot,0,false);}
      }
      measure=false;
    }
    if(disabled)return;
    // Complete all geometry reads before composited style writes.
    const views=shots.map(shot=>({shot,rect:shot.figure.getBoundingClientRect()}));
    for(const {shot,rect} of views){
      if(shot.failed)continue;
      const visible=rect.bottom>0&&rect.top<vh;
      shot.figure.dataset.motionVisible=String(visible);
      const raw=clamp((shot.top-rect.top)/shot.distance);
      sendCamera(shot,raw,visible);
      if(raw===shot.progress&&!measure&&shot.lastW===shot.fitW)continue;
      shot.progress=raw;shot.lastW=shot.fitW;
      let scale=1,cx=.5,cy=.5,opacity=1;
      if(shot.kind==='wind'){
        const reveal=smooth((raw-.24)/.58);
        scale=mix(1.12,1,reveal);cx=mix(.46,.5,reveal);cy=mix(.51,.5,reveal);
        opacity=reveal;
        const windOpacity=(.28+.72*smooth(raw/.13))*(1-smooth((raw-.48)/.32));
        shot.paths.forEach((path,i)=>{
          const passage=clamp(raw/.68-i*.016);
          path.style.strokeDashoffset=String(1.05-passage*2.05);
          path.style.opacity=String(windOpacity*(i%3===0?.8:.38));
        });
      }
      const x=(.5-cx)*shot.fitW*scale,y=(.5-cy)*shot.fitH*scale;
      shot.img.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(5)})`;
      shot.img.style.opacity=String(opacity);
    }
  }
  for(const shot of shots){
    shot.cameraFrame?.addEventListener('load',()=>sendCamera(shot));
    shot.img.addEventListener('load',()=>schedule(true),{once:true});
    shot.img.addEventListener('error',()=>{shot.failed=true;schedule(true);},{once:true});
    if(shot.img.complete&&!shot.img.naturalWidth)shot.failed=true;
  }
  addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    const shot=shots.find(s=>s.cameraFrame?.contentWindow===event.source);
    if(!shot)return;
    if(event.data?.type==='research-camera-loaded')sendCamera(shot);
    if(event.data?.type==='research-camera-ready')shot.figure.dataset.cameraReady='true';
    if(event.data?.type==='research-camera-failed'&&!shot.failed){shot.failed=true;delete shot.figure.dataset.cameraReady;schedule(true);}
  });
  addEventListener('scroll',()=>schedule(),{passive:true});
  addEventListener('resize',()=>schedule(true),{passive:true});
  addEventListener('pageshow',()=>schedule(true));
  reduced.addEventListener('change',()=>schedule(true));
  forced.addEventListener('change',()=>schedule(true));
  if('ResizeObserver' in window){const observer=new ResizeObserver(()=>schedule(true));shots.forEach(shot=>observer.observe(shot.viewport));}
  schedule(true);
}
