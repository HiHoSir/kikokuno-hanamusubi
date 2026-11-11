export const DEFAULT_CAMERA_ZOOM = 0.75;
const RIVER_DOT = 4;
const RIPPLE_MARGIN = 32;
const RIPPLE_COLORS = ['#2168b7', '#2c85cf', '#3490d4', '#409ada'];

export function riverRipples(width, height, bankMargin) {
  let seed = 41;
  function random(limit) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 0x100000000 * limit);
  }
  const rows = Math.floor((height - 2 * bankMargin) / RIVER_DOT);
  return Array.from({ length: Math.ceil(width / 12) }, () => {
    const row = random(rows);
    const nearBank = Math.min(row, rows - 1 - row) < 4;
    return {
      x: random(width / RIVER_DOT) * RIVER_DOT,
      y: bankMargin + row * RIVER_DOT,
      length: (nearBank ? 2 + random(4) : 3 + random(6)) * RIVER_DOT,
      speed: (nearBank ? 16 : 28) + random(9),
      shade: random(4),
    };
  });
}

export function riverRippleX(ripple, width, time) {
  const travel = Math.floor(time * ripple.speed / (1000 * RIVER_DOT)) * RIVER_DOT;
  const span = width + 2 * RIPPLE_MARGIN;
  return (ripple.x + travel + RIPPLE_MARGIN) % span - RIPPLE_MARGIN;
}

export function paintRiverRipples(context, ripples, width, top, left, right, time) {
  for (const ripple of ripples) {
    const x = riverRippleX(ripple, width, time);
    if (x + ripple.length <= left || x >= right) continue;
    const y = top + ripple.y;
    context.fillStyle = RIPPLE_COLORS[ripple.shade];
    context.fillRect(x, y, ripple.length, RIVER_DOT);
    if (ripple.shade === 3) {
      context.fillStyle = '#59ace3';
      context.fillRect(x + ripple.length - 2 * RIVER_DOT, y, RIVER_DOT, RIVER_DOT);
    }
  }
}

export function pixelViewport(cssWidth,cssHeight,dpr,desiredZoom=DEFAULT_CAMERA_ZOOM) {
  const ratio=Math.min(dpr||1,3);
  // Camera zoom controls the whole scene; DPR changes only backing resolution.
  const step=ratio*desiredZoom;
  return {step,width:Math.max(1,Math.round(cssWidth*ratio)),
    height:Math.max(1,Math.round(cssHeight*ratio))};
}

// Sample the native tree alpha where the character's head is drawn.
export function canopyOpacity(tree,x,y,mask) {
  if(!mask || y>=tree.depth)return 1;
  const [left,top]=tree.point;
  const px=Math.round(x-left),py=Math.round(y-top)-80;
  if(px<0 || px>=mask.width || py<0 || py>=mask.height)return 1;
  return mask.data[(py*mask.width+px)*4+3]>=170 ? 0.48 : 1;
}
