import {
  OIL_MAX, OIL_BURN, OIL_BURN_PER_WINDOW, OIL_PER_CAN, POUR_TIME, FILL_TIME,
  TURN_TIME, LENS_REPAIR_TIME, WINDOW_REPAIR_TIME, WATER_MAX, FLOOD_LEVEL, PUMP_RATE,
} from './constants.js';
import { WORLD } from './world.js';
import { targetsInReach } from './players.js';

export function makeTower(world, playerCount) {
  const items = [];
  for (let i = 0; i < playerCount; i++) items.push({ id: 'i' + i, kind: 'can', full: false, x: 138 + i * 8, floor: 'oil' });
  return {
    oil: OIL_MAX, lens: 'left', lensJammed: false,
    water: 0, flooded: false, broken: new Set(),
    items, nextId: playerCount,
  };
}

// What holding Space at this target would do for this player, or null.
function actionFor(t, p, target) {
  if (!target) return null;
  const c = p.carry;
  if (target.type === 'window') {
    if (c?.kind !== 'board' || !t.broken.has(target.id)) return null;
    return { key: 'window:' + target.id, time: WINDOW_REPAIR_TIME,
      done: ev => { t.broken.delete(target.id); p.carry = null; ev.push({ type: 'repair', what: 'window', id: target.id }); } };
  }
  if (target.type !== 'station') return null;
  switch (target.kind) {
    case 'lamp':
      if (c?.kind !== 'can' || !c.full) return null;
      return { key: 'lamp', time: POUR_TIME,
        done: ev => { t.oil = Math.min(OIL_MAX, t.oil + OIL_PER_CAN); p.carry = { kind: 'can', full: false }; ev.push({ type: 'pour' }); } };
    case 'barrels':
      if (c?.kind !== 'can' || c.full || t.flooded) return null;
      return { key: 'barrels', time: FILL_TIME,
        done: ev => { p.carry = { kind: 'can', full: true }; ev.push({ type: 'fill' }); } };
    case 'crankLeft':
    case 'crankRight': {
      const side = target.kind === 'crankLeft' ? 'left' : 'right';
      if (t.lensJammed || t.lens === side) return null;
      return { key: 'crank:' + side, time: TURN_TIME,
        done: ev => { t.lens = side; ev.push({ type: 'turn', side }); } };
    }
    case 'lens':
      if (c?.kind !== 'board' || !t.lensJammed) return null;
      return { key: 'lens', time: LENS_REPAIR_TIME,
        done: ev => { t.lensJammed = false; p.carry = null; ev.push({ type: 'repair', what: 'lens' }); } };
    case 'pump':
      return { key: 'pump', continuous: true };
    default:
      return null;
  }
}

function dropAt(t, p, x, floor, events) {
  const it = { id: 'i' + (t.nextId++), kind: p.carry.kind, x, floor };
  if (p.carry.kind === 'can') it.full = p.carry.full;
  t.items.push(it);
  p.carry = null;
  events?.push({ type: 'drop', id: p.id });
}

// pressed: Space went down this tick. held: Space is down this tick.
export function useSpace(t, p, pressed, held, dt, world = WORLD, events = []) {
  if (p.onLadder) { p.hold = null; return; }
  // A station or window that can be used right now beats an item lying on the floor next to it.
  const all = targetsInReach(p, world, t.items);
  const target = all.find((tg) => tg.type !== 'item' && actionFor(t, p, tg)) || all[0] || null;

  if (pressed && !actionFor(t, p, target)) {
    p.hold = null;
    if (!p.carry) {
      if (target?.type === 'item') {
        const i = t.items.findIndex(it => it.id === target.id);
        const it = t.items.splice(i, 1)[0];
        p.carry = it.kind === 'can' ? { kind: 'can', full: it.full } : { kind: it.kind };
        events.push({ type: 'pickup', id: p.id });
      } else if (target?.type === 'station' && target.kind === 'boards') {
        p.carry = { kind: 'board' };
        events.push({ type: 'pickup', id: p.id });
      }
    } else if (!target || target.type === 'item') {
      // Space at a station or window never drops what you carry, even when it can't be used right now.
      dropAt(t, p, p.x, p.floor, events);
    }
    return;
  }

  if (!held) { p.hold = null; return; }
  const act = actionFor(t, p, target);
  if (!act) { p.hold = null; return; }

  if (act.continuous) {
    t.water = Math.max(0, t.water - PUMP_RATE * dt);
    if (p.hold?.target !== 'pump') { p.hold = { target: 'pump', ticks: 0, need: 0 }; events.push({ type: 'pump', id: p.id }); }
    p.hold.ticks++;
    return;
  }
  const need = Math.round(act.time / dt);
  if (p.hold?.target !== act.key) p.hold = { target: act.key, ticks: 0, need };
  p.hold.ticks++;
  if (p.hold.ticks >= need) { act.done(events); p.hold = null; }
}

export function stepTower(t, dt, rates, events) {
  let lantern = 0;
  for (const id of t.broken) if (id.startsWith('lantern')) lantern++;
  const lower = t.broken.size - lantern;
  if (t.oil > 0) {
    t.oil = Math.max(0, t.oil - OIL_BURN * (1 + OIL_BURN_PER_WINDOW * lantern) * dt);
    if (t.oil === 0) events.push({ type: 'lampOut' });
  }
  t.water = Math.min(WATER_MAX, Math.max(0, t.water + (rates.waterBase + rates.waterPerWindow * lower) * dt));
  t.flooded = t.water >= FLOOD_LEVEL;
}

export function breakWindow(t, id, events) {
  if (t.broken.has(id)) return;
  t.broken.add(id);
  events.push({ type: 'break', id });
}

export function strikeLightning(t, events) {
  t.lensJammed = true;
  events.push({ type: 'lightning' });
}

// Used when a player leaves: their item lands where they stood.
export function dropCarried(t, p) {
  p.hold = null;
  if (!p.carry) return;
  const floor = p.floor ?? WORLD.floors.reduce((a, b) => (Math.abs(b.y - p.y) < Math.abs(a.y - p.y) ? b : a)).id;
  dropAt(t, p, p.x, floor, null);
}
