import { Socket } from "socket.io";
import { createLogger } from "vite";

import { delay } from "../lib/delay";
import { effectObject } from "../lib/effectObject";
import { find } from "../lib/find";
import { map } from "../lib/map";
import { pick } from "../lib/pick";
import { random } from "../lib/random";
import { Achivment } from "./Achivment";
import { Bomb } from "./Bomb";
import { Explode } from "./Explode";
import { GameMap } from "./GameMap";
import { Player } from "./Player";

import type { TChatInfo, TPoint } from "../../src/types";

const logger = createLogger('info', { allowClearScreen: true });

export const defaultConfig = {
  fillBlocks: .5,
  fillAchivments: .1,
  startExplodeRadius: 1,
  startBombsCount: 1,
  startLiveCount: 1,
};

export const defaultStartPositions: TPoint[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
];

export type TConfig = typeof defaultConfig;

export class Game {
  #settings: TConfig;

  map!: GameMap;
  bombs = new Set<Bomb>();
  explodes = new Set<Explode>();
  achivments = new Set<Achivment>();
  players = new Set<Player>();

  startPositions: TPoint[];
  usedPositions = new Set<TPoint>();

  running = false;

  waitForRestart = -1;

  getFreePosition() {
    const free = this.startPositions
      .filter(e => !this.usedPositions.has(e));
    const position = random(free);
    this.usedPositions.add(position);
    return position;
  }

  releaseFreePosition(position: TPoint) {
    this.usedPositions.delete(position);
  }

  get spectratorsCount() { return map(this.players, e => e, e => !e.inGame).length; }
  get playersCount() { return map(this.players, e => e, e => e.inGame).length; }
  get slotLimits() { return this.startPositions.length; }

  get settings() {
    return { ...this.#settings };
  }

  constructor(
    public width: number,
    public height: number,
    settings?: Partial<TConfig>,
    startPositions: TPoint[] = defaultStartPositions
  ) {
    this.#settings = { ...defaultConfig, ...settings };
    this.startPositions = startPositions
      .map(([x, y]) => [x * (width - 1) | 0, y * (height - 1) | 0])
      .map(([x, y]) => [(x & 1) ? x - 1 : x, (y & 1) ? y - 1 : y]);

    this.restart();
  }

  restart() {
    const { width, height } = this;

    this.waitForRestart = -1;

    for (const player of this.players) {
      if (!player.inGame) continue;
      player.reset();
    }

    this.bombs.clear();
    this.achivments.clear();
    this.explodes.clear();

    this.map = new GameMap(width, height, this);
    this.map.generate(this.settings);
  }

  message(message: string, sender?: Player) {
    for (const player of this.players)
      player.api.onMessage(
        message,
        sender instanceof Player ? ({ name: sender.name }) : ({ name: 'server' }),
        sender === player
      );
  }

  join(socket: Socket) {
    let player = find(this.players, { socket });
    if (player) return;
    player = new Player(this, socket);
    player.connect();
    this.players.add(player);
  }

  leave(socket: Socket) {
    const player = find(this.players, { socket });
    if (!player) return;
    this.players.delete(player);
    player.disconnect();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop()
      .catch(console.error);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
  }

  get info() {
    return pick(this, [
      'width',
      'height',
      'playersCount',
      'startPositions',
      'spectratorsCount'
    ]);
  }

  async loop() {
    while (this.running) {
      const { players, playersCount } = this;

      effectObject(
        this,
        'playersCount',
        this.playersCount,
        count => {
          logger.info('Players count ' + count);
        }
      );

      for (const explode of this.explodes) {
        explode.update();
      }

      for (const bomb of this.bombs) {
        bomb.update();
      }

      for (const achivment of this.achivments) {
        achivment.update();
      }

      for (const player of this.players) {
        player.update();
      }

      effectObject(
        this,
        'restartGame',
        playersCount && map(
          players,
          e => e,
          e => !e.isDeath && e.inGame
        ).length <= +!!(playersCount - 1),
        (isRestart) => {
          if (isRestart) {
            logger.info("Wait restart");
            this.waitForRestart = Date.now() + 3000;

            if (this.playersCount > 1) {
              const winPlayer = find(this.players, e => e.inGame && !e.isDeath);
              if (winPlayer) {
                this.message(`${winPlayer.name} победил`);
              } else {
                this.message(`Никто не выиграл`);
              }
            }
          } else {
            if (this.waitForRestart > 0) {
              logger.info("Cancel restart");
            }
            this.waitForRestart = -1;
          }
        }
      );

      if (this.waitForRestart > 0) {
        if (Date.now() > this.waitForRestart + 500) {
          logger.info("Restart");
          this.restart();
        }
      }

      await delay(20);
    }
  }
}