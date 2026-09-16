import {factoryMap,generateMap,blockedEdge,tileKey,levelOf,neighbors} from './maps.js';
import {createGame,squad,guards,alive,refresh,walkable,log} from './engine.js';
import {awardXP} from './progression.js';
export const TRAVEL_MINUTES=60,PLAY_MINUTES_PER_SECOND=1;
export function createWorld(custom=null,difficulty='standard') {
  return {difficulty,current:'factory',start:'factory',clock:{minutes:480,incomeRemainder:0},money:0,journeys:0,lastIncome:0,locations:{factory:{type:'factory'},yard:{type:'yard'},annex:{type:'factory'}},definitions:{factory:custom||factoryMap(),yard:generateMap(83,'Freight yard'),annex:generateMap(126,'Outer factory')},states:{factory:createGame(1947,custom||factoryMap(),true,difficulty)},links:[['factory','yard'],['yard','annex']]};
}
export const currentMap=world=>world.states[world.current];
// Shortest overmap route from the original starting tile, never from the squad.
export function locationDistance(world,destination){
 const queue=[[world.start,0]],seen=new Set([world.start]);
 for(let i=0;i<queue.length;i++){const [id,distance]=queue[i];if(id===destination)return distance;
  for(const link of world.links)if(link.includes(id))for(const next of link)if(!seen.has(next)){seen.add(next);queue.push([next,distance+1]);}
 }return Infinity;
}
export function factoryIncome(world,id){
 if(!world.definitions[id]||world.locations[id]?.type!=='factory')return 0;
 const distance=locationDistance(world,id);return Number.isFinite(distance)?100*(distance+1):0;
}
export const liberated=(world,id)=>world.states[id]?.phase==='won';
export const incomePerHour=world=>Object.keys(world.definitions).reduce((sum,id)=>sum+(liberated(world,id)?factoryIncome(world,id):0),0);
export function clockLabel(world){const minutes=Math.floor(world.clock.minutes);return `Day ${Math.floor(minutes/1440)+1} · ${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
// Every elapsed interval uses the same clock and production calculation.
export function advanceTime(world,minutes){
 if(!Number.isFinite(minutes)||minutes<=0)return 0;
 const earned=world.clock.incomeRemainder+incomePerHour(world)*minutes/60,income=Math.floor(earned+1e-9);
 world.clock.minutes+=minutes;world.clock.incomeRemainder=Math.max(0,earned-income);world.money+=income;return income;
}
export function tickWorld(world,elapsedMs,{paused=false}={}){
 if(paused||currentMap(world).phase==='lost'||!Number.isFinite(elapsedMs)||elapsedMs<=0)return 0;
 return advanceTime(world,elapsedMs/1000*PLAY_MINUTES_PER_SECOND);
}
export function downtimeReason(world){
 const s=currentMap(world);
 if(s.phase!=='won'||guards(s).length)return 'Clear this map before resting or training.';
 if(s.queue.length)return 'Stop movement before resting or training.';
 if(!squad(s).some(u=>!u.casualty))return 'No troops available.';
 if(s.units.some(u=>u.team==='squad'&&['bleeding','stable'].includes(u.casualty)))return 'Resolve squad casualties first.';
 return '';
}
export function spendTime(world,activity,hours){
 const error=downtimeReason(world);if(error)return {ok:false,error};
 if(!['rest','train'].includes(activity)||![1,4,8].includes(hours))return {ok:false,error:'Choose rest or training for 1, 4 or 8 hours.'};
 const s=currentMap(world),troops=squad(s).filter(u=>!u.casualty);
 if(activity==='train'&&!troops.some(u=>u.level<10))return {ok:false,error:'All available troops have reached level 10.'};
 const income=advanceTime(world,hours*60);
 for(const u of troops){u.overwatch=null;if(activity==='rest'){u.hp=Math.min(u.maxHp,u.hp+Math.ceil(u.maxHp*.1*hours));u.ap=u.maxAp;}else if(u.level<10)awardXP(u,25*hours);}
 const message=activity==='rest'?`Squad rested for ${hours} hours; recovered up to ${hours*10}% maximum health.`:`Squad trained for ${hours} hours; +${25*hours} XP per eligible troop.`;
 refresh(s);log(s,message);return {ok:true,income,message};
}
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
  const previous=currentMap(world),next=world.states[destination]||createGame(1947,world.definitions[destination],false,world.difficulty);
  const incoming=structuredClone(previous.units.filter(u=>u.team==='squad'));
  const occupied=new Set(guards(next).map(u=>tileKey(u.x,u.y,levelOf(u))));
  for(const u of incoming){const p=landing(next,next.definition.starts[u.id],occupied);if(!p)return {ok:false,error:'No free arrival tile.'};u.x=p.x;u.y=p.y;u.z=levelOf(p);u.alert=false;u.lastKnown=null;if(alive(u))occupied.add(tileKey(p.x,p.y,levelOf(p)));}
  next.units=[...incoming,...next.units.filter(u=>u.team==='guard')];next.selected=previous.selected;next.queue=[];next.effect=null;
  // Failed travel takes no time. Production during transit uses previously liberated maps.
  const income=advanceTime(world,TRAVEL_MINUTES);
  world.states[destination]=next;world.current=destination;world.journeys++;world.lastIncome=income;
  refresh(next);log(next,'Arrived from the overmap.'+(income?' Factory income +$'+income+' · Treasury $'+world.money+'.':''));return {ok:true,state:next,income};
}
