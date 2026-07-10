import Phaser from "phaser";
import { ASSETS } from "../../game/assets/manifest";
import { emitGameEvent, gameEvents } from "../../game/events";
import { AudioController } from "../../game/audio/AudioController";
import type { SimEntity, SimulationEvent } from "../../game/simulation/GameSimulation";
import { GameSimulation } from "../../game/simulation/GameSimulation";
import { BikeRider } from "../view/BikeRider";
import { InputController } from "../view/InputController";

interface RainDrop {
  shape: Phaser.GameObjects.Rectangle;
  speed: number;
}

export class GameScene extends Phaser.Scene {
  private simulation!: GameSimulation;
  private inputController!: InputController;
  private audioController!: AudioController;
  private rider!: BikeRider;
  private hills!: Phaser.GameObjects.TileSprite;
  private town!: Phaser.GameObjects.TileSprite;
  private road!: Phaser.GameObjects.Graphics;
  private storm!: Phaser.GameObjects.Graphics;
  private cloudLayer!: Phaser.GameObjects.Graphics;
  private lightning!: Phaser.GameObjects.Rectangle;
  private goalMarker!: Phaser.GameObjects.Graphics;
  private rain: RainDrop[] = [];
  private entityViews = new Map<number, Phaser.GameObjects.Image>();
  private groundY = 600;
  private playerX = 280;
  private hudTimer = 0;
  private lastLightningBeat = -1;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.simulation = this.registry.get("simulation") as GameSimulation;
    this.audioController = this.registry.get("audio") as AudioController;
    this.inputController = new InputController(this);

