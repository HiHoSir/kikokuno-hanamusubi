// One explicit local checkpoint. Existing live player/story keys remain unchanged.
// Save data is not uploaded; Safari may erase site storage when website data is cleared.
import {PLAYER_KEY,DEFAULT_PLAYER,normalizePlayer,readPlayer,FIELD_RETURN_KEY,BATTLE_REQUEST_KEY} from '../battle/rules.mjs';
import {CHAPTER_ONE_KEY,normalizeStage,readStoryStage} from '../story/chapter-one.mjs';

export const MANUAL_SAVE_KEY='kikokuno-hanamusubi-manual-save';
export const RESTORE_POSITION_KEY='kikokuno-hanamusubi-restore-position';
const FIELD_PLACE_RETURN_KEY='kikokuno-hanamusubi-field-return';
const SCENES=Object.freeze({village:'鬼灯村',interiors:'室内',field:'花霞野',tenyo:'天妖の社'});
const ROUTES=Object.freeze({
  village:'src/game/village/',interiors:'src/game/interiors/',
  field:'src/field/',tenyo:'src/game/tenyo/'
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
  if(source.scene==='interiors'){
    const building=source.building;
    // Interior entries come only from the map's fixed authored building IDs.
    if(typeof building!=='string'||!/^[a-z0-9-]{1,80}$/.test(building))return null;
    return {scene:source.scene,building,position};
  }
  return {scene:source.scene,position};
}
export function readManualGame(storage=globalThis.localStorage){
  try{
    const raw=JSON.parse(storage?.getItem(MANUAL_SAVE_KEY)||'null');
    if(raw?.version!==1||!raw.player||typeof raw.player!=='object')return null;
    const location=normalizeLocation(raw.location);
    if(!location||!['chief','shrine','cove'].includes(raw.story))return null;
    if(!Number.isFinite(Date.parse(raw.savedAt)))return null;
    return {version:1,savedAt:raw.savedAt,player:normalizePlayer(raw.player),
      story:normalizeStage(raw.story),location};
  }catch{return null;}
}
export function saveManualGame(location,storage=globalThis.localStorage,now=Date.now){
  const clean=normalizeLocation(location);
  if(!clean)return {accepted:false,message:'現在地を取得できません。移動後にもう一度お試しください。'};
  const save={version:1,savedAt:new Date(now()).toISOString(),
    player:readPlayer(storage),story:readStoryStage(storage),location:clean};
  try{
    storage.setItem(MANUAL_SAVE_KEY,JSON.stringify(save));
    if(!readManualGame(storage))throw Error('save verification failed');
    return {accepted:true,save,message:'記録しました。'};
  }catch{return {accepted:false,message:'記録できませんでした。Safariの保存領域を確認してください。'};}
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
export function routeForManualGame(save,root){
  const location=normalizeLocation(save?.location);
  if(!location)return null;
  const url=new URL(ROUTES[location.scene],root);
  if(location.building)url.searchParams.set('building',location.building);
  return url;
}
export function restoreManualGame(storage=globalThis.localStorage,session=globalThis.sessionStorage){
  const save=readManualGame(storage);
  if(!save)return {accepted:false,message:'記録されたデータがありません。'};
  const keys=[PLAYER_KEY,CHAPTER_ONE_KEY];
  let previous;
  try{
    previous=keys.map(key=>storage.getItem(key));
    // A one-time position is consumed only by the selected scene on arrival.
    session.setItem(RESTORE_POSITION_KEY,JSON.stringify(save.location));
    storage.setItem(PLAYER_KEY,JSON.stringify(save.player));
    storage.setItem(CHAPTER_ONE_KEY,save.story);
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
