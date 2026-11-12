((root,f)=>{const api=f();if(typeof module==='object'&&module.exports)module.exports=api;else root.SMAutotile=api;})(globalThis,()=>{
'use strict';
const directions=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]];
function normalize(mask){let n=mask&15;if((n&3)===3&&(mask&16))n|=16;if((n&6)===6&&(mask&32))n|=32;if((n&12)===12&&(mask&64))n|=64;if((n&9)===9&&(mask&128))n|=128;return n;}
const masks=[...new Set(Array.from({length:256},(_,i)=>normalize(i)))].sort((a,b)=>a-b),indices=Object.fromEntries(masks.map((m,i)=>[m,i]));
function maskAt(set,x,y){let mask=0;for(const [dx,dy,b]of directions)if(set.has((x+dx)+','+(y+dy)))mask|=b;return normalize(mask);}
function occupied(mask,x,y){if(x===0&&y===0)return true;const d=directions.find(d=>d[0]===x&&d[1]===y);return !!(d&&(mask&d[2]));}
// Shared quarter geometry: 4px banks, 24px minimum channel, concave diagonal corners.
function core(mask,px,py){const tx=Math.floor(px/32),ty=Math.floor(py/32);if(!occupied(mask,tx,ty))return false;const x=px-tx*32,y=py-ty*32,sx=x<16?-1:1,sy=y<16?-1:1,u=x<16?x:31-x,v=y<16?y:31-y,h=occupied(mask,tx+sx,ty),w=occupied(mask,tx,ty+sy),diag=occupied(mask,tx+sx,ty+sy);if(h&&w)return diag||u*u+v*v>=16;if(h)return v>=4;if(w)return u>=4;if(u<4||v<4)return false;return u>=8||v>=8||(u-8)*(u-8)+(v-8)*(v-8)<=16;}
function line(from,to){let [x,y]=from;const dx=Math.sign(to[0]-x),dy=Math.sign(to[1]-y),wx=Math.abs(to[0]-x),wy=Math.abs(to[1]-y),out=[];while(x!==to[0]||y!==to[1]){if(x===to[0])y+=dy;else if(y===to[1])x+=dx;else{const ex=Math.abs((Math.abs(x-from[0])+1)*wy-Math.abs(y-from[1])*wx),ey=Math.abs(Math.abs(x-from[0])*wy-(Math.abs(y-from[1])+1)*wx);if(ex<=ey)x+=dx;else y+=dy;}out.push([x,y]);}return out;}
return {directions,normalize,masks,indices,maskAt,core,line};
});
