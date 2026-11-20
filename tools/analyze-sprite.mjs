import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

// Read-only PNG measurements for asset design QA. No dependencies or image writes.
// Color/granularity metrics are evidence for a human comparison, not pass thresholds.
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function requireThat(ok, message) {
  if (!ok) throw new Error(message);
}
function paeth(a, b, c) {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}
function packedSample(row, x, depth) {
  if (depth === 8) return row[x];
  const bit = x * depth;
  return (row[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
}

/** Decode common non-interlaced PNG formats to RGBA8 without a third-party package. */
export function decodePng(data) {
  requireThat(Buffer.isBuffer(data) && data.subarray(0, 8).equals(signature), 'PNG signature is invalid');
  let at = 8, header, palette, transparency;
  const parts = [];
  let hasEnd = false;
  while (at + 12 <= data.length) {
    const length = data.readUInt32BE(at);
    const type = data.toString('ascii', at + 4, at + 8);
    const end = at + 12 + length;
    requireThat(end <= data.length, 'PNG chunk is truncated: ' + type);
    const body = data.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      requireThat(length === 13 && !header, 'PNG IHDR is invalid');
      header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8],
        type: body[9], compression: body[10], filter: body[11], interlace: body[12] };
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') transparency = body;
    else if (type === 'IDAT') parts.push(body);
    else if (type === 'IEND') { hasEnd = true; break; }
    at = end;
  }
  requireThat(header && hasEnd && parts.length, 'PNG requires IHDR, IDAT and IEND');
  const { width, height, depth, type, compression, filter, interlace } = header;
  requireThat(width > 0 && height > 0 && width * height <= 32_000_000, 'Image dimensions are invalid or too large');
  requireThat(compression === 0 && filter === 0 && interlace === 0, 'Only standard non-interlaced PNG is supported');
  requireThat(type in channels && (depth === 8 || (type === 3 && [1, 2, 4].includes(depth))),
    'Unsupported PNG color type / bit depth: ' + type + ' / ' + depth);
  if (type === 3) requireThat(palette && palette.length % 3 === 0, 'Indexed PNG requires PLTE');
  const stride = Math.ceil(width * channels[type] * depth / 8);
  const filterBytes = Math.max(1, Math.ceil(channels[type] * depth / 8));
  const inflated = inflateSync(Buffer.concat(parts));
  requireThat(inflated.length === (stride + 1) * height, 'PNG scanline length mismatch');
  const rgba = new Uint8Array(width * height * 4);
  let prev = Buffer.alloc(stride), src = 0;
  for (let y = 0; y < height; y++) {
    const mode = inflated[src++];
    requireThat(mode >= 0 && mode <= 4, 'Invalid PNG row filter: ' + mode);
    const row = Buffer.from(inflated.subarray(src, src + stride));
    src += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= filterBytes ? row[i - filterBytes] : 0;
      const b = prev[i];
      const c = i >= filterBytes ? prev[i - filterBytes] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][mode];
      row[i] = (row[i] + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const off = (y * width + x) * 4;
      let r, g, b, a = 255;
      if (type === 6) {
        const pos = x * 4;
        [r, g, b, a] = row.subarray(pos, pos + 4);
      } else if (type === 2) {
        const pos = x * 3;
        [r, g, b] = row.subarray(pos, pos + 3);
        if (transparency && transparency.length >= 6 &&
            r === transparency.readUInt16BE(0) && g === transparency.readUInt16BE(2) &&
            b === transparency.readUInt16BE(4)) a = 0;
      } else if (type === 3) {
        const idx = packedSample(row, x, depth);
        requireThat(idx * 3 + 2 < palette.length, 'Palette index is missing');
        [r, g, b] = palette.subarray(idx * 3, idx * 3 + 3);
        if (transparency && idx < transparency.length) a = transparency[idx];
      } else if (type === 4) {
        r = g = b = row[x * 2]; a = row[x * 2 + 1];
      } else {
        r = g = b = row[x];
        if (transparency && transparency.length >= 2 && r === transparency.readUInt16BE(0)) a = 0;
      }
      rgba.set([r, g, b, a], off);
    }
    prev = row;
  }
  return { width, height, rgba, colorType: type, bitDepth: depth };
}

export function frameRegions(image, frame) {
  if (!frame) return [{ x: 0, y: 0, width: image.width, height: image.height, column: 0, row: 0 }];
  const [w, h] = frame;
  requireThat(Number.isInteger(w) && w > 0 && Number.isInteger(h) && h > 0 &&
    image.width % w === 0 && image.height % h === 0, 'Frame size must divide the whole atlas exactly');
  const regions = [];
  for (let y = 0; y < image.height; y += h) for (let x = 0; x < image.width; x += w) {
    regions.push({ x, y, width: w, height: h, column: x / w, row: y / h });
  }
  return regions;
}

