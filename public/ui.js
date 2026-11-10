// Screens and app flow. Entry module loaded by index.html.
import * as net from './net.js';
import * as input from './input.js';
import * as render from './render.js';
import * as sound from './sound.js';

// Keeper coat colours, by join order (index in the room's player list).
export const COATS = ['#e8513a', '#3b8fe0', '#f2c230', '#4cbf6a'];
const NIGHTS = [
  { n: 1, blurb: 'Lampe og linse' },
  { n: 2, blurb: 'Ruderne knuser' },
  { n: 3, blurb: 'Kælderen fyldes' },
  { n: 4, blurb: 'Lynnedslag' },
  { n: 5, blurb: 'Det hele på én gang' },
];
const NAME_KEY = 'stormvagt.name';
const UNLOCK_KEY = 'stormvagt.unlocked';
const ERROR_MS = 4000;
const PENDING_MS = 8000;
const RESULTS_DELAY_MS = 1800; // let dawn or the last wreck show before results
const SNAP_KEEP = 14;

export const game = {
  you: null,
  room: null,
  state: null,
  result: null,
  countdownEnd: 0,
  canvas: document.getElementById('game'),
  countdownLeft() { return Math.max(0, Math.ceil((this.countdownEnd - performance.now()) / 1000)); },
};

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let screen = null;
let inRoom = false;
let pending = false;
let everOpened = false;
let pendingTimer = null;
let leftCode = null;
let goUntil = 0;
let countdownRunning = false;
let resultsTimer = null;
let hudKey = '';

const snaps = [];
let snapSeq = 0;
function pushSnap(s, e) {
  snaps.push({ seq: ++snapSeq, at: performance.now(), s, e });
  if (snaps.length > SNAP_KEEP) snaps.shift();
}
const getSnaps = () => snaps;

function playerIndex(id) {
  return game.room ? game.room.players.findIndex((p) => p.id === id) : -1;
}
function coatOf(id, fallback = 0) {
  const i = playerIndex(id);
  return COATS[(i >= 0 ? i : fallback) % COATS.length];
}

// ---------- unlocked nights (kept in this browser) ----------

export function unlockedNights() {
  try {
    const n = Number(localStorage.getItem(UNLOCK_KEY));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
  } catch { return 1; }
}
function unlockNight(n) {
  const next = Math.min(5, Math.max(unlockedNights(), n));
  try { localStorage.setItem(UNLOCK_KEY, String(next)); } catch { /* storage blocked */ }
  return next;
}

// ---------- screens ----------

export function show(name) {
  screen = name;
  for (const s of ['home', 'lobby', 'game', 'results']) $(`screen-${s}`).hidden = s !== name;
  input.setEnabled(name === 'game');
  if (name === 'game') {
    document.activeElement?.blur?.();
    if (!countdownRunning) { countdownRunning = true; requestAnimationFrame(countdownLoop); }
    if (!render.isRunning()) render.start(game.canvas, getSnaps, game.you, coatOf);
  } else {
    render.stop();
  }
}

function flashError(node, message) {
  node.textContent = message;
  node.hidden = false;
  clearTimeout(node._timer);
  node._timer = setTimeout(() => { node.hidden = true; }, ERROR_MS);
}
function clearError(node) { clearTimeout(node._timer); node.hidden = true; }
const isCreator = () => !!game.room && game.room.creatorId === game.you;

function resetRoom() {
  inRoom = false;
  setPending(false);
  game.room = null;
  game.state = null;
  game.result = null;
  snaps.length = 0;
  clearTimeout(resultsTimer);
  resultsTimer = null;
}

function leaveRoom() {
  net.send('leave');
  leftCode = game.room?.code || null;
  resetRoom();
  show('home');
}

// ---------- home ----------

const nameInput = $('name-input');
const codeInput = $('code-input');
try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage blocked */ }
nameInput.addEventListener('input', () => {
  try { localStorage.setItem(NAME_KEY, nameInput.value); } catch { /* storage blocked */ }
});

function updateHomeButtons() {
  const off = net.getStatus() !== 'open' || pending;
  $('create-btn').disabled = off;
  $('join-btn').disabled = off;
}

function setPending(on) {
  pending = on;
  clearTimeout(pendingTimer);
  if (on) {
    pendingTimer = setTimeout(() => {
      setPending(false);
      flashError($('home-error'), 'Serveren svarede ikke. Prøv igen.');
    }, PENDING_MS);
  }
  updateHomeButtons();
}

function request(t, data) {
  if (pending) return;
  clearError($('home-error'));
  if (!net.send(t, data)) { flashError($('home-error'), 'Ikke forbundet til serveren endnu.'); return; }
  setPending(true);
}

