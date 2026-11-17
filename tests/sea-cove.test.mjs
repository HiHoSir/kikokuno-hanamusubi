import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 COVE_MAP,COVE_WIDTH,COVE_HEIGHT,COVE_TILE_SIZE,COVE_SHORE,
 tileAt,walkableCell,walkablePoint,isSouthExit
} from '../data/maps/sea-cove/scene.mjs';
import {coastMask} from '../src/game/cove/render.mjs';
import {CHAPTER_ONE_STAGES,objectiveForStage,normalizeStage} from '../src/game/story/chapter-one.mjs';
import {readSavedGame,saveGame,restoreSavedGame,routeForSavedGame}
 from '../src/game/save/save-game.mjs';
import {readPlayer,savePlayer,DEFAULT_PLAYER} from '../src/game/battle/rules.mjs';

const source=path=>readFileSync(path,'utf8');
const stubStorage=()=>{
 const data=new Map();
 return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),
 removeItem:k=>data.delete(k)};
};
const adjacent=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1;
function bfs(start,goal){
 const queue=[start],seen=new Set([start.join(',')]);
 for(const here of queue){
  if(goal(here))return true;
  for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
   const next=[here[0]+dx,here[1]+dy],key=next.join(',');
   if(!seen.has(key)&&walkableCell(...next)){seen.add(key);queue.push(next);}
  }
 }
 return false;
}
test('the sea cove is an authored 46x34 grid of native 32px tiles',()=>{
 assert.equal(COVE_WIDTH,46);assert.equal(COVE_HEIGHT,34);
 assert.equal(COVE_TILE_SIZE,32);assert.equal(COVE_SHORE.length,34);
 assert.equal(COVE_MAP.tiles.length,34);
 for(const row of COVE_MAP.tiles){
  assert.equal(row.length,46);
  assert.match(row,/^[gs~tr]{46}$/);
 }
 assert.ok(COVE_MAP.tiles.join('').split('~').length>220,'coast has a real ocean, not a decorative water object');
 assert.ok(COVE_MAP.tiles.join('').includes('t'));
 assert.ok(COVE_MAP.tiles.join('').includes('s'));
 assert.ok(COVE_MAP.tiles.join('').includes('r'));
 const {x,y}=COVE_MAP.entry;
 assert.equal(walkablePoint(x,y),true);
 assert.equal(walkableCell(45,0),false);
 assert.equal(walkableCell(-1,5),false);
 assert.equal(tileAt(45,12),'~');
});
test('reused coastal textures and native character sheets have usable PNG source dimensions',()=>{
 const images=[
  ['assets/field/terrain/grass-base.png',32,32],
  ['assets/field/terrain/sand.png',32,32],
  ['assets/field/terrain/forest-core.png',32,32],
  ['assets/field/effects/water-motion.png',32,32],
  ['assets/village/objects/rocks.png',32,32],
  ['assets/field/terrain/atlas/coast-mask-32.png',128,128],
  ['assets/field/terrain/atlas/coast-shallow-32.png',128,128],
  ['assets/characters/hizuki/walk-4dir-80x112.png',240,448],
  ['assets/characters/npc/villager-walk-4dir-80x112.png',240,448]
 ];
 for(const [path,minWidth,minHeight] of images){
  const buffer=readFileSync(path);
  assert.equal(buffer.subarray(1,4).toString('ascii'),'PNG',path);
  assert.ok(buffer.readUInt32BE(16)>=minWidth, path+' width');
  assert.ok(buffer.readUInt32BE(20)>=minHeight,path+' height');
 }
});
test('the starting inlet route reaches a talkable spot around Ushiohei and the south exit',()=>{
 const entry=[Math.floor(COVE_MAP.entry.x/32),Math.floor(COVE_MAP.entry.y/32)];
 const fisher=[Math.floor(COVE_MAP.fisher.x/32),Math.floor(COVE_MAP.fisher.y/32)];
 assert.equal(bfs(entry,cell=>adjacent(cell,fisher)) ,true,'can reach the fisher');
 assert.equal(bfs(fisher,cell=>isSouthExit(...cell)),true,'can return to field');
 assert.equal(walkableCell(...fisher),true);
 assert.equal(isSouthExit(28,33),true);
 assert.equal(walkableCell(28,33),true);
 assert.equal(isSouthExit(8,33),false);
});
test('masked native atlases preserve diagonal coastline and animated sea is separate',()=>{
 const land={tiles:['gg~','gg~','~~~']};
 assert.equal(coastMask(land,0,0),15,'all four corners dry');
 assert.equal(coastMask(land,1,0),9,'both left corners dry');
 const renderer=source('src/game/cove/render.mjs');
 const walker=source('src/game/cove/walk.mjs');
 assert.match(renderer,/drawImage\(mask\.surface/);
 assert.match(renderer,/globalCompositeOperation='destination-in'/);
 assert.match(renderer,/const frame=Math\.floor\(time\/200\)/);
 assert.match(renderer,/staticArt\.ground/);
 assert.match(renderer,/coastShallow/);
 assert.doesNotMatch(renderer,/imageSmoothingEnabled=true/);
 for(const name of ['field/terrain/sand.png','field/terrain/grass-base.png',
   'field/terrain/forest-core.png','field/effects/water-motion.png',
   'field/terrain/atlas/coast-mask-32.png',
   'field/terrain/atlas/coast-shallow-32.png'])
  assert.ok(walker.includes(name),name);
 const manifest=JSON.parse(source('assets/manifest.json'));
 for(const relative of Object.values({
  ...Object.fromEntries(['field/terrain/sand.png','field/terrain/grass-base.png',
  'field/terrain/forest-core.png','field/effects/water-motion.png',
  'field/terrain/atlas/coast-mask-32.png',
  'field/terrain/atlas/coast-shallow-32.png'].map(x=>[x,'assets/'+x]))
 }))assert.ok(manifest.assets.some(x=>x.path===relative),'approved asset '+relative);
});
test('cove is hosted by the real game shell, its field landmark, and its shared controls',()=>{
 const field=source('src/field/walk.mjs');
 const shell=source('src/game/navigation/game-shell.mjs');
 const admission=source('src/game/navigation/entry.js');
 const html=source('src/game/cove/index.html');
 const walker=source('src/game/cove/walk.mjs');
 assert.match(shell,/src\/game\/cove\//);
 assert.match(shell,/track:'field', label:'海の入り江'/);
 assert.match(admission,/src\/game\/cove\//);
 assert.match(html,/navigation\/entry\.js" data-entry="game"/);
 assert.match(html,/data-bgm="field"/);
 assert.match(html,/\.\/walk\.mjs\?v=sea-cove-1/);
 assert.match(html,/\.\.\/ui\/controls\.css/);
 assert.match(html,/\.\.\/village\/dialogue\.css/);
 assert.match(field,/destination==='shrine'\|\|destination==='cove'/);
 assert.match(field,/from==='cove' \? coveReturnPosition\(\)/);
 assert.match(field,/\.\.\/game\/cove\//);
 assert.match(walker,/KIKOKU_ROUTE\.go\(/);
 assert.match(walker,/consumeRestorePosition\('cove'\)/);
 assert.match(walker,/KIKOKU_SAVE_SNAPSHOT/);
 assert.match(walker,/game-menu-open/);
 assert.match(walker,/isSouthExit/);
 assert.doesNotMatch(walker,/location\.assign\(/);
});
test('Ushiohei dialogue promotes cove -> forest and saves can resume in cove',()=>{
 assert.equal(CHAPTER_ONE_STAGES.at(-1),'forest');
 assert.equal(normalizeStage('forest'),'forest');
 assert.match(objectiveForStage('forest'),/忘れの森/);
 const walker=source('src/game/cove/walk.mjs');
 assert.match(walker,/advanceStoryStage\('forest'\)/);
 assert.match(walker,/潮平「昨夜の潮は妙だった/);
 const storage=stubStorage(),session=stubStorage();
 savePlayer({...DEFAULT_PLAYER,gold:24},storage);
 storage.setItem('kikokuno-hanamusubi-chapter-one','forest');
 const position={scene:'cove',position:{x:24*32+16,y:16*32+16,face:3}};
 const result=saveGame('manual',position,storage,()=>Date.parse('2026-11-17T00:00:00Z'));
 assert.equal(result.accepted,true);
 assert.equal(readSavedGame('manual',storage).story,'forest');
 assert.equal(restoreSavedGame('manual',storage,session).accepted,true);
 const route=routeForSavedGame(readSavedGame('manual',storage),'https://example.test/kikokuno-hanamusubi/');
 assert.equal(route.pathname,'/kikokuno-hanamusubi/src/game/cove/');
 assert.equal(readPlayer(storage).gold,24);
});
