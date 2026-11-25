// All coordinates are world pixels and use the common 80×112 character scale.
export const WIDTH=1920, HEIGHT=1536, TILE=32;
const tree=(x,y)=>({sprite:'tree',x,y,foot:[x-27,y-56,54,56],canopy:true});
const shrub=(x,y)=>({sprite:'shrub',x,y});
const lamp=(x,y)=>({sprite:'lamp',x,y,foot:[x-11,y-15,22,15]});
const serviceSigns={inn:'sign',armory:'signArmory'};
const building=(id,sprite,room,name,x,y,width,depth,lines)=>({
 id,sprite,x,y,sign:serviceSigns[room],foot:[x-width/2,y-depth,width,depth],site:{
  id,room,name,x,thresholdY:y+18,returnY:y+44,lines
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
   building('woodshed','thatch','house-craft','木こりの家',438,681,299,138,['雨のあとは木が水を吸って重くなる。今朝は薪を先にまとめたよ。広場の西で、木箱のそばに積んである。']),
   building('forest-inn','inn','inn','梢音の宿',1390,680,448,155,['森へ出るなら、暗くなる前に戻っておいで。朝は炭焼きが火を起こす頃に起こすよ。']),
   building('herb-home','tile','house-farm','薬草摘みの家',940,475,310,145,['晴れたら葉を外で干せるけど、空模様が怪しいときはここで選り分けるの。広場から畑へ行くなら、灯籠の手前で西へ曲がってね。']),
   building('charcoal-hut','thatch','house-craft','炭焼き小屋',430,1276,299,138,['火を落としたあとは窯を閉めて、炭が冷めるまで待つ。急いで戸を開けたら、月嶺の宿に運ぶ分まで灰になっちまう。']),
   building('forest-home','tile','house-family','森番の家',1512,1248,310,145,['森から戻った人は、南の横道で炭焼きと行き違う。夕方に村へ着くなら、灯籠の並びを目印に広場まで来るといい。']),
   lamp(1124,1310),lamp(767,1310),
   {sprite:'crate',x:530,y:879,foot:[495,852,70,26]},
   {sprite:'barrel',x:596,y:875,foot:[574,847,44,28]},
   lamp(855,839),lamp(1070,839),
   ...[[266,527],[734,586],[755,1095],[1190,1113],[1596,696],[632,1102],[335,1083],[1400,1230]].map(([x,y])=>shrub(x,y))
  ],
  gardens:[[406,926,4,3],[548,926,4,3],[482,1060,4,2]],
  residents:[
   resident('gatherer','osumi','薬草摘み',48,[[742,962],[742,944],[722,944],[722,982],[742,982]],
     ['薬草は広場の西で育ててるの。冬に山道が閉じても、村で薬を煎じられるようにね。','北の青い屋根がうちよ。雨の日は、摘んだ葉をあそこで干しているの。']),
   resident('woodcutter','farm-worker','木こり',52,[[585,768],[698,768],[698,805],[585,805]],
     ['杉は薪にして、硬い木は炭焼きに回す。南の小屋の前を通ると、窯番に会えるぞ。']),
   resident('elder','elder','村の古老',32,[[1055,562],[1120,562],[1120,611],[1055,611]],
     ['森へ出た者が道に迷わんように、昔は広場の灯籠に毎晩火を入れたものじゃ。','今も火を入れる。炭焼きが戻ってくるまでの目印だからな。']),
   resident('charcoal-burner','villager','炭焼き',43,[[682,1366],[797,1366],[797,1402],[682,1402]],
     ['木こりから受け取った薪で炭を焼く。月嶺村の湯宿にも、寒い朝に火を起こせる炭を届けているんだ。'])
  ]
 },
 mountain:{
  name:'月嶺村（仮称）',spawn:[1056,1046],
  paths:[[992,480,160,1056],[512,752,480,96],[1152,832,512,48],[864,864,576,192],[1088,512,416,96],[800,576,192,96],
   [480,1344,1184,96],[480,1280,128,64],[1536,1312,128,32],[1472,544,320,64],[1696,416,96,128],[1696,608,96,272]],
  objects:[
   ...[74,258,490,710,914,1124,1339,1560,1810].map((x,i)=>tree(x,222+(i%2)*44)),
   ...[[99,512],[195,389],[58,841],[218,1138],[214,1454],[1856,335],[1888,664],[1768,964],[1860,1192],[1736,1512]].map(([x,y])=>tree(x,y)),
   building('mountain-inn','inn','inn','月嶺の宿',573,733,448,155,['湯で足を温めたら、宿でひと晩どうぞ。湯場の西、紫の瓦に「宿」の札が目印です。']),
   building('mountain-armory','tile','armory','月嶺の兵具屋',1461,813,310,145,['峠に出るなら、足もとから揃えな。濡れた石で滑ると、どんな太刀も役に立たないよ。']),
   building('bath-hut','thatch','house-craft','湯支度小屋',1056,468,299,138,['朝は北側から引いた湯を見て、宿へ分ける分を決めるの。旅の人がひと息つけるよう、広場の湯場にも少し残しておくんだ。']),
   building('ridge-home','thatch','house-farm','山仕事の家',544,1260,299,138,['峠の荷は南の道で受け取る。炭は宿へ、丈夫な革は兵具屋へ。冬前はどちらも手が足りなくなるよ。']),
   building('mountain-family-home','tile','house-family','坂道の民家',1608,1294,310,145,['峠から帰る人が、広場の湯場で足を休めていく。草履が泥だらけなら、石畳の外で泥を落としてから行くといいよ。']),
   building('mountain-home','tile','house-family','湯守の家',1735,398,310,145,['ここは湯守の家だ。湯場は広場の南側だよ。湯を汚さないよう、泥を落としてから寄っておくれ。']),
   lamp(840,1340),lamp(1260,1340),
   {sprite:'rock',x:367,y:806,foot:[323,779,88,24]},
   {sprite:'rock',x:1552,y:925,foot:[1505,894,83,27]},
   lamp(947,666),lamp(1170,674),lamp(932,1040),lamp(1196,1040),lamp(1512,506),lamp(807,512),
   ...[[295,505],[848,519],[1646,553],[1632,860],[777,1028],[1208,1191],[1556,1128]].map(([x,y])=>shrub(x,y))
  ],
  pool:[1200,886,224,128],
  residents:[
   resident('keeper','elder','湯守',36,[[1244,852],[1351,852],[1351,869],[1244,869]],
     ['源泉は北の小屋で受けて、この石囲いの湯場まで引いている。冷えた足はまずここで温めな。','湯を分けてほしいときは、北東の家まで来ておくれ。戸口は東の路地から回れば分かる。']),
   resident('traveler','villager','湯治客',47,[[1134,1005],[1165,1005],[1165,923],[1134,923]],
     ['峠で脚絆が破れてね。東の瓦屋根、「兵」の看板の店で見つけた山駆けの脚絆が、帰り道で役立ったよ。']),
   resident('mountain-worker','farm-worker','山仕事の人',52,[[776,790],[871,790],[871,810],[776,810]],
     ['梢音村の炭を宿へ運んでいる。荷を下ろすのは西の紫屋根だ。「宿」の札が出ていれば主人は中にいるよ。']),
   resident('bath-attendant','osumi','湯支度の人',42,[[1237,1375],[1384,1375],[1384,1410],[1237,1410]],
     ['朝は北の湯支度小屋で湯を引き、宿が開く頃に手ぬぐいを届けるの。湯守は広場の石囲いを見回ってるよ。'])
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
