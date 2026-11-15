import {terrainY} from '../../src/field/height-projection.mjs';

// All anchors share the cliff and pool cells in the preview terrain.
export const fall = {x:18*32,source:10*32,lip:13*32,pool:14*32+8,height:3};

export function drawCliffWater(c,landscape,camera,time,zoom){
  const {width,height}=c.canvas;
  c.clearRect(0,0,width,height);
  const project=(x,y,z)=>landscape.project(x,terrainY(y,z),camera,zoom);
  const lip=project(fall.x,fall.lip,fall.height);
  const pool=project(fall.x,fall.pool,0);
  if(!lip||!pool||pool.y<136||lip.y>=height)return;
  const source=project(fall.x-10,fall.source,fall.height);
  const bend=project(fall.x+7,fall.source+42,fall.height);
  const rim=project(fall.x,fall.lip-13,fall.height);
  const polygon=(points,color)=>{
    c.fillStyle=color;
    c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));
    c.closePath();
    c.fill();
  };
  const line=(points,color,width)=>{
    if(points.some(p=>!p))return;
    c.strokeStyle=color;
    c.lineWidth=width;
    c.beginPath();
    points.forEach((p,i)=>i?c.lineTo(Math.round(p.x),Math.round(p.y)):c.moveTo(Math.round(p.x),Math.round(p.y)));
    c.stroke();
  };
  function ellipse(p,rx,ry,color){
    c.fillStyle=color;
    c.beginPath();
    c.ellipse(Math.round(p.x),Math.round(p.y),rx*p.scale,ry*p.scale,0,0,Math.PI*2);
    c.fill();
  }
  const sides=(p,half)=>[[p.x-half*p.scale,p.y],[p.x+half*p.scale,p.y]];
  function ribbon(samples,color){
    const valid=samples.filter(([p])=>p);
    if(valid.length<2)return;
    const edges=valid.map(([p,half])=>sides(p,half));
    polygon([...edges.map(e=>e[0]),...edges.reverse().map(e=>e[1])],color);
  }

  c.save();
  c.beginPath();
  c.rect(0,136,width,height-136);
  c.clip();
  c.imageSmoothingEnabled=false;

  // The shallow upper stream rolls over the cliff edge and bends into the pool.
  if(source){
    ellipse(source,16,5,'#244e49');
    ellipse(source,13,4,'#438d92');
    ellipse(source,8,2,'#72b8b6');
  }
  ribbon([[source,13],[bend,20],[rim,24],[lip,26]],'#243f37');
  ribbon([[source,10],[bend,17],[rim,21],[lip,24]],'#378999');
  ribbon([[source,5],[bend,10],[rim,14],[lip,16]],'#5cb7c6');
  for(let i=0;i<5;i++){
    const t=(time/4600+i/5)%1;
    const y=fall.source+(fall.lip-fall.source-8)*t;
    const x=fall.x+(i-2)*6+(t<.5?14*t-6:8-12*t);
    line([project(x,y,fall.height),project(x+3,y+7,fall.height)],'#b9dfdc',1.5);
  }

  function fallingPoint(t){
    const height=fall.height*(1-t);
    const y=fall.lip+(fall.pool-fall.lip)*t*t;
    return project(fall.x+3*t*t,y,height);
  }
  const drop=Array.from({length:19},(_,i)=>fallingPoint(i/18));

  ellipse(pool,38,10,'#1e5f76a8');
  ellipse(pool,30,8,'#4595a5b2');
  ellipse(pool,23,5,'#98cfcbaa');
  for(let i=0;i<4;i++){
    const spread=(time/880+i/4)%1;
    const opacity=(1-spread)*.52;
    c.globalAlpha=opacity;
    c.strokeStyle='#a8ddd8';
    c.lineWidth=1.5;
    c.beginPath();
    c.ellipse(pool.x,pool.y+4*pool.scale,(24+spread*22)*pool.scale,(5+spread*9)*pool.scale,0,0,Math.PI*2);
    c.stroke();
  }
  c.globalAlpha=1;

  ribbon(drop.map((p,i)=>[p,24+Math.sin(i*2.8)*2+(i>14?(i-14)*.7:0)]),'#327689');
  ribbon(drop.map((p,i)=>[p,19+Math.sin(i*1.5)*2]),'#72bfca');
  ribbon(drop.map((p,i)=>[p,9+Math.sin(i*.79)*3]),'#a9dddc');

  for(let i=0;i<12;i++){
    const spread=(i-5.5)*3.4;
    const points=drop.map((p,j)=>({
      x:p.x+(spread+Math.sin((j+2)*.54+i*.9)*1.6)*p.scale,
      y:p.y
    }));
    const head=Math.floor((time/530+i*.31)%1*points.length);
    line(points,i%4===0?'#f5fbe3ce':'#5398b2af',i%4===0?2.2:1.5);
    line(points.slice(Math.max(0,head-3),head+1),'#f3ffede3',2.5);
  }

  // Broken foam stays centered in the same plunge pool as the water channel.
  for(let i=0;i<18;i++){
    const t=(time/940+i*.113)%1;
    const angle=i*2.39996;
    const x=pool.x+Math.cos(angle)*(15+t*28)*pool.scale;
    const y=pool.y+(Math.sin(angle)*(5+t*10)+5)*pool.scale;
    c.globalAlpha=(1-t)*.88;
    c.fillStyle=i%3===0?'#f3f7df':'#b9e9e6';
    c.fillRect(Math.round(x),Math.round(y),Math.ceil((2+i%4)*pool.scale),Math.max(1,Math.round(pool.scale)));
  }
  // Match the field renderer's horizon fade on the separate water layer.
  c.globalAlpha=1;
  c.globalCompositeOperation='destination-in';
  const fade=c.createLinearGradient(0,136,0,208);
  fade.addColorStop(0,'#ffffff00');
  fade.addColorStop(.25,'#ffffff28');
  fade.addColorStop(.5,'#ffffff80');
  fade.addColorStop(.75,'#ffffffd7');
  fade.addColorStop(1,'#ffffff');
  c.fillStyle=fade;
  c.fillRect(0,136,width,height-136);
  c.restore();
}
