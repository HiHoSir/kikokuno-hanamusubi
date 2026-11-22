// PR gate for decisions that affect the game's previously recorded design.
// This tool verifies that a human-readable decision record accompanies changes.
// It CANNOT verify that the user really authorized the quote: the assistant and
// reviewer must verify that against the cited original conversation.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CHANGE_RECORD_PREFIX='docs/decisions/changes/';
const decisionFile=/^docs\/decisions\/changes\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/;
const protectedGroups=Object.freeze({
  balance:[
    /^data\/characters\/hizuki-status\.json$/,
    /^src\/game\/battle\/rules\.mjs$/,
    /^docs\/BATTLE_BALANCE\.md$/,
    /^docs\/BALANCE_PROGRESSION_CONTRACT\.md$/
  ],
  equipment:[
    /^data\/maps\/[^/]+\/armory\.mjs$/,
    /^src\/game\/shiomachi\/interior-preview\.mjs$/,
    /^docs\/FOUR_VILLAGES_EQUIPMENT_PLAN\.md$/
  ],
  progression:[
    /^data\/maps\/field\/terrain\.js$/,
    /^src\/field\/(?:world\.js|walk\.mjs)$/,
    /^docs\/MAP_ENEMY_EQUIPMENT_RECONCILIATION\.md$/
  ]
});
const gameplayPath=/^(?:data\/characters\/hizuki-status\.json|src\/game\/battle\/rules\.mjs|data\/maps\/[^/]+\/armory\.mjs|src\/game\/shiomachi\/interior-preview\.mjs|data\/maps\/field\/terrain\.js|src\/field\/(?:world\.js|walk\.mjs))$/;

export function impactedScopes(paths){
 return Object.keys(protectedGroups).filter(scope=>
   paths.some(path=>protectedGroups[scope].some(rule=>rule.test(path))));
}

function validNonempty(value){
 return typeof value==='string'&&value.trim().length>=12;
}
function presentList(value){
 return Array.isArray(value)&&value.length>0&&value.every(validNonempty);
}
export function validateDecisionRecord(record,requiredScopes,{hasGameplay=false}={}){
 const errors=[];
 if(!record||typeof record!=='object'||Array.isArray(record))
   return ['record must be a JSON object'];
 if(record.schemaVersion!==1)errors.push('schemaVersion must be 1');
 if(!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(record.id||''))
   errors.push('id must use YYYY-MM-DD-english-slug');
 if(!['user-approved','documentation-correction'].includes(record.kind))
   errors.push('kind must be user-approved or documentation-correction');
 if(!Array.isArray(record.scopes)||requiredScopes.some(s=>!record.scopes.includes(s)))
   errors.push('scopes must cover each affected design domain: '+requiredScopes.join(', '));
 for(const field of ['previousDesign','intendedDifference','impactAnalysis','preservedBoundaries','verification']){
   if(!validNonempty(record[field]))errors.push(field+' must explain the concrete change');
 }
 if(!presentList(record.readBeforeEditing))errors.push('readBeforeEditing must list checked design sources');
 if(!record.userEvidence||!validNonempty(record.userEvidence.source))
   errors.push('userEvidence.source must identify the original evidence');
 if(hasGameplay){
   if(record.kind!=='user-approved')
     errors.push('gameplay changes require kind=user-approved (no assistant-only prototype exception)');
   if(record.userEvidence?.status!=='explicit-user-instruction')
     errors.push('gameplay changes require explicit user instruction');
   if(!validNonempty(record.userEvidence?.quote))
     errors.push('gameplay changes require the actual user quotation, not an assistant assumption');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(record.userEvidence?.date||''))
     errors.push('gameplay changes require date of the user instruction');
 }
 if(!hasGameplay&&record.kind==='user-approved' &&
     (record.userEvidence?.status!=='explicit-user-instruction'||
      !validNonempty(record.userEvidence?.quote)))
   errors.push('user-approved must provide an explicit user quotation');
 return errors;
}

export function checkDesignChanges(changedFiles,readRecord){
 const scopes=impactedScopes(changedFiles);
 if(!scopes.length)return {scopes,errors:[]};
 const hasGameplay=changedFiles.some(path=>gameplayPath.test(path));
 const records=changedFiles.filter(path=>decisionFile.test(path));
 const errors=[];
 if(!records.length){
   errors.push('Protected design changed without a NEW OR UPDATED docs/decisions/changes/YYYY-MM-DD-*.json');
   return {scopes,errors};
 }
 let accepted=false;
 for(const path of records){
   try{
     const record=JSON.parse(readRecord(path));
     const failures=validateDecisionRecord(record,scopes,{hasGameplay});
     const id=path.slice(CHANGE_RECORD_PREFIX.length,-5);
     if(record.id!==id)failures.push('id must equal the filename');
     if(failures.length)errors.push(...failures.map(x=>path+': '+x));
     else accepted=true;
   }catch(error){errors.push(path+': cannot read/parse record: '+error.message)}
 }
 if(!accepted)errors.push('No decision record covers all affected scopes and authorization requirements');
 return {scopes,errors};
}

export function listChangedFiles(base){
 const output=execFileSync('git',['diff','--name-only','--diff-filter=ACMR',base,'HEAD'],
   {encoding:'utf8'});
 return output.trim()?output.trim().split('\n').filter(Boolean):[];
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=process.argv[2];
 if(!base){
   console.log('Design change gate: no comparison base (use only on PR); skipping diff verification.');
 }else{
   try{
     const paths=listChangedFiles(base);
     const result=checkDesignChanges(paths,path=>readFileSync(path,'utf8'));
     if(result.errors.length){
       console.error('DESIGN DECISION GATE FAILED\n'+result.errors.map(e=>' - '+e).join('\n'));
       console.error('See docs/decisions/README.md and AGENTS.md. Never fabricate user authorization.');
       process.exitCode=1;
     }else console.log('Design change gate passed ('+
       (result.scopes.join(', ')||'no design-impacting changes')+').');
   }catch(e){
     console.error('Design change gate cannot inspect PR diff:',e.message);
     process.exitCode=1;
   }
 }
}
