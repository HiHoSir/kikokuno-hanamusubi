export function pixelViewport(cssWidth,cssHeight,dpr,desiredZoom=1.2) {
  const ratio=Math.min(dpr||1,3);
  const step=Math.max(1,Math.round(ratio*desiredZoom));
  return {step,width:Math.max(step,Math.floor(cssWidth*ratio/step)*step),
    height:Math.max(step,Math.floor(cssHeight*ratio/step)*step)};
}
