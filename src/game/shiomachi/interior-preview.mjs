import {rooms,prepareInterior} from '../interiors/rooms.mjs';
import {paintRoom,paintPartition,paintContactShadow} from '../interiors/room-art.mjs';
import {drawFurnitureLife} from '../interiors/life-effects.mjs';
import {drawCharacter,residentInFront} from '../village/residents.mjs';
import {makeWalk,hizukiWalkDistance} from '../village/movement.mjs?v=shared-walk-1';
import {normalizePlayer,DEFAULT_PLAYER} from '../battle/rules.mjs?v=equipment-4slots-2-cove-shells-1-shiomachi-gear-1-cave-quest-1-finds-1-guardian-1';
import {SHIOMACHI_ARMORY_STOCK} from '../../../data/maps/shiomachi-village/armory.mjs?v=shiomachi-gear-1';

import {createVillageShop} from '../interiors/shop.mjs?v=shared-shops-1-cave-quest-1-finds-1-guardian-1';

export function createShiomachiInteriorPreview({ctx,images,viewport,clearInput,shopPanel,previewMode=true}){
 const furniture=images.furniture;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let site=null,room=null,plan=null,walking=null,floor=null,hero=null;
 let lastRoom=null;
 let trial=normalizePlayer({...DEFAULT_PLAYER,gold:250,hp:7,mp:3,shells:{bag:{white:1}}});
 const shop=createVillageShop({...shopPanel,clearInput,armoryStock:SHIOMACHI_ARMORY_STOCK,
   trial:{all:previewMode,read:()=>trial,save:player=>{trial=player;}}});
 function setRoom(nextSite){
   if(!nextSite||!Object.hasOwn(rooms,nextSite.room))return false;
   shop.close();
   site=nextSite;
   room=rooms[site.room];
   plan=prepareInterior(room);
   if(plan.resident.counter)plan.resident.name=site.name+'の店番';
   plan.resident.bitmap=images[plan.resident.asset];
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
   shop.close();
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
   if(!site||shop.active)return null;
   hero.moving=false;
   if(dir){
     const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
     const [dx,dy,face]=directions[dir];
     hero.face=face;
     const step=hizukiWalkDistance(dt);
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
   enter:setRoom,leave,advance,draw,resident,
   openShop:()=>Boolean(site)&&shop.open(site.room,site.name),
   closeShop:shop.close,confirmShop:shop.confirm,choose:shop.choose,
   get active(){return Boolean(site);},get shopActive(){return shop.active;},
   get site(){return site;},get plan(){return plan;},get actor(){return hero;},
   get roomName(){return lastRoom;},get currentRoom(){return site?.room??null;},
   get trial(){return trial;},position,
   updateDialogue(dialogue){
     if(!site)return;
     dialogue.update(residentInFront(hero.x,hero.y,hero.face,[plan.resident]),hero.x,hero.y);
   }
 };
}
