const cell = 32;

const corners = [[0,0],[1,0],[1,1],[0,1]];

export async function loadCliffChips() {
  const names = ['cliff-1','cliff-2','cliff-forest-1','cliff-forest-2'];
  const sources = names.map(name=>[name,'atlas/'+name+'-32.png',128]);
  sources.push(['wall-face','grass-cliff.png',cell]);
  return Object.fromEntries(await Promise.all(sources.map(async ([name,path,size]) => {
    const image = new Image();
    image.src = new URL('../../assets/field/terrain/'+path,import.meta.url);
    await image.decode();
    if (image.width !== size || image.height !== size) throw Error('Invalid terrain chip: '+name);
    return [name,image];
  })));
}

function drawChip(context,atlas,mask,x,y) {
  context.drawImage(atlas,(mask%4)*cell,Math.floor(mask/4)*cell,cell,cell,x,y,cell,cell);
}

// Keep the crest at its map edge. Place a second rock-only face underneath
// the first by matching each column to the lower edge of the original chip.
function lowerFace(atlas,mask,rock,wallDepth,phase) {
  const canvas = document.createElement('canvas');
  canvas.width = cell;
  canvas.height = cell+wallDepth;
  const context = canvas.getContext('2d');
  drawChip(context,atlas,mask,0,0);
  const {data} = context.getImageData(0,0,cell,cell);
  context.clearRect(0,0,canvas.width,canvas.height);
  for(let x=0;x<cell;x++) {
    let y=cell-1;
    while(y>=0 && !data[(y*cell+x)*4+3])y--;
    if(y<0)continue;
    for(let row=0;row<wallDepth;row+=cell) {
      const length=Math.min(cell,wallDepth-row);
      const sourceX=(x+phase)%cell;
      context.drawImage(rock,sourceX,0,1,length,x,y+1+row,1,length);
    }
  }
  context.globalCompositeOperation='source-atop';
  const shade=context.createLinearGradient(0,8,0,canvas.height);
  shade.addColorStop(0,'rgba(27,26,29,.16)');
  shade.addColorStop(.7,'rgba(26,34,40,.32)');
  shade.addColorStop(1,'rgba(17,29,26,.57)');
  context.fillStyle=shade;
  context.fillRect(0,0,canvas.width,canvas.height);
  for(let x=0;x<cell;x++){
    const u=x+phase;
    const shadow=.10+.09*Math.sin(u*.71)+.06*Math.cos(u*.31);
    context.fillStyle='rgba(24,36,45,'+shadow+')';
    context.fillRect(x,0,1,canvas.height);
  }
  return canvas;
}

export function drawCliffs(context,map,art) {
  const faces=new Map();
  const wallDepth=map.wallDepth??16;
  const caps=[];
  const isDry = type => type !== 'river' && type !== 'sea';
  for (let y=0; y<map.length-1; y++) {
    for (let x=0; x<map[0].length-1; x++) {
      const samples = corners.map(([dx,dy]) => ({
        height:map.heights[y+dy][x+dx],
        type:map[y+dy][x+dx],
      }));
      const high = Math.max(...samples.map(sample=>sample.height));
      const low = Math.min(...samples.map(sample=>sample.height));
      const px = x*cell+cell/2, py = y*cell+cell/2;
      if (samples.every(sample=>!isDry(sample.type)) || high===low) continue;
      const elevated = samples.reduce((mask,sample,i) =>
        sample.height===high ? mask|(1<<i) : mask,0);
      const forest = samples.some(sample=>sample.height<high && sample.type==='forest');
      const name = (forest?'cliff-forest-':'cliff-')+(high-low);
      const atlas = art[name];
      caps.push({atlas,elevated,px,py});
      const southDrop = [[0,3],[1,2]].some(([north,south]) =>
        samples[north].height-samples[south].height===2 && isDry(samples[south].type));
      if(southDrop) {
        const phase=(x%4)*8;
        const key=[name,elevated,phase].join();
        if(!faces.has(key))faces.set(key,lowerFace(atlas,elevated,art['wall-face'],wallDepth,phase));
        context.drawImage(faces.get(key),px,py);
      }
    }
  }
  for(const {atlas,elevated,px,py} of caps)drawChip(context,atlas,elevated,px,py);
}

export function makeWaterfallFrames(image,fall) {
  const frameWidth=4*cell;
  const width=2*cell;
  const inset=cell/2;
  const drop=(fall.basinRow-fall.edgeRow)*cell;
  const height=drop+2*cell;
  if (image.width!==frameWidth*4||image.height!==4*cell||fall.width!==1) throw Error('Invalid waterfall atlas');
  return Array.from({length:4},(_,phase)=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext('2d');
    for(const [column,sourceOffset] of [[0,0],[1,frameWidth-cell/2]]){
      const sx=phase*frameWidth+sourceOffset;
      const w=cell/2,x=inset+column*w;
      context.drawImage(image,sx,0,w,cell,x,0,w,cell);
      for(let row=0;row<drop;row+=cell){
        const sy=(row/cell)%2===0?cell:2*cell;
        context.drawImage(image,sx,sy,w,cell,x,cell+row,w,cell);
      }
    }
    // The splash widens into the pool using the two outer foam tiles.
    for(const [column,sourceColumn] of [[0,0],[1,3]]){
      const sx=phase*frameWidth+sourceColumn*cell;
      context.drawImage(image,sx,3*cell,cell,cell,column*cell,cell+drop,cell,cell);
    }
    return {image:canvas,sx:0,width,height,x:fall.column*cell-inset,y:(fall.edgeRow-1)*cell};
  });
}
