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

function step(ctx,half,y,shade,ascending){
 const front=ascending?y:y+5;
 const back=ascending?y-4:y;
 polygon(ctx,[[-half,back],[half-1,back],[half,front],[-half-1,front]],shade);
 ctx.fillStyle=STONE.side;
 ctx.fillRect(-half,front,half*2,3);
 ctx.fillStyle=STONE.light;
 ctx.globalAlpha=.36;
 ctx.fillRect(-half+2,ascending?front-1:back,half*2-6,1);
 ctx.fillStyle=STONE.edge;
 ctx.fillRect(-half+4,ascending?back+1:front-1,4,1);
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
  for(const [i,shade] of TREADS.entries())step(ctx,19+i*2,25+i*8,shade,false);
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

// A rising flight: exposed riser faces are cast toward the entrance. Rock
// shoulders merge into the far wall, which frames the elevated doorway.
function drawAscent(ctx,layer){
 if(layer==='back'){
  polygon(ctx,[[-33,10],[-18,9],[24,12],[42,30],[49,70],[44,96],
   [19,103],[-31,99],[-45,81],[-42,43]],STONE.shadow);
  polygon(ctx,[[-35,17],[-34,43],[-42,71],[-39,91],[-25,98],[24,98],[39,88],
   [42,73],[33,46],[33,19],[25,11],[-25,11]],STONE.edge);
  polygon(ctx,[[-29,14],[26,14],[26,60],[-28,60]],STONE.side);
  // Draw the rear steps first so the nearer riser covers the next tread.
  for(let i=TREADS.length-1;i>=0;i--)step(ctx,27-i,19+i*8,TREADS[6-i],true);
  polygon(ctx,[[-32,14],[-27,16],[-24,42],[-23,61],[-30,73],[-38,74],[-37,50]],STONE.middle);
  polygon(ctx,[[30,13],[25,16],[22,43],[22,62],[28,75],[35,79],[39,67],[35,46]],STONE.side);
  polygon(ctx,[[-40,72],[-35,61],[-27,58],[-21,62],[19,62],[26,57],[34,62],
   [42,77],[39,90],[31,96],[-32,96],[-40,88]],STONE.edge);
  polygon(ctx,[[-38,74],[-32,64],[-26,62],[-21,67],[19,67],[27,62],[33,65],
   [38,74],[37,83],[28,86],[-29,86],[-38,81]],STONE.top);
  polygon(ctx,[[-22,72],[-18,66],[-10,62],[10,62],[18,66],[22,72],
   [22,92],[-22,92]],STONE.light);
  polygon(ctx,[[-17,74],[-14,69],[-8,67],[8,67],[14,69],[17,74],
   [17,92],[-17,92]],STONE.dark);
  polygon(ctx,[[-17,90],[17,90],[14,94],[-15,94]],STONE.middle);
  return;
 }
 polygon(ctx,[[-37,76],[-30,74],[-22,79],[-22,89],[-28,95],[-39,91]],STONE.side);
 polygon(ctx,[[34,73],[38,78],[40,89],[32,96],[22,91],[22,80],[29,76]],STONE.side);
}

export function drawStairwell(ctx,col,row,layer,ascending=false){
 ctx.save();
 ctx.translate((col+(ascending?.5:1))*T,row*T);
 if(ascending)drawAscent(ctx,layer);
 else drawDescent(ctx,layer);
 ctx.restore();
}
