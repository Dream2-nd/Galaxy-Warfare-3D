// Procedural WebAudio engine — every sound is synthesized, so the game is fully offline.

type Ctx = AudioContext;

export class AudioEngine {
  ctx: Ctx | null = null;
  master!: GainNode;
  sfx!: GainNode;
  musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private engineOsc: OscillatorNode[] = [];
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private musicTimer: number | null = null;
  private musicStep = 0;
  volume = 0.7;
  musicVol = 0.45;
  started = false;

  init() {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);

    // shared noise buffer
    const len = Math.floor(c.sampleRate * 2);
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // persistent engine drone
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 6;
    this.engineGain.connect(this.engineFilter);
    this.engineFilter.connect(this.sfx);
    [42, 63, 118].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = i === 2 ? 0.18 : 0.4;
      o.connect(g);
      g.connect(this.engineGain);
      o.start();
      this.engineOsc.push(o);
    });
    this.started = true;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  setMusic(v: number) {
    this.musicVol = v;
    if (this.musicBus) this.musicBus.gain.value = v;
  }

  /** throttle 0..1, boost 0..1 */
  engine(throttle: number, boost: number, speedNorm: number) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = 0.035 + throttle * 0.1 + speedNorm * 0.05 + boost * 0.14;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    const f = 260 + speedNorm * 500 + boost * 900;
    this.engineFilter.frequency.setTargetAtTime(f, t, 0.15);
    this.engineOsc.forEach((o, i) => o.frequency.setTargetAtTime((i === 2 ? 118 : i === 1 ? 63 : 42) * (1 + boost * 0.35), t, 0.2));
  }
  engineOff() {
    if (this.ctx && this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  private noise(dur: number, gain: number, type: BiquadFilterType, f0: number, f1: number, dest?: AudioNode) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = type;
    const t = c.currentTime;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(dest ?? this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, freq2: number, dur: number, gain: number, type: OscillatorType = "sine", delay = 0) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name: string, dist = 0) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const a = Math.max(0, 1 - dist);
    if (a <= 0.01) return;
    switch (name) {
      case "laser": {
        const v = 0.88 + Math.random() * 0.24; // slight pitch variation keeps rapid fire from droning
        this.tone((1500 * a + 400) * v, 300 * v, 0.12, 0.16 * a, "sawtooth");
        this.noise(0.07, 0.05 * a, "highpass", 2600, 900);
        break;
      }
      case "rapid":
        this.tone(1900, 700, 0.05, 0.07 * a, "square");
        break;
      case "plasma":
        this.tone(220, 70, 0.34, 0.24 * a, "sine");
        this.noise(0.26, 0.1 * a, "bandpass", 900, 220);
        break;
      case "heavy":
        this.tone(150, 44, 0.6, 0.34 * a, "sawtooth");
        this.noise(0.5, 0.16 * a, "lowpass", 1400, 120);
        break;
      case "missile":
        this.noise(0.7, 0.16 * a, "bandpass", 500, 2600);
        this.tone(320, 120, 0.4, 0.1 * a, "triangle");
        break;
      case "hit":
        // crisp confirmation tick: your shot connected with armour
        this.tone(2400 * (0.95 + Math.random() * 0.1), 1500, 0.05, 0.09, "square");
        this.noise(0.04, 0.05, "highpass", 5000, 2500);
        break;
      case "hitShield":
        this.tone(1300, 2600, 0.07, 0.07, "sine");
        this.noise(0.06, 0.045, "bandpass", 3600, 1800);
        break;
      case "kill":
        this.tone(880, 880, 0.08, 0.15, "triangle");
        this.tone(1320, 1320, 0.18, 0.15, "triangle", 0.08);
        this.noise(0.25, 0.08, "highpass", 3000, 900);
        break;
      case "blast":
        this.noise(0.7, 0.32 * a, "lowpass", 1600, 90);
        this.tone(110, 40, 0.5, 0.26 * a, "sawtooth");
        break;
      case "explosionBig":
        this.noise(2.4, 0.6 * a, "lowpass", 1400, 40);
        this.tone(80, 22, 2.0, 0.5 * a, "sawtooth");
        this.tone(55, 18, 2.6, 0.45 * a, "sine", 0.1);
        this.noise(0.6, 0.3 * a, "highpass", 3500, 500);
        break;
      case "impact":
        this.noise(0.14, 0.2 * a, "highpass", 3200, 700);
        this.tone(320, 90, 0.12, 0.1 * a, "square");
        break;
      case "explosion": {
        this.noise(1.5, 0.55 * a, "lowpass", 1800, 60);
        this.tone(120, 28, 1.1, 0.5 * a, "sawtooth");
        this.tone(70, 22, 1.6, 0.4 * a, "sine", 0.05);
        this.noise(0.4, 0.3 * a, "highpass", 4000, 600);
        break;
      }
      case "shieldup":
        this.tone(320, 900, 0.35, 0.14 * a, "sine");
        this.noise(0.3, 0.05 * a, "bandpass", 1600, 3200);
        break;
      case "shieldbreak":
        this.noise(0.5, 0.28 * a, "bandpass", 4200, 500);
        this.tone(880, 120, 0.45, 0.16 * a, "triangle");
        break;
      case "lock":
        this.tone(1200, 1200, 0.06, 0.12 * a, "square");
        this.tone(1600, 1600, 0.06, 0.12 * a, "square", 0.1);
        break;
      case "locked":
        this.tone(760, 760, 0.09, 0.16, "sawtooth");
        this.tone(760, 760, 0.09, 0.16, "sawtooth", 0.14);
        break;
      case "boost":
        this.noise(0.5, 0.16 * a, "bandpass", 300, 2400);
        break;
      case "ui":
        this.tone(680, 980, 0.06, 0.07, "triangle");
        break;
      case "uiclick":
        this.tone(1100, 420, 0.09, 0.1, "square");
        break;
      case "warn":
        this.tone(420, 300, 0.2, 0.14, "sawtooth");
        break;
      case "victory":
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.5, 0.16, "triangle", i * 0.14));
        break;
      case "defeat":
        [440, 349, 262, 196].forEach((f, i) => this.tone(f, f * 0.98, 0.6, 0.16, "sawtooth", i * 0.18));
        break;
      case "nova":
        this.tone(60, 900, 0.9, 0.3, "sine");
        this.noise(1.2, 0.3, "bandpass", 300, 5000);
        this.tone(1200, 60, 1.2, 0.22, "triangle", 0.3);
        break;
    }
  }

  startMusic(mode: "battle" | "menu" | "none") {
    this.init();
    if (!this.ctx) return;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (mode === "none") return;
    const scale = mode === "battle" ? [55, 65.4, 82.4, 98, 110, 130.8] : [55, 73.4, 82.4, 110, 123.5, 164.8];
    const stepDur = mode === "battle" ? 340 : 620;
    this.musicStep = 0;
    const tick = () => {
      if (!this.ctx) return;
      const c = this.ctx;
      const t = c.currentTime;
      const s = this.musicStep++;
      const root = scale[s % scale.length];
      // bass pulse
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = root;
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(240, t);
      f.frequency.linearRampToValueAtTime(mode === "battle" ? 900 : 480, t + stepDur / 2000);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(mode === "battle" ? 0.2 : 0.14, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur / 900);
      o.connect(f); f.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + stepDur / 800);
      // shimmer
      if (s % 2 === 1) {
        const o2 = c.createOscillator();
        o2.type = "sine";
        o2.frequency.value = root * 8 * (1 + (s % 3) * 0.25);
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.045, t + 0.3);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o2.connect(g2); g2.connect(this.musicBus);
        o2.start(t); o2.stop(t + 1.8);
      }
      if (mode === "battle" && s % 4 === 0) this.noise(0.22, 0.09, "lowpass", 200, 60);
    };
    tick();
    this.musicTimer = window.setInterval(tick, stepDur);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose() {
    this.stopMusic();
    this.engineOff();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.started = false;
    }
  }
}

export const audio = new AudioEngine();
