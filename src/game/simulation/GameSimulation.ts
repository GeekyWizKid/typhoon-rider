import type { ActionState } from "../input/actions";

export type GamePhase = "menu" | "running" | "paused" | "failed" | "won";
export type EntityKind = "barrier" | "crate" | "puddle" | "branch" | "sign" | "barrel" | "token";
type ObstacleKind = Exclude<EntityKind, "token">;

export interface SimEntity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  width: number;
  height: number;
  speedOffset: number;
  hit: boolean;
}

export interface GameState {
  phase: GamePhase;
  distance: number;
  goalDistance: number;
  speed: number;
  stormGap: number;
  energy: number;
  tokens: number;
  playerHeight: number;
  playerVelocity: number;
  jumpsUsed: number;
  boosting: boolean;
  invulnerable: number;
  slowdown: number;
  elapsed: number;
  worldOffset: number;
  entities: SimEntity[];
}

export type SimulationEvent =
  | { type: "jump"; stage: 1 | 2 }
  | { type: "collect"; x: number; y: number }
  | { type: "hit"; x: number }
  | { type: "failed" }
  | { type: "won" };

const GOAL_DISTANCE = 2200;
const GRAVITY = 1640;
const JUMP_VELOCITY = 650;
const SECOND_JUMP_VELOCITY = 570;

export class GameSimulation {
  public readonly state: GameState;

  private events: SimulationEvent[] = [];
  private entityId = 0;
  private spawnCountdown = 520;
  private viewportWidth = 1280;
  private randomSeed = 0x2f6e2b1;

  constructor() {
    this.state = this.createInitialState("menu");
  }

  start(viewportWidth = this.viewportWidth): void {
    this.viewportWidth = Math.max(720, viewportWidth);
    Object.assign(this.state, this.createInitialState("running"));
    this.entityId = 0;
    this.spawnCountdown = this.viewportWidth * 1.8;
    this.randomSeed = 0x2f6e2b1;
    this.primeCourse();
  }

  pause(): void {
    if (this.state.phase === "running") this.state.phase = "paused";
  }

  resume(): void {
    if (this.state.phase === "paused") this.state.phase = "running";
  }

  resize(width: number): void {
    this.viewportWidth = Math.max(720, width);
  }

  update(deltaSeconds: number, actions: ActionState): void {
    if (this.state.phase !== "running") return;

    const dt = Math.min(deltaSeconds, 0.034);
    const state = this.state;
    const progress = Math.min(1, state.distance / state.goalDistance);

    state.elapsed += dt;
    state.invulnerable = Math.max(0, state.invulnerable - dt);
    state.slowdown = Math.max(0, state.slowdown - dt);

    state.boosting = actions.boostDown && state.energy > 1;
    if (state.boosting) {
      state.energy = Math.max(0, state.energy - 25 * dt);
      state.stormGap = Math.min(100, state.stormGap + 4.2 * dt);
    } else {
      state.energy = Math.min(100, state.energy + 8.5 * dt);
    }

    const baseSpeed = 330 + progress * 95;
    const boostSpeed = state.boosting ? 145 : 0;
    const slowdownMultiplier = state.slowdown > 0 ? 0.58 : 1;
    state.speed = (baseSpeed + boostSpeed) * slowdownMultiplier;
    state.distance = Math.min(state.goalDistance, state.distance + (state.speed * dt) / 14);
    state.worldOffset += state.speed * dt;
    state.stormGap = Math.max(0, state.stormGap - (1.25 + progress * 1.05) * dt);

    this.updatePlayer(dt, actions);
    this.updateEntities(dt);
    this.checkCollisions();

    if (state.distance >= state.goalDistance) {
      state.phase = "won";
      state.boosting = false;
      this.events.push({ type: "won" });
    } else if (state.stormGap <= 0) {
      state.phase = "failed";
      state.boosting = false;
      this.events.push({ type: "failed" });
    }
  }

  drainEvents(): SimulationEvent[] {
    return this.events.splice(0);
  }

  private createInitialState(phase: GamePhase): GameState {
    return {
      phase,
      distance: 0,
      goalDistance: GOAL_DISTANCE,
      speed: 330,
      stormGap: 82,
      energy: 72,
      tokens: 0,
      playerHeight: 0,
      playerVelocity: 0,
      jumpsUsed: 0,
      boosting: false,
      invulnerable: 0,
      slowdown: 0,
      elapsed: 0,
      worldOffset: 0,
      entities: []
    };
  }

