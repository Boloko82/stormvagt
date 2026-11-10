import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../server/game/constants.js';
import { WORLD } from '../server/game/world.js';
import { makePlayer } from '../server/game/players.js';
import { makeTower, useSpace, stepTower, breakWindow, strikeLightning, dropCarried } from '../server/game/tower.js';

const at = id => WORLD.stations.find(s => s.id === id) || WORLD.windows.find(w => w.id === id);
let n = 0;
const keeper = (id, carry = null) => {
  const s = at(id);
  const p = makePlayer({ id: 'p' + (n++), name: 'P', x: s.x, floor: s.floor });
  p.carry = carry;
  return p;
};
const rates0 = { waterBase: 0, waterPerWindow: 0 };
// Hold Space for k ticks; the first tick is the press.
const hold = (t, p, k) => { const ev = []; for (let i = 0; i < k; i++) useSpace(t, p, i === 0, true, DT, WORLD, ev); return ev; };
const cont = (t, p) => useSpace(t, p, false, true, DT, WORLD, []);
const ticks = secs => Math.round(secs / DT);

test('oil burns 10 in 10 s, 15 with one broken lantern window', () => {
  const t = makeTower(WORLD, 2);
  for (let i = 0; i < ticks(10); i++) stepTower(t, DT, rates0, []);
  assert.ok(Math.abs(t.oil - 90) < 1e-6);
  const u = makeTower(WORLD, 2); breakWindow(u, 'lantern-left', []);
  for (let i = 0; i < ticks(10); i++) stepTower(u, DT, rates0, []);
  assert.ok(Math.abs(u.oil - 85) < 1e-6);
});

test('a broken lower window does not change the oil burn', () => {
  const t = makeTower(WORLD, 2); breakWindow(t, 'oil-left', []);
  for (let i = 0; i < ticks(10); i++) stepTower(t, DT, rates0, []);
  assert.ok(Math.abs(t.oil - 90) < 1e-6);
});

test('lamp going out emits lampOut once and oil never goes below 0', () => {
  const t = makeTower(WORLD, 2); t.oil = 0.5; const ev = [];
  for (let i = 0; i < 60; i++) stepTower(t, DT, rates0, ev);
  assert.equal(t.oil, 0);
  assert.equal(ev.filter(e => e.type === 'lampOut').length, 1);
});

test('pouring a full can takes 30 ticks, adds 50 and caps at 100', () => {
  const u = makeTower(WORLD, 2); u.oil = 20;
  const q = keeper('lamp', { kind: 'can', full: true });
  hold(u, q, 29); assert.equal(u.oil, 20);
  cont(u, q); assert.equal(u.oil, 70); assert.deepEqual(q.carry, { kind: 'can', full: false });
  const v = makeTower(WORLD, 2); v.oil = 80;
  hold(v, keeper('lamp', { kind: 'can', full: true }), 30); assert.equal(v.oil, 100);
});

test('filling a can takes 45 ticks and is refused when flooded', () => {
  const t = makeTower(WORLD, 2); const p = keeper('barrels', { kind: 'can', full: false });
  hold(t, p, 44); assert.equal(p.carry.full, false);
  cont(t, p); assert.equal(p.carry.full, true);
  const u = makeTower(WORLD, 2); u.water = 60; stepTower(u, DT, rates0, []);
  assert.equal(u.flooded, true);
  const q = keeper('barrels', { kind: 'can', full: false });
  hold(u, q, 120); assert.equal(q.carry.full, false);
});

test('lens turns after 60 ticks at the crank, not when jammed', () => {
  const t = makeTower(WORLD, 2); assert.equal(t.lens, 'left');
  const p = keeper('crankRight');
  hold(t, p, 59); assert.equal(t.lens, 'left');
  cont(t, p); assert.equal(t.lens, 'right');
  strikeLightning(t, []); assert.equal(t.lensJammed, true);
  hold(t, keeper('crankLeft'), 120); assert.equal(t.lens, 'right');
});

test('jammed lens is repaired by a 90-tick hold with a board, which is used up', () => {
  const t = makeTower(WORLD, 2); strikeLightning(t, []);
  const p = keeper('lens', { kind: 'board' });
  hold(t, p, 89); assert.equal(t.lensJammed, true);
  cont(t, p); assert.equal(t.lensJammed, false); assert.equal(p.carry, null);
});

test('window repair takes 60 ticks and uses the board', () => {
  const t = makeTower(WORLD, 2); breakWindow(t, 'workshop-left', []);
  const p = keeper('workshop-left', { kind: 'board' });
  hold(t, p, 59); assert.ok(t.broken.has('workshop-left'));
  cont(t, p); assert.ok(!t.broken.has('workshop-left')); assert.equal(p.carry, null);
});

test('releasing Space at 59 ticks resets progress', () => {
  const t = makeTower(WORLD, 2); breakWindow(t, 'workshop-left', []);
  const p = keeper('workshop-left', { kind: 'board' });
  hold(t, p, 59); useSpace(t, p, false, false, DT, WORLD, []);
  assert.equal(p.hold, null);
  hold(t, p, 59); assert.ok(t.broken.has('workshop-left'));
});

test('walking away mid-hold resets progress', () => {
  const t = makeTower(WORLD, 2); breakWindow(t, 'workshop-left', []);
  const p = keeper('workshop-left', { kind: 'board' });
  hold(t, p, 50); p.x += 30; cont(t, p); assert.equal(p.hold, null);
  p.x -= 30; for (let i = 0; i < 20; i++) cont(t, p);
  assert.ok(t.broken.has('workshop-left'));
});

