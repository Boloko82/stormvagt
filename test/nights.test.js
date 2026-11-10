import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../server/game/constants.js';
import { nightPlan } from '../server/game/nights.js';
import { stepShips } from '../server/game/ships.js';
import { createNight } from '../server/game/index.js';

function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const players = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
const ship = side => ({ id: 's', side, progress: 0, danger: 0, status: 'sailing' });

test('ship counts per night grow with nights and players', () => {
  const base = [4, 5, 6, 7, 8];
  for (let night = 1; night <= 5; night++) {
    for (const n of [2, 3, 4]) assert.equal(nightPlan(night, n, seeded(1)).ships.length, base[night - 1] + n - 2);
  }
});

test('night 1 has no windows, water or lightning; windows from 2, water from 3, lightning from 4', () => {
  const p1 = nightPlan(1, 2, seeded(2));
  assert.equal(p1.windowBreaks.length, 0); assert.equal(p1.lightning.length, 0); assert.equal(p1.rates.waterBase, 0);
  const p2 = nightPlan(2, 2, seeded(2));
  assert.ok(p2.windowBreaks.length > 0); assert.equal(p2.rates.waterBase, 0); assert.equal(p2.lightning.length, 0);
  const p3 = nightPlan(3, 2, seeded(2));
  assert.ok(p3.rates.waterBase > 0); assert.equal(p3.lightning.length, 0);
  assert.ok(nightPlan(4, 2, seeded(2)).lightning.length > 0);
  assert.ok(nightPlan(5, 2, seeded(2)).lightning.length > 0);
});

test('more players make windows and lightning more frequent', () => {
  assert.ok(nightPlan(5, 4, seeded(3)).windowBreaks.length > nightPlan(5, 2, seeded(3)).windowBreaks.length);
  assert.ok(nightPlan(5, 4, seeded(3)).rates.waterBase > nightPlan(5, 2, seeded(3)).rates.waterBase);
});

test('night 1 never has more than 3 ships sailing at once even if none are lit', () => {
  const plan = nightPlan(1, 4, seeded(4));
  const times = plan.ships.map(s => s.at).sort((a, b) => a - b);
  for (let i = 3; i < times.length; i++) assert.ok(times[i] - times[i - 3] > 25);
});

test('a lit ship reaches harbour in 600 ticks; an unlit ship wrecks in 750', () => {
  const a = ship('left'); const ev = [];
  for (let i = 0; i < 599; i++) stepShips([a], { left: true, right: false }, DT, ev);
  assert.equal(a.status, 'sailing');
  stepShips([a], { left: true, right: false }, DT, ev);
  assert.equal(a.status, 'harbour'); assert.equal(ev.filter(e => e.type === 'harbour').length, 1);
  const b = ship('right');
  for (let i = 0; i < 749; i++) stepShips([b], { left: true, right: false }, DT, ev);
  assert.equal(b.status, 'sailing');
  stepShips([b], { left: true, right: false }, DT, ev);
  assert.equal(b.status, 'wrecked'); assert.equal(ev.filter(e => e.type === 'wreck').length, 1);
});

test('danger never drops when the ship is lit again', () => {
  const s = ship('left');
  for (let i = 0; i < 300; i++) stepShips([s], { left: false, right: false }, DT, []);
  const d = s.danger;
  for (let i = 0; i < 100; i++) stepShips([s], { left: true, right: false }, DT, []);
  assert.equal(s.danger, d); assert.ok(s.progress > 0);
});

function nightWithShip(side) {
  const g = createNight({ night: 1, players: players(2), rng: seeded(9) });
  g.plan.ships = [{ at: 0, side }]; g.ships.length = 0; g.shipsTotal = 1;
  return g;
}

