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
 * Assign a unit to a room.
 * Updates the unit's assignment, roomId, and position (moves to a tile inside the room).
 * Removes the unit from any previous room's workers array and adds to the new one.
 * Returns true if assignment was successful.
 */
export function assignUnitToRoom(state, unitId, room) {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return false;

  const roomDefs = getRoomDefs();
  const def = roomDefs.find(d => d.id === room.type);
  if (!def) return false;

  // Remove from previous room's workers array
  if (unit.roomId != null) {
    const prevRoom = state.rooms.find(r => r.id === unit.roomId);
    if (prevRoom && prevRoom.workers) {
      prevRoom.workers = prevRoom.workers.filter(id => id !== unit.id);
    }
  }

  // Add to new room's workers array
  if (!room.workers) room.workers = [];
  if (!room.workers.includes(unit.id)) {
    room.workers.push(unit.id);
  }

  // Update unit state
  unit.assignment = 'working';
  unit.roomId = room.id;

  // Move unit to a tile inside the room (center of the room)
  const [w, h] = def.size;
  unit.position.x = room.x + Math.floor(w / 2);
  unit.position.y = room.y + Math.floor(h / 2);

  // Offset slightly if multiple workers share the same center tile
  const workerIndex = room.workers.indexOf(unit.id);
  if (workerIndex > 0) {
    // Spread workers around the room center using simple offsets
    const offsets = [
      { dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: -1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];
    const offset = offsets[workerIndex % offsets.length];
    const newX = unit.position.x + offset.dx;
    const newY = unit.position.y + offset.dy;
    // Ensure the offset tile is within the room bounds
    if (newX >= room.x && newX < room.x + w && newY >= room.y && newY < room.y + h) {
      unit.position.x = newX;
      unit.position.y = newY;
    }
  }

  return true;
}

/**
 * Unassign a unit from its current room (set back to idle).
 * Removes it from the room's workers array and moves it to the Mead Hall.
 */
export function unassignUnit(state, unitId) {
  const unit = state.units.find(u => u.id === unitId);
  if (!unit) return false;

  // Remove from current room's workers array
  if (unit.roomId != null) {
    const prevRoom = state.rooms.find(r => r.id === unit.roomId);
    if (prevRoom && prevRoom.workers) {
      prevRoom.workers = prevRoom.workers.filter(id => id !== unit.id);
    }
  }

  // Move to Mead Hall
  const meadHall = state.rooms.find(r => r.type === 'meadHall');
  const allRoomDefs = getRoomDefs();
  const meadHallDef = allRoomDefs.find(d => d.id === 'meadHall');
  if (meadHall && meadHallDef) {
    const [w, h] = meadHallDef.size;
    unit.position.x = meadHall.x + Math.floor(w / 2);
    unit.position.y = meadHall.y + Math.floor(h / 2);
  }

  unit.assignment = 'idle';
  unit.roomId = null;

  return true;
}

/**
 * Find a unit at a given tile position.
 * Returns the unit instance or null.
 */
export function getUnitAtTile(units, tx, ty) {
  if (!units) return null;
  return units.find(u => u.position.x === tx && u.position.y === ty) || null;
}

/**
 * Sync nextUnitId after loading a saved game so new units don't collide.
 */
export function syncUnitIds(units) {
  if (!units || units.length === 0) return;
  const maxId = Math.max(...units.map(u => u.id));
  if (maxId >= nextUnitId) nextUnitId = maxId + 1;
}
