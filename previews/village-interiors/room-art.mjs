const colors = {
  cedar:{boards:['#896043','#94694a','#966b4a','#9b704e'],joint:'#6c4936',grain:['#80573e','#ac7d54','#926346']},
  walnut:{boards:['#694b39','#765341','#74513d','#7c5741'],joint:'#50372d',grain:['#644634','#8a6347','#6c4d3a']},
};

export function paintRoom(context, room) {
  const {width,height} = room;
  const fill = (color,x,y,w,h) => {
    context.fillStyle = color;
    context.fillRect(x,y,w,h);
  };
  const timber = colors[room.floor];
  const doorway = width/2;
  fill('#241d19',16,28,width-32,height-40);
  for (let y=128; y<height-32; y+=16) {
    const row=(y-128)/16;
    fill(timber.joint,28,y,width-56,16);
    for (let x=28-(row%3)*44, col=0; x<width-28; x+=132,col++) {
      const left=Math.max(28,x), right=Math.min(width-28,x+128);
      if (right<=left) continue;
      const variation=(row*11+col*17+Math.floor(row*col/7))%4;
      fill(timber.boards[variation],left,y+2,right-left,13);
      for (let i=0;i<3;i++) {
        const offset=(variation*23+col*13+i*41+row*7)%88;
        const length=Math.min(12+(row+i*5)%5*4,right-left-offset);
        if (length>0) fill(timber.grain[i],left+offset,y+4+i*4,length,2);
      }
    }
  }

  for (const [x,y,w,h] of room.earth ?? []) {
    fill('#594838',x,y,w,h);
    fill('#877154',x,y,w-4,h-4);
    for (let yy=y+4;yy<y+h-4;yy+=8) {
      for (let xx=x+4+(yy%5)*4;xx<x+w-12;xx+=20) {
        fill((xx+yy)%3===0?'#9b8260':'#786349',xx,yy,4,4);
      }
    }
    fill('#ac7c52',x+w-8,y,8,h);
    fill('#9c6d4a',x,y+h-8,w,8);
  }

  for (const [x,y,w,h] of room.tatami ?? []) {
    fill('#4d3f2c',x-4,y-4,w+8,h+8);
    fill('#938251',x,y,w,h);
    for (let yy=y;yy<y+h;yy+=4) {
      fill((yy-y)%12===0?'#a3935b':'#998857',x,yy,w,2);
      for (let xx=x+((yy-y)%8);xx<x+w;xx+=24) {
        fill('#ad9b62',xx,yy,Math.min(8,x+w-xx),2);
      }
    }
    // Cloth bindings follow the edges of the individual tatami mats.
    const across=Math.ceil(w/120), down=Math.ceil(h/172);
    for (let index=0;index<=across;index++) {
      const edge=x+Math.floor((w-4)*index/across/4)*4;
      fill('#576047',edge,y,4,h);
      if (index<across) fill('#6b704a',edge+4,y,2,h);
    }
    for (let index=0;index<=down;index++) {
      const edge=y+Math.floor((h-4)*index/down/4)*4;
      fill('#565a42',x,edge,w,4);
    }
  }

  fill('#35261e',16,28,width-32,108);
  fill('#7e5840',28,40,width-56,88);
  fill('#b49264',40,56,width-80,64);
  fill('#c5a578',40,56,width-80,40);
  fill('#ab885d',40,100,width-80,20);
  for (let x=40;x<width-40;x+=48) {
    fill('#b7986a',x+4,60,24,4);
    fill('#a8855a',x,112,20,4);
  }
  fill('#674831',28,120,width-56,12);
  fill('#573b2d',28,132,width-56,8);
  for (const x of room.windows) {
    fill('#4b3328',x-8,44,128,76);
    fill('#855d3d',x-4,48,120,64);
    fill('#d5bd87',x,52,112,56);
    fill('#e0c99b',x,52,112,36);
    fill('#bda676',x,100,112,8);
    for (const dx of [0,28,56,84,108]) fill('#876347',x+dx,52,4,56);
    for (const dy of [0,20,40,52]) fill('#876347',x,52+dy,112,4);
    fill('#573b2c',x-12,112,136,8);
    fill('#ad7e51',x-8,112,128,4);
  }
  for (const x of [24,width-36]) {
    fill('#53382a',x,36,12,height-64);
    fill('#906241',x+4,44,4,height-80);
  }
  fill('#33251e',16,28,width-32,12);
  fill('#a47751',20,28,width-40,4);
  fill('#4d3428',16,40,width-32,8);

  fill('#593d2c',doorway-36,height-36,72,36);
  fill('#a97b4f',doorway-36,height-36,72,12);
  fill('#c69a66',doorway-36,height-36,72,4);
  fill('#7d5940',doorway-36,height-20,72,8);
  for (const [left,w] of [[16,doorway-52],[doorway+36,width-doorway-52]]) {
    fill('#3b2a22',left,height-36,w,24);
    fill('#986b4a',left,height-36,w,8);
    fill('#5f4232',left,height-28,w,8);
  }
  for (const x of [doorway-48,doorway+36]) {
    fill('#493127',x,height-60,12,48);
    fill('#9b704c',x,height-60,12,8);
    fill('#805539',x+4,height-52,4,36);
  }
}

export function paintPartition(context, x, y, width) {
  const top = y-60;
  const fill = (color,left,upper,w,h) => {
    context.fillStyle = color;
    context.fillRect(left,upper,w,h);
  };
  fill('#493227',x,top,width,68);
  fill('#aa8258',x+4,top+8,width-8,44);
  fill('#ceb387',x+4,top+12,width-8,32);
  for (let offset=32;offset<width-4;offset+=36) fill('#89674a',x+offset,top+8,4,44);
  fill('#a57c50',x,top,width,4);
  fill('#805938',x,top+4,width,4);
  fill('#674736',x,top+48,width,12);
  fill('#30251e',x,top+64,width,4);
}
