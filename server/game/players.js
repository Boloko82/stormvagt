import { WALK_SPEED, CLIMB_SPEED, LADDER_GRAB, FLOOD_SLOW, REACH } from './constants.js';
import { WORLD, floorById } from './world.js';

export function makePlayer({ id, name, x, floor }) {
  const f = floorById(floor);
  return { id, name, x, y: f.y, floor, onLadder: false, facing: 1, carry: null, hold: null };
}

const floorAtY = y => WORLD.floors.find(f => Math.abs(f.y - y) < 0.01) || null;
const nearestFloor = y => WORLD.floors.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));

export function stepPlayer(p, keys, dt, { flooded = false } = {}) {
  const L = WORLD.ladder;
  const vert = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const horiz = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  if (!p.onLadder && vert !== 0 && Math.abs(p.x - L.x) <= LADDER_GRAB) {
    const canGo = vert < 0 ? p.y > L.top + 0.01 : p.y < L.bottom - 0.01;
    if (canGo) { p.onLadder = true; p.x = L.x; p.floor = null; }
  }

  if (p.onLadder) {
    if (vert !== 0) {
      p.y = Math.min(L.bottom, Math.max(L.top, p.y + vert * CLIMB_SPEED * dt));
    } else {
      const target = nearestFloor(p.y).y;
      const step = CLIMB_SPEED * dt;
      p.y = Math.abs(target - p.y) <= step ? target : p.y + Math.sign(target - p.y) * step;
    }
    const f = floorAtY(p.y);
    if (f && (vert === 0 || horiz !== 0)) { p.onLadder = false; p.floor = f.id; p.y = f.y; }
    else return;
  }

  if (horiz !== 0) {
    p.facing = horiz;
    const f = floorById(p.floor);
    const slow = flooded && (p.floor === 'cellar' || p.floor === 'oil') ? FLOOD_SLOW : 1;
    p.x = Math.min(f.right, Math.max(f.left, p.x + horiz * WALK_SPEED * slow * dt));
  }
}

// Everything within reach, nearest first (items win ties, so a dropped item can be picked up).
export function targetsInReach(p, world, items) {
  if (p.onLadder) return [];
  const found = [];
  const consider = (type, id, kind, x) => {
    const d = Math.abs(x - p.x);
    if (d <= REACH) found.push({ d, order: found.length, t: { type, id, kind } });
  };
  for (const it of items) if (it.floor === p.floor) consider('item', it.id, it.kind, it.x);
  for (const w of world.windows) if (w.floor === p.floor) consider('window', w.id, 'window', w.x);
  for (const s of world.stations) if (s.floor === p.floor) consider('station', s.id, s.kind, s.x);
  return found.sort((a, b) => a.d - b.d || a.order - b.order).map((f) => f.t);
}

export function targetInReach(p, world, items) {
  return targetsInReach(p, world, items)[0] || null;
}
