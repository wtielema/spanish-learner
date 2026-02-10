export function createInitialState() {
  return {
    grid: [],           // 2D array of tile objects
    rooms: [],          // placed room instances
    units: [],          // all unit instances
    resources: { wood: 50, iron: 30, runes: 0 },
    storage: { wood: 200, iron: 200, runes: 100 },
    expeditions: [],    // active expeditions
    raids: [],          // pending/active raids
    forge: {},          // unlocked upgrades
    realm: 'midgard',   // current realm progress
    raidTimer: 0,       // seconds until next raid
    tick: 0,            // total game ticks
    lastSaved: Date.now(),
  };
}

export let gameState = createInitialState();

export function setState(newState) {
  gameState = newState;
}
