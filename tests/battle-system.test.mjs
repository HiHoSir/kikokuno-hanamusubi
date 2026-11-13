import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {BATTLE_REQUEST_KEY,FIELD_RETURN_KEY,PLAYER_KEY,ENEMIES,createBattle,
  chooseEnemy,readPlayer,savePlayer,normalizePlayer,DEFAULT_PLAYER,
  STATUS_V2,levelStats,nextLevelXp,physicalDamage,fieldEncounterZone,chooseFieldEncounter} from '../src/game/battle/rules.mjs';

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


test('approved v2 core values match the restored status JSON and battle formula',()=>{
  const canonical=JSON.parse(readFileSync('data/characters/hizuki-status.json','utf8'));
  assert.equal(canonical.status,'approved-v2-core');
  assert.deepEqual(STATUS_V2.base,canonical.level.base);
  assert.deepEqual(STATUS_V2.growth,canonical.level.perLevel);
  for(const item of STATUS_V2.equipment){
    const tier=canonical.tiers.find(t=>t.id===item.id);
    assert.equal(item.attack,tier.weaponAttack);
    assert.equal(item.defense,tier.armorDefense);
  }
  assert.equal(DEFAULT_PLAYER.maxhp,26);
  assert.equal(DEFAULT_PLAYER.attack,9);
  assert.equal(DEFAULT_PLAYER.defense,6);
  assert.equal(levelStats(18,'T4',0).attack,141);
  assert.equal(levelStats(18,'T4',1).attack,149);
  assert.equal(levelStats(18,'T4',1).maxhp,182);
  assert.equal(levelStats(30,'T6',0).attack,224);
  assert.equal(levelStats(30,'T6',2).attack,232);
  assert.equal(physicalDamage(141,30,()=>.5),63);
  assert.equal(physicalDamage(149,30,()=>.5),67);
  assert.equal(nextLevelXp(30),7892);
  assert.equal(nextLevelXp(40),11638);
});

