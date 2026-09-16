// CPU reference renderer: one shared frame can be reused by every water tile.
export const LOOP_SECONDS=6;
const TAU=Math.PI*2;
const wrap=x=>((x%1)+1)%1;
function sample(src,w,h,u,v,c){
 const x=wrap(u)*w,y=wrap(v)*h,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(a,b)=>src[((b%h)*w+(a%w))*4+c];
 return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
// Each source wrap is hidden by a zero-weight band. Unlike mirroring, this
// preserves ripple direction; both value and first derivative remain periodic.
export function makePeriodic(src,w,h,size=192){
 const out=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,ax=Math.sin(Math.PI*u)**2,ay=Math.sin(Math.PI*v)**2,i=(y*size+x)*4;
  for(let c=0;c<3;c++)out[i+c]=
   sample(src,w,h,u,v,c)*ax*ay+
   sample(src,w,h,u+.5,v,c)*(1-ax)*ay+
   sample(src,w,h,u,v+.5,c)*ax*(1-ay)+
   sample(src,w,h,u+.5,v+.5,c)*(1-ax)*(1-ay);
  out[i+3]=255;
 }
 // Remove broad light/dark bands from the source while retaining small ripples.
 // A circular box blur keeps the normalization periodic, including at edges.
 const horizontal=new Float32Array(out.length),blurred=new Float32Array(out.length);
 const radius=Math.max(2,Math.round(size/16)),span=radius*2+1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let c=0;c<3;c++){
  let sum=0;
  for(let k=-radius;k<=radius;k++)sum+=out[(y*size+(x+k+size)%size)*4+c];
  horizontal[(y*size+x)*4+c]=sum/span;
 }
 const mean=[0,0,0];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let c=0;c<3;c++){
  let sum=0;
  for(let k=-radius;k<=radius;k++)sum+=horizontal[(((y+k+size)%size)*size+x)*4+c];
  blurred[(y*size+x)*4+c]=sum/span;
  mean[c]+=out[(y*size+x)*4+c]/(size*size);
 }
 for(let i=0;i<out.length;i+=4)for(let c=0;c<3;c++)out[i+c]=mean[c]+1.35*(out[i+c]-blurred[i+c]);
 // Break up long painted streaks before repetition. Integer rotations and
 // periodic bends keep this mixture continuous across both tile boundaries.
 const mixed=new Uint8ClampedArray(out.length);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size;
  const a=u+.025*Math.sin(TAU*v)+.012*Math.cos(TAU*(2*v+u));
  const b=v+.025*Math.sin(TAU*u+.7)+.01*Math.cos(TAU*(2*u-v));
  const i=(y*size+x)*4;
  for(let c=0;c<3;c++)mixed[i+c]=
   .5*sample(out,size,size,a,b,c)+
   .3*sample(out,size,size,b+.31,-a+.17,c)+
   .2*sample(out,size,size,-a+.63,-b+.41,c);
  mixed[i+3]=255;
 }
 return mixed;
}
export function waterPixel(base,size,u,v,seconds){
 u=wrap(u);v=wrap(v);
 const phase=TAU*wrap(seconds/LOOP_SECONDS);
 const du=.012*Math.sin(TAU*v+phase)+.005*Math.sin(TAU*(u+v)-phase*2);
 const dv=.009*Math.cos(TAU*u-phase)+.004*Math.sin(TAU*(u-v)+phase);
 // Let painted highlights move with the surface. A diagonal brightness wave
 // reads as a repeated stripe even when the pixel edges match perfectly.
 return [0,1,2].map(c=>Math.round(sample(base,size,size,u+du,v+dv,c))).concat(255);
}
export function renderWaterFrame(base,size,seconds,out=new Uint8ClampedArray(size*size*4)){
 // Duplicate terminal samples so opposite edges match exactly at every phase.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)out.set(waterPixel(base,size,x/(size-1),y/(size-1),seconds),(y*size+x)*4);
 return out;
}
