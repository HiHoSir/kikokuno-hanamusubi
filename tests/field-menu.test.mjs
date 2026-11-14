import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PLAYER,normalizePlayer,useExplorationResource} from '../src/game/battle/rules.mjs';
test('field consumables follow battle heal values and do not mutate input',()=>{
  const hero=normalizePlayer({...DEFAULT_PLAYER,hp:3,mp:10,potions:1,foods:{onigiri:1,dango:1}});
  const rice=useExplorationResource(hero,'food','onigiri');
  assert.equal(rice.accepted,true);assert.equal(rice.player.hp,15);assert.equal(rice.player.foods.onigiri,0);
  assert.equal(hero.foods.onigiri,1);
  assert.equal(useExplorationResource(hero,'food','dango').player.hp,25);
  assert.equal(useExplorationResource(hero,'herb').player.hp,26);
  const magic=useExplorationResource(hero,'heal');
  assert.equal(magic.player.hp,11);assert.equal(magic.player.mp,5);
  assert.equal(useExplorationResource(hero,'food','invalid').accepted,false);
  assert.equal(useExplorationResource(DEFAULT_PLAYER,'herb').accepted,false);
  assert.equal(useExplorationResource({...hero,potions:0},'herb').accepted,false);
  assert.equal(useExplorationResource({...hero,mp:4},'heal').accepted,false);
});
