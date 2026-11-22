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
const requiredSources=Object.freeze({
 balance:['data/characters/hizuki-status.json','docs/BALANCE_PROGRESSION_CONTRACT.md','docs/BATTLE_BALANCE.md'],
 equipment:['docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md','src/game/battle/rules.mjs','docs/BALANCE_PROGRESSION_CONTRACT.md'],
 progression:['docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md','data/maps/field/terrain.js']
});

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
export function validateDecisionRecord(record,requiredScopes,{hasGameplay=false,protectedFiles=[]}={}){
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
 else for(const scope of requiredScopes){
   if(!record.readBeforeEditing.some(entry=>
     requiredSources[scope]?.some(file=>entry.includes(file))))
     errors.push('readBeforeEditing must cite a relevant original source for '+scope);
 }
 if(!Array.isArray(record.affectedFiles)||!record.affectedFiles.length||
    !record.affectedFiles.every(path=>typeof path==='string'&&path.length>0))
   errors.push('affectedFiles must list the exact protected paths in this PR');
 else for(const path of protectedFiles){
   if(!record.affectedFiles.includes(path))
     errors.push('affectedFiles does not cover changed protected path: '+path);
 }
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
 const protectedFiles=[...new Set(changedFiles.filter(path=>
   Object.values(protectedGroups).some(rules=>rules.some(re=>re.test(path)))))];
 const hasGameplay=protectedFiles.some(path=>gameplayPath.test(path));
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
     const failures=validateDecisionRecord(record,scopes,{hasGameplay,protectedFiles});
     const id=path.slice(CHANGE_RECORD_PREFIX.length,-5);
     if(record.id!==id)failures.push('id must equal the filename');
     if(failures.length)errors.push(...failures.map(x=>path+': '+x));
     else accepted=true;
   }catch(error){errors.push(path+': cannot read/parse record: '+error.message)}
 }
 if(!accepted)errors.push('No decision record covers all affected scopes and authorization requirements');
 return {scopes,errors};
}

// Git's -z form puts the status, original path, and (for copies/renames)
// destination path in separate NUL-delimited fields. Include BOTH rename
// endpoints and DELETIONS; an old design source disappearing is still a change.
export function parseGitNameStatus(output){
 if(!output)return [];
 const parts=output.split('\0'),paths=[];
 for(let i=0;i<parts.length;){
   const status=parts[i++];
   if(!status)continue;
   if(!/^[ACDMRTUXB][0-9]*$/.test(status))
     throw Error('Unexpected git diff status: '+status);
   const oldPath=parts[i++];
   if(!oldPath)throw Error('Missing path for git diff status '+status);
   paths.push(oldPath);
   if(/^[RC]/.test(status)){
     const destination=parts[i++];
     if(!destination)throw Error('Missing destination for rename/copy '+oldPath);
     paths.push(destination);
   }
 }
 return [...new Set(paths)];
}

export function listChangedFiles(base){
 if(typeof base!=='string'||!base.trim())throw Error('Missing PR merge-base SHA');
 const output=execFileSync('git',['diff','--name-status','-z',base,'HEAD'],
   {encoding:'utf8'});
 return parseGitNameStatus(output);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=process.argv[2];
 if(!base){
   console.error('Design change gate requires a PR base SHA; refusing to report success without a diff.');
   process.exitCode=1;
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
