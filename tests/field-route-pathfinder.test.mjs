import test from 'node:test';
import assert from 'node:assert/strict';
import {traceFieldRoute,replayMovementPath,battleIntervalEnvelope} from '../tools/field-route-pathfinder.mjs';

const fixture=()=>{
 const size=32,side=8,blocked=new Set(['3,1','3,0','3,2']);
 const tile=(x,y)=>[Math.floor(x/size),Math.floor(y/size)];
 const open=(x,y)=>{
   const [tx,ty]=tile(x,y);
   return tx>0&&ty>0&&tx<7&&ty<7&&!blocked.has(tx+','+ty);
 };
 const world={
   size:size*side,tileSize:size,walkable:open,
   canMove:(x,y,nx,ny)=>{
     const [cx,cy]=tile(x,y),[tx,ty]=tile(nx,ny);
     return open(x,y)&&open(nx,ny)&&Math.abs(tx-cx)+Math.abs(ty-cy)===1;
   }
 };
 const contact=(x,y)=>{
   const [tx,ty]=tile(x,y);
   return tx===5&&ty===1?'shrine':tx===5&&ty===5?'cove':null;
 };
 const fieldStep=(state,dx,dy)=>{
   const x=state.x+dx*size,y=state.y+dy*size;
   return world.canMove(state.x,state.y,x,y)?{x,y}:null;
 };
 return {world,contact,fieldStep};
};

test('route audit follows only four-direction movement under collisions',()=>{
 const {world,contact,fieldStep}=fixture();
 const result=traceFieldRoute({world,from:[1*32+16,1*32+16],
   destination:'shrine',contact});
 assert.equal(result.reachable,true);
 assert.equal(result.steps,8,
   'a three-cell barrier should force a detour below it');
 assert.deepEqual(result.fromCell,[1,1]);
 assert.deepEqual(result.toCell,[5,1]);
 assert.ok(result.path.every(([x,y],i,p)=>!i||
   Math.abs(x-p[i-1][0])+Math.abs(y-p[i-1][1])===1));
 assert.deepEqual(replayMovementPath({path:result.path,fieldStep}),
   {success:true,steps:8,arrival:[5*32+16,1*32+16]});
});

test('a path cannot claim a destination merely because reference road metadata contains it',()=>{
 const {world,contact}=fixture();
 const missing=traceFieldRoute({world,from:[48,48],
   destination:'fox',contact});
 assert.equal(missing.reachable,false);
 assert.equal(missing.reason,'no-walkable-route');
 assert.equal(missing.steps,null);
});

test('route and replay reject inaccessible locations and fabricated diagonal steps',()=>{
 const {world,contact,fieldStep}=fixture();
 const blocked=traceFieldRoute({world,from:[3*32+16,1*32+16],
   destination:'shrine',contact});
 assert.equal(blocked.reachable,false);
 assert.equal(blocked.reason,'start-not-walkable');
 assert.deepEqual(replayMovementPath({path:[[1,1],[2,2]],fieldStep}),
   {success:false,at:1,reason:'non-cardinal-edge'});
 assert.deepEqual(replayMovementPath({path:[[2,1],[3,1]],fieldStep}),
   {success:false,at:1,reason:'actual-fieldStep-blocked',
    from:[80,48],expected:[112,48],actual:null});
 assert.equal(traceFieldRoute({world,from:[48,48],destination:'shrine',contact,maxVisits:1}).reason,
   'visit-limit');
});

test('step-based encounter estimates are explicitly envelopes, not simulated battles',()=>{
 assert.deepEqual(battleIntervalEnvelope(42),{
   minimum:3,maximum:4,assumes:'uninterrupted-moving-field-steps'});
 assert.deepEqual(battleIntervalEnvelope(8),{
   minimum:0,maximum:0,assumes:'uninterrupted-moving-field-steps'});
 assert.throws(()=>battleIntervalEnvelope(-1),/Invalid/);
 assert.throws(()=>battleIntervalEnvelope(15,0,13),/Invalid/);
});
