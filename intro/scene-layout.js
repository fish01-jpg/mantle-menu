(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sp1derSceneLayout = factory();
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const clamp = v => Math.max(0,Math.min(1,v));
  const ease = v => {v=clamp(v);return v*v*(3-2*v);};
  function layers(score,t,poster=false,reduced=false) {
    const out={signal:0,assembly:0,core:0,orbital:0,network:0,warp:0,resolve:0,title:0};
    if(poster)return {...out,signal:1,assembly:1,core:1,scene:'poster'};
    let index=0;score.stages.forEach((s,i)=>{if(t>=s.at)index=i;});
    const stage=score.stages[index], end=score.stages[index+1]?.at??score.duration;
    const key={ignition:'core',identity:'title',handoff:'title'}[stage.id]||stage.id;
    // No crossfade across the boundary: a previous scene is never redrawn
    // underneath the next. Motion reduction uses a stable full-strength tableau.
    out[key]=reduced||key==='title'?1:ease((t-stage.at)/.4)*(1-ease((t-(end-.35))/.35));
    return {...out,scene:stage.id};
  }
  function fit({width,height,headerBottom,copyTop,copyRight,footerTop,scene}) {
    const pad=width<400?20:24, short=width>height&&height<560;
    const left=short?Math.max(width*.43,copyRight+20):pad;
    const right=width-pad, top=Math.max(pad,headerBottom+20);
    const bottom=(short?footerTop:Math.min(copyTop,footerTop))-20;
    const box={left,top,right,bottom,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
    const radius={signal:2.8,assembly:3.05,ignition:1.7,orbital:3.0,network:3.3,warp:3.5,deep:3.4,reef:3.6,school:3.8,echo:2.8,finale:3.6}[scene]||2.8;
    // The assembly is an ellipse, not a sphere. Fit its shorter vertical extent
    // separately so embedded phones do not reduce six models to tiny stamps.
    const radiusY=scene==='assembly'?2.4:radius;
    const unit=scene==='identity'||scene==='handoff'
      ?Math.min(box.width/5.4,box.height/2.5,185)
      :Math.min(box.width/(radius*2),box.height/(radiusY*2),180);
    return {box,cx:(left+right)/2,cy:(top+bottom)/2,unit,radius,radiusY,short};
  }
  return Object.freeze({layers,fit});
}));
