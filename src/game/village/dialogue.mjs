import {faceToward} from './residents.mjs';

// Adapted from the former game dialogue: 36ms character reveal, A to reveal /
// advance, blinking ▼ when another line follows. No movement during a line.
export function bindDialogue(onOpen=()=>{}, onComplete=()=>{}) {
  const talk=document.querySelector('#talk');
  const panel=document.querySelector('#dialogue');
  const speaker=document.querySelector('#speaker');
  const line=document.querySelector('#line');
  const next=document.querySelector('#next');
  let target=null, conversation=null, index=0, x=0, y=0;
  let characters=[], displayed=0, typingTimer=null;

  function stopTyping() {
    if(typingTimer!==null)clearTimeout(typingTimer);
    typingTimer=null;
  }

  function indicator() {
    const complete=displayed>=characters.length;
    next.classList.toggle('hasNextLine',complete && index<conversation.lines.length-1);
    next.classList.toggle('hasLastLine',complete && index===conversation.lines.length-1);
    next.setAttribute('aria-label',!complete?'全文を表示':index<conversation.lines.length-1?'次のセリフへ':'会話を閉じる');
  }

  function tick() {
    if(!conversation)return;
    if(displayed<characters.length)line.textContent+=characters[displayed++];
    if(displayed<characters.length)typingTimer=setTimeout(tick,36);
    else {typingTimer=null;indicator();}
  }

  function showLine() {
    stopTyping();
    const value=String(conversation.lines[index]??'');
    const scripted=/^([^「」]{1,12})「([\s\S]*)」$/.exec(value);
    speaker.textContent=scripted?scripted[1]:conversation.name;
    characters=Array.from(scripted?scripted[2]:value);
    displayed=0;
    line.textContent='';
    next.classList.remove('hasNextLine','hasLastLine');
    if(characters.length)tick();
    else indicator();
  }

  function update(npc,playerX,playerY) {
    x=playerX;
    y=playerY;
    if(!conversation)target=npc;
    talk.hidden=true;
  }

  function open() {
    if(conversation || !target)return false;
    conversation=target;
    index=0;
    conversation.face=faceToward(x-conversation.x,y-conversation.y);
    onOpen();
    panel.hidden=false;
    showLine();
    return true;
  }

  function close(completed=false) {
    if(!conversation)return;
    stopTyping();
    const finished=completed && index>=conversation.lines.length;
    const ended=conversation;
    conversation=null;
    target=null;
    panel.hidden=true;
    line.textContent='';
    next.classList.remove('hasNextLine','hasLastLine');
    talk.hidden=true;
    if(finished)onComplete(ended);
  }

  function advance() {
    if(!conversation)return false;
    if(displayed<characters.length) {
      stopTyping();
      displayed=characters.length;
      line.textContent=characters.join('');
      indicator();
      return true;
    }
    ++index;
    if(index<conversation.lines.length)showLine();
    else close(true);
    return true;
  }

  talk.addEventListener('click',open);
  next.addEventListener('click',advance);
  return {get active(){return !!conversation;},update,open,advance,close};
}
