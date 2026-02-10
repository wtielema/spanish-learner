// units.js — Unit definitions, recruitment, and capacity management

import { getRoomDefs } from './rooms.js';
import { canAfford, deductCost } from './rooms.js';

let unitDefs = [];
let nextUnitId = 1;

/**
 * Load unit definitions from data/units.json.
 */
export async function loadUnitDefs() {
  const resp = await fetch('data/units.json');
  unitDefs = await resp.json();
}

/**
 * Returns the loaded unit definitions array.
 */
export function getUnitDefs() {
  return unitDefs;
}

/**
 * Returns max unit capacity based on Mead Hall level.
 * Looks up the Mead Hall room in state.rooms and uses unitCapBonus from room defs.
 * Default: 6 (level 1 Mead Hall).
 */
export function getUnitCapacity(state) {
  const roomDefs = getRoomDefs();
  const meadHallDef = roomDefs.find(d => d.id === 'meadHall');
  const meadHall = state.rooms.find(r => r.type === 'meadHall');

  if (!meadHall || !meadHallDef || !meadHallDef.unitCapBonus) return 6;

  const level = meadHall.level || 1;
  const index = Math.min(level, meadHallDef.unitCapBonus.length) - 1;
  return meadHallDef.unitCapBonus[index] || 6;
}

/**
 * Recruit a new unit of the given type.
 * Checks: unit cap not reached, can afford cost, has appropriate building.
 * Returns the new unit instance or null if recruitment fails.
 */
export function recruitUnit(state, unitTypeId) {
  const def = unitDefs.find(d => d.id === unitTypeId);
  if (!def) return null;

  // Check unit capacity
  const currentCount = state.units ? state.units.length : 0;
  const maxCap = getUnitCapacity(state);
  if (currentCount >= maxCap) return null;

  // Check cost
  if (!canAfford(state.resources, def.cost)) return null;

  // Find Mead Hall position for spawn point
  const meadHall = state.rooms.find(r => r.type === 'meadHall');
  const roomDefs = getRoomDefs();
  const meadHallDef = roomDefs.find(d => d.id === 'meadHall');

  let spawnX = 30;
  let spawnY = 20;
  if (meadHall && meadHallDef) {
    const [w, h] = meadHallDef.size;
    spawnX = meadHall.x + Math.floor(w / 2);
    spawnY = meadHall.y + Math.floor(h / 2);
  }

  // Deduct cost
  deductCost(state.resources, def.cost);

  const unit = {
    id: nextUnitId++,
    type: unitTypeId,
    health: def.stats.health,
    maxHealth: def.stats.health,
    assignment: 'idle',
    roomId: null,
    position: { x: spawnX, y: spawnY },
  };

  if (!state.units) state.units = [];
  state.units.push(unit);
  return unit;
}

/**
 * Returns list of unit types the player can currently recruit
 * based on buildings and their levels.
 */
export function getAvailableRecruits(state) {
  const roomDefs = getRoomDefs();
  const available = new Set();

  for (const room of state.rooms) {
    const def = roomDefs.find(d => d.id === room.type);
    if (!def) continue;

    // Mead Hall always allows Thralls
    if (room.type === 'meadHall') {
      available.add('thrall');
    }

    // Check unlocksUnits for buildings like Barracks and Shrine
    if (def.unlocksUnits) {
      const level = room.level || 1;
      const index = Math.min(level, def.unlocksUnits.length) - 1;
      const unlocked = def.unlocksUnits[index] || [];
      for (const unitId of unlocked) {
        available.add(unitId);
      }
    }
  }

  // Return full unit defs that are available
  return unitDefs.filter(d => available.has(d.id));
}

/**
 * Returns which unit types a specific room can recruit.
 * Used by the recruit panel to show only relevant units.
 */
export function getRecruitsForRoom(state, room) {
  const roomDefs = getRoomDefs();
  const def = roomDefs.find(d => d.id === room.type);
  if (!def) return [];

  const available = new Set();

  // Mead Hall can recruit Thralls
  if (room.type === 'meadHall') {
    available.add('thrall');
  }

  // Buildings with unlocksUnits
  if (def.unlocksUnits) {
    const level = room.level || 1;
    const index = Math.min(level, def.unlocksUnits.length) - 1;
    const unlocked = def.unlocksUnits[index] || [];
    for (const unitId of unlocked) {
      available.add(unitId);
    }
  }

  return unitDefs.filter(d => available.has(d.id));
}

/**
 * Sync nextUnitId after loading a saved game so new units don't collide.
 */
export function syncUnitIds(units) {
  if (!units || units.length === 0) return;
  const maxId = Math.max(...units.map(u => u.id));
  if (maxId >= nextUnitId) nextUnitId = maxId + 1;
}
