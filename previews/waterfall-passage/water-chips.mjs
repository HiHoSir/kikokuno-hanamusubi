import {composeCoast} from '../../src/field/terrain-chips.mjs';
import {bakeHeightProjection,sampleHeights,terrainY} from '../../src/field/height-projection.mjs';

const cell=32;
function surface(width,height){
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.imageSmoothingEnabled=false;
  return context;
}

// Bake the two existing river frames in the same world coordinates as the rock,
// then place animated waterfall tiles in that world layer before camera projection.
export function prepareWaterChips(renderer,map,fall,art,image,landscape,elevation){
  const coast=composeCoast(map,landscape,art);
  const flat=surface(coast.canvas.width,coast.canvas.height);
  const heights=sampleHeights(map,elevation);
  const rock=surface(cell,cell);
  landscape.drawAsset(rock,'grassCliff',0,0,cell,cell);
  const texture=rock.getImageData(0,0,cell,cell).data;
  const max=Math.max(...map.heights.map(row=>Math.max(...row)))+1;
  const rise=terrainY(0,0)-terrainY(0,1);
  const frames=[0,360].map((time)=>{
    flat.fillStyle=flat.createPattern(landscape.motionArt('water',time),'repeat');
    flat.fillRect(0,0,flat.canvas.width,flat.canvas.height);
    flat.drawImage(coast.canvas,0,0);
    const baked=bakeHeightProjection(flat.getImageData(0,0,flat.canvas.width,flat.canvas.height),heights,texture,rise,max,64);
    const frame=surface(baked.width,baked.height);
    frame.putImageData(new ImageData(baked.pixels,baked.width,baked.height),0,0);
    return {canvas:frame.canvas,originY:baked.originY};
  });
  renderer.prepare();
  const target=renderer.staticLand.getContext('2d');
  target.imageSmoothingEnabled=false;
  const origin=frames[0].originY;
  if(renderer.info.originY!==origin||target.canvas.width!==frames[0].canvas.width||
    target.canvas.height!==frames[0].canvas.height)throw Error('水辺と崖の描画座標が一致しません');
  const left=fall.column*cell;
  const width=fall.width*cell;
  const lip=terrainY(fall.edgeRow*cell,fall.upperLevel)-origin;
  const foot=terrainY(fall.edgeRow*cell,fall.lowerLevel)-origin;
  const crop=(2*cell-(foot-lip))/2;
  const segment=cell-crop;
  let previousWater=-1,previousFall=-1;
  return function updateWater(now){
    const water=Math.floor(now/360)%frames.length;
    const phase=Math.floor(now/150)%4;
    if(water===previousWater&&phase===previousFall)return false;
    const base=frames[water].canvas;
    if(water!==previousWater)target.drawImage(base,0,0);
    else target.drawImage(base,left,lip-cell,width,foot-lip+2*cell,left,lip-cell,width,foot-lip+2*cell);
    for(let col=0;col<fall.width;col++){
      const sx=(phase*fall.width+col)*cell;
      const x=left+col*cell;
      target.drawImage(image,sx,0,cell,cell,x,lip-cell,cell,cell);
      target.drawImage(image,sx,cell+crop,cell,segment,x,lip,cell,segment);
      target.drawImage(image,sx,2*cell,cell,segment,x,lip+segment,cell,segment);
      target.drawImage(image,sx,3*cell,cell,cell,x,foot,cell,cell);
    }
    previousWater=water;
    previousFall=phase;
    return true;
  };
}
