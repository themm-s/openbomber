import { points } from "core/point";
import { toLimit } from "core/toLimit";
import deathSrc from "images/death.png";
import deathIconsSrc from "images/deathSkins.png";
import fakeSrc from "images/explodeFake.png";
import { DEATH_FRAMES, EEffect } from "shared/types";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

const ANIMATIONS = {
  [EEffect.DEATH]: {
    sprite: new Sprite(deathSrc),
    frames: points('0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0')
  },
  [EEffect.FAKE_EXPLODE]: {
    sprite: new Sprite(fakeSrc),
    frames: points('0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0;8,0;9,0')
  }
};

const SPEEDS = {
  [EEffect.DEATH]: 100,
  [EEffect.FAKE_EXPLODE]: 30,
};

export class EffectSprite extends Frame {
  type!: EEffect;
  meta: number[] = [];

  startAnimate = -1;
  created = Date.now();

  deathIcons = new Sprite(deathIconsSrc);

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const { sprite, frames } = ANIMATIONS[this.type];
    const frame = (time - this.startAnimate) / SPEEDS[this.type] | 0;
    this.sprite = sprite;
    this.frame.set(frames[toLimit(frame, 0, frames.length - 1)]);
  }

  render(camera: Camera): void {
    if (this.type === EEffect.DEATH && this.frame.x > 3) {
      const [frame = 0] = this.meta;
      this.deathIcons.render(
        camera.ctx,
        DEATH_FRAMES[frame]
      );
    }

    super.render(camera);
  }
}