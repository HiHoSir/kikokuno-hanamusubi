import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createContext,runInContext} from 'node:vm';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../src/game/story/chapter-one.mjs';
import {TENYO_PLAYER_FOOT_RADIUS,sanctuaryCollisionGeometry,
 shrineCanStand,shrineAdvance,shrineExitReached}
 from '../src/game/tenyo/movement.mjs';

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
  assert.ok(code.includes('shrineExitReached'));
  assert.ok(code.includes('../../field/?from=shrine'));
  assert.ok(field.includes('../game/tenyo/'));
  assert.ok(field.includes('shrineReturnPosition'));
  assert.ok(village.includes("advanceStoryStage('shrine')"));
  for(const path of ['src/game/tenyo/walk.mjs','src/game/story/chapter-one.mjs',
    'src/field/walk.mjs','src/game/village/walk.mjs']){
    execFileSync(process.execPath,['--check',path]);
  }
});

test('production sanctuary paints its entrance within landscape and portrait viewports',()=>{
  const boot=`
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    const viewport={clientWidth:1363,clientHeight:936};
    let view, actor, resize, nextFrame;
    const context={setTransform(){},fillRect(){},drawImage(_world,...args){view=args;}};
    const scene={width:768,height:768,parentElement:viewport,dataset:{},getContext:()=>context};
    const load={hidden:false};
    const element={addEventListener(){}};
    globalThis.window={parent:{}};
    globalThis.document={
      querySelector:id=>({'#scene':scene,'#load':load}[id]??{...element}),
      querySelectorAll:()=>[],
      createElement:()=>({getContext:()=>({
        save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(){},
      })}),
      addEventListener(){},
    };
    globalThis.SMModel={parse:JSON.parse,collision:()=>new Set()};
    globalThis.SMRender={actorBounds(){},draw(_context,_map,options){actor=options.actor;}};
    globalThis.Image=class{naturalWidth=240;async decode(){}};
    globalThis.Audio=class{};
    globalThis.fetch=async url=>({ok:true,text:async()=>readFileSync(url,'utf8')});
    globalThis.addEventListener=()=>{};
    globalThis.requestAnimationFrame=callback=>{nextFrame=callback;};
    globalThis.ResizeObserver=class{
      constructor(callback){resize=callback;}
      observe(parent){assert.equal(parent,viewport);}
    };
    await import('./src/game/tenyo/walk.mjs');
    await new Promise(setImmediate);
    assert.equal(load.hidden,true,'first paint completes the loading screen');
    assert.deepEqual([actor.x,actor.y],[13,23]);
    function checkView(){
      const [left,top,dw,dh]=view;
      assert.ok(Math.abs(scene.width/scene.height-viewport.clientWidth/viewport.clientHeight)<0.005,
        'canvas buffer matches visible aspect ratio');
      const cssPerBufferX=viewport.clientWidth/scene.width;
      const cssPerBufferY=viewport.clientHeight/scene.height;
      const scaleX=(dw/896)*cssPerBufferX,scaleY=(dh/800)*cssPerBufferY;
      assert.ok(Math.abs(scaleX-1)<0.005,'shrine uses the user-selected 1.0 camera');
      assert.ok(Math.abs(scaleY-1)<0.005,'shrine view retains the same CSS scale vertically');
      const toCssX=x=>(left+x*dw/896)*cssPerBufferX;
      const toCssY=y=>(top+y*dh/800)*cssPerBufferY;
      const heroX=toCssX((actor.x+.5)*32);
      const heroFootY=toCssY((actor.y+.5)*32);
      assert.ok(heroX>=0&&heroX<=viewport.clientWidth,
        'Hizuki remains visible horizontally in both orientations');
      assert.ok(heroFootY>=0&&heroFootY<=viewport.clientHeight,
        'Hizuki remains visible vertically in both orientations');
      if(viewport.clientWidth>=896*1){
        assert.ok(Math.abs(toCssX(0)-(viewport.clientWidth-896*1)/2)<1,
          'shorter map has equal blue margins rather than a left anchor');
      }
    }
    checkView();
    Object.assign(viewport,{clientWidth:402,clientHeight:874});
    resize();
    nextFrame(performance.now()+60);
    checkView();
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

test('selected wide-angle camera and previous actual figure-size ratio are independent of collision',()=>{
 const source=readFileSync('src/game/tenyo/walk.mjs','utf8');
 assert.match(source,/TENYO_APPROVED_CAMERA=1/);
 assert.match(source,/TENYO_HERO_ART_FACTOR=0\.52/);
 assert.match(source,/halfHero=previewRecompose\(hero,TENYO_HERO_ART_FACTOR\)/);
 assert.match(source,/const zoom=previewMode\?reviewCamera:TENYO_APPROVED_CAMERA/);
 assert.doesNotMatch(source,/ZOOM=1\.4|heroDisplayScale/);
 const movement=readFileSync('src/game/tenyo/movement.mjs','utf8');
 assert.doesNotMatch(movement,/TENYO_HERO_ART_FACTOR|heroDisplayScale|WORLD_SCENE_ZOOM/);
});
test('sequel doorway between both guardians is a permanent story lock in every profile',()=>{
 const oldBlocked=M.collision(model);
 const seals=map.game.passageLocks;
 assert.equal(seals.length,2);
 assert.deepEqual(seals.map(s=>s.id).sort(),
  ['guardian-sequel-passage','sacred-rear-perimeter']);
 assert.ok(seals.every(s=>s.unlockIn==='sequel'));
 for(const profile of ['legacy','visual']){
  const world=sanctuaryCollisionGeometry(model,oldBlocked,map.game.residents,{profile});
  assert.equal(world.locks.length,2);
  const emptyGuards=sanctuaryCollisionGeometry(model,oldBlocked,[],{profile});
  for(const x of [408,432,448,464,494]){
   assert.equal(shrineCanStand(world,x,244),false,
     'never open guardian passage at '+x+' in '+profile);
   assert.equal(shrineCanStand(emptyGuards,x,244),false,
     'sequel lock must not depend on guardian NPC sprites '+profile);
  }
  const forward=shrineAdvance(world,448,280,0,-1,32);
  assert.ok(forward.y>259,'stop before story-only gate even during a long press: '+profile);
  let cursor={x:448,y:280};
  for(let i=0;i<10;i++){
   const next=shrineAdvance(world,cursor.x,cursor.y,0,-1,32);
   cursor={x:next.x,y:next.y};
  }
  assert.ok(cursor.y>259,'cannot repeatedly push through the future sequel opening: '+profile);
  assert.equal(shrineCanStand(world,448,272),true,
   'can approach and speak with the guards from the south: '+profile);
  assert.equal(shrineCanStand(world,448,218),false,
   'perimeter seal prevents a detour behind the guarded gate: '+profile);
  assert.ok(world.locks.every(l=>l.bottom>l.top&&l.right>l.left));
 }
});

test('shallow is inherently passable; gates block posts AND rails without blocking all water',()=>{
 const b=M.collision(model);
 const visual=sanctuaryCollisionGeometry(model,b,map.game.residents,{profile:'visual'});
 const legacy=sanctuaryCollisionGeometry(model,b,map.game.residents,{profile:'legacy'});
 // Deep water is unsafe. Shallow water, even in the rear background, is
 // physically shallow: only the separate story barrier prevents travel north.
 const cell=(x,y)=>map.waterSurface.find(v=>v.x===x&&v.y===y)?.depth;
 assert.equal(cell(9,6),'shallow');
 assert.equal(cell(9,8),'shallow');
 assert.equal(cell(17,8),'shallow');
 assert.equal(shrineCanStand(visual,304,208),true,
  'a shallow source cell must not inherit the huge decorative rear-water wall');
 assert.equal(shrineCanStand(legacy,304,208),false,
  'old scenic wall remains available strictly for comparison');
 for(const [x,y] of [[304,272],[560,272],[336,272],[304,235]]){
  assert.equal(shrineCanStand(visual,x,y),true,
   'unobstructed shallow water should be walkable at '+x+','+y);
 }
 assert.equal(shrineCanStand(visual,240,208),false,
  'mid/deep water stays non-walkable even with narrower shoreline contact');
 const gate=visual.shapes.filter(s=>s.id?.startsWith(
  map.objects.find(o=>o.templateId==='tenyo_water_gate').id));
 assert.equal(gate.length,4,'both posts and both fence rails need actual contact geometry');
 for(const [x,y] of [[370,240],[522,240],[355,238],[539,238]]){
  assert.equal(shrineCanStand(visual,x,y),false,
   'standing THROUGH visible water-gate post or fence is forbidden');
 }
 assert.equal(shrineCanStand(visual,448,244),false,
  'even the open-looking center remains a sealed sequel entrance');
});

test('outside the field, sanctuary uses independent pixel geometry and continuous foot movement',()=>{
 const world=sanctuaryCollisionGeometry(model,M.collision(model),map.game.residents);
 const oldGridSize=map.tileSize;
 assert.equal(world.width,28*oldGridSize);
 assert.equal(world.height,25*oldGridSize);
 assert.equal(TENYO_PLAYER_FOOT_RADIUS,8);
 assert.ok(world.rects.some(r=>r.source==='rear-scenic-water'));
 assert.ok(!M.collision(model).has('13,7'),'NPC entry is not a forbidden terrain tile');
 const feet=(x,y)=>[(x+.5)*oldGridSize,(y+.5)*oldGridSize];
 for(const [x,y] of [[13,23],[13,22],[13,10],[13,9],[14,8],[12,9],[12,10],[13,8]]){
   const [px,py]=feet(x,y);
   assert.equal(shrineCanStand(world,px,py),true,'approach '+x+','+y);
 }
 assert.equal(shrineCanStand(world,270.37,180.19),false,
  'water behind the gate is blocked using a non-grid pixel rectangle');
 assert.equal(shrineCanStand(world,...feet(12,8)),false,'Shirotae foot blocks');
 assert.equal(shrineCanStand(world,...feet(13,7)),false,'guardian foot blocks');
 assert.equal(shrineCanStand(world,...feet(12,8.75)),true,'NPC accessible from its actual foot');
 assert.equal(shrineCanStand(world,...feet(12,8.5)),false,'NPC feet can actually collide');
 assert.equal(shrineCanStand(world,...feet(8,10)),false,'lantern island cannot be crossed');
 assert.equal(shrineExitReached(world,432,768),true);
 assert.equal(shrineExitReached(world,432,760),false);
 const before=feet(13,23);
 const moved=shrineAdvance(world,...before,1,0,3.37);
 assert.ok(Math.abs(moved.traveled-3.37)<0.001,'no 8px or 32px step snapping');
 assert.ok(Math.abs(moved.x-(before[0]+3.37))<0.001);
 const second=shrineAdvance(world,moved.x,moved.y,0,-1,1.75);
 assert.ok(Math.abs(second.y-(before[1]-1.75))<0.001);
 assert.equal(shrineAdvance(world,...before,1,0,0).traveled,0);
 const walk=readFileSync('src/game/tenyo/walk.mjs','utf8');
 assert.match(walk,/shrineAdvance\(collider,state\.x,state\.y,dx,dy,/);
 assert.match(walk,/movementUnit='world-pixels'/);
 assert.doesNotMatch(walk,/TENYO_STEP|SPEED_MS\*TENYO_STEP/);
});
test('all three character source frames stay 80x112 while painted size is selected separately',()=>{
 assert.equal(Object.hasOwn(map.game,'heroDisplayScale'),false,
   'unreviewed hero-only shrink is prohibited');
 const renderer=sandbox.SMRender,im={width:240,height:448};
 const bounds=renderer.actorBounds(im,()=>{throw Error('village atlas should never be downconverted')});
 const draw=entity=>{
   const calls=[],ctx={drawImage(...args){calls.push(args)}};
   renderer.actor(ctx,{x:3,y:5,dir:'u',frame:1},im,bounds,32);
   const [,sx,sy,sw,sh,dx,dy,dw,dh]=calls[0];
   assert.deepEqual([sx,sy,sw,sh],[80,112,80,112],entity);
   assert.deepEqual([dx,dy,dw,dh],[72,70,80,112],entity);
   return [dw,dh];
 };
 const actual=[draw('Hizuki'),draw('Shirotae'),draw('guardian')];
 assert.deepEqual(actual,[[80,112],[80,112],[80,112]]);
 const walk=readFileSync('src/game/tenyo/walk.mjs','utf8');
 const painter=readFileSync('src/game/tenyo/rendering/render.js','utf8');
 assert.match(walk,/TENYO_APPROVED_CAMERA=1/);
 assert.match(walk,/TENYO_HERO_ART_FACTOR=0\.52/);
 assert.match(walk,/WORLD_ACTOR_FRAME/);
 assert.doesNotMatch(walk,/ZOOM=1\.4|heroDisplayScale/);
 assert.doesNotMatch(painter,/heroDisplayScale|displayScale/);
 assert.ok(!map.game.residents.some(n=>n.displayScale!==undefined));
 assert.equal(map.game.residents.filter(n=>n.id.startsWith('guardian')).length,2);
});
