function initPressureStudy(){
  const cover=document.querySelector('.pressure-study-cover');
  const control=cover?.querySelector('button.ps-cycle');
  if(!control)return;
  const zones=[['warm','暖色核心'],['cool','冷色过渡'],['edge','折面边缘']];
  let current=zones.findIndex(([id])=>id===cover.dataset.focus);
  function select(index){
    current=(index+zones.length)%zones.length;
    const [id,name]=zones[current];
    cover.dataset.focus=id;
    control.setAttribute('aria-label','切换压力云图局部，当前：'+name);
  }
  control.addEventListener('click',()=>select(current+1));
  control.addEventListener('keydown',event=>{
    const keys={ArrowLeft:current-1,ArrowRight:current+1,Home:0,End:zones.length-1};
    if(!Object.hasOwn(keys,event.key))return;
    event.preventDefault();select(keys[event.key]);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPressureStudy,{once:true});else initPressureStudy();
