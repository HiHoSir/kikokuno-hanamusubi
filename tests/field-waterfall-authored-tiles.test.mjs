import assert from 'node:assert/strict';
import {test} from 'node:test';
import {drawWaterfallChips} from '../src/field/terrain-chips.mjs';
const atlas={width:512,height:128};
const layer=()=>({tileSize:32,frameCount:4,frameDurationMs:180,frameSize:[128,128],origin:[65,16],
 tiles:Array.from({length:16},(_,i)=>{
  const col=i%4,row=Math.floor(i/4);
  return {cell:[65+col,16+row],atlas:[col,row]};
 })});
const drawAt=(time,visible)=>{
 const calls=[],c={drawImage:(...args)=>calls.push(args)};
 return {drawn:drawWaterfallChips(c,atlas,layer(),time,(x,y)=>({x:x/2,y:y/2}),visible),calls};
};
test('approved waterfall atlas yields sixteen separate map chips in each of four frames',()=>{
 const frames=[0,180,360,540,720].map(t=>drawAt(t));
 assert.deepEqual(frames.map(f=>f.drawn),[16,16,16,16,16]);
 assert.ok(frames.every(f=>f.calls.every(c=>c[0]===atlas&&c[3]===32&&c[4]===32)));
 assert.deepEqual(frames.map(f=>f.calls[0].slice(1,5)),
  [[0,0,32,32],[128,0,32,32],[256,0,32,32],[384,0,32,32],[0,0,32,32]]);
 assert.deepEqual(frames[0].calls[15].slice(1,5),[96,96,32,32]);
 assert.deepEqual(frames[0].calls,frames[4].calls,'four-frame loop is seamless');
});
test('waterfall tile placement culls offscreen tiles without adding collision',()=>{
 assert.equal(drawAt(0,x=>x<65*16+16).drawn,4);
 assert.throws(()=>drawWaterfallChips({drawImage(){}},{width:160,height:96},layer(),0,
   (x,y)=>({x,y})),/Invalid authored waterfall atlas/);
 const bad=layer();bad.tiles[0].atlas=[4,0];
 assert.throws(()=>drawWaterfallChips({drawImage(){}},atlas,bad,0,
   (x,y)=>({x,y})),/Invalid waterfall 32px map tile/);
});
