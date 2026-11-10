// Draws the game: pixel art at 320x180 on an offscreen canvas, scaled up,
// plus crisp text (names, messages) drawn on top at screen resolution.
import { LAYOUT } from './layout.js';
import * as sound from './sound.js';

const W = 320, H = 180;
const DELAY = 150;            // ms behind the newest state, so motion stays smooth online
const SNAP_DIST = 30;         // larger jumps are drawn without blending
const TOAST_MS = 2600;
const FLOOR = Object.fromEntries(LAYOUT.floors.map((f) => [f.id, f]));
const ST = Object.fromEntries(LAYOUT.stations.map((s) => [s.id, s]));
const ROOM_TOP = { lantern: 40, workshop: 59, oil: 95, cellar: 131 };
const WALL_L = 100, WALL_R = 220, IN_L = 106, IN_R = 214;
const SEA_Y = 146;

let canvas = null, ctx = null, buf = null, b = null, raf = 0, ro = null;
let getSnaps = () => [], youId = null, coatOf = () => '#e8513a';
let lastSeq = 0, flashUntil = 0, toasts = [], wasFlooded = false, prevX = new Map(), walk = new Map();
let view = { scale: 1, ox: 0, oy: 0 };

const rnd = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const drops = Array.from({ length: 90 }, () => [rnd() * W, rnd() * H, 0.7 + rnd() * 0.6]);
const clouds = Array.from({ length: 8 }, () => [rnd() * W, 4 + rnd() * 34, 18 + rnd() * 26]);

export function isRunning() { return !!raf; }

// Show a short message over the game, e.g. that a keeper left.
export function notify(text) { toast(text, performance.now()); }

export function start(c, snapsFn, you, coatFn) {
  canvas = c; ctx = c.getContext('2d');
  getSnaps = snapsFn; youId = you; coatOf = coatFn;
  buf = document.createElement('canvas'); buf.width = W; buf.height = H;
  b = buf.getContext('2d');
  lastSeq = 0; toasts = []; wasFlooded = false; prevX = new Map(); walk = new Map();
  ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  raf = requestAnimationFrame(frame);
}

export function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  ro?.disconnect(); ro = null;
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(r.width * d));
  canvas.height = Math.max(1, Math.round(r.height * d));
  const fit = Math.min(canvas.width / W, canvas.height / H);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  view = { scale, ox: Math.round((canvas.width - W * scale) / 2), oy: Math.round((canvas.height - H * scale) / 2) };
}

// ---------- timeline ----------

const lerp = (a, b, k) => a + (b - a) * k;

function blend(A, B, k) {
  if (A === B || k <= 0) return A;
  const byId = new Map(A.players.map((p) => [p.id, p]));
  const players = B.players.map((p) => {
    const q = byId.get(p.id);
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > SNAP_DIST) return p;
    return { ...p, x: lerp(q.x, p.x, k), y: lerp(q.y, p.y, k) };
  });
  const shipA = new Map(A.ships.map((s) => [s.id, s]));
  const ships = B.ships.map((s) => {
    const q = shipA.get(s.id);
    return q ? { ...s, progress: lerp(q.progress, s.progress, k), danger: lerp(q.danger, s.danger, k) } : s;
  });
  return {
    ...B, players, ships,
    tower: { ...B.tower, oil: lerp(A.tower.oil, B.tower.oil, k), water: lerp(A.tower.water, B.tower.water, k) },
  };
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const snaps = getSnaps();
  const t = now / 1000;
  let s = null;
  if (snaps.length) {
    const rt = now - DELAY;
    let ai = -1;
    for (let i = 0; i < snaps.length; i++) if (snaps[i].at <= rt) ai = i;
    const A = snaps[Math.max(0, ai)];
    const B = snaps[Math.min(snaps.length - 1, ai + 1)];
    const k = ai < 0 || A === B ? 0 : Math.min(1, (rt - A.at) / Math.max(1, B.at - A.at));
    s = blend(A.s, B.s, k);
    if (snaps[0].seq > lastSeq + snaps.length) lastSeq = snaps[0].seq - 1;
    for (const sn of snaps) if (sn.seq > lastSeq && sn.at <= rt) { lastSeq = sn.seq; sn.e.forEach((e) => onEvent(e, now)); }
    if (s.tower.flooded && !wasFlooded) toast('Olielageret er oversvømmet!', now);
    wasFlooded = s.tower.flooded;
  }
  drawWorld(s, t, now);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#050913';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buf, view.ox, view.oy, W * view.scale, H * view.scale);
  if (s) drawText(s, now);
}

