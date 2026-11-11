export const DEFAULT_CAMERA_ZOOM = 0.75;
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
