// Connection bits: north=1, east=2, south=4, west=8.
export const N=1,E=2,S=4,W=8;
export const BANK_NAMES=['Pool','North end','East end','NE bend','South end','NS straight','ES bend','NES junction','West end','WN bend','EW straight','NEW junction','SW bend','NSW junction','ESW junction','Crossing'];
const clamp=x=>Math.max(0,Math.min(1,x));
function segmentDistance(x,y,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));
 return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
export function bankDistance(mask,u,v){
 let d=Math.hypot(u-.5,v-.5);
 for(const [bit,x,y] of [[N,.5,0],[E,1,.5],[S,.5,1],[W,0,.5]])
  if(mask&bit)d=Math.min(d,segmentDistance(u,v,.5,.5,x,y));
 // Quarter-circle centerlines give bends matching tangents and widths at ports.
 const corner={3:[1,0],6:[1,1],9:[0,0],12:[0,1]}[mask];
 if(corner)d=Math.abs(Math.hypot(u-corner[0],v-corner[1])-.5);
 // Interior variation tapers to zero with zero slope at all boundaries.
 const fade=(Math.sin(Math.PI*u)*Math.sin(Math.PI*v))**2;
 return d-.235+fade*.012*(Math.sin(19*u+7*v)+.5*Math.sin(11*v-5*u));
}
export function makeBankOverlay(mask,grass,size){
 const out=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1),d=bankDistance(mask,u,v),i=(y*size+x)*4;
  const gx=x===size-1?0:x,gy=y===size-1?0:y,gi=(gy*size+gx)*4;
  const mud=1-clamp((d-.012)/.075),wet=1-clamp((d+.008)/.035);
  const alpha=clamp((d+.006)/.012);
  for(let c=0;c<3;c++){
   const soil=grass[gi+c]*[.83,.69,.53][c]+[15,9,5][c];
   out[i+c]=(grass[gi+c]*(1-mud)+soil*mud)*(1-.18*wet);
  }
  out[i+3]=Math.round(alpha*255);
 }
 return out;
}
export function connectionMask(cells,x,y){
 let mask=0;
 for(const [bit,dx,dy] of [[N,0,-1],[E,1,0],[S,0,1],[W,-1,0]])if(cells.has((x+dx)+','+(y+dy)))mask|=bit;
 return mask;
}
