import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs?v=guardian-1';

// Independent stair geometry from the November 11 cave prototype.
export function drawStairwell(c,x,y,layer,ascending=false){
 c.save();c.translate(x*T-(ascending?24:0),y*T);
 const poly=(pts,color)=>{
   c.fillStyle=color;c.beginPath();
   pts.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));
   c.closePath();c.fill();
 };
 if(layer==='back'){
   // Irregular rock perimeter. No rectangular tile outline.
   poly([[9,4],[25,-3],[43,-6],[65,-4],[83,4],[97,18],[102,33],
     [104,53],[97,74],[87,90],[69,100],[46,105],[27,98],[10,89],
     [-2,71],[-7,53],[-3,30]],'#303b45');
   poly([[13,9],[29,3],[47,1],[67,4],[85,13],[94,30],[96,48],
     [90,70],[79,85],[63,92],[44,94],[26,88],[12,76],[5,55],[6,29]],'#687078');
   const hole=[[18,15],[34,9],[53,9],[70,12],[84,25],[89,40],
     [89,59],[80,77],[67,85],[45,87],[29,81],[15,66],[11,45]];
   poly(hole,'#131c25');
   // The steps can NEVER protrude onto the flat surrounding floor.
   c.save();c.beginPath();
   hole.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));
   c.closePath();c.clip();
   poly([[25,20],[39,14],[59,14],[73,21],[80,37],[81,57],
     [70,72],[61,79],[37,79],[24,67],[19,47]],'#090f18');
   const shades=['#29323b','#313a42','#39424b','#414b53',
     '#4b535b','#565d65','#646b72','#72767b'];
   for(let i=0;i<8;i++){
     const top=23+i*8,half=13+i*3.6,L=Math.round(48-half),R=Math.round(48+half);
     poly([[L-1,top+4],[R+1,top+4],[R+2,top+8],[L-2,top+8]],'#111922');
     poly([[L,top],[R,top],[R+1,top+5],[L-1,top+5]],shades[ascending?7-i:i]);
     c.strokeStyle=i<3?'#45505a':i<6?'#80858a':'#a0a09b';
     c.lineWidth=1;c.beginPath();c.moveTo(L+2,top);c.lineTo(R-2,top);c.stroke();
   }
   c.restore();
   poly([[17,17],[29,13],[35,22],[30,40],[26,55],[21,79],[12,69],[10,47]],'#26313c');
   poly([[79,17],[67,13],[61,22],[66,40],[70,55],[75,79],[84,69],[86,47]],'#202c37');
   poly([[17,19],[25,15],[29,25],[23,43],[20,58],[15,56]],'#47525c');
   poly([[79,19],[71,15],[67,25],[73,43],[76,58],[81,56]],'#394752');
   if(ascending){
     poly([[18,34],[18,19],[28,8],[40,3],[56,3],[68,8],[78,19],[78,34],[69,34],[69,22],[62,14],[54,11],[42,11],[34,14],[27,22],[27,34]],'#687078');
     poly([[27,29],[28,20],[38,12],[58,12],[68,20],[69,29]],'#3a4650');
   }
 }else if(layer==='front'){
   poly([[4,69],[13,80],[27,91],[44,96],[63,95],[79,87],[92,71],
     [96,78],[86,91],[70,101],[48,106],[29,102],[13,93],[0,77]],'#27343d');
   poly([[4,69],[13,80],[29,89],[47,93],[64,91],[81,82],[92,71],
     [95,76],[84,85],[66,96],[47,99],[27,95],[11,88]],'#657078');
   poly([[20,94],[38,99],[61,99],[79,91],[71,98],[46,103],[31,101]],'#3e4852');
   c.strokeStyle='#7c8081';c.lineWidth=2;c.beginPath();
   c.moveTo(9,11);c.lineTo(26,4);c.lineTo(44,1);
   c.moveTo(68,2);c.lineTo(84,10);c.lineTo(93,22);
   c.moveTo(5,54);c.lineTo(7,69);c.lineTo(18,81);c.stroke();
   for(let j=0;j<13;j++){
     c.fillStyle=j%3?'#37434d':'#858889';
     c.fillRect(14+(j*17)%72,88+(j*7)%8,2+(j%3),2);
   }
 }
 c.restore();
}
