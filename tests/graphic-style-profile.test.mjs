import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STYLE_REFERENCES, measureSamples, formatMarkdown, reviewSignals, tenyoHeroArtFactor } from '../tools/report-graphic-style.mjs';
import { decodePng, inspectRegion } from '../tools/analyze-sprite.mjs';

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
    assert.equal(item.visiblyTranslucentPixels + item.nearOpaquePixels,
      item.partiallyTransparentPixels, item.path);
    if (item.regionPx) assert.equal(item.group, 'tenyo-production');
    if (item.group !== 'tenyo-legacy-preview') {
      assert.equal(registered.get(item.path)?.status, 'approved', item.path);
    }
    if (item.framePx) {
      assert.equal(item.frames, 12, item.path);
      assert.equal(item.frameVisibleHeights.length, 12, item.path);
    }
  }
  assert.match(formatMarkdown(samples), /tenyo-production/);
  console.log('\nGRAPHIC_STYLE_PROFILE_BEGIN\n' + formatMarkdown(samples) + '\nGRAPHIC_STYLE_PROFILE_END\n');
});


test('review signals distinguish visible alpha from nearly-opaque alpha', () => {
  const hero = {
    group: 'nonfield-actor',
    path: 'assets/characters/hizuki/walk-4dir-80x112.png',
    frontIdle: { visibleBounds: { height: 90 } },
    visiblePixels: 100, partiallyTransparentPixels: 0, visiblyTranslucentPixels: 0, nearOpaquePixels: 0, imagePx: [240, 448], paletteColors: 30
  };
  const human = {
    group: 'nonfield-actor', path: 'assets/characters/npc/example.png',
    frontIdle: { visibleBounds: { height: 44 } },
    visiblePixels: 100, partiallyTransparentPixels: 90, visiblyTranslucentPixels: 85, nearOpaquePixels: 5, imagePx: [240, 448], paletteColors: 20
  };
  const field = {
    group: 'field', path: 'assets/field/terrain/example.png',
    frontIdle: null,
    visiblePixels: 1024, partiallyTransparentPixels: 0, visiblyTranslucentPixels: 0, nearOpaquePixels: 0, imagePx: [32, 32], paletteColors: 700
  };
  const flagged = reviewSignals([hero, human, field]);
  assert.deepEqual(flagged.map(v => v.kind), ['human-height', 'visible-alpha', 'dense-palette']);
  assert.ok(flagged.every(v => v.detail.includes('px') || v.detail.includes('%') || v.detail.includes('RGB')));
  const onlyPreview = { ...human, group: 'tenyo-legacy-preview' };
  assert.equal(reviewSignals([hero, onlyPreview]).length, 0);
});


test('alpha 252 is near opaque, not visually faded', () => {
  const nearly = { group: 'nonfield-actor',
    path: 'assets/characters/npc/example.png',
    visiblePixels: 100, partiallyTransparentPixels: 90,
    visiblyTranslucentPixels: 0, nearOpaquePixels: 90 };
  const hero = { ...nearly, path: 'assets/characters/hizuki/walk-4dir-80x112.png',
    frontIdle: { visibleBounds: { height: 90 } } };
  nearly.frontIdle = { visibleBounds: { height: 90 } };
  assert.equal(reviewSignals([hero, nearly]).filter(x => x.kind === 'visible-alpha').length, 0);
});

test('production Tenyo uses exactly the measured atlas crops and visual-foot rows', () => {
  const walk = readFileSync('src/game/tenyo/walk.mjs', 'utf8');
  const matches = [...walk.matchAll(/^\s*([a-z0-9_]+):\[(\d+),(\d+),(\d+),(\d+)\],?\s*$/gm)];
  const rects = new Map(matches.map(m => [m[1], m.slice(2).map(Number)]));
  const foots = new Map([...walk.matchAll(/^\s*([a-z0-9_]+):(\d+),?\s*$/gm)].map(m => [m[1], Number(m[2])]));
  assert.match(walk, /const useRebuiltArt=!previewMode \|\|/);
  assert.match(walk, /const useGroundedDepth=useRebuiltArt && \(!previewMode \|\|/);
  assert.match(walk, /tenyo-rebuild-v1\/original-atlas\.png/);
  const atlas = decodePng(readFileSync('assets/tenyo-rebuild-v1/original-atlas.png'));
  const samples = STYLE_REFERENCES.filter(item => item.group === 'tenyo-production');
  assert.equal(samples.length, 5);
  for (const sample of samples) {
    assert.deepEqual(rects.get(sample.name), sample.rect, sample.name);
    const [x, y, width, height] = sample.rect;
    const b = inspectRegion(atlas, { x, y, width, height, row: 0, column: 0 }).visibleBounds;
    assert.ok(b, sample.name + ': must draw real pixels');
    assert.equal(b.y + b.height, foots.get(sample.name), sample.name + ': visual-foot must match actual alpha end');
  }
  const recorded = measureSamples().filter(item => item.group === 'tenyo-production');
  assert.equal(recorded.length, samples.length);
  assert.ok(recorded.every(item => item.regionPx));
});

test('Tenyo NPC sizes are compared to in-game approved 0.52 hero display, not raw atlas height', () => {
  assert.equal(tenyoHeroArtFactor(), 0.52);
  assert.equal(tenyoHeroArtFactor(() => 'const TENYO_HERO_ART_FACTOR=0.5;'), 0.5);
  assert.throws(() => tenyoHeroArtFactor(() => 'unset'), /not found/);
  const rows = measureSamples();
  const heroHeight = rows.find(x => x.path === 'assets/characters/hizuki/walk-4dir-80x112.png')
    .frontIdle.visibleBounds.height;
  assert.equal(heroHeight, 87);
  for (const npc of rows.filter(x => x.group === 'tenyo-actor')) {
    const height = npc.frontIdle.visibleBounds.height;
    assert.ok(height / (heroHeight * tenyoHeroArtFactor()) > 0.95, npc.path);
    assert.ok(height / (heroHeight * tenyoHeroArtFactor()) < 1.15, npc.path);
    assert.equal(reviewSignals(rows).some(s => s.path === npc.path && s.kind === 'human-height'), false);
  }
});

test('Shirotae and guards are not mistakenly called faded for near-opaque palette entries', () => {
  const rows = measureSamples();
  for (const id of ['shirotae', 'shrine-guardian']) {
    const a = rows.find(x => x.path.includes('/' + id + '-walk-'));
    assert.ok(a, id);
    assert.ok(a.nearOpaquePixels > a.visiblyTranslucentPixels, id + ': near-opaque majority');
    assert.equal(reviewSignals(rows).some(x => x.path === a.path && x.kind === 'visible-alpha'), false);
  }
});
