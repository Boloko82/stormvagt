import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager } from './rooms.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MAX_PAYLOAD = 16 * 1024;
const LOOP_MS = 1000 / 30;
const BROADCAST_MS = 50;
const PING_MS = 15000;
const MAX_CATCH_UP = 5; // ticks run at most per timer call after a stall
const TICKS_PER_SEC = 30;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res) {
  const head = req.method === 'HEAD';
  if (req.method !== 'GET' && !head) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(head ? undefined : 'ok');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  const file = path.resolve(PUBLIC_DIR, '.' + path.sep + pathname);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (pathname.includes('\0') || !file.startsWith(PUBLIC_DIR + path.sep) || !type) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Content-Length': data.length });
    res.end(head ? undefined : data);
  });
}

export function startServer(port = 0) {
  const rooms = new RoomManager();
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD });
  const clients = new Map(); // playerId -> ws
  const resultSent = new WeakSet();
  let nextId = 1;

  const send = (ws, msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const roomMessage = (room, you) => ({
    t: 'room',
    code: room.code,
    phase: room.phase,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    creatorId: room.creatorId,
    night: room.night,
    notice: room.notice,
    countdown: room.phase === 'countdown' ? Math.ceil(room.countdown / TICKS_PER_SEC) : 0,
    you,
  });

  const sendRoom = (room) => {
    for (const p of room.players) {
      const ws = clients.get(p.id);
      if (ws) send(ws, roomMessage(room, p.id));
    }
  };

  const sendState = (room) => {
    const msg = JSON.stringify({ t: 'state', s: room.game.getState(), e: room.game.drainEvents() });
    for (const p of room.players) {
      const ws = clients.get(p.id);
      if (ws && ws.readyState === ws.OPEN) ws.send(msg);
    }
  };

  rooms.onRoomChange((room) => {
    const finished = room.phase === 'results' && room.game && !resultSent.has(room.game);
    // The match just ended: send the last tick's events (final knockout,
    // round and match events) and the final state before anything else.
    if (finished) sendState(room);
    sendRoom(room);
    if (finished) {
      resultSent.add(room.game);
      const msg = { t: 'result', ...room.game.getResult(), s: room.game.getState() };
      for (const p of room.players) {
        const ws = clients.get(p.id);
        if (ws) send(ws, msg);
      }
    }
  });

  const broadcastState = () => {
    for (const room of rooms.getRooms()) {
      if ((room.phase !== 'countdown' && room.phase !== 'playing') || !room.game) continue;
      sendState(room);
    }
  };

  const reply = (ws, result) => {
    if (result && result.error) send(ws, { t: 'error', message: result.error });
  };

  function handle(ws, id, msg) {
    if (msg.t === 'create') {
      rooms.createRoom({ id, name: msg.name });
      const room = rooms.getRoom(id);
      if (room) send(ws, roomMessage(room, id));
      return;
    }
    if (msg.t === 'join') {
      const result = rooms.joinRoom(msg.code, { id, name: msg.name });
      if (result.error) return reply(ws, result);
      send(ws, roomMessage(result.room, id));
      return;
    }
    if (!rooms.getRoom(id)) return; // everything else needs a room
    switch (msg.t) {
      case 'night': return reply(ws, rooms.selectNight(id, msg.night));
      case 'start': return reply(ws, rooms.startMatch(id));
      case 'retry': return reply(ws, rooms.retry(id));
      case 'next': return reply(ws, rooms.nextNight(id));
      case 'lobby': return reply(ws, rooms.backToLobby(id));
      case 'keys': return rooms.setKeys(id, msg.keys);
      case 'leave': return rooms.leave(id);
      default: return; // unknown type: ignore
    }
  }

  wss.on('connection', (ws) => {
    const id = `p${nextId++}`;
    clients.set(id, ws);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg) || typeof msg.t !== 'string') return;
      try {
        handle(ws, id, msg);
      } catch (err) {
        console.error('Message handler failed:', err);
      }
    });
    ws.on('close', () => {
      try {
        rooms.leave(id);
      } catch (err) {
        console.error('Leave on close failed:', err);
      } finally {
        clients.delete(id);
      }
    });
    ws.on('error', () => {});
  });

  // Timers on Windows fire late (about every 45 ms instead of 33), so count the
  // time that really passed and run as many 30 Hz ticks as it covers.
  let last = performance.now();
  let acc = 0;
  let tickAcc = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    const elapsed = now - last;
    last = now;
    acc = Math.min(acc + elapsed, BROADCAST_MS * 3);
    tickAcc = Math.min(tickAcc + elapsed, LOOP_MS * MAX_CATCH_UP);
    try {
      while (tickAcc >= LOOP_MS) {
        tickAcc -= LOOP_MS;
        rooms.tick();
      }
      if (acc >= BROADCAST_MS) {
        acc -= BROADCAST_MS;
        broadcastState();
      }
    } catch (err) {
      console.error('Loop error:', err);
    }
  }, LOOP_MS);

  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* socket already closing */ }
    }
  }, PING_MS);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      resolve({
        port: server.address().port,
        close() {
          clearInterval(loop);
          clearInterval(pinger);
          for (const ws of wss.clients) ws.terminate();
          return new Promise((r) => wss.close(() => {
            server.closeAllConnections?.();
            server.close(() => r());
          }));
        },
      });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  startServer(port).then((s) => console.log(`Stormvagt kører på http://localhost:${s.port}`));
}
