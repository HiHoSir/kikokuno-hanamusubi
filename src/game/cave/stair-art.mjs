import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

const STONE={
 edge:'#272e36', dark:'#161c24', side:'#404952', middle:'#57616a',
 top:'#697179', light:'#858a87'
};
const TREADS=['#343e47','#3e4851','#4b555e','#565f67','#626b73','#6d757c','#787e81'];

function polygon(ctx,points,color){
 ctx.fillStyle=color;
 ctx.beginPath();
 for(const [i,[x,y]] of points.entries()){
  if(i===0)ctx.moveTo(x,y);
  else ctx.lineTo(x,y);
 }
 ctx.closePath();
 ctx.fill();
}

function step(ctx,half,y,shade){
 ctx.fillStyle=STONE.side;
 ctx.fillRect(-half,y+5,half*2,3);
 ctx.fillStyle=shade;
 ctx.fillRect(-half,y,half*2,5);
 ctx.fillStyle=STONE.light;
 ctx.globalAlpha=.36;
 ctx.fillRect(-half+2,y,half*2-5,1);
 ctx.globalAlpha=1;
 ctx.fillStyle=STONE.edge;
 ctx.fillRect(-half+4,y+4,4,1);
}

// A floor cut: the level rim stays on the floor, and every tread is inside
// the shaft. The closest tread connects directly to the southern landing.
function drawDescent(ctx,layer){
 if(layer==='back'){
  polygon(ctx,[[-37,6],[-26,1],[22,2],[37,8],[44,28],[45,74],[35,87],
   [20,94],[-25,92],[-40,84],[-45,68],[-44,28]],STONE.edge);
  polygon(ctx,[[-34,10],[-25,6],[22,7],[35,11],[39,29],[40,73],[29,86],
   [-27,86],[-35,80],[-41,64],[-39,32]],STONE.middle);
  polygon(ctx,[[-25,12],[23,12],[31,22],[35,72],[26,84],[-26,84],
   [-34,73],[-32,25]],STONE.dark);
  for(const [i,shade] of TREADS.entries())step(ctx,19+i*2,25+i*8,shade);
  polygon(ctx,[[-37,14],[-27,12],[-21,24],[-23,55],[-29,79],[-37,73],[-40,49]],STONE.side);
  polygon(ctx,[[35,13],[27,13],[22,25],[25,59],[30,79],[36,73],[39,52]],STONE.edge);
  return;
 }
 polygon(ctx,[[-44,47],[-39,64],[-31,78],[-27,86],[-37,89],[-43,79],[-47,62]],STONE.edge);
 polygon(ctx,[[42,46],[45,62],[41,77],[35,89],[27,86],[32,79],[38,64]],STONE.edge);
 polygon(ctx,[[-31,81],[-23,85],[23,85],[31,81],[35,86],[24,91],[-24,91],[-35,86]],STONE.top);
 ctx.fillStyle=STONE.light;
 ctx.fillRect(-22,86,43,1);
}

// Readable stepped silhouette with a flat upper landing and the same
// foot position as the previous side-profile staircase.
export function drawAscent(ctx,col,row){
 ctx.save();
 ctx.translate(col*T-8,row*T-16);
 const steps=7,width=11,rise=8;
 // Draw the support, risers and tread highlights without resampling.
 for(let i=steps-1;i>=0;i--){
  const x=5+i*width,y=80-i*rise;
  const span=i===steps-1?17:width;
  ctx.fillStyle=STONE.edge;
  ctx.fillRect(x,y,span,92-y);
  ctx.fillStyle=i%2===0?STONE.middle:STONE.side;
  ctx.fillRect(x+1,y+6,span-2,rise-2);
  ctx.fillStyle=STONE.top;
  ctx.fillRect(x,y,span,5);
  ctx.fillStyle=STONE.light;
  ctx.fillRect(x+1,y,span-2,1);
  ctx.fillStyle=STONE.side;
  ctx.fillRect(x+span-3,y+2,2,2);
 }
 ctx.fillStyle=STONE.side;
 ctx.fillRect(10,87,28,1);
 ctx.fillRect(43,87,34,1);
 ctx.restore();
}

export function drawStairwell(ctx,col,row,layer){
 ctx.save();
 ctx.translate((col+1)*T,row*T);
 drawDescent(ctx,layer);
 ctx.restore();
}
