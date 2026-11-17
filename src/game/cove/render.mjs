import {COVE_MAP,tileAt} from '../../../data/maps/sea-cove/scene.mjs';
import {drawCharacter} from '../village/residents.mjs';
import {createShellAtlas,SHELL_ART_SIZE} from '../items/shell-art.mjs';

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
const chip=(ctx,atlas,mask,px,py)=>{
 ctx.drawImage(atlas,(mask%4)*TILE,Math.floor(mask/4)*TILE,
   TILE,TILE,px,py,TILE,TILE);
};
export function prepareCoveArt(map=COVE_MAP,art){
 const pixelWidth=map.width*TILE,pixelHeight=map.height*TILE;
 const ground=canvas(pixelWidth,pixelHeight);
 const mask=canvas(pixelWidth,pixelHeight);
 const foam=[];
 // Compose *native 32px tiles* once; no runtime terrain shapes or stretched
 // painted backdrop. Water remains a separate moving underlay.
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
   const type=tileAt(x,y,map);
   const variation=((x*13+y*19)>>>0);
   if(type==='~')continue;
   const image=type==='s'?art.sand:type==='t'?art.forest:
     type==='r'?art.rocks:art.grass;
   drawTile(ground.ctx,image,x,y,variation);
 }
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
 return {ground:ground.surface,foam};
}
export function createCoveRenderer(ctx,art,map=COVE_MAP){
 const staticArt=prepareCoveArt(map,art);
 const shellArt=createShellAtlas();
 const shellTypes=Object.fromEntries(shellArt.ids.map((kind,index)=>[kind,index]));
 const {width,height}=map;
 const sprites=map.objects.map(object=>({
   x:object.x*TILE+TILE/2,y:(object.y+1)*TILE,
   image:art[object.kind]
 })).filter(s=>s.image);
 let lastDims='';
 return function draw(player,fisher,time,viewport,shells=[]){
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
   const actors=[
     ...sprites.map(s=>({type:'sprite',y:s.y,x:s.x,image:s.image})),
     ...shells.map(shell=>({type:'shell',...shell})),
     {type:'npc',y:fisher.y,x:fisher.x,bitmap:art.fisher,face:fisher.face,distance:0,moving:false},
     {type:'hero',y:player.y,x:player.x,bitmap:art.hero,face:player.face,distance:player.distance,moving:player.moving}
   ].sort((a,b)=>a.y-b.y);
   for(const actor of actors){
     if(actor.type==='sprite'){
       ctx.drawImage(actor.image,Math.round(actor.x-actor.image.naturalWidth/2),
         Math.round(actor.y-actor.image.naturalHeight));
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
}
