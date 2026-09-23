// The day schedule, shared with the 3D branch. Boundaries and the strength curve are ported from
// its game-clock.js and daylight.js so both games agree on what time of day it is and how bright.
// This game has no sun direction: every sprite carries its own upper-left light, so daylight here
// is a wash over the finished scene, never a relight.
export const MINUTES_PER_DAY=1440;
export const DAWN_START=300,DAY_START=360,DUSK_START=1080,NIGHT_START=1200;
// A map with no `time` opens here, which is the middle of the day and therefore untinted.
export const DEFAULT_START_MINUTES=480;

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

export const minuteOfDay=minutes=>((Math.floor(minutes)%MINUTES_PER_DAY)+MINUTES_PER_DAY)%MINUTES_PER_DAY;

export function daylightPhase(minutes){
 const m=minuteOfDay(minutes);
 return m<DAWN_START?'night':m<DAY_START?'dawn':m<DUSK_START?'day':m<NIGHT_START?'dusk':'night';
}

export const PHASE_LABELS={dawn:'Dawn',day:'Day',dusk:'Dusk',night:'Night'};

// 0 in the dark, 1 in full day, easing across dawn and dusk. Same expression as the 3D branch.
export function daylightStrength(minutes){
 const m=minuteOfDay(minutes);
 return m<DAY_START
  ?smooth((m-DAWN_START)/(DAY_START-DAWN_START))
  :1-smooth((m-DUSK_START)/(NIGHT_START-DUSK_START));
}

// Two washes over the drawn map. The cool one carries the dark; the warm one only exists while the
// light is changing, which is what makes dawn and dusk read as different from a dimmed noon.
export const NIGHT_WASH='#0e1a2b',NIGHT_ALPHA=.44;
export const WARM_WASH='#c2661d',WARM_ALPHA=.2;

export function daylightWashes(minutes){
 const strength=daylightStrength(minutes),washes=[];
 const night=NIGHT_ALPHA*(1-strength);
 if(night>.001)washes.push({color:NIGHT_WASH,alpha:night,blend:'source-over'});
 // 4s(1-s) peaks at the midpoint of a transition and is zero at both full day and full night.
 const warm=WARM_ALPHA*4*strength*(1-strength);
 if(warm>.001)washes.push({color:WARM_WASH,alpha:warm,blend:'overlay'});
 return washes;
}

// One call for a caller that wants the whole picture: the phase, its label, the strength and the
// washes to paint. Callers that only need one of those should use the narrower function.
export function daylightAt(minutes){
 const phase=daylightPhase(minutes);
 return {minute:minuteOfDay(minutes),phase,label:PHASE_LABELS[phase],strength:daylightStrength(minutes),washes:daylightWashes(minutes)};
}

// Paint the washes over a finished map. Interface drawn after this call stays untinted.
export function paintDaylight(ctx,minutes,width,height){
 const washes=daylightWashes(minutes);
 if(!washes.length)return false;
 ctx.save();
 for(const wash of washes){
  ctx.globalCompositeOperation=wash.blend;
  ctx.globalAlpha=wash.alpha;
  ctx.fillStyle=wash.color;
  ctx.fillRect(0,0,width,height);
 }
 ctx.restore();
 return true;
}
