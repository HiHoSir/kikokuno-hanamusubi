import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const base='https://example.test/kikokuno-hanamusubi/';
const source=readFileSync('src/game/navigation/entry.js','utf8');
const ticketKey='kikokuno-hanamusubi-next-entry';
const scenes=[
  ['src/opening/','src/opening/index.html'],
  ['src/game/village/','src/game/village/index.html'],
  ['src/game/interiors/','src/game/interiors/index.html'],
  ['src/field/','src/field/index.html'],
  ['src/game/tenyo/','src/game/tenyo/index.html'],
];
function enter(relativePath,entry,storage=new Map(),parent=null){
  const url=new URL(relativePath,base),changes=[];
  const location={
    href:url.href,pathname:url.pathname,search:url.search,
    assign:target=>changes.push(['assign',String(target)]),
    replace:target=>changes.push(['replace',String(target)]),
  };
  const window={location,parent};
  const document={
    currentScript:{src:new URL('src/game/navigation/entry.js',base).href,dataset:{entry}},
    documentElement:{style:{}},
  };
  const sessionStorage={
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,value),
    removeItem:key=>storage.delete(key),
  };
  runInNewContext(source,{window,document,location,sessionStorage,URL,Date});
  return {window,changes,document};
}
test('direct scene and game shell links return to title, previews are unaffected',()=>{
  for(const [path,html] of scenes){
    const content=readFileSync(html,'utf8');
    assert.match(content,/<script src="[^"]*navigation\/entry\.js" data-entry="game"><\/script>/);
    assert.ok(content.indexOf('navigation/entry.js')<content.indexOf('type="module"'));
    const direct=enter(path,'game');
    assert.deepEqual(direct.changes,[['replace',base]],path);
    assert.equal(direct.document.documentElement.style.visibility,'hidden');
  }
  const shell=readFileSync('src/game/index.html','utf8');
  assert.match(shell,/data-entry="shell"/);
  assert.deepEqual(enter('src/game/','shell').changes,[['replace',base]]);
  assert.doesNotMatch(readFileSync('previews/cave-prototype/index.html','utf8'),/data-entry="game"/);
});
test('title -> opening -> single stable gameplay page uses tickets once',()=>{
  const storage=new Map();
  const title=enter('','title',storage);
  title.window.KIKOKU_ROUTE.go(new URL('src/opening/',base));
  assert.deepEqual(title.changes,[['assign',new URL('src/opening/',base).href]]);
  const opening=enter('src/opening/','game',storage);
  assert.deepEqual(opening.changes,[]);
  opening.window.KIKOKU_ROUTE.go(new URL('src/game/',base));
  assert.deepEqual(enter('src/game/','shell',storage).changes,[]);
  assert.equal(storage.has(ticketKey),false);
  assert.deepEqual(enter('src/game/','shell',storage).changes,[['replace',base]]);
});
test('only an authorized embedded game scene can change without page navigation',()=>{
  const transitions=[];
  const host={acceptsChild:()=>true,navigate:(url,source)=>transitions.push(url)};
  const embedded=enter('src/game/village/','game',new Map(),{KIKOKU_GAME:host});
  assert.deepEqual(embedded.changes,[]);
  embedded.window.KIKOKU_ROUTE.go(new URL('src/game/interiors/?building=inn',base));
  assert.deepEqual(embedded.changes,[]);
  assert.deepEqual(transitions,[new URL('src/game/interiors/?building=inn',base).href]);
  const rejected=enter('src/game/village/','game',new Map(),{KIKOKU_GAME:{acceptsChild:()=>false}});
  assert.deepEqual(rejected.changes,[['replace',base]]);
});
test('untrusted destinations and stale tickets cannot enter the game',()=>{
  const storage=new Map();
  const title=enter('','title',storage);
  assert.throws(()=>title.window.KIKOKU_ROUTE.go(new URL('previews/cave-prototype/',base)),/本編の遷移先/);
  title.window.KIKOKU_ROUTE.go(new URL('src/game/',base));
  assert.deepEqual(enter('src/field/','game',storage).changes,[['replace',base]]);
  storage.set(ticketKey,JSON.stringify({route:new URL('src/game/',base).pathname,expiresAt:Date.now()-1}));
  assert.deepEqual(enter('src/game/','shell',storage).changes,[['replace',base]]);
});
test('all in-world transitions use the shared routing helper',()=>{
  assert.match(readFileSync('index.html','utf8'),/navigation\/entry\.js" data-entry="title"/);
  assert.match(readFileSync('src/title/title.js','utf8'),/KIKOKU_ROUTE\.go\(/);
  for(const file of ['src/opening/opening.js','src/game/village/walk.mjs',
    'src/game/interiors/walk.mjs','src/field/walk.mjs','src/game/tenyo/walk.mjs']){
    const content=readFileSync(file,'utf8');
    assert.match(content,/KIKOKU_ROUTE\.go\(/,file);
    assert.doesNotMatch(content,/(?:window\.)?location\.assign\(/,file);
  }
});
