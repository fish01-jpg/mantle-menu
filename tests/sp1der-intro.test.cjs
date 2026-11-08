'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const source = read('intro/sp1der-intro.js');
const score = JSON.parse(read('intro/sequence.json'));
function runtime({reduced=false,failApp=false,failAudio=false}={}) {
  const elements=new Map(), frames=new Map(), timers=new Map(), documentEvents={};
  let now=0, serial=0, fetches=0;
  function element(id) {
    if(elements.has(id))return elements.get(id);
    const e={id,hidden:false,style:{},attributes:{},events:{},textContent:'',
      classList:{add(){}},getContext(){return null;},
      contentWindow:{location:{href:'about:blank'}},
      setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},
      addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;},
      play(){this.paused=false;return failAudio?Promise.reject(Error('Audio unavailable')):Promise.resolve();},
      pause(){this.paused=true;},currentTime:0,paused:true,error:failAudio?{}:null};
    elements.set(id,e);return e;
  }
  const sandbox={console,URL,AbortController,Promise,Math,Object,
    innerWidth:390,innerHeight:844,devicePixelRatio:3,
    document:{baseURI:'https://example.test/sp1der-intro.html',getElementById:element,
      addEventListener(k,fn){documentEvents[k]=fn;}},
    matchMedia:()=>({matches:reduced,addEventListener(){}}),addEventListener(){},
    performance:{now:()=>now},
    requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id;},
    cancelAnimationFrame(id){frames.delete(id);},
    setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},
    clearTimeout(id){timers.delete(id);},
    fetch:async()=>{fetches++;return {ok:!failApp,status:failApp?503:200,text:async()=>'<html><div id="appShell"></div></html>',headers:{get:()=> 'text/html'}};},
    SP1DER_INTRO_SCORE:score
  };
  sandbox.window=sandbox;
  vm.runInNewContext(source,sandbox);
  return {
    sandbox, elements, frames, timers, documentEvents,
    get fetches(){return fetches;}, get state(){return sandbox.Sp1derIntroBeta.getState();},
    click(id){element(id).events.click();},
    step(ms){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},
    loaded(){const e=element('sp1derApp');e.contentWindow.location.href='https://example.test/sp1der.html';e.onload();},
    async settle(){for(let i=0;i<8;i++)await Promise.resolve();}
  };
}
test('generated intro is current and all inline scripts parse',()=>{
  cp.execFileSync(process.execPath,['scripts/build-sp1der-intro.cjs','--check'],{cwd:root});
  for(const match of read('sp1der-intro.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))assert.doesNotThrow(()=>new vm.Script(match[1]));
  assert.doesNotMatch(read('sp1der-intro.html'),/__STYLE__|__SCORE__|__SCRIPT__|<script[^>]+src=/);
});
test('score has ordered cue boundaries and a real 22-second MP3',()=>{
  assert.deepEqual(score.stages.map(s=>s.at),[0,3,7,11,15,19]);
  assert.equal(score.duration,22);
  const data=fs.readFileSync(path.join(root,'assets/intro/sp1der-intro-beta.mp3'));
  assert.ok(data.length>300000&&data.length<500000);
  assert.equal(data.subarray(0,3).toString(),'ID3');
});
test('Arcade has separate normal and beta entries with phone metadata',()=>{
  const hub=read('index.html');
  assert.equal((hub.match(/class="row" data-launch=/g)||[]).length,9);
  assert.match(hub,/data-launch="sp1der">/);
  assert.match(hub,/data-launch="sp1der-intro">/);
  assert.match(hub,/"sp1der-intro": \{ category: "apps", touch: true/);
  assert.match(hub,/"sp1der-intro": "sp1der-intro.html"/);
  assert.equal((hub.match(/appId !== "sp1der-intro"/g)||[]).length,2);
});
test('cold gate never requests app or starts audio',()=>{
  const r=runtime();
  assert.equal(r.state.phase,'ready');assert.equal(r.fetches,0);
  assert.equal(r.elements.get('score').paused,true);
});
test('silent clock pauses, resumes without a jump, and remains independent of media',async()=>{
  const r=runtime();r.click('startSilent');await r.settle();
  r.step(4000);assert.equal(r.state.stage,1);assert.equal(r.state.time,4);
  r.click('pause');r.step(10000);assert.equal(r.state.time,4);assert.equal(r.state.phase,'paused');
  r.click('pause');r.step(2000);assert.equal(r.state.time,6);
  assert.equal(r.fetches,1);assert.equal(r.elements.get('score').paused,true);
});
test('audio playback time is the master clock, including buffering and mute',async()=>{
  const r=runtime();r.click('startSound');await r.settle();assert.equal(r.state.clock,'audio');
  r.elements.get('score').currentTime=8.25;r.step(20000);
  assert.equal(r.state.time,8.25);assert.equal(r.state.stage,2);
  r.step(2000);assert.equal(r.state.time,8.25);
  r.click('sound');assert.equal(r.elements.get('score').muted,true);
  r.elements.get('score').currentTime=12.4;r.step(50);assert.equal(r.state.stage,3);
  r.click('pause');r.step(2000);assert.equal(r.state.time,12.4);
});
test('all scored phases are selected from the master time',async()=>{
  const r=runtime();r.click('startSound');await r.settle();
  for(const [i,s] of score.stages.entries()){
    r.elements.get('score').currentTime=s.at+.1;r.step(40);
    assert.equal(r.state.stage,i);assert.equal(r.elements.get('stageTitle').textContent,s.name);
  }
});
test('reduced motion follows preference and remains user-toggleable',()=>{
  const r=runtime({reduced:true});assert.equal(r.state.reduced,true);
  r.click('motion');assert.equal(r.state.reduced,false);
});
test('skip before play waits for the original app, then reveals it',async()=>{
  const r=runtime();r.click('skip');assert.equal(r.state.phase,'finished');
  await r.settle();assert.equal(r.fetches,1);assert.equal(r.elements.get('recovery').hidden,false);
  r.loaded();assert.equal(r.state.appReady,true);assert.equal(r.elements.get('sp1derApp').hidden,false);
  assert.equal(r.elements.get('sp1derApp').src,'https://example.test/sp1der.html');
});
test('completion never substitutes a cinematic for app readiness',async()=>{
  const r=runtime();r.click('startSilent');await r.settle();r.step(22000);
  assert.equal(r.state.phase,'finished');assert.equal(r.elements.get('recovery').hidden,false);
  assert.equal(r.elements.get('sp1derApp').style.visibility,'hidden');
});
test('HTTP failure exposes retry and a successful retry can hand off',async()=>{
  const r=runtime({failApp:true});r.click('skip');await r.settle();
  assert.equal(r.state.appFailed,true);assert.equal(r.elements.get('retry').hidden,false);
  r.sandbox.fetch=async()=>({ok:true,text:async()=>'<div id="appShell"></div>',headers:{get:()=> 'text/html'}});
  r.click('retry');await r.settle();r.loaded();
  assert.equal(r.state.appFailed,false);assert.equal(r.state.appReady,true);
});
test('audio failure falls back to silent clock instead of blocking launch',async()=>{
  const r=runtime({failAudio:true});r.click('startSound');await r.settle();
  for(let i=0;i<3;i++){r.elements.get('score').onerror();await r.settle();}
  assert.equal(r.state.clock,'silent');r.step(3000);assert.equal(r.state.time,3);
});
test('background visibility pauses; foreground requires an explicit Resume',()=>{
  const r=runtime();r.click('startSilent');r.step(3000);
  r.sandbox.document.hidden=true;r.documentEvents.visibilitychange();
  assert.equal(r.state.phase,'paused');r.step(8000);assert.equal(r.state.time,3);
  r.sandbox.document.hidden=false;r.documentEvents.visibilitychange();assert.equal(r.state.phase,'paused');
  r.click('pause');r.step(1000);assert.equal(r.state.time,4);
});
test('Escape skips the optional intro',async()=>{
  const r=runtime();let prevented=false;
  r.documentEvents.keydown({key:'Escape',preventDefault(){prevented=true;}});
  await r.settle();assert.equal(r.state.phase,'finished');assert.equal(prevented,true);
});
test('app timeout aborts outstanding load and offers retry, not a false-ready frame',async()=>{
  const r=runtime();r.sandbox.fetch=()=>new Promise(()=>{});r.click('skip');
  const timeout=[...r.timers.values()].find(t=>t.ms===30000);assert.ok(timeout);
  timeout.fn();assert.equal(r.state.appFailed,true);assert.equal(r.elements.get('retry').hidden,false);
});
test('the app iframe follows the visible viewport when a phone keyboard opens',()=>{
  const r=runtime();
  const view={width:390,height:280,offsetTop:22,offsetLeft:0};
  r.sandbox.visualViewport=view;
  // Re-execute initialization with a visual viewport event target.
  const events={};view.addEventListener=(name,fn)=>{events[name]=fn;};
  vm.runInNewContext(source,r.sandbox);
  const frame=r.elements.get('sp1derApp');
  assert.equal(frame.style.height,'280px');assert.equal(frame.style.top,'22px');
  view.height=844;view.offsetTop=0;events.resize();
  assert.equal(frame.style.height,'844px');assert.equal(frame.style.top,'0px');
  view.offsetTop=8;events.scroll();assert.equal(frame.style.top,'8px');
});
