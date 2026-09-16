import {cursorStyle,contextAction,fenceAtCursor,actionCost} from './cursor-actions.js';
import {SPECIES_TRAITS,SKILLS} from './progression.js';
import {gridLayout,GRID_W,GRID_H,reserve} from './inventory.js';
import {layerCompositor,layerStyle} from './layers.js';
import {characterArt,ARMED_WEAPONS} from './character-art.js';
import {LOOT_WEAPONS,fallenVisible,drawDeathDrops,inventoryArt,drawLootPile} from './loot-art.js';
import {unitArt} from './red-hats-art.js';
import {PROPS,propCells} from './environment.js';
import {environmentRenderer} from './environment-renderer.js';
import {bounds,inView,focusSector,sectorOverview} from './view.js';
import {createWorld,currentMap,travel,travelReason,locationDistance,factoryIncome,liberated,incomePerHour,clockLabel,tickWorld,spendTime,downtimeReason,medicalRestPreview,MEDIC_SKILL_REQUIRED} from './world.js';
import {parseMap,blockedEdge,levelOf,roofTop,neighbors} from './maps.js';
import {edgeCells,edgePoints} from './maps.js';
import {W,H,WEAPONS,arrangeInventory,stowWeapon,equipCutters,allocateSkill,setSneaking,setOverwatch,stepInvestigation,inventoryTransfer,turnTo,AIM_ZONES,moveGroup,key,alive,incapacitated,medicalCost,stabilizePreview,stabilize,cutPreview,cutFence,squad,guards,occupant,tile,walkable,createGame,STANCES,stanceOf,setStance,movementNeighbors,navigationPath,pathCost,pathTo,move,stepMovement,previewAttack,attack,equip,reload,endTurn,stepEnemy,canControl} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('map'),mainCtx=canvas.getContext('2d'),mini=$('mini').getContext('2d');
let customMap=null,loadError='';
if(new URLSearchParams(location.search).get('map')==='custom'){try{customMap=parseMap(sessionStorage.getItem('red-shift-playtest')||'');}catch(e){loadError='Could not load the playtest map. '+e.message;}}
let ctx=mainCtx,renderLevel=0;const compositeLayers=layerCompositor();
let showCone=false,bagSelection=null,inventoryMercId=null;
let selectedIds=new Set([0]),aimZone='torso',shotConfirmation=null;
let viewLevel=0,routeCache=null,cursor=null,hoverAction=null,cursorView='';
let lastClockFrame=null;
let world=createWorld(customMap),s=currentMap(world),targetId=null,burst=false,showGrid=false,hover=null,hoverActor=null,route=null,lastTick=0,lastRevision=-1,toast='',toastUntil=0,effectUntil=0,lastEffect=null,drag=null,width=1,height=1;
const camera={x:0,y:0,zoom:1.15},images=new Map(),sprites=[];
const art=environmentRenderer(()=>{},id=>message('Could not load '+id+' artwork.'));
const selected=()=>s.units[s.selected],target=()=>s.units.find(u=>u.id===targetId&&alive(u)&&s.detected.has(u.id));
function load(src){if(images.has(src))return images.get(src);const img=new Image();img.src=src;img.onerror=()=>message('An artwork file could not load. Reload the page to retry.');images.set(src,img);return img;}
for(const species of new Set(s.units.map(u=>u.species)))for(const pose of ['idle','walk-a','walk-b'])load(characterArt(species,"hands",pose).src);
for(const species of new Set(s.units.map(u=>u.species)))for(const weapon of ARMED_WEAPONS)load(characterArt(species,weapon).src);
for(const name of ['mill','bakery','bottler','dairy'])load(`../assets/machines/industrial/${name}.png`);
for(const weapon of LOOT_WEAPONS)for(const kind of ['gun','ammo'])load(`../assets/environment/loot/${kind}-${weapon}.png`);
function project(x,y,z=0){return {x:camera.x+(x-y)*28*camera.zoom,y:camera.y+(x+y)*14*camera.zoom-z*camera.zoom};}
function pick(x,y){const px=(x-camera.x)/(28*camera.zoom),py=(y-camera.y)/(14*camera.zoom);return {x:Math.round((px+py)/2),y:Math.round((py-px)/2)};}
function center(){const p=selected();viewLevel=levelOf(p);$('level').value=viewLevel;camera.x=width*.46-(p.x-p.y)*28*camera.zoom;camera.y=height*.48-(p.x+p.y)*14*camera.zoom;}
function overview(){camera.zoom=Math.max(.025,Math.min((width-70)/((W+H)*28),(height-100)/((W+H)*14)));camera.x=width/2-(W-H)*14*camera.zoom;camera.y=55;}
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=rect.width;height=rect.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(camera.x===0)center();}
new ResizeObserver(resize).observe(canvas);
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function diamond(x,y,fill,stroke,z=0,scale=1){const p=project(x,y,z),a=28*camera.zoom*scale,b=14*camera.zoom*scale;poly([{x:p.x,y:p.y-b},{x:p.x+a,y:p.y},{x:p.x,y:p.y+b},{x:p.x-a,y:p.y}],fill,stroke);}
function block(x,y,h,top,left,right){const p=project(x,y),a=28*camera.zoom,b=14*camera.zoom,z=h*camera.zoom;poly([{x:p.x-a,y:p.y},{x:p.x,y:p.y+b},{x:p.x,y:p.y+b-z},{x:p.x-a,y:p.y-z}],left,'#242b2480');poly([{x:p.x,y:p.y+b},{x:p.x+a,y:p.y},{x:p.x+a,y:p.y-z},{x:p.x,y:p.y+b-z}],right,'#242b2480');diamond(x,y,top,'#555643',h);}
function textLabel(label,x,y,color='#ddcf9f',size=11){const p=project(x,y);ctx.font=`${size*camera.zoom}px monospace`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(label,p.x,p.y);}
function drawTerrain(){


 // Existing industrial sprites form the factory skyline, outside the walkable map.
 if(renderLevel===0)for(const [name,x,y,size]of [['mill',7,-3,225],['bakery',17,-3,245],['bottler',25,-2,220],['dairy',34,14,200]]){const p=project(x,y),img=load(`../assets/machines/industrial/${name}.png`);if(img.complete&&img.naturalWidth){ctx.globalAlpha=.58;ctx.drawImage(img,p.x-size*camera.zoom/2,p.y-size*camera.zoom,size*camera.zoom,size*camera.zoom);ctx.globalAlpha=1;}}
 const b=bounds(camera,width,height);for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++){const k=key(x,y,renderLevel),seen=s.seen.has(k),visible=s.visible.has(k),t=tile(s,x,y,renderLevel),n=(x*37+y*13)%9;if(seen&&t==='void'||!seen&&(renderLevel!==viewLevel||renderLevel>0))continue;
  const base=t==='floor'?['#77745a','#7b765b','#736f56'][n%3]:['#6f7053','#737256','#696d51'][n%3];
  diamond(x,y,seen?base:'#303c34',showGrid&&seen?(x%24===0||y%24===0?'#e3cf8f99':'#a3a17b45'):seen?'#555e4533':'#37433644');
  if(seen){if(t==='water')diamond(x,y,'#365f72');art.ground(ctx,project,camera.zoom,x,y,t,(a,b)=>tile(s,a,b,renderLevel));if(t==='bridge')textLabel('═',x,y,'#ccb88c',12);if(showGrid)diamond(x,y,null,x%24===0||y%24===0?'#e3cf8f99':'#a3a17b45');if(t!=='water'&&(n===0||n===4)){const p=project(x,y);ctx.strokeStyle='#3c473541';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-12*camera.zoom,p.y-4*camera.zoom);ctx.lineTo(p.x-5*camera.zoom,p.y);ctx.lineTo(p.x+5*camera.zoom,p.y-2*camera.zoom);ctx.stroke();}
   if(t==='door'){diamond(x,y,'#9f8e5244','#c9aa6866');const p=project(x,y);ctx.fillStyle='#e1c579';ctx.fillRect(p.x-3*camera.zoom,p.y-1*camera.zoom,6*camera.zoom,2*camera.zoom);}
   if(!visible)diamond(x,y,'#182c2899');
  }
 }
 for(const link of s.climbs||[])for(const p of [link,roofTop(link)])if(p.z===renderLevel&&s.seen.has(key(p.x,p.y,p.z))){diamond(p.x,p.y,'#dcb86777','#ffe4a2');textLabel(p.z===link.z?'R ↑':'R ↓',p.x,p.y,'#ffe4a2',16);}
 for(const p of s.stairs)if((p.z===renderLevel||p.z+1===renderLevel)&&s.seen.has(key(p.x,p.y,renderLevel))){diamond(p.x,p.y,'#66bccb77','#a6f3ed');textLabel((p.kind==='ladder'?'L ':'')+(p.z===renderLevel?'↑':'↓'),p.x,p.y,'#effffe',16);}
 for(const exit of s.definition.exits.filter(p=>levelOf(p)===renderLevel)){if(s.seen.has(key(exit.x,exit.y,levelOf(exit)))){diamond(exit.x,exit.y,'#72bcd555','#a9e5eb');textLabel('TRAVEL',exit.x,exit.y,'#d8f6f4',8);}}

}
function drawEdge(k,kind){if(art.edge(ctx,project,camera.zoom,k,kind))return;
 const ends=edgePoints(k),a=project(ends[0].x,ends[0].y),b=project(ends[1].x,ends[1].y),h=(kind==='door'?0:27)*camera.zoom;
 if(kind==='door'){ctx.strokeStyle='#ebca7a';ctx.lineWidth=3*camera.zoom;ctx.setLineDash([4*camera.zoom,3*camera.zoom]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);return;}
 poly([a,b,{x:b.x,y:b.y-h},{x:a.x,y:a.y-h}],k.startsWith('e')?'#81745b':'#a08f6a','#514c3c');
 ctx.strokeStyle='#d1bd89';ctx.lineWidth=3*camera.zoom;ctx.beginPath();ctx.moveTo(a.x,a.y-h);ctx.lineTo(b.x,b.y-h);ctx.stroke();
 ctx.strokeStyle='#544d3c88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y-h/2);ctx.lineTo(b.x,b.y-h/2);ctx.stroke();
}
function drawObjects(now){for(const [id,p] of Object.entries(s.contacts||{}))if(!s.detected.has(Number(id))&&levelOf(p)===renderLevel){diamond(p.x,p.y,null,'#b4937260',0,.65);textLabel('?',p.x,p.y,'#b49372');}

 const b=bounds(camera,width,height),objects=[];for(const [k,kind]of Object.entries(s.edges)){const cells=edgeCells(k);if(levelOf(cells[0])===renderLevel&&cells.some(p=>inView(p,b))&&cells.some(p=>s.seen.has(key(p.x,p.y,renderLevel))))objects.push({x:(cells[0].x+cells[1].x)/2,y:(cells[0].y+cells[1].y)/2,type:'edge',edge:k,kind,visible:cells.some(p=>s.visible.has(key(p.x,p.y,renderLevel)))});}for(let y=b.y0;y<=b.y1;y++)for(let x=b.x0;x<=b.x1;x++)if(s.seen.has(key(x,y,renderLevel))&&['wall','crate'].includes(tile(s,x,y,renderLevel)))objects.push({x,y,type:tile(s,x,y,renderLevel)});
 for(const p of s.props)if(levelOf(p)===renderLevel&&propCells(p).some(q=>inView(q,b)&&s.seen.has(key(q.x,q.y,q.z))))objects.push({...p,type:'prop',depth:Math.max(...propCells(p).map(q=>q.x+q.y))});
 for(const pile of s.loot||[])if(pile.items.length&&levelOf(pile)===renderLevel&&inView(pile,b)&&s.visible.has(key(pile.x,pile.y,renderLevel)))objects.push({...pile,type:'loot'});
 for(const u of s.units)if(u.casualty!=='captured'&&levelOf(u)===renderLevel&&inView(u,b)&&(u.team==='squad'||s.detected.has(u.id)||fallenVisible(s,u,renderLevel)))objects.push({...u,type:'actor',unit:u});
 objects.sort((a,b)=>(PROPS[a.kind]?.groundLayer?0:1)-(PROPS[b.kind]?.groundLayer?0:1)||(a.depth??a.x+a.y)-(b.depth??b.x+b.y)||(a.type==='actor'?1:-1));
 for(const obj of objects){const {x,y,type}=obj,visible=obj.visible??s.visible.has(key(x,y,renderLevel));ctx.globalAlpha=visible?1:.45;
  if(type==='prop'){art.prop(ctx,project,camera.zoom,obj);}
  else if(type==='loot'){if(!drawLootPile(ctx,load,obj,project(x,y),camera.zoom))diamond(x,y,'#d5b95870','#f2d78c',0,.35);}
  else if(type==='edge'){drawEdge(obj.edge,obj.kind);}
  else if(type==='wall'){block(x,y,23,'#9b8e6b','#625d49','#797158');const p=project(x,y,10);ctx.strokeStyle='#403f3477';ctx.beginPath();ctx.moveTo(p.x,p.y+14*camera.zoom);ctx.lineTo(p.x+28*camera.zoom,p.y);ctx.stroke();}
  else if(type==='crate'){if(art.prop(ctx,project,camera.zoom,{...obj,kind:'crate-wood'})){ctx.globalAlpha=1;continue;}block(x,y,14,'#ac8651','#695539','#866b42');const p=project(x,y,14);ctx.strokeStyle='#463d2bb0';ctx.beginPath();ctx.moveTo(p.x-15*camera.zoom,p.y-6*camera.zoom);ctx.lineTo(p.x+13*camera.zoom,p.y+7*camera.zoom);ctx.stroke();}
  else{const u=obj.unit,p=project(x,y),color=u.team==='guard'?'#e57862':selectedIds.has(u.id)?'#f2ce79':'#b6d5b0';
   if(incapacitated(u)){diamond(x,y,'#bc8f3a77','#edc87a');textLabel(u.casualty==='stable'?'STABLE':u.name+' · '+u.bleedTurns+' turns',x,y,'#ffd98b',11);ctx.globalAlpha=1;continue;}if(!alive(u)){diamond(x,y,'#562e2566');drawDeathDrops(ctx,load,u,p,camera.zoom);ctx.font=`${10*camera.zoom}px monospace`;ctx.textAlign='center';ctx.fillStyle='#b5a17c';ctx.fillText('×',p.x-17*camera.zoom,p.y+7*camera.zoom);ctx.globalAlpha=1;continue;}
   ctx.fillStyle='#13241d66';ctx.beginPath();ctx.ellipse(p.x,p.y+2*camera.zoom,15*camera.zoom,7*camera.zoom,0,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle=color;ctx.lineWidth=u.id===s.selected?2.4:1.5;ctx.beginPath();ctx.ellipse(p.x,p.y,19*camera.zoom,9*camera.zoom,0,0,Math.PI*2);ctx.stroke();
   if(u.id===targetId)diamond(x,y,null,'#ffb28d',0,.9);
   const walking=(s.queue[0]?.id===u.id||s.queue[0]?.group?.some(o=>o.id===u.id))||(s.phase==='enemy'&&s.units[s.enemyIndex]?.id===u.id);const pose=walking?(Math.floor(now/170)%2?'walk-a':'walk-b'):'idle',frame=unitArt(u,pose),img=load(frame.src),sw=frame.width/4*camera.zoom,sh=64*camera.zoom;
   ctx.save();ctx.translate(p.x,p.y+3*camera.zoom);ctx.scale(u.facing,1);if(img.complete&&img.naturalWidth)ctx.drawImage(img,-sw/2,-sh,sw,sh);else{ctx.fillStyle=color;ctx.fillRect(-sw/4,-sh,sw/2,sh);}ctx.restore();
   ctx.globalAlpha=1;ctx.fillStyle='#14221d';ctx.fillRect(p.x-17*camera.zoom,p.y-(frame.contentHeight/4+7)*camera.zoom,34*camera.zoom,4*camera.zoom);ctx.fillStyle=color;ctx.fillRect(p.x-17*camera.zoom,p.y-(frame.contentHeight/4+7)*camera.zoom,34*camera.zoom*u.hp/u.maxHp,3*camera.zoom);
   ctx.font=`bold ${9*camera.zoom}px monospace`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText((u.team==='squad'?`${u.id+1} ${u.name}`:u.name)+(stanceOf(u)==='standing'?'':stanceOf(u)==='kneeling'?' [K]':' [P]'),p.x,p.y+17*camera.zoom);
   if(renderLevel===viewLevel)sprites.push({id:u.id,x:p.x-sw/2,y:p.y-frame.contentHeight/4*camera.zoom,w:sw,h:(frame.contentHeight/4+10)*camera.zoom});
  }ctx.globalAlpha=1;
 }
 ctx.globalAlpha=1;
}
function drawPreview(){
 if(hover&&canControl(s,selected())&&!s.queue.length){const u=hoverActor!==null?s.units[hoverActor]:null;
  if(u?.team==='guard'){diamond(u.x,u.y,'#e87b5933','#ec9a70');const a=project(selected().x,selected().y,30),b=project(u.x,u.y,30);ctx.setLineDash([4,5]);ctx.strokeStyle=previewAttack(s,selected(),u,burst,aimZone).ok?'#e6c87d':'#bb6d58';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
  else if(route){route.filter(p=>levelOf(p)===viewLevel).forEach(p=>diamond(p.x,p.y,pathCost(route)<=selected().ap||s.phase!=='player'?'#ddba6744':'#c9634933',null,0,.28));diamond(hover.x,hover.y,'#e0c78133','#d2bb78');}
 }
}
function drawMinimap(){mini.fillStyle='#192921';mini.fillRect(0,0,168,144);mini.strokeStyle='#647351';for(let i=0;i<=10;i++){mini.beginPath();mini.moveTo(i*16.8,0);mini.lineTo(i*16.8,144);mini.moveTo(0,i*14.4);mini.lineTo(168,i*14.4);mini.stroke();}for(let level=0;level<3;level++){const style=layerStyle(level,viewLevel);mini.save();mini.globalAlpha=style.alpha;mini.filter=style.filter;for(const k of s.seen){const [x,y,z=0]=k.split(',').map(Number);if(z!==level)continue;mini.fillStyle='#718263';mini.fillRect(x/W*168,y/H*144,1,1);}for(const u of s.units)if(levelOf(u)===level&&alive(u)&&(u.team==='squad'||s.detected.has(u.id))){mini.fillStyle=u.team==='guard'?'#ff9275':u.id===s.selected?'#ffda79':'#c8e5b6';mini.fillRect(u.x/W*168-2,u.y/H*144-2,4,4);}mini.restore();}}
function draw(now){if(!hover||drag||camera.zoom<.2)setCursorKind(drag?'pan':camera.zoom<.2?'overview':'default');ctx.clearRect(0,0,width,height);ctx.fillStyle='#202c29';ctx.fillRect(0,0,width,height);if(camera.zoom<.2){sprites.length=0;compositeLayers(mainCtx,viewLevel,width,height,(ink,level)=>{sectorOverview(ink,project,s,level,s.seen,level===0);for(const u of s.units)if(levelOf(u)===level&&alive(u)&&(u.team==='squad'||s.detected.has(u.id))){const p=project(u.x,u.y);ink.fillStyle=u.team==='squad'?'#ffda79':'#ff9275';ink.fillRect(p.x-2,p.y-2,4,4);}});return;}sprites.length=0;compositeLayers(mainCtx,viewLevel,width,height,(ink,level)=>{ctx=ink;renderLevel=level;try{drawTerrain(); if(showCone&&renderLevel===levelOf(selected())){const u=selected(),points=[project(u.x,u.y)];for(let a=u.heading-u.cone/2;a<=u.heading+u.cone/2;a+=3)points.push(project(u.x+60*Math.cos(a*Math.PI/180),u.y+60*Math.sin(a*Math.PI/180)));poly(points,'#e8cb6920','#e8cb6990');}drawObjects(now);}finally{ctx=mainCtx;renderLevel=viewLevel;}});ctx=mainCtx;renderLevel=viewLevel;const pointerView=[camera.x,camera.y,camera.zoom,viewLevel,width,height,s.revision].join(':');if(cursor&&!drag&&pointerView!==cursorView){cursorView=pointerView;const r=canvas.getBoundingClientRect();hitTest({clientX:r.left+cursor.x,clientY:r.top+cursor.y});updateHover();}drawPreview();drawActionCost();
 if(s.effect!==lastEffect){lastEffect=s.effect;effectUntil=now+350;}if(s.effect&&now<effectUntil&&(s.effect.az===viewLevel||s.effect.bz===viewLevel)){const a=project(s.effect.ax,s.effect.ay,30),b=project(s.effect.bx,s.effect.by,30);ctx.strokeStyle=s.effect.hit?'#ffe6a2':'#c2c5a0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.arc(b.x,b.y,7,0,7);ctx.stroke();}
}
function message(text){toast=text;toastUntil=performance.now()+3000;$('hint').textContent=text;}
function hitTest(e){const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;cursor={x:px,y:py};hoverActor=null;for(const v of [...sprites].reverse())if(px>=v.x&&px<=v.x+v.w&&py>=v.y&&py<=v.y+v.h){hoverActor=v.id;break;}hover=pick(px,py);}
function drawActionCost(){
 if(!cursor||!hover||drag||document.querySelector('dialog[open]'))return;
 const preview=actionCost(s,selected(),hoverAction,{route,burst,aimZone});if(!preview)return;
 const label=(hoverAction.action==='move'&&selectedIds.size>1?selected().name+' · ':'')+`${preview.estimated?'~':''}${preview.cost===null?'—':preview.cost} AP${preview.valid?'':' · '+preview.reason}`;
 ctx.save();ctx.font='bold 12px monospace';ctx.textAlign='left';ctx.textBaseline='middle';
 const boxWidth=Math.min(width-8,ctx.measureText(label).width+16),boxHeight=28;
 const x=Math.max(4,Math.min(width-boxWidth-4,cursor.x-boxWidth/2)),y=Math.max(4,Math.min(height-boxHeight-4,cursor.y+36));
 ctx.fillStyle='#17241ff2';ctx.fillRect(x,y,boxWidth,boxHeight);ctx.strokeStyle=preview.valid?'#ffda65':'#ff7474';ctx.strokeRect(x+.5,y+.5,boxWidth-1,boxHeight-1);ctx.fillStyle=preview.valid?'#ffda65':'#ff7474';ctx.fillText(label,x+8,y+boxHeight/2,boxWidth-16);ctx.restore();
}
function setCursorKind(kind){if(canvas.dataset.action===kind)return;canvas.dataset.action=kind;canvas.style.cursor=cursorStyle(kind);}
function updateHover(){
 route=null;hoverAction=null;if(drag){setCursorKind('pan');return;}if(camera.zoom<.2){setCursorKind('overview');$('hint').textContent='240 × 240 tiles · Double-click a sector to inspect it.';return;}if(!hover){setCursorKind('default');return;}
 const u=selected(),edge=fenceAtCursor(s,u,cursor,project,camera.zoom,viewLevel);hoverAction=contextAction(s,u,{actorId:hoverActor,point:{...hover,z:viewLevel},edge});setCursorKind(hoverAction.kind);
 if(hoverAction.action==='target'){const t=s.units.find(t=>t.id===hoverAction.id),p=previewAttack(s,u,t,burst,aimZone);$('hint').textContent=`${t.name} / ${WEAPONS[t.weapon].short} / ${t.hp} HP · ${p.ok?`${p.chance}% · ${p.cost} AP${p.cover?' · COVER':''}`:p.reason} · ${AIM_ZONES[aimZone].label} · ${shotConfirmation===shotKey(t)?'Click again to fire':'Click to select enemy'}`;return;}
 if(hoverAction.action!=='move'){const preview=actionCost(s,u,hoverAction);$('hint').textContent=preview?.valid?(hoverAction.label||'Interact'):preview?.reason||'Wait for your squad turn.';return;}
 const routeKey=[s.revision,u.id,u.x,u.y,u.z,stanceOf(u),u.sneaking,hover.x,hover.y,viewLevel].join(':');if(routeCache?.state===s&&routeCache.key===routeKey)route=routeCache.path;else{route=navigationPath(s,u,hover.x,hover.y,viewLevel);routeCache={state:s,key:routeKey,path:route};}
 if(!route?.length)setCursorKind('blocked');
 $('hint').textContent=route?.length?`${hover.x}, ${hover.y} · ${route.length} tiles${s.phase==='player'?` / ${pathCost(route)} AP${pathCost(route)>u.ap?' · will stop when AP is spent':''}`:' / explore and replan'} · Click to move`:'No route through discovered terrain, or already at destination.';
}
function sync(){ syncClock();if(hover)updateHover(); $('sight-info').textContent=(selected().cone??120)+'° cone · 75 tile landscape / 60 tile detection maximum';$('turn').disabled=!canControl(s,selected())||!!s.queue.length;selectedIds=new Set([...selectedIds].filter(id=>alive(s.units[id])));selectedIds.add(s.selected);
 $('level').value=viewLevel;const stairs=movementNeighbors(s,selected()).filter(p=>p.z!==levelOf(selected()));for(const [id,delta]of [['up',1],['down',-1]]){const link=stairs.find(p=>p.z===levelOf(selected())+delta);$(id).disabled=!canControl(s,selected())||s.queue.length>0||!link||(s.phase==='player'&&selected().ap<link.cost);$(id).textContent=(link?.kind==='roof'?'Roof':link?.cost===3?'Ladder':link?'Stairs':'Climb')+(delta===1?' ↑':' ↓')+(link?' · '+link.cost+' AP':'');}
 $('local-name').textContent=s.definition.name;$('recon-name').textContent=s.definition.name;document.title='Red Shift — '+s.definition.name;
 const u=selected(),w=WEAPONS[u.weapon],t=target(),p=t?previewAttack(s,u,t,burst,aimZone):null,control=canControl(s,u)&&!s.queue.length;
 if(!t)targetId=null;
 $('objective').textContent=`${s.definition.guards.length-guards(s).length} / ${s.definition.guards.length} guards defeated`;
 $('phase').textContent=({explore:'REAL-TIME EXPLORATION',player:'SQUAD TURN',enemy:'GUARDS MOVING',won:'LOCAL MAP CLEARED',lost:'SQUAD LOST'})[s.phase];$('phase').classList.toggle('combat',s.phase==='player'||s.phase==='enemy');
 $('round').textContent=(s.difficulty==='easy'?'EASY · ':'STANDARD · ')+(s.phase==='explore'?'SHIFT 07':`ROUND ${s.round}`);
 $('selected').innerHTML=`<img alt="${u.species}" src="${unitArt(u).src}"><div><h2>${u.name}</h2><p>${u.species.toUpperCase()} / L${levelOf(u)+1} / ${u.hp} HP / ${STANCES[stanceOf(u)].label}</p><p>${['explore','won'].includes(s.phase)?'EXPLORING':`${u.ap} / ${u.maxAp} ACTION POINTS`}</p></div>`;
 $('stances').innerHTML=Object.entries(STANCES).map(([id,v])=>`<button data-stance="${id}" aria-pressed="${stanceOf(u)===id}" ${!control||stanceOf(u)===id||(s.phase==='player'&&u.ap<2)?'disabled':''}>${v.label}</button>`).join('');
 $('stance-info').textContent=(STANCES[stanceOf(u)].moveCost+(u.sneaking?2:0))+' AP / tile · '+(s.phase==='player'?'2 AP to change stance':'Free stance changes outside combat')+' · Stand to climb';
 $('equip-cost').textContent=['explore','won'].includes(s.phase)?'FREE OUTSIDE COMBAT':'EQUIPPED SWAP FREE · BAG 3 AP';
 $('weapons').innerHTML=Object.entries(WEAPONS).filter(([id])=>id==='hands'||u.slots.includes(id)).map(([id,v])=>`<button data-weapon="${id}" aria-pressed="${u.weapon===id}" title="${v.name}" ${!control?'disabled':''}>${id==='hands'?'Hands':v.short}</button>`).join('');
 $('weapon-stats').textContent=`${w.name} · ${w.damage} damage\n${w.cost} AP · ${w.range} tile range · ${w.mag?`${u.ammo[u.weapon]}/${w.mag} rounds · ${reserve(u,u.weapon)} reserve`:'melee'}`;
 $('reload').disabled=!control||!reserve(u,u.weapon)||!w.mag||u.ammo[u.weapon]===w.mag||(s.phase==='player'&&u.ap<3);
 $('burst').disabled=!control||u.weapon!=='assault';$('burst').textContent=`Burst: ${burst?'on':'off'} [B]`;$('burst').setAttribute('aria-pressed',burst);
 const contacts=guards(s).filter(g=>s.detected.has(g.id));$('contact-count').textContent=`${contacts.length} VISIBLE`;
 $('targets').innerHTML=contacts.map(g=>`<button data-target="${g.id}" aria-pressed="${targetId===g.id}">${g.name} · L${levelOf(g)+1} · ${g.hp}</button>`).join('');
 $('target-info').innerHTML=t?`<b>${t.name}</b> / L${levelOf(t)+1} / ${WEAPONS[t.weapon].short}<br>${p.ok?`<strong>${p.chance}%</strong> hit · ${p.cost} AP · ${p.rounds>1?'3 × ':''}${p.damage} damage${p.coverPenalty?` · ${p.heightCover&&!p.cover?'HEIGHT COVER':'COVER'} −${p.coverPenalty}%`:''}${p.rangePenalty?` · UPHILL +${p.rangePenalty} distance`:''}`:`${p.reason}${p.cover?' · in cover':''}`}`:'Select a visible guard to inspect a shot.';
 $('attack').disabled=!control||!p?.ok;$('attack').textContent=burst&&u.weapon==='assault'?'Fire 3-round burst [F]':w.mag?'Fire weapon [F]':'Melee attack [F]';
 $('end').disabled=s.phase!=='player'||s.queue.length>0;
 $('squad').innerHTML=s.units.filter(u=>u.team==='squad').map(u=>`<button class="squad-card" data-unit="${u.id}" aria-pressed="${selectedIds.has(u.id)}" ${!alive(u)?'disabled':''}><span class="num">0${u.id+1}</span><img alt="" src="${unitArt(u).src}"><div class="info"><strong>${u.name}</strong><small>${alive(u)?`L${levelOf(u)+1} · ${STANCES[stanceOf(u)].label} · ${WEAPONS[u.weapon].short} · ${u.hp} HP`:incapacitated(u)?(u.casualty==='stable'?'STABILIZED':`BLEEDING · ${u.bleedTurns} turns`):u.casualty==='captured'?'CAPTURED':'DEAD'}</small><div class="bar"><i style="width:${u.hp/u.maxHp*100}%"></i></div><div class="bar ap"><i style="width:${u.ap/u.maxAp*100}%"></i></div><small>${['explore','won'].includes(s.phase)?'READY':`${u.ap} / ${u.maxAp} AP`}</small></div></button>`).join('');
 $('log').innerHTML=s.log.slice(0,6).map(l=>`<li>${l}</li>`).join('');
 const over=s.phase==='lost';$('outcome').hidden=!over;if(over){$('outcome').querySelector('h2').textContent=s.phase==='won'?'The works are yours.':'The shift is over.';$('outcome').querySelector('p').textContent=s.phase==='won'?`${squad(s).length} comrades survived. All twelve guards defeated.`:`Captured: ${s.defeat?.captured.map(u=>u.name).join(', ')||'none'}. Dead: ${s.defeat?.dead.map(u=>u.name).join(', ')||'none'}. Captured mercs are retained in this run’s record for a future rescue facility. That facility is not yet playable; Restart starts a new run.`;}
 $('group-status').textContent=selectedIds.size+' selected · Primary: '+selected().name;$('sneak').textContent=u.sneaking?'Sneaking · on':'Sneaking · off';$('watch').textContent=u.overwatch?'Overwatch reserved':'Overwatch · '+w.cost+' AP';$('watch').disabled=!control||s.phase!=='player'||!!u.overwatch||!w.mag||u.ap<w.cost||u.ammo[u.weapon]<1;renderUtilities();renderInventory();renderSheet();drawMinimap();lastRevision=s.revision;if(performance.now()>toastUntil){if(s.phase==='enemy')$('hint').textContent='Guard turn · Your squad will regain AP when the guards finish.';else if(s.queue.length)$('hint').textContent='Moving · Escape to stop';else if(over)$('hint').textContent='Operation complete · Restart to play again';else if(hover)updateHover();else $('hint').textContent=s.phase==='player'?'Squad turn · Use all four workers before ending the turn.':s.phase==='won'?'Local map cleared · Gather at the blue travel marker, then open Overmap.':'Click ground to explore · Blue marker: gather within 2 tiles to travel.';}
}
function select(id,toggle=false){if(!alive(s.units[id]))return;if(toggle){if(selectedIds.has(id)&&selectedIds.size>1){selectedIds.delete(id);if(s.selected===id)s.selected=[...selectedIds][0];}else{selectedIds.add(id);s.selected=id;}}else{selectedIds=new Set([id]);s.selected=id;}hover=null;hoverActor=null;route=null;viewLevel=levelOf(selected());$('level').value=viewLevel;targetId=null;aimZone='torso';$('aim-zone').value=aimZone;shotConfirmation=null;burst=false;s.queue=[];sync();}
function shotKey(t){const u=selected();return [u.id,t.id,aimZone,burst,s.round,s.phase,s.revision,u.x,u.y,u.z,u.weapon,u.ap,t.x,t.y,t.z,t.hp].join(':');}
function chooseEnemy(id){const t=s.units[id];if(!t||!alive(t)||!s.detected.has(id))return;if(targetId===id&&shotConfirmation===shotKey(t)){tryAttack();return;}targetId=id;shotConfirmation=shotKey(t);sync();updateHover();}
function tryAttack(){const t=target();shotConfirmation=null;if(t&&attack(s,selected(),t,burst,false,aimZone))sync();else message('Attack unavailable. Check range, AP and ammunition.');}
function restart(){lastClockFrame=null;selectedIds=new Set([0]);shotConfirmation=null;aimZone='torso';$('aim-zone').value=aimZone;world=createWorld(customMap,$('difficulty').value);s=currentMap(world);targetId=null;burst=false;hover=null;route=null;lastEffect=null;camera.zoom=1.15;center();sync();}
function zoom(factor){const cx=width/2,cy=height/2,z=camera.zoom,next=Math.max(.025,Math.min(2.3,z*factor));camera.x=cx+(camera.x-cx)*next/z;camera.y=cy+(camera.y-cy)*next/z;camera.zoom=next;}
$('squad').addEventListener('click',e=>{const b=e.target.closest('[data-unit]');if(b)select(Number(b.dataset.unit),e.shiftKey);});
$('weapons').addEventListener('click',e=>{const b=e.target.closest('[data-weapon]');if(b&&equip(s,selected(),b.dataset.weapon)){burst=false;sync();}});
$('stances').addEventListener('click',e=>{const b=e.target.closest('[data-stance]');if(b&&setStance(s,selected(),b.dataset.stance)){route=null;routeCache=null;sync();}});
$('targets').addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(b)chooseEnemy(Number(b.dataset.target));});
$('attack').onclick=tryAttack;$('reload').onclick=()=>{reload(s,selected());sync();};$('end').onclick=()=>{endTurn(s);sync();};$('burst').onclick=()=>{if(selected().weapon==='assault'){burst=!burst;sync();}};
$('restart').onclick=restart;$('again').onclick=restart;$('help').onclick=()=>$('manual').showModal();$('manual-close').onclick=()=>$('manual').close();$('center').onclick=center;$('fit').onclick=overview;$('zoomin').onclick=()=>zoom(1.2);$('zoomout').onclick=()=>zoom(1/1.2);$('grid').onclick=()=>{showGrid=!showGrid;$('grid').setAttribute('aria-pressed',showGrid);};
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.focus();if(e.button===2||e.button===1||e.altKey){drag={x:e.clientX,y:e.clientY};setCursorKind('pan');canvas.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;if(camera.zoom<.2){message('Double-click a sector to inspect it.');return;}hitTest(e);updateHover();
 const action=hoverAction;if(!action)return;
 if(action.action==='select'){select(action.id,e.shiftKey);return;}
 if(action.action==='target'){chooseEnemy(action.id);return;}
 if(action.action==='cut'){if(!cutFence(s,selected(),action.edge))message(cutPreview(s,selected(),action.edge).reason);sync();return;}
 if(action.action==='stabilize'){stabilize(s,selected(),s.units.find(u=>u.id===action.id));sync();return;}
 if(action.action==='loot'){showInventory();return;}
 if(action.action==='travel'){showOvermap();return;}
 if(action.action!=='move'||!hover)return;shotConfirmation=null;if(!(selectedIds.size>1?moveGroup(s,[...selectedIds],selected(),hover.x,hover.y,viewLevel):move(s,selected(),hover.x,hover.y,viewLevel)))message('Cannot move there. Check the path and available AP.');sync();});
