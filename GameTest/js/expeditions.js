// expeditions.js — Expedition definitions, validation, and resolution
// Handles timed missions where players send units to battle enemies for rewards.

import { resolveBattle, prepareCombatant } from './combat.js';
import { getUnitStatBonuses } from './forge.js';
import { getUnitDefs } from './units.js';
import { getEnemyDefs } from './raids.js';

let expeditionDefs = [];

/**
 * Load expedition definitions from data/expeditions.json.
 */
export async function loadExpeditionDefs() {
  const resp = await fetch('data/expeditions.json');
  expeditionDefs = await resp.json();
}

/**
 * Returns the loaded expedition definitions array.
 */
export function getExpeditionDefs() {
  return expeditionDefs;
}

/**
 * Returns expeditions available for the current realm.
 * Expeditions whose realmRequired matches the current realm are available.
 * All others are locked.
 */
export function getAvailableExpeditions(state) {
  return expeditionDefs.filter(def => def.realmRequired === state.realm);
}

/**
 * Returns all expedition definitions that are locked (wrong realm).
 */
export function getLockedExpeditions(state) {
  return expeditionDefs.filter(def => def.realmRequired !== state.realm);
}

/**
 * Start an expedition. Validates unit selection, marks units as on expedition,
 * and creates the active expedition entry.
 *
 * @param {Object} state — game state
 * @param {string} expeditionId — ID from expedition definitions
 * @param {number[]} unitIds — array of unit IDs to send
 * @returns {{ success: boolean, error?: string }}
 */
export function startExpedition(state, expeditionId, unitIds) {
  const def = expeditionDefs.find(d => d.id === expeditionId);
  if (!def) return { success: false, error: 'Unknown expedition' };

  // Check realm requirement
  if (def.realmRequired !== state.realm) {
    return { success: false, error: 'Realm not accessible' };
  }

  // Check unit count limits
  if (unitIds.length < def.minUnits) {
    return { success: false, error: `Need at least ${def.minUnits} unit(s)` };
  }
  if (unitIds.length > def.maxUnits) {
    return { success: false, error: `Maximum ${def.maxUnits} units allowed` };
  }

  const unitDefs = getUnitDefs();

  // Validate each unit: exists, is available (idle or defending, not working/expedition)
  for (const uid of unitIds) {
    const unit = state.units.find(u => u.id === uid);
    if (!unit) return { success: false, error: `Unit ${uid} not found` };
    if (unit.assignment === 'expedition') {
      return { success: false, error: `${getUnitName(unit, unitDefs)} is already on an expedition` };
    }
    if (unit.assignment === 'working') {
      return { success: false, error: `${getUnitName(unit, unitDefs)} is assigned to a room` };
    }

    // Must be able to fight OR be a seer (for bonus)
    const unitDef = unitDefs.find(d => d.id === unit.type);
    if (!unitDef) return { success: false, error: `Unknown unit type ${unit.type}` };
    if (!unitDef.canFight && unitDef.id !== 'seer') {
      return { success: false, error: `${unitDef.name} cannot go on expeditions` };
    }
  }

  // At least one combatant must be able to fight
  const hasFighter = unitIds.some(uid => {
    const unit = state.units.find(u => u.id === uid);
    const unitDef = unitDefs.find(d => d.id === unit.type);
    return unitDef && unitDef.canFight;
  });
  if (!hasFighter) {
    return { success: false, error: 'Need at least one fighter' };
  }

  // Mark units as on expedition
  for (const uid of unitIds) {
    const unit = state.units.find(u => u.id === uid);
    unit.assignment = 'expedition';
    unit.roomId = null;
  }

  // Create active expedition
  if (!state.expeditions) state.expeditions = [];
  state.expeditions.push({
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    expeditionId: def.id,
    unitIds: [...unitIds],
    startTime: Date.now(),
    duration: def.duration,
  });

  return { success: true };
}

/**
 * Tick all active expeditions. Resolves any that have completed.
 * Returns an array of expedition results (may be empty).
 */
