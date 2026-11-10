import { NIGHTS, FIRST_SHIP_AT, EXTRA_PLAYER_SCALE } from './constants.js';

// Builds the schedule for one night. All times are seconds from the start.
export function nightPlan(night, playerCount, rng) {
  const cfg = NIGHTS[night - 1];
  if (!cfg) throw new Error(`Unknown night: ${night}`);
  const extra = Math.max(0, playerCount - 2);
  const scale = 1 + EXTRA_PLAYER_SCALE * extra;
  const count = cfg.ships + extra;
  const gap = cfg.span / count;

  const ships = [];
  for (let i = 0; i < count; i++) {
    const at = FIRST_SHIP_AT + i * gap + (rng() - 0.5) * gap * 0.4;
    ships.push({ at: Math.max(FIRST_SHIP_AT, at), side: rng() < 0.5 ? 'left' : 'right' });
  }
  ships.sort((a, b) => a.at - b.at);

  const spread = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) out.push(FIRST_SHIP_AT + 10 + rng() * cfg.span);
    return out.sort((a, b) => a - b);
  };
  return {
    ships,
    windowBreaks: spread(Math.round(cfg.windowBreaks * scale)),
    lightning: spread(Math.round(cfg.lightning * scale)),
    rates: { waterBase: cfg.waterBase * scale, waterPerWindow: cfg.waterPerWindow },
  };
}
