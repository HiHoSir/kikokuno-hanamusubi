import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../src/game/story/chapter-one.mjs';

const map=JSON.parse(readFileSync('data/maps/tenyo-sanctuary/scene.json','utf8'));
const open=(x,y)=>map.grid[y]?.[x]==='.';
const npcCells=new Set(map.residents.map(n=>n.tile.join(',')));
const available=(x,y)=>open(x,y)&&!npcCells.has(x+','+y);

function route(from,to){
  const queue=[from],seen=new Set([from.join(',')]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    if(x===to[0]&&y===to[1])return true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=nx+','+ny;
      if(available(nx,ny)&&!seen.has(key)){seen.add(key);queue.push([nx,ny]);}
    }
  }
  return false;
}

test('the adopted Tenyo layers share the authored 48x32 collision map',()=>{
  assert.equal(map.tileSize,32);
  assert.equal(map.columns,48);
  assert.equal(map.rows,32);
  assert.equal(map.grid.length,32);
  for(const row of map.grid)assert.equal(row.length,48);
  for(const path of Object.values(map.images))assert.ok(existsSync(path),path);
  assert.ok(existsSync(map.hero));
  for(const npc of map.residents)assert.ok(existsSync(npc.asset),npc.asset);
  const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
  for(const path of [...Object.values(map.images),...map.residents.map(n=>n.asset)]){
    assert.ok(manifest.assets.some(asset=>asset.path===path&&asset.status==='approved'),path);
  }
});

test('south entrance, Shirotae interaction, and return are reachable on foot',()=>{
  assert.ok(available(...map.spawn));
  const shirotae=map.residents.find(n=>n.id==='shirotae');
  assert.ok(shirotae);
  assert.ok(open(...shirotae.tile));
  const around=[[0,1],[0,-1],[-1,0],[1,0]].map(([dx,dy])=>[shirotae.tile[0]+dx,shirotae.tile[1]+dy]);
  assert.ok(around.some(tile=>available(...tile)&&route(map.spawn,tile)), '白妙の前に到達できる');
  assert.ok(map.southExit.columns.some(x=>available(x,map.southExit.row)&&route(map.spawn,[x,map.southExit.row])), 'フィールドに徒歩で戻れる');
  for(const guard of map.residents.filter(n=>n.id!=='shirotae'))assert.ok(open(...guard.tile));
});

test('a saved chapter-one stage only advances and survives revisiting the village',()=>{
  const data=new Map();
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.equal(readStoryStage(storage),'chief');
  assert.equal(advanceStoryStage('shrine',storage),'shrine');
  assert.equal(readStoryStage(storage),'shrine');
  assert.equal(advanceStoryStage('cove',storage),'cove');
  assert.equal(advanceStoryStage('shrine',storage),'cove');
  assert.match(objectiveForStage(readStoryStage(storage)),/海の入り江/);
  assert.equal(readStoryStage({getItem:()=>{throw Error('denied');}}),'chief');
});

test('sanctuary is a production area with shared controls, story, audio and route',()=>{
  const html=readFileSync('src/game/tenyo/index.html','utf8');
  const code=readFileSync('src/game/tenyo/walk.mjs','utf8');
  const field=readFileSync('src/field/walk.mjs','utf8');
  const village=readFileSync('src/game/village/walk.mjs','utf8');
  assert.match(html,/data-bgm="prologue"/);
  for(const id of ['up','down','left','right','action-a','action-b','dialogue','speaker','line','next']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/controls\.css/);
  assert.match(html,/dialogue\.css/);
  assert.match(html,/selection-guard\.mjs/);
  assert.doesNotMatch(html,/previews\/|id="debug"/);
  assert.match(code,/bindDialogue/);
  assert.match(code,/advanceStoryStage\('cove'\)/);
  assert.match(code,/isSouthExit/);
  assert.match(code,/\.\.\/\.\.\/field\/\?from=shrine/);
  assert.match(field,/\.\.\/game\/tenyo\//);
  assert.match(field,/shrineReturnPosition/);
  assert.match(village,/advanceStoryStage\('shrine'\)/);
  for(const path of ['src/game/story/chapter-one.mjs','src/game/tenyo/walk.mjs','src/field/runtime.mjs','src/field/walk.mjs','src/game/village/walk.mjs']){
    execFileSync(process.execPath,['--check',path]);
  }
});
