#!/usr/bin/env node
'use strict';
// Original deterministic synthesis. No samples, third-party recordings or music.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const score = JSON.parse(fs.readFileSync(path.join(root, 'intro/sequence.json'), 'utf8'));
const sr = 44100, length = sr * score.duration;
const left = new Float32Array(length), right = new Float32Array(length);
let seed = 17011;
const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
function event(at, duration, fn, pan = 0) {
  const start = Math.round(at * sr), count = Math.min(Math.round(duration * sr), length - start);
  const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const sample = fn(i / sr, i / count);
    left[start + i] += sample * l; right[start + i] += sample * r;
  }
}
const tone = (f, t) => Math.sin(2 * Math.PI * f * t);
// Air bed and sub-harmonic rise.
let filtered = 0;
event(0, 22, (t, u) => {
  filtered = filtered * .965 + noise() * .035;
  const fade = Math.min(1, t / 2, (22 - t) / 2);
  return fade * (.09 * filtered + .045 * tone(36.7081, t) + .025 * tone(73.4162, t));
});
for (const stage of score.stages) {
  const notes = stage.at >= 19 ? [146.8324,184.9972,220,293.6648] : [73.4162,146.8324,174.6141,220];
  notes.forEach((f, n) => event(stage.at, Math.min(5.3, 22 - stage.at), (t, u) => {
    const env = Math.min(1,t/.65) * Math.pow(1-u,1.2);
    return .055 * env * (tone(f,t) + .25*tone(f*2.001,t) + .1*tone(f*3,t));
  }, (n-1.5)/3));
}
// Precisely scored impacts, metallic harmonic tails and stereo pass-bys.
for (const at of score.impacts) {
  event(at, 1.8, t => .33 * Math.exp(-t*6) * Math.sin(2*Math.PI*(42*t + 12*(1-Math.exp(-t*14)))) + noise()*.08*Math.exp(-t*15));
  event(at, 2.1, t => .045 * (tone(587.3296,t)+.5*tone(1174.659,t)+.3*tone(1728.2,t))*Math.exp(-t*3), .3);
  if (at >= 3) event(at-.65, .65, (t,u) => noise()*.15*u*u*Math.sin(Math.PI*u), -.65);
}
for (let beat = 0; beat < 32; beat++) {
  const at = 3 + beat * .5, f = score.notes[(beat * 3 + Math.floor(beat / 8)) % score.notes.length];
  event(at, .8, t => .12 * (tone(f*2,t)+.22*tone(f*4,t)) * Math.min(1,t/.008) * Math.exp(-t*8), Math.sin(beat*.9)*.7);
  if (beat % 2 === 0) event(at, .32, t => .23*Math.exp(-t*18)*Math.sin(2*Math.PI*(44*t+5*(1-Math.exp(-t*40)))));
  event(at+.25, .13, t => noise()*.035*Math.exp(-t*44), beat%2 ? -.65:.65);
}
for (const at of [5,9,13,17]) event(at, 1.4, (t,u) => .045*Math.sin(2*Math.PI*(340*t+1250*t*t))*Math.sin(Math.PI*u)*Math.pow(1-u,1.5), -.5);
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
const output = path.join(root,'assets/intro/sp1der-intro-beta.mp3');
try {
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(input,wav);
  cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','44100','-codec:a','libmp3lame','-b:a','128k','-metadata','title=Sp1der / First Signal','-metadata','artist=Fishes Arcade','-metadata','comment=Original procedurally composed score; source included in repository',output]);
  console.log('Composed '+score.duration+'s original stereo score: '+output);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
