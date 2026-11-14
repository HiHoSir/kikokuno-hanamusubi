// Pure viewport policy: preserve perspective and source-pixel scale in landscape.
export function fieldViewportDimensions(cssWidth,cssHeight){
  const ratio=Number.isFinite(cssWidth)&&Number.isFinite(cssHeight)&&cssHeight>0
    ?Math.max(1,cssWidth/cssHeight):640/544;
  const height=544;
  return {width:Math.max(640,Math.min(2048,Math.round(height*ratio))),height};
}
