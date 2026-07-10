import Phaser from "phaser";
import { gameEvents } from "../../game/events";
import type { ActionState } from "../../game/input/actions";

export class InputController {
  private readonly jumpKeys: Phaser.Input.Keyboard.Key[];
  private readonly boostKeys: Phaser.Input.Keyboard.Key[];
  private readonly pauseKeys: Phaser.Input.Keyboard.Key[];
  private touchJump = false;
  private touchBoost = false;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    this.jumpKeys = keyboard
      ? [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)
        ]
      : [];
    this.boostKeys = keyboard
      ? [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        ]
      : [];
    this.pauseKeys = keyboard
      ? [
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
          keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
        ]
      : [];

    gameEvents.addEventListener("input:jump", () => {
      this.touchJump = true;
    });
    gameEvents.addEventListener("input:boost", (event) => {
      this.touchBoost = (event as CustomEvent<boolean>).detail;
    });
  }

  read(): ActionState {
    const actions: ActionState = {
      jumpPressed: this.touchJump || this.jumpKeys.some((key) => Phaser.Input.Keyboard.JustDown(key)),
      boostDown: this.touchBoost || this.boostKeys.some((key) => key.isDown),
      pausePressed: this.pauseKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))
    };
    this.touchJump = false;
    return actions;
  }
}