canvas.addEventListener('pointermove',e=>{if(drag){setCursorKind('pan');camera.x+=e.clientX-drag.x;camera.y+=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};return;}hitTest(e);updateHover();});
canvas.addEventListener('pointerup',e=>{drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);hitTest(e);updateHover();});canvas.addEventListener('pointercancel',()=>{drag=null;cursor=null;hover=null;route=null;hoverAction=null;setCursorKind('default');});canvas.addEventListener('pointerleave',()=>{cursor=null;hover=null;hoverActor=null;route=null;hoverAction=null;setCursorKind('default');});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1);},{passive:false});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.ctrlKey||e.metaKey||e.altKey)return;if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if('1234'.includes(k)&&k.length===1)select(Number(k)-1,e.shiftKey);else if(k===' '){e.preventDefault();endTurn(s);sync();}else if(k==='i')showInventory();else if(k==='r'){reload(s,selected());sync();}else if(k==='f')tryAttack();else if(k==='b'&&selected().weapon==='assault'){burst=!burst;sync();}else if(k==='c')center();else if(k==='g')$('grid').click();else if(k==='?'||k==='h')$('manual').showModal();else if(k==='escape'){s.queue=[];shotConfirmation=null;sync();}else if(k==='+'||k==='=')zoom(1.2);else if(k==='-')zoom(1/1.2);else if(k.startsWith('arrow')){e.preventDefault();if(k==='arrowleft')camera.x+=50;if(k==='arrowright')camera.x-=50;if(k==='arrowup')camera.y+=50;if(k==='arrowdown')camera.y-=50;}});
function sector(){const sx=Number($('sector-x').value)-1,sy=Number($('sector-y').value)-1;if(!Number.isInteger(sx)||!Number.isInteger(sy)||sx<0||sy<0||sx>9||sy>9){message('Choose sector coordinates from 1 to 10.');return;}focusSector(camera,width,height,sx,sy);hover=null;route=null;}
$('sector').onclick=sector;$('level').onchange=()=>{viewLevel=Number($('level').value);hover=null;hoverActor=null;route=null;sync();};
for(const [id,delta]of [['up',1],['down',-1]])$(id).onclick=()=>{const u=selected(),link=movementNeighbors(s,u).find(p=>p.z===levelOf(u)+delta);if(!link||!move(s,u,link.x,link.y,link.z))message('Stand at stairs, a ladder or a marked roof climb while standing with enough AP.');sync();};
canvas.addEventListener('dblclick',e=>{if(camera.zoom>=.2)return;const r=canvas.getBoundingClientRect(),p=pick(e.clientX-r.left,e.clientY-r.top);if(p.x<0||p.y<0||p.x>=W||p.y>=H)return;$('sector-x').value=Math.floor(p.x/24)+1;$('sector-y').value=Math.floor(p.y/24)+1;sector();});
$('mini').onclick=e=>{const r=$('mini').getBoundingClientRect();$('sector-x').value=Math.min(10,Math.floor((e.clientX-r.left)/r.width*10)+1);$('sector-y').value=Math.min(10,Math.floor((e.clientY-r.top)/r.height*10)+1);sector();};
function frame(now){const elapsed=lastClockFrame===null?0:now-lastClockFrame;lastClockFrame=now;tickWorld(world,elapsed,{paused:document.hidden||$('manual').open});syncClock();if(!document.querySelector('dialog[open]')&&now-lastTick>(s.phase==='enemy'?110:130)){lastTick=now;if(s.phase==='enemy')stepEnemy(s);else if(s.queue.length){const before=levelOf(selected());stepMovement(s);if(levelOf(selected())!==before){viewLevel=levelOf(selected());$('level').value=viewLevel;}}if(s.phase!=='enemy')stepInvestigation(s);if(s.revision!==lastRevision)sync();}draw(now);requestAnimationFrame(frame);}resize();sync();requestAnimationFrame(frame);

