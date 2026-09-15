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
 assault:{name:'AK-47',short:'AK-47',cost:4,range:10,damage:26,mag:30}
};
export const STANCES={standing:{label:'Standing',moveCost:2},kneeling:{label:'Kneeling',moveCost:4},prone:{label:'Prone',moveCost:8}};
export const stanceOf=u=>Object.hasOwn(STANCES,u?.stance)?u.stance:'standing';
export function movementNeighbors(s,u,p=u,stairs){return neighbors(s,p,stairs).filter(q=>(levelOf(q)===levelOf(p)||stanceOf(u)==='standing')&&!(levelOf(q)===levelOf(p)&&q.x!==p.x&&q.y!==p.y&&[occupant(s,q.x,p.y,levelOf(p)),occupant(s,p.x,q.y,levelOf(p))].some(v=>v&&v!==u))).map(q=>({...q,cost:levelOf(q)===levelOf(p)?STANCES[stanceOf(u)].moveCost*q.cost:q.cost}));}
export const key=tileKey;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(levelOf(a)-levelOf(b))*3);
export const alive=u=>u.hp>0;
export const squad=s=>s.units.filter(u=>u.team==='squad'&&alive(u));
export const guards=s=>s.units.filter(u=>u.team==='guard'&&alive(u));
export const occupant=(s,x,y,z=0)=>s.units.find(u=>alive(u)&&u.x===x&&u.y===y&&levelOf(u)===z);
export const tile=(s,x,y,z=0)=>terrainAt(s,x,y,z);
export const walkable=(s,x,y,z=0)=>passable(s,{x,y,z});
export function log(s,message){s.log.unshift(message);s.log=s.log.slice(0,50);s.revision++;}
export function createGame(seed=1947,definition=factoryMap(),detect=true){
 const errors=validateMap(definition);if(errors.length)throw Error(errors.join(' '));
 const s={map:structuredClone(definition.terrain),upper:structuredClone(definition.upper),stairs:structuredClone(definition.stairs),climbs:structuredClone(definition.climbs||[]),props:structuredClone(definition.props||[]),sectors:structuredClone(definition.sectors),edges:{...definition.edges},definition:structuredClone(definition),units:[],phase:'explore',round:0,selected:0,visible:new Set(),seen:new Set(),detected:new Set(),log:[],seed,revision:0,queue:[],enemyIndex:0,effect:null};
 const add=(team,name,species,x,y,weapon,z=0)=>s.units.push({id:s.units.length,team,name,species,x,y,z,stance:'standing',hp:team==='squad'?100:45,maxHp:team==='squad'?100:45,ap:team==='squad'?12:7,maxAp:team==='squad'?12:7,accuracy:team==='squad'?85:55,weapon,ammo:Object.fromEntries(Object.entries(WEAPONS).map(([k,v])=>[k,v.mag])),alert:false,lastKnown:null,facing:1,steps:0});
 const cast=[['Yakov','horse','assault'],['Anya','goat','rifle'],['Misha','donkey','pistol'],['Vera','sheep','knife']];
 definition.starts.forEach((p,i)=>add('squad',cast[i][0],cast[i][1],p.x,p.y,cast[i][2],levelOf(p)));
 const names=['Boris','Lev','Grigori','Oleg','Pavel','Igor','Anton','Vadim','Yuri','Sasha','Pyotr','Nikolai'];
 definition.guards.forEach((g,i)=>add('guard',names[i]||`Guard ${i+1}`,g.species,g.x,g.y,g.weapon,levelOf(g)));
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
 const start=key(u.x,u.y,levelOf(u)),goal=key(x,y,z),occupied=new Set(s.units.filter(p=>alive(p)&&p!==u).map(p=>key(p.x,p.y,levelOf(p)))),stairs=stairSet(s);
 const heuristic=p=>{const dx=Math.abs(p.x-x),dy=Math.abs(p.y-y);return (Math.max(dx,dy)+.5*Math.min(dx,dy))*STANCES[stanceOf(u)].moveCost+2*Math.abs(levelOf(p)-z);},heap=[],scores=new Map([[start,0]]),parents=new Map();
 const deviation=p=>Math.abs((p.x-u.x)*(y-u.y)-(p.y-u.y)*(x-u.x));const less=(a,b)=>a.f<b.f||(a.f===b.f&&(deviation(a)<deviation(b)||(deviation(a)===deviation(b)&&a.g>b.g)));
 const push=n=>{heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!less(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],heap[i]))break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return first;};
 push({...u,z:levelOf(u),k:start,g:0,f:heuristic(u)});
 while(heap.length){const p=pop();if(p.g!==scores.get(p.k))continue;if(p.k===goal){const path=[];let k=goal;while(k!==start){const entry=parents.get(k);path.push(entry.point);k=entry.parent;}return path.reverse();}
  for(const q of movementNeighbors(s,u,p,stairs)){const k=key(q.x,q.y,q.z),g=p.g+q.cost;if(occupied.has(k)||g>=(scores.get(k)??Infinity))continue;scores.set(k,g);parents.set(k,{parent:p.k,point:q});push({...q,k,g,f:g+heuristic(q)});}
 }return null;
}
export const sightRange=()=>CHARACTER_RANGE;
export const canSee=(s,a,b)=>distance(a,b)<=sightRange(a,b)&&lineOfSight(s,a,b);
export function refresh(s){
 const oldDetected=s.detected,oldVisible=s.visible;s.visible=terrainVisibility(s,squad(s));s.detected=new Set(guards(s).filter(g=>squad(s).some(p=>canSee(s,p,g))).map(g=>g.id));
 if(s.queue.length&&[...s.detected].some(id=>!oldDetected.has(id))){s.queue=[];log(s,'Movement stopped: new opponent spotted.');}
 if(s.visible!==oldVisible||s.seen.size<s.visible.size)for(const k of s.visible)s.seen.add(k);
 if(!squad(s).length){if(s.phase!=='lost')log(s,'The squad has fallen. Restart the test to try again.');s.phase='lost';s.queue=[];return;}
 if(!alive(s.units[s.selected]))s.selected=squad(s)[0].id;
 if(!guards(s).length){if(s.phase!=='won'){log(s,'Local map cleared. Explore or gather at the travel marker.');s.queue=[];}s.phase='won';s.revision++;return;}
 for(const g of guards(s)){if(squad(s).some(p=>canSee(s,p,g)))g.alert=true;const targets=squad(s).filter(p=>canSee(s,g,p));if(targets.length){g.alert=true;const p=targets.sort((a,b)=>distance(g,a)-distance(g,b))[0];g.lastKnown={x:p.x,y:p.y,z:levelOf(p)};}}
 const contact=guards(s).some(g=>g.alert);
 if(s.phase==='explore'&&contact){s.phase='player';s.round++;s.queue=[];for(const u of s.units)u.ap=u.maxAp;log(s,'CONTACT / Squad turn. Movement costs 2 / 4 / 8 AP per tile: standing / kneeling / prone.');}
 else if((s.phase==='player'||s.phase==='enemy')&&!contact){s.phase='explore';s.queue=[];log(s,'Area clear. Real-time exploration resumed.');}
 if(!alive(s.units[s.selected]))s.selected=squad(s)[0].id;
 s.revision++;
}
export function canControl(s,u){return u&&alive(u)&&u.team==='squad'&&['explore','player','won'].includes(s.phase);}
export function setStance(s,u,stance){
 if(!Object.hasOwn(STANCES,stance)||!canControl(s,u)||s.queue.length||stanceOf(u)===stance||(s.phase==='player'&&u.ap<2))return false;
 if(s.phase==='player')u.ap-=2;u.stance=stance;log(s,u.name+' is '+stance+'.');return true;
}