test('battle wins follow B-formula, persist resources and level, and handle a two-foe victory',()=>{
  const combat=createBattle('onibi',DEFAULT_PLAYER,()=>.5);
  const {state}=combat;
  let result;
  for(let i=0;i<12&&!state.outcome;i++){
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

  const leveling=createBattle('field-oni',{...DEFAULT_PLAYER,xp:nextLevelXp(1)-ENEMIES['field-oni'].xp},()=>.5);
  for(let i=0;i<12&&!leveling.state.outcome;i++)leveling.act('attack');
  assert.equal(leveling.state.outcome,'victory');
  assert.equal(leveling.state.hero.lv,2);
  assert.equal(leveling.state.hero.maxhp,34);
  assert.equal(leveling.state.hero.hp,34);
  assert.equal(leveling.state.hero.mp,leveling.state.hero.maxmp);

  const pair=createBattle('tanuki',DEFAULT_PLAYER,()=>.5,2);
  assert.equal(pair.state.enemies.length,2);
  assert.equal(pair.state.enemies[0].hp,6);
  pair.act('attack:1');
  assert.equal(pair.state.enemies[0].hp,6,'first target is untouched');
  assert.equal(pair.state.enemies[1].hp,2,'selected second target takes damage');
  assert.equal(pair.act('attack:8').accepted,false,'invalid targets cannot use a turn');
  for(let i=0;i<10&&!pair.state.outcome;i++)pair.act('attack');
  assert.equal(pair.state.outcome,'victory');
  assert.equal(pair.state.hero.gold,8);
  assert.equal(pair.state.hero.xp,8);
});

test('invalid magic/herbs cost no turn; provisional 糸遊 and つむぎ follow their candidates',()=>{
  const novice=createBattle('field-oni',{...DEFAULT_PLAYER,mp:0,potions:0},()=>.5);
  assert.equal(novice.act('bloom').accepted,false);
  assert.equal(novice.act('heal').accepted,false);
  assert.equal(novice.act('herb').accepted,false);
  assert.equal(novice.state.turn,1);
  assert.equal(novice.state.hero.hp,DEFAULT_PLAYER.hp);
  const caster=createBattle('field-oni',{...DEFAULT_PLAYER,lv:3,hp:30,mp:12},()=>.5);
  assert.equal(caster.act('bloom').accepted,true);
  assert.equal(caster.state.outcome,'victory');
  assert.equal(caster.state.hero.mp,9);
  assert.equal(caster.state.enemy.hp,0);
  const healer=createBattle('field-oni',{...DEFAULT_PLAYER,hp:10,mp:12},()=>.5);
  assert.equal(healer.act('heal').accepted,true);
  assert.equal(healer.state.hero.mp,7);
  assert.ok(healer.state.hero.hp>10);
  assert.equal(healer.act('herb').accepted,true);
  assert.equal(healer.state.hero.potions,2);
  assert.ok(healer.state.hero.hp>0&&healer.state.hero.hp<=healer.state.hero.maxhp);
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
  assert.equal(normalizePlayer({...DEFAULT_PLAYER,hp:999}).hp,26);
});

test('the live encounter pool follows the actual Village-to-Tenyo Shrine road',()=>{
  const terrainSource=readFileSync('data/maps/field/terrain.js','utf8')
    .replace(/^window\.YK_FIELD_TERRAIN=/,'').replace(/;\s*$/,'');
  const terrain=JSON.parse(terrainSource);
  const roads=terrain.referenceComposition.roads.map(route=>route.map(([x,y])=>[x*32+16,y*32+16]));
  const world={roads},road=roads[0];
  const point=([x,y])=>({x,y});
  assert.equal(fieldEncounterZone(point(road[0]),world),'village-outskirts');
  assert.equal(fieldEncounterZone(point(road[10]),world),'village-outskirts');
  assert.equal(fieldEncounterZone(point(road[road.length-4]),world),'shrine-approach');
  assert.equal(fieldEncounterZone({x:2560,y:2560},world),'village-outskirts');
  assert.deepEqual(chooseFieldEncounter(point(road[0]),world,()=>.10),
    {enemyId:'field-oni',count:1,zone:'village-outskirts'});
  assert.deepEqual(chooseFieldEncounter(point(road[0]),world,()=>.90),
    {enemyId:'tanuki',count:2,zone:'village-outskirts'});
  assert.deepEqual(chooseFieldEncounter(point(road.at(-1)),world,()=>.45),
    {enemyId:'onibi',count:1,zone:'shrine-approach'});
  assert.deepEqual(chooseFieldEncounter(point(road.at(-1)),world,()=>.85),
    {enemyId:'tanuki',count:2,zone:'shrine-approach'});
  assert.ok(roads[0].length>30);
});

test('T0 early encounters are winnable without an immediate heal every battle',()=>{
  const expected=[['field-oni',1,3,4],['tanuki',2,4,4],['onibi',1,4,6]];
  for(const [id,count,hits,loss] of expected){
    const combat=createBattle(id,DEFAULT_PLAYER,()=>.5,count);
    let rounds=0;
    while(!combat.state.outcome && rounds<10){combat.act('attack');rounds++;}
    assert.equal(combat.state.outcome,'victory',id);
    assert.equal(rounds,hits,id+' attack count');
    assert.equal(DEFAULT_PLAYER.hp-combat.state.hero.hp,loss,id+' HP loss');
  }
  assert.equal(ENEMIES['field-oni'].xp,8);
  assert.equal(ENEMIES.tanuki.xp*2,8);
  assert.equal(ENEMIES.onibi.xp,9);
  assert.equal(nextLevelXp(1),80); // ~9-10 fights for one level.
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
  assert.ok(code.includes('BATTLE_REQUEST_KEY'));
  assert.ok(field.includes('FIELD_RETURN_KEY'));
  assert.ok(!/previews\//.test(html));
  for(const p of ['src/game/battle/rules.mjs','src/game/battle/walk.mjs','src/field/walk.mjs','src/game/navigation/game-shell.mjs'])
    execFileSync(process.execPath,['--check',p],{stdio:'pipe'});
});

test('production battle module evaluates, paints enemy/status and accepts an attack without browser-only omissions',()=>{
  const program=`
    const nodes=new Map();
    const makeNode=()=>({
      dataset:{},style:{},children:[],textContent:'',src:'',classList:{add(){},remove(){},toggle(){}},
      addEventListener(type,fn){this.listeners??={};this.listeners[type]=fn;},
      replaceChildren(){this.children=[];},append(child){this.children.push(child);}
    });
    globalThis.document={
      getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);},
      querySelectorAll(){return [];},
      createElement(){return makeNode();},
      addEventListener(){},
    };
    globalThis.addEventListener=()=>{};
    globalThis.sessionStorage={getItem:()=>null,removeItem(){}};
    const data=new Map();
    globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
    globalThis.Audio=class{play(){return Promise.resolve()}pause(){}};
    globalThis.setTimeout=fn=>{fn();return 0};
    await import('./src/game/battle/walk.mjs');
    const node=id=>nodes.get(id);
    if(node('enemy-label').textContent!=='野の小鬼')throw Error('approved enemy did not load');
    if(node('hp-label').textContent!=='26 / 26')throw Error('hero status was not rendered');
    if(node('command-list').children.length!==5)throw Error('battle commands were not created');
    node('command-list').children[0].listeners.click();
    if(!data.has('kikokuno-hanamusubi-battle-player'))throw Error('battle turn was not saved');
    if(!node('battle-message').textContent.includes('攻撃'))throw Error('attack was not performed');
  `;
  execFileSync(process.execPath,['--input-type=module','-e',program],{stdio:'pipe',timeout:8000});
});

test('two approved enemies render and can be targeted independently in the production ESM scene',()=>{
  const program=`
    const nodes=new Map();
    const makeNode=()=>({
      dataset:{},style:{},children:[],textContent:'',src:'',hidden:false,
      classList:{add(){},remove(){},toggle(){}},
      addEventListener(type,fn){this.listeners??={};this.listeners[type]=fn;},
      replaceChildren(){this.children=[];},append(child){this.children.push(child);}
    });
    globalThis.document={
      getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);},
      querySelectorAll(){return [];},createElement(){return makeNode();},addEventListener(){}
    };
    globalThis.addEventListener=()=>{};
    globalThis.sessionStorage={
      getItem(key){return key==='kikokuno-hanamusubi-battle-request'?JSON.stringify({enemyId:'tanuki',count:2,at:Date.now()}):null;},
      removeItem(){}
    };
    const store=new Map();
    globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,v)=>store.set(key,v)};
    globalThis.Audio=class{play(){return Promise.resolve()}pause(){}};
    globalThis.setTimeout=fn=>{fn();return 0;};
    await import('./src/game/battle/walk.mjs');
    const node=id=>nodes.get(id);
    if(node('enemy-figure-2').hidden)throw Error('second enemy hidden');
    if(!node('enemy-label-2').textContent.includes('化け狸'))throw Error('second enemy not drawn');
    node('command-list').children[0].listeners.click();
    const targets=node('command-list').children;
    if(targets.length!==3)throw Error('two-target command menu not shown');
    targets[1].listeners.click();
    if(!store.has('kikokuno-hanamusubi-battle-player'))throw Error('targeted hit was not saved');
    if(!node('battle-message').textContent.includes('攻撃'))throw Error('targeted battle action not executed');
  `;
  execFileSync(process.execPath,['--input-type=module','-e',program],{stdio:'pipe',timeout:8000});
});
