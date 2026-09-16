import {traceProjectile,muzzleHeight} from './projectiles.js';
import {levelOf,inBounds,terrainAt,edgePoints,tileKey,W,H} from './maps.js';
import {propCells} from './environment.js';

export function explosivePreview(s,a,target,w){
 const range=Math.hypot(target.x-a.x,target.y-a.y),height=levelOf(a)-levelOf(target),effectiveRange=w.range+Math.max(0,height)*3;
 const maxRange=w.arc?(w.thrown?effectiveRange:effectiveRange*2):w.range*2;
 let reason='';
 if(!inBounds(target.x,target.y,levelOf(target)))reason='Outside the map';
 else if(a.burningTurns)reason='On fire: running in panic';
 else if(a.team==='squad'&&!s.seen.has(tileKey(target.x,target.y,levelOf(target))))reason='Choose discovered terrain';
 else if(range>maxRange||range+Math.max(0,-height)*3>maxRange)reason='Out of range';
 else if(a.ammo[a.weapon]<1)reason='Reload required';
 else if(!['explore','won'].includes(s.phase)&&a.ap<w.cost)reason='Not enough AP';
 const beyond=range>effectiveRange,chance=beyond?10:Math.max(20,Math.min(95,a.accuracy-Math.max(0,range-3)/Math.max(1,effectiveRange-3)*25));
 return {ok:!reason,reason,cost:w.cost,rounds:1,chance:Math.round(chance),damage:w.damage,zone:'torso',range:effectiveRange,maxRange,beyond,blastRadius:w.blast};
}

// Parabolas are swept in short 3D segments through the same exact wall/floor/body
// collision geometry as bullets. Rockets sweep one continuous ray.
export function explosiveTrajectory(s,a,target,w,p,random){
 const origin={x:a.x,y:a.y,h:levelOf(a)*3+muzzleHeight(a)},accurate=random()*100<p.chance;
 let x=target.x,y=target.y;
 if(!accurate){const angle=random()*Math.PI*2,spread=(p.beyond?Math.max(4,Math.hypot(x-a.x,y-a.y)*.3):1+Math.hypot(x-a.x,y-a.y)*.12)*(.35+random()*.65);x+=Math.cos(angle)*spread;y+=Math.sin(angle)*spread;}
 const end={x,y,h:levelOf(target)*3+(w.arc?.08:target.ground?.08:1)},distance=Math.hypot(x-origin.x,y-origin.y);
 if(!w.arc){const hit=traceProjectile(s,a,origin,{x:x-origin.x,y:y-origin.y,h:end.h-origin.h},w.range*2);return {...hit,origin,accurate,path:[origin,hit]};}
 const apex=Math.max(3,distance*.3),steps=Math.ceil(Math.max(1,distance+Math.abs(end.h-origin.h)+apex*2)*10),path=[origin];let before=origin;
 for(let i=1;i<=steps*3;i++){
  const t=i/steps,next={x:origin.x+(x-origin.x)*t,y:origin.y+(y-origin.y)*t,h:origin.h+(end.h-origin.h)*t+4*apex*t*(1-t)},direction={x:next.x-before.x,y:next.y-before.y,h:next.h-before.h};
  const hit=traceProjectile(s,a,before,direction,Math.hypot(direction.x,direction.y,direction.h));
  if(hit.kind!=='range'){path.push(hit);return {...hit,origin,accurate,path};}
  path.push(next);before=next;
 }
 return {...end,z:levelOf(target),kind:'ground',origin,accurate,path};
}

