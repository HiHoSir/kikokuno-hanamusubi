import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {villageRooms} from '../src/game/interiors/rooms.mjs';
test('teahouse and armory expose real store UI without a village item shop',()=>{
 const html=readFileSync('src/game/interiors/index.html','utf8');
 const code=readFileSync('src/game/interiors/walk.mjs','utf8');
 assert.ok(html.includes('id="shop-panel"'));
 assert.ok(html.includes('id="shop-wallet"'));
 assert.match(html,/src="\.\/walk\.mjs\?v=[^"]+"/);
 for(const s of ['purchaseFood(','purchaseArmory(readPlayer(),choice.id)','ARMORY_STOCK.map(','readPlayer(','savePlayer(','shopActive','confirmShop()','closeShop()'])assert.ok(code.includes(s),s);
 const menu=readFileSync('src/game/ui/field-menu.mjs','utf8');
 for(const s of ['Object.entries(EQUIPMENT_SLOTS)','equipmentPreview(hero,slot,choice.id)','changeEquipment(readPlayer(),currentSlot,item.id)','equipment-slot-choice','equipment-gear-choice'])assert.ok(menu.includes(s),s);
 assert.equal(villageRooms['teahouse-northeast'],'teahouse');
 assert.equal(villageRooms['house-southeast-tile'],'armory');
 assert.ok(!Object.values(villageRooms).includes('shop'));
});
