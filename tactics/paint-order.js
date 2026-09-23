// Back-to-front order for everything drawn on a map level.
import {PROPS} from './environment.js';
import {alive} from './engine.js';

// Ground-layer props (walkable roofs) paint first, then scorched ground under burning tiles, then everything else.
export const paintLayer=o=>PROPS[o.kind]?.groundLayer?0:o.type==='scorch'?1:2;
// Within a layer, lower x + y is further back. On a tie the fallen paint first and standing units last.
export const paintDepth=o=>o.depth??o.x+o.y;
const tieRank=o=>o.type==='actor'?(alive(o.unit)?2:0):1;
export const paintOrder=(a,b)=>paintLayer(a)-paintLayer(b)||paintDepth(a)-paintDepth(b)||tieRank(a)-tieRank(b);
