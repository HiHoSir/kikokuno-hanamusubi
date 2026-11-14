// Original terrain art. Display sizes are independent of the 32px movement grid.
window.YK_LANDSCAPE=(()=>{
 const specs={waterMotion:[128,64],waterfallMotion:[160,96],newVillage:[64,32],newHouse:[32,32],newTorii:[32,32],newCaveLarge:[64,32],newFort:[64,32],newPagoda:[32,64],newTrees:[32,32],newMountainSmall:[32,32],newMountainLarge:[128,64],bridgeNS:[48,96],castle:[64,64],sacredTree:[64,64],stoneMonument:[32,32],waterfall:[80,96],horizon:[640,240],grass:[256,256],grassCliff:[32,32],ladder:[32,96],water:[64,64],snow:[64,64],barren:[64,64],sand:[64,64],shrine:[64,64],lantern:[24,40],bridge:[96,40],flowers:[40,24],wildflowers:[128,128],road:[64,64],village:[112,80],town:[144,104],hermit:[72,72],jizo:[32,32],cave:[80,64],torii:[64,64]},art={},errors={},decoded={};
 const placeKeys=['village','town','hermit','jizo','cave','torii'];
 const oldKeys=['water','snow','barren','sand'];
 const keys=Object.keys(specs),water=t=>t==='sea'||t==='river';let started=false;
 function ready(){return keys.every(k=>decoded[k]&&art[k]?.complete&&art[k].naturalWidth===specs[k][0]&&art[k].naturalHeight===specs[k][1]&&!errors[k]);}
 function load(change=()=>{}){
  if(started)return;started=true;
  for(const k of keys){const im=art[k]=new Image();im.onload=()=>{decoded[k]=true;if(im.naturalWidth!==specs[k][0]||im.naturalHeight!==specs[k][1])errors[k]='size';change();};im.onerror=()=>{errors[k]='load';change();};im.src=YK_FIELD_ASSETS.url(YK_FIELD_ASSETS.landscape[k]);}
 }
 function fixture(){
  const m=Array.from({length:17},()=>Array(20).fill('grass'));
  for(let y=0;y<17;y++)for(let x=(y<6?17:y<11?16:y<14?15:13);x<20;x++)m[y][x]='sea';
  for(let y=0;y<5;y++)for(let x=9;x<14;x++)if(!(y===4&&(x===9||x===13)))m[y][x]='snow';
  for(let y=1;y<4;y++)for(let x=1;x<7;x++)m[y][x]='mountain';
  m[1][11]=m[1][12]=m[2][11]=m[2][12]='snowMountain';
  for(let y=6;y<10;y++)for(let x=1;x<6;x++)if(!(y===6&&x===1))m[y][x]='forest';
  for(let y=12;y<17;y++)for(let x=0;x<(y===12?5:6);x++)m[y][x]='barren';
  for(const [x,y] of [[10,4],[10,5],[10,6],[11,6],[11,7],[11,8],[11,9],[12,9],[13,9],[14,9],[15,9]])m[y][x]='river';
  m[7][10]=m[8][10]='river';
  for(let y=13;y<=14;y++)for(let x=1;x<=4;x++)m[y][x]='rockMountain';
  // A walkable beach occupies actual land cells, outside the waterline.
  for(let y=0;y<17;y++){
   const coast=m[y].indexOf('sea');
   for(let x=Math.max(0,coast-2);x<coast;x++)if(m[y][x]==='grass')m[y][x]='sand';
  }
  m.paths=[
   [[304,520],[304,448],[256,448],[256,202]],
   [[256,252],[480,252],[480,192]],
   [[256,416],[392,416],[392,464]],
   [[256,416],[208,416],[208,496],[176,496]],
   [[256,304],[208,304]]
  ];
  // Object positions use world pixels; flowers and bridge lie under actors.
  m.decorations=[
   {kind:'shrine',x:216,y:112,width:80,height:80,foot:192},
   {kind:'lantern',x:198,y:184,width:24,height:40,foot:224},
   {kind:'lantern',x:294,y:184,width:24,height:40,foot:224},
   {kind:'bridge',x:288,y:224,width:128,height:56,foot:280,ground:true},
   {kind:'flowers',x:210,y:338,width:40,height:24,foot:362,ground:true},
   {kind:'flowers',x:312,y:340,width:40,height:24,foot:364,ground:true},
   {kind:'flowers',x:388,y:360,width:40,height:24,foot:384,ground:true},
   {kind:'flowers',x:232,y:462,width:40,height:24,foot:486,ground:true}
  ];
  return m;
 }
 function placesFixture(){
  const m=Array.from({length:17},()=>Array(20).fill('grass'));
  for(let y=1;y<4;y++)for(let x=1;x<7;x++)m[y][x]='mountain';
  for(let y=1;y<5;y++)for(let x=14;x<19;x++)m[y][x]='forest';
  for(let y=4;y<14;y++)m[y][10]='river';
  for(let x=10;x<20;x++)m[13][x]='river';
  for(let y=14;y<17;y++)for(let x=15;x<20;x++)m[y][x]='sea';
  for(let y=14;y<17;y++)for(let x=13;x<15;x++)m[y][x]='sand';
  m.decorations=[
   {kind:'cave',x:84,y:88,width:80,height:64,foot:152},
   {kind:'hermit',x:226,y:92,width:72,height:72,foot:164},
   {kind:'village',x:64,y:244,width:112,height:80,foot:324},
   {kind:'town',x:410,y:228,width:144,height:104,foot:332},
   {kind:'torii',x:420,y:134,width:64,height:64,foot:198},
   {kind:'jizo',x:214,y:304,width:32,height:32,foot:336},
   {kind:'jizo',x:364,y:304,width:32,height:32,foot:336},
   {kind:'bridge',x:288,y:332,width:96,height:56,foot:388,ground:true},
   {kind:'flowers',x:168,y:370,width:40,height:24,foot:394,ground:true},
   {kind:'flowers',x:542,y:372,width:40,height:24,foot:396,ground:true}
  ];
  m.paths=[
   [[272,524],[272,360],[120,360],[120,334]],
   [[272,360],[482,360],[482,342]],
   [[272,360],[272,208],[262,208],[262,174]],
   [[272,208],[124,208],[124,162]],
   [[400,360],[400,214],[452,214],[452,198]],
   [[400,360],[400,404]]
  ];
  return m;
 }
 function adjacent(map,x,y,predicate){return {n:predicate(map[y-1]?.[x]),e:predicate(map[y]?.[x+1]),s:predicate(map[y+1]?.[x]),w:predicate(map[y]?.[x-1])};}
 // Stepped pixel contours, including diagonal indentations at water junctions.
 function contains(px,py,n,diag,inset=0){
  const l=n.w?0:inset,r=n.e?32:32-inset,t=n.n?0:inset,b=n.s?32:32-inset;
  if(px<l||px>=r||py<t||py>=b)return false;
  const near=(u,v)=>u<2&&v<8||u<4&&v<4||u<8&&v<2;
  if(!n.w&&!n.n&&near(px-l,py-t)||!n.e&&!n.n&&near(r-1-px,py-t)||!n.w&&!n.s&&near(px-l,b-1-py)||!n.e&&!n.s&&near(r-1-px,b-1-py))return false;
  if(n.w&&n.n&&!diag.nw&&near(px,py)||n.e&&n.n&&!diag.ne&&near(31-px,py)||n.w&&n.s&&!diag.sw&&near(px,31-py)||n.e&&n.s&&!diag.se&&near(31-px,31-py))return false;
  return true;
 }
 function groundInside(x,y,n,diag,sx,sy){
  // Ground is a continuous surface: never cut an inner corner out of a
  // connected cell. The water contour has a different shoreline contract.
  // Fade exposed-edge roughness to zero where it meets a connected edge.
  const edge=[1,1,2,2,2,3,3,2,1,1,0,0,1,1,2,1];
  const dx=Math.min(edge[((y+sy)>>1)%16],n.n?y:32,n.s?31-y:32);
  const dy=Math.min(edge[((x+sx)>>1)%16],n.w?x:32,n.e?31-x:32);
  if(!n.w&&x<dx||!n.e&&31-x<dx||!n.n&&y<dy||!n.s&&31-y<dy)return false;
  const corner=(u,v)=>u<2&&v<6||u<4&&v<4||u<6&&v<2;
  return !(!n.w&&!n.n&&corner(x,y)||!n.e&&!n.n&&corner(31-x,y)||
   !n.w&&!n.s&&corner(x,31-y)||!n.e&&!n.s&&corner(31-x,31-y));
 }
 const masks=new Map();
 function maskTile(kind,n,diag,sx,sy){
  const key=kind+sx+','+sy+Object.values(n).map(Number).join('')+Object.values(diag).map(Number).join('');
  if(masks.has(key))return masks.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  // Generated artwork supplies surface detail; this mask only determines joins.
  c.drawImage(art[kind==='water'?'sand':kind],sx,sy,32,32,0,0,32,32);
  const base=c.getImageData(0,0,32,32),surface=document.createElement('canvas');surface.width=surface.height=32;
  const q=surface.getContext('2d');q.imageSmoothingEnabled=false;q.drawImage(art[kind],sx,sy,32,32,0,0,32,32);const source=q.getImageData(0,0,32,32).data;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const i=(y*32+x)*4;
   if(!(kind==='water'?contains(x,y,n,diag):groundInside(x,y,n,diag,sx,sy))){base.data[i+3]=0;continue;}
   if(kind!=='water'||contains(x,y,n,diag,5)){for(let j=0;j<4;j++)base.data[i+j]=source[i+j];
    if(kind==='water'&&!contains(x,y,n,diag,7)){base.data[i]=112;base.data[i+1]=195;base.data[i+2]=197;}
   }
  }
  c.putImageData(base,0,0);masks.set(key,canvas);return canvas;
 }
 function groundTile(map,x,y){return map.bridgeWaterCells?.has(x+','+y)?'river':map[y]?.[x];}
 function drawFloor(c,map){
  const a=window.YK_AUTOTILE;
  for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
   const wx=x+(map.textureOrigin?.x||0),wy=y+(map.textureOrigin?.y||0);
   c.drawImage(art.grass,wx%8*32,wy%8*32,32,32,x*32,y*32,32,32);
   const t=groundTile(map,x,y),kind=water(t)?'water':t==='snowMountain'?'snow':t==='rockMountain'?'barren':t;
   // Projected coast geometry is owned by elevation-view.js, not legacy autotiles.
   if(map.projectedHeights&&(water(t)||kind==='sand')){
    const tile=water(t)?art.water:art.sand;
    c.drawImage(tile,wx%2*32,wy%2*32,32,32,x*32,y*32,32,32);
    continue;
   }
   if(!['water','snow','barren','sand'].includes(kind))continue;
   const same=v=>v===undefined||(kind==='water'?water(v):kind==='snow'?(v==='snow'||v==='snowMountain'):kind==='barren'?(v==='barren'||v==='rockMountain'):kind==='sand'?(v==='sand'||water(v)):v===kind);
   if(t==='sea')c.drawImage(art.sand,wx%2*32,wy%2*32,32,32,x*32,y*32,32,32);
   const n={n:same(groundTile(map,x,y-1)),e:same(groundTile(map,x+1,y)),s:same(groundTile(map,x,y+1)),w:same(groundTile(map,x-1,y))},diag={nw:same(groundTile(map,x-1,y-1)),ne:same(groundTile(map,x+1,y-1)),sw:same(groundTile(map,x-1,y+1)),se:same(groundTile(map,x+1,y+1))};
   c.drawImage(maskTile(kind,n,diag,wx%2*32,wy%2*32),x*32,y*32);
  }
 }
 function pathDistance(x,y,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
  const t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/d)):0;
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
 }
 function onBridge(map,x,y){return (map.decorations||[]).some(o=>(o.kind==='bridge'||o.kind==='bridgeNS')&&x>=o.x&&x<o.x+o.width&&y>=o.y&&y<o.y+o.height);}
 function roadAllowed(map,x,y){const t=map[Math.floor(y/32)]?.[Math.floor(x/32)];return ['grass','sand','snow','barren','road','bridge'].includes(t)||!map.referencePlacedObjects&&water(t)&&onBridge(map,x,y);}
 const roads=new WeakMap();
 function roadLayer(map){
  if(roads.has(map))return roads.get(map);
  const canvas=document.createElement('canvas');canvas.width=map[0].length*32;canvas.height=map.length*32;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  for(let y=-((map.textureOrigin?.y||0)%2)*32;y<canvas.height;y+=64)for(let x=-((map.textureOrigin?.x||0)%2)*32;x<canvas.width;x+=64)c.drawImage(art.road,x,y);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height),covered=new Uint8Array(canvas.width*canvas.height);
  for(const path of map.paths||[])for(let j=1;j<path.length;j++){
   const a=path[j-1],b=path[j];
   for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1])-22));y<Math.min(canvas.height,Math.ceil(Math.max(a[1],b[1])+22));y++)
    for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0])-22));x<Math.min(canvas.width,Math.ceil(Math.max(a[0],b[0])+22));x++){
     const edge=20-((Math.floor((x+(map.textureOrigin?.x||0)*32)/4)+Math.floor((y+(map.textureOrigin?.y||0)*32)/4)*3)%5===0?1:0);
     if(pathDistance(x+.5,y+.5,a,b)<=edge&&roadAllowed(map,x,y))covered[y*canvas.width+x]=1;
    }
  }
  for(let i=0;i<covered.length;i++)if(!covered[i])pixels.data[i*4+3]=0;
  c.putImageData(pixels,0,0);roads.set(map,canvas);return canvas;
 }
 // Explicit normalized ground footprints. Roofs remain outside collision.
 const footprintSpecs={newVillage:[[.18,.72,.82,1]],newHouse:[[.18,.72,.82,1]],newTorii:[[.08,.68,.25,1],[.75,.68,.92,1]],newCaveLarge:[[.12,.72,.88,1]],newFort:[[.18,.72,.82,1]],newPagoda:[[.1,.6,.9,1]],castle:[[.10,.62,.92,1]],waterfall:[[.10,.40,.90,1]],
  shrine:[[0,0,1,1]],hermit:[[.14,.52,.88,1]],
  village:[[.10,.50,.92,1]],town:[[.08,.48,.94,1]],
  cave:[[.10,.56,.90,1]],lantern:[[.25,.72,.75,1]],
  jizo:[[.22,.64,.78,1]],torii:[[.18,.78,.31,1],[.72,.78,.85,1]]
 };
 function footprints(o){
  if(o.walkThrough||o.collision?.enabled===false)return [];
  // Occupancy is authored in absolute movement cells, never inferred from sprite pixels.
  return (o.occupiedTiles||[]).map(([tx,ty])=>({x:tx*32,y:ty*32,width:32,height:32}));
 }
 // Collision uses feet and ground footprints, not roofs or tree overhangs.
 function walkable(map,x,y,r=8){
  if(x-r<0||y-r<0||x+r>=map[0].length*32||y+r>=map.length*32)return false;
  const bridge=(px,py)=>(map.decorations||[]).some(o=>(o.kind==='bridge'&&px>=o.x&&px<o.x+o.width&&py>=o.y+o.height*.30&&py<=o.y+o.height*.82||o.kind==='bridgeNS'&&px>=o.x+o.width*.22&&px<=o.x+o.width*.78&&py>=o.y&&py<o.y+o.height));
  for(const [dx,dy] of [[0,0],[-r,0],[r,0],[0,-r],[0,r],[-r*.7,-r*.7],[r*.7,-r*.7],[-r*.7,r*.7],[r*.7,r*.7]]){
   const px=x+dx,py=y+dy,t=map[Math.floor(py/32)]?.[Math.floor(px/32)];
   if(water(t)?(map.referencePlacedObjects||!bridge(px,py)):!['grass','forest','sand','snow','barren','road','bridge'].includes(t))return false;
  }
  const hit=(l,t,w,h)=>Math.hypot(x-Math.max(l,Math.min(x,l+w)),y-Math.max(t,Math.min(y,t+h)))<r;
  // The world map's legacy decoration positions are being replaced. Until the
  // new placement pass is verified, do not retain invisible solid footprints
  // from those former positions. Terrain/water/cliffs still block normally.
  if(!map.fieldObjectCollisionDeferred&&map.occupiedTiles){
   for(let ty=Math.floor((y-r)/32);ty<=Math.floor((y+r)/32);ty++)for(let tx=Math.floor((x-r)/32);tx<=Math.floor((x+r)/32);tx++)
    if(map.occupiedTiles.has(tx+','+ty)&&hit(tx*32,ty*32,32,32))return false;
  }else if(!map.fieldObjectCollisionDeferred)for(const o of map.decorations||[]){
   for(const f of footprints(o))if(hit(f.x,f.y,f.width,f.height))return false;
  }
  return true;
 }
 const floors=new WeakMap();
 function floorLayer(map){
  if(floors.has(map))return floors.get(map);
  const layer=document.createElement('canvas');layer.width=map[0].length*32;layer.height=map.length*32;
  drawFloor(layer.getContext('2d'),map);floors.set(map,layer);return layer;
 }
 const sceneObjects=new WeakMap();
 function objects(map){
  if(sceneObjects.has(map))return sceneObjects.get(map);
  if(map.referencePlacedObjects){const result=(map.decorations||[]).filter(o=>!o.ground).slice().sort((a,b)=>a.foot-b.foot||a.x-b.x);sceneObjects.set(map,result);return result;}
  // Approved field objects replace legacy procedural crowns and mountain sprites.
  // Grouping is visual only: the authored terrain/collision grid is immutable.
  const trees=[],mountains=[],covered=new Set(),key=(x,y)=>y*map[0].length+x;
  for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
   const t=map[y][x];
   if(t==='forest')trees.push({kind:'newTrees',x:x*32,y:y*32,width:32,height:32,foot:(y+1)*32});
   if(!['mountain','rockMountain','snowMountain'].includes(t)||covered.has(key(x,y)))continue;
   const large=t==='mountain'&&x+3<map[y].length&&y+1<map.length&&
    [0,1].every(dy=>[0,1,2,3].every(dx=>map[y+dy]?.[x+dx]==='mountain'&&!covered.has(key(x+dx,y+dy))));
   if(large){
    mountains.push({kind:'newMountainLarge',x:x*32,y:y*32,width:128,height:64,foot:(y+2)*32});
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<4;dx++)covered.add(key(x+dx,y+dy));
   }else mountains.push({kind:'newMountainSmall',x:x*32,y:y*32,width:32,height:32,foot:(y+1)*32});
  }
  const result=[...trees,...mountains,...(map.decorations||[]).filter(o=>!o.ground)].sort((a,b)=>a.foot-b.foot||a.x-b.x);sceneObjects.set(map,result);return result;
 }
 // Short contact shadows attach objects to the ground without floating silhouettes.
 // A single cached alpha layer avoids dark seams between overlapping objects.
 const shadows=new WeakMap();
 function shadowLayer(map){
  if(shadows.has(map))return shadows.get(map);
  const layer=document.createElement('canvas');layer.width=map[0].length*32;layer.height=map.length*32;
  const c=layer.getContext('2d');c.imageSmoothingEnabled=false;
  c.fillStyle='#18281e';
  for(const o of objects(map)){
   // A short contact shadow, anchored to the base; no projected roof silhouette.
   const small=['lantern','jizo','torii'].includes(o.kind);
   const width=o.width*(small?.48:.70),depth=small?2:3;
   c.beginPath();c.ellipse(o.x+o.width/2+2,o.foot-1,width/2,depth,0,0,Math.PI*2);c.fill();
  }
  const p=c.getImageData(0,0,layer.width,layer.height);
  for(let i=0;i<p.data.length;i+=4){const alpha=p.data[i+3]>=128?30:0;p.data[i]=24;p.data[i+1]=40;p.data[i+2]=30;p.data[i+3]=alpha;}
  c.putImageData(p,0,0);shadows.set(map,layer);return layer;
 }
 function draw(c,map,actor){
  if(!ready()||!window.YK_AUTOTILE.ready())return false;c.imageSmoothingEnabled=false;c.drawImage(groundLayer(map),0,0);
  let drawn=false;
  for(const o of objects(map)){
   if(actor&&!drawn&&actor.foot<o.foot){actor.draw();drawn=true;}
   if(o.kind==='forest')window.YK_AUTOTILE.drawCrown(c,o.x,o.y,o.width,o.height);
   else c.drawImage(art[o.kind],o.x,o.y,o.width,o.height);
  }
  if(actor&&!drawn)actor.draw();return true;
 }

 function quarterFixture(){
  const m=Array.from({length:48},()=>Array(40).fill('grass'));
  for(let y=0;y<48;y++)for(let x=0;x<40;x++){
   const coast=32-Math.floor(y/12);
   if(x>=coast)m[y][x]='sea';else if(x>=coast-2)m[y][x]='sand';
   if(y<11&&x>3&&x<20)m[y][x]='snow';
   if(y>=3&&y<9&&x>=5&&x<17)m[y][x]='snowMountain';
   if(y>=14&&y<21&&x>=2&&x<9)m[y][x]='mountain';
   if(y>=28&&y<34&&x>=3&&x<10)m[y][x]='forest';
   if(y>=13&&y<19&&x>=22&&x<28)m[y][x]='forest';
   if(y>=38&&y<44&&x>=17&&x<24)m[y][x]='barren';
   if(y>=40&&y<43&&x>=18&&x<22)m[y][x]='rockMountain';
   if(y<2||y>=47||x<1)m[y][x]='sea';else if(y===2||y===46||x===1)m[y][x]='sand';
  }
  for(let y=16;y<=19;y++)for(let x=22;x<=25;x++)m[y][x]='grass';
  for(let y=11;y<=25;y++)m[y][20]='river';
  for(let x=12;x<32;x++)m[25][x]='river';
  m.decorations=[
   {kind:'bridgeNS',x:440,y:768,width:48,height:96,foot:864,ground:true},
   {kind:'bridge',x:608,y:660,width:96,height:56,foot:716,ground:true},
   {kind:'village',x:330,y:1016,width:112,height:80,foot:1096},
   {kind:'town',x:750,y:902,width:144,height:104,foot:1006},
   {kind:'castle',x:408,y:304,width:112,height:112,foot:416},
   {kind:'cave',x:180,y:616,width:80,height:64,foot:680},
   {kind:'hermit',x:292,y:552,width:72,height:72,foot:624},
   {kind:'shrine',x:720,y:512,width:80,height:80,foot:592},
   {kind:'waterfall',x:616,y:268,width:80,height:96,foot:364},
   {kind:'jizo',x:416,y:1096,width:32,height:32,foot:1128},
   {kind:'torii',x:728,y:602,width:64,height:64,foot:666},
   {kind:'flowers',x:526,y:952,width:40,height:24,foot:976,ground:true},
   {kind:'flowers',x:530,y:1216,width:40,height:24,foot:1240,ground:true}
  ];
  m.paths=[[[464,1392],[464,426]],[[464,688],[760,688],[760,602]],[[464,1144],[386,1144],[386,1106]],[[464,1032],[822,1032],[822,1016]],[[464,648],[328,648],[328,634]],[[464,728],[220,728],[220,690]]];
  return m;
 }
 const grounds=new WeakMap();
 // Draw cliff faces at height boundaries without altering the authored ground tiles.
 function drawHeightFaces(c,map){
  const heights=map.heights;if(!heights)return;
  const floor=floorLayer(map),roads=roadLayer(map),step=22;
  c.save();c.imageSmoothingEnabled=false;
  // Raised top surfaces and their visible south-facing cliff walls are drawn
  // from north to south, so the nearer ledge covers the farther one.
  for(let y=0;y<heights.length;y++)for(let x=0;x<heights[y].length;x++){
   const level=heights[y][x];if(level<=0)continue;
   const px=x*32,py=y*32,dy=py-level*step;
   const south=y+1<heights.length?heights[y+1][x]:0;
   const west=x?heights[y][x-1]:0,east=x+1<heights[y].length?heights[y][x+1]:0;
   if(level>south){
    const depth=(level-south)*step;
    // The wall hangs below the elevated surface, connecting to the lower ground.
    c.fillStyle='#393c3c';c.fillRect(px,dy+32,32,depth);
    c.fillStyle='#69675e';c.fillRect(px+3,dy+33,26,Math.max(1,depth-4));
    c.fillStyle='#a59b85';c.fillRect(px,dy+32,32,4);
    c.fillStyle='#282d31';c.fillRect(px,dy+32+depth-5,32,5);
    for(let k=0;k<3;k++){
     const xx=px+5+((x*11+y*7+k*9)%22);
     c.fillStyle=k===1?'#b2a48a':'#4c4c48';
     c.fillRect(xx,dy+38+(k%2)*6,2,Math.max(2,depth-14-(k%3)*3));
    }
   }
   if(level>west){c.fillStyle='#303639';c.fillRect(px,dy+3,4,29);}
   if(level>east){c.fillStyle='#a69b82';c.fillRect(px+28,dy+3,4,29);}
   // Copy the real authored 32px top tile, not a flat color approximation.
   c.drawImage(floor,px,py,32,32,px,dy,32,32);
   c.drawImage(roads,px,py,32,32,px,dy,32,32);
   // Thin top rim distinguishes the elevated surface from its cliff face.
   if(level>south){c.fillStyle='#d0c2a1';c.fillRect(px,dy+29,32,3);}
  }
  c.restore();
 }
 // Subtle shoreline relief: the land edge is raised visually above a shared sea/river level.
 // Painted in map coordinates so perspective sampling, collision and water alignment stay unchanged.
 function drawShoreRelief(c,map){
  c.save();c.imageSmoothingEnabled=false;
  for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
   if(water(groundTile(map,x,y)))continue;
   const px=x*32,py=y*32;
   const north=water(groundTile(map,x,y-1)),south=water(groundTile(map,x,y+1));
   const west=water(groundTile(map,x-1,y)),east=water(groundTile(map,x+1,y));
   // The north-facing edge is darker; the south-facing bank catches more light.
   if(south){
    c.fillStyle='rgba(45,68,52,.55)';c.fillRect(px,py+27,32,4);
    c.fillStyle='rgba(185,162,109,.85)';c.fillRect(px,py+28,32,2);
    c.fillStyle='rgba(19,74,103,.40)';c.fillRect(px,py+32,32,3);
   }
   if(north){c.fillStyle='rgba(27,78,92,.42)';c.fillRect(px,py,32,3);c.fillStyle='rgba(202,191,139,.65)';c.fillRect(px,py+3,32,2);}
   if(east){c.fillStyle='rgba(51,80,59,.42)';c.fillRect(px+28,py,4,32);c.fillStyle='rgba(196,180,125,.7)';c.fillRect(px+29,py,2,32);}
   if(west){c.fillStyle='rgba(37,77,77,.38)';c.fillRect(px,py,3,32);c.fillStyle='rgba(205,187,133,.65)';c.fillRect(px+3,py,2,32);}
  }
  c.restore();
 }
 function groundLayer(map){
  if(grounds.has(map))return grounds.get(map);
  const layer=document.createElement('canvas');layer.width=map[0].length*32;layer.height=map.length*32;const c=layer.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(floorLayer(map),0,0);c.drawImage(roadLayer(map),0,0);c.drawImage(shadowLayer(map),0,0);if(!map.projectedHeights){if(map.shoreRelief)drawShoreRelief(c,map);else drawHeightFaces(c,map);}
  for(const o of (map.decorations||[]).filter(o=>o.ground)){
   if(o.kind==='wildflowers'){
    // Same 32px cells as Hozuki village, placed sparsely without a square backdrop.
    const cx=o.x+o.width/2,cy=o.y+o.height/2;
    for(const [dx,dy,n] of [[-24,-12,3],[4,-8,9],[-9,10,6],[20,13,12]]){
     const x=cx+dx,y=cy+dy,idx=(n+Math.floor(cx/32)*3+Math.floor(cy/32)*5)&15;
     c.drawImage(art.wildflowers,(idx%4)*32,Math.floor(idx/4)*32,32,32,x-16,y-16,32,32);
    }
   }else c.drawImage(art[o.kind],o.x,o.y,o.width,o.height);
  }
  // The large production map retains one composite, not four full-size canvases.
  if(map.length>=64)for(const cache of [floors,roads,shadows]){cache.delete(map);}
  layer.__ykStatic=true;grounds.set(map,layer);return layer;
 }
 // Based on the 2026-10-07 Mode7/HDMA handoff. Browser approximation values,
 // not a verbatim copy of ROM coefficient tables. Angles are camera yaw.
 const cameraPresets=[{name:'標準',far:.34,near:1.30,gamma:1.85},{name:'強調',far:.28,near:1.35,gamma:2.1},{name:'穏やか',far:.48,near:1.18,gamma:1.45},
  // Settlement: retain distant depth, but prevent foreground expansion and side convergence.
  {name:'村内安定',far:.46,near:1.22,gamma:1.5,softNear:true}];
 function perspectiveScale(t,p=cameraPresets[0]){
  t=Math.max(0,Math.min(1,t));
  // Smoothly ease the near end of the village curve; leave world presets unchanged.
  if(p.softNear&&t>.65)t=.65+.18*(1-Math.exp(-(t-.65)/.18));
  return p.far+(p.near-p.far)*Math.pow(t,p.gamma);
 }
 function mode7LikeMatrix(angle,scale){const c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;return {a:c,b:s,c:-s,d:c};}
 const curves=new Map();
 function cameraCurve(zoom=1.4,preset=0){
  const key=zoom+':'+preset;if(curves.has(key))return curves.get(key);
  const p=cameraPresets[preset]||cameraPresets[0],offset=new Float64Array(801),anchor=354;
  for(let y=1;y<=800;y++)offset[y]=offset[y-1]+1/(.65*zoom*perspectiveScale((y-.5)/543,p));
  const origin=offset[anchor];for(let y=0;y<=800;y++)offset[y]-=origin;
  const curve={offset,p,zoom,anchor};curves.set(key,curve);return curve;
 }
 function lineAt(y,zoom=1.4,preset=0){
  const c=cameraCurve(zoom,preset),i=Math.max(0,Math.min(799,Math.floor(y))),f=Math.max(0,Math.min(1,y-i));
  const scale=zoom*perspectiveScale(y/543,c.p),xScale=c.p.softNear?scale:scale*(.94+.06*Math.max(0,Math.min(1,y/543)));
  return {offset:c.offset[i]*(1-f)+c.offset[i+1]*f,scale,xScale};
 }
 function project(x,y,camera,zoom=1.4){
  const angle=camera.angle||0,cs=Math.cos(angle),sn=Math.sin(angle),dx=x-camera.x,dy=y-camera.y;
  const vx=cs*dx+sn*dy,vy=-sn*dx+cs*dy,c=cameraCurve(zoom,camera.preset||0);
  if(vy<c.offset[0]||vy>c.offset[800])return null;
  // Invert the cached piecewise-linear curve directly. Avoid 24 scale/power
  // evaluations per object and terrain vertex on every animation frame.
  let lo=0,hi=800;while(hi-lo>1){const mid=(lo+hi)>>1;if(c.offset[mid]<=vy)lo=mid;else hi=mid;}
  const sy=lo+(vy-c.offset[lo])/(c.offset[hi]-c.offset[lo]),l=lineAt(sy,zoom,camera.preset||0),xs=camera.horizontalScale||l.xScale;return {x:(camera.centerX??320)+vx*xs,y:sy,scale:l.scale,xScale:xs};
 }
 function unproject(x,y,camera,zoom=1.4){
  if(y<0||y>800)return null;const l=lineAt(y,zoom,camera.preset||0),vx=(x-(camera.centerX??320))/(camera.horizontalScale||l.xScale),vy=l.offset,a=camera.angle||0,cs=Math.cos(a),sn=Math.sin(a);
  return {x:camera.x+cs*vx-sn*vy,y:camera.y+sn*vx+cs*vy,scale:l.scale};
 }
 // Build only small visible ground chunks. Avoid several 2560² temporary
 // canvases on mobile when preparing the elevated world.
 // Keep the authored 8x8 texture chunks, but bound their lifetime.
 // A full exploration previously retained every visited chunk for the session.
 // Eviction removes only the cache reference; never shrink/reuse a surface
 // because deferred draw commands may still reference it this frame.
 const ELEVATION_CHUNK_LIMIT=64;
 const elevationChunks=new WeakMap();
 let chunkTouch=0;
 function elevationChunkStats(map){return {count:elevationChunks.get(map)?.size||0,limit:ELEVATION_CHUNK_LIMIT};}
 function elevationTexture(map,tx,ty){
  if(!elevationChunks.has(map))elevationChunks.set(map,new Map());
  const cache=elevationChunks.get(map),bx=Math.floor(tx/8)*8,by=Math.floor(ty/8)*8,key=bx+','+by;
  if(!cache.has(key)){
   const ox=Math.max(0,bx-1),oy=Math.max(0,by-1),ex=Math.min(map[0].length,bx+9),ey=Math.min(map.length,by+9);
   const chunk=map.slice(oy,ey).map(r=>r.slice(ox,ex));
   chunk.textureOrigin={x:ox,y:oy};chunk.projectedHeights=true;chunk.shoreRelief=true;chunk.referencePlacedObjects=true;
   chunk.bridgeWaterCells=new Set([...map.bridgeWaterCells].map(k=>{const [x,y]=k.split(',').map(Number);return (x-ox)+','+(y-oy);}));
   chunk.paths=map.paths.map(r=>r.map(([x,y])=>[x-ox*32,y-oy*32]));
   chunk.decorations=map.decorations.filter(o=>o.x+o.width>=ox*32-32&&o.x<=ex*32+32&&o.foot>=oy*32-32&&o.y<=ey*32+32).map(o=>({...o,x:o.x-ox*32,y:o.y-oy*32,foot:o.foot-oy*32}));
   const surface=groundLayer(chunk);
   for(const layers of [floors,roads,shadows]){const temp=layers.get(chunk);if(temp){temp.width=1;temp.height=1;}layers.delete(chunk);}
   cache.set(key,{surface,ox,oy,lastUsed:++chunkTouch});
   if(cache.size>ELEVATION_CHUNK_LIMIT){
    let oldestKey=null,oldestStamp=Infinity;
    for(const [candidate,entry] of cache){
     if(entry.lastUsed<oldestStamp){oldestStamp=entry.lastUsed;oldestKey=candidate;}
    }
    if(oldestKey!==null)cache.delete(oldestKey);
   }
  }
  const entry=cache.get(key);
  entry.lastUsed=++chunkTouch;
  const {surface,ox,oy}=entry;return {surface,x:(tx-ox)*32,y:(ty-oy)*32};
 }
 const motionFrames={};
 function motionArt(kind,time=typeof performance==='object'?performance.now():0){const atlas=art[kind+'Motion'];if(!atlas?.complete||!atlas.naturalWidth)return art[kind];if(!motionFrames[kind]){const [atlasWidth,h]=specs[kind+'Motion'];const frames=2,frameWidth=atlasWidth/frames;motionFrames[kind]=Array.from({length:frames},(_,i)=>{const cv=document.createElement('canvas');cv.width=frameWidth;cv.height=h;const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(atlas,i*frameWidth,0,frameWidth,h,0,0,frameWidth,h);return cv;});}return motionFrames[kind][Math.floor(time/360)%motionFrames[kind].length]}
 function drawQuarter(c,map,actor,zoom=1.4,settings={}){
  if(!ready())return false;
  const motionTime=Number.isFinite(settings.motionTime)?settings.motionTime:typeof performance==='object'?performance.now():0,movingWater=motionArt('water',motionTime),movingFall=motionArt('waterfall',motionTime);
  if(settings.elevationTerrain&&map.elevationEnabled){
   const fieldArt={...art,waterAnimated:true,sea:movingWater,river:movingWater,waterfall:movingFall,rock:art.barren,grassCliff:art.grassCliff,ladder:art.ladder,forest:art.grass,mountain:art.grass,snowMountain:art.snow,rockMountain:art.barren};
   return !!window.YK_ELEVATION_VIEW.render(c,map,fieldArt,{x:actor.x,y:actor.foot,height:actor.height,draw:actor.draw},{
    camera:{x:settings.cameraX??actor.x,y:actor.foot,preset:settings.preset||0,centerX:(settings.viewportWidth??640)/2},viewportWidth:settings.viewportWidth??640,rise:map.elevationRise||20,
    groundTile:(tx,ty)=>elevationTexture(map,tx,ty),objects:objects(map)
   });
  }
  const camera={x:settings.cameraX??actor.x,y:actor.foot,angle:settings.angle||0,preset:settings.preset||0,horizontalScale:settings.horizontalScale||0},ground=settings.ground||groundLayer(map),strip=4,top=136,gx=settings.groundOrigin?.x||0,gy=settings.groundOrigin?.y||0;
  c.save();c.beginPath();c.rect(0,0,640,544);c.clip();c.imageSmoothingEnabled=false;if(settings.interiorBackdrop){c.fillStyle=settings.interiorBackdrop;c.fillRect(0,0,640,544);}else c.drawImage(art.horizon,0,0,640,top+80);
  const ocean=settings.oceanOutside?c.createPattern(movingWater,'repeat'):null;
  const corners=[];for(let y=top;y<=544;y+=strip)for(const x of [0,640])corners.push(unproject(x,y,camera,zoom));
  const left=Math.max(gx,Math.floor(Math.min(...corners.map(p=>p.x)))-4),right=Math.min(gx+ground.width,Math.ceil(Math.max(...corners.map(p=>p.x)))+4);
  const upper=Math.max(gy,Math.floor(Math.min(...corners.map(p=>p.y)))-4),lower=Math.min(gy+ground.height,Math.ceil(Math.max(...corners.map(p=>p.y)))+4);
  for(let sy=top;sy<544;sy+=strip){
   const a=lineAt(sy,zoom,camera.preset),b=lineAt(sy+strip,zoom,camera.preset);
   const blend=Math.max(0,Math.min(1,(sy-top)/72));c.globalAlpha=blend*blend*(3-2*blend);
   c.fillStyle=settings.edgeColor||'#25869d';c.fillRect(0,sy,640,strip);
   // Repeat the existing 64px sea in world coordinates, beyond every map edge.
   // Only visible strips are drawn: no padded multi-megapixel ground cache.
   if(ocean){
    const xs=camera.horizontalScale||a.xScale,ys=strip/(b.offset-a.offset),cs=Math.cos(camera.angle),sn=Math.sin(camera.angle);
    c.save();c.beginPath();c.rect(0,sy,640,strip);c.clip();
    c.transform(xs*cs,-ys*sn,xs*sn,ys*cs,320-xs*(cs*camera.x+sn*camera.y),sy-ys*(-sn*camera.x+cs*camera.y+a.offset));
    const pts=[unproject(0,sy,camera,zoom),unproject(640,sy,camera,zoom),unproject(0,sy+strip,camera,zoom),unproject(640,sy+strip,camera,zoom)];
    const x0=Math.min(...pts.map(p=>p.x))-4,y0=Math.min(...pts.map(p=>p.y))-4;
    c.fillStyle=ocean;c.fillRect(x0,y0,Math.max(...pts.map(p=>p.x))-x0+4,Math.max(...pts.map(p=>p.y))-y0+4);c.restore();
   }
   if(!camera.angle){
    const sourceTop=Math.max(gy,camera.y+a.offset),bottom=Math.min(gy+ground.height,camera.y+b.offset);
    if(right>left&&bottom>sourceTop)c.drawImage(ground,left-gx,sourceTop-gy,right-left,bottom-sourceTop,320+(left-camera.x)*(camera.horizontalScale||a.xScale),sy+(sourceTop-camera.y-a.offset)*strip/(b.offset-a.offset),(right-left)*(camera.horizontalScale||a.xScale),(bottom-sourceTop)*strip/(b.offset-a.offset)+.5);
   }else if(right>left&&lower>upper){
    const cs=Math.cos(camera.angle),sn=Math.sin(camera.angle),ys=strip/(b.offset-a.offset);
    c.save();c.beginPath();c.rect(0,sy,640,strip);c.clip();
    c.transform((camera.horizontalScale||a.xScale)*cs,-ys*sn,(camera.horizontalScale||a.xScale)*sn,ys*cs,320-(camera.horizontalScale||a.xScale)*(cs*camera.x+sn*camera.y),sy-ys*(-sn*camera.x+cs*camera.y+a.offset));
    c.drawImage(ground,left-gx,upper-gy,right-left,lower-upper,left,upper,right-left,lower-upper);c.restore();
   }
  }
  c.globalAlpha=1;
  if(settings.afterGround)settings.afterGround(c,camera);
  const raised=(x,y)=>{const p=project(x,y,camera,zoom);return p?{...p,depth:p.y,y:p.y-(settings.elevation?.(x,y)||0)*p.scale}:null;};
  const projected=(settings.objects||objects(map)).map(o=>({o,p:raised(o.x+o.width/2,o.foot)})).filter(v=>v.p&&v.p.depth>=top&&v.p.depth<750).sort((a,b)=>a.p.depth-b.p.depth);
  const player=raised(actor.x,actor.foot);let drawn=false;
  for(const {o,p} of projected){
   if(!drawn&&player.depth<p.depth){actor.draw(player.x,player.y,player.scale);drawn=true;}
   const w=o.width*(camera.horizontalScale||p.scale),h=o.height*p.scale,x=p.x-w/2,y=p.y-h;if(x+w<0||x>640)continue;
   c.globalAlpha=Math.min(1,Math.max(0,(p.y-top)/70));
   if(o.tileImage){
    const im=o.tileImage;
    if(im.complete&&im.naturalWidth)for(let yy=0;yy<o.height;yy+=4){
     const dy=Math.min(4,o.height-yy),p1=project(o.x,o.y+yy,camera,zoom),p2=project(o.x+o.width,o.y+yy+dy,camera,zoom);
     if(!p1||!p2||p2.y<=p1.y)continue;
     const srcY=o.tileSourceY||0,srcH=o.tileSourceH||im.naturalHeight;
     c.drawImage(im,0,srcY+srcH*yy/o.height,im.naturalWidth,srcH*dy/o.height,p1.x,p1.y,p2.x-p1.x,p2.y-p1.y+.5);
    }
   }else if(o.draw)o.draw(c,x,y,w,h,p);else if(o.kind==='forest')window.YK_AUTOTILE.drawCrown(c,x,y,w,h);else c.drawImage(o.kind==='waterfall'?movingFall:art[o.kind],x,y,w,h);c.globalAlpha=1;
  }
  if(!drawn)actor.draw(player.x,player.y,player.scale);
  if(!settings.interiorBackdrop){const haze=c.createLinearGradient(0,top-56,0,top+144);haze.addColorStop(0,'rgba(202,225,214,0)');haze.addColorStop(.38,'rgba(202,225,214,.34)');haze.addColorStop(1,'rgba(202,225,214,0)');c.fillStyle=haze;c.fillRect(0,top-56,640,200);}
  c.restore();return true;
 }
 function drawAsset(c,k,x,y,w,h){if(!ready())return false;c.imageSmoothingEnabled=false;c.drawImage(art[k],x,y,w,h);return true;}
 return {cameraPresets,perspectiveScale,mode7LikeMatrix,groundLayer,drawQuarter,project,unproject,quarterFixture,footprints,shadowLayer,walkable,floorLayer,specs,keys,placeKeys,placesFixture,errors,load,ready,fixture,draw,objects,drawAsset,motionArt,contains,adjacent,roadAllowed,roadLayer,groundInside,elevationChunkStats};
})();




