import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const entry = new URL('src/field/index.html', root);
const source = (path, base = root) => readFileSync(new URL(path, base), 'utf8');

function loadField() {
  const manifest = JSON.parse(source('assets/manifest.json'));
  const paths = new Set(manifest.assets.map(({path}) => path));
  class FieldImage {
    set src(url) {
      const target = new URL(url);
      const path = target.pathname.slice(root.pathname.length);
      assert.ok(paths.has(path), `unregistered image: ${path}`);
      const png = readFileSync(target);
      this.naturalWidth = png.readUInt32BE(16);
      this.naturalHeight = png.readUInt32BE(20);
      this.complete = true;
      this.onload?.();
    }
  }
  const context = createContext({Image: FieldImage, URL, document: {currentScript: {src: entry.href}}});
  context.window = context;
  const html = source(entry);
  for (const [, path] of html.matchAll(/<script src="([^"]+)"/g)) {
    const url = new URL(path, entry);
    context.document.currentScript.src = url.href;
    runInContext(source(url), context, {filename: url.pathname});
  }
  return context;
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the field foreground clouds and shadows share a registered moving layer', () => {
  const html = source(entry);
  assert.match(html, /class="field-weather" aria-hidden="true"/);
  assert.match(html, /class="cloud-track"[^>]*>\s*<div class="cloud-shadows"[^>]*><\/div>\s*<div class="foreground-clouds"[^>]*><\/div>/);
  const image = html.match(/url\(["']?([^"'()]*cloud-overlay\.png)(?:\?[^"'()]*)?["']?\)/)?.[1];
  assert.ok(image, 'foreground cloud texture URL');
  const url = new URL(image, entry);
  const path = url.pathname.slice(root.pathname.length);
  const manifest = JSON.parse(source('assets/manifest.json'));
  assert.ok(manifest.assets.some(asset => asset.path === path && asset.type === 'effect'));
  const png = readFileSync(url);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [640, 240]);
  assert.equal(png[25], 6, 'RGBA texture supplies the shadow alpha mask');
});

// A fixed 23-cell basin revision. Reconstructing the old terrain with these
// cells must recover the original hashes, so unrelated field cells stay safe.
const waterfallBasinEdits=[
 [65,15,'mountain','grass'],
 [66,15,'mountain','river'],
 [68,15,'mountain','grass'],
 [65,16,'mountain','river'],
 [66,16,'mountain','river'],
 [68,16,'mountain','river'],
 [65,17,'mountain','river'],
 [66,17,'mountain','river'],
 [64,18,'mountain','grass'],
 [65,18,'grass','river'],
 [69,18,'grass','river'],
 [70,18,'mountain','river'],
 [71,18,'mountain','grass'],
 [72,18,'mountain','grass'],
 [64,19,'mountain','grass'],
 [65,19,'grass','river'],
 [66,19,'grass','river'],
 [71,19,'mountain','river'],
 [68,20,'grass','river'],
 [71,20,'mountain','river'],
 [68,21,'grass','river'],
 [71,21,'mountain','grass'],
 [68,22,'grass','river']
];
test('the field entry loads the approved exploration map and elevation data', () => {
  assert.match(source('data/maps/field/terrain.js'), /referenceComposition/);
  const {YK_WORLD: world, YK_FIELD_TERRAIN: terrain} = loadField();
  assert.equal(world.tileSize, 32);
  assert.equal(world.size, 2560);
  assert.equal(world.mapData.length, 80);
  assert.ok(world.mapData.every(row => row.length === 80));
  assert.equal(world.mapData.elevationEnabled, true);
  const restoredTiles=terrain.tiles.map(row=>row.slice());
  const restoredHeights=terrain.heights.map(row=>row.slice());
  for(const [x,y,from,to] of waterfallBasinEdits){
    assert.equal(terrain.tiles[y][x],to,'waterfall basin '+x+','+y);
    restoredTiles[y][x]=from;
  }
  // The basin replaces only one originally raised grass cell with flat water.
  assert.equal(terrain.heights[21][68],0,'waterline is zero at the lower pool');
  restoredHeights[21][68]=1;
  assert.equal(digest(restoredTiles),'de21dabdd8125fe4be430cb1dc4714d1a7e797c5cec361384817e3778f512999',
    'terrain outside the waterfall basin remains unmodified');
  assert.equal(digest(restoredHeights),'a2281bea3735928cb1197099852b7b1a89dcdb678a51cbb840dc54fe2581c16e',
    'heights outside the waterfall basin remain unmodified');
  assert.equal(terrain.referenceComposition.decorations.length,1019);
  assert.equal(terrain.referenceComposition.waterfallChipLayer.tiles.length,16);
  assert.equal(terrain.referenceComposition.decorations.some(o=>o.kind==='waterfall'),false);
  assert.equal(world.walkable(...world.start), true);
  assert.equal(world.walkable(16, 16), false);
});

