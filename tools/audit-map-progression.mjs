// Reproducible, read-only audit of the existing overworld progression.
// Uses actual authored map metadata, field encounter implementation and v2 rules.
// Does not place NPCs, rebalance equipment, or write save data.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {
  STATUS_V2,ARMORY_STOCK,ENEMIES,nextLevelXp
} from '../src/game/battle/rules.mjs';

import {FIELD_PLACE_ROUTES} from '../src/field/landmarks.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const orderedPlaces=['village','shrine','cove','forest','waterfall','hotspring','fox'];
const legLength=route=>route.slice(1).reduce((sum,p,i)=>
  sum+Math.abs(p[0]-route[i][0])+Math.abs(p[1]-route[i][1]),0);
const nextGoldTotal=stock=>stock.reduce((s,item)=>s+item.price,0);

export function buildMapProgressionAudit(){
  const contents=read('data/maps/field/terrain.js');
  const terrain=JSON.parse(contents.slice(contents.indexOf('{'),contents.lastIndexOf('}')+1));
  const world=read('src/field/world.js');
  const walk=read('src/field/walk.mjs');
  const battle=read('src/game/battle/rules.mjs');
  const reference=terrain.referenceComposition;
  const match=walk.match(/const encounterAfter=(\d+)\+Math\.floor\(Math\.random\(\)\*(\d+)\)/);
  if(!match)throw Error('Field encounter frequency expression changed; audit the new policy');
  const minInterval=Number(match[1]),maxInterval=minInterval+Number(match[2])-1;
  if(!walk.includes('chooseFieldEncounter('))throw Error('Actual encounter entry point changed');
  const firstRouteOnly=battle.includes('const road=world?.roads?.[0];') &&
    battle.includes("if(closest>32*4)return 'village-outskirts';");
  if(!firstRouteOnly)throw Error('Region encounter routing changed; audit every region');
  const legs=orderedPlaces.slice(1).map((id,i)=>{
    const prev=orderedPlaces[i],points=reference.roads[i];
    if(!points?.length||
      String(points[0])!==String(reference.places[prev])||
      String(points.at(-1))!==String(reference.places[id]))
      throw Error('Authored road endpoints differ from destination chain: '+prev+' > '+id);
    return {
      from:prev,to:id,routeIndex:i,referenceNodes:points.length,
      metadataSteps:legLength(points),liveBothEnds:Object.hasOwn(FIELD_PLACE_ROUTES,prev)&&Object.hasOwn(FIELD_PLACE_ROUTES,id)
    };
  });
  const first=legs[0];
  const earlyEnemySets=[
    {id:'field-oni',count:1},{id:'tanuki',count:2},{id:'onibi',count:1}
  ];
  const earlyEnemies=earlyEnemySets.map(({id,count})=>{
    const enemy=ENEMIES[id];
    if(!enemy)throw Error('Missing existing first-route enemy: '+id);
    return {id,count,xp:enemy.xp*count,gold:enemy.gold*count};
  });
  const firstAreaExperience={
    toLevel2:nextLevelXp(1),
    toLevel5:[1,2,3,4].reduce((s,lv)=>s+nextLevelXp(lv),0),
    toLevel10:Array.from({length:9},(_,n)=>n+1)
      .reduce((s,lv)=>s+nextLevelXp(lv),0),
    firstLegRoughBattles:{min:Math.floor(first.metadataSteps/maxInterval),
      max:Math.floor(first.metadataSteps/minInterval)},
    // These are arithmetic bounds only, not simulated battle probabilities.
    level5BattleCountAtCurrentFirstRouteRewards:{
      min:Math.ceil([1,2,3,4].reduce((s,lv)=>s+nextLevelXp(lv),0)/
        Math.max(...earlyEnemies.map(x=>x.xp))),
      max:Math.ceil([1,2,3,4].reduce((s,lv)=>s+nextLevelXp(lv),0)/
        Math.min(...earlyEnemies.map(x=>x.xp)))
    }
  };
  const stock=ARMORY_STOCK.map(item=>({
    id:item.id,slot:item.slot,price:item.price,attack:item.attack,defense:item.defense
  }));
  const guardNames=Object.keys(reference.places);
  return {
    auditVersion:1,
    map:{width:terrain.width,height:terrain.height,tileSize:terrain.tileSize,
      locations:orderedPlaces.map(id=>({id,cell:reference.places[id]})),
      legs,
      caveDestinationPresent:guardNames.some(id=>/cave|cavern|tunnel|pass/.test(id)),
      restStopLocations:reference.restStops.map(s=>({id:s.id,name:s.name,cell:s.cell})),
      hasRestStopShopConnection:walk.includes('restStopAt('),
      liveTransitionDestinations:orderedPlaces.filter(id=>Object.hasOwn(FIELD_PLACE_ROUTES,id))
    },
    encounters:{minSteps:minInterval,maxSteps:maxInterval,firstRouteOnly,
      enemies:earlyEnemies},
    growth:{approvedTierBonuses:STATUS_V2.equipment.map(t=>[t.id,t.attack,t.defense]),
      firstAreaExperience},
    equipment:{hozuki:stock,hozukiTotals:{
      price:nextGoldTotal(stock),
      attack:stock.reduce((sum,item)=>sum+item.attack,0),
      defense:stock.reduce((sum,item)=>sum+item.defense,0)
    }}
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=buildMapProgressionAudit();
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
