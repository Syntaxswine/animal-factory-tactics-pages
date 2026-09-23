// Flamethrower burst animation: a cartoon jet from the painted nozzle, drawn in canvas code.
// Every shape is outlined once around its union and shaded in flat bands, like the painted sprites.
// Pure and deterministic: the same (options, t) always draws the same frame, so a burst can be scrubbed.
import {FLAME_NOZZLES} from './flame-nozzles.js';
import {targetHeight} from './projectiles.js';

// One burst, in milliseconds from the trigger pull. Fuel leaves the nozzle between ignite and cutoff and
// needs `travel` to land, so the jet reaches the target at `impact` and the last fuel lands at `empty`.
export const FLAME={ignite:70,travel:190,impact:260,cutoff:640,empty:830,end:1250};
export const SHOT_MS=650;
export const eventMs=event=>event?.incendiary?FLAME.end:SHOT_MS;
export const effectMs=effect=>(effect?.sequence||[effect]).reduce((sum,event)=>sum+eventMs(event),0);
// Which event of an attack sequence is playing `elapsed` ms after it started, and how far into it.
// Mirrors the renderer's original rule for bullets: events play back to back, the last one holds.
export function effectClock(effect,elapsed){
 const sequence=effect?.sequence||[effect];let start=0;
 for(const [index,event] of sequence.entries()){
  const length=eventMs(event);
  if(elapsed<start+length||index===sequence.length-1)return {index,event,local:Math.max(0,elapsed-start)};
  start+=length;
 }
 return null;
}

// Colours sampled from the sprites: their outline, red cloth, brass and cream highlights.
export const FLAME_PALETTE={outline:'#2f2014',rim:'#b3401f',body:'#de7a2c',inner:'#efb24a',core:'#fbe6c6'};
export const SMOKE_PALETTE={outline:'#3a332a',soot:'#5f574b',body:'#978d7b',light:'#c4b9a2'};
// Coat colours for the tufts that drift down after a fiery exit.
export const TUFTS={horse:'#8f4a26',goat:'#eadfc6',donkey:'#8e877c',sheep:'#f1e9d6',cow:'#7b4a2c',hen:'#b0502a','pig-foreman':'#e5a79a','pig-director':'#e5a79a',skunk:'#2c2825'};

// Nozzle position (screen offset from the unit's ground point) and barrel direction. This repeats
// app.js sprite placement exactly: frames are drawn at quarter scale, centred, with row 244 on the ground.
export function nozzleOffset(unit,frame,zoom){
 const facing=unit?.facing<0?-1:1,measured=FLAME_NOZZLES[frame?.src];
 if(measured){const angle=measured[2]*Math.PI/180;return {x:facing*(measured[0]-frame.width/2)/4*zoom,y:(measured[1]-244)/4*zoom,dx:facing*Math.cos(angle),dy:Math.sin(angle)};}
 // Vector overlay (flamethrower-art.js) draws its pilot light at (27, stance + 3) below a 3 px drop.
 const y=unit?.stance==='prone'?-16:unit?.stance==='kneeling'?-29:-42;
 return {x:facing*27*zoom,y:(y+6)*zoom,dx:facing,dy:0};
}
// Torso height in screen pixels (24 px per height unit, as tracers use). A body that has just fallen
// is measured as it stood, because that is where the flame arrived.
export const torsoLift=(unit,zoom)=>targetHeight({...unit,hp:1},'torso')*24*zoom;
// A miss lands on the floor beside the target, a little short, on a side chosen by the seed.
export function missLanding(event,seed){
 const dx=event.bx-event.ax,dy=event.by-event.ay,length=Math.hypot(dx,dy)||1,side=seed%2?1:-1,spread=.75+(seed%7)/14;
 return {x:event.bx-dx/length*.45-dy/length*side*spread,y:event.by-dy/length*.45+dx/length*side*spread};
}

const TAU=Math.PI*2;
const clamp=(v,low=0,high=1)=>Math.max(low,Math.min(high,v));
const easeOut=t=>1-(1-t)**3,easeIn=t=>t*t;
const easeBack=t=>{const c=1.7;return 1+(c+1)*(t-1)**3+c*(t-1)**2;};
function random(seed){let x=(seed>>>0)^0x9e3779b9||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}