test('adopted highland clears diagonal forest corner centers without removing real cliff walls',()=>{
  const {YK_WORLD: world}=loadField();
  const map=world.mapData;
  const at=(x,y)=>[x*32+16,y*32+16];
  const [x,y]=at(60,28);
  assert.equal(map.cornerCut,28);
  assert.ok(world.walkable(x,y),'Hizuki can stand on retained highland');
  assert.equal(world.canMove(x,y,...at(59,28)),true,'west forest corner remains open');
  assert.equal(world.canMove(x,y,...at(60,29)),true,'south forest corner remains open');
  assert.equal(world.canMove(x,y,...at(61,28)),false,'east two-level cliff still blocks');
  assert.ok(map.diagonalSceneryThinning.removed.length>=100,'forests are thinned near real diagonal cliffs');
  assert.ok(map.diagonalSceneryThinning.removed.every(o=>o.kind==='newTrees'),
    'mountains are never deleted to expose a silhouette');
  const expected=new Set(map.decorations.flatMap(o=>o.occupiedTiles.map(c=>c.join(','))));
  assert.deepEqual([...map.occupiedTiles].filter(k=>!expected.has(k)),[],'no invisible object occupancy remains');
  assert.ok(map.decorations.some(o=>o.contactTiles.some(([tx,ty])=>tx===68&&ty===8)),
    'original mountain at (68,8) remains represented');
});

test('author-approved four-frame waterfall atlas preserves the entrance collision contract',()=>{
  const {YK_WORLD:world,YK_AREA_TRANSITIONS:transitions}=loadField();
  const layer=world.mapData.waterfallChipLayer;
  assert.equal(layer.source,'waterfall-south-4w-2h');
  assert.equal(layer.tileSize,32);
  assert.equal(layer.frameCount,4);
  assert.equal(layer.frameDurationMs,180);
  assert.deepEqual(Array.from(layer.frameSize),[128,128]);
  assert.deepEqual(Array.from(layer.origin),[65,16]);
  assert.equal(layer.tiles.length,16);
  assert.equal(new Set(layer.tiles.map(t=>t.cell.join(','))).size,16);
  assert.ok(layer.tiles.every(t=>t.atlas.every(v=>Number.isInteger(v)&&v>=0&&v<4)));
  assert.equal(world.mapData.decorations.some(o=>o.kind==='waterfall'),false);
  assert.deepEqual(Array.from(world.mapData.landmarkContactTiles.waterfall,([x,y])=>[x,y]),
    [[66,18],[67,18],[68,18]]);
  for(const x of [66,67,68])
    assert.equal(transitions.contact(world,x*32+16,18*32+16),'waterfall');
  assert.equal(transitions.contact(world,67*32+16,20*32+16),null);
  assert.ok(world.walkable(67*32+16,18*32+16),'old entrance is passable');
  assert.equal(world.mapData.occupiedTiles.has('67,18'),false);
});

