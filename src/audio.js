/* İçərişəhər Runner — procedural audio. No sample files anywhere.

   The soundtrack is a small 6/8 band: nağara and def holding a yallı groove,
   a bass pumping the root, a tar picking phrases out of the district's maqam,
   and a zurna taking the lead every other section. Everything runs through a
   generated plate reverb, so the alleys sound like alleys and the hamam
   sounds like a hamam. */
(function (ICH) {
  'use strict';
  const U = ICH.U;

  /* Melodic cells written as scale degrees (null = rest) over a 12-step bar.
     The tar walks these instead of wandering, which is what makes it read as
     a tune rather than a random arpeggiator. */
  const MOTIFS = [
    [0, null, 1, 2, null, 1, 0, null, -1, 0, null, null],
    [4, 3, 2, null, 3, 2, 1, null, 0, null, 1, null],
    [0, 2, 4, null, 3, null, 2, 1, 0, null, null, null],
    [2, null, 2, 3, 4, null, 5, 4, 3, 2, null, null],
    [0, null, null, 0, 1, 0, -1, -2, null, 0, null, null],
    [7, 6, 5, 4, null, 5, 4, 3, null, 2, null, null],
  ];

  // dum = deep hit, tek = rim. Classic 6/8 dance figure with the lift on 7.
  const DUM = [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0];
  const TEK = [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1];
  const DEF = [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1];

  const A = {
    ctx: null,
    ready: false,
    muted: false,
    playing: false,
    intensity: 0,
    combat: 0,

    master: null,
    sfxBus: null,
    musicBus: null,
    noiseBuf: null,

    _step: 0,
    _bar: 0,
    _next: 0,
    _timer: 0,
    _drones: [],
    _motif: 0,
    _coinChain: 0,
    _coinT: 0,

    /* ------------------------------------------------------------- setup */
    init() {
      if (this.ctx) return;
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const ctx = this.ctx;

      // a gentle limiter keeps the mix punchy when a lot happens at once
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -14;
      this.limiter.knee.value = 22;
      this.limiter.ratio.value = 6;
      this.limiter.attack.value = 0.004;
      this.limiter.release.value = 0.22;
      this.limiter.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.limiter);

      // plate reverb built from a generated impulse
      this.verb = ctx.createConvolver();
      this.verb.buffer = this._makeIR(2.2, 3.1);
      this.verbReturn = ctx.createGain();
      this.verbReturn.gain.value = 0.9;
      this.verb.connect(this.verbReturn);
      this.verbReturn.connect(this.master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.6;
      this.sfxBus.connect(this.master);
      this.sfxSend = ctx.createGain();
      this.sfxSend.gain.value = 0.12;
      this.sfxBus.connect(this.sfxSend);
      this.sfxSend.connect(this.verb);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.0;
      this.musicBus.connect(this.master);
      this.musicSend = ctx.createGain();
      this.musicSend.gain.value = 0.22;
      this.musicBus.connect(this.musicSend);
      this.musicSend.connect(this.verb);

      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      this.ready = true;
    },

    _makeIR(seconds, decay) {
      const rate = this.ctx.sampleRate;
      const n = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(2, n, rate);
      const e1 = Math.floor(rate * 0.017);
      const e2 = Math.floor(rate * 0.029);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < n; i++) {
          const t = i / n;
          // a couple of early reflections give it a room, not just a wash
          const early = i === e1 ? 0.6 : i === e2 ? 0.45 : 0;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early;
        }
      }
      return buf;
    },

    unlock() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
      }
      return this.muted;
    },

    toggleMute() { return this.setMuted(!this.muted); },

    /* ------------------------------------------------------ voice helpers */
    _env(node, t, atk, dec, peak) {
      const g = node.gain;
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + atk);
      g.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    },

    _pan(node, amount) {
      if (!this.ctx.createStereoPanner) return node;
      const p = this.ctx.createStereoPanner();
      p.pan.value = amount;
      node.connect(p);
      return p;
    },

    tone(o) {
      if (!this.ready) return;
      const t = o.at || this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), t + (o.slide || o.dur));
      if (o.detune) osc.detune.value = o.detune;
      let node = osc;
      if (o.filter) {
        const flt = this.ctx.createBiquadFilter();
        flt.type = o.filterType || 'lowpass';
        flt.frequency.setValueAtTime(o.filter, t);
        if (o.filterTo) flt.frequency.exponentialRampToValueAtTime(Math.max(o.filterTo, 20), t + o.dur);
        flt.Q.value = o.q || 1;
        osc.connect(flt);
        node = flt;
      }
      node.connect(gain);
      let out = gain;
      if (o.pan) out = this._pan(gain, o.pan);
      out.connect(o.bus || this.sfxBus);
      this._env(gain, t, o.atk || 0.005, o.dur, o.gain === undefined ? 0.25 : o.gain);
      osc.start(t);
      osc.stop(t + (o.atk || 0.005) + o.dur + 0.06);
      return osc;
    },

    noise(o) {
      if (!this.ready) return;
      const t = o.at || this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = o.rate || 1;
      const flt = this.ctx.createBiquadFilter();
      flt.type = o.filterType || 'bandpass';
      flt.frequency.setValueAtTime(o.f, t);
      if (o.to) flt.frequency.exponentialRampToValueAtTime(Math.max(o.to, 20), t + o.dur);
      flt.Q.value = o.q || 1;
      const gain = this.ctx.createGain();
      src.connect(flt);
      flt.connect(gain);
      let out = gain;
      if (o.pan) out = this._pan(gain, o.pan);
      out.connect(o.bus || this.sfxBus);
      this._env(gain, t, o.atk || 0.004, o.dur, o.gain === undefined ? 0.25 : o.gain);
      src.start(t);
      src.stop(t + o.dur + 0.12);
    },

    /** Short melodic run — the backbone of every fanfare and pickup jingle. */
    run(freqs, o) {
      o = o || {};
      const c = this.ctx.currentTime;
      freqs.forEach((f, i) => {
        this.tone({
          f, dur: o.dur || 0.16, type: o.type || 'triangle',
          gain: o.gain === undefined ? 0.2 : o.gain,
          at: c + i * (o.gap || 0.06), filter: o.filter, q: o.q,
        });
      });
    },

    /* -------------------------------------------------------------- sfx */
    play(name) {
      if (!this.ready || this.muted) return;
      const c = this.ctx.currentTime;
      switch (name) {
        case 'jump':
          this.tone({ f: 300, to: 720, dur: 0.13, type: 'triangle', gain: 0.3 });
          this.noise({ f: 900, to: 2600, dur: 0.1, gain: 0.07, q: 0.7 });
          break;
        case 'djump':
          this.tone({ f: 520, to: 1040, dur: 0.12, type: 'square', gain: 0.16 });
          this.tone({ f: 780, to: 1560, dur: 0.1, type: 'triangle', gain: 0.1, at: c + 0.02 });
          this.noise({ f: 2600, to: 900, dur: 0.16, gain: 0.1, q: 0.6 });
          break;
        case 'land':
          this.noise({ f: 420, to: 150, dur: 0.09, filterType: 'lowpass', gain: 0.22 });
          this.tone({ f: 130, to: 70, dur: 0.08, type: 'sine', gain: 0.16 });
          break;
        case 'step':
          this.noise({ f: 1400, to: 700, dur: 0.035, gain: 0.05, q: 1.4 });
          break;
        case 'slash':
          // whoosh, then the ring of the blade
          this.noise({ f: 2600, to: 480, dur: 0.14, q: 1.7, gain: 0.28 });
          this.tone({ f: 1900, to: 2600, dur: 0.09, type: 'triangle', gain: 0.07, at: c + 0.03 });
          break;
        case 'throw':
          this.tone({ f: 320, to: 110, dur: 0.16, type: 'sine', gain: 0.22 });
          this.noise({ f: 1200, to: 400, dur: 0.12, gain: 0.06, q: 1.2 });
          break;
        case 'coin': {
          // a streak of coins climbs in pitch, so it sounds like one phrase
          if (c - this._coinT > 1.1) this._coinChain = 0;
          else this._coinChain = Math.min(this._coinChain + 1, 14);
          this._coinT = c;
          const k = Math.pow(2, this._coinChain / 12);
          this.tone({ f: 988 * k, dur: 0.055, type: 'square', gain: 0.13 });
          this.tone({ f: 1480 * k, dur: 0.1, type: 'square', gain: 0.11, at: c + 0.05 });
          this.tone({ f: 2960 * k, dur: 0.06, type: 'sine', gain: 0.05, at: c + 0.05 });
          break;
        }
        case 'gem':
          this.run([880, 1174, 1568, 2093, 2637], { dur: 0.13, gain: 0.15, gap: 0.05 });
          break;
        case 'heal':
          this.run([523, 659, 784, 1046], { dur: 0.18, type: 'sine', gain: 0.2, gap: 0.07 });
          break;
        case 'sweet':
          this.run([784, 988, 1318], { dur: 0.12, type: 'triangle', gain: 0.16, gap: 0.05 });
          break;
        case 'power':
          this.run([392, 523, 659, 784, 1046, 1318], { dur: 0.2, type: 'sawtooth', gain: 0.11, gap: 0.05, filter: 2600 });
          this.tone({ f: 98, to: 196, dur: 0.5, type: 'sine', gain: 0.22 });
          break;
        case 'kill':
          this.noise({ f: 1400, to: 200, dur: 0.16, gain: 0.28, q: 0.8 });
          this.tone({ f: 240, to: 70, dur: 0.16, type: 'square', gain: 0.16 });
          break;
        case 'break':
          this.noise({ f: 3400, to: 700, dur: 0.22, gain: 0.24, q: 0.5 });
          this.noise({ f: 1200, to: 300, dur: 0.14, gain: 0.14, q: 0.9, at: c + 0.03 });
          break;
        case 'clang':
          this.tone({ f: 1760, dur: 0.28, type: 'square', gain: 0.12, filter: 3200, q: 6 });
          this.tone({ f: 2640, dur: 0.22, type: 'triangle', gain: 0.07, at: c + 0.01 });
          break;
        case 'bounce':
          this.tone({ f: 420, to: 940, dur: 0.1, type: 'sine', gain: 0.24 });
          break;
        case 'hurt':
          this.tone({ f: 300, to: 80, dur: 0.32, type: 'sawtooth', gain: 0.26, filter: 1200, filterTo: 300 });
          this.noise({ f: 700, to: 200, dur: 0.2, gain: 0.14, filterType: 'lowpass' });
          break;
        case 'rope':
          this.tone({ f: 180, to: 150, dur: 0.22, type: 'triangle', gain: 0.2, filter: 900 });
          this.noise({ f: 2400, to: 1200, dur: 0.09, gain: 0.06, q: 1.6 });
          break;
        case 'die':
          [440, 349, 262, 196, 131].forEach((f, i) =>
            this.tone({ f, dur: 0.3, type: 'square', gain: 0.2, at: c + i * 0.13, filter: 1800 })
          );
          break;
        case 'bark':
          this.tone({ f: 440, to: 190, dur: 0.09, type: 'sawtooth', gain: 0.22, filter: 1400 });
          this.tone({ f: 300, to: 150, dur: 0.1, type: 'square', gain: 0.14, at: c + 0.1 });
          break;
        case 'bow':
          this.noise({ f: 1800, to: 600, dur: 0.1, q: 2.2, gain: 0.2 });
          this.tone({ f: 700, to: 260, dur: 0.12, type: 'triangle', gain: 0.14 });
          break;
        case 'slam':
          this.tone({ f: 110, to: 32, dur: 0.36, type: 'sine', gain: 0.5 });
          this.noise({ f: 700, to: 110, dur: 0.3, filterType: 'lowpass', gain: 0.32 });
          break;
        case 'wings':
          for (let i = 0; i < 5; i++) {
            this.noise({ f: 900 + i * 120, to: 400, dur: 0.07, q: 1.4, gain: 0.09, at: c + i * 0.055 });
          }
          break;
        case 'steam':
          this.noise({ f: 2600, to: 900, dur: 0.5, q: 0.5, gain: 0.16 });
          break;
        case 'roar':
          this.tone({ f: 150, to: 50, dur: 0.75, type: 'sawtooth', gain: 0.34, filter: 900, filterTo: 200 });
          this.noise({ f: 520, to: 110, dur: 0.75, filterType: 'lowpass', gain: 0.26 });
          this.tone({ f: 76, to: 36, dur: 0.95, type: 'sine', gain: 0.34, at: c + 0.05 });
          break;
        case 'gate': // the way out grinding open
          this.noise({ f: 300, to: 90, dur: 1.1, filterType: 'lowpass', gain: 0.24 });
          this.tone({ f: 60, to: 44, dur: 1.2, type: 'sine', gain: 0.3 });
          break;
        case 'fanfare': // a district falls
          this.run([392, 523, 659, 784], { dur: 0.24, type: 'sawtooth', gain: 0.16, gap: 0.11, filter: 2400, q: 3 });
          this.run([784, 1046], { dur: 0.6, type: 'sawtooth', gain: 0.14, gap: 0.44, filter: 2600, q: 4 });
          this.tone({ f: 98, dur: 1.1, type: 'sine', gain: 0.3 });
          break;
        case 'levelup': // the whole city, once around
          [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => {
            this.tone({ f, dur: 0.3, type: 'sawtooth', gain: 0.14, at: c + i * 0.09, filter: 3000, q: 3 });
            this.tone({ f: f / 2, dur: 0.3, type: 'triangle', gain: 0.1, at: c + i * 0.09 });
          });
          this.tone({ f: 65.4, dur: 1.6, type: 'sine', gain: 0.3 });
          break;
        case 'ui':
          this.tone({ f: 660, dur: 0.07, type: 'square', gain: 0.14 });
          break;
        case 'start':
          this.run([294, 392, 466, 587, 698], { dur: 0.24, type: 'sawtooth', gain: 0.13, gap: 0.09, filter: 2200 });
          break;
      }
    },

    /* ------------------------------------------------------------ music */
    SCALE: [0, 1, 4, 5, 7, 8, 11],
    ROOT: 146.83,
    BPM: 138,
    MIX: { reverb: 0.22, def: true, zurna: true },

    /** Each district plays in its own maqam, root, tempo and instrumentation. */
    setMode(m) {
      if (!m) return;
      this.SCALE = m.scale || this.SCALE;
      this.ROOT = m.root || this.ROOT;
      this.BPM = m.bpm || this.BPM;
      this.MIX = {
        reverb: m.reverb === undefined ? 0.22 : m.reverb,
        def: m.def !== false,
        zurna: m.zurna !== false,
      };
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.musicSend.gain.setTargetAtTime(this.MIX.reverb, t, 0.8);
      this.sfxSend.gain.setTargetAtTime(0.06 + this.MIX.reverb * 0.35, t, 0.8);
      this._drones.forEach((o) => {
        if (o.frequency && o._droneMult) {
          o.frequency.setTargetAtTime((this.ROOT / 2) * o._droneMult, t, 0.6);
        }
      });
    },

    setIntensity(v) { this.intensity = U.clamp(v, 0, 1); },

    /** Boss fights drop the tune into a harder, faster gear. */
    setCombat(on) {
      const want = on ? 1 : 0;
      if (this.combat === want) return;
      this.combat = want;
      if (this.ready && this.playing) {
        this.musicBus.gain.setTargetAtTime(on ? 0.36 : 0.3, this.ctx.currentTime, 0.4);
      }
    },

    startMusic() {
      if (!this.ready || this.playing) return;
      this.playing = true;
      this._step = 0;
      this._bar = 0;
      this._next = this.ctx.currentTime + 0.08;
      this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicBus.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.6);

      // balaban drone: root and fifth, breathing slightly out of step
      [1, 1.5].forEach((mult, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = (this.ROOT / 2) * mult;
        osc.detune.value = i * 7 - 3;
        osc._droneMult = mult;
        const flt = this.ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = 430;
        const g = this.ctx.createGain();
        g.gain.value = 0.07;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.13 + i * 0.05;
        const lfoG = this.ctx.createGain();
        lfoG.gain.value = 0.028;
        lfo.connect(lfoG);
        lfoG.connect(g.gain);
        osc.connect(flt);
        flt.connect(g);
        g.connect(this.musicBus);
        osc.start();
        lfo.start();
        this._drones.push(osc, lfo);
      });

      this._timer = setInterval(() => this._schedule(), 25);
    },

    stopMusic() {
      if (!this.playing) return;
      this.playing = false;
      clearInterval(this._timer);
      const t = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setTargetAtTime(0.0001, t, 0.25);
      this._drones.forEach((o) => {
        try { o.stop(t + 1.2); } catch (e) { /* already stopped */ }
      });
      this._drones = [];
    },

    _schedule() {
      if (!this.playing) return;
      const stepDur = 60 / this.BPM / (this.combat ? 4.6 : 3.6);
      while (this._next < this.ctx.currentTime + 0.16) {
        this._beat(this._step, this._next, stepDur);
        this._step++;
        if (this._step >= 12) {
          this._step = 0;
          this._bar++;
          // a fresh cell every two bars keeps it moving without losing the thread
          if (this._bar % 2 === 0) {
            this._motif = (this._motif + 1 + ((Math.random() * 3) | 0)) % MOTIFS.length;
          }
        }
        this._next += stepDur;
      }
    },

    /** Degree (may be negative or past the octave) → frequency in the maqam. */
    _freq(deg, oct) {
      const n = this.SCALE.length;
      let d = deg;
      let o = oct || 0;
      while (d < 0) { d += n; o--; }
      while (d >= n) { d -= n; o++; }
      return this.ROOT * Math.pow(2, o + this.SCALE[d] / 12);
    },

    /* ---- instruments ---- */
    _nagara(t, deep, gain) {
      this.tone({
        f: deep ? 118 : 210, to: deep ? 44 : 120, dur: deep ? 0.19 : 0.09,
        type: 'sine', gain, bus: this.musicBus, at: t, pan: deep ? 0 : -0.25,
      });
      this.noise({
        f: deep ? 260 : 900, to: deep ? 100 : 420, dur: deep ? 0.1 : 0.06,
        filterType: 'lowpass', gain: gain * 0.4, bus: this.musicBus, at: t,
      });
    },

    _def(t, gain) {
      this.noise({ f: 5200, to: 3600, dur: 0.05, q: 0.9, gain, bus: this.musicBus, at: t, pan: 0.3 });
    },

    _bass(t, f, dur) {
      this.tone({
        f, dur, type: 'sawtooth', gain: 0.16, filter: 320, filterTo: 160, q: 3,
        bus: this.musicBus, at: t,
      });
      this.tone({ f: f / 2, dur, type: 'sine', gain: 0.14, bus: this.musicBus, at: t });
    },

    _tar(t, f, dur, gain) {
      // two slightly detuned courses plus a pick transient
      [-6, 6].forEach((det) => {
        this.tone({
          f, dur, type: 'sawtooth', gain: gain * 0.5, detune: det,
          filter: 2800, filterTo: 620, q: 3.2, bus: this.musicBus, at: t, pan: det / 24,
        });
      });
      this.noise({ f: 3200, to: 1400, dur: 0.02, gain: gain * 0.3, bus: this.musicBus, at: t });
    },

    _zurna(t, f, dur, gain) {
      // nasal double reed: rich saw through a tight resonant band, with vibrato
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.985, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const vib = this.ctx.createOscillator();
      vib.frequency.value = 6.2;
      const vibG = this.ctx.createGain();
      vibG.gain.value = f * 0.012;
      vib.connect(vibG);
      vibG.connect(osc.frequency);
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = Math.min(f * 3.2, 3400);
      flt.Q.value = 4.5;
      const g = this.ctx.createGain();
      osc.connect(flt);
      flt.connect(g);
      this._pan(g, 0.18).connect(this.musicBus);
      this._env(g, t, 0.045, dur, gain);
      osc.start(t);
      vib.start(t);
      osc.stop(t + dur + 0.15);
      vib.stop(t + dur + 0.15);
    },

    _beat(step, t, dur) {
      const inten = this.intensity;
      const hot = this.combat > 0;
      const bar = this._bar;
      const sectionB = (bar % 8) >= 4; // the zurna takes over every other four bars

      /* --- percussion */
      if (DUM[step]) this._nagara(t, true, 0.44);
      if (TEK[step] && (inten > 0.2 || step === 2 || step === 7 || hot)) {
        this._nagara(t, false, 0.16 + inten * 0.08);
      }
      if (this.MIX.def && (inten > 0.35 || hot) && DEF[step]) {
        this._def(t, 0.05 + inten * 0.05);
      }
      // fill on the way out of every fourth bar
      if (bar % 4 === 3 && step >= 9) {
        this._nagara(t + dur * 0.5, false, 0.2);
        if (step === 11) this._nagara(t + dur * 0.75, true, 0.36);
      }

      /* --- bass */
      if (step === 0) this._bass(t, this._freq(0, -1), dur * 2.6);
      else if (step === 6) this._bass(t, this._freq(4, -1), dur * 1.8);
      else if (step === 9 && (inten > 0.3 || hot)) this._bass(t, this._freq(2, -1), dur * 1.4);

      /* --- tar picks the motif */
      const cell = MOTIFS[this._motif];
      const deg = cell[step];
      if (deg !== null && deg !== undefined) {
        const oct = sectionB && this.MIX.zurna ? 0 : 1;
        this._tar(t, this._freq(deg, oct), dur * (step % 3 === 0 ? 1.7 : 1.1), 0.13);
        // mordent: the little flick that makes it sound played
        if (Math.random() < 0.22) {
          this._tar(t + dur * 0.34, this._freq(deg + 1, oct), dur * 0.4, 0.07);
        }
      }

      /* --- zurna lead over the B section */
      if (this.MIX.zurna && sectionB && (inten > 0.15 || hot)
        && (step === 0 || step === 6 || (step === 9 && hot))) {
        const lead = deg === null || deg === undefined ? 0 : deg;
        this._zurna(t, this._freq(lead, 1), dur * (step === 0 ? 3.4 : 2.2), 0.1 + inten * 0.05);
      }

      /* --- combat: an extra low pulse to push the fight along */
      if (hot && (step === 3 || step === 10)) {
        this.tone({
          f: this._freq(0, -2), dur: dur * 1.2, type: 'square',
          gain: 0.1, filter: 260, bus: this.musicBus, at: t,
        });
      }
    },
  };

  ICH.Audio = A;
})(window.ICH);
