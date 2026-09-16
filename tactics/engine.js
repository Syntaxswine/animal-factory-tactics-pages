import {explosivePreview,explosiveTrajectory,detonate} from './explosives.js';
import {initPersonality,friendlyReaction,helped,settleStress,injuryStrain,killRelief} from './personalities.js';
import {initProgression,awardCombatXP,train} from './progression.js';
import {bulletTrajectory} from './projectiles.js';
import {gridLayout,storeLayout,placeItem,initInventory,reserve,consumeAmmo,syncWeapons,accepts,receive} from './inventory.js';
import {inCone,headingTo} from './perception.js';
export {inCone,headingTo} from './perception.js';
import {terrainVisibility,TERRAIN_RANGE,CHARACTER_RANGE} from './visibility.js';
export {TERRAIN_RANGE,CHARACTER_RANGE} from './visibility.js';
import {PROPS,EDGES,propAt,propTall,propCells} from './environment.js';
import {W,H,factoryMap,validateMap,blockedEdge,levelOf,tileKey,terrainAt,neighbors,stairSet,canStep,LEVELS,passable,sightEdge,edgeBetween,edgeCells,inBounds} from './maps.js';
export {W,H} from './maps.js';
export const WEAPONS={
 hands:{name:'Workers’ fists',short:'Hands',cost:3,range:1,damage:16,mag:0},
 knife:{name:'NR-40 knife',short:'NR-40',cost:3,range:1,damage:27,mag:0},
 pistol:{name:'TT-33 pistol',short:'TT-33',cost:4,range:8,damage:27,mag:8},
 rifle:{name:'Mosin-Nagant',short:'Mosin',cost:6,range:14,damage:48,mag:5},
 assault:{name:'AK-47',short:'AK-47',cost:4,range:10,damage:26,mag:30},
 grenade:{name:'Fragmentation grenade',short:'Grenade',cost:5,range:10,damage:120,mag:3,blast:3,arc:true,thrown:true},
 launcher:{name:'Grenade launcher',short:'Launcher',cost:6,range:22,damage:140,mag:1,blast:3,arc:true},
 rpg:{name:'RPG',short:'RPG',cost:7,range:40,damage:220,mag:1,blast:4},
 flamethrower:{name:'Backpack flamethrower',short:'Flamer',cost:6,range:3,damage:180,mag:4,incendiary:true}
};
export const AIM_ZONES={head:{label:'Head',accuracy:-25,damage:1.5},weapon:{label:'Weapon',accuracy:-15,damage:.75},torso:{label:'Torso',accuracy:0,damage:1},legs:{label:'Legs',accuracy:-10,damage:.85}};
export function tankExplosionChance(unit,zone){
 const carrying=unit.weapon==='flamethrower'||unit.pack?.some(i=>i.type==='weapon'&&i.kind==='flamethrower');
 if(!carrying||unit.tanksExploded||(unit.ammo?.flamethrower??0)<=0)return 0;
 return zone==='torso'?.25:zone==='weapon'&&unit.weapon==='flamethrower'?.9:0;
}
export const STANCES={standing:{label:'Standing',moveCost:2},kneeling:{label:'Kneeling',moveCost:4},prone:{label:'Prone',moveCost:8}};
export const stanceOf=u=>Object.hasOwn(STANCES,u?.stance)?u.stance:'standing';
export function movementNeighbors(s,u,p=u,stairs){return neighbors(s,p,stairs).filter(q=>(levelOf(q)===levelOf(p)||stanceOf(u)==='standing')&&!(levelOf(q)===levelOf(p)&&q.x!==p.x&&q.y!==p.y&&[occupant(s,q.x,p.y,levelOf(p)),occupant(s,p.x,q.y,levelOf(p))].some(v=>v&&v!==u))).map(q=>({...q,cost:levelOf(q)===levelOf(p)?(STANCES[stanceOf(u)].moveCost+(u.sneaking?2:0))*q.cost:q.cost}));}
export const key=tileKey;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(levelOf(a)-levelOf(b))*3);
export const alive=u=>u.hp>0;
export const incapacitated=u=>u?.hp===0&&['bleeding','stable'].includes(u.casualty);
export const medicalCost=u=>Math.ceil(12-9*Math.max(0,Math.min(100,Number(u.medical)||0))/100);
export const squad=s=>s.units.filter(u=>u.team==='squad'&&alive(u));
export const guards=s=>s.units.filter(u=>u.team==='guard'&&alive(u));
export const occupant=(s,x,y,z=0)=>s.units.find(u=>(alive(u)||incapacitated(u))&&u.x===x&&u.y===y&&levelOf(u)===z);
export const tile=(s,x,y,z=0)=>terrainAt(s,x,y,z);
export const walkable=(s,x,y,z=0)=>passable(s,{x,y,z});
export function log(s,message){s.log.unshift(message);s.log=s.log.slice(0,50);s.revision++;}
export function createGame(seed=1947,definition=factoryMap(),detect=true,difficulty='standard'){
 const errors=validateMap(definition);if(errors.length)throw Error(errors.join(' '));
 const s={difficulty:difficulty==='easy'?'easy':'standard',map:structuredClone(definition.terrain),upper:structuredClone(definition.upper),stairs:structuredClone(definition.stairs),climbs:structuredClone(definition.climbs||[]),props:structuredClone(definition.props||[]),sectors:structuredClone(definition.sectors),edges:{...definition.edges},definition:structuredClone(definition),units:[],phase:'explore',round:0,selected:0,visible:new Set(),seen:new Set(),detected:new Set(),log:[],seed,revision:0,queue:[],enemyIndex:0,contacts:{},effect:null};
 const add=(team,name,species,x,y,weapon,z=0)=>s.units.push({id:s.units.length,team,name,species,x,y,z,medical:team==='squad'?[0,25,50,100][s.units.length]:0,medkits:team==='squad'?1:0,wireCutters:team==='squad',casualty:null,bleedTurns:0,sneaking:false,stealth:20,overwatch:null,lastHeard:null,stance:'standing',hp:team==='squad'?100:45,maxHp:team==='squad'?100:45,ap:team==='squad'?12:7,maxAp:team==='squad'?12:7,accuracy:team==='squad'?85:55,weapon,ammo:Object.fromEntries(Object.entries(WEAPONS).map(([k,v])=>[k,v.mag])),alert:false,lastKnown:null,facing:1,heading:team==='squad'?45:225,cone:120,steps:0});
 const cast=[['Yakov','horse','assault'],['Anya','goat','rifle'],['Misha','donkey','pistol'],['Vera','sheep','knife']];
 definition.starts.forEach((p,i)=>add('squad',cast[i][0],cast[i][1],p.x,p.y,cast[i][2],levelOf(p)));
 const names=['Boris','Lev','Grigori','Oleg','Pavel','Igor','Anton','Vadim','Yuri','Sasha','Pyotr','Nikolai'];
 definition.guards.forEach((g,i)=>{add('guard',names[i]||`Guard ${i+1}`,g.species,g.x,g.y,g.weapon,levelOf(g));if(g.outfit)s.units.at(-1).outfit=g.outfit;});
 for(const u of s.units){initInventory(u,WEAPONS);if(u.team==='squad'){initProgression(u);initPersonality(u);}}s.loot=definition.starts.map((p,i)=>({...p,items:[{type:'ammo',kind:i%2?'rifle':'pistol',count:i%2?5:8}]}));
 if(definition.name==='Factory test')for(const [i,kind]of ['grenade','launcher','rpg'].entries())s.loot[i+1].items.push({type:'weapon',kind,rounds:WEAPONS[kind].mag},{type:'ammo',kind,count:kind==='grenade'?6:3});
 if(definition.name==='Factory test')s.loot[0].items.push({type:'weapon',kind:'flamethrower',rounds:4},{type:'ammo',kind:'flamethrower',count:4});
 if(detect)refresh(s);log(s,`Local map ready / ${definition.guards.length} guards.`);return s;
}
// Eye rays traverse tile edges and solid upper floors; stairs are floor openings.
export function lineOfSight(s,a,b){
 const az=levelOf(a),bz=levelOf(b),dx=b.x-a.x,dy=b.y-a.y,h0=az*3+1.3,dh=(bz-az)*3;
 if(dh){for(let z=1;z<LEVELS;z++){const t=(z*3-h0)/dh;if(t<=0||t>=1)continue;const fx=a.x+dx*t,fy=a.y+dy*t;
  const xs=[Math.round(fx-1e-8),Math.round(fx+1e-8)],ys=[Math.round(fy-1e-8),Math.round(fy+1e-8)];
  for(const x of xs)for(const y of ys)if(tile(s,x,y,z)!=='void'&&!(s.stairs||[]).some(p=>p.x===x&&p.y===y&&p.z===z-1))return false;
 }}
 let x=a.x,y=a.y,ix=0,iy=0;const nx=Math.abs(dx),ny=Math.abs(dy),sx=Math.sign(dx),sy=Math.sign(dy);
 const blocked=(p,q,t)=>{const h=h0+dh*t,z=Math.floor(h/3);return h-z*3<=2.7&&sightEdge(s,{...p,z},{...q,z},{height:h-z*3,offset:p.x!==q.x?a.y+dy*t-p.y+.5:a.x+dx*t-p.x+.5});};
 while(ix<nx||iy<ny){const d=(1+2*ix)*ny-(1+2*iy)*nx;
  if(d===0){const t=(ix+.5)/nx,p={x,y},q={x:x+sx,y},r={x,y:y+sy},e={x:x+sx,y:y+sy};if(blocked(p,q,t)||blocked(p,r,t)||blocked(q,e,t)||blocked(r,e,t)||tile(s,q.x,q.y,az)==='wall'||tile(s,r.x,r.y,az)==='wall'||propTall(s,q.x,q.y,Math.floor((h0+dh*t)/3))||propTall(s,r.x,r.y,Math.floor((h0+dh*t)/3)))return false;x+=sx;y+=sy;ix++;iy++;}
  else if(d<0){if(blocked({x,y},{x:x+sx,y},(ix+.5)/nx))return false;x+=sx;ix++;}
  else {if(blocked({x,y},{x,y:y+sy},(iy+.5)/ny))return false;y+=sy;iy++;}
  const t=nx>=ny?(x-a.x)/(dx||1):(y-a.y)/(dy||1),z=Math.floor((h0+dh*t)/3);if((tile(s,x,y,z)==='wall'||propTall(s,x,y,z))&&(x!==b.x||y!==b.y||z!==bz))return false;
 }return true;
}
export const pathCost=path=>path.reduce((n,p)=>n+(p.cost||1),0);
export function pathTo(s,u,x,y,z=levelOf(u)){
 if(!walkable(s,x,y,z)||(occupant(s,x,y,z)&&occupant(s,x,y,z)!==u))return null;
 const start=key(u.x,u.y,levelOf(u)),goal=key(x,y,z),occupied=new Set(s.units.filter(p=>(alive(p)||incapacitated(p))&&p!==u).map(p=>key(p.x,p.y,levelOf(p)))),stairs=stairSet(s);
 const heuristic=p=>{const dx=Math.abs(p.x-x),dy=Math.abs(p.y-y);return (Math.max(dx,dy)+.5*Math.min(dx,dy))*(STANCES[stanceOf(u)].moveCost+(u.sneaking?2:0))+2*Math.abs(levelOf(p)-z);},heap=[],scores=new Map([[start,0]]),parents=new Map();
 const deviation=p=>Math.abs((p.x-u.x)*(y-u.y)-(p.y-u.y)*(x-u.x));const less=(a,b)=>a.f<b.f||(a.f===b.f&&(deviation(a)<deviation(b)||(deviation(a)===deviation(b)&&a.g>b.g)));
 const push=n=>{heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],heap[i]))break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return first;};
 push({...u,z:levelOf(u),k:start,g:0,f:heuristic(u)});
 while(heap.length){const p=pop();if(p.g!==scores.get(p.k))continue;if(p.k===goal){const path=[];let k=goal;while(k!==start){const entry=parents.get(k);path.push(entry.point);k=entry.parent;}return path.reverse();}
  for(const q of movementNeighbors(s,u,p,stairs)){const k=key(q.x,q.y,q.z),g=p.g+q.cost;if(occupied.has(k)||g>=(scores.get(k)??Infinity))continue;scores.set(k,g);parents.set(k,{parent:p.k,point:q});push({...q,k,g,f:g+heuristic(q)});}
 }return null;
}
export const sightRange=(a,b)=>b?.sneaking?Math.max(8,CHARACTER_RANGE-20-(b.stealth||0)*.2-(stanceOf(b)==='prone'?10:0)):CHARACTER_RANGE;
export const canSee=(s,a,b)=>inCone(a,b)&&distance(a,b)<=sightRange(a,b)&&lineOfSight(s,a,b);
export function refresh(s){
 const oldDetected=s.detected,oldVisible=s.visible;s.visible=terrainVisibility(s,squad(s));s.detected=new Set(guards(s).filter(g=>squad(s).some(p=>canSee(s,p,g))).map(g=>g.id));
 for(const g of guards(s))if(s.detected.has(g.id))s.contacts[g.id]={x:g.x,y:g.y,z:levelOf(g)};
 if(s.queue.length&&[...s.detected].some(id=>!oldDetected.has(id))){s.queue=[];log(s,'Movement stopped: new opponent spotted.');}
 if(s.visible!==oldVisible||s.seen.size<s.visible.size)for(const k of s.visible)s.seen.add(k);
 if(!squad(s).length){if(!s.defeat){for(const u of s.units.filter(u=>u.team==='squad')){u.casualty=u.casualty==='stable'?'captured':'dead';u.bleedTurns=0;u.ap=0;u.overwatch=null;syncWeapons(u);}s.defeat={location:s.definition.name,round:s.round,captured:s.units.filter(u=>u.team==='squad'&&u.casualty==='captured').map(u=>structuredClone(u)),dead:s.units.filter(u=>u.team==='squad'&&u.casualty==='dead').map(u=>({id:u.id,name:u.name}))};log(s,s.defeat.captured.length+' captured / '+s.defeat.dead.length+' dead.');}s.phase='lost';s.queue=[];return;}
 if(!alive(s.units[s.selected]))s.selected=squad(s)[0].id;
 const pending=s.units.some(u=>u.casualty==='bleeding'||alive(u)&&u.burningTurns>0)||(s.fires?.length||0)>0;
 if(!guards(s).some(g=>g.alert)&&!s.detected.size&&!pending)for(const u of s.units)if(u.casualty==='stable'){u.hp=5;u.casualty=null;log(s,u.name+' recovered after the encounter (5 HP).');}
 if(!guards(s).length&&!pending){if(s.phase!=='won'){log(s,'Local map cleared. Explore or gather at the travel marker.');s.queue=[];}s.phase='won';s.revision++;return;}
 for(const g of guards(s)){if(squad(s).some(p=>canSee(s,p,g)))g.alert=true;const targets=squad(s).filter(p=>canSee(s,g,p));if(targets.length){g.alert=true;const p=targets.sort((a,b)=>distance(g,a)-distance(g,b))[0];g.lastKnown={x:p.x,y:p.y,z:levelOf(p)};}}
 const contact=guards(s).some(g=>g.alert)||pending;
 if(['explore','won'].includes(s.phase)&&contact){s.phase='player';s.round++;s.queue=[];for(const u of s.units)u.ap=u.burningTurns?0:u.maxAp;log(s,'CONTACT / Squad turn. Movement costs 2 / 4 / 8 AP per tile: standing / kneeling / prone.');}
 else if((s.phase==='player'||s.phase==='enemy')&&!contact){s.phase='explore';s.queue=[];log(s,'Area clear. Real-time exploration resumed.');}
 if(!alive(s.units[s.selected]))s.selected=squad(s)[0].id;
 s.revision++;
}
export function canControl(s,u){return u&&alive(u)&&!u.burningTurns&&u.team==='squad'&&['explore','player','won'].includes(s.phase);}
export function setStance(s,u,stance){
 if(!Object.hasOwn(STANCES,stance)||!canControl(s,u)||s.queue.length||stanceOf(u)===stance||(s.phase==='player'&&u.ap<2))return false;
 if(s.phase==='player')u.ap-=2;u.overwatch=null;u.stance=stance;log(s,u.name+' is '+stance+'.');return true;
}

