import {RESIDENT_RADIUS} from '../village/residents.mjs';
import {BACK_WALL_FLOOR_Y,BACK_WALL_CONTACT_Y,SIDE_WALL_CLEAR_X,FRONT_WALL_TOP_OFFSET,FRONT_WALL_FURNITURE_GAP} from './room-geometry.mjs';

// Every sprite uses original 2px-world-pixel artwork (never stretched at draw time).
// The floor-contact rectangle is authored independently of each visible silhouette.
export const furniture = {
  teaCounter: {sprite:[0,0,212,124], foot:[8,56,196,62]},
  teaTable: {sprite:[248,0,156,114], foot:[10,32,136,76]},
  blueFuton: {sprite:[496,0,108,132], foot:[8,12,92,116]},
  redFuton: {sprite:[744,0,108,132], foot:[8,12,92,116]},
  weaponRack: {sprite:[0,176,128,150], foot:[12,100,104,42]},
  merchantShelf: {sprite:[248,176,148,148], foot:[10,100,128,42]},
  hearth: {sprite:[496,176,136,146], foot:[8,65,120,76]},
  tansu: {sprite:[744,176,120,108], foot:[6,72,108,30]},
  kitchen: {sprite:[0,352,148,144], foot:[8,74,132,66]},
  supplies: {sprite:[248,352,116,124], foot:[4,76,108,44]},
  weaponCounter: {sprite:[496,352,204,136], foot:[8,70,188,60]},
  cushion: {sprite:[744,352,52,44]},
  shopCounter: {sprite:[0,528,212,118], foot:[8,48,196,64]},
  innCounter: {sprite:[248,528,212,122], foot:[8,58,196,58]},
  workbench: {sprite:[496,528,168,106], foot:[8,64,152,36]},
  shoeRack: {sprite:[744,528,112,94], foot:[8,62,96,26]},
};

// Wall-relative placements are resolved from architecture and sprite footprints.
// Runtime drawing still uses the full 2px-pitch image without any per-object scale.
export function resolveFurniturePlacement(room,[asset,horizontal,vertical]) {
  const spec=furniture[asset];
  if(!spec) throw new Error('Unknown furniture '+asset);
  const {sprite,foot}=spec;
  const x=horizontal==='left-wall'?SIDE_WALL_CLEAR_X
    :horizontal==='right-wall'?room.width-SIDE_WALL_CLEAR_X-sprite[2]:horizontal;
  const y=vertical==='back-wall'?BACK_WALL_CONTACT_Y-(foot?.[1]??NaN)
    :vertical==='front-wall'?room.height-FRONT_WALL_TOP_OFFSET-FRONT_WALL_FURNITURE_GAP-sprite[3]:vertical;
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Invalid wall anchor for '+asset);
  return {asset,x,y,sprite,foot};
}

const TATAMI_SHORT_SIDE=80;

// Each letter identifies one mat. A single cell denotes a half mat.
export function tatamiMats({origin:[left,top], rows}) {
  const mats=[];
  for (const [y,row] of rows.entries()) {
    for (let x=0;x<row.length;x++) {
      const id=row[x];
      if (row[x-1]===id || rows[y-1]?.[x]===id) continue;
      const width=row[x+1]===id?2:1;
      const height=rows[y+1]?.[x]===id?2:1;
      mats.push([left+x*TATAMI_SHORT_SIDE,top+y*TATAMI_SHORT_SIDE,
        width*TATAMI_SHORT_SIDE,height*TATAMI_SHORT_SIDE]);
    }
  }
  return mats;
}