test('two players pumping lower water twice as fast', () => {
  const t = makeTower(WORLD, 2); t.water = 50;
  hold(t, keeper('pump'), 30); const one = 50 - t.water;
  const u = makeTower(WORLD, 2); u.water = 50;
  const b = keeper('pump'), c = keeper('pump');
  for (let i = 0; i < 30; i++) { useSpace(u, b, i === 0, true, DT, WORLD, []); useSpace(u, c, i === 0, true, DT, WORLD, []); }
  assert.ok(one > 0); assert.ok(Math.abs((50 - u.water) - 2 * one) < 1e-6);
});

test('pumping works while carrying something and keeps the item', () => {
  const t = makeTower(WORLD, 2); t.water = 50;
  const p = keeper('pump', { kind: 'board' });
  hold(t, p, 30); assert.ok(t.water < 50); assert.deepEqual(p.carry, { kind: 'board' });
});

test('water rises with base rate and lower broken windows, and floods at 60', () => {
  const t = makeTower(WORLD, 2); const rates = { waterBase: 1, waterPerWindow: 2 };
  breakWindow(t, 'oil-right', []); breakWindow(t, 'lantern-left', []);
  for (let i = 0; i < ticks(10); i++) stepTower(t, DT, rates, []);
  assert.ok(Math.abs(t.water - 30) < 1e-6);
  t.water = 59.99; stepTower(t, DT, rates, []); assert.equal(t.flooded, true);
  t.water = 120; stepTower(t, DT, rates, []); assert.equal(t.water, 100);
});

test('two players repairing one window use only one board', () => {
  const t = makeTower(WORLD, 2); breakWindow(t, 'oil-left', []);
  const a = keeper('oil-left', { kind: 'board' }), b = keeper('oil-left', { kind: 'board' });
  for (let i = 0; i < 60; i++) { useSpace(t, a, i === 0, true, DT, WORLD, []); useSpace(t, b, i === 0, true, DT, WORLD, []); }
  assert.ok(!t.broken.has('oil-left'));
  assert.equal([a.carry, b.carry].filter(c => c === null).length, 1);
});

test('press picks up and drops; boards come from the stack', () => {
  const t = makeTower(WORLD, 2);
  const can = t.items[0];
  const p = makePlayer({ id: 'x', name: 'X', x: can.x, floor: can.floor });
  useSpace(t, p, true, true, DT, WORLD, []);
  assert.deepEqual(p.carry, { kind: 'can', full: false });
  assert.equal(t.items.length, 1);
  useSpace(t, p, false, false, DT, WORLD, []);
  p.x = 130; useSpace(t, p, true, true, DT, WORLD, []);
  assert.equal(p.carry, null); assert.equal(t.items.length, 2);
  const q = keeper('boards'); useSpace(t, q, true, true, DT, WORLD, []);
  assert.deepEqual(q.carry, { kind: 'board' });
});

test('a press on the ladder does not drop the item', () => {
  const t = makeTower(WORLD, 2);
  const p = makePlayer({ id: 'x', name: 'X', x: WORLD.ladder.x, floor: 'oil' });
  p.carry = { kind: 'board' }; p.onLadder = true; p.floor = null; p.y -= 10;
  useSpace(t, p, true, true, DT, WORLD, []);
  assert.deepEqual(p.carry, { kind: 'board' });
  assert.equal(t.items.length, 2);
});

test('dropCarried puts the item where the player stood', () => {
  const t = makeTower(WORLD, 2);
  const p = makePlayer({ id: 'x', name: 'X', x: 150, floor: 'workshop' }); p.carry = { kind: 'can', full: true };
  dropCarried(t, p);
  const it = t.items.at(-1);
  assert.equal(it.kind, 'can'); assert.equal(it.full, true); assert.equal(it.x, 150); assert.equal(it.floor, 'workshop');
  assert.equal(p.carry, null);
  const q = makePlayer({ id: 'y', name: 'Y', x: WORLD.ladder.x, floor: 'workshop' }); q.carry = { kind: 'board' }; q.onLadder = true; q.floor = null; q.y += 5;
  dropCarried(t, q); assert.equal(t.items.at(-1).floor, 'workshop');
});

test('an item lying on a station does not block using the station', () => {
  const t = makeTower(WORLD, 2); t.oil = 40;
  t.items.push({ id: 'junk', kind: 'can', full: false, x: at('lamp').x, floor: 'lantern' });
  const p = keeper('lamp', { kind: 'can', full: true });
  hold(t, p, 30);
  assert.equal(t.oil, 90);
  assert.deepEqual(p.carry, { kind: 'can', full: false });
  const w = makeTower(WORLD, 2); breakWindow(w, 'oil-left', []);
  w.items.push({ id: 'junk', kind: 'board', x: at('oil-left').x + 1, floor: 'oil' });
  const q = keeper('oil-left', { kind: 'board' }); q.x += 1;
  hold(w, q, 60);
  assert.ok(!w.broken.has('oil-left'));
});

test('with empty hands, Space at a station with an item on it picks the item up', () => {
  const t = makeTower(WORLD, 2);
  t.items.push({ id: 'junk', kind: 'can', full: false, x: at('lamp').x, floor: 'lantern' });
  const p = keeper('lamp');
  useSpace(t, p, true, true, DT, WORLD, []);
  assert.deepEqual(p.carry, { kind: 'can', full: false });
});

test('starting cans: one empty can per player in the oil store', () => {
  const t = makeTower(WORLD, 3);
  assert.equal(t.items.length, 3);
  assert.ok(t.items.every(i => i.kind === 'can' && i.full === false && i.floor === 'oil'));
  assert.equal(t.oil, 100);
});
