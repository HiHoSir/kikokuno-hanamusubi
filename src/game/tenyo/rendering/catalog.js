((root,f)=>{const api=f();if(typeof module==='object'&&module.exports)module.exports=api;else root.SMCatalog=api;})(globalThis,()=>{
'use strict';
// x,y is the leftmost ground cell on the front contact row. Negative dy is rear ground.
const single=[[0,0]],tree=single,house=[[0,0],[1,0],[2,0]],
inn=[[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,0],[1,0],[2,0],[3,0],[4,0]],shop=inn,
shrine=[[0,-1],[1,-1],[2,-1],[0,0],[1,0],[2,0]];
// Intentionally authored masks, NOT inferred from visual dimensions/alpha.
const occupancy={well:single,building_inn:inn,building_shop:shop,building_tea:house,building_west_home:house,building_southwest_home:house,building_south_home:house,building_shrine:shrine,bridge:[],bridge_vertical:[],auto_road:[],auto_river:single,ground_grass:[],bench:single,pot:single,crate:single,tree_conifer:tree,tree_broadleaf:tree,shrub:single,grass_tuft:[],flowers_orange:single,flowers_white:single,rocks:single,fence:single,garden_crop:single,terrain_grass:[],terrain_dirt:[],terrain_river:[]};
const doors={building_inn:[[2,0],[2,1]],building_shop:[[2,0],[2,1]],building_tea:[[1,0],[1,1]],building_west_home:[[1,0],[1,1]],building_southwest_home:[[1,0],[1,1]],building_south_home:[[1,0],[1,1]],building_shrine:[[1,0],[1,1]]};
// Verified transparent margins of the approved PNGs; display only, never collision input.
const visible={well:[5,2,22,28],building_inn:[9,2,142,92],building_shop:[9,2,142,92],building_tea:[2,15,92,65],building_west_home:[2,17,92,62],building_southwest_home:[2,16,92,63],building_south_home:[2,18,92,60],building_shrine:[8,2,80,92],bridge:[0,0,64,32],bridge_vertical:[0,0,32,64],bench:[2,11,28,10],pot:[2,2,27,28],crate:[3,2,25,28],tree_conifer:[2,10,28,43],tree_broadleaf:[2,17,28,30],shrub:[2,4,26,24],grass_tuft:[2,4,28,23],flowers_orange:[2,6,28,18],flowers_white:[2,2,28,27],rocks:[2,5,28,22],fence:[2,8,28,15],garden_crop:[0,0,32,32]};
const templates=[{"id":"well","name":"井戸","src":"assets/settlement-editor/chips/well.png","displayCells":[1,1],"kind":"object"},{"id":"building_inn","name":"宿","src":"assets/settlement-editor/chips/building_inn.png","displayCells":[5,3],"kind":"object"},{"id":"building_shop","name":"店","src":"assets/settlement-editor/chips/building_shop_inn.png","displayCells":[5,3],"kind":"object"},{"id":"building_tea","name":"茶屋","src":"assets/settlement-editor/chips/building_tea.png","displayCells":[3,3],"kind":"object"},{"id":"building_west_home","name":"西の民家","src":"assets/settlement-editor/chips/building_west_home.png","displayCells":[3,3],"kind":"object"},{"id":"building_southwest_home","name":"南西の民家","src":"assets/settlement-editor/chips/building_southwest_home.png","displayCells":[3,3],"kind":"object"},{"id":"building_south_home","name":"南の民家","src":"assets/settlement-editor/chips/building_south_home.png","displayCells":[3,3],"kind":"object"},{"id":"building_shrine","name":"祠","src":"assets/settlement-editor/chips/building_shrine.png","displayCells":[3,3],"kind":"object"},{"id":"bridge","name":"木の橋","src":"assets/settlement-editor/terrain-v1/bridge-h.png","displayCells":[2,1],"kind":"object"},{"id":"bench","name":"ベンチ","src":"assets/settlement-editor/chips/bench.png","displayCells":[1,1],"kind":"object"},{"id":"pot","name":"壺","src":"assets/settlement-editor/chips/pot.png","displayCells":[1,1],"kind":"object"},{"id":"crate","name":"木箱","src":"assets/settlement-editor/chips/crate.png","displayCells":[1,1],"kind":"object"},{"id":"tree_conifer","name":"針葉樹","src":"assets/settlement-editor/chips/tree_conifer.png","displayCells":[1,2],"kind":"object"},{"id":"tree_broadleaf","name":"広葉樹","src":"assets/settlement-editor/chips/tree_broadleaf.png","displayCells":[1,2],"kind":"object"},{"id":"shrub","name":"低木","src":"assets/settlement-editor/chips/shrub.png","displayCells":[1,1],"kind":"object"},{"id":"grass_tuft","name":"草むら","src":"assets/settlement-editor/chips/grass_tuft.png","displayCells":[1,1],"kind":"terrain"},{"id":"flowers_orange","name":"赤橙の花","src":"assets/settlement-editor/chips/flowers_orange.png","displayCells":[1,1],"kind":"object"},{"id":"flowers_white","name":"白い花","src":"assets/settlement-editor/chips/flowers_white.png","displayCells":[1,1],"kind":"object"},{"id":"rocks","name":"岩","src":"assets/settlement-editor/chips/rocks.png","displayCells":[1,1],"kind":"object"},{"id":"fence","name":"木柵","src":"assets/settlement-editor/chips/fence.png","displayCells":[1,1],"kind":"object"},{"id":"garden_crop","name":"畑","src":"assets/settlement-editor/terrain-v1/farm-source.png","displayCells":[1,1],"kind":"terrain"},{"id":"terrain_grass","name":"草地の断片","src":"assets/settlement-editor/chips/terrain_grass.png","displayCells":[1,1],"kind":"terrain"},{"id":"terrain_dirt","name":"土道の断片","src":"assets/settlement-editor/chips/terrain_dirt.png","displayCells":[1,1],"kind":"terrain"},{"id":"terrain_river","name":"川の断片","src":"assets/settlement-editor/chips/terrain_river.png","displayCells":[1,4],"kind":"terrain"},{"id":"bridge_vertical","name":"木の橋（縦）","src":"assets/settlement-editor/terrain-v1/bridge-v.png","displayCells":[1,2],"kind":"object"},{"id":"auto_road","name":"道（自動接続）","src":"assets/settlement-editor/terrain-v1/road-47.png","displayCells":[1,1],"kind":"terrain"},{"id":"auto_river","name":"川（自動接続）","src":"assets/settlement-editor/terrain-v1/river-47.png","displayCells":[1,1],"kind":"terrain"},{"id":"ground_grass","name":"草地（全面）","src":"assets/settlement-editor/terrain-v1/grass-source.png","displayCells":[1,1],"kind":"terrain"}].map(t=>({...t,occupiedTiles:occupancy[t.id],entranceLocal:doors[t.id]?.[0]||null,approachLocal:doors[t.id]?.[1]||null}));
for(const t of templates){t.sourceRect=t.kind==='object'?visible[t.id]:[0,0,t.displayCells[0]*32,t.displayCells[1]*32];t.layer=t.kind==='terrain'||t.id==='bridge'||t.id==='bridge_vertical'?'ground':'object';}
const byId=Object.fromEntries(templates.map(t=>[t.id,t]));
// Explicit two-row building masks: the rear row is blocked; the central door is open.
for(const t of templates.filter(t=>t.id.startsWith('building_'))){t.legacyOccupiedTiles=t.occupiedTiles;t.occupiedTiles=[];for(const dy of [-1,0])for(let dx=0;dx<t.displayCells[0];dx++)if(dy!==0||dx!==t.entranceLocal[0])t.occupiedTiles.push([dx,dy]);}
byId.garden_crop.legacyOccupiedTiles=single;byId.garden_crop.occupiedTiles=[];
for(const id of ['auto_road','auto_river']){byId[id].autotile=true;byId[id].paintable=true;byId[id].paintGroup='surface';byId[id].preview='assets/settlement-editor/terrain-v1/'+(id==='auto_road'?'road':'river')+'-preview.png';}
byId.auto_river.animation={frames:2,frameHeight:192,frameMs:360};byId.auto_river.src='assets/animation/fluid-v1/river-47.png';byId.auto_river.water=true;byId.ground_grass.paintable=true;byId.ground_grass.paintGroup='base';
byId.garden_crop.paintable=true;byId.garden_crop.paintGroup='farm';
byId.bridge.name='木の橋（横・旧2マス）';byId.bridge.bridgePassages=[[0,0],[1,0]];byId.bridge_vertical.bridgePassages=[[0,-1],[0,0]];
byId.bridge.hidden=true;byId.bridge_vertical.hidden=true;
const bridgeTile={id:'auto_bridge',name:'橋（1マス・自動接続）',src:'assets/settlement-editor/terrain-v1/bridge-v2-17.png',preview:'assets/settlement-editor/terrain-v1/bridge-v2-preview.png',displayCells:[1,1],kind:'terrain',sourceRect:[0,0,32,32],layer:'ground',occupiedTiles:[],entranceLocal:null,approachLocal:null,autotile:true,bridgeAuto:true,paintable:true,paintGroup:'bridge',bridgePassages:[[0,0]]};templates.push(bridgeTile);byId.auto_bridge=bridgeTile;
for(const id of ['terrain_grass','terrain_dirt','terrain_river'])byId[id].hidden=true;

// Reusable village pack: static authored sizes, layers and occupancy.
const packDir='assets/settlement-editor/pack-v1/';
function packAsset(id,name,size=[1,1],blocked=true,ground=false,extra={}){const t={id,name,src:packDir+id+'.png',displayCells:size,kind:ground?'terrain':'object',sourceRect:[0,0,size[0]*32,size[1]*32],occupiedTiles:blocked?[[0,0]]:[],layer:ground?'ground':'object',entranceLocal:null,approachLocal:null,pack:'v1',...extra};templates.push(t);byId[id]=t;}
for(const [key,name]of [['shop','小型店舗'],['inn','小型宿'],['medicine','薬屋'],['weapon','武器屋'],['armor','防具屋'],['tools','道具屋']]){packAsset('small_'+key,name,[3,2],false,false,{entranceLocal:[1,0],approachLocal:[1,1],occupiedTiles:[[0,-1],[1,-1],[2,-1],[0,0],[2,0]]});packAsset('sign_'+key,name+'の看板',[1,1],false,false,{wallSign:true});}
packAsset('building_barn','物置・納屋',[3,2],false,false,{src:packDir+'barn.png',entranceLocal:[1,0],approachLocal:[1,1],occupiedTiles:[[0,-1],[1,-1],[2,-1],[0,0],[2,0]]});
for(const [id,name]of [['barrel','樽'],['rice_bale','米俵'],['firewood','薪'],['basket','籠'],['signpost','立て札']])packAsset(id,name);
for(const [id,name,file]of [['stairs_stone','石の階段','stairs'],['stepping_stone','踏み石','stepping_stone'],['decor_leaves','落ち葉','leaves'],['decor_pebbles','小石','pebbles']])packAsset(id,name,[1,1],false,true,{src:packDir+file+'.png'});
for(const [key,name]of [['cobble','石畳'],['gravel','砂利'],['soil','裸土']])packAsset('ground_'+key,name+'（自動接続）',[1,1],false,true,{src:packDir+key+'-47.png',preview:packDir+key+'-preview.png',autotile:true,paintable:true,paintGroup:'surface'});
for(const [key,name]of [['fence','木柵'],['hedge','生垣']])packAsset('auto_'+key,name+'（自動接続）',[1,1],true,true,{src:packDir+key+'-16.png',preview:packDir+key+'-preview.png',autotile:true,cardinalAuto:true,paintable:true,paintGroup:'boundary'});

for(const [id,name]of [['building_belltower','鐘撞堂'],['building_jinja','神社']])packAsset(id,name,[3,2],false,false,{src:'assets/settlement-editor/religious-v1/'+id+'.png',pack:'religious-v1',entranceLocal:[1,0],approachLocal:[1,1],occupiedTiles:[[0,-1],[1,-1],[2,-1],[0,0],[2,0]]});
for(const [id,name]of [['komainu_left','狛犬（左）'],['komainu_right','狛犬（右）']])packAsset(id,name,[1,1],true,false,{src:'assets/settlement-editor/religious-v1/'+id+'.png',pack:'religious-v1'});
// Seasonal variants reuse approved silhouettes. Keep contact independent of PNG size:
// both tall broadleaf and the 1-cell paired trees block only their authored base cell.
for(const [key,name]of [['sakura_pale','桜（淡桃）'],['sakura_pink','桜（濃桃）'],['autumn_red','紅葉（赤）'],['autumn_orange','紅葉（橙）'],['autumn_yellow','紅葉（黄）']]){
 for(const [prefix,size,rect,label]of [['tree',[1,2],[2,17,28,30],'広葉樹'],['trees_1cell',[1,1],[0,7,32,25],'1マスの木']]){
  const id=prefix+'_'+key;
  packAsset(id,label+'・'+name,size,true,false,{src:'assets/settlement-editor/seasonal-trees-v1/'+id+'.png',sourceRect:rect,pack:'seasonal-trees-v1'});
 }
}
// Reuse the approved 64px torii without resampling the source PNG. Its 2x
// nearest-neighbour draw spans four 32px cells in both directions.
// x,y is the leftmost cell on the bottom contact row: only the two posts
// block walking; the central two cells and every upper cell remain open.
packAsset('torii_gate','鳥居（中央通行可・4マス幅）',[4,4],false,false,{
 src:'assets/terrain/places-v1/torii.png',sourceRect:[0,0,64,64],
 renderCells:[4,4],occupiedTiles:[[0,0],[3,0]],pack:'field-torii-reuse'
});
// Approved B Jizo is shared with the field; contact is authored independently.
packAsset('jizo','地蔵',[1,1],true,false,{src:'assets/settlement-editor/chips/jizo.png',pack:'jizo-approved-v1'});
// Tenyou water-sanctuary gate: 6x4 visual, explicit left/right contact cells,
// center two cells reserved for event-gated future passage.
packAsset('tenyo_water_gate','天妖の社・水上門',[6,4],false,false,{
 src:'assets/settlement-editor/tenyo-gate-v1/tenyo_gate_6x4_v3.png',
 sourceRect:[0,0,192,128],pack:'tenyo-gate-v1',
 occupiedTiles:[[0,0],[1,0],[4,0],[5,0]],
 entranceLocal:[2,0],approachLocal:[2,1]
});
// Dedicated orthographic village torii, 4x3 display. Only outer posts collide.
packAsset('torii_gate_v2','鳥居・村用32px版',[4,3],false,false,{
 src:'assets/settlement-editor/tenyo-gate-v1/torii_gate_v2_4x3.png',
 sourceRect:[0,0,128,96],pack:'tenyo-gate-v1',
 occupiedTiles:[[0,0],[3,0]]
});
// Low-res freestanding stone lantern for Tenyou sanctuary. One blocked base cell.
packAsset('tenyo_stone_lantern','天妖の石灯篭',[1,2],true,false,{
 src:'assets/settlement-editor/tenyo-gate-v1/stone_lantern_1x2.png',
 sourceRect:[0,0,32,64],pack:'tenyo-gate-v1',occupiedTiles:[[0,0]]
});
// Walkable sanctuary shallows: animated surface, no water collision.
packAsset('tenyo_shallows','霊池・歩ける浅瀬',[1,1],false,true,{
 src:'assets/settlement-editor/tenyo-water-v1/shallow_water_32x4.png',
 sourceRect:[0,0,32,32],occupiedTiles:[],paintable:true,paintGroup:'surface',
 animation:{frames:4,frameHeight:32,frameMs:450},shallow:true,pack:'tenyo-water-v1'
});
for(let i=1;i<=3;i++)packAsset('tenyo_lotus_'+i,'ハスの葉 '+i,[1,1],false,true,{
 src:'assets/settlement-editor/tenyo-water-v1/lotus_leaf_'+i+'.png',
 sourceRect:[0,0,32,32],occupiedTiles:[],pack:'tenyo-water-v1'
});
packAsset('tenyo_ripple_fx','浅瀬波紋アニメ',[1,1],false,true,{
 src:'assets/settlement-editor/tenyo-water-v1/shallow_ripple_32x4.png',
 sourceRect:[0,0,32,32],occupiedTiles:[],hidden:true,pack:'tenyo-water-v1'
});
// Original rock sprite variants with independently authored 1-cell contacts.
for(const [id,name] of [['rock_group_a','岩群・大'],['rock_group_b','岩群・反転'],['rock_group_c','岩群・小'],['rock_group_d','岩群・小反転']])packAsset(id,name,[1,1],true,false,{src:'assets/settlement-editor/rock-pieces-v1/'+id+'.png',sourceRect:[0,0,48,48],pack:'rock-pieces-v1'});
// Existing field waterfall: two 80×96 frames arranged horizontally.
packAsset('sanctuary_waterfall','滝（アニメーション）',[3,3],false,false,{src:'assets/animation/fluid-v1/waterfall.png',sourceRect:[0,0,80,96],occupiedTiles:[[0,0],[1,0],[2,0]],animation:{frames:2,frameWidth:80,frameMs:360},pack:'fluid-v1'});
// Full-map scenery overlay and separate falls. Art is independent of collision.
packAsset('sanctuary_forest_frame_v1','聖域の森と岩場',[27,25],false,false,{src:'assets/settlement-editor/sanctuary-frame-v1/forest-frame.png',sourceRect:[0,0,864,800],occupiedTiles:[],submergedHeight:0,pack:'sanctuary-frame-v1'});
packAsset('sanctuary_forest_frame_v2','聖域の森と岩場（28マス）',[28,25],false,false,{src:'assets/settlement-editor/sanctuary-frame-v1/forest-frame.png',sourceRect:[0,0,864,800],renderCells:[28,25],occupiedTiles:[],submergedHeight:0,pack:'sanctuary-frame-v1'});
packAsset('sanctuary_fall_art_v1','聖域の滝・新規原画',[3,4],false,false,{src:'assets/settlement-editor/sanctuary-frame-v1/waterfall.png',sourceRect:[0,0,96,128],occupiedTiles:[],submergedHeight:0,pack:'sanctuary-frame-v1'});
packAsset('sanctuary_forest_frame_v3','聖域の森と岩場・遠景',[28,25],false,false,{src:'assets/settlement-editor/sanctuary-frame-v1/forest-frame.png',sourceRect:[0,0,864,800],renderCells:[28,25],occupiedTiles:[],submergedHeight:0,fadeHorizon:true,pack:'sanctuary-frame-v1'});
packAsset('sanctuary_horizon_v1','聖域の空と遠景',[10,4],false,false,{src:'assets/settlement-editor/sanctuary-horizon-v1/horizon.png',sourceRect:[0,0,320,128],occupiedTiles:[],submergedHeight:0,pack:'sanctuary-horizon-v1'});
packAsset('sanctuary_fall_v2','聖域の滝・岩付き',[4,5],false,false,{src:'assets/settlement-editor/sanctuary-horizon-v1/waterfall.png',sourceRect:[0,0,128,160],occupiedTiles:[],submergedHeight:0,animation:{frames:4,frameMs:150},flowRegion:[48,48,30,72],pack:'sanctuary-horizon-v1'});
packAsset('sanctuary_npc_shirotae','白妙（聖域NPC）',[1,1],true,false,{src:'assets/characters/tenyo-npc-v3/shirotae-walk-96x128.png',sourceRect:[0,0,32,32],character:true,pack:'sanctuary-npc'});
packAsset('sanctuary_npc_guard','社守（聖域NPC）',[1,1],true,false,{src:'assets/characters/tenyo-guardian-sd-v1/walk-atlas-32.png',sourceRect:[0,0,32,32],character:true,pack:'sanctuary-npc'});
for(const id of ['sanctuary_forest_frame_v1','sanctuary_forest_frame_v2','sanctuary_forest_frame_v3','sanctuary_horizon_v1'])byId[id].selectThrough=true;
// Larger overlapping canopies use the existing village trees; only the trunk cell blocks.
for(const [id,name,src] of [['sanctuary_tree_broad','森・広葉樹','assets/settlement-editor/chips/tree_broadleaf.png'],['sanctuary_tree_conifer','森・針葉樹','assets/settlement-editor/chips/tree_conifer.png'],['sanctuary_tree_sakura','森・桜','assets/settlement-editor/seasonal-trees-v1/tree_sakura_pink.png']])packAsset(id,name,[1,2],true,false,{src,sourceRect:id==='sanctuary_tree_conifer'?[2,10,28,43]:[2,17,28,30],renderCells:[2,2],submergedHeight:0,pack:'sanctuary-forest'});
// Independent raised rock island; the middle front cell is reserved for the
// separately placed lantern. All remaining footprint cells are explicit.
packAsset('rock_island_lantern_base','岩の小島・灯籠台',[3,2],false,false,{
 src:'assets/settlement-editor/rock-island-v1/stone-island-96x64.png',
 sourceRect:[0,0,96,64],occupiedTiles:[[0,-1],[1,-1],[2,-1],[0,0],[2,0]],supportSurface:{slot:[1,0],offsetY:-26,accept:['tenyo_stone_lantern']},submergedHeight:12,pack:'rock-island-v1'
});
packAsset('rock_island_lantern_base_mirror','岩の小島・反転',[3,2],false,false,{
 src:'assets/settlement-editor/rock-island-v1/stone-island-mirror-96x64.png',
 sourceRect:[0,0,96,64],occupiedTiles:[[0,-1],[1,-1],[2,-1],[0,0],[2,0]],supportSurface:{slot:[1,0],offsetY:-26,accept:['tenyo_stone_lantern']},submergedHeight:12,pack:'rock-island-v1'
});
// Imported user-authored clear-water pack. Native 32x32, four stacked animation frames.
for(const id of ['shallow','mid','deep',...['deep_mid','mid_shallow'].flatMap(k=>['N','E','S','W'].map(d=>'shore_'+k+'_'+d))]){
packAsset('clear_water_'+id,'透明水 '+id,[1,1],false,true,{src:'assets/settlement-editor/clear-water-v1/'+id+'.png',sourceRect:[0,0,32,32],animation:{frames:4,frameHeight:32,frameMs:360},pack:'clear-water-v1',hidden:true,paintable:false,paintGroup:'surface'});
}
return {templates,byId};
});