// ---------- events ----------

function toast(text, now) {
  toasts = toasts.filter((x) => x.text !== text);
  toasts.push({ text, until: now + TOAST_MS });
  if (toasts.length > 3) toasts.shift();
}

function onEvent(e, now) {
  const side = e.side === 'left' ? 'venstre' : 'højre';
  switch (e.type) {
    case 'ship': toast(`Skib i sigte mod ${side}!`, now); break;
    case 'harbour': toast('Et skib er i havn!', now); break;
    case 'wreck': toast('Et skib forliste!', now); break;
    case 'break': toast('En rude knuste!', now); break;
    case 'lightning': toast('Lynnedslag! Linsen sidder fast', now); flashUntil = now + 220; break;
    case 'lampOut': toast('Lampen gik ud!', now); break;
    default: break;
  }
  sound.play(e.type);
}

// ---------- pixel drawing ----------

function P(x, y, w, h, c) { b.fillStyle = c; b.fillRect(Math.round(x), Math.round(y), w, h); }

function drawWorld(s, t, now) {
  const dawn = s && s.phase === 'won' ? 1 : 0;
  // sky
  const sky = dawn ? ['#3a3f6b', '#6a5a7e', '#b9787a', '#e79a6a'] : ['#070d22', '#0b1530', '#0f1d3d', '#14264a'];
  sky.forEach((c, i) => P(0, i * 37, W, 37, c));
  for (const [x0, y, w] of clouds) {
    const x = ((x0 + t * 5) % (W + 60)) - 30;
    P(x, y, w, 4, dawn ? '#7a6a8a' : '#1c2a4c'); P(x + 5, y - 3, w - 10, 3, dawn ? '#8a789a' : '#22345a');
  }
  const lit = s && s.tower.oil > 0 && !s.tower.lensJammed;
  if (lit) drawBeam(s, t);
  // sea
  for (let y = SEA_Y; y < H; y += 2) {
    P(0, y, W, 2, y < 156 ? '#163f62' : y < 168 ? '#123552' : '#0d2a44');
    for (let x = (y * 7) % 11; x < W; x += 11) if (((x + y) >> 3) % 3 === 0) P(x + Math.sin(x * 0.2 + t * 2 + y) * 2, y, 3, 1, '#2f6a90');
  }
  // piers where ships come in
  P(76, SEA_Y - 2, 22, 3, '#5a4632'); P(222, SEA_Y - 2, 22, 3, '#5a4632');
  for (const x of [78, 88, 96, 224, 232, 242]) P(x, SEA_Y + 1, 2, 8, '#3a2e22');
  if (s) drawShips(s, t);
  drawTower(s, t, lit);
  if (s) {
    drawWater(s, t);
    for (const it of s.tower.items) drawItem(it.kind, it.full, it.x, FLOOR[it.floor].y);
    for (const p of s.players) drawKeeper(p, t);
  }
  // rain
  b.fillStyle = 'rgba(170,200,240,0.5)';
  for (const [x0, y0, sp] of drops) {
    const y = (y0 + t * 90 * sp) % H, x = ((x0 - t * 30 * sp) % W + W) % W;
    if (x > WALL_L && x < WALL_R && y > 12 && y < 170) continue; // dry inside the tower
    b.fillRect(Math.round(x), Math.round(y), 1, 3);
  }
  if (now < flashUntil) { b.fillStyle = 'rgba(225,235,255,0.55)'; b.fillRect(0, 0, W, H); }
}

