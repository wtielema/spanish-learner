import { gameState, setState, createInitialState } from './state.js';
import { camera, setupCameraControls, centerCamera, screenToWorld } from './camera.js';
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, isRock, digTile } from './grid.js';
import { renderGrid, renderHoverTile, renderRoomLabels, renderRoomPreview, renderUnits } from './renderer.js';
import { loadRoomDefs, getRoomDefs, canPlaceRoom, canAfford, placeRoom, placeRoomFree, syncRoomIds, tickProduction } from './rooms.js';
import { loadUnitDefs, getUnitDefs, getUnitCapacity, recruitUnit, getRecruitsForRoom, syncUnitIds, assignUnitToRoom, unassignUnit, getUnitAtTile } from './units.js';
import { createHUD, updateHUD, showWarning } from './ui.js';
import { loadUpgradeDefs, getUpgradeDefs, getAvailableUpgrades, purchaseUpgrade, isUpgradePurchased } from './forge.js';
import { loadEnemyDefs, initRaidTimer, tickRaidTimer, getRaidReport, executeRaid, generateRagnarokRaid } from './raids.js';
import { loadExpeditionDefs, getExpeditionDefs, getAvailableExpeditions, getLockedExpeditions, startExpedition, tickExpeditions, getExpeditionTimeRemaining, formatDuration } from './expeditions.js';
import { calculateOfflineProgress, formatElapsedTime } from './idle.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('ui-overlay');

// Mouse / hover tracking
const mouse = { x: -1, y: -1, tileX: -1, tileY: -1, onCanvas: false, leftDown: false };

// Dig flash feedback (brief flash on the dug tile)
const digFlashes = []; // { x, y, timer }

// Build mode state
let buildMode = null; // null = not building, otherwise { defId, def } for the room being placed

// Selected unit for assignment
let selectedUnitId = null;

// End-game state
let gameOver = false;
let gameWon = false;
let ragnarokPending = false; // set to true when Storm Asgard expedition succeeds

// Attempt to dig at the given tile coordinates; returns true if successful
function tryDig(tx, ty) {
  if (buildMode) return false; // no digging in build mode
  if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) return false;
  if (gameState.resources.wood < 1) return false;
  if (digTile(gameState.grid, tx, ty)) {
    gameState.resources.wood -= 1;
    digFlashes.push({ x: tx, y: ty, timer: 0.25 }); // 250ms flash
    return true;
  }
  return false;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game tick (1s interval) -- resource production, combat, timers
function gameTick() {
  // Stop ticking if game is over or won
  if (gameOver || gameWon) return;

  gameState.tick++;
  tickProduction(gameState);

  // Raid system: tick the timer; if a raid triggers, show the report
  const raidResult = tickRaidTimer(gameState);
  if (raidResult) {
    showRaidReport(raidResult);
  }

  // Expedition system: tick active expeditions; show results
  const expResults = tickExpeditions(gameState);
  for (const expResult of expResults) {
    // Check for realm unlock notification
    if (expResult.realmUnlocked) {
      showRealmUnlockNotification(expResult.realmUnlocked);
    }

    // Check for Ragnarok trigger
    if (expResult.ragnarokTriggered && expResult.isVictory) {
      ragnarokPending = true;
    }

    showExpeditionReport(expResult);
  }

  // Handle Ragnarok: trigger the final raid
  if (ragnarokPending) {
    ragnarokPending = false;
    triggerRagnarokRaid();
  }

  // Check for game over: Mead Hall destroyed
  if (gameState.meadHallHP <= 0) {
    showGameOverScreen();
    return;
  }

  // Refresh expedition panel if open (to update countdowns)
  if (expeditionPanelOpen) {
    refreshExpeditionPanel();
  }
}

// --- Build Panel ---

