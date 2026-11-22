export const VILLAGE_FENCE_ART='assets/village/terrain/auto-fence.png';
export const VILLAGE_GATE_POST_ART='assets/village/scene/sprite-60.png';
const tile=32;
const rails=[[0,-1,1,13,0,6,16],[1,0,2,16,13,16,6],
  [0,1,4,13,16,6,16],[-1,0,8,0,13,16,6]];

export function makeVillageFence(segments,blocked,width){
  const cells=new Map();
  const lastRow=blocked.length/width/tile-1;
  for(const [x,y,endX,endY] of segments){
    for(let ty=y;ty<=endY;ty++)for(let tx=x;tx<=endX;tx++){
      cells.set(ty*width/tile+tx,[tx,ty]);
    }
  }
  const has=(x,y)=>x>=0&&x<width/tile&&cells.has(y*width/tile+x);
  return [...cells.values()].map(([tx,ty])=>{
    const x=tx*tile,y=ty*tile;
    let mask=0;
    for(const [dx,dy,bit,left,top,w,h] of rails){
      if(!has(tx+dx,ty+dy))continue;
      mask|=bit;
      for(let row=y+top;row<y+top+h;row++){
        blocked.fill(1,row*width+x+left,row*width+x+left+w);
      }
    }
    // The join and end posts share the same foot line as the rails.
    for(let row=y+13;row<y+19;row++)blocked.fill(1,row*width+x+13,row*width+x+19);
    const gatePost=ty===lastRow&&(mask===2||mask===8);
    if(mask===2||mask===8){
      const left=mask===2?(gatePost?0:4):16;
      const right=mask===8?(gatePost?32:28):16;
      for(let row=y+13;row<y+19;row++)blocked.fill(1,row*width+x+left,row*width+x+right);
    }
    if(mask===1||mask===4){
      const top=mask===1?16:6,bottom=mask===1?26:16;
      for(let row=y+top;row<y+bottom;row++)blocked.fill(1,row*width+x+13,row*width+x+19);
    }
    return {point:[x,y],depth:y+16,mask,gatePost};
  });
}

export function drawVillageFence(ctx,art,postArt,{point:[x,y],mask,gatePost}){
  ctx.drawImage(art,(mask%8)*tile,Math.floor(mask/8)*tile,tile,tile,x,y,tile,tile);
  if(!gatePost)return;
  ctx.save();
  ctx.translate(mask===2?x+tile:x,y+20-postArt.naturalHeight);
  ctx.scale(mask===2?-1:1,1);
  ctx.drawImage(postArt,0,0);
  ctx.restore();
}
