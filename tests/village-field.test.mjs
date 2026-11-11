import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as movement from '../previews/village-walk/movement.mjs';

const scene = JSON.parse(readFileSync(new URL('../previews/village-walk/map/scene.json', import.meta.url)));

test('south road switches to the field only when walking across its exit', () => {
  const exit = scene.markers.find(marker => marker.id === 'field-exit');
  assert.ok(exit, 'the main road has a field exit');
  assert.equal(movement.crossesSouthExit(exit, 1140, 2205, 1140, 2210), true);
  assert.equal(movement.crossesSouthExit(exit, 1196, 2205, 1196, 2210), false);
  assert.equal(movement.crossesSouthExit(exit, 1140, 2210, 1140, 2205), false);
  assert.equal(movement.crossesSouthExit(exit, 1138, 2208, 1140, 2208), false);
  assert.equal(movement.crossesSouthExit(exit, ...exit.point, ...exit.point), false);
});

test('field approach has a walkable arrival cell before its village entrance', async () => {
  const { arrival, villageCell, canEnterCell } = await import('../previews/field-walk/map.mjs');
  assert.deepEqual(arrival, [10, 8]);
  assert.deepEqual(villageCell, [10, 7]);
  assert.equal(canEnterCell(...arrival), true);
  assert.equal(canEnterCell(...villageCell), true);
  assert.equal(canEnterCell(0, 0), false);
  assert.equal(canEnterCell(11, 6), false);
});
