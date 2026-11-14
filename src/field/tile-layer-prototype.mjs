// Experimental 32px tilemap / alpha shoreline / animated-water renderer.
// It is never selected by normal gameplay. The approved perspective renderer
// remains authoritative until the same-camera visual and speed QA passes.
const wet=(map,x,y)=>!map[y]?.[x]||['sea','river'].includes(map[y][x])||map.bridgeWaterCells?.has(x+','+y);
const canvas=(w,h)=>{const el=document.createElement('canvas');el.width=w;el.height=h;el.getContext('2d').imageSmoothingEnabled=false;return el};

export function createTileLayerPrototype(context,map,drawHero){
 const landscape=window.YK_LANDSCAPE,elevation=window.YK_ELEVATION;
 const elevationView=window.YK_ELEVATION_VIEW;
 let land=null;
 const info={name:'tile-layers-experiment',builds:0,waterFrames:0,waterCells:0,draws:0,staticLand:true,animatedWater:true};
 function prepare(){
  if(land)return;
  const start=performance.now();
  const flat=map.slice();
  Object.assign(flat,map,{projectedHeights:false,shoreRelief:false});
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
  // Land/water masks must not erase south-facing cliff walls that extend
  // past the shore. Repaint the already-authored height faces on top.
  landscape.drawHeightFaces(g,flat);
  info.builds++;info.buildMs=+(performance.now()-start).toFixed(2);
  info.staticBytes=land.width*land.height*4;
 }
 function draw(c,actor,time,viewWidth=c.canvas.width){
  prepare();
  const height=c.canvas.height,cam={x:actor.x,y:actor.foot,preset:0,centerX:viewWidth/2},zoom=1.4;
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
  const frame=landscape.motionArt('water',time),pattern=c.createPattern(frame,'repeat');
  for(let sy=136;sy<Math.min(544,height);sy+=4){
   const sh=Math.min(4,height-sy);
   const a=landscape.unproject(0,sy,cam,zoom),b=landscape.unproject(viewWidth,sy,cam,zoom);
   const d=landscape.unproject(0,sy+sh,cam,zoom);
   if(!a||!b||!d||b.x<=a.x||d.y<=a.y)continue;
   const sx=viewWidth/(b.x-a.x),ys=sh/(d.y-a.y);
   c.save();c.beginPath();c.rect(0,sy,viewWidth,sh);c.clip();
   // Lower moving sea layer: the static land never receives a water frame.
   c.save();c.transform(sx,0,0,ys,-a.x*sx,sy-a.y*ys);
   c.fillStyle=pattern;c.fillRect(a.x-4,a.y-4,b.x-a.x+8,d.y-a.y+8);c.restore();
   const x0=Math.max(0,Math.floor(a.x)-1),x1=Math.min(land.width,Math.ceil(b.x)+1);
   const y0=Math.max(0,Math.floor(a.y)-1),y1=Math.min(land.height,Math.ceil(d.y)+1);
   if(x1>x0&&y1>y0)c.drawImage(land,x0,y0,x1-x0,y1-y0,
    (x0-a.x)*sx,sy+(y0-a.y)*ys,(x1-x0)*sx,(y1-y0)*ys+.5);
   c.restore();
  }
  const project=(x,y,z)=>{
   const p=landscape.project(x,y,cam,zoom);
   return p&&{...p,y:p.y-(z||0)*(map.elevationRise||20)*p.scale};
  };
  const drawPlayer=()=>{
   const p=project(actor.x,actor.foot,actor.height??elevation.height(map,actor.x,actor.foot));
   if(p)drawHero(p.x,p.y,p.scale);
  };
  let player=false;
  for(const o of landscape.objects(map)){
   const foot=o.foot??o.y;
   if(!player&&actor.foot<=foot){drawPlayer();player=true;}
   const cx=o.x+o.width/2,p=project(cx,foot,o.supportHeight??elevation.height(map,cx,foot));
   if(!p||p.x< -120||p.x>viewWidth+120||p.y<60||p.y>height+100)continue;
   if(!landscape.specs[o.kind])continue;
   c.globalAlpha=Math.min(1,Math.max(0,(p.y-136)/70));
   landscape.drawAsset(c,o.kind,p.x-o.width*p.scale/2,p.y-o.height*p.scale,o.width*p.scale,o.height*p.scale);
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
