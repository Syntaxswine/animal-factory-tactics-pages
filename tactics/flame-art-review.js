import {CHARACTER_SPECIES} from './character-art.js';
import {unitArt,RED_HAT_SPECIES} from './red-hats-art.js';
import {drawFlamethrower} from './flamethrower-art.js';
import {drawDeathDrops} from './loot-art.js';
import {drawBody} from './body-art.js';
import {environmentRenderer} from './environment-renderer.js';
import {FLAME,drawFlameBurst,nozzleOffset,torsoLift,missLanding,shooterShake,targetFlinch,holdsFallenSprite,TUFTS} from './flame-effect.js';
import {fireClumps,fireSprites,igniteGrowth,fireFrame} from './ground-fire.js';
import {paintOrder} from './paint-order.js';

const $=id=>document.getElementById(id),images=new Map(),PAUSE=450,SEED=3;
const SCENES={
 burst:{end:FLAME.end,film:[60,170,280,380,560,720,900,1100],note:"One burst is 1.25 s. The jet leaves each sprite's measured nozzle (flame-nozzles.js) and is drawn by the same flame-effect.js the game uses."},
 ground:{end:1600,film:[60,150,240,360,800,900,1000,1100],note:'A burning tile is a scorch plus three clumps of flame, each sorted like a sprite (ground-fire.js), so the animals, the crate and the concrete wall stand in front of some clumps and behind others. Tiles light in a ripple; flames shrink and smoke more each round.'},
};
const DIRECTIONS=[['Right',1,-1],['Down-right',1,0],['Down',1,1],['Down-left',0,1],['Left',-1,1],['Up-left',-1,0],['Up',-1,-1],['Up-right',0,-1]];
let time=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,previous=null;
const art=environmentRenderer(()=>draw(),()=>{});
const fireArt=fireSprites((w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}));

for(const species of CHARACTER_SPECIES)$('species').add(new Option(species.replaceAll('-',' '),species));
for(let range=1;range<=10;range++)$('range').add(new Option(range+(range===1?' tile':' tiles'),range));
$('toward').replaceChildren(...DIRECTIONS.map(([label,dx,dy])=>new Option(label,dx+','+dy)));
const query=new URLSearchParams(location.search);
for(const id of ['scene','species','outfit','stance','outcome','range','toward','turns','zoom','speed'])if([...$(id).options].some(o=>o.value===query.get(id)))$(id).value=query.get(id);
if(!query.has('range'))$('range').value='5';
if(query.has('t')){time=Math.max(0,Number(query.get('t'))||0);playing=false;}
if(query.get('filmstrip')==='1')$('filmstrip').checked=true;
const scene=()=>SCENES[$('scene').value];

function load(src){if(images.has(src))return images.get(src);const img=new Image();img.onload=()=>draw();img.src=src;images.set(src,img);return img;}
const outfitFor=species=>$('outfit').value==='red-hats'&&RED_HAT_SPECIES.includes(species)?'red-hats':'normal';

// Units, the fallen and blocks are drawn exactly as app.js draws them.
function drawUnit(ctx,unit,p,zoom,offset={x:0,y:0}){
 ctx.fillStyle='#13241d66';ctx.beginPath();ctx.ellipse(p.x,p.y+2*zoom,15*zoom,7*zoom,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=unit.team==='guard'?'#e57862':'#b6d5b0';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y,19*zoom,9*zoom,0,0,Math.PI*2);ctx.stroke();
 const frame=unitArt(unit),img=load(frame.src),sw=frame.width/4*zoom,sh=64*zoom;
 ctx.save();ctx.translate(p.x+offset.x,p.y+3*zoom+offset.y);ctx.scale(unit.facing,1);if(img.complete&&img.naturalWidth)ctx.drawImage(img,-sw/2,-sh,sw,sh);drawFlamethrower(ctx,unit,zoom);ctx.restore();
}
function drawFallen(ctx,unit,p,zoom){
 const fallen={...unit,hp:0,casualty:'dead'};drawBody(ctx,load,fallen,p,zoom);drawDeathDrops(ctx,load,fallen,p,zoom);
 ctx.font=`${10*zoom}px monospace`;ctx.textAlign='center';ctx.fillStyle='#b5a17c';ctx.fillText('×',p.x-17*zoom,p.y+7*zoom);
}
function camera(width,height,zoom,centre,lift){const c={x:width/2-(centre.x-centre.y)*28*zoom,y:height/2-(centre.x+centre.y)*14*zoom+lift*zoom};return (x,y,z=0)=>({x:c.x+(x-y)*28*zoom,y:c.y+(x+y)*14*zoom-z*zoom});}
function ground(ctx,project,width,height,zoom,centre,textured){
 ctx.fillStyle='#202c29';ctx.fillRect(0,0,width,height);
 const reach=Math.ceil(Math.max(width,height)/(28*zoom))+2;
 for(let y=Math.floor(centre.y)-reach;y<=centre.y+reach;y++)for(let x=Math.floor(centre.x)-reach;x<=centre.x+reach;x++){
  const p=project(x,y),a=28*zoom,b=14*zoom,n=((x*37+y*13)%9+9)%9;if(p.x<-a||p.x>width+a||p.y<-b||p.y>height+b)continue;
  if(textured&&art.ground(ctx,project,zoom,x,y,'yard'))continue;
  ctx.beginPath();ctx.moveTo(p.x,p.y-b);ctx.lineTo(p.x+a,p.y);ctx.lineTo(p.x,p.y+b);ctx.lineTo(p.x-a,p.y);ctx.closePath();ctx.fillStyle=['#77745a','#7b765b','#736f56'][n%3];ctx.fill();ctx.strokeStyle='#555e4533';ctx.lineWidth=1;ctx.stroke();
 }
}

