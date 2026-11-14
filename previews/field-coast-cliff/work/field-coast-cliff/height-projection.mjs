const cell=32;
// Relief uses map pixels, in the same coordinates as actor and object feet.
export const risePerLevel=30;
export const terrainY=(y,height,rise=risePerLevel)=>y-height*rise;
const samplesPerLevel=64;
const clipBucketWidth=32;

export function sampleHeights(map,elevation) {
 const width=map[0].length*cell;
 const samples=new Uint16Array(width*map.length*cell);
 for(let ty=0;ty<map.length;ty++)for(let tx=0;tx<map[ty].length;tx++){
  const start=ty*cell*width+tx*cell;
  const base=map.heights[ty][tx];
  const {cuts}=elevation.outline(map,tx,ty);
  if(!map.ramps[ty][tx]&&!cuts.length){
   if(base)for(let v=0;v<cell;v++)samples.fill(base*samplesPerLevel,start+v*width,start+v*width+cell);
   continue;
  }
  for(let v=0;v<cell;v++)for(let u=0;u<cell;u++){
   const x=tx*cell+u+.5,y=ty*cell+v+.5;
   samples[start+v*width+u]=elevation.height(map,x,y)*samplesPerLevel;
  }
 }
 return samples;
}

// Depth is the unshifted map row of the visible surface. Horizontal runs
// retain the cliff silhouettes for sprite clipping without a per-frame readback.
function depthRuns(depth,width,height,originY) {
 const rows=[],columns=Math.ceil(width/clipBucketWidth);
 const maxDepth=new Uint16Array(columns*Math.ceil(height/clipBucketWidth));
 for(let v=0;v<height;v++){
  const start=v*width,buckets=[],block=Math.floor(v/clipBucketWidth)*columns;
  for(let x=0;x<width;){
   const foot=depth[start+x];
   let end=x+1;
   while(end<width&&depth[start+end]===foot)end++;
   if(foot>v+originY+1&&foot>0){
    for(let part=x;part<end;){
     const column=Math.floor(part/clipBucketWidth);
     const stop=Math.min(end,(column+1)*clipBucketWidth);
     const bucket=buckets[column]??(buckets[column]={max:0,runs:[]});
     bucket.runs.push(part,stop,foot);
     bucket.max=Math.max(bucket.max,foot);
     maxDepth[block+column]=Math.max(maxDepth[block+column],foot);
     part=stop;
    }
   }
   x=end;
  }
  rows.push(buckets);
 }
 return {rows,columns,maxDepth};
}

export function bakeHeightProjection({width,height,data},levels,rock,rise,maxLevel,levelScale=1) {
 const originY=-maxLevel*rise;
 const projectedHeight=height-originY;
 const pixels=new Uint8ClampedArray(width*projectedHeight*4);
 const depth=new Uint16Array(width*projectedHeight);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,src=i*4;
  if(!data[src+3])continue;
  const h=levels[i]/levelScale,destY=Math.round(terrainY(y,h,rise));
  const next=i+width;
  const lower=next<levels.length&&data[next*4+3]?levels[next]/levelScale:0;
  const bottom=Math.min(height,Math.round(terrainY(y+1,lower,rise)));
  const wall=h-lower>.15;
  const span=bottom-destY;
  for(let v=destY;v<Math.max(destY+1,bottom);v++){
   const dst=(v-originY)*width+x;
   const p=dst*4;
   if(v===destY||!wall){
    pixels[p]=data[src];pixels[p+1]=data[src+1];pixels[p+2]=data[src+2];pixels[p+3]=data[src+3];
    depth[dst]=data[src+3]>=128?y+1:0;
   }else{
    const d=v-destY;
    const shade=d<=2?1.12:d>=span-2?.60:.97-.21*d/span;
    const face=((d%cell)*cell+x%cell)*4;
    pixels[p]=rock[face]*shade;pixels[p+1]=rock[face+1]*shade;pixels[p+2]=rock[face+2]*shade;pixels[p+3]=255;
    depth[dst]=y+1;
   }
  }
 }
 return {pixels,width,height:projectedHeight,originY,terrainDepth:depthRuns(depth,width,projectedHeight,originY)};
}

