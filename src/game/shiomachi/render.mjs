import {prepareCoveArt,prepareCoveSurf,coveCameraStart} from '../cove/render.mjs';
import {drawCharacter} from '../village/residents.mjs';
import {tideFrame} from '../terrain/surf.mjs';
import {SHIOMACHI_MAP,SHIOMACHI_TILE,shiomachiTileAt} from '../../../data/maps/shiomachi-village/scene.mjs';

const TILE=SHIOMACHI_TILE;
function surface(width,height){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:true});
 ctx.imageSmoothingEnabled=false;
 return {canvas,ctx};
}
// The street is a mosaic of approved texture chips sampled in world-space.
// It is not a flat canvas-drawn rectangle; existing dirt pixel art is retained.
export function roadCell(x,y){
 if(y>=14&&y<SHIOMACHI_MAP.height&&x>=18&&x<=23)return true;
 if(y>=31&&y<=33&&x>=8&&x<=34)return true;
 if(y>=47&&y<=49&&x>=8&&x<=34)return true;
 return false;
}
function staticRoads(map,art){
 const {canvas,ctx}=surface(map.width*TILE,map.height*TILE);
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
   if(!roadCell(x,y)||shiomachiTileAt(x,y,map)!=='s')continue;
   const sx=x*TILE%art.pathSoil.naturalWidth;
   const sy=y*TILE%art.pathSoil.naturalHeight;
   ctx.drawImage(art.pathSoil,sx,sy,TILE,TILE,x*TILE,y*TILE,TILE,TILE);
 }
 return canvas;
}
export function createShiomachiRenderer(ctx,art,map=SHIOMACHI_MAP){
 const landscape=prepareCoveArt(map,art);
 const surf=prepareCoveSurf(map,landscape.shoreMask);
 const roads=staticRoads(map,art);
 const sprites=map.objects.map(o=>({...o,image:art[o.sprite]}));
 // Canonical village sign PNGs, retained at their original 96x120 size.
 // Place them over their corresponding façades and depth-sort with buildings.
 const signs=map.interiors.map(site=>({
   type:'object',id:site.building+'-sign',x:site.x-80,
   y:site.thresholdY-34,image:art[site.sign]
 })).filter(o=>o.image);
 const {width,height}=map;
 const render=(player,residents,time,viewport,debug=false)=>{
   const {step,bufferWidth,bufferHeight}=viewport;
   const viewW=bufferWidth/step,viewH=bufferHeight/step;
   const cx=coveCameraStart(width*TILE,viewW,player.x-viewW/2);
   const cy=coveCameraStart(height*TILE,viewH,player.y-viewH/2-106);
   const shiftX=cx<0?-cx*step:-Math.floor(cx)*step;
   const shiftY=cy<0?-cy*step:-Math.floor(cy)*step;
   ctx.setTransform(1,0,0,1,0,0);
   ctx.imageSmoothingEnabled=false;
   ctx.fillStyle='#28678e';
   ctx.fillRect(0,0,bufferWidth,bufferHeight);
   ctx.setTransform(step,0,0,step,shiftX,shiftY);
   const waveFrame=Math.floor(time/360)%2;
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     if(shiomachiTileAt(x,y,map)!=='~'&&Math.abs(y-map.shore[x])>1)continue;
     ctx.drawImage(art.water,waveFrame*64+(x&1)*TILE,(y&1)*TILE,TILE,TILE,
       x*TILE,y*TILE,TILE,TILE);
   }
   ctx.drawImage(landscape.ground,0,0);
   const tide=tideFrame(time);
   for(const cell of surf.entries){
     const sx=(cell.index%surf.columns)*TILE;
     const sy=(tide.phase*surf.rows+Math.floor(cell.index/surf.columns))*TILE;
     ctx.drawImage(surf.sheet,sx,sy,TILE,TILE,
       cell.x*TILE,cell.y*TILE,TILE,TILE);
   }
   ctx.drawImage(roads,0,0);
   // This is the actual approved-generation-derived transparent dock sprite,
   // not a bridge texture repeated into an implausible pier. Native world size;
   // never apply independent scaling to the dock or the nearby characters.
   const dock=map.pier.image;
   ctx.drawImage(art.pierNative,
     Math.round(dock.x-dock.width/2),
     Math.round(dock.footY-dock.height));
   // Correct painter order: player/NPC feet on the deck stay in front of it.
   const actors=[
     ...sprites.map(o=>({...o,type:'object'})),
     ...signs,
     ...residents.map(o=>({...o,type:'npc',bitmap:art[o.sprite]})),
     {...player,type:'hero',bitmap:art.hero}
   ].sort((a,b)=>a.y-b.y||((a.type==='hero'?1:0)-(b.type==='hero'?1:0)));
   for(const obj of actors){
     if(obj.type==='object'){
       if(!obj.image)continue;
       ctx.drawImage(obj.image,Math.round(obj.x-obj.image.naturalWidth/2),
         Math.round(obj.y-obj.image.naturalHeight));
       continue;
     }
     ctx.save();
     ctx.fillStyle='rgba(9,22,31,.36)';
     ctx.beginPath();
     ctx.ellipse(Math.round(obj.x),Math.round(obj.y-2),23,7,0,0,2*Math.PI);
     ctx.fill();
     ctx.restore();
     drawCharacter(ctx,obj);
   }
   if(debug){
     const p=map.pier;
     ctx.strokeStyle='#79efff';
     ctx.lineWidth=2;
     ctx.strokeRect(p.left*TILE,p.top*TILE,
       (p.right-p.left+1)*TILE,(p.bottom-p.top+1)*TILE);
     for(const fixture of p.fixtures){
       ctx.beginPath();
       ctx.arc(fixture.x,fixture.y,fixture.radius+7,0,Math.PI*2);
       ctx.stroke();
     }
     ctx.lineWidth=3;
     for(const o of map.objects){
       ctx.strokeStyle=o.kind==='building'?'#ef7ea7':'#e8d382';
       if(o.collision){
         const b=o.collision;
         ctx.strokeRect(b.left,b.top,b.right-b.left,b.bottom-b.top);
       }else{
         ctx.beginPath();ctx.arc(o.x,o.y,o.radius+7,0,Math.PI*2);ctx.stroke();
       }
     }
     ctx.strokeStyle='#ffd45a';
     for(const site of map.interiors){
       ctx.strokeRect(site.x-23,site.thresholdY-10,46,20);
     }
     ctx.strokeStyle='#40edb8';
     for(const npc of residents){
       ctx.beginPath();ctx.arc(npc.x,npc.y,22,0,Math.PI*2);ctx.stroke();
     }
     ctx.strokeStyle='#75d6ff';ctx.strokeRect(map.exit.left,map.exit.top,
       map.exit.right-map.exit.left,map.exit.bottom-map.exit.top);
   }
 };
 render.qa=Object.freeze({waveFrames:8,coastTiles:surf.entries.length,
   buildings:sprites.filter(o=>o.kind==='building').length,
   visibleSigns:signs.length,
   nativeObjectCount:sprites.length,pierSprite:[art.pierNative.naturalWidth,art.pierNative.naturalHeight],
   pierWalkableCells:(map.pier.right-map.pier.left+1)*(map.pier.bottom-map.pier.top+1),
   zoomRule:'shared non-field 0.5, fixed',
   ocean:'approved cove shoreline tiles + animated 8-frame surf'});
 return render;
}
