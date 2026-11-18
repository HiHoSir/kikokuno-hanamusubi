import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

// Native sprite QA: inspect *all 12 decoded frames*, not just PNG headers.
function png(path) {
 const bytes=readFileSync(path);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path);
 let pos=8,w=0,h=0,type=-1,depth=0;
 const idat=[];
 while(pos<bytes.length){
  const len=bytes.readUInt32BE(pos),kind=bytes.toString('ascii',pos+4,pos+8);
  const data=bytes.subarray(pos+8,pos+8+len);
  if(kind==='IHDR'){
   w=data.readUInt32BE(0);h=data.readUInt32BE(4);
   depth=data[8];type=data[9];
  } else if(kind==='IDAT')idat.push(data);
  pos+=len+12;
  if(kind==='IEND')break;
 }
 assert.deepEqual([w,h,depth,type],[240,448,8,6],path);
 const raw=inflateSync(Buffer.concat(idat));
 const stride=w*4,out=new Uint8Array(w*h*4),previous=new Uint8Array(stride);
 let src=0;
 for(let y=0;y<h;y++){
  const filter=raw[src++];
  const cur=new Uint8Array(stride);
  for(let i=0;i<stride;i++){
   const a=i<4?0:cur[i-4],b=previous[i],c=i<4?0:previous[i-4];
   let predict=0;
   if(filter===1)predict=a;
   else if(filter===2)predict=b;
   else if(filter===3)predict=(a+b)>>1;
   else if(filter===4){
    const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
    predict=da<=db&&da<=dc?a:db<=dc?b:c;
   }else assert.equal(filter,0);
   cur[i]=(raw[src++]+predict)&255;
  }
  out.set(cur,y*stride);
  previous.set(cur);
 }
 return {data:out,w,h};
}
const fisherman='assets/characters/npc/ushiohei-walk-4dir-80x112.png';
const source='assets/characters/npc/farm-worker-walk-4dir-80x112.png';

test('Ushiohei has a real native 12-frame walking PNG and preserves NPC feet/silhouette',()=>{
 const a=png(fisherman),b=png(source);
 let changed=0,blue=0;
 for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++){
  const i=(y*a.w+x)*4;
  assert.equal(a.data[i+3],b.data[i+3],
   'palette editing must not change silhouette or crop NPC pixels '+x+','+y);
  if(a.data[i+3]>120){
   if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2])
    changed++;
   if(a.data[i+2]>a.data[i]&&a.data[i+1]>a.data[i]&&y%112>=44&&y%112<=84)
    blue++;
  }
 }
 assert.ok(changed>500,'fisher must not just duplicate original farmer');
 assert.ok(blue>250,'indigo fisherman clothing must appear across all directions');
 for(let direction=0;direction<4;direction++)for(let frame=0;frame<3;frame++){
  let count=0,minX=80,maxX=-1,minY=112,maxY=-1;
  for(let cy=0;cy<112;cy++)for(let cx=0;cx<80;cx++){
   const x=frame*80+cx,y=direction*112+cy;
   if(a.data[(y*a.w+x)*4+3]>120){
    count++;minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);
    minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
   }
  }
  assert.ok(count>400,'empty frame '+direction+','+frame);
  assert.ok(minX>=6&&maxX<=73,'frame image bleeds outside own cell');
  assert.ok(minY>=6&&maxY<=105,'feet/head cut off '+direction+','+frame);
 }
});

test('game displays dedicated male fisherman without altering other villagers',()=>{
 const scene=readFileSync('src/game/cove/walk.mjs','utf8');
 assert.match(scene,/fisher:'assets\/characters\/npc\/ushiohei-walk-4dir-80x112\.png'/);
 assert.doesNotMatch(scene,/fisher:'assets\/characters\/npc\/villager-walk/);
 const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
 assert.equal(manifest.assets.filter(a=>a.path===fisherman).length,1);
 assert.match(readFileSync('tools/generate-ushiohei-sprite.py','utf8'),
   /farm-worker-walk-4dir-80x112\.png/);
});
