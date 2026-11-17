import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {furniture,rooms,prepareInterior} from '../src/game/interiors/rooms.mjs';

const path='assets/village/interiors/furniture.png';
function decodeRGBA(pngPath=path) {
  const png=readFileSync(pngPath);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  assert.equal(png[24],8,'8-bit');
  assert.equal(png[25],6,'RGBA');
  const chunks=[];let offset=8;
  while(offset<png.length){
    const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);
    if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));
    offset+=length+12;
    if(type==='IEND')break;
  }
  const source=inflateSync(Buffer.concat(chunks));
  const stride=width*4;
  const pixels=Buffer.alloc(stride*height);
  let input=0;
  for(let y=0;y<height;y++){
    const filter=source[input++];
    assert.ok(filter>=0&&filter<=4,'PNG filter');
    for(let i=0;i<stride;i++){
      const left=i>=4?pixels[y*stride+i-4]:0;
      const above=y>0?pixels[(y-1)*stride+i]:0;
      const corner=y>0&&i>=4?pixels[(y-1)*stride+i-4]:0;
      let predictor=0;
      if(filter===1)predictor=left;
      if(filter===2)predictor=above;
      if(filter===3)predictor=(left+above)>>1;
      if(filter===4){
        const p=left+above-corner;
        const a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-corner);
        predictor=a<=b&&a<=c?left:b<=c?above:corner;
      }
      pixels[y*stride+i]=(source[input++]+predictor)&255;
    }
  }
  return {width,height,pixels};
}

test('all 16 furniture props fit native 2px atlas rectangles with matching collision footprints',()=>{
  const {width,height}=decodeRGBA();
  assert.equal(width,896);
  assert.equal(height,704);
  assert.equal(Object.keys(furniture).length,16);
  for(const [name,{sprite,foot}] of Object.entries(furniture)){
    const [x,y,w,h]=sprite;
    assert.ok([x,y,w,h].every(n=>n%2===0),name+' must use 2px grid');
    assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height,name+' within sheet');
    if(foot){
      const [left,top,fw,fh]=foot;
      assert.ok(left>=0&&top>=0&&left+fw<=w&&top+fh<=h,name+' footprint stays inside art');
    }
  }
  assert.equal(furniture.innCounter.sprite[2],212);
  for(const room of Object.values(rooms)) {
    const plan=prepareInterior(room);
    assert.equal(plan.blocked.length,room.width*room.height);
    assert.equal(plan.depthSorted.filter(item=>item.sprite).length,room.furniture.length);
  }
});

test('the 2px furniture atlas is the exact unscaled rendering of the logical-pixel master',()=>{
  const {width,height,pixels}=decodeRGBA();
  const master=decodeRGBA('source-assets/village/interiors/furniture-master.png');
  assert.deepEqual([master.width,master.height],[448,352]);
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const actual=(y*width+x)*4;
      const authored=(Math.floor(y/2)*master.width+Math.floor(x/2))*4;
      for(let c=0;c<4;c++)
        assert.equal(pixels[actual+c],master.pixels[authored+c],`pixel pitch at (${x},${y})`);
    }
  }
  const render=readFileSync('src/game/interiors/walk.mjs','utf8');
  assert.match(render,/context\\.drawImage\\(furniture,\\.\\.\\.object\\.sprite,object\\.x,object\\.y,w,h\\)/);
  assert.match(render,/interior-furniture-2px-1/);
  assert.match(readFileSync('assets/manifest.json','utf8'),/source-assets\\/village\\/interiors\\/furniture-master\\.png/);
});
