import { SHIP_SAVE_TIME, SHIP_WRECK_TIME } from './constants.js';

// lit: { left: boolean, right: boolean }
export function stepShips(ships, lit, dt, events) {
  for (const s of ships) {
    if (s.status !== 'sailing') continue;
    if (lit[s.side]) {
      s.progress = Math.min(100, s.progress + (100 / SHIP_SAVE_TIME) * dt);
      if (s.progress >= 100 - 1e-9) { s.progress = 100; s.status = 'harbour'; events.push({ type: 'harbour', id: s.id, side: s.side }); }
    } else {
      s.danger = Math.min(100, s.danger + (100 / SHIP_WRECK_TIME) * dt);
      if (s.danger >= 100 - 1e-9) { s.danger = 100; s.status = 'wrecked'; events.push({ type: 'wreck', id: s.id, side: s.side }); }
    }
  }
}
