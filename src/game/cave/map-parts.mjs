import {CAVE_TILE as TILE} from '../../../data/maps/cave/floors.mjs?v=cave-maps-1-stair-links-1-exploration-1-maze-2-stairs-2';
import {drawStairwell,drawAscent} from './stair-art.mjs?v=cave-visual-1-stair-links-1-guardian-1-pair-1-stairs-2-rise-1-topdown-1-stone-1';
import {createCaveTerrain,drawCaveRim} from './terrain-art.mjs?v=cave-visual-1-guardian-1';

export function createCaveMap(layout,{floorArt,wallArt,ledgeArt,crateArt}){
 const {ground,rim}=createCaveTerrain(layout,floorArt,wallArt);
 const paint=ground.getContext('2d');
 const foreground=[];
 const objects=[];
 for(const {kind,origin:[col,row],id} of layout.features){
  const x=col*TILE,y=row*TILE;
  switch(kind){
   case 'down':
    drawStairwell(paint,col,row,'back');
    drawStairwell(paint,col,row,'front');
    foreground.push({depth:y+100,draw:ctx=>drawStairwell(ctx,col,row,'front')});
    break;
   case 'up':
    drawAscent(paint,col,row);
    break;
   case 'seal':
   case 'inscription':
    objects.push({depth:y+TILE/2,draw:(ctx,foundItems)=>{
     const lit=kind==='seal'&&foundItems.includes(id);
     ctx.drawImage(ledgeArt,x,y+TILE/2-ledgeArt.height);
     ctx.fillStyle=kind==='inscription'?'#72878a':id==='cave-white-seal'?'#dddfcc':'#6d80a0';
     ctx.fillRect(x+19,y-14,10,9);
     ctx.fillStyle=lit?'#ffffa9':'#2b3944';
     ctx.fillRect(x+22,y-12,4,5);
    }});
    break;
   case 'cache':
    objects.push({id,depth:y+TILE/2,draw:ctx=>ctx.drawImage(crateArt,x+TILE/2-crateArt.width/2,y+TILE/2-crateArt.height)});
    break;
   case 'drop':
    paint.drawImage(ledgeArt,x,y+TILE+12-ledgeArt.height);
    paint.fillStyle='#a09673';
    paint.fillRect(x+16,y+26,16,2);
    paint.fillRect(x+20,y+30,8,2);
    break;
   case 'ledge':
    objects.push({depth:y+TILE,draw:ctx=>ctx.drawImage(ledgeArt,x,y+TILE-ledgeArt.height)});
    break;
  }
 }
 return {
  width:ground.width,height:ground.height,
  draw(ctx,x,y,actors,foundItems){
   ctx.drawImage(ground,0,0);
   for(const item of [...objects,...actors].sort((a,b)=>a.depth-b.depth))if(!foundItems.includes(item.id))item.draw(ctx,foundItems);
   drawCaveRim(ctx,rim,x,y);
   for(const item of foreground)if(y<item.depth)item.draw(ctx);
  }
 };
}