test('waterfall basin uses moving river tiles, clears ghost mountains and preserves the cliff entrance',()=>{
  const {YK_WORLD:world,YK_AREA_TRANSITIONS:transitions}=loadField();
  const m=world.mapData,at=(x,y)=>[x*32+16,y*32+16];
  const wet=waterfallBasinEdits.filter(cell=>cell[3]==='river').map(([x,y])=>[x,y]);
  const formerMountains=waterfallBasinEdits.filter(cell=>cell[2]==='mountain').map(([x,y])=>[x,y]);
  assert.equal(wet.length,16);
  for(const [x,y] of wet){
    assert.equal(m[y][x],'river','falls into animated water, not a grass decal');
    assert.equal(m.heights[y][x],0,'river is at its natural water level');
    assert.equal(world.walkable(...at(x,y)),false,'water collision matches visible water');
  }
  for(const [x,y] of formerMountains){
    assert.equal(m.occupiedTiles.has(x+','+y),false,'retired mountains have no invisible collision');
    assert.ok(!m.decorations.some(o=>['newMountainLarge','newMountainSmall'].includes(o.kind)&&
      o.contactTiles.some(([tx,ty])=>tx===x&&ty===y)),
      'no stray mountains cover the waterfall or plunge pool');
  }
  for(const x of [69,70,71]){
    assert.ok(m.decorations.some(o=>o.kind==='newMountainSmall'&&
      o.contactTiles.some(([tx,ty])=>tx===x&&ty===16)),
      'solid right-bank mountains keep matching 32px sprites');
  }
  const route=[[67,21],[67,20],[67,19],[67,18]];
  for(let i=1;i<route.length;i++){
    assert.ok(world.canMove(...at(...route[i-1]),...at(...route[i])),'entrance route remains walkable');
    assert.ok(world.canMove(...at(...route[i]),...at(...route[i-1])),'entrance has a return route');
  }
  assert.ok(route.every(([x,y])=>m.travelReachable.has(x+','+y)));
  assert.ok(m.ladders.some(l=>l.lower.join(',')==='67,21'&&l.upper.join(',')==='67,20'),
    'original automatically selected ladder is made explicit after basin reshaping');
  assert.equal(transitions.contact(world,...at(67,18)),'waterfall');
  assert.equal(transitions.contact(world,...at(67,19)),null);
  // All 16 added wet cells must join the same flowing water system and reach
  // the already authored downstream river, rather than forming isolated pools.
  const visited=new Set(['67,16']),queue=[[67,16]];
  for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=queue[i][0]+dx,y=queue[i][1]+dy,key=x+','+y;
    if(m[y]?.[x]==='river'&&!visited.has(key)){visited.add(key);queue.push([x,y]);}
  }
  assert.ok(wet.every(([x,y])=>visited.has(x+','+y)),'plunge pool connects to upstream water');
  assert.ok(visited.has('69,25'),'plunge pool feeds the downstream river');
  const actual=new Set(m.decorations.flatMap(o=>o.occupiedTiles.map(c=>c.join(','))));
  assert.deepEqual([...m.occupiedTiles].filter(k=>!actual.has(k)),[]);
});

test('the field projection and image loader retain the original perspective and art', () => {
  const {YK_WORLD: world, YK_LANDSCAPE: landscape, YK_CAMERA: camera, YK_AUTOTILE: autotile} = loadField();
  landscape.load();
  autotile.load();
  assert.ok(landscape.ready(), JSON.stringify(landscape.errors));
  assert.ok(autotile.ready());
  const [x, y] = world.start;
  const view = {x, y};
  assert.equal(landscape.project(x, y, view).x, 320);
  assert.equal(landscape.project(x, y, view).y, 354);
  assert.ok(landscape.project(x, y - 100, view).scale < landscape.project(x, y + 100, view).scale);
  assert.equal(camera.position({x: x + 32, y}, {x, y, at: 1000, duration: 192}, 1096).x, x + 16);
});

