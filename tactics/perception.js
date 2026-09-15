export const headingTo=(a,b)=>a.x===b.x&&a.y===b.y?(a.heading??0):Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
export function inCone(a,b){if(!Number.isFinite(a.heading))return true;const dx=b.x-a.x,dy=b.y-a.y;if(!dx&&!dy)return true;const angle=headingTo(a,b),delta=Math.abs(((angle-a.heading+540)%360+360)%360-180);return delta<=(a.cone??120)/2+1e-8;}
