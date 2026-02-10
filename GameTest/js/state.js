import { createGrid } from './grid.js';

export function createInitialState() {
  return {
    grid: createGrid(),
    rooms: [],          // placed room instances
    units: [],          // all unit instances
    resources: { wood: 50, iron: 30, runes: 0 },
    storage: { wood: 200, iron: 200, runes: 100 },
    expeditions: [],    // active expeditions
    raids: [],          // pending/active raids
    forge: {},          // unlocked upgrades
    realm: 'midgard',   // current realm progress
    raidTimer: 0,       // seconds until next raid
    meadHallHP: 100,    // Mead Hall hit points (0 = destroyed)
    tick: 0,            // total game ticks
    lastSaved: Date.now(),
  };
}

export let gameState = createInitialState();

export function setState(newState) {
  gameState = newState;
}
