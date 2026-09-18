// Delay a single-finger action until release so adding a second finger cannot
// accidentally order movement or fire a shot. Mouse and pen keep their controls.
export function touchCamera(canvas,camera,{minZoom=.025,maxZoom=2.3,onTap=()=>{},onChange=()=>{}}={}){
 const points=new Map();let gesture=false,baseline=null,start=null,moved=false;
 const pair=()=>{if(points.size<2)return null;const [a,b]=[...points.values()],r=canvas.getBoundingClientRect();return {x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top,d:Math.hypot(a.x-b.x,a.y-b.y)};};
 const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;stop(e);canvas.focus();
  if(!points.size){gesture=false;moved=false;start={x:e.clientX,y:e.clientY};}
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
  if(points.size>=2){gesture=true;baseline=pair();onChange();}
 },{capture:true});
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch')return;stop(e);if(!points.has(e.pointerId))return;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)moved=true;
  const next=pair();if(next&&baseline){
   const zoom=Math.max(minZoom,Math.min(maxZoom,camera.zoom*(baseline.d>0?next.d/baseline.d:1))),scale=zoom/camera.zoom;
   camera.x=next.x+(camera.x-baseline.x)*scale;camera.y=next.y+(camera.y-baseline.y)*scale;camera.zoom=zoom;onChange();
  }baseline=next;
 },{capture:true});
 const finish=(e,cancel)=>{
  if(e.pointerType!=='touch')return;stop(e);if(!points.has(e.pointerId))return;
  const tap=!cancel&&!gesture&&!moved&&points.size===1&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<=8;
  if(cancel)gesture=true;points.delete(e.pointerId);baseline=pair();
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(tap)onTap(e);
 };
 canvas.addEventListener('pointerup',e=>finish(e,false),{capture:true});
 canvas.addEventListener('pointercancel',e=>finish(e,true),{capture:true});
 canvas.addEventListener('lostpointercapture',e=>finish(e,true),{capture:true});
}
