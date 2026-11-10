export function pixelViewport(cssWidth,cssHeight,dpr,desiredZoom=1.0) {
  const ratio=Math.min(dpr||1,3);
  // Device density changes backing resolution, never the approved scene zoom.
  const step=ratio*desiredZoom;
  return {step,width:Math.max(1,Math.round(cssWidth*ratio)),
    height:Math.max(1,Math.round(cssHeight*ratio))};
}
