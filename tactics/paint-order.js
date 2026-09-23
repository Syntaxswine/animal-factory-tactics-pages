// Back-to-front order for everything drawn on a map level.
import {PROPS} from './environment.js';
import {alive} from './engine.js';

// Ground-layer props (walkable roofs) paint first, then scorched ground under burning tiles, then everything else.
export const paintLayer=o=>PROPS[o.kind]?.groundLayer?0:o.type==='scorch'?1:2;
// Within a layer, lower x + y is further back. On a tie the fallen paint first and standing units last.
export const paintDepth=o=>o.depth??o.x+o.y;
const tieRank=o=>o.type==='actor'?(alive(o.unit)?2:0):1;
export const paintOrder=(a,b)=>paintLayer(a)-paintLayer(b)||paintDepth(a)-paintDepth(b)||tieRank(a)-tieRank(b);

// A prop can paint extra pieces around itself, the way burning ground paints flame clumps: each
// piece is its own depth-sorted object so a unit on the tile has some in front and some behind.
// Walls and fences on the tile's sides sort at +/-.5 and a unit standing on it sorts at 0, so a
// piece stays inside this span and never reaches either.
export const PROP_PIECE_SPAN=.45,PROP_PIECE_MIN=.05;
// `side` is 'behind' to paint before a unit standing on the tile, 'front' to paint after it.
export function propPieceDepth(x,y,side,offset=.28){
 const u=Math.min(Math.max(Math.abs(offset),PROP_PIECE_MIN),PROP_PIECE_SPAN);
 return x+y+(side==='behind'?-u:u);
}
