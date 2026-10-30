import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// The Blender-built objects share one continuous space.
// Scroll moves a real camera from a two-dimensional training section,
// through the numerical policy, to a complete parafoil mesh further into the scene.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = v => Math.max(0, Math.min(1, v));
const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const smooth = (a, b, value) => ease((value - a) / (b - a));
const vector = values => new THREE.Vector3(...values);
const standalone = parent === window;
let progress = standalone ? clamp(Number(new URLSearchParams(location.search).get('progress')) || 0) : 0;
let visible = standalone, ready = false, presented = false, failed = false, queued = 0;
let renderer, scene, camera, asset, environmentTarget;
const groups = {}, materialGroups = {};
const captions = [...document.querySelectorAll('.scene-caption')];
const counters = [...document.querySelectorAll('.scene-count span')];
const bars = [...document.querySelectorAll('.scene-steps i')];
const paths = {
  desktop: {
    camera: [[.2,.65,6.5],[5.5,4.5,15.5],[8.5,2.4,-2.8],[3.6,5,-3],[2.6,12.3,-8.5]],
    target: [[0,-.15,0],[2.4,-.1,-4],[5.5,.1,-11],[0,-.5,-27],[0,-.55,-29]],
  },
  mobile: {
    camera: [[.25,.7,11.7],[6.2,4.6,18],[7.7,1.7,-2.8],[3.2,4.1,-1.6],[1.0,11.7,-8.3]],
    target: [[.15,-.15,0],[2.3,-.15,-4],[5.5,.1,-11],[0,-.55,-26],[0,-.65,-29]],
  },
};
for (const path of Object.values(paths)) {
  path.camera = new THREE.CatmullRomCurve3(path.camera.map(vector), false, 'centripetal');
  path.target = new THREE.CatmullRomCurve3(path.target.map(vector), false, 'centripetal');
}
function notify(type) { if (!standalone) parent.postMessage({type, shot:'solver'}, location.origin); }
function fail(error) {
  if (failed) return;
  failed = true; ready = false;
  document.body.dataset.failed = 'true';
  notify('research-camera-failed');
  if (error) console.warn('Blender numerical scene unavailable', error);
}
function queue() {
  if (ready && visible && !failed && !document.hidden && !reduced.matches && !queued) queued=requestAnimationFrame(render);
}
function keyLight(color, power, position) {
  const light=new THREE.DirectionalLight(color,power);
  light.position.set(...position); light.target.position.set(4,.5,-4);
  scene.add(light,light.target);
}
function prepareMaterials(groupName, group) {
  const materials=[];
  group.traverse(mesh=>{
    if (!mesh.isMesh && !mesh.isLine) return;
    mesh.frustumCulled=true;
    const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const copies=originals.map(original=>{
      const mat=original.clone();
      mat.userData.baseOpacity=mat.opacity;
      mat.userData.baseEmissiveIntensity=mat.emissiveIntensity??0;
      if ('envMapIntensity' in mat) mat.envMapIntensity=1.05;
      // Preserve the Blender mesh materials; do not restore a filled fabric surface.
      // Light the main subject without hiding or introducing geometry at phase boundaries.
      const attention={value:1};mat.userData.attention=attention;
      const prepare=mat.onBeforeCompile;
      mat.onBeforeCompile=shader=>{
        prepare.call(mat,shader);
        shader.uniforms.uAttention=attention;
        shader.fragmentShader='uniform float uAttention;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor.rgb*=uAttention;\n#include <dithering_fragment>');
      };
      mat.customProgramCacheKey=()=> 'blender-solver-attention-'+groupName+'-'+mat.name;
      materials.push(mat); return mat;
    });
    mesh.material=Array.isArray(mesh.material)?copies:copies[0];
  });
  materialGroups[groupName]=materials;
}
async function init() {
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setClearColor(0x000000,1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.94;
    renderer.domElement.setAttribute('aria-label','由二维训练剖面拉开至数值策略，再推近远处完整翼伞网格的连续三维镜头');
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fail();});
    document.body.prepend(renderer.domElement);
    scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(36,1,.025,130);
    const studio=new THREE.Scene(); studio.background=new THREE.Color(.006,.008,.011);
    for (const [w,h,position,power] of [[12,4,[-3,8,5],3],[2,11,[8,4,-3],3.1],[12,2,[0,6,-5],2.4],[4,7,[-8,3,4],.7],[5,6,[12,7,-10],2.4]]) {
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power,power),side:THREE.DoubleSide}));
      panel.position.set(...position); panel.lookAt(2,0,-3); studio.add(panel);
    }
    const pmrem=new THREE.PMREMGenerator(renderer);
    environmentTarget=pmrem.fromScene(studio,.015); scene.environment=environmentTarget.texture;
    studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xd6e8ff,0x12151b,.25));
    keyLight(0xf3f8ff,1.75,[-2,8,9]);keyLight(0x8fc3e9,.8,[14,6,-8]);keyLight(0xffffff,1.1,[-8,5,-4]);
    const gltf=await new GLTFLoader().loadAsync('/media/rl-solver-blender-scene.glb?v=eb9da6fd');
    if (failed) return;
    asset=gltf.scene;scene.add(asset);
    for (const name of ['TrainingSection','Policy','FullParafoil']) {
      const group=asset.getObjectByName(name);
      if (!group) throw new Error('Missing Blender scene group: '+name);
      groups[name]=group;prepareMaterials(name,group);
    }
    document.body.dataset.sceneSource='blender-glb';
    document.body.dataset.groupCount=String(Object.keys(groups).length);
    if(groups.FullParafoil.userData.representation!=='computational-mesh') throw new Error('Expected the parafoil mesh asset');
    document.body.dataset.fullParafoilMode=groups.FullParafoil.userData.representation;
    document.body.dataset.fullParafoilCenter=new THREE.Box3().setFromObject(groups.FullParafoil).getCenter(new THREE.Vector3()).toArray().map(n=>n.toFixed(3)).join(',');
    ready=true;resize();notify('research-camera-loaded');queue();
  } catch(error) { fail(error); }
}
function render() {
  queued=0;
  if (!ready||!visible||failed||document.hidden||reduced.matches) return;
  try {
    if (renderer.getContext().isContextLost()) {fail();return;}
    const p=progress,aspect=innerWidth/Math.max(1,innerHeight),portrait=aspect<1.25;
    const path=portrait?paths.mobile:paths.desktop;
    // Smooth global timing and centripetal splines keep both position and gaze continuous.
    const t=ease(p);
    camera.position.copy(path.camera.getPoint(t));
    const target=path.target.getPoint(t);
    if(portrait&&aspect<.9) camera.position.sub(target).multiplyScalar(1+(.9/aspect-1)*.5).add(target);
    camera.lookAt(target);camera.aspect=aspect;camera.fov=36;camera.updateProjectionMatrix();
    const enterSecond=smooth(.23,.39,p),enterThird=smooth(.66,.81,p);
    const weights=[1-enterSecond,enterSecond*(1-enterThird),enterThird];
    ['TrainingSection','Policy','FullParafoil'].forEach((name,i)=>{
      const base=.001;
      for(const mat of materialGroups[name]) mat.userData.attention.value=base+(1-base)*weights[i];
    });
    captions.forEach((caption,i)=>{
      caption.style.opacity=String(weights[i]);
      caption.style.transform='translateY('+((1-weights[i])*5).toFixed(2)+'px)';
      caption.setAttribute('aria-hidden',weights[i]<.5?'true':'false');
    });
    counters.forEach((counter,i)=>{counter.style.opacity=String(weights[i]);});
    bars.forEach((bar,i)=>{bar.style.transform='scaleX('+clamp(p*3-i)+')';});
    const phase=p<.31?'training':p<.735?'policy':'full-parafoil';
    document.body.dataset.phase=phase;document.body.dataset.progress=p.toFixed(4);
    document.body.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(4)).join(',');
    document.body.dataset.cameraTarget=target.toArray().map(n=>n.toFixed(4)).join(',');
    document.body.dataset.captionWeights=weights.map(n=>n.toFixed(3)).join(',');
    renderer.render(scene,camera);
    if(!presented){presented=true;notify('research-camera-ready');}
  } catch(error){fail(error);}
}
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight,false);queue();}
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='research-camera-state')return;
  if(failed){notify('research-camera-failed');return;}
  progress=clamp(Number(event.data.progress)||0);visible=Boolean(event.data.visible);
  if(presented&&event.data.requestReady)notify('research-camera-ready');
  queue();
});
addEventListener('resize',resize);document.addEventListener('visibilitychange',queue);
reduced.addEventListener('change',()=>{if(!reduced.matches&&!renderer)init();else queue();});
addEventListener('pagehide',()=>{if(queued)cancelAnimationFrame(queued);queued=0;visible=false;});
if(!reduced.matches)init();