// The shooter braces and the projector hums while fuel flows.
export function shooterShake(t,zoom,facing=1){
 if(t<FLAME.ignite||t>FLAME.cutoff+60)return {x:0,y:0};
 const settle=t>FLAME.cutoff?1-(t-FLAME.cutoff)/60:1;
 return {x:-facing*zoom*(.6+.5*Math.sin(t*.13))*settle,y:zoom*.35*Math.sin(t*.21)*settle};
}
// A missed target hops in surprise; a singed survivor shivers.
export function targetFlinch(t,zoom,outcome){
 const age=(t-FLAME.impact)/240;
 if(age<0||age>1)return {x:0,y:0};
 if(outcome==='miss')return {x:0,y:-zoom*6*Math.sin(Math.PI*age)};
 if(outcome==='hit')return {x:zoom*1.2*Math.sin(t*.55)*(1-age),y:0};
 return {x:0,y:0};
}
// A body burned down keeps its standing sprite until the flame reaches it and the soot covers the swap.
export const holdsFallenSprite=t=>t<FLAME.impact+50;

// Quadratic jet that leaves along the barrel and bends onto the landing point, with an arc-length table
// so billows spread evenly however sharply it bends.
function jetPath(from,dir,to){
 const vx=to.x-from.x,vy=to.y-from.y,distance=Math.hypot(vx,vy),along=distance?clamp((dir.x*vx+dir.y*vy)/distance,.2,1):1;
 const control={x:from.x+dir.x*distance*.4*along,y:from.y+dir.y*distance*.4*along-distance*.05};
 const at=u=>({x:(1-u)**2*from.x+2*(1-u)*u*control.x+u*u*to.x,y:(1-u)**2*from.y+2*(1-u)*u*control.y+u*u*to.y});
 const steps=24,lengths=[0];let previous=at(0);
 for(let i=1;i<=steps;i++){const p=at(i/steps);lengths.push(lengths[i-1]+Math.hypot(p.x-previous.x,p.y-previous.y));previous=p;}
 const total=lengths[steps];
 return {length:total,point(s){
  const goal=clamp(s)*total;let i=1;while(i<steps&&lengths[i]<goal)i++;
  const u=total?(i-1+clamp((goal-lengths[i-1])/((lengths[i]-lengths[i-1])||1)))/steps:clamp(s),p=at(u);
  let tx=2*(1-u)*(control.x-from.x)+2*u*(to.x-control.x),ty=2*(1-u)*(control.y-from.y)+2*u*(to.y-control.y);const m=Math.hypot(tx,ty);
  if(m>1e-6){tx/=m;ty/=m;}else{tx=dir.x;ty=dir.y;}
  return {x:p.x,y:p.y,tx,ty};
 }};
}

