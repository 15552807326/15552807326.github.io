function start(){
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
