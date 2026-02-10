import { TILE, GRID_WIDTH, GRID_HEIGHT } from './grid.js';

let roomDefs = [];
let nextRoomId = 1;

export async function loadRoomDefs() {
  const resp = await fetch('data/rooms.json');
  roomDefs = await resp.json();
}

export function getRoomDefs() {
  return roomDefs;
}

/** Check if a room of given width x height can be placed at (x, y) on the grid */
export function canPlaceRoom(grid, x, y, width, height) {
  // Bounds check
  if (x < 0 || y < 0 || x + width > GRID_WIDTH || y + height > GRID_HEIGHT) return false;

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = grid[y + dy][x + dx];
      if (tile.type !== TILE.FLOOR || tile.roomId) return false;
    }
  }
  return true;
}

/** Check if the player can afford a cost object like { wood: 30, iron: 10 } */
export function canAfford(resources, cost) {
  for (const [res, amount] of Object.entries(cost)) {
    if ((resources[res] || 0) < amount) return false;
  }
  return true;
}

/** Deduct cost from resources (mutates resources in place) */
export function deductCost(resources, cost) {
  for (const [res, amount] of Object.entries(cost)) {
    resources[res] = (resources[res] || 0) - amount;
  }
}

/**
 * Place a room on the grid.
 * Returns the room instance if successful, or null if placement is invalid / can't afford.
 */
export function placeRoom(state, roomDefId, x, y) {
  const def = roomDefs.find(d => d.id === roomDefId);
  if (!def) return null;

  const [width, height] = def.size;

  if (!canPlaceRoom(state.grid, x, y, width, height)) return null;
  if (!canAfford(state.resources, def.cost)) return null;

  deductCost(state.resources, def.cost);

  const room = {
    id: nextRoomId++,
    type: roomDefId,
    x,
    y,
    level: 1,
    workers: [],
  };

  // Mark grid tiles
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = state.grid[y + dy][x + dx];
      tile.roomId = room.id;
      tile.roomColor = def.color;
    }
  }

  state.rooms.push(room);
  return room;
}

/**
 * Place a room without deducting cost (used for starting Mead Hall).
 * Returns the room instance.
 */
export function placeRoomFree(state, roomDefId, x, y) {
  const def = roomDefs.find(d => d.id === roomDefId);
  if (!def) return null;

  const [width, height] = def.size;

  const room = {
    id: nextRoomId++,
    type: roomDefId,
    x,
    y,
    level: 1,
    workers: [],
  };

  // Mark grid tiles
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tile = state.grid[y + dy][x + dx];
      tile.roomId = room.id;
      tile.roomColor = def.color;
    }
  }

  state.rooms.push(room);
  return room;
}

/**
 * Tick resource production for all rooms with workers assigned.
 * output = (baseRate + workerCount * perWorker) * levelMultiplier
 * levelMultiplier = room.level (level 2 = 2x, level 3 = 3x)
 * Only produces if at least 1 worker is assigned.
 * Resources are capped by state.storage.
 */
export function tickProduction(state) {
  for (const room of state.rooms) {
    const def = roomDefs.find(d => d.id === room.type);
    if (!def || !def.production) continue;

    const workerCount = room.workers ? room.workers.length : 0;
    if (workerCount === 0) continue;

    const { resource, baseRate, perWorker } = def.production;
    const levelMultiplier = room.level || 1;
    const output = (baseRate + workerCount * perWorker) * levelMultiplier;

    const cap = state.storage[resource] || Infinity;
    state.resources[resource] = Math.min(
      (state.resources[resource] || 0) + output,
      cap
    );
  }
}

/**
 * Upgrade a room to the next level.
 * Checks: room exists, below maxLevel, player can afford upgrade cost.
 * Deducts cost, increments level, returns true/false.
 */
export function upgradeRoom(state, roomInstanceId) {
  const room = state.rooms.find(r => r.id === roomInstanceId);
  if (!room) return false;

  const def = roomDefs.find(d => d.id === room.type);
  if (!def) return false;

  const currentLevel = room.level || 1;
  const maxLevel = def.maxLevel || 1;
  if (currentLevel >= maxLevel) return false;

  // upgradeCost is an array: index 0 = cost for level 2, index 1 = cost for level 3
  if (!def.upgradeCost) return false;
  const costIndex = currentLevel - 1;
  if (costIndex >= def.upgradeCost.length) return false;

  const cost = def.upgradeCost[costIndex];
  if (!canAfford(state.resources, cost)) return false;

  deductCost(state.resources, cost);
  room.level = currentLevel + 1;
  return true;
}

/**
 * Get the production rate info for a room at its current level.
 * Returns { resource, rate } or null if the room has no production.
 */
export function getRoomProductionRate(room) {
  const def = roomDefs.find(d => d.id === room.type);
  if (!def || !def.production) return null;

  const workerCount = room.workers ? room.workers.length : 0;
  const { resource, baseRate, perWorker } = def.production;
  const levelMultiplier = room.level || 1;
  const rate = (baseRate + workerCount * perWorker) * levelMultiplier;

  return { resource, rate, baseRate, perWorker, levelMultiplier, workerCount };
}

/**
 * Sync nextRoomId after loading a saved game so new rooms don't collide.
 */
export function syncRoomIds(rooms) {
  if (rooms.length === 0) return;
  const maxId = Math.max(...rooms.map(r => r.id));
  if (maxId >= nextRoomId) nextRoomId = maxId + 1;
}