export function navigationState(s){const known=p=>s.seen.has(key(p.x,p.y,levelOf(p))),knowledge=new Set(s.seen);for(const p of s.climbs)if(known(p)||known({x:p.x+p.dx,y:p.y+p.dy,z:p.z+1}))for(const q of [p,{x:p.x,y:p.y,z:p.z+1},{x:p.x+p.dx,y:p.y+p.dy,z:p.z+1}])knowledge.add(key(q.x,q.y,q.z));return {...s,knowledge,edges:Object.fromEntries(Object.entries(s.edges).filter(([k])=>edgeCells(k).some(known))),props:s.props.filter(p=>propCells(p).some(known)),stairs:s.stairs.filter(p=>known(p)||known({...p,z:p.z+1})),climbs:s.climbs.filter(p=>known(p)||known({x:p.x+p.dx,y:p.y+p.dy,z:p.z+1})),units:s.units.filter(p=>p.team==='squad'||s.detected.has(p.id))};}
export function navigationPath(s,u,x,y,z=levelOf(u)){if(!inBounds(x,y,z))return null;return pathTo(navigationState(s),u,x,y,z);}

export function move(s,u,x,y,z=levelOf(u)){
 if(!canControl(s,u))return false;const path=navigationPath(s,u,x,y,z);if(!path?.length)return false;
 if(s.phase==='player'&&path[0].cost>u.ap)return false;
 s.queue=path.map(p=>({id:u.id,...p,goal:{x,y,z}}));return true;
}
export function stepMovement(s){
 if(!s.queue.length||!['explore','player','won'].includes(s.phase))return false;
 let step=s.queue[0];const actor=s.units[step.id];if(step.goal&&canControl(s,actor)){const goal=step.goal,path=navigationPath(s,actor,goal.x,goal.y,goal.z);if(!path?.length){s.queue=[];log(s,'Route stopped: destination reached or no discovered route remains.');return false;}s.queue=path.map(p=>({id:actor.id,...p,goal}));}step=s.queue.shift();const u=s.units[step.id],currentStep=u&&movementNeighbors(s,u).find(p=>p.x===step.x&&p.y===step.y&&p.z===levelOf(step));if(!canControl(s,u)||!currentStep||occupant(s,step.x,step.y,levelOf(step))||(s.phase==='player'&&u.ap<currentStep.cost)){s.queue=[];return false;}
 u.facing=(step.x-u.x)-(step.y-u.y)>=0?1:-1;u.x=step.x;u.y=step.y;u.z=levelOf(step);u.steps++;if(s.phase==='player')u.ap-=currentStep.cost;refresh(s);return true;
}
export function coverAgainst(s,a,b){
 const dx=a.x-b.x,dy=a.y-b.y;if(dx===0&&dy===0)return false;const cells=[];if(Math.abs(dx)>=Math.abs(dy)*.5)cells.push([b.x+Math.sign(dx),b.y]);if(Math.abs(dy)>=Math.abs(dx)*.5)cells.push([b.x,b.y+Math.sign(dy)]);
 return cells.some(([x,y])=>tile(s,x,y,levelOf(b))==='crate'||PROPS[propAt(s,x,y,levelOf(b))?.kind]?.cover>0||(EDGES[s.edges[edgeBetween(b,{x,y,z:levelOf(b)})]]?.cover||0)>0);
}
export function previewAttack(s,a,b,burst=false){
 if(!a||!b||!alive(a)||!alive(b)||a.team===b.team)return {ok:false,reason:'Choose a living opponent'};
 const w=WEAPONS[a.weapon],rounds=burst&&a.weapon==='assault'?3:1,cost=w.cost+(rounds===3?2:0),melee=w.mag===0,range=melee?distance(a,b):Math.hypot(a.x-b.x,a.y-b.y);
 const visible=a.team==='squad'?squad(s).some(p=>canSee(s,p,b)):canSee(s,a,b);
 const cover=!melee&&coverAgainst(s,a,b),heightCover=!melee&&levelOf(b)>levelOf(a)&&(a.x!==b.x||a.y!==b.y),coverPenalty=cover?25:heightCover?15:0,rangePenalty=melee?0:Math.max(0,levelOf(b)-levelOf(a)),effectiveRange=Math.max(0,w.range-rangePenalty);
 const chance=Math.max(10,Math.min(95,a.accuracy+(melee?10:0)-Math.max(0,range+rangePenalty-3)*3-coverPenalty-(rounds===3?10:0)));
 let reason='';
 if(!visible)reason='Target not visible';else if(range>effectiveRange)reason='Out of range';else if(!lineOfSight(s,a,b))reason='Line of fire blocked';else if(w.mag&&a.ammo[a.weapon]<rounds)reason='Reload required';else if(!['explore','won'].includes(s.phase)&&a.ap<cost)reason='Not enough AP';
 return {ok:!reason,reason,cost,rounds,chance:Math.round(chance),cover,heightCover,coverPenalty,rangePenalty,damage:w.damage,range:effectiveRange};
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function attack(s,a,b,burst=false,byAI=false){
 if(s.queue.length)return false;
 if(byAI?!(s.phase==='enemy'&&a?.team==='guard'&&alive(a)):!canControl(s,a))return false;
 const p=previewAttack(s,a,b,burst);if(!p.ok)return false;
 if(s.phase==='explore'){b.alert=true;refresh(s);} // Opening attacks always spend combat AP.
 a.ap-=p.cost;if(WEAPONS[a.weapon].mag)a.ammo[a.weapon]-=p.rounds;
 let damage=0;for(let i=0;i<p.rounds;i++)if(random(s)*100<p.chance)damage+=Math.round(p.damage*(a.team==='guard'?.65:1));
 b.hp=Math.max(0,b.hp-damage);a.facing=(b.x-a.x)-(b.y-a.y)>=0?1:-1;s.effect={ax:a.x,ay:a.y,bx:b.x,by:b.y,az:levelOf(a),bz:levelOf(b),hit:damage>0};
 log(s,`${a.name} → ${b.name}: ${damage?`${damage} damage`:'miss'}${!alive(b)?' / down':''}.`);refresh(s);return true;
}
export function equip(s,u,id){if(!canControl(s,u)||s.queue.length||!WEAPONS[id]||u.weapon===id||(s.phase==='player'&&u.ap<2))return false;if(s.phase==='player')u.ap-=2;u.weapon=id;log(s,`${u.name} equipped ${WEAPONS[id].name}.`);return true;}
export function reload(s,u,byAI=false){
 if(byAI?!(s.phase==='enemy'&&u?.team==='guard'&&alive(u)):!canControl(s,u))return false;
 const w=WEAPONS[u.weapon];if(s.queue.length||!w.mag||u.ammo[u.weapon]===w.mag||(!['explore','won'].includes(s.phase)&&u.ap<3))return false;
 if(!['explore','won'].includes(s.phase))u.ap-=3;u.ammo[u.weapon]=w.mag;log(s,`${u.name} reloaded ${w.short}.`);return true;
}
export function endTurn(s){if(s.phase!=='player'||s.queue.length)return false;s.phase='enemy';s.enemyIndex=0;for(const g of guards(s))g.ap=g.maxAp;log(s,'Guard turn.');return true;}
export function stepEnemy(s){
 if(s.phase!=='enemy')return false;
 const g=s.units[s.enemyIndex];
 if(!g){s.phase='player';s.round++;for(const p of squad(s))p.ap=p.maxAp;refresh(s);log(s,`Squad turn / ${s.round}.`);return true;}
 if(g.team!=='guard'||!alive(g)||!g.alert||g.ap<1){s.enemyIndex++;return true;}
 const targets=squad(s).filter(p=>canSee(s,g,p)).sort((a,b)=>distance(g,a)-distance(g,b));
 const target=targets[0];if(target)g.lastKnown={x:target.x,y:target.y,z:levelOf(target)};
 if(target&&previewAttack(s,g,target).ok){attack(s,g,target,false,true);return true;}
 if(target&&previewAttack(s,g,target).reason==='Not enough AP'){g.ap=0;s.enemyIndex++;return true;}
 if(WEAPONS[g.weapon].mag&&g.ammo[g.weapon]===0&&reload(s,g,true))return true;
 const dest=g.lastKnown;if(dest){let best=null;for(const q of neighbors(s,dest)){if(!WEAPONS[g.weapon].mag&&distance(q,dest)>WEAPONS[g.weapon].range)continue;const path=pathTo(s,g,q.x,q.y,q.z);if(path?.length&&(!best||pathCost(path)<pathCost(best)))best=path;}
  if(best&&best[0].cost<=g.ap){const p=best[0];g.facing=(p.x-g.x)-(p.y-g.y)>=0?1:-1;g.x=p.x;g.y=p.y;g.z=levelOf(p);g.steps++;g.ap-=p.cost;refresh(s);return true;}}
 g.ap=0;s.enemyIndex++;return true;
}
