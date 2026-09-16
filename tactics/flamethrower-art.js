// Equipment overlay shared by all existing character poses and outfits.
export function drawFlamethrower(ctx,unit,zoom){
 if(unit.weapon!=='flamethrower')return;
 const stance=unit.stance||'standing',y=stance==='prone'?-16:stance==='kneeling'?-29:-42;
 ctx.save();ctx.scale(zoom,zoom);ctx.lineJoin='round';ctx.lineCap='round';
 ctx.strokeStyle='#272c20';ctx.lineWidth=2;
 for(const x of [-19,-11]){ctx.fillStyle='#75744a';ctx.beginPath();ctx.roundRect(x,y-4,8,22,3);ctx.fill();ctx.stroke();ctx.fillStyle='#b1924d';ctx.fillRect(x+1,y+5,6,3);}
 ctx.strokeStyle='#272720';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-10,y+16);ctx.quadraticCurveTo(1,y+27,10,y+10);ctx.stroke();
 ctx.strokeStyle='#9c9b76';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,y+8);ctx.lineTo(25,y+2);ctx.stroke();
 ctx.strokeStyle='#33372c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(4,y+8);ctx.lineTo(3,y+15);ctx.moveTo(20,y);ctx.lineTo(23,y+6);ctx.stroke();
 ctx.fillStyle='#efaa41';ctx.beginPath();ctx.arc(27,y+3,2,0,Math.PI*2);ctx.fill();ctx.restore();
}
