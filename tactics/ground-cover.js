// Ground cover: low grass tufts on open ground, and dense undergrowth in woodland. Parcel K of
// docs/tactics/SCENERY-PORT-HANDOFF.md. This is look only. It adds no collision, no cover and no
// sight cost: woodland already charges nine tiles of optical distance per tile crossed, and
// woodland.js already measures the exact ray length.
//
// WHERE IT DRAWS. On the `dressing` stage of scene-passes.js, after the terrain and under the
// props, which is where the woodland bush already paints from environment-renderer.js. A unit
// standing on a tile is therefore always in front of that tile's cover, exactly as it is already
// always in front of the bush.
//
// PLACEMENT IS THE 3D BRANCH'S, HASH FOR HASH. `foliage-models.js` on project/tactics-3d picks
// tufts and undergrowth from a spatial hash of the tile; the constants, the index offsets into the
// random stream and the count rule below are that function's, so a map dressed here and the same
// map dressed there grow their grass in the same places. What does not port is the shading: every
// sprite in this game carries its own upper-left light baked into the painting, so the tufts and
// clumps are painted in the khaki-olive palette measured off ground-grass.png and bush.png rather
// than lit at runtime.
import {terrainAt,tileKey} from './maps.js';
import {propAt} from './environment.js';
import {addScenePass} from './scene-passes.js';

// Tufts grow on three terrains only. Grass and woodland get two a tile; yard gets one on a third of
// its tiles, so a yard reads as worn and a meadow as not.
export const TUFT_TERRAINS=['yard','ground-grass','woodland'];
export const COVER_TERRAIN='woodland';

const spatialHash=(x,y,z,a,b,c)=>(Math.imul(x+a,73856093)^Math.imul(y+b,19349663)^Math.imul(z+c,83492791))>>>0;
// Two different offsets, so a woodland tile's undergrowth is not stacked on its own tufts.
export const tuftSeed=(x,y,z=0)=>spatialHash(x,y,z,91,37,7);
export const coverSeed=(x,y,z=0)=>spatialHash(x,y,z,17,61,3);
// Deterministic by index rather than by call order: asking for draw 7 twice gives the same number,
// so a tile's dressing survives a reload, a camera move and a level switch unchanged.
export const seedRandom=seed=>i=>((Math.imul(seed^(i*374761393),1597334677)>>>0)%10000)/10000;
export const tuftCount=(terrain,seed)=>!TUFT_TERRAINS.includes(terrain)?0:terrain==='yard'?(seed%3===0?1:0):2;

export const TUFT_VARIANTS=6,COVER_VARIANTS=6;

// A tile is 56 x 28 px at zoom 1, so one tile unit across the ground is 28 px of screen width.
export const TILE_PX=28;
// And one tile unit of height is 28*sqrt(2)*cos(30 degrees) px, which is the lift the 3D branch's
// hybrid projection gives a point one unit above the floor. Using its number keeps a thing that is
// waist high there waist high here.
export const UNIT_PX=28*Math.SQRT2*Math.cos(Math.PI/6);
// One deliberate departure from the model. A tuft's box is .10 to .195 units tall, which is 3.4 to
// 6.7 px: wider than it is tall, and at that size a clump of blades averages down into a dark smear
// that reads as a stain on the grass rather than as grass. In the 3D scene the individual blades
// carry it; a sprite has to carry it in silhouette, so the tuft is drawn twice as tall as its box.
// Placement, count, spread and determinism are untouched -- this is only how tall the blades stand.
export const TUFT_LIFT=2;

