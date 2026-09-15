export const WEIGHT={knife:1,pistol:1,rifle:4,assault:4};
export const itemWeight=i=>i.type==='weapon'?(WEIGHT[i.kind]||0):i.count*.03;
export const loadWeight=u=>(u.pack||[]).reduce((n,i)=>n+itemWeight(i),0)+(u.medkits||0)*.5+(u.wireCutters?1:0);
export function initInventory(u,weapons){u.capacity=16;u.slots=[u.weapon,u.weapon==='pistol'?'knife':'pistol'];u.pack=[...new Set(u.slots)].map(kind=>({type:'weapon',kind,rounds:weapons[kind].mag}));for(const kind of ['pistol','rifle'])u.pack.push({type:'ammo',kind,count:kind==='pistol'?16:5});if(u.team==='guard'){u.slots=[u.weapon];u.pack=u.pack.filter(i=>i.type==='weapon'&&i.kind===u.weapon||i.type==='ammo'&&i.kind===u.weapon);}}
export const reserve=(u,kind)=>u.pack.filter(i=>i.type==='ammo'&&i.kind===kind).reduce((n,i)=>n+i.count,0);
export function consumeAmmo(u,kind,count){for(const i of u.pack)if(i.type==='ammo'&&i.kind===kind){const n=Math.min(count,i.count);i.count-=n;count-=n;}u.pack=u.pack.filter(i=>i.type!=='ammo'||i.count>0);}
export function syncWeapons(u){for(const i of u.pack)if(i.type==='weapon')i.rounds=u.ammo[i.kind];}
export function accepts(u,item){return loadWeight(u)+itemWeight(item)<=u.capacity+1e-8&&!(item.type==='weapon'&&u.pack.some(i=>i.type==='weapon'&&i.kind===item.kind));}
export function receive(u,item){if(item.type==='weapon'){u.ammo[item.kind]=item.rounds;u.pack.push(item);}else{const existing=u.pack.find(i=>i.type==='ammo'&&i.kind===item.kind);if(existing)existing.count+=item.count;else u.pack.push(item);}}
