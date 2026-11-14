import {tatamiMats} from './rooms.mjs';

// Match the four-world-pixel pitch and warm wood shades of the furniture atlas.
const wood = {
  ink:'#35221c', edge:'#573526', shade:'#6d462b', face:'#8c5932',
  light:'#aa7646', grain:'#966434',
};
const floors = {
  cedar:{boards:['#946a46','#9b704b','#9e7550','#98704e'], seam:'#866044', grain:['#8d6344','#a77a52']},
  walnut:{boards:['#75513b','#80583e','#835a40','#795640'], seam:'#6a4836', grain:['#704c37','#8c6246']},
};

function painter(context) {
  return (color,x,y,w,h)=>{
    context.fillStyle=color;
    context.fillRect(x,y,w,h);
  };
}

function texture(fill, [x,y,w,h], shades, spacing, seed) {
  for (let row=0;row*spacing+4<=h;row++) {
    const top=y+row*spacing;
    for (let col=0;col*spacing+4<=w;col++) {
      const n=(col*47+row*29+seed*17+(col+3)*(row+5)*13)%101;
      if (n>=44) continue;
      const left=Math.min(x+w-4,x+col*spacing+4*(n%3));
      const length=Math.min(n<20?8:4,x+w-left);
      if (length>0) fill(shades[n%shades.length],left,top,length,4);
      if (n<12 && top+8<=y+h && left+4<x+w) fill(shades[n%shades.length],left+4,top+4,4,4);
    }
  }
}

function boardGrain(fill, x,y,w,h,shades,seed) {
  const slots=Math.max(1,Math.floor((w-24)/4));
  for (let row=0;row<3 && row*4+4<=h;row++) {
    const left=x+4+4*((seed*7+row*9)%slots);
    const length=Math.min(x+w-left-4,12+4*((seed+row*3)%6));
    if (length<=0) continue;
    fill(shades[row%shades.length],left,y+row*4,length,4);
    if (row===0 && h>=8 && length>=16) fill(shades[0],left+4,y+4,length-12,4);
  }
}

const boardLengths=[96,112,128,148,168,192];
const boardWidths=[20,24,24,28,24,28,20];

export function floorboardJoints(left,right,rows,seed) {
  const courses=[];
  for (let row=0;row<rows;row++) {
    const ends=[];
    let x=left;
    while (x<right) {
      const index=ends.length;
      const choice=(seed+row*17+index*index*11+row*index*7)%boardLengths.length;
      const length=index===0 ? 56+4*((seed+row*29+row*row*7)%23) : boardLengths[choice];
      let end=x+length;
      if (courses[row-1]?.some(joint=>Math.abs(joint-end)<=12)) end+=28;
      if (right-end<44) end=right;
      ends.push(end);
      x=end;
    }
    courses.push(ends);
  }
  return courses;
}

function paintMat(fill, [x,y,w,h]) {
  const horizontal=w>=h;
  fill(horizontal?'#988655':'#938152',x,y,w,h);
  const along=horizontal?h:w;
  const across=horizontal?w:h;
  for (let row=8;row<across-4;row+=8) {
    const weave=row/8;
    const color=weave%2===0?'#a08c5b':'#8e7e52';
    for (let run=8+4*(weave%3);run<along-8;run+=24) {
      const length=Math.min(12,along-4-run);
      if (horizontal) fill(color,x+row,y+run,4,length);
      else fill(color,x+run,y+row,length,4);
    }
  }
  // Cloth bindings run along each mat's long sides, within the floor surface.
  const binding='#7b714a';
  if (horizontal) {
    fill('#796d464d',x+w-4,y,4,h);
    fill(binding,x,y,w,4);
    fill(binding,x,y+h-4,w,4);
  } else {
    fill('#796d464d',x,y+h-4,w,4);
    fill(binding,x,y,4,h);
    fill(binding,x+w-4,y,4,h);
  }
}

function beam(fill, x,y,w,h,seed) {
  fill(wood.ink,x,y,w,h);
  fill(wood.face,x+4,y+4,w-8,h-8);
  fill(wood.light,x+4,y+4,w-12,4);
  fill(wood.edge,x+4,y+h-8,w-8,4);
  texture(fill,[x+8,y+8,w-16,h-16],[wood.grain,wood.shade],16,seed);
}

function post(fill, x,y,w,h,seed) {
  fill(wood.ink,x,y,w,h);
  fill(wood.face,x+4,y+4,w-8,h-8);
  fill(wood.light,x+4,y+4,4,h-12);
  if (w>=16) fill(wood.shade,x+w-8,y+4,4,h-8);
  texture(fill,[x+8,y+8,w-16,h-16],[wood.grain,wood.shade],12,seed);
}

