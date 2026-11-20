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
  { group: 'tenyo-actor', path: 'assets/characters/npc/shirotae-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'tenyo-actor', path: 'assets/characters/npc/shrine-guardian-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-actor', path: 'assets/characters/npc/farm-worker-walk-4dir-80x112.png', frame: [80,112] },
  { group: 'nonfield-prop', path: 'assets/village/scene/house-thatch.png' },
  { group: 'nonfield-prop', path: 'assets/village/scene/belltower.png' },
  { group: 'nonfield-prop', path: 'assets/village/objects/tree-sakura-pale.png' },
  { group: 'nonfield-prop', path: 'assets/village/objects/barrel.png' },
  { group: 'nonfield-prop', path: 'assets/village/interiors/furniture.png' },
  // The older gate/lantern PNGs remain available ONLY for the legacy review switch.
  // Production loads the cropped rebuilt atlas in src/game/tenyo/walk.mjs.
  { group: 'tenyo-legacy-preview', path: 'assets/tenyo/tenyo-water-gate.png' },
  { group: 'tenyo-legacy-preview', path: 'assets/tenyo/tenyo-stone-lantern.png' },
  { group: 'nonfield-prop', path: 'assets/sea-cove/objects/fish-basket-80x74.png' },
  { group: 'field', path: 'assets/characters/hizuki/walk-sd-32.png', frame: [32,32] },
  { group: 'field', path: 'assets/field/terrain/forest-core.png' },
  { group: 'field', path: 'assets/field/terrain/grass-cliff.png' },
  { group: 'field', path: 'assets/field/terrain/water.png' },
  // These are actual runtime crops in REBUILD_RECTS (walk.mjs), not proposed sprites.
  // Preserve source rectangles so statistics cannot accidentally include neighbors.
  { group: 'tenyo-production', path: 'assets/tenyo-rebuild-v1/original-atlas.png', name: 'sanctuary_fall_v2', rect: [0,0,128,160] },
  { group: 'tenyo-production', path: 'assets/tenyo-rebuild-v1/original-atlas.png', name: 'tenyo_water_gate', rect: [128,0,192,128] },
  { group: 'tenyo-production', path: 'assets/tenyo-rebuild-v1/original-atlas.png', name: 'torii_gate_v2', rect: [128,128,128,96] },
  { group: 'tenyo-production', path: 'assets/tenyo-rebuild-v1/original-atlas.png', name: 'rock_island_lantern_base', rect: [0,160,96,64] },
  { group: 'tenyo-production', path: 'assets/tenyo-rebuild-v1/original-atlas.png', name: 'tenyo_stone_lantern', rect: [96,160,32,64] }
]);

