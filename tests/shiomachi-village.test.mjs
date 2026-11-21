import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {COVE_SHORE,COVE_MAP} from '../data/maps/sea-cove/scene.mjs';
import {SHORE_Y} from '../data/maps/shoreline-study/scene.mjs';
import {
 SHIOMACHI_MAP,SHIOMACHI_WIDTH,SHIOMACHI_HEIGHT,SHIOMACHI_TILE,
 SHIOMACHI_SHORE,SHIOMACHI_BUILDINGS,SHIOMACHI_PROPS,SHIOMACHI_NPCS,
 SHIOMACHI_REVIEW_SPOTS,SHIOMACHI_PIER,shiomachiWalkableCell,shiomachiIsExit,
 shiomachiCollision,shiomachiPierFixtureCollision
} from '../data/maps/shiomachi-village/scene.mjs';
import {roadCell} from '../src/game/shiomachi/render.mjs';
import {residentInFront} from '../src/game/village/residents.mjs';
import {DEFAULT_CAMERA_ZOOM} from '../src/game/village/render.mjs';

const read=path=>readFileSync(path,'utf8');
const dimensions=path=>{
 const b=readFileSync(path);
 assert.equal(b.subarray(1,4).toString(),'PNG',path);
 return [b.readUInt32BE(16),b.readUInt32BE(20)];
};
function blocked(x,y){
 return !shiomachiWalkableCell(x,y)||
   shiomachiCollision(SHIOMACHI_MAP.objects,x*32+16,y*32+16,7);
}
function connected(from,condition){
 const q=[from],visited=new Set([from.join(',')]);
 for(const [x,y] of q){
   if(condition(x,y))return true;
   for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
     const nx=x+dx,ny=y+dy,k=nx+','+ny;
     if(visited.has(k)||blocked(nx,ny))continue;
     visited.add(k);q.push([nx,ny]);
   }
 }
 return false;
}

test('this review is a separate village, not a replacement for the original sea cove',()=>{
 assert.equal(SHIOMACHI_MAP.id,'shiomachi-village');
 assert.equal(COVE_MAP.id,'sea-cove');
 assert.equal(SHIOMACHI_WIDTH,42);
 assert.equal(SHIOMACHI_HEIGHT,54);
 assert.equal(SHIOMACHI_TILE,32,'coast/ground mapchip only, NOT a building size constraint');
 assert.deepEqual(SHIOMACHI_SHORE,COVE_SHORE,'reuse approved shoreline as a separate instance');
 assert.deepEqual(SHIOMACHI_SHORE.slice(0,30),SHORE_Y);
 assert.equal(SHIOMACHI_MAP.tiles.length,54);
 for(let y=0;y<54;y++){
   const row=SHIOMACHI_MAP.tiles[y];
   assert.equal(row.length,42);
   for(let x=0;x<42;x++)
     assert.equal(row[x],y<SHIOMACHI_SHORE[x]?'~':'s','shore '+x+','+y);
 }
 assert.deepEqual([COVE_MAP.width,COVE_MAP.height],[42,44],
   'do not expand or overwrite the actual sea-cove map');
});

