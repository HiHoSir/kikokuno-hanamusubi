// In all top-level game documents, preserve state and audio on device rotation.
const notice=document.querySelector('#landscape-required');
const portraitQuery=matchMedia('(orientation: portrait)');
function syncOrientation(){
  const portrait=portraitQuery.matches;
  notice.setAttribute('aria-hidden',String(!portrait));
  for(const node of document.body.children){
    if(node===notice||node.tagName==='SCRIPT')continue;
    node.inert=portrait;
  }
  if(portrait){
    // Release an ongoing D-pad press even when the containing iframe keeps running.
    try{document.querySelector('#game-scene')?.contentWindow?.dispatchEvent(new Event('blur'));}catch{}
    document.dispatchEvent(new Event('landscape-blocked'));
    document.activeElement?.blur?.();
  }
}
portraitQuery.addEventListener?.('change',syncOrientation);
syncOrientation();
