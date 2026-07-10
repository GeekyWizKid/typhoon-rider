import Phaser from "phaser";
import { ASSETS } from "../../game/assets/manifest";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor("#485d5c");
    this.load.svg(ASSETS.hills.key, ASSETS.hills.path);
    this.load.svg(ASSETS.town.key, ASSETS.town.path);
    this.load.spritesheet(ASSETS.rider.key, ASSETS.rider.path, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet(ASSETS.obstacles.key, ASSETS.obstacles.path, { frameWidth: 64, frameHeight: 64 });
  }

  create(): void {
    this.scene.start("GameScene");
  }
}
