import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {HIZUKI_WALK_SPEED, makeWalk, touchedEntrance} from '../previews/village-walk/movement.mjs';
import {residentInFront} from '../previews/village-walk/residents.mjs';

const preview = new URL('../previews/village-interiors/', import.meta.url);

test('each interior has a walkable entrance, exit and path to every room destination', async () => {
  const {rooms, prepareInterior} = await import(new URL('rooms.mjs', preview));
  assert.equal(Object.keys(rooms).length, 7);
  for (const room of Object.values(rooms)) {
    const {blocked, spawn, exitY, doorway, destinations, resident} = prepareInterior(room);
    const walk = makeWalk(room.width, room.height, blocked, 8);
    assert.equal(walk.canStand(...spawn), true, room.name);
    assert.equal(walk.canStand(doorway, exitY), true, room.name);
    assert.equal(walk.canStand(doorway + 48, exitY), false, room.name);
    const seen = new Set([spawn.join(',')]);
    const queue = [spawn];
    for (const [x, y] of queue) {
      for (const [dx, dy] of [[4,0],[-4,0],[0,4],[0,-4]]) {
        const nx = x+dx, ny = y+dy, key = [nx,ny].join(',');
        if (seen.has(key)) continue;
        const [endX, endY] = walk.move(x,y,dx,dy);
        if (endX !== nx || endY !== ny) continue;
        seen.add(key);
        queue.push([nx,ny]);
      }
    }
    assert.ok(seen.has([doorway, exitY].join(',')), room.name+' exit');
    for (const point of destinations) assert.ok(seen.has(point.join(',')), room.name+' '+point);
    assert.ok(resident?.lines.length, room.name);
    assert.equal(walk.canStand(resident.x,resident.y),false,room.name+' resident footprint');
    assert.ok(queue.some(([x,y])=>[0,1,2,3].some(face=>residentInFront(x,y,face,[resident]))),room.name+' reachable resident');
  }
});

test('the four commercial rooms share one clerk and face the public side of the counter', async () => {
  const {rooms,prepareInterior}=await import(new URL('rooms.mjs',preview));
  const clerks=['teahouse','shop','inn','armory'].map(id=>prepareInterior(rooms[id]).resident);
  assert.deepEqual(new Set(clerks.map(npc=>npc.asset)),new Set(['shop-clerk']));
  for(const npc of clerks){
    const [x,y]=npc.talkPoint;
    assert.equal(residentInFront(x,y+22,1,[npc]),npc);
    assert.equal(residentInFront(x,y-22,0,[npc]),undefined);
    assert.ok(npc.y<y);
  }
});

test('walking reaches a door only on contact from the front at the shared faster speed', () => {
  assert.equal(HIZUKI_WALK_SPEED,176);
  const door={id:'tea',entrance:[100,200,48,8]};
  assert.equal(touchedEntrance([door],124,234,124,229,8),undefined);
  assert.equal(touchedEntrance([door],124,221,124,215,8),door);
  assert.equal(touchedEntrance([door],124,215,124,221,8),undefined);
  assert.equal(touchedEntrance([door],99,214,103,214,8),undefined);
  assert.equal(touchedEntrance([door],96,221,96,215,8),undefined);
});

test('village entrances reuse interior plans and return to their own entrance marker', async () => {
  const {rooms, villageRooms, resolveInterior} = await import(new URL('rooms.mjs', preview));
  const village = JSON.parse(readFileSync(new URL('../village-walk/map/scene.json', preview)));
  const entrances = village.markers.filter(marker => marker.entrance);
  assert.equal(entrances.length, 9);
  for (const {id} of entrances) {
    assert.ok(Object.hasOwn(rooms,villageRooms[id]),id);
    const result = resolveInterior(new URLSearchParams({building:id,room:'armory'}));
    assert.equal(result.room, rooms[villageRooms[id]], id);
    assert.equal(result.returnFocus, id);
  }
  assert.equal(resolveInterior(new URLSearchParams('building=unknown&room=armory')).room, rooms.armory);
  assert.equal(resolveInterior(new URLSearchParams('room=__proto__')).room, rooms.teahouse);
});

test('tatami plans use full or half mats with no junction of four corners', async () => {
  const {rooms, tatamiMats} = await import(new URL('rooms.mjs', preview));
  for (const room of Object.values(rooms).filter(room=>room.tatami)) {
    const {rows,origin:[left,top]} = room.tatami;
    const mats=tatamiMats(room.tatami);
    assert.equal(mats.length,new Set(rows.join('')).size,room.name);
    assert.ok(mats.some(([, ,w,h])=>w>h) && mats.some(([, ,w,h])=>h>w),room.name);
    for (const [x,y,w,h] of mats) {
      assert.ok([w,h].includes(80) && [80,160].includes(Math.max(w,h)),room.name);
      assert.ok(x>=40 && y>=140 && x+w<=room.width-40 && y+h<=room.height-36,room.name);
    }
    for (const [y,row] of rows.entries()) {
      assert.equal(row.length,rows[0].length,room.name);
      for (let x=0;x<row.length;x++) {
        const px=left+80*x+40, py=top+80*y+40;
        assert.equal(mats.filter(([l,t,w,h])=>px>=l && px<l+w && py>=t && py<t+h).length,1,room.name);
        if (x>0 && y>0) {
          const junction=[row[x-1],row[x],rows[y-1][x-1],rows[y-1][x]];
          assert.notEqual(new Set(junction).size,4,room.name);
        }
      }
    }
  }
});

test('floorboards vary in length and stagger their joints between adjacent rows', async () => {
  const {floorboardJoints} = await import(new URL('room-art.mjs', preview));
  const courses=floorboardJoints(28,740,18,336);
  assert.deepEqual(courses,floorboardJoints(28,740,18,336));
  assert.ok(new Set(courses.map(row=>row.join(','))).size>14);
  for (const [row, joints] of courses.entries()) {
    assert.equal(joints.at(-1),740);
    const lengths=joints.map((end,i)=>end-(joints[i-1]??28));
    assert.ok(lengths.every(length=>length>=44 && length%4===0));
    if (row>0) for (const end of joints.slice(0,-1)) {
      assert.ok(courses[row-1].slice(0,-1).every(previous=>Math.abs(previous-end)>12));
    }
  }
});