function drawBeam(s, t) {
  const left = s.tower.lens === 'left';
  const ox = 160, oy = 30;
  const ex = left ? -10 : W + 10;
  const low = s.tower.oil < 20 ? 0.5 + 0.5 * Math.sin(t * 25) : 1;
  b.save();
  b.globalAlpha = 0.16 * low + 0.04 * Math.sin(t * 3);
  b.fillStyle = '#ffe9a8';
  b.beginPath(); b.moveTo(ox, oy - 2); b.lineTo(ex, 6); b.lineTo(ex, 120); b.lineTo(ox, oy + 2); b.closePath(); b.fill();
  b.globalAlpha = 0.12 * low;
  b.fillRect(left ? 0 : 220, SEA_Y, 100, 22);
  b.restore();
}

function shipPos(s, ship, laneIndex) {
  const left = ship.side === 'left';
  const travel = ship.status === 'harbour' ? 100 : ship.progress;
  const x = left ? 4 + travel * 0.68 : W - 16 - travel * 0.68;
  return { x, y: SEA_Y - 6 + laneIndex * 7, left };
}

function drawShips(s, t) {
  const lanes = { left: 0, right: 0 };
  const docked = { left: 0, right: 0 };
  for (const ship of s.ships) {
    if (ship.status === 'harbour') {
      const n = docked[ship.side]++;
      const x = ship.side === 'left' ? 80 + (n % 2) * 9 : 228 + (n % 2) * 9;
      drawBoat(x, SEA_Y - 5 - Math.floor(n / 2) * 2, ship.side === 'left', 0, t, true);
      continue;
    }
    if (ship.status === 'wrecked') {
      const x = ship.side === 'left' ? 88 : 224;
      P(x, 166, 7, 2, '#4a3426'); P(x + 2, 163, 1, 4, '#cfc6b2');
      continue;
    }
    const lane = lanes[ship.side]++ % 3;
    const { x, y, left } = shipPos(s, ship, lane);
    const bob = Math.round(Math.sin(t * 2.4 + x) * (1 + ship.danger / 50));
    drawBoat(x, y + bob, left, ship.danger, t, false);
    // progress (green) and danger (red) bars
    P(x - 1, y + bob - 12, 14, 3, '#0a0f1e');
    P(x, y + bob - 11, Math.round(12 * ship.progress / 100), 1, '#6fdc7a');
    P(x, y + bob - 10, Math.round(12 * ship.danger / 100), 1, '#ff5a4a');
    if (ship.danger > 55 && Math.sin(t * 10) > 0) { P(x + 5, y + bob - 19, 2, 4, '#ff5a4a'); P(x + 5, y + bob - 14, 2, 1, '#ff5a4a'); }
  }
}

function drawBoat(x, y, left, danger, t, docked) {
  const hull = docked ? '#6a4a34' : '#5a3a28';
  P(x, y, 12, 3, hull); P(x + 1, y + 3, 10, 1, '#3a2418');
  const mast = left ? x + 5 : x + 6;
  P(mast, y - 8, 1, 8, '#d9d2c0');
  const tilt = danger > 60 ? 1 : 0;
  P(left ? mast + 1 : mast - 4, y - 7 + tilt, 4, 5, '#ece4d0');
  P(left ? x + 11 : x, y - 1, 1, 1, Math.sin(t * 6) > 0 ? '#ffd36b' : '#c09030');
}

