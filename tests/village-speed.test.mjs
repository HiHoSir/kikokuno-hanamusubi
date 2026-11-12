import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HIZUKI_WALK_SPEED,HIZUKI_INTERIOR_WALK_SPEED,makeWalk,touchedEntrance,crossesSouthExit} from '../src/game/village/movement.mjs';
import {drawCharacter} from '../src/game/village/residents.mjs';

test('village moves about 64% faster, indoor pace stays unchanged and field has independent movement',()=>{
  assert.equal(HIZUKI_WALK_SPEED,288);
  assert.equal(HIZUKI_INTERIOR_WALK_SPEED,176);
  const village=readFileSync('src/game/village/walk.mjs','utf8');
  const interior=readFileSync('src/game/interiors/walk.mjs','utf8');
  const html=readFileSync('src/game/village/index.html','utf8');
  assert.match(village,/HIZUKI_WALK_SPEED\*elapsed\/1000/);
  assert.match(interior,/HIZUKI_INTERIOR_WALK_SPEED\*elapsed\/1000/);
  assert.match(html,/village-speed-288/);
  assert.match(village,/movement\.mjs\?v=village-speed-288/);
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
  // Higher velocity reaches the next frame earlier, with the same 14-pixel stride.
  assert.ok((14/HIZUKI_WALK_SPEED*1000)<(14/176*1000));
});

test('increased speed still checks collisions at subpixel-sized intervals',()=>{
  const width=120,height=100,blocked=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=60;x<width;x++)blocked[y*width+x]=1;
  const walk=makeWalk(width,height,blocked,8);
  let [x,y]=[40,50];
  const distancePerFrame=HIZUKI_WALK_SPEED*40/1000;
  for(let i=0;i<8;i++)[x,y]=walk.move(x,y,distancePerFrame,0);
  assert.ok(x<=52.1&&x>50,'collision stops against wall even at faster pace');
  assert.equal(y,50);
  assert.equal(walk.canStand(70,50),false);
  const occupied=(px,py)=>Math.abs(px-45)<.75&&Math.abs(py-50)<.75;
  const [limited]=walk.move(40,50,distancePerFrame,0,occupied);
  assert.ok(limited<45,'NPC collision should not be skipped during a single frame');
});

test('a fast step still triggers door contact and south-field exit thresholds',()=>{
  const marker={entrance:[100,60,40,20]};
  const speedStep=HIZUKI_WALK_SPEED*40/1000;
  const doors=touchedEntrance([marker],120,85,120,85-speedStep,8);
  assert.equal(doors,marker);
  const exit={southExit:[100,90,40]};
  assert.equal(crossesSouthExit(exit,120,85,120,85+speedStep),true);
  assert.equal(crossesSouthExit(exit,145,85,145,85+speedStep),false);
});
