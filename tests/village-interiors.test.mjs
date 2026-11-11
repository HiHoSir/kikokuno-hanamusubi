import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {makeWalk} from '../previews/village-walk/movement.mjs';

const preview = new URL('../previews/village-interiors/', import.meta.url);

test('each interior has a walkable entrance, exit and path to every room destination', async () => {
  const {rooms, prepareInterior} = await import(new URL('rooms.mjs', preview));
  assert.equal(Object.keys(rooms).length, 7);
  for (const room of Object.values(rooms)) {
    const {blocked, spawn, exitY, doorway, destinations} = prepareInterior(room);
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
  }
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
