(function () {
  'use strict';
  // Two cuts share one renderer: the classic 34s score and the 68s extended cut.
  // The extended toggle only appears when the extended score was embedded.
  const BASE_SCORE = window.SP1DER_INTRO_SCORE;
  const EXTENDED_SCORE = window.SP1DER_INTRO_SCORE_EXTENDED || null;
  let score = BASE_SCORE;
  let timeline = window.Sp1derTiming.create(score), T = timeline.times;
  const sceneLayout = window.Sp1derSceneLayout;
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d'), audio = $('score'), app = $('sp1derApp');
  const state = {
    phase: 'ready', mode: 'silent', reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    muted: false, time: 0, anchor: 0, offset: 0, stage: -1, ready: false,
    appStarted: false, appFailed: false, finishWanted: false, generation: 0, frame: 0, lastPaint: 0,
    extended: false, egg: -1, eggStart: 0
  };
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const ease = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const TAU = Math.PI * 2;
  const C = { cyan: [121,228,239], pale: [217,248,251], warm: [237,187,124], dim: [60,103,123] };
  let w = 1, h = 1, unit = 1, cx = 0, cy = 0, camera = 0, zoom = 1;
  let composition = null;
  const phone = () => Math.min(innerWidth,innerHeight) < 650;
  const rgba = (c,a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
  function rotate(p, rx = 0, ry = 0, rz = 0) {
    let [x,y,z] = p, a = Math.cos(rx), b = Math.sin(rx);
    [y,z] = [y*a-z*b,y*b+z*a]; a = Math.cos(ry); b = Math.sin(ry);
    [x,z] = [x*a+z*b,-x*b+z*a]; a = Math.cos(rz); b = Math.sin(rz);
    return [x*a-y*b,x*b+y*a,z];
  }
  function project(p) {
    const [x,y,z] = rotate(p, -.09, camera, 0);
    const d = 7 + z;
    if (d < .35) return null;
    const scale = 7 / d * unit * zoom;
    return [cx+x*scale,cy+y*scale,scale,z];
  }
  function path(points, color, alpha, width = 1, close = false, fill = false) {
    if (!ctx || alpha <= .002) return;
    const p = points.map(project);
    if (p.some(v=>!v)) return;
    ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));
    if(close)ctx.closePath();
    if(fill){ctx.fillStyle=rgba(color,alpha*.12);ctx.fill();}
    ctx.strokeStyle=rgba(color,alpha);ctx.lineWidth=width;ctx.stroke();
  }
  function dot(p,r,color,alpha) {
    if(alpha<=.002)return;
    const q=project(p);if(!ctx||!q)return;
    ctx.fillStyle=rgba(color,alpha);ctx.beginPath();ctx.arc(q[0],q[1],r,0,TAU);ctx.fill();
  }
  function annotation(p, text, side, alpha) {
    if(alpha<=.002)return;
    const q=project(p);if(!q||!ctx)return;
    const x=q[0]+side*36,y=q[1]-22;
    ctx.strokeStyle=rgba(C.dim,alpha*.7);ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(q[0]+side*16,y);ctx.lineTo(x+side*64,y);ctx.stroke();
    ctx.fillStyle=rgba(C.pale,alpha*.8);ctx.font="12px 'IBM Plex Mono',monospace";ctx.textAlign=side<0?'right':'left';ctx.fillText(text,x,y-7);
  }
  function ring(radius, depth, tilt, spin, alpha, segmented = false, color = C.cyan) {
    if(alpha<=.002)return;
    const n=phone()?64:100, pts=[];
    for(let i=0;i<=n;i++){
      const a=i/n*TAU+spin;
      const p=rotate([Math.cos(a)*radius,Math.sin(a)*radius,0],tilt[0],tilt[1],tilt[2]);
      p[2]+=depth;pts.push(p);
      if(segmented&&i%6===5){path(pts.splice(0),color,alpha,1.3);}
    }
    path(pts,color,alpha,segmented?1.3:.8);
    for(let i=0;i<32;i++){
      const a=i/32*TAU+spin, out=i%4===0?.11:.04;
      const ends=[radius,radius+out].map(r=>{const p=rotate([Math.cos(a)*r,Math.sin(a)*r,0],...tilt);p[2]+=depth;return p;});
      path(ends,color,alpha*.7);
    }
  }
  const phi=(1+Math.sqrt(5))/2;
  const ico=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(p=>p.map(v=>v/Math.sqrt(1+phi*phi)));
  const edges=[];
  for(let a=0;a<ico.length;a++)for(let b=a+1;b<ico.length;b++)if(Math.hypot(...ico[a].map((v,i)=>v-ico[b][i]))<1.1)edges.push([a,b]);
  const shapes = {
    MESSAGE:[[-1,-.65],[1,-.65],[1,.55],[.1,.55],[-.55,1],[-.55,.55],[-1,.55]],
    WINDOW:[[-1,-.8],[1,-.8],[1,.8],[-1,.8]],
    FOLDER:[[-1,-.6],[-.25,-.6],[0,-.9],[.75,-.9],[1,-.55],[1,.75],[-1,.75]],
    CURSOR:[[-.65,-1],[.95,.2],[.2,.35],[.65,1],[-.05,1.2],[-.4,.48],[-.95,.95]],
    PERSON:[[-.95,1],[-.85,.25],[-.35,-.1],[.35,-.1],[.85,.25],[.95,1]],
    ENVELOPE:[[-1,-.65],[1,-.65],[1,.65],[-1,.65]]
  };
  const names=Object.keys(shapes);
  function model(name, pos, scale, rotation, alpha, color) {
    const poly=shapes[name], n=poly.length, depth=.3;
    const transform=p=>rotate(p.map(v=>v*scale),...rotation).map((v,i)=>v+pos[i]);
    const front=poly.map(([x,y])=>transform([x,y,-depth])),back=poly.map(([x,y])=>transform([x,y,depth]));
    // Each everyday object is an extruded polygon, with real front/back faces.
    path(back,color,alpha*.28,1,true,true);
    for(let i=0;i<n;i++)path([front[i],back[i],back[(i+1)%n],front[(i+1)%n]],color,alpha*.38,.75,true,true);
    path(front,color,alpha,1.2,true,true);
    const extra=line=>path(line.map(([x,y])=>transform([x,y,-depth-.01])),color,alpha*.7);
    if(name==='ENVELOPE')extra([[-1,-.65],[0,.12],[1,-.65]]);
    if(name==='WINDOW'){
      extra([[-1,-.4],[1,-.4]]);extra([[-.76,-.62],[-.69,-.62]]);extra([[-.5,-.62],[-.43,-.62]]);
      for(let i=0;i<4;i++)extra([[-.72,-.13+i*.19],[-.42+(i%2)*.14,-.13+i*.19]]);
      const waveClock=state.reduced?0:state.time;
      const wave=[];for(let i=0;i<=24;i++)wave.push([-.12+i*.038,.26+Math.sin(i*.85+waveClock*4)*.12*Math.sin(i/24*Math.PI)]);
      extra(wave);extra([[-.12,.57],[.78,.57]]);
    }
    if(name==='FOLDER'){
      extra([[-.65,-.28],[.65,-.28]]);extra([[-.65,0],[.45,0]]);extra([[-.65,.28],[.08,.28]]);
    }
    if(name==='MESSAGE'){extra([[-.7,-.26],[.7,-.26]]);extra([[-.7,.04],[.35,.04]]);}
    if(name==='PERSON'){
      const head=[];for(let i=0;i<=24;i++){const a=i/24*TAU;head.push(transform([Math.cos(a)*.36,-.67+Math.sin(a)*.36,-depth]));}path(head,color,alpha,1.2);
    }
  }
  const stars=Array.from({length:160},(_,i)=>[(Math.sin(i*123.7)*.5+.5)*2-1,(Math.cos(i*73.1)*.5+.5)*2-1,(i*1.731)%18]);
  const nodes=Array.from({length:110},(_,i)=>{
    const y=1-2*(i+.5)/110, r=Math.sqrt(1-y*y), a=i*2.399963;
    return [Math.cos(a)*r*2.45,y*2.45,Math.sin(a)*r*2.45];
  });
  const links=[];
  for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++)if(Math.hypot(...nodes[a].map((v,i)=>v-nodes[b][i]))<.92)links.push([a,b]);
  function drawImpact(fx, t) {
    if(state.reduced)return;
    // The controls never shake. Only the projected world receives the camera punch.
    if(fx.charge>.005){
      const r=3.7-fx.charge*.85;
      for(let i=0;i<12;i++){
        const a=i/12*TAU+t*.15;
        path([[Math.cos(a)*r,Math.sin(a)*r,.4],[Math.cos(a)*(r-.35),Math.sin(a)*(r-.35),.4]],C.warm,fx.charge*.45,1.5);
      }
      ring(.4+fx.charge*.4,-.1,[.2,.4,0],-t,.25*fx.charge,true,C.warm);
    }
    for(const hit of fx.hits){
      const age=hit.age, energy=hit.power*Math.exp(-age*4), color=hit.warm?C.warm:C.cyan;
      // Wide wavefronts, rather than full-screen white flashes.
      for(let j=0;j<3;j++){
        const delay=j*.085, u=age-delay;if(u<0)continue;
        ring(.5+Math.pow(u,.72)*(4+j*.7),-.5+j*.16,[.08+j*.23,.12,j*.2],j*.2,
          hit.power*.75*Math.exp(-u*3.3),j===1,color);
      }
      const count=phone()?22:42;
      for(let i=0;i<count;i++){
        const a=i/count*TAU+Math.sin(i*7.1)*.18, speed=2.5+(i%7)*.45;
        const r=.4+age*speed, z=Math.sin(i*12.3)*(.8+age*2), size=.025+(i%3)*.018;
        const p=[Math.cos(a)*r,Math.sin(a)*r*.8,z];
        const shard=[[-size,-size,0],[size*2,0,size],[0,size,0]].map(v=>
          rotate(v,age*3+i,age*2,i).map((n,k)=>n+p[k]));
        path(shard,color,energy*.7,1,true,true);
        path([p,[p[0]-Math.cos(a)*age*.65,p[1]-Math.sin(a)*age*.5,z+.2]],color,energy*.3);
      }
      if(energy>.015){
        const radius=Math.min(w,h)*(.23+age*.3);
        const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius);
        glow.addColorStop(0,rgba(color,.16*energy));glow.addColorStop(.4,rgba(color,.045*energy));glow.addColorStop(1,rgba(color,0));
        ctx.fillStyle=glow;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
        const beam=ctx.createLinearGradient(0,cy,w,cy);
        beam.addColorStop(0,rgba(color,0));beam.addColorStop(.5,rgba(C.pale,.65*energy));beam.addColorStop(1,rgba(color,0));
        ctx.fillStyle=beam;ctx.fillRect(0,cy-1,w,1+energy*2);
        ctx.fillStyle=rgba(color,energy*.13);ctx.fillRect(w*.12,cy-4,w*.76,8);
      }
    }
    // Low-level scored percussion remains distinct from the big cinematic hits.
    if(fx.kick>.02)ring(1.0+(1-fx.kick)*.7,-.15,[.1,.2,0],0,fx.kick*.22);
  }
  function orbitalMachine(t, motion, alpha, beat){
    for(let deck=0;deck<3;deck++){
      const z=(deck-1)*.65, r=1.1+deck*.35;
      ring(r,z,[.18,.15,.05],motion*(deck%2?.22:-.18),alpha*.5,true,deck===1?C.warm:C.cyan);
      const count=phone()?10:16;
      for(let i=0;i<count;i++){
        const a=i/count*TAU+motion*(deck%2?.22:-.18), turn=state.reduced?1:ease((t-T.orbital)/1.1);
        const p=[Math.cos(a)*r,Math.sin(a)*r,z];
        const shape=[[-.14,-.055,0],[.14,-.055,0],[.20,.055,.08],[-.14,.055,.08]].map(v=>
          rotate(v,turn*.4,0,a+Math.PI/2).map((n,k)=>n+p[k]));
        path(shape,deck===1?C.warm:C.cyan,alpha*(.4+beat*.3),1,true,true);
        if(i%2===0)path([p,[p[0]*.72,p[1]*.72,z+.4]],C.dim,alpha*.5);
      }
    }
    // Rotating scanning planes visibly cut through the layered mechanism.
    for(let i=0;i<2;i++){
      const a=motion*.55+i*Math.PI/2;
      path([[-2.6,0,0],[2.6,0,0],[2.6,0,.04],[-2.6,0,.04]].map(p=>rotate(p,.4,a,.3)),C.pale,alpha*.5,1,true);
    }
  }
  function warpCorridor(t, motion, alpha, lift, beat){
    const count=phone()?14:22;
    for(let j=0;j<count;j++){
      const z=state.reduced?j*1.7-2:((j*1.7+28-(t-T.warp)*8)%26+26)%26-4;
      const points=[];
      for(let i=0;i<=6;i++){
        const a=i/6*TAU+motion*.075;
        points.push([Math.cos(a)*2.8,Math.sin(a)*2.8,z]);
      }
      path(points,j%4===0?C.warm:C.cyan,alpha*(.13+Math.max(0,1-(z+4)/26)*.3),1.3);
      // Alternating wall trusses make the passage a volume, not just nested rings.
      for(let i=0;i<6;i++){
        const a=i/6*TAU+motion*.075, b=a+TAU/6;
        path([[Math.cos(a)*2.8,Math.sin(a)*2.8,z],
          [Math.cos(b)*2.8,Math.sin(b)*2.8,z+1.05]],C.dim,alpha*.33,.7);
      }
    }
    const countLines=phone()?18:32;
    for(let i=0;i<countLines;i++){
      const a=i/countLines*TAU+motion*.075, r=2.8+(i%3)*.35;
      path([[Math.cos(a)*r,Math.sin(a)*r,-3.7],[Math.cos(a)*r,Math.sin(a)*r,18]],i%7===0?C.warm:C.cyan,alpha*.25);
    }
    const packets=phone()?10:18, objects=phone()?8:14;
    for(let i=0;i<packets;i++){
      const a=i/packets*TAU+motion*.075, r=2.55+(i%3)*.12;
      const z=state.reduced?i*1.1:((i*1.9+26-(t-T.warp)*12)%22+22)%22-3.5;
      const p=[Math.cos(a)*r,Math.sin(a)*r,z];
      path([p,[p[0],p[1],z+1.1]],i%4===0?C.warm:C.cyan,alpha*.85,1.8);
      // Beat-synced halos swell around every light packet as the score builds.
      if(beat>.04)dot(p,2.2+beat*2.6,i%4===0?C.warm:C.cyan,alpha*beat*.3);
      dot(p,1.5,i%4===0?C.warm:C.pale,alpha);
    }
    const orbits=[];
    for(let i=0;i<objects;i++){
      const z=state.reduced?i*1.7:((i*2.7+30-(t-T.warp)*5)%20+20)%20-3;
      const a=i/objects*TAU+motion*.1;
      const p=[Math.cos(a)*1.9,Math.sin(a)*1.9,z];
      orbits.push(p);
      model(names[i%names.length],p,.38,
        [.2,motion*.3+i,a*.1],alpha*.85,i%3===0?C.warm:C.cyan);
    }
    // Interconnection web: neighbours link to each other and to the corridor
    // axis, so the transit reads as one woven system that brightens on beats.
    for(let i=0;i<orbits.length;i++){
      const a=orbits[i], b=orbits[(i+1)%orbits.length];
      if(Math.abs(a[2]-b[2])<4)
        path([a,b],i%2?C.cyan:C.warm,alpha*(.16+lift*.24+beat*.12),.8);
      path([a,[a[0]*.26,a[1]*.26,a[2]]],C.dim,alpha*(.10+lift*.16),.7);
    }
    // A central destination, with independent inner and outer depth scales.
    ring(.85,9,[.1,-.1,0],-motion*.25,alpha*.7,true,C.warm);
    ring(1.15,12,[0,0,0],motion*.18,alpha*.5,true);
    // A shared glow breathes behind the destination as the score builds.
    const dest=project([0,0,10.5]);
    if(dest&&ctx){
      const r=Math.max(20,unit*(1.5+beat*.3));
      const glow=ctx.createRadialGradient(dest[0],dest[1],0,dest[0],dest[1],r);
      glow.addColorStop(0,rgba(C.warm,alpha*(.10+lift*.10+beat*.14)));
      glow.addColorStop(.5,rgba(C.cyan,alpha*(.04+lift*.05)));
      glow.addColorStop(1,rgba(C.cyan,0));
      ctx.fillStyle=glow;ctx.fillRect(dest[0]-r,dest[1]-r,r*2,r*2);
    }
  }
  // ===== Extended-cut scenes: the deep, the reef, the school, the echo, the finale. =====
  function deepDive(t,motion,alpha,beat){
    const enter=ease((t-T.deep)/1.4), exit=alpha;
    // Descending depth rings: the world sinks past the camera.
    for(let j=0;j<10;j++){
      const z=state.reduced?j*2:((j*2+20-(t-T.deep)*1.6)%20+20)%20-4;
      ring(3.2,z-3,[.06,0,.2],j*.09,.12*enter*exit,true);
    }
    // Sonar pings ripple outward from the core, unanswered.
    const ping=((t-T.deep)%3)/3;
    ring(.5+ping*2.6,-.2,[.3,.2,0],motion*.2,(1-ping)*.3*enter*exit,true,C.warm);
    // Bubbles rise as the camera sinks.
    for(let i=0;i<(phone()?14:32);i++){
      const bx=Math.sin(i*2.7)*2.2, bz=((i*1.31+14-motion*.9)%14+14)%14-2;
      const by=1.9-((i*.83+motion*.55)%3.6);
      dot([bx,by,bz],1.2+(i%3)*.4,i%4===0?C.warm:C.pale,.35*enter*exit);
    }
    if(!phone())annotation([1.4,1.1,0],'DEPTH / 418M',1,.5*exit);
  }
  function coral(x,y,angle,len,depth,motion,alpha){
    if(depth<=0||len<.05)return;
    const sway=Math.sin(motion*.8+x*2.4)*.07, a2=angle+sway;
    const x2=x+Math.cos(a2)*len, y2=y+Math.sin(a2)*len;
    path([[x,y,.25],[x2,y2,.25]],depth%2?C.warm:C.cyan,alpha*(.4+depth*.1),1.4);
    coral(x2,y2,a2-.55,len*.74,depth-1,motion,alpha);
    coral(x2,y2,a2+.55,len*.74,depth-1,motion,alpha);
  }
  function reefGarden(t,motion,alpha,beat){
    const grow=ease((t-T.reef)/1.6), exit=alpha;
    // Kelp strands sway on the current.
    for(let i=0;i<(phone()?10:17);i++){
      const bx=-2.7+i*.35, pts=[];
      for(let s=0;s<=9;s++){
        const sway=Math.sin(motion*.6+i*.9+s*.5)*.13*(s/9);
        pts.push([bx+sway,2.2-s*.42,.3]);
      }
      path(pts,i%3===0?C.warm:C.cyan,.4*grow*exit,1.6);
    }
    // Branching corals grow up from the floor.
    const corals=phone()?5:9;
    for(let i=0;i<corals;i++)
      coral(-2.2+i*.75,2.0,-Math.PI/2+(i%2?.3:-.3),.34,4,motion,.5*grow*exit);
    // Plankton drift through the light.
    for(let i=0;i<(phone()?20:46);i++){
      const px=Math.sin(i*4.1)*2.9, py=Math.cos(i*2.6)*1.9;
      dot([px,py,((i*1.37+16-motion*1.1)%12+12)%12-2],.8,C.pale,.3*grow*exit);
    }
    // Caustic light arcs near the surface.
    for(let i=0;i<3;i++){
      const yy=-1.7-i*.3;
      path([[Math.sin(motion*.5+i)*1.5-2.4,yy,.2],[Math.sin(motion*.5+i)*1.5+2.4,yy,.2]],C.cyan,.14*grow*exit);
    }
  }
  function drawSmallFish(x,y,s,heading,color,alpha,wag){
    if(alpha<=.01)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(heading);
    ctx.fillStyle=rgba(color,alpha);
    ctx.beginPath();
    ctx.moveTo(s*.95,0);
    ctx.quadraticCurveTo(0,-s*.55,-s*.55,-s*.26);
    ctx.quadraticCurveTo(-s*.8,0,-s*.55,s*.26);
    ctx.quadraticCurveTo(0,s*.55,s*.95,0);
    ctx.fill();
    const w2=Math.sin(wag)*s*.28;
    ctx.beginPath();
    ctx.moveTo(-s*.55,0);ctx.lineTo(-s*1.15,-s*.36+w2);ctx.lineTo(-s*1.15,s*.36+w2);
    ctx.closePath();ctx.fill();
    ctx.restore();
  }
  function fishSchool(t,motion,alpha,beat){
    const enter=ease((t-T.school)/1.3), exit=alpha;
    const n=phone()?30:58;
    const tx=Math.sin(motion*.42)*1.5, ty=Math.cos(motion*.31)*.85;
    // Drifting motes keep the water itself alive around the shoal.
    for(let i=0;i<(phone()?12:26);i++){
      const mx=Math.sin(i*3.1+motion*.14)*3.1, my=Math.cos(i*1.7+motion*.1)*1.9;
      dot([mx,my,((i*1.23+10-motion*.7)%10+10)%10-2],.7,C.pale,.2*enter*exit);
    }
    // One odd fish glows red for a few seconds. Nobody mentions it.
    const redOn=!state.reduced&&t-T.school>1.4&&t-T.school<5.2;
    for(let i=0;i<n;i++){
      const ph=i*2.399, sp=.42+((i*7)%5)*.1;
      const a=motion*sp+ph;
      const r=.9+((i*13)%7)*.16;
      const px=tx+Math.cos(a)*r, py=ty+Math.sin(a*1.31)*r*.6;
      const z=((i*1.9+18-motion*1.15)%16+16)%16-2.6;
      const red=redOn&&i===7;
      const q=project([px,py,z]);
      if(!q)continue;
      drawSmallFish(q[0],q[1],Math.max(4,q[2]*.11),a+Math.PI/2,red?[255,93,93]:(i%5===0?C.warm:C.cyan),(red?1:.75)*enter*exit,state.time*9+i);
    }
  }
  function echoSignals(t,motion,alpha){
    const enter=ease((t-T.echo)/1.2), exit=alpha;
    // The opening signal, replayed as ghosts.
    const u=(t-T.echo)/3.4;
    for(let k=0;k<3;k++){
      const uu=clamp(u*1.2-k*.22);
      if(uu<=0)continue;
      ring(1.58,0,[.88,.15,.15],motion*.18,.22*(1-uu)*enter*exit,true);
      ring(2.06,.1,[.12,.7,.2],motion*.09,.14*(1-uu)*enter*exit);
    }
    // Ghost models of the first assembly orbit, flickering.
    const flick=.55+.45*Math.sin(t*17);
    for(let i=0;i<6;i++){
      const a=i/6*TAU+motion*.06;
      model(names[i],[Math.cos(a)*2.1,Math.sin(a)*2.1,.5],.2,[.2,a,motion*.05],.22*flick*enter*exit,i%2?C.cyan:C.warm);
    }
    // A reversed sweep collapses inward, pulling toward the title.
    const rev=clamp((t-T.echo)/2.6);
    for(let i=0;i<8;i++)
      ring(3.4-rev*2.6,.3+i*.12,[.1,.2,0],-motion*.1,.08*(1-rev)*enter*exit,true);
  }
  function finaleBurst(t,motion,alpha,beat){
    const enter=ease((t-T.finale)/1.2), exit=alpha;
    const u=clamp((t-T.finale)/Math.max(1,T.handoff-T.finale));
    // Everything returns at once: rings, models, a mini network, beat confetti.
    ring(1.1,0,[.2,.3,0],motion*.25,.4*enter*exit,true,C.warm);
    ring(2.3,.4,[.1,.1,0],-motion*.18,.22*enter*exit,true);
    const count=phone()?8:14;
    for(let i=0;i<count;i++){
      const a=i/count*TAU+motion*.2, r=1.9+Math.sin(u*Math.PI)*.3;
      const p=[Math.cos(a)*r,Math.sin(a)*r*.8,.3];
      model(names[i%names.length],p,.3,[.2,a,motion*.1],.6*enter*exit,i%3===0?C.warm:C.cyan);
      path([p,[p[0]*.4,p[1]*.4,.3]],C.dim,.2*enter*exit);
    }
    const mini=nodes.slice(0,40).map(v=>rotate(v.map(n=>n*.36),motion*.14,motion*.18,0));
    for(const [a,b] of links){if(b>=40)break;path([mini[a],mini[b]],C.cyan,.09*enter*exit);}
    mini.forEach((v,i)=>dot(v,.8,i%6===0?C.warm:C.pale,(.3+beat*.2)*enter*exit));
    for(let j=0;j<5;j++)ring(2.6+j*.26,j*.3-.6,[0,0,.15],motion*.1+j*.13,.11*enter*exit,true,j%2?C.warm:C.cyan);
    if(beat>.05)for(let i=0;i<(phone()?10:20);i++){
      const a=i*2.399+motion, r=1.3+((i*.37+motion*.4)%1)*1.7;
      dot([Math.cos(a)*r,Math.sin(a*1.3)*r*.8,.6],1.1,i%3?C.pale:C.warm,beat*.5*enter*exit);
    }
  }
  // ===== The hidden signal from the deep (extended cut only). =====
  // Type "fish" during the extended cut, or tap the tiny pixel fin drifting
  // through the reef and the school, and the deep answers with three locals:
  // a red fish, a blue bass, and a fin made of pixels. Each is its own thing.
  const FIN_MAP=['....##....','...####...','...####...','..######..','..######..','.########.','.########.','##########','##########'];
  const FIN_PIXELS=[];
  FIN_MAP.forEach((row,r)=>[...row].forEach((ch,c)=>{if(ch==='#')FIN_PIXELS.push({c,r,dx:Math.sin(r*3.7+c*1.3)*46,dy:Math.cos(r*1.9+c*2.7)*34,delay:(r*10+c)%9/9});}));
  let finTap=null, eggKeys='';
  function eggChime(freq,dur,delay){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      eggChime.ctx=eggChime.ctx||new AC();const ac=eggChime.ctx;
      const t0=ac.currentTime+(delay||0),o=ac.createOscillator(),g=ac.createGain();
      o.type='sine';o.frequency.value=freq;
      g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(.12,t0+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
      o.connect(g);g.connect(ac.destination);o.start(t0);o.stop(t0+dur+.05);
    }catch(e){}
  }
  function startEgg(){
    if(!state.extended||state.phase!=='playing'||state.egg>=0)return;
    state.egg=0;state.eggStart=performance.now();
    eggChime(880,.5);eggChime(1174.66,.7,.12);
  }
  function finDrift(t,alpha){
    if(state.reduced||state.egg>=0){finTap=null;return;}
    // A small fin of raw pixels drifts along the bottom of the scene.
    const span=Math.max(1,T.school-T.reef);
    const u=clamp((t-T.reef)/(span*1.35));
    const b=composition&&composition.box?composition.box:{left:0,right:w,bottom:h};
    const x=b.left+u*(b.width||w), y=b.bottom-14-Math.sin(u*Math.PI*2)*8;
    FIN_PIXELS.forEach(p=>{
      ctx.fillStyle=rgba(C.cyan,alpha*.5);
      ctx.fillRect(x+(p.c-5)*3.2,y+(p.r-4.5)*3.2,2.6,2.6);
    });
    finTap={x,y};
  }
  function drawRedFish(x,y,s){
    const wag=Math.sin(state.time*10)*.35;
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle=rgba([255,93,93],.95);
    ctx.beginPath();
    ctx.moveTo(26*s,0);
    ctx.quadraticCurveTo(6*s,-14*s,-14*s,-8*s);
    ctx.quadraticCurveTo(-20*s,0,-14*s,8*s);
    ctx.quadraticCurveTo(6*s,14*s,26*s,0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14*s,0);ctx.lineTo(-30*s,(-10+wag*10)*s);ctx.lineTo(-24*s,0);ctx.lineTo(-30*s,(10+wag*10)*s);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(6,12,18,.9)';
    ctx.beginPath();ctx.arc(16*s,-3*s,2.4*s,0,TAU);ctx.fill();
    ctx.restore();
  }
  function drawBlueBass(x,y,s){
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle=rgba([93,139,255],.95);
    // Rounder body, big mouth, spiky dorsal fin: a bass, not a minnow.
    ctx.beginPath();
    ctx.moveTo(30*s,4*s);
    ctx.quadraticCurveTo(24*s,-20*s,-4*s,-16*s);
    ctx.quadraticCurveTo(-24*s,-12*s,-26*s,0);
    ctx.quadraticCurveTo(-24*s,12*s,-4*s,16*s);
    ctx.quadraticCurveTo(24*s,20*s,30*s,4*s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8*s,-15*s);
    for(let i=0;i<4;i++){
      ctx.lineTo((-8+i*7)*s,(-25-(i%2)*4)*s);
      ctx.lineTo((-1+i*7)*s,-15*s);
    }
    ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-24*s,0);ctx.lineTo(-38*s,-12*s);ctx.lineTo(-34*s,0);ctx.lineTo(-38*s,12*s);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(6,12,18,.85)';ctx.lineWidth=2*s;
    ctx.beginPath();ctx.moveTo(29*s,5*s);ctx.quadraticCurveTo(20*s,9*s,12*s,7*s);ctx.stroke();
    ctx.beginPath();ctx.moveTo(10*s,-6*s);ctx.quadraticCurveTo(7*s,2*s,10*s,8*s);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(19*s,-6*s,3*s,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(6,12,18,.9)';ctx.beginPath();ctx.arc(19.5*s,-6*s,1.6*s,0,TAU);ctx.fill();
    ctx.restore();
  }
  function drawEgg(){
    const p=(performance.now()-state.eggStart)/1000;
    if(p>6){state.egg=-1;return;}
    ctx.fillStyle='rgba(3,7,12,.58)';ctx.fillRect(0,0,w,h);
    ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.font="12px 'IBM Plex Mono',monospace";
    ctx.fillStyle=rgba(C.warm,.95);ctx.fillText('SIGNAL FROM THE DEEP',cx,h*.14);
    // RED: a sleek courier that races across the frame, trailing light.
    const redU=clamp((p-.5)/2.2);
    if(redU>0&&redU<1){
      const x=-90+(w+180)*ease(redU), y=h*.26+Math.sin(redU*8)*10;
      for(let k=4;k>=1;k--){ctx.fillStyle=rgba([255,93,93],.10*(1-k/5));ctx.beginPath();ctx.arc(x-k*26,y,7-k,0,TAU);ctx.fill();}
      drawRedFish(x,y,1.15);
    }
    // BLUE BASS: a local that rises from below with its mouth open.
    const bassU=clamp((p-1.6)/2.2);
    if(bassU>0&&bassU<1){
      const y=h*.68+(1-ease(bassU))*h*.25;
      drawBlueBass(cx-w*.16+Math.sin(p*2)*20,y,1.1);
    }
    // PIXEL FIN: a fin assembles from raw pixels, shimmers, then dissolves.
    const finU=clamp((p-3.1)/1.4), finOut=clamp((5.6-p)/.7);
    if(finU>0&&finOut>0){
      const cell=Math.min(9,w*.011), fx=cx+w*.17, fy=h*.5;
      FIN_PIXELS.forEach(px=>{
        const u2=clamp((finU-px.delay*.35)/.65);
        const jx=(1-ease(u2))*px.dx, jy=(1-ease(u2))*px.dy;
        const x=fx+(px.c-4.5)*cell+jx, y=fy+(px.r-4)*cell+jy;
        const shimmer=.55+.45*Math.abs(Math.sin(p*6+px.c+px.r));
        const col=(px.r+px.c)%3===0?C.pale:(px.r+px.c)%3===1?C.cyan:C.warm;
        ctx.fillStyle=rgba(col,.9*finOut*shimmer);
        ctx.fillRect(x,y,cell-.9,cell-.9);
      });
    }
    ctx.textBaseline='middle';
  }
  function resolveSequence(t,motion,alpha){
    const elapsed=t-T.resolve, index=state.reduced?2:Math.min(2,Math.floor(elapsed));
    const word=score.words[Math.max(0,index)], local=state.reduced?1:elapsed-index;
    const settle=state.reduced?1:ease(local/.23);
    const b=composition.box;
    // Isolated chapter cards replace the tunnel completely at this boundary.
    ring(2.25,1,[.3,motion*.09,0],motion*.16,alpha*.35,true,C.warm);
    ring(1.75,.5,[-.4,0,.2],-motion*.12,alpha*.3,true);
    for(let i=0;i<6;i++){
      const a=i/6*TAU+motion*.12, r=2.1+(1-settle)*.5;
      model(names[i],[Math.cos(a)*r,Math.sin(a)*r,1],.22,[.2,a,motion*.1],alpha*.75,i%2?C.cyan:C.warm);
    }
    const size=Math.min(96,b.width/(word.length*.62),b.height*.30);
    ctx.fillStyle=rgba([6,12,18],alpha*.86);
    ctx.fillRect(b.left,b.top+b.height*.5-size*.7,b.width,size*1.55+32);
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`600 ${size}px 'Barlow Condensed',sans-serif`;
    ctx.fillStyle=rgba(C.pale,alpha*settle);ctx.fillText(word,cx,cy+(1-settle)*12);
    ctx.font="12px 'IBM Plex Mono',monospace";ctx.fillStyle=rgba(C.warm,alpha);
    ctx.fillText(['YOUR PEOPLE','YOUR IDEAS','YOUR SPACE'][Math.max(0,index)],cx,cy+size*.72+12);
    const length=Math.min(150,b.width*.5);
    for(let i=0;i<3;i++){
      ctx.fillStyle=rgba(i<=index?C.cyan:C.dim,alpha*.8);
      ctx.fillRect(cx-length/2+i*length/3,b.bottom-12,length/3-6,2);
    }
  }
  function drawWorld(t, poster) {
    if(!ctx)return;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#060c12';ctx.fillRect(0,0,w,h);
    const portrait=w<h, short=h<560;
    const reduced=state.reduced;
    const actual=t;
    const layers=sceneLayout.layers(score,actual,poster,reduced);
    if(reduced&&!poster)t=score.stages[Math.max(0,state.stage)].at+1.5;
    const motion=reduced?0:t;
    cx=poster?(portrait?w*.5:w*.70):w*.5;
    cy=poster?(portrait?h*.73:h*.50):(portrait?h*.43:h*.46);
    unit=Math.min(w,h)*(portrait?.255:short?.30:.275);
    if(poster&&portrait&&h<720){cy=h*.77;unit=w*.22;}
    if(!poster){
      const header=document.querySelector('.masthead').getBoundingClientRect();
      const copy=$('sequenceCopy').getBoundingClientRect();
      const footer=document.querySelector('.telemetry').getBoundingClientRect();
      const fit=sceneLayout.fit({width:w,height:h,headerBottom:header.bottom,
        copyTop:copy.top,copyRight:copy.right,footerTop:footer.top,scene:layers.scene});
      ({cx,cy,unit}=fit);
      composition={...fit,layers};
    }else composition={layers,box:null,cx,cy,unit};
    camera=poster?-.25:reduced?-.15:Math.sin(t*.22)*.23;
    const fx=timeline.effects(actual,reduced||poster);
    // Keep the handoff advance restrained and include the maximum punch in fit margins.
    zoom=!reduced&&!poster?1+fx.punch*.045+fx.kick*.008+ease((t-T.handoff)/4)*.18:1;
    if(!reduced&&!poster){cx+=Math.sin(actual*31)*fx.punch*3;cy+=Math.cos(actual*27)*fx.punch*2;}
    const fade=!reduced&&!poster&&actual>score.duration-1?1-ease(actual-(score.duration-1)):1;
    ctx.globalAlpha=fade;
    ctx.save();
    if(!poster){
      const b=composition.box;
      ctx.beginPath();ctx.rect(b.left,b.top,b.width,b.height);ctx.clip();
    }
    const active=poster?1:ease(t/1.5);
    // Dust, a receding construction grid, and depth slices establish real space.
    if(layers.signal>0)for(const s of stars.slice(0,phone()?85:160)){
      const z=((s[2]+18-motion*(t>=T.network&&t<T.identity?2.2:.16))%18+18)%18;
      dot([s[0]*9,s[1]*6,z-2],z<2?1.1:.6,C.pale,(.15+active*.12)*layers.signal);
    }
    if(layers.signal>0)for(let i=-8;i<=8;i++){
      path([[i*.7,2.15,-1],[i*.7,2.15,18]],C.dim,.15*active*layers.signal);
      path([[-7,2.15,i+8],[7,2.15,i+8]],C.dim,.11*active*layers.signal);
    }
    const beat=fx.pulse;
    // Progressive energy: the sequence gets fuller and brighter as it builds.
    const lift=poster||reduced?1:ease((t-T.assembly)/25);
    // The initial signal resolves into stacked orbital schematics.
    const ringIn=poster?1:ease((t-.3)/2);
    const ringOut=layers.signal;
    const alpha=ringIn*ringOut;
    ring(1.58,0,[.88,.15,.15],motion*.18,.45*alpha,true);
    ring(1.83,.08,[-.78,.4,-.5],-motion*.12,.35*alpha,true,C.warm);
    ring(2.06,.1,[.12,.7,.2],motion*.09,.26*alpha);
    ring(1.22,-.02,[.25,1.02,0],-motion*.22,(.42+beat*.15)*alpha,true);
    ring(2.19,.15,[1.24,.1,0],motion*.1,.16*alpha);
    if(!poster&&t<T.assembly){
      const sweep=t/T.assembly*TAU;
      path([[0,0,0],[Math.cos(sweep)*1.8,Math.sin(sweep)*1.8,0]],C.pale,.6*ringIn);
      for(let k=0;k<8;k++)dot([Math.cos(k/8*TAU)*1.58,Math.sin(k/8*TAU)*1.58,0],2,C.warm,ease((t-k*.15)/.3));
    }
    // Cards enter from far outside the frustum, settle, then pass the camera.
    const modelCount=poster?(phone()?6:8):6;
    for(let i=0;i<modelCount;i++){
      const arrival=poster?1:reduced?1:ease((t-T.assembly-i*.13)/1.6);
      if(layers.assembly<=0)continue;
      const a=i/modelCount*TAU-.3+motion*.075;
      const orbit=poster?2.02:2.05;
      const fly=1-arrival;
      const p=[Math.cos(a)*(orbit+fly*5),Math.sin(a)*(orbit*.75+fly*4),Math.sin(a*2)*.6+fly*12];
      model(names[i%names.length],p,(poster?.30:.40)+beat*.025,[Math.sin(motion*.3+i)*.3,a*.3+motion*.09,Math.sin(i+motion*.1)*.12],arrival*.9*layers.assembly,i%3===0?C.warm:C.cyan);
      if(!phone()&&i<2&&arrival>.95)annotation(p,names[i%names.length],Math.cos(a)<0?-1:1,.48*layers.assembly);
    }
    // Exploded geodesic core: separated vertices gather into one faceted object.
    const ignition=poster?1:ease((t-T.ignition)/2.1);
    const coreAlpha=(poster?.9:1)*layers.core;
    const coreScale=poster?.68:.52+ignition*.22+beat*.055+fx.punch*.09;
    const pts=ico.map((p,i)=>{
      const spread=poster?0:(1-ignition)*(.6+Math.sin(i*8)*.2);
      return rotate(p.map((v,j)=>v*(coreScale+spread)+(j===1?Math.sin(i*7)*spread*.25:0)),motion*.19,motion*.24,.1);
    });
    for(const [a,b] of edges)path([pts[a],pts[b]],C.pale,coreAlpha*(.75+lift*.1),1.25);
    pts.forEach(p=>dot(p,1.6+lift*.5,C.warm,coreAlpha*(.9+lift*.1)));
    ring(.91,0,[motion*.15,motion*.12,0],motion*.2,.26*coreAlpha,true,C.warm);
    // Inner stacked rotors and orbiting circuit fragments add a second depth scale.
    for(let layer=0;layer<3;layer++)ring(.26+layer*.12,(layer-1)*.22,[.7,motion*.08,layer*.5],-motion*.3,.25*coreAlpha,true,layer===1?C.warm:C.cyan);
    if(layers.core>0){
      for(let i=0;i<(phone()?24:48);i++){
        const a=i/48*TAU+motion*.13, r=1.05+(i%4)*.055, z=(i%3-1)*.17;
        path([[Math.cos(a)*r,Math.sin(a)*r,z],[Math.cos(a+.025)*r,Math.sin(a+.025)*r,z]],i%4===0?C.warm:C.cyan,.6*coreAlpha,1.4);
      }
    }
    if(layers.orbital>0)orbitalMachine(t,motion,layers.orbital,beat);
    // A triangulated spherical network turns into a corridor of depth planes.
    if(layers.network>0){
      const enter=reduced?1:ease((t-T.network)/1.3), exit=layers.network;
      const p=nodes.map(v=>rotate(v,motion*.09,motion*.13,0).map(n=>n*enter));
      links.forEach(([a,b],i)=>path([p[a],p[b]],i%11===0?C.warm:C.cyan,(.12+beat*.08+lift*.05)*enter*exit));
      p.forEach((v,i)=>dot(v,i%9===0?2:1,C.cyan,(.45+beat*.25+lift*.15)*enter*exit));
      for(let j=0;j<9;j++){
        const z=reduced?j*2:((j*2+18-(t-T.network)*3.5)%18+18)%18;
        ring(3.3,z-3,[0,0,.3],j*.07,.10*enter*exit,true);
      }
    }
    if(layers.warp>0)warpCorridor(t,motion,layers.warp,lift,beat);
    if(layers.deep>0)deepDive(t,motion,layers.deep,beat);
    if(layers.reef>0)reefGarden(t,motion,layers.reef,beat);
    if(layers.school>0)fishSchool(t,motion,layers.school,beat);
    if(layers.echo>0)echoSignals(t,motion,layers.echo);
    if(layers.finale>0)finaleBurst(t,motion,layers.finale,beat);
    if(!poster&&(layers.reef>0||layers.school>0))finDrift(t,Math.max(layers.reef,layers.school));
    if(layers.resolve>0)resolveSequence(t,motion,layers.resolve);
    if(!poster)drawImpact(fx,actual);
    // Six independently projected, extruded letters assemble from different axes.
    if(!poster&&t>=T.identity){
      const title='SP1DER';
      const titleFit=Math.min(1,(composition.box.width-24)/(unit*5.3*zoom));
      for(let i=0;i<title.length;i++){
        const lockAt=T.identity+i*timeline.beat;
        const u=reduced?1:ease((t-(lockAt-.6))/.6);
        const p=[(i-2.5)*.73*titleFit+(1-u)*Math.sin(i*3)*5,(1-u)*Math.cos(i*2.5)*4,(1-u)*9-.75];
        const q=project(p);if(!q)continue;
        const rx=reduced?0:(1-u)*.5, ry=reduced?0:(1-u)*1.6;
        const basisX=project(p.map((v,j)=>v+rotate([1,0,0],rx,ry,0)[j]));
        const basisY=project(p.map((v,j)=>v+rotate([0,1,0],rx,ry,0)[j]));
        if(!basisX||!basisY)continue;
        ctx.save();ctx.transform((basisX[0]-q[0])/q[2],(basisX[1]-q[1])/q[2],(basisY[0]-q[0])/q[2],(basisY[1]-q[1])/q[2],q[0],q[1]);
        ctx.font=`600 ${q[2]*1.08*titleFit}px 'Barlow Condensed',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        for(let d=6;d>=1;d--){ctx.fillStyle=rgba(C.dim,.3*u);ctx.fillText(title[i],d*.85,-d*.55);}
        const lock=fx.locks.find(cue=>cue.index===i);
        if(lock&&lock.age<.45){ctx.shadowColor=rgba(C.warm,1);ctx.shadowBlur=22*Math.exp(-lock.age*7);}
        ctx.fillStyle=rgba(C.pale,u);ctx.fillText(title[i],0,0);ctx.restore();
      }
      const a=ease((t-T.identity-2.5)/.65);
      path([[-2.3*titleFit,.66*titleFit,-.6],[2.3*titleFit,.66*titleFit,-.6]],C.warm,.6*a);
      const q=project([0,.98*titleFit,-.6]);
      if(q){ctx.font="12px 'IBM Plex Mono',monospace";ctx.textAlign='center';ctx.fillStyle=rgba(C.cyan,.85*a);ctx.fillText('YOUR PEOPLE. YOUR SPACE.',q[0],q[1]);}
    }
    // Small engineering readouts belong to the spatial artwork, not app diagnostics.
    if(!phone()&&ringIn>.8){
      const readout=t>=T.deep&&T.deep!==undefined&&t<T.school?'SONAR / ACTIVE':
        t>=T.network&&t<T.warp?'NETWORK / 110 NODES':'GEODESIC / 30 EDGES';
      annotation([-1.2,-1.15,0],readout,-1,.55*ringOut);
      annotation([1.1,.95,0],'FIRST SIGNAL / 120 BPM',1,.4*ringOut);
    }
    ctx.restore();
    if(!poster&&state.egg>=0)drawEgg();
    ctx.globalAlpha=1;
  }
  function syncAppViewport(){
    const view=window.visualViewport;
    app.style.width=(view?view.width:innerWidth)+'px';
    app.style.height=(view?view.height:innerHeight)+'px';
    app.style.top=(view?view.offsetTop:0)+'px';
    app.style.left=(view?view.offsetLeft:0)+'px';
  }
  function resize(){
    syncAppViewport();
    w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,phone()?1.5:1.8);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
    drawWorld(state.phase==='ready'?8.5:state.time,state.phase==='ready');
  }
  function playbackTime(){
    if(state.phase!=='playing')return state.time;
    if(state.mode==='pending')return state.time;
    if(state.mode==='audio')return clamp(audio.currentTime,0,score.duration);
    return clamp(state.offset+(performance.now()-state.anchor)/1000,0,score.duration);
  }
  function status(text){$('playbackStatus').textContent=text;}
  function updateStage(t){
    let index=0;score.stages.forEach((s,i)=>{if(t>=s.at)index=i;});
    if(state.stage!==index){
      state.stage=index;const s=score.stages[index];
      $('stageTag').textContent=s.tag;$('stageTitle').textContent=s.name;
    }
    const detail=timeline.story(t,state.reduced).detail;
    if($('stageDetail').textContent!==detail)$('stageDetail').textContent=detail;
    $('timecode').textContent=t.toFixed(1).padStart(4,'0')+' / '+score.duration.toFixed(1);
    $('timelineFill').style.width=t/score.duration*100+'%';
  }
  function tick(now){
    state.frame=0;if(state.phase!=='playing')return;
    state.time=playbackTime();
    if(now-state.lastPaint>(phone()?31:15)){
      updateStage(state.time);drawWorld(state.time,false);state.lastPaint=now;
    }
    if(state.time>=score.duration-.015){finish();return;}
    state.frame=requestAnimationFrame(tick);
  }
  function loop(){if(!state.frame&&state.phase==='playing')state.frame=requestAnimationFrame(tick);}
  function silentFallback(message){
    const time=state.mode==='audio'?Math.max(state.time,audio.currentTime||0):state.time;
    audio.pause();state.mode='silent';state.offset=time;state.time=time;state.anchor=performance.now();
    $('sound').hidden=true;status(message||'Silent playback.');
  }
  function syncControls(){
    if(state.stage>=0)updateStage(state.time);
    $('motion').setAttribute('aria-pressed',String(state.reduced));
    $('motion').textContent=state.reduced?'Motion reduced':'Reduce motion';
    $('sound').setAttribute('aria-pressed',String(state.muted));
    $('sound').textContent=state.muted?'Sound off':'Sound on';
    $('pause').textContent=state.phase==='paused'?'Resume':'Pause';
  }
  function start(withSound){
    if(state.phase!=='ready')return;
    state.phase='playing';state.time=0;state.offset=0;state.anchor=performance.now();
    $('gate').hidden=true;$('sequenceCopy').hidden=false;$('pause').hidden=false;
    ensureApp();updateStage(0);syncControls();loop();
    if(!withSound){state.mode='silent';status('Silent playback.');$('pause').focus();return;}
    state.mode='pending';audio.volume=.72;audio.muted=false;$('sound').hidden=false;
    status('Loading the soundtrack…');
    const attempt=()=> {
      if(state.phase==='finished')return;
      let promise;
      try{promise=audio.play();}catch(e){silentFallback('Sound unavailable. Continuing silently.');return;}
      Promise.resolve(promise).then(()=>{
        if(state.mode!=='pending'||state.phase==='finished'){audio.pause();return;}
        state.mode='audio';if(state.phase==='paused')audio.pause();
        status(state.phase==='paused'?'Paused.':'Soundtrack synchronized.');
      }).catch(()=>{if(state.mode==='pending'&&!audio.error)silentFallback('Sound unavailable. Continuing silently.');});
    };
    let source=0;
    const mirrors=[
      'https://cdn.jsdelivr.net/gh/fish01-jpg/mantle-menu@main/'+score.audio,
      'https://raw.githubusercontent.com/fish01-jpg/mantle-menu/main/'+score.audio
    ];
    audio.onerror=()=>{
      if(state.mode==='pending'&&source<mirrors.length){audio.src=mirrors[source++];attempt();}
      else if(state.mode==='pending'||state.mode==='audio')silentFallback('Sound unavailable. Continuing silently.');
    };
    attempt();
    setTimeout(()=>{if(state.mode==='pending'&&state.phase!=='finished')silentFallback('Sound took too long. Continuing silently.');},5000);
    $('pause').focus();
  }
  function togglePause(hidden){
    if(state.phase==='playing'){
      state.time=playbackTime();state.phase='paused';
      if(state.mode==='pending')state.mode='audio';
      audio.pause();
      cancelAnimationFrame(state.frame);state.frame=0;
      status(hidden?'Paused while this tab is away. Press Resume.':'Paused.');
    }else if(state.phase==='paused'){
      state.phase='playing';state.anchor=performance.now();state.offset=state.time;
      if(state.mode==='audio'){
        audio.play().then(()=>status('Soundtrack synchronized.')).catch(()=>silentFallback('Sound unavailable. Continuing silently.'));
      }else status(state.mode==='pending'?'Loading the soundtrack…':'Silent playback.');
      loop();
    }
    syncControls();
  }
  let appTimer, appController;
  function appError(){
    clearTimeout(appTimer);state.appFailed=true;state.ready=false;
    $('appStatus').textContent='APP / RETRY AVAILABLE';
    if(state.finishWanted)showRecovery(true);
  }
  function showRecovery(failed){
    $('gate').hidden=true;$('sequenceCopy').hidden=true;$('recovery').hidden=false;
    $('pause').hidden=true;$('sound').hidden=true;$('skip').hidden=true;
    $('recoveryTitle').textContent=failed?'Sp1der needs another try.':'Opening your space.';
    $('recoveryDetail').textContent=failed?'The app could not load. Check your connection, then retry. You can also return to the arcade.':'The sequence is complete. Waiting for Sp1der to load.';
    $('retry').hidden=!failed;
    (failed?$('retry'):$('arcadeBack')).focus();
  }
  function revealApp(){
    if(!state.finishWanted||!state.ready)return;
    clearTimeout(appTimer);$('recovery').hidden=true;
    app.hidden=false;app.style.visibility='visible';app.style.pointerEvents='auto';app.removeAttribute('inert');
    // The guest app is not interactive behind the nonessential intro.
    $('cinema').classList.add('leaving');$('cinema').setAttribute('inert','');
    setTimeout(()=>{$('cinema').hidden=true;app.focus();},state.reduced?0:650);
  }
  async function ensureApp(retry=false){
    if(state.appStarted&&!retry)return;
    const generation=++state.generation;
    state.appStarted=true;state.appFailed=false;state.ready=false;
    clearTimeout(appTimer);if(appController)appController.abort();
    appController=new AbortController();
    app.setAttribute('inert','');app.hidden=false;app.style.visibility='hidden';app.style.pointerEvents='none';
    $('appStatus').textContent='APP / PREPARING';
    app.onload=null;app.removeAttribute('srcdoc');app.src='about:blank';
    const target=new URL('sp1der.html',document.baseURI);
    const mirror=/^(raw\.githubusercontent\.com|.*jsdelivr\.net|.*githack\.com|cdn\.statically\.io)$/.test(target.hostname);
    // Verify HTTP success before navigating, so a 404 cannot count as readiness.
    const sources=mirror?[
      target.href,
      'https://cdn.jsdelivr.net/gh/fish01-jpg/mantle-menu@main/sp1der.html',
      'https://raw.githubusercontent.com/fish01-jpg/mantle-menu/main/sp1der.html'
    ]:[target.href];
    appTimer=setTimeout(()=>{if(generation===state.generation&&!state.ready){appController.abort();appError();}},30000);
    for(const url of sources){
      try{
        const response=await fetch(url,{signal:appController.signal});
        if(!response.ok)throw Error('HTTP '+response.status);
        const html=await response.text();
        if(!/id=["']appShell["']/.test(html))throw Error('Not the Sp1der app');
        if(generation!==state.generation)return;
        app.onload=()=>{
          if(generation!==state.generation||state.appFailed)return;
          try{if(app.contentWindow.location.href==='about:blank')return;}catch(e){/* Cross-origin HTTP app. */}
          state.ready=true;clearTimeout(appTimer);$('appStatus').textContent='APP / READY';revealApp();
        };
        app.onerror=()=>{if(generation===state.generation)appError();};
        if(!mirror&&!/text\/plain|application\/octet-stream/i.test(response.headers.get('content-type')||''))app.src=url;
        else {
          // Preserve the existing Arcade raw/CDN launcher fallback without copying the app.
          const base=new URL('.',url).href.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
          // Keep this token split: the Arcade's legacy injectBase scans the entire
          // fetched HTML, including script strings, for an existing base element.
          const baseTag='<ba'+'se href="'+base+'">';
          app.srcdoc=html.replace(/<head([^>]*)>/i,'<head$1>'+baseTag);
        }
        return;
      }catch(e){
        if(generation!==state.generation)return;
        if(appController.signal.aborted){appError();return;}
      }
    }
    appError();
  }
  function finish(){
    if(state.finishWanted)return;
    state.time=Math.min(state.time,score.duration);state.finishWanted=true;state.phase='finished';
    audio.pause();cancelAnimationFrame(state.frame);state.frame=0;
    if(!state.appStarted)ensureApp();
    status('Intro complete.');$('pause').hidden=true;$('sound').hidden=true;
    if(state.ready)revealApp();else showRecovery(state.appFailed);
  }
  // The extended cut swaps the score before playback begins; the same renderer
  // and timing drive both, and every dependent readout updates with it.
  function selectScore(extended){
    if(state.phase!=='ready'||!EXTENDED_SCORE)return;
    state.extended=!!extended;
    score=state.extended?EXTENDED_SCORE:BASE_SCORE;
    timeline=window.Sp1derTiming.create(score);T=timeline.times;
    $('ledeDuration').textContent=String(score.duration);
    $('extendedDuration').textContent=String(score.duration);
    $('extended').setAttribute('aria-pressed',String(state.extended));
    audio.src=score.audio;
    state.time=0;state.stage=-1;state.offset=0;state.egg=-1;
    updateStage(0);syncControls();resize();
  }
  $('startSound').addEventListener('click',()=>start(true));
  $('startSilent').addEventListener('click',()=>start(false));
  $('skip').addEventListener('click',finish);
  $('pause').addEventListener('click',()=>togglePause(false));
  $('sound').addEventListener('click',()=>{state.muted=!state.muted;audio.muted=state.muted;syncControls();});
  $('motion').addEventListener('click',()=>{state.reduced=!state.reduced;syncControls();drawWorld(state.time,state.phase==='ready');});
  $('retry').addEventListener('click',()=>{showRecovery(false);ensureApp(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='playing')togglePause(true);});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!state.finishWanted){e.preventDefault();finish();}
    if(e.code==='Space'&&e.target===document.body&&['playing','paused'].includes(state.phase)){e.preventDefault();togglePause(false);}
    // The hidden signal: type "fish" during the extended cut.
    if(state.extended&&/^[a-z]$/i.test(e.key)){
      eggKeys=(eggKeys+e.key.toLowerCase()).slice(-4);
      if(eggKeys==='fish')startEgg();
    }
  });
  document.addEventListener('pointerdown',e=>{
    // Or tap the tiny pixel fin drifting through the reef and the school.
    if(state.extended&&finTap&&state.egg<0&&Math.hypot(e.clientX-finTap.x,e.clientY-finTap.y)<28)startEgg();
  });
  audio.addEventListener('ended',()=>{if(state.mode==='audio'&&!state.finishWanted){state.time=score.duration;updateStage(state.time);finish();}});
  audio.addEventListener('waiting',()=>{if(state.mode==='audio'&&state.phase==='playing')status('Sync held. Buffering audio…');});
  audio.addEventListener('playing',()=>{if(state.mode==='audio'&&state.phase==='playing')status('Soundtrack synchronized.');});
  addEventListener('resize',resize);
  if(window.visualViewport){
    visualViewport.addEventListener('resize',resize);
    visualViewport.addEventListener('scroll',syncAppViewport);
  }
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const motionPreference=()=>{state.reduced=preference.matches;syncControls();drawWorld(state.time,state.phase==='ready');};
  if(preference.addEventListener)preference.addEventListener('change',motionPreference);
  // Read-only observability for beta QA. Playback is driven by the real controls.
  window.Sp1derIntroBeta=Object.freeze({
    getState:()=>({phase:state.phase,clock:state.mode,time:playbackTime(),stage:state.stage,reduced:state.reduced,appReady:state.ready,appFailed:state.appFailed}),
    getEffects:()=>timeline.effects(playbackTime(),state.reduced),
    getStory:()=>timeline.story(playbackTime(),state.reduced),
    getComposition:()=>composition?JSON.parse(JSON.stringify(composition)):null,
    get duration(){return score.duration;},
    get extended(){return state.extended;},
    get egg(){return state.egg;}
  });
  syncControls();resize();
  // The extended cut stays hidden unless its score was embedded (e.g. raw file
  // or stripped builds). ?extended=1 in the URL selects it up front.
  if(EXTENDED_SCORE){
    $('extended').hidden=false;
    $('extended').addEventListener('click',()=>selectScore(!state.extended));
    try{if(/[?&]extended=1\b/.test(location.search))selectScore(true);}catch(e){}
  }
  if(document.fonts)document.fonts.ready.then(()=>{if(state.phase==='ready')drawWorld(8.5,true);});
}());
