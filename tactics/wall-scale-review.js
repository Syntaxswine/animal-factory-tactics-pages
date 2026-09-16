import {DOOR_ART} from './door-art.js';
// Diagnostic snapshot of environment-renderer.js calibration and app.js actor size.
// Kept independent of the in-progress gameplay integration; never changes game state.
const crops={'wall-concrete':[75,143,1211,1176],'wall-brick':[62,96,1206,1210],'wall-corrugated':[154,51,1130,1214],'window-brick':[36,16,1221,1242],'window-concrete':[113,56,1175,1219],'window-corrugated':[81,9,1172,1240],'door-steel-closed':[122,27,1137,1211],'door-wood-closed':[157,22,1099,1232],'doorway-concrete-open':[116,66,1144,1200]};
const baselines={'wall-concrete':[139,1175,1185,578,415],'wall-brick':[143,1209,1200,634,510],'wall-corrugated':[193,1213,1095,746,670],'window-brick':[95,1241,1210,847,785],'window-concrete':[176,1218,1135,808,720],'window-corrugated':[131,1239,1128,846,805],'door-steel-closed':[179,1210,1095,776,715],'door-wood-closed':[220,1231,1075,820,745],'doorway-concrete-open':[188,1199,1095,771,690]};
const $=id=>document.getElementById(id),images=new Map();
function image(src){if(!images.has(src)){const img=new Image();img.onload=draw;img.onerror=()=>{$('status').textContent='Could not load '+src;};img.src=src;images.set(src,img);}return images.get(src);}
function ready(img){return img.complete&&img.naturalWidth>0;}
function ruler(c,x,y,height,color,label){c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x,y-height);for(const yy of [y,y-height]){c.moveTo(x-5,yy);c.lineTo(x+5,yy);}c.stroke();c.font='14px system-ui';c.fillText(label,x+8,y-height/2);}
function scene(canvas,height,redesigned=false){const c=canvas.getContext('2d'),z=4,ox=240,oy=448,p=(x,y)=>({x:ox+(x-y)*28*z,y:oy+(x+y)*14*z});c.clearRect(0,0,480,530);
 const floor=image('../assets/environment/ground-concrete.png');if(ready(floor)){c.save();c.setTransform(28*z/floor.width,14*z/floor.height,-28*z/floor.width,14*z/floor.height,ox,oy-14*z);c.drawImage(floor,0,0);c.restore();}
 c.strokeStyle='#c3be9177';c.beginPath();c.moveTo(ox,oy-56);c.lineTo(ox+112,oy);c.lineTo(ox,oy+56);c.lineTo(ox-112,oy);c.closePath();c.stroke();
 const id=$('wall').value,art=redesigned?DOOR_ART[id]:null,img=image('../assets/environment/'+(art?.file||id+'.png'));if(ready(img)){const a=p(-.5,.5),b=p(-.5,-.5),[x0,y0,x1,y1,sourceHeight]=art?.baseline||baselines[id],d=height*z/sourceHeight,ax=(b.x-a.x)/(x1-x0),ay=((b.y-a.y)-d*(y1-y0))/(x1-x0),crop=art?.crop||crops[id];c.save();c.transform(ax,ay,0,d,a.x-ax*x0,a.y-ay*x0-d*y0);c.drawImage(img,crop[0],crop[1],crop[2]-crop[0],crop[3]-crop[1],crop[0],crop[1],crop[2]-crop[0],crop[3]-crop[1]);c.restore();}
 c.fillStyle='#10201866';c.beginPath();c.ellipse(ox,oy+8,60,28,0,0,Math.PI*2);c.fill();const actor=image('../assets/characters/'+$('person').value+'-idle.png');if(ready(actor))c.drawImage(actor,ox-24*z,oy+3*z-64*z,48*z,64*z);
 ruler(c,97,oy,height*z,'#83c6d8',height+' px');ruler(c,342,oy,59*z,'#ead18a','59 px');c.fillStyle='#c5cfbf';c.font='14px system-ui';c.textAlign='center';c.fillText('1 × 1 tile',ox,520);c.textAlign='left';
}
function draw(){const height=Number($('height').value);$('height-value').value=height+' px';$('trial-title').textContent=(DOOR_ART[$('wall').value]?'Cropped · ':'Trial · ')+height+' px '+(DOOR_ART[$('wall').value]?'door':'wall');$('trial-stat').textContent='Wall / visible player height: '+(height/59).toFixed(2)+'×';scene($('current'),44);scene($('trial'),height,true);}
$('wall').value='door-steel-closed';$('height').value=72;
for(const id of ['wall','person','height'])$(id).addEventListener('input',draw);draw();