test('the small fishing village uses native roof and gear dimensions with no scenery scaling',()=>{
 assert.equal(SHIOMACHI_BUILDINGS.length,4);
 assert.equal(SHIOMACHI_PROPS.length,8);
 assert.equal(SHIOMACHI_NPCS.length,4);
 const map=SHIOMACHI_MAP;
 const art={
   houseThatch:[390,357],houseTile:[360,373],teahouse:[420,410],
   netRack:[232,176],netBundle:[146,88],barrel:[64,86],
   basket:[80,74],ropeCoil:[88,62],crate:[92,70]
 };
 const paths={
  houseThatch:'assets/village/scene/house-thatch.png',
  houseTile:'assets/village/scene/house-tile.png',
  teahouse:'assets/village/scene/teahouse.png',
  netRack:'assets/sea-cove/objects/net-drying-rack-232x176.png',
  netBundle:'assets/sea-cove/objects/net-bundle-146x88.png',
  barrel:'assets/sea-cove/objects/fish-barrel-64x86.png',
  basket:'assets/sea-cove/objects/fish-basket-80x74.png',
  ropeCoil:'assets/sea-cove/objects/rope-coil-88x62.png',
  crate:'assets/sea-cove/objects/fish-crate-92x70.png'
 };
 for(const [id,expected] of Object.entries(art))assert.deepEqual(dimensions(paths[id]),expected,id);
 for(const building of SHIOMACHI_BUILDINGS){
   assert.deepEqual([building.width,building.height],art[building.sprite]);
   assert.equal(building.collision.left,building.x-building.width/2);
   assert.equal(building.collision.top,building.y-building.height);
   assert.equal(building.collision.bottom,building.y);
   assert.ok(building.collision.left>0&&building.collision.right<42*32);
   assert.ok(building.collision.top>0&&building.collision.bottom<54*32);
 }
 for(const o of SHIOMACHI_PROPS){
   assert.deepEqual([o.width,o.height],art[o.sprite],o.id);
   assert.ok(o.x-o.width/2>=0&&o.x+o.width/2<=42*32,o.id+' x bounds');
   assert.ok(o.y-o.height>=0&&o.y<=54*32,o.id+' y bounds');
 }
 for(let i=0;i<SHIOMACHI_BUILDINGS.length;i++)
   for(let j=i+1;j<SHIOMACHI_BUILDINGS.length;j++){
     const a=SHIOMACHI_BUILDINGS[i].collision,b=SHIOMACHI_BUILDINGS[j].collision;
     assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,
       'houses must not interpenetrate: '+i+','+j);
   }
});

test('walkable south entrance, open main street, pier and dialogue approaches',()=>{
 const {entry,residents,pier,objects}=SHIOMACHI_MAP;
 const from=[Math.floor(entry.x/32),Math.floor(entry.y/32)];
 assert.equal(blocked(...from),false);
 assert.equal(shiomachiIsExit(entry.x,entry.y),false);
 assert.equal(shiomachiIsExit(674,1698),true);
 assert.equal(shiomachiWalkableCell(20,5),true,'pier extends into ocean');
 assert.equal(shiomachiWalkableCell(19,5),false,'ocean outside pier remains solid');
 assert.equal(shiomachiWalkableCell(23,6),false,'no passable water next to pier');
 assert.equal(pier.left,20);
 assert.equal(roadCell(20,35),true);
 assert.equal(roadCell(20,52),true);
 assert.equal(roadCell(4,35),false);
 assert.ok(connected(from,(x,y)=>y<=16&&x>=19&&x<=22),
   'entry must connect to coast and the dock');
 for(const npc of residents){
   const cx=Math.floor(npc.x/32),cy=Math.floor(npc.y/32);
   assert.equal(shiomachiCollision(objects,npc.x,npc.y,7),false,npc.name+' is outside scenery collision');
   assert.ok(connected(from,(x,y)=>
     Math.hypot(x*32+16-npc.x,y*32+16-npc.y)<62),
     'player needs a path to '+npc.name);
   assert.ok(Array.isArray(npc.lines)&&npc.lines.length>=2,npc.id);
   assert.ok(npc.lines.every(line=>line.startsWith(npc.name+'「')&&line.endsWith('」')),npc.id);
 }
 // QA shortcuts should be safe and make one real NPC available in front.
 for(const [name,spot] of Object.entries(SHIOMACHI_REVIEW_SPOTS)){
   assert.ok(shiomachiWalkableCell(Math.floor(spot.x/32),Math.floor(spot.y/32)),name);
   assert.equal(shiomachiCollision(objects,spot.x,spot.y,7),false,name);
 }
 for(const [spotName,npcId] of [['buildings','tide-elder'],['worksite','net-mender']]){
   const spot=SHIOMACHI_REVIEW_SPOTS[spotName];
   assert.equal(residentInFront(spot.x,spot.y,spot.face,residents)?.id,npcId);
 }
});