function alphaAt(image, x, y) { return image.rgba[(y * image.width + x) * 4 + 3]; }
export function inspectRegion(image, rect) {
  const { x, y, width, height } = rect;
  requireThat(x >= 0 && y >= 0 && width > 0 && height > 0 &&
    x + width <= image.width && y + height <= image.height, 'Region outside image');
  let colored = 0, translucent = 0, visiblyTranslucent = 0, nearOpaque = 0, isolated = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const colors = new Map();
  for (let iy = 0; iy < height; iy++) for (let ix = 0; ix < width; ix++) {
    const px = x + ix, py = y + iy, off = (py * image.width + px) * 4;
    const a = image.rgba[off + 3];
    if (!a) continue;
    colored++;
    if (a < 255) translucent++;
    // 240..254 is almost opaque (e.g. alpha=252/255); report it
    // separately from transparencies that can visibly fade a sprite.
    if (a >= 240 && a < 255) nearOpaque++;
    if (a > 0 && a < 240) visiblyTranslucent++;
    minX = Math.min(minX, ix); maxX = Math.max(maxX, ix);
    minY = Math.min(minY, iy); maxY = Math.max(maxY, iy);
    const rgb = Array.from(image.rgba.subarray(off, off + 3))
      .map(v => v.toString(16).padStart(2, '0')).join('');
    colors.set('#' + rgb, (colors.get('#' + rgb) ?? 0) + 1);
    const adjacent = [[ix - 1, iy], [ix + 1, iy], [ix, iy - 1], [ix, iy + 1]]
      .some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height &&
        alphaAt(image, x + nx, y + ny) > 0);
    if (!adjacent) isolated++;
  }
  const bounds = colored ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
  return {
    ...rect,
    visibleBounds: bounds,
    transparentMargins: bounds ? { left: minX, top: minY, right: width - 1 - maxX,
      bottom: height - 1 - maxY } : null,
    visiblePixels: colored,
    translucentPixels: translucent,
    visiblyTranslucentPixels: visiblyTranslucent,
    nearOpaquePixels: nearOpaque,
    opaqueCoverage: Number((colored / (width * height)).toFixed(4)),
    opaqueColorCount: colors.size,
    isolatedPixels: isolated,
    topColors: [...colors].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([hex, pixels]) => ({ hex, pixels }))
  };
}

/** Pixel-by-pixel revision comparison (not a perceptual style comparison). */
export function compareRegions(current, reference, regions) {
  requireThat(current.width === reference.width && current.height === reference.height,
    'Comparison PNGs must have identical dimensions');
  return regions.map(r => {
    let changedPixels = 0;
    for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) {
      const i = (y * current.width + x) * 4;
      if ([0, 1, 2, 3].some(ch => current.rgba[i + ch] !== reference.rgba[i + ch])) changedPixels++;
    }
    return { column: r.column, row: r.row, changedPixels };
  });
}

function options(args) {
  requireThat(args.length, 'Usage: node tools/analyze-sprite.mjs FILE.png [--frame WxH] [--compare OLD.png] [--json]');
  const out = { file: args[0], frame: null, compare: null, json: false };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') out.json = true;
    else if (a === '--frame') {
      const m = /^([1-9]\d*)x([1-9]\d*)$/.exec(args[++i] ?? '');
      requireThat(m, 'Expected --frame 80x112, for example');
      out.frame = m.slice(1).map(Number);
    } else if (a === '--compare') {
      out.compare = args[++i];
      requireThat(out.compare, 'Expected a PNG path after --compare');
    } else throw new Error('Unknown option: ' + a);
  }
  return out;
}
export function inspectSprite(image, frame = null, reference = null) {
  const regions = frameRegions(image, frame);
  const result = {
    size: [image.width, image.height],
    png: { colorType: image.colorType, bitDepth: image.bitDepth },
    frameSize: frame,
    regions: regions.map(r => inspectRegion(image, r))
  };
  if (reference) result.comparison = compareRegions(image, reference, regions);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = options(process.argv.slice(2));
    const result = inspectSprite(decodePng(readFileSync(opts.file)), opts.frame,
      opts.compare ? decodePng(readFileSync(opts.compare)) : null);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('PNG: ' + opts.file + ' ' + result.size.join('x'));
      for (const [i, r] of result.regions.entries()) {
        console.log('[' + r.row + ',' + r.column + '] visible=' + r.visiblePixels +
          ' bounds=' + JSON.stringify(r.visibleBounds) + ' colors=' + r.opaqueColorCount +
          ' partialAlpha=' + r.translucentPixels + ' visibleTranslucent=' +
          r.visiblyTranslucentPixels + ' nearOpaque=' + r.nearOpaquePixels + ' isolated=' + r.isolatedPixels +
          (result.comparison ? ' changed=' + result.comparison[i].changedPixels : ''));
      }
      console.log('These are measurement diagnostics, NOT automatic style-approval results.');
    }
  } catch (error) {
    console.error('Sprite inspection failed: ' + error.message);
    process.exitCode = 1;
  }
}
