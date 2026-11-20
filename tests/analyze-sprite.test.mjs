import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, frameRegions, inspectRegion, inspectSprite, compareRegions } from '../tools/analyze-sprite.mjs';

const signature = Buffer.from('89504e470d0a1a0a', 'hex');
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c ^= byte;
    for (let n = 0; n < 8; n++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, bytes) {
  const tag = Buffer.from(name);
  const data = Buffer.from(bytes);
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([head, tag, data, tail]);
}
function png(w, h, type, depth, scanlines, palette = null, transparent = null) {
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4); hdr[8] = depth; hdr[9] = type;
  return Buffer.concat([
    signature, chunk('IHDR', hdr),
    ...(palette ? [chunk('PLTE', palette)] : []),
    ...(transparent ? [chunk('tRNS', transparent)] : []),
    chunk('IDAT', deflateSync(Buffer.from(scanlines))), chunk('IEND', [])
  ]);
}
function redBlue() {
  return png(2, 2, 6, 8, [
    0, 255, 0, 0, 255, 0, 0, 0, 0, // red, transparent black
    0, 255, 230, 0, 128, 0, 0, 255, 255 // partial yellow, opaque blue
  ]);
}

test('reports RGBA palette, opacity, transparent margins and per-frame visible bounds', () => {
  const image = decodePng(redBlue());
  assert.deepEqual([image.width, image.height], [2, 2]);
  assert.equal(image.colorType, 6);
  const report = inspectRegion(image, { x: 0, y: 0, width: 2, height: 2, row: 0, column: 0 });
  assert.deepEqual(report.visibleBounds, { x: 0, y: 0, width: 2, height: 2 });
  assert.equal(report.visiblePixels, 3);
  assert.equal(report.translucentPixels, 1);
  assert.equal(report.opaqueColorCount, 3);
  assert.equal(report.opaqueCoverage, 0.75);
});

test('reads 2-bit indexed PNG palettes and tRNS alpha without changing source pixels', () => {
  const image = decodePng(png(2, 1, 3, 2, [0, 0x10], [255, 0, 0, 0, 0, 255], [255, 0]));
  assert.deepEqual(Array.from(image.rgba), [255, 0, 0, 255, 0, 0, 255, 0]);
  const report = inspectSprite(image);
  assert.deepEqual(report.regions[0].visibleBounds, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(report.regions[0].opaqueColorCount, 1);
  assert.deepEqual(report.regions[0].transparentMargins, { left: 0, top: 0, right: 1, bottom: 0 });
});

test('a 3x4 atlas is divided into exactly twelve frames in row-major order', () => {
  const image = { width: 240, height: 448, rgba: new Uint8Array(240 * 448 * 4) };
  const regions = frameRegions(image, [80, 112]);
  assert.equal(regions.length, 12);
  assert.deepEqual(regions[0], { x: 0, y: 0, width: 80, height: 112, column: 0, row: 0 });
  assert.deepEqual(regions.at(-1), { x: 160, y: 336, width: 80, height: 112, column: 2, row: 3 });
  assert.throws(() => frameRegions(image, [70, 112]), /divide/);
});

test('pixel diff compares revisions per frame; style metrics are never interpreted as pass/fail', () => {
  const first = decodePng(redBlue());
  const alternate = decodePng(png(2, 2, 6, 8, [
    0, 254, 0, 0, 255, 0, 0, 0, 0,
    0, 255, 230, 0, 128, 0, 0, 255, 255
  ]));
  assert.deepEqual(compareRegions(alternate, first, frameRegions(first, [1, 2])),
    [{ column: 0, row: 0, changedPixels: 1 }, { column: 1, row: 0, changedPixels: 0 }]);
  assert.throws(() => compareRegions(first, { width: 3, height: 2 }, frameRegions(first, null)), /identical/);
});

test('rejects corrupt and unsupported PNG data explicitly', () => {
  assert.throws(() => decodePng(Buffer.from('hello')), /signature/);
  assert.throws(() => decodePng(png(1, 1, 6, 8, [5, 1, 2, 3, 4])), /filter/);
  assert.throws(() => decodePng(png(1, 1, 6, 16, [0, 1, 2, 3, 4, 5, 6, 7, 8])), /Unsupported/);
});