$('create-btn').addEventListener('click', () => request('create', { name: nameInput.value }));
function join() {
  const code = codeInput.value.trim();
  if (!code) { flashError($('home-error'), 'Skriv en rumkode først.'); codeInput.focus(); return; }
  if (code.toUpperCase().replace(/[^A-Z]/g, '') === leftCode) leftCode = null;
  request('join', { name: nameInput.value, code });
}
$('join-btn').addEventListener('click', join);
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !codeInput.value.trim()) $('create-btn').click(); });

// ---------- lobby ----------

function coatChip(index) {
  const chip = el('span', 'coat');
  chip.style.background = COATS[index % COATS.length];
  return chip;
}

function renderLobby() {
  const room = game.room;
  const creator = isCreator();
  const unlocked = unlockedNights();

  $('lobby-code').textContent = room.code;
  const notice = $('lobby-notice');
  notice.hidden = !room.notice;
  notice.textContent = room.notice || '';

  $('player-count').textContent = `${room.players.length} / 4`;
  const list = $('player-list');
  list.replaceChildren();
  room.players.forEach((p, i) => {
    const li = el('li', 'player');
    li.append(coatChip(i), el('span', 'player-name', p.name));
    if (p.id === game.you) li.append(el('span', 'tag tag-you', 'dig'));
    if (p.id === room.creatorId) li.append(el('span', 'tag', 'opretter'));
    list.append(li);
  });

  const box = $('night-buttons');
  box.replaceChildren();
  for (const night of NIGHTS) {
    const btn = el('button', 'night');
    btn.type = 'button';
    btn.classList.toggle('selected', room.night === night.n);
    const locked = night.n > unlocked;
    btn.disabled = !creator || locked;
    btn.append(el('span', 'night-label', `Nat ${night.n}`));
    btn.append(el('span', 'night-blurb', locked && creator ? `Klar nat ${night.n - 1} først` : night.blurb));
    btn.addEventListener('click', () => net.send('night', { night: night.n }));
    box.append(btn);
  }

  const enough = room.players.length >= 2;
  let hint = '';
  if (!enough) hint = 'Venter på flere vogtere. I skal være mindst 2.';
  else if (!creator) hint = 'Den, der oprettede rummet, vælger natten.';
  $('night-hint').textContent = hint;

  const start = $('start-btn');
  start.hidden = !creator;
  start.disabled = !enough;
  start.textContent = `Start nat ${room.night}`;
  const host = room.players.find((p) => p.id === room.creatorId);
  $('wait-text').textContent = creator ? '' : `Venter på, at ${host ? host.name : 'opretteren'} starter…`;
}

$('start-btn').addEventListener('click', () => net.send('start'));
$('lobby-leave-btn').addEventListener('click', leaveRoom);

// ---------- game ----------

function renderHud(s) {
  const key = `${s.night}|${s.saved}|${s.shipsTotal}|${s.wrecked}`;
  if (key === hudKey) return;
  hudKey = key;
  const info = $('hud-info');
  info.replaceChildren(
    el('span', 'hud-item', `Nat ${s.night}`),
    el('span', 'hud-item', `I havn: ${s.saved} / ${s.shipsTotal}`),
    el('span', `hud-item ${s.wrecked > 0 ? 'hud-bad' : 'hud-soft'}`, `Forliste: ${s.wrecked} / 3`),
  );
}

const muteBtn = $('mute-btn');
function showMute(muted) {
  muteBtn.textContent = muted ? 'Lyd fra' : 'Lyd til';
  muteBtn.setAttribute('aria-pressed', String(muted));
}
showMute(sound.isMuted());
sound.onMuteChange(showMute);
muteBtn.addEventListener('click', () => { sound.setMuted(!sound.isMuted()); muteBtn.blur(); });
window.addEventListener('keydown', (e) => {
  if (screen === 'game' && e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey) sound.setMuted(!sound.isMuted());
});

function countdownLoop() {
  const cd = $('countdown');
  if (screen !== 'game') { cd.hidden = true; countdownRunning = false; return; }
  let text = '';
  if (game.room?.phase === 'countdown') text = String(Math.max(1, game.countdownLeft()));
  else if (performance.now() < goUntil) text = 'Vagten starter!';
  cd.hidden = !text;
  cd.style.fontSize = text.length > 2 ? 'clamp(2rem, 7vw, 4.5rem)' : '';
  if (cd.textContent !== text) cd.textContent = text;
  requestAnimationFrame(countdownLoop);
}

$('game-leave-btn').addEventListener('click', leaveRoom);

// ---------- results ----------

