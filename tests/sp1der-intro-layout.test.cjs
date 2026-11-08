'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const layout=require('../intro/scene-layout.js');
const score=JSON.parse(fs.readFileSync(path.join(__dirname,'../intro/sequence.json'),'utf8'));
const keys=['signal','assembly','core','orbital','network','warp','title'];
test('phase two has no opening background or ghost core, including its exact boundary',()=>{
  for(const t of [4,4.01,4.5,6,7.99]){
    const layers=layout.layers(score,t);
    assert.equal(layers.scene,'assembly');
    for(const key of keys.filter(k=>k!=='assembly'))assert.equal(layers[key],0);
  }
  assert.ok(layout.layers(score,6).assembly>.99);
});
test('each phase exclusively owns its primary geometry; nothing lingers under the title',()=>{
  const expected=['signal','assembly','core','orbital','network','warp','title','title'];
  score.stages.forEach((stage,index)=>{
    for(const reduced of [false,true]){
      const layers=layout.layers(score,stage.at+1.5,false,reduced);
      assert.deepEqual(keys.filter(k=>layers[k]>0),[expected[index]]);
    }
  });
});
test('reduced-motion compositions stay constant within a phase and poster remains separate',()=>{
  for(const [i,stage] of score.stages.entries()){
    const end=score.stages[i+1]?.at??score.duration;
    assert.deepEqual(layout.layers(score,stage.at+.01,false,true),layout.layers(score,end-.01,false,true));
  }
  const poster=layout.layers(score,8.5,true);
  assert.equal(poster.scene,'poster');assert.equal(poster.signal,1);assert.equal(poster.core,1);
});
test('fitted primary geometry stays inside the art area at narrow, embedded and desktop sizes',()=>{
  for(const [width,height] of [[320,506],[320,568],[375,615],[390,792],[430,880],[667,315],[844,330],[932,370],[1440,900],[1280,500]]){
    const short=width>height&&height<560;
    for(const stage of score.stages){
      const fit=layout.fit({width,height,headerBottom:short?60:113,
        copyTop:height-210,copyRight:width*.42,footerTop:height-80,scene:stage.id});
      assert.ok(fit.box.left>=0&&fit.box.right<=width);
      assert.ok(fit.box.top>0&&fit.box.bottom<height);
      assert.ok(fit.box.height>0&&fit.box.width>0);
      assert.ok(fit.unit>0);
      if(!['identity','handoff'].includes(stage.id)){
        assert.ok(fit.unit*fit.radius*2<=fit.box.width+.001);
        assert.ok(fit.unit*fit.radiusY*2<=fit.box.height+.001);
      }
      if(short)assert.ok(fit.box.left>width*.42);
    }
  }
});
test('assembly uses its elliptical height without exceeding horizontal fit',()=>{
  const fit=layout.fit({width:320,height:506,headerBottom:113,copyTop:328,copyRight:300,footerTop:432,scene:'assembly'});
  assert.ok(fit.unit>=36);
  assert.ok(fit.unit*fit.radius*2<=fit.box.width);
  assert.ok(fit.unit*fit.radiusY*2<=fit.box.height);
  assert.ok(fit.radiusY<fit.radius);
});
test('short portrait caption spacing frees artwork room without shrinking controls',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../intro/sp1der-intro.css'),'utf8');
  assert.match(css,/\(max-height:600px\) and \(orientation:portrait\)/);
  assert.match(css,/#sequenceCopy\{bottom:96px/);
  assert.match(css,/#stageDetail\{font-size:12px;max-width:none\}/);
  assert.match(css,/min-height:44px/);
});
test('primary geometry is clipped to its artwork region, not the control/caption areas',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../intro/sp1der-intro.js'),'utf8');
  assert.match(source,/ctx\.rect\(b\.left,b\.top,b\.width,b\.height\);ctx\.clip\(\)/);
  assert.match(source,/getBoundingClientRect/);
  assert.match(source,/const coreAlpha=.*layers\.core/);
  assert.match(source,/if\(layers\.signal>0\)for\(const s of stars/);
});
