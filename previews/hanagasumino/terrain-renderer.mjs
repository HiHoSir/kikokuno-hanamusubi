import {composeCoast} from '../../src/field/terrain-chips.mjs?v=field-height-1';
import {drawCliffs} from './water-chips.mjs?v=island';

const zoom=1.75;

const canvas=(w,h)=>{const el=document.createElement('canvas');el.width=w;el.height=h;el.getContext('2d').imageSmoothingEnabled=false;return el};

const treeKinds=new Set(['newTrees','sacredTree']);
const spriteSize=32;
const treeOverlapAlpha=.5;

function readSpriteAlpha(width,height,draw){
 const target=canvas(width,height).getContext('2d');
 draw(target);
 return target.getImageData(0,0,width,height).data;
}

function createTreeOcclusion(landscape,hero){
 const {image,anchor,frame}=hero;
 const trees=new Map(),frames=new Map();
 return (kind,x,y,w,h,player)=>{
  const heroWidth=spriteSize*player.scale;
  const left=player.x-anchor[0]*player.scale,top=player.y-anchor[1]*player.scale;
  if(x>=left+heroWidth||x+w<=left||y>=top+heroWidth||y+h<=top)return false;
  if(!trees.has(kind)){
   const [width,height]=landscape.specs[kind];
   const alpha=readSpriteAlpha(width,height,c=>landscape.drawAsset(c,kind,0,0,width,height));
   trees.set(kind,{width,height,alpha});
  }
  const {width,height,alpha}=trees.get(kind);
  const {row,column}=frame();
  const key=row*spriteSize+column;
  if(!frames.has(key)){
   const pixels=readSpriteAlpha(spriteSize,spriteSize,c=>c.drawImage(image,
    column*spriteSize,row*spriteSize,spriteSize,spriteSize,0,0,spriteSize,spriteSize));
   const opaque=[];
   for(let v=0;v<spriteSize;v++)for(let u=0;u<spriteSize;u++){
    if(pixels[(v*spriteSize+u)*4+3]>=128)opaque.push([u+.5,v+.5]);
   }
   frames.set(key,opaque);
  }
  // Compare the current hero frame with the foliage's opaque pixels.
  // Both alpha masks are cached. Canvas readback happens only on first use.
  return frames.get(key).some(([u,v])=>{
   const tx=Math.floor((left+u*player.scale-x)*width/w);
   const ty=Math.floor((top+v*player.scale-y)*height/h);
   return tx>=0&&tx<width&&ty>=0&&ty<height&&alpha[(ty*width+tx)*4+3]>=128;
  });
 };
}

