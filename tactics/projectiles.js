import {terrainAt,levelOf,sightEdge,W,H,LEVELS} from './maps.js';
import {PROPS,propAt} from './environment.js';

const EPS=1e-7;
export const bodyHeight=u=>u.hp<=0?.3:u.stance==='prone'?.55:u.stance==='kneeling'?1.2:1.8;
export const muzzleHeight=u=>u.stance==='prone'?.35:u.stance==='kneeling'?.9:1.3;
export const eyeHeight=muzzleHeight;
export const targetHeight=(u,zone='torso')=>zone==='weapon'?muzzleHeight(u):bodyHeight(u)*(zone==='head'?.92:zone==='legs'?.28:.72);
const point=(origin,direction,t)=>({x:origin.x+direction.x*t,y:origin.y+direction.y*t,h:origin.h+direction.h*t});
const slab=(origin,velocity,low,high)=>Math.abs(velocity)<EPS?(origin>=low&&origin<=high?[-Infinity,Infinity]:null):[Math.min((low-origin)/velocity,(high-origin)/velocity),Math.max((low-origin)/velocity,(high-origin)/velocity)];

// A shot has one continuous path. Team membership never filters collision candidates.
export function traceProjectile(state,shooter,origin,direction,reach){
 const length=Math.hypot(direction.x,direction.y,direction.h);
 if(!Number.isFinite(length)||length<EPS||!Number.isFinite(reach)||reach<=0)throw Error('Invalid projectile ray');
 const d={x:direction.x/length,y:direction.y/length,h:direction.h/length};
 let nearest=null,limit=reach;
 for(const unit of state.units){
  if(unit===shooter||!(unit.hp>0||['bleeding','stable'].includes(unit.casualty)))continue;
  const ox=origin.x-unit.x,oy=origin.y-unit.y,a=d.x*d.x+d.y*d.y,b=2*(ox*d.x+oy*d.y),c=ox*ox+oy*oy-.34*.34;
  let horizontal;
  if(a<EPS){if(c>0)continue;horizontal=[0,reach];}
  else {const discriminant=b*b-4*a*c;if(discriminant<0)continue;const root=Math.sqrt(discriminant);horizontal=[(-b-root)/(2*a),(-b+root)/(2*a)];}
  const vertical=slab(origin.h,d.h,levelOf(unit)*3+.05,levelOf(unit)*3+bodyHeight(unit));if(!vertical)continue;
  const t=Math.max(EPS,horizontal[0],vertical[0]),end=Math.min(reach,horizontal[1],vertical[1]);
  if(t<=end&&t<limit){limit=t;nearest=unit;}
 }
 const impact=(kind,t,extra={})=>{const p=point(origin,d,t);return {kind,...p,z:Math.max(0,Math.min(LEVELS-1,Math.floor((p.h+EPS)/3))),distance:t,...extra};};
 // Exact grid/level crossings keep thin walls, corner joins and floor slabs solid.
 const crossings=[0,limit];
 for(const axis of ['x','y'])if(Math.abs(d[axis])>EPS){
  let boundary=Math.floor(origin[axis]+.5)+(d[axis]>0?.5:-.5);
  for(let t=(boundary-origin[axis])/d[axis];t<limit;t=(boundary-origin[axis])/d[axis]){if(t>EPS)crossings.push(t);boundary+=Math.sign(d[axis]);}
 }
 if(Math.abs(d.h)>EPS)for(let z=0;z<LEVELS;z++){const t=(z*3-origin.h)/d.h;if(t>EPS&&t<limit)crossings.push(t);}
 crossings.sort((a,b)=>a-b);
 const times=crossings.filter((t,i)=>!i||t-crossings[i-1]>EPS);
 for(let i=0;i<times.length;i++){
  const t=times[i],p=point(origin,d,t),before=point(origin,d,t-EPS),after=point(origin,d,t+EPS);
  const ax=Math.round(before.x),ay=Math.round(before.y),bx=Math.round(after.x),by=Math.round(after.y);
  if(after.x<-.5||after.y<-.5||after.x>=W-.5||after.y>=H-.5)return impact('boundary',t);
  if(t>EPS){
   const lower=Math.floor(Math.min(before.h,after.h)/3),upper=Math.floor(Math.max(before.h,after.h)/3);
   if(lower!==upper&&upper>=0&&upper<LEVELS){
    const cells=new Set([`${ax},${ay}`,`${bx},${by}`]);
    for(const cell of cells){const [x,y]=cell.split(',').map(Number);if((upper===0||terrainAt(state,x,y,upper)!=='void')&&!(state.stairs||[]).some(s=>s.x===x&&s.y===y&&s.z===upper-1))return impact('floor',t);}
   }
   const z=Math.floor(p.h/3),height=p.h-z*3;
   if(z>=0&&z<LEVELS&&height<=2.7){
    if(ax!==bx&&ay!==by)for(const [x,y]of [[ax,by],[bx,ay]]){const terrain=terrainAt(state,x,y,z),prop=PROPS[propAt(state,x,y,z)?.kind],top=terrain==='wall'||prop?.tall?2.7:terrain==='crate'||prop?.solid&&prop.cover>0?.8:0;if(top&&height<=top)return impact('cover',t);}
    if(ax!==bx)for(const y of new Set([ay,by]))if(sightEdge(state,{x:ax,y,z},{x:bx,y,z},{height,offset:p.y-y+.5}))return impact('wall',t);
    if(ay!==by)for(const x of new Set([ax,bx]))if(sightEdge(state,{x,y:ay,z},{x,y:by,z},{height,offset:p.x-x+.5}))return impact('wall',t);
   }
  }
  if(i===times.length-1)break;
  const end=times[i+1],mid=point(origin,d,(t+end)/2),x=Math.round(mid.x),y=Math.round(mid.y),z=Math.floor(mid.h/3);
  if(z<0)return impact('floor',t);
  if(z>=LEVELS)continue;
  const terrain=terrainAt(state,x,y,z),prop=PROPS[propAt(state,x,y,z)?.kind];
  const height=terrain==='wall'||prop?.tall?2.7:(terrain==='crate'||prop?.solid&&prop.cover>0)?.8:0;
  if(height){const vertical=slab(origin.h,d.h,z*3,z*3+height);if(vertical){const hit=Math.max(t,vertical[0]);if(hit<=Math.min(end,vertical[1]))return impact('cover',hit);}}
 }
 if(nearest){const result=impact('unit',limit,{unitId:nearest.id}),relative=(result.h-levelOf(nearest)*3)/bodyHeight(nearest);result.zone=relative>.85?'head':relative<.38?'legs':'torso';return result;}
 return impact('range',reach);
}

