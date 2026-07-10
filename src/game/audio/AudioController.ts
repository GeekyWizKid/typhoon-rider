import type { SimulationEvent } from "../simulation/GameSimulation";

const LEAD_PATTERN: ReadonlyArray<number | null> = [
  74, null, 77, 76, 74, 69, 72, null, 74, null, 77, 81, 79, 77, 76, null,
  70, null, 74, 72, 70, 69, 65, null, 70, null, 74, 77, 76, 74, 72, null,
  72, null, 76, 74, 72, 67, 69, null, 72, null, 76, 79, 77, 76, 74, null,
  69, null, 72, 74, 76, 74, 72, 69, 67, null, 69, 72, 74, 72, 69, null
];

const BASS_ROOTS = [38, 34, 36, 33] as const;
const ARPEGGIO_ROOTS = [62, 58, 60, 57] as const;
const ARPEGGIO_INTERVALS = [0, 7, 12, 7] as const;

export class AudioController {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private muted = false;
  private musicActive = false;
  private musicPaused = false;
  private sequenceStep = 0;
  private nextStepTime = 0;
  private threat = 0.18;
  private boosting = false;

  unlock(): void {
    if (!this.context) this.createAudioGraph();
    if (this.context?.state === "suspended") void this.context.resume();
  }

  startMusic(): void {
    this.unlock();
    if (!this.context || !this.musicGain) return;

    this.clearMusicTimer();
    this.musicActive = true;
    this.musicPaused = false;
    this.sequenceStep = 0;
    this.nextStepTime = this.context.currentTime + 0.06;
    this.fadeMusicTo(0.78, 0.08);
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25);
    this.scheduleMusic();
  }

  pauseMusic(): void {
    if (!this.musicActive || this.musicPaused) return;
    this.musicPaused = true;
    this.clearMusicTimer();
    this.fadeMusicTo(0.0001, 0.05);
  }

  resumeMusic(): void {
    this.unlock();
    if (!this.context || !this.musicActive || !this.musicPaused) return;
    this.musicPaused = false;
    this.nextStepTime = this.context.currentTime + 0.06;
    this.fadeMusicTo(0.78, 0.08);
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25);
    this.scheduleMusic();
  }

  stopMusic(): void {
    if (!this.musicActive) return;
    this.clearMusicTimer();
    this.musicActive = false;
    this.musicPaused = false;
    this.sequenceStep = 0;
    this.fadeMusicTo(0.0001, 0.08);
  }

  setThreat(stormGap: number, boosting: boolean): void {
    this.threat = Math.max(0, Math.min(1, 1 - stormGap / 100));
    this.boosting = boosting;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (!this.muted) this.unlock();
    if (this.context && this.masterGain) {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.9, now, 0.015);
    }
    return this.muted;
  }

  play(event: SimulationEvent): void {
    if (event.type === "failed" || event.type === "won") this.stopMusic();
    if (this.muted || !this.context) return;

    if (event.type === "jump") {
      const frequencies = event.stage === 2 ? [410, 690] : [250, 410];
      this.tone(frequencies[0], frequencies[1], event.stage === 2 ? 0.16 : 0.11, "triangle", 0.055);
    }
    if (event.type === "collect") this.chime();
    if (event.type === "hit") this.tone(120, 72, 0.22, "sawtooth", 0.08);
    if (event.type === "failed") this.tone(150, 55, 0.65, "sine", 0.1);
    if (event.type === "won") {
      this.tone(330, 494, 0.25, "triangle", 0.07);
      window.setTimeout(() => this.tone(494, 660, 0.36, "triangle", 0.06), 170);
    }
  }

  private createAudioGraph(): void {
    const context = new AudioContext();
    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const sfxGain = context.createGain();
    const compressor = context.createDynamicsCompressor();

    masterGain.gain.value = this.muted ? 0 : 0.9;
    musicGain.gain.value = 0.0001;
    sfxGain.gain.value = 1;
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(compressor).connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.musicGain = musicGain;
    this.sfxGain = sfxGain;
    this.noiseBuffer = this.createNoiseBuffer(context);
  }

  private scheduleMusic(): void {
    if (!this.context || !this.musicActive || this.musicPaused) return;
    const stepDuration = 60 / 136 / 4;
    const scheduleUntil = this.context.currentTime + 0.14;

    while (this.nextStepTime < scheduleUntil) {
      this.scheduleStep(this.sequenceStep, this.nextStepTime, stepDuration);
      this.sequenceStep = (this.sequenceStep + 1) % LEAD_PATTERN.length;
      this.nextStepTime += stepDuration;
    }
  }

  private scheduleStep(step: number, time: number, stepDuration: number): void {
    const bar = Math.floor(step / 16);
    const beatInBar = step % 16;
    const leadNote = LEAD_PATTERN[step];

    if (leadNote !== null) {
      this.note(leadNote, time, stepDuration * 0.78, "square", 0.027);
      if (this.threat > 0.62) this.note(leadNote - 12, time, stepDuration * 0.58, "square", 0.009);
    }

    if (step % 2 === 1) {
      const arpNote = ARPEGGIO_ROOTS[bar] + ARPEGGIO_INTERVALS[Math.floor(beatInBar / 2) % 4];
      this.note(arpNote, time, stepDuration * 0.48, "square", 0.012 + this.threat * 0.004);
    }

    if (beatInBar % 4 === 0) {
      this.note(BASS_ROOTS[bar], time, stepDuration * 3.35, "triangle", 0.052);
    }

    if (beatInBar === 0 || beatInBar === 8) this.kick(time);
    if (beatInBar === 4 || beatInBar === 12) this.noiseHit(time, 0.075, 0.028, 1350);
    if (step % 2 === 0 || this.threat > 0.5) {
      const hatVolume = step % 2 === 0 ? 0.012 : 0.007 + this.threat * 0.006;
      this.noiseHit(time, 0.025, hatVolume, 4200);
    }

    if (this.boosting && beatInBar % 4 === 3) {
      const boostNote = ARPEGGIO_ROOTS[bar] + 24;
      this.note(boostNote, time, stepDuration * 0.35, "square", 0.012);
    }
  }

  private note(midi: number, time: number, duration: number, type: OscillatorType, volume: number): void {
    if (!this.context || !this.musicGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const attackEnd = time + 0.004;
    const releaseStart = time + duration * 0.68;
    const end = time + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(volume, attackEnd);
    gain.gain.setValueAtTime(volume, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(end + 0.02);
  }

  private kick(time: number): void {
    if (!this.context || !this.musicGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(118, time);
    oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.09);
    gain.gain.setValueAtTime(0.065, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(time + 0.12);
  }

  private noiseHit(time: number, duration: number, volume: number, highpassFrequency: number): void {
    if (!this.context || !this.musicGain || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(highpassFrequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(gain).connect(this.musicGain);
    source.start(time);
    source.stop(time + duration);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 0.25);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let register = 0x7fff;
    for (let index = 0; index < length; index += 1) {
      const bit = ((register >> 0) ^ (register >> 1)) & 1;
      register = (register >> 1) | (bit << 14);
      data[index] = register & 1 ? 0.72 : -0.72;
    }
    return buffer;
  }

  private fadeMusicTo(value: number, duration: number): void {
    if (!this.context || !this.musicGain) return;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(Math.max(0.0001, this.musicGain.gain.value), now);
    this.musicGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, value), now + duration);
  }

  private clearMusicTimer(): void {
    if (this.musicTimer === null) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private chime(): void {
    this.tone(620, 820, 0.12, "sine", 0.06);
    window.setTimeout(() => this.tone(820, 1040, 0.14, "sine", 0.05), 65);
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.context || !this.sfxGain) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
