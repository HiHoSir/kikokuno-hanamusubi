// Shortest 4-direction paths under the EXACT current field collision rules.
// Browser-only-world dependencies are passed in; no game map or save writes.
// Importable by both Node unit tests and Chromium inspection of production.
const DIRS=Object.freeze([[0,-1],[1,0],[0,1],[-1,0]]);
const center=(x,y,size)=>[x*size+size/2,y*size+size/2];
const valid=([x,y],width,height)=>Number.isInteger(x)&&Number.isInteger(y)&&
  x>=0&&y>=0&&x<width&&y<height;

export function traceFieldRoute({world,from,destination,contact,maxVisits}){
 if(!world||!Array.isArray(from)||typeof contact!=='function')
   throw Error('A loaded production world, start point and transition function are required');
 if(typeof destination!=='string'||!destination)throw Error('Missing real destination');
 const size=world.tileSize,width=Math.floor(world.size/size),height=width;
 const start=[Math.floor(from[0]/size),Math.floor(from[1]/size)];
 if(!valid(start,width,height))throw Error('Start outside authored field');
 const key=([x,y])=>y*width+x,byKey=k=>[k%width,Math.floor(k/width)];
 const isOpen=cell=>world.walkable(...center(...cell,size));
 if(!isOpen(start))return {destination,reachable:false,reason:'start-not-walkable',
   fromCell:start,visited:0,steps:null,path:[]};
 const startKey=key(start);
 const visited=new Uint8Array(width*height),previous=new Int32Array(width*height);
 previous.fill(-1);
 visited[startKey]=1;
 const queue=[startKey];
 const budget=maxVisits??width*height;
 let found=-1,index=0,blockedMoves=0;
 while(index<queue.length&&index<budget){
   const cur=queue[index++],cell=byKey(cur),point=center(...cell,size);
   const here=contact(...point);
   if(here===destination){found=cur;break;}
   // An actual transition would leave the field, so it must not act as a
   // shortcut to another destination (unless this is the starting cell).
   if(here&&cur!==startKey)continue;
   for(const [dx,dy] of DIRS){
     const next=[cell[0]+dx,cell[1]+dy];
     if(!valid(next,width,height))continue;
     const k=key(next);
     if(visited[k])continue;
     const endpoint=center(...next,size);
     if(!world.canMove(...point,...endpoint)){blockedMoves++;continue;}
     visited[k]=1;previous[k]=cur;
     queue.push(k);
   }
 }
 if(found<0)return {destination,reachable:false,
   reason:index>=budget?'visit-limit':'no-walkable-route',
   fromCell:start,visited:index,blockedMoves,steps:null,path:[]};
 const path=[];
 for(let k=found;k!==-1;k=previous[k])path.push(byKey(k));
 path.reverse();
 return {destination,reachable:true,fromCell:start,
   toCell:path.at(-1),steps:path.length-1,visited:index,
   blockedMoves,path};
}

export function replayMovementPath({path,fieldStep,tileSize=32}){
 if(!Array.isArray(path)||!path.length)return {success:false,reason:'empty-path'};
 if(typeof fieldStep!=='function')throw Error('Actual fieldStep implementation required');
 let state={x:path[0][0]*tileSize+tileSize/2,y:path[0][1]*tileSize+tileSize/2};
 for(let i=1;i<path.length;i++){
   const [x,y]=path[i-1],[nx,ny]=path[i],dx=nx-x,dy=ny-y;
   if(Math.abs(dx)+Math.abs(dy)!==1)return {success:false,at:i,reason:'non-cardinal-edge'};
   const result=fieldStep(state,dx,dy,0);
   const expected=[nx*tileSize+tileSize/2,ny*tileSize+tileSize/2];
   if(!result||result.x!==expected[0]||result.y!==expected[1])
     return {success:false,at:i,reason:'actual-fieldStep-blocked',
       from:[state.x,state.y],expected,actual:result?[result.x,result.y]:null};
   state={x:result.x,y:result.y};
 }
 return {success:true,steps:path.length-1,arrival:[state.x,state.y]};
}

export function battleIntervalEnvelope(steps,minInterval=9,maxInterval=13){
 if(!Number.isInteger(steps)||steps<0||minInterval<1||maxInterval<minInterval)
   throw Error('Invalid step count/encounter interval');
 // Only a rough, fixed-distance range: enemy rolls, repeated battle returns,
 // landmark exclusions, detours and scripted entrances change the real result.
 return {minimum:Math.floor(steps/maxInterval),
   maximum:Math.floor(steps/minInterval),assumes:'uninterrupted-moving-field-steps'};
}