function syncClock(){const clock=clockLabel(world);if($('campaign-clock').textContent!==clock)$('campaign-clock').textContent=clock;const summary=`${clock} · Treasury $${world.money.toLocaleString()} · +$${incomePerHour(world).toLocaleString()} / hour`;if($('economy-summary').textContent!==summary)$('economy-summary').textContent=summary;}
document.addEventListener('visibilitychange',()=>{lastClockFrame=null;});
$('manual').addEventListener('close',()=>{lastClockFrame=null;});
function showOvermap(){
 syncClock();renderDowntime();
 $('route-label').textContent=Object.values(world.definitions).map(d=>d.name).join(' ↔ ');const container=$('locations');container.replaceChildren();
 for(const [id,definition]of Object.entries(world.definitions)){
  const card=document.createElement('button');card.className='location';card.dataset.location=id;
  const name=document.createElement('strong');name.textContent=definition.name;card.append(name);
  const detail=document.createElement('span');const visited=world.states[id];detail.textContent=id===world.current?'Current location':visited?(guards(visited).length?'Visited · guards remain':'Cleared · terrain remembered'):'Unvisited local map';card.append(detail);
  const production=document.createElement('span'),rate=factoryIncome(world,id);production.textContent=rate?`${liberated(world,id)?'Liberated':'Not liberated'} factory · ${locationDistance(world,id)} steps from start · ${liberated(world,id)?'Produces':'Potential'} $${rate} / hour`:'Freight yard · No factory income';card.append(production);
  const reason=travelReason(world,id);card.disabled=!!reason;card.title=reason||'Travel to this local map · 1 hour';
  card.onclick=()=>{const result=travel(world,id);if(!result.ok){$('travel-info').textContent=result.error;return;}s=result.state;selectedIds=new Set([s.selected]);shotConfirmation=null;aimZone='torso';$('aim-zone').value=aimZone;targetId=null;hover=null;hoverActor=null;route=null;lastEffect=null;center();$('overmap').close();sync();};container.append(card);
 }
 const activeMap=currentMap(world),exit=activeMap.definition.exits[0];$('travel-info').textContent=`Travel marker: ${exit.x}, ${exit.y}, level ${levelOf(exit)+1}. Gather every living member within 2 tiles. Travel takes 1 hour and is unavailable during combat.`;
 if(!$('overmap').open)$('overmap').showModal();
}
$('world').onclick=showOvermap;$('world-close').onclick=()=>$('overmap').close();
if(loadError)message(loadError);

