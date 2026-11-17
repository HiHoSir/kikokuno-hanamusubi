import test from 'node:test';
import assert from 'node:assert/strict';
import {rooms, furniture, prepareInterior, resolveFurniturePlacement} from '../src/game/interiors/rooms.mjs';
import {BACK_WALL_FLOOR_Y,BACK_WALL_CONTACT_Y,SIDE_WALL_CLEAR_X,FRONT_WALL_TOP_OFFSET,FRONT_WALL_FURNITURE_GAP} from '../src/game/interiors/room-geometry.mjs';

const HERO_RADIUS = 8;
const GRID_STEP = 4;
const CUSHION_COUNTS = {teahouse:4, inn:2, 'house-farm':2, 'house-family':2, 'house-craft':1};

function layoutObjects(room) {
  return room.furniture.map(entry => {
    const {asset,x,y,sprite,foot} = resolveFurniturePlacement(room,entry);
    const [, ,width,height] = sprite;
    return {asset,x,y,width,height,foot,depth:foot ? y+foot[1]+foot[3] : y+height};
  });
}
function overlap(a,b) {
  return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))
    * Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
}

test('furniture layouts have room-specific seating and no visual sprite overlaps or floor overhangs',()=>{
  for (const [name,room] of Object.entries(rooms)) {
    const objects=layoutObjects(room);
    for (let i=0;i<objects.length;i++) {
      const obj=objects[i];
      assert.ok(obj.x>=32 && obj.x+obj.width<=room.width-32,`${name}:${obj.asset} outside inner wall`);
      assert.ok(obj.y+obj.height<=room.height-32,`${name}:${obj.asset} extends beyond floor`);
      for (let j=i+1;j<objects.length;j++)
        assert.equal(overlap(obj,objects[j]),0,`${name}:${obj.asset} overlaps ${objects[j].asset}`);
    }
    if (name in CUSHION_COUNTS)
      assert.equal(objects.filter(obj=>obj.asset==='cushion').length,CUSHION_COUNTS[name],`${name} seating arrangement`);
  }
});

function accessible(plan,room) {
  const {blocked}=plan, {width,height}=room;
  const cols=Math.floor(width/GRID_STEP),rows=Math.floor(height/GRID_STEP);
  const map=new Uint8Array(cols*rows);
  const offsets=[];
  for (let dy=-HERO_RADIUS;dy<=HERO_RADIUS;dy++)
    for (let dx=-HERO_RADIUS;dx<=HERO_RADIUS;dx++)
      if (dx*dx+dy*dy<=HERO_RADIUS*HERO_RADIUS) offsets.push([dx,dy]);
  function canStand(x,y) {
    for (const [dx,dy] of offsets) {
      const px=x+dx,py=y+dy;
      if (px<0 || py<0 || px>=width || py>=height || blocked[py*width+px]) return false;
    }
    return true;
  }
  let walkable=0;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) {
    if(canStand(x*GRID_STEP,y*GRID_STEP)) {
      map[y*cols+x]=1;walkable++;
    }
  }
  const sx=Math.round(plan.spawn[0]/GRID_STEP),sy=Math.round(plan.spawn[1]/GRID_STEP);
  assert.equal(map[sy*cols+sx],1,room.name+' spawn must be clear for 8px hero');
  const reachable=new Uint8Array(cols*rows);
  const queue=[sy*cols+sx];reachable[queue[0]]=1;
  for(let index=0;index<queue.length;index++) {
    const p=queue[index],x=p%cols,y=Math.floor(p/cols);
    for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nx=x+dx,ny=y+dy;
      if(nx<0 || nx>=cols || ny<0 || ny>=rows)continue;
      const target=ny*cols+nx;
      if(map[target]&&!reachable[target]){reachable[target]=1;queue.push(target);}
    }
  }
  assert.equal(queue.length,walkable,room.name+' must have no disconnected walkable pockets');
  const withinReach=(tx,ty,facingUpOnly)=>{
    for(let p=0;p<reachable.length;p++) {
      if(!reachable[p])continue;
      const px=(p%cols)*GRID_STEP,py=Math.floor(p/cols)*GRID_STEP;
      const dx=tx-px,dy=ty-py,dist=Math.hypot(dx,dy);
      if(dist>=65 || dist<=10)continue;
      if(facingUpOnly) {
        if(dy>=0 || Math.abs(dx)>28)continue;
      } else if(!(Math.abs(dx)<=28 || Math.abs(dy)<=28))continue;
      return true;
    }
    return false;
  };
  return {withinReach};
}

test('all seven rooms retain walkable routes, conversations, and hidden tansu searches',()=>{
  for (const [name,room] of Object.entries(rooms)) {
    const plan=prepareInterior(room);
    const {withinReach}=accessible(plan,room);
    const npc=plan.resident;
    const [nx,ny]=npc.talkPoint??[npc.x,npc.y];
    assert.ok(withinReach(nx,ny,!!npc.talkPoint),`${name}: resident must remain reachable`);
    if(name==='house-family'||name==='house-craft') {
      const chest=plan.depthSorted.find(obj=>obj.asset==='tansu');
      const [x,y,w,h]=chest.footprint;
      assert.ok(withinReach(x+w/2,y+h-4,true),`${name}: hidden item chest is no longer reachable`);
    }
  }
});

test('wall-mounted furniture stays aligned to actual architecture rather than fixed coordinates',()=>{
  assert.equal(BACK_WALL_FLOOR_Y,128);
  assert.equal(BACK_WALL_CONTACT_Y,BACK_WALL_FLOOR_Y+16);
  for (const [name,room] of Object.entries(rooms)) {
    for (const entry of room.furniture) {
      const [asset,requestX,requestY]=entry;
      const {x,y,foot,sprite}=resolveFurniturePlacement(room,entry);
      if(requestY==='back-wall')assert.equal(y+foot[1],BACK_WALL_CONTACT_Y,name+':'+asset+' rear contact');
      if(requestX==='left-wall')assert.equal(x,SIDE_WALL_CLEAR_X,name+':'+asset+' left contact');
      if(requestX==='right-wall')assert.equal(x+sprite[2],room.width-SIDE_WALL_CLEAR_X,name+':'+asset+' right contact');
      if(requestY==='front-wall')assert.equal(y+sprite[3],room.height-FRONT_WALL_TOP_OFFSET-FRONT_WALL_FURNITURE_GAP,name+':'+asset+' front contact');
    }
  }
  const mandatory={teahouse:['merchantShelf','kitchen'],shop:['merchantShelf','tansu'],inn:['tansu'],armory:['weaponRack','tansu'],
    'house-farm':['supplies','tansu'],'house-family':['tansu'],'house-craft':['merchantShelf','tansu','supplies']};
  for(const [name,assets] of Object.entries(mandatory))for(const asset of assets)
    assert.ok(rooms[name].furniture.some(([id,,y])=>id===asset&&y==='back-wall'),name+':'+asset+' missing rear wall anchor');
});
