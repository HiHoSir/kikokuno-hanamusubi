// Public review route uses the exact production field HTML, assets and terrain.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{const u=new URL(req.url,'http://localhost');
 const p=resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
 if(relative(root,p).startsWith('..')){res.writeHead(403);res.end();return;}
 const b=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream'});res.end(b);
 }catch{res.writeHead(404);res.end('404');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const start of ['meadow','approach','west','east','lookout','rear','eastHighland','centralHighland','northRidge','forestCliff','mountainCliff','treeEdgeEast','treeEdgeCenter','waterfall']){
  const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/previews/field-exploration/?from=battle&start='+start);
  try{await page.waitForFunction(()=>window.__FIELD_EXPLORATION_PREVIEW &&
      document.querySelector('#load')?.hidden===true,null,{timeout:45000});}
  catch(err){
    console.log('REVIEW STATUS '+JSON.stringify(await page.evaluate(()=>({
      loading:document.querySelector('#progress')?.textContent||document.querySelector('#load')?.textContent,
      loaded:document.querySelector('#load')?.hidden, preview:window.__FIELD_EXPLORATION_PREVIEW,
      url:location.href,base:document.baseURI
    }))));
    throw err;
  }
  const info=await page.evaluate(()=>({
    qa:window.__FIELD_EXPLORATION_PREVIEW,
    reviewSpawn:window.__FIELD_EXPLORATION_SPAWN,
    scenery:window.YK_WORLD.mapData.diagonalSceneryThinning,
    collisionConsistency:(()=>{
      const m=window.YK_WORLD.mapData, expected=new Set(m.decorations.flatMap(o=>o.occupiedTiles.map(c=>c.join(','))));
      const stale=[...m.occupiedTiles].filter(k=>!expected.has(k));
      const missing=[...expected].filter(k=>!m.occupiedTiles.has(k));
      const removed=m.diagonalSceneryThinning?.removed||[];
      const retiredCells=removed.flatMap(o=>o.contactTiles).filter(([x,y])=>['grass','forest'].includes(m[y]?.[x]));
      return {stale,missing,retiredCount:retiredCells.length,
        newlyOpen:retiredCells.filter(([x,y])=>!m.occupiedTiles.has(x+','+y)).length,
        restoredMountainAnchors:[[52,22],[54,24],[55,25],[57,26],[65,15],[68,15],[66,16],[68,16],[70,18],[44,64],[42,65],[46,66],[42,67],[64,8],[65,9],[68,8]]
          .map(([x,y])=>({
           x,y,visible:m.decorations.some(o=>['newTrees','newMountainLarge','newMountainSmall'].includes(o.kind)&&
             o.contactTiles.some(c=>c[0]===x&&c[1]===y)),
           terrain:m[y]?.[x]
          }))
      };
    })(),
    waterfallBasin:(()=>{
      const m=window.YK_WORLD.mapData,w=window.YK_WORLD;
      const wet=[[66,15],[65,16],[66,16],[68,16],[65,17],[66,17],[65,18],[69,18],
         [70,18],[65,19],[66,19],[71,19],[68,20],[71,20],[68,21],[68,22]];
      const retired=[[65,15],[66,15],[68,15],[65,16],[66,16],[68,16],[65,17],[66,17],
        [64,18],[70,18],[71,18],[72,18],[64,19],[71,19],[71,20],[71,21]];
      const at=(x,y)=>[x*32+16,y*32+16],route=[[67,21],[67,20],[67,19],[67,18]];
      return {
       wet:wet.map(([x,y])=>({x,y,river:m[y][x]==='river',blocked:!w.walkable(...at(x,y))})),
       retired:retired.map(([x,y])=>({x,y,unoccupied:!m.occupiedTiles.has(x+','+y),
         noMountain:!m.decorations.some(o=>['newMountainLarge','newMountainSmall'].includes(o.kind)&&
           o.contactTiles.some(c=>c[0]===x&&c[1]===y))})),
       approach:route.slice(1).every((p,i)=>w.canMove(...at(...route[i]),...at(...p))&&w.canMove(...at(...p),...at(...route[i]))),
       reachable:route.every(([x,y])=>m.travelReachable.has(x+','+y)),
       ladder:m.ladders.some(l=>l.lower.join(',')==='67,21'&&l.upper.join(',')==='67,20'),
       downstream:m[25][69]==='river'
      };
    })(),
    cornerWalk:(()=>{
      // Exact coordinates of the reported Hirozuki forest gap near the east cliff.
      const m=window.YK_WORLD.mapData,W=window.YK_WORLD,E=window.YK_ELEVATION;
      const pos=(x,y)=>[x*32+16,y*32+16],center=pos(60,28);
      const exits=Object.fromEntries(
        [['north',60,27],['west',59,28],['east',61,28],['south',60,29]]
          .map(([name,x,y])=>[name,{
            canMove:W.canMove(...center,...pos(x,y)),
            hasVisibleTreeCollider:m.decorations.some(o=>
              o.kind==='newTrees'&&o.occupiedTiles?.some(c=>c[0]===x&&c[1]===y)),
            cut:E.outline(m,x,y).cuts.length,
            terrain:m[y]?.[x],height:m.heights[y]?.[x]
          }])
      );
      return {cutWidth:m.cornerCut,originalPassable:W.walkable(...center),exits};
    })(),
    anchoredTrees:(()=>{
      const m=window.YK_WORLD.mapData,E=window.YK_ELEVATION;
      const trees=m.decorations.filter(o=>o.kind==='newTrees'&&o.contactTiles.length===1);
      return {
        mode:window.YK_FIELD_LEGACY_TREE_ANCHORS?'old':'terrain',
        inset:trees.filter(o=>o.renderFoot!==undefined).length,
        ramps:trees.filter(o=>o.renderHeight!==undefined).length,
        misplaced:trees.filter(o=>Math.abs(E.height(m,o.x+o.width/2,(o.renderFoot??o.foot)-1)-
          (o.renderHeight??o.supportHeight))>.001).length,
        reachable:m.travelReachable.size
      };
    })(),
    pos:[Number(document.querySelector('#scene').dataset.x),Number(document.querySelector('#scene').dataset.y)],
    height:window.YK_WORLD.mapData.heights[59][40],
    flowers:window.YK_WORLD.mapData.decorations.filter(o=>o.kind==='wildflowers').length,
    nav:document.querySelectorAll('#review-controls a').length,
    mountainThinning:(()=>{
      const terrain=window.YK_FIELD_TERRAIN;
      const map=window.YK_WORLD.mapData;
      const removed=[[52,22],[54,24],[55,25],[57,26],[65,15],[68,15],[66,16],[68,16],[70,18],[44,64],[42,65],[46,66],[42,67],[64,8],[65,9],[68,8]];
      const objects=terrain.referenceComposition.decorations.filter(o=>o.kind==='newMountainLarge'||o.kind==='newMountainSmall');
      return {
        sourceCount:objects.length,
        runtimeCount:map.decorations.filter(o=>o.kind==='newMountainLarge'||o.kind==='newMountainSmall').length,
        removed:removed.map(([x,y])=>({
          x,y,
          stillPresent:objects.some(o=>o.contactTiles[0][0]===x&&o.contactTiles[0][1]===y),
          terrain:map[y][x],
          walkable:window.YK_WORLD.walkable(x*32+16,y*32+16)
        })),
        remainingAnchors:[[53,23],[53,26],[42,66]].every(([x,y])=>objects.some(o=>o.contactTiles[0][0]===x&&o.contactTiles[0][1]===y))
      };
    })(),
    cliffObjects:[[39,32,'newTrees'],[53,23,'newMountainSmall'],[53,26,'newMountainLarge']].map(([x,y,kind])=>({
      x,y,kind,cuts:window.YK_ELEVATION.outline(window.YK_WORLD.mapData,x,y).cuts.length,
      protected:window.YK_WORLD.mapData.cornerProtected.has(x+','+y),
      sprite:window.YK_WORLD.mapData.decorations.some(o=>o.kind===kind&&o.contactTiles.some(c=>c[0]===x&&c[1]===y))
    })),
    regionCoverage:(()=>{const m=window.YK_WORLD.mapData;const count=(xl,yl,xh,yh)=>{let total=0;for(let y=yl;y<=yh;y++)for(let x=xl;x<=xh;x++)if(m.heights[y][x]>0&&m.travelReachable.has(x+','+y))total++;return total;};return {east:count(62,26,76,42),central:count(23,34,32,40)};})(),
    ramps:[[40,57],[37,54],[40,64],[40,61],[35,60],[39,59],[45,61],[42,59]].map(([x,y])=>window.YK_WORLD.mapData.ramps[y][x]),
    markers:window.__FIELD_EXPLORATION_MARKERS||null,
    allRoutes:Object.fromEntries(Object.entries({
      south:[[40,65],[40,64],[40,63],[40,62],[40,61],[40,60],[40,59]],
      west:[[34,60],[35,60],[36,60],[37,60],[38,60],[38,59],[39,59],[40,59]],
      east:[[46,61],[45,61],[44,61],[43,61],[43,60],[43,59],[42,59],[41,59],[40,59]],
      north:[[40,59],[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53]]
    }).map(([name,route])=>[name,route.every((p,i,cells)=>{
      if(!i)return true;const center=([x,y])=>[x*32+16,y*32+16];
      return window.YK_WORLD.canMove(...center(cells[i-1]),...center(p))&&window.YK_WORLD.canMove(...center(p),...center(cells[i-1]));
    })])),
    localLadders:window.YK_WORLD.mapData.ladders.filter(l=>l.lower[0]>=34&&l.lower[0]<=46&&l.lower[1]>=53&&l.lower[1]<=64).length,


    routeCanMove:[[40,65],[40,64],[40,63],[40,62],[40,61],[40,60],[40,59],[40,58]].every((c,i,path)=>{
      if(!i)return true;
      const pos=([x,y])=>[x*32+16,y*32+16];
      return window.YK_WORLD.canMove(...pos(path[i-1]),...pos(c))&&window.YK_WORLD.canMove(...pos(c),...pos(path[i-1]));
    }),
    base:document.baseURI, url:location.href
  }));
  assert.equal(info.qa.source,'production','review scene must reference the live game');
  assert.equal(info.qa.tileSize,32);assert.equal(info.qa.phase,'production-waterfall-basin');
  assert.equal(info.cornerWalk.cutWidth,28,'small diagonal clipping must not consume walkable tile centers');
  assert.equal(info.cornerWalk.originalPassable,true,'Hizuki remains on valid highland');
  assert.equal(info.cornerWalk.exits.west.canMove,true,'forest tile west of Hizuki must remain traversable');
  assert.equal(info.cornerWalk.exits.south.canMove,true,'forest tile south of Hizuki must remain traversable');
  assert.equal(info.cornerWalk.exits.north.canMove,true,'existing path northward stays open');
  assert.equal(info.cornerWalk.exits.east.canMove,false,'real two-level cliff remains impassable');
  assert.equal(info.cornerWalk.exits.west.cut,1,'west diagonal cliff polygon still exists');
  assert.equal(info.cornerWalk.exits.south.cut,1,'south diagonal cliff polygon still exists');
  assert.ok(Object.values(info.cornerWalk.exits).every(o=>!o.hasVisibleTreeCollider),
    'ordinary forest trees cannot leave a solid collision around Hirozuki');
  assert.equal(info.anchoredTrees.mode,'terrain');
  assert.ok(info.anchoredTrees.inset<=25,'remaining mountain-cover trees may need anchored roots');
  assert.ok(info.anchoredTrees.ramps<=7,'remaining slope trees still use sampled terrain heights');
  assert.ok(info.scenery?.bevelTiles>=5,'the filter detects actual diagonal cliff cells');
  assert.ok(info.scenery.removed.length>=8,'forest trees are removed around diagonal cliffs');
  assert.ok(info.scenery.byKind.newTrees>0,'trees adjacent to diagonal cliffs are thinned');
  assert.equal(info.scenery.remainingForestAtBevel,0,'no original forest tree remains within one tile of a bevel');
  assert.ok(info.scenery.preservedMountainScenery>=90,'solid mountains retain visible sprites');
  assert.ok(info.collisionConsistency.restoredMountainAnchors.every(o=>
    o.terrain==='mountain'?o.visible:!o.visible),
    'mountain material must retain a sprite; water/grass converted from mountains must not');
  assert.deepEqual(info.collisionConsistency.stale,[],'removed sprites must not retain collision-only occupied cells');
  assert.deepEqual(info.collisionConsistency.missing,[],'every live object footprint must be in collision map');
  assert.ok(info.collisionConsistency.retiredCount>=8,'check actual removed tree footholds');
  assert.ok(info.scenery.removed.every(o=>o.kind==='newTrees'),
    'do not delete mountain or mountain-derived stand-in scenery');
  assert.equal(info.anchoredTrees.misplaced,0,'no tree root disagrees with its projected terrain height');
  assert.ok(info.anchoredTrees.reachable>=2403,'thinning must not shrink the traversable field');
  assert.ok(info.regionCoverage.east>=125&&info.regionCoverage.central>=45,'restored plateaus are traversable');
  assert.ok(info.cliffObjects.every(o=>o.cuts>0&&!o.protected),
    'diagonal cliff shapes survive even where mountain sprites are restored');
  assert.equal(info.waterfallBasin.retired.length,16,'only verified waterfall mountain cells are cleaned');
  assert.equal(info.mountainThinning.sourceCount,168,'keep mountain sprites everywhere except the waterfall corridor');
  assert.equal(info.mountainThinning.runtimeCount,
    info.mountainThinning.sourceCount-71,
    'only waterfall-adjacent mountains change; all unrelated runtime scenery is retained');
  assert.ok(info.mountainThinning.removed.every(o=>
    o.terrain==='mountain'?o.stillPresent&&!o.walkable:!o.stillPresent),
    'solid mountain ground stays visible, while water and grass have no phantom mountain');
  assert.ok(info.mountainThinning.remainingAnchors,'mountain range remains legible');
  assert.ok(info.waterfallBasin.wet.every(o=>o.river&&o.blocked),
    'waterfall foot and downstream must share animated river surface with water collision');
  assert.ok(info.waterfallBasin.retired.every(o=>o.noMountain&&o.unoccupied),
    'replaced mountain sprites cannot leave invisible collisions or floating mountains');
  assert.ok(info.waterfallBasin.approach&&info.waterfallBasin.reachable&&
    info.waterfallBasin.ladder&&info.waterfallBasin.downstream,
    'entry staircase and streaming river remain connected after basin reshape');

  assert.equal(info.height,2);assert.equal(info.flowers,34);assert.equal(info.nav,14);assert.deepEqual(info.ramps,['s','s','n','n','e','e','w','w']);
  assert.equal(info.localLadders,0,'overlook uses ramps, not ladder sprites');
  assert.deepEqual(info.markers?.cells,[[40,58],[37,55]]);
  assert.equal(info.markers?.tileSize,32);
  assert.equal(info.markers?.style,'grass-worn-soil-dither');
  assert.equal(info.markers?.source,'approved-road-and-grass');
  assert.ok(info.markers?.changed.every(n=>n>100&&n<900),'single-cell non-square footpath masks');
  assert.ok(Object.values(info.allRoutes).every(Boolean),'every direction supports two-way movement');
  assert.equal(info.routeCanMove,true,'full uphill and downhill route');

  // Tree/diagonal-cliff inspection cells may be occupied. Assert the intended
  // camera neighborhood is inspected instead of accepting the village fallback.
  const target=({meadow:[27,59],approach:[40,65],west:[34,60],east:[46,61],lookout:[40,59],rear:[40,58],eastHighland:[63,34],centralHighland:[24,38],northRidge:[68,26],forestCliff:[39,32],mountainCliff:[54,22],treeEdgeEast:[60,29],treeEdgeCenter:[30,39],waterfall:[66,20]})[start];
  assert.deepEqual(info.reviewSpawn?.requested,target,'the named location remains the camera review target');
  assert.deepEqual(info.pos,info.reviewSpawn?.resolved,'hero starts at the verified playable inspection cell');
  assert.ok(info.reviewSpawn.displacement<=8,'review spawn must stay near the named tree, not at the village');
  if(!start.startsWith('treeEdge'))assert.equal(info.reviewSpawn.displacement,0,'established walkthrough spawn stays unchanged');
  assert.equal(errors.length,0,errors.join('\n'));
  if(start==='waterfall')await page.screenshot({path:'artifacts/field-authored-waterfall-tiles.png'});
  if(start==='approach'){
    await page.screenshot({path:'artifacts/field-exploration-pages-before-climb.png'});
    for(let i=1;i<=7;i++){
      await page.keyboard.press('ArrowUp',{delay:35});
      await page.waitForFunction(y=>Number(document.querySelector('#scene').dataset.y)===y,65-i,{timeout:3000});
      await page.waitForTimeout(30);
    }
    assert.equal(await page.locator('#scene').getAttribute('data-y'),'58','actual uphill traversal');
    await page.screenshot({path:'artifacts/field-exploration-pages-after-climb.png'});
    for(let i=1;i<=7;i++){
      await page.keyboard.press('ArrowDown',{delay:35});
      await page.waitForFunction(y=>Number(document.querySelector('#scene').dataset.y)===y,58+i,{timeout:3000});
      await page.waitForTimeout(30);
    }
    assert.equal(await page.locator('#scene').getAttribute('data-y'),'65','actual downhill traversal');
    await page.screenshot({path:'artifacts/field-exploration-pages-after-descent.png'});
  }
  if(start==='west'||start==='east'){
    const route=start==='west'?
      [[34,60],[35,60],[36,60],[37,60],[38,60],[38,59],[39,59],[40,59]]:
      [[46,61],[45,61],[44,61],[43,61],[43,60],[43,59],[42,59],[41,59],[40,59]];
    const walk=async (from,to)=>{
      const dx=to[0]-from[0],dy=to[1]-from[1];
      const key=dx===1?'ArrowRight':dx===-1?'ArrowLeft':dy===1?'ArrowDown':'ArrowUp';
      await page.keyboard.press(key,{delay:35});
      await page.waitForFunction(([x,y])=>{
        const s=document.querySelector('#scene');
        return Number(s.dataset.x)===x&&Number(s.dataset.y)===y;
      },to,{timeout:4000});
      await page.waitForTimeout(25);
    };
    for(let i=1;i<route.length;i++)await walk(route[i-1],route[i]);
    await page.screenshot({path:'artifacts/field-exploration-'+start+'-on-summit.png'});
    for(let i=route.length-1;i>0;i--)await walk(route[i],route[i-1]);
    assert.deepEqual(await page.evaluate(()=>[Number(document.querySelector('#scene').dataset.x),Number(document.querySelector('#scene').dataset.y)]),route[0],start+' return route');
  }
  if(start==='rear'){
    const route=[[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53],[36,53],[36,54],[36,55]];
    const go=async (from,to)=>{
      const dx=to[0]-from[0],dy=to[1]-from[1];
      const key=dx===1?'ArrowRight':dx===-1?'ArrowLeft':dy===1?'ArrowDown':dy===-1?'ArrowUp':null;
      assert.ok(key,'rear route uses orthogonal steps');
      await page.keyboard.press(key,{delay:35});
      try{
        await page.waitForFunction(([x,y])=>{
          const scene=document.querySelector('#scene');
          return Number(scene?.dataset.x)===x&&Number(scene?.dataset.y)===y;
        },to,{timeout:4000});
      }catch(error){
        const state=await page.evaluate(()=>{
          const scene=document.querySelector('#scene');
          return {x:scene?.dataset.x,y:scene?.dataset.y,paused:window.__FIELD_RENDER_PAUSED,
            preview:window.__FIELD_EXPLORATION_PREVIEW,
            blocked:window.YK_WORLD?.canMove(40*32+16,58*32+16,40*32+16,57*32+16)};
        });
        console.error('REAR MOVE FAILED '+JSON.stringify({from,to,key,state}));
        await page.screenshot({path:'artifacts/field-exploration-rear-failure.png'});
        throw error;
      }
      console.log('REAR MOVE OK '+JSON.stringify({from,to,key}));
      await page.waitForTimeout(30);
    };
    for(let i=1;i<route.length;i++)await go(route[i-1],route[i]);
    await page.screenshot({path:'artifacts/field-exploration-rear-after-descent.png'});
    for(let i=route.length-1;i>0;i--)await go(route[i],route[i-1]);
    assert.deepEqual(await page.evaluate(()=>[Number(document.querySelector('#scene').dataset.x),Number(document.querySelector('#scene').dataset.y)]),route[0],'rear two-ramp ascent returns to summit');
  }
  await page.screenshot({path:'artifacts/field-exploration-pages-'+start+'.png'});
  console.log(start,JSON.stringify(info));
  await page.close();

 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
