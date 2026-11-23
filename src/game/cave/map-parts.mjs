import {CAVE_TILE as TILE} from '../../../data/maps/cave/floors.mjs?v=cave-maps-1';
import {drawRaisedSteps,drawStairwell} from './stair-art.mjs?v=cave-visual-1';
import {createCaveTerrain,drawCaveRim} from './terrain-art.mjs?v=cave-visual-1';

export function createCaveMap(layout,{floorArt,wallArt,stairsUp,ledgeArt}){
 const {ground,rim}=createCaveTerrain(layout,floorArt,wallArt);
 const paint=ground.getContext('2d');
 const foreground=[];
 const objects=[];
 for(const {kind,origin:[col,row]} of layout.features){
  const x=col*TILE,y=row*TILE;
  switch(kind){
   case 'down':
    drawStairwell(paint,col,row,'back');
    drawStairwell(paint,col,row,'front');
    foreground.push({depth:y+100,draw:ctx=>drawStairwell(ctx,col,row,'front')});
    break;
   case 'rise':
    drawRaisedSteps(paint,col,row,'back');
    drawRaisedSteps(paint,col,row,'front');
    foreground.push({depth:y+70,draw:ctx=>drawRaisedSteps(ctx,col,row,'front')});
    break;
   case 'up':
    objects.push({depth:y+70,draw:ctx=>ctx.drawImage(stairsUp,x,y)});
    break;
   case 'ledge':
    objects.push({depth:y+TILE,draw:ctx=>ctx.drawImage(ledgeArt,x,y+TILE-ledgeArt.height)});
    break;
  }
 }
 return {
  width:ground.width,height:ground.height,
  draw(ctx,x,y,actors){
   ctx.drawImage(ground,0,0);
   for(const item of [...objects,...actors].sort((a,b)=>a.depth-b.depth))item.draw(ctx);
   drawCaveRim(ctx,rim,x,y);
   for(const item of foreground)if(y<item.depth)item.draw(ctx);
  }
 };
}
