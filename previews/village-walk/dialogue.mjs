import {faceToward} from './residents.mjs?v=indoor-residents';

export function bindDialogue(onOpen) {
  const talk=document.querySelector('#talk');
  const dialogue=document.querySelector('#dialogue');
  const speaker=document.querySelector('#speaker');
  const line=document.querySelector('#line');
  const next=document.querySelector('#next');
  let target, conversation, index, x, y;

  function update(npc,playerX,playerY) {
    x=playerX;
    y=playerY;
    target=npc;
    talk.hidden=!!conversation || !target;
  }

  function showLine() {
    line.textContent=conversation.lines[index];
    next.textContent=index+1<conversation.lines.length?'次へ':'閉じる';
  }

  function open() {
    if(!target || conversation) return;
    conversation=target;
    index=0;
    conversation.face=faceToward(x-conversation.x,y-conversation.y);
    onOpen();
    speaker.textContent=conversation.name;
    showLine();
    dialogue.hidden=false;
    talk.hidden=true;
    next.focus({preventScroll:true});
  }

  function close(restoreFocus=false) {
    conversation=undefined;
    dialogue.hidden=true;
    if(!restoreFocus) target=undefined;
    talk.hidden=!target;
    if(restoreFocus && target){
      talk.focus({preventScroll:true});
    }
  }

  talk.addEventListener('click',open);
  next.addEventListener('click',()=>{
    if(!conversation) return;
    if(++index<conversation.lines.length) showLine();
    else close(true);
  });

  return {get active(){return !!conversation;},update,open,close};
}