// Sizes are in tile units, positions are absolute tile coordinates, so project() places them.
export function grassTufts(x,y,z=0,terrain='yard'){
 const seed=tuftSeed(x,y,z),random=seedRandom(seed),count=tuftCount(terrain,seed);
 return Array.from({length:count},(_,i)=>({
  x:x+(random(i+1)-.5)*.72,y:y+(random(i+3)-.5)*.72,
  width:.20+random(i+7)*.12,height:.10+random(i+5)*.095,
  variant:Math.floor(random(i+11)*TUFT_VARIANTS),
 }));
}
// Three masses a tile, waist high. The middle one takes the pale leaf tone, which is the one piece
// of the 3D branch's material assignment that survives into a painted sprite.
export function coverClumps(x,y,z=0,terrain='yard'){
 if(terrain!==COVER_TERRAIN)return [];
 const random=seedRandom(coverSeed(x,y,z));
 return Array.from({length:3},(_,i)=>({
  x:x+(random(i+1)-.5)*.5,y:y+(random(i+7)-.5)*.5,
  width:.58+random(i+5)*.25,height:.55+random(i+3)*.6,
  pale:i===1,variant:Math.floor(random(i+13)*COVER_VARIANTS),
 }));
}

// Measured off the existing artwork rather than chosen: the quadrant means of bush.png are #6a6135
// at the top left and #5d5530 at the bottom right, and the eight commonest tones in ground-grass.png
// run #473b24 to #756937. Downscaled to the 50 x 32 px it is actually drawn at, the painted bush is
// a speckled olive mound with no readable leaf detail, which is why clumps of flat blobs in these
// tones sit beside it without looking like a different game.
// A tuft is drawn into a 10 x 8 box and stamped 5.6 to 9.0 px wide, so a blade has to be about two
// box units thick to survive as one screen pixel, and its tones have to sit outside the ground's own
// noise, which runs luma 44 to 105. These reach 137 and 42, so a tuft reads as a shape rather than
// as more speckle.
const GRASS={lit:'#988b4e',mid:'#6a5f33',dark:'#302a17'};
const LEAF={lit:'#6a6135',mid:'#574e2c',dark:'#453d23',deep:'#2f2a19'};
const LEAF_PALE={lit:'#837a45',mid:'#6a6135',dark:'#544b2b',deep:'#3a331e'};
// The same wash drawTerrain paints over a remembered-but-unseen tile. A cover sprite is stamped
// after that wash, so the dimmed copy is baked into the sprite instead.
const FOG_DIM='#182c2899';
const TAU=Math.PI*2;

function shapeRandom(variant,salt){
 let x=(Math.imul(variant+1,2654435761)^Math.imul(salt,40503))>>>0||0x9e3779b9;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}

// Both shapes are drawn into a box `w` by `h` with the ground point at (ox, oy), then stamped
// scaled to whatever that particular tuft or clump measures, so one cached bitmap serves the whole
// size range of its variant.

// A low spreading tuft: five to seven blades off one root, the left-leaning ones catching the light.
export function drawTuft(g,ox,oy,w,h,variant){
 const rand=shapeRandom(variant,17),blades=5+variant%3;
 g.save();
 g.globalAlpha=.32;g.fillStyle=GRASS.dark;
 g.beginPath();g.ellipse(ox,oy-h*.03,w*.26,h*.06,0,0,TAU);g.fill();
 g.globalAlpha=1;g.lineCap='round';
 for(let i=0;i<blades;i++){
  const t=(i+.5)/blades,lean=(t-.5)*1.9+(rand()-.5)*.28;
  // Five to seven draws from this range always leave one blade well clear of the rest, so no variant
  // comes out a flat smear, and the top of the range still clears the top of the box, where the
  // stamp would clip it.
  const tip=h*(.42+rand()*.36)*(1-.3*Math.abs(lean)),tx=ox+lean*w*.34,ty=oy-tip;
  // Mostly light: grass is brighter than the ground it stands on, and only the blade leaning
  // furthest from the light takes the dark tone.
  g.strokeStyle=lean<0?GRASS.lit:lean>.7?GRASS.dark:GRASS.mid;
  g.lineWidth=h*(.13+rand()*.05);
  g.beginPath();g.moveTo(ox+(rand()-.5)*w*.12,oy);
  g.quadraticCurveTo(ox+lean*w*.16,oy-tip*.72,tx,ty);g.stroke();
 }
 g.restore();
}

