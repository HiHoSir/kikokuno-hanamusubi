// All coordinates are world pixels and use the common 80×112 character scale.
export const WIDTH=1920, HEIGHT=1536, TILE=32;
const tree=(x,y)=>({sprite:'tree',x,y,foot:[x-27,y-56,54,56],canopy:true});
const shrub=(x,y)=>({sprite:'shrub',x,y});
const lamp=(x,y)=>({sprite:'lamp',x,y,foot:[x-11,y-15,22,15]});
const building=(id,sprite,room,name,x,y,width,depth)=>({
 id,sprite,x,y,foot:[x-width/2,y-depth,width,depth],site:{
  id,room,name,x,thresholdY:y+18,returnY:y+44
 }
});
const resident=(id,asset,name,speed,route,lines)=>({id,asset,name,speed,route,face:0,lines});
const forestEdge=[
 ...[64,248,434,612,818,1015,1248,1455,1660,1854].map((x,i)=>tree(x,232+(i%3)*27)),
 ...[48,191].flatMap((x,i)=>[422,644,872,1090,1292].map(y=>tree(x,y-i*103))),
 ...[1752,1888].flatMap((x,i)=>[462,698,900,1124,1310].map(y=>tree(x,y-i*104))),
];
export const VILLAGES={
 forest:{
  name:'梢音村（仮称）',spawn:[940,1015],
  paths:[[864,608,160,928],[448,704,416,96],[1024,704,480,96],[768,896,416,160],[896,480,128,128],[1024,544,128,96],
   [384,1312,1152,96],[384,1296,96,16],[1440,1280,96,32]],
  objects:[
   ...forestEdge,tree(576,492),tree(1450,480),tree(307,984),tree(1744,1080),tree(640,1530),tree(1768,1514),tree(184,1496),
   building('woodshed','thatch','house-craft','木こりの家',438,681,299,138),
   building('forest-inn','inn','inn','梢音の宿',1390,680,448,155),
   building('herb-home','tile','house-farm','薬草摘みの家',940,475,310,145),
   building('charcoal-hut','thatch','house-craft','炭焼き小屋',430,1276,299,138),
   building('forest-home','tile','house-family','森番の家',1512,1248,310,145),
   lamp(1124,1310),lamp(767,1310),
   {sprite:'sign',x:1328,y:658,depth:679},
   {sprite:'crate',x:530,y:879,foot:[495,852,70,26]},
   {sprite:'barrel',x:596,y:875,foot:[574,847,44,28]},
   lamp(855,839),lamp(1070,839),
   ...[[266,527],[734,586],[755,1095],[1190,1113],[1596,696],[632,1102],[335,1083],[1400,1230]].map(([x,y])=>shrub(x,y))
  ],
  gardens:[[406,926,4,3],[548,926,4,3],[482,1060,4,2]],
  residents:[
   resident('gatherer','osumi','薬草摘み',48,[[742,962],[742,944],[722,944],[722,982],[742,982]],
     ['籠の中は、朝露が残るうちに摘んだ薬草よ。','森の奥は似た葉が多いから、道のすぐ脇で摘むの。']),
   resident('woodcutter','farm-worker','木こり',52,[[585,768],[698,768],[698,805],[585,805]],
     ['木は切ってすぐ使わない。軒下で風に当てて、冬の薪にするんだ。']),
   resident('elder','elder','村の古老',32,[[1055,562],[1120,562],[1120,611],[1055,611]],
     ['夕方になると、森から風より先に鳥の声が来る。','今朝は、その声がひとつも聞こえなんだ。']),
   resident('charcoal-burner','villager','炭焼き',43,[[682,1366],[797,1366],[797,1402],[682,1402]],
     ['炭を出すのは窯が冷めてからだ。外で待っている間に、次に焼く枝を集めておくんだよ。'])
  ]
 },
 mountain:{
  name:'月嶺村（仮称）',spawn:[1056,1046],
  paths:[[992,480,160,1056],[512,752,480,96],[1152,752,352,96],[864,864,576,192],[1088,512,416,96],[800,576,192,96],
   [480,1344,1184,96],[480,1280,128,64],[1536,1312,128,32],[1472,544,320,64],[1664,512,128,32]],
  objects:[
   ...[74,258,490,710,914,1124,1339,1560,1810].map((x,i)=>tree(x,222+(i%2)*44)),
   ...[[99,512],[195,389],[58,841],[218,1138],[214,1454],[1856,335],[1888,664],[1768,964],[1860,1192],[1736,1512]].map(([x,y])=>tree(x,y)),
   building('mountain-inn','inn','inn','月嶺の宿',573,733,448,155),
   building('mountain-home','tile','house-family','湯守の家',1461,727,310,145),
   building('bath-hut','thatch','house-craft','湯支度小屋',1056,468,299,138),
   building('ridge-home','thatch','house-farm','山仕事の家',544,1260,299,138),
   building('mountain-family-home','tile','house-family','坂道の民家',1608,1294,310,145),
   building('mountain-armory','tile','armory','月嶺の兵具屋',1710,505,310,145),
   {sprite:'signArmory',x:1625,y:493,depth:506},
   lamp(840,1340),lamp(1260,1340),
   {sprite:'sign',x:516,y:712,depth:732},
   {sprite:'rock',x:367,y:806,foot:[323,779,88,24]},
   {sprite:'rock',x:1552,y:925,foot:[1505,894,83,27]},
   lamp(947,666),lamp(1170,674),lamp(932,1040),lamp(1196,1040),lamp(1512,506),lamp(807,512),
   ...[[295,505],[848,519],[1646,553],[1632,860],[777,1028],[1208,1191],[1556,1128]].map(([x,y])=>shrub(x,y))
  ],
  pool:[1200,886,224,128],
  residents:[
   resident('keeper','elder','湯守',36,[[1294,829],[1382,829],[1382,797],[1294,797]],
     ['石で囲ったのは、湯が道へあふれないようにするためさ。','夜は、湯気の向こうに月がぼんやり浮かぶよ。']),
   resident('traveler','villager','湯治客',47,[[1134,1005],[1165,1005],[1165,923],[1134,923]],
     ['ここまで来ると、坂を登ってこわばった足がようやくほどけるよ。']),
   resident('mountain-worker','farm-worker','山仕事の人',52,[[776,790],[871,790],[871,810],[776,810]],
     ['日が落ちたら石灯籠を目印にしな。山の道は、暗くなるのが早い。']),
   resident('bath-attendant','osumi','湯支度の人',42,[[1237,1375],[1384,1375],[1384,1410],[1237,1410]],
     ['宿に泊まる人の分まで、手ぬぐいを干してあるよ。山風は冷たいけれど、乾くのは早いんだ。'])
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
