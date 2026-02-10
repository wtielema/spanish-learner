// ui.js — Resource HUD and overlay management

let hudEl = null;
let resWood = null;
let resIron = null;
let resRunes = null;
let unitCount = null;
let meadHallHPEl = null;
let realmEl = null;
let warningEl = null;
let warningTimer = 0;

const REALM_DISPLAY_NAMES = {
  midgard: 'Midgard',
  jotunheim: 'Jotunheim',
  asgard: 'Asgard',
};

/**
 * Creates the HUD HTML elements inside the ui-overlay container.
 * @param {HTMLElement} container — the #ui-overlay div
 */
export function createHUD(container) {
  const bar = document.createElement('div');
  bar.id = 'resource-bar';

  bar.innerHTML = `
    <div class="res-group">
      <span class="res-item" id="res-wood">Wood: 0/200</span>
      <span class="res-item" id="res-iron">Iron: 0/200</span>
      <span class="res-item" id="res-runes">Runes: 0/100</span>
    </div>
    <div class="res-group">
      <span class="res-item" id="realm-label">Realm: Midgard</span>
      <span class="res-item" id="mead-hall-hp">Mead Hall: 100 HP</span>
      <span class="res-item" id="unit-count">Units: 0/6</span>
    </div>
  `;

  container.appendChild(bar);
  hudEl = bar;

  // Cache element references for fast updates
  resWood = document.getElementById('res-wood');
  resIron = document.getElementById('res-iron');
  resRunes = document.getElementById('res-runes');
  unitCount = document.getElementById('unit-count');
  meadHallHPEl = document.getElementById('mead-hall-hp');
  realmEl = document.getElementById('realm-label');

  // Warning message element (e.g., "Not enough wood!")
  const warning = document.createElement('div');
  warning.id = 'hud-warning';
  container.appendChild(warning);
  warningEl = warning;
}

/**
 * Updates the HUD display from the current game state.
 * @param {object} state — the gameState object
 */
export function updateHUD(state) {
  if (!hudEl) return;

  const r = state.resources;
  const s = state.storage;

  resWood.textContent = `Wood: ${r.wood}/${s.wood}`;
  resIron.textContent = `Iron: ${r.iron}/${s.iron}`;
  resRunes.textContent = `Runes: ${r.runes}/${s.runes}`;

  // Mead Hall HP
  const hp = state.meadHallHP != null ? state.meadHallHP : 100;
  meadHallHPEl.textContent = `Mead Hall: ${hp} HP`;
  // Color-code based on HP level
  if (hp > 60) {
    meadHallHPEl.style.color = '#7ec87e';
  } else if (hp > 30) {
    meadHallHPEl.style.color = '#e0a040';
  } else {
    meadHallHPEl.style.color = '#e04040';
  }

  // Realm display
  const realmName = REALM_DISPLAY_NAMES[state.realm] || state.realm;
  realmEl.textContent = `Realm: ${realmName}`;

  // Unit count: current units vs max capacity (default max 6)
  const currentUnits = state.units ? state.units.length : 0;
  const maxUnits = state.maxUnits || 6;
  unitCount.textContent = `Units: ${currentUnits}/${maxUnits}`;
}

/**
 * Shows a brief warning message on the HUD (e.g., "Not enough wood!").
 * @param {string} msg — warning text
 * @param {number} duration — display time in ms (default 1500)
 */
export function showWarning(msg, duration = 1500) {
  if (!warningEl) return;
  warningEl.textContent = msg;
  warningEl.classList.add('visible');
  clearTimeout(warningTimer);
  warningTimer = setTimeout(() => {
    warningEl.classList.remove('visible');
  }, duration);
}
