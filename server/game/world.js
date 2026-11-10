import { LAYOUT } from '../../public/layout.js';

export const WORLD = LAYOUT;

export const floorById = id => WORLD.floors.find(f => f.id === id);
export const isLowerFloor = id => id === 'workshop' || id === 'oil';
