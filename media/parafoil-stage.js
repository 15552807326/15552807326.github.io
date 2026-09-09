import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const status=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,model,active='airdrop',view='full',paused=reduced.matches,visible=window===parent;
let yaw=.48,targetYaw=.48,pitch=.16,targetPitch=.16,started=performance.now(),last=0;
let dragging=false,lastX=0,lastY=0,loaded=new Map(),requestToken=0;
const target=new THREE.Vector3(),desiredTarget=new THREE.Vector3();
let distance=20,desiredDistance=20;
function motionLabel(){const b=document.querySelector('#motion');b.textContent=paused?'▶':'Ⅱ';b.setAttribute('aria-label',paused?'播放镜头动画':'暂停镜头动画');b.setAttribute('aria-pressed',String(paused));}
function frameView(immediate=false){
  const aspect=innerWidth/innerHeight;
  const fit= Math.max(8.8/(2*Math.tan(THREE.MathUtils.degToRad(28)/2)),8.8/(2*Math.tan(THREE.MathUtils.degToRad(28)/2)*aspect));
  if(view==='full'){desiredTarget.set(0,0.15,0);desiredDistance=fit*1.16;targetPitch=.11;targetYaw=.43;}
  if(view==='canopy'){desiredTarget.set(0,3.0,0);desiredDistance=fit*.61;targetPitch=.20;targetYaw=.48;}
  if(view==='payload'){desiredTarget.set(0,-2.65,0);desiredDistance=fit*.38;targetPitch=.10;targetYaw=.52;}
  if(immediate){distance=desiredDistance;target.copy(desiredTarget);}
}
async function loadModel(which){
  const token=++requestToken;
  status.classList.remove('error');status.textContent='正在切换三维模型';
  try{
    let object=loaded.get(which);
    if(!object){
      const gltf=await new GLTFLoader().loadAsync(`/media/parafoil-${which}.glb`);
      object=gltf.scene;
      const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
      object.position.sub(center);
      const wrapper=new THREE.Group();wrapper.add(object);
      wrapper.scale.setScalar(8.77/Math.max(size.x,size.y));
      wrapper.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.frustumCulled=true;
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        for(const material of materials){
          material.envMapIntensity=.88;
          if(/FABRIC/i.test(material.name)){material.metalness=.72;material.roughness=.34;material.envMapIntensity=.9;}
          if(/cord|绳|binding/i.test(material.name)){material.envMapIntensity=1.15;}
        }
      });
      object=wrapper;loaded.set(which,object);
    }
    if(token!==requestToken)return;
    if(model)scene.remove(model);
    model=object;active=which;scene.add(model);frameView(true);
    for(const button of document.querySelectorAll('[data-model]'))button.setAttribute('aria-pressed',String(button.dataset.model===which));
    const fallback=document.querySelector('#fallback');fallback.src=`/media/${which}-studio-poster.png`;fallback.alt=which==='airdrop'?'钛银空投翼伞三维外观渲染':'钛银动力翼伞三维外观渲染';
    document.body.classList.add('ready');status.textContent=which==='airdrop'?'空投翼伞':'动力翼伞';
    document.body.dataset.model=which;
  }catch(error){if(token!==requestToken)return;status.textContent=model?'切换未完成，保留当前模型':'三维暂不可用，已保留静态预览';status.classList.add('error');console.error('Parafoil model load failed',error);}
}
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
  renderer.setClearColor(0x000000,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.domElement.setAttribute('aria-label','可拖动的钛银翼伞三维模型');renderer.domElement.tabIndex=0;
  document.body.insertBefore(renderer.domElement,document.body.firstChild);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(28,innerWidth/innerHeight,.1,100);
  const env=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);const envTarget=pmrem.fromScene(env,.04);scene.environment=envTarget.texture;env.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc7d7f0,0x111112,.24));
  function light(color,power,pos){const l=new THREE.DirectionalLight(color,power);l.position.set(...pos);scene.add(l);}
  light(0xf2f5ff,3.0,[3,7,7]);light(0xa8caff,2.4,[-6,3,-5]);light(0xffffff,2.0,[6,4,-2]);light(0xa1b1c7,.35,[-4,0,5]);
  motionLabel();frameView(true);loadModel('airdrop');
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')return;dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!dragging)return;targetYaw+=(event.clientX-lastX)*.007;targetPitch=THREE.MathUtils.clamp(targetPitch+(event.clientY-lastY)*.004,-.35,.60);lastX=event.clientX;lastY=event.clientY;});
  canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
  // Horizontal one-finger drag rotates; vertical gestures continue to scroll the page.
  let touchX,touchY,gesture=false;
  canvas.addEventListener('touchstart',event=>{if(event.touches.length!==1)return;touchX=lastX=event.touches[0].clientX;touchY=lastY=event.touches[0].clientY;gesture=false;},{passive:true});
  canvas.addEventListener('touchmove',event=>{if(event.touches.length!==1)return;const t=event.touches[0];if(!gesture&&Math.abs(t.clientX-touchX)>Math.abs(t.clientY-touchY)+6)gesture=true;if(gesture){targetYaw+=(t.clientX-lastX)*.008;lastX=t.clientX;}},{passive:true});
  canvas.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();targetYaw+=event.key==='ArrowLeft'?-.25:.25;}if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();targetPitch=THREE.MathUtils.clamp(targetPitch+(event.key==='ArrowUp'?.1:-.1),-.35,.6);}});
  document.querySelector('#motion').addEventListener('click',()=>{paused=!paused;motionLabel();});
  document.querySelectorAll('[data-model]').forEach(b=>b.addEventListener('click',()=>loadModel(b.dataset.model)));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));frameView();}));
  addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();frameView(true);});
  addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='stage-visibility'){visible=Boolean(event.data.visible);document.body.dataset.visible=String(visible);}});
  parent.postMessage({type:'stage-ready'},location.origin);
  document.addEventListener('visibilitychange',()=>{last=0;});
  reduced.addEventListener('change',()=>{paused=reduced.matches;motionLabel();});
  function animate(now){requestAnimationFrame(animate);if(!visible||document.hidden||now-last<1000/30)return;last=now;
    const progress=(now-started)/1000;
    yaw=THREE.MathUtils.lerp(yaw,targetYaw,paused?1:.045);pitch=THREE.MathUtils.lerp(pitch,targetPitch,.05);
    target.lerp(desiredTarget,reduced.matches?1:.05);distance=THREE.MathUtils.lerp(distance,desiredDistance,reduced.matches?1:.05);
    const orbit=paused||dragging?0:Math.sin(progress*.20)*.14;
    camera.position.set(Math.sin(yaw+orbit)*distance,Math.sin(pitch)*distance,Math.cos(yaw+orbit)*distance);camera.position.add(target);camera.lookAt(target);
    renderer.render(scene,camera);
  }requestAnimationFrame(animate);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();document.body.classList.remove('ready');status.textContent='已切换至静态预览';});
}catch(error){status.textContent='已为此设备显示静态预览';console.warn('WebGL unavailable',error);}
