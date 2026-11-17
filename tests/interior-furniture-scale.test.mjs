import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {furniture, rooms, prepareInterior} from '../src/game/interiors/rooms.mjs';

const expected = [
  'teaCounter','teaTable','blueFuton','redFuton','weaponRack','merchantShelf',
  'hearth','tansu','kitchen','supplies','weaponCounter','cushion',
  'shopCounter','innCounter','workbench','shoeRack',
];

function pngSize(path) {
  const buffer=readFileSync(path);
  assert.equal(buffer.subarray(1,4).toString(), 'PNG');
  return [buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
}

test('all 16 furniture objects have independent native sizes and contact footprints',()=>{
  assert.deepEqual(Object.keys(furniture),expected);
  for(const [name,{sprite,foot}] of Object.entries(furniture)){
    const [atlasX,atlasY,w,h] = sprite;
    assert.ok(w>0 && h>0 && w<=248 && h<=176, name+' sprite fits own cell');
    assert.equal(atlasX%248,0,name+' atlas column');
    assert.equal(atlasY%176,0,name+' atlas row');
    assert.equal(w%2,0,name+' width uses 2px grid');
    assert.equal(h%2,0,name+' height uses 2px grid');
    if(foot){
      const [fx,fy,fw,fh]=foot;
      assert.ok(fx>=0 && fy>=0 && fw>0 && fh>0,name+' contact rectangle exists');
      assert.ok(fx+fw<=w && fy+fh<=h,name+' collision stays inside drawn sprite');
    }
  }
  // A chest should not exceed the 80x112 hero frame by a large factor.
  assert.deepEqual(furniture.tansu.sprite.slice(2),[120,108]);
  assert.deepEqual(furniture.tansu.foot,[6,72,108,30]);
  assert.deepEqual(pngSize('source-assets/village/interiors/furniture-master.png'),[448,352]);
  assert.deepEqual(pngSize('assets/village/interiors/furniture.png'),[896,704]);
});

test('furniture proportions correspond to objects, not one-size-fits-all boxes',()=>{
  for(const key of ['teaCounter','weaponCounter','shopCounter','innCounter']){
    const [, ,w,h]=furniture[key].sprite;
    assert.ok(w>=h*1.5,`${key} is a horizontally oriented counter`);
  }
  for(const key of ['blueFuton','redFuton']){
    const [, ,w,h]=furniture[key].sprite;
    assert.ok(h>w,`${key} is a lengthwise floor futon`);
  }
  for(const key of ['weaponRack','merchantShelf']){
    const [, ,w,h]=furniture[key].sprite;
    assert.ok(h>=w,`${key} is an upright rack`);
  }
});

test('each authored room resolves furniture collision and NPC counters without a detached anchor',()=>{
  for(const [roomName,room] of Object.entries(rooms)){
    const plan=prepareInterior(room);
    assert.equal(plan.depthSorted.filter(x=>x.sprite).length,room.furniture.length,roomName);
    for(const object of plan.depthSorted.filter(x=>x.sprite)){
      const [width,height]=object.sprite.slice(2);
      assert.equal(object.depth,object.footprint
        ? object.footprint[1]+object.footprint[3] : object.y+height,roomName);
      assert.ok(object.x>=0 && object.x+width<=room.width,roomName+' sprite within room width');
      assert.ok(object.y>=0 && object.y+height<=room.height,roomName+' sprite within room height');
    }
    const [spawnX,spawnY]=plan.spawn;
    assert.equal(plan.blocked[Math.floor(spawnY)*room.width+Math.floor(spawnX)],0,roomName+' exit/spawn remains walkable');
    assert.ok(plan.resident.x>0 && plan.resident.x<room.width,roomName);
  }
});