test('the user-generated pier is a native transparent sprite, no fake bridge-tile loop',()=>{
 const pier=SHIOMACHI_PIER,art='assets/shiomachi/objects/wooden-pier-128x360.png';
 assert.deepEqual(dimensions(art),[128,360]);
 const png=readFileSync(art);
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.deepEqual([pier.left,pier.right,pier.top,pier.bottom],[20,22,3,13]);
 assert.deepEqual(pier.image,{x:688,footY:448,width:128,height:360});
 assert.ok(pier.image.x-pier.image.width/2>=pier.left*32-16);
 assert.equal(pier.image.footY,(pier.bottom+1)*32);
 // The deck is reachable through sea tiles, open-sided for future boarding.
 for(const y of [3,4,5,6,7,8,9,10,11,12,13]){
   assert.equal(shiomachiWalkableCell(21,y),true,'walkable pier center '+y);
   assert.equal(shiomachiWalkableCell(19,y),y<SHIOMACHI_SHORE[19]?false:true,
     'deep water beside dock stays unwalkable');
 }
 assert.ok(shiomachiPierFixtureCollision(653,147,7));
 assert.ok(shiomachiPierFixtureCollision(725,413,7));
 assert.equal(shiomachiPierFixtureCollision(688,240,7),false,
   'clear central walkway from village to the open tip');
 const rendering=read('src/game/shiomachi/render.mjs');
 const walk=read('src/game/shiomachi/walk.mjs');
 assert.ok(rendering.includes('ctx.drawImage(art.pierNative'),
   'the renderer must draw the generated one-piece dock art');
 assert.ok(!rendering.includes('atlasX=')&&!rendering.includes('art.pier,atlasX'),
   'remove repeated bridge tiles');
 assert.ok(walk.includes("pierNative:'assets/shiomachi/objects/wooden-pier-128x360.png'"));
 assert.ok(walk.includes('shiomachiPierFixtureCollision(x,y,7,map)'));
 assert.ok(!walk.includes('auto-bridge.png'));
});

test('review UI is landscape only, same 0.5 zoom, no purchases or save writes',()=>{
 assert.equal(DEFAULT_CAMERA_ZOOM,0.5);
 const html=read('previews/shiomachi-village/index.html');
 const walk=read('src/game/shiomachi/walk.mjs');
 const render=read('src/game/shiomachi/render.mjs');
 assert.match(html,/shiomachi\/walk\.mjs/);
 assert.match(html,/@media\(orientation:portrait\)/);
 assert.match(html,/id="collision-toggle"/);
 assert.match(html,/id="dialogue"/);
 assert.match(html,/id="action-a"/);
 assert.match(html,/id="action-b"/);
 assert.match(html,/id="pad" class="controls"/,
   'review must use the same full-screen controller host as production');
 assert.ok(html.includes('src/game/ui/controls.css'),
   'shared controller stylesheet is the one source of layout truth');
 for(const id of ['up','down','left','right'])
   assert.match(html,new RegExp('id="'+id+'" type="button" data-dir="'+id+'"'));
 assert.match(html,/<details class="review-tools"/,
   'debug shortcuts must stay folded by default');
 for(const oldLayout of ['.dpad{','grid-template-columns:repeat(3,44px)','width:min(100%,980px)'])
   assert.ok(!html.includes(oldLayout),'custom controller layout must be absent: '+oldLayout);
 assert.match(walk,/const \[nx,ny\]=walk\.move/);
 assert.match(walk,/bindDialogue\(clearInput\)/);
 assert.match(walk,/requestAnimationFrame\(frame\)/);
 assert.match(walk,/previewOnly:true/);
 assert.doesNotMatch(walk,/savePlayer|saveGame|localStorage|sessionStorage|advanceStoryStage|KIKOKU_ROUTE\.go/);
 assert.match(render,/prepareCoveArt\(map,art\)/);
 assert.match(render,/prepareCoveSurf\(map,landscape.shoreMask\)/);
 assert.match(render,/tideFrame\(time\)/);
 assert.match(render,/drawCharacter\(ctx,obj\)/);
 assert.match(render,/ctx\.drawImage\(art\.pierNative/);
 assert.ok(existsSync('docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md'));
});