function drawTower(s, t, lit) {
  // rock and foundation
  P(88, 168, 144, 12, '#232a33'); P(94, 166, 132, 3, '#2c3540');
  // outer walls with red and white bands
  for (let y = 40; y < 168; y++) {
    const c = Math.floor((y - 40) / 12) % 2 ? '#c8402c' : '#e9e4d8';
    P(WALL_L, y, IN_L - WALL_L, 1, c); P(IN_R, y, WALL_R - IN_R, 1, c);
  }
  // rooms
  const roomColor = { lantern: '#24304d', workshop: '#3a2f28', oil: '#33302a', cellar: '#2a2e33' };
  for (const f of LAYOUT.floors) {
    P(IN_L, ROOM_TOP[f.id], IN_R - IN_L, f.y - ROOM_TOP[f.id], roomColor[f.id]);
    for (let x = IN_L + 6; x < IN_R; x += 12) P(x, ROOM_TOP[f.id], 1, f.y - ROOM_TOP[f.id], 'rgba(0,0,0,0.18)');
    P(IN_L, f.y, IN_R - IN_L, 3, f.id === 'cellar' ? '#4a4f57' : '#6b5440');
  }
  // lantern dome
  P(130, 18, 60, 22, '#1a2440');
  for (let x = 132; x < 188; x += 8) P(x, 20, 6, 18, lit ? '#f7d77a' : '#2e4a70');
  if (lit) { b.save(); b.globalAlpha = 0.35; P(126, 14, 68, 30, '#ffe9a8'); b.restore(); }
  P(126, 38, 68, 3, '#3a3f4a');
  P(132, 12, 56, 6, '#c8402c'); P(148, 6, 24, 6, '#c8402c'); P(158, 2, 4, 4, '#e9e4d8');
  // ladder
  const L = LAYOUT.ladder;
  P(L.x - 4, L.top - 12, 1, L.bottom - L.top + 12, '#8a6a46'); P(L.x + 3, L.top - 12, 1, L.bottom - L.top + 12, '#8a6a46');
  for (let y = L.top - 10; y < L.bottom; y += 4) P(L.x - 3, y, 6, 1, '#a07c52');
  // windows
  for (const w of LAYOUT.windows) {
    const f = FLOOR[w.floor];
    const wx = w.side === 'left' ? WALL_L : IN_R, wy = Math.max(ROOM_TOP[f.id] + 1, f.y - 22);
    const broken = s && s.tower.broken.includes(w.id);
    if (!broken) {
      P(wx, wy, 6, 12, '#2b5d8a'); P(wx + 1, wy + 1, 1, 4, '#8cc2e8'); P(wx, wy + 6, 6, 1, '#1b3a58');
    } else {
      P(wx, wy, 6, 12, '#05070d');
      P(wx, wy, 2, 3, '#8cc2e8'); P(wx + 4, wy + 9, 2, 3, '#8cc2e8');
      const dir = w.side === 'left' ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const k = ((t * 1.6 + i / 3) % 1);
        const x0 = w.side === 'left' ? IN_L : IN_R;
        P(x0 + dir * k * 22, wy + 2 + i * 4, 2, 1, 'rgba(170,200,240,0.7)');
      }
    }
  }
  drawStations(s, t, lit);
}

function holdingAt(s, target) {
  return !!s && s.players.some((p) => p.hold && p.hold.target === target);
}