export function navigationState(s){const known=p=>s.seen.has(key(p.x,p.y,levelOf(p))),knowledge=new Set(s.seen);for(const p of s.climbs)if(known(p)||known({x:p.x+p.dx,y:p.y+p.dy,z:p.z+1}))for(const q of [p,{x:p.x,y:p.y,z:p.z+1},{x:p.x+p.dx,y:p.y+p.dy,z:p.z+1}])knowledge.add(key(q.x,q.y,q.z));return {...s,knowledge,edges:Object.fromEntries(Object.entries(s.edges).filter(([k])=>edgeCells(k).some(known))),props:s.props.filter(p=>propCells(p).some(known)),stairs:s.stairs.filter(p=>known(p)||known({...p,z:p.z+1})),climbs:s.climbs.filter(p=>known(p)||known({x:p.x+p.dx,y:p.y+p.dy,z:p.z+1})),units:s.units.filter(p=>p.team==='squad'||s.detected.has(p.id))};}
export function navigationPath(s,u,x,y,z=levelOf(u)){if(!inBounds(x,y,z))return null;return pathTo(navigationState(s),u,x,y,z);}

export function move(s,u,x,y,z=levelOf(u)){
 if(!canControl(s,u))return false;const path=navigationPath(s,u,x,y,z);if(!path?.length)return false;
 if(s.phase==='player'&&path[0].cost>u.ap)return false;
 u.overwatch=null;s.queue=path.map(p=>({id:u.id,...p,goal:{x,y,z}}));return true;
}
export function stepMovement(s){
 if(!s.queue.length||!['explore','player','won'].includes(s.phase))return false;
 if(s.queue[0].group)return stepGroupMovement(s);
 let step=s.queue[0];const actor=s.units[step.id];if(step.goal&&canControl(s,actor)){const goal=step.goal,path=navigationPath(s,actor,goal.x,goal.y,goal.z);if(!path?.length){s.queue=[];log(s,'Route stopped: destination reached or no discovered route remains.');return false;}s.queue=path.map(p=>({id:actor.id,...p,goal}));}step=s.queue.shift();const u=s.units[step.id],currentStep=u&&movementNeighbors(s,u).find(p=>p.x===step.x&&p.y===step.y&&p.z===levelOf(step));if(!canControl(s,u)||!currentStep||occupant(s,step.x,step.y,levelOf(step))||(s.phase==='player'&&u.ap<currentStep.cost)){s.queue=[];return false;}
 u.heading=headingTo(u,step);u.facing=(step.x-u.x)-(step.y-u.y)>=0?1:-1;u.x=step.x;u.y=step.y;u.z=levelOf(step);u.steps++;u.overwatch=null;emitNoise(s,u,u.sneaking?3:10);if(s.phase==='player')u.ap-=currentStep.cost;enterFire(s,u);refresh(s);return true;
}
export function coverAgainst(s,a,b){
 const occupied=PROPS[propAt(s,b.x,b.y,levelOf(b))?.kind];
 if(occupied&&!occupied.solid&&occupied.cover>0)return true;
 const dx=a.x-b.x,dy=a.y-b.y;if(dx===0&&dy===0)return false;const cells=[];if(Math.abs(dx)>=Math.abs(dy)*.5)cells.push([b.x+Math.sign(dx),b.y]);if(Math.abs(dy)>=Math.abs(dx)*.5)cells.push([b.x,b.y+Math.sign(dy)]);
 return cells.some(([x,y])=>tile(s,x,y,levelOf(b))==='crate'||PROPS[propAt(s,x,y,levelOf(b))?.kind]?.cover>0||(EDGES[s.edges[edgeBetween(b,{x,y,z:levelOf(b)})]]?.cover||0)>0);
}
const retaliationToken=Symbol('retaliation');
export function previewAttack(s,a,b,burst=false,zone='torso',token=null){
 if(!a||!b||!alive(a)||!alive(b)||a.team===b.team&&token!==retaliationToken)return {ok:false,reason:'Choose a living opponent'};
 if(WEAPONS[a.weapon].blast)return explosivePreview(s,a,b,WEAPONS[a.weapon]);
 if(!Object.hasOwn(AIM_ZONES,zone))return {ok:false,reason:'Choose an aim location'};
 const aim=AIM_ZONES[zone];
 const w=WEAPONS[a.weapon],rounds=burst&&a.weapon==='assault'?3:1,cost=w.cost+(rounds===3?2:0),melee=w.mag===0,range=melee?distance(a,b):Math.hypot(a.x-b.x,a.y-b.y);
 const visible=token!==retaliationToken&&a.team==='squad'?squad(s).some(p=>canSee(s,p,b)):canSee(s,a,b);
 const cover=!melee&&coverAgainst(s,a,b),heightCover=!melee&&levelOf(b)>levelOf(a)&&(a.x!==b.x||a.y!==b.y),coverPenalty=cover?25:heightCover?15:0,rangePenalty=melee?0:Math.max(0,levelOf(b)-levelOf(a)),effectiveRange=Math.max(0,w.range-rangePenalty);
 const chance=Math.max(10,Math.min(95,a.accuracy+(melee?10:0)+aim.accuracy-Math.max(0,range+rangePenalty-3)*3-coverPenalty-(rounds===3?10:0)));
 let reason='';
 if(a.burningTurns>0)reason='On fire: running in panic';else if(melee&&zone!=='torso')reason='Aimed shots require a firearm';else if(!visible)reason='Target not visible';else if(!inCone(a,b))reason='Outside personal sight cone';else if(range>effectiveRange)reason='Out of range';else if(!lineOfSight(s,a,b))reason='Line of fire blocked';else if(w.mag&&a.ammo[a.weapon]<rounds)reason='Reload required';else if(!['explore','won'].includes(s.phase)&&a.ap<cost)reason='Not enough AP';
 let obstruction=null;
 if(!reason&&!melee&&!w.incendiary){const path=bulletTrajectory(s,a,b,{accurate:true,zone,reach:w.range*1.5},()=>0);if(path.unitId!==b.id){const unit=s.units.find(u=>u.id===path.unitId);obstruction=unit?{kind:'unit',id:unit.id,name:unit.name,friendly:unit.team===a.team}:{kind:path.kind};}}
 return {ok:!reason,reason,cost,rounds,chance:Math.round(chance),cover,heightCover,coverPenalty,rangePenalty,damage:Math.round(w.damage*aim.damage),zone,range:effectiveRange,tankChance:melee?0:tankExplosionChance(b,zone),obstruction};
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function combatDamage(s,u,damage,fatal=false,source=null){
 const living=alive(u),before=u.hp;u.hp=Math.max(0,u.hp-damage);injuryStrain(u,before-u.hp);
 if(u.hp>0)return;
 if(living)killRelief(source,u);
 if(u.team==='guard'&&living&&!u.lootDropped){delete s.contacts[u.id];awardCombatXP(s);syncWeapons(u);s.loot.push({x:u.x,y:u.y,z:levelOf(u),items:u.pack});u.pack=[];u.lootDropped=true;}
 if(u.team==='squad'&&(living||fatal&&incapacitated(u))){u.casualty=fatal?'dead':s.difficulty==='easy'?'stable':'bleeding';u.bleedTurns=u.casualty==='bleeding'?6:0;u.ap=0;u.overwatch=null;s.queue=[];}
}
function ignite(s,u){
 if(!alive(u)||u.burningTurns>0)return;
 u.burningTurns=3;u.ap=0;u.overwatch=null;u.stance='standing';u.sneaking=false;
 if(u.team==='guard')u.alert=true;
 s.queue=[];log(s,u.name+' is on fire / panic for 3 turns.');
}
function enterFire(s,u){if(s.fires?.some(p=>p.x===u.x&&p.y===u.y&&p.z===levelOf(u)))ignite(s,u);}
function panicRun(s,u){
 if(!alive(u)||!u.burningTurns)return;
 const heading=Math.floor(random(s)*8)*45;
 for(let step=0;step<3;step++){
  const choices=movementNeighbors(s,u).filter(p=>levelOf(p)===levelOf(u)&&!occupant(s,p.x,p.y,p.z));
  if(!choices.length)break;
  choices.sort((a,b)=>Math.cos((headingTo(u,b)-heading)*Math.PI/180)-Math.cos((headingTo(u,a)-heading)*Math.PI/180));
  const p=choices[0];u.heading=headingTo(u,p);u.facing=(p.x-u.x)-(p.y-u.y)>=0?1:-1;u.x=p.x;u.y=p.y;u.steps++;emitNoise(s,u,15);
 }
 u.ap=0;u.fireActedRound=s.round;
 log(s,u.name+' runs in panic / '+u.burningTurns+' turns of fire.');
}
function finishFireRound(s){
 for(const u of s.units)if(u.burningTurns>0&&u.fireActedRound===s.round){u.burningTurns--;if(!u.burningTurns)log(s,u.name+' is no longer on fire.');}
 s.fires=(s.fires||[]).map(p=>({...p,turns:p.turns-1})).filter(p=>p.turns>0);
}
function explodeTanks(s,wearer,source=null){
 wearer.tanksExploded=true;wearer.ammo.flamethrower=0;
 wearer.pack=wearer.pack.filter(i=>i.kind!=='flamethrower');wearer.slots=wearer.slots.map(id=>id==='flamethrower'?null:id);
 if(wearer.weapon==='flamethrower')wearer.weapon='hands';wearer.overwatch=null;
 const z=levelOf(wearer);s.fires||=[];
 for(let y=wearer.y-5;y<=wearer.y+5;y++)for(let x=wearer.x-5;x<=wearer.x+5;x++)if(inBounds(x,y,z)&&Math.hypot(x-wearer.x,y-wearer.y)<=5&&!['void','water'].includes(tile(s,x,y,z))){const old=s.fires.find(p=>p.x===x&&p.y===y&&p.z===z);if(old)old.turns=3;else s.fires.push({x,y,z,turns:3});}
 const victims=s.units.filter(u=>(alive(u)||incapacitated(u))&&levelOf(u)===z&&Math.max(Math.abs(u.x-wearer.x),Math.abs(u.y-wearer.y))<=1);
 for(const u of victims)combatDamage(s,u,Math.max(u.hp,1),true,source);
 for(const u of s.units)if(levelOf(u)===z&&Math.hypot(u.x-wearer.x,u.y-wearer.y)<=5)ignite(s,u);
 log(s,`${wearer.name}'s fuel tanks exploded / ${victims.length} caught in blast.`);
 return {x:wearer.x,y:wearer.y,z:levelOf(wearer)};
}
export function attack(s,a,b,burst=false,byAI=false,zone='torso',reaction=false){
 if(s.queue.length)return false;
 if(reaction?!(s.phase==='enemy'&&a?.team==='squad'&&alive(a)&&!a.burningTurns&&a.overwatch?.weapon===a.weapon&&a.overwatch.heading===a.heading&&!burst&&zone==='torso'&&canSee(s,a,b)):byAI?!(s.phase==='enemy'&&a?.team==='guard'&&alive(a)&&!a.burningTurns):!canControl(s,a))return false;
 const p=previewAttack(s,reaction?{...a,ap:WEAPONS[a.weapon].cost}:a,b,burst,zone);if(!p.ok)return false;a.overwatch=null;
 if(b.team==='guard'){b.alert=true;b.lastKnown={x:a.x,y:a.y,z:levelOf(a)};}if(s.phase==='explore'){b.alert=true;refresh(s);} // Opening attacks always spend combat AP.
 if(!reaction&&!(b.ground&&['explore','won'].includes(s.phase)))a.ap-=p.cost;
 const trajectories=[],explosions=[],sequence=[];
 // A stack suspends the current burst while a reply resolves; ammunition bounds chains.
 const frames=[{a,b,p,zone,left:p.rounds,weapon:a.weapon,aim:{...b},reply:false}];
 while(frames.length){
  const f=frames.at(-1),shooter=f.a,target=f.b,w=WEAPONS[f.weapon];
  if(!f.left||!alive(shooter)||shooter.burningTurns||w.mag&&shooter.ammo[f.weapon]<1){frames.pop();continue;}
  f.left--;shooter.overwatch=null;shooter.heading=headingTo(shooter,f.aim);shooter.facing=(f.aim.x-shooter.x)-(f.aim.y-shooter.y)>=0?1:-1;
  emitNoise(s,shooter,w.mag?30:2);if(w.mag)shooter.ammo[f.weapon]--;
  const accurate=w.blast?false:random(s)*100<f.p.chance,ballistic=w.mag&&!w.incendiary;
  const shot=w.blast?explosiveTrajectory(s,shooter,f.aim,w,f.p,()=>random(s)):ballistic?bulletTrajectory(s,shooter,f.aim,{accurate,zone:f.zone,chance:f.p.chance,burst:f.p.rounds>1,reach:w.range*1.5},()=>random(s)):null;
  if(shot)trajectories.push(shot);
  const victim=ballistic?s.units.find(u=>u.id===shot.unitId):accurate&&alive(target)?target:null;
  const event={ax:shooter.x,ay:shooter.y,bx:f.aim.x,by:f.aim.y,az:levelOf(shooter),bz:levelOf(f.aim),hit:!!victim,incendiary:!!w.incendiary,trajectories:shot?[shot]:[],explosions:[],reply:f.reply};sequence.push(event);
  const blastResult=w.blast?detonate(s,shot,w):null;
  if(blastResult){event.explosions.push(blastResult.blast);explosions.push(blastResult.blast);event.hit=blastResult.hits.length>0;log(s,`${shooter.name}: ${w.short} detonated / ${blastResult.blast.destroyed} structures destroyed.`);}
  if(!victim&&!blastResult){log(s,`${shooter.name} → ${target.name}: miss${f.reply?' / retaliation':''}.`);continue;}
  const impacts=blastResult?blastResult.hits:[{unit:victim,damage:Math.round(Math.round(w.damage*AIM_ZONES[shot?.zone||f.zone].damage)*(shooter.team==='guard'&&!w.incendiary?.65:1))}];
  for(const {unit:victim,damage:amount}of impacts){
  const hitZone=w.blast?'torso':shot?.zone||f.zone;
  if(victim.team==='guard'){victim.alert=true;victim.lastKnown={x:shooter.x,y:shooter.y,z:levelOf(shooter)};}
  const tankChance=w.mag?tankExplosionChance(victim,hitZone):0;
  if(tankChance>0&&random(s)<tankChance){const blast=explodeTanks(s,victim,shooter);explosions.push(blast);event.explosions.push(blast);}
  else {combatDamage(s,victim,amount,!!w.incendiary||incapacitated(victim),shooter);if(w.incendiary)ignite(s,victim);}
  const friendly=victim.team===shooter.team;
  log(s,`${shooter.name} → ${victim.name}: ${amount} damage${friendly?' / friendly fire':''}${f.reply?' / retaliation':''}${!alive(victim)?' / down':''}.`);
  if(friendly&&victim!==shooter&&victim.team==='squad'&&alive(victim)){
   const armed=WEAPONS[victim.weapon].mag>0,turned={...victim,heading:headingTo(victim,shooter),ap:WEAPONS[victim.weapon].cost};
   const reply=armed&&alive(shooter)?previewAttack(s,turned,shooter,false,'torso',retaliationToken):{ok:false};
   const response=friendlyReaction(s,victim,shooter,amount,reply.ok);
   if(response){event.dialogue=`${response.speaker}: “${response.line}”`;log(s,event.dialogue);if(response.retaliate){frames.push({a:victim,b:shooter,p:reply,zone:'torso',left:1,weapon:victim.weapon,aim:{...shooter},reply:true});}}
  }
 }
 }
 s.effect={...sequence[0],trajectories,explosions,explosion:explosions.at(-1),sequence};
 refresh(s);if(byAI)resolveOverwatch(s,a);return true;
}

export function groundTarget(point){return {...point,id:'ground',name:'Terrain',team:'terrain',hp:1,ground:true,weapon:'hands'};}
export function attackGround(s,u,point){if(!WEAPONS[u?.weapon]?.blast)return false;return attack(s,u,groundTarget(point));}
export function equip(s,u,id,slot=1){if(!canControl(s,u)||s.queue.length||!WEAPONS[id]||u.weapon===id||!(id==='hands'||u.pack.some(i=>i.type==='weapon'&&i.kind===id)))return false;const stored=id!=='hands'&&!u.slots.includes(id),cost=stored?3:0;if(s.phase==='player'&&u.ap<cost)return false;const slots=[...u.slots];if(stored)slots[slot===0?0:1]=id;const layout=gridLayout({...u,slots});if(!layout.ok)return false;if(s.phase==='player')u.ap-=cost;u.slots=slots;storeLayout(u,layout);u.weapon=id;if(id==='flamethrower')delete u.tanksExploded;u.overwatch=null;log(s,u.name+' equipped '+WEAPONS[id].name+'.');return true;}
export function equipCutters(s,u,slot){
 if(!canControl(s,u)||s.queue.length||!u.wireCutters||![0,1].includes(slot)||u.slots.includes('wireCutters'))return false;
 const cost=s.phase==='player'?3:0;if(u.ap<cost)return false;
 const slots=[...u.slots],replaced=slots[slot];slots[slot]='wireCutters';const layout=gridLayout({...u,slots});if(!layout.ok)return false;
 u.ap-=cost;u.slots=slots;storeLayout(u,layout);if(u.weapon===replaced)u.weapon='hands';u.overwatch=null;
 log(s,u.name+' equipped wire cutters in the '+(slot?'secondary':'primary')+' slot.');return true;
}
export function stowWeapon(s,u,slot){if(!canControl(s,u)||s.queue.length||![0,1].includes(slot)||!u.slots[slot])return false;const slots=[...u.slots],kind=slots[slot];slots[slot]=null;const layout=gridLayout({...u,slots});if(!layout.ok)return false;u.slots=slots;storeLayout(u,layout);if(u.weapon===kind)u.weapon='hands';u.overwatch=null;log(s,'Equipment moved to backpack.');return true;}
export function arrangeInventory(s,u,key,cell){if(!canControl(s,u)||s.queue.length||!placeItem(u,key,cell))return false;log(s,'Backpack rearranged.');return true;}
export function reload(s,u,byAI=false){if(byAI?!(s.phase==='enemy'&&u?.team==='guard'&&alive(u)&&!u.burningTurns):!canControl(s,u))return false;const w=WEAPONS[u.weapon],count=Math.min(w.mag-u.ammo[u.weapon],reserve(u,u.weapon));if(s.queue.length||!w.mag||count<=0||(!['explore','won'].includes(s.phase)&&u.ap<3))return false;if(!['explore','won'].includes(s.phase))u.ap-=3;u.overwatch=null;u.ammo[u.weapon]+=count;consumeAmmo(u,u.weapon,count);syncWeapons(u);log(s,u.name+' reloaded '+count+' rounds.');return true;}
export function inventoryTransfer(s,u,index,mode,target=null){if(!canControl(s,u)||s.queue.length)return false;const near=p=>levelOf(u)===levelOf(p)&&Math.abs(u.x-p.x)+Math.abs(u.y-p.y)<=1&&(u.x===p.x&&u.y===p.y||!blockedEdge(s,u,p));if(mode==='take'){if(!s.loot.includes(target)||!near(target))return false;const item=target.items[index];if(!item||!accepts(u,item))return false;target.items.splice(index,1);receive(u,item);}else{syncWeapons(u);const item=u.pack[index];if(!item)return false;if(mode==='give'){if(!s.units.includes(target)||target===u||!alive(target)||target.team!=='squad'||!near(target)||!accepts(target,item))return false;receive(target,item);}else if(mode==='drop'){let pile=s.loot.find(p=>p.x===u.x&&p.y===u.y&&levelOf(p)===levelOf(u));if(!pile){pile={x:u.x,y:u.y,z:levelOf(u),items:[]};s.loot.push(pile);}pile.items.push(item);}else return false;u.pack.splice(index,1);if(item.type==='weapon'){u.slots=u.slots.map(k=>k===item.kind?null:k);if(u.weapon===item.kind)u.weapon='hands';u.overwatch=null;}}log(s,'Inventory updated.');return true;}
export function endTurn(s){if(s.phase!=='player'||s.queue.length)return false;for(const u of s.units)if(u.casualty==='bleeding'&&--u.bleedTurns<=0){u.casualty='dead';log(s,u.name+' died from blood loss.');}for(const u of s.units)panicRun(s,u);s.phase='enemy';s.enemyIndex=0;for(const g of guards(s))g.ap=g.burningTurns?0:g.maxAp;log(s,'Guard turn.');return true;}
export function stepEnemy(s){
 if(s.phase!=='enemy')return false;
 const g=s.units[s.enemyIndex];
 if(!g){finishFireRound(s);s.phase='player';s.round++;for(const p of squad(s)){p.ap=p.burningTurns?0:p.maxAp;p.overwatch=null;settleStress(p,2);}refresh(s);log(s,`Squad turn / ${s.round}.`);return true;}
 if(g.team!=='guard'||!alive(g)||g.burningTurns>0||!g.alert||g.ap<1){s.enemyIndex++;return true;}
 const targets=squad(s).filter(p=>canSee(s,g,p)).sort((a,b)=>distance(g,a)-distance(g,b));
 const target=targets[0];if(target)g.lastKnown={x:target.x,y:target.y,z:levelOf(target)};
 if(target&&previewAttack(s,g,target).ok){attack(s,g,target,false,true);return true;}
 if(target&&previewAttack(s,g,target).reason==='Not enough AP'){g.ap=0;s.enemyIndex++;return true;}
 if(WEAPONS[g.weapon].mag&&g.ammo[g.weapon]===0&&reload(s,g,true))return true;
 const dest=g.lastKnown;if(!dest){g.heading=(g.heading+45)%360;s.enemyIndex++;refresh(s);return true;}if(dest&&!inCone(g,dest)){g.heading=headingTo(g,dest);refresh(s);return true;}if(dest){let best=null;for(const q of neighbors(s,dest)){if(!WEAPONS[g.weapon].mag&&distance(q,dest)>WEAPONS[g.weapon].range)continue;const path=pathTo(s,g,q.x,q.y,q.z);if(path?.length&&(!best||pathCost(path)<pathCost(best)))best=path;}
  if(best&&best[0].cost<=g.ap){const p=best[0];g.heading=headingTo(g,p);g.facing=(p.x-g.x)-(p.y-g.y)>=0?1:-1;g.x=p.x;g.y=p.y;g.z=levelOf(p);g.steps++;g.ap-=p.cost;enterFire(s,g);refresh(s);resolveOverwatch(s,g);return true;}}
 g.ap=0;s.enemyIndex++;return true;
}

export function stabilizePreview(s,medic,patient){const cost=medicalCost(medic);let reason='';if(!canControl(s,medic)||s.queue.length)reason='Cannot act now';else if(!s.units.includes(patient)||patient.team!=='squad'||patient.casualty!=='bleeding'||patient.bleedTurns<=0)reason='Choose a bleeding teammate';else if(!medic.medkits)reason='No medkits remaining';else if(levelOf(medic)!==levelOf(patient)||Math.abs(medic.x-patient.x)+Math.abs(medic.y-patient.y)!==1||blockedEdge(s,medic,patient))reason='Stand beside the casualty with an open edge';else if(s.phase==='player'&&medic.ap<cost)reason='Not enough AP';return {ok:!reason,reason,cost};}
export function stabilize(s,medic,patient){const p=stabilizePreview(s,medic,patient);if(!p.ok)return false;if(s.phase==='player')medic.ap-=p.cost;medic.medkits--;patient.casualty='stable';patient.bleedTurns=0;const thanks=helped(patient,medic);if(thanks)log(s,patient.name+': '+thanks);log(s,medic.name+' stabilized '+patient.name+'.');refresh(s);return true;}
export function cutPreview(s,u,edge){let reason='';const cost=4;if(!canControl(s,u)||s.queue.length)reason='Cannot act now';else if(!u.wireCutters)reason='Wire cutters required';else if(!u.slots.includes('wireCutters'))reason='Equip wire cutters in a held slot';else if(s.edges[edge]!=='fence-chainlink')reason='Choose a chain-link fence';else if(!edgeCells(edge).some(p=>p.x===u.x&&p.y===u.y&&levelOf(p)===levelOf(u)))reason='Stand beside the fence';else if(s.phase==='player'&&u.ap<cost)reason='Not enough AP';return {ok:!reason,reason,cost};}
export function cutFence(s,u,edge){const p=cutPreview(s,u,edge);if(!p.ok)return false;if(s.phase==='player')u.ap-=p.cost;s.edges[edge]='fence-cut';u.overwatch=null;log(s,u.name+' cut a passable opening in the fence.');refresh(s);return true;}

export function moveGroup(s,ids,leader,x,y,z=levelOf(leader)){
 const members=[...new Set(ids)].map(id=>s.units[id]);if(!members.length||!members.includes(leader)||members.some(u=>!canControl(s,u)||levelOf(u)!==levelOf(leader)))return false;
 const dx=x-leader.x,dy=y-leader.y,reserved=new Set(),orders=[];
 // Selected comrades vacate their starts; execution still checks real occupancy.
 const planning=navigationState(s);planning.units=planning.units.filter(u=>!members.includes(u));
 // Frontmost members vacate space first; every member still takes at most one step per tick.
 members.sort((a,b)=>(b.x*dx+b.y*dy)-(a.x*dx+a.y*dy));
 for(const u of members){const gx=u.x+dx,gy=u.y+dy,candidates=[];for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++)candidates.push({x:gx+ox,y:gy+oy,z,d:ox*ox+oy*oy});candidates.sort((a,b)=>a.d-b.d);let found=null;for(const goal of candidates){if(reserved.has(key(goal.x,goal.y,z)))continue;const path=inBounds(goal.x,goal.y,z)?pathTo(planning,u,goal.x,goal.y,z):null;if(path&&(path.length||u.x===goal.x&&u.y===goal.y&&levelOf(u)===z)){if(s.phase==='player'&&path.length&&path[0].cost>u.ap)continue;found=goal;break;}}if(!found)return false;reserved.add(key(found.x,found.y,z));orders.push({id:u.id,goal:{x:found.x,y:found.y,z}});}
 if(orders.every(o=>{const u=s.units[o.id];return u.x===o.goal.x&&u.y===o.goal.y&&levelOf(u)===z;}))return false;for(const u of members)u.overwatch=null;s.queue=[{group:orders}];log(s,'Group movement ordered for '+orders.length+' comrades.');return true;
}
function stepGroupMovement(s){const order=s.queue[0];let moved=false;for(const entry of order.group){const u=s.units[entry.id],goal=entry.goal;if(!canControl(s,u)){s.queue=[];return moved;}if(u.x===goal.x&&u.y===goal.y&&levelOf(u)===goal.z)continue;const path=navigationPath(s,u,goal.x,goal.y,goal.z),step=path?.[0],valid=step&&movementNeighbors(s,u).find(p=>p.x===step.x&&p.y===step.y&&p.z===step.z);if(!valid||occupant(s,step.x,step.y,step.z)||(s.phase==='player'&&u.ap<valid.cost)){s.queue=[];log(s,'Group stopped: route blocked or a comrade lacks AP.');return moved;}u.heading=headingTo(u,step);u.facing=(step.x-u.x)-(step.y-u.y)>=0?1:-1;u.x=step.x;u.y=step.y;u.z=step.z;u.steps++;u.overwatch=null;emitNoise(s,u,u.sneaking?3:10);if(s.phase==='player')u.ap-=valid.cost;enterFire(s,u);moved=true;refresh(s);if(s.queue[0]!==order)return moved;}
 if(order.group.every(e=>{const u=s.units[e.id];return u.x===e.goal.x&&u.y===e.goal.y&&levelOf(u)===e.goal.z;}))s.queue=[];return moved;
}

