export const CHARACTER_SPECIES=['horse','goat','donkey','sheep','cow','hen','pig-foreman','pig-director'];
export const ARMED_WEAPONS=['knife','pistol','rifle','assault'];
export const CHARACTER_STANCES=['standing','kneeling','prone'];
export function characterArt(species,weapon='hands',pose='idle',stance='standing'){
 if(stance==='kneeling'||stance==='prone')return {src:`../assets/characters/stances/${species}-${ARMED_WEAPONS.includes(weapon)?weapon:'hands'}-${stance}.png`,width:384,height:256,anchor:[192,244],contentHeight:stance==='kneeling'?176:96};
 const armed=ARMED_WEAPONS.includes(weapon);
 return {src:armed?`../assets/characters/armed/${species}-${weapon}.png`:`../assets/characters/${species}-${pose}.png`,width:armed?256:192,height:256,anchor:[armed?128:96,244],contentHeight:236};
}
