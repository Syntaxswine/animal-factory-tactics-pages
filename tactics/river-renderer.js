import {makePeriodic,renderWaterFrame} from './water-animation.js';
import {shoreMask} from './shore-tiles.js';

// Four shoreline quadrants keep the banks inside blocked water cells, including tiny pools.
// Shared edge samples depend on the same neighbors on either side of a tile boundary.
export function riverMasks(terrain,x,y){
 const wet=(dx,dy)=>['water','bridge','void'].includes(terrain(x+dx,y+dy));
 const land=(u,v)=>{
  const xs=u===0?[-1,0]:u===2?[0,1]:[0],ys=v===0?[-1,0]:v===2?[0,1]:[0];
  return xs.some(dx=>ys.some(dy=>!wet(dx,dy)));
 };
 return [shoreMask(land,0,0),shoreMask(land,1,0),shoreMask(land,0,1),shoreMask(land,1,1)];
}
export function riverRenderer(onReady,onError){
 let started=false,water,frame,surface,diamond,last=-1;const banks=[];
 const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 function projectImage(source,sx=0,sy=0,sw=source.width,sh=source.height){
  const c=canvas(112,56),g=c.getContext('2d');g.setTransform(56/sw,28/sw,-56/sh,28/sh,56,0);g.drawImage(source,sx,sy,sw,sh,0,0,sw,sh);return c;
 }
 function start(){
  started=true;const source=new Image(),atlas=new Image();
  source.onload=()=>{surface=canvas(64,64);const g=surface.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0,64,64);water=makePeriodic(g.getImageData(0,0,64,64).data,64,64,64);frame=g.createImageData(64,64);onReady();};
  atlas.onload=()=>{for(let i=0;i<48;i++)banks[i]=projectImage(atlas,i%4*128,Math.floor(i/4)*128,128,128);onReady();};
  source.onerror=()=>onError('river-water');atlas.onerror=()=>onError('shore-tiles-atlas');
  source.src='../assets/environment/foliage/river-water.png';atlas.src='../assets/environment/foliage/shore-tiles-atlas.png';
 }
 return (ctx,project,zoom,x,y,terrain)=>{
  if(!started)start();if(!water)return false;
  const now=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.floor(performance.now()/125);
  if(now!==last){last=now;renderWaterFrame(water,64,now/8,frame.data);surface.getContext('2d').putImageData(frame,0,0);diamond=projectImage(surface);}
  const p=project(x,y);ctx.drawImage(diamond,p.x-28*zoom,p.y-14*zoom,56*zoom,28*zoom);
  const masks=riverMasks(terrain,x,y);
  for(let i=0;i<4;i++){const variant=((x*7+y*11+i)%3+3)%3,bank=banks[variant*16+masks[i]];if(!bank||!masks[i])continue;const q=project(x+(i%2? .25:-.25),y+(i<2?-.25:.25));ctx.drawImage(bank,q.x-14*zoom,q.y-7*zoom,28*zoom,14*zoom);}
  return true;
 };
}
