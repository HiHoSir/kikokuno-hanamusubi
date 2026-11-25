// All coordinates are world pixels and use the common 80×112 character scale.
export const WIDTH=1920, HEIGHT=1312, TILE=32;
const tree=(x,y)=>({sprite:'tree',x,y,foot:[x-27,y-56,54,56],canopy:true});
const shrub=(x,y)=>({sprite:'shrub',x,y});
const lamp=(x,y)=>({sprite:'lamp',x,y,foot:[x-11,y-15,22,15]});
const building=(id,sprite,room,name,x,y,width,depth)=>({
 id,sprite,x,y,foot:[x-width/2,y-depth,width,depth],site:{
  room,name,x,thresholdY:y+18,returnY:y+44
 }
});
const resident=(id,asset,name,x,y,lines)=>({id,asset,name,route:[[x,y]],face:0,lines});
const forestEdge=[
 ...[64,248,434,612,818,1015,1248,1455,1660,1854].map((x,i)=>tree(x,232+(i%3)*27)),
 ...[48,191].flatMap((x,i)=>[422,644,872,1090,1292].map(y=>tree(x,y-i*103))),
 ...[1752,1888].flatMap((x,i)=>[462,698,900,1124,1310].map(y=>tree(x,y-i*104))),
];
export const VILLAGES={
 forest:{
  name:'梢音村（仮称）',spawn:[940,1072],
  paths:[[864,608,160,704],[448,704,416,96],[1024,704,480,96],[768,896,416,160],[928,480,96,128]],
  objects:[
   ...forestEdge,tree(576,492),tree(1450,480),tree(447,990),tree(1566,1104),tree(588,1262),tree(1345,1310),
   building('woodshed','thatch','house-craft','木こりの家',438,681,299,138),
   building('forest-inn','inn','inn','梢音の宿',1390,680,448,155),
   {sprite:'sign',x:1328,y:658,depth:679},
   {sprite:'crate',x:475,y:879,foot:[440,852,70,26]},
   {sprite:'barrel',x:541,y:875,foot:[519,847,44,28]},
   lamp(855,839),lamp(1070,839),
   ...[[266,527],[734,586],[755,1095],[1190,1113],[1596,696],[632,1102],[335,1083],[1400,1230]].map(([x,y])=>shrub(x,y))
  ],
  gardens:[[406,926,4,3],[548,926,4,3],[482,1060,4,2]],
  residents:[
   resident('gatherer','osumi','薬草摘み',742,962,['籠の中は、朝露が残るうちに摘んだ薬草よ。','森の奥は似た葉が多いから、道のすぐ脇で摘むの。']),
   resident('woodcutter','farm-worker','木こり',585,768,['木は切ってすぐ使わない。軒下で風に当てて、冬の薪にするんだ。']),
   resident('elder','elder','村の古老',946,544,['夕方になると、森から風より先に鳥の声が来る。','今朝は、その声がひとつも聞こえなんだ。'])
  ]
 },
 mountain:{
  name:'月嶺村（仮称）',spawn:[1056,1090],
  paths:[[992,480,160,832],[512,752,480,96],[1152,752,352,96],[864,864,576,192],[1088,512,416,96],[800,576,192,96]],
  objects:[
   ...[74,258,490,710,914,1124,1339,1560,1810].map((x,i)=>tree(x,222+(i%2)*44)),
   ...[[99,512],[195,389],[58,841],[218,1138],[401,1290],[1723,402],[1822,640],[1768,964],[1860,1192],[1532,1267]].map(([x,y])=>tree(x,y)),
   building('mountain-inn','inn','inn','月嶺の宿',573,733,448,155),
   building('mountain-home','tile','house-family','湯守の家',1461,727,310,145),
   {sprite:'sign',x:516,y:712,depth:732},
   {sprite:'rock',x:367,y:806,foot:[323,779,88,24]},
   {sprite:'rock',x:1552,y:925,foot:[1505,894,83,27]},
   lamp(947,666),lamp(1170,674),lamp(932,1040),lamp(1196,1040),lamp(1512,506),lamp(807,512),
   ...[[295,505],[848,519],[1646,553],[1632,860],[777,1028],[1092,1191],[1556,1128]].map(([x,y])=>shrub(x,y))
  ],
  pool:[1200,886,224,128],
  residents:[
   resident('keeper','elder','湯守',1294,839,['石で囲ったのは、湯が道へあふれないようにするためさ。','夜は、湯気の向こうに月がぼんやり浮かぶよ。']),
   resident('traveler','villager','湯治客',1134,1005,['ここまで来ると、坂を登ってこわばった足がようやくほどけるよ。']),
   resident('mountain-worker','farm-worker','山仕事の人',776,794,['日が落ちたら石灯籠を目印にしな。山の道は、暗くなるのが早い。'])
  ]
 }
};

export function villageBlockers(map){
 const blocked=new Uint8Array(WIDTH*HEIGHT);
 const areas=map.objects.flatMap(object=>object.foot?[object.foot]:[]);
 if(map.pool)areas.push(map.pool);
 for(const [x,y,columns,rows] of map.gardens??[])areas.push([x,y,columns*TILE,rows*TILE]);
 for(const [left,top,width,height] of areas){
  for(let y=top;y<top+height;y++)blocked.fill(1,y*WIDTH+left,y*WIDTH+left+width);
 }
 return blocked;
}
