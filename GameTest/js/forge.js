// forge.js — Forge upgrade definitions, purchasing, and stat bonus calculations

import { canAfford, deductCost } from './rooms.js';

let upgradeDefs = [];

/**
 * Load upgrade definitions from data/upgrades.json.
 */
export async function loadUpgradeDefs() {
  const resp = await fetch('data/upgrades.json');
  upgradeDefs = await resp.json();
}

/**
 * Returns the loaded upgrade definitions array.
 */
export function getUpgradeDefs() {
  return upgradeDefs;
}

/**
 * Returns upgrades available based on forge level.
 * Finds the forge room in state.rooms and gets its level.
 * Returns all upgrade defs whose requiredForgeLevel <= forge level.
 */
export function getAvailableUpgrades(state) {
  const forgeRoom = state.rooms.find(r => r.type === 'forge');
  if (!forgeRoom) return [];

  const forgeLevel = forgeRoom.level || 1;
  return upgradeDefs.filter(def => def.requiredForgeLevel <= forgeLevel);
}

/**
 * Purchase an upgrade. Checks affordability, deducts cost, and marks
 * the upgrade as purchased in state.forge.
 * Returns true if purchase was successful, false otherwise.
 */
export function purchaseUpgrade(state, upgradeId) {
  // Already purchased?
  if (state.forge && state.forge[upgradeId]) return false;

  const def = upgradeDefs.find(d => d.id === upgradeId);
  if (!def) return false;

  // Check forge level requirement
  const forgeRoom = state.rooms.find(r => r.type === 'forge');
  if (!forgeRoom) return false;
  const forgeLevel = forgeRoom.level || 1;
  if (def.requiredForgeLevel > forgeLevel) return false;

  // Check affordability
  if (!canAfford(state.resources, def.cost)) return false;

  // Deduct cost
  deductCost(state.resources, def.cost);

  // Mark as purchased
  if (!state.forge) state.forge = {};
  state.forge[upgradeId] = true;

  return true;
}

/**
 * Returns cumulative stat bonuses { attack: N, defense: N } for a given
 * unit type based on all purchased forge upgrades.
 */
export function getUnitStatBonuses(state, unitType) {
  const bonuses = { attack: 0, defense: 0 };

  if (!state.forge) return bonuses;

  for (const def of upgradeDefs) {
    if (!state.forge[def.id]) continue; // not purchased
    if (!def.effects[unitType]) continue; // doesn't affect this unit type

    const effects = def.effects[unitType];
    if (effects.attack) bonuses.attack += effects.attack;
    if (effects.defense) bonuses.defense += effects.defense;
  }

  return bonuses;
}

/**
 * Check if an upgrade has already been purchased.
 */
export function isUpgradePurchased(state, upgradeId) {
  return !!(state.forge && state.forge[upgradeId]);
}
