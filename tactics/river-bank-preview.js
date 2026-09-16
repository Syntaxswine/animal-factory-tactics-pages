import {makePeriodic,renderWaterFrame,LOOP_SECONDS} from './water-animation.js';
import {makeShoreOverlay,SHORE_VARIANTS,shoreMask} from './shore-tiles.js';
const size=128,count=6,canvas=document.querySelector('#river'),ctx=canvas.getContext('2d');
const status=document.querySelector('#status'),play=document.querySelector('#play'),grid=document.querySelector('#grid');
const makeCanvas=()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;};
async function texture(src){
 const img=new Image();img.src=src;await img.decode();const c=makeCanvas(),g=c.getContext('2d',{willReadFrequently:true});
 g.drawImage(img,0,0,size,size);return makePeriodic(g.getImageData(0,0,size,size).data,size,size,size);
}
let running=!matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,last,seed=0;
try{
 const [water,grass]=await Promise.all([texture('../assets/environment/foliage/river-water.png'),texture('../assets/environment/ground-grass.png')]);
 const waterCanvas=makeCanvas(),wc=waterCanvas.getContext('2d'),frame=wc.createImageData(size,size);
 const overlays=Array.from({length:SHORE_VARIANTS*16},(_,i)=>{const c=makeCanvas();c.getContext('2d').putImageData(new ImageData(makeShoreOverlay(i%16,Math.floor(i/16),grass,size),size,size),0,0);return c;});
 const layouts={
  river:(x,y)=>Math.abs(x-(3+1.1*Math.sin(y*.95)))>1.05,
  lake:(x,y)=>Math.hypot((x-3)/1.5,(y-3)/1.1)>1.7,
  coast:(x,y)=>x<2.8+.8*Math.sin(y*1.1)
 };
 const atlas=document.querySelector('#atlas'),ag=atlas.getContext('2d');
 function draw(){
  renderWaterFrame(water,size,time,frame.data);wc.putImageData(frame,0,0);
  const isLand=layouts[document.querySelector('#layout').value];
  for(let y=0;y<count;y++)for(let x=0;x<count;x++){
   const mask=shoreMask(isLand,x,y),variant=(x*7+y*11+seed)%SHORE_VARIANTS;
   ctx.drawImage(waterCanvas,x*size,y*size);ctx.drawImage(overlays[variant*16+mask],x*size,y*size);
  }
  const variant=Number(document.querySelector('#variant').value);
  for(let mask=0;mask<16;mask++){const x=mask%4*size,y=Math.floor(mask/4)*size;ag.drawImage(waterCanvas,x,y);ag.drawImage(overlays[variant*16+mask],x,y);}
  if(grid.checked){
   ctx.strokeStyle='#eed99388';ctx.beginPath();for(let i=1;i<count;i++){ctx.moveTo(i*size,0);ctx.lineTo(i*size,768);ctx.moveTo(0,i*size);ctx.lineTo(768,i*size);}ctx.stroke();
   ctx.fillStyle='#fff1a8';
   for(let y=0;y<=count;y++)for(let x=0;x<count;x++)if(isLand(x,y)!==isLand(x+1,y)){ctx.beginPath();ctx.arc((x+.5)*size,y*size,3,0,Math.PI*2);ctx.fill();}
   for(let y=0;y<count;y++)for(let x=0;x<=count;x++)if(isLand(x,y)!==isLand(x,y+1)){ctx.beginPath();ctx.arc(x*size,(y+.5)*size,3,0,Math.PI*2);ctx.fill();}
  }
  status.textContent='48 shoreline tiles · fixed edge meeting points · '+time.toFixed(2)+' / '+LOOP_SECONDS+' seconds';
 }
 play.textContent=running?'Pause':'Play';play.onclick=()=>{running=!running;play.textContent=running?'Pause':'Play';last=undefined;};
 for(const id of ['layout','variant'])document.querySelector('#'+id).onchange=draw;
 grid.onchange=draw;document.querySelector('#shuffle').onclick=()=>{seed=(seed+1)%SHORE_VARIANTS;draw();};
 document.querySelector('#download').onclick=()=>{
  const sheet=document.createElement('canvas');sheet.width=size*4;sheet.height=size*12;const g=sheet.getContext('2d');
  for(let i=0;i<48;i++)g.drawImage(overlays[i],i%4*size,Math.floor(i/4)*size);
  const a=document.createElement('a');a.href=sheet.toDataURL('image/png');a.download='shore-tiles-128px-4x12.png';a.click();
 };
 document.querySelector('#legend').textContent='IDs 0–15, left to right. Land corner bits: NW 1, NE 2, SE 4, SW 8. 0 is all water; 15 is all land. All three variants share identical boundaries.';
 let lastDraw=0;
 function tick(now){if(running&&!document.hidden){if(last!==undefined)time=(time+(now-last)/1000)%LOOP_SECONDS;if(now-lastDraw>1000/24){draw();lastDraw=now;}}last=document.hidden?undefined:now;requestAnimationFrame(tick);}
 draw();requestAnimationFrame(tick);
}catch(e){status.textContent='Unable to load shoreline preview: '+e.message;}
