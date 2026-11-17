// REVIEW-ONLY ocean-to-sand motion; not part of the accepted game map.
// A single shared tide phase controls both water wash and retreating foam.
export const TIDE_STEP_MS=180;
export const TIDE_REACH_PX=Object.freeze([-3,-2,0,2,5,7,9,8,6,3,0,-2]);
export const TIDE_FRAME_COUNT=TIDE_REACH_PX.length;
export const WET_BAND_PX=11;
export function tideFrame(timeMs){
  if(!Number.isFinite(timeMs))return 0;
  return ((Math.floor(timeMs/TIDE_STEP_MS)%TIDE_FRAME_COUNT)+TIDE_FRAME_COUNT)%TIDE_FRAME_COUNT;
}
export function tideReach(phase,x){
  const p=((phase%TIDE_FRAME_COUNT)+TIDE_FRAME_COUNT)%TIDE_FRAME_COUNT;
  // Small, repeating variations keep the advancing edge connected and avoid
  // a ruler-straight white band. Every x shares the same tide phase.
  const irregular=[0,0,1,1,0,-1,-1,0][Math.floor(x/8)%8];
  return TIDE_REACH_PX[p]+irregular;
}
export function classifySurfPixel(pixelY,shoreY,phase,x){
  if(!Number.isFinite(shoreY))return 'none';
  const reach=tideReach(phase,x),tip=shoreY+reach;
  if(pixelY>=shoreY&&pixelY<=shoreY+WET_BAND_PX){
    if(reach>0&&pixelY<tip-1)return 'water';
    if(pixelY>=tip-1&&pixelY<=tip+1)return 'foam';
    return 'wet-sand';
  }
  if(pixelY>=tip-1&&pixelY<=tip+1&&pixelY>=shoreY-5)return 'foam';
  return 'none';
}
