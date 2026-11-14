import {composeTerrainChips} from "./terrain-chips.mjs";

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

export function createFieldTerrainRenderer(map,drawHero,art,hero){
 const landscape=window.YK_LANDSCAPE;
 const objects=landscape.objects(map);
 const overlapsHero=createTreeOcclusion(landscape,hero);
 let land=null, stripsWidth, stripsHeight, strips=[];
 const waterPatterns=new WeakMap();
 const zoom=1.4;
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
 const info={builds:0,waterFrames:0,draws:0,staticLand:true,animatedWater:true};
 function prepare(){
  if(land)return;
  const {canvas,...stats}=composeTerrainChips(map,landscape,art);
  land=canvas;
  Object.assign(info,stats,{builds:1,staticBytes:land.width*land.height*4});
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
  const fall=landscape.motionArt('waterfall',time);
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
   c.restore();
  }
  // The camera follows the cell center. Use the near edge of the same
  // cell for the visible foot and for depth sorting.
  const playerFoot=actor.foot+16;
  const playerPosition=landscape.project(actor.x,playerFoot,cam,zoom);
  const drawPlayer=()=>{
   if(playerPosition)drawHero(c,playerPosition.x,playerPosition.y,playerPosition.scale);
  };
  const minFoot=landscape.unproject(0,136,cam,zoom).y;
  const maxFoot=landscape.unproject(0,Math.min(landscape.foregroundProjectionLimit,height+maxSpriteHeight*outerScale),cam,zoom).y;
  let first=0,last=objects.length;
  while(first<last){
   const mid=(first+last)>>1;
   if(objects[mid].foot<minFoot)first=mid+1;
   else last=mid;
  }
  let player=false;
  for(let i=first;i<objects.length&&objects[i].foot<=maxFoot;i++){
   const o=objects[i];
   const foot=o.foot??o.y;
   if(!player&&playerFoot<=foot){drawPlayer();player=true;}
   const cx=o.x+o.width/2,p=landscape.project(cx,foot,cam,zoom);
   if(!p||!landscape.specs[o.kind])continue;
   const w=o.width*p.scale,h=o.height*p.scale,x=p.x-w/2,y=p.y-h;
   if(x+w<=0||x>=viewWidth||y>=height||p.y<=136)continue;
   const fadeTree=player&&playerPosition&&treeKinds.has(o.kind)
    &&overlapsHero(o.kind,x,y,w,h,playerPosition);
   c.globalAlpha=Math.min(1,Math.max(0,(p.y-136)/70))*(fadeTree?treeOverlapAlpha:1);
   if(o.kind==='waterfall'&&fall)c.drawImage(fall,x,y,w,h);
   else landscape.drawAsset(c,o.kind,x,y,w,h);
   c.globalAlpha=1;
  }
  if(!player)drawPlayer();
  // Original projection fades the terrain into the same sky between y136-208.
  for(let y=136;y<208;y+=4){
   const t=(y-136)/72;c.globalAlpha=1-t*t*(3-2*t);skyBand(y,4);
  }
  c.globalAlpha=1;
  c.restore();info.draws++;info.waterFrames=Math.floor(time/360)%2;
  return info;
 }
 return {prepare,draw,info,get staticLand(){return land}};
}