export function tickExpeditions(state) {
  if (!state.expeditions || state.expeditions.length === 0) return [];

  const now = Date.now();
  const results = [];
  const remaining = [];

  for (const exp of state.expeditions) {
    const elapsed = now - exp.startTime;
    if (elapsed >= exp.duration * 1000) {
      // Expedition complete — resolve it
      const result = resolveExpedition(state, exp);
      results.push(result);
    } else {
      remaining.push(exp);
    }
  }

  state.expeditions = remaining;
  return results;
}

/**
 * Resolve a completed expedition. Runs combat, processes rewards/losses.
 *
 * @param {Object} state — game state
 * @param {Object} expedition — active expedition entry
 * @returns {Object} result for display
 */
export function resolveExpedition(state, expedition) {
  const def = expeditionDefs.find(d => d.id === expedition.expeditionId);
  const unitDefs = getUnitDefs();
  const enemyDefs = getEnemyDefs();

  // Build attacker combatants from our sent units
  const attackers = [];
  let hasSeer = false;

  for (const uid of expedition.unitIds) {
    const unit = state.units.find(u => u.id === uid);
    if (!unit) continue; // unit may have been removed somehow

    const unitDef = unitDefs.find(d => d.id === unit.type);
    if (!unitDef) continue;

    // Track if a seer is present (for reward bonus)
    if (unitDef.id === 'seer') {
      hasSeer = true;
    }

    // Only fighters enter combat
    if (unitDef.canFight) {
      const forgeBonuses = getUnitStatBonuses(state, unit.type);
      const combatant = prepareCombatant(unit, unitDef, forgeBonuses);
      if (combatant) attackers.push(combatant);
    }
  }

  // Build enemy combatants from expedition definition
  const defenders = [];
  for (const enemyGroup of def.enemies) {
    const eDef = enemyDefs.find(d => d.id === enemyGroup.type);
    for (let i = 0; i < enemyGroup.count; i++) {
      if (eDef) {
        defenders.push({
          id: `enemy_${eDef.id}_${Date.now()}_${Math.random()}`,
          name: eDef.name,
          type: eDef.id,
          health: eDef.stats.health,
          maxHealth: eDef.stats.health,
          attack: eDef.stats.attack,
          defense: eDef.stats.defense,
          canFight: true,
        });
      } else {
        // Fallback
        defenders.push({
          id: `enemy_${enemyGroup.type}_${Date.now()}_${Math.random()}`,
          name: enemyGroup.type,
          type: enemyGroup.type,
          health: 25,
          maxHealth: 25,
          attack: 5,
          defense: 2,
          canFight: true,
        });
      }
    }
  }

  // Build enemy composition summary
  const enemyComposition = summarizeEnemies(defenders);

  // Our units are the attackers, expedition enemies are defenders
  const battleResult = resolveBattle(attackers, defenders);

  const isVictory = battleResult.winner === 'attackers';
  const isDraw = battleResult.winner === 'draw';

  // Process results
  const result = {
    expeditionName: def.name,
    difficulty: def.difficulty,
    enemyComposition,
    unitsSent: expedition.unitIds.length,
    winner: battleResult.winner,
    isVictory,
    attackerLosses: battleResult.attackerLosses,
    attackerSurvivors: battleResult.attackerSurvivors,
    rewards: null,
    realmUnlocked: null,
    ragnarokTriggered: false,
    revivedUnit: null,
    log: battleResult.log,
  };

  if (isVictory) {
    // Calculate rewards with seer bonus
    const seerMultiplier = hasSeer ? 1.3 : 1.0;
    const rewards = {};
    for (const [resource, amount] of Object.entries(def.rewards)) {
      const bonusAmount = Math.floor(amount * seerMultiplier);
      rewards[resource] = bonusAmount;
      // Add to state resources, capped at storage
      state.resources[resource] = Math.min(
        (state.resources[resource] || 0) + bonusAmount,
        state.storage[resource] || Infinity
      );
    }
    result.rewards = rewards;
    result.hasSeerBonus = hasSeer;

    // Handle realm unlock
    if (def.realmUnlock) {
      state.realm = def.realmUnlock;
      result.realmUnlocked = def.realmUnlock;
    }

    // Handle Ragnarok trigger
    if (def.triggersRagnarok) {
      result.ragnarokTriggered = true;
      state.realm = 'asgard';
      // The main game loop should check for this and handle end-game
    }

    // Return surviving units to idle
    for (const uid of expedition.unitIds) {
      const unit = state.units.find(u => u.id === uid);
      if (!unit) continue;
      // Check if unit survived
      const survived = battleResult.attackerSurvivors.find(s => s.id === uid);
      if (survived) {
        unit.assignment = 'idle';
        unit.health = survived.health;
      }
      // Dead units handled below
    }
  } else if (isDraw) {
    // Draw: units return but no rewards
    for (const uid of expedition.unitIds) {
      const unit = state.units.find(u => u.id === uid);
      if (!unit) continue;
      const survived = battleResult.attackerSurvivors.find(s => s.id === uid);
      if (survived) {
        unit.assignment = 'idle';
        unit.health = survived.health;
      }
    }
  }

  // Remove dead units (applies to loss and draw)
  for (const loss of battleResult.attackerLosses) {
    const idx = state.units.findIndex(u => u.id === loss.id);
    if (idx !== -1) {
      // Also remove from room workers array if somehow still assigned
      const deadUnit = state.units[idx];
      if (deadUnit.roomId != null) {
        const room = state.rooms.find(r => r.id === deadUnit.roomId);
        if (room && room.workers) {
          room.workers = room.workers.filter(id => id !== deadUnit.id);
        }
      }
      state.units.splice(idx, 1);
    }
  }

  // Valkyrie revive: check if any attacker survivor was originally in losses
  // (combat.js handles the valkyrie mechanic internally)
  for (const survivor of battleResult.attackerSurvivors) {
    const existsInState = state.units.find(u => u.id === survivor.id);
    if (!existsInState) {
      // This unit was removed (died) but got revived by Valkyrie — re-add it
      const unitDef = unitDefs.find(d => d.id === survivor.type);
      if (unitDef) {
        state.units.push({
          id: survivor.id,
          type: survivor.type,
          health: survivor.health,
          maxHealth: survivor.maxHealth,
          assignment: 'idle',
          roomId: null,
          position: { x: 30, y: 20 },
        });
        result.revivedUnit = survivor.name;
      }
    }
  }

  // On defeat: all units that were sent and didn't survive are already removed.
  // Units that weren't fighters (seers) but were sent — also die on defeat.
  if (!isVictory && !isDraw) {
    for (const uid of expedition.unitIds) {
      const unit = state.units.find(u => u.id === uid);
      if (unit && unit.assignment === 'expedition') {
        // Non-fighter that didn't participate in combat — dies on defeat
        const idx = state.units.indexOf(unit);
        if (idx !== -1) state.units.splice(idx, 1);
      }
    }
  } else {
    // Victory or draw: return non-fighters (seers) to idle
    for (const uid of expedition.unitIds) {
      const unit = state.units.find(u => u.id === uid);
      if (unit && unit.assignment === 'expedition') {
        unit.assignment = 'idle';
      }
    }
  }

  return result;
}

/**
 * Get time remaining for an active expedition in seconds.
 */
export function getExpeditionTimeRemaining(expedition) {
  const elapsed = (Date.now() - expedition.startTime) / 1000;
  return Math.max(0, expedition.duration - elapsed);
}

/**
 * Format seconds into a human-readable duration string (e.g., "5:00", "1:23:45").
 */
export function formatDuration(totalSeconds) {
  const seconds = Math.floor(totalSeconds);
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Helper: get a unit's name from its definition.
 */
function getUnitName(unit, unitDefs) {
  const def = unitDefs.find(d => d.id === unit.type);
  return def ? def.name : unit.type;
}

/**
 * Summarize enemy composition into a readable string.
 */
function summarizeEnemies(enemies) {
  const counts = {};
  for (const enemy of enemies) {
    counts[enemy.name] = (counts[enemy.name] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => `${count} ${name}`)
    .join(', ');
}
