import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STYLE_REFERENCES, measureSamples, formatMarkdown, reviewSignals } from '../tools/report-graphic-style.mjs';

// This reports facts about current images, not automatic subjective style acceptance.
test('representative first-game PNGs can be measured and approved references are registered', () => {
  const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
  const registered = new Map(manifest.assets.map(a => [a.path, a]));
  const samples = measureSamples();
  assert.equal(samples.length, STYLE_REFERENCES.length);
  for (const item of samples) {
    assert.ok(item.imagePx.every(n => Number.isInteger(n) && n > 0), item.path);
    assert.ok(item.paletteColors >= 0, item.path);
    assert.ok(item.visibleCoverage >= 0 && item.visibleCoverage <= 1, item.path);
    assert.ok(item.visibleBounds, item.path);
    if (item.group !== 'review-only') {
      assert.equal(registered.get(item.path)?.status, 'approved', item.path);
    }
    if (item.framePx) {
      assert.equal(item.frames, 12, item.path);
      assert.equal(item.frameVisibleHeights.length, 12, item.path);
    }
  }
  assert.match(formatMarkdown(samples), /review-only/);
  console.log('\nGRAPHIC_STYLE_PROFILE_BEGIN\n' + formatMarkdown(samples) + '\nGRAPHIC_STYLE_PROFILE_END\n');
});


test('review signals are only advisory, grounded in measured heights and partial alpha', () => {
  const hero = {
    group: 'nonfield-actor',
    path: 'assets/characters/hizuki/walk-4dir-80x112.png',
    frontIdle: { visibleBounds: { height: 90 } },
    visiblePixels: 100, partiallyTransparentPixels: 0, imagePx: [240, 448], paletteColors: 30
  };
  const human = {
    group: 'nonfield-actor', path: 'assets/characters/npc/example.png',
    frontIdle: { visibleBounds: { height: 44 } },
    visiblePixels: 100, partiallyTransparentPixels: 90, imagePx: [240, 448], paletteColors: 20
  };
  const field = {
    group: 'field', path: 'assets/field/terrain/example.png',
    frontIdle: null,
    visiblePixels: 1024, partiallyTransparentPixels: 0, imagePx: [32, 32], paletteColors: 700
  };
  const flagged = reviewSignals([hero, human, field]);
  assert.deepEqual(flagged.map(v => v.kind), ['human-height', 'partial-alpha', 'dense-palette']);
  assert.ok(flagged.every(v => v.detail.includes('px') || v.detail.includes('%') || v.detail.includes('RGB')));
  const onlyPreview = { ...human, group: 'review-only' };
  assert.equal(reviewSignals([hero, onlyPreview]).length, 0);
});
