import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {BATTLE_REQUEST_KEY,FIELD_RETURN_KEY,PLAYER_KEY,ENEMIES,createBattle,
  chooseEnemy,readPlayer,savePlayer,normalizePlayer,DEFAULT_PLAYER} from '../src/game/battle/rules.mjs';

test('all wild battle enemy sprites are existing approved old-repository assets',()=>{
  const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
  for(const [key,enemy] of Object.entries(ENEMIES)){
    assert.equal(key,enemy.id);
    const entry=manifest.assets.find(asset=>asset.path===enemy.asset);
    assert.equal(entry?.status,'approved',enemy.asset);
    assert.equal(entry?.usage,'battle-enemy',enemy.asset);
    assert.equal(entry?.origin?.repo,'HiHoSir/yaksha-hanamusubi');
    assert.ok(existsSync(enemy.asset),'no generated replacement: '+key);
    assert.ok(enemy.hp>0&&enemy.attack>0);
  }
  for(const pose of ['idle','attack','skill','hit','guard','victory']){
    const p='assets/characters/hizuki/battle/'+pose+'.png';
    assert.ok(existsSync(p));
    assert.equal(manifest.assets.find(x=>x.path===p)?.status,'approved');
  }
  for(const path of ['assets/audio/bgm/battle.ogg','assets/audio/se/battle-encounter.ogg'])
    assert.ok(existsSync(path),path);
  assert.equal(chooseEnemy(0),'field-oni');
  assert.equal(chooseEnemy(8),'tanuki');
  assert.equal(chooseEnemy(16),'onibi');
});

test('battle wins are earned by turns and persist solo experience, coins and level',()=>{
  const combat=createBattle('onibi',DEFAULT_PLAYER,()=>0);
  const {state}=combat;
  let result;
  for(let i=0;i<5&&!state.outcome;i++){
    result=combat.act('attack');
    assert.equal(result.accepted,true);
  }
  assert.equal(result.outcome,'victory');
  assert.equal(state.enemy.hp,0);
  assert.equal(state.hero.wins,1);
  assert.equal(state.hero.gold,ENEMIES.onibi.gold);
  assert.equal(state.hero.xp,ENEMIES.onibi.xp);
  assert.equal(combat.act('attack').accepted,false);
  const store=new Map();
  const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  savePlayer(state.hero,storage);
  assert.deepEqual(readPlayer(storage),state.hero);
  assert.ok(store.has(PLAYER_KEY));
  const leveling=createBattle('field-oni',{...DEFAULT_PLAYER,xp:38},()=>0);
  for(let i=0;i<7&&!leveling.state.outcome;i++)leveling.act('attack');
  assert.equal(leveling.state.outcome,'victory');
  assert.equal(leveling.state.hero.lv,2);
  assert.ok(leveling.state.hero.maxhp>DEFAULT_PLAYER.maxhp);
});

test('invalid magic or herbs never cost a turn; valid magic and healing consume resources',()=>{
  const combat=createBattle('field-oni',{...DEFAULT_PLAYER,mp:0,potions:0},()=>0);
  assert.equal(combat.act('bloom').accepted,false);
  assert.equal(combat.act('heal').accepted,false);
  assert.equal(combat.act('herb').accepted,false);
  assert.equal(combat.state.turn,1);
  assert.equal(combat.state.hero.hp,DEFAULT_PLAYER.hp);
  const caster=createBattle('field-oni',{...DEFAULT_PLAYER,hp:20,mp:12},()=>0);
  const startHp=caster.state.enemy.hp;
  assert.equal(caster.act('bloom').accepted,true);
  assert.equal(caster.state.hero.mp,8);
  assert.ok(caster.state.enemy.hp<startHp);
  assert.equal(caster.act('heal').accepted,true);
  assert.equal(caster.state.hero.mp,5);
  assert.equal(caster.act('herb').accepted,true);
  assert.equal(caster.state.hero.potions,2);
  assert.ok(caster.state.hero.hp>0&&caster.state.hero.hp<=caster.state.hero.maxhp);
});

test('defense reduces incoming damage and escape/defeat stop the fight',()=>{
  const normal=createBattle('field-oni',DEFAULT_PLAYER,()=>0);
  normal.act('attack');
  const normalDamage=DEFAULT_PLAYER.hp-normal.state.hero.hp;
  const defended=createBattle('field-oni',DEFAULT_PLAYER,()=>0);
  defended.act('guard');
  assert.ok(DEFAULT_PLAYER.hp-defended.state.hero.hp<normalDamage);
  const fleeing=createBattle('field-oni',DEFAULT_PLAYER,()=>0);
  assert.equal(fleeing.act('flee').outcome,'escape');
  assert.equal(fleeing.state.enemy.hp,ENEMIES['field-oni'].hp);
  const failed=createBattle('field-oni',DEFAULT_PLAYER,()=>.99);
  assert.equal(failed.act('flee').outcome,null);
  assert.ok(failed.state.hero.hp<DEFAULT_PLAYER.hp);
  const defeated=createBattle('field-oni',{...DEFAULT_PLAYER,hp:1},()=>0);
  assert.equal(defeated.act('guard').outcome,'defeat');
  assert.equal(defeated.act('attack').accepted,false);
  assert.equal(normalizePlayer({maxhp:5,hp:999}).hp,5);
});

test('battle is production scene, field encounter and safe return in persistent game shell',()=>{
  const html=readFileSync('src/game/battle/index.html','utf8');
  const code=readFileSync('src/game/battle/walk.mjs','utf8');
  const css=readFileSync('src/game/battle/battle.css','utf8');
  const field=readFileSync('src/field/walk.mjs','utf8');
  const shell=readFileSync('src/game/navigation/game-shell.mjs','utf8');
  const entry=readFileSync('src/game/navigation/entry.js','utf8');
  assert.match(html,/data-entry="game"/);
  assert.match(html,/data-bgm="battle"/);
  assert.match(html,/controls\.css/);
  assert.match(html,/audio\/boot\.mjs/);
  for(const x of ['action-a','action-b','up','down','left','right','battle-message','command-list','hero-image','enemy-image'])
    assert.ok(html.includes('id="'+x+'"'),x);
  assert.match(css,/\.battle-panels/);
  assert.match(css,/\.encounter-overlay/);
  assert.ok(code.includes('createBattle('));
  assert.ok(code.includes('savePlayer('));
  assert.ok(code.includes('KIKOKU_ROUTE.go('));
  assert.ok(code.includes('assets/audio/se/battle-encounter.ogg'));
  assert.ok(field.includes('startBattle()'));
  assert.ok(field.includes("from==='battle'"));
  assert.ok(field.includes('world.walkable(point.x,point.y)'));
  assert.ok(field.includes('!destination'));
  assert.ok(field.includes('walkedSteps>=encounterAfter'));
  assert.ok(shell.includes("track:'battle'"));
  assert.ok(entry.includes("'src/game/battle/'"));
  assert.ok(code.includes(BATTLE_REQUEST_KEY));
  assert.ok(field.includes(FIELD_RETURN_KEY));
  assert.ok(!/previews\//.test(html));
  for(const p of ['src/game/battle/rules.mjs','src/game/battle/walk.mjs','src/field/walk.mjs','src/game/navigation/game-shell.mjs'])
    execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
});