  private updatePlayer(dt: number, actions: ActionState): void {
    const state = this.state;
    if (actions.jumpPressed && state.jumpsUsed === 0 && state.playerHeight <= 0.5) {
      state.playerVelocity = JUMP_VELOCITY;
      state.jumpsUsed = 1;
      this.events.push({ type: "jump", stage: 1 });
    } else if (actions.jumpPressed && state.jumpsUsed === 1 && state.playerHeight > 28) {
      state.playerVelocity = Math.max(state.playerVelocity, SECOND_JUMP_VELOCITY);
      state.jumpsUsed = 2;
      this.events.push({ type: "jump", stage: 2 });
    }

    if (state.playerHeight > 0 || state.playerVelocity > 0) {
      state.playerHeight += state.playerVelocity * dt;
      state.playerVelocity -= GRAVITY * dt;
      if (state.playerHeight <= 0) {
        state.playerHeight = 0;
        state.playerVelocity = 0;
        state.jumpsUsed = 0;
      }
    }
  }

  private updateEntities(dt: number): void {
    const travel = this.state.speed * dt;
    for (const entity of this.state.entities) entity.x -= travel + entity.speedOffset * dt;

    this.spawnCountdown -= travel;
    if (this.spawnCountdown <= 0 && this.state.distance < this.state.goalDistance - 130) {
      this.spawnPattern(this.viewportWidth + 170);
      const difficulty = this.state.distance / this.state.goalDistance;
      this.spawnCountdown = this.lerp(700, 470, difficulty) + this.random() * 180;
    }

    this.state.entities = this.state.entities.filter((entity) => entity.x > -260 && !entity.hit);
  }

  private checkCollisions(): void {
    const state = this.state;
    for (const entity of state.entities) {
      if (entity.hit || entity.x < -62 || entity.x > 66) continue;

      if (entity.kind === "token") {
        const riderCenter = state.playerHeight + 62;
        if (Math.abs(riderCenter - entity.y) < 68) {
          entity.hit = true;
          state.tokens += 1;
          state.energy = Math.min(100, state.energy + 18);
          state.stormGap = Math.min(100, state.stormGap + 7);
          this.events.push({ type: "collect", x: entity.x, y: entity.y });
        }
        continue;
      }

      const clearance = entity.kind === "puddle" ? 20 : entity.height - 10;
      if (state.playerHeight < clearance && state.invulnerable <= 0) {
        entity.hit = true;
        state.invulnerable = 1.15;
        state.slowdown = 0.72;
        state.stormGap = Math.max(0, state.stormGap - 24);
        state.energy = Math.max(0, state.energy - 16);
        this.events.push({ type: "hit", x: entity.x });
      }
    }
  }

  private primeCourse(): void {
    this.spawnObstacle("barrier", this.viewportWidth * 0.82);
    this.spawnObstacle("puddle", this.viewportWidth * 1.23);
    this.spawnObstacle("branch", this.viewportWidth * 1.66, false);
    this.spawnObstacle("barrel", this.viewportWidth * 2.5, false);
  }

  private spawnPattern(x: number): void {
    const progress = this.state.distance / this.state.goalDistance;
    const patternRoll = this.random();
    if (progress > 0.08 && patternRoll > 0.76) {
      if (patternRoll < 0.86) {
        this.spawnObstacle("puddle", x, false);
        this.spawnObstacle("barrier", x + 188, false);
        this.spawnToken(x + 94, 126);
      } else if (patternRoll < 0.94) {
        this.spawnObstacle("branch", x, false);
        this.spawnObstacle("crate", x + 208, false);
        this.spawnToken(x + 110, 150);
      } else {
        this.spawnObstacle("sign", x, false);
        this.spawnToken(x + 18, 196);
      }
      return;
    }

    const roll = this.random();
    const kind: ObstacleKind =
      roll < 0.22
        ? "puddle"
        : roll < 0.42
          ? "barrier"
          : roll < 0.58
            ? "crate"
            : roll < 0.74
              ? "branch"
              : roll < 0.88
                ? "barrel"
                : progress > 0.12
                  ? "sign"
                  : "barrier";
    this.spawnObstacle(kind, x);
  }

  private spawnObstacle(kind: ObstacleKind, x: number, withToken = true): void {
    const dimensions = {
      puddle: { width: 136, height: 20 },
      barrier: { width: 86, height: 62 },
      crate: { width: 72, height: 74 },
      branch: { width: 154, height: 54 },
      sign: { width: 104, height: 142 },
      barrel: { width: 64, height: 64 }
    }[kind];

    this.state.entities.push({
      id: ++this.entityId,
      kind,
      x,
      y: 0,
      ...dimensions,
      speedOffset: kind === "barrel" ? 82 : 0,
      hit: false
    });

    if (withToken && this.random() > 0.38) {
      const tokenY = kind === "puddle" ? 88 : kind === "sign" ? 196 : 126 + this.random() * 34;
      this.spawnToken(x + (kind === "puddle" ? 8 : 20), tokenY);
    }
  }

  private spawnToken(x: number, y: number): void {
    this.state.entities.push({
      id: ++this.entityId,
      kind: "token",
      x,
      y,
      width: 34,
      height: 34,
      speedOffset: 0,
      hit: false
    });
  }

  private random(): number {
    let value = this.randomSeed;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.randomSeed = value >>> 0;
    return this.randomSeed / 0xffffffff;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
