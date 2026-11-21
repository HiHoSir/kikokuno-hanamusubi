// 潮待村 (draft): an independent, walkable coastal settlement review.
// Not registered as a field destination; it never alters the existing cove.
// Layout positions are WORLD PIXELS. Only ground/coast/pier reuse 32px tiles.
import {COVE_SHORE} from '../sea-cove/scene.mjs';

export const SHIOMACHI_TILE=32;
export const SHIOMACHI_WIDTH=42;
export const SHIOMACHI_HEIGHT=54;
export const SHIOMACHI_SHORE=Object.freeze([...COVE_SHORE]);
const rows=Array.from({length:SHIOMACHI_HEIGHT},(_,y)=>
  Array.from({length:SHIOMACHI_WIDTH},(_,x)=>
    y<SHIOMACHI_SHORE[x]?'~':'s').join(''));
export const SHIOMACHI_TILES=Object.freeze(rows);

const building=(id,sprite,x,y,w,h)=>Object.freeze({
  id,kind:'building',sprite,x,y,width:w,height:h,solid:true,
  collision:Object.freeze({left:x-w/2,top:y-h,right:x+w/2,bottom:y})
});
const prop=(id,sprite,x,y,w,h,radius)=>Object.freeze({
  id,kind:'prop',sprite,x,y,width:w,height:h,solid:true,radius
});
export const SHIOMACHI_BUILDINGS=Object.freeze([
  building('west-fisher-home','houseThatch',280,1015,390,357),
  building('east-fisher-home','houseTile',1060,1015,360,373),
  building('fish-teahouse','teahouse',270,1550,420,410),
  building('east-net-home','houseThatch',1100,1550,390,357)
]);
export const SHIOMACHI_PROPS=Object.freeze([
  prop('drying-rack','netRack',423,601,232,176,66),
  prop('rolled-net','netBundle',800,605,146,88,48),
  prop('barrel-at-landing','barrel',940,621,64,86,27),
  prop('basket-at-landing','basket',1080,622,80,74,34),
  prop('fish-crate','crate',940,1127,92,70,39),
  prop('rope-at-landing','ropeCoil',1085,1118,88,62,29),
  prop('west-barrel','barrel',94,1170,64,86,27),
  prop('south-basket','basket',490,1517,80,74,34)
]);
export const SHIOMACHI_NPCS=Object.freeze([
 Object.freeze({id:'tide-elder',name:'村の古老',sprite:'elder',x:678,y:1058,face:0,
   lines:Object.freeze([
     '村の古老「ここは潮待村。潮の上げ下げを見ながら、網を直して暮らしておる。」',
     '村の古老「鬼灯村の鐘も、この浜まで聞こえていたんじゃが……。近ごろは妙に静かじゃ。」'
   ])}),
 Object.freeze({id:'net-mender',name:'網直しの漁師',sprite:'fisher',x:795,y:725,face:3,
   lines:Object.freeze([
     '網直しの漁師「穴のあいた網は、潮が変わる前に繕っておくんだ。」',
     '網直しの漁師「入り江の潮平？　あいつも海に詳しい男だよ。浜の外れにいるはずさ。」'
   ])}),
 Object.freeze({id:'shore-girl',name:'浜の娘',sprite:'osumi',x:682,y:1327,face:0,
   lines:Object.freeze([
     '浜の娘「浜で拾ったきれいな小石を並べてるの。波が来るたびに並びが変わるんだ。」',
     '浜の娘「旅をするなら気をつけてね。海の音が大きい日は、足元を見て歩いて。」'
   ])}),
 Object.freeze({id:'fish-seller',name:'魚売り',sprite:'clerk',x:630,y:1534,face:0,
   lines:Object.freeze([
     '魚売り「今朝の魚はよく太ってるよ。港の舟が戻ると、いつも賑やかになるんだ。」',
     '魚売り「今日は店じまいの支度中さ。品物を売るのはまた今度にしよう。」'
   ])})
]);
export const SHIOMACHI_PIER=Object.freeze({
 // A short north-facing wooden pier. It is passable, but not a boat transition.
 left:20,right:22,top:5,bottom:11
});
export const SHIOMACHI_ENTRY=Object.freeze({x:674,y:1637,face:1});
export const SHIOMACHI_EXIT=Object.freeze({
  left:610,right:742,top:1680,bottom:SHIOMACHI_HEIGHT*SHIOMACHI_TILE
});
export const SHIOMACHI_REVIEW_SPOTS=Object.freeze({
 shore:Object.freeze({x:675,y:465,face:1}),
 buildings:Object.freeze({x:655,y:1122,face:0}),
 worksite:Object.freeze({x:775,y:760,face:3}),
 south:Object.freeze({...SHIOMACHI_ENTRY})
});
export const SHIOMACHI_MAP=Object.freeze({
 id:'shiomachi-village',name:'潮待村（試作）',tileSize:SHIOMACHI_TILE,
 width:SHIOMACHI_WIDTH,height:SHIOMACHI_HEIGHT,tiles:SHIOMACHI_TILES,
 shore:SHIOMACHI_SHORE,pier:SHIOMACHI_PIER,entry:SHIOMACHI_ENTRY,
 exit:SHIOMACHI_EXIT,objects:Object.freeze([...SHIOMACHI_BUILDINGS,...SHIOMACHI_PROPS]),
 residents:SHIOMACHI_NPCS
});
export function shiomachiTileAt(x,y,map=SHIOMACHI_MAP){
 return map.tiles[y]?.[x]??'~';
}
export function shiomachiWalkableCell(x,y,map=SHIOMACHI_MAP){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<=0||x>=map.width-1||y<=0||y>=map.height-1)return false;
 const {left,right,top,bottom}=map.pier;
 if(x>=left&&x<=right&&y>=top&&y<=bottom)return true;
 return shiomachiTileAt(x,y,map)==='s';
}
export function shiomachiIsExit(x,y,map=SHIOMACHI_MAP){
 const e=map.exit;
 return x>=e.left&&x<=e.right&&y>=e.top&&y<e.bottom;
}
export function shiomachiCollision(objects,x,y,radius=7){
 return objects.some(o=>{
   if(!o.solid)return false;
   if(o.collision){
     const b=o.collision;
     return x+radius>b.left&&x-radius<b.right&&y+radius>b.top&&y-radius<b.bottom;
   }
   return Math.hypot(x-o.x,y-o.y)<(o.radius??0)+radius;
 });
}
