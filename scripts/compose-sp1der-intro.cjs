#!/usr/bin/env node
'use strict';
// Original deterministic synthesis. No samples, third-party recordings or music.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const score = JSON.parse(fs.readFileSync(path.join(root, 'intro/sequence.json'), 'utf8'));
const timeline = require('../intro/timing.js').create(score);
const sr = 44100, length = sr * score.duration;
const left = new Float32Array(length), right = new Float32Array(length);
let seed = 17011;
const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
function event(at, duration, fn, pan = 0) {
  const start = Math.round(at * sr), count = Math.min(Math.round(duration * sr), length - start);
  if(start < 0)throw Error('Audio event starts before zero');
  const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const sample = fn(i / sr, i / count);
    left[start + i] += sample * l; right[start + i] += sample * r;
  }
}
const tone = (f, t) => Math.sin(2 * Math.PI * f * t);
// Air bed and sub-harmonic rise.
let filtered = 0;
event(0, score.duration, (t, u) => {
  filtered = filtered * .965 + noise() * .035;
  const fade = Math.min(1, t / 2, (score.duration - t) / 2);
  return fade * (.09 * filtered + .045 * tone(36.7081, t) + .025 * tone(73.4162, t));
});
for (const stage of score.stages) {
  const notes = stage.at >= timeline.times.identity ? [146.8324,184.9972,220,293.6648] : [73.4162,146.8324,174.6141,220];
  notes.forEach((f, n) => event(stage.at, Math.min(5.3, score.duration - stage.at), (t, u) => {
    const env = Math.min(1,t/.65) * Math.pow(1-u,1.2);
    return .055 * env * (tone(f,t) + .25*tone(f*2.001,t) + .1*tone(f*3,t));
  }, (n-1.5)/3));
}
// The exact same events trigger the renderer. No independent beat timer.
for (const cue of timeline.events) {
  const {at, power, index = 0} = cue;
  if (cue.kind === 'impact') {
    // Deep cinematic downstroke, sharp attack and a wide metallic afterimage.
    event(at, 2, t => power * (
      .57 * Math.sin(2*Math.PI*(38*t + 6*(1-Math.exp(-t*22)))) * Math.exp(-t*5.5) +
      .15 * tone(73.4162,t) * Math.exp(-t*3.5) +
      .13 * noise() * Math.exp(-t*32)));
    for (const pan of [-.72,.72]) event(at, 2.2, t =>
      power*.065*(tone(587.3296,t)+.45*tone(1174.659,t)+.25*tone(1728.2,t))*Math.exp(-t*3.5), pan);
    if (at > 1) {
      let air=0;
      event(at-.9, .9, (t,u) => {
        air=air*.8+noise()*.2;
        return .25*power*u*u*(air+.2*tone(220+u*880,t));
      }, -.65);
      event(at, .65, (t,u) => .11*power*noise()*Math.exp(-t*10), .65);
    }
  } else if (cue.kind === 'pulse') {
    const f = score.notes[(index*3+Math.floor(index/8))%score.notes.length];
    event(at, .7, t => .105*(tone(f*2,t)+.2*tone(f*4,t))*Math.min(1,t/.004)*Math.exp(-t*9), Math.sin(index*.9)*.7);
    if (cue.bass) event(at, .45, t =>
      .20*Math.exp(-t*13)*Math.sin(2*Math.PI*(44*t+3*(1-Math.exp(-t*40)))));
    if (cue.snare) event(at, .23, t =>
      (.052*noise()+.045*tone(185,t))*Math.exp(-t*21), .12);
    if (at >= timeline.times.orbital && at < timeline.times.identity)
      event(at, .3, t => .045*(tone(f*4,t)+.3*tone(f*7,t))*Math.exp(-t*16), index%2?-.8:.8);
  } else if (cue.kind === 'tick') {
    let previous=0;
    event(at, .09, t => {const n=noise(), sample=(n-previous)*.015*Math.exp(-t*55);previous=n;return sample;}, index%2?-.65:.65);
  } else if (cue.kind === 'lock') {
    event(at, .75, t => .14*(tone(score.notes[index]*2,t)+.3*tone(score.notes[index]*3,t))*Math.exp(-t*8), (index-2.5)/4);
  }
}
for (const stage of score.stages.slice(1,-1)) event(stage.at+1, 1.4, (t,u) =>
  .035*Math.sin(2*Math.PI*(340*t+1250*t*t))*Math.sin(Math.PI*u)*Math.pow(1-u,1.5), -.5);
// A rising stereo transit layer leads into the title; final chord is allowed to breathe.
for(const pan of [-.8,.8]) event(timeline.times.warp, timeline.times.resolve-timeline.times.warp, (t,u) =>
  .035*(tone(146.8324*(pan<0?1:1.002),t)+.4*tone(293.6648,t))*Math.sin(Math.PI*u),pan);
// Short stereo diffusion, not an external impulse response.
for (let i = length - 1; i >= 0; i--) for (const [delay,gain] of [[.173,.15],[.293,.11],[.439,.07]]) {
  const j = i - Math.round(delay * sr);
  if (j >= 0) { left[i] += right[j]*gain; right[i] += left[j]*gain; }
}
let peak = 0;
for (let i=0;i<length;i++) peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
const wav = Buffer.alloc(44 + length*4);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(length*4,40);
for(let i=0;i<length;i++){const fade=Math.min(1,(length-i)/(sr*.25));wav.writeInt16LE(Math.round(left[i]/peak*.88*fade*32767),44+i*4);wav.writeInt16LE(Math.round(right[i]/peak*.88*fade*32767),46+i*4);}
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'sp1der-score-'));
const input = path.join(temp,'score.wav');
const output = path.join(root,score.audio);
try {
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(input,wav);
  cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','44100','-codec:a','libmp3lame','-b:a','128k','-metadata','title=Sp1der / First Signal','-metadata','artist=Fishes Arcade','-metadata','comment=Original procedurally composed score; source included in repository',output]);
  console.log('Composed '+score.duration+'s original stereo score: '+output);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
