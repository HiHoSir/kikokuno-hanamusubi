// Camera / render interpolation only. Does not move the game state or draw.
window.YK_CAMERA=(()=>{
 function position(state,motion,frameTime,duration=motion?.duration||144){
  if(!motion)return {x:state.x,y:state.y};
  const t=Math.max(0,Math.min(1,(frameTime-motion.at)/duration));
  return {x:motion.x+(state.x-motion.x)*t,y:motion.y+(state.y-motion.y)*t};
 }
 return {position};
})();

