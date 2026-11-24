import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

const UP_TREADS=['#59636a','#626d74','#69737a','#707b81','#7b8589','#899293'];
const DOWN_TREADS=['#303a44','#394650','#47535d','#52606b','#606d76','#6f7b83'];

function rect(ctx,color,x,y,width,height){
 ctx.fillStyle=color;
 ctx.fillRect(x,y,width,height);
}

function drawTreads(ctx,colors,edge){
 for(const [index,color] of colors.entries()){
  const y=15+index*11;
  rect(ctx,color,-30,y,60,8);
  rect(ctx,edge,-28,y,56,2);
  rect(ctx,'#303941',-30,y+8,60,3);
 }
}

// An open flight viewed from near overhead. The raised last tread is wide
// and bright; the low entry edge meets the corridor on the north side.
export function drawAscent(ctx,col,row){
 ctx.save();
 ctx.translate((col+.5)*T,row*T);
 rect(ctx,'#232b33',-34,12,68,81);
 rect(ctx,'#4a555f',-34,13,4,68);
 rect(ctx,'#3a464f',30,13,4,68);
 drawTreads(ctx,UP_TREADS,'#899497');
 rect(ctx,'#879195',-34,80,68,8);
 rect(ctx,'#4d5962',-34,88,68,5);
 ctx.restore();
}

// The lower stairs sit inside a floor cut. The floor lip is at the south
// side and the furthest treads recede into shade at the north end.
export function drawStairwell(ctx,col,row,layer){
 ctx.save();
 ctx.translate((col+1)*T,row*T);
 if(layer==='back'){
  rect(ctx,'#252e36',-39,8,78,82);
  rect(ctx,'#5c6871',-36,11,72,76);
  rect(ctx,'#212c35',-32,14,64,70);
  drawTreads(ctx,DOWN_TREADS,'#697782');
  rect(ctx,'#29343e',-30,15,60,3);
 }else{
  rect(ctx,'#78838a',-34,82,68,4);
  rect(ctx,'#3d4952',-36,86,72,4);
 }
 ctx.restore();
}
