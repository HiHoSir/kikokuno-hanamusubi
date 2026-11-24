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

// The approved side-profile stair climbs into a rock opening on the right.
export function drawAscent(ctx,col,row,art){
 ctx.save();
 ctx.translate(col*T-8,row*T-16);
 polygon(ctx,[[72,27],[75,13],[83,6],[96,4],[115,10],[128,17],
  [124,43],[108,52],[95,49],[84,42]],STONE.edge);
 polygon(ctx,[[76,23],[80,13],[88,8],[101,8],[117,13],[125,18],
  [121,28],[109,31],[96,24],[87,26]],STONE.side);
 polygon(ctx,[[98,30],[116,27],[128,19],[125,43],[108,51],[96,45]],STONE.shadow);
 ctx.drawImage(art,0,0);
 ctx.restore();
}

export function drawStairwell(ctx,col,row,layer){
 ctx.save();
 ctx.translate((col+1)*T,row*T);
 drawDescent(ctx,layer);
 ctx.restore();
}
