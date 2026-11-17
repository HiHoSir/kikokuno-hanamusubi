import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {villageArrivalFacing} from '../src/game/village/movement.mjs';
import {rooms,prepareInterior} from '../src/game/interiors/rooms.mjs';
import {drawFurnitureLife,FURNITURE_LIFE_EMITTERS} from '../src/game/interiors/life-effects.mjs';

const entrances=[{id:'house-southwest-tile'},{id:'house-northwest-thatch'},
  {id:'teahouse-northeast'},{id:'inn-southeast'},{id:'house-southeast-tile'}];

test('leaving an interior faces the camera; checkpoint restores retain their facing',()=>{
  for(const {id} of entrances)for(const savedFace of [0,1,2,3])
    assert.equal(villageArrivalFacing(id,entrances,savedFace),0,id+' faces south');
  for(const savedFace of [0,1,2,3])
    assert.equal(villageArrivalFacing(null,entrances,savedFace),savedFace);
  assert.equal(villageArrivalFacing('chief',entrances,3),3);
  const village=readFileSync('src/game/village/walk.mjs','utf8');
  assert.match(village,/let face = villageArrivalFacing\(focus,entrances\)/);
  assert.match(village,/!returningFromBuilding && resumed/);
  const interior=readFileSync('src/game/interiors/walk.mjs','utf8');
  assert.match(interior,/outdoor\.searchParams\.set\('focus',initial\.returnFocus\)/);
});

function collectPaints(asset,time,reduced=false,x=120,y=180){
  const pixels=[];
  const context={fillStyle:null,save(){},restore(){},
    fillRect(px,py,w,h){pixels.push({px,py,w,h,fill:this.fillStyle});}};
  drawFurnitureLife(context,{asset,x,y},time,reduced);
  return pixels;
}

test('heat and vapour animate only at real furniture sources, without canvas scaling',()=>{
  assert.deepEqual(Object.keys(FURNITURE_LIFE_EMITTERS).sort(),['hearth','kitchen','teaCounter','teaTable']);
  for(const [roomName,room] of Object.entries(rooms)){
    const plan=prepareInterior(room);
    for(const obj of plan.depthSorted.filter(x=>x.sprite)){
      const frames=collectPaints(obj.asset,0);
      if(FURNITURE_LIFE_EMITTERS[obj.asset]){
        assert.ok(frames.length>3,roomName+':'+obj.asset+' emits particles');
        assert.ok(frames.every(p=>Number.isFinite(p.px)&&Number.isFinite(p.py)&&p.w>0&&p.h>0));
      }else assert.equal(frames.length,0,roomName+':'+obj.asset+' must not emit');
    }
  }
  assert.notDeepEqual(collectPaints('hearth',0),collectPaints('hearth',180));
  assert.deepEqual(FURNITURE_LIFE_EMITTERS.kitchen,[{kind:'fire',x:58,y:115},{kind:'steam',x:56,y:48}]);
  assert.notDeepEqual(collectPaints('kitchen',0),collectPaints('kitchen',420));
  assert.notDeepEqual(collectPaints('teaCounter',0),collectPaints('teaCounter',420));
  assert.deepEqual(collectPaints('hearth',0,true),collectPaints('hearth',9000,true));
  assert.deepEqual(collectPaints('teaTable',0,true),collectPaints('teaTable',9000,true));
  const offset=collectPaints('hearth',0, false,126,194);
  const base=collectPaints('hearth',0);
  assert.deepEqual(offset.map((q,i)=>[q.px-base[i].px,q.py-base[i].py]),offset.map(()=>[6,14]),'effects follow furniture coordinates');
  const render=readFileSync('src/game/interiors/walk.mjs','utf8');
  assert.match(render,/drawFurnitureLife\(context,object,sceneTime,reducedMotion\.matches\)/);
  assert.match(render,/context\.drawImage\(furniture,\.\.\.object\.sprite,object\.x,object\.y,w,h\)/);
});
