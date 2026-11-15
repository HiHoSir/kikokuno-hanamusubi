const cell = 32;
const corners = [[0,0],[1,0],[1,1],[0,1]];

export async function loadCliffChips() {
  const names = ['cliff-1','cliff-2','cliff-forest-1','cliff-forest-2'];
  return Object.fromEntries(await Promise.all(names.map(async name => {
    const image = new Image();
    image.src = new URL('../../assets/field/terrain/atlas/'+name+'-32.png',import.meta.url);
    await image.decode();
    if (image.width !== 128 || image.height !== 128) throw Error('Invalid terrain atlas: '+name);
    return [name,image];
  })));
}

function drawChip(context,atlas,mask,x,y) {
  context.drawImage(atlas,(mask%4)*cell,Math.floor(mask/4)*cell,cell,cell,x,y,cell,cell);
}

export function drawCliffs(context,map,art) {
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
      const wet = samples.every(sample=>!isDry(sample.type));
      if (wet || high===low) continue;
      const elevated = samples.reduce((mask,sample,i) =>
        sample.height===high ? mask|(1<<i) : mask,0);
      const forest = samples.some(sample=>sample.height<high && sample.type==='forest');
      const atlas = art[(forest?'cliff-forest-':'cliff-')+(high-low)];
      drawChip(context,atlas,elevated,px,py);
    }
  }
}

export function makeWaterfallFrames(image,fall) {
  const width = fall.width*cell;
  const height = 4*cell;
  if (image.width !== width*4 || image.height !== height) throw Error('Invalid waterfall atlas');
  return Array.from({length:4},(_,phase)=>({
    image,sx:phase*width,width,height,x:fall.column*cell,y:(fall.edgeRow-2)*cell,
  }));
}
