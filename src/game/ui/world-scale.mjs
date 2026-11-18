// One visual scale for every explorable, non-field scene.
// 1 world pixel = WORLD_SCENE_ZOOM CSS pixels (independent of Retina DPR).
// Apply the same scale to the entire scene, never to a particular character,
// building, district or player position. Field has separate camera rules.
export const WORLD_SCENE_ZOOM=0.5;
export const WORLD_HERO_FRAME=Object.freeze([80,112]);
export const WORLD_HERO_FOOT=Object.freeze([40,106]);
