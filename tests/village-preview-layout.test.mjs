import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VILLAGES,HEIGHT,WIDTH,villageBlockers} from '../data/maps/village-previews/scenes.mjs';
import {rooms} from '../src/game/interiors/rooms.mjs';
import {makeWalk} from '../src/game/village/movement.mjs';
import {RESIDENT_RADIUS} from '../src/game/village/residents.mjs';

const buildingArt={inn:'inn',tile:'house-tile',thatch:'house-thatch'};
function buildingBounds(building){
 const png=readFileSync(new URL('../assets/village/scene/'+buildingArt[building.sprite]+'.png',import.meta.url));
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 return {left:building.x-width/2,right:building.x+width/2,top:building.y-height,bottom:building.y};
}

const step=16;
const snap=value=>Math.round(value/step)*step;
const key=(x,y)=>y*WIDTH+x;

function reachableFrom(walk,[x,y]){
 const start=[snap(x),snap(y)];
 assert.ok(walk.canStand(...start));
 const pending=[start];
 const visited=new Set([key(...start)]);
 for(let i=0;i<pending.length;i++){
   const [x,y]=pending[i];
   for(const [dx,dy] of [[0,-step],[step,0],[0,step],[-step,0]]){
     const nx=x+dx,ny=y+dy,id=key(nx,ny);
     if(nx<0||nx>=WIDTH||ny<0||ny>=HEIGHT||visited.has(id)||!walk.canStand(nx,ny))continue;
     const [movedX,movedY]=walk.move(x,y,dx,dy);
     if(movedX!==nx||movedY!==ny)continue;
     visited.add(id);
     pending.push([nx,ny]);
   }
 }
 return visited;
}

for(const map of Object.values(VILLAGES)){
 test(map.name+' has accessible buildings and clear patrol loops',()=>{
   const blocked=villageBlockers(map);
   const walk=makeWalk(WIDTH,HEIGHT,blocked,8);
   const accessible=reachableFrom(walk,map.spawn);
   const buildings=map.objects.filter(object=>object.site);
   assert.equal(buildings.length,6);
   assert.equal(buildings.filter(object=>object.site.room==='armory').length,1);
   assert.equal(new Set(buildings.map(object=>object.site.id)).size,buildings.length);
   for(const [i,building] of buildings.entries()){
     const a=buildingBounds(building);
     for(const other of buildings.slice(i+1)){
       const b=buildingBounds(other);
       assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,
         building.id+' and '+other.id+' do not overlap');
     }
     const {site}=building;
     if(site.room==='inn'||site.room==='armory')
       assert.equal(building.sign,site.room==='inn'?'sign':'signArmory',site.name+' has a storefront sign');
     assert.ok(rooms[site.room],site.name);
     assert.ok(walk.canStand(site.x,site.returnY),site.name+' return position');
     assert.ok(accessible.has(key(snap(site.x),snap(site.returnY))),site.name+' accessible from spawn');
     const [x,y]=walk.move(site.x,site.returnY,0,site.thresholdY-site.returnY-2);
     assert.ok(x===site.x&&y<site.thresholdY,site.name+' approach');
   }
   const npcWalk=makeWalk(WIDTH,HEIGHT,blocked,RESIDENT_RADIUS);
   assert.equal(map.residents.length,4);
   for(const npc of map.residents){
     assert.ok(npc.speed>0&&npc.route.length>2,npc.name);
     for(const [i,[x,y]] of npc.route.entries()){
       const [nx,ny]=npc.route[(i+1)%npc.route.length];
       assert.ok((x===nx)!==(y===ny),npc.name+' walks in four directions');
       assert.ok(npcWalk.canStand(x,y),npc.name+' stands clear of obstacles');
       const [mx,my]=npcWalk.move(x,y,nx-x,ny-y);
       assert.deepEqual([mx,my],[nx,ny],npc.name+' patrol leg');
     }
   }
 });
}
