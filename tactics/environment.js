// Explicit game rules for the supplied environment art. Manifest prose is not executable.
export const GROUNDS=['ground-dirt','ground-gravel','ground-grass','ground-concrete','ground-asphalt','ground-tiles'];
export const PROPS={
 'crate-wood':{w:1,h:1,cover:25,solid:true},'crate-steel':{w:1,h:1,cover:25,solid:true},'crate-stack':{w:1,h:1,cover:25,solid:true,tall:true},
 'table-wood':{w:2,h:1,cover:25,solid:true},'table-steel':{w:2,h:1,cover:25,solid:true},'workbench-vise':{w:2,h:1,cover:25,solid:true},'workbench-metal':{w:2,h:1,cover:25,solid:true},
 'barrel-single':{w:1,h:1,cover:25,solid:true},'barrels-cluster':{w:1,h:1,cover:25,solid:true},sandbags:{w:1,h:1,cover:25,solid:true},pallet:{w:1,h:1,cover:0,solid:false}
};
export const EDGES={'fence-cut':{solid:false,opaque:false,cover:0},wall:{solid:true,opaque:true,cover:25,art:'wall-concrete'},door:{solid:false,opaque:false,cover:0},'wall-concrete':{solid:true,opaque:true,cover:25,art:'wall-concrete'},'wall-corrugated':{solid:true,opaque:true,cover:25,art:'wall-corrugated'},'wall-brick':{solid:true,opaque:true,cover:25,art:'wall-brick'},'fence-chainlink':{solid:true,opaque:false,cover:0,art:'fence-chainlink'},'fence-railing':{solid:true,opaque:false,cover:0,art:'fence-railing'}};
Object.assign(EDGES,{
 'window-concrete':{solid:true,opaque:true,window:true,cover:25,art:'window-concrete'},'window-brick':{solid:true,opaque:true,window:true,cover:25,art:'window-brick'},'window-corrugated':{solid:true,opaque:true,window:true,cover:25,art:'window-corrugated'},
 'door-steel-closed':{solid:true,opaque:true,cover:25,art:'door-steel-closed'},'door-wood-closed':{solid:true,opaque:true,cover:25,art:'door-wood-closed'},'doorway-concrete-open':{solid:false,opaque:false,cover:0,art:'doorway-concrete-open'}
});
export const floorTerrain=t=>['floor','yard','bridge',...GROUNDS].includes(t);
export function propCells(p){const rule=PROPS[p.kind];if(!rule)return [];const w=p.rotated?rule.h:rule.w,h=p.rotated?rule.w:rule.h;return Array.from({length:w*h},(_,i)=>({x:p.x+i%w,y:p.y+Math.floor(i/w),z:p.z??0}));}
const indexes=new WeakMap();
export function propAt(m,x,y,z=0){const props=m.props;if(!props)return undefined;let index=indexes.get(props);if(!index){index=new Map();for(const p of props)for(const q of propCells(p))index.set(`${q.x},${q.y},${q.z}`,p);indexes.set(props,index);}return index.get(`${x},${y},${z}`);}
export const propBlocks=(m,x,y,z=0)=>!!PROPS[propAt(m,x,y,z)?.kind]?.solid;
export const propTall=(m,x,y,z=0)=>!!PROPS[propAt(m,x,y,z)?.kind]?.tall;
