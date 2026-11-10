// Short synthesized sound effects (Web Audio, no files). Quiet by default.
// The audio context is created on the first key press or click, since browsers
// only allow sound after a user gesture. Mute is remembered in localStorage.

const MUTE_KEY = 'stormvagt.muted';
const VOLUME = 0.22;

let ctx = null;
let master = null;
let noise = null;
let muted = false;
const muteFns = [];

try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked */ }

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    // One second of white noise, reused by every noisy effect.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);

export function isMuted() {
  return muted;
}

export function setMuted(on) {
  muted = !!on;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
  for (const fn of muteFns) fn(muted);
}

export function onMuteChange(fn) {
  muteFns.push(fn);
}

// A tone that glides from f0 to f1 with a quick attack and decay.
function tone(type, f0, f1, start, dur, vol = 0.6) {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Filtered noise; the band-pass centre glides from f0 to f1.
function hiss(f0, f1, start, dur, vol = 0.5) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}


const SOUNDS = {
  ship() { // a low fog horn
    tone('sawtooth', 110, 104, 0, 0.9, 0.22);
    tone('sawtooth', 165, 158, 0, 0.9, 0.12);
  },
  harbour() { // a bright harbour bell
    tone('sine', 1320, 1320, 0, 0.6, 0.35);
    tone('sine', 1980, 1980, 0, 0.35, 0.15);
  },
  wreck() {
    hiss(900, 120, 0, 0.7, 0.6);
    tone('square', 140, 50, 0.05, 0.5, 0.25);
  },
  break() {
    hiss(6000, 3000, 0, 0.25, 0.45);
    tone('triangle', 2400, 1800, 0, 0.08, 0.2);
  },
  lightning() {
    hiss(3000, 80, 0, 1.2, 0.7);
    tone('sawtooth', 60, 35, 0.05, 1, 0.3);
  },
  pour() { hiss(700, 400, 0, 0.5, 0.3); },
  fill() { hiss(400, 900, 0, 0.6, 0.3); },
  pump() { tone('square', 180, 120, 0, 0.12, 0.18); },
  repair() {
    [0, 0.12].forEach(t => { tone('square', 500, 260, t, 0.06, 0.3); hiss(2500, 1500, t, 0.04, 0.3); });
  },
  turn() { tone('sawtooth', 220, 330, 0, 0.25, 0.12); },
  pickup() { tone('sine', 600, 900, 0, 0.08, 0.25); },
  drop() { tone('sine', 500, 300, 0, 0.08, 0.2); },
  lampOut() { hiss(1500, 300, 0, 0.4, 0.35); },
  dawn() {
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i * 0.12, i === 3 ? 0.5 : 0.15, 0.45));
  },
  lost() {
    [392, 349, 311, 262].forEach((f, i) => tone('sawtooth', f, f * 0.97, i * 0.22, i === 3 ? 0.55 : 0.2, 0.16));
  },
};

// Play an effect by event name. Unknown names, and calls before the first
// user gesture or while muted, do nothing.
export function play(name) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const fn = SOUNDS[name];
  if (fn) fn();
}