// A flamethrower burst: a merc fires at a foreman guard `range` tiles away.
function renderBurst(ctx,width,height,t,{fit=false}={}){
 const [dx,dy]=$('toward').value.split(',').map(Number),length=Math.hypot(dx,dy),range=Number($('range').value),outcome=$('outcome').value;
 const aim={x:Math.round(dx/length*range),y:Math.round(dy/length*range)};if(!aim.x&&!aim.y)aim.x=1;
 const facing=aim.x-aim.y>=0?1:-1,species=$('species').value;
 const shooter={x:0,y:0,z:0,species,outfit:outfitFor(species),weapon:'flamethrower',stance:$('stance').value,facing,team:'squad',hp:100};
 const target={...aim,z:0,species:'pig-foreman',weapon:'pistol',stance:'standing',facing:-facing,team:'guard',hp:45,ammo:{pistol:8}};
 let zoom=Number($('zoom').value);
 if(fit)zoom=Math.min(zoom,width/(Math.abs(aim.x-aim.y)*28+130),height/(Math.abs(aim.x+aim.y)*14+150));
 const centre={x:aim.x/2,y:aim.y/2},project=camera(width,height,zoom,centre,26);
 ground(ctx,project,width,height,zoom,centre,false);
 const shooterPoint=project(0,0),targetPoint=project(aim.x,aim.y),fallen=outcome==='kill'&&!holdsFallenSprite(t);
 const units=[{unit:shooter,point:shooterPoint,offset:shooterShake(t,zoom,facing)},{unit:target,point:targetPoint,offset:targetFlinch(t,zoom,outcome),fallen}];
 units.sort((a,b)=>(a.unit.x+a.unit.y)-(b.unit.x+b.unit.y)||(a.fallen?-1:1));
 for(const {unit,point,offset,fallen:down} of units)down?drawFallen(ctx,unit,point,zoom):drawUnit(ctx,unit,point,zoom,offset);
 const nozzle=nozzleOffset(shooter,unitArt(shooter),zoom),shake=shooterShake(t,zoom,facing);
 const to=outcome==='miss'?(q=>project(q.x,q.y))(missLanding({ax:0,ay:0,bx:aim.x,by:aim.y},SEED)):{x:targetPoint.x,y:targetPoint.y-torsoLift(target,zoom)};
 drawFlameBurst(ctx,{from:{x:shooterPoint.x+nozzle.x+shake.x,y:shooterPoint.y+nozzle.y+shake.y},dir:{x:nozzle.dx,y:nozzle.dy},to,ground:targetPoint,t,zoom,outcome,seed:SEED,tuft:TUFTS[target.species]});
}

