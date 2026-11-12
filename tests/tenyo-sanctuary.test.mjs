import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createContext,runInContext} from 'node:vm';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../src/game/story/chapter-one.mjs';

const raw=readFileSync('data/maps/tenyo-sanctuary/scene.json','utf8');
const map=JSON.parse(raw);
const sandbox=createContext({});
for(const script of ['catalog','autotile','model','render']){
  const path='src/game/tenyo/rendering/'+script+'.js';
  runInContext(readFileSync(path,'utf8'),sandbox,{filename:path});
}
const M=sandbox.SMModel,C=sandbox.SMCatalog;
const model=M.parse(raw);
const blocked=M.collision(model);
const occupied=new Set(map.game.residents.map(npc=>npc.tile.join(',')));
const open=(x,y)=>M.inside(model,[x,y])&&!blocked.has(x+','+y)&&!occupied.has(x+','+y);
function route(from,to){
  const q=[from],seen=new Set([from.join(',')]);
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i];
    if(x===to[0]&&y===to[1])return true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=nx+','+ny;
      if(open(nx,ny)&&!seen.has(k)){q.push([nx,ny]);seen.add(k);}
    }
  }
  return false;
}
const fileForId=id=>'assets/tenyo/'+id.replaceAll('_','-').toLowerCase()+'.png';

test('accepted water sanctuary map is restored instead of the older 48x32 forest scene',()=>{
  assert.equal(map.tileSize,32);
  assert.equal(map.width,28);
  assert.equal(map.height,25);
  assert.equal(map.objects.length,78);
  assert.equal(map.waterSurface.length,700);
  assert.ok(map.waterSurface.some(v=>v.depth==='deep'));
  assert.ok(map.waterSurface.some(v=>v.depth==='shallow'));
  assert.ok(map.objects.some(v=>v.templateId==='sanctuary_forest_frame_v3'));
  assert.ok(map.objects.some(v=>v.templateId==='sanctuary_fall_v2'));
  assert.ok(map.objects.some(v=>v.templateId==='tenyo_water_gate'));
  assert.deepEqual(map.game.entrySpawn,[13,23]);
  assert.equal(map.game.residents.length,3);
  assert.equal(map.game.source.path,'assets/settlement-editor/maps/tenyo-sanctuary-water-v5.json');
  assert.ok(sandbox.SMRender.draw);
  assert.equal(M.validate(model).length,0);
});

test('all runtime artwork and waterfall audio are adopted with no dead old layers',()=>{
  const ids=new Set([
    ...map.objects.map(v=>v.templateId),
    ...(map.waterBottom||[]).map(v=>v.tileId),
    'clear_water_shallow','clear_water_mid','clear_water_deep','tenyo_ripple_fx',
    ...['deep_mid','mid_shallow'].flatMap(pair=>['N','E','S','W'].map(dir=>'clear_water_shore_'+pair+'_'+dir)),
  ]);
  const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
  const registered=new Set(manifest.assets.filter(a=>a.status==='approved').map(a=>a.path));
  for(const id of ids){
    assert.ok(C.byId[id],id);
    const path=fileForId(id);
    assert.ok(existsSync(path),path);
    assert.ok(registered.has(path),path);
  }
  for(const p of [map.game.hero,...map.game.residents.map(n=>n.asset),'assets/tenyo/waterfall-loop.m4a']){
    assert.ok(existsSync(p),p);
    assert.ok(registered.has(p),p);
  }
  for(const wrong of ['background.webp','shrine.webp','torii.webp','forest.webp'])
    assert.equal(existsSync('assets/tenyo/'+wrong),false,'unapproved 48x32 scene deleted: '+wrong);
});

test('walkable entry, Shirotae and both guards have reachable conversations and exit',()=>{
  const entry=map.game.entrySpawn;
  assert.ok(open(...entry));
  const people=map.game.residents;
  assert.deepEqual(people.find(n=>n.id==='shirotae').tile,[12,8]);
  assert.deepEqual(people.filter(n=>n.id.startsWith('guardian')).map(n=>n.tile),[[13,7],[14,7]]);
  for(const npc of people){
    assert.equal(blocked.has(npc.tile.join(',')),false,npc.id+' actor anchor must be valid');
    const adjacent=[[0,1],[0,-1],[1,0],[-1,0]].map(([dx,dy])=>[npc.tile[0]+dx,npc.tile[1]+dy]);
    assert.ok(adjacent.some(pos=>open(...pos)&&route(entry,pos)),npc.id+' reachable from entry');
  }
  assert.ok(map.game.southExit.columns.some(x=>open(x,map.game.southExit.row)&&route(entry,[x,map.game.southExit.row])));
});

test('chapter-one progression advances only after Shirotae and cannot reset',()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.equal(readStoryStage(storage),'chief');
  assert.equal(advanceStoryStage('shrine',storage),'shrine');
  assert.equal(advanceStoryStage('cove',storage),'cove');
  assert.equal(advanceStoryStage('shrine',storage),'cove');
  assert.match(objectiveForStage(readStoryStage(storage)),/海の入り江/);
  assert.ok(map.game.residents.find(n=>n.id==='shirotae').dialogue.shrine.length>=4);
});

test('the production game loads original water render, common controller and field routing',()=>{
  const html=readFileSync('src/game/tenyo/index.html','utf8');
  const code=readFileSync('src/game/tenyo/walk.mjs','utf8');
  const field=readFileSync('src/field/walk.mjs','utf8');
  const village=readFileSync('src/game/village/walk.mjs','utf8');
  for(const name of ['catalog','autotile','model','render'])assert.match(html,new RegExp('rendering/'+name+'\\.js'));
  for(const id of ['up','down','left','right','action-a','action-b','dialogue','speaker','line','next'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/controls\\.css/);
  assert.match(html,/dialogue\\.css/);
  assert.match(html,/selection-guard\\.mjs/);
  assert.doesNotMatch(html,/previews\\/|id="debug"/);
  assert.match(code,/SMRender\\.draw/);
  assert.match(code,/SMModel\\.collision/);
  assert.match(code,/lighting:true,reflections:true,atmosphere:true,depthOfField:true/);
  assert.match(code,/waterfall-loop\\.m4a/);
  assert.match(code,/bindDialogue/);
  assert.match(code,/advanceStoryStage\\('cove'\\)/);
  assert.match(code,/exitReached/);
  assert.match(code,/\\.\\.\\/\\.\\.\\/field\\/\\?from=shrine/);
  assert.match(field,/\\.\\.\\/game\\/tenyo\\//);
  assert.match(field,/shrineReturnPosition/);
  assert.match(village,/advanceStoryStage\\('shrine'\\)/);
  for(const path of ['src/game/tenyo/walk.mjs','src/game/story/chapter-one.mjs',
    'src/field/walk.mjs','src/game/village/walk.mjs']){
    execFileSync(process.execPath,['--check',path]);
  }
});
