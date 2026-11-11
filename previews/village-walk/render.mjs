export const DEFAULT_CAMERA_ZOOM = 0.75;
export function pixelViewport(cssWidth,cssHeight,dpr,desiredZoom=DEFAULT_CAMERA_ZOOM) {
  const ratio=Math.min(dpr||1,3);
  // Camera zoom controls the whole scene; DPR changes only backing resolution.
  const step=ratio*desiredZoom;
  return {step,width:Math.max(1,Math.round(cssWidth*ratio)),
    height:Math.max(1,Math.round(cssHeight*ratio))};
}
