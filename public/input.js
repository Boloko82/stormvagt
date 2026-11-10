// Keyboard input. WASD or arrows move and climb; Space picks up, drops and uses.
// Keys are only tracked (and their default action blocked) while enabled,
// which the UI does on the game screen only, so typing a name still works.

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'act',
};
const ACTIONS = ['up', 'down', 'left', 'right', 'act'];

const held = new Set(); // KeyboardEvent.code values currently down
let enabled = false;
let callback = () => {};
let last = released();

function released() {
  return Object.fromEntries(ACTIONS.map((a) => [a, false]));
}

function current() {
  const keys = released();
  for (const code of held) keys[KEY_MAP[code]] = true;
  return keys;
}

function update(force = false) {
  const keys = current();
  if (!force && ACTIONS.every((a) => keys[a] === last[a])) return;
  last = keys;
  callback({ ...keys });
}

function releaseAll() {
  held.clear();
  update(true);
}

export function start(onKeys) {
  callback = onKeys;
  window.addEventListener('keydown', (e) => {
    // Leave browser shortcuts (Ctrl/Cmd + key) alone.
    if (!enabled || e.ctrlKey || e.metaKey || !(e.code in KEY_MAP)) return;
    e.preventDefault();
    held.add(e.code);
    update();
  });
  window.addEventListener('keyup', (e) => {
    if (!enabled || !(e.code in KEY_MAP)) return;
    e.preventDefault();
    held.delete(e.code);
    update();
  });
  window.addEventListener('blur', () => { if (enabled) releaseAll(); });
  document.addEventListener('visibilitychange', () => {
    if (enabled && document.hidden) releaseAll();
  });
}

// Turn game input on or off. Turning it off releases anything still held.
export function setEnabled(on) {
  if (enabled === on) return;
  if (!on && held.size) releaseAll();
  enabled = on;
}

export function getKeys() {
  return { ...last };
}
