import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager, cleanName, cleanCode } from '../server/rooms.js';

function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const P = (id, name = id) => ({ id, name });
function roomWith(n) {
  const rm = new RoomManager({ rng: seeded(3) });
  const room = rm.createRoom(P('a', 'Ann'));
  for (let i = 1; i < n; i++) rm.joinRoom(room.code, P('abcd'[i], ['Ann', 'Bo', 'Carl', 'Dita'][i]));
  return { rm, room };
}
const finish = (rm, room, won) => {
  room.game.isOver = () => true;
  room.game.getResult = () => ({ won, night: room.night, saved: 1, wrecked: won ? 0 : 3 });
  rm.tick();
};
const startAndRun = (rm, room) => { assert.deepEqual(rm.startMatch('a'), { ok: true }); for (let i = 0; i < 90; i++) rm.tick(); assert.equal(room.phase, 'playing'); };

test('codes are 4 letters without I and O and unique', () => {
  const rm = new RoomManager();
  const codes = new Set();
  for (let i = 0; i < 200; i++) codes.add(rm.createRoom(P('x' + i)).code);
  assert.equal(codes.size, 200);
  for (const c of codes) assert.match(c, /^[A-HJ-NP-Z]{4}$/);
});

test('names and codes are cleaned', () => {
  assert.equal(cleanName('  Bo   Bo  '), 'Bo Bo');
  assert.equal(cleanName('x'.repeat(20)).length, 12);
  assert.equal(cleanCode(' ab cd '), 'ABCD');
  const { rm, room } = roomWith(1);
  assert.ok(rm.joinRoom(room.code.toLowerCase().split('').join(' '), P('z', '   ')).room);
  assert.equal(room.players.at(-1).name, 'Vogter 2');
});

test('Danish errors for unknown code, full room and a room in a night', () => {
  const { rm, room } = roomWith(4);
  assert.equal(rm.joinRoom('QQQQ', P('z')).error, 'Der er intet rum med den kode');
  assert.equal(rm.joinRoom(room.code, P('z')).error, 'Rummet er fuldt');
  const r2 = roomWith(2);
  r2.rm.selectNight('a', 1); r2.rm.startMatch('a');
  assert.equal(r2.rm.joinRoom(r2.room.code, P('z')).error, 'Rummet er i gang med en nat');
});

test('selectNight accepts 1-5 integers from the creator only', () => {
  const { rm, room } = roomWith(2);
  for (const bad of [0, 6, '3', 2.5, [1], 'constructor', null, undefined, NaN]) {
    assert.ok(rm.selectNight('a', bad).error, String(bad));
  }
  assert.equal(room.night, 1);
  assert.ok(rm.selectNight('b', 2).error);
  assert.deepEqual(rm.selectNight('a', 3), { ok: true });
  assert.equal(room.night, 3);
});

test('start needs at least 2 players and the creator', () => {
  const { rm } = roomWith(1);
  assert.equal(rm.startMatch('a').error, 'I skal være mindst 2 spillere');
  const r = roomWith(2);
  assert.ok(r.rm.startMatch('b').error);
  assert.deepEqual(r.rm.startMatch('a'), { ok: true });
  assert.equal(r.room.phase, 'countdown');
});

test('countdown then playing; keys reach the game; results when the night ends', () => {
  const { rm, room } = roomWith(2);
  rm.selectNight('a', 2);
  startAndRun(rm, room);
  assert.equal(room.game.getState().night, 2);
  const x0 = room.game.getState().players[0].x;
  rm.setKeys('a', { right: true, act: 'yes', evil: 1 });
  for (let i = 0; i < 10; i++) rm.tick();
  assert.ok(room.game.getState().players[0].x > x0);
  finish(rm, room, true);
  assert.equal(room.phase, 'results');
});

test('setKeys ignores junk and is ignored outside a night', () => {
  const { rm, room } = roomWith(2);
  rm.setKeys('a', { right: true });
  assert.deepEqual(room.keys, {});
  startAndRun(rm, room);
  for (const junk of [null, 5, 'x', [true]]) rm.setKeys('a', junk);
  assert.deepEqual(room.keys, {});
});

