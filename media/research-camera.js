import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Original Blender geometry, not a textured plane. Scroll drives a perspective dolly + orbit.
const requested=new URLSearchParams(location.search).get('shot');
const kind=['landing','formation'].includes(requested)?requested:'fabric';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,model,progress=0,visible=false,queued=0,ready=false,presented=false,failed=false,contactOffset=-.1235;
const modelBase=new THREE.Vector3();
const formationMembers=[];
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const vector=a=>new THREE.Vector3(...a);
const notify=type=>parent.postMessage({type,shot:kind},location.origin);
function fail(){ready=false;presented=false;failed=true;notify('research-camera-failed');}
function queue(){if(!queued&&ready&&visible&&!document.hidden&&!reduced.matches)queued=requestAnimationFrame(render);}
function render(){
  queued=0;
  if(!ready||!visible||document.hidden||reduced.matches)return;
  try{
  if(renderer.getContext().isContextLost()){fail();return;}
  const aspect=innerWidth/Math.max(1,innerHeight);
  const fit=Math.max(15.3,13.8/aspect);
  if(kind==='fabric'){
    const t=smooth((progress-.03)/.89);
    // Slide along the upper skin, arc across the leading edge, then reveal half the canopy.
    const path=new THREE.CatmullRomCurve3([
      vector([2.10,5.10,1.55]),vector([2.35,5.45,2.5]),vector([3.30,5.70,4.5]),vector([4.30,5.40,6.40])
    ],false,'centripetal');
    camera.position.copy(path.getPoint(t));
    const target=vector([1.4933,4.1771,.3012]).lerp(vector([1.40,3.60,0]),t);
    if(aspect<1.25){camera.position.sub(target).multiplyScalar(1+(1.25/aspect-1)*t*.65).add(target);}
    camera.lookAt(target);camera.fov=35;
  }else if(kind==='landing'){
    // First an empty pad. Then the actual canopy/cargo geometry descends into the frame.
    const t=smooth((progress-.08)/.32);
    const path=new THREE.CatmullRomCurve3([
      vector([2.6,-3.25,4.2]),vector([3.4,-1.0,6.0]),vector([4.5,1.5,10.5]),vector([fit*.35,fit*.19,fit*.94])
    ],false,'centripetal');
    camera.position.copy(path.getPoint(t));
    const target=vector([0,-4.52,.10]).lerp(vector([0,-.30,0]),smooth(t));
    const overview=Math.sin(Math.PI*clamp((progress-.12)/.78));
    camera.position.sub(target).multiplyScalar(1+.30*overview).add(target);
    target.y+=overview*1.0;
    camera.lookAt(target);camera.fov=38;
    const descent=clamp((progress-.14)/.74);
    const altitude=contactOffset+(14-contactOffset)*(1-descent)*(1-descent);
    const lateral=.9*Math.sin(Math.PI*descent)*(1-descent);
    model.position.copy(modelBase).add(vector([lateral,altitude,.35*Math.sin(Math.PI*descent)*(1-descent)]));
    model.rotation.z=.024*Math.sin(descent*Math.PI*2)*(1-descent);
    document.body.dataset.landingPhase=descent===0?'empty-platform':descent===1?'touchdown':'descending';
    document.body.dataset.payloadClearance=Math.max(0,altitude-contactOffset).toFixed(4);
  }else{
    const widen=smooth((progress-.18)/.65);
    const portrait=aspect<1.1;
    const distance=THREE.MathUtils.lerp(fit,portrait?Math.max(24,27/aspect):Math.max(26,39/aspect),widen);
    camera.position.set(distance*.12,distance*.12,distance);camera.lookAt(0,portrait?widen:.1,0);camera.fov=38;
    model.position.copy(modelBase);if(portrait)model.position.y-=.65*widen;
    // The leader remains continuous; two additional models follow staggered 3D ingress paths.
    formationMembers.forEach((wing,i)=>{
      const enter=clamp((progress-(i===0?.18:.40))/.44),t=smooth(enter),side=i===0?-1:1;
      wing.visible=enter>0;
      wing.position.copy(modelBase).add(vector([side*THREE.MathUtils.lerp(18,portrait?4.8:7.8,t),THREE.MathUtils.lerp(3.2,portrait?2.6:i===0?.7:1.0,t),THREE.MathUtils.lerp(-9,i===0?-3.3:-4.6,t)]));
      wing.rotation.z=side*.10*Math.sin(Math.PI*t);wing.rotation.y=-side*.13*(1-t);
    });
    document.body.dataset.formationCount=String(1+formationMembers.filter(wing=>wing.visible).length);
  }
  camera.aspect=aspect;camera.updateProjectionMatrix();renderer.render(scene,camera);
  document.body.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(3)).join(',');
  document.body.dataset.progress=progress.toFixed(4);
  if(!presented){presented=true;notify('research-camera-ready');}
  }catch(error){fail();console.warn('Research camera render failed',error);}
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);queue();}
function keyLight(color,power,position){const light=new THREE.DirectionalLight(color,power);light.position.set(...position);scene.add(light);return light;}
async function init(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fail();});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x000000,1);
    renderer.shadowMap.enabled=kind!=='formation';renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=kind==='landing';renderer.shadowMap.needsUpdate=true;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
    renderer.domElement.setAttribute('aria-label',({'fabric':'真实三维伞衣表面与气室','landing':'翼伞下降并着陆的三维场景','formation':'单伞扩展至三伞编队的三维场景'})[kind]);
    document.body.append(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.035,150);
    const environment=new THREE.Scene();environment.background=new THREE.Color(.006,.007,.009);
    for(const [w,h,position,power] of [[9,5,[-3,7,4],2],[2,10,[6,4,-3],3.2],[5,5,[-4,1,7],.45],[12,2,[0,9,-2],2.2]]){
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power,power),side:THREE.DoubleSide}));panel.position.set(...position);panel.lookAt(0,2,0);environment.add(panel);
    }
    if(kind!=='fabric'){
      const cargoStrip=new THREE.Mesh(new THREE.PlaneGeometry(2,8),new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.3,2.5),side:THREE.DoubleSide}));cargoStrip.position.set(4,-2,5);cargoStrip.lookAt(0,-2,0);environment.add(cargoStrip);
    }
    const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(environment,.015);
    scene.environment=env.texture;environment.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xd8e5f6,0x111116,.08));
    const key=keyLight(0xf1f5ff,1.3,[1,8,6]);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.camera.near=.1;key.shadow.camera.far=30;key.shadow.normalBias=.018;key.shadow.bias=-.00008;
    keyLight(0xb6d2fa,.45,[-6,5,-4]);keyLight(0xffffff,.9,[7,5,-1]);keyLight(0xabb8ca,.10,[-3,-1,5]);
    if(kind!=='fabric')keyLight(0xd0e1f5,.65,[-3,-3,6]);
    const gltf=await new GLTFLoader().loadAsync('/media/parafoil-airdrop.glb');
    if(failed||renderer.getContext().isContextLost()){fail();return;}
    model=gltf.scene;
    const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());model.position.sub(center);modelBase.copy(model.position);
    contactOffset=-4.5075-(box.min.y-center.y);
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.castShadow=true;mesh.receiveShadow=true;
      for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        mat.envMapIntensity=.80;
        if(/suspension cord|riser cord/i.test(mat.name)){mat.color.setRGB(.16,.18,.21);mat.emissive.setRGB(.045,.055,.070);mat.metalness=.25;mat.roughness=.42;}
        if(/cell ribs/i.test(mat.name)){mat.color.setRGB(.055,.060,.070);mat.envMapIntensity=.18;mat.roughness=.6;}
        if(/FABRIC/.test(mat.name)){
          mat.color.setRGB(.29,.31,.34);mat.metalness=.78;mat.roughness=.32;
          // Fine weave modulates the material in object space, with antialiasing at distance.
          mat.onBeforeCompile=shader=>{
            shader.vertexShader='varying vec3 vClothPosition;\nvarying vec3 vClothWorldNormal;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvClothWorldNormal=normalize(mat3(modelMatrix)*objectNormal);');
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClothPosition=position;');
            shader.fragmentShader='varying vec3 vClothPosition;\nvarying vec3 vClothWorldNormal;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
              vec2 thread=vClothPosition.xz*530.0;
              float aa=1.0-smoothstep(0.4,2.2,max(fwidth(thread.x),fwidth(thread.y)));
              float weave=sin(thread.x)*sin(thread.y);
              roughnessFactor=clamp(roughnessFactor+aa*weave*0.035,0.23,0.52);
            `);
            shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
              float cavity=mix(0.09,1.0,smoothstep(-0.15,0.62,normalize(vClothWorldNormal).y));
              reflectedLight.indirectDiffuse*=cavity;
              reflectedLight.indirectSpecular*=cavity;
            `);
          };
          mat.customProgramCacheKey=()=> 'research-cloth-weave-v2';
        }
      }
    });scene.add(model);
    if(kind==='formation'){
      for(let i=0;i<2;i++){const wing=model.clone(true);wing.visible=false;formationMembers.push(wing);scene.add(wing);}
    }
    if(kind==='landing'){
      const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.47,.055,96),new THREE.MeshStandardMaterial({color:0x111419,metalness:.75,roughness:.32}));
      pad.position.y=-4.54;pad.receiveShadow=true;scene.add(pad);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.39,.012,10,120),new THREE.MeshBasicMaterial({color:0xa7d8ff}));ring.rotation.x=Math.PI/2;ring.position.y=-4.505;scene.add(ring);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(1.44,.006,8,120),new THREE.MeshBasicMaterial({color:0x314c62}));rim.rotation.x=Math.PI/2;rim.position.y=-4.51;scene.add(rim);
      const bounce=new THREE.PointLight(0x9dcbff,2,5,2);bounce.position.set(0,-3.9,1.8);scene.add(bounce);
    }
    ready=true;resize();notify('research-camera-loaded');queue();
  }catch(error){console.warn('Research camera unavailable',error);fail();}
}
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='research-camera-state')return;
  if(failed){notify('research-camera-failed');return;}
  progress=clamp(Number(event.data.progress)||0);visible=Boolean(event.data.visible);
  if(presented&&event.data.requestReady)notify('research-camera-ready');
  queue();
});
addEventListener('resize',resize);document.addEventListener('visibilitychange',queue);reduced.addEventListener('change',queue);
if(!reduced.matches)init();else reduced.addEventListener('change',()=>{if(!reduced.matches&&!renderer)init();});
