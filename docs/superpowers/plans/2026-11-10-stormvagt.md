# Stormvagt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Danish-language browser co-op game for 2–4 online players who keep a lighthouse lit through five storm nights.

**Architecture:** Same shape as Skillet Scrap (`../Skillet Scrap`): one Node.js program serves the page and runs the authoritative game over WebSocket; browsers send key states and draw interpolated state on a canvas. Game rules are pure code with no network or timers. Rooms, server, networking and input code are copied from Skillet Scrap and adapted.

**Tech Stack:** Node.js 20+ (ES modules), `ws`, built-in `node:test`, plain browser JavaScript, Canvas 2D, Web Audio. No build step.

**Spec:** `docs/superpowers/specs/2026-11-10-stormvagt-design.md` (Danish; it is the authority).

## Global Constraints

- Project folder: `C:\Users\tomal\Documents\Jette\Projects\Stormvagt`. Reference project to copy from: `C:\Users\tomal\Documents\Jette\Projects\Skillet Scrap` (read only, never modify).
- Only runtime dependency: `ws`. No asset files; all art and sound generated in code and original.
- All player-facing text is Danish.
- 2–4 players; start needs at least 2. Rooms hold up to 4, 4-letter codes.
- Controls: A/D or ←/→ walk; W/S or ↑/↓ climb at the ladder; Space picks up/drops and is held to use a station. One carried item: oil can (empty/full) or board.
- Server tick 30 Hz, state broadcast ~20 Hz. Port from `process.env.PORT`, default 3000.
- Pixel art drawn at 320×180 and scaled up by whole pixels.
- Spec values, verbatim: oil 0–100, burns 1/s, +50 % burn per broken lantern-room window; full can gives +50 after a 1 s hold; can fills at barrels with a 1.5 s hold, not while flooded; lens points left or right, turning takes a 2 s hold at that side's crank; jammed lens repaired with a board by a 3 s hold; lit ship progress 0→100 in 20 s; unlit ship danger 0→100 in 25 s and never decreases; window repair with a board, 2 s hold; water 0–100, flooded at ≥ 60 (no can filling, slower walking in cellar and oil store); ships per night at 2 players 4/5/6/7/8, +1 per extra player; night lost at the 3rd wreck; dawn when the last ship is resolved, won with ≤ 2 wrecks.
- Unlocked nights live in the room creator's browser (`localStorage`); night 1 always open.
- No git: tasks have no commit steps; the controller snapshots work.

## Review Focus

1. A player disconnecting while carrying an item or mid-hold: the item drops where they stood, hold progress is discarded, the night continues for the others.
2. Two or more players using one station at once: the pump stacks per player; every other station completes once, and a board or oil load is consumed only once.
3. Malformed or out-of-range client values (night "6", 0, "abc", arrays, prototype keys): rejected with an error, server keeps running.
4. `localStorage` unavailable or holding garbage: only night 1 offered, no crash.
5. Space pressed on the ladder or held through a move away from a station: no drop onto the ladder, and the hold resets when the player leaves the station's reach.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `render.yaml`, `README.md`, `start-spil.bat`, `.gitignore` | Scripts, deploy, Danish instructions |
| `server/game/constants.js` | Every tuning number |
| `server/game/world.js` | Floors, ladder, station and window positions |
| `server/game/players.js` | Walking, climbing, carrying, finding the station in reach |
| `server/game/tower.js` | Lamp, oil can and barrels, lens, windows, water, lightning |
| `server/game/ships.js` | Ship spawning, lit/unlit progress, harbour and wreck |
| `server/game/nights.js` | Per-night schedules and player-count scaling |
| `server/game/index.js` | `createNight` ties it together |
| `server/rooms.js` | Rooms, lobby, night choice, lifecycle |
| `server/index.js` | HTTP static, WebSocket, loop |
| `public/*` | Screens, input, net, renderer, sound |
| `test/*.test.js` | Tests |

---

### Task 1: Setup, world and players

