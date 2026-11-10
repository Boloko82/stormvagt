import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DT } from '../server/game/constants.js';
import { WORLD, floorById } from '../server/game/world.js';
import { makePlayer, stepPlayer, targetInReach } from '../server/game/players.js';

const keys = (k = {}) => ({ left: false, right: false, up: false, down: false, act: false, ...k });
const run = (p, k, secs, opts) => { for (let i = 0; i < Math.round(secs / DT); i++) stepPlayer(p, keys(k), DT, opts); };
const station = id => WORLD.stations.find(s => s.id === id);

test('walking right moves right and stops at the wall', () => {
  const f = floorById('workshop');
  const p = makePlayer({ id: 'a', name: 'A', x: 140, floor: 'workshop' });
  run(p, { right: true }, 0.5);
  assert.ok(p.x > 140);
  run(p, { right: true }, 10);
  assert.equal(p.x, f.right);
  assert.equal(p.y, f.y);
  assert.equal(p.facing, 1);
});

test('up at the ladder climbs to the floor above', () => {
  const p = makePlayer({ id: 'a', name: 'A', x: WORLD.ladder.x, floor: 'oil' });
  run(p, { up: true }, 0.2);
  assert.equal(p.onLadder, true);
  run(p, { up: true }, 0.3);
  run(p, {}, 2);
  assert.equal(p.onLadder, false);
  assert.equal(p.floor, 'workshop');
  assert.equal(p.y, floorById('workshop').y);
});

test('up away from the ladder does nothing', () => {
  const p = makePlayer({ id: 'a', name: 'A', x: WORLD.ladder.x + 30, floor: 'oil' });
  run(p, { up: true }, 1);
  assert.equal(p.onLadder, false);
  assert.equal(p.floor, 'oil');
});

test('cannot climb above the lantern room or below the cellar', () => {
  const p = makePlayer({ id: 'a', name: 'A', x: WORLD.ladder.x, floor: 'lantern' });
  run(p, { up: true }, 1);
  assert.equal(p.floor, 'lantern');
  const q = makePlayer({ id: 'b', name: 'B', x: WORLD.ladder.x, floor: 'cellar' });
  run(q, { down: true }, 1);
  assert.equal(q.floor, 'cellar');
});

test('flooded cellar walking is slower', () => {
  const a = makePlayer({ id: 'a', name: 'A', x: 140, floor: 'cellar' });
  const b = makePlayer({ id: 'b', name: 'B', x: 140, floor: 'cellar' });
  run(a, { right: true }, 0.3, { flooded: false });
  run(b, { right: true }, 0.3, { flooded: true });
  assert.ok(b.x - 140 < (a.x - 140) * 0.75);
  const c = makePlayer({ id: 'c', name: 'C', x: 140, floor: 'workshop' });
  run(c, { right: true }, 0.3, { flooded: true });
  assert.equal(c.x, a.x);
});

test('targetInReach finds the lamp, and nothing on the ladder', () => {
  const lamp = station('lamp');
  const p = makePlayer({ id: 'a', name: 'A', x: lamp.x, floor: 'lantern' });
  assert.deepEqual(targetInReach(p, WORLD, []), { type: 'station', id: 'lamp', kind: 'lamp' });
  const q = makePlayer({ id: 'b', name: 'B', x: WORLD.ladder.x, floor: 'oil' });
  stepPlayer(q, keys({ up: true }), DT);
  assert.equal(q.onLadder, true);
  assert.equal(targetInReach(q, WORLD, []), null);
});

test('targetInReach prefers the nearest of item, window and station', () => {
  const w = WORLD.windows.find(x => x.floor === 'workshop' && x.side === 'left');
  const p = makePlayer({ id: 'a', name: 'A', x: w.x + 2, floor: 'workshop' });
  assert.deepEqual(targetInReach(p, WORLD, []), { type: 'window', id: w.id, kind: 'window' });
  const items = [{ id: 'i1', kind: 'board', x: w.x + 3, floor: 'workshop' }];
  assert.deepEqual(targetInReach(p, WORLD, items), { type: 'item', id: 'i1', kind: 'board' });
});

test('stations and windows on one floor are far enough apart to tell apart', () => {
  for (const f of WORLD.floors) {
    const xs = [...WORLD.stations.filter(s => s.floor === f.id), ...WORLD.windows.filter(w => w.floor === f.id)].map(s => s.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 14, `${f.id}: ${xs}`);
  }
});
