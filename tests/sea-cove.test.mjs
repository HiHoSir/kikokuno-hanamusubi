import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 COVE_MAP,COVE_WIDTH,COVE_HEIGHT,COVE_TILE_SIZE,COVE_SHORE,COVE_SAND_DEPTH,
 tileAt,walkableCell,walkablePoint,isSouthExit
} from '../data/maps/sea-cove/scene.mjs';
import {coastMask,grassCornerMask,scrubCornerMask} from '../src/game/cove/render.mjs';
import {TIDE_FRAMES,tideFrame,surfSample} from '../src/game/terrain/surf.mjs';
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
 const flowers=COVE_MAP.objects.filter(o=>o.kind==='flowers');
 assert.equal(flowers.length,3,'do not paste a whole wildflower sheet as one prop');
 assert.ok(flowers.every(o=>Number.isInteger(o.chip)&&o.chip>=0&&o.chip<16));
 const {x,y}=COVE_MAP.entry;
 assert.equal(walkablePoint(x,y),true);
 assert.equal(walkableCell(45,0),false);
 assert.equal(walkableCell(-1,5),false);
 assert.equal(tileAt(45,12),'~');
});
test('broad beach is authored 10–14 tiles deep; no rectangular grass walkway to the field',()=>{
 assert.equal(COVE_SAND_DEPTH.length,COVE_HEIGHT);
 assert.ok(COVE_SAND_DEPTH.every(n=>Number.isInteger(n)&&n>=10&&n<=14));
 for(let y=2;y<COVE_HEIGHT;y++){
   const coast=COVE_SHORE[y];
   for(let x=coast-COVE_SAND_DEPTH[y];x<coast;x++)
     assert.ok(['s','r'].includes(tileAt(x,y)),
       'sand reach must not be interrupted by grass/scrub: '+x+','+y);
 }
 assert.equal(tileAt(Math.floor(COVE_MAP.entry.x/32),
   Math.floor(COVE_MAP.entry.y/32)),'s','player starts on dry sand');
 assert.ok(COVE_MAP.exit.columns.every(x=>tileAt(x,33)==='s'),
   'every field return route is sandy');
 const sand=COVE_MAP.tiles.join('').split('').filter(t=>t==='s').length;
 assert.ok(sand>300,'sandbox must be a substantial beach, got '+sand);
});
test('the approved 8-frame tide rule is used by 32px production cove atlas',()=>{
 assert.equal(TIDE_FRAMES.length,8);
 assert.deepEqual(TIDE_FRAMES.map(phase=>phase.reach),[2,4,7,11,14,11,7,4]);
 assert.equal(tideFrame(260*4).reach,14);
 assert.equal(surfSample(14,'sand',4,0),3);
 const render=source('src/game/cove/render.mjs');
 assert.match(render,/prepareCoveSurf\(map,shoreMask\)/);
 assert.match(render,/const tide=tideFrame\(time\)/);
 assert.match(render,/ctx\.drawImage\(surf\.sheet,sx,sy,TILE,TILE/);
 assert.match(render,/mode:'animated-native-32px-mapchips'/);
 assert.match(render,/orientation:'sea-east'/);
 assert.match(render,/edgeX\[wy\]-wx,'sand',phase,wy/);
 assert.doesNotMatch(render,/drawImage\(tideLayers|fillRect\(.*foam.*time/);
 const preview=source('data/maps/shoreline-study/tide.mjs');
 assert.ok(preview.includes("../../../src/game/terrain/surf.mjs"),
   'only one tide phase definition shared by preview and production');
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
 const green={tiles:['ggs','gss','sss']};
 assert.equal(grassCornerMask(green,0,0),11,'three grass corners connect without square beach patch');
 assert.equal(grassCornerMask(green,1,0),1,'partial grass corner is clipped by the native mask');
 const scrub={tiles:['tts','tss','sss']};
 assert.equal(scrubCornerMask(scrub,0,0),11,'forest has natural masked corners');
 const renderer=source('src/game/cove/render.mjs');
 const walker=source('src/game/cove/walk.mjs');
 assert.match(renderer,/drawImage\(mask\.surface/);
 assert.match(renderer,/globalCompositeOperation='destination-in'/);
 assert.match(renderer,/grassCornerMask\(map,x,y\)/);
 assert.match(renderer,/chip\(greenCoverage\.ctx,art\.coastMask,cover,px,py\)/);
 assert.match(renderer,/landJoin:'masked-16-corner-grass-sand'/);
 assert.match(renderer,/scrubCornerMask\(map,x,y\)/);
 assert.match(renderer,/chip\(scrubCoverage\.ctx,art\.coastMask,cover,px,py\)/);
 assert.ok(renderer.includes("if(actor.kind==='flowers')"));
 assert.ok(renderer.includes('ctx.drawImage(actor.image,sx,sy,TILE,TILE,'));
 assert.ok(renderer.includes('Math.round(actor.x-TILE/2),Math.round(actor.y-TILE),TILE,TILE'));
 assert.doesNotMatch(renderer,/if\(actor\.kind==='flowers'\)\{[^}]*actor\.image\.naturalWidth/,
  'flower sprites must be cropped to one 32px source tile, not scaled entire sheets');
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
