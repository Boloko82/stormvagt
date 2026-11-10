// All tuning values for Stormvagt. Units: pixels (320x180 world), seconds.
export const DT = 1 / 30;
export const VIEW_W = 320;
export const VIEW_H = 180;

// Players
export const WALK_SPEED = 62;        // px/s
export const CLIMB_SPEED = 60;       // px/s on the ladder
export const LADDER_GRAB = 7;        // how close to the ladder you must stand to climb
export const FLOOD_SLOW = 0.55;      // walking speed factor in the cellar and oil store when flooded
export const REACH = 9;              // how close to a station, window or item you must stand

// Lamp and oil (spec values)
export const OIL_MAX = 100;
export const OIL_BURN = 1;                // per second
export const OIL_BURN_PER_WINDOW = 0.5;   // +50 % per broken lantern-room window
export const OIL_PER_CAN = 50;
export const POUR_TIME = 1;
export const FILL_TIME = 1.5;

// Lens (spec values)
export const TURN_TIME = 2;
export const LENS_REPAIR_TIME = 3;

// Windows and water
export const WINDOW_REPAIR_TIME = 2;
export const WATER_MAX = 100;
export const FLOOD_LEVEL = 60;
export const PUMP_RATE = 6;               // water removed per second per pumping player

// Ships (spec values)
export const SHIP_SAVE_TIME = 20;         // lit seconds to reach harbour
export const SHIP_WRECK_TIME = 25;        // unlit seconds to wreck
export const MAX_WRECKS = 2;              // the 3rd wreck loses the night

// Nights. ships = ships at 2 players (spec); span = seconds over which ships arrive.
// windowBreaks and lightning are counts at 2 players; water rates are per second.
export const FIRST_SHIP_AT = 8;
export const EXTRA_PLAYER_SCALE = 0.6;   // each player beyond 2 adds this much to breaks, lightning and water
export const NIGHTS = [
  { ships: 4, span: 420, windowBreaks: 0, lightning: 0, waterBase: 0, waterPerWindow: 0 },
  { ships: 5, span: 450, windowBreaks: 5, lightning: 0, waterBase: 0, waterPerWindow: 0 },
  { ships: 6, span: 480, windowBreaks: 6, lightning: 0, waterBase: 0.25, waterPerWindow: 0.3 },
  { ships: 7, span: 510, windowBreaks: 5, lightning: 3, waterBase: 0.22, waterPerWindow: 0.28 },
  { ships: 8, span: 540, windowBreaks: 6, lightning: 3, waterBase: 0.24, waterPerWindow: 0.3 },
];
