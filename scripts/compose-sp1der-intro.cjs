#!/usr/bin/env node
'use strict';
// Original deterministic synthesis. No samples, third-party recordings or music.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');

function compose(score) {
  const timeline = require('../intro/timing.js').create(score);
  const sr = 44100, length = sr * score.duration;
  const left = new Float32Array(length), right = new Float32Array(length);
  let seed = 17011;
  const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
  function event(at, duration, fn, pan = 0) {
    const start = Math.round(at * sr), count = Math.min(Math.round(duration * sr), length - start);
    if (start < 0) throw Error('Audio event starts before zero');
    const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < count; i++) {
      const sample = fn(i / sr, i / count);
      left[start + i] += sample * l; right[start + i] += sample * r;
    }
  }
  const tone = (f, t) => Math.sin(2 * Math.PI * f * t);
  // Air bed and sub-harmonic rise.
  let filtered = 0;
  event(0, score.duration, (t) => {
    filtered = filtered * .965 + noise() * .035;
    const fade = Math.min(1, t / 2, (score.duration - t) / 2);
    return fade * (.09 * filtered + .045 * tone(36.7081, t) + .025 * tone(73.4162, t));
  });
  for (const stage of score.stages) {
    const notes = stage.at >= timeline.times.identity ? [146.8324, 184.9972, 220, 293.6648] : [73.4162, 146.8324, 174.6141, 220];
    notes.forEach((f, n) => event(stage.at, Math.min(5.3, score.duration - stage.at), (t, u) => {
      const env = Math.min(1, t / .65) * Math.pow(1 - u, 1.2);
      return .055 * env * (tone(f, t) + .25 * tone(f * 2.001, t) + .1 * tone(f * 3, t));
    }, (n - 1.5) / 3));
  }
  // ===== Progressive arrangement: every stage adds another connected layer, so
  // the score stops sounding sparse early and keeps growing toward the title.
  // All layers share the same D-minor-to-D-major harmony as the stage chords.
  // The groove now arrives by ignition (pad + arpeggio + bass), not by transit. =====
  const stageIndexAt = t => { let i = 0; score.stages.forEach((s, k) => { if (t >= s.at) i = k; }); return i; };
  const titleIdx = score.stages.findIndex(s => s.id === 'identity');
  const rootOf = i => i >= titleIdx ? 146.8324 : 73.4162;   // D3 from the title on, D2 before
  const fifthOf = i => i >= titleIdx ? 220 : 110;           // A2 / A3
  const frac = i => i / Math.max(1, score.stages.length - 1);
  const ARP = [146.8324, 174.6141, 220, 261.6256, 220, 174.6141];
  const ARP_TITLE = [293.6648, 369.9944, 440, 587.3296, 440, 369.9944];
  const BASS_PATTERN = i => [1, 1, 1.5, 1, 2, 1, 1.5, 1];
  // 1) Warm pad bed under every stage, thickening stage by stage.
  score.stages.forEach((stage, i) => {
    const end = score.stages[i + 1]?.at ?? score.duration;
    const level = (i === 0 ? .010 : .020) + frac(i) * .030;
    [rootOf(i), fifthOf(i), rootOf(i) * 2].forEach((f, n) => event(stage.at, end - stage.at, (t) => {
      const fade = Math.min(1, t / .8, (end - stage.at - t) / .6);
      return level * fade * (.6 * tone(f, t) + .25 * tone(f * 1.004, t) + .18 * tone(f * 2, t));
    }, (n - 1) * .45));
  });
  // 2) Plucked arpeggio from assembly on; an octave up from warp, brighter at the title.
  const arpEnd = timeline.times.identity + 5 * timeline.beat + .25;
  for (let at = timeline.times.assembly; at < arpEnd; at += timeline.beat / 2) {
    const i = stageIndexAt(at), step = Math.round(at / (timeline.beat / 2));
    const title = at >= timeline.times.identity;
    const f = (title ? ARP_TITLE : ARP)[step % 6] * (at >= timeline.times.warp && !title ? 2 : 1);
    const level = .022 + frac(i) * .044;
    event(at, .38, t => level * (tone(f, t) + .2 * tone(f * 2, t)) * Math.exp(-t * 9), step % 2 ? .6 : -.6);
  }
  // 3) Driving bass line from ignition on: root/fifth/octave eighths that gain weight.
  for (let at = timeline.times.ignition; at < timeline.times.identity + 5 * timeline.beat; at += timeline.beat / 2) {
    const i = stageIndexAt(at), step = Math.round(at / (timeline.beat / 2));
    const f = rootOf(i) * BASS_PATTERN(i)[step % 8];
    const level = .062 + frac(i) * .04;
    event(at, .3, t => level * (tone(f, t) + .3 * tone(f * 2.002, t)) * Math.min(1, t / .006) * Math.exp(-t * 7));
  }
  // 4) Off-beat shaker from orbital on, gaining presence every stage.
  for (let at = timeline.times.orbital + timeline.beat / 2; at < timeline.times.identity + 5 * timeline.beat; at += timeline.beat) {
    const i = stageIndexAt(at);
    let air = 0;
    event(at, .12, t => { air = air * .82 + noise() * .18; return (.022 + frac(i) * .04) * air * Math.exp(-t * 30); }, .35);
  }
  // 5) Sixteenth-note drive from network on: the upbeat push into the title.
  for (let at = timeline.times.network; at < timeline.times.identity + 5 * timeline.beat; at += timeline.beat / 4) {
    const step = Math.round(at / (timeline.beat / 4));
    const i = stageIndexAt(at);
    const f = rootOf(i) * [1, 1, 1.5, 1][step % 4];
    const accent = step % 4 === 0 ? 1 : .55;
    event(at, .16, t => .039 * accent * tone(f * 2, t) * Math.min(1, t / .004) * Math.exp(-t * 18), step % 2 ? .25 : -.25);
  }
  // 6) Lead melody from warp on: the phrase plays twice — at warp and again at
  // resolve — and swells toward the title, where it lands on D major.
  const leadUntil = timeline.times.identity + 5 * timeline.beat;
  const leadPasses = [timeline.times.warp, timeline.times.resolve]
    .filter(base => base < leadUntil);
  const LEAD_NOTES = [[0, 293.6648], [.5, 349.2282], [1, 440], [1.5, 392], [2, 440], [2.5, 523.2511],
    [3, 587.3296], [3.5, 440], [4, 369.9944], [4.5, 440], [5, 587.3296], [5.5, 587.3296]];
  for (const leadFrom of leadPasses) for (const [off, f] of LEAD_NOTES) {
    const at = leadFrom + off;
    if (at > leadUntil) break;
    const title = at >= timeline.times.identity;
    const towardTitle = Math.min(1, Math.max(0, (at - timeline.times.warp) /
      Math.max(1, timeline.times.identity - timeline.times.warp)));
    const level = .055 + towardTitle * .036;
    event(at, .62, t => {
      const vib = f * (1 + .004 * Math.sin(2 * Math.PI * 5 * t));
      return level * Math.min(1, t / .02) * Math.exp(-t * 2.2) *
        (tone(vib, t) + (title ? .4 * tone(vib * 2, t) : .18 * tone(vib * 2, t)));
    }, .15);
  }
  // 7) Shimmering bell sparkle through the title locks, panned wide.
  const BELLS = [587.3296, 880, 739.9889, 1174.659];
  for (let at = timeline.times.identity, k = 0; at < arpEnd; at += timeline.beat / 4, k++) {
    event(at, .3, t => .019 * (tone(BELLS[k % 4], t) + .3 * tone(BELLS[k % 4] * 2.76, t)) * Math.exp(-t * 12), k % 2 ? .75 : -.75);
  }
  // 8) Final warm bloom under the handoff: the whole stack landing on one D major chord.
  for (const [f, n] of [[146.8324, -.5], [220, 0], [293.6648, .25], [369.9944, .5], [440, .7]])
    event(timeline.times.handoff, 1.8, (t, u) =>
      .07 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (tone(f, t) + .2 * tone(f * 2, t)), n);
  // The exact same events trigger the renderer. No independent beat timer.
  for (const cue of timeline.events) {
    const { at, power, index = 0 } = cue;
    if (cue.kind === 'impact') {
      // Deep cinematic downstroke, sharp attack and a wide metallic afterimage.
      event(at, 2, t => power * (
        .57 * Math.sin(2 * Math.PI * (38 * t + 6 * (1 - Math.exp(-t * 22)))) * Math.exp(-t * 5.5) +
        .15 * tone(73.4162, t) * Math.exp(-t * 3.5) +
        .13 * noise() * Math.exp(-t * 32)));
      for (const pan of [-.72, .72]) event(at, 2.2, t =>
        power * .065 * (tone(587.3296, t) + .45 * tone(1174.659, t) + .25 * tone(1728.2, t)) * Math.exp(-t * 3.5), pan);
      if (at > 1) {
        let air = 0;
        event(at - .9, .9, (t, u) => {
          air = air * .8 + noise() * .2;
          return .25 * power * u * u * (air + .2 * tone(220 + u * 880, t));
        }, -.65);
        event(at, .65, (t) => .11 * power * noise() * Math.exp(-t * 10), .65);
      }
    } else if (cue.kind === 'pulse') {
      const f = score.notes[(index * 3 + Math.floor(index / 8)) % score.notes.length];
      event(at, .7, t => .105 * (tone(f * 2, t) + .2 * tone(f * 4, t)) * Math.min(1, t / .004) * Math.exp(-t * 9), Math.sin(index * .9) * .7);
      if (cue.bass) event(at, .45, t =>
        .20 * Math.exp(-t * 13) * Math.sin(2 * Math.PI * (44 * t + 3 * (1 - Math.exp(-t * 40)))));
      if (cue.snare) event(at, .23, t =>
        (.052 * noise() + .045 * tone(185, t)) * Math.exp(-t * 21), .12);
      if (at >= timeline.times.orbital && at < timeline.times.identity)
        event(at, .3, t => .045 * (tone(f * 4, t) + .3 * tone(f * 7, t)) * Math.exp(-t * 16), index % 2 ? -.8 : .8);
    } else if (cue.kind === 'tick') {
      let previous = 0;
      event(at, .09, t => { const n = noise(), sample = (n - previous) * .015 * Math.exp(-t * 55); previous = n; return sample; }, index % 2 ? -.65 : .65);
    } else if (cue.kind === 'lock') {
      event(at, .75, t => .14 * (tone(score.notes[index] * 2, t) + .3 * tone(score.notes[index] * 3, t)) * Math.exp(-t * 8), (index - 2.5) / 4);
    }
  }
  for (const stage of score.stages.slice(1, -1)) event(stage.at + 1, 1.4, (t, u) =>
    .035 * Math.sin(2 * Math.PI * (340 * t + 1250 * t * t)) * Math.sin(Math.PI * u) * Math.pow(1 - u, 1.5), -.5);
  // A rising stereo transit layer leads into the title; final chord is allowed to breathe.
  for (const pan of [-.8, .8]) event(timeline.times.warp, timeline.times.resolve-timeline.times.warp, (t, u) =>
    .035 * (tone(146.8324 * (pan < 0 ? 1 : 1.002), t) + .4 * tone(293.6648, t)) * Math.sin(Math.PI * u), pan);
  // Short stereo diffusion, not an external impulse response.
  for (let i = length - 1; i >= 0; i--) for (const [delay, gain] of [[.173, .15], [.293, .11], [.439, .07]]) {
    const j = i - Math.round(delay * sr);
    if (j >= 0) { left[i] += right[j] * gain; right[i] += left[j] * gain; }
  }
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const wav = Buffer.alloc(44 + length * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(length * 4, 40);
  for (let i = 0; i < length; i++) { const fade = Math.min(1, (length - i) / (sr * .25)); wav.writeInt16LE(Math.round(left[i] / peak * .88 * fade * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(right[i] / peak * .88 * fade * 32767), 46 + i * 4); }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp1der-score-'));
  const input = path.join(temp, 'score.wav');
  const output = path.join(root, score.audio);
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(input, wav);
    // Two-pass linear loudness normalization: one static gain instead of dynamic
    // compression, so the progressive stage-by-stage build-up survives the master.
    const probe = cp.spawnSync('ffmpeg', ['-hide_banner', '-i', input, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
    const log = (probe.stdout || '') + (probe.stderr || '');
    const m = JSON.parse(log.slice(log.indexOf('{'), log.lastIndexOf('}') + 1));
    cp.execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-af',
      `loudnorm=I=-16:TP=-1.5:LRA=9:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}`,
      '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '128k', '-metadata', 'title=Sp1der / First Signal', '-metadata', 'artist=Fishes Arcade', '-metadata', 'comment=Original procedurally composed score; source included in repository', output]);
    console.log('Composed ' + score.duration + 's original stereo score: ' + output);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

for (const file of ['intro/sequence.json', 'intro/sequence-extended.json']) {
  if (fs.existsSync(path.join(root, file))) compose(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')));
}