// Flame shapes are drawn as five nested passes; each pass fills the union of every shape at that pass's
// scale, so the outline only traces the outside and the colour bands never overlap each other.
const PASSES=[{colour:'outline',scale:1,outline:true,heat:0},{colour:'rim',scale:1,heat:0},{colour:'body',scale:.8,heat:0},{colour:'inner',scale:.5,heat:.3},{colour:'core',scale:.26,heat:.58}];
function addShape(ctx,shape,pass,ow){
 const k=pass.scale,grow=pass.outline?ow:0;
 if(shape.kind==='puff'){
  // Hot cores sit low in a flame, so inner bands drift down instead of stacking like a target.
  const r=shape.r*k+grow,y=shape.y+shape.r*(1-k)*.32;if(r<=.05)return;
  ctx.moveTo(shape.x+r*(shape.flat?1.25:1),y);ctx.ellipse(shape.x,y,r*(shape.flat?1.25:1),r*(shape.flat?.62:1),0,0,TAU);
 }else if(shape.kind==='tongue'){
  const w=shape.w*k+grow,bx=shape.bx,by=shape.by+shape.w*(1-k)*.4,reach=1-(1-k)*.55,tx=bx+(shape.tx-bx)*reach,ty=by+(shape.ty-by)*reach;
  const ax=tx-bx,ay=ty-by,h=Math.hypot(ax,ay);if(w<=.05||h<=.05)return;
  const ux=ax/h,uy=ay/h,nx=-uy,ny=ux,tipX=tx+ux*grow*1.4,tipY=ty+uy*grow*1.4,angle=Math.atan2(ny,nx);
  // bulge and shoulder shape the sides: the default is a slim jet tongue, larger values a rounder campfire flame.
  const bulge=shape.bulge??1.05,shoulder=shape.shoulder??.35;
  ctx.moveTo(tipX,tipY);
  ctx.quadraticCurveTo(bx+nx*w*bulge+ux*h*shoulder,by+ny*w*bulge+uy*h*shoulder,bx+nx*w,by+ny*w);
  ctx.arc(bx,by,w,angle,angle+Math.PI,false);
  ctx.quadraticCurveTo(bx-nx*w*bulge+ux*h*shoulder,by-ny*w*bulge+uy*h*shoulder,tipX,tipY);
  ctx.closePath();
 }else if(shape.kind==='rod'){
  // Traced clockwise on screen like canvas arcs: under the nonzero rule an opposite winding would cut
  // holes wherever a billow overlaps the rod.
  const left=[],right=[];
  for(const p of shape.points){const w=p.w*k+grow;left.push([p.x-p.ty*w,p.y+p.tx*w]);right.push([p.x+p.ty*w,p.y-p.tx*w]);}
  if(left.length<2)return;
  ctx.moveTo(right[0][0],right[0][1]);for(const q of right.slice(1))ctx.lineTo(q[0],q[1]);for(const q of left.reverse())ctx.lineTo(q[0],q[1]);ctx.closePath();
  for(const p of [shape.points[0],shape.points.at(-1)]){const w=p.w*k+grow;ctx.moveTo(p.x+w,p.y);ctx.arc(p.x,p.y,w,0,TAU);}
 }
}
export function fillFlames(ctx,shapes,zoom){
 const ow=Math.max(.8,zoom*1.05);
 for(const pass of PASSES){
  ctx.beginPath();ctx.fillStyle=FLAME_PALETTE[pass.colour];
  for(const shape of shapes)if(shape.heat>=pass.heat)addShape(ctx,shape,pass,ow);
  ctx.fill();
 }
}
// Cartoon smoke: a few lobes filled as one union, so a cloud has a single outline. Clouds never turn
// translucent (the outline would show through); they grow, drift and shrink away instead.
export function smokeCloud(ctx,x,y,r,zoom,soot=false,spin=0){
 if(!(r>.4))return;
 const c=Math.cos(spin),s=Math.sin(spin),lobes=[[-.55,.18,.7],[.52,.22,.66],[.02,-.3,.84],[-.08,.38,.58]].map(([dx,dy,k])=>[x+(dx*c-dy*s)*r,y+(dx*s+dy*c)*r,k*r]);
 const layer=(fill,grow,shiftX,shiftY,scale)=>{ctx.fillStyle=fill;ctx.beginPath();for(const [lx,ly,lr] of lobes){const R=lr*scale+grow,cx=lx+shiftX,cy=ly+shiftY;ctx.moveTo(cx+R,cy);ctx.arc(cx,cy,R,0,TAU);}ctx.fill();};
 layer(SMOKE_PALETTE.outline,Math.min(Math.max(.6,zoom*.7),r*.25),0,0,1);
 layer(soot?SMOKE_PALETTE.soot:SMOKE_PALETTE.body,0,0,0,1);
 layer(soot?SMOKE_PALETTE.body:SMOKE_PALETTE.light,0,-r*.14,-r*.18,.56);
}

