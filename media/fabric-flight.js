// A single editorial cut, in the same sticky viewport as the original dolly.
// Scroll decides WHEN to cut; the clip itself runs at its native 25 fps.
function start(){
  const figure=document.querySelector('#research-motion-fabric');
  const clip=figure?.querySelector('#fabric-flight-clip');
  if(!clip)return;
  const viewport=figure.querySelector('.research-motion-viewport');
  const button=figure.querySelector('.fabric-flight-control');
  const label=button.querySelector('.fabric-flight-action');
  const reduced=matchMedia('(prefers-reduced-motion:reduce), (forced-colors:active)');
  const saveData=navigator.connection?.saveData===true;
  let near=false, posterRequested=false, posterReady=false, mediaReady=false, sourceSet=false;
  let gate=false, manual=false, held=false, blocked=false, finished=false, failed=false;
  let inside=false, sky=false, pending=false, frame=0;
  const state=(key,value)=>{if(figure.dataset[key]!==value)figure.dataset[key]=value;};
  clip.defaultMuted=true;clip.muted=true;clip.playsInline=true;
  function paint(){
    const key=failed?'retry':!sky?'model':finished?'ended':!clip.paused?'playing':'paused';
    state('filmState',key);
    const text=({model:'看伞衣近景',playing:'暂停片段',paused:'播放片段',ended:'重播片段',retry:'重试片段'})[key];
    if(label.textContent!==text){label.textContent=text;}
    button.setAttribute('aria-label',text+'：4 秒红白翼伞近景');
  }
  function poster(){
    if(posterRequested)return;
    posterRequested=true;
    const img=new Image();
    img.onload=()=>{clip.poster=clip.dataset.poster;posterReady=true;schedule();};
    img.src=clip.dataset.poster;
  }
  function load(){
    if(sourceSet)return;
    sourceSet=true;clip.preload='auto';clip.src=clip.dataset.src;clip.load();
  }
  function play(gesture){
    if(!gesture && (pending||blocked||failed||finished||held||clip.ended||!clip.paused))return;
    if(gesture){
      blocked=false;held=false;
      if(failed){failed=false;sourceSet=false;}
      if(finished||clip.ended){finished=false;clip.currentTime=0;}
    }
    load();pending=true;
    // Keep this synchronous on taps for inline Safari playback.
    clip.play().catch(err=>{
      if(err.name!=='AbortError'){blocked=true;if(err.name==='NotSupportedError')failed=true;}
    }).finally(()=>{pending=false;paint();});
  }
  function update(){
    frame=0;
    const canScroll=!reduced.matches && CSS.supports('position','sticky') &&
      parseFloat(figure.style.getPropertyValue('--shot-distance'))>0;
    state('filmScroll',canScroll?'on':'off');
    if(!near||document.hidden){
      if(!clip.paused)clip.pause();
      if(!near){manual=false;gate=false;}
      inside=false;return;
    }
    poster();
    const box=viewport.getBoundingClientRect(),vh=document.documentElement.clientHeight;
    const visible=Math.max(0,Math.min(box.bottom,vh)-Math.max(box.top,0));
    inside=visible>=Math.min(box.height*.34,vh*.30);
    if(!inside){manual=false;}
    if(canScroll){
      const d=parseFloat(figure.style.getPropertyValue('--shot-distance'));
      const top=parseFloat(figure.style.getPropertyValue('--shot-top'));
      const p=(top-figure.getBoundingClientRect().top)/d;
      // Hysteresis avoids recutting when the trackpad rests on the edit.
      if(p<.66){if(gate)manual=false;gate=false;}
      if(p>=.78)gate=true;
      if(!saveData&&inside&&p>.28&&!failed)load();
    }else{gate=false;}
    const want=manual||gate;
    sky=want&&!failed&&(posterReady||mediaReady);
    state('filmShot',sky?'sky':'model');
    if(!inside||!want||failed){if(!clip.paused)clip.pause();}
    else if(sky&&!reduced.matches&&!saveData)play(false);
    paint();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  const observer=new IntersectionObserver(entries=>{
    near=entries[0].isIntersecting;schedule();
  },{rootMargin:'500px 0px'});observer.observe(figure);
  new MutationObserver(schedule).observe(figure,{attributes:true,attributeFilter:['data-motion-ready']});
  if('ResizeObserver' in window)new ResizeObserver(schedule).observe(viewport);
  for(const name of ['scroll','resize','pageshow'])addEventListener(name,()=>{if(near)schedule();},{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)clip.pause();else schedule();
  });
  addEventListener('pagehide',()=>clip.pause());
  reduced.addEventListener('change',()=>{manual=false;gate=false;clip.pause();schedule();});
  clip.addEventListener('loadeddata',()=>{mediaReady=true;schedule();});
  clip.addEventListener('play',paint);clip.addEventListener('pause',paint);
  clip.addEventListener('ended',()=>{finished=true;paint();});
  clip.addEventListener('error',()=>{failed=true;schedule();});
  button.addEventListener('click',()=>{
    if(sky&&!clip.paused&&!clip.ended){held=true;clip.pause();paint();return;}
    manual=true;near=true;inside=true;poster();
    // The button is an explicit request even in reduced motion/data-saver.
    if(posterReady||mediaReady){sky=true;state('filmShot','sky');}
    play(true);schedule();
  });
  button.hidden=false;schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