export function composeRaisedTerrain(map,landscape,art,compose,elevation) {
 const started=performance.now();
 const base=compose(map,landscape,art,null,{relief:false});
 const context=base.canvas.getContext('2d');
 const {width,height}=base.canvas;
 const flat=context.getImageData(0,0,width,height);
 base.canvas.width=1;
 base.canvas.height=1;
 const rock=document.createElement('canvas');
 rock.width=rock.height=cell;
 const surface=rock.getContext('2d');
 landscape.drawAsset(surface,'grassCliff',0,0,cell,cell);
 const texture=surface.getImageData(0,0,cell,cell).data;
 const maxLevel=map.heights.reduce((max,row)=>Math.max(max,...row),0)+1;
 const baked=bakeHeightProjection(flat,sampleHeights(map,elevation),texture,risePerLevel,maxLevel,samplesPerLevel);
 const canvas=document.createElement('canvas');
 canvas.width=baked.width;
 canvas.height=baked.height;
 const out=canvas.getContext('2d');
 out.putImageData(new ImageData(baked.pixels,baked.width,baked.height),0,0);
 for(const {lower:[x,y],upper:[ux,uy]} of map.ladders||[]){
  const lip=terrainY(y*cell,elevation.level(map,ux,uy));
  const foot=terrainY(y*cell,elevation.level(map,x,y));
  landscape.drawAsset(out,'ladder',x*cell+8,lip-baked.originY-3,16,foot-lip+13);
 }
 return {...base,canvas,originY:baked.originY,terrainDepth:baked.terrainDepth,buildMs:performance.now()-started};
}

// Apply the same strip projection as the terrain texture. Each rectangle
// removes just the area where a nearer surface covers the sprite.
export function clipAtTerrain(context,terrainDepth,originY,strips,{x,y,width,height,foot}) {
 const {rows,columns,maxDepth}=terrainDepth;
 const firstStrip=Math.max(0,Math.floor((y-strips[0].sy)/4));
 const lastStrip=Math.min(strips.length-1,Math.ceil((y+height-strips[0].sy)/4)-1);
 if(firstStrip>lastStrip)return false;
 // Perspective widens monotonically. The outer strips bound the sprite's
 // world rectangle so most sprites can skip checking individual depth runs.
 const top=strips[firstStrip],bottom=strips[lastStrip];
 const leftEdge=Math.min(top.ax+x/top.sx,bottom.ax+x/bottom.sx);
 const rightEdge=Math.max(top.ax+(x+width)/top.sx,bottom.ax+(x+width)/bottom.sx);
 const leftColumn=Math.max(0,Math.floor(leftEdge/clipBucketWidth));
 const rightColumn=Math.min(columns,Math.ceil(rightEdge/clipBucketWidth));
 const topRow=Math.max(0,Math.floor((top.ay-originY)/clipBucketWidth));
 const bottomRow=Math.min(maxDepth.length/columns,Math.ceil((bottom.dy-originY)/clipBucketWidth));
 let mayBeHidden=false;
 for(let row=topRow;row<bottomRow&&!mayBeHidden;row++)for(let column=leftColumn;column<rightColumn;column++){
  if(maxDepth[row*columns+column]>foot){mayBeHidden=true;break;}
 }
 if(!mayBeHidden)return false;
 let clipped=false;
 for(let i=firstStrip;i<=lastStrip;i++){
  const {ax,ay,dy,sx,ys,sy,sh}=strips[i];
  const left=ax+x/sx,right=ax+(x+width)/sx;
  const first=Math.max(originY,Math.floor(ay+(Math.max(y,sy)-sy)/ys));
  const end=Math.min(originY+rows.length,Math.ceil(ay+(Math.min(y+height,sy+sh)-sy)/ys),Math.ceil(dy));
  const startColumn=Math.max(0,Math.floor(left/clipBucketWidth));
  const endColumn=Math.ceil(right/clipBucketWidth);
  for(let v=first;v<end;v++){
   const row=rows[v-originY];
   const columns=Math.min(endColumn,row.length);
   for(let column=startColumn;column<columns;column++){
    const bucket=row[column];
    if(!bucket||bucket.max<=foot)continue;
    for(let j=0;j<bucket.runs.length;j+=3){
     const a=bucket.runs[j],b=bucket.runs[j+1],depth=bucket.runs[j+2];
     if(a>=right)break;
     if(b<=left||depth<=foot)continue;
     const x0=(Math.max(a,left)-ax)*sx,x1=(Math.min(b,right)-ax)*sx;
     const y0=Math.max(y,sy,sy+(v-ay)*ys),y1=Math.min(y+height,sy+sh,sy+(v+1-ay)*ys);
     if(y1<=y0)continue;
     if(!clipped){
      context.save();
      context.beginPath();
      context.rect(x,y,width,height);
      clipped=true;
     }
     context.rect(x0,y0,x1-x0,y1-y0);
    }
   }
  }
 }
 if(clipped)context.clip('evenodd');
 return clipped;
}