export const rooms = {
  teahouse: {
    name:'茶店', width:768, height:576, floor:'cedar', windows:[176,480],
    tatami:{origin:[64,300],rows:['AABCCDEF','GGBIIDEF']},
    furniture:[
      ['merchantShelf',68,'back-wall'], ['teaCounter',274,132], ['kitchen',544,'back-wall'],
      ['teaTable',130,324], ['teaTable',484,324],
      ['cushion',72,362], ['cushion',300,362], ['cushion',426,362], ['cushion',646,362],
    ],
    destinations:[[388,276],[188,480],[568,480]],
    resident:{asset:'shop-clerk',name:'茶店の店番',counter:'teaCounter',lines:['いらっしゃい。おにぎりと団子もあるよ。旅のお供にどうだい？']},
  },
  shop: {
    name:'物販店', width:704, height:544, floor:'cedar', windows:[294],
    furniture:[
      ['merchantShelf',56,'back-wall'], ['merchantShelf',500,'back-wall'],
      ['shopCounter',246,238], ['supplies','left-wall',326], ['tansu',302,'back-wall'],
    ],
    destinations:[[352,376],[180,268],[528,292]],
    resident:{asset:'shop-clerk',name:'物販店の店番',counter:'shopCounter',lines:['旅支度なら、うちの品を見ていってくださいな。']},
  },
  inn: {
    name:'宿', width:832, height:672, floor:'cedar', windows:[144,352,560],
    tatami:{origin:[56,140],rows:['ABCCDEEFH','ABGIDJJFK','LLGIMMNNK']},
    partitions:[[32,380,88],[216,380,400],[712,380,88]],
    furniture:[
      ['blueFuton',220,158], ['redFuton',388,158], ['blueFuton',592,158],
      ['tansu',56,'back-wall'], ['tansu','right-wall',430],
      ['innCounter',96,432], ['cushion',332,532], ['cushion',400,532], ['shoeRack',534,'front-wall'],
    ],
    destinations:[[176,592],[168,380],[664,380],[240,320],[416,320],[640,320]],
    resident:{asset:'shop-clerk',name:'宿の店番',counter:'innCounter',lines:['お疲れさまです。客間は奥にございます。']},
  },
  armory: {
    name:'兵具屋', width:736, height:544, floor:'walnut', windows:[312],
    furniture:[
      ['weaponRack',92,'back-wall'], ['weaponRack',520,'back-wall'], ['tansu',302,'back-wall'],
      ['weaponCounter',266,268], ['supplies','left-wall',332], ['supplies','right-wall',332],
    ],
    destinations:[[368,400],[156,272],[584,272]],
    resident:{asset:'shop-clerk',name:'兵具屋の店番',counter:'weaponCounter',lines:['いらっしゃい。初めての旅なら、丈夫な兵具を揃えていきな。']},
  },
  'house-farm': {
    name:'農家', width:640, height:512, floor:'walnut', windows:[240],
    earth:[[36,136,164,284]],
    tatami:{origin:[200,140],rows:['ABCCH','ABDEE','FFDGG']},
    furniture:[
      ['supplies',56,'back-wall'], ['kitchen','left-wall',270], ['tansu',446,'back-wall'],
      ['hearth',274,218], ['cushion',208,312], ['cushion',420,312],
    ],
    destinations:[[132,408],[336,376],[516,276]],
    resident:{asset:'farm-worker',name:'農家の住人',at:[470,292],lines:['朝摘みの野菜をしまったところだよ。畑は家の外にあるよ。']},
  },
  'house-family': {
    name:'家族の民家', width:672, height:528, floor:'cedar', windows:[112,410],
    tatami:{origin:[64,140],rows:['AABBCDD','EFFGCIJ','EKKGLIJ','MMNNLOO']},
    furniture:[
      ['tansu',82,'back-wall'], ['redFuton',408,152], ['blueFuton',524,152],
      ['teaTable',156,296], ['cushion',96,342], ['cushion',330,342],
    ],
    destinations:[[220,452],[480,300],[584,300]],
    resident:{asset:'villager',name:'民家の住人',at:[448,330],lines:['緋月さま、いらっしゃい。どうぞ上がっていって。']},
  },
  'house-craft': {
    name:'仕事場のある民家', width:672, height:528, floor:'cedar', windows:[288,476],
    tatami:{origin:[364,140],rows:['AAB','CDB','CDE','FFE']},
    furniture:[
      ['workbench','left-wall',248], ['merchantShelf',72,'back-wall'], ['supplies',242,'back-wall'],
      ['blueFuton',516,150], ['tansu',370,'back-wall'], ['cushion',470,350],
    ],
    destinations:[[192,436],[420,300],[540,316],[272,272]],
    resident:{asset:'elder',name:'職人',at:[264,306],lines:['道具は使ったあとが肝心じゃ。手入れをすれば長くもつぞ。']},
  },
};

export const villageRooms = {
  'teahouse-northeast':'teahouse',
  'inn-southeast':'inn',
  'house-northwest-tile':'house-family',
  'house-northwest-thatch':'house-farm',
  'house-northeast-thatch':'house-craft',
  'house-southeast-tile':'armory',
  'house-southwest-thatch':'house-farm',
  'house-southeast-thatch':'house-craft',
  'house-southwest-tile':'house-family',
};

export function resolveInterior(params) {
  const building = params.get('building');
  const key = params.get('room');
  const returnFocus = Object.hasOwn(villageRooms, building) ? building : null;
  const selected = returnFocus ? villageRooms[returnFocus] : Object.hasOwn(rooms, key) ? key : 'teahouse';
  return {room:rooms[selected], selected, returnFocus};
}

export function prepareInterior(room) {
  const {width,height} = room;
  const doorway = width/2;
  const spawn = [doorway,height-76];
  const exitY = height-12;
  const blocked = new Uint8Array(width*height).fill(1);

  function fill([left,top,w,h],value) {
    for (let y=top; y<top+h; y++) blocked.fill(value,y*width+left,y*width+left+w);
  }
  fill([32,BACK_WALL_FLOOR_Y,width-64,height-BACK_WALL_FLOOR_Y-32],0);
  fill([doorway-36,height-32,72,32],0);

  const objects = room.furniture.map(entry=>{
    const {asset,x,y,sprite,foot} = resolveFurniturePlacement(room,entry);
    const footprint = foot && [x+foot[0],y+foot[1],foot[2],foot[3]];
    if (footprint) fill(footprint,1);
    return {asset,sprite,x,y,footprint,depth:footprint ? footprint[1]+footprint[3] : y+sprite[3]};
  });
  const partitions = (room.partitions ?? []).map(([x,y,w])=>{
    const footprint = [x,y-8,w,16];
    fill(footprint,1);
    return {x,y,w,footprint,depth:y+8};
  });
  const config = room.resident;
  const counter = objects.find(object=>object.asset===config.counter)?.footprint;
  const [x,y] = counter ? [counter[0]+counter[2]/2,counter[1]-14] : config.at;
  const resident = {...config,x,y,face:0,depth:y};
  if(counter) resident.talkPoint=[x,counter[1]+counter[3]-4];
  for(let dy=-RESIDENT_RADIUS;dy<=RESIDENT_RADIUS;dy++){
    for(let dx=-RESIDENT_RADIUS;dx<=RESIDENT_RADIUS;dx++){
      if(dx*dx+dy*dy<=RESIDENT_RADIUS*RESIDENT_RADIUS) blocked[(y+dy)*width+x+dx]=1;
    }
  }
  const depthSorted = [...objects,...partitions,resident].sort((a,b)=>a.depth-b.depth);
  return {blocked,doorway,spawn,exitY,depthSorted,resident,destinations:room.destinations};
}
