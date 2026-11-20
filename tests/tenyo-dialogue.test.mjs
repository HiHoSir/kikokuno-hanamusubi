import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindDialogue} from '../src/game/village/dialogue.mjs';
import {CHAPTER_ONE_STAGES} from '../src/game/story/chapter-one.mjs';

const map=JSON.parse(readFileSync('data/maps/tenyo-sanctuary/scene.json','utf8'));
const [white,west,east]=map.game.residents;
const spoken=/^([^「」]{1,12})「([\s\S]+)」$/;

test('Shirotae has complete conversations for every existing chapter-one stage',()=>{
 assert.equal(white.id,'shirotae');
 assert.deepEqual(Object.keys(white.dialogue),CHAPTER_ONE_STAGES);
 for(const stage of CHAPTER_ONE_STAGES){
  const lines=white.dialogue[stage];
  assert.ok(Array.isArray(lines)&&lines.length>=2,stage+' must not open an empty dialogue');
  for(const line of lines){
   const speaker=spoken.exec(line);
   assert.ok(speaker,stage+' must have a proper voice label: '+line);
   assert.ok(['白妙','緋月'].includes(speaker[1]),stage+' unexpected speaker');
   assert.ok(speaker[2].trim().length>0,stage+' blank line');
  }
 }
 assert.match(white.dialogue.chief.join(''),/里長.*札/);
 assert.match(white.dialogue.shrine.join(''),/里長.*結び札/);
 assert.match(white.dialogue.shrine.join(''),/潮平/);
 assert.match(white.dialogue.cove.join(''),/海の入り江/);
 assert.match(white.dialogue.forest.join(''),/潮平/);
 assert.match(white.dialogue.forest.join(''),/忘れの森/);
});

test('guardian guidance matches the actual sanctuary geometry and does not ban shallow water',()=>{
 assert.deepEqual([west.id,east.id],['guardian-west','guardian-east']);
 assert.deepEqual(white.tile,[12,8]);
 assert.deepEqual([west.tile,east.tile],[[13,7],[14,7]]);
 for(const npc of [west,east]){
  assert.ok(npc.lines.length>=2,'guard should not repeat a misleading single line');
  assert.ok(npc.lines.every(line=>spoken.test(line)&&line.startsWith('社守「')));
 }
 assert.match(west.lines.join(''),/門の手前.*南側/);
 assert.match(east.lines.join(''),/左右の浅瀬は歩けます/);
 assert.match(east.lines.join(''),/深く/);
 assert.doesNotMatch(west.lines.join('')+east.lines.join(''),/水辺と森には足を踏み入れぬ/);
 assert.deepEqual(map.game.passageLocks.map(x=>x.id),['guardian-sequel-passage']);
});

test('all sanctuary NPC dialogues open and close through the actual common dialogue UI',()=>{
 const formerDocument=globalThis.document;
 const formerAudio=globalThis.KIKOKU_AUDIO;
 const elements=Object.fromEntries(['talk','dialogue','speaker','line','next'].map(id=>[
  '#'+id,{
   hidden:id==='dialogue',
   textContent:'',
   classList:{toggle(){},remove(){}},
   setAttribute(){},
   addEventListener(){}
  }
 ]));
 const completed=[];
 globalThis.document={querySelector:id=>elements[id]};
 globalThis.KIKOKU_AUDIO={se(){},talkChar(){},unlock(){}};
 try{
  const dialogue=bindDialogue(()=>{},npc=>completed.push(npc.id));
  for(const stage of CHAPTER_ONE_STAGES){
   for(const definition of [white,west,east]){
    const npc={...definition,lines:definition.dialogue?.[stage]??definition.lines,
      x:definition.tile[0]*32+16,y:definition.tile[1]*32+16};
    const footX=npc.x,footY=npc.y+34;
    dialogue.update(npc,footX,footY);
    assert.equal(dialogue.open(),true,stage+' '+definition.id);
    assert.equal(dialogue.active,true);
    for(const line of npc.lines){
     const [,speaker,words]=spoken.exec(line);
     assert.equal(elements['#speaker'].textContent,speaker);
     dialogue.advance(); // reveal the full line (A speeds up)
     assert.equal(elements['#line'].textContent,words);
     dialogue.advance(); // move to next line or finish
    }
    assert.equal(dialogue.active,false,stage+' '+definition.id+' must close');
    assert.equal(completed.at(-1),definition.id);
    assert.equal(elements['#dialogue'].hidden,true);
   }
  }
 }finally{
  if(formerDocument===undefined)delete globalThis.document;
  else globalThis.document=formerDocument;
  if(formerAudio===undefined)delete globalThis.KIKOKU_AUDIO;
  else globalThis.KIKOKU_AUDIO=formerAudio;
 }
});

test('shrine alone advances story only when Shirotae finishes the shrine-stage talk',()=>{
 const walk=readFileSync('src/game/tenyo/walk.mjs','utf8');
 assert.match(walk,/!previewMode&&ended\.id==='shirotae'&&readStoryStage\(\)==='shrine'/);
 assert.match(walk,/advanceStoryStage\('cove'\)/);
 assert.match(walk,/mapUrl\.searchParams\.set\('v','tenyo-dialogue-20261120-1'\)/);
});
