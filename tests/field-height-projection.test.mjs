import test from 'node:test';
import assert from 'node:assert/strict';
import {bakeHeightProjection,clipAtTerrain,terrainY} from '../src/field/height-projection.mjs';

const grass=[129,175,71,255];
const rock=new Uint8ClampedArray(32*32*4).fill(80);
function fixture(levelAt,opaque=()=>true) {
  const width=40,height=48;
  const levels=new Float32Array(width*height);
  const data=new Uint8ClampedArray(levels.length*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=y*width+x;
    levels[index]=levelAt(x,y);
    if(opaque(x,y))data.set(grass,index*4);
  }
  const baked=bakeHeightProjection({width,height,data},levels,rock,10,2);
  return {...baked,at:(x,y)=>Array.from(baked.pixels.subarray((x+(y-baked.originY)*width)*4,(x+(y-baked.originY)*width)*4+4))};
}

test('plateau edges are shaded at the sampled height cuts, including diagonal corners',()=>{
  const plateau=(x,y)=>+(x>=8&&x<=31&&y>=24&&y<=44);
  const {at}=fixture(plateau);
  assert.ok(at(19,terrainY(24,1,10))[1]<130);
  assert.ok(at(8,terrainY(34,1,10))[1]<130);
  assert.ok(at(31,terrainY(34,1,10))[1]<130);
  assert.deepEqual(at(19,terrainY(34,1,10)),grass);
  assert.deepEqual(at(19,terrainY(44,1,10)),grass);
  assert.notDeepEqual(at(19,44),grass,'the lower margin still lies on the cliff');
  assert.deepEqual(at(19,45),grass,'low ground resumes below the face');
  const diagonal=fixture((x,y)=>+(y>=24+Math.max(0,x-20)));
  assert.ok(diagonal.at(24,terrainY(28,1,10))[1]<130);
  const ramp=fixture((x,y)=>Math.max(0,Math.min(1,(y-19)/32)));
  assert.deepEqual(ramp.at(19,Math.round(terrainY(23,4/32,10))),grass);
  const shore=fixture(plateau,(x,y)=>y>=24);
  assert.deepEqual(shore.at(19,terrainY(24,1,10)),grass);
  assert.equal(shore.at(19,terrainY(24,1,10)-1)[3],0);
});

test('only nearer raised terrain clips a sprite at the projected surface',()=>{
  const terrain=fixture((x,y)=>+(x>=8&&x<16&&y>=24&&y<=27));
  const calls=[];
  const context=Object.fromEntries(['save','beginPath','rect','clip'].map(method=>[method,(...args)=>calls.push([method,...args])]));
  const strips=[{ax:0,ay:14,dy:18,sx:1,ys:1,sy:0,sh:4}];
  const sprite={x:4,y:0,width:10,height:4,foot:19};
  assert.equal(clipAtTerrain(context,terrain.terrainDepth,terrain.originY,strips,sprite),true);
  assert.deepEqual(calls.filter(([method])=>method==='rect'),[
    ['rect',4,0,10,4],['rect',8,0,6,1],['rect',8,1,6,1],['rect',8,2,6,1],['rect',8,3,6,1],
  ]);
  assert.equal(clipAtTerrain(context,terrain.terrainDepth,terrain.originY,strips,{...sprite,foot:28}),false);
});
