// Shared chapter-one progression across the village, shrine and future field areas.
// Keep the legacy localStorage key for existing iPhone saves.
export const CHAPTER_ONE_KEY='kikokuno-hanamusubi-field-comparison-chapter-one';
export const CHAPTER_ONE_STAGES=Object.freeze(['chief','shrine','cove']);
export function normalizeStage(value){
  return CHAPTER_ONE_STAGES.includes(value)?value:'chief';
}
export function readStoryStage(storage=globalThis.localStorage){
  try{return normalizeStage(storage?.getItem(CHAPTER_ONE_KEY));}catch{return 'chief';}
}
export function advanceStoryStage(next,storage=globalThis.localStorage){
  const current=readStoryStage(storage);
  const desired=normalizeStage(next);
  if(CHAPTER_ONE_STAGES.indexOf(desired)<=CHAPTER_ONE_STAGES.indexOf(current))return current;
  try{storage?.setItem(CHAPTER_ONE_KEY,desired);}catch{}
  return desired;
}
export function objectiveForStage(stage){
  switch(normalizeStage(stage)){
    case 'shrine':return '結び札を手に入れた。天妖の社で白妙を探そう';
    case 'cove':return '白妙の話を聞いた。海の入り江で潮平を探そう';
    default:return '里長の話を聞こう';
  }
}