// A waist-high mass: a few stems, then a cloud of leaf blobs in an upright ellipse, lit toward the
// upper left. Fourteen blobs is where the silhouette stops reading as a circle.
export function drawCover(g,ox,oy,w,h,variant,pale=false){
 // The blob cloud is sized so that a blob at the rim still lands inside the box: the widest blob is
 // .20w across, so the cloud's own radius stops at .30w and the pair reaches the edge exactly.
 const rand=shapeRandom(variant,53),tone=pale?LEAF_PALE:LEAF,cx=ox,cy=oy-h*.48,rx=w*.30,ry=h*.33;
 g.save();
 g.globalAlpha=.34;g.fillStyle=tone.deep;
 g.beginPath();g.ellipse(ox,oy-h*.03,w*.40,h*.055,0,0,TAU);g.fill();
 g.globalAlpha=1;g.strokeStyle=tone.deep;g.lineCap='round';
 for(let i=0;i<3;i++){
  const lean=(i-1)*.5+(rand()-.5)*.4;
  g.lineWidth=w*.055;
  g.beginPath();g.moveTo(ox+(rand()-.5)*w*.1,oy);g.quadraticCurveTo(ox+lean*w*.12,oy-h*.35,ox+lean*w*.3,oy-h*(.5+rand()*.3));g.stroke();
 }
 for(let i=0;i<14;i++){
  const a=rand()*TAU,r=Math.sqrt(rand()),bx=cx+Math.cos(a)*rx*r,by=cy+Math.sin(a)*ry*r;
  // Upper left lit, lower right in shade, with enough scatter that the gradient never reads as a ramp.
  const shade=(bx-cx)/rx+(by-cy)/ry+(rand()-.5)*1.1;
  g.fillStyle=shade<-.55?tone.lit:shade<.35?tone.mid:shade<1.2?tone.dark:tone.deep;
  const br=w*(.12+rand()*.08);
  g.beginPath();g.ellipse(bx,by,br,br*(.62+rand()*.3),rand()*TAU,0,TAU);g.fill();
 }
 g.restore();
}

// Nominal bitmap sizes in unzoomed px, chosen from the size ranges above: a tuft measures 5.6 to 9.0
// px across and 3.4 to 6.7 px tall, a clump 16.2 to 23.2 across and 18.9 to 39.4 tall.
export const TUFT_BOX={w:10,h:8,ox:5,oy:7},COVER_BOX={w:26,h:44,ox:13,oy:42};

// Same cache discipline as ground-fire.js: every shape is drawn once into a small canvas at the next
// 1.5x step at or above the screen scale, and stamped with drawImage. A screenful of open ground is
// a couple of thousand tiles, so the per-frame work has to be a stamp and nothing else.
export function groundCoverSprites(makeCanvas){
 const cache=new Map();let step=0;
 const stepFor=scale=>Math.min(3.375,1.5**Math.ceil(Math.log(Math.max(scale,.3))/Math.log(1.5)-1e-9));
 function sprite(kind,variant,pale,dim){
  const id=`${kind}:${variant}:${pale?1:0}:${dim?1:0}`;let canvas=cache.get(id);if(canvas)return canvas;
  const box=kind==='tuft'?TUFT_BOX:COVER_BOX;
  canvas=makeCanvas(Math.ceil(box.w*step),Math.ceil(box.h*step));
  const g=canvas.getContext('2d');g.setTransform(step,0,0,step,0,0);
  if(kind==='tuft')drawTuft(g,box.ox,box.oy,box.w,box.h,variant);else drawCover(g,box.ox,box.oy,box.w,box.h,variant,pale);
  if(dim){
   g.globalCompositeOperation='source-atop';g.fillStyle=FOG_DIM;
   g.beginPath();g.moveTo(0,0);g.lineTo(box.w,0);g.lineTo(box.w,box.h);g.lineTo(0,box.h);g.closePath();g.fill();
   g.globalCompositeOperation='source-over';
  }
  cache.set(id,canvas);return canvas;
 }
 return {
  get size(){return cache.size;},
  get step(){return step;},
  // Stamps one tuft or clump whose ground point is (x, y), scaled to `width` by `height` px. The
  // render step follows the zoom and nothing else: keying it off this piece's own size would flip
  // the step, and so clear the cache, between two neighbouring tufts.
  draw(ctx,kind,x,y,{zoom=1,width,height,pixelRatio=1,variant=0,pale=false,dim=false,alpha=1}){
   const next=stepFor(zoom*pixelRatio);if(next!==step){step=next;cache.clear();}
   if(!(width>0)||!(height>0)||!(alpha>0))return false;
   const box=kind==='tuft'?TUFT_BOX:COVER_BOX,sx=width/box.w,sy=height/box.h;
   if(alpha<1){ctx.save();ctx.globalAlpha=alpha;}
   ctx.drawImage(sprite(kind,variant,pale,dim),x-box.ox*sx,y-box.oy*sy,box.w*sx,box.h*sy);
   if(alpha<1)ctx.restore();
   return true;
  },
 };
}

