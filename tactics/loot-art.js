import {tileKey,levelOf} from './maps.js';
// Ground dressing derived from fallen units; no pickup or inventory transfer yet.
export const LOOT_WEAPONS=['pistol','rifle','assault'];
export function deathDropArt(unit){
 if(unit.hp>0||!LOOT_WEAPONS.includes(unit.weapon))return [];
 const weapon=unit.weapon;
 const drops=[{src:`../assets/environment/loot/gun-${weapon}.png`,size:weapon==='pistol'?23:40,dx:-4,dy:-2}];
 if((unit.ammo?.[weapon]??0)>0)drops.push({src:`../assets/environment/loot/ammo-${weapon}.png`,size:17,dx:11,dy:5});
 return drops;
}
export function fallenVisible(state,unit,level){
 return unit.hp<=0&&levelOf(unit)===level&&state.seen.has(tileKey(unit.x,unit.y,levelOf(unit)));
}
export function drawDeathDrops(ctx,load,unit,point,zoom){
 for(const drop of deathDropArt(unit)){
  const img=load(drop.src),size=drop.size*zoom;
  if(img.complete&&img.naturalWidth)ctx.drawImage(img,point.x+drop.dx*zoom-size/2,point.y+drop.dy*zoom-size/2,size,size);
 }
}
