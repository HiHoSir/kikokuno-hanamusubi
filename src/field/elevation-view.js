// Texture mapping uses the production field's perspective projection.
// The same elevation sampler positions terrain vertices, roads, feet and objects.
window.YK_ELEVATION_VIEW=(()=>{
 const E=window.YK_ELEVATION;
 const paths=YK_FIELD_ASSETS.landscape;
 const [heroAnchorX,heroAnchorY]=YK_FIELD_ASSETS.heroFootAnchorPx;
 const sources={grass:paths.grass,sand:paths.sand,snow:paths.snow,rock:paths.barren,grassCliff:paths.grassCliff,sea:paths.water,road:paths.road,horizon:paths.horizon,trees:paths.newTrees,shrine:paths.shrine,hero:YK_FIELD_ASSETS.hero,ladder:paths.ladder};
 async function load(){const pairs=await Promise.all(Object.entries(sources).map(([k,src])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve([k,im]);im.onerror=()=>reject(Error(src));im.src=YK_FIELD_ASSETS.url(src);})));return Object.fromEntries(pairs);}
 const padded=new WeakMap();
 function repeatPadding(im){
  if(padded.has(im))return padded.get(im);
  const surface=document.createElement('canvas');surface.width=im.width*3;surface.height=im.height*3;
  const q=surface.getContext('2d');for(let y=0;y<3;y++)for(let x=0;x<3;x++)q.drawImage(im,x*im.width,y*im.height);
  padded.set(im,surface);return surface;
 }
 function triangle(c,im,uv,p){
  const [a,b,d]=uv,[A,B,D]=p,den=(b.x-a.x)*(d.y-a.y)-(d.x-a.x)*(b.y-a.y);if(Math.abs(den)<1e-8)return;
  const xx=((B.x-A.x)*(d.y-a.y)-(D.x-A.x)*(b.y-a.y))/den;
  const xy=((D.x-A.x)*(b.x-a.x)-(B.x-A.x)*(d.x-a.x))/den;
  const yx=((B.y-A.y)*(d.y-a.y)-(D.y-A.y)*(b.y-a.y))/den;
  const yy=((D.y-A.y)*(b.x-a.x)-(B.y-A.y)*(d.x-a.x))/den;
  // Subpixel overlap closes rasterization hairlines; repeated padding keeps edge
  // samples valid without stretching the tile or exposing the sea behind it.
  const cx=(A.x+B.x+D.x)/3,cy=(A.y+B.y+D.y)/3;
  c.save();c.beginPath();p.forEach((v,i)=>{const len=Math.hypot(v.x-cx,v.y-cy)||1,x=v.x+(v.x-cx)/len*.65,y=v.y+(v.y-cy)/len*.65;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();
  c.transform(xx,yx,xy,yy,A.x-xx*a.x-xy*a.y,A.y-yx*a.x-yy*a.y);c.drawImage(repeatPadding(im),-im.width,-im.height);c.restore();
 }
 function quad(c,im,sx,sy,sw,sh,p,shade=0){
  const uv=[{x:sx,y:sy},{x:sx+sw,y:sy},{x:sx+sw,y:sy+sh},{x:sx,y:sy+sh}];
  triangle(c,im,[uv[0],uv[1],uv[2]],[p[0],p[1],p[2]]);triangle(c,im,[uv[0],uv[2],uv[3]],[p[0],p[2],p[3]]);
  if(shade){c.save();c.fillStyle='rgba(12,24,34,'+shade+')';c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();c.restore();}
 }
 function bandPolygon(poly,low,high){
  for(const [bound,sign] of [[low,1],[high,-1]]){const out=[];
   for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=(a[1]-bound)*sign>=0,bi=(b[1]-bound)*sign>=0;
    if(ai)out.push(a);if(ai!==bi){const t=(bound-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,bound]);}
   }poly=out;
  }return poly;
 }
 // Shore geometry is derived from neighbouring water, independent of terrain art.
 const waterKind=t=>t==='sea'||t==='river';
 const shoreSides=(m,x,y)=>{
  // Object corner protection applies to elevation cuts, not shoreline edges.
  if(waterKind(m[y]?.[x])||m.roads?.has(x+','+y)||m[y]?.[x]==='bridge')return [];
  return [['n',0,-1],['e',1,0],['s',0,1],['w',-1,0]].filter(([side,dx,dy])=>{
   if(!waterKind(m[y+dy]?.[x+dx]))return false;
   // Only a level, non-ramped bank is a beach. Elevated land is a cliff.
   // Compare both shared edge endpoints so sloping shores are excluded.
   const ends=side==='n'?[[0,0],[1,0]]:side==='e'?[[1,0],[1,1]]:side==='s'?[[0,1],[1,1]]:[[0,0],[0,1]];
   return ends.every(([u,v])=>
    Math.abs(E.level(m,x,y,u,v)-E.level(m,x+dx,y+dy,u-dx,v-dy))<.001
   );
  }).map(([side])=>side);
 };
 // Immutable terrain topology is expensive to recompute every time the
 // camera moves. Keep source-space coastline shapes, never screen positions.
 const shoreCache=new WeakMap();
 function shoreGeometry(m,tx,ty,shape){
  const useCache=window.YK_FIELD_SHORE_CACHE!==false;
  let cache=shoreCache.get(m);
  if(useCache){
   if(!cache){cache=new Map();shoreCache.set(m,cache);}
   const result=cache.get(ty*m[0].length+tx);
   if(result)return result;
  }
  const sides=shape.cuts.length?[]:shoreSides(m,tx,ty);
  const outline=sides.length?shoreOutline(sides,tx,ty):null;
  const sand=[],darkEdges=[];
  if(outline){
   const edge=outline.poly,flags=outline.boundary,center=[16,16];
   for(let i=0;i<edge.length;i++){
    const j=(i+1)%edge.length;
    if(!flags[i]||!flags[j])continue;
    const a=edge[i],b=edge[j],dx=b[0]-a[0],dy=b[1]-a[1];
    darkEdges.push([a,b]);
    const len=Math.hypot(dx,dy);if(len<.01)continue;
    const inward=[-dy/len,dx/len],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    if((center[0]-mid[0])*inward[0]+(center[1]-mid[1])*inward[1]<0){inward[0]*=-1;inward[1]*=-1;}
    const width=8+1.2*Math.sin((tx*32+mid[0])*.11+(ty*32+mid[1])*.17);
    const poly=[a,b,[b[0]+inward[0]*width,b[1]+inward[1]*width],[a[0]+inward[0]*width,a[1]+inward[1]*width]];
    sand.push({a,b,width,poly});
   }
  }
  const value={sides,outline,sand,darkEdges};
  if(useCache)cache.set(ty*m[0].length+tx,value);
  return value;
 }
 // Shared shoreline mask for the visible land surface and its sand overlay.
 // Round convex land corners only when both orthogonal neighbours are water.
 // The removed corner reveals the already rendered water below; collision
 // and height geometry remain unchanged.
 // Each shore edge is sampled in world coordinates. Land and sand share
 // this polygon; the dark waterline is extracted from its marked edges.
 function shoreOutline(shores,tx,ty){
  const wet=new Set(shores),poly=[],boundary=[],radius=9;
  const wave=(x,y)=>2.2+1.3*Math.sin(x*.13+y*.071)+.8*Math.sin(x*.29-y*.11);
  const corners=[[0,0,'w','n'],[32,0,'n','e'],[32,32,'e','s'],[0,32,'s','w']];
  const sidePoint=(side,t)=>{
   const wx=tx*32,wy=ty*32;
   const f=Math.sin(Math.PI*t/32),d=Math.max(0,wave(wx+(side==='n'||side==='s'?t:side==='e'?32:0),wy+(side==='e'||side==='w'?t:side==='s'?32:0)))*f;
   return side==='n'?[t,d]:side==='e'?[32-d,t]:side==='s'?[32-t,32-d]:[d,32-t];
  };
  const sideAt=(side,t)=>side==='n'?sidePoint('n',t):side==='e'?sidePoint('e',t):side==='s'?sidePoint('s',t):sidePoint('w',t);
  const sides=['n','e','s','w'];
  for(let i=0;i<4;i++){
   const side=sides[i],prev=sides[(i+3)%4],next=sides[(i+1)%4];
   const start=wet.has(side)&&wet.has(prev)?radius:0;
   const finish=wet.has(side)&&wet.has(next)?32-radius:32;
   if(wet.has(side)){
    for(let t=start;t<=finish;t+=2){
     const p=sideAt(side,t);poly.push(p);boundary.push(true);
    }
    if((finish-start)%2!==0){poly.push(sideAt(side,finish));boundary.push(true);}
   }else{
    poly.push(sideAt(side,start));boundary.push(false);
    poly.push(sideAt(side,finish));boundary.push(false);
   }
   if(wet.has(side)&&wet.has(next)){
    const from=sideAt(side,32-radius),to=sideAt(next,radius);
    const corner=corners[(i+1)%4];
    for(let j=1;j<=6;j++){
     const t=j/7,u=1-t;
     poly.push([u*u*from[0]+2*u*t*corner[0]+t*t*to[0],u*u*from[1]+2*u*t*corner[1]+t*t*to[1]]);
     boundary.push(true);
    }
   }
  }
  return {poly,boundary};
 }
 function clipShore(c,poly,tx,ty,point,m){
  const p=poly.map(([u,v])=>point(tx*32+u,ty*32+v,E.level(m,tx,ty,u/32,v/32)));
  if(!p.every(Boolean))return false;
  c.beginPath();p.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.clip();return true;
 }
 const groundTiles=new WeakMap();
 function groundTile(surface,tx,ty){
  if(!groundTiles.has(surface))groundTiles.set(surface,new Map());
  const cache=groundTiles.get(surface),key=tx+','+ty;if(cache.has(key))return cache.get(key);
  const tile=document.createElement('canvas');tile.width=tile.height=32;
  tile.getContext('2d').drawImage(surface,tx*32,ty*32,32,32,0,0,32,32);cache.set(key,tile);return tile;
 }
 function render(c,m,art,actor,options={}){
  const rise=options.rise||20,zoom=1.4,viewWidth=options.viewportWidth||640,camera=options.camera||{x:256,y:options.cameraY||400,preset:0,centerX:viewWidth/2},items=[];
  const bounds=[];for(const sy of [120,240,400,700])for(const sx of [-160,viewWidth+160])bounds.push(YK_LANDSCAPE.unproject(sx,sy,camera,zoom));
  const minX=Math.max(0,Math.floor(Math.min(...bounds.map(p=>p.x))/32)-2),maxX=Math.min(m[0].length-1,Math.ceil(Math.max(...bounds.map(p=>p.x))/32)+2);
  const minY=Math.max(0,Math.floor(Math.min(...bounds.map(p=>p.y))/32)-2),maxY=Math.min(m.length-1,Math.ceil(Math.max(...bounds.map(p=>p.y))/32)+2);
  // Exact world-space vertices are projected repeatedly by ground strips,
  // cliff faces and shoreline overlays. Keep this cache within one render:
  // camera movement can never reuse coordinates from an earlier frame.
  const projectedVertices=new Map();
  const point=(x,y,h)=>{
   const key=x+','+y+','+h;
   if(projectedVertices.has(key))return projectedVertices.get(key);
   const p=YK_LANDSCAPE.project(x,y,camera,zoom);
   const projected=p&&{...p,y:p.y-h*rise*p.scale};
   projectedVertices.set(key,projected);
   return projected;
  };
  const diagnostic=window.YK_CLIFF_DEBUG===true;
  // Separate late overlay isolates missing geometry from depth overpainting.
  const xray=diagnostic&&window.YK_CLIFF_XRAY===true;
  const xrayFaces=[];
  const cliffReport=diagnostic?{camera:{x:camera.x,y:camera.y},bounds:[minX,minY,maxX,maxY],walls:[],lips:[],tiles:0}:null;
  if(diagnostic)window.YK_CLIFF_REPORT=cliffReport;
  c.save();c.beginPath();c.rect(0,0,viewWidth,544);c.clip();c.imageSmoothingEnabled=false;c.clearRect(0,0,viewWidth,544);
   // The existing horizon art is 640px wide. Repeat at native pixel scale
   // rather than stretching its mountains/clouds to fill panoramic screens.
   const horizonLeft=Math.floor((viewWidth-640)/2);
   const horizonRight=viewWidth-horizonLeft-640;
   // Mirror only the immediate outside edges at native pixel scale: unlike
   // repeating the whole sky there is no hard tile seam, and unlike stretching
   // its edge pixel there are no unnatural horizontal color bands.
   function drawHorizonBand(sy,sh){
     if(horizonLeft>0){
       c.save();c.translate(horizonLeft,0);c.scale(-1,1);
       c.drawImage(art.horizon,0,sy,horizonLeft,sh,0,sy,horizonLeft,sh);
       c.restore();
     }
     c.drawImage(art.horizon,0,sy,640,sh,horizonLeft,sy,640,sh);
     if(horizonRight>0){
       c.save();c.translate(horizonLeft+640+horizonRight,0);c.scale(-1,1);
       c.drawImage(art.horizon,640-horizonRight,sy,horizonRight,sh,0,sy,horizonRight,sh);
       c.restore();
     }
   }
   drawHorizonBand(0,240);
  // Continue the same sea texture beyond the test map, as in the main field.
  const ocean=c.createPattern(art.sea,'repeat');
  for(let sy=136;sy<544;sy+=4){
   const a=YK_LANDSCAPE.unproject(0,sy,camera,zoom),b=YK_LANDSCAPE.unproject(viewWidth,sy,camera,zoom),d=YK_LANDSCAPE.unproject(0,sy+4,camera,zoom);
   c.save();c.beginPath();c.rect(0,sy,viewWidth,4);c.clip();c.translate(0,sy);c.scale(viewWidth/(b.x-a.x),4/(d.y-a.y));c.translate(-a.x,-a.y);c.fillStyle=ocean;
   c.fillRect(a.x-4,a.y-4,b.x-a.x+8,d.y-a.y+8);c.restore();
  }
  c.save();c.beginPath();c.rect(0,136,viewWidth,408);c.clip();
  // Tile tops are sampled in short world-space strips to follow perspective and slopes.
  for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
   const center=point(tx*32+16,ty*32+16,E.level(m,tx,ty));
   if(!center)continue;
    // A projected tile can intersect the viewport even when its centre is outside.
    // Use conservative corner bounds; the canvas clip handles the final edge.
    const tileCorners=[[0,0],[32,0],[32,32],[0,32]].map(([u,v])=>point(tx*32+u,ty*32+v,E.level(m,tx,ty,u/32,v/32)));
    if(tileCorners.every(Boolean)){
     const xs=tileCorners.map(p=>p.x),ys=tileCorners.map(p=>p.y);
     if(Math.max(...xs)<-2||Math.min(...xs)>viewWidth+2||Math.max(...ys)<110||Math.min(...ys)>602)continue;
    }
   if(diagnostic)cliffReport.tiles++;
   const band=options.groundTile?(center.y<280?32:16):8;
   const kind=m[ty][tx],im=art[kind]||art.grass,road=m.roads?.has(tx+','+ty),texture=art.waterAnimated&&waterKind(kind)?im:options.groundTile?(()=>{const t=options.groundTile(tx,ty);return groundTile(t.surface,t.x/32,t.y/32);})():options.groundTexture?groundTile(options.groundTexture,tx,ty):road?art.road:im,shape=E.outline(m,tx,ty),shore=shoreGeometry(m,tx,ty,shape),shores=shore.sides,shoreShape=shore.outline;
   for(let v=0;v<32;v+=band){const py=ty*32+v;
    items.push({depth:py+band,order:0,draw:()=>{
     const p=[[0,v],[32,v],[32,v+band],[0,v+band]].map(([u,w])=>point(tx*32+u,ty*32+w,E.level(m,tx,ty,u/32,w/32)));
     if(p.every(Boolean)){
      if(shoreShape){c.save();if(!clipShore(c,shoreShape.poly,tx,ty,point,m)){c.restore();return;}}
      if(shape.cuts.length){
       const clipped=bandPolygon(shape.polygon,v,v+band).map(([u,w])=>point(tx*32+u,ty*32+w,E.level(m,tx,ty,u/32,w/32)));
       if(clipped.length<3||!clipped.every(Boolean)){if(shoreShape)c.restore();return;}
       c.save();c.beginPath();clipped.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();
      }
      const sx=tx*32%texture.width,sy=(ty*32+v)%texture.height;
      // The fast rectangular blit is valid only when BOTH projected sides are vertical.
       // Perspective shifts x across depth, especially near screen edges.
       if(Math.abs(p[0].y-p[1].y)<1e-6&&Math.abs(p[2].y-p[3].y)<1e-6&&Math.abs(p[0].x-p[3].x)<.01&&Math.abs(p[1].x-p[2].x)<.01){
       const left=Math.min(p[0].x,p[3].x),right=Math.max(p[1].x,p[2].x);
       c.drawImage(texture,sx,sy,32,band,left,p[0].y,right-left+.3,p[3].y-p[0].y+.6);
      }else quad(c,texture,sx,sy,32,band,p);
      if(shape.cuts.length)c.restore();
      if(shoreShape)c.restore();
     }
    }});
   }
   // Overlay shoreline sand on the LAND side. No water expansion, collision
   // changes or tile-specific coordinate lists. All edges use world geometry.
   if(shores.length){
    // Sand polygons are stable in world space; only projection changes.
    for(const {a,b,width,poly} of shore.sand){
     items.push({depth:ty*32+Math.max(a[1],b[1])+width,order:.25,draw:()=>{
      c.save();
      if(!clipShore(c,shoreShape.poly,tx,ty,point,m)){c.restore();return;}
      const p=poly.map(([u,v])=>point(tx*32+u,ty*32+v,E.level(m,tx,ty,u/32,v/32)));
      if(p.every(Boolean)){
       const uv=poly.map(([u,v])=>({x:tx*32+u,y:ty*32+v}));
       triangle(c,art.sand,[uv[0],uv[1],uv[2]],[p[0],p[1],p[2]]);
       triangle(c,art.sand,[uv[0],uv[2],uv[3]],[p[0],p[2],p[3]]);
      }
      c.restore();
     }});
    }
   }
   // The removed triangle exposes lower ground, not an empty cutout.
   for(const cut of shape.cuts){
    const local=[cut.corner,...cut.ends],base=art[cut.material]||im;
    items.push({depth:ty*32+Math.max(...local.map(p=>p[1])),order:0,draw:()=>{
     const p=local.map(([u,v])=>point(tx*32+u,ty*32+v,cut.lower));
     const uv=local.map(([u,v])=>({x:tx*32%base.width+u,y:ty*32%base.height+v}));
     if(p.every(Boolean))triangle(c,base,uv,p);
    }});
   }
   // Outline only actual cliff lips and land/water boundaries, never tile seams.
   // Geometry comes from the same retained top polygon as the cliff walls.
   const isWater=t=>t==='sea'||t==='river';
   for(let i=0;i<shape.polygon.length;i++){
    const a=shape.polygon[i],b=shape.polygon[(i+1)%shape.polygon.length];
    const [ax,ay]=a,[bx,by]=b;
    const side=ax===bx&&ax===0?'w':ax===bx&&ax===32?'e':ay===by&&ay===0?'n':ay===by&&ay===32?'s':null;
    const cut=side?shape.cuts.find(q=>q.ends.some(e=>e[0]===ax&&e[1]===ay)):shape.cuts.find(q=>q.ends[0][0]===ax&&q.ends[0][1]===ay&&q.ends[1][0]===bx&&q.ends[1][1]===by);
    const [dx,dy]=side?E.dirs[side]:[0,0],neighbor=m[ty+dy]?.[tx+dx];
    const h0=E.level(m,tx,ty,ax/32,ay/32),h1=E.level(m,tx,ty,bx/32,by/32);
    const n0=side?E.level(m,tx+dx,ty+dy,ax/32-dx,ay/32-dy):cut?.lower;
    const n1=side?E.level(m,tx+dx,ty+dy,bx/32-dx,by/32-dy):cut?.lower;
    const cliff=h0>(n0??h0)+.001||h1>(n1??h1)+.001;
    if(!cliff)continue;
    if(diagnostic)cliffReport.lips.push({tile:[tx,ty],edge:[ax,ay,bx,by],heights:[h0,h1],neighbor:[n0,n1]});
    // For forward-facing lips, sort at their visible raised screen position.
    // Do not promote rear-facing lips: that exposed the back walls in 16.0.154.
    const facesCamera=side==='s'||(!side&&bx<ax);
    const lift=facesCamera?Math.max(0,Math.max(h0-n0,h1-n1))*rise/zoom:0;
    const depth=ty*32+Math.max(ay,by)+lift;
    items.push({depth,order:1.5,draw:()=>{
     const p0=point(tx*32+ax,ty*32+ay,h0),p1=point(tx*32+bx,ty*32+by,h1);
     if(!p0||!p1)return;
     c.save();c.lineCap='butt';c.lineJoin='bevel';
     c.strokeStyle='rgba(19,22,18,.84)';
     c.lineWidth=Math.max(1,Math.min(2.4,(p0.scale+p1.scale)*.7));
     // Stable hand-drawn wobble: endpoints stay on the exact terrain seam.
     // Sample the same world coordinates across adjacent tiles, not per frame.
     const vx=p1.x-p0.x,vy=p1.y-p0.y,length=Math.hypot(vx,vy);
     const nx=length?-vy/length:0,ny=length?vx/length:0;
     const wx=tx*32+ax,wy=ty*32+ay,ex=tx*32+bx,ey=ty*32+by;
     const wobble=(t)=>{
      const x=wx+(ex-wx)*t,y=wy+(ey-wy)*t;
      const seed=Math.sin(x*12.9898+y*78.233)*43758.5453;
      return (seed-Math.floor(seed)-.5)*5.2;
     };
     // Cliff lips use only the elevation outline. Waterline belongs
     // exclusively to the shared shoreline polygon below.
     c.beginPath();c.moveTo(p0.x,p0.y);
     for(let step=1;step<7;step++){
      const t=step/7,offset=wobble(t)*Math.sin(Math.PI*t);
      c.lineTo(p0.x+vx*t+nx*offset,p0.y+vy*t+ny*offset);
     }
     c.lineTo(p1.x,p1.y);
     c.stroke();c.restore();
    }});
   }
   // Generate axis-aligned and diagonal walls from the SAME top polygon.
   for(let i=0;i<shape.polygon.length;i++){
    const ends=[shape.polygon[i],shape.polygon[(i+1)%shape.polygon.length]],[[ax,ay],[bx,by]]=ends;
    const side=ax===bx&&ax===0?'w':ax===bx&&ax===32?'e':ay===by&&ay===0?'n':ay===by&&ay===32?'s':null;
    const cut=side?null:shape.cuts.find(c=>c.ends[0][0]===ax&&c.ends[0][1]===ay&&c.ends[1][0]===bx&&c.ends[1][1]===by);
    if(!side&&!cut)continue;
    // Do not cull a wall independently of its cliff lip. The former
    // world-space backface test discarded valid faces at every elevation.
    // Depth sorting and terrain occlusion determine visible portions.
    const [dx,dy]=side?E.dirs[side]:[0,0],top=ends.map(([u,v])=>E.level(m,tx,ty,u/32,v/32));
    const bottom=ends.map(([u,v],j)=>Math.min(top[j],cut?cut.lower:E.level(m,tx+dx,ty+dy,u/32-dx,v/32-dy)));
    if(top.every((h,j)=>h-bottom[j]<1e-6))continue;
    const coords=ends.map(([u,v])=>[tx*32+u,ty*32+v]),segments=Math.max(1,Math.ceil(Math.abs(by-ay)/8));
    for(let segment=0;segment<segments;segment++){
     const t0=segment/segments,t1=(segment+1)/segments,mix=(a,t)=>a[0]+(a[1]-a[0])*t;
     const span=[t0,t1].map(t=>[mix(coords.map(p=>p[0]),t),mix(coords.map(p=>p[1]),t)]);
     const high=[mix(top,t0),mix(top,t1)],low=[mix(bottom,t0),mix(bottom,t1)];
     if(diagnostic)cliffReport.walls.push({tile:[tx,ty],edge:[ax,ay,bx,by],segment,segments,high,low,depth:Math.max(...span.map(p=>p[1])),side:side||'diagonal'});
     // A forward-facing wall occupies screen space BELOW its elevated top.
     // Account for that projected span in the ordinary depth sort, rather
     // than drawing every cliff after all terrain (the 16.0.154 regression).
     const facesCamera=side==='s'||(!side&&bx<ax);
     const lift=facesCamera?Math.max(...high.map((h,j)=>h-low[j]))*rise/zoom:0;
     items.push({depth:facesCamera?Math.max(...span.map(p=>p[1]))+lift:ty*32-.01,order:facesCamera?1:-1,draw:()=>{
      const bands=Math.max(1,Math.ceil(Math.max(...high.map((h,j)=>h-low[j]))));
      for(let b=0;b<bands;b++){
       const hi=high.map((h,j)=>h+(low[j]-h)*b/bands),lo=high.map((h,j)=>h+(low[j]-h)*(b+1)/bands);
       const p=[point(...span[0],hi[0]),point(...span[1],hi[1]),point(...span[1],lo[1]),point(...span[0],lo[0])];
       const material=m.cliffMaterials?.[ty]?.[tx]||options.cliffMaterial||'grassCliff';
       const face=art[material]||art.grassCliff||art.rock;
       if(p.every(Boolean)){
        if(xray)xrayFaces.push({p,side:side||'diagonal',tile:[tx,ty]});
        quad(c,face,(tx*32)%face.width,(ty*32)%face.height,32,32,p,side==='w'?.12:side==='e'?.35:cut?.28:.22);
        if(diagnostic){c.save();c.fillStyle='rgba(255,0,180,.32)';c.strokeStyle='#ff00ff';c.lineWidth=1.5;c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();c.stroke();c.restore();}
       }
      }
     }});
    }
   }
  }
  // Stroke the SAME polygon used to clip land and sand, instead of the old
  // independent square-edge coastline. No dark outline on the inland sand edge.
  for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
   const shape=E.outline(m,tx,ty);
   if(shape.cuts.length)continue;
   const shore=shoreGeometry(m,tx,ty,shape),edges=shore.darkEdges;
   if(!edges.length)continue;
   items.push({depth:ty*32+32,order:.5,draw:()=>{
    c.save();c.strokeStyle='rgba(27,36,29,.76)';
    const p0=point(tx*32+16,ty*32+16,E.level(m,tx,ty));
    c.lineWidth=Math.max(1,(p0?.scale||1)*.6);
    c.lineJoin='round';c.lineCap='round';c.beginPath();
    for(const [a,b] of edges){
     const p=point(tx*32+a[0],ty*32+a[1],E.level(m,tx,ty,a[0]/32,a[1]/32));
     const q=point(tx*32+b[0],ty*32+b[1],E.level(m,tx,ty,b[0]/32,b[1]/32));
     if(p&&q){c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);}
    }
    c.stroke();c.restore();
   }});
  }
  // Illustrated ladders lie on the front-facing cliff surface.
  for(const l of m.ladders||[]){
   const [tx,ty]=l.lower,[ux,uy]=l.upper;
   items.push({depth:ty*32+20,order:2.5,draw:()=>{
    if(!art.ladder)return;
    const top=point(ux*32+16,(uy+1)*32,E.level(m,ux,uy));
    const bottom=point(tx*32+16,ty*32,E.level(m,tx,ty));
    if(!top||!bottom)return;
    const height=Math.max(18,Math.abs(bottom.y-top.y)+12*bottom.scale),width=19*bottom.scale;
    c.drawImage(art.ladder,top.x-width/2,top.y-5*top.scale,width,height);
   }});
  }
  for(const o of options.objects||m.objects||[]){
   const foot=o.foot??o.y,center=o.foot===undefined?o.x:o.x+o.width/2;
   items.push({depth:foot,order:2,draw:()=>{const p=point(center,foot,o.supportHeight??E.height(m,center,foot));if(!p||p.x+o.width*p.scale/2<0||p.x-o.width*p.scale/2>viewWidth)return;
    c.globalAlpha=Math.min(1,Math.max(0,(p.y-136)/70));
    if(o.render)o.render(c,p);else if(art[o.kind])c.drawImage(art[o.kind],p.x-o.width*p.scale/2,p.y-o.height*p.scale,o.width*p.scale,o.height*p.scale);c.globalAlpha=1;
   }});
  }
  // The actor's feet must be composited after the entire ground cell under them.
   // Sorting at the exact foot y interleaved the sprite with 16px terrain strips,
   // making the boots/body flicker as the camera moved vertically.
   if(actor)items.push({depth:actor.y+32,order:3,draw:()=>{
   const p=point(actor.x,actor.y,actor.height??E.height(m,actor.x,actor.y));if(!p)return;
   if(actor.draw){actor.draw(p.x,p.y,p.scale);return;}
   const row={d:0,u:1,r:2,l:3}[actor.dir||'d'],col=row>=2?Math.min(1,actor.frame||0):actor.frame||0;
   // Approved 32px field atlas, one shared projection/foot anchor.
   c.fillStyle='rgba(0,0,0,.24)';c.beginPath();c.ellipse(p.x,p.y,9*p.scale,3*p.scale,0,0,Math.PI*2);c.fill();
   c.drawImage(art.hero,col*32,row*32,32,32,p.x-heroAnchorX*p.scale,p.y-heroAnchorY*p.scale,32*p.scale,32*p.scale);
  }});
  items.sort((a,b)=>a.depth-b.depth||a.order-b.order);for(const item of items)item.draw();
  // Diagnostic only: draw projected face polygons AFTER all depth sorting.
  // If the cyan shape appears where the normal wall is absent, the face
  // exists and has been overpainted. No production ordering is changed.
  if(xray){
   c.save();c.lineWidth=1.5;c.strokeStyle='#00ffff';c.fillStyle='rgba(0,255,255,.14)';
   for(const {p} of xrayFaces){
    c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();c.stroke();
   }
   c.restore();
   cliffReport.xrayFaces=xrayFaces.length;
  }
  c.restore();
  for(let y=136;y<208;y+=4){const t=(y-136)/72;c.globalAlpha=1-t*t*(3-2*t);drawHorizonBand(y,4);}c.globalAlpha=1;
  if(options.grid){for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
   for(const cut of E.outline(m,tx,ty).cuts){
    const blocked=[cut.corner,...cut.ends].map(([u,v])=>point(tx*32+u,ty*32+v,cut.lower));if(!blocked.every(Boolean))continue;
    c.fillStyle='rgba(255,77,77,.65)';c.beginPath();blocked.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();
   }
   const p=E.outline(m,tx,ty).polygon.map(([u,v])=>point(tx*32+u,ty*32+v,E.level(m,tx,ty,u/32,v/32)));if(!p.every(Boolean))continue;
   c.strokeStyle='rgba(255,255,255,.25)';c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.stroke();
  }}c.restore();return {point};
 }
 return {load,render,sources};
})();


