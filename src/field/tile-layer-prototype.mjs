// Experimental 32px tilemap / alpha shoreline / animated-water renderer.
// It is never selected by normal gameplay. The approved perspective renderer
// remains authoritative until the same-camera visual and speed QA passes.
const wet=(map,x,y)=>!map[y]?.[x]||['sea','river'].includes(map[y][x])||map.bridgeWaterCells?.has(x+','+y);
const canvas=(w,h)=>{const el=document.createElement('canvas');el.width=w;el.height=h;el.getContext('2d').imageSmoothingEnabled=false;return el};

export function createTileLayerPrototype(context,map,drawHero){
 const landscape=window.YK_LANDSCAPE,elevation=window.YK_ELEVATION;
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
  // Cut alpha holes out of the already baked landscape. Sand outside each
  // existing water mask is retained, so independently animated sea shows below.
  const masks=new Map();
  function mask(n,d){
   const key=Object.values(n).concat(Object.values(d)).map(Number).join('');
   if(masks.has(key))return masks.get(key);
   const tile=canvas(32,32),t=tile.getContext('2d'),data=t.createImageData(32,32);
   for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    if(landscape.contains(x,y,n,d))data.data[(y*32+x)*4+3]=255;
   }
   t.putImageData(data,0,0);masks.set(key,tile);return tile;
  }
  g.globalCompositeOperation='destination-out';
  for(let y=0;y<map.length;y++)for(let x=0;x<map[0].length;x++){
   if(!['sea','river'].includes(map[y][x])&&!map.bridgeWaterCells?.has(x+','+y))continue;
   const n={n:wet(map,x,y-1),e:wet(map,x+1,y),s:wet(map,x,y+1),w:wet(map,x-1,y)};
   const d={nw:wet(map,x-1,y-1),ne:wet(map,x+1,y-1),sw:wet(map,x-1,y+1),se:wet(map,x+1,y+1)};
   g.drawImage(mask(n,d),x*32,y*32);info.waterCells++;
  }
  g.globalCompositeOperation='source-over';
  info.builds++;info.masks=masks.size;info.buildMs=+(performance.now()-start).toFixed(2);
  info.staticBytes=land.width*land.height*4;
 }
 function draw(c,actor,time,viewWidth=c.canvas.width){
  prepare();
  const height=c.canvas.height,cam={x:actor.x,y:actor.foot,preset:0,centerX:viewWidth/2},zoom=1.4;
  c.save();c.imageSmoothingEnabled=false;c.clearRect(0,0,viewWidth,height);
  c.fillStyle='#192f3c';c.fillRect(0,0,viewWidth,height);
  landscape.drawAsset(c,'horizon',0,0,viewWidth,240);
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
  c.restore();info.draws++;info.waterFrames=Math.floor(time/360)%2;
  return info;
 }
 return {prepare,draw,info,get staticLand(){return land}};
}