// Burning ground: a patch of fire crossing a concrete wall, with a crate in it, the chosen animal standing in
// the middle, a guard deeper in the fire and another just outside it in front.
function renderGround(ctx,width,height,t,{fit=false,pixelRatio=1}={}){
 let zoom=Number($('zoom').value);if(fit)zoom=Math.min(zoom,width/420,height/330);
 const centre={x:.3,y:.3},project=camera(width,height,zoom,centre,20),turns=Number($('turns').value),species=$('species').value;
 ground(ctx,project,width,height,zoom,centre,true);
 const fires=[];for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(Math.hypot(x,y)<=2.4)fires.push({x,y,z:0,turns});
 const objects=[
  ...[-3,-2,-1,0].map(y=>({x:1.5,y,type:'edge',edge:`e:1:${y}`,kind:'wall'})),
  {x:-1,y:1,type:'crate'},
  {x:0,y:0,type:'actor',unit:{x:0,y:0,z:0,species,outfit:outfitFor(species),weapon:'flamethrower',stance:$('stance').value,facing:1,team:'squad',hp:100}},
  {x:-1,y:-2,type:'actor',unit:{x:-1,y:-2,z:0,species:'pig-foreman',weapon:'pistol',stance:'standing',facing:1,team:'guard',hp:45}},
  {x:2,y:2,type:'actor',unit:{x:2,y:2,z:0,species:'cow',outfit:'red-hats',weapon:'rifle',stance:'standing',facing:-1,team:'guard',hp:45}},
 ];
 for(const fire of fires){objects.push({x:fire.x,y:fire.y,type:'scorch',fire});for(const clump of fireClumps(fire))objects.push({...clump,type:'fire',fire});}
 objects.sort(paintOrder);
 for(const obj of objects){
  const p=project(obj.x,obj.y);
  if(obj.type==='edge'){if(!art.edge(ctx,project,zoom,obj.edge,obj.kind)){const a=project(1.5,obj.y-.5),b=project(1.5,obj.y+.5),h=72*zoom;ctx.fillStyle='#8a8471';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(b.x,b.y-h);ctx.lineTo(a.x,a.y-h);ctx.closePath();ctx.fill();}}
  else if(obj.type==='crate'){if(!art.prop(ctx,project,zoom,{x:obj.x,y:obj.y,z:0,kind:'crate-wood'})){ctx.fillStyle='#ac8651';ctx.fillRect(p.x-20*zoom,p.y-30*zoom,40*zoom,32*zoom);}}
  else if(obj.type==='actor')drawUnit(ctx,obj.unit,p,zoom);
  else fireArt.draw(ctx,obj.type==='fire'?'clump':'scorch',p.x,p.y,{zoom,pixelRatio,turns:obj.fire.turns,variant:obj.variant,frame:fireFrame(t,obj.phase),grow:(obj.size||1)*igniteGrowth(obj.fire,t)});
 }
}

function sized(canvas){
 const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,width:rect.width,height:rect.height,pixelRatio:rect.width?w/rect.width:1};
}

function draw(){
 const {ctx,width,height,pixelRatio}=sized($('stage')),current=scene(),t=Math.min(time,current.end),render=$('scene').value==='ground'?renderGround:renderBurst;
 if($('filmstrip').checked){
  // One contact sheet of fixed moments, so the whole effect can be judged (and shared) as a single image.
  const columns=width<640?2:4,rows=Math.ceil(current.film.length/columns),w=width/columns,h=height/rows;
  current.film.forEach((moment,i)=>{const x=i%columns*w,y=Math.floor(i/columns)*h;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);render(ctx,w,h,moment,{fit:true,pixelRatio});ctx.fillStyle='#17241fdd';ctx.fillRect(0,h-22,84,22);ctx.fillStyle='#f5e6c9';ctx.font='13px monospace';ctx.textAlign='left';ctx.fillText(moment+' ms',8,h-7);ctx.strokeStyle='#63755f';ctx.strokeRect(.5,.5,w-1,h-1);ctx.restore();});
 }else render(ctx,width,height,t,{pixelRatio});
 $('scrub').max=String(current.end);$('scrub').value=String(Math.round(t));$('time').textContent=time>current.end?'pause':`${Math.round(t)} ms`;
}
function showScene(){
 for(const control of document.querySelectorAll('[data-scene]'))control.hidden=control.dataset.scene!==$('scene').value;
 $('note').textContent=scene().note;time=Math.min(time,scene().end);draw();
}

function frame(now){
 if(playing&&previous!==null){time+=(now-previous)*Number($('speed').value);if(time>scene().end+PAUSE)time=0;}
 previous=now;if(playing)draw();requestAnimationFrame(frame);
}

$('play').textContent=playing?'Pause':'Play';
$('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';if(playing&&time>=scene().end)time=0;draw();});
$('scrub').addEventListener('input',()=>{time=Number($('scrub').value);playing=false;$('play').textContent='Play';draw();});
for(const id of ['species','outfit','stance','outcome','range','toward','turns','zoom','speed'])$(id).addEventListener('change',draw);
$('scene').addEventListener('change',showScene);
$('filmstrip').addEventListener('change',()=>{$('stage').classList.toggle('sheet',$('filmstrip').checked);draw();});
new ResizeObserver(draw).observe($('stage'));
$('stage').classList.toggle('sheet',$('filmstrip').checked);showScene();requestAnimationFrame(frame);