function shoji(fill, x) {
  fill(wood.ink,x-8,48,128,64);
  fill(wood.shade,x-4,52,120,56);
  fill('#c5aa78',x,56,112,48);
  fill('#e2c798',x+4,56,104,32);
  texture(fill,[x+4,60,104,36],['#d7bb8b','#e9d0a3'],20,x/4);
  fill('#bb9c70',x+4,96,104,4);
  for (const dx of [0,28,56,84,108]) fill(wood.face,x+dx,56,4,48);
  for (const y of [56,76,100]) fill(wood.shade,x,y,112,4);
  fill(wood.ink,x-12,104,136,12);
  fill(wood.light,x-8,104,128,4);
  fill(wood.edge,x-8,108,128,4);
}

export function paintRoom(context, room) {
  const {width,height} = room;
  const fill = painter(context);
  const timber = floors[room.floor];
  const doorway = width/2;
  const floorBottom=height-32;

  fill('#241a17',16,28,width-32,height-40);
  const courseWidths=[];
  for (let remaining=floorBottom-128;remaining>0;) {
    const row=courseWidths.length;
    const index=(width/4+row*11+Math.floor(row/3)*3)%boardWidths.length;
    const next=boardWidths[index];
    const h=remaining-next<16?remaining:next;
    courseWidths.push(h);
    remaining-=h;
  }
  const courses=floorboardJoints(28,width-28,courseWidths.length,(width+height)/4);
  let y=128;
  for (const [row,joints] of courses.entries()) {
    const h=courseWidths[row];
    fill(timber.seam,28,y,width-56,h);
    let left=28;
    for (const [column,right] of joints.entries()) {
      const variation=(row*11+column*17+Math.floor(row*column/7))%4;
      fill(timber.boards[variation],left,y,right-left-4,h-4);
      boardGrain(fill,left,y+4,right-left-4,h-8,timber.grain,row+column*11);
      left=right;
    }
    y+=h;
  }

  for (const [x,y,w,h] of room.earth ?? []) {
    fill('#887453',x,y,w,h);
    texture(fill,[x+4,y+4,w-8,h-8],['#7d6a4a','#96805b','#907b57'],12,13);
  }

  if (room.tatami) {
    for (const mat of tatamiMats(room.tatami)) paintMat(fill,mat);
  }

  // Continue the wall's contact shade across wood, earth and tatami alike.
  fill('#35221c45',40,140,width-80,4);
  fill('#35221c2a',40,144,width-80,4);
  fill('#35221c14',40,148,width-80,4);
  fill('#35221c24',40,152,4,height-188);
  fill('#35221c24',width-44,152,4,height-188);
  fill('#9b7f58',28,40,width-56,84);
  fill('#bda275',36,48,width-72,64);
  fill('#ccb183',40,56,width-84,32);
  fill('#ae9269',36,52,width-72,4);
  texture(fill,[40,60,width-80,44],['#b3986c','#c2a779','#ab9066'],16,5);
  fill(wood.edge,32,108,width-64,28);
  for (let x=36;x<width-40;x+=28) {
    const w=Math.min(24,width-40-x);
    fill(wood.face,x,112,w,16);
    fill(wood.grain,x,112,4,12);
    fill(wood.shade,x+w-4,116,4,12);
  }
  const windows=room.windows.map(x=>Math.floor(x/4)*4);
  let panelLeft=40;
  for (const panelRight of [...windows.map(x=>x-12),width-40]) {
    if (panelRight-panelLeft>=104) {
      const center=Math.floor((panelLeft+panelRight)/8)*4;
      post(fill,center-8,48,16,68,5);
    }
    panelLeft=panelRight+140;
  }
  beam(fill,16,28,width-32,24,4);
  beam(fill,24,124,width-48,16,7);
  for (const x of windows) shoji(fill,x);
  for (const x of [24,width-40]) post(fill,x,44,16,height-80,3);

  for (const [left,w] of [[16,doorway-52],[doorway+36,width-doorway-52]]) {
    beam(fill,left,height-36,w,24,5);
  }
  fill(wood.ink,doorway-36,height-36,72,36);
  fill(wood.face,doorway-36,height-32,72,24);
  fill(wood.light,doorway-36,height-36,72,8);
  fill(wood.edge,doorway-36,height-16,72,4);
  for (const x of [doorway-48,doorway+36]) post(fill,x,height-60,12,48,5);
}

export function paintPartition(context, x,y,width) {
  const fill=painter(context);
  const top=y-60;
  fill(wood.ink,x,top,width,68);
  fill(wood.face,x+4,top+4,width-8,56);
  fill('#a88961',x+8,top+12,width-16,32);
  fill('#c2a77b',x+8,top+12,width-16,12);
  texture(fill,[x+8,top+12,width-16,32],['#b2986b','#bda276'],16,7);
  for (let offset=32;offset<width-4;offset+=36) {
    fill(wood.shade,x+offset,top+12,4,32);
  }
  beam(fill,x,top,width,16,4);
  beam(fill,x,top+44,width,24,5);
}

export function paintContactShadow(context, [left,top,width,height]) {
  const fill=painter(context);
  const x=Math.ceil(left/4)*4;
  const right=Math.floor((left+width)/4)*4;
  const y=Math.floor((top+height)/4)*4;
  fill('#35221c26',x+4,y-8,right-x+4,12);
  fill('#35221c42',x+8,y-4,right-x-8,4);
}
