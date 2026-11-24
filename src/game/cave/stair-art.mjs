import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

const STONE={
 edge:'#272e36', dark:'#161c24', side:'#404952', middle:'#57616a',
 top:'#697179', light:'#858a87', shadow:'#131920'
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
 const front=y+5;
 const back=y;
 polygon(ctx,[[-half,back],[half-1,back],[half,front],[-half-1,front]],shade);
 ctx.fillStyle=STONE.side;
 ctx.fillRect(-half,front,half*2,3);
 ctx.fillStyle=STONE.light;
 ctx.globalAlpha=.36;
 ctx.fillRect(-half+2,back,half*2-6,1);
 ctx.fillStyle=STONE.edge;
 ctx.fillRect(-half+4,front-1,4,1);
 ctx.globalAlpha=1;
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

// The flight climbs onto a shelf cut into the far rock. Its foot is open
// to the corridor; the shelf's exposed cheek makes its height visible.
function drawAscent(ctx,layer){
 if(layer==='front'){
  polygon(ctx,[[21,64],[37,72],[47,94],[39,110],[26,117],[29,95],
   [17,83]],STONE.side);
  return;
 }
 polygon(ctx,[[-28,12],[28,12],[49,54],[61,88],[53,118],[26,131],
  [-24,120],[-43,90],[-32,51]],STONE.shadow);
 // Rock top and its right-hand face extend behind the last step.
 polygon(ctx,[[-42,77],[-51,97],[-43,118],[-30,130],[30,132],[46,117],
  [51,95],[38,75],[26,66],[-28,65]],STONE.edge);
 polygon(ctx,[[-42,76],[-49,94],[-35,111],[-18,110],[-8,111],[21,108],
  [37,108],[48,94],[37,76],[26,66],[-28,65]],STONE.middle);
 polygon(ctx,[[-49,94],[-35,111],[-18,110],[-16,127],[-32,123],
  [-43,115]],STONE.side);
 polygon(ctx,[[37,108],[48,94],[50,101],[43,117],[30,132],[22,128],[23,111]],STONE.dark);
 // Right cheek is a vertical stone face, with a broken edge near the foot.
 polygon(ctx,[[23,13],[26,25],[27,42],[29,52],[28,62],[36,76],[27,91],
  [20,91],[20,58],[17,32]],STONE.side);
 polygon(ctx,[[26,25],[27,26],[29,42],[29,52],[31,53],[33,70],
  [27,82],[24,72],[22,54],[21,40]],STONE.edge);
 // Each exposed front face increases in height toward the cave shelf.
 for(let i=6;i>=0;i--){
  const x=i*1.4,y=14+i*8,half=27-i;
  const riser=3+Math.floor(i/2);
  polygon(ctx,[[x-half,y],[x+half,y],[x+half,y+riser],[x-half,y+riser]],STONE.side);
  polygon(ctx,[[x-half,y],[x+half,y],[x+half-2,y+2],[x-half+1,y+2]],TREADS[i]);
  ctx.fillStyle=STONE.light;
  ctx.fillRect(Math.round(x-half+2),y,half*2-5,1);
  ctx.fillStyle=STONE.edge;
  ctx.fillRect(Math.round(x+half-9),y+2,4,1);
 }
 polygon(ctx,[[-27,14],[-25,19],[-23,33],[-24,50],[-19,62],[-12,65],
  [-18,77],[-31,74],[-36,62],[-34,39],[-32,22]],STONE.middle);
 // Rough rock teeth surround a cut in the shelf. The square opening is
 // recessed behind the landing and casts a shadow down its inner face.
 polygon(ctx,[[-23,86],[-16,71],[-4,68],[8,67],[25,69],[37,78],
  [41,91],[33,97],[23,92],[-13,92]],STONE.side);
 polygon(ctx,[[-12,86],[-7,76],[3,73],[17,72],[26,77],[30,85],
  [28,93],[-12,93]],STONE.dark);
 polygon(ctx,[[-12,94],[0,89],[21,89],[28,93],[24,99],[-10,99]],STONE.top);
 polygon(ctx,[[-32,96],[-24,88],[-18,93],[-24,104],[-33,109]],STONE.top);
 polygon(ctx,[[31,99],[40,93],[44,98],[37,105],[28,107]],STONE.middle);
}

export function drawStairwell(ctx,col,row,layer,ascending=false){
 ctx.save();
 ctx.translate((col+(ascending?.5:1))*T,row*T);
 if(ascending)drawAscent(ctx,layer);
 else drawDescent(ctx,layer);
 ctx.restore();
}
