'use strict';
/* Brimstone Halo · sound, synthesized on the fly with Web Audio (no asset files) */

let actx = null, muted = false, noiseBuf = null, master = null;
const sfxLast = {};
function initAudio() {
  if (actx) { if (actx.resume) actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
}
function tone(type, f0, f1, dur, vol, delay) {
  const t = actx.currentTime + (delay || 0), o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, delay) {
  const t = actx.currentTime + (delay || 0), s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur);
}
const chord = (fs, dur, vol, step, type) => fs.forEach((f, i) => tone(type || 'sine', f, f * 1.002, dur, vol, i * (step || 0)));
function sfx(k) {
  if (!actx || muted) return;
  const now = performance.now(), gap = { shoot: 70, hit: 45, graze: 35, gem: 40, boom: 50, parry: 40, swing: 80, arrow: 120, bite: 90, pickup: 60 }[k] || 0;
  if (gap && now - (sfxLast[k] || 0) < gap) return; sfxLast[k] = now;
  switch (k) {
    case 'shoot': P && P.cls === 'ophan' ? tone('sine', 900, 1400, 0.07, 0.03) : tone('triangle', 1250, 620, 0.05, 0.035); break;
    case 'swing': noise(0.12, 0.08, 3000); tone('sine', 420, 220, 0.12, 0.04); break;
    case 'parry': tone('square', 1800 + Math.random() * 400, 1200, 0.05, 0.025); break;
    case 'hit': noise(0.05, 0.06, 2600); break;
    case 'graze': tone('sine', 2200 + Math.random() * 400, 2600, 0.04, 0.035); break;
    case 'gem': tone('sine', 1500 + Math.random() * 500, 2400, 0.06, 0.03); break;
    case 'boom': noise(0.28, 0.16, 900); tone('sine', 140, 50, 0.25, 0.12); break;
    case 'boom2': noise(0.5, 0.2, 1400); tone('sine', 110, 40, 0.5, 0.16); break;
    case 'hurt': tone('sawtooth', 220, 70, 0.3, 0.14); noise(0.2, 0.12, 1200); break;
    case 'dash': noise(0.18, 0.08, 4000); tone('sine', 500, 1100, 0.15, 0.05); break;
    case 'nova': tone('sine', 300, 1600, 0.4, 0.12); noise(0.4, 0.07, 6000); break;
    case 'strike': tone('sawtooth', 200, 600, 0.45, 0.05); noise(0.45, 0.05, 2500); break;
    case 'gale': noise(0.6, 0.12, 6000); chord([660, 880, 1320], 0.5, 0.04, 0.04); break;
    case 'word': chord([196, 294, 392, 587], 1.2, 0.07, 0.02, 'triangle'); noise(0.6, 0.08, 3000); break;
    case 'aegis': chord([330, 495, 660], 0.6, 0.05, 0.03, 'triangle'); noise(0.3, 0.06, 3000); break;
    case 'whirl': noise(0.9, 0.08, 5000); tone('sawtooth', 160, 320, 0.9, 0.04); break;
    case 'leap': noise(0.4, 0.07, 5000); tone('sine', 300, 900, 0.4, 0.05); break;
    case 'land': noise(0.6, 0.22, 900); tone('sine', 90, 35, 0.5, 0.18); break;
    case 'heal2': chord([523, 659, 784, 1046], 0.9, 0.06, 0.07); break;
    case 'wheel': tone('sawtooth', 120, 480, 0.6, 0.06); tone('sine', 880, 1320, 0.6, 0.04); break;
    case 'still': tone('sine', 880, 220, 1.4, 0.07); tone('sine', 1320, 330, 1.4, 0.04); break;
    case 'stream': noise(1.4, 0.07, 1800); tone('sawtooth', 90, 140, 1.4, 0.04); break;
    case 'eyes': chord([988, 1175, 1480, 1760], 0.4, 0.04, 0.03); break;
    case 'bite': noise(0.08, 0.1, 1800); tone('square', 260, 140, 0.08, 0.03); break;
    case 'dove': chord([784, 1046], 0.3, 0.05, 0.08); break;
    case 'cry': tone('sawtooth', 1800, 1100, 0.35, 0.03); break;
    case 'dive': noise(0.3, 0.14, 2600); tone('sine', 400, 120, 0.3, 0.08); break;
    case 'arrow': tone('triangle', 1600, 900, 0.06, 0.025); break;
    case 'heal': chord([660, 880], 0.18, 0.06, 0.07); break;
    case 'level': chord([523, 659, 784, 1046], 0.35, 0.07, 0.08, 'triangle'); break;
    case 'ready': chord([784, 988, 1175], 0.5, 0.06, 0.1); break;
    case 'ascend': chord([392, 494, 587, 784, 988], 1.4, 0.06, 0.06); noise(0.8, 0.06, 8000); break;
    case 'wave': tone('sawtooth', 110, 55, 0.9, 0.06); tone('sine', 220, 110, 0.9, 0.06); break;
    case 'phase': tone('sawtooth', 80, 40, 1.0, 0.12); noise(0.8, 0.12, 700); break;
    case 'bossdie': noise(1.6, 0.25, 1500); tone('sine', 120, 30, 1.5, 0.2); chord([523, 659, 784], 1.2, 0.05, 0.12); break;
    case 'die': tone('sawtooth', 300, 40, 1.4, 0.14); noise(1.2, 0.1, 800); break;
    case 'pickup': tone('triangle', 700, 1100, 0.1, 0.05); break;
    case 'rare': chord([880, 1320], 0.3, 0.05, 0.08); break;
    case 'legend': chord([523, 784, 1046, 1568], 0.9, 0.06, 0.1); break;
    case 'equip': noise(0.08, 0.06, 2000); tone('triangle', 300, 200, 0.12, 0.05); break;
    case 'salvage': noise(0.25, 0.08, 1400); tone('sine', 600, 1800, 0.2, 0.04); break;
    case 'buy': chord([659, 988, 1319], 0.5, 0.05, 0.05); break;
  }
}
