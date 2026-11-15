const cell = 32;
const wallDepth = 16;
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
function lowerFace(atlas,mask,rock) {
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
    context.drawImage(rock,x,0,1,wallDepth,x,y+1,1,wallDepth);
  }
  context.globalCompositeOperation='source-atop';
  context.fillStyle='rgba(30,19,12,.20)';
  context.fillRect(0,0,canvas.width,canvas.height);
  return canvas;
}

export function drawCliffs(context,map,art) {
  const faces=new Map();
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
        const key=name+'-'+elevated;
        if(!faces.has(key))faces.set(key,lowerFace(atlas,elevated,art['wall-face']));
        context.drawImage(faces.get(key),px,py);
      }
    }
  }
  for(const {atlas,elevated,px,py} of caps)drawChip(context,atlas,elevated,px,py);
}

export function makeWaterfallFrames(image,fall) {
  const width = fall.width*cell;
  const height = 4*cell;
  if (image.width !== width*4 || image.height !== height) throw Error('Invalid waterfall atlas');
  return Array.from({length:4},(_,phase)=>({
    image,sx:phase*width,width,height,x:fall.column*cell,y:(fall.edgeRow-2)*cell,
  }));
}