export function createFieldTerrainRenderer(map,drawHero,art,hero,falls){
 const landscape=window.YK_LANDSCAPE;
 const objects=landscape.objects(map).map(o=>({...o,center:o.x+o.width/2}));
 const overlapsHero=createTreeOcclusion(landscape,hero);
 let land=null, stripsWidth, stripsHeight, strips=[];
 const waterPatterns=new WeakMap();
 // Use an upper bound only to limit the foot-sorted search. Visibility of
 // each prop is then tested on its full projected sprite, including its top.
 const maxSpriteHeight=objects.reduce((max,o)=>Math.max(max,o.height),0);
 const outerScale=landscape.unproject(0,landscape.foregroundProjectionLimit,{x:0,y:0,foregroundGrowth:true},zoom).scale;
 function projectionStrips(width,height){
  if(stripsWidth===width&&stripsHeight===height)return strips;
  stripsWidth=width;stripsHeight=height;strips=[];
  const view={x:0,y:0,preset:0,centerX:width/2,foregroundGrowth:true};
  for(let sy=136;sy<Math.min(544,height);sy+=4){
   const sh=Math.min(4,height-sy);
   const left=landscape.unproject(0,sy,view,zoom);
   const right=landscape.unproject(width,sy,view,zoom);
   const next=landscape.unproject(0,sy+sh,view,zoom);
   if(left&&right&&next)strips.push({sy,sh,left,right,next});
  }
  return strips;
 }
 function waterPattern(c,frame){
  let patterns=waterPatterns.get(c);
  if(!patterns){patterns=new WeakMap();waterPatterns.set(c,patterns);}
  if(!patterns.has(frame))patterns.set(frame,c.createPattern(frame,'repeat'));
  return patterns.get(frame);
 }
 const info={zoom,builds:0,waterFrames:0,draws:0,animatedWater:true};
 function prepare(){
  if(land)return;
  const started=performance.now();
  const {canvas:ground,...stats}=composeCoast(map,landscape,art);
  const context=ground.getContext('2d');
  drawCliffs(context,map,art);
  for(const [x,y] of map.bridges){
   landscape.drawAsset(context,'bridge',x*32-16,y*32-4,64,40);
  }
  land=ground;
  Object.assign(info,stats,{builds:1,buildMs:performance.now()-started});
 }
 function draw(c,actor,time,viewWidth=c.canvas.width){
  prepare();
  const height=c.canvas.height,cam={x:actor.x,y:actor.foot,preset:0,centerX:viewWidth/2,foregroundGrowth:true};
  c.save();c.imageSmoothingEnabled=false;c.clearRect(0,0,viewWidth,height);
  c.fillStyle='#192f3c';c.fillRect(0,0,viewWidth,height);
  // Match the normal Momotaro-style sky, including mirrored panorama sides.
  // Stretching a 640px horizon across the screen produced a harsh seam.
  const horizon=landscape.motionArt('horizon',time);
  const left=Math.floor((viewWidth-640)/2),right=viewWidth-left-640;
  function skyBand(y,h){
   if(left>0){c.save();c.translate(left,0);c.scale(-1,1);c.drawImage(horizon,0,y,left,h,0,y,left,h);c.restore();}
   c.drawImage(horizon,0,y,640,h,left,y,640,h);
   if(right>0){c.save();c.translate(left+640+right,0);c.scale(-1,1);
    c.drawImage(horizon,640-right,y,right,h,0,y,right,h);c.restore();}
  }
  skyBand(0,240);
  const frame=landscape.motionArt('water',time),pattern=waterPattern(c,frame);
  const fall=falls[Math.floor(time/150)%falls.length];
  for(const {sy,sh,left,right,next} of projectionStrips(viewWidth,height)){
   const ax=cam.x+left.x,ay=cam.y+left.y,bx=cam.x+right.x,dy=cam.y+next.y;
   if(bx<=ax||dy<=ay)continue;
   const sx=viewWidth/(bx-ax),ys=sh/(dy-ay);
   c.save();c.beginPath();c.rect(0,sy,viewWidth,sh);c.clip();
   // Lower moving sea layer: the static land never receives a water frame.
   c.save();c.transform(sx,0,0,ys,-ax*sx,sy-ay*ys);
   c.fillStyle=pattern;c.fillRect(ax-4,ay-4,bx-ax+8,dy-ay+8);c.restore();
   const x0=Math.max(0,Math.floor(ax)-1),x1=Math.min(land.width,Math.ceil(bx)+1);
   const y0=Math.max(0,Math.floor(ay)-1),y1=Math.min(land.height,Math.ceil(dy)+1);
   if(x1>x0&&y1>y0)c.drawImage(land,x0,y0,x1-x0,y1-y0,
    (x0-ax)*sx,sy+(y0-ay)*ys,(x1-x0)*sx,(y1-y0)*ys+.5);
   if (fall.x+fall.width>ax && fall.x<bx && fall.y+fall.height>ay && fall.y<dy) {
    c.drawImage(fall.image,fall.sx,0,fall.width,fall.height,
     (fall.x-ax)*sx,sy+(fall.y-ay)*ys,fall.width*sx,fall.height*ys);
   }
   c.restore();
  }
  // The camera follows the cell center. Use the near edge of the same
  // cell for the visible foot and for depth sorting.
  const playerFoot=actor.foot+16;
  const playerPosition=landscape.project(actor.x,playerFoot,cam,zoom);
  const drawPlayer=()=>{
   if(!playerPosition)return;
   const {x,y,scale}=playerPosition;
   drawHero(c,x,y,scale);
  };
  const minFoot=landscape.unproject(0,136,cam,zoom).y;
  const maxFoot=landscape.unproject(0,Math.min(landscape.foregroundProjectionLimit,height+maxSpriteHeight*outerScale),cam,zoom).y;
  let first=0,last=objects.length;
  while(first<last){
   const mid=(first+last)>>1;
   if(objects[mid].foot<minFoot)first=mid+1;
   else last=mid;
  }
  // Sprites and the terrain share the same horizon. A tall distant sprite
  // can otherwise rise above the first row of the fog overlay.
  c.save();c.beginPath();c.rect(0,136,viewWidth,Math.max(0,height-136));c.clip();
  let player=false;
  for(let i=first;i<objects.length&&objects[i].foot<=maxFoot;i++){
   const o=objects[i];
   const foot=o.foot;
   if(!player&&playerFoot<=foot){drawPlayer();player=true;}
   const p=landscape.project(o.center,o.foot,cam,zoom);
   if(!p||!landscape.specs[o.kind])continue;
   const w=o.width*p.scale,h=o.height*p.scale,x=p.x-w/2,y=p.y-h;
   if(x+w<=0||x>=viewWidth||y>=height||p.y<=136)continue;
   const fadeTree=player&&playerPosition&&treeKinds.has(o.kind)
    &&overlapsHero(o.kind,x,y,w,h,playerPosition);
   c.globalAlpha=Math.min(1,Math.max(0,(p.y-136)/70))*(fadeTree?treeOverlapAlpha:1);
   landscape.drawAsset(c,o.kind,x,y,w,h);
   c.globalAlpha=1;
  }
  if(!player)drawPlayer();
  c.restore();
  // Original projection fades the terrain into the same sky between y136-208.
  for(let y=136;y<208;y+=4){
   const t=(y-136)/72;c.globalAlpha=1-t*t*(3-2*t);skyBand(y,4);
  }
  c.globalAlpha=1;
  c.restore();info.draws++;info.waterFrames=Math.floor(time/360)%2;
  return info;
 }
 function drawOverview(context,landmarks,position,mouths){
  prepare();
  const {width,height}=context.canvas;
  const scale=width/land.width;
  context.imageSmoothingEnabled=false;
  context.fillStyle='#20566b';
  context.fillRect(0,0,width,height);
  context.save();
  context.scale(scale,scale);
  context.drawImage(land,0,0);
  const fall=falls[0];
  context.drawImage(fall.image,fall.x,fall.y);
  for(const o of objects)landscape.drawAsset(context,o.kind,o.x,o.y,o.width,o.height);
  context.restore();
  const center=([x,y])=>[(x+.5)*32*scale,(y+.5)*32*scale];
  const [from,to]=mouths.map(center);
  context.strokeStyle='#efd7a4';
  context.lineWidth=3;
  context.setLineDash([6,5]);
  context.beginPath();context.moveTo(...from);context.lineTo(...to);context.stroke();
  context.setLineDash([]);
  context.font='bold 17px sans-serif';
  context.textAlign='center';
  context.textBaseline='middle';
  for(const [i,{point}] of landmarks.entries()){
   const [x,y]=center(point);
   context.fillStyle='#23291d';
   context.strokeStyle='#fff0bd';
   context.lineWidth=2.5;
   context.beginPath();context.arc(x,y,12,0,Math.PI*2);context.fill();context.stroke();
   context.fillStyle='#fff4ce';context.fillText(String(i+1),x,y+.5);
  }
  if(position){
   const [x,y]=center(position);
   context.strokeStyle='#78eaff';context.lineWidth=4;
   context.beginPath();context.arc(x,y,14,0,Math.PI*2);context.stroke();
  }
 }
 return {prepare,draw,drawOverview,info};
}