**Files:** Create `package.json` (copy Skillet Scrap's; name `stormvagt`; test script `node --test "test/*.test.js"`), `.gitignore`, `server/game/constants.js`, `server/game/world.js`, `server/game/players.js`. Test: `test/players.test.js`.

**Interfaces — Produces:**
- `DT = 1/30`, `VIEW_W = 320`, `VIEW_H = 180`.
- `WORLD`: `{ floors: [{ id: 'lantern'|'workshop'|'oil'|'cellar', y, left, right }], ladder: { x, top, bottom }, stations: [{ id, kind: 'lamp'|'crankLeft'|'crankRight'|'lens'|'boards'|'barrels'|'pump', floor, x }], windows: [{ id, floor, x, side: 'left'|'right' }] }`. Floors top to bottom: lantern, workshop, oil, cellar; 2 windows per floor except the cellar.
- `makePlayer({ id, name, x, floor }) -> { id, name, x, y, floor, onLadder:false, facing:1, carry:null, hold:null }` where `carry` is `null | { kind:'can', full:boolean } | { kind:'board' }` and `hold` is `null | { target, t }`.
- `stepPlayer(p, keys, dt, { flooded }) -> void`. Moves along the floor within walls, climbs when at the ladder, snaps to the floor on leaving the ladder; speed reduced by `FLOOD_SLOW` in cellar and oil floors when flooded.
- `targetInReach(p, world, items) -> { type:'station'|'window'|'item', id } | null`, nearest within `REACH` on the same floor; null on the ladder.

- [ ] **Step 1: Failing tests** in `test/players.test.js`: walking right for 1 s moves right and stops at the wall; W at the ladder climbs and reaches the floor above; W away from the ladder does nothing; flooded cellar walking is slower; `targetInReach` returns the lamp when standing at it and `null` on the ladder.
- [ ] **Step 2:** Run `npm test`. Expected FAIL.
- [ ] **Step 3:** Implement; all speeds and reaches in `constants.js`.
- [ ] **Step 4:** Run `npm test`. Expected PASS.

### Task 2: Tower systems

**Files:** Create `server/game/tower.js`. Test: `test/tower.test.js`.

**Interfaces:**
- Consumes: Task 1.
- Produces: `makeTower(world, playerCount) -> { oil:100, lens:'left', lensJammed:false, water:0, broken:Set<windowId>, items:[{ id, kind, full?, x, floor }] }`. Starting items: one empty can per player in the oil store (count passed in: `makeTower(world, playerCount)`).
- `useSpace(tower, p, pressed, held, dt, world, events) -> void`: handles pick up / drop on a press, and holds at stations: fill can at barrels (1.5 s, not when flooded), pour at lamp (1 s, +50, capped at 100, can becomes empty), turn lens at a crank (2 s, not when jammed), repair window (2 s, uses the board), repair lens (3 s, uses the board), take a board at the stack (press), pump (held, `PUMP_RATE` per player per second). Hold resets when the target changes or Space is released. No drop on the ladder.
- `stepTower(tower, dt, rates, events) -> void`: burns oil at 1/s × (1 + 0.5 × broken lantern windows); water rises by `rates.waterBase + rates.waterPerWindow × broken lower windows`; `flooded = water >= 60`.
- `breakWindow(tower, id, events)`, `strikeLightning(tower, events)` (jams the lens).
- `dropCarried(tower, p)` for disconnects.
- Events: `{type:'pour'|'fill'|'turn'|'repair'|'pump'|'break'|'lightning'|'lampOut'|'pickup'|'drop', ...}`.

- [ ] **Step 1: Failing tests** in `test/tower.test.js`, with exact spec values: oil falls 10 in 10 s; with one broken lantern window 15 in 10 s; pouring a full can takes 30 ticks and adds 50 capped at 100; filling takes 45 ticks and is refused when water is 60; lens turns after 60 ticks at the right crank and not when jammed; lens repair takes 90 ticks with a board and consumes it; window repair 60 ticks consumes the board; releasing Space at 59 ticks resets progress; walking away mid-hold resets progress; two players pumping lower water twice as fast; two players repairing one window consume one board; a press on the ladder does not drop the item; `dropCarried` puts the item at the player's spot.
- [ ] **Step 2:** Run `npm test`. Expected FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected PASS.

### Task 3: Ships, nights and the game

**Files:** Create `server/game/ships.js`, `server/game/nights.js`, `server/game/index.js`. Test: `test/ships.test.js`, `test/nights.test.js`.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `nightPlan(night, playerCount, rng) -> { ships:[{ at, side }], windowBreaks:[at], lightning:[at], rates:{ waterBase, waterPerWindow } }`. Night 1 has no windows, water or lightning; windows from 2, water from 3, lightning from 4. Ship count = `[4,5,6,7,8][night-1] + (playerCount - 2)`. Extra players also make windows, water and lightning more frequent. All numbers in `constants.js`.
- `stepShips(ships, lit, dt, events)`: a ship is lit when `lit[side]` is true; lit progress +100/20 s, unlit danger +100/25 s; ≥100 → `'harbour'` or `'wrecked'` with events `harbour`/`wreck`.
- `createNight({ night, players:[{id,name}], rng }) -> game` with the Skillet Scrap game interface: `step(inputs)`, `getState()`, `drainEvents()`, `isOver()`, `getResult() -> { won, night, saved, wrecked }`, plus `removePlayer(id)` (drops their item; the night continues).
- State: `{ night, phase:'playing'|'won'|'lost', time, players:[...], tower:{ oil, lens, lensJammed, water, flooded, broken:[...], items:[...] }, ships:[{ id, side, progress, danger, status }], wrecked, saved, shipsTotal }`.
- Lit rule: lamp oil > 0 and lens points at that side and is not jammed.
- Lost the moment the 3rd ship wrecks; won when all ships are resolved with ≤ 2 wrecks.

- [ ] **Step 1: Failing tests**: ship counts per night at 2, 3 and 4 players; night 1 has no breaks, water or lightning, and 4 has lightning; a lit ship reaches harbour in 600 ticks; an unlit ship wrecks in 750 ticks; danger never drops when it is lit again; empty oil leaves both sides unlit; a jammed lens leaves the ship unlit; 3 wrecks → `lost` immediately; all resolved with 2 wrecks → `won`; `removePlayer` keeps the night going and drops their item; same seed and inputs give the same state after 600 ticks; `getState()` is JSON-safe.
- [ ] **Step 2:** Run `npm test`. Expected FAIL.
- [ ] **Step 3:** Implement. Spread ship arrivals so a night lasts about 6–10 minutes; never more than 3 ships waiting at once on night 1.
- [ ] **Step 4:** Run `npm test`. Expected PASS.

### Task 4: Rooms

**Files:** Create `server/rooms.js` (adapt Skillet Scrap's `server/rooms.js`). Test: `test/rooms.test.js` (adapt Skillet Scrap's).

**Interfaces:**
- Consumes: `createNight`.
- Produces: `RoomManager` with the Skillet Scrap methods, where `selectMode` is replaced by `selectNight(playerId, night)` (integer 1–5, creator only); `startMatch` requires ≥ 2 players and a chosen night; results actions are `nextNight` (creator, only after a win, night < 5), `retry` (creator), `backToLobby` (anyone; ok if already in the lobby). `leave` during a night calls `game.removePlayer` and sets notice "`<navn>` forlod natten"; if fewer than 1 player remains the room is deleted; in lobby or results the notice is "`<navn>` forlod rummet". Joining is refused outside the lobby. Danish error messages.
- Room fields: `code, phase:'lobby'|'countdown'|'playing'|'results', players, creatorId, night, notice, game, countdown`.

- [ ] **Step 1: Failing tests** (adapted from Skillet Scrap plus): `selectNight` rejects 0, 6, "3", 2.5, [1], "constructor" and non-creators; start refused with 1 player; leaving mid-night keeps the room playing for the others with the notice; `nextNight` only after a win and refused on night 5; `retry` restarts the same night; Danish error texts for unknown code, full room and room in a night.
- [ ] **Step 2–4:** fail, implement, pass.

### Task 5: Server

**Files:** Create `server/index.js` (adapt Skillet Scrap's, including its final-tick broadcast, HEAD support, payload limit, ping, close-handler catch). Test: `test/server.test.js` (adapt).

**Interfaces:** Protocol is Skillet Scrap's with `mode` replaced by `night{night}` and results actions `next`, `retry`, `lobby`. `room` messages include `night`. `GET /health` returns `ok`.

- [ ] **Step 1: Failing tests**: create, join, choose night 1, start, receive `state`; held `right` moves the player; a client closing mid-night leaves the other playing with the notice; malformed messages keep the server alive; static path confinement; `/health`.
- [ ] **Step 2–4:** fail, implement, pass. Add a placeholder `public/index.html`.

### Task 6: Client screens

**Files:** Create `public/index.html`, `style.css`, `net.js`, `input.js`, `ui.js` (adapt Skillet Scrap's; Danish copy throughout).

- [ ] **Step 1:** Screens: forside (navn, Opret rum, kode + Deltag), lobby (stor kode, spillere, natvælger with locked nights shown greyed with "Klar nat N først", "Sådan spiller I" card, Start for the creator), resultat (Natten er overstået / Fyret gik ud, skibe i havn, forliste, Næste nat / Prøv igen / Tilbage til lobbyen). Keep Skillet Scrap's waking, lost-connection, pending, focus-loss and ctrl/meta handling. The input maps W/S and ↑/↓ for climbing too.
- [ ] **Step 2:** Unlocks: `localStorage` key `stormvagt.unlocked` holds the highest unlocked night (1–5); read and write in try/catch; garbage or missing means 1. On a won result the creator's browser stores `max(current, night + 1)` capped at 5.
- [ ] **Step 3: Verify in the in-app browser** with two tabs: create, join, night picker shows only night 1 open, start, leave, garbage in `localStorage` still shows night 1.

### Task 7: Pixel art and sound

**Files:** Create `public/render.js`, `public/sound.js`; modify `ui.js`, `index.html`, `style.css`.

- [ ] **Step 1:** Draw at 320×180 on an offscreen canvas and scale by the largest whole number that fits (letterbox the rest). Interpolate with a ~150 ms delay as Skillet Scrap does.
- [ ] **Step 2:** Scene: night sea on both sides with waves and rain, the cut-open tower with four floors, ladder, stations (lamp with oil gauge, lens with beam pointing left/right and a light cone on the sea, cranks, board stack, barrels, pump), windows (whole/broken with wind streaks), rising cellar water, ships with a progress/danger bar, wreck and harbour effects, lightning flash. Players: four distinct small keepers in different coloured oilskins, name tags, carried item visible, a hold-progress ring.
- [ ] **Step 3:** HUD in Danish: Nat N, skibe i havn x/total, forliste y/3, lampens olie. Banners: "Nat N", "Daggry!", "Fyret gik ud".
- [ ] **Step 4:** Sound: generated Web Audio effects for pour, pump, hammer, break, thunder, horn (ship arriving), harbour bell, wreck; mute toggle remembered in `localStorage`.
- [ ] **Step 5: Verify** in the in-app browser with two tabs on night 3: screenshots show all four floors readable, both players distinct, no console errors.

### Task 8: Instructions, playthrough and tuning

**Files:** Create `README.md` (Danish, plain language, same sections as Skillet Scrap's README: what it is, how to play, start on the PC, put online with GitHub + Render, troubleshooting), `start-spil.bat` (adapt Skillet Scrap's), `render.yaml` (service name `stormvagt`). Modify `constants.js`.

- [ ] **Step 1:** Write bots (in the controller's scratchpad, not the project) that play through the real server by sending keys: a simple role-picking brain (refill oil, keep lens on the side with the most danger, repair, pump).
- [ ] **Step 2:** Play every night with 2, 3 and 4 bots. Tune so nights last about 6–10 minutes, night 1 is nearly always won, and night 5 is won sometimes. Record every run.
- [ ] **Step 3:** One real browser view per night type (1, 3, 5) with bots filling seats; screenshots.
- [ ] **Step 4:** `npm test` passes; nothing left running; report honestly.
