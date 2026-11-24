import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

const ROCK={
 outline:'#202831', hollow:'#19222c', wall:'#38434d',
 side:'#46515a', edge:'#5e6970', lip:'#737e83'
};

function path(ctx,points){
 ctx.beginPath();
 for(const [index,[x,y]] of points.entries()){
  if(index===0)ctx.moveTo(x,y);
  else ctx.lineTo(x,y);
 }
 ctx.closePath();
}

function polygon(ctx,points,color){
 path(ctx,points);
 ctx.fillStyle=color;
 ctx.fill();
}

// The width runs across the view so both the tread and its vertical face read.
function tread(ctx,x,y,width,slant,runX,runY,rise,top,riser){
 const front=[[x,y],[x+width,y+slant]];
 polygon(ctx,[...front,[x+width,y+slant+rise],[x,y+rise]],riser);
 polygon(ctx,[...front,[x+width+runX,y+slant+runY],[x+runX,y+runY]],top);
 polygon(ctx,[...front,[x+width,y+slant+1],[x,y+1]],ROCK.lip);
}

export function drawAscent(ctx,col,row){
 ctx.save();
 ctx.translate(col*T-8,row*T-16);
 // The foot stays at the corridor side. The staircase ends at a flat tread.
 const firstX=3,firstY=66,width=36,slant=17,count=5;
 const side=[];
 for(let i=0;i<count;i++){
  const x=firstX+i*10+width,y=firstY-i*10+slant;
  side.push([x,y+6],[x+10,y+1]);
 }
 polygon(ctx,[...side,[89,76],[45,95],[39,89]],ROCK.outline);
 polygon(ctx,[...side,[86,74],[45,92],[40,88]],ROCK.side);
 for(let i=count-1;i>=0;i--){
  const x=firstX+i*10,y=firstY-i*10;
  tread(ctx,x,y,width,slant,10,-5,7,i===count-1?'#889196':'#778289','#505d67');
 }
 ctx.restore();
}

const rim=[[-4,8],[46,31],[47,38],[3,90],[-5,91],[-47,70],[-48,63]];
const inner=[[-3,16],[39,35],[0,83],[-40,64]];

function drawDescent(ctx,layer){
 if(layer==='back'){
  polygon(ctx,rim,ROCK.outline);
  polygon(ctx,[[-4,11],[43,33],[43,38],[1,87],[-5,87],[-44,67],[-44,63]],ROCK.edge);
  polygon(ctx,inner,ROCK.hollow);
  ctx.save();
  path(ctx,inner);
  ctx.clip();
  polygon(ctx,[[-40,67],[-3,16],[7,21],[-22,65],[-25,76]],ROCK.wall);
  for(let i=0;i<5;i++){
   const x=2-i*7,y=26+i*10;
   const shade=['#707c85','#63717c','#556571','#465863','#394b56'][i];
   tread(ctx,x,y,37,18,-1,-6,5,shade,ROCK.wall);
  }
  ctx.restore();
  return;
 }
 polygon(ctx,[[-47,66],[-5,88],[3,88],[29,57],[44,40],[43,46],[3,92],[-5,94],[-46,73]],ROCK.outline);
 polygon(ctx,[[-44,66],[-4,87],[1,87],[32,51],[44,38],[43,41],[2,90],[-5,90],[-44,70]],ROCK.lip);
}

export function drawStairwell(ctx,col,row,layer){
 ctx.save();
 ctx.translate((col+1)*T,row*T);
 drawDescent(ctx,layer);
 ctx.restore();
}
