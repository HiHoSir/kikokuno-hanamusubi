// Game-world visual contract for EVERY explorable non-field scene.
// Hero, NPCs, buildings, furniture and props share this one world coordinate
// system and the same camera factor. Never zoom an individual actor/asset or
// change the factor based on the player's location. Field alone is exempt.
export const WORLD_SCENE_ZOOM=0.5;
export const WORLD_ACTOR_FRAME=Object.freeze([80,112]);
export const WORLD_ACTOR_FOOT=Object.freeze([40,106]);
export const WORLD_ACTOR_ATLAS=Object.freeze([240,448]);
// Existing exports remain aliases so art/data standards cannot diverge.
export const WORLD_HERO_FRAME=WORLD_ACTOR_FRAME;
export const WORLD_HERO_FOOT=WORLD_ACTOR_FOOT;