function renderUtilities(){const u=selected();$('medical-info').textContent='Medical '+u.medical+'/100 · Stabilize '+medicalCost(u)+' AP · Medkits '+u.medkits+' · Cutters '+(u.slots.includes('wireCutters')?'held':'in backpack — equip to cut')+' · Cut fence 4 AP';const host=$('utility-actions');host.replaceChildren();for(const patient of s.units.filter(p=>p.casualty==='bleeding')){const check=stabilizePreview(s,u,patient),button=document.createElement('button');button.textContent='Stabilize '+patient.name+' · '+patient.bleedTurns+' turns · '+check.cost+' AP';button.title=check.reason;button.disabled=!check.ok;button.onclick=()=>{if(stabilize(s,selected(),patient))sync();};host.append(button);}for(const [edge,kind]of Object.entries(s.edges)){if(kind!=='fence-chainlink'||!edgeCells(edge).some(p=>p.x===u.x&&p.y===u.y&&levelOf(p)===levelOf(u)))continue;const check=cutPreview(s,u,edge),button=document.createElement('button'),other=edgeCells(edge).find(p=>p.x!==u.x||p.y!==u.y);button.style.cursor=check.ok?cursorStyle('cut'):'not-allowed';button.textContent='Cut fence '+(other.x>u.x?'east':other.x<u.x?'west':other.y>u.y?'south':'north')+' · 4 AP';button.title=check.reason;button.disabled=!check.ok;button.onclick=()=>{if(cutFence(s,selected(),edge))sync();};host.append(button);}if(!host.children.length)host.textContent='Stand beside a wire fence or bleeding teammate to use equipment.';}

