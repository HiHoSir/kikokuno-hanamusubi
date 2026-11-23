import {CAVE_TILE as TILE} from '../../../data/maps/cave/floors.mjs';

export const CAVE_DARK='#090d13';
const DARK=[9,13,19];

function canvas(width,height){
 const surface=document.createElement('canvas');
 surface.width=width;
 surface.height=height;
 return surface;
}

function pixels(art){
 const ctx=canvas(art.width,art.height).getContext('2d',{willReadFrequently:true});
 ctx.drawImage(art,0,0);
 return ctx.getImageData(0,0,art.width,art.height).data;
}

// The exploration preview's directed cliff faces use the same logical grid
// as collision. A separate translucent layer carries the foreground rim.
export function createCaveTerrain({grid,exit},floorArt,wallArt){
 const columns=grid[0].length,rows=grid.length;
 const width=columns*TILE,height=rows*TILE;
 const ground=canvas(width,height),rim=canvas(width,height);
 const groundCtx=ground.getContext('2d'),rimCtx=rim.getContext('2d');
 const surface=groundCtx.createImageData(width,height),contact=rimCtx.createImageData(width,height);
 const floor=pixels(floorArt),wall=pixels(wallArt);
 const tileOpen=(x,y)=>Number(grid[y]?.[x]==='.'||
   Boolean(exit&&y>=rows&&Math.abs(x-exit[0])<=1));
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
   const x=col+.5,y=row+.5;
   const u=x/TILE-.5,v=y/TILE-.5;
   const tx=Math.floor(u),ty=Math.floor(v),fx=u-tx,fy=v-ty;
   const a=tileOpen(tx,ty),b=tileOpen(tx+1,ty);
   const c=tileOpen(tx,ty+1),d=tileOpen(tx+1,ty+1);
   const occupancy=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
   const score=occupancy-.5-.044*Math.sin(x*.123+y*.036)
     -.027*Math.sin(y*.239-x*.054)-.014*Math.sin(x*.347+y*.201);
   const source=((row%floorArt.height)*floorArt.width+col%floorArt.width)*4;
   const pixel=(row*width+col)*4;
   surface.data[pixel+3]=255;
   if(score>=0){
     const shade=score<.055?.64:score<.115?.78:score<.17?.9:1;
     for(let channel=0;channel<3;channel++)
       surface.data[pixel+channel]=Math.round(floor[source+channel]*shade);
     continue;
   }
   const gx=((b-a)*(1-fy)+(d-c)*fy)/TILE;
   const gy=((c-a)*(1-fx)+(d-b)*fx)/TILE;
   const grade=Math.hypot(gx,gy);
   const distance=grade>0?-score/grade:Infinity;
   const side=grade>0?Math.max(0,Math.min(1,(Math.abs(gx)/grade-.23)/.18)):0;
   const south=gy<0?1-side:0;
   const depth=(gy<0?4:27)*(1-side)+23*side;
   if(distance>=depth){
     surface.data.set(DARK,pixel);
     continue;
   }
   const edgeX=x+distance*gx/grade,edgeY=y+distance*gy/grade;
   const ribs=Math.sin(edgeX*.45+Math.sin(edgeX*.17))*(1-side)
     +Math.sin(edgeY*.47+Math.sin(edgeY*.21))*side;
   const band=Math.floor(distance+1.8*Math.sin(x*.11+y*.15));
   const shade=1-(distance/depth)**2;
   const detail=ribs*(1-south)*13+(band%9===5?-9:0)+(distance<=3.5?20:0);
   const foreground=south>=.5||distance<7;
   for(let channel=0;channel<3;channel++){
     const color=DARK[channel]+shade*(wall[source+channel]*(.91-.16*gx/grade)+detail);
     surface.data[pixel+channel]=color;
     if(foreground)contact.data[pixel+channel]=color;
   }
   if(foreground)contact.data[pixel+3]=255;
 }
 groundCtx.putImageData(surface,0,0);
 rimCtx.putImageData(contact,0,0);
 return {ground,rim};
}

export function drawCaveRim(ctx,rim,x,y){
 // Draw only lip pixels beside the actor at or in front of their feet.
 const col=Math.max(0,Math.floor(x/TILE)-1)*TILE;
 const row=Math.max(0,Math.floor(y/TILE))*TILE;
 const width=Math.min(3*TILE,rim.width-col);
 const height=Math.min(2*TILE,rim.height-row);
 if(width>0&&height>0)ctx.drawImage(rim,col,row,width,height,col,row,width,height);
}