function createBuildPanel() {
  // Remove existing panel if any
  const existing = document.getElementById('build-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'build-panel';
  panel.innerHTML = '<h3>Build</h3>';

  const defs = getRoomDefs();
  for (const def of defs) {
    const btn = document.createElement('button');
    btn.className = 'build-btn';
    btn.dataset.roomId = def.id;

    const costParts = Object.entries(def.cost)
      .map(([res, amt]) => `<span>${res}: ${amt}</span>`)
      .join('');

    btn.innerHTML = `
      <span class="room-name">${def.name}</span>
      <span class="room-cost">${costParts}</span>
      <span class="room-size">${def.size[0]}x${def.size[1]}</span>
    `;

    btn.addEventListener('click', () => {
      enterBuildMode(def.id);
    });

    panel.appendChild(btn);
  }

  overlay.appendChild(panel);

  // Build mode indicator
  const indicator = document.createElement('div');
  indicator.id = 'build-mode-indicator';
  indicator.textContent = 'Build Mode -- Click to place, ESC / Right-click to cancel';
  overlay.appendChild(indicator);
}

function updateBuildPanel() {
  const defs = getRoomDefs();
  const btns = document.querySelectorAll('.build-btn');
  for (const btn of btns) {
    const def = defs.find(d => d.id === btn.dataset.roomId);
    if (!def) continue;
    const affordable = canAfford(gameState.resources, def.cost);
    btn.disabled = !affordable;
    btn.classList.toggle('active', buildMode && buildMode.defId === def.id);
  }
}

function enterBuildMode(defId) {
  const defs = getRoomDefs();
  const def = defs.find(d => d.id === defId);
  if (!def) return;
  if (!canAfford(gameState.resources, def.cost)) return;

  buildMode = { defId, def };
  const indicator = document.getElementById('build-mode-indicator');
  if (indicator) indicator.classList.add('visible');
  updateBuildPanel();
}

function exitBuildMode() {
  buildMode = null;
  const indicator = document.getElementById('build-mode-indicator');
  if (indicator) indicator.classList.remove('visible');
  updateBuildPanel();
}

function tryPlaceRoom(tx, ty) {
  if (!buildMode) return false;
  const { defId, def } = buildMode;
  const [w, h] = def.size;

  // Center the room on the mouse tile
  const rx = tx - Math.floor(w / 2);
  const ry = ty - Math.floor(h / 2);

  const room = placeRoom(gameState, defId, rx, ry);
  if (room) {
    exitBuildMode();
    updateBuildPanel();
    return true;
  }
  return false;
}

// --- Recruit Panel ---

let recruitPanelRoom = null; // the room instance currently showing a recruit panel, or null

function getRoomAtTile(tx, ty) {
  if (tx < 0 || tx >= GRID_WIDTH || ty < 0 || ty >= GRID_HEIGHT) return null;
  const tile = gameState.grid[ty][tx];
  if (!tile.roomId) return null;
  return gameState.rooms.find(r => r.id === tile.roomId) || null;
}

function openRecruitPanel(room) {
  closeRecruitPanel();
  recruitPanelRoom = room;

  const recruits = getRecruitsForRoom(gameState, room);
  if (recruits.length === 0) return; // nothing to recruit from this room

  const panel = document.createElement('div');
  panel.id = 'recruit-panel';

  const roomDefs = getRoomDefs();
  const roomDef = roomDefs.find(d => d.id === room.type);
  const roomName = roomDef ? roomDef.name : room.type;
  panel.innerHTML = `<h3>Recruit — ${roomName}</h3>`;

  const cap = getUnitCapacity(gameState);
  const count = gameState.units ? gameState.units.length : 0;
  const capLine = document.createElement('div');
  capLine.className = 'recruit-cap';
  capLine.textContent = `Units: ${count}/${cap}`;
  panel.appendChild(capLine);

  for (const unitDef of recruits) {
    const btn = document.createElement('button');
    btn.className = 'recruit-btn';
    btn.dataset.unitId = unitDef.id;

    const costParts = Object.entries(unitDef.cost);
    const costStr = costParts.length > 0
      ? costParts.map(([res, amt]) => `<span>${res}: ${amt}</span>`).join('')
      : '<span>Free</span>';

    btn.innerHTML = `
      <span class="unit-name">${unitDef.name}</span>
      <span class="unit-role">${unitDef.role}</span>
      <span class="unit-cost">${costStr}</span>
    `;

    const affordable = canAfford(gameState.resources, unitDef.cost) && count < cap;
    btn.disabled = !affordable;

    btn.addEventListener('click', () => {
      const unit = recruitUnit(gameState, unitDef.id);
      if (unit) {
        // Refresh the panel to update costs and cap
        openRecruitPanel(room);
      } else {
        showWarning('Cannot recruit!');
      }
    });

    panel.appendChild(btn);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'recruit-close-btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => closeRecruitPanel());
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
}

function closeRecruitPanel() {
  recruitPanelRoom = null;
  const existing = document.getElementById('recruit-panel');
  if (existing) existing.remove();
}

// --- Forge Panel ---

let forgePanelRoom = null; // the forge room instance currently showing the panel, or null

function openForgePanel(room) {
  closeForgePanel();
  forgePanelRoom = room;

  const allUpgrades = getUpgradeDefs();
  if (allUpgrades.length === 0) return;

  const forgeLevel = room.level || 1;

  const panel = document.createElement('div');
  panel.id = 'forge-panel';

  panel.innerHTML = `<h3>Forge (Level ${forgeLevel})</h3>`;

  for (const def of allUpgrades) {
    const purchased = isUpgradePurchased(gameState, def.id);
    const locked = def.requiredForgeLevel > forgeLevel;
    const affordable = !locked && !purchased && canAfford(gameState.resources, def.cost);

    const item = document.createElement('div');
    item.className = 'forge-item';
    if (purchased) item.classList.add('purchased');
    if (locked) item.classList.add('locked');

    const costParts = Object.entries(def.cost)
      .map(([res, amt]) => `<span>${res}: ${amt}</span>`)
      .join('');

    let badge = '';
    if (purchased) {
      badge = '<span class="forge-badge purchased-badge">Purchased</span>';
    } else if (locked) {
      badge = `<span class="forge-badge locked-badge">Locked (Forge Lv.${def.requiredForgeLevel})</span>`;
    }

    item.innerHTML = `
      <div class="forge-item-header">
        <span class="forge-item-name">${def.name}</span>
        ${badge}
      </div>
      <div class="forge-item-desc">${def.description}</div>
      <div class="forge-item-cost">${costParts}</div>
    `;

    if (!purchased && !locked) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'forge-buy-btn';
      buyBtn.textContent = 'Buy';
      buyBtn.disabled = !affordable;

      buyBtn.addEventListener('click', () => {
        const success = purchaseUpgrade(gameState, def.id);
        if (success) {
          openForgePanel(room); // refresh panel
        } else {
          showWarning('Cannot purchase!');
        }
      });

      item.appendChild(buyBtn);
    }

    panel.appendChild(item);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'forge-close-btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => closeForgePanel());
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
}

function closeForgePanel() {
  forgePanelRoom = null;
  const existing = document.getElementById('forge-panel');
  if (existing) existing.remove();
}

// --- Raid Report Panel ---

function showRaidReport(raidResult) {
  // Remove any existing raid report
  closeRaidReport();

  const report = getRaidReport(raidResult);

  const panel = document.createElement('div');
  panel.id = 'raid-report';

  // Header with outcome styling
  const isVictory = raidResult.winner === 'defenders';
  const isDraw = raidResult.winner === 'draw';
  const headerClass = isVictory ? 'raid-victory' : isDraw ? 'raid-draw' : 'raid-defeat';

  const headerText = isVictory ? 'Raid Repelled!' : isDraw ? 'Raid Stalemate' : 'Raid Breach!';

  panel.innerHTML = `
    <div class="raid-header ${headerClass}">
      <h3>${headerText}</h3>
    </div>
    <div class="raid-body">
      <div class="raid-enemies">
        <strong>Enemy Force:</strong> ${raidResult.enemyComposition}
      </div>
      <div class="raid-defenders">
        <strong>Defenders:</strong> ${raidResult.defenderCount} unit${raidResult.defenderCount !== 1 ? 's' : ''}
      </div>
      ${raidResult.defenderLosses.length > 0
        ? `<div class="raid-casualties"><strong>Casualties:</strong> ${raidResult.defenderLosses.map(l => l.name).join(', ')}</div>`
        : raidResult.defenderCount > 0
          ? '<div class="raid-no-casualties">No casualties!</div>'
          : '<div class="raid-no-defenders">No defenders available!</div>'
      }
      ${raidResult.revivedUnit
        ? `<div class="raid-revived"><strong>Valkyrie revived:</strong> ${raidResult.revivedUnit}</div>`
        : ''
      }
      ${raidResult.meadHallDamage > 0
        ? `<div class="raid-damage"><strong>Mead Hall damage:</strong> ${raidResult.meadHallDamage} (HP: ${gameState.meadHallHP}/100)</div>`
        : ''
      }
    </div>
  `;

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'raid-dismiss-btn';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', () => closeRaidReport());
  panel.appendChild(dismissBtn);

  overlay.appendChild(panel);

  // Auto-dismiss after 15 seconds
  panel._dismissTimer = setTimeout(() => closeRaidReport(), 15000);
}

function closeRaidReport() {
  const existing = document.getElementById('raid-report');
  if (existing) {
    if (existing._dismissTimer) clearTimeout(existing._dismissTimer);
    existing.remove();
  }
}

// --- Expedition Button ---

function createExpeditionButton() {
  const btn = document.createElement('button');
  btn.id = 'expedition-btn';
  btn.textContent = 'Expeditions';
  btn.addEventListener('click', () => {
    if (expeditionPanelOpen) {
      closeExpeditionPanel();
    } else {
      // Close other panels first
      closeRecruitPanel();
      closeForgePanel();
      openExpeditionPanel();
    }
  });
  overlay.appendChild(btn);
}

// --- Expedition Panel ---

let expeditionPanelOpen = false;
let selectedExpeditionUnits = []; // unit IDs selected for an expedition

function openExpeditionPanel() {
  closeExpeditionPanel();
  expeditionPanelOpen = true;
  refreshExpeditionPanel();
}

function refreshExpeditionPanel() {
  // Remove existing panel content (but keep the panel open)
  const existing = document.getElementById('expedition-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'expedition-panel';

  panel.innerHTML = `<h3>Expeditions</h3>`;

  const unitDefs = getUnitDefs();

  // --- Active Expeditions ---
  const activeExps = gameState.expeditions || [];
  if (activeExps.length > 0) {
    const activeSection = document.createElement('div');
    activeSection.className = 'exp-section';
    activeSection.innerHTML = '<div class="exp-section-title">Active</div>';

    for (const exp of activeExps) {
      const def = getExpeditionDefs().find(d => d.id === exp.expeditionId);
      if (!def) continue;

      const remaining = getExpeditionTimeRemaining(exp);
      const card = document.createElement('div');
      card.className = 'exp-card exp-active';

      const unitNames = exp.unitIds.map(uid => {
        const unit = gameState.units.find(u => u.id === uid);
        if (!unit) return '?';
        const uDef = unitDefs.find(d => d.id === unit.type);
        return uDef ? uDef.name : unit.type;
      }).join(', ');

      card.innerHTML = `
        <div class="exp-card-name">${def.name}</div>
        <div class="exp-card-timer">Time left: ${formatDuration(remaining)}</div>
        <div class="exp-card-units">Units: ${unitNames}</div>
      `;
      activeSection.appendChild(card);
    }

    panel.appendChild(activeSection);
  }

  // --- Available Expeditions ---
  const available = getAvailableExpeditions(gameState);
  if (available.length > 0) {
    const availSection = document.createElement('div');
    availSection.className = 'exp-section';
    availSection.innerHTML = '<div class="exp-section-title">Available</div>';

    for (const def of available) {
      // Check if this expedition is already active
      const alreadyActive = activeExps.some(e => e.expeditionId === def.id);

      const card = document.createElement('div');
      card.className = 'exp-card';
      if (alreadyActive) card.classList.add('exp-in-progress');

      const rewardsStr = Object.entries(def.rewards)
        .map(([res, amt]) => `${res}: ${amt}`)
        .join(', ');

      const difficultyClass = `exp-diff-${def.difficulty}`;

      card.innerHTML = `
        <div class="exp-card-header">
          <span class="exp-card-name">${def.name}</span>
          <span class="exp-card-difficulty ${difficultyClass}">${def.difficulty}</span>
        </div>
        <div class="exp-card-desc">${def.description}</div>
        <div class="exp-card-info">
          <span>Duration: ${formatDuration(def.duration)}</span>
          <span>Units: ${def.minUnits}-${def.maxUnits}</span>
        </div>
        <div class="exp-card-rewards">Rewards: ${rewardsStr}</div>
      `;

      if (!alreadyActive) {
        const sendBtn = document.createElement('button');
        sendBtn.className = 'exp-send-btn';
        sendBtn.textContent = 'Select Units';
        sendBtn.addEventListener('click', () => {
          openExpeditionUnitSelect(def);
        });
        card.appendChild(sendBtn);
      } else {
        const inProgLabel = document.createElement('div');
        inProgLabel.className = 'exp-in-progress-label';
        inProgLabel.textContent = 'In Progress';
        card.appendChild(inProgLabel);
      }

      availSection.appendChild(card);
    }

    panel.appendChild(availSection);
  }

  // --- Locked Expeditions ---
  const locked = getLockedExpeditions(gameState);
  if (locked.length > 0) {
    const lockedSection = document.createElement('div');
    lockedSection.className = 'exp-section';
    lockedSection.innerHTML = '<div class="exp-section-title">Locked</div>';

    for (const def of locked) {
      const card = document.createElement('div');
      card.className = 'exp-card exp-locked';

      card.innerHTML = `
        <div class="exp-card-header">
          <span class="exp-card-name">${def.name}</span>
          <span class="exp-card-difficulty exp-diff-${def.difficulty}">${def.difficulty}</span>
        </div>
        <div class="exp-card-desc">${def.description}</div>
        <div class="exp-card-locked-msg">Requires: ${def.realmRequired}</div>
      `;

      lockedSection.appendChild(card);
    }

    panel.appendChild(lockedSection);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'exp-close-btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => closeExpeditionPanel());
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
}

function openExpeditionUnitSelect(expeditionDef) {
  // Remove existing unit select panel
  const existing = document.getElementById('exp-unit-select');
  if (existing) existing.remove();

  selectedExpeditionUnits = [];

  const unitDefs = getUnitDefs();

  const panel = document.createElement('div');
  panel.id = 'exp-unit-select';

  panel.innerHTML = `
    <h3>Select Units for ${expeditionDef.name}</h3>
    <div class="exp-select-info">Select ${expeditionDef.minUnits}-${expeditionDef.maxUnits} units</div>
  `;

  // Get idle units that can go on expeditions (fighters + seers)
  const eligibleUnits = (gameState.units || []).filter(u => {
    if (u.assignment === 'expedition' || u.assignment === 'working') return false;
    const uDef = unitDefs.find(d => d.id === u.type);
    if (!uDef) return false;
    return uDef.canFight || uDef.id === 'seer';
  });

  if (eligibleUnits.length === 0) {
    const noUnits = document.createElement('div');
    noUnits.className = 'exp-no-units';
    noUnits.textContent = 'No available units. Recruit fighters or unassign working units.';
    panel.appendChild(noUnits);
  } else {
    const unitList = document.createElement('div');
    unitList.className = 'exp-unit-list';

    for (const unit of eligibleUnits) {
      const uDef = unitDefs.find(d => d.id === unit.type);
      const unitBtn = document.createElement('button');
      unitBtn.className = 'exp-unit-btn';
      unitBtn.dataset.unitId = unit.id;

      const healthPct = Math.round((unit.health / unit.maxHealth) * 100);
      unitBtn.innerHTML = `
        <span class="exp-unit-name">${uDef.name} #${unit.id}</span>
        <span class="exp-unit-stats">HP: ${unit.health}/${unit.maxHealth} (${healthPct}%)</span>
        <span class="exp-unit-role">${uDef.canFight ? 'Fighter' : 'Seer (+30% rewards)'}</span>
      `;

      unitBtn.addEventListener('click', () => {
        const idx = selectedExpeditionUnits.indexOf(unit.id);
        if (idx === -1) {
          if (selectedExpeditionUnits.length < expeditionDef.maxUnits) {
            selectedExpeditionUnits.push(unit.id);
            unitBtn.classList.add('selected');
          }
        } else {
          selectedExpeditionUnits.splice(idx, 1);
          unitBtn.classList.remove('selected');
        }
        // Update send button state
        updateSendButtonState(expeditionDef);
      });

      unitList.appendChild(unitBtn);
    }

    panel.appendChild(unitList);
  }

  // Send button
  const sendBtn = document.createElement('button');
  sendBtn.className = 'exp-confirm-btn';
  sendBtn.id = 'exp-confirm-send';
  sendBtn.textContent = 'Send Expedition';
  sendBtn.disabled = true;

  sendBtn.addEventListener('click', () => {
    const result = startExpedition(gameState, expeditionDef.id, selectedExpeditionUnits);
    if (result.success) {
      closeExpeditionUnitSelect();
      refreshExpeditionPanel();
    } else {
      showWarning(result.error || 'Cannot start expedition');
    }
  });
  panel.appendChild(sendBtn);

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'exp-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => closeExpeditionUnitSelect());
  panel.appendChild(cancelBtn);

  overlay.appendChild(panel);
}

function updateSendButtonState(expeditionDef) {
  const sendBtn = document.getElementById('exp-confirm-send');
  if (!sendBtn) return;

  const count = selectedExpeditionUnits.length;
  sendBtn.disabled = count < expeditionDef.minUnits || count > expeditionDef.maxUnits;
  sendBtn.textContent = count > 0
    ? `Send Expedition (${count} unit${count !== 1 ? 's' : ''})`
    : 'Send Expedition';
}

function closeExpeditionUnitSelect() {
  selectedExpeditionUnits = [];
  const existing = document.getElementById('exp-unit-select');
  if (existing) existing.remove();
}

function closeExpeditionPanel() {
  expeditionPanelOpen = false;
  selectedExpeditionUnits = [];
  const panel = document.getElementById('expedition-panel');
  if (panel) panel.remove();
  const unitSelect = document.getElementById('exp-unit-select');
  if (unitSelect) unitSelect.remove();
}

// --- Expedition Report Panel ---

function showExpeditionReport(expResult) {
  // Remove any existing expedition report
  closeExpeditionReport();

  const panel = document.createElement('div');
  panel.id = 'expedition-report';

  const isVictory = expResult.isVictory;
  const isDraw = expResult.winner === 'draw';
  const headerClass = isVictory ? 'exp-report-victory' : isDraw ? 'exp-report-draw' : 'exp-report-defeat';
  const headerText = isVictory ? 'Expedition Victorious!' : isDraw ? 'Expedition Stalemate' : 'Expedition Failed!';

  let rewardsHtml = '';
  if (expResult.rewards) {
    const rewardsStr = Object.entries(expResult.rewards)
      .map(([res, amt]) => `${res}: +${amt}`)
      .join(', ');
    rewardsHtml = `<div class="exp-report-rewards"><strong>Rewards:</strong> ${rewardsStr}${expResult.hasSeerBonus ? ' (Seer +30%)' : ''}</div>`;
  }

  let realmHtml = '';
  if (expResult.realmUnlocked) {
    realmHtml = `<div class="exp-report-realm"><strong>Realm Unlocked:</strong> ${expResult.realmUnlocked}!</div>`;
  }

  let ragnarokHtml = '';
  if (expResult.ragnarokTriggered) {
    ragnarokHtml = `<div class="exp-report-ragnarok"><strong>RAGNAROK HAS BEGUN!</strong></div>`;
  }

  panel.innerHTML = `
    <div class="exp-report-header ${headerClass}">
      <h3>${headerText}</h3>
      <div class="exp-report-name">${expResult.expeditionName}</div>
    </div>
    <div class="exp-report-body">
      <div class="exp-report-enemies">
        <strong>Enemies:</strong> ${expResult.enemyComposition}
      </div>
      <div class="exp-report-sent">
        <strong>Units sent:</strong> ${expResult.unitsSent}
      </div>
      ${expResult.attackerLosses.length > 0
        ? `<div class="exp-report-casualties"><strong>Fallen:</strong> ${expResult.attackerLosses.map(l => l.name).join(', ')}</div>`
        : '<div class="exp-report-no-casualties">No casualties!</div>'
      }
      ${expResult.revivedUnit
        ? `<div class="exp-report-revived"><strong>Valkyrie revived:</strong> ${expResult.revivedUnit}</div>`
        : ''
      }
      ${rewardsHtml}
      ${realmHtml}
      ${ragnarokHtml}
    </div>
  `;

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'exp-report-dismiss-btn';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', () => closeExpeditionReport());
  panel.appendChild(dismissBtn);

  overlay.appendChild(panel);

  // Auto-dismiss after 15 seconds
  panel._dismissTimer = setTimeout(() => closeExpeditionReport(), 15000);
}

function closeExpeditionReport() {
  const existing = document.getElementById('expedition-report');
  if (existing) {
    if (existing._dismissTimer) clearTimeout(existing._dismissTimer);
    existing.remove();
  }
}

// --- Realm Unlock Notification ---

function showRealmUnlockNotification(realm) {
  const existing = document.getElementById('realm-notification');
  if (existing) existing.remove();

  const realmNames = { jotunheim: 'Jotunheim', asgard: 'Asgard' };
  const realmFlavor = {
    jotunheim: 'The realm of giants trembles before your might. Raids grow fiercer as the giants take notice.',
    asgard: 'The golden halls shimmer in the distance. The gods watch your approach with interest.',
  };

  const displayName = realmNames[realm] || realm;
  const flavor = realmFlavor[realm] || 'A new realm awaits.';

  const panel = document.createElement('div');
  panel.id = 'realm-notification';

  panel.innerHTML = `
    <div class="realm-notif-header">
      <h3>${displayName} Unlocked!</h3>
    </div>
    <div class="realm-notif-body">
      <p>${flavor}</p>
    </div>
  `;

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'realm-notif-dismiss-btn';
  dismissBtn.textContent = 'Onward!';
  dismissBtn.addEventListener('click', () => {
    const el = document.getElementById('realm-notification');
    if (el) el.remove();
  });
  panel.appendChild(dismissBtn);

  overlay.appendChild(panel);

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    const el = document.getElementById('realm-notification');
    if (el) el.remove();
  }, 10000);
}

// --- Ragnarok Final Raid ---

function triggerRagnarokRaid() {
  const enemies = generateRagnarokRaid();
  const raidResult = executeRaid(gameState, enemies);

  // Mark this as the Ragnarok raid for display purposes
  raidResult.isRagnarok = true;

  // Check if player survived
  if (raidResult.winner === 'defenders' || raidResult.winner === 'draw') {
    // Victory! Player survived Ragnarok
    showRaidReport(raidResult);
    // Delay victory screen briefly so the raid report shows first
    setTimeout(() => {
      showVictoryScreen();
    }, 2000);
  } else {
    // Ragnarok failed — Mead Hall is destroyed regardless of remaining HP
    gameState.meadHallHP = 0;
    showRaidReport(raidResult);
    setTimeout(() => {
      showGameOverScreen();
    }, 2000);
  }
}

// --- Game Over Screen ---

function showGameOverScreen() {
  if (gameOver) return;
  gameOver = true;

  const existing = document.getElementById('game-over-screen');
  if (existing) existing.remove();

  // Gather stats
  const ticksSurvived = gameState.tick;
  const roomsBuilt = gameState.rooms ? gameState.rooms.length : 0;
  const totalRaids = gameState.raids ? gameState.raids.length : 0;
  const raidsSurvived = gameState.raids
    ? gameState.raids.filter(r => r.winner === 'defenders' || r.winner === 'draw').length
    : 0;
  const unitsRecruited = gameState.units ? gameState.units.length : 0;

  const minutes = Math.floor(ticksSurvived / 60);
  const seconds = ticksSurvived % 60;
  const timeStr = `${minutes}m ${seconds}s`;

  const panel = document.createElement('div');
  panel.id = 'game-over-screen';

  panel.innerHTML = `
    <div class="endgame-bg"></div>
    <div class="endgame-content">
      <h2 class="game-over-title">Your Mead Hall Has Fallen</h2>
      <p class="game-over-flavor">The gods weep as your stronghold crumbles to dust. The echoes of your warriors fade into the cold northern wind...</p>
      <div class="endgame-stats">
        <div class="endgame-stat"><span class="stat-label">Time Survived</span><span class="stat-value">${timeStr}</span></div>
        <div class="endgame-stat"><span class="stat-label">Rooms Built</span><span class="stat-value">${roomsBuilt}</span></div>
        <div class="endgame-stat"><span class="stat-label">Units Remaining</span><span class="stat-value">${unitsRecruited}</span></div>
        <div class="endgame-stat"><span class="stat-label">Raids Faced</span><span class="stat-value">${totalRaids}</span></div>
        <div class="endgame-stat"><span class="stat-label">Raids Survived</span><span class="stat-value">${raidsSurvived}</span></div>
      </div>
    </div>
  `;

  const restartBtn = document.createElement('button');
  restartBtn.className = 'endgame-restart-btn';
  restartBtn.textContent = 'Start New Game';
  restartBtn.addEventListener('click', () => {
    localStorage.removeItem('vikingKeeper');
    window.location.reload();
  });
  panel.querySelector('.endgame-content').appendChild(restartBtn);

  overlay.appendChild(panel);
}

// --- Victory Screen ---

function showVictoryScreen() {
  if (gameWon) return;
  gameWon = true;

  const existing = document.getElementById('victory-screen');
  if (existing) existing.remove();

  // Gather stats
  const ticksPlayed = gameState.tick;
  const roomsBuilt = gameState.rooms ? gameState.rooms.length : 0;
  const totalRaids = gameState.raids ? gameState.raids.length : 0;
  const raidsSurvived = gameState.raids
    ? gameState.raids.filter(r => r.winner === 'defenders' || r.winner === 'draw').length
    : 0;
  const unitsAlive = gameState.units ? gameState.units.length : 0;

  const minutes = Math.floor(ticksPlayed / 60);
  const seconds = ticksPlayed % 60;
  const timeStr = `${minutes}m ${seconds}s`;

  const panel = document.createElement('div');
  panel.id = 'victory-screen';

  panel.innerHTML = `
    <div class="endgame-bg victory-bg"></div>
    <div class="endgame-content victory-content">
      <h2 class="victory-title">Ragnarok Survived</h2>
      <h3 class="victory-subtitle">Valhalla Awaits!</h3>
      <p class="victory-flavor">The fires of Ragnarok have been quenched. Through cunning strategy and unyielding courage, you have forged a stronghold worthy of the gods themselves. Odin raises his horn in your honor — a seat among the Einherjar is yours for eternity.</p>
      <div class="endgame-stats">
        <div class="endgame-stat"><span class="stat-label">Time Played</span><span class="stat-value">${timeStr}</span></div>
        <div class="endgame-stat"><span class="stat-label">Rooms Built</span><span class="stat-value">${roomsBuilt}</span></div>
        <div class="endgame-stat"><span class="stat-label">Units Alive</span><span class="stat-value">${unitsAlive}</span></div>
        <div class="endgame-stat"><span class="stat-label">Raids Faced</span><span class="stat-value">${totalRaids}</span></div>
        <div class="endgame-stat"><span class="stat-label">Raids Survived</span><span class="stat-value">${raidsSurvived}</span></div>
      </div>
    </div>
  `;

  const restartBtn = document.createElement('button');
  restartBtn.className = 'endgame-restart-btn victory-restart-btn';
  restartBtn.textContent = 'Play Again';
  restartBtn.addEventListener('click', () => {
    localStorage.removeItem('vikingKeeper');
    window.location.reload();
  });
  panel.querySelector('.endgame-content').appendChild(restartBtn);

  overlay.appendChild(panel);
}

// --- Offline Progress Panel ("While you were away...") ---

function showOfflineReport(summary) {
  // Remove any existing offline report
  closeOfflineReport();

  const panel = document.createElement('div');
  panel.id = 'offline-report';

  const timeStr = formatElapsedTime(summary.elapsedSeconds);

  // Resource gains
  const resEntries = Object.entries(summary.resourcesGained)
    .filter(([, amt]) => amt > 0);
  let resourcesHtml = '';
  if (resEntries.length > 0) {
    const resList = resEntries
      .map(([res, amt]) => `<div class="offline-res-item"><span class="offline-res-name">${res}:</span> <span class="offline-res-amt">+${Math.floor(amt)}</span></div>`)
      .join('');
    resourcesHtml = `
      <div class="offline-section">
        <div class="offline-section-title">Resources Gathered</div>
        ${resList}
      </div>
    `;
  }

  // Expedition results
  let expeditionsHtml = '';
  if (summary.expeditionResults.length > 0) {
    const expCount = summary.expeditionResults.length;
    expeditionsHtml = `
      <div class="offline-section">
        <div class="offline-section-title">Expeditions</div>
        <div class="offline-exp-info">${expCount} expedition${expCount !== 1 ? 's' : ''} completed! Check results when they resolve.</div>
      </div>
    `;
  }

  // Raid results
  let raidsHtml = '';
  if (summary.raidResults.length > 0) {
    const raidCount = summary.raidResults.length;
    const victories = summary.raidResults.filter(r => r.winner === 'defenders').length;
    const defeats = summary.raidResults.filter(r => r.winner === 'attackers').length;
    const draws = raidCount - victories - defeats;

    let raidLines = `<div>${raidCount} raid${raidCount !== 1 ? 's' : ''} occurred</div>`;
    if (victories > 0) raidLines += `<div class="offline-raid-victory">${victories} repelled</div>`;
    if (defeats > 0) raidLines += `<div class="offline-raid-defeat">${defeats} breached</div>`;
    if (draws > 0) raidLines += `<div class="offline-raid-draw">${draws} stalemate${draws !== 1 ? 's' : ''}</div>`;
    if (summary.unitsLost > 0) raidLines += `<div class="offline-raid-losses">Units lost: ${summary.unitsLost}</div>`;
    if (summary.meadHallDamage > 0) raidLines += `<div class="offline-raid-damage">Mead Hall damage: ${summary.meadHallDamage}</div>`;

    raidsHtml = `
      <div class="offline-section">
        <div class="offline-section-title">Raids</div>
        ${raidLines}
      </div>
    `;
  }

  // Nothing happened?
  let nothingHtml = '';
  if (resEntries.length === 0 && summary.expeditionResults.length === 0 && summary.raidResults.length === 0) {
    nothingHtml = '<div class="offline-nothing">All was quiet in your absence.</div>';
  }

  panel.innerHTML = `
    <div class="offline-header">
      <h3>While You Were Away...</h3>
      <div class="offline-time">${timeStr}</div>
    </div>
    <div class="offline-body">
      ${resourcesHtml}
      ${expeditionsHtml}
      ${raidsHtml}
      ${nothingHtml}
    </div>
  `;

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'offline-dismiss-btn';
  dismissBtn.textContent = 'Continue';
  dismissBtn.addEventListener('click', () => closeOfflineReport());
  panel.appendChild(dismissBtn);

  overlay.appendChild(panel);
}

function closeOfflineReport() {
  const existing = document.getElementById('offline-report');
  if (existing) existing.remove();
}

// --- Pre-place starting Mead Hall ---

function placeStartingMeadHall() {
  // The starting area is a 7x7 carved area centered on the grid.
  // Grid center: (30, 20). The 7x7 spans from (27,17) to (33,23).
  // The Mead Hall is 5x5, placed at (28,17) to occupy tiles 28-32, 17-21.
  // This leaves a 1-tile border on all sides within the 7x7 area.
  placeRoomFree(gameState, 'meadHall', 28, 17);
}

// Track time between frames for dig flash decay
let lastFrameTime = performance.now();

// Render loop
function render() {
  const now = performance.now();
  const dt = (now - lastFrameTime) / 1000; // seconds
  lastFrameTime = now;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid with camera transform (visibility-culled)
  renderGrid(ctx, gameState.grid, canvas.width, canvas.height);

  // Draw room name labels
  renderRoomLabels(ctx, gameState.rooms, canvas.width, canvas.height);

  // Draw units on the grid
  renderUnits(ctx, gameState.units, canvas.width, canvas.height, selectedUnitId);

  // Draw dig flash effects (brief white flash on newly dug tiles)
  if (digFlashes.length > 0) {
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    for (let i = digFlashes.length - 1; i >= 0; i--) {
      const flash = digFlashes[i];
      flash.timer -= dt;
      if (flash.timer <= 0) {
        digFlashes.splice(i, 1);
        continue;
      }
      const alpha = flash.timer / 0.25; // fade from 1 to 0
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.5})`;
      ctx.fillRect(flash.x * TILE_SIZE, flash.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    ctx.restore();
  }

  // Build mode: draw room placement preview
  if (buildMode && mouse.onCanvas && mouse.tileX >= 0 && mouse.tileY >= 0) {
    const { def } = buildMode;
    const [w, h] = def.size;
    const rx = mouse.tileX - Math.floor(w / 2);
    const ry = mouse.tileY - Math.floor(h / 2);
    const valid = canPlaceRoom(gameState.grid, rx, ry, w, h) && canAfford(gameState.resources, def.cost);
    renderRoomPreview(ctx, def, rx, ry, valid);
  }

  // Draw hover tile indicator when mouse is over a valid tile (only when NOT in build mode)
  if (!buildMode && mouse.onCanvas && mouse.tileX >= 0 && mouse.tileX < GRID_WIDTH
      && mouse.tileY >= 0 && mouse.tileY < GRID_HEIGHT) {
    const tile = gameState.grid[mouse.tileY][mouse.tileX];
    // canDig: tile is rock and has at least one floor neighbor
    const adjacentToFloor = tile.type === 'rock' && (
      !isRock(gameState.grid, mouse.tileX - 1, mouse.tileY) ||
      !isRock(gameState.grid, mouse.tileX + 1, mouse.tileY) ||
      !isRock(gameState.grid, mouse.tileX, mouse.tileY - 1) ||
      !isRock(gameState.grid, mouse.tileX, mouse.tileY + 1)
    );
    const canDig = adjacentToFloor && gameState.resources.wood >= 1;
    renderHoverTile(ctx, mouse.tileX, mouse.tileY, canDig);
  }

  // Update maxUnits based on Mead Hall level for HUD display
  gameState.maxUnits = getUnitCapacity(gameState);

  // Update HTML HUD with current resource values
  updateHUD(gameState);

  // "No wood!" warning when trying to dig without resources
  if (!buildMode && mouse.leftDown && gameState.resources.wood < 1) {
    showWarning('Not enough wood!');
  }

  // Periodically refresh build panel button states (every frame is fine, it's lightweight)
  updateBuildPanel();

  requestAnimationFrame(render);
}

// Save/Load
function saveGame() {
  gameState.lastSaved = Date.now();
  localStorage.setItem('vikingKeeper', JSON.stringify(gameState));
}

function loadGame() {
  const data = localStorage.getItem('vikingKeeper');
  if (data) {
    setState(JSON.parse(data));
    return true;
  }
  return false;
}

// Boot
async function init() {
  // Load room, unit, upgrade, and enemy definitions before anything else
  await loadRoomDefs();
  await loadUnitDefs();
  await loadUpgradeDefs();
  await loadEnemyDefs();
  await loadExpeditionDefs();

  const loaded = loadGame();
  if (loaded) {
    // Sync room and unit ID counters so new entries get unique IDs
    syncRoomIds(gameState.rooms);
    syncUnitIds(gameState.units);
  }

  // Initialize raid timer and Mead Hall HP (handles fresh + loaded games)
  initRaidTimer(gameState);

  // Calculate offline progress if significant time has passed (> 10 seconds)
  let offlineSummary = null;
  if (loaded && gameState.lastSaved) {
    const elapsed = (Date.now() - gameState.lastSaved) / 1000;
    if (elapsed > 10) {
      offlineSummary = calculateOfflineProgress(gameState);
    }
  }

  // If no rooms exist (fresh game), place the starting Mead Hall
  if (gameState.rooms.length === 0) {
    placeStartingMeadHall();
  }

  setupCameraControls(canvas);
  centerCamera(30, 20, TILE_SIZE, canvas.width, canvas.height);

  // Create build panel UI
  createBuildPanel();

  // Create resource HUD
  createHUD(overlay);

  // Create expedition button
  createExpeditionButton();

  // Mouse tracking for hover tile
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    const world = screenToWorld(mouse.x, mouse.y, TILE_SIZE);
    mouse.tileX = world.tileX;
    mouse.tileY = world.tileY;

    // Click-and-drag digging: dig tiles as the mouse moves while held (only when not building)
    if (mouse.leftDown && !buildMode) {
      tryDig(mouse.tileX, mouse.tileY);
    }
  });
  canvas.addEventListener('mouseenter', () => { mouse.onCanvas = true; });
  canvas.addEventListener('mouseleave', () => {
    mouse.onCanvas = false;
    mouse.leftDown = false;
  });

  // Left-click: priorities: build mode > recruit panel > unit selection/assignment > dig
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      // Priority 1: Build mode — place rooms
      if (buildMode) {
        tryPlaceRoom(mouse.tileX, mouse.tileY);
        return;
      }

      // Priority 2: Check if clicking a room that supports recruitment (opens panel)
      const clickedRoom = getRoomAtTile(mouse.tileX, mouse.tileY);

      // Priority 3: Unit selection and assignment
      // If a unit is selected and clicking on a room → assign unit to room
      if (selectedUnitId != null && clickedRoom) {
        // Don't assign to Mead Hall — that is "unassign" (go idle)
        if (clickedRoom.type === 'meadHall') {
          unassignUnit(gameState, selectedUnitId);
        } else {
          assignUnitToRoom(gameState, selectedUnitId, clickedRoom);
        }
        selectedUnitId = null;
        return;
      }

      // If clicking on a tile with a unit → select that unit
      const clickedUnit = getUnitAtTile(gameState.units, mouse.tileX, mouse.tileY);
      if (clickedUnit) {
        // Toggle selection: clicking the same unit deselects it
        if (selectedUnitId === clickedUnit.id) {
          selectedUnitId = null;
        } else {
          selectedUnitId = clickedUnit.id;
        }
        // Close recruit panel if open
        if (recruitPanelRoom) closeRecruitPanel();
        return;
      }

      // If clicking a room that can recruit (and no unit selected) → open recruit panel
      if (clickedRoom) {
        const recruits = getRecruitsForRoom(gameState, clickedRoom);
        if (recruits.length > 0) {
          selectedUnitId = null;
          closeForgePanel();
          openRecruitPanel(clickedRoom);
          return;
        }
      }

      // If clicking a forge room (and no unit selected) → open forge panel
      if (clickedRoom && clickedRoom.type === 'forge') {
        selectedUnitId = null;
        closeRecruitPanel();
        openForgePanel(clickedRoom);
        return;
      }

      // Clicking empty space → deselect unit, close panels, then dig
      if (selectedUnitId != null) {
        selectedUnitId = null;
        return;
      }
      if (recruitPanelRoom) {
        closeRecruitPanel();
      }
      if (forgePanelRoom) {
        closeForgePanel();
      }
      mouse.leftDown = true;
      tryDig(mouse.tileX, mouse.tileY);
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouse.leftDown = false;
    }
  });

  // Right-click to cancel build mode, close panels, or deselect unit
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
      if (buildMode) exitBuildMode();
      if (recruitPanelRoom) closeRecruitPanel();
      if (forgePanelRoom) closeForgePanel();
      if (expeditionPanelOpen) closeExpeditionPanel();
      if (selectedUnitId != null) selectedUnitId = null;
    }
  });

  // Escape to cancel build mode, close panels, or deselect unit
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOfflineReport();
      if (buildMode) exitBuildMode();
      if (recruitPanelRoom) closeRecruitPanel();
      if (forgePanelRoom) closeForgePanel();
      if (expeditionPanelOpen) closeExpeditionPanel();
      if (selectedUnitId != null) selectedUnitId = null;
    }
  });

  // Show offline progress report if applicable
  if (offlineSummary) {
    showOfflineReport(offlineSummary);
  }

  setInterval(gameTick, 1000);
  setInterval(saveGame, 10000); // auto-save every 10s
  requestAnimationFrame(render);
}

init();
