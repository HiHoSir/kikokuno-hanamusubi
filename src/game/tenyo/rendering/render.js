((root,f)=>{const api=f(typeof module==='object'&&module.exports?require('./catalog.js'):root.SMCatalog,typeof module==='object'&&module.exports?require('./model.js'):root.SMModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.SMRender=api;})(globalThis,(C,M)=>{
'use strict';const rows={d:0,u:1,r:2,l:3};
function actorBounds(image,createCanvas){if(image.width===240&&image.height===448){const village={};for(const d of Object.keys(rows))village[d]={village:true};return village;}const cv=createCanvas(96,128),c=cv.getContext('2d');c.drawImage(image,0,0);const p=c.getImageData(0,0,96,128).data,out={};for(const [d,row]of Object.entries(rows)){let left=32,top=32,right=-1,bottom=-1;for(let f=0;f<3;f++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(p[((row*32+y)*96+f*32+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}if(right<left)throw Error('緋月のフレームが空です');out[d]={left,top,width:right-left+1,height:bottom-top+1};}return out;}
function actor(c,s,image,bounds,tile=32,drawSprite=null,displayScale=1){const b=bounds[s.dir];if(b.village){const scale=tile/32*displayScale;(drawSprite||((ctx,...args)=>ctx.drawImage(...args)))(c,image,(s.frame||0)*80,rows[s.dir]*112,80,112,(s.x+.5)*tile-40*scale,(s.y+.5)*tile-106*scale,80*scale,112*scale);return;}const scale=Math.min(28/b.width,28/b.height)*tile/32;(drawSprite||((ctx,...args)=>ctx.drawImage(...args)))(c,image,(s.frame||0)*32,rows[s.dir]*32,32,32,(s.x+.5)*tile-(b.left+b.width/2)*scale,(s.y+.5)*tile-(b.top+b.height/2)*scale,32*scale,32*scale);}
function actorDepth(s,bounds,tile){const b=bounds[s.dir];if(b.village)return (s.y+.5)*tile;const scale=Math.min(28/b.width,28/b.height)*tile/32;return (s.y+.5)*tile+b.height*scale/2;}
function actorShadow(c,s,bounds,tile,strength=.28,displayScale=1){c.save();c.globalAlpha=strength;c.fillStyle='#101820';c.beginPath();c.ellipse((s.x+.5)*tile,actorDepth(s,bounds,tile),11.2*tile/32*displayScale,3.36*tile/32*displayScale,0,0,Math.PI*2);c.fill();c.restore();}
function depthQueue(m,actorState,bounds){const q=m.objects.filter(v=>C.byId[v.templateId].layer==='object').map(v=>({object:v,depth:(v.y+(C.byId[v.templateId].character?.5:C.byId[v.templateId].wallSign?2:1))*m.tileSize}));if(actorState&&bounds)q.push({actor:actorState,depth:actorDepth(actorState,bounds,m.tileSize)});return q.sort((a,b)=>a.depth-b.depth||Number(!!C.byId[a.object?.templateId]?.wallSign)-Number(!!C.byId[b.object?.templateId]?.wallSign)||Number(!!C.byId[b.object?.templateId]?.supportSurface)-Number(!!C.byId[a.object?.templateId]?.supportSurface));}
function phase(o,t){return o.forExport?0:Number.isInteger(o.animationFrame)?((o.animationFrame%2)+2)%2:Math.floor((o.animationTime||0)/(t.animation?.frameMs||360))%(t.animation?.frames||2)}
function drawWater(c,m,o={}){const frames=M.autotileLayout(m);for(const v of m.objects.filter(v=>C.byId[v.templateId].water||C.byId[v.templateId].bridgePassages).sort((a,b)=>Number(!!C.byId[a.templateId].bridgePassages)-Number(!!C.byId[b.templateId].bridgePassages))){const t=C.byId[v.templateId],im=o.images?.[v.templateId];if(!im)continue;const index=frames.get(v.id),r=M.visualRect(m,v),source=t.autotile?[index%8*32,Math.floor(index/8)*32+(t.animation?phase(o,t)*t.animation.frameHeight:0),32,32]:t.sourceRect;c.drawImage(im,...source,r.x,r.y,r.width,r.height)}}
const clearCache=new WeakMap(),horizonFadeCache=new WeakMap(),reflectionCache=new WeakMap(),characterBoundsCache=new WeakMap(),atmosphereCache=new Map(),focusBuffers=new Map();
function characterBounds(im){let b=characterBoundsCache.get(im);if(!b){b=actorBounds(im,(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;});characterBoundsCache.set(im,b);}return b;}
const waterKinds=['shallow','mid','deep'];
const waterOrder={shallow:0,mid:1,deep:2};
function waterTile(images,cell,neighbours,frame){
 const atlas=waterKinds.map(kind=>images['clear_water_'+kind]);
 if(atlas.some(image=>!image))return null;
 let cache=clearCache.get(images);
 if(!cache){cache={tiles:new Map(),frames:[]};clearCache.set(images,cache);}
 const uniform=neighbours.every(other=>other.depth===cell.depth&&other.opacity===cell.opacity);
 const key=uniform?[frame,cell.depth,cell.opacity].join(':'):
   [frame,cell.x,cell.y,...neighbours.flatMap(other=>[other.depth,other.opacity])].join(':');
 if(cache.tiles.has(key))return cache.tiles.get(key);
 const surface=document.createElement('canvas');
 surface.width=32;surface.height=32;
 const ctx=surface.getContext('2d',{willReadFrequently:true});
 if(!cache.frames[frame])cache.frames[frame]=atlas.map(image=>{
   ctx.clearRect(0,0,32,32);
   ctx.drawImage(image,0,frame*32,32,32,0,0,32,32);
   return ctx.getImageData(0,0,32,32).data;
 });
 const samples=cache.frames[frame],result=ctx.createImageData(32,32);
 // Bend the depth contours in world coordinates so the curves cross tile seams.
 const worldX=cell.x*32,worldY=cell.y*32;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   let depth=cell.depth,opacity=cell.opacity;
   if(!uniform){
     const px=worldX+x+.5,py=worldY+y+.5;
     const gx=(x+.5+8*Math.sin((py+px*.4)/43)+4*Math.sin((py-px*.35)/17))/32-.5;
     const gy=(y+.5+7*Math.sin((px+py*.35)/37)+4*Math.sin((px-py*.3)/16))/32-.5;
     const ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy,index=(iy+1)*3+ix+1;
     const a=neighbours[index],b=neighbours[index+1],c=neighbours[index+3],d=neighbours[index+4];
     const aWeight=(1-u)*(1-v),bWeight=u*(1-v),cWeight=(1-u)*v,dWeight=u*v;
     depth=a.depth*aWeight+b.depth*bWeight+c.depth*cWeight+d.depth*dWeight;
     opacity=a.opacity*aWeight+b.opacity*bWeight+c.opacity*cWeight+d.opacity*dWeight;
   }
   const low=Math.min(2,Math.floor(depth)),high=Math.min(2,low+1),mix=depth-low;
   const i=(y*32+x)*4;
   for(let channel=0;channel<3;channel++){
     result.data[i+channel]=samples[low][i+channel]*(1-mix)+samples[high][i+channel]*mix;
   }
   result.data[i+3]=(samples[low][i+3]*(1-mix)+samples[high][i+3]*mix)*opacity;
 }
 ctx.putImageData(result,0,0);
 if(cache.tiles.size>=2048)cache.tiles.clear();
 cache.tiles.set(key,surface);
 return surface;
}
function draw(c,m,o={}){const images=o.images||{},tile=m.tileSize,objects=o.groundOnly?m.objects.filter(v=>C.byId[v.templateId].layer==='ground'):m.objects,sun=objects.find(v=>v.templateId==='sanctuary_horizon_v1');if(o.forExport){if(m.background&&!o.backgroundImage)throw Error('背景画像が未読込です');for(const v of objects)if(!images[v.templateId])throw Error('素材画像が未読込です');}
c.imageSmoothingEnabled=false;c.clearRect(0,0,m.width*tile,m.height*tile);
if(o.backgroundImage)c.drawImage(o.backgroundImage,0,0);
// Additional water-specific layers preserve the pre-existing object catalog.
const waterFrame=o.forExport?0:Math.floor((o.animationTime||0)/360)%4;
const auto=typeof module==='object'&&module.exports?require('./autotile.js'):globalThis.SMAutotile;
const bottomSets=new Map();for(const v of m.waterBottom||[]){if(!bottomSets.has(v.tileId))bottomSets.set(v.tileId,new Set());bottomSets.get(v.tileId).add(v.x+','+v.y);}
function layerTiles(entries,mode){for(const v of entries||[]){const id=mode==='bottom'?v.tileId:'clear_water_'+v.depth;const t=C.byId[id],im=images[id];if(!t||!im)continue;const x=v.x*tile,y=v.y*tile;let sr=t.sourceRect;if(t.autotile){const mask=auto.maskAt(bottomSets.get(id)||new Set(),v.x,v.y),index=auto.indices[mask];sr=[index%8*32,Math.floor(index/8)*32,32,32];}else if(t.animation){sr=[0,waterFrame*t.animation.frameHeight,32,32];}c.save();if(mode==='surface')c.globalAlpha=v.opacity??.65;c.drawImage(im,...sr,x,y,tile,tile);c.restore();}}
const waterCells=new Map((m.waterSurface||[]).map(v=>[v.x+','+v.y,v]));
const surfaceTiles=new Map();
function surfaceTile(v){
 if(surfaceTiles.has(v))return surfaceTiles.get(v);
 const opacity=v.opacity??.65,depth=waterOrder[v.depth];
 if(opacity<=0||depth===undefined)return null;
 const cell={x:v.x,y:v.y,depth,opacity},neighbours=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const other=waterCells.get((v.x+dx)+','+(v.y+dy));
   const otherDepth=waterOrder[other?.depth];
   neighbours.push(otherDepth===undefined?cell:{depth:otherDepth,opacity:other.opacity??.65});
 }
 const surface=waterTile(images,cell,neighbours,waterFrame);
 surfaceTiles.set(v,surface);
 return surface;
}
// Water blends only with the opaque pixels of the submerged part of each sprite.
function sprite(im,source,r,waterline,height,onlyShallow=false){if(!height||!waterCells.size){c.drawImage(im,...source,r.x,r.y,r.width,r.height);return;}
const cv=document.createElement('canvas');cv.width=Math.ceil(r.width);cv.height=Math.ceil(r.height);const sc=cv.getContext('2d');sc.imageSmoothingEnabled=false;sc.drawImage(im,...source,0,0,r.width,r.height);sc.save();sc.beginPath();sc.rect(0,waterline-height-r.y,r.width,height);sc.clip();sc.globalCompositeOperation='source-atop';
for(let y=Math.floor((waterline-height)/tile);y<Math.ceil(waterline/tile);y++)for(let x=Math.floor(r.x/tile);x<Math.ceil((r.x+r.width)/tile);x++){const cell=waterCells.get(x+','+y);if(!cell||onlyShallow&&cell.depth!=='shallow')continue;const surface=surfaceTile(cell);if(!surface)continue;sc.globalAlpha=onlyShallow ? .78 : .55;sc.drawImage(surface,0,0,32,32,x*tile-r.x,y*tile-r.y,tile,tile);}sc.restore();c.drawImage(cv,r.x,r.y);}
const frames=M.autotileLayout(m),object=v=>{const im=images[v.templateId],t=C.byId[v.templateId],r=M.visualRect(m,v),index=frames.get(v.id),source=t.autotile?[index%8*32,Math.floor(index/8)*32+(t.animation?phase(o,t)*t.animation.frameHeight:0),32,32]:t.animation?.frameWidth?[t.sourceRect[0]+phase(o,t)*t.animation.frameWidth,...t.sourceRect.slice(1)]:t.sourceRect;if(!im)return;
if(t.character){const state={x:v.x,y:v.y,dir:v.dir||'d',frame:v.frame||0},bounds=characterBounds(im);if(o.shadows)actorShadow(c,state,bounds,tile,sun ? .38 : .28);actor(c,state,im,bounds,tile,(ctx,img,sx,sy,sw,sh,x,y,width,height)=>sprite(img,[sx,sy,sw,sh],{x,y,width,height},actorDepth(state,bounds,tile),7*tile/32,true));return;}
// Elevated objects stand on their support rather than in the water below it.
if(t.fadeHorizon){let cache=horizonFadeCache.get(im);if(!cache){cache=new Map();horizonFadeCache.set(im,cache);}const key=r.width+','+r.height+','+source.join(',');let cv=cache.get(key);if(!cv){cv=document.createElement('canvas');cv.width=Math.ceil(r.width);cv.height=Math.ceil(r.height);const sc=cv.getContext('2d');sc.imageSmoothingEnabled=false;sc.drawImage(im,...source,0,0,r.width,r.height);sc.globalCompositeOperation='destination-out';const radius=r.width*.19,g=sc.createRadialGradient(r.width/2,-r.height*.025,0,r.width/2,-r.height*.025,radius);g.addColorStop(0,'rgba(0,0,0,.95)');g.addColorStop(.52,'rgba(0,0,0,.75)');g.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=g;sc.fillRect(0,0,r.width,r.height);sc.globalCompositeOperation='source-over';
if(cache.size>=8)cache.clear();cache.set(key,cv);}c.drawImage(cv,r.x,r.y);return;}
const elevated=r.y+r.height<(v.y+1)*tile-.01,depth=t.layer==='object'&&!t.bridgePassages&&!elevated?(t.submergedHeight??8)*tile/32:0;sprite(im,source,r,r.y+r.height,depth);
// Animate only the interior water; cliff lip and splash retain their original position.
if(t.flowRegion&&!o.forExport){const step=phase(o,t);if(step){const [sx,sy,sw,sh]=t.flowRegion,scaleX=r.width/source[2],scaleY=r.height/source[3],x=r.x+sx*scaleX,y=r.y+sy*scaleY,w=sw*scaleX,h=sh*scaleY,dy=step*3*scaleY;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(im,sx,sy,sw,sh,x,y+dy,w,h);c.drawImage(im,sx,sy,sw,sh,x,y+dy-h,w,h);c.restore();}}};
const groundOrder=v=>{const t=C.byId[v.templateId];return t.bridgePassages?3:t.paintGroup==='base'?0:t.shallow?1:t.autotile?1:2;};
for(const v of objects.filter(v=>C.byId[v.templateId].layer==='ground').sort((a,b)=>groundOrder(a)-groundOrder(b)))object(v);
layerTiles(m.waterBottom,'bottom');
// The surface image carries interpolated depth and opacity for both the lake and submerged sprites.
for(const v of m.waterSurface||[]){
 const im=surfaceTile(v);
 if(im)c.drawImage(im,0,0,32,32,v.x*tile,v.y*tile,tile,tile);
}
if(sun&&o.lighting!==false&&waterCells.size){const r=M.visualRect(m,sun),cx=r.x+r.width/2,cy=r.y+r.height*.38,s=tile/32,frame=o.forExport?0:waterFrame;c.save();c.beginPath();for(const v of m.waterSurface||[])if((v.opacity??.65)>0)c.rect(v.x*tile,v.y*tile,tile,tile);c.clip();
// Sparse sunset glints supplement, rather than replace, object reflections.
for(let i=0;i<90;i++){const h=n=>{const z=Math.sin(n*127.1+41.7)*43758.5453;return z-Math.floor(z);},p=h(i*3+1),q=h(i*3+2),y=cy+10*s+p*(m.height*tile*.7-cy),distance=(y-cy)/(m.height*tile-cy),spread=(10+48*distance)*s,x=cx+(q-.5)*2*spread+(frame%2?1:-1)*s,alpha=(.075*(1-distance)+.01)*(.4+.6*h(i*3+3));c.fillStyle='rgba(255,204,124,'+alpha+')';c.fillRect(Math.round(x),Math.round(y),Math.max(1,(2+4*h(i*5+3))*s),Math.max(1,s));}c.restore();}
if(sun&&o.reflections!==false&&waterCells.size){
// Reflected sprites are clipped to water and drawn before the actual objects.
c.save();c.beginPath();for(const v of m.waterSurface||[])if((v.opacity??.65)>0)c.rect(v.x*tile,v.y*tile,tile,tile);c.clip();
function reflect(im,src,r,foot){const top=2*foot-r.y-r.height;if(top>=m.height*tile||top+r.height<=0)return;let cache=reflectionCache.get(im);if(!cache){cache=new Map();reflectionCache.set(im,cache);}const key=r.width+','+r.height+','+src.join(',');let cv=cache.get(key);if(!cv){cv=document.createElement('canvas');cv.width=Math.ceil(r.width);cv.height=Math.ceil(r.height);const sc=cv.getContext('2d');sc.imageSmoothingEnabled=false;sc.translate(0,r.height);sc.scale(1,-1);sc.drawImage(im,...src,0,0,r.width,r.height);sc.setTransform(1,0,0,1,0,0);sc.globalCompositeOperation='destination-in';const g=sc.createLinearGradient(0,0,0,r.height);g.addColorStop(0,'rgba(0,0,0,.23)');g.addColorStop(.55,'rgba(0,0,0,.10)');g.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=g;sc.fillRect(0,0,r.width,r.height);if(cache.size>=32)cache.clear();cache.set(key,cv);}c.drawImage(cv,r.x,top);}
for(const v of objects){const t=C.byId[v.templateId],im=images[v.templateId];if(!im||t.layer!=='object'||t.autotile||t.id==='sanctuary_horizon_v1'||t.id.startsWith('sanctuary_forest_frame_'))continue;if(t.character){const state={x:v.x,y:v.y,dir:v.dir||'d',frame:v.frame||0},bounds=characterBounds(im);actor(c,state,im,bounds,tile,(ctx,img,sx,sy,sw,sh,x,y,width,height)=>reflect(img,[sx,sy,sw,sh],{x,y,width,height},actorDepth(state,bounds,tile)));continue;}const r=M.visualRect(m,v);reflect(im,t.sourceRect,r,Math.max(r.y+r.height,(v.y+1)*tile));}
if(!o.forExport&&o.hero&&o.actor&&o.bounds)actor(c,o.actor,o.hero,o.bounds,tile,(ctx,im,sx,sy,sw,sh,x,y,width,height)=>reflect(im,[sx,sy,sw,sh],{x,y,width,height},actorDepth(o.actor,o.bounds,tile)));
c.restore();}
if(!o.groundOnly)for(const item of depthQueue(m,!o.forExport&&o.hero?o.actor:null,o.bounds)){if(item.object)object(item.object);else{if(o.shadows)actorShadow(c,item.actor,o.bounds,tile,sun ? .38 : .28,o.heroDisplayScale??1);actor(c,item.actor,o.hero,o.bounds,tile,(ctx,im,sx,sy,sw,sh,x,y,width,height)=>sprite(im,[sx,sy,sw,sh],{x,y,width,height},actorDepth(item.actor,o.bounds,tile),7*tile/32,true),o.heroDisplayScale??1);}}
if(!o.forExport&&images.tenyo_ripple_fx){const legacy=m.objects.filter(v=>v.templateId==='tenyo_shallows'),shallow=s=>waterCells.get(Math.round(s.x)+','+Math.round(s.y))?.depth==='shallow'||legacy.some(v=>v.x===Math.round(s.x)&&v.y===Math.round(s.y)),frame=(offset)=>Math.floor(((o.animationTime||0)+offset)/180)%4;c.save();c.beginPath();for(const v of m.waterSurface||[])if((v.opacity??.65)>0)c.rect(v.x*tile,v.y*tile,tile,tile);for(const v of legacy)c.rect(v.x*tile,v.y*tile,tile,tile);c.clip();
if(sun)for(const [i,p]of [[.29,.29],[.70,.34],[.30,.56],[.70,.63],[.41,.78]].entries()){const x=Math.floor(m.width*p[0]),y=Math.floor(m.height*p[1]);if(!waterCells.has(x+','+y))continue;c.globalAlpha=.45;c.drawImage(images.tenyo_ripple_fx,0,frame(i*120)*32,32,32,x*tile,y*tile,tile,tile);}
for(const [i,v]of m.objects.filter(v=>v.templateId==='sanctuary_fall_v2').entries()){const r=M.visualRect(m,v);c.globalAlpha=.6;c.drawImage(images.tenyo_ripple_fx,0,frame(i*180)*32,32,32,r.x+r.width/2-tile/2,r.y+r.height-tile*.7,tile,tile);}
const actors=[...(o.actor&&o.hero?[o.actor]:[]),...m.objects.filter(v=>C.byId[v.templateId].character)];for(const [i,s]of actors.entries())if(shallow(s)){c.globalAlpha=.8;c.drawImage(images.tenyo_ripple_fx,0,frame(i*90)*32,32,32,s.x*tile,(s.y+.45)*tile,tile,tile);}c.restore();}
if(sun&&o.lighting!==false){const r=M.visualRect(m,sun),cx=r.x+r.width/2,cy=r.y+r.height*.38,radius=Math.max(m.width,m.height)*tile*.8;c.save();c.globalCompositeOperation='source-atop';const g=c.createRadialGradient(cx,cy,0,cx,cy,radius);g.addColorStop(0,'rgba(255,190,110,.17)');g.addColorStop(.4,'rgba(255,193,123,.075)');g.addColorStop(1,'rgba(255,198,140,0)');c.fillStyle=g;c.fillRect(0,0,m.width*tile,m.height*tile);c.restore();}
// A soft scene-wide air and light layer is composited over both scenery and actors.
if(sun&&o.atmosphere!==false){const r=M.visualRect(m,sun),w=m.width*tile,h=m.height*tile,cx=r.x+r.width/2,cy=r.y+r.height*.38,key=[w,h,cx,cy].join(',');let cv=atmosphereCache.get(key);if(!cv){cv=document.createElement('canvas');cv.width=w;cv.height=h;const ac=cv.getContext('2d'),fog=ac.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.9);fog.addColorStop(0,'rgba(255,218,174,.20)');fog.addColorStop(.42,'rgba(255,228,198,.085)');fog.addColorStop(1,'rgba(211,229,226,.018)');ac.fillStyle=fog;ac.fillRect(0,0,w,h);for(const [offset,angle,width,opacity]of [[-.13,-.24,.075,.12],[.03,-.16,.06,.10],[.19,-.20,.09,.08]]){ac.save();ac.translate(cx+offset*w,cy+h*.36);ac.rotate(angle);ac.scale(w*width,h*.50);const beam=ac.createRadialGradient(0,0,0,0,0,1);beam.addColorStop(0,'rgba(255,233,195,'+opacity+')');beam.addColorStop(1,'rgba(255,233,195,0)');ac.fillStyle=beam;ac.fillRect(-1,-1,2,2);ac.restore();}if(atmosphereCache.size>=2)atmosphereCache.clear();atmosphereCache.set(key,cv);}c.save();c.globalCompositeOperation='source-atop';c.drawImage(cv,0,0);c.restore();}
if(sun&&o.objectShading!==false){const h=m.height*tile;c.save();c.globalCompositeOperation='source-atop';const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(10,22,35,0)');g.addColorStop(.36,'rgba(10,22,35,.045)');g.addColorStop(.72,'rgba(10,22,35,.21)');g.addColorStop(1,'rgba(10,22,35,.42)');c.fillStyle=g;c.fillRect(0,0,m.width*tile,h);c.restore();}
// A moving focal region follows Hizuki; a cached low-resolution copy softens only distant rows.
if(sun&&o.depthOfField!==false){const w=m.width*tile,h=m.height*tile,key=w+','+h;let pair=focusBuffers.get(key);if(!pair){const small=document.createElement('canvas'),blur=document.createElement('canvas');small.width=Math.max(1,Math.ceil(w/3));small.height=Math.max(1,Math.ceil(h/3));blur.width=w;blur.height=h;pair={small,blur};if(focusBuffers.size>=2)focusBuffers.clear();focusBuffers.set(key,pair);}const sc=pair.small.getContext('2d'),bc=pair.blur.getContext('2d');sc.clearRect(0,0,pair.small.width,pair.small.height);sc.imageSmoothingEnabled=true;sc.drawImage(c.canvas,0,0,pair.small.width,pair.small.height);bc.clearRect(0,0,w,h);bc.imageSmoothingEnabled=true;bc.globalCompositeOperation='source-over';bc.drawImage(pair.small,0,0,w,h);bc.globalCompositeOperation='destination-in';const active=o.hero&&o.actor&&o.bounds,fx=active?(o.actor.x+.5)*tile:w/2,fy=active?actorDepth(o.actor,o.bounds,tile):h*.54,sharp=tile*1.8,falloff=tile*5;bc.save();bc.translate(fx,fy);bc.scale(1.6,1);const g=bc.createRadialGradient(0,0,sharp,0,0,sharp+falloff);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.72)');bc.fillStyle=g;bc.fillRect(-fx/1.6,-fy,w/1.6,h);bc.restore();c.save();c.globalCompositeOperation='source-atop';c.drawImage(pair.blur,0,0);c.restore();}
if(o.forExport)return;
if(o.collision){const b=M.collision(m);for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const k=x+','+y;c.fillStyle=b.has(k)?'#ef4e5277':o.reachable?.has(k)?'#30e88444':'#f3b52c22';c.fillRect(x*tile,y*tile,tile,tile);}}
if(o.grid){c.strokeStyle='#ffffff90';c.lineWidth=.7;for(let x=0;x<=m.width;x++){c.beginPath();c.moveTo(x*tile+.5,0);c.lineTo(x*tile+.5,m.height*tile);c.stroke();}for(let y=0;y<=m.height;y++){c.beginPath();c.moveTo(0,y*tile+.5);c.lineTo(m.width*tile,y*tile+.5);c.stroke();}}
if(o.markers){c.font=Math.max(8,tile*.31)+'px sans-serif';c.textAlign='center';for(const e of m.entrances){c.fillStyle='#ffc250';c.fillRect((e.marker[0]+.375)*tile,(e.marker[1]+.375)*tile,tile*.25,tile*.25);c.strokeStyle='#ffe3a0';c.strokeRect(e.approach[0]*tile+2,e.approach[1]*tile+2,tile-4,tile-4);c.fillText('入口',(e.approach[0]+.5)*tile,(e.approach[1]+.625)*tile);}c.fillStyle='#b4edff';c.fillText('始',(m.spawn[0]+.5)*tile,(m.spawn[1]+.625)*tile);}
if(o.selection){const v=m.objects.find(v=>v.id===o.selection);if(v){const r=M.visualRect(m,v);c.strokeStyle='#fff0a6';c.lineWidth=2;c.strokeRect(r.x,r.y,r.width,r.height);c.fillStyle='#fff0a6';c.fillRect(v.x*tile,(v.y+1)*tile-2,C.byId[v.templateId].displayCells[0]*tile,2);}}
}
return {draw,drawWater,actorBounds,actor,actorDepth,depthQueue};
});