function drawStations(s, t, lit) {
  const tower = s?.tower;
  // cranks
  for (const id of ['crankLeft', 'crankRight']) {
    const st = ST[id]; const y = FLOOR[st.floor].y;
    const side = id === 'crankLeft' ? 'left' : 'right';
    P(st.x - 1, y - 10, 2, 10, '#5d5f68');
    const a = holdingAt(s, 'crank:' + side) ? t * 8 : 0.6;
    P(st.x - 3, y - 13, 6, 6, '#8a8c96'); P(st.x - 2, y - 12, 4, 4, '#3a3d48');
    P(st.x + Math.round(Math.cos(a) * 3) - 1, y - 11 + Math.round(Math.sin(a) * 3) - 1, 2, 2, '#e8c06a');
    P(st.x - 2, y - 16, 4, 2, side === tower?.lens ? '#ffcf5a' : '#4a4f5a');
  }
  // lamp with oil gauge
  {
    const st = ST.lamp; const y = FLOOR[st.floor].y;
    P(st.x - 3, y - 8, 7, 8, '#b08a3a'); P(st.x - 2, y - 12, 5, 4, '#d9b45a');
    if (tower && tower.oil > 0) {
      const f = Math.sin(t * 17) > 0 ? '#ffe08a' : '#ffb84a';
      P(st.x - 1, y - 16, 3, 4, f); P(st.x, y - 18, 1, 2, '#fff2c0');
    }
    const oil = tower ? tower.oil : 100;
    P(st.x + 6, y - 15, 3, 14, '#0a0f1e');
    const h = Math.round(12 * oil / 100);
    P(st.x + 7, y - 2 - h, 1, h, oil < 25 ? (Math.sin(t * 8) > 0 ? '#ff5a4a' : '#a0302a') : '#ffcf5a');
  }
  // lens
  {
    const st = ST.lens; const y = FLOOR[st.floor].y;
    P(st.x - 1, y - 8, 3, 8, '#5d5f68');
    const jam = tower?.lensJammed;
    P(st.x - 5, y - 18, 11, 10, jam ? '#5a5d66' : '#c99a3a');
    P(st.x - 4, y - 17, 9, 8, jam ? '#3a3d48' : '#f2c75c');
    if (tower && !jam) {
      const dir = tower.lens === 'left' ? -1 : 1;
      P(st.x - 1 + dir * 2, y - 14, 3, 2, '#7a4a10'); P(st.x + dir * 4, y - 15, 1, 4, '#7a4a10');
    }
    if (jam && Math.sin(t * 13) > 0) { P(st.x - 6, y - 20, 1, 2, '#9fd3ff'); P(st.x + 5, y - 9, 2, 1, '#9fd3ff'); P(st.x + 2, y - 21, 1, 1, '#ffffff'); }
  }
  // board stack
  {
    const st = ST.boards; const y = FLOOR[st.floor].y;
    for (let i = 0; i < 4; i++) P(st.x - 6, y - 2 - i * 2, 12, 2, i % 2 ? '#a47a4a' : '#b98c58');
    P(st.x - 6, y - 10, 1, 8, '#7a5634'); P(st.x + 5, y - 10, 1, 8, '#7a5634');
  }
  // barrels
  {
    const st = ST.barrels; const y = FLOOR[st.floor].y;
    for (const dx of [-7, 1]) { P(st.x + dx, y - 10, 6, 10, '#6a4a2a'); P(st.x + dx, y - 8, 6, 1, '#3a3d48'); P(st.x + dx, y - 3, 6, 1, '#3a3d48'); }
    P(st.x - 8, y - 11, 15, 1, '#3a2a1a');
  }
  // pump
  {
    const st = ST.pump; const y = FLOOR[st.floor].y;
    P(st.x - 2, y - 12, 5, 12, '#5d6a74'); P(st.x - 3, y - 13, 7, 2, '#7d8a94');
    const up = holdingAt(s, 'pump') ? Math.round(Math.sin(t * 10) * 3) : 0;
    P(st.x + 3, y - 12 + up, 7, 1, '#9aa6ae'); P(st.x + 9, y - 13 + up, 1, 3, '#9aa6ae');
    P(st.x - 6, y - 3, 4, 2, '#5d6a74');
  }
}

function drawWater(s, t) {
  const w = s.tower.water;
  if (w <= 0.2) return;
  const cellarH = FLOOR.cellar.y - ROOM_TOP.cellar;
  const inCellar = Math.min(1, w / 60) * cellarH;
  const wave = Math.round(Math.sin(t * 3));
  b.save();
  b.globalAlpha = 0.6;
  P(IN_L, FLOOR.cellar.y - inCellar + wave, IN_R - IN_L, inCellar - wave, '#2a6fa0');
  if (w > 60) {
    const over = Math.min(1, (w - 60) / 40) * 12;
    P(IN_L, FLOOR.oil.y - over, IN_R - IN_L, over, '#2a6fa0');
  }
  b.restore();
  P(IN_L, FLOOR.cellar.y - inCellar + wave, IN_R - IN_L, 1, '#7fc3e0');
}

function drawItem(kind, full, x, y) {
  if (kind === 'can') {
    P(x - 2, y - 6, 5, 6, '#8a929c'); P(x - 1, y - 8, 3, 2, '#5d646e');
    if (full) P(x - 2, y - 4, 5, 2, '#f0a030');
  } else {
    P(x - 5, y - 2, 10, 2, '#b98c58'); P(x - 5, y - 2, 10, 1, '#d4a46c');
  }
}