// Draws one burst at `t` ms. from/dir: nozzle point and barrel direction on screen. to: landing point
// (target torso for a hit or kill, the floor for a miss). ground: the target's floor point, so a soot poof
// can hide the whole body. outcome: 'hit' | 'kill' | 'miss'.
export function drawFlameBurst(ctx,{from,dir,to,ground=null,t,zoom=1,outcome='hit',seed=1,tuft=null,still=false}){
 if(!(t>=0&&t<=FLAME.end))return;
 // Reduced motion holds one representative frame for the whole burst.
 if(still)t=FLAME.impact+220;
 // Per-burst random numbers; noise(i) wraps, so no index can fall off the table into NaN geometry.
 const rand=random(seed),table=Array.from({length:64},()=>rand()),noise=i=>table[((i%64)+64)%64],path=jetPath(from,dir,to),flicker=(i,speed=.05)=>Math.sin(t*speed+noise(i)*TAU);
 const miss=outcome==='miss',kill=outcome==='kill',landed=clamp((t-FLAME.impact)/140),fading=clamp((t-FLAME.empty)/(FLAME.end-FLAME.empty-80));
 const strength=t<FLAME.impact?0:easeBack(landed)*(1-easeIn(fading));
 const flames=[];
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';

 // Scorch left where a miss lands, under everything else.
 if(miss&&t>=FLAME.impact){ctx.globalAlpha=.34*clamp(landed*2)*(1-fading);ctx.fillStyle=SMOKE_PALETTE.outline;ctx.beginPath();ctx.ellipse(to.x,to.y,zoom*13,zoom*6.5,0,0,TAU);ctx.fill();ctx.globalAlpha=1;}

 // Smoke rising from the landing and from the far end of the jet, behind the fire.
 for(let k=0;k<7;k++){
  const born=FLAME.impact+60+k*85,age=(t-born)/640;if(age<=0||age>=1)continue;
  const lean=(noise(k+8)-.5)*zoom*20,base=miss?to:{x:to.x,y:to.y-zoom*6};
  smokeCloud(ctx,base.x+lean*easeOut(age),base.y-zoom*(10+36*easeOut(age)),zoom*(5+5*noise(k+20))*Math.sin(Math.PI*age)**.5,zoom,false,noise(k+16)*TAU);
 }
 for(let k=0;k<2;k++){
  const born=FLAME.ignite+190+k*190,age=(t-born)/620,s=.68+.16*k;if(age<=0||age>=1||born>FLAME.cutoff)continue;
  const p=path.point(s);smokeCloud(ctx,p.x+(noise(k+30)-.5)*zoom*10,p.y-zoom*(16+28*easeOut(age)),zoom*(6.5+3*noise(k+34))*Math.sin(Math.PI*age)**.5,zoom,false,noise(k+38)*TAU);
 }

 // Pilot flare before the fuel arrives.
 if(t<FLAME.ignite+80){
  const grow=easeOut(clamp(t/FLAME.ignite)),len=zoom*(3+6*grow)*(1+.15*flicker(1,.09)),shrink=1-clamp((t-FLAME.ignite)/80);
  flames.push({kind:'tongue',bx:from.x,by:from.y,tx:from.x+dir.x*len*shrink,ty:from.y+dir.y*len*shrink-zoom*2*grow,w:zoom*2*grow*shrink,heat:1});
 }

 // The jet: a smooth rod of burning fuel that breaks into rolling billows as it slows and spreads, with
 // tongues licking upward. Billows only start a fifth of the way out, where the fuel has slowed enough to
 // crowd together; nearer the nozzle they would string out like beads.
 const flow=emitted=>{const x=clamp((t-emitted)/FLAME.travel);return 1-(1-x)*(1-x);};
 const head=t<FLAME.ignite?0:flow(FLAME.ignite),tail=t<FLAME.cutoff?0:flow(FLAME.cutoff);
 if(head>tail){
  const points=[];
  for(let i=0;i<=20;i++){const s=tail+(head-tail)*i/20,p=path.point(s);points.push({...p,w:zoom*(1.3+4.6*s)*(1+.1*flicker(i,.08))});}
  flames.push({kind:'rod',points,heat:t<FLAME.cutoff?.6:.35});
  if(tail===0){const p=path.point(Math.min(head,.03));flames.push({kind:'puff',x:p.x+dir.x*zoom,y:p.y+dir.y*zoom,r:zoom*(2.5+.5*flicker(2,.11)),heat:1});}
 }
 for(let k=0;;k++){
  const emitted=FLAME.ignite+k*8;if(emitted>FLAME.cutoff||emitted>t)break;
  const s=flow(emitted);if(s>=1||s<.14)continue;
  const p=path.point(s),grow=easeOut(clamp((s-.14)/.3)),wobble=zoom*(.3+3.2*s)*flicker(k+3,.021),rise=zoom*13*s*s;
  const r=zoom*(2.2+10*s**.85)*grow*(.8+.4*noise(k*7))*(1+.12*flicker(k,.047));
  const x=p.x-p.ty*wobble,y=p.y+p.tx*wobble-rise;
  flames.push({kind:'puff',x,y,r,heat:.2});
  if(k%3===0&&s>.35)flames.push({kind:'tongue',bx:x,by:y-r*.35,tx:x-p.tx*r*.4,ty:y-r*(.95+.5*(.5+.5*flicker(k+9,.07))),w:r*.42,heat:.2});
 }

 // Where the jet lands: a blossom on a body, or a splash spreading across the floor.
 if(strength>0){
  const reach=zoom*(miss?15:kill?18:16)*strength,sway=i=>.5+.5*flicker(i+40,.08);
  if(miss){
   for(let i=0;i<7;i++){const a=i/7*TAU+noise(44)*TAU,x=to.x+Math.cos(a)*reach*.8,y=to.y+Math.sin(a)*reach*.4;flames.push({kind:'puff',flat:true,x,y,r:reach*.3,heat:.45});if(Math.sin(a)<.5)flames.push({kind:'tongue',bx:x,by:y,tx:x+Math.cos(a)*reach*.18,ty:y-reach*(.6+.55*sway(i)),w:reach*.2,heat:.5});}
   flames.push({kind:'puff',flat:true,x:to.x,y:to.y,r:reach*.5,heat:.7});
  }else{
   for(let i=0;i<8;i++){const a=i/8*TAU+noise(45)*TAU,c=Math.cos(a),n=Math.sin(a)*.8,bx=to.x+c*reach*.3,by=to.y+n*reach*.3;flames.push({kind:'tongue',bx,by,tx:to.x+c*reach*(.9+.3*sway(i)),ty:to.y+(n-.7)*reach*(.85+.35*sway(i)),w:reach*.28,heat:.5});}
   for(let i=0;i<3;i++){const a=noise(46+i)*TAU;flames.push({kind:'puff',x:to.x+Math.cos(a)*reach*.3,y:to.y+Math.sin(a)*reach*.25,r:reach*.4,heat:.2});}
   flames.push({kind:'puff',x:to.x,y:to.y,r:reach*.55,heat:.45*(1-fading)});
  }
 }
 fillFlames(ctx,flames,zoom);

 // Embers pop out of the landing and fall back.
 for(let k=0;k<9;k++){
  const born=FLAME.impact+k*26,age=(t-born)/(340+noise(k+50)*160);if(age<=0||age>=1)continue;
  const a=-Math.PI*(.12+.76*noise(k+12)),speed=zoom*(22+18*noise(k+24)),x=to.x+Math.cos(a)*speed*age,y=to.y+Math.sin(a)*speed*age+zoom*26*age*age;
  ctx.fillStyle=k%2?FLAME_PALETTE.inner:FLAME_PALETTE.core;ctx.beginPath();ctx.arc(x,y,zoom*(1.25-.6*age),0,TAU);ctx.fill();
 }

 // A fiery exit ends in a round puff of soot, and a few tufts of coat drift down out of it.
 if(kill){
  const start=FLAME.impact+10,age=(t-start)/860;
  if(age>0&&age<1){
   // Pops to full size within ~80 ms, before the fallen sprite is swapped out underneath it.
   // One round cloud over the whole body, feet to head, so no part of it vanishes in the open. Lobes
   // start packed together and billow outward; the lower ones are drawn last so the cloud stacks upward.
   const size=easeOut(clamp(age*11))*(1-easeIn(clamp((age-.5)/.5))),floor=ground?ground.y:to.y+zoom*24;
   const cx=to.x,cy=(to.y+floor)/2-zoom*3,rx=zoom*12,ry=Math.max(zoom*12,(floor-to.y)/2+zoom*4),spread=.45+.75*easeOut(clamp(age*2.4)),lift=zoom*18*easeOut(age);
   const lobes=Array.from({length:11},(_,i)=>{const a=i/11*TAU+noise(56)*TAU,f=Math.sqrt(noise(i+1));return {x:cx+Math.cos(a)*rx*f*spread,y:cy+Math.sin(a)*ry*f*spread-lift*(.7+.3*f),r:zoom*(8+4*noise(i+33))*size*(1.15-.35*f),soot:i%3===0,spin:noise(i+57)*TAU};}).sort((p,q)=>p.y-q.y);
   for(const lobe of lobes)smokeCloud(ctx,lobe.x,lobe.y,lobe.r,zoom,lobe.soot,lobe.spin);
  }
  const drift=(t-(FLAME.impact+200))/(FLAME.end-FLAME.impact-200);
  if(tuft&&drift>0&&drift<1){
   ctx.globalAlpha=1-easeIn(drift);
   for(let i=0;i<4;i++){
    const x=to.x+zoom*(i-1.5)*9+zoom*6*Math.sin(drift*TAU*1.1+i*2.1),y=to.y-zoom*18+zoom*(30+i*6)*drift,tilt=.7*Math.sin(drift*TAU*1.3+i);
    ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.fillStyle=SMOKE_PALETTE.outline;ctx.beginPath();ctx.ellipse(0,0,zoom*5.4,zoom*2.7,0,0,TAU);ctx.fill();
    ctx.fillStyle=tuft;ctx.beginPath();ctx.ellipse(0,0,zoom*4.3,zoom*1.7,0,0,TAU);ctx.fill();ctx.restore();
   }
   ctx.globalAlpha=1;
  }
 }

 // The projector coughs out a smoke ring when the fuel stops.
 const ring=(t-FLAME.cutoff-30)/520;
 if(ring>0&&ring<1){
  const along=zoom*(4+22*easeOut(ring)),x=from.x+dir.x*along,y=from.y+dir.y*along-zoom*9*ring,angle=Math.atan2(dir.y,dir.x);
  ctx.globalAlpha=(1-ring)**.6;
  for(const [colour,width] of [[SMOKE_PALETTE.outline,3.6],[SMOKE_PALETTE.light,1.9]]){
   ctx.strokeStyle=colour;ctx.lineWidth=zoom*width*(1-ring*.5);ctx.beginPath();ctx.ellipse(x,y,zoom*(2.4+3.4*ring),zoom*(4.6+8*ring),angle,0,TAU);ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 ctx.restore();
}