test('field movement retains the 32px grid and projects the SD from its foot anchor', async () => {
  const context = loadField();
  globalThis.window = context;
  try {
    const {contact, fieldStep, villageArrival, placeArrival, world} = await import('../src/field/runtime.mjs');
    const [x, y] = villageArrival();
    assert.equal(x % 32, 16);
    assert.equal(y % 32, 16);
    assert.equal(contact(x, y), null);
    assert.ok(world.walkable(x, y));
    const neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const entry = neighbors.map(([dx, dy]) => fieldStep({x, y}, dx, dy, 1000))
      .find(step => step && contact(step.x, step.y) === 'village');
    assert.ok(entry, 'the village entrance is one legal step from the field arrival');
    for (const [destination, column, row] of [['village',37,69],['shiomachi',53,51]]) {
      for (const offset of [0,1]) {
        const x=(column+offset)*32+16,y=row*32+16;
        assert.equal(contact(x,y),destination);
        assert.ok(neighbors.some(([dx,dy])=>{
          const fromX=x-dx*32,fromY=y-dy*32;
          return contact(fromX,fromY)===null&&world.walkable(fromX,fromY)&&
            world.canMove(fromX,fromY,x,y);
        }),destination+' footprint has a walkable approach at column '+(column+offset));
      }
    }

    // Confirm the new destination is actually reachable using the authored
    // field collision and elevation, not just wired by an unwalkable URL.
    const shrineStart=placeArrival('shrine');
    assert.ok(world.walkable(...shrineStart),'safe arrival beside shrine');
    assert.notEqual(contact(...shrineStart),'shrine','return does not immediately re-enter shrine');
    const todo=[shrineStart],seen=new Set([shrineStart.join(',')]);
    let reachableShrine=false;
    for(let i=0;i<todo.length&&!reachableShrine;i++){
      const [px,py]=todo[i];
      for(const [dx,dy] of [[0,32],[0,-32],[32,0],[-32,0]]){
        const nx=px+dx,ny=py+dy,key=nx+','+ny;
        if(!seen.has(key)&&world.canMove(px,py,nx,ny)){
          if(contact(nx,ny)==='shrine'){reachableShrine=true;break;}
          seen.add(key);todo.push([nx,ny]);
        }
      }
    }
    assert.ok(reachableShrine,'shrine contact is reachable after returning to field');
    const fromVillage=villageArrival(),frontier=[fromVillage],visited=new Set([fromVillage.join(',')]);
    let journeyReachable=false;
    for(let i=0;i<frontier.length&&!journeyReachable;i++){
      const [px,py]=frontier[i];
      for(const [dx,dy] of [[0,32],[0,-32],[32,0],[-32,0]]){
        const nx=px+dx,ny=py+dy,key=nx+','+ny;
        if(!visited.has(key)&&world.canMove(px,py,nx,ny)){
          if(contact(nx,ny)==='shrine'){journeyReachable=true;break;}
          visited.add(key);frontier.push([nx,ny]);
        }
      }
    }
    assert.ok(journeyReachable,'walkable field route from village to Tenyo sanctuary');


    assert.equal(Math.abs(entry.x - x) + Math.abs(entry.y - y), 32);
    assert.equal(entry.motion.duration, 256);
    assert.equal(fieldStep({x: 16, y: 16}, -1, 0, 1000), null);
    const spec = JSON.parse(source('data/characters/hizuki-walk.json'));
    const sprite = spec.variants[spec.defaultForArea.field];
    assert.equal(context.YK_FIELD_ASSETS.hero, sprite.path);
    assert.deepEqual([...context.YK_FIELD_ASSETS.heroFootAnchorPx], sprite.footAnchorPx);


  } finally {
    delete globalThis.window;
  }
});

test('a direction tap between animation frames still moves one cell', async () => {
  const listeners = new Map();
  const button = {dataset: {dir: 'up'}, classList: {toggle() {}}, setPointerCapture() {},
    addEventListener: (type, listener) => listeners.set(type, listener)};
  const scene = {dataset: {}, getContext() {}};
  const loading = {hidden: false};
  const frames = [];
  const controller = source('src/field/walk.mjs').replace(/^import .*;\n/gm, '')
    .replaceAll('import.meta.url', '"https://example.test/src/field/walk.mjs"');
  const context = createContext({
    document: {querySelector: selector => ({'#scene': scene, '#load': loading}[selector]),
      querySelectorAll: () => [button], addEventListener() {}},
    location: {search: ''}, URL, URLSearchParams, console, performance: {now: () => 0},
    addEventListener() {}, requestAnimationFrame: frame => frames.push(frame),
    contact: () => null, createFieldRenderer: () => () => {}, loadFieldArt: async () => ({}),
    consumeRestorePosition:()=>null,window:{parent:{}},
    villageArrival: () => [1200, 2256], world: {tileSize: 32},
    fieldStep: ({x, y}, dx, dy, at) => ({x: x + dx * 32, y: y + dy * 32, motion: {x, y, at, duration: 192}}),
  });
  runInContext(controller, context);
  await new Promise(setImmediate);
  assert.equal(loading.hidden, true);
  const tap = {button: 0, pointerId: 1, preventDefault() {}};
  listeners.get('pointerdown')(tap);
  listeners.get('pointerup')(tap);
  listeners.get('lostpointercapture')(tap);
  frames.shift()(100);
  frames.shift()(300);
  assert.deepEqual(scene.dataset, {x: '37', y: '69'});
  frames.shift()(600);
  assert.equal(scene.dataset.y, '69');
  listeners.get('pointerdown')(tap);
  listeners.get('pointercancel')(tap);
  frames.shift()(700);
  frames.shift()(1000);
  assert.equal(scene.dataset.y, '69');
});

