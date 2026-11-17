import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
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
  assert.ok(render.includes('context.drawImage(furniture,...object.sprite,object.x,object.y,w,h)'));
  assert.ok(render.includes('interior-wall-anchor-1'));
  assert.ok(readFileSync('assets/manifest.json','utf8').includes('source-assets/village/interiors/furniture-master.png'));
});

test('kamado pixels have the same restrained shading and pixel scale as other furniture',()=>{
  const master=decodeRGBA('source-assets/village/interiors/furniture-master.png');
  const [atlasX,atlasY,w,h]=furniture.kitchen.sprite;
  assert.deepEqual([atlasX,atlasY,w,h],[0,352,148,144],'no change in sprite geometry');
  const ox=atlasX/2,oy=atlasY/2;
  const rgba=(x,y)=>[...master.pixels.subarray(((oy+y)*master.width+ox+x)*4,((oy+y)*master.width+ox+x)*4+4)];
  for(let y=0;y<12;y++)for(let x=0;x<w/2;x++)
    assert.equal(rgba(x,y)[3],0,`static steam at (${x},${y})`);
  for(const [name,x,y] of [['pot handle',28,16],['wood lid',20,20],
    ['stove',35,44],['firebox',28,60],['mortar',60,40],['stone foot',60,65]])
    assert.equal(rgba(x,y)[3],255,`${name} should remain intact`);
  const colors=new Set();
  for(let y=0;y<h/2;y++)for(let x=0;x<w/2;x++){
    const pixel=rgba(x,y);
    if(pixel[3]>0)colors.add(pixel.slice(0,3).join(','));
  }
  assert.ok(colors.size>=36&&colors.size<=48,`kamado has ${colors.size} visible colors instead of <=48`);
  assert.deepEqual(furniture.kitchen.foot,[8,74,132,66]);
  const rendered=readFileSync('src/game/interiors/walk.mjs','utf8');
  assert.ok(rendered.includes('furniture.png?v=interior-kamado-style-1'),'Safari must not keep old atlas');
});

test('all non-kamado parts of the logical furniture atlas are bit-for-bit unchanged',()=>{
  const {width,height,pixels}=decodeRGBA('source-assets/village/interiors/furniture-master.png');
  assert.deepEqual([width,height],[448,352]);
  const outside=Buffer.alloc((width*height-74*72)*4);
  let offset=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x<74&&y>=176&&y<248)continue;
    outside.set(pixels.subarray((y*width+x)*4,(y*width+x+1)*4),offset);
    offset+=4;
  }
  assert.equal(createHash('sha256').update(outside).digest('hex'),
    'd5b595bfc5a888f1e82c3b58792934380b84ceb5249b141236dae102046ce4dc');
});
