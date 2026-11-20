import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, frameRegions, inspectRegion } from './analyze-sprite.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Curated sampling of current first-game art. Names are *existing paths*, not new IDs.
// 'review-only' is measured for diagnostics but never promoted to approved style canon.
export const STYLE_REFERENCES = Object.freeze([
  { group: 'nonfield-actor', path: 'assets/characters/hizuki/walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-actor', path: 'assets/characters/npc/villager-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-actor', path: 'assets/characters/npc/shirotae-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-actor', path: 'assets/characters/npc/shrine-guardian-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-actor', path: 'assets/characters/npc/farm-worker-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-prop', path: 'assets/village/scene/house-thatch.png' },
  { group: 'nonfield-prop', path: 'assets/village/scene/belltower.png' },
  { group: 'nonfield-prop', path: 'assets/village/objects/tree-sakura-pale.png' },
  { group: 'nonfield-prop', path: 'assets/village/objects/barrel.png' },
  { group: 'nonfield-prop', path: 'assets/sea-cove/objects/fish-basket-80x74.png' },
  { group: 'field', path: 'assets/characters/hizuki/walk-sd-32.png', frame: [32,32] },
  { group: 'field', path: 'assets/field/terrain/forest-core.png' },
  { group: 'field', path: 'assets/field/terrain/grass-cliff.png' },
  { group: 'field', path: 'assets/field/terrain/water.png' },
  { group: 'review-only', path: 'assets/tenyo-rebuild-v1/original-atlas.png' }
]);

export function measureSamples(readBytes = p => readFileSync(resolve(repoRoot, p)), samples = STYLE_REFERENCES) {
  return samples.map(sample => {
    const png = decodePng(readBytes(sample.path));
    const whole = inspectRegion(png, { x: 0, y: 0, width: png.width, height: png.height, row: 0, column: 0 });
    const frames = sample.frame ? frameRegions(png, sample.frame).map(region => inspectRegion(png, region)) : null;
    const idleFront = frames ? frames[0] : null;
    const fields = {
      group: sample.group,
      path: sample.path,
      imagePx: [png.width, png.height],
      pngType: png.colorType,
      paletteColors: whole.opaqueColorCount,
      visiblePixels: whole.visiblePixels,
      partiallyTransparentPixels: whole.translucentPixels,
      visibleCoverage: whole.opaqueCoverage,
      visibleBounds: whole.visibleBounds,
      isolatedPixels: whole.isolatedPixels,
      topColors: whole.topColors.slice(0, 3),
      framePx: sample.frame ?? null,
      frames: frames?.length ?? 0,
      frontIdle: idleFront ? {
        visibleBounds: idleFront.visibleBounds,
        margin: idleFront.transparentMargins,
        colors: idleFront.opaqueColorCount,
        isolatedPixels: idleFront.isolatedPixels
      } : null
    };
    if (frames) fields.frameVisibleHeights = frames.map(v => v.visibleBounds?.height ?? 0);
    return fields;
  });
}
function cell(v) {
  return v == null ? '—' : String(v);
}
function bounds(v) {
  return v ? v.width + '×' + v.height + '@' + v.x + ',' + v.y : 'empty';
}
export function formatMarkdown(rows) {
  const out = [
    '# Adopted graphic style measurement (diagnostic; not auto-approved)',
    '',
    'Samples listed as review-only are **not approved style references**. Colors are the distinct RGB values among visible pixels (alpha>0). Coverage includes partly translucent pixels. Metrics do not determine aesthetic quality.',
    '',
    '| Group | Existing asset | PNG px | Visible RGB colors | Coverage | Partial alpha | Visible bounds | Front idle bounds (if sheet) |',
    '|---|---|---:|---:|---:|---:|---|---|'
  ];
  for (const r of rows) out.push(
    '| ' + r.group + ' | ' + r.path + ' | ' + r.imagePx.join('×') +
    ' | ' + cell(r.paletteColors) + ' | ' + (r.visibleCoverage * 100).toFixed(1) +
    '% | ' + r.partiallyTransparentPixels + ' | ' + bounds(r.visibleBounds) +
    ' | ' + (r.frontIdle ? bounds(r.frontIdle.visibleBounds) : '—') + ' |'
  );
  out.push('', 'Notes: Compare within matching roles and approved assets only. Perspective, outline style, depth, feet anchors, animation, and shadows still need visual/gameplay checks.');
  return out.join('\n');
}
const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const option = process.argv[2] ?? '--markdown';
    if (option !== '--markdown' && option !== '--json') throw new Error('Use --markdown or --json');
    const rows = measureSamples();
    console.log(option === '--json' ? JSON.stringify(rows, null, 2) : formatMarkdown(rows));
  } catch (error) {
    console.error('Graphic style profiling failed:', error.message);
    process.exitCode = 1;
  }
}
