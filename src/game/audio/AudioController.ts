import type { SimulationEvent } from "../simulation/GameSimulation";

export class AudioController {
  private context: AudioContext | null = null;
  private muted = false;

  unlock(): void {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (!this.muted) this.unlock();
    return this.muted;
  }

  play(event: SimulationEvent): void {
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
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
