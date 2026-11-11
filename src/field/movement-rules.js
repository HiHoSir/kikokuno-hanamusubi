// Deterministic movement math. Rendering, timing, encounters and save writes stay in game.js.
window.YK_MOVEMENT=(()=>{
 function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
 function step(area,x,y,dx,dy,speed,worldSize,blocked){
  const fieldStyle=['field','village','teahouse','osumiHome','villageRoom'].includes(area);
  const norm=Math.hypot(dx,dy)||1,sp=area==='field'?32:speed*(fieldStyle?32:22);
  const vx=dx/norm*sp,vy=dy/norm*sp,steps=Math.ceil(sp/2);
  const maxX=area==='field'?worldSize-16:area==='village'?1504:741;
  const maxY=area==='field'?worldSize-16:area==='village'?1248:736;
  // The field is a discrete 32px grid. Validate the entire stride before
  // updating position, so a blocked coastline/river/mountain never leaves the
  // player on a fractional tile. Preserve existing interior/village behavior.
  if(area==='field'){
   for(let i=1;i<=steps;i++){
    const nx=clamp(x+vx*i/steps,16,maxX),ny=clamp(y+vy*i/steps,16,maxY);
    if(blocked(nx,ny))return {x,y};
   }
   return {x:clamp(x+vx,16,maxX),y:clamp(y+vy,16,maxY)};
  }
  for(let i=0;i<steps;i++){
   const nx=clamp(x+vx/steps,27,maxX),ny=clamp(y+vy/steps,34,maxY);
   if(!blocked(nx,ny)){x=nx;y=ny;}
   else if(vx&&vy&&!fieldStyle){
    if(!blocked(nx,y))x=nx;
    else if(!blocked(x,ny))y=ny;
   }
  }
  return {x,y};
 }
 // Preserve 32px strides; only field travel cadence is slower.
 const duration=(area,speed=1)=>area==='field'?192/(Number(speed)>0?Number(speed):1):144;
 return {step,duration};
})();

