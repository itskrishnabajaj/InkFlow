// Synthesized sound effects via the Web Audio API. No audio files — every
// sound is generated from oscillators / noise bursts. Must be unlocked by a
// user gesture on mobile (call resume() from a tap).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this._ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) { this.muted = m; }

  _blip({ freq = 220, type = 'square', dur = 0.08, slideTo = null, vol = 1 }) {
    if (this.muted) return;
    this._ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise({ dur = 0.12, vol = 0.6, lowpass = 1800 }) {
    if (this.muted) return;
    this._ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  break() { this._noise({ dur: 0.14, vol: 0.7, lowpass: 1400 }); }
  place() { this._blip({ freq: 180, type: 'square', dur: 0.07, slideTo: 320, vol: 0.5 }); }
  click() { this._blip({ freq: 540, type: 'triangle', dur: 0.04, vol: 0.4 }); }
  step()  { this._noise({ dur: 0.06, vol: 0.25, lowpass: 700 }); }
}