$('select-all').onclick=()=>{selectedIds=new Set(squad(s).filter(u=>levelOf(u)===viewLevel).map(u=>u.id));if(!selectedIds.size){message('No conscious squad members on this layer.');selectedIds.add(s.selected);return;}if(!selectedIds.has(s.selected))s.selected=[...selectedIds][0];s.queue=[];shotConfirmation=null;targetId=null;sync();};
$('aim-zone').onchange=()=>{aimZone=$('aim-zone').value;shotConfirmation=target()?shotKey(target()):null;sync();updateHover();};

$('turn').onclick=()=>{if(!turnTo(s,selected(),Number($('facing').value)))message('Cannot turn now.');shotConfirmation=null;sync();};$('cone').onclick=()=>{showCone=!showCone;$('cone').setAttribute('aria-pressed',showCone);};

function showInventory(){inventoryMercId=s.selected;bagSelection=null;renderInventory();if(!$('inventory-screen').open)$('inventory-screen').showModal();}
$('inventory-open').onclick=showInventory;
$('inventory-close').onclick=()=>$('inventory-screen').close();
function renderMercTabs(active){
 const tabs=$('merc-tabs');tabs.replaceChildren();
 const mercs=s.units.filter(u=>u.team==='squad');
 for(const [index,u]of mercs.entries()){
  const b=document.createElement('button');b.id='merc-tab-'+u.id;b.setAttribute('role','tab');b.setAttribute('aria-controls','merc-panel');b.setAttribute('aria-selected',u.id===active.id);b.tabIndex=u.id===active.id?0:-1;b.textContent=u.name+(u.casualty?' · '+u.casualty:'');
  b.onclick=()=>{inventoryMercId=u.id;bagSelection=null;renderInventory();$('merc-tab-'+u.id).focus();};
  b.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%mercs.length;else if(e.key==='ArrowLeft')next=(index+mercs.length-1)%mercs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=mercs.length-1;else return;e.preventDefault();$('merc-tab-'+mercs[next].id).click();};tabs.append(b);
 }
 $('merc-panel').setAttribute('aria-labelledby','merc-tab-'+active.id);
}
function renderInventory(){const u=s.units.find(u=>u.id===inventoryMercId&&u.team==='squad')||selected(),box=$('inventory'),layout=gridLayout(u);renderMercTabs(u);$('bag-summary').textContent='Backpack · '+layout.occupied.size+' / '+(GRID_W*GRID_H)+' slots';const portrait=document.createElement('img');portrait.className='inventory-portrait';portrait.src=unitArt({...u,stance:'standing'}).src;portrait.alt=u.name+' · '+u.species;$('inventory-character').replaceChildren(portrait,inventoryStats(u));box.replaceChildren();const label=i=>i.type==='weapon'?WEAPONS[i.kind].short:i.type==='ammo'?i.kind+' ammo ×'+i.count:i.kind==='medkits'?'Medkits ×'+i.count:'Wire cutters';const button=(host,text,fn)=>{const b=document.createElement('button');b.textContent=text;b.disabled=!canControl(s,u)||!!s.queue.length;b.onclick=()=>{if(!fn())message('Action unavailable: check space, adjacency or AP.');bagSelection=null;sync();};host.append(b);return b;};const ready=document.createElement('div');ready.className='ready-grid';box.append(ready);for(let n=0;n<2;n++){const host=document.createElement('div');host.className='ready-slot';ready.append(host);const kind=u.slots[n];button(host,(n?'Secondary':'Primary')+' · '+(kind==='wireCutters'?'Wire cutters':kind?WEAPONS[kind].short:'Empty')+' · 2 cells',()=>kind==='wireCutters'||kind&&equip(s,u,kind));if(kind)button(host,'Stow',()=>stowWeapon(s,u,n));}const note=document.createElement('p');note.textContent='6 × 3 backpack · 18 slots. Select an item, then an empty cell to move it. Rifles span two cells; pistols, ammo stacks and tools one. Ready swaps free; equipping from backpack costs 3 AP in combat.';box.append(note);const grid=document.createElement('div');grid.className='backpack-grid';box.append(grid);for(let cell=0;cell<GRID_W*GRID_H;cell++){const b=button(grid,'',()=>bagSelection?.id===u.id&&arrangeInventory(s,u,bagSelection.key,cell));b.className='bag-cell';b.title='Cell '+(cell+1);b.setAttribute('aria-label','Backpack cell '+(cell+1));b.style.gridColumn=cell%GRID_W+1;b.style.gridRow=Math.floor(cell/GRID_W)+1;}for(const e of layout.entries){const b=document.createElement('button');b.className='bag-item';b.textContent=label(e.item);const sprite=inventoryArt(e.item);if(sprite){const img=document.createElement('img');img.src=sprite;img.alt='';b.prepend(img);}b.style.gridColumn=(e.cell%GRID_W+1)+' / span '+e.span;b.style.gridRow=Math.floor(e.cell/GRID_W)+1;b.setAttribute('aria-pressed',bagSelection?.id===u.id&&bagSelection.key===e.key);b.onclick=()=>{bagSelection={id:u.id,key:e.key};renderInventory();};grid.append(b);}const choice=bagSelection?.id===u.id?layout.entries.find(e=>e.key===bagSelection.key):null;if(choice?.key==='wireCutters'){for(const [slot,name]of ['primary','secondary'].entries())button(box,'Equip '+name+(s.phase==='player'?' · 3 AP':' · Free'),()=>equipCutters(s,u,slot));}if(choice&&choice.item.type!=='utility'){const n=Number(choice.key);if(choice.item.type==='weapon'){button(box,'Equip primary · 3 AP',()=>equip(s,u,choice.item.kind,0));button(box,'Equip secondary · 3 AP',()=>equip(s,u,choice.item.kind,1));}button(box,'Drop '+label(choice.item),()=>inventoryTransfer(s,u,n,'drop'));for(const v of squad(s))if(v!==u&&v.z===u.z&&Math.abs(v.x-u.x)+Math.abs(v.y-u.y)<=1&&!blockedEdge(s,u,v))button(box,'Give to '+v.name,()=>inventoryTransfer(s,u,n,'give',v));}for(const pile of s.loot||[])if(levelOf(pile)===levelOf(u)&&Math.abs(pile.x-u.x)+Math.abs(pile.y-u.y)<=1&&s.visible.has(key(pile.x,pile.y,levelOf(pile)))&&(pile.x===u.x&&pile.y===u.y||!blockedEdge(s,u,pile)))pile.items.forEach((i,n)=>button(box,'Take '+label(i)+(i.type==='weapon'?' · '+i.rounds+' loaded':''),()=>inventoryTransfer(s,u,n,'take',pile)));}


