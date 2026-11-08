(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sp1derTiming = factory();
}(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  // Used unchanged by the audio composer and embedded browser renderer.
  function create(score) {
    const beat = 60 / score.bpm;
    const times = Object.fromEntries(score.stages.map(s => [s.id, s.at]));
    const events = score.hits.map(hit => ({...hit, kind: 'impact'}));
    for (let i = 0; score.rhythm.from + i * beat < score.rhythm.until; i++) {
      const at = score.rhythm.from + i * beat;
      events.push({kind: 'pulse', at, index: i, bass: i % 2 === 0, snare: i % 4 === 2,
        power: i % 8 === 0 ? 1 : i % 2 === 0 ? .8 : .4});
      events.push({kind: 'tick', at: at + beat / 2, index: i, power: .2});
    }
    for (let i = 0; i < 6; i++) events.push({kind: 'lock', at: times.identity + i * beat, index: i, power: .65});
    events.sort((a,b) => a.at - b.at);
    function effects(t, reduced = false) {
      if (reduced) return {pulse: 0, kick: 0, punch: 0, charge: 0, hits: [], locks: [], next: null};
      let pulse = 0, kick = 0, punch = 0;
      const hits = [], locks = [];
      for (const event of events) {
        const age = t - event.at;
        if (age < 0 || age > 2) continue;
        if (event.kind === 'impact') {
          hits.push({...event, age});
          punch = Math.max(punch, event.power * Math.exp(-age * 8));
        } else if (event.kind === 'pulse') {
          const energy = event.power * Math.exp(-age * 11);
          pulse = Math.max(pulse, energy);
          if (event.bass) kick = Math.max(kick, energy);
        } else if (event.kind === 'lock') locks.push({...event, age});
      }
      const next = score.hits.find(hit => hit.at > t && hit.at - t <= .9) || null;
      const charge = next ? Math.pow(1 - (next.at - t) / .9, 2) * next.power : 0;
      return {pulse, kick, punch, charge, hits, locks, next};
    }
    return Object.freeze({events, times, beat, effects});
  }
  return Object.freeze({create});
}));
