export const ASSETS = {
  hills: { key: "environment.pixel-hills", path: "/assets/environment/pixel-hills.svg" },
  town: { key: "environment.pixel-town", path: "/assets/environment/pixel-town.svg" },
  rider: { key: "character.rider", path: "/assets/characters/rider-sheet.png" },
  obstacles: { key: "obstacles.pixel-atlas", path: "/assets/obstacles/obstacle-sheet.png" }
} as const;

export type AssetKey = (typeof ASSETS)[keyof typeof ASSETS]["key"];
