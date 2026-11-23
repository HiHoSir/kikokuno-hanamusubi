// Two independent checkpoints: a user-written slot and a rotating autosave.
// Existing live player/story keys remain unchanged.
// Save data is not uploaded; Safari may erase site storage when website data is cleared.
import {PLAYER_KEY,DEFAULT_PLAYER,normalizePlayer,readPlayer,FIELD_RETURN_KEY,BATTLE_REQUEST_KEY} from '../battle/rules.mjs?v=shiomachi-gear-1-cave-quest-1-finds-1';
import {CHAPTER_ONE_KEY,CHAPTER_ONE_STAGES,normalizeStage,readStoryStage,
  USHIOHEI_HAMMER_KEY,hasUshioheiCelebratedHammer
} from '../story/chapter-one.mjs?v=ushiohei-hammer-1';

export const MANUAL_SAVE_KEY='kikokuno-hanamusubi-manual-save';
export const AUTO_SAVE_KEY='kikokuno-hanamusubi-auto-save';
export const RESTORE_POSITION_KEY='kikokuno-hanamusubi-restore-position';
const FIELD_PLACE_RETURN_KEY='kikokuno-hanamusubi-field-return';
const SCENES=Object.freeze({village:'鬼灯村',interiors:'室内',field:'花霞野',
  tenyo:'天妖の社',cove:'海の入り江',shiomachi:'潮待村',cave:'社西の洞窟'});
const ROUTES=Object.freeze({
  village:'src/game/village/',interiors:'src/game/interiors/',
  field:'src/field/',tenyo:'src/game/tenyo/',cove:'src/game/cove/',
  shiomachi:'src/game/shiomachi/',cave:'src/game/cave/'
});
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function normalizeLocation(source){
  if(!source||typeof source!=='object'||!own(SCENES,source.scene))return null;
  const point=source.position;
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||
     point.x<0||point.y<0||point.x>100000||point.y>100000)return null;
  const position={x:point.x,y:point.y};
  if(Number.isInteger(point.face)&&point.face>=0&&point.face<=3)position.face=point.face;
  if(Number.isInteger(point.row)&&point.row>=0&&point.row<=3)position.row=point.row;
  if(source.scene==='cave'){
    if(!Number.isInteger(point.floor)||point.floor<0||point.floor>2)return null;
    position.floor=point.floor;
  }
  if(source.scene==='interiors'){
    const building=source.building;
    // Interior entries come only from the map's fixed authored building IDs.
    if(typeof building!=='string'||!/^[a-z0-9-]{1,80}$/.test(building))return null;
    return {scene:source.scene,building,position};
  }
  return {scene:source.scene,position};
}
export function readSavedGame(slot='manual',storage=globalThis.localStorage){
  const key=slot==='manual'?MANUAL_SAVE_KEY:slot==='auto'?AUTO_SAVE_KEY:null;
  if(!key)return null;
  try{
    const raw=JSON.parse(storage?.getItem(key)||'null');
    if(raw?.version!==1||!raw.player||typeof raw.player!=='object')return null;
    const location=normalizeLocation(raw.location);
    if(!location||!CHAPTER_ONE_STAGES.includes(raw.story))return null;
    if(!Number.isFinite(Date.parse(raw.savedAt)))return null;
    return {version:1,savedAt:raw.savedAt,player:normalizePlayer(raw.player),
      story:normalizeStage(raw.story),ushioheiHammerCelebrated:raw.ushioheiHammerCelebrated===true,location};
  }catch{return null;}
}
export const readManualGame=(storage=globalThis.localStorage)=>readSavedGame('manual',storage);
export const readAutoGame=(storage=globalThis.localStorage)=>readSavedGame('auto',storage);
export function saveGame(slot,location,storage=globalThis.localStorage,now=Date.now){
  const key=slot==='manual'?MANUAL_SAVE_KEY:slot==='auto'?AUTO_SAVE_KEY:null;
  if(!key)return {accepted:false,message:'保存先を選んでください。'};
  const clean=normalizeLocation(location);
  if(!clean)return {accepted:false,message:'現在地を取得できません。移動後にもう一度お試しください。'};
  const save={version:1,savedAt:new Date(now()).toISOString(),
    player:readPlayer(storage),story:readStoryStage(storage),
    ushioheiHammerCelebrated:hasUshioheiCelebratedHammer(storage),location:clean};
  try{
    storage.setItem(key,JSON.stringify(save));
    if(!readSavedGame(slot,storage))throw Error('save verification failed');
    return {accepted:true,save,message:slot==='manual'?'記録しました。':'自動保存しました。'};
  }catch{return {accepted:false,message:'記録できませんでした。Safariの保存領域を確認してください。'};}
}
export const saveManualGame=(location,storage=globalThis.localStorage,now=Date.now)=>
  saveGame('manual',location,storage,now);
