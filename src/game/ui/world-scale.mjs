// World scale used by village, interiors and cove.
// Hero, NPCs, buildings, furniture and props share this world coordinate
// system and the same camera factor. Never zoom an individual actor/asset or
// change the factor based on the player's location. Field has its own rules.
// Tenyo sanctuary now uses the same world zoom and native character frame.
// The source 80x112px character atlas is never resized independently.
export const WORLD_SCENE_ZOOM=0.5;
export const WORLD_ACTOR_FRAME=Object.freeze([80,112]);
export const WORLD_ACTOR_FOOT=Object.freeze([40,106]);
export const WORLD_ACTOR_ATLAS=Object.freeze([240,448]);
// Existing exports remain aliases so art/data standards cannot diverge.
export const WORLD_HERO_FRAME=WORLD_ACTOR_FRAME;
export const WORLD_HERO_FOOT=WORLD_ACTOR_FOOT;
