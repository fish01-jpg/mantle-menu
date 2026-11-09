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
const timing = require('../intro/timing.js').create(score);
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
  vm.runInNewContext(read('intro/timing.js'),sandbox);
  vm.runInNewContext(read('intro/scene-layout.js'),sandbox);
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
  assert.doesNotMatch(read('sp1der-intro.html'),/__(?:STYLE|SCORE|SCRIPT|TIMING|LAYOUT|DURATION|VERSION|AUDIO)__|<script[^>]+src=/);
});
test('raw GitHub launcher injects a real document base instead of matching a script string',()=>{
  const hub=read('fishes-arcade.html');
  const inject=hub.match(/function injectBase\(html, base\) \{[\s\S]*?\n\}/)[0];
  const base='https://raw.githubusercontent.com/fish01-jpg/mantle-menu/main/';
  const result=vm.runInNewContext(inject+';injectBase(html,base)',{html:read('sp1der-intro.html'),base});
  assert.ok(result.includes('<head><base href="'+base+'">'));
  assert.equal((result.match(/<base\s/g)||[]).length,1);
});
test('score has nine ordered stages and a real versioned 34-second MP3',()=>{
  assert.deepEqual(score.stages.map(s=>s.at),[0,4,8,12,16,20,26,29,32]);
  assert.equal(score.duration,34);assert.equal(score.version,6);
  assert.equal(score.audio,'assets/intro/sp1der-intro-beta-v6.mp3');
  const data=fs.readFileSync(path.join(root,score.audio));
  assert.ok(data.length>500000&&data.length<650000);
  assert.equal(data.subarray(0,3).toString(),'ID3');
  // Older downloaded wrappers must still get their matching original audio.
  assert.ok(fs.statSync(path.join(root,'assets/intro/sp1der-intro-beta.mp3')).size>300000);
  assert.ok(fs.statSync(path.join(root,'assets/intro/sp1der-intro-beta-v2.mp3')).size>500000);
  assert.ok(fs.statSync(path.join(root,'assets/intro/sp1der-intro-beta-v3.mp3')).size>500000);
  assert.ok(fs.statSync(path.join(root,'assets/intro/sp1der-intro-beta-v4.mp3')).size>500000);
  assert.ok(fs.statSync(path.join(root,'assets/intro/sp1der-intro-beta-v5.mp3')).size>500000);
  assert.match(read('sp1der-intro.html'),/34<\/span> seconds/);
  assert.match(read('sp1der-intro.html'),/INTRO BETA \/ 06/);
  assert.match(read('fishes-arcade.html'),/34-second intro/);
});
test('extended cut runs its own longer score, audio and hit grid',()=>{
  const ext=JSON.parse(read('intro/sequence-extended.json'));
  assert.equal(ext.duration,58.5);assert.ok(ext.duration>score.duration);
  assert.equal(ext.version,score.version);
  assert.equal(ext.audio,'assets/intro/sp1der-intro-beta-v6-extended.mp3');
  assert.deepEqual(ext.stages.map(s=>s.at),[0,4,8,12,16,20,26,32,38,44,47,51,54.5,56.5]);
  assert.deepEqual(ext.stages.map(s=>s.id),['signal','assembly','ignition','orbital','network','deep','reef','school','warp','resolve','echo','identity','finale','handoff']);
  const data=fs.readFileSync(path.join(root,ext.audio));
  assert.ok(data.length>800000&&data.length<1100000);
  assert.equal(data.subarray(0,3).toString(),'ID3');
  const tl=require('../intro/timing.js').create(ext);
  assert.equal(tl.events.filter(e=>e.kind==='impact').length,21);
  assert.equal(tl.events.filter(e=>e.kind==='pulse').length,99);
  assert.deepEqual(tl.events.filter(e=>e.kind==='lock').map(e=>e.at),[51,51.5,52,52.5,53,53.5]);
  assert.ok(tl.events.every((e,i,a)=>e.at>=0&&e.at<ext.duration&&(!i||e.at>=a[i-1].at)));
  // The ending closes right after the title: one celebration hit, one soft
  // final accent, and nothing scheduled between the last lock and the fade.
  const tail=tl.events.filter(e=>e.at>53.5).map(e=>[e.kind,e.at]);
  assert.deepEqual(tail,[['impact',54.5],['impact',56.5]]);
  assert.ok(ext.duration-56.5<2.5);
  // Narrative captions stay inside their stages in the extended cut too.
  for(const [i,stage] of ext.stages.entries()){
    assert.equal(tl.story(stage.at).detail,stage.detail);
    for(const cue of stage.readouts||[]){
      assert.ok(cue.after>0&&stage.at+cue.after<(ext.stages[i+1]?.at??ext.duration));
      assert.equal(tl.story(stage.at+cue.after).detail,cue.text);
    }
  }
  // The composer renders both cuts through the same progressive arrangement.
  assert.match(read('scripts/compose-sp1der-intro.cjs'),/sequence-extended\.json/);
});
test('the hidden signal from the deep lives only in the extended cut',()=>{
  const built=read('sp1der-intro.html');
  assert.match(built,/window\.SP1DER_INTRO_SCORE_EXTENDED = /);
  assert.match(built,/id="extended"/);
  assert.match(source,/SIGNAL FROM THE DEEP/);
  assert.match(source,/'fish'/);
  assert.match(source,/drawRedFish/);assert.match(source,/drawBlueBass/);assert.match(source,/FIN_PIXELS/);
  assert.match(source,/SP1DER_INTRO_SCORE_EXTENDED/);
});
test('audio synthesis and rendering import the identical timing implementation',()=>{
  assert.match(read('scripts/compose-sp1der-intro.cjs'),/require\('\.\.\/intro\/timing\.js'\)\.create\(score\)/);
  assert.match(source,/window\.Sp1derTiming\.create\(score\)/);
  assert.match(read('scripts/build-sp1der-intro.cjs'),/read\('intro\/timing\.js'\)/);
  assert.match(read('scripts/compose-sp1der-intro.cjs'),/for \(const cue of timeline\.events\)/);
});
test('every major visual impact starts on its exact audio cue and decays',()=>{
  assert.equal(timing.events.filter(e=>e.kind==='impact').length,13);
  for(const hit of score.hits){
    assert.equal(timing.effects(hit.at-.001).hits.some(e=>e.id===hit.id),false);
    const onset=timing.effects(hit.at);
    assert.equal(onset.hits.find(e=>e.id===hit.id).age,0);
    assert.equal(onset.punch,hit.power);
    assert.ok(timing.effects(hit.at+.3).punch<onset.punch*.1);
    assert.equal(timing.effects(hit.at+2.01).hits.some(e=>e.id===hit.id),false);
  }
});
test('musical grid, riser envelope and six individual title locks are deterministic',()=>{
  assert.equal(timing.beat,.5);
  assert.equal(timing.events.filter(e=>e.kind==='pulse').length,55);
  assert.equal(timing.effects(5).kick,.8);
  assert.ok(timing.effects(7.95).charge>timing.effects(7.2).charge);
  assert.equal(timing.effects(8).next,null);
  assert.deepEqual(timing.events.filter(e=>e.kind==='lock').map(e=>e.at),[29,29.5,30,30.5,31,31.5]);
  assert.deepEqual(timing.effects(20.12),timing.effects(20.12));
  assert.ok(timing.events.every((e,i,a)=>e.at>=0&&e.at<score.duration&&(!i||e.at>=a[i-1].at)));
});
test('narrative captions advance within every main phase without crossing a boundary',()=>{
  for(const [i,stage] of score.stages.entries()){
    assert.equal(timing.story(stage.at).detail,stage.detail);
    for(const cue of stage.readouts||[]){
      assert.ok(cue.after>0&&stage.at+cue.after<score.stages[i+1].at);
      assert.equal(timing.story(stage.at+cue.after).detail,cue.text);
      assert.notEqual(timing.story(stage.at+cue.after-.001).detail,cue.text);
    }
    assert.equal(timing.story(stage.at+.1,true).detail,timing.story((score.stages[i+1]?.at??34)-.01,true).detail);
  }
});
test('pre-title chapters hit on exact beats; final title gets a short non-rhythmic tail',()=>{
  for(const [at,word] of [[26,'CONNECT.'],[27,'CREATE.'],[28,'BELONG.']]){
    assert.equal(timing.story(at).word,word);
    assert.ok(timing.events.some(e=>e.kind==='impact'&&e.at===at));
  }
  assert.equal(timing.story(29).word,null);
  assert.equal(timing.story(26.1,true).word,'BELONG.');
  assert.equal(timing.story(28.9,true).word,'BELONG.');
  assert.equal(timing.story(31.499).titleSettled,false);
  assert.equal(timing.story(31.5).titleSettled,true);
  assert.equal(score.duration-31.5,2.5);
  assert.ok(timing.events.filter(e=>['pulse','tick'].includes(e.kind)).every(e=>e.at<31.5));
  assert.deepEqual(timing.events.filter(e=>e.at>31.5).map(e=>[e.kind,e.at]),[['impact',32]]);
  assert.match(read('scripts/compose-sp1der-intro.cjs'),/timeline.times.resolve-timeline.times.warp/);
  assert.match(source,/function resolveSequence/);
  assert.match(source,/const packets=phone\(\)\?10:18, objects=phone\(\)\?8:14/);
});
test('changing motion while paused refreshes narrative without moving playback',()=>{
  const r=runtime();r.click('startSilent');r.step(6000);r.click('pause');
  assert.equal(r.elements.get('stageDetail').textContent,score.stages[1].readouts[0].text);
  r.click('motion');
  assert.equal(r.elements.get('stageDetail').textContent,score.stages[1].detail);
  assert.equal(r.state.time,6);
  r.click('motion');
  assert.equal(r.elements.get('stageDetail').textContent,score.stages[1].readouts[0].text);
  assert.equal(r.state.time,6);
});
test('reduced motion suppresses all impact, camera, percussion and charge envelopes',()=>{
  const still=timing.effects(0,true);
  for(const at of [7.95,8,12,20.1,24.5,28,33.5])assert.deepEqual(timing.effects(at,true),still);
});
test('Arcade has separate normal and beta entries with phone metadata',()=>{
  const hub=read('fishes-arcade.html');
  const entries=[...hub.matchAll(/class="row" data-launch="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(entries).size,entries.length,'catalog launch IDs must remain unique');
  for(const id of ['spidercraft','polytrack','fluid','pixel-canvas','geometry-dash','tetris','tiers','sp1der','sp1der-intro'])
    assert.ok(entries.includes(id),'existing entry must remain available: '+id);
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
  const r=runtime();r.click('startSilent');await r.settle();r.step(score.duration*1000);
  assert.equal(r.state.phase,'finished');assert.equal(r.elements.get('recovery').hidden,false);
  assert.equal(r.elements.get('sp1derApp').style.visibility,'hidden');
});
test('the extended sequence does not hand off at the old 22-second endpoint',async()=>{
  const r=runtime();r.click('startSilent');await r.settle();r.loaded();r.step(22000);
  assert.equal(r.state.phase,'playing');assert.equal(r.state.stage,5);
  assert.equal(r.elements.get('sp1derApp').style.visibility,'hidden');
  r.step(12000);assert.equal(r.state.phase,'finished');
  assert.equal(r.elements.get('sp1derApp').style.visibility,'visible');
});
test('paused or buffering media also freezes hit effects, mute preserves them',async()=>{
  const r=runtime();r.click('startSound');await r.settle();
  r.elements.get('score').currentTime=20.03;r.step(40);
  const fx=r.sandbox.Sp1derIntroBeta.getEffects();
  r.step(500);assert.deepEqual(r.sandbox.Sp1derIntroBeta.getEffects(),fx);
  r.click('sound');assert.deepEqual(r.sandbox.Sp1derIntroBeta.getEffects(),fx);
  r.click('pause');r.step(2000);assert.deepEqual(r.sandbox.Sp1derIntroBeta.getEffects(),fx);
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
