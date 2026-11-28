import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {SHIOMACHI_MAP,shiomachiIsExit} from '../data/maps/shiomachi-village/scene.mjs';
import {SHIOMACHI_ARMORY_STOCK} from '../data/maps/shiomachi-village/armory.mjs';
import {EQUIPMENT_ITEMS,STATUS_V2} from '../src/game/battle/rules.mjs';

const read=p=>readFileSync(p,'utf8');
const terrainSource=read('data/maps/field/terrain.js');
const terrain=JSON.parse(terrainSource.slice(terrainSource.indexOf('{'),terrainSource.lastIndexOf('}')+1));
const field=read('src/field/world.js'),walk=read('src/field/walk.mjs');
const inGame=read('src/game/shiomachi/index.html');
const runtime=read('src/game/shiomachi/walk.mjs');
const preview=read('previews/shiomachi-village/index.html');

test('coastal field marker is on free grass by the cove, not a replaced location',()=>{
 assert.equal(terrain.tiles[51][53],'grass');
 assert.deepEqual(terrain.referenceComposition.places.cove,[49,53]);
 const cove=terrain.referenceComposition.decorations.find(o=>o.destination==='cove');
 assert.deepEqual(cove.contactTiles,[[49,53]]);
 assert.deepEqual([cove.x,cove.y],[49*32,53*32]);
 assert.equal(terrain.tiles[53][49],'sand');
 assert.equal(terrain.tiles[54][49],'river','the cove marker faces the water');
 assert.deepEqual(terrain.referenceComposition.places.village,[37,70]);
 assert.deepEqual(terrain.referenceComposition.roads[1].at(-1),[49,53]);
 assert.ok(!terrain.referenceComposition.places.shiomachi,
   'new village is a separate authored world marker, not a replacement cove');
 const elevation={prepare(map){map.ramps=map.map(row=>row.map(()=>null));},refreshCollision(){}};
 const window={YK_FIELD_TERRAIN:terrain,YK_FIELD_ELEVATION:elevation};
 runInNewContext(field,{window,YK_FIELD_ELEVATION:elevation});
 const {decorations,landmarkContactTiles}=window.YK_WORLD.mapData;
 const hozuki=decorations.find(item=>item.destination==='village');
 const shiomachi=decorations.find(item=>item.destination==='shiomachi');
 assert.equal(shiomachi.kind,hozuki.kind);
 assert.deepEqual([shiomachi.width,shiomachi.height],[hozuki.width,hozuki.height]);
 assert.deepEqual([shiomachi.x,shiomachi.y,shiomachi.foot],[53*32,51*32,52*32]);
 assert.equal(terrain.tiles[51][54],'grass','the second art cell also sits on land');
 assert.deepEqual(structuredClone(landmarkContactTiles.shiomachi),[[53,51],[54,51]]);
 assert.deepEqual(structuredClone(shiomachi.contactTiles),[[53,51],[54,51]]);
 assert.equal(shiomachi.occupiedTiles.length,0);
});

test('official village is protected by shell admission, uses original native-sized map and a real south exit',()=>{
 assert.match(inGame,/navigation\/entry\.js" data-entry="game"/);
 assert.doesNotMatch(inGame,/class="review-tools"|data-review-spot=|data-review-room=/);
 assert.match(inGame,/src="\.\/walk\.mjs/);
 assert.match(inGame,/src\/game\/ui\/controls\.css/);
 assert.ok(inGame.includes('id="shop-panel"'));
 assert.equal(SHIOMACHI_MAP.width,42);
 assert.equal(SHIOMACHI_MAP.height,54);
 assert.equal(SHIOMACHI_MAP.objects.length,12);
 assert.equal(SHIOMACHI_MAP.residents.length,4);
 assert.equal(shiomachiIsExit(674,1698),true);
 assert.ok(runtime.includes("const previewMode=location.pathname.includes('/previews/')"));
 assert.ok(runtime.includes("consumeRestorePosition('shiomachi')"));
 assert.ok(runtime.includes("window.KIKOKU_SAVE_SNAPSHOT=()=>({scene:'shiomachi'"));
 assert.ok(runtime.includes("window.KIKOKU_ROUTE.go(new URL('../../field/?from=shiomachi'"));
 assert.match(read('src/field/landmarks.mjs'),/shiomachi:'\.\.\/game\/shiomachi\/'/);
 assert.match(walk,/FIELD_PLACE_ROUTES\[destination\]/);
 assert.match(walk,/fieldExitPosition\(from\)/);
 assert.match(preview,/data-review-room="armory"/,'the original isolated preview is unchanged');
});

test('the connected shop uses individual items while approved tier values stay separate',()=>{
 assert.equal(SHIOMACHI_ARMORY_STOCK.length,4);
 for(const item of SHIOMACHI_ARMORY_STOCK)
   assert.deepEqual(EQUIPMENT_ITEMS[item.id],item);
 assert.deepEqual(STATUS_V2.equipment.map(x=>[x.id,x.attack,x.defense]),[
  ['T0',0,0],['T1',20,14],['T2',42,30],['T3',64,46],
  ['T4',88,64],['T5',114,84],['T6',140,104]]);
 const interior=read('src/game/shiomachi/interior-preview.mjs');
 assert.match(interior,/trial:previewMode\?\{read:/);
 const shop=read('src/game/interiors/shop.mjs');
 assert.match(shop,/試用・セーブには反映しません/);
 assert.match(shop,/else\{\s+savePlayer\(result\.player\)/);
 assert.match(read('src/game/interiors/walk.mjs'),/createVillageShop\(/);
});
