import { gameState, setState, createInitialState } from './state.js';
import { camera, setupCameraControls, centerCamera, screenToWorld } from './camera.js';
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, isRock, digTile } from './grid.js';
import { renderGrid, renderHoverTile } from './renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Mouse / hover tracking
const mouse = { x: -1, y: -1, tileX: -1, tileY: -1, onCanvas: false, leftDown: false };

// Dig flash feedback (brief flash on the dug tile)
const digFlashes = []; // { x, y, timer }

// Attempt to dig at the given tile coordinates; returns true if successful
function tryDig(tx, ty) {
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

// Game tick (1s interval) — resource production, combat, timers
function gameTick() {
  gameState.tick++;
  // TODO: production, raids, expeditions
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

  // Draw hover tile indicator when mouse is over a valid tile
  if (mouse.onCanvas && mouse.tileX >= 0 && mouse.tileX < GRID_WIDTH
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
  ctx.fillText('Viking Keeper — Game Loop Running', 20, 40);
  ctx.font = '16px sans-serif';
  ctx.fillText(`Tick: ${gameState.tick} | Wood: ${gameState.resources.wood} | Iron: ${gameState.resources.iron} | Runes: ${gameState.resources.runes}`, 20, 70);

  // "No wood!" warning when trying to dig without resources
  if (mouse.leftDown && gameState.resources.wood < 1) {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Not enough wood!', 20, 100);
  }

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
function init() {
  loadGame();
  setupCameraControls(canvas);
  centerCamera(30, 20, TILE_SIZE, canvas.width, canvas.height);

  // Mouse tracking for hover tile
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    const world = screenToWorld(mouse.x, mouse.y, TILE_SIZE);
    mouse.tileX = world.tileX;
    mouse.tileY = world.tileY;

    // Click-and-drag digging: dig tiles as the mouse moves while held
    if (mouse.leftDown) {
      tryDig(mouse.tileX, mouse.tileY);
    }
  });
  canvas.addEventListener('mouseenter', () => { mouse.onCanvas = true; });
  canvas.addEventListener('mouseleave', () => {
    mouse.onCanvas = false;
    mouse.leftDown = false;
  });

  // Left-click to dig
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.leftDown = true;
      tryDig(mouse.tileX, mouse.tileY);
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouse.leftDown = false;
    }
  });

  setInterval(gameTick, 1000);
  setInterval(saveGame, 10000); // auto-save every 10s
  requestAnimationFrame(render);
}

init();