$('sneak').onclick=()=>{setSneaking(s,selected());shotConfirmation=null;sync();};$('watch').onclick=()=>{setOverwatch(s,selected());shotConfirmation=null;sync();};

function inventoryStats(u){
 const section=document.createElement('section');section.className='inventory-stats';section.setAttribute('aria-label',u.name+' character stats');
 const heading=document.createElement('h3');heading.textContent=u.name+' · '+u.species;section.append(heading);
 const stats=document.createElement('dl');
 for(const [label,value]of [['Health',`${u.hp} / ${u.maxHp} HP`],['Action points',`${u.ap} / ${u.maxAp} AP`],['Level',u.level],['Experience',`${u.xp} XP`],['Skill points',u.skillPoints],['Accuracy',u.accuracy],['Medical',`${u.medical} / 100`],['Stealth',`${u.stealth} / 100`],['Sight cone',`${u.cone}°`],['Stance',STANCES[stanceOf(u)].label]]){
  const row=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;row.append(term,detail);stats.append(row);
 }
 section.append(stats);
 const skills=document.createElement('p');skills.className='inventory-skill-ranks';skills.textContent='Training: '+Object.entries(SKILLS).map(([id,k])=>`${k.label} ${u.skills[id]}/20`).join(' · ');section.append(skills);
 const trait=SPECIES_TRAITS[u.species]?.label;if(trait){const note=document.createElement('p');note.textContent=trait;section.append(note);}
 return section;
}
function renderSheet(){const u=selected(),box=$('sheet');$('sheet-summary').textContent='Character sheet · Level '+u.level+' · '+u.skillPoints+' points';box.replaceChildren();const text=document.createElement('p');text.textContent='Level '+u.level+' · '+u.xp+' XP · '+u.skillPoints+' points available. '+u.maxHp+' HP / '+u.maxAp+' AP / '+u.accuracy+' accuracy. '+(SPECIES_TRAITS[u.species]?.label||'');box.append(text);for(const [id,k] of Object.entries(SKILLS)){const b=document.createElement('button');b.textContent=k.label+' '+u.skills[id]+' · '+k.effect;b.disabled=!['explore','won'].includes(s.phase)||u.skillPoints<1||u.skills[id]>=20||id==='medical'&&u.medical>=100||id==='stealth'&&u.stealth>=100;b.onclick=()=>{if(!allocateSkill(s,u,id))message('Training unavailable.');sync();};box.append(b);}}