    this.createWorld();
    this.rider = new BikeRider(this, this.playerX, this.groundY);
    this.rider.container.setDepth(12);
    this.bindCommands();
    this.handleResize({ width: this.scale.width, height: this.scale.height } as Phaser.Structs.Size);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < this.scale.height * 0.76) emitGameEvent("input:jump");
    });
    window.addEventListener("blur", () => {
      if (this.simulation.state.phase === "running") this.pauseGame();
    });
    emitGameEvent("state", this.simulation.state);
  }

  update(_time: number, deltaMilliseconds: number): void {
    const dt = deltaMilliseconds / 1000;
    const actions = this.inputController.read();

    if (actions.pausePressed) {
      if (this.simulation.state.phase === "running") this.pauseGame();
      else if (this.simulation.state.phase === "paused") this.resumeGame();
    }

    this.simulation.update(dt, actions);
    this.processEvents(this.simulation.drainEvents());
    this.renderState(dt);
    this.updateWeather(dt);

    this.hudTimer -= deltaMilliseconds;
    if (this.hudTimer <= 0) {
      this.hudTimer = 70;
      emitGameEvent("state", this.simulation.state);
    }
  }

  private createWorld(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.add.rectangle(0, 0, width, height, 0x485d5c).setOrigin(0).setDepth(-4);

    this.cloudLayer = this.add.graphics().setDepth(-3);
    this.drawClouds(width, height);

    this.hills = this.add
      .tileSprite(width / 2, height / 2, width, 500, ASSETS.hills.key)
      .setTileScale(1, 1)
      .setDepth(-2);
    this.town = this.add
      .tileSprite(width / 2, height / 2, width, 420, ASSETS.town.key)
      .setTileScale(1, 1)
      .setDepth(-1);

    this.road = this.add.graphics().setDepth(3);
    this.goalMarker = this.add.graphics().setDepth(7).setVisible(false);
    this.storm = this.add.graphics().setDepth(16);
    this.lightning = this.add.rectangle(0, 0, width, height, 0xe5f4ff, 0).setOrigin(0).setDepth(18);
    this.createRain(width, height);
  }

  private createRain(width: number, height: number): void {
    for (const drop of this.rain) drop.shape.destroy();
    this.rain = [];
    const count = Phaser.Math.Clamp(Math.floor((width * height) / 9000), 42, 130);
    for (let index = 0; index < count; index += 1) {
      const x = (index * 97) % Math.max(width, 1);
      const y = (index * 173) % Math.max(height, 1);
      const length = 12 + (index % 4) * 5;
      const shape = this.add
        .rectangle(x, y, 3, length, 0xa9bbb1, 0.24 + (index % 3) * 0.07)
        .setDepth(15);
      this.rain.push({ shape, speed: 520 + (index % 7) * 54 });
    }
  }

  private bindCommands(): void {
    gameEvents.addEventListener("command:start", () => {
      this.audioController.unlock();
      this.clearEntityViews();
      this.simulation.start(this.scale.width);
      this.cameras.main.stopFollow();
      this.cameras.main.setAlpha(1);
      emitGameEvent("state", this.simulation.state);
    });
    gameEvents.addEventListener("command:pause", () => this.pauseGame());
    gameEvents.addEventListener("command:resume", () => this.resumeGame());
    gameEvents.addEventListener("command:sound", () => {
      const muted = this.audioController.toggle();
      emitGameEvent("sound", muted);
    });
  }

  private pauseGame(): void {
    this.simulation.pause();
    emitGameEvent("state", this.simulation.state);
  }

  private resumeGame(): void {
    this.audioController.unlock();
    this.simulation.resume();
    emitGameEvent("state", this.simulation.state);
  }

  private renderState(dt: number): void {
    const state = this.simulation.state;
    this.hills.tilePositionX = state.worldOffset * 0.055;
    this.town.tilePositionX = state.worldOffset * 0.18;
    this.rider.update(state, dt, this.groundY);
    this.drawRoad(state.worldOffset);
    this.drawStorm(state.stormGap, state.elapsed);
    this.drawGoal(state.distance, state.goalDistance);
    this.syncEntityViews(state.entities, state.elapsed);
  }

  private syncEntityViews(entities: SimEntity[], elapsed: number): void {
    const liveIds = new Set(entities.filter((entity) => !entity.hit).map((entity) => entity.id));
    for (const [id, view] of this.entityViews) {
      if (!liveIds.has(id)) {
        view.destroy();
        this.entityViews.delete(id);
      }
    }

    for (const entity of entities) {
      if (entity.hit) continue;
      let view = this.entityViews.get(entity.id);
      if (!view) {
        view = this.createEntityView(entity);
        this.entityViews.set(entity.id, view);
      }
      view.x = this.playerX + entity.x;
      view.y = entity.kind === "token" ? this.groundY - entity.y : this.groundY + 5;
      if (entity.kind === "token") {
        view.rotation = elapsed * 1.9 + entity.id;
        view.setScale(0.78 + Math.sin(elapsed * 4 + entity.id) * 0.06);
      } else if (entity.kind === "barrel") {
        view.rotation = -elapsed * 5.4 - entity.id;
      }
    }
  }

  private createEntityView(entity: SimEntity): Phaser.GameObjects.Image {
    const frame = {
      barrier: 0,
      crate: 1,
      puddle: 2,
      branch: 3,
      sign: 4,
      barrel: 5,
      token: 6
    }[entity.kind];
    const view = this.add
      .image(0, 0, ASSETS.obstacles.key, frame)
      .setDepth(entity.kind === "token" ? 10 : 8);
    if (entity.kind === "token") {
      view.setOrigin(0.5).setDisplaySize(52, 52);
    } else {
      const height = entity.kind === "puddle" ? 38 : entity.height + 12;
      view.setOrigin(0.5, 1).setDisplaySize(entity.width + 12, height);
    }
    return view;
  }

  private drawRoad(worldOffset: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const roadHeight = Math.max(96, height - this.groundY);
    const laneY = Math.round(this.groundY + roadHeight * 0.48);
    this.road.clear();
    this.road.fillStyle(0x16282b, 1);
    this.road.fillRect(0, this.groundY - 8, width, roadHeight + 8);
    this.road.fillStyle(0x21383a, 1);
    this.road.fillRect(0, this.groundY + 4, width, Math.max(18, roadHeight * 0.28));
    this.road.fillStyle(0x0e2024, 0.9);
    this.road.fillRect(0, laneY + 12, width, height - laneY - 12);

    const reflectionOffset = -((worldOffset * 0.38) % 220) - 220;
    for (let x = reflectionOffset, index = 0; x < width + 220; x += 220, index += 1) {
      const reflectionX = Math.round(x + 52 + (index % 3) * 24);
      const reflectionHeight = 38 + (index % 4) * 16;
      this.road.fillStyle(index % 3 === 1 ? 0xd69648 : 0x789a90, index % 3 === 1 ? 0.16 : 0.12);
      this.road.fillRect(reflectionX, this.groundY + 18, 8, reflectionHeight);
      this.road.fillRect(reflectionX - 7, this.groundY + 42, 22, 4);
      this.road.fillRect(reflectionX - 3, this.groundY + 58, 14, 3);
    }

    this.road.fillStyle(0x91a69c, 0.48);
    this.road.fillRect(0, this.groundY - 8, width, 4);
    this.road.fillStyle(0x314d4d, 1);
    this.road.fillRect(0, this.groundY - 4, width, 8);

    const railOffset = -((worldOffset * 0.22) % 156) - 156;
    this.road.fillStyle(0x182d30, 1);
    for (let x = railOffset; x < width + 156; x += 156) {
      this.road.fillRect(Math.round(x + 18), this.groundY - 58, 10, 58);
    }
    this.road.fillStyle(0x6d7f77, 1);
    this.road.fillRect(0, this.groundY - 54, width, 9);
    this.road.fillRect(0, this.groundY - 31, width, 7);
    this.road.fillStyle(0xa5afa1, 0.72);
    this.road.fillRect(0, this.groundY - 53, width, 3);

    const dashOffset = -((worldOffset * 0.9) % 238) - 238;
    this.road.fillStyle(0x9aa69c, 0.42);
    for (let x = dashOffset; x < width + 238; x += 238) {
      this.road.fillRect(Math.round(x), laneY, 112, 6);
    }

    const glintOffset = -((worldOffset * 0.62) % 148) - 148;
    for (let x = glintOffset, index = 0; x < width + 148; x += 148, index += 1) {
      this.road.fillStyle(0x9bb4ac, 0.2 + (index % 3) * 0.05);
      this.road.fillRect(Math.round(x + 24), this.groundY + 24 + (index % 4) * 18, 54 + (index % 2) * 24, 3);
      this.road.fillRect(Math.round(x + 42), laneY + 34 + (index % 3) * 22, 34, 3);
    }

    this.road.fillStyle(0x091b1f, 1);
    this.road.fillRect(0, height - 30, width, 30);
    this.road.fillStyle(0x45615c, 1);
    this.road.fillRect(0, height - 30, width, 5);
    const drainOffset = -((worldOffset * 0.8) % 196) - 196;
    for (let x = drainOffset; x < width + 196; x += 196) {
      this.road.fillStyle(0x0b171a, 1);
      this.road.fillRect(Math.round(x + 54), height - 24, 78, 13);
      this.road.fillStyle(0x344b49, 1);
      for (let slot = 0; slot < 5; slot += 1) {
        this.road.fillRect(Math.round(x + 60 + slot * 14), height - 21, 8, 7);
      }
    }
  }

  private drawStorm(gap: number, elapsed: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const gapScale = Phaser.Math.Clamp(width / 900, 1.05, 2.1);
    const edge = this.playerX - gap * gapScale + 24;
    this.storm.clear();
    this.storm.fillStyle(0x071318, 0.72);
    this.storm.fillRect(0, 0, Math.max(0, edge - 64), height);
    for (let layer = 0; layer < 5; layer += 1) {
      const layerX = Math.round(edge - 76 + layer * 18 + Math.sin(elapsed * (1.15 + layer * 0.08)) * 7);
      this.storm.fillStyle(layer % 2 === 0 ? 0x13282d : 0x20383b, 0.26 + layer * 0.07);
      this.storm.fillRect(layerX, 0, 30, height);
    }
    for (let index = 0; index < 18; index += 1) {
      const y = Math.floor((((index * 71 + elapsed * (42 + (index % 4) * 9)) % (height + 100)) - 50) / 8) * 8;
      const wobble = Math.round(Math.sin(elapsed * 1.7 + index) * 5);
      const streakX = Math.round(edge - 118 + (index % 5) * 22 + wobble);
      this.storm.fillStyle(index % 3 === 0 ? 0x9aaca4 : 0x617a76, 0.18 + (index % 3) * 0.06);
      this.storm.fillRect(streakX, y, 58 + (index % 4) * 18, 3);
      this.storm.fillRect(streakX + 22, y + 11, 34 + (index % 3) * 12, 2);
    }
  }

  private drawGoal(distance: number, goalDistance: number): void {
    const remainingPixels = (goalDistance - distance) * 14;
    const x = this.playerX + remainingPixels;
    const visible = x < this.scale.width + 200;
    this.goalMarker.setVisible(visible);
    if (!visible) return;

    this.goalMarker.clear();
    this.goalMarker.fillStyle(0xf0ca6a, 0.15);
    this.goalMarker.fillTriangle(x - 16, this.groundY - 176, x - 320, this.groundY - 214, x - 320, this.groundY - 140);
    this.goalMarker.fillStyle(0x263f40, 1);
    this.goalMarker.fillRect(x - 98, this.groundY - 66, 196, 66);
    this.goalMarker.fillStyle(0x6f4138, 1);
    this.goalMarker.fillRect(x - 112, this.groundY - 78, 224, 16);
    this.goalMarker.fillStyle(0x9aa297, 1);
    this.goalMarker.fillRect(x - 24, this.groundY - 166, 48, 100);
    this.goalMarker.fillStyle(0x62746e, 1);
    this.goalMarker.fillRect(x - 20, this.groundY - 154, 40, 88);
    this.goalMarker.fillStyle(0x1b3032, 1);
    this.goalMarker.fillRect(x - 31, this.groundY - 184, 62, 20);
    this.goalMarker.fillRect(x - 20, this.groundY - 200, 40, 16);
    this.goalMarker.fillStyle(0xe5ad4f, 1);
    this.goalMarker.fillRect(x - 13, this.groundY - 181, 26, 14);
    this.goalMarker.fillStyle(0xdda050, 1);
    this.goalMarker.fillRect(x - 12, this.groundY - 46, 24, 46);
    this.goalMarker.fillRect(x - 74, this.groundY - 38, 26, 24);
    this.goalMarker.fillRect(x + 48, this.groundY - 38, 26, 24);
  }

  private processEvents(events: SimulationEvent[]): void {
    for (const event of events) {
      this.audioController.play(event);
      if (event.type === "jump" && event.stage === 2) this.showDoubleJumpFx();
      if (event.type === "collect") this.showCollectFx();
      if (event.type === "hit") {
        this.cameras.main.shake(160, 0.0065);
        this.lightning.setFillStyle(0x9f2949, 0.34).setAlpha(1);
        this.tweens.add({ targets: this.lightning, alpha: 0, duration: 210 });
      }
      if (event.type === "failed") {
        this.cameras.main.shake(520, 0.009);
        emitGameEvent("state", this.simulation.state);
      }
      if (event.type === "won") {
        this.showWinFx();
        emitGameEvent("state", this.simulation.state);
      }
    }
  }

  private showCollectFx(): void {
    const sparkle = this.add
      .image(this.playerX + 10, this.groundY - this.simulation.state.playerHeight - 96, ASSETS.obstacles.key, 6)
      .setDepth(20)
      .setDisplaySize(42, 42);
    this.tweens.add({
      targets: sparkle,
      y: sparkle.y - 72,
      rotation: Math.PI,
      alpha: 0,
      scale: 1.4,
      duration: 480,
      ease: "Cubic.Out",
      onComplete: () => sparkle.destroy()
    });
  }

  private showDoubleJumpFx(): void {
    const x = this.playerX;
    const y = this.groundY - this.simulation.state.playerHeight - 58;
    const ring = this.add.graphics().setPosition(x, y).setDepth(20);
    ring.lineStyle(5, 0xd95745, 0.92);
    ring.strokeRect(-32, -32, 64, 64);
    ring.lineStyle(2, 0xf0c95d, 0.82);
    ring.strokeRect(-46, -46, 92, 92);
    const badge = this.add
      .text(x + 42, y - 45, "×2", {
        color: "#f3d678",
        fontFamily: '"Courier New", "PingFang SC", monospace',
        fontSize: "22px",
        fontStyle: "bold",
        stroke: "#102226",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.tweens.add({
      targets: ring,
      scale: 1.75,
      alpha: 0,
      duration: 760,
      ease: "Cubic.Out",
      onComplete: () => ring.destroy()
    });
    this.tweens.add({
      targets: badge,
      y: badge.y - 46,
      alpha: 0,
      duration: 840,
      ease: "Cubic.Out",
      onComplete: () => badge.destroy()
    });
  }

  private showWinFx(): void {
    for (let index = 0; index < 18; index += 1) {
      const confetti = this.add
        .rectangle(
          this.scale.width * (0.22 + (index % 9) * 0.07),
          -20 - (index % 4) * 30,
          8,
          22,
          [0xf0c95d, 0xd95745, 0x78a79c][index % 3]
        )
        .setDepth(21)
        .setRotation(index * 0.7);
      this.tweens.add({
        targets: confetti,
        y: this.scale.height * (0.72 + (index % 3) * 0.08),
        x: confetti.x + Math.sin(index) * 90,
        rotation: confetti.rotation + Math.PI * 3,
        duration: 1100 + (index % 5) * 110,
        ease: "Quad.In",
        onComplete: () => confetti.destroy()
      });
    }
  }

  private updateWeather(dt: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const drift = (this.simulation.state.speed * 0.17 + 130) * dt;
    for (const drop of this.rain) {
      drop.shape.y += drop.speed * dt;
      drop.shape.x -= drift;
      if (drop.shape.y > height + 30 || drop.shape.x < -30) {
        drop.shape.y = -30;
        drop.shape.x = Math.random() * (width + 160);
      }
    }

    if (this.simulation.state.phase === "running") {
      const beat = Math.floor(this.simulation.state.elapsed / 6.4);
      if (beat > this.lastLightningBeat && this.simulation.state.elapsed % 6.4 > 5.7) {
        this.lastLightningBeat = beat;
        this.lightning.setFillStyle(0xa8bddd, 0.24).setAlpha(1);
        this.tweens.add({ targets: this.lightning, alpha: 0, duration: 150 });
      }
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.groundY = Math.round(Phaser.Math.Clamp(height * 0.72, height * 0.64, height - 118));
    this.playerX = Math.round(Phaser.Math.Clamp(width * 0.25, 104, 350));
    this.simulation.resize(width);
    this.hills.setPosition(width / 2, this.groundY - 250).setSize(width, 500);
    this.town.setPosition(width / 2, this.groundY - 210).setSize(width, 420);
    this.lightning.setSize(width, height);
    this.rider?.container.setX(this.playerX);
    this.drawClouds(width, height);
    this.createRain(width, height);
  }

  private drawClouds(width: number, height: number): void {
    this.cloudLayer.clear();
    this.cloudLayer.fillStyle(0x4c6261, 1);
    this.cloudLayer.fillRect(0, 0, width, height);
    this.cloudLayer.fillStyle(0x82928a, 0.34);
    this.cloudLayer.fillRect(0, Math.round(height * 0.3), width, Math.round(height * 0.24));
    this.cloudLayer.fillStyle(0xabc0b2, 0.13);
    this.cloudLayer.fillRect(0, Math.round(height * 0.44), width, Math.round(height * 0.1));

    const colors = [0x263c40, 0x31494a, 0x3b5352];
    for (let row = 0; row < 3; row += 1) {
      const y = 18 + row * 48;
      for (let index = 0; index < 8; index += 1) {
        const x = Math.floor(((index * 247 + row * 91) % (width + 320) - 180) / 8) * 8;
        const cloudWidth = 132 + ((index + row) % 4) * 48;
        this.cloudLayer.fillStyle(colors[(index + row) % colors.length], 0.84 - row * 0.08);
        this.cloudLayer.fillRect(x, y, cloudWidth, 30);
        this.cloudLayer.fillRect(x + 28, y - 18, cloudWidth - 54, 20);
        this.cloudLayer.fillRect(x + 52, y + 26, cloudWidth - 80, 12);
      }
    }

    for (let index = 0; index < 11; index += 1) {
      const x = Math.round((index / 10) * width);
      this.cloudLayer.fillStyle(0xb6c4b8, 0.05 + (index % 3) * 0.025);
      this.cloudLayer.fillRect(x, Math.round(height * 0.2), 22 + (index % 4) * 11, Math.round(height * 0.42));
    }
  }

  private clearEntityViews(): void {
    for (const view of this.entityViews.values()) view.destroy();
    this.entityViews.clear();
  }
}
