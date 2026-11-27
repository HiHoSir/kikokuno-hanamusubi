const enemy=(name,asset)=>({name,asset:`assets/enemies/${asset}.png`});
export const FIELD_ENCOUNTER_PLAN_ENEMIES={
 oni:enemy('野の小鬼','field-oni'),tanuki:enemy('化け狸','tanuki'),onibi:enemy('鬼火','onibi'),
 kodama:enemy('木霊','kodama'),spider:enemy('迷い蜘蛛','mayoi-gumo'),
 kodamaAutumn:{...enemy('紅葉木霊','kodama'),filter:'hue-rotate(-76deg) saturate(1.12)'},
 spiderIndigo:{...enemy('藍糸蜘蛛','mayoi-gumo'),filter:'sepia(.8) hue-rotate(217deg) saturate(1.65)'},
 snake:enemy('水蛇','mizuhebi'),waterChild:enemy('滝童','takiwarashi'),
 shoreOni:enemy('磯妖','isoy'),bubbleJelly:enemy('泡くらげ','awakurage'),
 caveGuardian:enemy('岩守の鬼','cave-guardian'),
 caveBat:{name:'鉱灯蝙蝠',concept:'紺の翼と胸の琥珀色の鉱石。低い弧を描く飛び姿。'},
 caveCentipede:{name:'岩骨ムカデ',concept:'石灰岩色の節と橙の大顎。低くうねる横長の姿。'},
 mountainBoar:{name:'峠荒らし',concept:'黄土色の剛毛と木枠を背負った猪。肩と牙が大きい。'},
 mountainCrow:{name:'風切り鴉',concept:'尖った黒翼と足元の水色の布。斜めに飛び込む姿。'},
 fox:enemy('妖狐','youko'),shadowFox:enemy('影九尾','kagekyubi')
};

// Routes describe the intended distribution on the review map. A tunnel is
// represented by its endpoints and never marks surface cells as encounters.
export const FIELD_ENCOUNTER_PLAN=[
 {id:'south',title:'鬼灯村から潮待村',color:'#dec796',sections:[
  {name:'南岸と社への道',roadIndices:[0,1],paths:[],
   formations:['oni','tanuki','onibi'],balance:['early-oni','early-tanuki','early-onibi'],detail:'鬼灯村外れと社への道の現行編成。'},
  {name:'海の入り江から潮待村',paths:[[[49,53],[49,51],[53,51]]],
   formations:['shoreOni','bubbleJelly'],balance:['cove-oni','cove-jelly'],detail:'磯妖は単体、泡くらげは単体か2体。入り江のイベント地点では通常戦を避ける。'},
  {name:'社西の洞窟',paths:[[[14,48],[20,48],[20,45]]],
   formations:['oni','tanuki','caveGuardian'],balance:['early-oni','early-tanuki','cave-guardian'],
   detail:'現行の基準として、地下の通常戦には序盤敵を使い、岩守の鬼は地下3階の固定戦。'}
 ]},
 {id:'bridge',title:'潮待村から梢音村',color:'#f2a948',sections:[
  {name:'潮待村から橋の南岸',paths:[[[53,51],[53,49],[51,47],[48,46],[48,44]]],
   formations:['oni','tanuki'],balance:['early-oni','early-tanuki'],detail:'南岸は野の小鬼と化け狸を中心にする。'},
  {name:'橋の北岸から梢音村',paths:[[[48,43],[48,35],[56,35]]],
   formations:['oni','tanuki','kodama'],balance:['early-oni','early-tanuki','bridge-kodama'],detail:'渡った先で木霊の単体を混ぜ、梢音村に近づくほど森の敵を増やす。橋上と入村マスは遭遇対象外。'}
 ]},
 {id:'forest',title:'梢音村から忘れの森',color:'#64db9d',sections:[
  {name:'梢音村から森の入口',paths:[[[56,35],[56,33],[60,33],[60,32]]],
   formations:['kodama','spider'],balance:['bridge-kodama','edge-spider'],detail:'入口付近は北岸と同じ木霊と、通常の迷い蜘蛛が単体で出る案。梢音村から最短7歩のため、直行時に戦闘を強制しない。'},
  {name:'森の奥から滝へ',paths:[[[60,32],[60,29],[63,29],[63,23],[65,23]]],
   formations:['kodamaAutumn','spiderIndigo'],balance:['forest-kodama','forest-spider'],detail:'紅葉木霊は赤橙の葉を持つ単体の強敵。青藍の藍糸蜘蛛は単体か2体で出る。'}
 ]},
 {id:'waterfall',title:'龍神の滝から洞窟東口',color:'#6ad7f0',sections:[
  {name:'滝と水辺',paths:[[[65,23],[65,20],[67,20]],[[67,20],[67,22],[57,22]]],
   formations:['snake','waterChild'],balance:['falls-snake','falls-child'],detail:'水辺の敵に切り替える。水鏡のイベント地点は通常遭遇から外す。'}
 ]},
 {id:'tunnel',title:'山越えの洞窟',color:'#f294ae',tunnel:true,sections:[
  {name:'洞窟の入口側と奥',paths:[[[57,22],[42,18]]],
   formations:['caveBat','caveCentipede'],balance:['tunnel-bat','tunnel-centipede'],detail:'鉱灯蝙蝠は湿った東口側で単体、奥では2体。岩骨ムカデは狭い岩棚の単体。'}
 ]},
 {id:'ridge',title:'洞窟西口から月嶺村',color:'#e7cc67',sections:[
  {name:'西口と山道',paths:[[[42,18],[42,15],[30,15],[29,17],[26,17]]],
   formations:['mountainBoar','mountainCrow'],balance:['pass-boar','pass-crow'],detail:'峠荒らしは岩場の単体。風切り鴉は露出した尾根に単体で出る。洞窟西口と月嶺村の周囲は休息区間。'}
 ]},
 {id:'fox',title:'月嶺村から九尾の祠',color:'#c1a0ff',sections:[
  {name:'北の参道',paths:[[[26,17],[26,13],[28,13],[28,11],[40,11],[40,5]]],
   formations:['fox','shadowFox'],balance:['ridge-fox','shrine-shadow-fox'],detail:'参道は妖狐の単体。影九尾は祠前の固定戦候補。'}
 ]}
];

export const FIELD_ENCOUNTER_PLAN_MARKERS={
 village:'鬼灯村',shrine:'天妖の社',cove:'海の入り江',shiomachi:'潮待村',
 kozuene:'梢音村',forest:'忘れの森',waterfall:'龍神の滝',fox:'九尾の祠'
};
export const FIELD_ENCOUNTER_PLANNED_MARKERS=[
 {name:'洞窟 西口',point:[42,18]},{name:'洞窟 東口',point:[57,22]},{name:'月嶺村',point:[26,17]}
];
