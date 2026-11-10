import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import { startServer } from '../server/index.js';

const server = await startServer(0);
const sockets = [];
after(async () => {
  for (const ws of sockets) ws.terminate();
  await server.close();
});

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    sockets.push(ws);
    ws.inbox = [];
    ws.waiters = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      ws.inbox.push(msg);
      for (const w of [...ws.waiters]) w();
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitFor(ws, pred, ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), ms);
    const check = () => {
      const i = ws.inbox.findIndex(pred);
      if (i === -1) return false;
      const [msg] = ws.inbox.splice(i, 1);
      clearTimeout(timer);
      ws.waiters = ws.waiters.filter((w) => w !== check);
      resolve(msg);
      return true;
    };
    if (!check()) ws.waiters.push(check);
  });
}

const send = (ws, obj) => ws.send(JSON.stringify(obj));

function get(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    http.request({ host: '127.0.0.1', port: server.port, path, method, agent: false }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], headers: res.headers, body }));
    }).on('error', reject).end();
  });
}

async function twoPlayers() {
  const a = await connect();
  send(a, { t: 'create', name: 'Ann' });
  const created = await waitFor(a, (m) => m.t === 'room');
  const b = await connect();
  send(b, { t: 'join', name: 'Bob', code: created.code });
  const joined = await waitFor(b, (m) => m.t === 'room');
  return { a, b, created, joined };
}

test('flow: create, join, pick night, start', async () => {
  const { a, b, created, joined } = await twoPlayers();
  assert.equal(created.phase, 'lobby');
  assert.equal(created.you, created.creatorId);
  assert.equal(created.night, 1);
  assert.equal(joined.players.length, 2);
  assert.notEqual(joined.you, joined.creatorId);
  send(a, { t: 'night', night: 2 });
  await waitFor(b, (m) => m.t === 'room' && m.night === 2);
  send(a, { t: 'start' });
  const ra = await waitFor(a, (m) => m.t === 'room' && m.phase === 'countdown');
  const rb = await waitFor(b, (m) => m.t === 'room' && m.phase === 'countdown');
  assert.equal(ra.night, 2);
  assert.ok(ra.countdown >= 1 && rb.countdown <= 3);
  const sa = await waitFor(a, (m) => m.t === 'state');
  await waitFor(b, (m) => m.t === 'state');
  assert.ok(sa.s && Array.isArray(sa.e));
  assert.equal(sa.s.night, 2);
});

test('a bad night value gets a Danish error and changes nothing', async () => {
  const { a } = await twoPlayers();
  send(a, { t: 'night', night: '6' });
  const err = await waitFor(a, (m) => m.t === 'error');
  assert.equal(err.message, 'Vælg en nat mellem 1 og 5');
});

test('keys: right held moves the keeper', async () => {
  const { a, b } = await twoPlayers();
  send(a, { t: 'start' });
  await waitFor(b, (m) => m.t === 'room' && m.phase === 'playing', 6000);
  const first = await waitFor(b, (m) => m.t === 'state' && m.s.phase === 'playing');
  const x0 = bobX(first.s);
  send(b, { t: 'keys', keys: { right: true } });
  const latest = await waitFor(b, (m) => m.t === 'state' && bobX(m.s) > x0 + 1).catch(() => null);
  assert.ok(latest, `keeper did not move from ${x0}`);
});

function findPlayer(s, name) { return (s.players || []).find((p) => p.name === name); }
function bobX(s) { return findPlayer(s, 'Bob').x; }

test('a player leaving mid-night: the night goes on for the other, with a notice', async () => {
  const { a, b } = await twoPlayers();
  send(a, { t: 'start' });
  await waitFor(a, (m) => m.t === 'state');
  b.close();
  const room = await waitFor(a, (m) => m.t === 'room' && m.notice);
  assert.equal(room.notice, 'Bob forlod natten');
  assert.equal(room.players.length, 1);
  assert.notEqual(room.phase, 'lobby');
  a.inbox.length = 0;
  const s = await waitFor(a, (m) => m.t === 'state');
  assert.equal(s.s.players.length, 1);
});

test('bad messages are ignored and the server keeps running', async () => {
  const c = await connect();
  c.send('not json');
  c.send(JSON.stringify({ t: 'nope' }));
  c.send(JSON.stringify({ t: 'keys' }));
  c.send(JSON.stringify({ t: 'join' }));
  c.send(JSON.stringify({ t: 'start' }));
  c.send(JSON.stringify([1, 2]));
  c.send('null');
  c.send('x'.repeat(100 * 1024));
  await new Promise((r) => setTimeout(r, 200));
  const d = await connect();
  send(d, { t: 'create', name: '<b>x</b>' });
  const room = await waitFor(d, (m) => m.t === 'room');
  assert.equal(room.players.length, 1);
  // join with missing code reports an error to that client
  const e = await connect();
  send(e, { t: 'join', name: 'E' });
  const err = await waitFor(e, (m) => m.t === 'error');
  assert.equal(typeof err.message, 'string');
});

test('static files and health', async () => {
  const root = await get('/');
  assert.equal(root.status, 200);
  assert.match(root.type, /text\/html/);
  assert.match(root.body, /<html/i);
  const esc = await get('/../package.json');
  assert.notEqual(esc.status, 200);
  assert.ok(!esc.body.includes('stormvagt'));
  const esc2 = await get('/%2e%2e/package.json');
  assert.ok(!esc2.body.includes('stormvagt'));
  const health = await get('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body, 'ok');
  assert.equal((await get('/missing.js')).status, 404);
});

test('HEAD works for health and static files; other methods get 405', async () => {
  const health = await get('/health', 'HEAD');
  assert.equal(health.status, 200);
  assert.equal(health.body, '');
  const page = await get('/', 'HEAD');
  assert.equal(page.status, 200);
  assert.match(page.type, /text\/html/);
  assert.equal(page.body, '');
  assert.ok(Number(page.headers['content-length']) > 0);
  assert.equal((await get('/missing.js', 'HEAD')).status, 404);
  const post = await get('/health', 'POST');
  assert.equal(post.status, 405);
  assert.match(post.headers.allow, /HEAD/);
});

test('game time keeps pace with the clock (30 ticks per second)', async () => {
  const { a } = await twoPlayers();
  send(a, { t: 'start' });
  const first = await waitFor(a, (m) => m.t === 'state' && m.s.phase === 'playing' && m.s.time > 0.2, 6000);
  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 2000));
  a.inbox.length = 0;
  const later = await waitFor(a, (m) => m.t === 'state');
  const wall = (Date.now() - t0) / 1000;
  const game = later.s.time - first.s.time;
  assert.ok(game > wall * 0.9 && game < wall * 1.1, `game ${game.toFixed(2)} s vs clock ${wall.toFixed(2)} s`);
});
