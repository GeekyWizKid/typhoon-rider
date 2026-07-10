import { emitGameEvent, onGameEvent } from "../game/events";
import type { GameState } from "../game/simulation/GameSimulation";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element #${id}`);
  return found as T;
}

export class HudController {
  private readonly hud = element<HTMLElement>("hud");
  private readonly startScreen = element<HTMLElement>("start-screen");
  private readonly pauseScreen = element<HTMLElement>("pause-screen");
  private readonly resultScreen = element<HTMLElement>("result-screen");
  private readonly mobileControls = element<HTMLElement>("mobile-controls");
  private readonly progressFill = element<HTMLElement>("progress-fill");
  private readonly stormFill = element<HTMLElement>("storm-fill");
  private readonly energyFill = element<HTMLElement>("energy-fill");
  private readonly distanceLabel = element<HTMLElement>("distance-label");
  private readonly tokenCount = element<HTMLElement>("token-count");
  private readonly resultKicker = element<HTMLElement>("result-kicker");
  private readonly resultTitle = element<HTMLElement>("result-title");
  private readonly resultStat = element<HTMLElement>("result-stat");
  private readonly soundButton = element<HTMLButtonElement>("sound-button");

  constructor() {
    element("start-button").addEventListener("click", () => emitGameEvent("command:start"));
    element("pause-button").addEventListener("click", () => emitGameEvent("command:pause"));
    element("resume-button").addEventListener("click", () => emitGameEvent("command:resume"));
    element("restart-button").addEventListener("click", () => emitGameEvent("command:start"));
    element("restart-from-pause").addEventListener("click", () => emitGameEvent("command:start"));
    this.soundButton.addEventListener("click", () => emitGameEvent("command:sound"));

    const jumpButton = element<HTMLButtonElement>("jump-button");
    jumpButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      emitGameEvent("input:jump");
    });

    const boostButton = element<HTMLButtonElement>("boost-button");
    const setBoost = (value: boolean) => emitGameEvent("input:boost", value);
    boostButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      boostButton.setPointerCapture(event.pointerId);
      setBoost(true);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      boostButton.addEventListener(name, () => setBoost(false));
    }

    onGameEvent<GameState>("state", (state) => this.update(state));
    onGameEvent<boolean>("sound", (muted) => this.updateSound(muted));
  }

  update(state: GameState): void {
    const isMenu = state.phase === "menu";
    const isPlaying = state.phase === "running" || state.phase === "paused";
    const isResult = state.phase === "failed" || state.phase === "won";

    this.startScreen.classList.toggle("is-hidden", !isMenu);
    this.hud.classList.toggle("is-hidden", !isPlaying);
    this.pauseScreen.classList.toggle("is-hidden", state.phase !== "paused");
    this.resultScreen.classList.toggle("is-hidden", !isResult);
    this.mobileControls.classList.toggle("is-hidden", state.phase !== "running");

    const progress = Math.min(100, (state.distance / state.goalDistance) * 100);
    this.progressFill.style.width = `${progress}%`;
    this.stormFill.style.width = `${state.stormGap}%`;
    this.energyFill.style.width = `${state.energy}%`;
    this.distanceLabel.textContent = `${Math.floor(state.distance)} / ${state.goalDistance} m`;
    this.tokenCount.textContent = String(state.tokens);

    if (isResult) {
      const won = state.phase === "won";
      this.resultKicker.textContent = won ? "灯塔照亮了避风站" : "风墙吞没了海岸路";
      this.resultTitle.textContent = won ? "平安抵达" : "别停下";
      this.resultStat.textContent = won
        ? `用时 ${this.formatTime(state.elapsed)} · 收集 ${state.tokens} 枚风车`
        : `你骑出了 ${Math.floor(state.distance)} 米`;
      this.resultScreen.classList.toggle("result--won", won);
    }
  }

  private updateSound(muted: boolean): void {
    this.soundButton.textContent = muted ? "×" : "♪";
    this.soundButton.setAttribute("aria-label", muted ? "开启声音" : "静音");
    this.soundButton.title = muted ? "开启声音" : "静音";
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  }
}
