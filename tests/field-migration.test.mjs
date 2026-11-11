import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const entry = new URL('src/field/index.html', root);
const source = (path, base = root) => readFileSync(new URL(path, base), 'utf8');

function loadField() {
  const manifest = JSON.parse(source('assets/manifest.json'));
  const paths = new Set(manifest.assets.map(({path}) => path));
  class FieldImage {
    set src(url) {
      const target = new URL(url);
      const path = target.pathname.slice(root.pathname.length);
      assert.ok(paths.has(path), `unregistered image: ${path}`);
      const png = readFileSync(target);
      this.naturalWidth = png.readUInt32BE(16);
      this.naturalHeight = png.readUInt32BE(20);
      this.complete = true;
      this.onload?.();
    }
  }
  const context = createContext({Image: FieldImage, URL, document: {currentScript: {src: entry.href}}});
  context.window = context;
  const html = source(entry);
  for (const [, path] of html.matchAll(/<script src="([^"]+)"/g)) {
    const url = new URL(path, entry);
    context.document.currentScript.src = url.href;
    runInContext(source(url), context, {filename: url.pathname});
  }
  return context;
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the field entry loads the original authored map and elevation data', () => {
  assert.match(source('data/maps/field/terrain.js'), /referenceComposition/);
  const {YK_WORLD: world, YK_FIELD_TERRAIN: terrain} = loadField();
  assert.equal(world.tileSize, 32);
  assert.equal(world.size, 2560);
  assert.equal(world.mapData.length, 80);
  assert.ok(world.mapData.every(row => row.length === 80));
  assert.equal(world.mapData.elevationEnabled, true);
  assert.equal(digest(terrain.tiles), 'f0956d5ef070f828359a32a27c68481570f528cac542220ae8a3392a80fd4bd1');
  assert.equal(digest(terrain.heights), '8193650f027e8de6f03468b518fbd1ac330b9be31e214b3aa2d0d9517cd19bb1');
  assert.equal(digest(terrain.referenceComposition), 'dfc801b62e70fea3aa0b0f3609db086df23d713392681b9f7caa938a6680807c');
  assert.equal(world.walkable(...world.start), true);
  assert.equal(world.walkable(16, 16), false);
});

test('the field projection and image loader retain the original perspective and art', () => {
  const {YK_WORLD: world, YK_LANDSCAPE: landscape, YK_CAMERA: camera, YK_AUTOTILE: autotile} = loadField();
  landscape.load();
  autotile.load();
  assert.ok(landscape.ready(), JSON.stringify(landscape.errors));
  assert.ok(autotile.ready());
  const [x, y] = world.start;
  const view = {x, y};
  assert.equal(landscape.project(x, y, view).x, 320);
  assert.equal(landscape.project(x, y, view).y, 354);
  assert.ok(landscape.project(x, y - 100, view).scale < landscape.project(x, y + 100, view).scale);
  assert.equal(camera.position({x: x + 32, y}, {x, y, at: 1000, duration: 192}, 1096).x, x + 16);
});

test('village arrival and entry use the copied map contact cells and 32px movement', async () => {
  const context = loadField();
  globalThis.window = context;
  try {
    const {contact, fieldStep, villageArrival, world} = await import('../src/field/runtime.mjs');
    const [x, y] = villageArrival();
    assert.equal(x % 32, 16);
    assert.equal(y % 32, 16);
    assert.equal(contact(x, y), null);
    assert.ok(world.walkable(x, y));
    const neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const entry = neighbors.map(([dx, dy]) => fieldStep({x, y}, dx, dy, 1000))
      .find(step => step && contact(step.x, step.y) === 'village');
    assert.ok(entry, 'the village entrance is one legal step from the field arrival');
    assert.equal(Math.abs(entry.x - x) + Math.abs(entry.y - y), 32);
    assert.equal(entry.motion.duration, 192);
    assert.equal(fieldStep({x: 16, y: 16}, -1, 0, 1000), null);
  } finally {
    delete globalThis.window;
  }
});