test('landscape field draws directly into a wider viewport without a portrait crop',async()=>{
 const html=source(entry);
 assert.match(html,/<main class="field-screen" data-bgm="field">/);
 assert.match(html,/@media \(orientation:landscape\)/);
 assert.match(html,/main\.field-screen #pad\{[\s\S]*?background:transparent/);
 assert.doesNotMatch(html,/grid-template-rows:minmax\(0,1fr\) 108px/);
 assert.doesNotMatch(html,/object-fit:cover/);
 const worldContext=loadField();
 const landscape=worldContext.YK_LANDSCAPE;
 landscape.objects=()=>[];
 landscape.groundLayer=()=>({width:2560,height:2560});
 landscape.motionArt=()=>({width:640,height:240});
 worldContext.YK_WORLD.mapData=Object.assign([['grass']],{decorations:[],heights:[[0]],ramps:[[null]]});
 globalThis.ImageData=class {constructor(data,width,height){Object.assign(this,{data,width,height});}};
 const terrain=new Proxy({}, {get:()=>({})});
 globalThis.document={createElement:()=>{
   const canvas={width:0,height:0};
   canvas.getContext=()=>({canvas,clearRect(){},drawImage(){},fillRect(){},putImageData(){},
     getImageData(){return new ImageData(new Uint8ClampedArray(canvas.width*canvas.height*4),canvas.width,canvas.height);}});
   return canvas;
 }};
 globalThis.window=worldContext;
 const draws=[];
 let cssW=900,cssH=390;
 const display={width:640,height:544,dataset:{},getBoundingClientRect(){return {width:cssW,height:cssH};}};
 const hero={};
 const context={canvas:display,save(){},restore(){},fillRect(){},clearRect(){},
   beginPath(){},ellipse(){},fill(){},translate(){},scale(){},transform(){},rect(){},clip(){},createPattern(){},
   drawImage(...args){if(args[0]===hero)draws.push(args);}};
 try{
   const {createFieldRenderer}=await import('../src/field/runtime.mjs?panoramic-regression');
   const renderer=createFieldRenderer(context,{hero,terrain});
   for(const [w,h,expected] of [[900,390,1255],[1536,706,1184],[844,390,1177]]){
     cssW=w;cssH=h;draws.length=0;
     renderer({x:1200,y:2256,row:0,column:0},0);
     assert.deepEqual([display.width,display.height],[expected,544]);
     assert.equal(display.dataset.fieldViewportWidth,String(expected));
     assert.ok(!Object.hasOwn(display.dataset,'fieldCropTop'));
     assert.equal(draws.length,1,'the actual source sprite is painted once directly onto the wide field');
     const args=draws[0];
     assert.equal(args.length,9);
     assert.ok(Math.abs(args[5]+args[7]/2-expected/2)<40,'hero stays horizontally centered');
     const camera={x:1200,y:2256,centerX:expected/2,foregroundGrowth:true};
     const projected=landscape.project(1200,2272,camera,1.75);
     assert.equal(Number(display.dataset.fieldHeroFoot),Math.round(projected.y));
     assert.equal(args[7],32*projected.scale);
   }
 }finally{delete globalThis.window;delete globalThis.document;delete globalThis.ImageData;}
});
