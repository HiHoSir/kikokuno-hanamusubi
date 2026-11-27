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

 tideCrab:{...enemy('潮鋏','tidal-crab-128'),pixelArt:true,distribution:{habitat:'入り江の磯・潮だまり',count:1,point:[48,52]},concept:'珊瑚色の大鋏と青緑の甲羅。干潮の磯に踏ん張る。',technique:'潮受け。鋏を閉じた次の通常攻撃を軽減する。'},
 bridgeLantern:{...enemy('橋灯り','stone-lantern-128'),pixelArt:true,distribution:{habitat:'橋の北側の石畳',count:1,point:[48,42]},concept:'苔むした石灯籠に黄色の火。橋を渡った先の石畳に浮かぶ。',technique:'灯継ぎ。灯が明滅した次の手番で、残っていれば小回復。'},
 leafStalker:{...enemy('落葉隠れ','leaf-tanuki-128'),pixelArt:true,distribution:{habitat:'忘れの森奥の落ち葉が積もる林床',count:1,point:[58,30]},concept:'赤褐色の落葉の束から、目と太い尾だけがのぞく。',technique:'落ち葉払い。初手は隠れ、飛び出すときに強打する。'},
 sprayCormorant:{...enemy('飛沫鵜','diving-cormorant-128'),pixelArt:true,distribution:{habitat:'龍神の滝の滝壺沿い',count:1,point:[67,21]},concept:'鉛色の長い首と嘴。翼をすぼめて滝壺へ斜めに潜る。',technique:'水くぐり。潜った手番は攻撃せず、浮上時に鋭い一撃。'},
 crystalHermit:{...enemy('晶殻ヤドカリ','crystal-hermit-crab-128'),pixelArt:true,distribution:{habitat:'山越えの洞窟内の結晶帯',count:1},concept:'白い小脚の上に、三角形の紫水晶の殻。',technique:'晶殻。高い守備を持ち、固定ダメージの糸遊が通りやすい。'},
 mistDeer:{...enemy('霧角鹿','mist-antler-deer-128'),pixelArt:true,distribution:{habitat:'洞窟西口と月嶺村の間にある尾根の鞍部',count:1,point:[37,15]},concept:'白い枝角と青灰色の細い体。足元に尾根の霧をまとう。',technique:'角の予告。角を低く下げた次の一撃が強く、防御で受けやすい。'},
 fox:enemy('妖狐','youko'),shadowFox:enemy('影九尾','kagekyubi')
};

// Routes describe the intended distribution on the review map. A tunnel is
// represented by its endpoints and never marks surface cells as encounters.
export const FIELD_ENCOUNTER_PLAN=[
 {id:'south',title:'鬼灯村から潮待村',color:'#dec796',sections:[
  {name:'南岸と社への道',roadIndices:[0,1],paths:[],
   formations:['oni','tanuki','onibi'],balance:['early-oni','early-tanuki','early-onibi'],detail:'鬼灯村外れと社への道の現行編成。'},
  {name:'海の入り江から潮待村',paths:[[[49,53],[49,51],[53,51]]],
   formations:['shoreOni','bubbleJelly','tideCrab'],balance:['cove-oni','cove-jelly','cove-crab'],detail:'磯妖は単体、泡くらげは単体か2体。潮鋏は磯の岩場に単体。入り江のイベント地点では通常戦を避ける。'},
  {name:'社西の洞窟',paths:[[[14,48],[20,48],[20,45]]],
   formations:['oni','tanuki','caveGuardian'],balance:['early-oni','early-tanuki','cave-guardian'],
   detail:'現行の基準として、地下の通常戦には序盤敵を使い、岩守の鬼は地下3階の固定戦。'}
 ]},
 {id:'bridge',title:'潮待村から梢音村',color:'#f2a948',sections:[
  {name:'潮待村から橋の南岸',paths:[[[53,51],[53,49],[51,47],[48,46],[48,44]]],
   formations:['oni','tanuki'],balance:['early-oni','early-tanuki'],detail:'南岸は野の小鬼と化け狸を中心にする。'},
  {name:'橋の北岸から梢音村',paths:[[[48,43],[48,35],[56,35]]],
   formations:['oni','tanuki','kodama','bridgeLantern'],balance:['early-oni','early-tanuki','bridge-kodama','bridge-lantern'],detail:'渡った先で木霊を混ぜ、北岸の石畳に橋灯りを置く。梢音村に近づくほど木霊を増やす。橋上と入村マスは遭遇対象外。'}
 ]},
 {id:'forest',title:'梢音村から忘れの森',color:'#64db9d',sections:[
  {name:'梢音村から森の入口',paths:[[[56,35],[56,33],[60,33],[60,32]]],
   formations:['kodama','spider'],balance:['bridge-kodama','edge-spider'],detail:'入口付近は北岸と同じ木霊と、通常の迷い蜘蛛が単体で出る案。梢音村から最短7歩のため、直行時に戦闘を強制しない。'},
  {name:'森の奥から滝へ',paths:[[[60,32],[60,29],[63,29],[63,23],[65,23]]],
   formations:['kodamaAutumn','spiderIndigo','leafStalker'],balance:['forest-kodama','forest-spider','forest-leaf'],detail:'紅葉木霊は赤橙の葉を持つ単体の強敵。藍糸蜘蛛は単体か2体、落葉隠れは落ち葉の多い森床に単体。'}
 ]},
 {id:'waterfall',title:'龍神の滝から洞窟東口',color:'#6ad7f0',sections:[
  {name:'滝と水辺',paths:[[[65,23],[65,20],[67,20]],[[67,20],[67,22],[57,22]]],
   formations:['snake','waterChild','sprayCormorant'],balance:['falls-snake','falls-child','falls-bird'],detail:'滝壺は水蛇と飛沫鵜、浅瀬は滝童が出る。水鏡のイベント地点は通常遭遇から外す。'}
 ]},
 {id:'tunnel',title:'山越えの洞窟',color:'#f294ae',tunnel:true,sections:[
  {name:'洞窟の入口側と奥',paths:[[[57,22],[42,18]]],
   formations:['caveBat','caveCentipede','crystalHermit'],balance:['tunnel-bat','tunnel-centipede','tunnel-hermit'],detail:'鉱灯蝙蝠は湿った東口側で単体、奥では2体。岩骨ムカデは狭い岩棚、晶殻ヤドカリは晶洞に単体。'}
 ]},
 {id:'ridge',title:'洞窟西口から月嶺村',color:'#e7cc67',sections:[
  {name:'西口と山道',paths:[[[42,18],[42,15],[30,15],[29,17],[26,17]]],
   formations:['mountainBoar','mountainCrow','mistDeer'],balance:['pass-boar','pass-crow','pass-deer'],detail:'峠荒らしは岩場の単体。風切り鴉は露出した尾根、霧角鹿は霧の鞍部に単体。洞窟西口と月嶺村の周囲は休息区間。'}
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
