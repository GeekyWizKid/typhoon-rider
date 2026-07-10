import { inject } from "@vercel/analytics";
import Phaser from "phaser";
import "./style.css";
import { GameSimulation } from "./game/simulation/GameSimulation";
import { AudioController } from "./game/audio/AudioController";
import { BootScene } from "./phaser/scenes/BootScene";
import { GameScene } from "./phaser/scenes/GameScene";
import { HudController } from "./ui/HudController";

inject();

const simulation = new GameSimulation();
const audio = new AudioController();
new HudController();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-canvas",
  backgroundColor: "#485d5c",
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  scene: [BootScene, GameScene],
  callbacks: {
    preBoot: (game) => {
      game.registry.set("simulation", simulation);
      game.registry.set("audio", audio);
    }
  }
};

new Phaser.Game(config);
