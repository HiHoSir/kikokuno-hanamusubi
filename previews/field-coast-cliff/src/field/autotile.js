// Based on 夜叉姫_Work引き継ぎ_ROM解析.md §§11,14,16,18–21.
// Original 32×32 RGBA assets, assembled from 16px parts without stretching.
window.YK_AUTOTILE=(()=>{
 const forestKeys=['core','edge_top','edge_right','edge_bottom','edge_left','corner_tl','corner_tr','corner_bl','corner_br'].map(k=>'forest_'+k);
 const keys=['grass_base',...forestKeys],specs=Object.fromEntries(keys.map(k=>[k,[32,32]])),art={},errors={};
 const baseColor='#83b54d';let started=false,crown;
 const ready=()=>!!crown?.complete&&crown.naturalWidth===64&&keys.every(k=>art[k]?.complete&&art[k].naturalWidth===32&&art[k].naturalHeight===32&&!errors[k]);
 function load(onChange=()=>{}){
  if(started)return;started=true;
  crown=new Image();crown.onload=onChange;crown.onerror=()=>{errors.crown='load';onChange();};crown.src=YK_FIELD_ASSETS.url(YK_FIELD_ASSETS.autotile.crown);
  for(const key of keys){const im=art[key]=new Image();im.onload=()=>{if(im.naturalWidth!==32||im.naturalHeight!==32)errors[key]='size';onChange();};im.onerror=()=>{errors[key]='load';onChange();};im.src=YK_FIELD_ASSETS.url(YK_FIELD_ASSETS.autotile[key]);}
 }
 function roles(kind,{n=false,e=false,s=false,w=false}={}){
  if(kind==='grass')return [[0,0],[0,0],[0,0],[0,0]];
  if(kind==='forest')return [[w?1:0,n?1:0],[e?1:2,n?1:0],[w?1:0,s?1:2],[e?1:2,s?1:2]];
  throw new Error('Unknown terrain: '+kind);
 }
 // Each role supplies the matching quadrant, preserving the full 32px crown.
 const parts=['forest_corner_tl','forest_edge_top','forest_corner_tr','forest_edge_left','forest_core','forest_edge_right','forest_corner_bl','forest_edge_bottom','forest_corner_br'];
 function neighbors(map,x,y){const t=map[y]?.[x];return {n:map[y-1]?.[x]===t,e:map[y]?.[x+1]===t,s:map[y+1]?.[x]===t,w:map[y]?.[x-1]===t};}
 function drawAsset(c,key,x,y,size=32){if(!ready())return false;c.imageSmoothingEnabled=false;c.drawImage(art[key],x,y,size,size);return true;}
 function drawCell(c,kind,n,x,y){
  if(!ready())return false;c.imageSmoothingEnabled=false;
  c.fillStyle=baseColor;c.fillRect(x,y,32,32);drawAsset(c,'grass_base',x,y);
  if(kind==='grass')return true;
  roles(kind,n).forEach(([col,row],i)=>{const key=parts[row*3+col],sx=(i%2)*16,sy=(i>>1)*16;c.drawImage(art[key],sx,sy,16,16,x+(i%2)*16,y+(i>>1)*16,16,16);});return true;
 }
 function drawMap(c,map,ox=0,oy=0){if(!ready())return false;for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)drawCell(c,map[y][x],neighbors(map,x,y),ox+x*32,oy+y*32);return true;}
 // Movement remains on the 32px grid; one canopy covers up to four cells.
 function forestObjects(map){
  const used=new Set(),objects=[];
  for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
   if(map[y][x]!=='forest'||used.has(x+','+y))continue;
   const cells=[];
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)if(map[y+dy]?.[x+dx]==='forest'&&!used.has((x+dx)+','+(y+dy))){used.add((x+dx)+','+(y+dy));cells.push([x+dx,y+dy]);}
   const cx=(Math.min(...cells.map(p=>p[0]))+Math.max(...cells.map(p=>p[0]))+1)*16;
   const foot=(Math.max(...cells.map(p=>p[1]))+1)*32;
   objects.push({x:cx-40,y:foot-80,width:80,height:80,foot,cells});
  }
  return objects.sort((a,b)=>a.foot-b.foot||a.x-b.x);
 }
 function drawScene(c,map,actor){
  if(!ready())return false;
  for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++)drawCell(c,'grass',{},x*32,y*32);
  let drawn=false;c.imageSmoothingEnabled=false;
  for(const tree of forestObjects(map)){
   if(actor&&!drawn&&actor.foot<tree.foot){actor.draw();drawn=true;}
   c.drawImage(crown,tree.x,tree.y,tree.width,tree.height);
  }
  if(actor&&!drawn)actor.draw();return true;
 }
 function fixture(){
  const m=Array.from({length:17},()=>Array(20).fill('grass'));
  for(let y=1;y<=5;y++)for(let x=1;x<=6;x++)m[y][x]='forest';
  for(let y=1;y<=5;y++)for(let x=11;x<=17;x++)m[y][x]='forest';
  m[4][17]=m[5][17]=m[5][16]='grass';
  for(let x=1;x<=6;x++)m[8][x]='forest';for(let y=9;y<=12;y++)m[y][1]='forest';m[11][5]='forest';
  for(let x=10;x<=17;x++)m[8][x]='forest';m[11][10]='forest';for(let y=11;y<=13;y++)m[y][15]='forest';
  return m;
 }
 function drawCrown(c,x,y,w=80,h=80){if(!ready())return false;c.imageSmoothingEnabled=false;c.drawImage(crown,x,y,w,h);return true;}
 return {drawCrown,load,ready,roles,neighbors,forestObjects,drawScene,drawCell,drawMap,drawAsset,fixture,errors,specs,keys,baseColor};
})();
