import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hizukiWalkDistance,makeWalk,touchedEntrance} from '../src/game/village/movement.mjs';
import {WORLD_SCENE_ZOOM} from '../src/game/ui/world-scale.mjs';
import {makeVillageFence} from '../src/game/village/boundary.mjs';
import {drawCharacter,walkFrame} from '../src/game/village/residents.mjs';

test('villages, rooms, cove and shrine use the same walking pace at their gameplay zoom',()=>{
  assert.equal(hizukiWalkDistance(1000)*WORLD_SCENE_ZOOM,144);
  assert.equal(hizukiWalkDistance(1000,1),144);
  assert.equal(hizukiWalkDistance(250),72);
  for(const path of ['village/walk','interiors/walk','shiomachi/walk','shiomachi/interior-preview','cove/walk']){
    const scene=readFileSync('src/game/'+path+'.mjs','utf8');
    assert.match(scene,/hizukiWalkDistance\((elapsed|dt)\)/,path);
  }
  const shrine=readFileSync('src/game/tenyo/walk.mjs','utf8');
  assert.match(shrine,/hizukiWalkDistance\(elapsedMs,TENYO_APPROVED_CAMERA\)/);
  assert.match(shrine,/walkFrame\(state.distance,state.moving,TENYO_APPROVED_CAMERA\)/);
});

test('walking animation strides are tied to real distance instead of elapsed time',()=>{
  const recorded=[];
  const ctx={drawImage:(...args)=>recorded.push(args)};
  const sprite={bitmap:{},x:300,y:320,face:0,distance:0,moving:true};
  drawCharacter(ctx,sprite);
  sprite.distance=14;
  drawCharacter(ctx,sprite);
  sprite.distance=28;
  drawCharacter(ctx,sprite);
  sprite.distance=42;
  drawCharacter(ctx,sprite);
  assert.deepEqual(recorded.map(args=>args[1]),[80,0,160,0]);
  assert.deepEqual(recorded.map(args=>args.slice(5)),Array.from({length:4},()=>[260,214,80,112]));
  assert.deepEqual([0,7,14,21].map(distance=>walkFrame(distance,true,1)),[1,0,2,0]);
  assert.equal(walkFrame(14,false,1),0);
});

test('increased speed still checks collisions at subpixel-sized intervals',()=>{
  const width=120,height=100,blocked=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=60;x<width;x++)blocked[y*width+x]=1;
  const walk=makeWalk(width,height,blocked,8);
  let [x,y]=[40,50];
  const distancePerFrame=hizukiWalkDistance(40);
  for(let i=0;i<8;i++)[x,y]=walk.move(x,y,distancePerFrame,0);
  assert.ok(x<=52.1&&x>50,'collision stops against wall even at faster pace');
  assert.equal(y,50);
  assert.equal(walk.canStand(70,50),false);
  const occupied=(px,py)=>Math.abs(px-45)<.75&&Math.abs(py-50)<.75;
  const [limited]=walk.move(40,50,distancePerFrame,0,occupied);
  assert.ok(limited<45,'NPC collision should not be skipped during a single frame');
});

test('a fast step still triggers contact with an interior door',()=>{
  const marker={entrance:[100,60,40,20]};
  const speedStep=hizukiWalkDistance(40);
  const doors=touchedEntrance([marker],120,85,120,85-speedStep,8);
  assert.equal(doors,marker);
});

test('a village can exit at any clear map edge; fences, water and indoor bounds stop movement',()=>{
  const width=128,height=96,blocked=new Uint8Array(width*height);
  makeVillageFence([[0,2,1,2]],blocked,width);
  for(let y=0;y<20;y++)blocked.fill(1,y*width,y*width+width);
  const walk=makeWalk(width,height,blocked,8);
  assert.equal(walk.move(100,84,0,8,null,true)[2],undefined,'inside map');
  assert.equal(walk.move(100,88,0,10,null,true)[2],true,'south opening');
  assert.equal(walk.move(8,48,-10,0,null,true)[2],true,'unfenced west edge');
  assert.equal(walk.move(120,48,10,0,null,true)[2],true,'unfenced east edge');
  assert.equal(walk.move(24,63,0,40,null,true)[2],undefined,'wooden fence');
  assert.equal(walk.move(100,32,0,-40,null,true)[2],undefined,'water');
  assert.equal(walk.move(100,84,0,30)[2],undefined,'ordinary movement remains bounded');
  assert.equal(walk.canStand(100,95,true),true,'a save near the dry edge is valid');
  assert.equal(walk.canStand(100,96,true),false,'a save beyond the map is invalid');
});
