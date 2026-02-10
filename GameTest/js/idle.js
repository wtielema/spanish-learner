// idle.js — Offline catch-up calculation
// Called on game load when time has elapsed since last save.

import { getRoomDefs } from './rooms.js';
import { generateRaid, executeRaid } from './raids.js';

// Maximum offline time: 24 hours in seconds
const MAX_OFFLINE_SECONDS = 86400;

// Raid timer constant — must match raids.js INITIAL_RAID_TIMER
const INITIAL_RAID_TIMER = 600;

/**
 * Calculate offline progress since last save.
 * Handles resource production, expedition completion, and raid accumulation.
 *
 * @param {Object} state — current game state (mutated in place)
 * @returns {Object} summary of what happened while away
 */
export function calculateOfflineProgress(state) {
  const now = Date.now();
  const rawElapsed = (now - state.lastSaved) / 1000;
  const elapsedSeconds = Math.min(rawElapsed, MAX_OFFLINE_SECONDS);

  const summary = {
    elapsedSeconds,
    resourcesGained: { wood: 0, iron: 0, runes: 0 },
    expeditionResults: [],
    raidResults: [],
    unitsLost: 0,
    meadHallDamage: 0,
  };

  // --- 1. Resource production ---
  calculateOfflineProduction(state, elapsedSeconds, summary);

  // --- 2. Expedition completion ---
  resolveOfflineExpeditions(state, summary);

  // --- 3. Raid accumulation ---
  resolveOfflineRaids(state, elapsedSeconds, summary);

  return summary;
}

/**
 * Calculate resource production for all rooms with workers.
 * Uses the same formula as tickProduction but multiplied by elapsed seconds.
 */
function calculateOfflineProduction(state, elapsedSeconds, summary) {
  const roomDefs = getRoomDefs();

  for (const room of state.rooms) {
    const def = roomDefs.find(d => d.id === room.type);
    if (!def || !def.production) continue;

    const workerCount = room.workers ? room.workers.length : 0;
    if (workerCount === 0) continue;

    const { resource, baseRate, perWorker } = def.production;
    const levelMultiplier = room.level || 1;
    const ratePerSecond = (baseRate + workerCount * perWorker) * levelMultiplier;
    const produced = ratePerSecond * elapsedSeconds;

    const cap = state.storage[resource] || Infinity;
    const before = state.resources[resource] || 0;
    state.resources[resource] = Math.min(before + produced, cap);
    const actualGain = state.resources[resource] - before;

    summary.resourcesGained[resource] = (summary.resourcesGained[resource] || 0) + actualGain;
  }
}

/**
 * Detect expeditions that completed while offline.
 * We identify them for the summary report, but let the first
 * tickExpeditions() call in the game loop actually resolve them
 * (combat, rewards, unit state changes). This avoids duplicating
 * the complex combat/reward logic from expeditions.js.
 */
function resolveOfflineExpeditions(state, summary) {
  if (!state.expeditions || state.expeditions.length === 0) return;

  const now = Date.now();

  for (const exp of state.expeditions) {
    const elapsed = now - exp.startTime;
    if (elapsed >= exp.duration * 1000) {
      summary.expeditionResults.push({
        expeditionId: exp.expeditionId,
        completed: true,
      });
    }
  }
}

/**
 * Calculate how many raids would have occurred during offline time
 * and execute them sequentially.
 */
function resolveOfflineRaids(state, elapsedSeconds, summary) {
  // The raid timer decreases by 1 each tick (1 second).
  // When it hits 0, a raid triggers and the timer resets.
  // We need to figure out how many raids fire in elapsedSeconds.

  let remainingTime = elapsedSeconds;
  let raidCount = 0;

  // Current timer value
  let currentTimer = state.raidTimer || INITIAL_RAID_TIMER;

  // Calculate how many raids would have fired
  while (remainingTime > 0) {
    if (remainingTime >= currentTimer) {
      // A raid fires
      remainingTime -= currentTimer;
      raidCount++;

      // Reset timer (same logic as tickRaidTimer)
      // The tick would have advanced by the time consumed
      const futureTick = state.tick + Math.floor(elapsedSeconds - remainingTime);
      const reduction = Math.floor(futureTick / 600) * 30;
      currentTimer = Math.max(300, INITIAL_RAID_TIMER - reduction);
    } else {
      // Time runs out before next raid
      currentTimer -= remainingTime;
      remainingTime = 0;
    }
  }

  // Update the raid timer with remaining time
  state.raidTimer = Math.max(1, Math.round(currentTimer));

  // Cap offline raids to prevent excessive computation (max 10 raids)
  raidCount = Math.min(raidCount, 10);

  // Execute raids sequentially
  for (let i = 0; i < raidCount; i++) {
    // Advance tick estimate for difficulty scaling
    const enemies = generateRaid(state);
    const result = executeRaid(state, enemies);

    const raidSummary = {
      winner: result.winner,
      enemyComposition: result.enemyComposition,
      defenderLosses: result.defenderLosses.length,
      meadHallDamage: result.meadHallDamage,
    };

    summary.raidResults.push(raidSummary);
    summary.unitsLost += result.defenderLosses.length;
    summary.meadHallDamage += result.meadHallDamage;
  }

  // Advance the tick counter by elapsed seconds
  state.tick += Math.floor(elapsedSeconds);
}

/**
 * Format elapsed seconds into a human-readable string.
 * e.g. "2 hours, 15 minutes" or "45 minutes" or "30 seconds"
 */
export function formatElapsedTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}
