import * as THREE from './vendor/three.module.js';
import {unitArt} from './red-hats-art.js';
import {roomBoxes,traceShot,SHOT_PRESETS} from './hybrid-geometry.js';
const $=id=>document.getElementById(id),host=$('scene');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){$('status').textContent='This test needs WebGL 2. Try hardware acceleration in your browser.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x172520);renderer.outputColorSpace=THREE.SRGBColorSpace;host.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(),focus=new THREE.Vector3(0,.5,-.5);
scene.add(new THREE.HemisphereLight(0xfff3d8,0x52634d,2.3));const sun=new THREE.DirectionalLight(0xffe2ac,2);sun.position.set(-4,9,5);scene.add(sun);
let azimuth=Math.PI/4,elevation=Math.atan(.5*Math.sqrt(2)),zoom=1;
function resize(){const w=host.clientWidth,h=host.clientHeight,span=10/zoom;renderer.setSize(w,h);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;camera.near=.1;camera.far=80;camera.position.copy(focus).add(new THREE.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(18));camera.lookAt(focus);camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(host);
const manager=new THREE.LoadingManager();manager.onLoad=()=>$('status').textContent='Artwork loaded · 1 unit = 1 tile';manager.onError=url=>$('status').textContent='Could not load '+url;
const loader=new THREE.TextureLoader(manager),textureCache=new Map();
function texture(src){if(!textureCache.has(src)){const t=loader.load(src);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();textureCache.set(src,t);}return textureCache.get(src);}
const grass=texture('../assets/environment/ground-grass.png');grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(10,10);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,11),new THREE.MeshStandardMaterial({map:grass,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-.025,-.5);scene.add(floor);
const concrete=texture('../assets/environment/ground-concrete.png');concrete.wrapS=concrete.wrapT=THREE.RepeatWrapping;concrete.repeat.set(6,4);
const slab=new THREE.Mesh(new THREE.BoxGeometry(6,.08,4),new THREE.MeshStandardMaterial({map:concrete,roughness:1}));slab.position.set(0,-.03,-2);scene.add(slab);
const grid=new THREE.GridHelper(12,12,0xa6b489,0x738461);grid.position.y=.016;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
const brick=texture('../assets/environment/wall-brick.png');
const brickMaterial=new THREE.MeshStandardMaterial({map:brick,roughness:1,color:0xe3ccb0});
const walls=new THREE.Group(),bounds=new THREE.Group();scene.add(walls,bounds);
let boxes=[],lane=-1.5,shot=null,shotTime=0;
function rebuild(){
 for(const group of [walls,bounds]){for(const c of [...group.children]){group.remove(c);c.geometry?.dispose();if(group===bounds||c.material!==brickMaterial)c.material.dispose();}}
 boxes=roomBoxes({doorClosed:$('door').checked,roof:$('roof').checked});
 for(const b of boxes){
  const g=new THREE.BoxGeometry(...b.size),uv=g.attributes.uv;
  // Sample the existing wall's front parallelogram into flat block faces.
  for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,(170+u*970)/1280,1-(1175-u*520-v*480)/1280);}
  const special=b.name==='Roof'||b.name==='Closed door';
  const material=special?new THREE.MeshStandardMaterial({color:b.name==='Roof'?0x54635b:0x805f39,roughness:1}):brickMaterial;
  const m=new THREE.Mesh(g,material);m.position.fromArray(b.center);walls.add(m);
  const wire=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:0xf0c879,depthTest:false,transparent:true,opacity:.6}));wire.position.copy(m.position);bounds.add(wire);
 }
 bounds.visible=$('colliders').checked;clearShot();
}
const actors=[];
function actor(species,outfit,z,flip){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({transparent:true,alphaTest:.15,side:THREE.DoubleSide,depthWrite:true}));
 m.position.set(lane,0,z);scene.add(m);const a={m,species,outfit,z,flip};actors.push(a);return a;
}
actor('horse','normal',2.4,false);actor('cow','red-hats',-2.2,true);
function updateActors(){const stature=+$('scale').value,stance=$('stance').value;
 for(const a of actors){const f=unitArt({species:a.species,outfit:a.outfit,weapon:'rifle',stance});a.m.material.map=texture(f.src);a.m.material.needsUpdate=true;const scale=stature/236;a.m.scale.set(f.width*scale*(a.flip?-1:1),f.height*scale,1);a.offset=(f.anchor[1]-f.height/2)*scale;a.planeHeight=f.height*scale;}
 $('scale-value').textContent=stature.toFixed(2);clearShot();
}
const markerMaterial=new THREE.MeshBasicMaterial({color:0xffd686}),bullet=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),markerMaterial);bullet.visible=false;scene.add(bullet);
const targetBounds=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.45,1, .4)),new THREE.LineBasicMaterial({color:0x86c9cd}));scene.add(targetBounds);
let line=null;
function clearShot(){shot=null;bullet.visible=false;if(line){scene.remove(line);line.geometry.dispose();line.material.dispose();line=null;}$('result').textContent='Choose a path, then fire.';}
function targetBox(){const height=+$('scale').value*({standing:1,kneeling:.7,prone:.28}[$('stance').value]);return {name:'Target',min:[lane-.225,0,-2.4],max:[lane+.225,height,-2],center:[lane,height/2,-2.2],size:[.45,height,.4]};}
function fire(){
 clearShot();const y=+$('height').value,start=[lane,y,2.2],end=[lane,y,-3.8],hit=traceShot(start,end,[...boxes,targetBox()]),point=hit?.point||end;
 shot={start,point,hit};shotTime=performance.now();const color=hit?.name==='Target'?0x91d7b1:hit?0xf0a05f:0x9ec4de;
 line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start),new THREE.Vector3(...point)]),new THREE.LineBasicMaterial({color}));scene.add(line);
 $('result').textContent=hit?.name==='Target'?'CLEAR — shot reached the target.':hit?'BLOCKED — '+hit.name+'.':'CLEAR — shot passed above the target.';
 $('result').style.color='#'+color.toString(16).padStart(6,'0');
}
for(const [id,p] of Object.entries(SHOT_PRESETS)){const b=document.createElement('button');b.textContent=p.label;b.dataset.preset=id;b.setAttribute('aria-pressed',id==='door');b.onclick=()=>{lane=p.x;$('height').value=p.height;$('height-value').textContent=p.height.toFixed(2);for(const other of $('presets').children)other.setAttribute('aria-pressed',other===b);updateActors();};$('presets').append(b);}
$('fire').onclick=fire;$('height').oninput=()=>{$('height-value').textContent=(+$('height').value).toFixed(2);clearShot();};
$('door').onchange=$('roof').onchange=rebuild;$('colliders').onchange=()=>bounds.visible=$('colliders').checked;
$('scale').oninput=$('stance').onchange=updateActors;
$('reset').onclick=()=>{azimuth=Math.PI/4;elevation=Math.atan(.5*Math.sqrt(2));zoom=1;resize();};
let drag=null;renderer.domElement.onpointerdown=e=>{drag=[e.clientX,e.clientY];renderer.domElement.setPointerCapture(e.pointerId);};
renderer.domElement.onpointermove=e=>{if(!drag)return;azimuth-=(e.clientX-drag[0])*.007;elevation=THREE.MathUtils.clamp(elevation+(e.clientY-drag[1])*.005,.15,1.25);drag=[e.clientX,e.clientY];resize();};
renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>drag=null;
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.6,2.5);resize();},{passive:false});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();fire();}});
rebuild();updateActors();resize();
renderer.setAnimationLoop(now=>{
 for(const a of actors){a.m.quaternion.copy(camera.quaternion);a.m.scale.y=a.planeHeight*Math.cos(elevation);a.m.position.set(lane,0,a.z).add(new THREE.Vector3(0,a.offset*Math.cos(elevation),0).applyQuaternion(camera.quaternion));}
 const target=targetBox();targetBounds.position.fromArray(target.center);targetBounds.scale.y=target.size[1];targetBounds.visible=$('colliders').checked;
 if(shot){const t=Math.min((now-shotTime)/600,1);bullet.visible=true;bullet.position.fromArray(shot.start.map((v,i)=>v+(shot.point[i]-v)*t));}
 renderer.render(scene,camera);
});