export function bulletTrajectory(state,shooter,target,{accurate,zone='torso',chance=50,burst=false,reach},random){
 const origin={x:shooter.x,y:shooter.y,h:levelOf(shooter)*3+muzzleHeight(shooter)};
 const aimHeight=targetHeight(target,zone);
 let dx=target.x-origin.x,dy=target.y-origin.y,dh=levelOf(target)*3+aimHeight-origin.h;
 if(!accurate){
  const distance=Math.max(.5,Math.hypot(dx,dy)),angle=Math.atan2(dy,dx);
  const minimum=Math.asin(Math.min(.9,.42/distance)),maximum=Math.max(minimum,.08+(1-chance/100)*.65+(burst?.12:0));
  const lateral=random()*2-1,spread=Math.sign(lateral||1)*(minimum+Math.abs(lateral)*(maximum-minimum));
  dx=Math.cos(angle+spread)*distance;dy=Math.sin(angle+spread)*distance;
  dh+=(random()*2-1)*distance*maximum*.45;
 }
 const result=traceProjectile(state,shooter,origin,{x:dx,y:dy,h:dh},reach);
 if(accurate&&result.unitId===target.id)result.zone=zone;
 return {...result,origin,accurate};
}

// One shell emits all pellets together. Angular spread naturally thins the pattern with distance.
export function shotgunTrajectories(state,shooter,target,{accurate,zone='torso',chance=50,reach,pellets=6},random){
 const origin={x:shooter.x,y:shooter.y,h:levelOf(shooter)*3+muzzleHeight(shooter)},range=Math.max(.1,Math.hypot(target.x-origin.x,target.y-origin.y));
 const angle=Math.atan2(target.y-origin.y,target.x-origin.x)+(accurate?0:(random()<.5?-1:1)*(.10+(1-chance/100)*.2));
 const slope=(levelOf(target)*3+targetHeight(target,zone)-origin.h)/range;
 return Array.from({length:pellets},()=>{const phase=random()*Math.PI*2,radius=Math.sqrt(random())*.11,yaw=angle+Math.cos(phase)*radius;
  const hit=traceProjectile(state,shooter,origin,{x:Math.cos(yaw),y:Math.sin(yaw),h:slope+Math.sin(phase)*radius},reach);
  if(accurate&&zone==='weapon'&&hit.unitId===target.id&&Math.abs(hit.h-levelOf(target)*3-targetHeight(target,'weapon'))<.15)hit.zone='weapon';
  return {...hit,origin,accurate,pellet:true};
 });
}
