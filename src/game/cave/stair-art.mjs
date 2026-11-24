import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

const ASCENT_STEPS=[
 {y:8,halfWidth:34,face:'#47434a',top:'#898078',edge:'#b1a392'},
 {y:32,halfWidth:32,face:'#595051',top:'#a29587',edge:'#c7b79e'},
 {y:56,halfWidth:30,face:'#6b5c56',top:'#b9a98f',edge:'#dccaac'}
];

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
 ctx.translate((col+.5)*T,row*T);
 // The stepped shadow sits beside the solid flight and under the top landing.
 rect(ctx,'#30343b',-34,28,72,12);
 rect(ctx,'#30343b',-32,44,72,20);
 rect(ctx,'#30343b',-30,68,70,16);
 rect(ctx,'#39393d',-30,84,64,4);
 for(const step of ASCENT_STEPS)drawSlab(ctx,step,24);
 rect(ctx,'#6d6665',14,28,12,4);
 rect(ctx,'#82756a',-28,48,12,4);
 rect(ctx,'#978775',14,72,8,4);
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
