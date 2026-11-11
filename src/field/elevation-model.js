// Shared 32px terrain contract. Material never determines elevation or connectivity.
window.YK_ELEVATION=(()=>{
 const CELL=32,dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
 const inside=(m,x,y)=>x>=0&&y>=0&&y<m.length&&x<m[0].length;
 function level(m,tx,ty,u=.5,v=.5){
  if(!inside(m,tx,ty))return 0;
  const base=m.heights?.[ty]?.[tx]||0,r=m.ramps?.[ty]?.[tx];
  return base+(r==='n'?1-v:r==='s'?v:r==='e'?u:r==='w'?1-u:0);
 }
 // All geometry is authored in map coordinates, never inferred from a sprite.
 const cornerDefs=[['nw',0,0,-1,0,0,-1],['ne',32,0,1,0,0,-1],['se',32,32,1,0,0,1],['sw',0,32,-1,0,0,1]];
 const outlines=new WeakMap();
 function outline(m,tx,ty){
  const cache=outlines.get(m);if(cache&&inside(m,tx,ty))return cache[ty][tx];
  return buildOutline(m,tx,ty);
 }
 function prepare(m){outlines.delete(m);outlines.set(m,m.map((row,y)=>row.map((_,x)=>buildOutline(m,x,y))));}
 function buildOutline(m,tx,ty){
  const requested=Math.max(0,Math.min(30,m.cornerCut??30)),base=level(m,tx,ty),cuts=[],polygon=[];
  const eligible=cornerDefs.map(([name,cx,cy,dx,dy,ex,ey])=>{
   const a=level(m,tx+dx,ty+dy),b=level(m,tx+ex,ty+ey),d=level(m,tx+dx+ex,ty+dy+ey);
   const ramp=m.ramps?.[ty]?.[tx]||m.ramps?.[ty+dy]?.[tx+dx]||m.ramps?.[ty+ey]?.[tx+ex]||m.ramps?.[ty+dy+ey]?.[tx+dx+ex];
   // Object footprints block movement, not terrain geometry. Do not suppress
    // diagonal cliff faces merely because an object contacts this cell.
    return requested>0&&!m.cornerProtected?.has(tx+','+ty)&&!ramp&&base>a&&a===b&&d<=a;
  });
  for(const [name,cx,cy,dx,dy,ex,ey] of cornerDefs){
   const index=cornerDefs.findIndex(c=>c[0]===name),a=level(m,tx+dx,ty+dy);
   // Adjacent bevels share a 32px edge: keep a 2px straight segment.
   const cut=Math.min(requested,eligible[(index+1)%4]||eligible[(index+3)%4]?15:30),bevel=eligible[index];
   if(!bevel){polygon.push([cx,cy]);continue;}
   const ends=name==='nw'?[[0,cut],[cut,0]]:name==='ne'?[[32-cut,0],[32,cut]]:name==='se'?[[32,32-cut],[32-cut,32]]:[[cut,32],[0,32-cut]];
   cuts.push({name,corner:[cx,cy],ends,lower:a,amount:cut,material:m[ty+dy]?.[tx+dx]||m[ty+ey]?.[tx+ex]||m[ty]?.[tx]});polygon.push(...ends);
  }
  return {polygon,cuts};
 }
 function removed(cut,u,v,clearance=0){return Math.abs(u-cut.corner[0])+Math.abs(v-cut.corner[1])<=cut.amount+clearance*Math.SQRT2+1e-7;}
 function height(m,x,y){const tx=Math.floor(x/CELL),ty=Math.floor(y/CELL),u=x-tx*CELL,v=y-ty*CELL;
  const cut=outline(m,tx,ty).cuts.find(c=>removed(c,u,v));return cut?cut.lower:level(m,tx,ty,u/CELL,v/CELL);
 }
 function pointWalkable(m,x,y,clearance=2){
  const tx=Math.floor(x/CELL),ty=Math.floor(y/CELL);if(!walkable(m,tx,ty))return false;
  // Also inspect the adjoining cell at an exact grid edge: the diagonal's end
  // must not become passable just because floor(x/32) selects the lower tile.
  for(let cy=ty-1;cy<=ty+1;cy++)for(let cx=tx-1;cx<=tx+1;cx++){
   const u=x-cx*CELL,v=y-cy*CELL;
   if(u<-clearance||u>CELL+clearance||v<-clearance||v>CELL+clearance||!inside(m,cx,cy))continue;
   if(outline(m,cx,cy).cuts.some(c=>removed(c,u,v,clearance)))return false;
  }return true;
 }
 function walkable(m,x,y){return inside(m,x,y)&&['grass','forest','sand','snow','barren','road','bridge'].includes(m[y][x])&&!m.occupiedTiles?.has(x+','+y);}
 function ladderBetween(m,x,y,nx,ny){return (m.ladders||[]).find(l=>(l.lower[0]===x&&l.lower[1]===y&&l.upper[0]===nx&&l.upper[1]===ny)||(l.lower[0]===nx&&l.lower[1]===ny&&l.upper[0]===x&&l.upper[1]===y))||null;}
 // Test BOTH ends of a shared edge: a ramp's side is not a traversable cliff.
 function connected(m,x,y,nx,ny){
  if(!walkable(m,x,y)||!walkable(m,nx,ny)||Math.abs(nx-x)+Math.abs(ny-y)!==1)return false;
  const dx=nx-x,dy=ny-y;
  if(dy&&ladderBetween(m,x,y,nx,ny))return true;
  for(const t of [0,.5,1]){
   const a=dx?level(m,x,y,dx>0?1:0,t):level(m,x,y,t,dy>0?1:0);
   const b=dx?level(m,nx,ny,dx>0?0:1,t):level(m,nx,ny,t,dy>0?0:1);
   if(Math.abs(a-b)>1e-6)return false;
  }return true;
 }
 // Check the whole stride, including cut corners. Reuse for manual and routed motion.
 function canMove(m,x,y,nx,ny){
  if(x!==nx&&y!==ny)return false;
  const n=Math.max(1,Math.ceil(Math.hypot(nx-x,ny-y)/2));let tx=Math.floor(x/CELL),ty=Math.floor(y/CELL);
  for(let i=0;i<=n;i++){const px=x+(nx-x)*i/n,py=y+(ny-y)*i/n,ax=Math.floor(px/CELL),ay=Math.floor(py/CELL);
   if(!pointWalkable(m,px,py))return false;
   if((ax!==tx||ay!==ty)&&!connected(m,tx,ty,ax,ay))return false;tx=ax;ty=ay;
  }return true;
 }
 function validate(m){
  const errors=[];for(let y=0;y<m.length;y++)for(let x=0;x<m[0].length;x++){
   const h=m.heights?.[y]?.[x],r=m.ramps?.[y]?.[x];
   if(!Number.isInteger(h)||h<0)errors.push('height '+x+','+y);
   if(r){const d=dirs[r];if(!d){errors.push('ramp direction '+x+','+y);continue;}
    for(const sign of [-1,1])if(!connected(m,x,y,x+d[0]*sign,y+d[1]*sign))errors.push('ramp endpoint '+x+','+y);
   }
  }return errors;
 }
 function fixture(material='mixed'){
  const m=Array.from({length:20},(_,y)=>Array.from({length:16},(_,x)=>x===0||x===15||y===0||y===19?'sea':material==='mixed'?(x<6?'grass':x<11?'sand':'snow'):material));
  m.heights=m.map(r=>r.map(()=>0));m.ramps=m.map(r=>r.map(()=>null));m.roads=new Set();m.cornerCut=30;
  for(let y=5;y<=11;y++)for(let x=3;x<=12;x++)m.heights[y][x]=1;
  for(let y=5;y<=8;y++)for(let x=6;x<=10;x++)m.heights[y][x]=2;
  m.heights[9][3]=m.heights[10][3]=0; // concave corner
  m.ramps[12][7]='n';m.ramps[9][8]='n';m.ramps[10][13]='w';
  for(let y=10;y<=17;y++)m.roads.add('7,'+y);
  for(let y=7;y<=10;y++)m.roads.add('8,'+y);
  for(let x=12;x<=14;x++)m.roads.add(x+',10');
  m.objects=[{kind:'trees',x:5*32+16,y:7*32+16,width:32,height:32,occupiedTiles:[[5,7]]},
   {kind:'shrine',x:10*32,y:8*32,width:64,height:64,occupiedTiles:[[9,6],[10,6],[9,7],[10,7]]}];
  m.occupiedTiles=new Set(m.objects.flatMap(o=>o.occupiedTiles.map(p=>p.join(','))));
  m.spawn=[7*32+16,15*32+16];return m;
 }
 return {prepare,CELL,dirs,inside,level,height,outline,pointWalkable,canMove,walkable,connected,ladderBetween,validate,fixture};
})();


