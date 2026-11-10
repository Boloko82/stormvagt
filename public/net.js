// WebSocket connection to the game server.
// Status: 'connecting' -> 'open'; 'waking' while retrying a sleepy server;
// 'lost' when an open connection drops or we give up retrying.

const RETRY_MS = 3000;
const GIVE_UP_MS = 2 * 60 * 1000;
// Render's free plan sleeps after ~15 minutes without HTTP requests, and the
// open WebSocket may not count, so ping /health now and then while connected.
const KEEP_AWAKE_MS = 5 * 60 * 1000;

const handlers = new Map(); // t -> [fn]
const statusFns = [];
let ws = null;
let status = 'connecting';
let startedAt = 0;
let retryTimer = null;
let keepAwakeTimer = null;

function url() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  clearInterval(keepAwakeTimer);
  keepAwakeTimer = null;
  if (next === 'open') {
    keepAwakeTimer = setInterval(() => {
      fetch('/health', { cache: 'no-store' }).catch(() => { /* ignore */ });
    }, KEEP_AWAKE_MS);
  }
  for (const fn of statusFns) fn(next);
}

function attempt() {
  const sock = new WebSocket(url());
  ws = sock;
  sock.onopen = () => {
    if (ws !== sock) return;
    clearTimeout(retryTimer);
    setStatus('open');
  };
  sock.onmessage = (ev) => {
    if (ws !== sock || typeof ev.data !== 'string') return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    for (const fn of handlers.get(msg.t) || []) fn(msg);
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    if (status === 'open') {
      ws = null;
      setStatus('lost');
    }
    // Still connecting: the retry timer decides what happens next.
  };
  retryTimer = setTimeout(() => {
    if (ws !== sock || sock.readyState === WebSocket.OPEN) return;
    sock.onclose = null;
    try { sock.close(); } catch { /* not open yet */ }
    if (Date.now() - startedAt >= GIVE_UP_MS) {
      ws = null;
      setStatus('lost');
      return;
    }
    setStatus('waking');
    attempt();
  }, RETRY_MS);
}

export function connect() {
  clearTimeout(retryTimer);
  if (ws) {
    const old = ws;
    ws = null;
    old.onclose = null;
    try { old.close(); } catch { /* ignore */ }
  }
  startedAt = Date.now();
  status = null; // force the 'connecting' notification
  setStatus('connecting');
  attempt();
}

export function send(t, data = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify({ ...data, t }));
  return true;
}

export function on(t, fn) {
  if (!handlers.has(t)) handlers.set(t, []);
  handlers.get(t).push(fn);
}

export function onStatus(fn) {
  statusFns.push(fn);
}

export function getStatus() {
  return status;
}
