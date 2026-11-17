// A small in-world hint for uncollected village finds; no additional art asset.
export const FIND_HINT_RADIUS=148;

export function shouldShowFindHint(hero,find,foundItems,radius=FIND_HINT_RADIUS) {
  if (!find || foundItems.has(find.id)) return false;
  const dx=hero.x-find.x, dy=hero.y-find.y;
  return dx*dx+dy*dy<=radius*radius;
}

export function drawFindHint(context,x,y,time=0) {
  // Draw in map coordinates so the bubble follows both the camera and its target.
  const left=Math.round(x)-21;
  const top=Math.round(y)-43+(Math.floor(time/650)%2);
  context.save();
  context.fillStyle='#201b19';
  context.fillRect(left+2,top+3,42,34);
  context.fillRect(left+18,top+34,9,7);
  context.fillStyle='#f7e9c5';
  context.fillRect(left+2,top,38,31);
  context.fillStyle='#896a42';
  context.fillRect(left+5,top+3,32,2);
  context.fillRect(left+5,top+27,32,2);
  context.fillStyle='#f7e9c5';
  context.fillRect(left+19,top+31,7,5);
  context.fillStyle='#302b24';
  context.font='bold 27px "DotGothic16",monospace';
  context.textAlign='center';
  context.textBaseline='middle';
  context.fillText('?',left+21,top+17);
  context.restore();
}
