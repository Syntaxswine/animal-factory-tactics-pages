// Burning ground: a scorched, glowing decal under each burning tile plus a few separate clumps of flame
// inside it. Each clump is its own depth-sorted object, so a unit standing in the fire has flames both
// behind and in front of it, and walls, crates and neighbours overlap the clumps the way they overlap sprites.
// Drawn with the same outlined flame bands as the flamethrower burst (flame-effect.js).
import {FLAME_PALETTE,SMOKE_PALETTE,fillFlames,smokeCloud} from './flame-effect.js';

// A looping flicker of 8 frames at 10 per second: snappy, like hand-drawn fire animated on twos.
export const FIRE_FRAMES=8,FIRE_LOOP_MS=800;
// Burning tiles last three rounds; their flames shrink each round and smoke more as they die down.
export const fireStage=turns=>turns>=3?3:turns===2?2:1;
const STAGE_SIZE={3:1,2:.74,1:.5};
// Sprite boxes in unzoomed pixels, with the ground point each drawing is anchored to.
export const CLUMP_BOX={w:44,h:64,ox:22,oy:56};
export const SCORCH_BOX={w:60,h:32,ox:30,oy:16};
const TAU=Math.PI*2;

function hash(...values){let h=2166136261;for(const v of values){h=Math.imul(h^(v&0xffff),16777619);h=Math.imul(h^((v>>>16)&0xffff),16777619);}return h>>>0;}
function random(seed){let x=seed||0x9e3779b9;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
const wrap=frame=>((Math.floor(frame)%FIRE_FRAMES)+FIRE_FRAMES)%FIRE_FRAMES;
// Every flickering term: `cycles` whole cycles per loop, so the last frame flows into the first like any other pair.
export const flicker=(frame,cycles,phase=0)=>Math.sin(TAU*cycles*wrap(frame)/FIRE_FRAMES+phase);

// Three clumps per tile, one toward the back and two toward the front. u runs along the depth axis (dx+dy)
// and v across it (dx-dy), in tiles. |u| stays below .45, so a clump never sorts past the walls and fences on
// its own tile's sides (they sort at +/-.5), and it is never 0, where a unit standing on the tile would tie.
const SPOTS=[[-.28,.02],[.2,-.38],[.3,.34]];
export function fireClumps(fire){
 const z=fire.z??0,rand=random(hash(fire.x,fire.y,z,101));
 return SPOTS.map(([u,v])=>{
  u+=(rand()-.5)*.14;v+=(rand()-.5)*.2;
  const dx=(u+v)/2,dy=(u-v)/2;
  return {x:fire.x+dx,y:fire.y+dy,z,depth:fire.x+fire.y+u,variant:Math.floor(rand()*3),phase:rand(),size:.85+rand()*.3};
 });
}
// Tiles light a moment apart, so a fresh blaze ripples outward instead of appearing all at once.
export const igniteDelay=fire=>hash(fire.x,fire.y,fire.z??0,7)%6*35;
// Scale of a tile's fire `elapsed` ms after it was lit: nothing until its ripple delay, then a springy pop.
export function igniteGrowth(fire,elapsed){
 const t=(elapsed-igniteDelay(fire))/380;
 if(t<=0)return 0;if(t>=1)return 1;
 const c=1.7;return 1+(c+1)*(t-1)**3+c*(t-1)**2;
}
// Loop frame of a clump at clock time `ms`; each clump's own phase keeps neighbours out of step.
export const fireFrame=(ms,phase=0)=>Math.floor(ms/FIRE_LOOP_MS*FIRE_FRAMES+phase*FIRE_FRAMES);

// One clump at frame `frame` of its loop, standing on (x, y).
export function drawFireClump(ctx,x,y,zoom,turns,frame,variant=0){
 const stage=fireStage(turns),S=STAGE_SIZE[stage]*zoom,rand=random(hash(variant,31)),phase=Array.from({length:16},()=>rand()*TAU);
 const wave=(cycles,i)=>flicker(frame,cycles,phase[i]);
 // A dying fire puts up lazy puffs of smoke that rise and shrink away within the loop, from one clump design in
 // three so a field of fire smokes in places rather than everywhere. Smoke keeps its size as the flames shrink.
 if(stage<3&&variant%3===0){
  const age=wrap(frame)/FIRE_FRAMES,r=zoom*(stage===1?8.5:6.5)*Math.sin(Math.PI*age)**.6;
  smokeCloud(ctx,x+zoom*2*wave(1,12),y-zoom*(16+32*age),r,zoom,false,phase[13]);
 }
 // A glowing bed of burning fuel, then rounded campfire tongues. The three variants are one fat tongue with
 // a side lick, a tall and a short tongue, and three small ones, so a field of clumps never repeats a shape.
 const shapes=[{kind:'puff',flat:true,x,y:y-S*1.2,r:S*6.6*(1+.06*wave(1,0)),heat:.5}];
 const TONGUES=[[[-1,15,5.6,1],[5.4,7,3.2,2]],[[-3.2,14,4.6,1],[3.6,9,4,2]],[[-5,9,3.6,1],[.4,12,4,2],[5.4,8,3.4,1]]];
 for(const [i,[offset,height,width,cycles]] of TONGUES[variant%3].entries()){
  const bx=x+S*(offset+(rand()-.5)*1.2),by=y-S*2.2,tall=S*height*(.9+rand()*.2)*(1+.18*wave(cycles,i+1)),sway=S*2*wave(cycles===2?1:2,i+4);
  shapes.push({kind:'tongue',bx,by,tx:bx+sway,ty:by-tall,w:S*width,bulge:1.45,shoulder:.5,heat:i===0?.35:.2});
 }
 // A spark hops off the top of the flames once per loop.
 const spark=wrap(frame)/FIRE_FRAMES;
 fillFlames(ctx,shapes,zoom);
 if(stage>1&&spark>.25&&spark<.8){const lift=(spark-.25)/.55;ctx.fillStyle=FLAME_PALETTE.inner;ctx.beginPath();ctx.arc(x+S*(3*Math.sin(phase[14])+2*lift),y-S*(18+14*lift),zoom*(1.2-.6*lift),0,TAU);ctx.fill();}
}

// The scorched tile under the flames: charred ground, a breathing glow and twinkling embers.
export function drawScorch(ctx,x,y,zoom,turns,frame){
 const stage=fireStage(turns),a=26*zoom,b=13*zoom;
 ctx.save();
 ctx.globalAlpha=.5;ctx.fillStyle=SMOKE_PALETTE.outline;
 ctx.beginPath();ctx.moveTo(x,y-b);ctx.lineTo(x+a,y);ctx.lineTo(x,y+b);ctx.lineTo(x-a,y);ctx.closePath();ctx.fill();
 ctx.globalAlpha=(.3+.08*flicker(frame,1))*(stage===3?1:stage===2?.8:.55);ctx.fillStyle=FLAME_PALETTE.body;
 ctx.beginPath();ctx.ellipse(x,y,a*.8,b*.8,0,0,TAU);ctx.fill();
 ctx.globalAlpha=1;
 const rand=random(hash(stage,59));
 for(let i=0;i<6;i++){
  const u=(rand()-.5)*1.3,v=(rand()-.5)*1.3,px=(u-v)*a*.5,py=(u+v)*b*.5,glow=flicker(frame,1+i%3,rand()*TAU);
  if(glow<.15)continue;
  ctx.fillStyle=i%2?FLAME_PALETTE.inner:FLAME_PALETTE.core;ctx.beginPath();ctx.arc(x+px,y+py,zoom*(.8+.6*glow),0,TAU);ctx.fill();
 }
 ctx.restore();
}

// Fire covers up to about 80 tiles for three rounds, so every clump and scorch frame is drawn once into a
// small canvas and stamped with drawImage. Frames are rendered at the next 1.5x step at or above the screen
// scale (zoom x device pixels, capped at 3.375) and the cache is dropped when that step changes, so ordinary
// zooming rarely re-renders and the cache stays a few megabytes even at full zoom.
export function fireSprites(makeCanvas){
 const cache=new Map();let step=0;
 const stepFor=scale=>Math.min(3.375,1.5**Math.ceil(Math.log(Math.max(scale,.3))/Math.log(1.5)-1e-9));
 function sprite(kind,turns,variant,frame){
  const id=`${kind}:${turns}:${variant}:${frame}`;let canvas=cache.get(id);if(canvas)return canvas;
  const box=kind==='clump'?CLUMP_BOX:SCORCH_BOX;
  canvas=makeCanvas(Math.ceil(box.w*step),Math.ceil(box.h*step));
  const g=canvas.getContext('2d');g.setTransform(step,0,0,step,0,0);
  if(kind==='clump')drawFireClump(g,box.ox,box.oy,1,turns,frame,variant);else drawScorch(g,box.ox,box.oy,1,turns,frame);
  cache.set(id,canvas);return canvas;
 }
 return {
  get size(){return cache.size;},
  get step(){return step;},
  // Stamps a clump or scorch whose ground point is (x, y). grow scales it about that point.
  draw(ctx,kind,x,y,{zoom,pixelRatio=1,turns,variant=0,frame=0,grow=1}){
   const next=stepFor(zoom*pixelRatio);if(next!==step){step=next;cache.clear();}
   if(!(grow>0))return;
   const box=kind==='clump'?CLUMP_BOX:SCORCH_BOX,k=zoom*grow;
   ctx.drawImage(sprite(kind,fireStage(turns),kind==='clump'?variant%3:0,wrap(frame)),x-box.ox*k,y-box.oy*k,box.w*k,box.h*k);
  },
 };
}
