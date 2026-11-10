import { createNight } from './game/index.js';

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const NIGHT_COUNT = 5;
const NAME_MAX = 12;
const COUNTDOWN_TICKS = 90; // 3 seconds at 30 ticks per second
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
const KEY_NAMES = ['up', 'down', 'left', 'right', 'act'];

export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

export function cleanCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[^A-Z]/g, '');
}

function coerceKeys(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const keys = {};
  for (const k of KEY_NAMES) keys[k] = !!raw[k];
  return keys;
}

export class RoomManager {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.rooms = new Map();      // code -> room
    this.playerRoom = new Map(); // playerId -> code
    this.listeners = [];
  }

  onRoomChange(cb) { this.listeners.push(cb); }
  getRooms() { return [...this.rooms.values()]; }
  getRoom(playerId) { return this.rooms.get(this.playerRoom.get(playerId)) || null; }

  createRoom(player) {
    if (this.playerRoom.has(player.id)) this.leave(player.id);
    let code;
    do {
      code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(this.rng() * CODE_LETTERS.length)]).join('');
    } while (this.rooms.has(code));
    const room = { code, creatorId: player.id, players: [], night: 1, phase: 'lobby', notice: null, game: null, countdown: 0, keys: {} };
    this.rooms.set(code, room);
    this.#addPlayer(room, player);
    this.#changed(room);
    return room;
  }

  joinRoom(code, player) {
    const room = this.rooms.get(cleanCode(code));
    if (!room) return { error: 'Der er intet rum med den kode' };
    if (this.playerRoom.get(player.id) === room.code) return { room };
    if (room.phase !== 'lobby') return { error: 'Rummet er i gang med en nat' };
    if (room.players.length >= MAX_PLAYERS) return { error: 'Rummet er fuldt' };
    if (this.playerRoom.has(player.id)) this.leave(player.id);
    this.#addPlayer(room, player);
    this.#changed(room);
    return { room };
  }

  leave(playerId) {
    const room = this.getRoom(playerId);
    if (!room) return;
    const gone = room.players.find((p) => p.id === playerId);
    room.players = room.players.filter((p) => p.id !== playerId);
    this.playerRoom.delete(playerId);
    delete room.keys[playerId];
    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.creatorId === playerId) room.creatorId = room.players[0].id;
    const inNight = room.phase === 'countdown' || room.phase === 'playing';
    if (inNight) room.game.removePlayer(playerId);
    room.notice = inNight ? `${gone.name} forlod natten` : `${gone.name} forlod rummet`;
    this.#changed(room);
  }

  selectNight(playerId, night) {
    const room = this.#creatorRoom(playerId);
    if (room.error) return room;
    if (room.phase !== 'lobby') return { error: 'Natten er allerede i gang' };
    if (typeof night !== 'number' || !Number.isInteger(night) || night < 1 || night > NIGHT_COUNT) return { error: 'Vælg en nat mellem 1 og 5' };
    room.night = night;
    this.#changed(room);
    return { ok: true };
  }

  startMatch(playerId) {
    const room = this.#creatorRoom(playerId);
    if (room.error) return room;
    if (room.phase !== 'lobby') return { error: 'Natten er allerede i gang' };
    return this.#begin(room);
  }

  retry(playerId) {
    const room = this.#creatorRoom(playerId);
    if (room.error) return room;
    if (room.phase === 'countdown') return { ok: true }; // a repeated click
    if (room.phase !== 'results') return { error: 'Der er ingen afsluttet nat' };
    return this.#begin(room);
  }

  nextNight(playerId) {
    const room = this.#creatorRoom(playerId);
    if (room.error) return room;
    if (room.phase === 'countdown') return { ok: true }; // a repeated click
    if (room.phase !== 'results') return { error: 'Der er ingen afsluttet nat' };
    if (!room.lastResult?.won) return { error: 'I skal vinde natten først' };
    if (room.night >= NIGHT_COUNT) return { error: 'Der er ikke flere nætter' };
    if (room.players.length < MIN_PLAYERS) return { error: 'I skal være mindst 2 spillere' };
    room.night++;
    return this.#begin(room);
  }

  backToLobby(playerId) {
    const room = this.getRoom(playerId);
    if (!room) return { error: 'Du er ikke i et rum' };
    if (room.phase === 'lobby') return { ok: true }; // someone else already went back
    if (room.phase !== 'results') return { error: 'Natten er ikke slut endnu' };
    this.#toLobby(room);
    this.#changed(room);
    return { ok: true };
  }

  setKeys(playerId, keys) {
    const room = this.getRoom(playerId);
    if (!room || room.phase !== 'playing') return;
    const clean = coerceKeys(keys);
    if (clean) room.keys[playerId] = clean;
  }

  tick() {
    for (const room of [...this.rooms.values()]) {
      try {
        this.#tickRoom(room);
      } catch (err) {
        console.error(`Room ${room.code} failed, returning to lobby:`, err);
        this.#toLobby(room);
        room.notice = 'Natten stoppede på grund af en fejl';
        try { this.#changed(room); } catch (e) { console.error(e); }
      }
    }
  }

  #tickRoom(room) {
    if (room.phase === 'countdown') {
      room.countdown--;
      if (room.countdown <= 0) {
        room.phase = 'playing';
        this.#changed(room);
      }
    } else if (room.phase === 'playing') {
      room.game.step(room.keys);
      if (room.game.isOver()) {
        room.lastResult = room.game.getResult();
        room.phase = 'results';
        this.#changed(room);
      }
    }
  }

  #addPlayer(room, player) {
    const name = cleanName(player.name) || `Vogter ${room.players.length + 1}`;
    room.players.push({ id: player.id, name });
    this.playerRoom.set(player.id, room.code);
  }

  #creatorRoom(playerId) {
    const room = this.getRoom(playerId);
    if (!room) return { error: 'Du er ikke i et rum' };
    if (room.creatorId !== playerId) return { error: 'Kun den, der oprettede rummet, kan gøre det' };
    return room;
  }

  #begin(room) {
    if (room.players.length < MIN_PLAYERS) return { error: 'I skal være mindst 2 spillere' };
    room.game = createNight({
      night: room.night,
      players: room.players.map((p) => ({ id: p.id, name: p.name })),
      rng: this.rng,
    });
    room.keys = {};
    room.notice = null;
    room.lastResult = null;
    room.phase = 'countdown';
    room.countdown = COUNTDOWN_TICKS;
    this.#changed(room);
    return { ok: true };
  }

  #toLobby(room) {
    room.phase = 'lobby';
    room.game = null;
    room.keys = {};
    room.countdown = 0;
  }

  #changed(room) {
    for (const cb of this.listeners) cb(room);
  }
}
