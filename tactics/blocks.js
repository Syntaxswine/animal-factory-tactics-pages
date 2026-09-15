import {blankMap,validateMap,terrainAt,setTerrain,edgeKey,edgeCells,tileKey,roofTop} from './maps.js';
import {propCells,GROUNDS} from './environment.js';
export const isBlock=d=>d?.kind==='red-shift-block';
const inside=(p,x,y)=>p.x>=x&&p.x<x+24&&p.y>=y&&p.y<y+24;
const shift=(p,x,y)=>({...p,x:p.x+x,y:p.y+y});
export function blockCanvas(name='Untitled block'){const m=blankMap(name);m.starts=[{x:230,y:230,z:0},{x:231,y:230,z:0},{x:230,y:231,z:0},{x:231,y:231,z:0}];m.exits=[{x:232,y:230,z:0}];return m;}
export function extractBlock(m,sx=0,sy=0){if(!Number.isInteger(sx)||!Number.isInteger(sy)||sx<0||sx>9||sy<0||sy>9)throw Error('Choose a sector from1 to10.');const x=sx*24,y=sy*24;
 for(const p of m.props||[]){const cells=propCells(p);if(cells.some(q=>inside(q,x,y))&&!cells.every(q=>inside(q,x,y)))throw Error('A prop crosses this sector boundary. Move it fully inside or outside first.');}
 for(const p of m.climbs||[])if(inside(p,x,y)!==inside(roofTop(p),x,y))throw Error('A roof climb crosses this sector boundary.');
 const d={kind:'red-shift-block',version:1,size:24,levels:3,name:m.name,terrain:Array.from({length:24},(_,dy)=>Array.from({length:24},(_,dx)=>terrainAt(m,x+dx,y+dy))),upper:[{},{}],edges:{},props:(m.props||[]).filter(p=>inside(p,x,y)).map(p=>shift(p,-x,-y)),stairs:m.stairs.filter(p=>inside(p,x,y)).map(p=>shift(p,-x,-y)),climbs:(m.climbs||[]).filter(p=>inside(p,x,y)).map(p=>shift(p,-x,-y)),guards:m.guards.filter(p=>inside(p,x,y)).map(p=>shift(p,-x,-y))};
 for(let z=1;z<3;z++)for(let dy=0;dy<24;dy++)for(let dx=0;dx<24;dx++){const t=terrainAt(m,x+dx,y+dy,z);if(t!=='void')d.upper[z-1][tileKey(dx,dy)]=t;}
 for(const [k,v]of Object.entries(m.edges)){const cells=edgeCells(k);if(cells.some(p=>inside(p,x,y))){const [axis,xs,ys,zs]=k.split(':');d.edges[edgeKey(axis,Number(xs)-x,Number(ys)-y,Number(zs||0))]=v;}}return d;
}
function applyData(m,d,x,y){for(let dy=0;dy<24;dy++)for(let dx=0;dx<24;dx++){setTerrain(m,x+dx,y+dy,0,d.terrain[dy][dx]);for(let z=1;z<3;z++)setTerrain(m,x+dx,y+dy,z,d.upper[z-1][tileKey(dx,dy)]||'void');}
 for(const [k,v]of Object.entries(d.edges)){const [a,b,c,z]=k.split(':');m.edges[edgeKey(a,Number(b)+x,Number(c)+y,Number(z||0))]=v;}
 for(const field of ['props','stairs','climbs','guards'])m[field]=[...(m[field]||[]),...d[field].map(p=>shift(p,x,y))];}
export function validateBlock(d){if(!isBlock(d)||d.version!==1||d.size!==24||d.levels!==3)throw Error('Expected a24×24 block with3levels.');if(!Array.isArray(d.terrain)||d.terrain.length!==24||d.terrain.some(r=>!Array.isArray(r)||r.length!==24))throw Error('Invalid block ground.');if(!Array.isArray(d.upper)||d.upper.length!==2||d.upper.some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw Error('Invalid block upper floors.');for(const field of ['props','stairs','climbs','guards'])if(!Array.isArray(d[field])||d[field].some(p=>!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||!inside(p,0,0)))throw Error('Invalid block '+field);if(!d.edges||typeof d.edges!=='object'||Array.isArray(d.edges))throw Error('Invalid block edges.');
 for(const layer of d.upper)for(const k of Object.keys(layer)){if(!['yard','floor','crate','bridge',...GROUNDS].includes(layer[k]))throw Error('Invalid upper floor terrain.');const [x,y]=k.split(',').map(Number);if(k!==tileKey(x,y)||!Number.isInteger(x)||!Number.isInteger(y)||!inside({x,y},0,0))throw Error('Upper floor extends beyond block.');}
 for(const k of Object.keys(d.edges)){const [axis,x,y,z]=k.split(':');if(k!==edgeKey(axis,Number(x),Number(y),Number(z||0)))throw Error('Noncanonical block edge.');if(!/^(e|s):(-?\d+):(-?\d+)(?::[12])?$/.test(k)||!edgeCells(k).some(p=>inside(p,0,0)))throw Error('Edge extends beyond block.');}
 if(d.props.some(p=>!propCells(p).every(q=>inside(q,0,0)))||d.climbs.some(p=>!inside(roofTop(p),0,0)))throw Error('An object crosses the block boundary.');
 const m=blockCanvas(d.name);applyData(m,d,0,0);const errors=validateMap(m,{connectivity:false});if(errors.length)throw Error(errors[0]);return d;
}
export function openBlock(d){validateBlock(d);const m=blockCanvas(d.name);applyData(m,d,0,0);return m;}
export function placeBlock(m,d,sx,sy){validateBlock(d);if(!Number.isInteger(sx)||!Number.isInteger(sy)||sx<0||sx>9||sy<0||sy>9)throw Error('Choose a sector from1 to10.');const x=sx*24,y=sy*24;
 for(const p of m.props||[])if(propCells(p).some(q=>inside(q,x,y))&&!propCells(p).every(q=>inside(q,x,y)))throw Error('An existing prop crosses the destination boundary.');
 for(const p of m.climbs||[])if(inside(p,x,y)!==inside(roofTop(p),x,y))throw Error('An existing climb crosses the destination boundary.');
 const out=structuredClone(m);for(const k of Object.keys(out.edges))if(edgeCells(k).some(p=>inside(p,x,y)))delete out.edges[k];for(const field of ['props','stairs','climbs','guards'])out[field]=(out[field]||[]).filter(p=>!inside(p,x,y));applyData(out,d,x,y);const errors=validateMap(out,{connectivity:false});if(errors.length)throw Error(errors[0]);return out;
}