export function turnTo(s,u,heading){if(!canControl(s,u)||s.queue.length||!Number.isFinite(heading))return false;heading=((heading%360)+360)%360;if(heading===u.heading)return false;u.overwatch=null;u.heading=heading;u.facing=Math.cos(heading*Math.PI/180)-Math.sin(heading*Math.PI/180)>=0?1:-1;refresh(s);return true;}

export function setSneaking(s,u){if(!canControl(s,u)||s.queue.length)return false;u.sneaking=!u.sneaking;u.overwatch=null;refresh(s);return true;}
export function emitNoise(s,u,radius){if(u.team!=='squad')return;for(const g of guards(s))if(!canSee(s,g,u)&&distance(g,u)<=radius){g.lastHeard={x:Math.max(0,Math.min(W-1,Math.round(u.x/6)*6)),y:Math.max(0,Math.min(H-1,Math.round(u.y/6)*6)),z:levelOf(u)};g.searchSteps=12;}}
export function stepInvestigation(s){if(!['explore','won'].includes(s.phase))return false;for(const g of guards(s))if(g.lastHeard&&g.searchSteps>0){const dest=g.lastHeard;g.heading=headingTo(g,dest);const path=pathTo(s,g,dest.x,dest.y,dest.z);g.searchSteps--;if(path?.length){const p=path[0];g.x=p.x;g.y=p.y;g.z=p.z;g.steps++;}else g.searchSteps=0;if(!g.searchSteps)g.lastHeard=null;refresh(s);return true;}return false;}
export function setOverwatch(s,u){if(!canControl(s,u)||s.phase!=='player'||s.queue.length||u.overwatch||!WEAPONS[u.weapon].mag||u.ammo[u.weapon]<1||u.ap<WEAPONS[u.weapon].cost)return false;u.ap-=WEAPONS[u.weapon].cost;u.overwatch={weapon:u.weapon,heading:u.heading};log(s,u.name+' reserved one overwatch shot.');return true;}
export function resolveOverwatch(s,g){if(s.phase!=='enemy'||!alive(g))return;for(const u of squad(s)){const watch=u.overwatch;if(!watch)continue;if(watch.weapon!==u.weapon||watch.heading!==u.heading){u.overwatch=null;continue;}if(canSee(s,u,g)&&previewAttack(s,{...u,ap:WEAPONS[u.weapon].cost},g).ok){attack(s,u,g,false,false,'torso',true);if(!alive(g)||s.phase!=='enemy')break;}}}

export function allocateSkill(s,u,skill){if(!canControl(s,u)||s.queue.length||!['explore','won'].includes(s.phase)||!train(u,skill))return false;log(s,u.name+' trained '+skill+'.');refresh(s);return true;}