function drawKeeper(p, t) {
  const coat = coatOf(p.id);
  const x = Math.round(p.x), y = Math.round(p.y);
  const last = prevX.get(p.id);
  const moving = last !== undefined && Math.abs(last - p.x) > 0.05;
  prevX.set(p.id, p.x);
  const phase = (walk.get(p.id) || 0) + (moving ? 0.25 : 0);
  walk.set(p.id, phase);
  const step = moving ? (Math.floor(phase) % 2) : 0;
  // boots and legs
  if (p.onLadder) { P(x - 3, y - 2, 2, 2, '#2a2422'); P(x + 1, y - 3, 2, 2, '#2a2422'); }
  else { P(x - 3 + step, y - 2, 2, 2, '#2a2422'); P(x + 1 - step, y - 2, 2, 2, '#2a2422'); }
  P(x - 3, y - 4, 6, 2, '#26364a');
  // coat
  P(x - 3, y - 9, 7, 5, coat);
  P(x - 3, y - 9, 7, 1, 'rgba(255,255,255,0.25)');
  if (p.onLadder) { P(x - 4, y - 12, 1, 3, coat); P(x + 4, y - 12, 1, 3, coat); }
  // head and hat
  P(x - 2, y - 12, 5, 3, '#f2c9a0');
  if (!p.onLadder) P(x + (p.facing > 0 ? 1 : -1), y - 11, 1, 1, '#1a1410');
  P(x - 3, y - 13, 7, 1, coat); P(x - 2, y - 15, 5, 2, coat);
  // carried item above the head
  if (p.carry) drawItem(p.carry.kind, p.carry.full, x, y - 15);
  // hold progress
  if (p.hold) {
    const frac = p.hold.need ? p.hold.ticks / p.hold.need : (Math.sin(t * 10) + 1) / 2;
    P(x - 5, y - 24, 11, 3, '#0a0f1e');
    P(x - 4, y - 23, Math.max(1, Math.round(9 * Math.min(1, frac))), 1, '#ffcf5a');
  }
  if (p.id === youId) { P(x - 1, y - 28, 3, 1, '#ffcf5a'); P(x, y - 27, 1, 1, '#ffcf5a'); }
}

// ---------- text on top ----------

function drawText(s, now) {
  const sc = view.scale;
  const px = (x) => view.ox + x * sc, py = (y) => view.oy + y * sc;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(Math.max(10, sc * 3.2) * (d > 1 ? 1 : 1))}px "Trebuchet MS", "Segoe UI", sans-serif`;
  for (const p of s.players) {
    const tx = px(p.x), ty = py(p.y + 7);
    ctx.lineWidth = Math.max(2, sc * 0.8);
    ctx.strokeStyle = 'rgba(5,9,19,0.85)';
    ctx.strokeText(p.name, tx, ty);
    ctx.fillStyle = p.id === youId ? '#ffcf5a' : '#f3ecdd';
    ctx.fillText(p.name, tx, ty);
  }
  toasts = toasts.filter((x) => x.until > now);
  ctx.font = `800 ${Math.round(Math.max(13, sc * 4.5))}px "Trebuchet MS", "Segoe UI", sans-serif`;
  toasts.forEach((x, i) => {
    const y = view.oy + (12 + i * 7) * sc;
    const fade = Math.min(1, (x.until - now) / 400);
    ctx.globalAlpha = fade;
    ctx.lineWidth = Math.max(3, sc);
    ctx.strokeStyle = 'rgba(5,9,19,0.9)';
    ctx.strokeText(x.text, view.ox + 160 * sc, y);
    ctx.fillStyle = '#ffcf5a';
    ctx.fillText(x.text, view.ox + 160 * sc, y);
    ctx.globalAlpha = 1;
  });
  if (s.phase !== 'playing') {
    const text = s.phase === 'won' ? 'Daggry!' : 'Natten er tabt';
    ctx.font = `800 ${Math.round(Math.max(28, sc * 14))}px "Trebuchet MS", "Segoe UI", sans-serif`;
    ctx.lineWidth = Math.max(4, sc * 2);
    ctx.strokeStyle = '#050913';
    ctx.strokeText(text, view.ox + 160 * sc, view.oy + 95 * sc);
    ctx.fillStyle = s.phase === 'won' ? '#ffcf5a' : '#ff6a5a';
    ctx.fillText(text, view.ox + 160 * sc, view.oy + 95 * sc);
  }
}
