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

test('the field entry loads the original authored map and elevation data', () => {
  assert.match(source('data/maps/field/terrain.js'), /referenceComposition/);
  const {YK_WORLD: world, YK_FIELD_TERRAIN: terrain} = loadField();
  assert.equal(world.tileSize, 32);
  assert.equal(world.size, 2560);
  assert.equal(world.mapData.length, 80);
  assert.ok(world.mapData.every(row => row.length === 80));
  assert.equal(world.mapData.elevationEnabled, true);
  assert.equal(digest(terrain.tiles), '8a6a964a6de03a0883b9223b228dfc59b9b2527903a75a28e984b207a6113efe');
  assert.equal(digest(terrain.heights), 'a2281bea3735928cb1197099852b7b1a89dcdb678a51cbb840dc54fe2581c16e');
  assert.equal(digest(terrain.referenceComposition), '3a691fc2475e001f389b4044663b466871d5c1bdd0aca8e91a286004102ddd83');
  assert.equal(world.walkable(...world.start), true);
  assert.equal(world.walkable(16, 16), false);
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

test('early exploration meadow links two authored route cells without moving destinations', () => {
 const {YK_WORLD: world, YK_FIELD_TERRAIN: terrain} = loadField();
 const start=[31,62],end=[28,53],glade=[27,59];
 const center=([x,y])=>[x*32+16,y*32+16];
 const queue=[start],visited=new Set([start.join(',')]);
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
   const nx=x+dx,ny=y+dy,key=nx+','+ny;
   if(nx<22||nx>34||ny<52||ny>63||visited.has(key))continue;
   if(world.canMove(...center([x,y]),...center([nx,ny]))){visited.add(key);queue.push([nx,ny]);}
  }
 }
 assert.ok(visited.has(end.join(',')), 'side route rejoins existing path');
 assert.ok(visited.has(glade.join(',')), 'forest meadow is reachable');
 assert.equal(terrain.tiles[59][27], 'grass');
 for (const [key,cell] of Object.entries({
  village:[37,70],shrine:[20,45],cove:[49,50],forest:[60,33],waterfall:[67,20],hotspring:[22,17],fox:[40,5]
 })) assert.deepEqual(Array.from(terrain.referenceComposition.places[key]),cell);
});
test('the eastern raised lookout uses authored heights and does not replace water or roads', () => {
 const {YK_WORLD: world, YK_FIELD_TERRAIN: terrain} = loadField();
 const top=terrain.heights.slice(55,64).flatMap((row,j)=>row.slice(36,45).map((h,i)=>({h,x:36+i,y:55+j})));
 assert.ok(top.some(t=>t.h===1),'lower terrace');
 assert.ok(top.some(t=>t.h===2),'higher lookout');
 assert.ok(top.filter(t=>t.h>0).every(t=>['grass','forest'].includes(terrain.tiles[t.y][t.x])));
 assert.equal(terrain.referenceComposition.decorations.filter(o=>o.kind==='wildflowers').length, 19);
 assert.deepEqual(world.roads.length,terrain.referenceComposition.roads.length);
});


test('highland has 32px traversable slopes on south, east and west, and a north descent', () => {
 const {YK_WORLD:world, YK_FIELD_TERRAIN:terrain,YK_ELEVATION:elevation}=loadField();
 const m=world.mapData,pos=([x,y])=>[x*32+16,y*32+16];
 const routes={
  south:[[40,65],[40,64],[40,63],[40,62],[40,61],[40,60],[40,59]],
  west:[[34,60],[35,60],[36,60],[37,60],[38,60],[38,59],[39,59],[40,59]],
  east:[[46,61],[45,61],[44,61],[43,61],[43,60],[43,59],[42,59],[41,59],[40,59]],
  north:[[40,59],[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53]]
 };
 const slopes=terrain.referenceComposition.slopeConnections;
 assert.equal(slopes.length,8);
 assert.deepEqual(slopes.map(s=>s.dir).sort().join(''), 'ee'+'nn'+'ss'+'ww');
 for(const [name,route] of Object.entries(routes)){
  for(let i=1;i<route.length;i++){
   assert.equal(world.canMove(...pos(route[i-1]),...pos(route[i])),true,name+' traversal '+i);
   assert.equal(world.canMove(...pos(route[i]),...pos(route[i-1])),true,name+' reverse '+i);
  }
 }
 assert.equal(m.ladders.filter(l=>l.lower[0]>=34&&l.lower[0]<=46&&l.lower[1]>=53&&l.lower[1]<=64).length,0,'no highland ladders');
 assert.equal(elevation.validate(m).length,0);
 assert.ok(m.travelReachable.has('40,59'));
});

test('rear-side slopes connect the summit to lower ground and return to the front entrance', () => {
 const {YK_WORLD: world, YK_ELEVATION: elevation} = loadField();
 const map=world.mapData;
 const pos=([x,y])=>[x*32+16,y*32+16];
 const rear=[[40,59],[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53],[36,53],[36,54],[36,55]];
 assert.equal(map.ramps[57][40],'s','upper ramp from height 2 to 1');
 assert.equal(map.ramps[54][37],'s','lower ramp from height 1 to 0');
 assert.equal(map.heights[58][40],2);
 assert.equal(map.heights[56][40],1);
 assert.equal(map.heights[53][37],0);
 assert.equal(elevation.validate(map).length,0,'existing elevation contract remains valid');
 for(let i=1;i<rear.length;i++){
   assert.equal(world.canMove(...pos(rear[i-1]),...pos(rear[i])),true,'rear descent '+i);
   assert.equal(world.canMove(...pos(rear[i]),...pos(rear[i-1])),true,'rear ascent '+i);
 }
 // Avoid ladders and elevated cells for the return. The route must make a
 // genuine loop through the existing ground, rather than teleporting.
 const start=[36,55],goal=[40,65],queue=[start],visited=new Set([start.join(',')]);
 for(let i=0;i<queue.length&&!visited.has(goal.join(','));i++){
   const [x,y]=queue[i];
   for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
     const nx=x+dx,ny=y+dy,k=nx+','+ny;
     if(nx<12||nx>54||ny<43||ny>76||visited.has(k)||map.heights[ny]?.[nx]!==0)continue;
     if(world.canMove(...pos([x,y]),...pos([nx,ny]))){visited.add(k);queue.push([nx,ny]);}
   }
 }
 assert.ok(visited.has(goal.join(',')),'lower meadow reconnects to the front ladder entrance');
 assert.ok(map.travelReachable.has('37,53'),'rear exit is reachable from the village');
});