export function measureSamples(readBytes = p => readFileSync(resolve(repoRoot, p)), samples = STYLE_REFERENCES) {
  return samples.map(sample => {
    const png = decodePng(readBytes(sample.path));
    const [x, y, width, height] = sample.rect ?? [0, 0, png.width, png.height];
    const whole = inspectRegion(png, { x, y, width, height, row: 0, column: 0 });
    const frames = sample.frame ? frameRegions(png, sample.frame).map(region => inspectRegion(png, region)) : null;
    const idleFront = frames ? frames[0] : null;
    const fields = {
      group: sample.group,
      path: sample.path,
      name: sample.name ?? null,
      regionPx: sample.rect ?? null,
      imagePx: [png.width, png.height],
      pngType: png.colorType,
      paletteColors: whole.opaqueColorCount,
      visiblePixels: whole.visiblePixels,
      partiallyTransparentPixels: whole.translucentPixels,
      visiblyTranslucentPixels: whole.visiblyTranslucentPixels,
      nearOpaquePixels: whole.nearOpaquePixels,
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

// Read the ACTUAL selected Tenyo relative size instead of comparing raw PNG bounds.
export function tenyoHeroArtFactor(source = () => readFileSync(resolve(repoRoot, 'src/game/tenyo/walk.mjs'), 'utf8')) {
  const match = source().match(/\bconst TENYO_HERO_ART_FACTOR=([0-9]+(?:\.[0-9]+)?);/);
  if (!match) throw new Error('Approved Tenyo hero art factor not found');
  const scale = Number(match[1]);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 2) throw new Error('Tenyo factor out of range');
  return scale;
}
// Advisory signals derived from *measured* current assets and displayed scale.
// Never used as an automatic image approval gate.
export function reviewSignals(rows) {
  const heroHeight = rows.find(r => r.path ===
    'assets/characters/hizuki/walk-4dir-80x112.png')?.frontIdle?.visibleBounds?.height;
  const notes = [];
  for (const r of rows) {
    if (r.group === 'tenyo-legacy-preview') continue;
    const height = r.frontIdle?.visibleBounds?.height;
    if (['nonfield-actor', 'tenyo-actor'].includes(r.group) && heroHeight && height) {
      const displayedHeroHeight = heroHeight * (r.group === 'tenyo-actor' ? tenyoHeroArtFactor() : 1);
      if (height / displayedHeroHeight < 0.7) {
        notes.push({ path: r.path, kind: 'human-height', detail:
          'Front idle visible height ' + height + 'px = ' +
          Math.round(height / displayedHeroHeight * 100) +
          '% of APPROVED displayed Hizuki ' + displayedHeroHeight.toFixed(1) +
          'px. Verify intended stature in that area.' });
      }
    }
    // Only visibly translucent pixels should suggest a faded sprite.
    // Alpha=252 (~99%) is effectively opaque and must not trigger a false alarm.
    if (r.visiblePixels && r.visiblyTranslucentPixels / r.visiblePixels > 0.75) {
      notes.push({ path: r.path, kind: 'visible-alpha', detail:
        'Pixels with alpha 1..239 account for ' +
        Math.round(r.visiblyTranslucentPixels / r.visiblePixels * 100) +
        '% of visible pixels. Check whether translucency was intended.' });
    }
    if (r.group === 'field' && r.imagePx[0] === 32 && r.imagePx[1] === 32 &&
        r.paletteColors > 512) {
      notes.push({ path: r.path, kind: 'dense-palette', detail:
        r.paletteColors + ' distinct RGB values on a 32×32 field tile; compare dot density with approved adjacent tiles.' });
    }
  }
  return notes;
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
    'Tenyo production entries are crops from the currently rendered atlas, while tenyo-legacy-preview entries are older comparison images. Tenyo NPC heights are checked against the hero as DISPLAYED (approved 0.52 art factor), not raw 80x112 PNG height. Colors are distinct RGB values at alpha>0; near-opaque alpha 240..254 is reported separately from visibly translucent alpha 1..239. These are diagnostic measurements, not art approvals.',
    '',
    '| Group | Existing asset / crop | PNG px | Visible RGB colors | Coverage | Visible alpha 1..239 | Near opaque 240..254 | Visible bounds | Front idle bounds |',
    '|---|---|---:|---:|---:|---:|---:|---|---|'
  ];
  for (const r of rows) out.push(
    '| ' + r.group + ' | ' + r.path + (r.name ? ' :: ' + r.name : '') +
    ' | ' + (r.regionPx ? r.regionPx.slice(2).join('×') : r.imagePx.join('×')) +
    ' | ' + cell(r.paletteColors) + ' | ' + (r.visibleCoverage * 100).toFixed(1) +
    '% | ' + r.visiblyTranslucentPixels + ' | ' + r.nearOpaquePixels +
    ' | ' + bounds(r.visibleBounds) +
    ' | ' + (r.frontIdle ? bounds(r.frontIdle.visibleBounds) : '—') + ' |'
  );
  const flags = reviewSignals(rows);
  out.push('', '## Review signals (advisory; no automatic rejection)', '');
  if (flags.length) {
    out.push('| Existing asset | Signal | Why to check |', '|---|---|---|');
    for (const f of flags) out.push('| ' + f.path + ' | ' + f.kind + ' | ' + f.detail + ' |');
  } else out.push('No advisory signals among these samples.');
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
