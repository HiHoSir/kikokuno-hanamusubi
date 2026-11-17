import {COVE_MAP,tileAt} from '../../../data/maps/sea-cove/scene.mjs';
import {drawCharacter} from '../village/residents.mjs';
import {createShellAtlas,SHELL_ART_SIZE} from '../items/shell-art.mjs';
import {TIDE_FRAMES,tideFrame,surfSample} from '../terrain/surf.mjs';

const TILE=32;
function canvas(width,height){
 const surface=document.createElement('canvas');
 surface.width=width;surface.height=height;
 const ctx=surface.getContext('2d');
 ctx.imageSmoothingEnabled=false;
 return {surface,ctx};
}
function drawTile(ctx,image,x,y,variation=0){
 const cols=Math.max(1,Math.floor(image.naturalWidth/TILE));
 const rows=Math.max(1,Math.floor(image.naturalHeight/TILE));
 const index=variation%(cols*rows);
 const sx=(index%cols)*TILE,sy=Math.floor(index/cols)*TILE;
 ctx.drawImage(image,sx,sy,TILE,TILE,x*TILE,y*TILE,TILE,TILE);
}
export const coastMask=(map,x,y)=>{
 const dry=(cx,cy)=>tileAt(cx,cy,map)!=='~';
 return (dry(x,y)?1:0)|(dry(x+1,y)?2:0)|
   (dry(x+1,y+1)?4:0)|(dry(x,y+1)?8:0);
};
// Use the same approved corner atlas for the distant sand/grass join.
export const grassCornerMask=(map,x,y)=>{
 const green=(cx,cy)=>['g','t'].includes(tileAt(cx,cy,map));
 return (green(x,y)?1:0)|(green(x+1,y)?2:0)|
   (green(x+1,y+1)?4:0)|(green(x,y+1)?8:0);
};
export const scrubCornerMask=(map,x,y)=>{
 const dense=(cx,cy)=>tileAt(cx,cy,map)==='t';
 return (dense(x,y)?1:0)|(dense(x+1,y)?2:0)|
   (dense(x+1,y+1)?4:0)|(dense(x,y+1)?8:0);
};
const chip=(ctx,atlas,mask,px,py)=>{
 ctx.drawImage(atlas,(mask%4)*TILE,Math.floor(mask/4)*TILE,
   TILE,TILE,px,py,TILE,TILE);
};
export function prepareCoveArt(map=COVE_MAP,art){
 const pixelWidth=map.width*TILE,pixelHeight=map.height*TILE;
 const ground=canvas(pixelWidth,pixelHeight);
 const green=canvas(pixelWidth,pixelHeight);
 const greenCoverage=canvas(pixelWidth,pixelHeight);
 const scrub=canvas(pixelWidth,pixelHeight);
 const scrubCoverage=canvas(pixelWidth,pixelHeight);
 const mask=canvas(pixelWidth,pixelHeight);
 const foam=[],rocks=[];
 // Every dry cell begins as a native sand tile, then an approved 16-corner
 // mask smoothly joins distant grass. We never resample a large landscape
 // image into independently stretched tile rectangles.
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
   const type=tileAt(x,y,map);
   if(type==='~')continue;
   const variation=((x*13+y*19)>>>0);
   drawTile(ground.ctx,art.sand,x,y,variation);
   drawTile(green.ctx,art.grass,x,y,variation);
   drawTile(scrub.ctx,art.forest,x,y,variation);
   if(type==='r')rocks.push({x,y,variation});
 }
 greenCoverage.ctx.fillStyle='#fff';
 greenCoverage.ctx.fillRect(0,0,pixelWidth,pixelHeight);
 let grassCornerChips=0;
 for(let y=-1;y<map.height;y++)for(let x=-1;x<map.width;x++){
   const cover=grassCornerMask(map,x,y);
   if(cover===15)continue;
   const px=x*TILE+TILE/2,py=y*TILE+TILE/2;
   greenCoverage.ctx.clearRect(px,py,TILE,TILE);
   if(cover>0){
     chip(greenCoverage.ctx,art.coastMask,cover,px,py);
     grassCornerChips++;
   }
 }
 green.ctx.globalCompositeOperation='destination-in';
 green.ctx.drawImage(greenCoverage.surface,0,0);
 green.ctx.globalCompositeOperation='source-over';
 ground.ctx.drawImage(green.surface,0,0);
 // Keep dense forest and its dark canopy in native mapchips. Its 16-corner
 // mask follows the irregular authored collision footprint instead of
 // drawing a rectangular slab of full tiles on top of the beach.
 scrubCoverage.ctx.fillStyle='#fff';
 scrubCoverage.ctx.fillRect(0,0,pixelWidth,pixelHeight);
 let scrubCornerChips=0;
 for(let y=-1;y<map.height;y++)for(let x=-1;x<map.width;x++){
   const cover=scrubCornerMask(map,x,y);
   if(cover===15)continue;
   const px=x*TILE+TILE/2,py=y*TILE+TILE/2;
   scrubCoverage.ctx.clearRect(px,py,TILE,TILE);
   if(cover>0){
     chip(scrubCoverage.ctx,art.coastMask,cover,px,py);
     scrubCornerChips++;
   }
 }
 scrub.ctx.globalCompositeOperation='destination-in';
 scrub.ctx.drawImage(scrubCoverage.surface,0,0);
 scrub.ctx.globalCompositeOperation='source-over';
 ground.ctx.drawImage(scrub.surface,0,0);
 // Boulder terrain tiles stay on their explicitly blocked map cells.
 for(const {x,y,variation} of rocks)
   drawTile(ground.ctx,art.rocks,x,y,variation);
 mask.ctx.fillStyle='#fff';
 mask.ctx.fillRect(0,0,pixelWidth,pixelHeight);
 // This offset-quarter shoreline matches the 16-bitmask atlas used by the
 // actual field, including diagonal corners and convex bays.
 for(let y=-1;y<map.height;y++)for(let x=-1;x<map.width;x++){
   const cover=coastMask(map,x,y);
   if(cover===15)continue;
   const px=x*TILE+TILE/2,py=y*TILE+TILE/2;
   mask.ctx.clearRect(px,py,TILE,TILE);
   if(cover>0){
     chip(mask.ctx,art.coastMask,cover,px,py);
     foam.push({cover,px,py});
   }
 }
 ground.ctx.globalCompositeOperation='destination-in';
 ground.ctx.drawImage(mask.surface,0,0);
 ground.ctx.globalCompositeOperation='source-over';
 return {ground:ground.surface,foam,shoreMask:mask.surface,
   grassCornerChips,scrubCornerChips};
}
// Compile the accepted 8-phase shoreline animation into 32x32 mapchip frames.
// This cove has sea to the EAST, so the sea/land boundary is measured from
// right to left in *world coordinates*. It is not a per-cell local-x wave,
// and no full-scene translucent water overlay is drawn during playback.
export function prepareCoveSurf(map,shoreMask){
 const pixelWidth=map.width*TILE,pixelHeight=map.height*TILE;
 const alpha=shoreMask.getContext('2d',{willReadFrequently:true})
   .getImageData(0,0,pixelWidth,pixelHeight).data;
 const edgeX=new Int32Array(pixelHeight).fill(-1);
 const cells=new Map();
 for(let y=0;y<pixelHeight;y++){
   let sawSea=false;
   for(let x=pixelWidth-1;x>=0;x--){
     if(alpha[(y*pixelWidth+x)*4+3]<128){sawSea=true;continue;}
     if(sawSea){edgeX[y]=x;break;}
   }
   if(edgeX[y]<0)continue;
   for(let x=Math.max(0,edgeX[y]-18);x<=edgeX[y];x++){
     const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
     if(tileAt(tx,ty,map)!=='s')continue;
     const id=tx+','+ty;
     if(!cells.has(id))cells.set(id,{x:tx,y:ty});
   }
 }
 const entries=[...cells.values()].sort((a,b)=>a.y-b.y||a.x-b.x)
   .map((cell,index)=>({...cell,index}));
 const columns=16,rows=Math.max(1,Math.ceil(entries.length/columns));
 const {surface:sheet,ctx}=canvas(columns*TILE,rows*TIDE_FRAMES.length*TILE);
 const coverage=[];
 for(let phase=0;phase<TIDE_FRAMES.length;phase++){
   let wetPixels=0,washedPixels=0,foamPixels=0;
   for(const {x:tx,y:ty,index} of entries){
     const tile=ctx.createImageData(TILE,TILE);
     for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){
       const wx=tx*TILE+px,wy=ty*TILE+py;
       if(alpha[(wy*pixelWidth+wx)*4+3]<128||edgeX[wy]<0)continue;
       const effect=surfSample(edgeX[wy]-wx,'sand',phase,wy);
       if(effect===0)continue;
       wetPixels++;
       const i=(py*TILE+px)*4;
       if(effect===1){
         tile.data[i]=55;tile.data[i+1]=100;
         tile.data[i+2]=105;tile.data[i+3]=68;
       }else if(effect===2){
         washedPixels++;
         tile.data[i]=69;tile.data[i+1]=158;
         tile.data[i+2]=177;tile.data[i+3]=118;
       }else{
         foamPixels++;
         const grain=(wy*7+wx*13+(wy>>2))%9;
         tile.data[i]=225+(grain%3)*7;
         tile.data[i+1]=235+(grain%3)*5;
         tile.data[i+2]=220+(grain%4)*7;
         tile.data[i+3]=grain===0?142:208;
       }
     }
     ctx.putImageData(tile,(index%columns)*TILE,
       (phase*rows+Math.floor(index/columns))*TILE);
   }
   coverage.push({wetPixels,washedPixels,foamPixels});
 }
 return {sheet,entries,columns,rows,frames:TIDE_FRAMES.length,coverage};
}
export function createCoveRenderer(ctx,art,map=COVE_MAP){
 const staticArt=prepareCoveArt(map,art);
 const surf=prepareCoveSurf(map,staticArt.shoreMask);
 const shellArt=createShellAtlas();
 const shellTypes=Object.fromEntries(shellArt.ids.map((kind,index)=>[kind,index]));
 const {width,height}=map;
 const sprites=map.objects.map(object=>({
   kind:object.kind,chip:object.chip??0,
   x:object.x*TILE+TILE/2,y:(object.y+1)*TILE,
   image:art[object.kind]
 })).filter(s=>s.image);
 let lastDims='';
 const render=function draw(player,fisher,time,viewport,shells=[]){
   const {step,bufferWidth,bufferHeight}=viewport;
   const visibleWidth=bufferWidth/step,visibleHeight=bufferHeight/step;
   const cameraX=Math.max(0,Math.min(width*TILE-visibleWidth,player.x-visibleWidth/2));
   const cameraY=Math.max(0,Math.min(height*TILE-visibleHeight,player.y-visibleHeight/2));
   ctx.setTransform(1,0,0,1,0,0);
   ctx.imageSmoothingEnabled=false;
   ctx.fillStyle='#1e6384';
   ctx.fillRect(0,0,bufferWidth,bufferHeight);
   ctx.setTransform(step,0,0,step,-Math.floor(cameraX)*step,-Math.floor(cameraY)*step);
   ctx.imageSmoothingEnabled=false;
   // The moving water atlas sits behind the transparent coast mask.
   const waterImage=art.water;
   const frame=Math.floor(time/200);
   const cols=Math.max(1,Math.floor(waterImage.naturalWidth/TILE));
   const rows=Math.max(1,Math.floor(waterImage.naturalHeight/TILE));
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     if(tileAt(x,y,map)!=='~')continue;
     drawTile(ctx,waterImage,x,y,(frame+x%3+Math.floor(y/3))%(cols*rows));
   }
   // Native authored foam chips are part of the sea layer, not an overlaid
   // opaque shoreline that could obscure the player's feet.
   ctx.globalAlpha=.74;
   for(const {cover,px,py} of staticArt.foam)
     chip(ctx,art.coastShallow,cover,px,py);
   ctx.globalAlpha=1;
   ctx.drawImage(staticArt.ground,0,0);
   // Draw only precompiled 32px animation atlas chips. Each wave phase
   // contains the same stable tile positions and is synchronized to the
   // accepted shoreline prototype. No 32px line reappears during motion.
   const tide=tideFrame(time);
   for(const cell of surf.entries){
     const sx=(cell.index%surf.columns)*TILE;
     const sy=(tide.phase*surf.rows+Math.floor(cell.index/surf.columns))*TILE;
     ctx.drawImage(surf.sheet,sx,sy,TILE,TILE,
       cell.x*TILE,cell.y*TILE,TILE,TILE);
   }
   const actors=[
     ...sprites.map(s=>({type:'sprite',...s})),
     ...shells.map(shell=>({type:'shell',...shell})),
     {type:'npc',y:fisher.y,x:fisher.x,bitmap:art.fisher,face:fisher.face,distance:0,moving:false},
     {type:'hero',y:player.y,x:player.x,bitmap:art.hero,face:player.face,distance:player.distance,moving:player.moving}
   ].sort((a,b)=>a.y-b.y);
   for(const actor of actors){
     if(actor.type==='sprite'){
       if(actor.kind==='flowers'){
         // wildflowers.png is a 4x4 *mapchip sheet*, not a single giant
         // object. One flower placement = one unscaled 32x32 source chip.
         const sx=(actor.chip%4)*TILE,sy=Math.floor(actor.chip/4)*TILE;
         ctx.drawImage(actor.image,sx,sy,TILE,TILE,
           Math.round(actor.x-TILE/2),Math.round(actor.y-TILE),TILE,TILE);
       }else{
         ctx.drawImage(actor.image,Math.round(actor.x-actor.image.naturalWidth/2),
           Math.round(actor.y-actor.image.naturalHeight));
       }
       continue;
     }
     if(actor.type==='shell'){
       const index=shellTypes[actor.kind];
       if(index===undefined)continue;
       // Native 20px atlas source. Only the camera may scale the final scene.
       ctx.drawImage(shellArt.canvas,index*SHELL_ART_SIZE,0,SHELL_ART_SIZE,SHELL_ART_SIZE,
         Math.round(actor.x-SHELL_ART_SIZE/2),Math.round(actor.y-SHELL_ART_SIZE+4),
         SHELL_ART_SIZE,SHELL_ART_SIZE);
       continue;
     }
     ctx.save();
     ctx.fillStyle='rgba(13,27,31,.25)';
     ctx.beginPath();ctx.ellipse(actor.x,actor.y-2,26,7,0,0,Math.PI*2);ctx.fill();
     ctx.restore();
     drawCharacter(ctx,actor);
   }
 };
 render.surfInfo={
   chipSize:TILE,frames:surf.frames,tileCount:surf.entries.length,
   atlas:[surf.sheet.width,surf.sheet.height],coverage:surf.coverage,
   mode:'animated-native-32px-mapchips',orientation:'sea-east',
   landJoin:'masked-16-corner-grass-sand',
   grassCornerChips:staticArt.grassCornerChips,
   scrubCornerChips:staticArt.scrubCornerChips
 };
 return render;
}