function renderDowntime(){const reason=downtimeReason(world),hours=Number($('downtime-hours').value);$('downtime-info').textContent=reason||`Ordinary rest: recover up to ${Math.round(Math.min(100,hours/48*100))}% maximum HP and refill AP. Train: +${hours*25} XP per troop below level 10. Ordinary recovery takes up to 2 days; medical care takes up to 1 day. Factory production continues.`;for(const id of ['rest-squad','train-squad']){$(id).disabled=!!reason;$(id).title=reason;}if(!reason&&squad(s).every(u=>u.level>=10)){$('train-squad').disabled=true;$('train-squad').title='All troops have reached level 10.';}$('downtime-roster').textContent=s.units.filter(u=>u.team==='squad').map(u=>`${u.name}: ${u.hp}/${u.maxHp} HP · Level ${u.level} · ${u.xp} XP · ${u.skillPoints} skill points · Medical ${u.medical} · ${u.medkits} medkits${u.medicalRestHours>0?' · '+u.medicalRestHours+'h care remaining':''}${u.casualty?' · '+u.casualty:''}`).join('\n');renderMedicalRest();}
function renderMedicalRest(){const chosen=$('rest-medic').value,medics=squad(s).filter(u=>!u.casualty&&u.medical>=MEDIC_SKILL_REQUIRED).sort((a,b)=>b.medical-a.medical);$('rest-medic').replaceChildren();for(const u of medics){const option=document.createElement('option');option.value=u.id;option.textContent=`${u.name} · Medical ${u.medical}`;$('rest-medic').append(option);}if(medics.some(u=>String(u.id)===chosen))$('rest-medic').value=chosen;const preview=medicalRestPreview(world,$('rest-medic').value===''?null:Number($('rest-medic').value));$('medical-rest').disabled=!preview.ok;$('medical-rest').title=preview.reason;$('medical-rest-info').textContent=preview.reason||`Use ${preview.kitsNeeded} of ${preview.kits} squad medkits. Each wounded troop gets 24 hours of faster recovery; unfinished care continues during later rests without another kit.`;}
$('rest-medic').onchange=renderMedicalRest;
$('downtime-hours').onchange=renderDowntime;
for(const [id,activity]of [['rest-squad','rest'],['medical-rest','medical-rest'],['train-squad','train']])$(id).onclick=()=>{const result=spendTime(world,activity,Number($('downtime-hours').value),$('rest-medic').value===''?null:Number($('rest-medic').value));lastClockFrame=null;$('downtime-result').textContent=result.ok?result.message+` Factory income +$${result.income}.`:result.error;sync();renderDowntime();};
