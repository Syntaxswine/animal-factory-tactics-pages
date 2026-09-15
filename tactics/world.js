import {factoryMap,generateMap,blockedEdge,tileKey,levelOf,neighbors} from './maps.js';
import {createGame,squad,guards,alive,refresh,walkable,log} from './engine.js';
export function createWorld(custom=null) {
  return {current:'factory',definitions:{factory:custom||factoryMap(),yard:generateMap(83,'Yard test'),annex:generateMap(126,'Workshop test')},states:{factory:createGame(1947,custom||factoryMap())},links:[['factory','yard'],['yard','annex']]};
}
export const currentMap=world=>world.states[world.current];
export function travelReason(world,destination) {
  const s=currentMap(world);
  if(!world.definitions[destination])return 'Unknown location.';
  if(destination===world.current)return 'You are already here.';
  if(!world.links.some(l=>l.includes(world.current)&&l.includes(destination)))return 'Travel to the neighboring location first.';
  if(!['explore','won'].includes(s.phase)||guards(s).some(g=>g.alert))return 'Finish the active encounter before traveling.';
  if(s.queue.length)return 'Stop movement before traveling.';
  if(!squad(s).length)return 'No surviving squad members.';
  const exit=s.definition.exits[0];
  if(squad(s).some(u=>levelOf(u)!==levelOf(exit)||Math.hypot(u.x-exit.x,u.y-exit.y)>2))return 'Gather every living squad member within 2 tiles of the travel marker.';
  return '';
}
function landing(s,start,occupied) {
  const q=[start],seen=new Set([tileKey(start.x,start.y,levelOf(start))]);
  for(let i=0;i<q.length;i++){const p=q[i];if(walkable(s,p.x,p.y,levelOf(p))&&!occupied.has(tileKey(p.x,p.y,levelOf(p))))return p;
    for(const b of neighbors(s,p)){const k=tileKey(b.x,b.y,levelOf(b));if(!seen.has(k)){seen.add(k);q.push(b);}}
  }return null;
}
export function travel(world,destination) {
  const error=travelReason(world,destination);if(error)return {ok:false,error};
  const previous=currentMap(world),next=world.states[destination]||createGame(1947,world.definitions[destination],false);
  const incoming=structuredClone(previous.units.filter(u=>u.team==='squad'));
  const occupied=new Set(guards(next).map(u=>tileKey(u.x,u.y,levelOf(u))));
  for(const u of incoming){const p=landing(next,next.definition.starts[u.id],occupied);if(!p)return {ok:false,error:'No free arrival tile.'};u.x=p.x;u.y=p.y;u.z=levelOf(p);u.alert=false;u.lastKnown=null;if(alive(u))occupied.add(tileKey(p.x,p.y,levelOf(p)));}
  next.units=[...incoming,...next.units.filter(u=>u.team==='guard')];next.selected=previous.selected;next.queue=[];next.effect=null;
  world.states[destination]=next;world.current=destination;refresh(next);log(next,'Arrived from the overmap.');return {ok:true,state:next};
}
