import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

const DESCENT_STEPS=[
 {y:12,halfWidth:20,face:'#1a222a',top:'#333e47',edge:'#505e68'},
 {y:36,halfWidth:26,face:'#222b33',top:'#4c585d',edge:'#6e7a80'},
 {y:60,halfWidth:32,face:'#343c44',top:'#757a70',edge:'#acaa98'}
];

function rect(ctx,color,x,y,width,height){
 ctx.fillStyle=color;
 ctx.fillRect(x,y,width,height);
}

// Each slab has a vertical face, a worn lip and a broad horizontal tread.
function drawSlab(ctx,{y,halfWidth,face,top,edge},depth){
 const x=-halfWidth,width=halfWidth*2;
 rect(ctx,face,x,y,width,8);
 rect(ctx,top,x,y+8,width,depth-8);
 rect(ctx,edge,x+4,y+8,width-8,4);
 rect(ctx,edge,x,y+12,4,4);
 rect(ctx,face,halfWidth-4,y+12,4,depth-12);
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

export function drawStairwell(ctx,col,row,layer){
 ctx.save();
 ctx.translate((col+1)*T,row*T);
 if(layer==='back'){
  // Raw side walls taper into dark rock. The approach at the south is open.
  rect(ctx,'#171d24',-28,8,56,16);
  rect(ctx,'#222931',-36,16,72,52);
  rect(ctx,'#222931',-40,44,80,36);
  rect(ctx,'#3d4347',-36,20,8,32);
  rect(ctx,'#565955',-40,44,8,32);
  rect(ctx,'#333d45',28,32,8,32);
  rect(ctx,'#444d50',32,56,8,24);
  for(const step of DESCENT_STEPS)drawSlab(ctx,step,24);
 }else{
  rect(ctx,'#777a70',-32,84,64,4);
  rect(ctx,'#555a58',-28,88,56,4);
 }
 ctx.restore();
}
