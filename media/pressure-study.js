function initPressureStudy(){
  const cover=document.querySelector('.pressure-study-cover');
  if(!cover)return;
  const buttons=[...cover.querySelectorAll('button[data-pressure-select]')];
  function select(b){
    cover.dataset.focus=b.dataset.pressureSelect;
    for(const item of buttons)item.setAttribute('aria-pressed',String(item===b));
  }
  for(const [i,b] of buttons.entries()){
    b.addEventListener('click',()=>select(b));
    b.addEventListener('keydown',e=>{
      let target;
      if(e.key==='Home')target=buttons[0];
      else if(e.key==='End')target=buttons.at(-1);
      else if(e.key==='ArrowRight')target=buttons[(i+1)%buttons.length];
      else if(e.key==='ArrowLeft')target=buttons[(i+buttons.length-1)%buttons.length];
      else return;
      e.preventDefault();target.focus();select(target);
    });
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPressureStudy,{once:true});else initPressureStudy();
