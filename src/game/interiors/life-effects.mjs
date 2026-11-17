// Small, deliberately pixel-stepped domestic animations. Their anchors belong
// to furniture artwork, so rearranging a room also moves every effect.
// No independent RAF, textures, collision, scale or random allocations.
export const FURNITURE_LIFE_EMITTERS = Object.freeze({
  hearth: Object.freeze([{kind:'fire',x:64,y:112},{kind:'smoke',x:66,y:70}]),
  // The stove's source PNG contains no baked-in plume. Steam is fully dynamic.
  kitchen: Object.freeze([{kind:'fire',x:58,y:115},{kind:'steam',x:56,y:48}]),
  teaCounter: Object.freeze([{kind:'steam',x:169,y:36}]),
  teaTable: Object.freeze([{kind:'steam',x:85,y:37}]),
});

const FIRE_COLORS=Object.freeze({
  r:'#ac3927',o:'#e77836',y:'#ffc460',w:'#ffe7a0'
});
const FIRE_FRAMES=Object.freeze([
  ['...y...', '..oyo..', '.ooyo..', '.roory.', '.rrorr.', '..r.r..'],
  ['..y....', '..oyo..', '.ooyyo.', '.roor..', '.rroor.', '..r.r..'],
  ['....y..', '...oyo.', '..ooy..', '.roory.', '.rroorr', '..r.r..'],
  ['...y...', '...yoo.', '..oyoo.', '.roorr.', '.rrorr.', '..r.r..'],
]);

function paintFire(context,x,y,time) {
  const rows=FIRE_FRAMES[Math.floor(time/150)%FIRE_FRAMES.length];
  // Two offset tongues in the ember bed, in source-world 2px cells.
  for (const [offsetX,offsetY] of [[-12,0],[2,-2]]) {
    for(let row=0;row<rows.length;row++)for(let col=0;col<rows[row].length;col++){
      const color=FIRE_COLORS[rows[row][col]];
      if(color){context.fillStyle=color;context.fillRect(x+offsetX+col*2,y+offsetY+row*2-12,2,2);}
    }
  }
}

function paintRising(context,x,y,time,kind) {
  const smoke=kind==='smoke';
  const frame=Math.floor(time/(smoke?180:210));
  const lifetime=smoke?12:9;
  const strands=smoke?3:2;
  for(let plume=0;plume<strands;plume++) {
    const age=(frame+plume*(smoke?4:5))%lifetime;
    const lift=age*2;
    const drift=Math.round(Math.sin((age+plume*3)*0.7)*(smoke?3:2))*2;
    const px=x+(plume-1)*6+drift;
    const py=y-8-lift;
    if(smoke) {
      // Compact, staggered grey puffs; dissipate near the end of each cycle.
      context.fillStyle=age>8?'#9d91877f':'#a59d92a8';
      context.fillRect(px-3,py,6,4);
      context.fillStyle='#c8bdb28a';
      context.fillRect(px-1,py-4,4,4);
      if(age<8)context.fillRect(px+3,py+2,4,2);
    } else {
      context.fillStyle=age>5?'#d2c8b37a':'#eee5cfb3';
      context.fillRect(px,py,2,6);
      context.fillStyle='#d0c6b5a3';
      context.fillRect(px+2,py-4,2,4);
      if(age<5)context.fillRect(px-2,py+4,2,4);
    }
  }
}

export function drawFurnitureLife(context,object,elapsedMs,reducedMotion=false) {
  const emitters=FURNITURE_LIFE_EMITTERS[object.asset];
  if(!emitters)return;
  const time=reducedMotion?0:Math.max(0,elapsedMs);
  context.save();
  for(const {kind,x,y} of emitters){
    const px=Math.round((object.x+x)/2)*2;
    const py=Math.round((object.y+y)/2)*2;
    if(kind==='fire')paintFire(context,px,py,time);
    else paintRising(context,px,py,time,kind);
  }
  context.restore();
}
