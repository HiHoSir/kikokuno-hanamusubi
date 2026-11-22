import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 assert.deepEqual(terrain.referenceComposition.places.cove,[49,50]);
 assert.deepEqual(terrain.referenceComposition.places.village,[37,70]);
 assert.deepEqual(terrain.referenceComposition.roads[1].at(-1),[49,50]);
 assert.ok(field.includes('SHIOMACHI_FIELD_CELL=Object.freeze([53,51])'));
 assert.ok(field.includes('landmarkContactTiles.shiomachi=[SHIOMACHI_FIELD_CELL.slice()]'));
 assert.ok(field.includes("destination:'shiomachi'"));
 assert.ok(field.includes("kind:'newHouse'"),'existing 32px field marker art reused');
 assert.ok(!terrain.referenceComposition.places.shiomachi,
   'new village is a separate authored world marker, not a replacement cove');
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
 assert.match(walk,/\['shrine','cove','shiomachi'\]\.includes\(destination\)/);
 assert.match(walk,/placeReturnPosition\(from\)/);
 assert.match(walk,/sessionStorage\.setItem\(RETURN_KEY/);
 assert.match(preview,/data-review-room="armory"/,'the original isolated preview is unchanged');
});

test('placing a village does not make prototype armor real or adjust approved tier values',()=>{
 assert.equal(SHIOMACHI_ARMORY_STOCK.length,4);
 for(const item of SHIOMACHI_ARMORY_STOCK)
   assert.equal(EQUIPMENT_ITEMS[item.id],undefined);
 assert.deepEqual(STATUS_V2.equipment.map(x=>[x.id,x.attack,x.defense]),[
  ['T0',0,0],['T1',20,14],['T2',42,30],['T3',64,46],
  ['T4',88,64],['T5',114,84],['T6',140,104]]);
 const interior=read('src/game/shiomachi/interior-preview.mjs');
 assert.match(interior,/試用・セーブには反映しません/);
 assert.doesNotMatch(interior,/savePlayer|localStorage|saveGame/);
});
