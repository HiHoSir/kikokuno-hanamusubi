// Canonical shell species and the deterministic random batch policy.
// Both the beach experiment and the production cove use one price table.
export const SHELL_KINDS=Object.freeze({
 sakura:Object.freeze({id:'sakura',name:'桜貝',value:12,weight:0.17}),
 spiral:Object.freeze({id:'spiral',name:'巻貝',value:7,weight:0.30}),
 white:Object.freeze({id:'white',name:'白貝',value:3,weight:0.53})
});
export const BATTLES_PER_SHELL_BATCH=5;
export const SHELL_BATCH_MIN=1;
export const SHELL_BATCH_MAX=3;
export const SHELL_CAP=12;
export const SHELL_PICKUP_DISTANCE=36;
export const emptyShellBag=()=>({sakura:0,spiral:0,white:0});
export const shellBagCount=bag=>Object.keys(SHELL_KINDS)
 .reduce((sum,k)=>sum+(Number.isSafeInteger(bag?.[k])&&bag[k]>0?bag[k]:0),0);
export const shellBagValue=bag=>Object.entries(SHELL_KINDS)
 .reduce((sum,[k,item])=>sum+
 (Number.isSafeInteger(bag?.[k])&&bag[k]>0?bag[k]:0)*item.value,0);
// A per-cycle pseudo-random roll, stable across reloads and save restoration.
export function shellCycleRandom(cycle){
 let state=(Math.imul(cycle,0x9e3779b1)^0xBEEFA416)>>>0;
 return ()=>{
  state=(state+0x6D2B79F5)>>>0;
  let t=Math.imul(state^(state>>>15),1|state);
  t^=t+Math.imul(t^(t>>>7),61|t);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
export const shellBatchCount=cycle=>{
 const roll=shellCycleRandom(cycle)();
 return SHELL_BATCH_MIN+Math.floor(roll*(SHELL_BATCH_MAX-SHELL_BATCH_MIN+1));
};
export const shellKindFromRoll=roll=>roll<.17?'sakura':roll<.47?'spiral':'white';
