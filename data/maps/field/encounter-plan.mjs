const enemy=(name,asset)=>({name,asset:`assets/enemies/${asset}.png`});
export const FIELD_ENCOUNTER_PLAN_ENEMIES={
 oni:enemy('野の小鬼','field-oni'),tanuki:enemy('化け狸','tanuki'),onibi:enemy('鬼火','onibi'),
 kodama:enemy('木霊','kodama'),spider:enemy('迷い蜘蛛','mayoi-gumo'),
 snake:enemy('水蛇','mizuhebi'),waterChild:enemy('滝童','takiwarashi'),
 fox:enemy('妖狐','youko')
};

// Routes describe the intended distribution on the review map. A tunnel is
// represented by its endpoints and never marks surface cells as encounters.
export const FIELD_ENCOUNTER_PLAN=[
 {id:'south',title:'鬼灯村から潮待村',color:'#dec796',sections:[
  {name:'南岸と社への道',roadIndices:[0,1],paths:[[[49,53],[49,51],[53,51]]],
   formations:['oni','tanuki','onibi'],detail:'鬼灯村外れと社への道の現行編成を基準にする。'}
 ]},
 {id:'bridge',title:'潮待村から梢音村',color:'#f2a948',sections:[
  {name:'潮待村から橋の南岸',paths:[[[53,51],[53,49],[51,47],[48,46],[48,44]]],
   formations:['oni','tanuki'],detail:'南岸は野の小鬼と化け狸を中心にする。'},
  {name:'橋の北岸から梢音村',paths:[[[48,43],[48,35],[56,35]]],
   formations:['oni','tanuki','kodama'],balance:['bridge-kodama'],detail:'渡った先で木霊の単体を混ぜ、梢音村に近づくほど森の敵を増やす。橋上と入村マスは遭遇対象外。'}
 ]},
 {id:'forest',title:'梢音村から忘れの森',color:'#64db9d',sections:[
  {name:'梢音村から森の入口',paths:[[[56,35],[56,33],[60,33],[60,32]]],
   formations:['kodama','spider'],balance:['bridge-kodama','edge-spider'],detail:'入口付近は北岸と同じ木霊と、小型の迷い蜘蛛が単体で出る案。梢音村から最短7歩のため、直行時に戦闘を強制しない。'},
  {name:'森の奥から滝へ',paths:[[[60,32],[60,29],[63,29],[63,23],[65,23]]],
   formations:['kodama','spider'],balance:['forest-kodama','forest-spider'],detail:'森奥の木霊は単体の強敵。迷い蜘蛛は単体から2体編成へ移る。'}
 ]},
 {id:'waterfall',title:'龍神の滝から洞窟東口',color:'#6ad7f0',sections:[
  {name:'滝と水辺',paths:[[[65,23],[65,20],[67,20]],[[67,20],[67,22],[57,22]]],
   formations:['snake','waterChild'],balance:['falls-snake','falls-child'],detail:'水辺の敵に切り替える。水鏡のイベント地点は通常遭遇から外す。'}
 ]},
 {id:'tunnel',title:'山越えの洞窟',color:'#f294ae',tunnel:true,sections:[
  {name:'洞窟の入口側と奥',paths:[[[57,22],[42,18]]],
   formations:[],detail:'東口から入り西口へ。洞窟内の編成は入口側を弱くし、奥で複数にする。専用の敵候補は地形と仕掛けに合わせて選ぶ。'}
 ]},
 {id:'ridge',title:'洞窟西口から月嶺村',color:'#e7cc67',sections:[
  {name:'西口と山道',paths:[[[42,18],[42,15],[30,15],[29,17],[26,17]]],
   formations:[],detail:'西口近くを休息区間にし、道中に山地の敵を置く。月嶺村の近くでは複数編成を控える。'}
 ]},
 {id:'fox',title:'月嶺村から九尾の祠',color:'#c1a0ff',sections:[
  {name:'北の参道',paths:[[[26,17],[26,13],[28,13],[28,11],[40,11],[40,5]]],
   formations:['fox'],balance:['ridge-fox'],detail:'妖狐系を中心に、祠へ近づくにつれて編成を強める。'}
 ]}
];

export const FIELD_ENCOUNTER_PLAN_MARKERS={
 village:'鬼灯村',shrine:'天妖の社',cove:'海の入り江',shiomachi:'潮待村',
 kozuene:'梢音村',forest:'忘れの森',waterfall:'龍神の滝',fox:'九尾の祠'
};
export const FIELD_ENCOUNTER_PLANNED_MARKERS=[
 {name:'洞窟 西口',point:[42,18]},{name:'洞窟 東口',point:[57,22]},{name:'月嶺村',point:[26,17]}
];
