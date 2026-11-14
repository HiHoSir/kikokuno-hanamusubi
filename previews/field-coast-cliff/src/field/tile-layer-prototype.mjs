// Experimental 32px tilemap / alpha shoreline / animated-water renderer.
// It is never selected by normal gameplay. The approved perspective renderer
// remains authoritative until the same-camera visual and speed QA passes.
const wet=(map,x,y)=>!map[y]?.[x]||['sea','river'].includes(map[y][x])||map.bridgeWaterCells?.has(x+','+y);
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
 return (kind,x,y,w,h,player,alternate)=>{
  const heroWidth=spriteSize*player.scale;
  const left=player.x-anchor[0]*player.scale,top=player.y-anchor[1]*player.scale;
  if(x>=left+heroWidth||x+w<=left||y>=top+heroWidth||y+h<=top)return false;
  const artKey=alternate||kind;
  if(!trees.has(artKey)){
   const [width,height]=landscape.specs[kind];
   const alpha=readSpriteAlpha(width,height,c=>{
    if(alternate)c.drawImage(alternate,0,0);
    else landscape.drawAsset(c,kind,0,0,width,height);
   });
   trees.set(artKey,{width,height,alpha});
  }
  const {width,height,alpha}=trees.get(artKey);
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

export function createTileLayerPrototype(context,map,drawHero,chips,hero){
 const landscape=window.YK_LANDSCAPE,elevation=window.YK_ELEVATION;
 const elevationView=window.YK_ELEVATION_VIEW;
 const objects=landscape.objects(map);
 const overlapsHero=chips&&hero?createTreeOcclusion(landscape,hero):null;
 const shortTrees=chips?.cliffUnderstoryTrees?.(map,objects);
 let lowTree;
 let land=null, stripsWidth, stripsHeight, strips=[];
 const waterPatterns=new WeakMap();
 const zoom=1.4;
 // Use an upper bound only to limit the foot-sorted search. Visibility of
 // each prop is then tested on its full projected sprite, including its top.
 const maxSpriteHeight=chips?objects.reduce((max,o)=>Math.max(max,o.height),0):0;
 const outerScale=chips?landscape.unproject(0,landscape.foregroundProjectionLimit,{x:0,y:0,foregroundGrowth:true},zoom).scale:0;
 function projectionStrips(width,height){
  if(stripsWidth===width&&stripsHeight===height)return strips;
  stripsWidth=width;stripsHeight=height;strips=[];
  const view={x:0,y:0,preset:0,centerX:width/2,foregroundGrowth:!!chips};
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
 const info={name:'tile-layers-experiment',builds:0,waterFrames:0,waterCells:0,draws:0,staticLand:true,animatedWater:true};
 function prepare(){
  if(land)return;
  if(chips){
   const baked=chips.composeTerrainChips(map,landscape,chips.art);
   land=baked.canvas;
   if(shortTrees?.size){
    const source=canvas(32,32);
    landscape.drawAsset(source.getContext('2d'),'newTrees',0,0,32,32);
    lowTree=canvas(32,32);
    const target=lowTree.getContext('2d');
    // Keep the original contact pixels at the bottom of the chip.
    target.drawImage(source,0,0,32,27,0,12,32,15);
    target.drawImage(source,0,27,32,5,0,27,32,5);
   }
   Object.assign(info,baked,{canvas:undefined,lowTrees:shortTrees?.size||0,builds:1,staticBytes:land.width*land.height*4});
   return;
  }
  const start=performance.now();
  const flat=map.slice();
  Object.assign(flat,map,{projectedHeights:true,shoreRelief:false});
  const source=landscape.groundLayer(flat);
  land=canvas(map[0].length*32,map.length*32);
  const g=land.getContext('2d');g.drawImage(source,0,0);
  // Transparent SEA tiles are a separate, animated bottom layer. A 32px
  // ground tile has a fixed alpha coastline and may draw over moving water.
  // Keep the existing world-space curvy shore geometry (not the old blocky
  // legacy 16-mask silhouette) and paint its inland sand band once.
  g.save();
  g.globalCompositeOperation='destination-out';
  g.fillStyle='#000';
  for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){
   if(!['sea','river'].includes(map[y][x])&&!map.bridgeWaterCells?.has(x+','+y))continue;
   g.fillRect(x*32,y*32,32,32);info.waterCells++;
  }
  g.restore();
  const coastTiles=[];
  const sand=g.createPattern(landscape.motionArt('sand',0),'repeat');
  for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){
   if(wet(map,x,y))continue;
   const shape=elevation.outline(map,x,y);
   if(shape.cuts.length)continue;
   const shore=elevationView.shoreGeometry(map,x,y,shape);
   if(!shore.outline)continue;
   coastTiles.push({x,y,shore});
   const points=shore.outline.poly;
   function path(points){
    g.moveTo(x*32+points[0][0],y*32+points[0][1]);
    for(let i=1;i<points.length;i++)g.lineTo(x*32+points[i][0],y*32+points[i][1]);
    g.closePath();
   }
   // Cut only the outside of the authored curved land polygon. The sea beneath
   // remains visible through its alpha holes, even between water animation frames.
   g.save();
   g.beginPath();g.rect(x*32,y*32,32,32);path(points);
   g.globalCompositeOperation='destination-out';g.fillStyle='#000';g.fill('evenodd');
   g.restore();
   g.save();g.beginPath();path(points);g.clip();
   for(const band of shore.sand){
    g.save();g.beginPath();path(band.poly);g.clip();
    g.fillStyle=sand;g.fillRect(x*32,y*32,32,32);g.restore();
   }
   g.restore();
  }
  // Ink belongs to the static terrain layer. Wavy coast borders no longer
  // require per-frame calculations or additional projected triangles.
  g.save();g.strokeStyle='rgba(27,36,29,.76)';g.lineWidth=1;g.lineJoin='round';
  for(const {x,y,shore} of coastTiles){
   g.beginPath();
   for(const [a,b] of shore.darkEdges){
    g.moveTo(x*32+a[0],y*32+a[1]);g.lineTo(x*32+b[0],y*32+b[1]);
   }
   g.stroke();
  }
  g.restore();
  info.coastTiles=coastTiles.length;
  info.masks=coastTiles.length;
  // Bake the authored 0..3 level height steps as *textured map pieces*
  // ONCE, not as moving 2D rectangles or perspective triangles each frame.
  // The earlier test used flat grey legacy walls, which failed the actual
  // Momotaro-style visual criterion despite being quick.
  const elevationRise=map.elevationRise||20;
  for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
    const h=map.heights[y]?.[x]||0;
    if(h<=0||wet(map,x,y))continue;
    const px=x*32,py=y*32,raisedY=py-h*elevationRise;
    const south=map.heights[y+1]?.[x]||0;
    const west=map.heights[y]?.[x-1]||0;
    const east=map.heights[y]?.[x+1]||0;
    if(h>south){
      const wallHeight=(h-south)*elevationRise;
      // Existing approved cliff graphic is 32x32. Repeat 20px pieces
      // vertically, preserving its original pixel density.
      for(let offset=0;offset<wallHeight;offset+=elevationRise){
        landscape.drawAsset(g,'grassCliff',px,raisedY+32+offset,32,
          Math.min(elevationRise,wallHeight-offset));
      }
      g.fillStyle='rgba(19,25,20,.16)';
      g.fillRect(px,raisedY+32,32,wallHeight);
    }
    if(h>west){g.fillStyle='rgba(17,26,29,.4)';g.fillRect(px,raisedY+2,3,29);}
    if(h>east){g.fillStyle='rgba(27,33,31,.26)';g.fillRect(px+29,raisedY+2,3,29);}
    g.drawImage(source,px,py,32,32,px,raisedY,32,32);
    if(h>south){
      g.fillStyle='rgba(209,188,143,.5)';
      g.fillRect(px,raisedY+30,32,2);
    }
  }
  info.builds++;info.buildMs=+(performance.now()-start).toFixed(2);
  info.staticBytes=land.width*land.height*4;
 }
 function draw(c,actor,time,viewWidth=c.canvas.width){
  prepare();
  const height=c.canvas.height,cam={x:actor.x,y:actor.foot,preset:0,centerX:viewWidth/2,foregroundGrowth:!!chips};
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
  const project=(x,y,z)=>{
   const p=landscape.project(x,y,cam,zoom);
   return chips?p:p&&{...p,y:p.y-(z||0)*(map.elevationRise||20)*p.scale};
  };
  // Movement and camera use the cell centre. In the chip scene the visible
  // contact point follows the same near edge as a one-cell object's foot.
  const playerFoot=chips?actor.foot+16:actor.foot;
  const playerPosition=project(actor.x,playerFoot,chips?0:actor.height??elevation.height(map,actor.x,actor.foot));
  const drawPlayer=()=>{
   if(playerPosition)drawHero(c,playerPosition.x,playerPosition.y,playerPosition.scale);
  };
  // Objects are already sorted by their world foot. In the chip renderer
  // height is baked into the land, so this range is exact before projection.
  const minFoot=chips?landscape.unproject(0,136,cam,zoom).y:-Infinity;
  const maxFoot=chips?landscape.unproject(0,Math.min(landscape.foregroundProjectionLimit,height+maxSpriteHeight*outerScale),cam,zoom).y:Infinity;
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
   const cx=o.x+o.width/2,p=project(cx,foot,chips?0:o.supportHeight??elevation.height(map,cx,foot));
   if(!p||!landscape.specs[o.kind])continue;
   const w=o.width*p.scale,h=o.height*p.scale,x=p.x-w/2,y=p.y-h;
   if(chips){
    if(x+w<=0||x>=viewWidth||y>=height||p.y<=136)continue;
   }else if(p.x< -120||p.x>viewWidth+120||p.y<60||p.y>height+100)continue;
   const alternate=shortTrees?.has(o)?lowTree:null;
   const fadeTree=player&&playerPosition&&overlapsHero&&treeKinds.has(o.kind)
    &&overlapsHero(o.kind,x,y,w,h,playerPosition,alternate);
   c.globalAlpha=Math.min(1,Math.max(0,(p.y-136)/70))*(fadeTree?treeOverlapAlpha:1);
   if(chips&&o.kind==='waterfall'&&fall)c.drawImage(fall,x,y,w,h);
   else if(alternate)c.drawImage(alternate,x,y,w,h);
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
