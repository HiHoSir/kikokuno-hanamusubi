import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drawFindHint,shouldShowFindHint,FIND_HINT_RADIUS} from '../src/game/village/find-indicator.mjs';
import {VILLAGE_FINDS} from '../data/maps/hozuki-village/finds.mjs';

test('nearby uncollected finds show a question mark; obtained or distant finds do not',()=>{
  const find={id:'hozuki-bridge-shrub',x:100,y:200};
  assert.ok(shouldShowFindHint({x:100,y:200},find,new Set()));
  assert.ok(shouldShowFindHint({x:100+FIND_HINT_RADIUS,y:200},find,new Set()));
  assert.equal(shouldShowFindHint({x:100+FIND_HINT_RADIUS+1,y:200},find,new Set()),false);
  assert.equal(shouldShowFindHint({x:100,y:200},find,new Set([find.id])),false);
  assert.equal(shouldShowFindHint({x:100,y:200},null,new Set()),false);
});

test('question mark can be painted without changing map art or context state',()=>{
  const calls=[];
  const context=new Proxy({save(){calls.push('save')},restore(){calls.push('restore')},fillRect(){calls.push('rect')},fillText(s){calls.push(s)}},{set(obj,k,v){obj[k]=v;return true}});
  drawFindHint(context,90,70,0);
  assert.deepEqual(calls.filter(x=>x==='?'),['?']);
  assert.equal(calls[0],'save');
  assert.equal(calls.at(-1),'restore');
});

test('all five authored finds remain wired to the real village and interiors',()=>{
  assert.equal(Object.keys(VILLAGE_FINDS).length,5);
  assert.equal(Object.values(VILLAGE_FINDS).filter(find=>find.sprite).length,2);
  assert.equal(Object.values(VILLAGE_FINDS).filter(find=>find.building).length,3);
  for(const path of ['src/game/village/walk.mjs','src/game/interiors/walk.mjs']){
    const source=readFileSync(path,'utf8');
    assert.match(source,/shouldShowFindHint/);
    assert.match(source,/drawFindHint/);
    assert.match(source,/collectedFinds\.add/);
  }
});
