// Shoreline feasibility study only. Tide motion is independent of the
// approved two-frame open-water atlas; changing sea color alone is NOT surf.
export const TIDE_INTERVAL_MS=260;
export const TIDE_FRAMES=Object.freeze([
  Object.freeze({reach:2,wetReach:12,retreat:true}),
  Object.freeze({reach:4,wetReach:12,retreat:false}),
  Object.freeze({reach:7,wetReach:12,retreat:false}),
  Object.freeze({reach:11,wetReach:13,retreat:false}),
  Object.freeze({reach:14,wetReach:14,retreat:false}),
  Object.freeze({reach:11,wetReach:14,retreat:true}),
  Object.freeze({reach:7,wetReach:14,retreat:true}),
  Object.freeze({reach:4,wetReach:13,retreat:true})
]);
export function tideFrame(time){
  const phase=Math.floor(Math.max(0,time)/TIDE_INTERVAL_MS)%TIDE_FRAMES.length;
  return {phase,...TIDE_FRAMES[phase]};
}
// Distances are measured from the ALPHA EDGE of the actual authored coast
// mask, not the raw 32px tile boundary. This prevents 32px staircase foam.
export function tidePixel(distance,terrain,phase,hash=0){
  if(terrain!=='sand'||!Number.isFinite(distance)||distance<1)return 0;
  const state=TIDE_FRAMES[phase];
  if(!state)return 0;
  const roughness=hash%3===0?1:hash%5===0?-1:0;
  const front=Math.max(1,state.reach+roughness);
  if(distance>state.wetReach+1)return 0;
  if(distance<=front){
    // Surf reaches the sand. Crest is 2-3px wide in a consistent palette.
    if(distance>=front-2&&hash%7!==0)return 3;
    return 2;
  }
  return 1; // damp sand persists as the wash retreats
}
