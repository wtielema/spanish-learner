// raids.js — Raid generation, timer management, and execution
// Handles enemy waves that attack the player's Mead Hall.

import { resolveBattle, prepareCombatant } from './combat.js';
import { getUnitStatBonuses } from './forge.js';
import { getUnitDefs } from './units.js';

let enemyDefs = [];

// Initial raid timer value (ticks). 600 = ~10 minutes at 1 tick/sec.
// For faster testing, reduce to e.g. 60 (1 min) or 120 (2 min).
const INITIAL_RAID_TIMER = 600;

/**
 * Load enemy definitions from data/enemies.json.
 */
export async function loadEnemyDefs() {
  const resp = await fetch('data/enemies.json');
  enemyDefs = await resp.json();
}

/**
 * Returns the loaded enemy definitions array.
 */
export function getEnemyDefs() {
  return enemyDefs;
}

/**
 * Initialize the raid timer on the game state if not already set.
 * Called once during game boot.
 */
export function initRaidTimer(state) {
  if (!state.raidTimer || state.raidTimer <= 0) {
    state.raidTimer = INITIAL_RAID_TIMER;
  }
  // Ensure meadHallHP exists
  if (state.meadHallHP == null) {
    state.meadHallHP = 100;
  }
}

/**
 * Tick the raid timer each game tick. When it reaches 0, trigger a raid.
 * Returns a raid result object if a raid occurred, or null otherwise.
 */
export function tickRaidTimer(state) {
  state.raidTimer--;

  if (state.raidTimer <= 0) {
    const enemies = generateRaid(state);
    const result = executeRaid(state, enemies);

    // Reset timer — scales shorter as the game progresses
    // Minimum 300 ticks (~5 min), decreases by 30 per 600 ticks of game time
    const reduction = Math.floor(state.tick / 600) * 30;
    state.raidTimer = Math.max(300, INITIAL_RAID_TIMER - reduction);

    return result;
  }

  return null;
}

/**
 * Get the realm difficulty multiplier.
 * Midgard: 1x, Jotunheim: 1.5x, Asgard: 2x
 */
function getRealmMultiplier(realm) {
  switch (realm) {
    case 'jotunheim': return 1.5;
    case 'asgard': return 2.0;
    default: return 1.0; // midgard
  }
}

/**
 * Generate a raid based on current game difficulty (scaled by state.tick and realm).
 * Returns an array of enemy combatant objects ready for resolveBattle.
 */
export function generateRaid(state) {
  const tick = state.tick || 0;
  const realmMult = getRealmMultiplier(state.realm);
  const enemies = [];

  if (tick < 600) {
    // Early game: 2-3 draugr
    const count = Math.round(randInt(2, 3) * realmMult);
    for (let i = 0; i < count; i++) {
      enemies.push(makeEnemyCombatant('draugr'));
    }
  } else if (tick < 1800) {
    // Mid game: 3-5 draugr + 1-2 trolls
    const draugrCount = Math.round(randInt(3, 5) * realmMult);
    const trollCount = Math.round(randInt(1, 2) * realmMult);
    for (let i = 0; i < draugrCount; i++) {
      enemies.push(makeEnemyCombatant('draugr'));
    }
    for (let i = 0; i < trollCount; i++) {
      enemies.push(makeEnemyCombatant('troll'));
    }
  } else {
    // Late game: 4-6 draugr + 2-3 trolls + 0-1 frost giant
    const draugrCount = Math.round(randInt(4, 6) * realmMult);
    const trollCount = Math.round(randInt(2, 3) * realmMult);
    const giantCount = Math.max(1, Math.round(randInt(0, 1) * realmMult));
    for (let i = 0; i < draugrCount; i++) {
      enemies.push(makeEnemyCombatant('draugr'));
    }
    for (let i = 0; i < trollCount; i++) {
      enemies.push(makeEnemyCombatant('troll'));
    }
    for (let i = 0; i < giantCount; i++) {
      enemies.push(makeEnemyCombatant('frostGiant'));
    }
  }

  return enemies;
}

/**
 * Generate the special Ragnarok raid: 6 draugr + 4 trolls + 3 frost giants.
 * This is the final challenge in the game.
 */
export function generateRagnarokRaid() {
  const enemies = [];
  for (let i = 0; i < 6; i++) enemies.push(makeEnemyCombatant('draugr'));
  for (let i = 0; i < 4; i++) enemies.push(makeEnemyCombatant('troll'));
  for (let i = 0; i < 3; i++) enemies.push(makeEnemyCombatant('frostGiant'));
  return enemies;
}

/**
 * Create a combatant object from an enemy definition.
 * Enemy combatants use the same shape as prepareCombatant output.
 */
function makeEnemyCombatant(enemyId) {
  const def = enemyDefs.find(d => d.id === enemyId);
  if (!def) {
    // Fallback draugr if def not found
    return {
      id: `enemy_${enemyId}_${Date.now()}_${Math.random()}`,
      name: enemyId,
      type: enemyId,
      health: 25,
      maxHealth: 25,
      attack: 5,
      defense: 2,
      canFight: true,
    };
  }

  return {
    id: `enemy_${def.id}_${Date.now()}_${Math.random()}`,
    name: def.name,
    type: def.id,
    health: def.stats.health,
    maxHealth: def.stats.health,
    attack: def.stats.attack,
    defense: def.stats.defense,
    canFight: true,
  };
}

