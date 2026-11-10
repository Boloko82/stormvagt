import { DT, MAX_WRECKS } from './constants.js';
import { WORLD } from './world.js';
import { makePlayer, stepPlayer } from './players.js';
import { makeTower, useSpace, stepTower, breakWindow, strikeLightning, dropCarried } from './tower.js';
import { stepShips } from './ships.js';
import { nightPlan } from './nights.js';

const START_X = [132, 150, 170, 188];

export function createNight({ night, players, rng = Math.random }) {
  const plan = nightPlan(night, players.length, rng);
  const tower = makeTower(WORLD, players.length);
  const keepers = players.map((p, i) => Object.assign(makePlayer({ id: p.id, name: p.name, x: START_X[i % 4], floor: 'lantern' }), { prevAct: false }));
  let events = [];
  let nextShip = 0, nextBreak = 0, nextBolt = 0, shipId = 0;

  const game = {
    plan, tower, players: keepers, ships: [], shipsTotal: plan.ships.length,
    time: 0, phase: 'playing', wrecked: 0, saved: 0,

    step(inputs = {}) {
      if (game.phase !== 'playing') return;
      for (const p of keepers) {
        const k = inputs[p.id] || {};
        stepPlayer(p, k, DT, { flooded: tower.flooded });
        const act = !!k.act;
        useSpace(tower, p, act && !p.prevAct, act, DT, WORLD, events);
        p.prevAct = act;
      }
      while (nextShip < plan.ships.length && plan.ships[nextShip].at <= game.time) {
        const s = plan.ships[nextShip++];
        const ship = { id: 's' + (shipId++), side: s.side, progress: 0, danger: 0, status: 'sailing' };
        game.ships.push(ship);
        events.push({ type: 'ship', id: ship.id, side: ship.side });
      }
      while (nextBreak < plan.windowBreaks.length && plan.windowBreaks[nextBreak] <= game.time) {
        nextBreak++;
        const whole = WORLD.windows.filter(w => !tower.broken.has(w.id));
        if (whole.length) breakWindow(tower, whole[Math.floor(rng() * whole.length)].id, events);
      }
      while (nextBolt < plan.lightning.length && plan.lightning[nextBolt] <= game.time) {
        nextBolt++;
        strikeLightning(tower, events);
      }
      stepTower(tower, DT, plan.rates, events);
      const on = tower.oil > 0 && !tower.lensJammed;
      stepShips(game.ships, { left: on && tower.lens === 'left', right: on && tower.lens === 'right' }, DT, events);
      game.wrecked = game.ships.filter(s => s.status === 'wrecked').length;
      game.saved = game.ships.filter(s => s.status === 'harbour').length;
      if (game.wrecked > MAX_WRECKS) { game.phase = 'lost'; events.push({ type: 'lost' }); }
      else if (game.saved + game.wrecked >= game.shipsTotal) { game.phase = 'won'; events.push({ type: 'dawn' }); }
      game.time += DT;
    },

    getState() {
      return {
        night, phase: game.phase, time: game.time,
        players: keepers.map(p => ({
          id: p.id, name: p.name, x: p.x, y: p.y, floor: p.floor, onLadder: p.onLadder, facing: p.facing,
          carry: p.carry ? { ...p.carry } : null,
          hold: p.hold ? { target: p.hold.target, ticks: p.hold.ticks, need: p.hold.need } : null,
        })),
        tower: {
          oil: tower.oil, lens: tower.lens, lensJammed: tower.lensJammed,
          water: tower.water, flooded: tower.flooded, broken: [...tower.broken],
          items: tower.items.map(i => ({ ...i })),
        },
        ships: game.ships.map(s => ({ ...s })),
        wrecked: game.wrecked, saved: game.saved, shipsTotal: game.shipsTotal,
      };
    },

    drainEvents() { const e = events; events = []; return e; },
    isOver() { return game.phase !== 'playing'; },
    getResult() { return { won: game.phase === 'won', night, saved: game.saved, wrecked: game.wrecked }; },

    removePlayer(id) {
      const i = keepers.findIndex(p => p.id === id);
      if (i < 0) return;
      dropCarried(tower, keepers[i]);
      keepers.splice(i, 1);
    },
  };
  return game;
}