export const saveAutoGame=(location,storage=globalThis.localStorage,now=Date.now)=>
  saveGame('auto',location,storage,now);
export function pendingRestoreLocation(session=globalThis.sessionStorage){
  try{return normalizeLocation(JSON.parse(session?.getItem(RESTORE_POSITION_KEY)||'null'));}catch{return null;}
}
export function consumeRestorePosition(scene,session=globalThis.sessionStorage){
  try{
    const raw=JSON.parse(session?.getItem(RESTORE_POSITION_KEY)||'null');
    if(raw?.scene!==scene)return null;
    session.removeItem(RESTORE_POSITION_KEY);
    const location=normalizeLocation(raw);
    return location?.position??null;
  }catch{
    try{session?.removeItem(RESTORE_POSITION_KEY)}catch{}
    return null;
  }
}
export function routeForSavedGame(save,root){
  const location=normalizeLocation(save?.location);
  if(!location)return null;
  const url=new URL(ROUTES[location.scene],root);
  if(location.building)url.searchParams.set('building',location.building);
  return url;
}
export function restoreSavedGame(slot,storage=globalThis.localStorage,session=globalThis.sessionStorage){
  const save=readSavedGame(slot,storage);
  if(!save)return {accepted:false,message:'記録されたデータがありません。'};
  const keys=[PLAYER_KEY,CHAPTER_ONE_KEY,USHIOHEI_HAMMER_KEY];
  let previous;
  try{
    previous=keys.map(key=>storage.getItem(key));
    // A one-time position is consumed only by the selected scene on arrival.
    session.setItem(RESTORE_POSITION_KEY,JSON.stringify(save.location));
    storage.setItem(PLAYER_KEY,JSON.stringify(save.player));
    storage.setItem(CHAPTER_ONE_KEY,save.story);
    if(save.ushioheiHammerCelebrated)storage.setItem(USHIOHEI_HAMMER_KEY,'1');
    else storage.removeItem(USHIOHEI_HAMMER_KEY);
    // A prior encounter/return must never hijack the checkpoint's location.
    for(const key of [FIELD_RETURN_KEY,BATTLE_REQUEST_KEY,FIELD_PLACE_RETURN_KEY])
      try{session.removeItem(key)}catch{}
    return {accepted:true,save,message:'記録した場所へ戻ります。'};
  }catch{
    try{
      if(previous)keys.forEach((key,index)=>{
        if(previous[index]===null)storage.removeItem(key);
        else storage.setItem(key,previous[index]);
      });
      session?.removeItem(RESTORE_POSITION_KEY);
    }catch{}
    return {accepted:false,message:'読み込みできませんでした。'};
  }
}
export function startNewGame(storage=globalThis.localStorage,session=globalThis.sessionStorage){
  try{
    storage.setItem(PLAYER_KEY,JSON.stringify(normalizePlayer(DEFAULT_PLAYER)));
    storage.setItem(CHAPTER_ONE_KEY,'chief');
    storage.removeItem(USHIOHEI_HAMMER_KEY);
    for(const key of [RESTORE_POSITION_KEY,FIELD_RETURN_KEY,BATTLE_REQUEST_KEY,FIELD_PLACE_RETURN_KEY])
      session?.removeItem(key);
    return {accepted:true};
  }catch{return {accepted:false,message:'保存領域を使用できません。'};}
}
export function manualSaveLabel(save){
  if(!save)return '記録なし';
  const area=SCENES[save.location.scene];
  return area+'　'+save.player.lv+'段　'+save.player.gold+'両';
}
