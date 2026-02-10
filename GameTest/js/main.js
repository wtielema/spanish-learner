import { gameState, setState, createInitialState } from './state.js';
import { camera, setupCameraControls, centerCamera, screenToWorld } from './camera.js';
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, isRock, digTile } from './grid.js';
import { renderGrid, renderHoverTile, renderRoomLabels, renderRoomPreview } from './renderer.js';
import { loadRoomDefs, getRoomDefs, canPlaceRoom, canAfford, placeRoom, placeRoomFree, syncRoomIds } from './rooms.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('ui-overlay');

// Mouse / hover tracking
const mouse = { x: -1, y: -1, tileX: -1, tileY: -1, onCanvas: false, leftDown: false };

// Dig flash feedback (brief flash on the dug tile)
const digFlashes = []; // { x, y, timer }

// Build mode state
let buildMode = null; // null = not building, otherwise { defId, def } for the room being placed

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
  gameState.tick++;
  // TODO: production, raids, expeditions
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

  // HUD text (drawn outside camera transform so it stays fixed on screen)
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '24px sans-serif';
  ctx.fillText('Viking Keeper', 20, 40);
  ctx.font = '16px sans-serif';
  ctx.fillText(`Tick: ${gameState.tick} | Wood: ${gameState.resources.wood} | Iron: ${gameState.resources.iron} | Runes: ${gameState.resources.runes}`, 20, 70);

  // "No wood!" warning when trying to dig without resources
  if (!buildMode && mouse.leftDown && gameState.resources.wood < 1) {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Not enough wood!', 20, 100);
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
  // Load room definitions before anything else
  await loadRoomDefs();

  const loaded = loadGame();
  if (loaded) {
    // Sync room ID counter so new rooms get unique IDs
    syncRoomIds(gameState.rooms);
  }

  // If no rooms exist (fresh game), place the starting Mead Hall
  if (gameState.rooms.length === 0) {
    placeStartingMeadHall();
  }

  setupCameraControls(canvas);
  centerCamera(30, 20, TILE_SIZE, canvas.width, canvas.height);

  // Create build panel UI
  createBuildPanel();

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

  // Left-click: dig (no build mode) or place room (build mode)
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      if (buildMode) {
        tryPlaceRoom(mouse.tileX, mouse.tileY);
      } else {
        mouse.leftDown = true;
        tryDig(mouse.tileX, mouse.tileY);
      }
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouse.leftDown = false;
    }
  });

  // Right-click to cancel build mode (camera panning still handled by camera.js)
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2 && buildMode) {
      exitBuildMode();
    }
  });

  // Escape to cancel build mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && buildMode) {
      exitBuildMode();
    }
  });

  setInterval(gameTick, 1000);
  setInterval(saveGame, 10000); // auto-save every 10s
  requestAnimationFrame(render);
}

init();
