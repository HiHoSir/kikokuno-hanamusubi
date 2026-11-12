import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
  assert.ok(html.includes('controls.css'));
  assert.ok(html.includes('dialogue.css'));
  assert.ok(html.includes('selection-guard.mjs'));
  assert.ok(!html.includes('previews/')&&!html.includes('id="debug"'));
  assert.ok(code.includes('SMRender.draw'));
  assert.ok(code.includes('SMModel.collision'));
  assert.ok(code.includes('lighting:true,reflections:true,atmosphere:true,depthOfField:true'));
  assert.ok(code.includes('waterfall-loop.m4a'));
  assert.ok(code.includes('bindDialogue'));
  assert.ok(code.includes("advanceStoryStage('cove')"));
  assert.ok(code.includes('exitReached'));
  assert.ok(code.includes('../../field/?from=shrine'));
  assert.ok(field.includes('../game/tenyo/'));
  assert.ok(field.includes('shrineReturnPosition'));
  assert.ok(village.includes("advanceStoryStage('shrine')"));
  for(const path of ['src/game/tenyo/walk.mjs','src/game/story/chapter-one.mjs',
    'src/field/walk.mjs','src/game/village/walk.mjs']){
    execFileSync(process.execPath,['--check',path]);
  }
});

test('production sanctuary ESM entry links and begins loading its canonical map',()=>{
  const boot=`
    globalThis.document={
      querySelector:sel=>({
        '#scene':{getContext:()=>({})},
        '#status':{textContent:''}, '#objective':{textContent:''},'#load':{hidden:false}
      }[sel]||null),
      querySelectorAll:()=>[],
    };
    globalThis.SMModel={parse(){}};
    globalThis.SMRender={draw(){}};
    globalThis.fetch=()=>new Promise(()=>{});
    await import('./src/game/tenyo/walk.mjs');
  `;
  execFileSync(process.execPath,['--input-type=module','-e',boot],{timeout:10000,stdio:'pipe'});
});

test('Shirotae and both shrine guards share village-scale transparent atlas conventions',()=>{
  const hero='assets/characters/hizuki/walk-4dir-80x112.png';
  const white='assets/characters/npc/shirotae-walk-4dir-80x112.png';
  const guard='assets/characters/npc/shrine-guardian-walk-4dir-80x112.png';
  assert.equal(map.game.hero,hero,'field-only SD32 is not allowed inside sanctuary');
  assert.equal(map.game.residents.find(x=>x.id==='shirotae').asset,white);
  const sentries=map.game.residents.filter(x=>x.id.startsWith('guardian'));
  assert.equal(sentries.length,2);
  assert.ok(sentries.every(x=>x.asset===guard),'two guards reuse ONE approved image');
  const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
  for(const [key,path] of [['tenyo-shirotae',white],['tenyo-guardian',guard]]){
    const record=manifest.assets.find(x=>x.id===key);
    assert.equal(record.path,path);
    const bytes=readFileSync(path);
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),240,'3 frames each 80 pixels wide');
    assert.equal(bytes.readUInt32BE(20),448,'4 directions each 112 pixels tall');
    assert.ok(bytes.indexOf(Buffer.from('tRNS'))!==-1,'must have transparent PNG palette');
    const gitSha=createHash('sha1').update('blob '+bytes.length).update(Buffer.from([0])).update(bytes).digest('hex');
    assert.equal(gitSha,record.gitBlobSha,'manifest must identify exactly the approved PNG');
  }
  assert.equal(C.byId.sanctuary_npc_shirotae.src,white);
  assert.equal(C.byId.sanctuary_npc_guard.src,guard);
  for(const oldPath of ['shirotae-walk-4dir-32.png','shrine-guardian-walk-4dir-32.png'])
    assert.equal(existsSync('assets/characters/npc/'+oldPath),false,'obsolete same-role sprite must be removed');
});

test('original sanctuary renderer draws 80x112 atlas frames at the SAME foot anchor as the village',()=>{
  const renderer=sandbox.SMRender,image={width:240,height:448};
  const bounds=renderer.actorBounds(image,()=>{throw Error('fixed 96x128 buffer is forbidden for village atlas')});
  const calls=[];
  const ctx={drawImage(...args){calls.push(args)}};
  for(const [dir,row] of [['d',0],['u',1],['r',2],['l',3]]){
    renderer.actor(ctx,{x:3,y:5,dir,frame:1},image,bounds,32);
    const args=calls.at(-1);
    assert.equal(args[1],80,'second walking frame');
    assert.equal(args[2],row*112,'correct directional row');
    assert.equal(args[3],80);
    assert.equal(args[4],112);
    assert.equal(args[5],72,'foot X = tile center minus 40');
    assert.equal(args[6],70,'foot Y = tile center minus 106');
    assert.equal(args[7],80);
    assert.equal(args[8],112);
    assert.equal(renderer.actorDepth({x:3,y:5,dir},bounds,32),176,'depth is ground contact, not head height');
  }
});

test('sanctuary screenshot regression: player is not giant compared with Shirotae and the shrine',()=>{
  const scale=map.game.heroDisplayScale;
  assert.equal(map.game.hero,'assets/characters/hizuki/walk-4dir-80x112.png');
  assert.equal(scale,0.52,'scene-specific display scale, NOT an asset downsize');
  const renderer=sandbox.SMRender,im={width:240,height:448};
  const bounds=renderer.actorBounds(im,()=>{throw Error('village atlas should not use the 32px sampling canvas');});
  const calls=[];
  const ctx={drawImage(...args){calls.push(args);}};
  const a={x:3,y:5,dir:'u',frame:1};
  renderer.actor(ctx,a,im,bounds,32,null,scale);
  const [,sx,sy,sw,sh,dx,dy,dw,dh]=calls[0];
  assert.deepEqual([sx,sy,sw,sh],[80,112,80,112],'keep full village-scale source atlas');
  const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.0001,`expected ${expected}, got ${actual}`);
  near(dw,80*scale);near(dh,112*scale);
  near(dx,(a.x+.5)*32-40*scale);
  near(dy,(a.y+.5)*32-106*scale);
  near(dx+40*scale,(a.x+.5)*32);
  near(dy+106*scale,(a.y+.5)*32);
  assert.equal(renderer.actorDepth(a,bounds,32),(a.y+.5)*32,'feet, shadows and occlusion retain the same location');
  const walk=readFileSync('src/game/tenyo/walk.mjs','utf8');
  assert.ok(walk.includes('heroDisplayScale:map.game.heroDisplayScale??1'),'renderer receives authored visual scale');
  assert.ok(!walk.includes('map.game.heroDisplayScale*32'),'logical 32px cell movement must not scale with sprite');
  // White and the two guards retain their approved relative size.
  assert.equal(map.game.residents.filter(n=>n.id.startsWith('guardian')).length,2);
  assert.ok(!map.game.residents.some(n=>n.displayScale!==undefined),'NPC scale untouched');
});
