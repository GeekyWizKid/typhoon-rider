import Phaser from "phaser";
import { ASSETS } from "../../game/assets/manifest";
import type { GameState } from "../../game/simulation/GameSimulation";

const PEDAL_ANIMATION = "rider-pedal";

export class BikeRider {
  public readonly container: Phaser.GameObjects.Container;

  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Rectangle;
  private readonly speedLines: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y);
    this.shadow = scene.add.rectangle(0, -2, 84, 8, 0x07181b, 0.58).setOrigin(0.5, 1);
    this.speedLines = scene.add.graphics();
    this.sprite = scene.add
      .sprite(0, 0, ASSETS.rider.key, 0)
      .setOrigin(0.5, 1)
      .setDisplaySize(122, 122);

    if (!scene.anims.exists(PEDAL_ANIMATION)) {
      scene.anims.create({
        key: PEDAL_ANIMATION,
        frames: scene.anims.generateFrameNumbers(ASSETS.rider.key, { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      });
    }
    this.sprite.play(PEDAL_ANIMATION);
    this.container.add([this.shadow, this.speedLines, this.sprite]);
  }

  update(state: GameState, deltaSeconds: number, groundY: number): void {
    const roadBounce = state.playerHeight === 0 ? Math.round(Math.sin(state.worldOffset * 0.04) * 2) : 0;
    this.container.y = Math.round(groundY - state.playerHeight + roadBounce);
    this.container.rotation = state.playerHeight > 0 ? (state.jumpsUsed === 2 ? -0.12 : -0.04) : 0;
    this.container.alpha = state.invulnerable > 0 && Math.floor(state.invulnerable * 16) % 2 === 0 ? 0.42 : 1;

    if (state.playerHeight > 0) {
      this.sprite.stop();
      this.sprite.setFrame(state.jumpsUsed === 2 ? 2 : 1);
    } else if (!this.sprite.anims.isPlaying) {
      this.sprite.play(PEDAL_ANIMATION);
    }
    this.sprite.anims.timeScale = Phaser.Math.Clamp(state.speed / 340, 0.8, 1.65);
    this.shadow.setVisible(state.playerHeight < 12);

    this.speedLines.clear();
    if (state.boosting) {
      this.speedLines.fillStyle(0xf0cb62, 0.76);
      this.speedLines.fillRect(-88, -38, 32, 3);
      this.speedLines.fillRect(-104, -58, 46, 3);
      this.speedLines.fillRect(-82, -80, 30, 3);
    }

    void deltaSeconds;
  }
}
