import {canSee,zoneVisible,inCone} from './engine.js';
import {W,H,levelOf} from './maps.js';
const cache=new WeakMap();
// Cache world-space cells, so camera movement and animation do not retrace sight.
export function overwatchTiles(s,u,range){
 const key=[s.revision,u.id,u.x,u.y,levelOf(u),u.heading,u.cone,u.stance,range].join(':');
 const prior=cache.get(s);if(prior?.key===key)return prior.cells;
 const cells=[];
 for(let y=Math.max(0,Math.ceil(u.y-range));y<=Math.min(H-1,u.y+range);y++)for(let x=Math.max(0,Math.ceil(u.x-range));x<=Math.min(W-1,u.x+range);x++){
  const p={x,y,z:levelOf(u),stance:'standing'};
  if(Math.hypot(x-u.x,y-u.y)>range||!inCone(u,p))continue;
  cells.push({...p,clear:canSee(s,u,p)&&zoneVisible(s,u,p,'torso')});
 }
 cache.set(s,{key,cells});return cells;
}
