import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawWaterfallChips} from '../src/field/terrain-chips.mjs';

const layout=()=>({tileSize:32,frameSize:[80,96],heightLevel:1,
 tiles:Array.from({length:9},(_,i)=>{
  const col=i%3,row=Math.floor(i/3);
  return {cell:[66+col,16+row],source:[col*32,row*32,col===2?16:32,32],
   role:row===0?'lip':row===2?'pool':'fall'};
 })});

test('waterfall is nine separately projected animated map chips',()=>{
 const calls=[],ctx={drawImage:(...args)=>calls.push(args)},frame={width:80,height:96};
 assert.equal(drawWaterfallChips(ctx,frame,layout(),(x,y)=>({x:x/2,y:y/2})),9);
 assert.equal(calls.length,9);
 assert.ok(calls.every(a=>a.length===9&&a[0]===frame));
 assert.deepEqual(calls[0].slice(1,5),[0,0,32,32]);
 assert.deepEqual(calls[8].slice(1,5),[64,64,16,32]);
 assert.equal(calls.reduce((sum,a)=>sum+a[3]*a[4],0),80*96);
});
test('waterfall tile culling and cell dimensions remain bounded',()=>{
 const calls=[],ctx={drawImage:(...args)=>calls.push(args)},frame={},layer=layout();
 assert.equal(drawWaterfallChips(ctx,frame,layer,(x,y)=>({x,y}),x=>x<66*32+32),3);
 layer.tiles[0].source[2]=33;
 assert.throws(()=>drawWaterfallChips(ctx,frame,layer,(x,y)=>({x,y})),/Invalid 32px waterfall map chip/);
});
