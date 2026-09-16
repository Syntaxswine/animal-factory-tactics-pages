import {alive,canControl,cutPreview,stabilizePreview,previewAttack,pathCost,WEAPONS,groundTarget} from './engine.js';
import {blockedEdge,edgeCells,edgeKey,levelOf,tileKey} from './maps.js';

// Small vector cursors stay sharp and use explicit hotspots for precise tile/edge picking.
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="#17241f" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
export const CURSOR_ART={
 walk:{hotspot:[7,4],fallback:'pointer',svg:svg('<path fill="#f4d58e" d="M6 3h12l-1 13 5 4 6 2q3 1 2 6H5V17L3 14Z"/><path fill="none" d="M5 25h24M7 8h8M7 12h8M8 16h7M16 20l4-3"/>')},
 shoot:{hotspot:[16,16],fallback:'crosshair',svg:svg('<circle cx="16" cy="16" r="9" fill="none" stroke-width="4"/><path d="M16 2v8m0 12v8M2 16h8m12 0h8" stroke-width="4"/><circle cx="16" cy="16" r="9" fill="none" stroke="#f4d58e" stroke-width="2"/><path d="M16 2v8m0 12v8M2 16h8m12 0h8" stroke="#f4d58e" stroke-width="2"/><circle cx="16" cy="16" r="2" fill="#f4d58e" stroke="none"/>')},
 interact:{hotspot:[12,3],fallback:'pointer',svg:svg('<path fill="#f4d58e" d="M9 17V5q0-4 4-3 2 0 2 3v8q4-4 6 1 4-2 5 3 4 0 3 5l-3 8H13L4 19q-2-4 2-4Z"/><path fill="none" d="M15 13v7m6-6v7m5-4v5"/>')},
 cut:{hotspot:[9,5],fallback:'pointer',svg:svg('<path fill="#c5d1c6" d="M4 2l8 5 4-5 5 2-5 11H9Z"/><path fill="none" stroke="#17241f" stroke-width="7" d="M11 13L5 29m10-16 12 15"/><path fill="none" stroke="#dfaa64" stroke-width="4" d="M11 15L5 29m11-14 11 13"/><circle cx="13" cy="12" r="3" fill="#d9dfce"/><path fill="none" d="M12 7l1 2"/>')}
};
const styles=Object.fromEntries(Object.entries(CURSOR_ART).map(([id,a])=>[id,`url("data:image/svg+xml,${encodeURIComponent(a.svg)}") ${a.hotspot.join(' ')}, ${a.fallback}`]));
export const cursorStyle=kind=>styles[kind]||({blocked:'not-allowed',pan:'grabbing',overview:'zoom-in',wait:'wait'})[kind]||'default';

export function contextAction(s,u,{actorId=null,point=null,edge=null}={}){
 const actor=s.units.find(a=>a.id===actorId);
 const select=actor?.team==='squad'&&alive(actor)?{kind:'interact',action:'select',id:actor.id,label:'Select '+actor.name}:null;
 if(actor?.team==='guard'&&alive(actor)&&s.detected.has(actor.id))return {kind:WEAPONS[u.weapon].mag?'shoot':'interact',action:'target',id:actor.id};
 if(edge&&s.edges[edge]==='fence-chainlink'&&edgeCells(edge).some(p=>p.x===u.x&&p.y===u.y&&levelOf(p)===levelOf(u))&&edgeCells(edge).some(p=>s.seen.has(tileKey(p.x,p.y,levelOf(p)))))return {kind:'cut',action:'cut',edge,label:'Cut fence'};
 if(select)return select;
 if(!canControl(s,u))return {kind:'wait',action:'none'};
 if(!s.queue.length&&point&&s.visible.has(tileKey(point.x,point.y,levelOf(point)))){
  const same=p=>p.x===point.x&&p.y===point.y&&levelOf(p)===levelOf(point);
  const patient=s.units.find(p=>same(p)&&p.team==='squad'&&p.casualty==='bleeding');
  if(patient)return {kind:'interact',action:'stabilize',id:patient.id,label:'Stabilize '+patient.name};
  const near=levelOf(u)===levelOf(point)&&Math.abs(u.x-point.x)+Math.abs(u.y-point.y)<=1;
  if(near&&(same(u)||!blockedEdge(s,u,point))&&s.loot.some(p=>same(p)&&p.items.length))return {kind:'interact',action:'loot',label:'Inspect supplies · open inventory'};
  if(s.definition.exits.some(same)&&levelOf(u)===levelOf(point)&&Math.hypot(u.x-point.x,u.y-point.y)<=2)return {kind:'interact',action:'travel',label:'Open overmap'};
 }
 return {kind:'walk',action:'move'};
}

// Preview the actual action, retaining its cost even when it cannot currently be performed.
export function actionCost(s,u,action,{route=null,burst=false,aimZone='torso'}={}){
 if(!action)return null;
 const free=['explore','won'].includes(s.phase),result=(cost,reason='',estimated=false)=>({cost,valid:!reason,reason,estimated});
 if(action.action==='select')return result(0);
 if(action.action==='ground'){const p=previewAttack(s,u,groundTarget(action.point));return result(p.cost,!canControl(s,u)||s.queue.length?'Cannot act now':p.reason);}
 if(action.action==='target'){
  const target=s.units.find(t=>t.id===action.id);if(!target)return result(null,'No target');
  const preview=previewAttack(s,u,target,burst,aimZone);return result(preview.cost,!canControl(s,u)||s.queue.length?'Cannot act now':preview.reason);
 }
 if(action.action==='cut'||action.action==='stabilize'){
  const preview=action.action==='cut'?cutPreview(s,u,action.edge):stabilizePreview(s,u,s.units.find(t=>t.id===action.id));
  return result(free?0:preview.cost,preview.reason);
 }
 if(action.action==='move'){
  const cost=route?.length?(free?0:pathCost(route)):null;
  if(!canControl(s,u))return result(cost,'Cannot act now');
  if(!route?.length)return result(null,'No route');
  return result(cost,!free&&cost>u.ap?'Not enough AP':'',route.some(p=>!s.seen.has(tileKey(p.x,p.y,levelOf(p)))));
 }
 if(['loot','travel'].includes(action.action))return result(0,!canControl(s,u)||s.queue.length?'Cannot act now':'');
 return result(null,'Cannot act now');
}

// Match the visible fence face as well as its ground edge; check only adjacent wire fences.
export function fenceAtCursor(s,u,cursor,project,zoom,level){
 if(!cursor||levelOf(u)!==level)return null;
 for(const edge of [edgeKey('e',u.x,u.y,level),edgeKey('e',u.x-1,u.y,level),edgeKey('s',u.x,u.y,level),edgeKey('s',u.x,u.y-1,level)]){
  if(s.edges[edge]!=='fence-chainlink')continue;
  const [axis,x,y]=edge.split(':');const a=project(Number(x)+(axis==='e'?.5:-.5),Number(y)+(axis==='e'?-.5:.5)),b=project(Number(x)+.5,Number(y)+.5);
  const t=(cursor.x-a.x)/(b.x-a.x);if(t<-.12||t>1.12)continue;
  const floor=a.y+(b.y-a.y)*Math.max(0,Math.min(1,t));if(cursor.y>=floor-44*zoom&&cursor.y<=floor+5*zoom)return edge;
 }return null;
}
