// Extra drawing passes the scenery parcels of docs/tactics/SCENERY-PORT-HANDOFF.md register, so
// none of them has to reopen app.js. Every stage is empty until a parcel fills it in, and an empty
// stage costs one array check per frame.
//
//   dressing  after the terrain, under the props: grass tufts and woodland undergrowth (parcel K)
//   light     after the dressing, still under the props: lamp and fire pools (parcel I)
//   overlay   after everything, over the daylight wash: spotlight beams (parcel J)
//
// A pass receives the layer's context and a view: {project, zoom, level, bounds, state, minutes}.
// It draws and returns nothing. It must not mutate the state it is handed.
export const SCENE_STAGES=Object.freeze(['dressing','light','overlay']);

const passes=new Map(SCENE_STAGES.map(stage=>[stage,[]]));

export function addScenePass(stage,draw){
 const list=passes.get(stage);
 if(!list)throw new Error(`Unknown scene stage: ${stage}`);
 if(typeof draw!=='function')throw new Error(`Scene pass for ${stage} is not a function`);
 list.push(draw);
 return ()=>{const at=list.indexOf(draw);if(at>=0)list.splice(at,1);};
}

export function runScenePass(stage,ctx,view){
 const list=passes.get(stage);
 if(!list||!list.length)return 0;
 for(const draw of list)draw(ctx,view);
 return list.length;
}

export const scenePassCount=stage=>passes.get(stage)?.length??0;

// Tests register passes; without this they would leak into each other.
export function clearScenePasses(){for(const list of passes.values())list.length=0;}
