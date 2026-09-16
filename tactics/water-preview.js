import {makePeriodic,renderWaterFrame,LOOP_SECONDS} from './water-animation.js';
const canvas=document.querySelector('#water'),ctx=canvas.getContext('2d');
const tile=document.createElement('canvas');tile.width=tile.height=192;
const tc=tile.getContext('2d',{willReadFrequently:true}),status=document.querySelector('#status');
const play=document.querySelector('#play'),scrub=document.querySelector('#scrub'),grid=document.querySelector('#grid');
let running=!matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,previous;
play.textContent=running?'Pause':'Play';
try{
 const img=new Image();img.src='../assets/environment/foliage/river-water.png';await img.decode();
 tc.drawImage(img,0,0,192,192);
 const base=makePeriodic(tc.getImageData(0,0,192,192).data,192,192);
 const frame=tc.createImageData(192,192);
 function draw(){
  renderWaterFrame(base,192,time,frame.data);tc.putImageData(frame,0,0);
  for(let y=0;y<3;y++)for(let x=0;x<3;x++)ctx.drawImage(tile,x*192,y*192);
  if(grid.checked){ctx.strokeStyle='#eed993';ctx.lineWidth=1;ctx.beginPath();for(let i=1;i<3;i++){ctx.moveTo(i*192,0);ctx.lineTo(i*192,576);ctx.moveTo(0,i*192);ctx.lineTo(576,i*192);}ctx.stroke();}
  scrub.value=time;status.textContent=time.toFixed(2)+' / '+LOOP_SECONDS+' seconds · 3×3 repeated tiles';
 }
 play.onclick=()=>{running=!running;play.textContent=running?'Pause':'Play';previous=undefined;};
 scrub.oninput=()=>{time=Number(scrub.value);running=false;play.textContent='Play';draw();};
 grid.onchange=draw;
 document.querySelector('#projection').onchange=e=>canvas.classList.toggle('iso',e.target.value==='iso');
 let lastDraw=0;
 function tick(now){
  if(running&&!document.hidden){if(previous!==undefined)time=(time+(now-previous)/1000)%LOOP_SECONDS;if(now-lastDraw>=1000/24){draw();lastDraw=now;}}
  previous=document.hidden?undefined:now;requestAnimationFrame(tick);
 }
 draw();requestAnimationFrame(tick);
}catch(error){status.textContent='Water preview failed to load: '+error.message;play.disabled=true;scrub.disabled=true;}