test('leaving mid-night keeps the night going for the others', () => {
  const { rm, room } = roomWith(3);
  startAndRun(rm, room);
  room.game.players.find(p => p.id === 'c').carry = { kind: 'board' };
  const items = room.game.tower.items.length;
  rm.leave('c');
  assert.equal(room.phase, 'playing');
  assert.equal(room.notice, 'Carl forlod natten');
  assert.equal(room.game.getState().players.length, 2);
  assert.equal(room.game.tower.items.length, items + 1);
});

test('leaving during the countdown also keeps the night', () => {
  const { rm, room } = roomWith(2);
  rm.startMatch('a');
  rm.leave('b');
  assert.equal(room.phase, 'countdown');
  assert.equal(room.notice, 'Bo forlod natten');
  assert.equal(room.game.getState().players.length, 1);
});

test('leaving in the lobby or results says left the room; creator hands over; empty rooms vanish', () => {
  const { rm, room } = roomWith(3);
  rm.leave('a');
  assert.equal(room.notice, 'Ann forlod rummet');
  assert.equal(room.creatorId, 'b');
  rm.leave('b'); rm.leave('c');
  assert.equal(rm.joinRoom(room.code, P('z')).error, 'Der er intet rum med den kode');
});

test('nextNight only after a win, and not after night 5', () => {
  const { rm, room } = roomWith(2);
  startAndRun(rm, room); finish(rm, room, false);
  assert.ok(rm.nextNight('a').error);
  assert.deepEqual(rm.retry('a'), { ok: true });
  assert.equal(room.night, 1); assert.equal(room.phase, 'countdown');
  for (let i = 0; i < 90; i++) rm.tick();
  finish(rm, room, true);
  assert.ok(rm.nextNight('b').error);
  assert.deepEqual(rm.nextNight('a'), { ok: true });
  assert.equal(room.night, 2); assert.equal(room.game.getState().night, 2);
  const r5 = roomWith(2); r5.rm.selectNight('a', 5); startAndRun(r5.rm, r5.room); finish(r5.rm, r5.room, true);
  assert.equal(r5.rm.nextNight('a').error, 'Der er ikke flere nætter');
});

test('retry and nextNight need 2 players', () => {
  const { rm, room } = roomWith(2);
  startAndRun(rm, room); finish(rm, room, true);
  rm.leave('b');
  assert.equal(room.phase, 'results');
  assert.ok(rm.retry('a').error);
  assert.ok(rm.nextNight('a').error);
});

test('backToLobby from results by anyone; repeated clicks are fine', () => {
  const { rm, room } = roomWith(2);
  assert.deepEqual(rm.backToLobby('b'), { ok: true });
  startAndRun(rm, room);
  assert.ok(rm.backToLobby('b').error);
  finish(rm, room, true);
  assert.deepEqual(rm.backToLobby('b'), { ok: true });
  assert.equal(room.phase, 'lobby'); assert.equal(room.game, null);
  assert.deepEqual(rm.backToLobby('a'), { ok: true });
});

test('a throwing night does not stop other rooms', () => {
  const r1 = roomWith(2), r2 = { rm: r1.rm, room: r1.rm.createRoom(P('x')) };
  r1.rm.joinRoom(r2.room.code, P('y'));
  r1.rm.startMatch('a'); r1.rm.startMatch('x');
  for (let i = 0; i < 90; i++) r1.rm.tick();
  r1.room.game.step = () => { throw new Error('boom'); };
  const orig = console.error; console.error = () => {};
  try { r1.rm.tick(); } finally { console.error = orig; }
  assert.equal(r1.room.phase, 'lobby');
  assert.equal(r2.room.phase, 'playing');
});

test('onRoomChange fires on joins, night choice and phase changes', () => {
  const rm = new RoomManager({ rng: seeded(5) });
  const seen = [];
  rm.onRoomChange(r => seen.push(r.phase));
  const room = rm.createRoom(P('a'));
  rm.joinRoom(room.code, P('b'));
  rm.selectNight('a', 1);
  rm.startMatch('a');
  assert.deepEqual(seen, ['lobby', 'lobby', 'lobby', 'countdown']);
});
