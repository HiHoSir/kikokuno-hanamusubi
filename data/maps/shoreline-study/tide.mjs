// Eight synchronous surf-animation frames. Each phase is baked into 32px
// map chips at load time; gameplay only selects the corresponding atlas row.
// Signed distance is measured from the APPROVED 16-corner shoreline mask.
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
// World-coordinate variation, deliberately NOT indexed from a 32px tile's
// local x. Both sides of any vertical grid boundary share a continuous crest.
// This is used only while authoring an atlas, never per pixel during animation.
export function surfFront(phase,worldX){
  const state=TIDE_FRAMES[phase];
  if(!state||!Number.isFinite(worldX))return 0;
  const variation=Math.sin(worldX/19)*1.15+Math.sin(worldX/43+1.7)*.85;
  return Math.max(1,state.reach+Math.round(variation));
}
// 0: clear, 1: exposed damp sand, 2: thin water sheet, 3: foamy crest.
// Tile pixels are produced from this single rule and packed into a sheet.
export function surfSample(distance,terrain,phase,worldX){
  if(terrain!=='sand'||!Number.isFinite(distance)||distance<0)return 0;
  const state=TIDE_FRAMES[phase];if(!state)return 0;
  const front=surfFront(phase,worldX);
  if(distance>state.wetReach+2)return 0;
  if(distance>front)return 1;
  if(distance>=front-2)return 3;
  return 2;
}
