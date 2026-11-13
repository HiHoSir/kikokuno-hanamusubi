import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {villageRooms,rooms,resolveInterior} from '../src/game/interiors/rooms.mjs';

const scene=JSON.parse(readFileSync('data/maps/hozuki-village/scene.json','utf8'));
const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
const pair=[
  {building:'teahouse-northeast',id:'sign-teahouse-northeast',file:'sign-teahouse.png',label:'茶',room:'teahouse'},
  {building:'inn-southeast',id:'sign-inn-southeast',file:'sign-inn.png',label:'宿',room:'inn'}
];

test('storefront signs are native-size PNG layers tied to existing enterable buildings',()=>{
  assert.equal(scene.sprites.filter(s=>s.signFor).length,2);
  assert.ok(scene.sprites.every((s,i)=>i===0||s.depth>=scene.sprites[i-1].depth));
  for(const {building,id,file,label,room} of pair){
    const owner=scene.sprites.find(s=>s.id===building),sign=scene.sprites.find(s=>s.id===id);
    const marker=scene.markers.find(m=>m.id===building);
    assert.ok(owner?.eave&&marker?.entrance,'missing established door for '+building);
    assert.equal(villageRooms[building],room);
    assert.equal(resolveInterior(new URLSearchParams('building='+building)).selected,room);
    assert.equal(rooms[room].name,building.startsWith('inn')?'宿':'茶店');
    assert.equal(sign.signFor,building);
    assert.equal(sign.symbol,label);
    assert.equal(sign.file,file);
    assert.deepEqual(sign.size,[96,120]);
    assert.ok(sign.depth>owner.depth,'sign should render on building facade');
    assert.ok(sign.point[0]>=owner.point[0]&&sign.point[0]+96<=owner.point[0]+owner.size[0]);
    assert.ok(sign.point[1]>=owner.point[1]&&sign.point[1]+120<=owner.point[1]+owner.size[1]);
    const [ex,ey,ew,eh]=marker.entrance;
    const [sx,sy]=sign.point;
    assert.ok(sy+120<=ey||sx+96<=ex||sx>=ex+ew,'sign must not cover entry trigger');
    const path='assets/village/scene/'+file;
    const item=manifest.assets.find(a=>a.path===path);
    assert.equal(item?.id,'village-shop-sign-'+room);
    assert.equal(item?.buildingId,building);
    assert.equal(item?.status,'approved');
    assert.ok(existsSync(path));
    const png=readFileSync(path);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(png.readUInt32BE(16),96);
    assert.equal(png.readUInt32BE(20),120);
    assert.equal(png[25],6,'RGBA PNG must preserve transparency');
  }
});

test('shop-only interior definitions remain unlinked until actual outside shops exist',()=>{
  const marks=scene.markers.filter(m=>m.entrance);
  assert.equal(marks.length,9,'do not repurpose or add fictitious existing homes');
  assert.ok(!Object.values(villageRooms).includes('armory'));
  assert.ok(!Object.values(villageRooms).includes('shop'));
  assert.ok(rooms.armory&&rooms.shop);
  const walk=readFileSync('src/game/village/walk.mjs','utf8');
  const entry=readFileSync('src/game/village/index.html','utf8');
  assert.ok(walk.includes("'../../../data/maps/hozuki-village/scene.json?v=shop-signs-1'"));
  assert.ok(entry.includes('./walk.mjs?v=fb40c1b-20261112-village-speed-288-shop-signs-1'));
  assert.ok(walk.includes('data.sprites.flatMap'));
  assert.ok(walk.includes('art.get(sprite.file)'));
});
