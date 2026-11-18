import {COVE_MAP,COVE_SHORE,tileAt} from '../../../data/maps/sea-cove/scene.mjs';
import {drawCharacter} from '../village/residents.mjs';
import {createShellAtlas,SHELL_ART_SIZE} from '../items/shell-art.mjs';
import {TIDE_FRAMES,tideFrame,surfSample} from '../terrain/surf.mjs';

// Keep the actual approved shoreline-study composition (field landscape
// ground, 16-corner mask, 4 sand atlases, native sea and 8-frame surf).
// This renderer NEVER edits the field terrain, projection or camera code.
const TILE=32;
function canvas(width,height){
 const surface=document.createElement('canvas');
 surface.width=width;surface.height=height;
 const ctx=surface.getContext('2d');
 ctx.imageSmoothingEnabled=false;
 return {surface,ctx};
}
const chip=(ctx,atlas,mask,px,py)=>{
 ctx.drawImage(atlas,(mask%4)*TILE,Math.floor(mask/4)*TILE,
   TILE,TILE,px,py,TILE,TILE);
};
export const coastMask=(map,x,y)=>{
 // The *south* edge is continuous dry land, not a new coastline.
 // The north remains the approved sea; this does not touch its 16-mask.
 const dry=(cx,cy)=>{
   // A map boundary is NOT a coastline. Continue the coastal height field
   // at east/west boundaries; let the sand continue beyond the south edge.
   // Real sea/sand transitions are taken from the existing mapchip grid.
   if(Number.isInteger(map.width)&&Number.isInteger(map.height)){
     if(cy>=map.height)return true;
     if(cx<0)return cy>=COVE_SHORE[0];
     if(cx>=map.width)return cy>=COVE_SHORE[map.width-1];
   }
   return tileAt(cx,cy,map)!=='~';
 };
 return (dry(x,y)?1:0)|(dry(x+1,y)?2:0)|
   (dry(x+1,y+1)?4:0)|(dry(x,y+1)?8:0);
};
// These helpers remain available for existing maps/tests, but this approved
// wide-sand cove deliberately contains no mandatory green/forest border.
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
export function prepareCoveArt(map=COVE_MAP,art){
 const pixelWidth=map.width*TILE,pixelHeight=map.height*TILE;
 const ground=canvas(pixelWidth,pixelHeight),mask=canvas(pixelWidth,pixelHeight);
 const landscape=globalThis.YK_LANDSCAPE;
 if(!landscape?.groundLayer||!landscape.ready())
  throw Error('承認済み砂浜の地形チップが準備できていません');
 // Exactly the study's contiguous native landscape sand texture.
 // Its draw source is shared, not a new hand-drawn tile variation.
 const dryMap=map.tiles.map(row=>Array.from(row,()=> 'sand'));
 dryMap.paths=[];dryMap.decorations=[];dryMap.projectedHeights=false;
 dryMap.referencePlacedObjects=true;dryMap.bridgeWaterCells=new Set();
 dryMap.textureOrigin={x:0,y:0};
 ground.ctx.drawImage(landscape.groundLayer(dryMap),0,0);
 const coast=[];
 mask.ctx.fillStyle='#fff';
 mask.ctx.fillRect(0,0,pixelWidth,pixelHeight);
 for(let y=-1;y<map.height;y++)for(let x=-1;x<map.width;x++){
   const cover=coastMask(map,x,y);if(cover===15)continue;
   const px=x*TILE+TILE/2,py=y*TILE+TILE/2;
   mask.ctx.clearRect(px,py,TILE,TILE);
   if(cover>0){
     chip(mask.ctx,art.coastMask,cover,px,py);
     coast.push({cover,px,py,x,y});
   }
 }
 ground.ctx.globalCompositeOperation='destination-in';
 ground.ctx.drawImage(mask.surface,0,0);
 ground.ctx.globalCompositeOperation='source-over';
 const sandEdges=[art.coastSand0,art.coastSand1,art.coastSand2,art.coastSand3];
 for(const {cover,px,py,x,y} of coast)
   chip(ground.ctx,sandEdges[(x&1)+2*(y&1)],cover,px,py);
 return {ground:ground.surface,shoreMask:mask.surface,coast};
}
export function prepareCoveSurf(map,shoreMask){
 const pixelWidth=map.width*TILE,pixelHeight=map.height*TILE;
 const alpha=shoreMask.getContext('2d',{willReadFrequently:true})
   .getImageData(0,0,pixelWidth,pixelHeight).data;
 // Signed distance down from the sea is derived from the exact 16-corner
 // shoreline alpha, column by column, as in the accepted review page.
 const shoreY=new Int32Array(pixelWidth).fill(-1);
 const slots=new Map();
 for(let x=0;x<pixelWidth;x++){
   let seaSeen=false;
   for(let y=0;y<pixelHeight;y++){
     const a=alpha[(y*pixelWidth+x)*4+3];
     if(a<128){seaSeen=true;continue;}
     if(seaSeen){shoreY[x]=y;break;}
   }
   const edge=shoreY[x];if(edge<0)continue;
   for(let y=edge;y<Math.min(pixelHeight,edge+18);y++){
     const tx=Math.floor(x/TILE),ty=Math.floor(y/TILE);
     // Do not reject shoreline-edge cells by their coarse terrain label.
     // The 16-corner alpha mask already clips surf to real dry pixels.
     // The accepted shoreline study includes these partial sea-labelled
     // cells; dropping them removed 13 animated chips at the waterline.
     const key=tx+','+ty;
     if(!slots.has(key))slots.set(key,{x:tx,y:ty});
   }
 }
 const entries=[...slots.values()].sort((a,b)=>a.y-b.y||a.x-b.x)
   .map((item,index)=>({...item,index}));
 const columns=16,rows=Math.max(1,Math.ceil(entries.length/columns));
 const {surface:sheet,ctx}=canvas(columns*TILE,rows*TILE*TIDE_FRAMES.length);
 const coverage=[];
 for(let phase=0;phase<TIDE_FRAMES.length;phase++){
   let wetPixels=0,washedPixels=0,foamPixels=0;
   for(const {x:tx,y:ty,index} of entries){
     const tile=ctx.createImageData(TILE,TILE);
     for(let py=0;py<TILE;py++)for(let px=0;px<TILE;px++){
       const wx=tx*TILE+px,wy=ty*TILE+py;
       if(alpha[(wy*pixelWidth+wx)*4+3]<128||shoreY[wx]<0)continue;
       const effect=surfSample(wy-shoreY[wx],'sand',phase,wx);
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
         const grain=(wx*7+wy*13+(wx>>2))%9;
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
   ...object,
   x:object.footPosition?object.x:object.x*TILE+TILE/2,
   y:object.footPosition?object.y:(object.y+1)*TILE,
   image:art[object.kind]
 })).filter(o=>o.image);
 const render=function draw(player,fisher,time,viewport,shells=[]){
   const {step,bufferWidth,bufferHeight}=viewport;
   const viewW=bufferWidth/step,viewH=bufferHeight/step;
   const cameraX=Math.max(0,Math.min(width*TILE-viewW,player.x-viewW/2));
   const cameraY=Math.max(0,Math.min(height*TILE-viewH,player.y-viewH/2-106));
   ctx.setTransform(1,0,0,1,0,0);
   ctx.imageSmoothingEnabled=false;
   ctx.fillStyle='#28678e';ctx.fillRect(0,0,bufferWidth,bufferHeight);
   ctx.setTransform(step,0,0,step,-Math.floor(cameraX)*step,-Math.floor(cameraY)*step);
   // Same two-frame sea atlas and 2x2 world-coordinate chip alignment.
   const frame=Math.floor(time/360)%2;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     if(tileAt(x,y,map)!=='~'&&Math.abs(y-COVE_SHORE[x])>1)continue;
     ctx.drawImage(art.water,frame*64+(x&1)*TILE,(y&1)*TILE,
       TILE,TILE,x*TILE,y*TILE,TILE,TILE);
   }
   ctx.drawImage(staticArt.ground,0,0);
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
   ].sort((a,b)=>a.y-b.y||(a.type==='hero'?1:-1));
   for(const actor of actors){
     if(actor.type==='sprite'){
       ctx.drawImage(actor.image,
         Math.round(actor.x-actor.image.naturalWidth/2),
         Math.round(actor.y-actor.image.naturalHeight));
       continue;
     }
     if(actor.type==='shell'){
       const index=shellTypes[actor.kind];if(index===undefined)continue;
       ctx.drawImage(shellArt.canvas,index*SHELL_ART_SIZE,0,SHELL_ART_SIZE,SHELL_ART_SIZE,
         Math.round(actor.x-SHELL_ART_SIZE/2),
         Math.round(actor.y-SHELL_ART_SIZE+4),SHELL_ART_SIZE,SHELL_ART_SIZE);
       continue;
     }
     ctx.save();ctx.fillStyle='rgba(14,28,39,.34)';
     ctx.beginPath();ctx.ellipse(actor.x,actor.y-2,23,6,0,0,Math.PI*2);ctx.fill();
     ctx.restore();
     drawCharacter(ctx,actor);
   }
 };
 render.surfInfo={
   chipSize:TILE,frames:surf.frames,tileCount:surf.entries.length,
   atlas:[surf.sheet.width,surf.sheet.height],coverage:surf.coverage,
   mode:'animated-native-32px-mapchips',orientation:'sea-north',
   landJoin:'sea-to-sand-16-corner-alpha-autotiles',
   approvedCoastline:30,expandedCoastline:map.width,sceneryNativeCount:sprites.filter(s=>s.kind==='rocks').length
 };
 return render;
}
