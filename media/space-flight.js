import * as THREE from './three-vendor/build/three.module.min.js';
import { GLTFLoader } from './space-vendor/GLTFLoader.js';
import { RoomEnvironment } from './space-vendor/RoomEnvironment.js';

// The same editable silver parafoil used on the homepage, not a stock spaceship.
export async function createFlight(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .76;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 160);
  camera.position.set(0,.15,10);
  camera.lookAt(0,0,0);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(environment,.04);
  scene.environment = envTarget.texture;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0x8babdb,0x030509,.16));
  function light(color,power,x,y,z) { const l=new THREE.DirectionalLight(color,power);l.position.set(x,y,z);scene.add(l); }
  light(0xffe2bd,2.5,-7,5,3);
  light(0x719bd8,2.0,5,2,-4);
  light(0xb0d8ff,.5,-3,-1,-4);
  light(0xcadfff,.38,4,-1,6);
  let model, disposed=false;
  function dispose() {
    if(disposed)return; disposed=true;
    const geometries=new Set(), materials=new Set(), textures=new Set();
    model?.traverse(object=>{if(!object.isMesh)return;geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose());
    envTarget.dispose(); renderer.dispose();
  }
  try {
    const gltf=await new GLTFLoader().loadAsync('/media/parafoil-powered.glb');
    const bounds=new THREE.Box3().setFromObject(gltf.scene);
    const center=bounds.getCenter(new THREE.Vector3());
    const size=bounds.getSize(new THREE.Vector3());
    gltf.scene.position.sub(center);
    model=new THREE.Group();model.add(gltf.scene);scene.add(model);
    const factor=3.8/Math.max(size.x,size.y);
    gltf.scene.scale.setScalar(factor);
    gltf.scene.position.multiplyScalar(factor);
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]) {
        m.envMapIntensity=.48;
        if(/FABRIC/i.test(m.name)){m.color.setRGB(.30,.33,.39);m.metalness=.74;m.roughness=.34;}
        if(/cord/i.test(m.name)){m.color.setRGB(.12,.16,.23);m.metalness=.35;}
      }
    });
    function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
    const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
    function render(t){
      if(disposed)return;
      const away=smooth(.1,2.1,t),far=smooth(1.55,4.0,t);
      const fit=Math.min(1,camera.aspect*1.55);
      const lateralFit=camera.aspect<.8?.25:1;
      model.position.set((-1.80*(1-away)+Math.sin(t*1.1)*.24*(1-far))*fit*lateralFit, -.55*(1-away)+.10*Math.sin(away*Math.PI), -away*4-far*24);
      model.rotation.set(.18+Math.sin(t*.9)*.06, Math.PI-.62+away*.71, -.20*Math.sin(Math.PI*away)+.04*(1-away));
      model.scale.setScalar(fit*(.87-.30*smooth(2.9,4.0,t)));
      model.visible=t<4.02;
      // Last approach vanishes into the landing point before the page opens there.
      canvas.style.opacity=String(1-smooth(3.62,4.01,t));
      renderer.render(scene,camera);
    }
    resize();
    return {render,resize,dispose};
  } catch(error) {dispose();throw error;}
}