/**
 * Execute a raid against the player's settlement.
 * Gathers defenders (idle units + units not assigned to rooms that canFight),
 * resolves the battle, and processes results.
 *
 * Returns a raid result object for display.
 */
export function executeRaid(state, enemies) {
  const unitDefs = getUnitDefs();

  // Gather defenders: units that are idle or not on expeditions
  // For v1: all units not on expedition are potential defenders
  const defenders = [];
  const allUnits = state.units || [];

  for (const unit of allUnits) {
    // Skip units on expeditions (future-proofing)
    if (unit.assignment === 'expedition') continue;

    const unitDef = unitDefs.find(d => d.id === unit.type);
    if (!unitDef || !unitDef.canFight) continue;

    const forgeBonuses = getUnitStatBonuses(state, unit.type);
    const combatant = prepareCombatant(unit, unitDef, forgeBonuses);
    if (combatant) {
      defenders.push(combatant);
    }
  }

  // Build enemy composition summary before battle
  const enemyComposition = summarizeEnemies(enemies);

  // Resolve the battle — enemies are attackers, our units are defenders
  const battleResult = resolveBattle(enemies, defenders);

  // Process results
  const raidResult = {
    tick: state.tick,
    enemyComposition,
    enemyCount: enemies.length,
    defenderCount: defenders.length,
    winner: battleResult.winner,
    defenderLosses: battleResult.defenderLosses,
    attackerLosses: battleResult.attackerLosses,
    attackerSurvivors: battleResult.attackerSurvivors,
    defenderSurvivors: battleResult.defenderSurvivors,
    meadHallDamage: 0,
    log: battleResult.log,
  };

  if (battleResult.winner === 'attackers') {
    // Enemies won — Mead Hall takes damage
    const remainingEnemies = battleResult.attackerSurvivors.length;
    const damage = 10 + 5 * remainingEnemies;
    state.meadHallHP = Math.max(0, (state.meadHallHP || 100) - damage);
    raidResult.meadHallDamage = damage;
  }

  // Remove dead defender units from state.units
  for (const loss of battleResult.defenderLosses) {
    const idx = state.units.findIndex(u => u.id === loss.id);
    if (idx !== -1) {
      // Also remove from room workers array if assigned
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

  // Valkyrie revive: if a defender was revived (in defenderSurvivors but was in losses),
  // check if any survivor's id was originally in our fallen list and restore the unit.
  // The combat system already moved the revived unit to survivors, so we check
  // if any survivor id matches a unit we just removed.
  for (const survivor of battleResult.defenderSurvivors) {
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
          position: { x: 30, y: 20 }, // default to center
        });
        raidResult.revivedUnit = survivor.name;
      }
    } else {
      // Update surviving unit's health after battle
      existsInState.health = survivor.health;
    }
  }

  // Store raid result in state for history
  if (!state.raids) state.raids = [];
  state.raids.push({
    tick: raidResult.tick,
    winner: raidResult.winner,
    enemyCount: raidResult.enemyCount,
    defenderCount: raidResult.defenderCount,
    losses: raidResult.defenderLosses.length,
    meadHallDamage: raidResult.meadHallDamage,
  });

  return raidResult;
}

/**
 * Summarize enemy composition into a readable string.
 * e.g. "3 Draugr, 1 Troll"
 */
function summarizeEnemies(enemies) {
  const counts = {};
  for (const enemy of enemies) {
    counts[enemy.name] = (counts[enemy.name] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => `${count} ${name}${count > 1 ? '' : ''}`)
    .join(', ');
}

/**
 * Format a raid result into a readable report for the UI.
 */
export function getRaidReport(result) {
  const lines = [];

  lines.push(`Raid Incoming: ${result.enemyComposition}`);
  lines.push(`Defenders: ${result.defenderCount} unit${result.defenderCount !== 1 ? 's' : ''}`);
  lines.push('');

  if (result.winner === 'defenders') {
    lines.push('Victory! The raiders have been repelled.');
  } else if (result.winner === 'attackers') {
    lines.push('Defeat! The raiders have breached the defenses.');
    lines.push(`Mead Hall took ${result.meadHallDamage} damage.`);
  } else {
    lines.push('Draw! Both sides fought to a standstill.');
  }

  if (result.defenderLosses.length > 0) {
    const fallen = result.defenderLosses.map(l => l.name).join(', ');
    lines.push(`Fallen: ${fallen}`);
  } else if (result.defenderCount > 0) {
    lines.push('No casualties among defenders.');
  }

  if (result.revivedUnit) {
    lines.push(`Valkyrie revived: ${result.revivedUnit}`);
  }

  return lines.join('\n');
}

/**
 * Random integer in [min, max] inclusive.
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
