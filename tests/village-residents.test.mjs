import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { makeWalk } from '../previews/village-walk/movement.mjs';
import { advanceResident, makeResident, residentInFront } from '../previews/village-walk/residents.mjs';

test('only the nearest resident in front and within speaking distance can be addressed', () => {
  const near = {x: 60, y: 92};
  const far = {x: 60, y: 65};
  const behind = {x: 60, y: 131};
  const beside = {x: 95, y: 92};
  assert.equal(residentInFront(60, 120, 1, [far, beside, behind, near]), near);
  assert.equal(residentInFront(60, 120, 0, [near, far, beside]), undefined);
  assert.equal(residentInFront(60, 170, 1, [near, far]), undefined);
});

test('feet stop at a live obstacle and the patrol animates only while travelling', () => {
  const walk = makeWalk(200, 200, new Uint8Array(200 * 200), 8);
  assert.deepEqual(walk.move(25, 80, 30, 0, x => x >= 40), [39, 80]);
  const npc = makeResident({route: [[25, 80], [80, 80]], face: 0, speed: 40});
  advanceResident(npc, 1000, walk, (x) => x >= 40);
  assert.equal(npc.x, 39);
  assert.equal(npc.face, 2);
  assert.equal(npc.distance, 14);
  assert.equal(npc.moving, true);
  advanceResident(npc, 100, walk, (x) => x >= 40);
  assert.equal(npc.moving, false);
  advanceResident(npc, 2000, walk);
  assert.equal(npc.x, 80);
  assert.equal(npc.target, 0);
  assert.ok(npc.wait > 0);
});

test('the three approved residents use twelve-frame atlases and defined orthogonal routes', () => {
  const residents = JSON.parse(readFileSync(new URL('../previews/village-walk/map/residents.json', import.meta.url)));
  assert.deepEqual(residents.map(({id}) => id), ['chief', 'satoko', 'osumi']);
  for (const {asset, lines, route} of residents) {
    const png = readFileSync(new URL(`../${asset}`, import.meta.url));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [240, 448]);
    assert.ok(lines.length && lines.every(Boolean));
    for (let i = 0; i < route.length; i++) {
      const [x, y] = route[i];
      const [nx, ny] = route[(i + 1) % route.length];
      assert.ok(x === nx || y === ny);
    }
  }
});