// Below these zooms a tuft is a single dark pixel and a screenful of them just muddies the ground,
// so each kind fades out over a band rather than popping off at a threshold.
export const TUFT_FADE=[.30,.55],COVER_FADE=[.18,.38];
const fade=(zoom,[a,b])=>zoom<=a?0:zoom>=b?1:(zoom-a)/(b-a);

// grassTufts and coverClumps are pure, and a screenful asks for the same tiles every frame, so the
// answers are kept. The cap is a whole large map's worth of tiles; past it the map has changed
// enough that starting over is cheaper than growing.
const MEMO_CAP=40000,memo=new Map();
export function tileCover(x,y,z,terrain){
 const id=`${x},${y},${z},${terrain}`;let entry=memo.get(id);
 if(!entry){
  if(memo.size>=MEMO_CAP)memo.clear();
  entry={tufts:grassTufts(x,y,z,terrain),clumps:coverClumps(x,y,z,terrain).sort((a,b)=>(a.x+a.y)-(b.x+b.y))};
  memo.set(id,entry);
 }
 return entry;
}
export const clearCoverMemo=()=>memo.clear();

// Back to front along the depth axis, because a clump is up to 39 px tall and leans over the tile in
// front of it. drawTerrain can loop rows because a tile is flat; this cannot.
export function paintGroundCover(ctx,view,art){
 const {project,zoom,level,bounds,state}=view;
 const tuftAlpha=fade(zoom,TUFT_FADE),coverAlpha=fade(zoom,COVER_FADE);
 if(!bounds||!state||(!tuftAlpha&&!coverAlpha))return 0;
 const pixelRatio=view.pixelRatio??1;
 let drawn=0;
 for(let d=bounds.x0+bounds.y0;d<=bounds.x1+bounds.y1;d++)
  for(let x=Math.max(bounds.x0,d-bounds.y1),last=Math.min(bounds.x1,d-bounds.y0);x<=last;x++){
   const y=d-x,k=tileKey(x,y,level);
   if(state.seen&&!state.seen.has(k))continue;
   const terrain=terrainAt(state,x,y,level);
   if(!TUFT_TERRAINS.includes(terrain)||propAt(state,x,y,level))continue;
   const {tufts,clumps}=tileCover(x,y,level,terrain),dim=!!state.visible&&!state.visible.has(k);
   if(tuftAlpha)for(const t of tufts){
    const p=project(t.x,t.y);
    if(art.draw(ctx,'tuft',p.x,p.y,{zoom,width:t.width*TILE_PX*zoom,height:t.height*UNIT_PX*TUFT_LIFT*zoom,pixelRatio,variant:t.variant,dim,alpha:tuftAlpha}))drawn++;
   }
   if(coverAlpha)for(const c of clumps){
    const p=project(c.x,c.y);
    if(art.draw(ctx,'cover',p.x,p.y,{zoom,width:c.width*TILE_PX*zoom,height:c.height*UNIT_PX*zoom,pixelRatio,variant:c.variant,pale:c.pale,dim,alpha:coverAlpha}))drawn++;
   }
  }
 return drawn;
}

// Registers the dressing pass and hands back its remover, so app.js needs the import and the call
// and nothing else.
export function installGroundCover(makeCanvas,{pixelRatio=()=>1}={}){
 const art=groundCoverSprites(makeCanvas);
 return addScenePass('dressing',(ctx,view)=>paintGroundCover(ctx,{...view,pixelRatio:pixelRatio()},art));
}