const boxDistance=(p,x0,y0,h0,x1,y1,h1)=>Math.hypot(Math.max(x0-p.x,0,p.x-x1),Math.max(y0-p.y,0,p.y-y1),Math.max(h0-p.h,0,p.h-h1));
function blastClear(s,impact,end){const origin={x:impact.x,y:impact.y,h:Math.max(.03,impact.h)},d={x:end.x-origin.x,y:end.y-origin.y,h:end.h-origin.h},length=Math.hypot(d.x,d.y,d.h);if(length<.06)return true;const hit=traceProjectile({...s,units:[]},null,origin,d,length);return hit.kind==='range'||hit.distance>=length-.06;}
export function detonate(s,impact,w){
 const radius=w.blast,candidates=[];
 for(const [key,kind]of Object.entries(s.edges)){
  const [a,b]=edgePoints(key),h=a.z*3,dist=boxDistance(impact,Math.min(a.x,b.x),Math.min(a.y,b.y),h,Math.max(a.x,b.x),Math.max(a.y,b.y),h+2.7);
  const resistance=/concrete|steel|^wall$/.test(kind)?50:/brick/.test(kind)?40:20;
  if(dist<=radius&&w.damage*(1-dist/radius)>=resistance)candidates.push({dist,point:{x:Math.max(Math.min(a.x,b.x),Math.min(impact.x,Math.max(a.x,b.x))),y:Math.max(Math.min(a.y,b.y),Math.min(impact.y,Math.max(a.y,b.y))),h:Math.max(h+.03,Math.min(impact.h,h+2.6))},remove:()=>{delete s.edges[key];}});
 }
 for(const prop of s.props){const cells=propCells(prop),z=levelOf(prop);let nearest=null;for(const c of cells){const d=boxDistance(impact,c.x-.5,c.y-.5,z*3,c.x+.5,c.y+.5,z*3+2.7);if(!nearest||d<nearest.dist)nearest={dist:d,point:{x:Math.max(c.x-.49,Math.min(impact.x,c.x+.49)),y:Math.max(c.y-.49,Math.min(impact.y,c.y+.49)),h:Math.max(z*3+.03,Math.min(impact.h,z*3+2.6))}};}if(nearest&&nearest.dist<=radius&&w.damage*(1-nearest.dist/radius)>=20)candidates.push({...nearest,remove:()=>{s.props=s.props.filter(p=>p!==prop);}});}
 for(let z=0;z<3;z++)for(let y=Math.max(0,Math.floor(impact.y-radius));y<=Math.min(H-1,Math.ceil(impact.y+radius));y++)for(let x=Math.max(0,Math.floor(impact.x-radius));x<=Math.min(W-1,Math.ceil(impact.x+radius));x++){
  const terrain=terrainAt(s,x,y,z);if(!['wall','crate'].includes(terrain))continue;
  const dist=boxDistance(impact,x-.5,y-.5,z*3,x+.5,y+.5,z*3+2.7);
  if(dist<radius&&w.damage*(1-dist/radius)>=(terrain==='wall'?50:20))candidates.push({dist,point:{x:Math.max(x-.5,Math.min(impact.x,x+.5)),y:Math.max(y-.5,Math.min(impact.y,y+.5)),h:Math.max(z*3+.03,Math.min(impact.h,z*3+2.6))},remove:()=>{if(z)s.upper[z-1][tileKey(x,y)]='floor';else (s.map||s.terrain)[y][x]='ground-gravel';}});
 }
 let destroyed=0;
 // Near surfaces breach first. Floors and surviving structures shield the space beyond.
 for(const c of candidates.sort((a,b)=>a.dist-b.dist))if(blastClear(s,impact,c.point)){c.remove();destroyed++;}
 const hits=[];
 for(const u of s.units){if(!(u.hp>0||['bleeding','stable'].includes(u.casualty)))continue;const point={x:u.x,y:u.y,h:levelOf(u)*3+.8},dist=Math.hypot(u.x-impact.x,u.y-impact.y,point.h-impact.h);if(dist<radius&&blastClear(s,impact,point))hits.push({unit:u,damage:Math.max(1,Math.round(w.damage*(1-dist/radius)))});}
 return {hits,blast:{x:impact.x,y:impact.y,z:impact.z,radius,destroyed}};
}
