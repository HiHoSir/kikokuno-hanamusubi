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
  assert.equal(digest(terrain.tiles), 'f0956d5ef070f828359a32a27c68481570f528cac542220ae8a3392a80fd4bd1');
  assert.equal(digest(terrain.heights), '8193650f027e8de6f03468b518fbd1ac330b9be31e214b3aa2d0d9517cd19bb1');
  assert.equal(digest(terrain.referenceComposition), 'dfc801b62e70fea3aa0b0f3609db086df23d713392681b9f7caa938a6680807c');
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
    const {contact, createFieldRenderer, fieldStep, villageArrival, placeArrival, world} = await import('../src/field/runtime.mjs');
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
    assert.equal(entry.motion.duration, 192);
    assert.equal(fieldStep({x: 16, y: 16}, -1, 0, 1000), null);
    const spec = JSON.parse(source('data/characters/hizuki-walk.json'));
    const sprite = spec.variants[spec.defaultForArea.field];
    assert.equal(context.YK_FIELD_ASSETS.hero, sprite.path);
    assert.deepEqual([...context.YK_FIELD_ASSETS.heroFootAnchorPx], sprite.footAnchorPx);

    const hero = {};
    const draws = [];
    const canvas = {
      save() {}, restore() {}, clearRect() {}, fillRect() {}, translate() {}, scale() {},
      beginPath() {}, ellipse() {}, fill() {}, drawImage: (...args) => draws.push(args),
    };
    context.YK_LANDSCAPE.drawQuarter = (_canvas, _map, actor) => actor.draw(100, 200, 0.75);
    createFieldRenderer(canvas, hero)({x, y, row: 2, column: 1}, 0);
    assert.deepEqual(draws, [[hero, 32, 64, 32, 32, 88, 188, 24, 24]]);

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
  const status = {};
  const frames = [];
  const controller = source('src/field/walk.mjs').replace(/^import .*;\n/gm, '')
    .replaceAll('import.meta.url', '"https://example.test/src/field/walk.mjs"');
  const context = createContext({
    document: {querySelector: selector => ({'#scene': scene, '#load': loading, '#status': status}[selector]),
      querySelectorAll: () => [button], addEventListener() {}},
    location: {search: ''}, URL, URLSearchParams, console, performance: {now: () => 0},
    addEventListener() {}, requestAnimationFrame: frame => frames.push(frame),
    contact: () => null, createFieldRenderer: () => () => {}, loadFieldArt: async () => ({}),
    villageArrival: () => [1200, 2256], world: {tileSize: 32, near: () => null},
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

test('landscape field crops the real rendered hero and never double-crops in CSS', async () => {
  const html=source(entry);
  assert.match(html, /<main class="field-screen" data-bgm="field">/);
  assert.match(html, /@media \(orientation:landscape\)/);
  assert.match(html, /canvas\{position:absolute;inset:0;display:block;width:100%;height:100%/);
  assert.match(html, /\.viewport\{position:relative;display:block;overflow:hidden/);
  assert.match(html, /grid-template-rows:minmax\(0,1fr\) 108px/);
  assert.match(html, /main\.field-screen #pad\{[\s\S]*?position:relative/);
  assert.match(html, /main\.field-screen \.viewport canvas\{[\s\S]*?object-fit:fill/);
  assert.doesNotMatch(html, /object-position:center 65%/);

  const worldContext=loadField();
  worldContext.YK_LANDSCAPE.drawQuarter=(_ctx,_map,actor)=>actor.draw(320,354,1.08);
  globalThis.window=worldContext;
  const onScreenCalls=[];
  let width=1536,height=440;
  const display={width:768,height:768,dataset:{},
    getBoundingClientRect(){return {width,height};}};
  const paint=(canvas,calls)=>({
    canvas,save(){},restore(){},clearRect(){},fillRect(){},
    translate(){},scale(){},beginPath(){},ellipse(){},fill(){},
    drawImage(...args){calls.push(args);},
    set imageSmoothingEnabled(value){this._smoothing=value;}
  });
  const displayContext=paint(display,onScreenCalls);
  let sourceBuffer;
  globalThis.document={createElement(tag){
    assert.equal(tag,'canvas');
    const buffer={width:0,height:0};
    buffer.getContext=()=>paint(buffer,[]);
    sourceBuffer=buffer;
    return buffer;
  }};
  try{
    // The query avoids a cached module instance whose world was constructed
    // by a different test. Test the actual exported production renderer.
    const {createFieldRenderer,fieldViewportCrop}=await import('../src/field/runtime.mjs?landscape-camera-regression');
    const render=createFieldRenderer(displayContext,{});
    for(const [w,h] of [[1536,440],[900,282],[1179,320]]){
      width=w;height=h;
      onScreenCalls.length=0;
      render({x:1200,y:2256,row:0,column:0},0);
      const ratio=width/height;
      const heroFoot=Number(display.dataset.fieldHeroFoot);
      const crop=fieldViewportCrop(ratio,heroFoot);
      assert.equal(display.width,768);
      assert.equal(display.height,Math.round(768/ratio));
      assert.equal(sourceBuffer.width,768);
      assert.equal(sourceBuffer.height,768);
      assert.equal(onScreenCalls.length,1,'a single offscreen canvas is composited onto screen');
      const [buffer,sx,sy,sw,sh,dx,dy,dw,dh]=onScreenCalls[0];
      assert.equal(buffer,sourceBuffer);
      assert.deepEqual([sx,sw,sh,dx,dy,dw,dh],[0,768,crop.height,0,0,768,display.height]);
      // dataset is an integer diagnostic; the live renderer keeps sub-pixel
      // precision from its actual projected foot before rounding the label.
      assert.ok(Math.abs(sy-crop.top)<1,'source crop must track drawn foot precisely');
      const footFraction=(heroFoot-sy)/sh;
      assert.ok(footFraction>=.65&&footFraction<=.71,
        'rendered hero foot must remain within 65–71% of the visible field: '+footFraction);
      assert.ok(sy>=0&&sy+sh<=768,'crop must remain inside original projection');
    }
    // Switching back to portrait restores the original 768-square field;
    // nothing about its game state or world coordinates is reset.
    width=390;height=710;
    onScreenCalls.length=0;
    render({x:1200,y:2256,row:0,column:0},0);
    assert.deepEqual([display.width,display.height],[768,768]);
    assert.equal(display.dataset.fieldHeroFoot!==undefined,true);
    assert.equal(onScreenCalls.length,1,'portrait continues to draw the hero directly');
    assert.equal(onScreenCalls[0][0].constructor,Object);
  }finally{
    delete globalThis.window;
    delete globalThis.document;
  }
});
