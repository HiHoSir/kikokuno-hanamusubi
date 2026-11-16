// Pure area exit selection. Does not move the player or write saves.
window.YK_AREA_TRANSITIONS=(()=>{
 function inside(x,y,rect){return x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3];}
 function exit(area,x,y,villageLayout,world){
  if(['teahouse','osumiHome','villageRoom'].includes(area))return null;
  if(area==='village'){
   if(x>villageLayout.exit.rect[0]&&x<villageLayout.exit.rect[2]&&y>villageLayout.exit.rect[1]&&y<villageLayout.exit.rect[3])return villageLayout.exit.to;
   if(inside(x,y,villageLayout.northExit.rect))return villageLayout.northExit.to;
  }
  if(area==='shrine')return window.YK_TENYO?.exit(x,y)?'field':null;
  if(world?.places?.[area]&&area!=='village'&&x<42)return 'field';
  return null;
 }
 // Enter only on the destination object's authored contact cells, never on its artwork bounds.
 function contact(world,x,y){
  const tx=Math.floor(x/32),ty=Math.floor(y/32);
  for(const [id,place] of Object.entries(world?.places||{})){
   const objects=world.mapData?.decorations||[];
   const matches=objects.filter(o=>o.destination===id||o.placeId===id||o.id===id);
   if(matches.some(o=>o.contactTiles?.some(([cx,cy])=>cx===tx&&cy===ty)))return id;
   if(!matches.length&&Math.floor(place.point[0]/32)===tx&&Math.floor(place.point[1]/32)===ty)return id;
  }
  return null;
 }
 // Apply location-specific runtime state only. Caller handles input, messages and saves.
 function apply(state,destination,world,areas){
  const previous=state.area;
  state.area=destination;
  if(destination==='field'){
   const point=world.places[previous]?.point||state.worldPosition||world.hub;
   [state.x,state.y]=point;
   state.dir='d';
  }else{state.x=70;state.y=430;}
  state.visitedAreas[destination]=true;
  state.frame=1;state.encounterSteps=0;state.encounterGrace=areas[destination]?.grace||0;
  return state;
 }
 return {exit,apply,contact};
})();
