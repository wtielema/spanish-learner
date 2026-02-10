// combat.js — Turn-based auto-combat resolution system
// Pure logic module: no imports of game state or other modules.
// Used by raids.js and expeditions.js.

const MAX_ROUNDS = 50;

/**
 * Prepare a game unit for combat by combining base stats with forge bonuses.
 * Filters out non-combatants (canFight === false).
 *
 * @param {Object} unit — A game unit instance (from state.units)
 *   Expected shape: { id, type, health, maxHealth, ... }
 * @param {Object} unitDef — The unit definition from units.json
 *   Expected shape: { id, name, stats: { health, attack, defense }, canFight }
 * @param {Object} forgeBonuses — { attack: N, defense: N } from forge.getUnitStatBonuses
 * @returns {Object|null} A combatant object, or null if the unit cannot fight
 */
export function prepareCombatant(unit, unitDef, forgeBonuses = { attack: 0, defense: 0 }) {
  if (!unitDef.canFight) return null;

  return {
    id: unit.id,
    name: unitDef.name,
    type: unitDef.id,
    health: unit.health ?? unitDef.stats.health,
    maxHealth: unit.maxHealth ?? unitDef.stats.health,
    attack: unitDef.stats.attack + (forgeBonuses.attack || 0),
    defense: unitDef.stats.defense + (forgeBonuses.defense || 0),
    canFight: true,
  };
}

/**
 * Calculate damage dealt by an attacker to a defender.
 * Damage = attacker.attack - defender.defense * 0.5, minimum 1.
 */
function calcDamage(attacker, defender) {
  return Math.max(1, attacker.attack - defender.defense * 0.5);
}

/**
 * Pick a random element from an array.
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Resolve a full battle between two sides.
 *
 * @param {Array} attackers — Array of combatant objects (from prepareCombatant)
 * @param {Array} defenders — Array of combatant objects
 * @returns {Object} Battle result:
 *   {
 *     winner: 'attackers' | 'defenders' | 'draw',
 *     attackerSurvivors: [...],
 *     defenderSurvivors: [...],
 *     attackerLosses: [...],
 *     defenderLosses: [...],
 *     log: [...]
 *   }
 */
export function resolveBattle(attackers, defenders) {
  // Deep-clone combatants so we don't mutate the originals
  let atkAlive = attackers.map(c => ({ ...c }));
  let defAlive = defenders.map(c => ({ ...c }));

  const atkFallen = [];
  const defFallen = [];
  const log = [];

  // Filter out non-fighters (safety check — prepareCombatant already handles this)
  atkAlive = atkAlive.filter(c => c.canFight !== false);
  defAlive = defAlive.filter(c => c.canFight !== false);

  // Edge case: one or both sides have no fighters
  if (atkAlive.length === 0 && defAlive.length === 0) {
    return buildResult('draw', [], [], [], [], ['Neither side has any fighters.']);
  }
  if (atkAlive.length === 0) {
    return buildResult('defenders', [], defAlive, [], [], ['Attackers have no fighters — defenders win by default.']);
  }
  if (defAlive.length === 0) {
    return buildResult('attackers', atkAlive, [], [], [], ['Defenders have no fighters — attackers win by default.']);
  }

  // Round-based combat
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const roundLog = [];
    roundLog.push(`--- Round ${round} ---`);

    // Gather all living combatants with their side tag for turn order
    const allFighters = [
      ...atkAlive.map(c => ({ combatant: c, side: 'attacker' })),
      ...defAlive.map(c => ({ combatant: c, side: 'defender' })),
    ];

    // Each combatant attacks a random enemy
    for (const { combatant, side } of allFighters) {
      // Skip if this combatant was killed earlier this round
      if (combatant.health <= 0) continue;

      const enemies = side === 'attacker' ? defAlive : atkAlive;
      const aliveEnemies = enemies.filter(e => e.health > 0);
      if (aliveEnemies.length === 0) continue;

      const target = pickRandom(aliveEnemies);
      const damage = calcDamage(combatant, target);
      target.health -= damage;

      roundLog.push(`${combatant.name} (${side}) hits ${target.name} for ${damage} damage${target.health <= 0 ? ' — ELIMINATED' : ` (${target.health}/${target.maxHealth} HP)`}`);
    }

    // Remove fallen from alive lists
    const newAtkFallen = atkAlive.filter(c => c.health <= 0);
    const newDefFallen = defAlive.filter(c => c.health <= 0);

    for (const fallen of newAtkFallen) atkFallen.push(fallen);
    for (const fallen of newDefFallen) defFallen.push(fallen);

    atkAlive = atkAlive.filter(c => c.health > 0);
    defAlive = defAlive.filter(c => c.health > 0);

    log.push(...roundLog);

    // Check if battle is over
    if (atkAlive.length === 0 || defAlive.length === 0) break;
  }

  // Determine winner
  let winner;
  if (atkAlive.length > 0 && defAlive.length === 0) {
    winner = 'attackers';
  } else if (defAlive.length > 0 && atkAlive.length === 0) {
    winner = 'defenders';
  } else {
    winner = 'draw';
  }

  // Valkyrie mechanic: winning side revives one fallen ally at 50% HP
  if (winner === 'attackers') {
    applyValkyrieRevive(atkAlive, atkFallen, log);
  } else if (winner === 'defenders') {
    applyValkyrieRevive(defAlive, defFallen, log);
  }

  return buildResult(winner, atkAlive, defAlive, atkFallen, defFallen, log);
}

/**
 * If the surviving side contains a valkyrie, revive one random fallen ally
 * with 50% of their max health.
 */
function applyValkyrieRevive(survivors, fallen, log) {
  const valkyrie = survivors.find(c => c.type === 'valkyrie');
  if (!valkyrie || fallen.length === 0) return;

  const revived = pickRandom(fallen);
  revived.health = Math.floor(revived.maxHealth * 0.5);

  // Move from fallen to survivors
  const idx = fallen.indexOf(revived);
  fallen.splice(idx, 1);
  survivors.push(revived);

  log.push(`${valkyrie.name} revives ${revived.name} with ${revived.health} HP!`);
}

/**
 * Build the standardized result object.
 */
function buildResult(winner, atkSurvivors, defSurvivors, atkFallen, defFallen, log) {
  return {
    winner,
    attackerSurvivors: atkSurvivors,
    defenderSurvivors: defSurvivors,
    attackerLosses: atkFallen.map(c => ({ id: c.id, name: c.name, type: c.type })),
    defenderLosses: defFallen.map(c => ({ id: c.id, name: c.name, type: c.type })),
    log,
  };
}
