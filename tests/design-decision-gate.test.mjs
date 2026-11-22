import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  impactedScopes,validateDecisionRecord,checkDesignChanges
} from '../tools/guard-design-changes.mjs';

const record=(kind='user-approved',scopes=['balance','equipment'])=>({
  schemaVersion:1,id:'2026-11-22-consistent-source-review',kind,scopes,
  readBeforeEditing:[
    'docs/BALANCE_PROGRESSION_CONTRACT.md original values read',
    'docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md was also consulted'
  ],
  previousDesign:'Old approved T0–T6 bonuses and the existing village equipment catalog.',
  intendedDifference:'A user-requested item change whose exact before/after stats are documented.',
  impactAnalysis:'Map arrival level, enemy strength, save compatibility and required income are reviewed.',
  preservedBoundaries:'Existing approved tier curve, first village and already-approved art remain unchanged.',
  verification:'Run full unit tests plus area browser QA and validate persisted player equipment.',
  userEvidence:{
    status:kind==='user-approved'?'explicit-user-instruction':'documentation-only',
    date:'2026-11-22',
    quote:'The user directly asked for exactly these numbers in their original message.',
    source:'Original user message in the 2026-11-22 ChatGPT project conversation'
  }
});
const path='docs/decisions/changes/2026-11-22-consistent-source-review.json';
const evaluate=(files,doc)=>checkDesignChanges(files,p=>p===path?JSON.stringify(doc):'{}');

test('the change gate covers concrete battle, gear, field and original design documents',()=>{
  assert.deepEqual(impactedScopes(['data/characters/hizuki-status.json']),['balance']);
  assert.deepEqual(impactedScopes(['docs/BATTLE_BALANCE.md']),['balance']);
  assert.deepEqual(impactedScopes(['docs/BALANCE_PROGRESSION_CONTRACT.md']),['balance']);
  assert.deepEqual(impactedScopes(['data/maps/shiomachi-village/armory.mjs']),['equipment']);
  assert.deepEqual(impactedScopes(['src/game/shiomachi/interior-preview.mjs']),['equipment']);
  assert.deepEqual(impactedScopes(['docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md']),['equipment']);
  assert.deepEqual(impactedScopes(['src/field/walk.mjs']),['progression']);
  assert.deepEqual(impactedScopes(['src/field/world.js']),['progression']);
  assert.deepEqual(impactedScopes(['docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md']),['progression']);
  assert.deepEqual(impactedScopes(['data/maps/field/terrain.js']),['progression']);
  assert.deepEqual(impactedScopes(['assets/enemies/new-enemy.png','src/game/shiomachi/render.mjs']),[]);
});

test('PR guard refuses changes to prices without a contemporaneous decision record',()=>{
  const result=checkDesignChanges(['data/maps/shiomachi-village/armory.mjs'],()=>{throw Error('never called')});
  assert.deepEqual(result.scopes,['equipment']);
  assert.match(result.errors[0],/without a NEW OR UPDATED/);
});

test('PR guard refuses rewriting the approved tier table with no recorded authority',()=>{
  const result=checkDesignChanges(['data/characters/hizuki-status.json','src/game/battle/rules.mjs'],()=>{throw Error('never called')});
  assert.deepEqual(result.scopes,['balance']);
  assert.ok(result.errors.length);
});

test('PR guard also catches misleading design-document-only changes',()=>{
  assert.ok(checkDesignChanges(['docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md'],()=>'{ }').errors.length);
  assert.deepEqual(evaluate(['docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md',path],
    record('documentation-correction',['equipment'])).errors,[]);
});

test('records must be changed in the same PR, not merely present elsewhere',()=>{
  const result=checkDesignChanges(['src/field/world.js'],()=>JSON.stringify(record()));
  assert.ok(result.errors.length,'a pre-existing record cannot authorize a new PR automatically');
});

test('assistant-only prototypes cannot authorize changes to gameplay or a preview catalog',()=>{
  const files=['data/maps/shiomachi-village/armory.mjs',path];
  const proposed=record('documentation-correction',['equipment']);
  assert.match(evaluate(files,proposed).errors.join(' '),/require kind=user-approved/);
  const unquoted=record('user-approved',['equipment']);
  unquoted.userEvidence.status='assistant-suggestion';
  unquoted.userEvidence.quote='';
  assert.match(evaluate(files,unquoted).errors.join(' '),/explicit user instruction/);
  assert.match(evaluate(files,unquoted).errors.join(' '),/actual user quotation/);
});

test('a proposed change cannot disguise a gameplay change by covering docs only',()=>{
  const files=['docs/BATTLE_BALANCE.md','src/game/battle/rules.mjs',path];
  assert.match(evaluate(files,record('documentation-correction',['balance'])).errors.join(' '),
    /require kind=user-approved/);
});

test('decision record scope and required impact fields cannot be omitted',()=>{
  const files=['src/game/battle/rules.mjs','data/maps/shiomachi-village/armory.mjs',path];
  const good=record('user-approved',['balance','equipment']);
  assert.deepEqual(evaluate(files,good).errors,[]);
  const notCovered=record('user-approved',['balance']);
  assert.match(evaluate(files,notCovered).errors.join(' '),/must cover/);
  const vague=record('user-approved',['balance','equipment']);
  vague.impactAnalysis='none';
  assert.match(evaluate(files,vague).errors.join(' '),/impactAnalysis/);
});

test('record file id, schema and corrupt JSON fail closed; cosmetic-only changes pass',()=>{
  assert.deepEqual(checkDesignChanges(['src/game/shiomachi/render.mjs'],()=>{throw Error('irrelevant')}).errors,[]);
  const wrong=record('user-approved',['balance']);
  wrong.id='2026-11-22-unrelated';
  assert.match(evaluate(['src/game/battle/rules.mjs',path],wrong).errors.join(' '),/equal the filename/);
  wrong.schemaVersion=2;
  assert.match(validateDecisionRecord(wrong,['balance'],{hasGameplay:true}).join(' '),/schemaVersion/);
  assert.match(checkDesignChanges(['src/game/battle/rules.mjs',path],()=>'{ bad json').errors.join(' '),/cannot read\/parse/);
});

test('the source documents explain this incident and manual verification limits',()=>{
  const agents=readFileSync('AGENTS.md','utf8');
  const incident=readFileSync('docs/incidents/2026-11-22-design-override.md','utf8');
  const policy=readFileSync('docs/decisions/README.md','utf8');
  const workflow=readFileSync('.github/workflows/repository-guard.yml','utf8');
  assert.match(agents,/docs\/decisions\/changes/);
  assert.match(agents,/続けて/);
  assert.match(incident,/PR #64/);
  assert.match(incident,/PR #71/);
  assert.match(incident,/記録/);
  assert.match(policy,/cannot independently verify|cannot verify|It CANNOT|cannot verify/i);
  assert.match(workflow,/guard-design-changes\.mjs/);
  assert.match(workflow,/fetch-depth: 0/);
});
