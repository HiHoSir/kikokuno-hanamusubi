// Shiomachi review interiors reuse the canonical village room geometry/art.
// Everything here is volatile preview state: no storage, saves or field routes.
import {rooms,prepareInterior} from '../interiors/rooms.mjs';
import {paintRoom,paintPartition,paintContactShadow} from '../interiors/room-art.mjs';
import {drawFurnitureLife} from '../interiors/life-effects.mjs';
import {drawCharacter,residentInFront} from '../village/residents.mjs';
import {makeWalk,HIZUKI_INTERIOR_WALK_SPEED} from '../village/movement.mjs';
import {normalizePlayer,DEFAULT_PLAYER,FOOD_ITEMS,purchaseFood} from '../battle/rules.mjs';
import {SHIOMACHI_ARMORY_STOCK,purchaseShiomachiArmory} from '../../../data/maps/shiomachi-village/armory.mjs';

export const SHIOMACHI_INN_PRICE=20; // preview-only proposed price, not game economy canon
export function previewInnStay(hero,price=SHIOMACHI_INN_PRICE){
 const player=normalizePlayer(hero);
 if(player.gold<price)return {accepted:false,player,message:'両が足りません。'};
 const next=normalizePlayer({...player,gold:player.gold-price,
   hp:player.maxhp,mp:player.maxmp});
 return {accepted:true,player:next,message:'ごゆっくり。体力と術力が回復しました。'};
}