function renderResults() {
  const r = game.result;
  const creator = isCreator();
  const title = $('result-title');
  const detail = $('result-detail');
  const unlock = $('result-unlock');
  unlock.hidden = true;
  if (!r) {
    title.textContent = 'Natten er slut';
    detail.textContent = '';
  } else if (r.won) {
    title.textContent = r.night === 5 ? 'Alle fem nætter er klaret!' : 'Daggry! I klarede natten';
    detail.textContent = `${r.saved} ${r.saved === 1 ? 'skib' : 'skibe'} kom i havn, ${r.wrecked} forliste.`;
    if (r.night < 5) { unlock.hidden = false; unlock.textContent = `Nat ${r.night + 1} er låst op.`; }
  } else {
    title.textContent = 'Tre skibe forliste';
    detail.textContent = `Natten er tabt. ${r.saved} ${r.saved === 1 ? 'skib' : 'skibe'} nåede i havn. Prøv igen!`;
  }
  const canNext = !!r && r.won && r.night < 5;
  $('next-btn').hidden = !creator || !canNext;
  $('retry-btn').hidden = !creator;
  $('retry-btn').classList.toggle('btn-big', !canNext);
  $('results-wait').textContent = creator ? '' : 'Venter på, at opretteren vælger…';
}

$('next-btn').addEventListener('click', () => net.send('next'));
$('retry-btn').addEventListener('click', () => net.send('retry'));
$('back-lobby-btn').addEventListener('click', () => net.send('lobby'));
$('results-leave-btn').addEventListener('click', leaveRoom);

// ---------- server messages ----------

net.on('room', (msg) => {
  if (!inRoom && (!pending || msg.code === leftCode)) {
    if (!pending && msg.code !== leftCode) { net.send('leave'); leftCode = msg.code; }
    return;
  }
  const prevPhase = inRoom ? game.room?.phase : null;
  const prevNotice = inRoom ? game.room?.notice : null;
  inRoom = true;
  leftCode = null;
  setPending(false);
  game.room = msg;
  game.you = msg.you;

  if (msg.phase === 'countdown' && prevPhase !== 'countdown') {
    game.countdownEnd = performance.now() + msg.countdown * 1000;
    game.state = null;
    game.result = null;
    snaps.length = 0;
    hudKey = '';
    $('hud-info').replaceChildren();
  }
  if (msg.phase !== 'results') { clearTimeout(resultsTimer); resultsTimer = null; }
  if (msg.phase === 'playing' && prevPhase !== 'playing') {
    goUntil = performance.now() + 1100;
    net.send('keys', { keys: input.getKeys() });
  }

  if ((msg.phase === 'countdown' || msg.phase === 'playing') && msg.notice && msg.notice !== prevNotice) render.notify(msg.notice);

  if (msg.phase === 'lobby') {
    game.state = null;
    renderLobby();
    show('lobby');
  } else if (msg.phase === 'countdown' || msg.phase === 'playing') {
    if (screen !== 'game') show('game');
  } else if (msg.phase === 'results') {
    if (screen === 'results') renderResults();
    else if (screen !== 'game') showResults();
    else if (!resultsTimer) resultsTimer = setTimeout(showResults, RESULTS_DELAY_MS);
  }
});

function showResults() {
  resultsTimer = null;
  renderResults();
  show('results');
}

const validState = (s) => s && typeof s === 'object' && Array.isArray(s.players) && s.tower && Array.isArray(s.ships);

net.on('state', (msg) => {
  if (!inRoom || !validState(msg.s)) return;
  game.state = msg.s;
  renderHud(msg.s);
  pushSnap(msg.s, Array.isArray(msg.e) ? msg.e : []);
});

net.on('result', (msg) => {
  if (!inRoom) return;
  game.result = msg;
  if (validState(msg.s)) { game.state = msg.s; pushSnap(msg.s, []); renderHud(msg.s); }
  if (msg.won && Number.isInteger(msg.night)) unlockNight(msg.night + 1);
  if (screen === 'results') renderResults();
});

net.on('error', (msg) => {
  const message = typeof msg.message === 'string' ? msg.message : 'Noget gik galt.';
  if (pending || !inRoom) { setPending(false); flashError($('home-error'), message); }
  else if (screen === 'results') flashError($('results-error'), message);
  else flashError($('lobby-error'), message);
});

// ---------- connection ----------

const overlay = $('conn-overlay');
net.onStatus((status) => {
  updateHomeButtons();
  $('home-status').textContent = status === 'connecting' ? 'Forbinder…' : '';
  if (status === 'open') {
    everOpened = true;
    overlay.hidden = true;
  } else if (status === 'waking') {
    $('conn-text').textContent = 'Vækker serveren…';
    $('conn-spinner').hidden = false;
    $('conn-home-btn').hidden = true;
    overlay.hidden = false;
  } else if (status === 'lost') {
    resetRoom();
    input.setEnabled(false);
    $('conn-text').textContent = everOpened
      ? 'Forbindelsen til serveren blev afbrudt.'
      : 'Kunne ikke nå serveren. Prøv igen om lidt.';
    $('conn-spinner').hidden = true;
    $('conn-home-btn').hidden = false;
    overlay.hidden = false;
  }
});

$('conn-home-btn').addEventListener('click', () => { overlay.hidden = true; show('home'); net.connect(); });

input.start((keys) => net.send('keys', { keys }));
show('home');
net.connect();