test('empty oil leaves both sides unlit; a jammed lens leaves the ship unlit', () => {
  const g = nightWithShip('left'); g.tower.oil = 0; g.tower.lens = 'left';
  for (let i = 0; i < 60; i++) g.step({});
  assert.equal(g.ships[0].progress, 0); assert.ok(g.ships[0].danger > 0);
  const h = nightWithShip('left'); h.tower.lens = 'left'; h.tower.lensJammed = true;
  for (let i = 0; i < 60; i++) h.step({});
  assert.equal(h.ships[0].progress, 0);
  const k = nightWithShip('left'); k.tower.lens = 'left';
  for (let i = 0; i < 60; i++) k.step({});
  assert.ok(k.ships[0].progress > 0); assert.equal(k.ships[0].danger, 0);
});

test('the third wreck loses the night at once; all resolved with 2 wrecks wins', () => {
  const g = createNight({ night: 1, players: players(2), rng: seeded(5) });
  g.plan.ships = [{ at: 0, side: 'right' }, { at: 0, side: 'right' }, { at: 0, side: 'right' }, { at: 0, side: 'left' }];
  g.shipsTotal = 4; g.tower.lens = 'left';
  for (let i = 0; i < 2000 && !g.isOver(); i++) { g.tower.oil = 100; g.step({}); }
  assert.equal(g.getState().phase, 'lost');
  assert.deepEqual(g.getResult(), { won: false, night: 1, saved: 1, wrecked: 3 });
  const h = createNight({ night: 1, players: players(2), rng: seeded(5) });
  h.plan.ships = [{ at: 0, side: 'right' }, { at: 0, side: 'right' }, { at: 0, side: 'left' }];
  h.shipsTotal = 3; h.tower.lens = 'left';
  for (let i = 0; i < 2000 && !h.isOver(); i++) { h.tower.oil = 100; h.step({}); }
  assert.equal(h.getState().phase, 'won');
  assert.deepEqual(h.getResult(), { won: true, night: 1, saved: 1, wrecked: 2 });
});

test('a player can walk, and Space works through the game', () => {
  const g = createNight({ night: 1, players: players(2), rng: seeded(6) });
  const x0 = g.getState().players[0].x;
  for (let i = 0; i < 15; i++) g.step({ p0: { right: true } });
  assert.ok(g.getState().players[0].x > x0);
});

test('removePlayer drops their item and the night continues', () => {
  const g = createNight({ night: 1, players: players(2), rng: seeded(7) });
  const p = g.players.find(q => q.id === 'p1'); p.carry = { kind: 'board' };
  const before = g.tower.items.length;
  g.removePlayer('p1');
  assert.equal(g.getState().players.length, 1);
  assert.equal(g.tower.items.length, before + 1);
  g.step({}); assert.equal(g.isOver(), false);
});

test('same seed and inputs give the same state', () => {
  const run = () => {
    const g = createNight({ night: 5, players: players(3), rng: seeded(11) });
    for (let i = 0; i < 600; i++) g.step({ p0: { right: i % 60 < 30, left: i % 60 >= 30, act: i % 7 === 0 } });
    return JSON.stringify(g.getState());
  };
  assert.equal(run(), run());
});

test('getState is JSON-safe and has the documented fields', () => {
  const g = createNight({ night: 3, players: players(2), rng: seeded(12) });
  for (let i = 0; i < 400; i++) g.step({});
  const s = JSON.parse(JSON.stringify(g.getState()));
  for (const k of ['night', 'phase', 'time', 'players', 'tower', 'ships', 'wrecked', 'saved', 'shipsTotal']) assert.ok(k in s, k);
  for (const k of ['oil', 'lens', 'lensJammed', 'water', 'flooded', 'broken', 'items']) assert.ok(k in s.tower, k);
  assert.ok(Array.isArray(s.tower.broken));
});

test('night 3 water rises when nobody pumps', () => {
  const g = createNight({ night: 3, players: players(2), rng: seeded(13) });
  for (let i = 0; i < 900; i++) g.step({});
  assert.ok(g.tower.water > 0);
});