export function createShiomachiInteriorPreview({ctx,images,viewport,clearInput,shopPanel}){
 const furniture=images.furniture;
 const {title,wallet,options,message}=shopPanel;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let site=null,room=null,plan=null,walking=null,floor=null,hero=null;
 let lastRoom=null,shopActive=false,selected=0;
 // An illustrative ten-win (8 ryo each) QA wallet, NOT a claim that ten
 // encounters occur between the villages. No save data is read or written.
 // This budget must exercise one coastal weapon, a stay and food in one run.
 let trial=normalizePlayer({...DEFAULT_PLAYER,gold:80,hp:7,mp:3});
 let ownedShiomachi={}; // Preview-only inventory; never persisted or added to the original catalog.
 function shopEntries(){
   if(!site)return [];
   if(site.room==='inn')return [
     {id:'sleep',label:'一泊する　'+SHIOMACHI_INN_PRICE+'両（体力・術力を回復）'},
     {id:'exit',label:'もどる'}];
   if(site.room==='armory')return [
     ...SHIOMACHI_ARMORY_STOCK.map(item=>({id:item.id,
       label:item.name+'　'+item.price+'両（'+(item.attack?'攻撃+':'守備+')+(item.attack||item.defense)+'）'})),
     {id:'exit',label:'もどる'}];
   if(site.room==='teahouse')return [
     ...Object.values(FOOD_ITEMS).map(item=>({id:item.id,
       label:item.name+'　'+item.price+'両（体力+'+item.heal+'）'})),
     {id:'exit',label:'もどる'}];
   return [];
 }
 function refreshShop(){
   wallet.textContent='試用所持金 '+trial.gold+'両　体力 '+trial.hp+'/'+trial.maxhp+
     '　術力 '+trial.mp+'/'+trial.maxmp;
   options.replaceChildren();
   for(const [i,entry] of shopEntries().entries()){
     const btn=document.createElement('button');
     btn.type='button';
     btn.dataset.shopItem=entry.id;
     btn.textContent=entry.label;
     if(entry.id in trial.foods)btn.textContent+='　所持'+trial.foods[entry.id];
     if(trial.equipmentInventory?.[entry.id]||ownedShiomachi[entry.id])btn.textContent+='　購入済';
     btn.classList.toggle('selected',selected===i);
     btn.addEventListener('click',()=>{
       selected=i;
       confirmShop();
     });
     options.append(btn);
   }
 }
 function closeShop(){
   shopActive=false;
   shopPanel.panel.hidden=true;
   clearInput();
 }
 function openShop(){
   if(!site||!['inn','armory','teahouse'].includes(site.room))return false;
   shopActive=true;selected=0;clearInput();
   title.textContent=site.name+'（試用・セーブには反映しません）';
   message.textContent='何をいたしましょう？';
   shopPanel.panel.hidden=false;
   refreshShop();
   return true;
 }
 function confirmShop(){
   if(!shopActive)return false;
   const picked=shopEntries()[selected];
   if(!picked)return false;
   if(picked.id==='exit'){closeShop();return true;}
   const result=picked.id==='sleep'?previewInnStay(trial)
     :site.room==='armory'?purchaseShiomachiArmory(trial,ownedShiomachi,picked.id)
       :purchaseFood(trial,picked.id);
   if(result.accepted){
     trial=result.player;
     if(result.owned)ownedShiomachi=result.owned;
   }
   message.textContent=result.message;
   refreshShop();
   return result.accepted;
 }
 function choose(direction){
   if(!shopActive)return;
   const entries=shopEntries();
   selected=(selected+(direction==='up'||direction==='left'?-1:1)+entries.length)%entries.length;
   refreshShop();
 }
 function setRoom(nextSite){
   if(!nextSite||!Object.hasOwn(rooms,nextSite.room))return false;
   closeShop();
   site=nextSite;
   room=rooms[site.room];
   plan=prepareInterior(room);
   plan.resident.bitmap=images[plan.resident.asset==='elder'?'elder':'clerk'];
   walking=makeWalk(room.width,room.height,plan.blocked,8);
   hero={x:plan.spawn[0],y:plan.spawn[1],face:1,distance:0,moving:false};
   if(!walking.canStand(hero.x,hero.y))
     throw Error('室内の開始位置に立てません: '+site.room);
   floor=document.createElement('canvas');
   floor.width=room.width;floor.height=room.height;
   const fctx=floor.getContext('2d');
   fctx.imageSmoothingEnabled=false;
   paintRoom(fctx,room);
   for(const item of plan.depthSorted)if(item.footprint)paintContactShadow(fctx,item.footprint);
   lastRoom=room.name;
   return true;
 }
 function leave(){
   const last=site;
   site=null;room=null;plan=null;walking=null;floor=null;hero=null;
   closeShop();
   return last;
 }
 const camera=(position,visible,size)=>visible>=size?(size-visible)/2:
   Math.max(0,Math.min(size-visible,position-visible/2));
 function draw(now,debug=false){
   if(!site)return;
   const {step,bufferWidth,bufferHeight}=viewport;
   const viewW=bufferWidth/step,viewH=bufferHeight/step;
   ctx.setTransform(1,0,0,1,0,0);
   ctx.imageSmoothingEnabled=false;
   ctx.fillStyle='#191714';
   ctx.fillRect(0,0,bufferWidth,bufferHeight);
   const left=camera(hero.x,viewW,room.width),top=camera(hero.y,viewH,room.height);
   ctx.setTransform(step,0,0,step,-Math.floor(left)*step,-Math.floor(top)*step);
   ctx.drawImage(floor,0,0);
   const drawHero=()=>drawCharacter(ctx,{...hero,bitmap:images.hero});
   let drew=false;
   for(const obj of plan.depthSorted){
     if(!drew&&obj.depth>hero.y){drawHero();drew=true;}
     if(obj===plan.resident){
       drawCharacter(ctx,obj);
     }else if(obj.sprite){
       const [,,w,h]=obj.sprite;
       ctx.drawImage(furniture,...obj.sprite,obj.x,obj.y,w,h);
       drawFurnitureLife(ctx,obj,now,reduce.matches);
     }else{
       paintPartition(ctx,obj.x,obj.y,obj.w);
     }
   }
   if(!drew)drawHero();
   if(debug){
     ctx.strokeStyle='#ec85ad';ctx.lineWidth=3;
     for(const o of plan.depthSorted){
       if(!o.footprint)continue;
       ctx.strokeRect(...o.footprint);
     }
     ctx.strokeStyle='#78e9d0';
     ctx.strokeRect(plan.doorway-36,room.height-32,72,32);
   }
 }
 function advance(dt,dir){
   if(!site||shopActive)return null;
   hero.moving=false;
   if(dir){
     const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
     const [dx,dy,face]=directions[dir];
     hero.face=face;
     const step=HIZUKI_INTERIOR_WALK_SPEED*dt/1000;
     const [nx,ny]=walking.move(hero.x,hero.y,dx*step,dy*step);
     hero.distance+=Math.hypot(nx-hero.x,ny-hero.y);
     hero.moving=Math.abs(nx-hero.x)+Math.abs(ny-hero.y)>0.01;
     hero.x=nx;hero.y=ny;
     if(dir==='down'&&hero.y>=plan.exitY)return leave();
   }
   return null;
 }
 const resident=()=>site?plan.resident:null;
 const position=()=>hero?{x:hero.x,y:hero.y,face:hero.face}:null;
 return {
   enter:setRoom,leave,advance,draw,openShop,closeShop,confirmShop,choose,resident,
   get active(){return Boolean(site);},get shopActive(){return shopActive;},
   get site(){return site;},get plan(){return plan;},get actor(){return hero;},
   get roomName(){return lastRoom;},get currentRoom(){return site?.room??null;},
   get trial(){return {...trial,shiomachiGear:{...ownedShiomachi}};},position,
   updateDialogue(dialogue){
     if(!site)return;
     dialogue.update(residentInFront(hero.x,hero.y,hero.face,[plan.resident]),hero.x,hero.y);
   }
 };
}
