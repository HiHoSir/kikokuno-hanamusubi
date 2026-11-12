import test from 'node:test';
import assert from 'node:assert/strict';
import {bindDialogue} from '../src/game/village/dialogue.mjs';

function fakeElement() {
  const handlers=new Map();
  const classes=new Set();
  return {
    hidden:true,
    textContent:'',
    handlers,
    attrs:{},
    addEventListener(type,fn){handlers.set(type,fn);},
    setAttribute(name,value){this.attrs[name]=value;},
    classList:{
      toggle(name,on){if(on)classes.add(name);else classes.delete(name);},
      remove(...names){for(const name of names)classes.delete(name);},
      contains(name){return classes.has(name);},
    },
  };
}

test('legacy-style dialogue reveals, advances and completes only at the final line',()=>{
  const prior=globalThis.document;
  const nodes=new Map(['#talk','#dialogue','#speaker','#line','#next'].map(id=>[id,fakeElement()]));
  globalThis.document={querySelector(id){return nodes.get(id);}};
  let openCount=0,completeCount=0;
  try {
    const dialog=bindDialogue(()=>openCount++,()=>completeCount++);
    const npc={id:'chief',name:'里長',x:50,y:40,face:0,lines:['おはよう、緋月。','緋月「分かった、行ってくる！」']};
    dialog.update(npc,50,60);
    assert.equal(dialog.open(),true);
    assert.equal(dialog.active,true);
    assert.equal(openCount,1);
    assert.equal(nodes.get('#speaker').textContent,'里長');
    // A first finishes the typing; it does not skip a line.
    assert.equal(dialog.advance(),true);
    assert.equal(nodes.get('#line').textContent,'おはよう、緋月。');
    assert.equal(nodes.get('#next').classList.contains('hasNextLine'),true);
    assert.equal(completeCount,0);
    // Next A advances to the second speaker, but the story is not completed yet.
    dialog.advance();
    assert.equal(nodes.get('#speaker').textContent,'緋月');
    assert.equal(completeCount,0);
    dialog.advance();
    assert.equal(nodes.get('#line').textContent,'分かった、行ってくる！');
    dialog.advance();
    assert.equal(dialog.active,false);
    assert.equal(nodes.get('#dialogue').hidden,true);
    assert.equal(completeCount,1);
  } finally {
    globalThis.document=prior;
  }
});

test('closing a dialogue early must not complete its quest',()=>{
  const prior=globalThis.document;
  const nodes=new Map(['#talk','#dialogue','#speaker','#line','#next'].map(id=>[id,fakeElement()]));
  globalThis.document={querySelector(id){return nodes.get(id);}};
  let completions=0;
  try{
    const dlg=bindDialogue(()=>{},()=>completions++);
    dlg.update({name:'里長',id:'chief',x:0,y:0,lines:['まだ途中です']},0,20);
    dlg.open();
    dlg.close();
    assert.equal(completions,0);
  }finally{globalThis.document=prior;}
});
