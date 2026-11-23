import {CAVE_TILE as T} from '../../../data/maps/cave/floors.mjs';

// Independent stair geometry from the November 11 cave prototype.
export function drawStairwell(c,x,y,layer){
 c.save();c.translate(x*T,y*T);
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
     poly([[L,top],[R,top],[R+1,top+5],[L-1,top+5]],shades[i]);
     c.strokeStyle=i<3?'#45505a':i<6?'#80858a':'#a0a09b';
     c.lineWidth=1;c.beginPath();c.moveTo(L+2,top);c.lineTo(R-2,top);c.stroke();
   }
   c.restore();
   poly([[17,17],[29,13],[35,22],[30,40],[26,55],[21,79],[12,69],[10,47]],'#26313c');
   poly([[79,17],[67,13],[61,22],[66,40],[70,55],[75,79],[84,69],[86,47]],'#202c37');
   poly([[17,19],[25,15],[29,25],[23,43],[20,58],[15,56]],'#47525c');
   poly([[79,19],[71,15],[67,25],[73,43],[76,58],[81,56]],'#394752');
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
// v0.14 independently rendered top-down ascending steps, not a pasted
// wall-facing frontal stair sprite. Top is higher, south is its accessible foot.
// Collision geometry is independent of all decorative drawing.
export function drawRaisedSteps(c,x,y,layer){
 c.save();c.translate(x*T,y*T);
 const poly=(points,fill)=>{
   c.fillStyle=fill;c.beginPath();
   points.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));
   c.closePath();c.fill();
 };
 if(layer==='back'){
   // Raised rough ledge continues onto solid northern cliff, not a tunnel hole.
   poly([[-10,8],[-7,-13],[5,-24],[25,-32],[51,-35],[77,-30],
     [99,-19],[108,-4],[105,18],[90,25],[79,20],[16,19],[4,24]],
     '#232d36');
   poly([[-7,2],[0,-16],[15,-25],[33,-29],[60,-28],[84,-23],
     [100,-11],[104,6],[93,15],[77,13],[16,13],[1,18]],
     '#414b55');
   poly([[7,-13],[23,-21],[40,-23],[62,-21],[81,-14],
     [88,-2],[75,9],[19,9],[7,0]],'#697178');
   poly([[25,-16],[42,-20],[60,-19],[72,-13],[69,-5],[30,-5]],
     '#828783');
   // The high landing is bright stone rather than a doorway/light panel.
   c.fillStyle='#858981';c.fillRect(32,-7,33,12);
   c.fillStyle='#a0a096';c.fillRect(35,-7,29,2);
   // Terraced stone sidewalls lead outwards toward the low floor.
   poly([[15,6],[24,12],[21,32],[20,52],[11,75],[3,89],
     [-3,79],[0,56],[4,30]],'#222d37');
   poly([[81,6],[72,12],[75,32],[76,52],[85,75],[93,89],
     [99,79],[96,56],[92,30]],'#202b35');
   poly([[11,12],[17,15],[14,34],[10,56],[3,70],
     [2,45]],'#525e67');
   poly([[85,12],[79,15],[82,34],[86,56],[93,70],
     [94,45]],'#48555f');
   // Steps face north and become narrower toward the higher landing.
   // This is a clear height change, not a seamless corridor.
   const tones=['#878b87','#828682','#7c817f','#727981',
     '#6b737b','#626c74','#5c6670','#58636e','#505b66'];
   for(let j=0;j<9;j++){
     const top=11+j*9.5;
     const half=24+j*1.48;
     const L=Math.round(48-half),R=Math.round(48+half);
     c.fillStyle='#252f39';
     c.fillRect(L-1,top+5,R-L+2,5);
     poly([[L+1,top],[R-1,top],[R,top+5],[L,top+5]],tones[j]);
     c.strokeStyle=j<3?'#b3b4a9':j<6?'#979d9c':'#848d90';
     c.lineWidth=1;c.beginPath();c.moveTo(L+3,top+1);c.lineTo(R-3,top+1);c.stroke();
     // Uneven pixel chips keep the steps consistent with the rock texture.
     c.fillStyle='#333f49';
     c.fillRect(L+6+(j*7)%10,top+3,2+j%2,2);
   }
   // South foot ends visibly at the floor, no extended wall arch.
   poly([[8,97],[20,91],[31,97],[63,97],[74,91],[89,97],
     [80,103],[18,103]],'#3e4b54');
 }else if(layer==='front'){
   // Rock side faces and a shallow top cap; center treads remain visible.
   poly([[-3,73],[3,58],[10,41],[13,24],[20,16],[25,20],
     [19,44],[15,61],[7,80]],'#34414c');
   poly([[99,73],[93,58],[86,41],[83,24],[76,16],[71,20],
     [77,44],[81,61],[89,80]],'#303e49');
   poly([[11,13],[20,8],[27,11],[27,16],[17,19],[10,26]],'#616c72');
   poly([[85,13],[76,8],[69,11],[69,16],[79,19],[86,26]],'#58656e');
   c.strokeStyle='#8b9490';c.lineWidth=2;c.beginPath();
   c.moveTo(1,64);c.lineTo(7,42);c.lineTo(11,23);
   c.moveTo(95,64);c.lineTo(89,42);c.lineTo(85,23);c.stroke();
   // Cap at the raised landing partially covers the highest step.
   poly([[22,3],[30,-4],[42,-6],[59,-6],[70,-3],[75,4],
     [71,10],[25,10]],'#6d777c');
   poly([[28,0],[40,-4],[60,-4],[68,0],[67,4],[30,4]],'#93978e');
 }
 c.restore();
}
