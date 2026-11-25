import {WIDTH,HEIGHT,TILE} from '../../../data/maps/village-previews/scenes.mjs?v=villages-5';
import {canopyOpacity} from '../village/render.mjs';
import {drawCharacter} from '../village/residents.mjs';

const contains=([left,top,w,h],x,y)=>x>=left&&x<left+w&&y>=top&&y<top+h;
// Coordinates in the shared 8×6 village path chip atlases, indexed by
// exposed sides (north/east/south/west in bits 1/2/4/8).
const pathEdges=new Map([
 [1,[7,3]], [2,[4,4]], [3,[2,3]], [4,[3,4]], [6,[2,4]],
 [8,[0,3]], [9,[4,2]], [12,[0,2]]
]);
const coreChips=[[4,5],[5,5],[6,5],[7,4]];
const start=(world,view,desired)=>Math.min(Math.max(0,world-view),Math.max(0,desired));
const chip=(ctx,art,sx,sy,x,y)=>ctx.drawImage(art,sx,sy,TILE,TILE,x,y,TILE,TILE);
function surface(width,height){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 ctx.imageSmoothingEnabled=false;
 return {canvas,ctx};
}

export function createVillageLandscape(map,art){
 const {canvas,ctx}=surface(WIDTH,HEIGHT);
 const paved=(x,y)=>map.paths.some(rect=>contains(rect,x+16,y+16));
 const pathArt=map.pool?art.cobble:art.road;
 for(let y=0;y<HEIGHT;y+=TILE)for(let x=0;x<WIDTH;x+=TILE){
   chip(ctx,art.grass,0,0,x,y);
   if(paved(x,y)){
     const edges=(!paved(x,y-TILE)?1:0)|(!paved(x+TILE,y)?2:0)|
       (!paved(x,y+TILE)?4:0)|(!paved(x-TILE,y)?8:0);
     const [col,row]=pathEdges.get(edges)??coreChips[(x/TILE*7+y/TILE*11)%4];
     chip(ctx,pathArt,col*TILE,row*TILE,x,y);
   }else if((x*7+y*13)%(TILE*43)<TILE&&x>64&&y>220){
     chip(ctx,art.groundDetails,TILE*(1+(x/TILE+y/TILE)%4),TILE*4,x,y);
   }
 }
 for(const [x,y,columns,rows] of map.gardens??[]){
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
     const px=x+col*TILE,py=y+row*TILE;
     chip(ctx,art.soil,px%256,py%256,px,py);
     chip(ctx,art.crop,0,0,px,py);
   }
 }
 const covers=new Set(map.objects.filter(object=>object.canopy||object.site).map(object=>object.sprite));
 const masks=new Map([...covers].map(sprite=>{
   const bitmap=art[sprite];
   const mask=surface(bitmap.width,bitmap.height);
   mask.ctx.drawImage(bitmap,0,0);
   return [sprite,mask.ctx.getImageData(0,0,bitmap.width,bitmap.height)];
 }));
 const signs=map.objects.filter(object=>object.sign).map(object=>({
   sprite:object.sign,x:object.x-87,y:object.y-6,depth:object.y+1
 }));
 const structures=[...map.objects,...signs].map(object=>{
   const bitmap=art[object.sprite];
   return {...object,bitmap,point:[Math.round(object.x-bitmap.width/2),
     Math.round(object.y-bitmap.height)],depth:object.depth??object.y};
 });

 function draw(ctx,viewport,hero,residents,time){
   const {step,bufferWidth,bufferHeight}=viewport;
   const viewWidth=bufferWidth/step,viewHeight=bufferHeight/step;
   const x0=Math.floor(start(WIDTH,viewWidth,hero.x-viewWidth/2));
   const y0=Math.floor(start(HEIGHT,viewHeight,hero.y-viewHeight/2-Math.min(306,viewHeight*.38)));
   ctx.setTransform(1,0,0,1,0,0);
   ctx.fillStyle=map.pool?'#344539':'#243c2d';
   ctx.fillRect(0,0,bufferWidth,bufferHeight);
   const x=Math.max(0,(viewWidth-WIDTH)/2)-x0,y=Math.max(0,(viewHeight-HEIGHT)/2)-y0;
   ctx.setTransform(step,0,0,step,Math.round(x*step),Math.round(y*step));
   ctx.imageSmoothingEnabled=false;
   ctx.drawImage(canvas,0,0);
   if(map.pool)drawPool(ctx,art,map.pool,time);
   const actors=[...residents,{...hero,bitmap:art.hero}];
   const ordered=[...structures,...actors].sort((a,b)=>(a.depth??a.y)-(b.depth??b.y));
   for(const obj of ordered){
     if(obj.point){
       ctx.globalAlpha=canopyOpacity(obj,hero.x,hero.y,masks.get(obj.sprite));
       ctx.drawImage(obj.bitmap,...obj.point);
       ctx.globalAlpha=1;
     }else{
       ctx.fillStyle='#16251b70';
       ctx.beginPath();
       ctx.ellipse(Math.round(obj.x),Math.round(obj.y-2),22,7,0,0,2*Math.PI);
       ctx.fill();
       drawCharacter(ctx,obj);
     }
   }
 }
 return {draw};
}

function drawPool(ctx,art,[x,y,w,h],time){
 const frame=Math.floor(time/240)%4;
 for(let dy=0;dy<h;dy+=TILE)for(let dx=0;dx<w;dx+=TILE){
   const rim=dy===0||dy===h-TILE||dx===0||dx===w-TILE;
   if(rim){
     chip(ctx,art.cobble,224,128,x+dx,y+dy);
     chip(ctx,art.stone,0,0,x+dx,y+dy);
   }else{
     chip(ctx,art.water,0,(frame+((dx+dy)/TILE)%2)%4*TILE,x+dx,y+dy);
   }
 }
}
