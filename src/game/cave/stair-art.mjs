import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

function rect(ctx,color,x,y,width,height){
 ctx.fillStyle=color;
 ctx.fillRect(x,y,width,height);
}

export function drawAscent(ctx,col,row){
 ctx.save();
 ctx.translate((col+.5)*T,(row+.5)*T);
 // The low end meets the corridor on the east. Tread depth runs north/south.
 const stone=['#a0aaa9','#929e9f','#859298','#7c888e'];
 for(let step=0;step<stone.length;step++){
  const x=-24+step*12, top=-32+step*8;
  rect(ctx,'#232a32',x,top,14,20-top);
  rect(ctx,'#4a535a',x+2,top+4,10,14-top);
  rect(ctx,stone[step],x+2,top+2,10,24);
  rect(ctx,'#b3bab5',x+2,top+2,8,2);
 }
 ctx.restore();
}

export function drawStairwell(ctx,col,row){
 ctx.save();
 ctx.translate(col*T,row*T);
 // Flush stone rim around a shaft. Each tread drops east under the floor.
 rect(ctx,'#222a33',0,0,T,T);
 rect(ctx,'#6f797e',2,2,T-4,T-4);
 rect(ctx,'#444f59',4,4,T-8,T-8);
 rect(ctx,'#19212a',6,6,T-12,T-12);
 const stone=['#a0aaa9','#78858b','#55626c','#37444f'];
 for(let step=0;step<stone.length;step++){
  const x=7+step*8,top=10+step*6;
  rect(ctx,stone[step],x,top,6,39-top);
 }
 rect(ctx,'#929b9d',4,42,22,2);
 ctx.restore();
}
