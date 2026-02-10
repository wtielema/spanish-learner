import { gameState, setState, createInitialState } from './state.js';
import { camera, setupCameraControls, centerCamera, screenToWorld } from './camera.js';
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, isRock } from './grid.js';
import { renderGrid, renderHoverTile } from './renderer.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Mouse / hover tracking
const mouse = { x: -1, y: -1, tileX: -1, tileY: -1, onCanvas: false };

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

// Render loop
function render() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid with camera transform (visibility-culled)
  renderGrid(ctx, gameState.grid, canvas.width, canvas.height);

  // Draw hover tile indicator when mouse is over a valid tile
  if (mouse.onCanvas && mouse.tileX >= 0 && mouse.tileX < GRID_WIDTH
      && mouse.tileY >= 0 && mouse.tileY < GRID_HEIGHT) {
    const tile = gameState.grid[mouse.tileY][mouse.tileX];
    // canDig: tile is rock and has at least one floor neighbor
    const canDig = tile.type === 'rock' && (
      !isRock(gameState.grid, mouse.tileX - 1, mouse.tileY) ||
      !isRock(gameState.grid, mouse.tileX + 1, mouse.tileY) ||
      !isRock(gameState.grid, mouse.tileX, mouse.tileY - 1) ||
      !isRock(gameState.grid, mouse.tileX, mouse.tileY + 1)
    );
    renderHoverTile(ctx, mouse.tileX, mouse.tileY, canDig);
  }

  // HUD text (drawn outside camera transform so it stays fixed on screen)
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '24px sans-serif';
  ctx.fillText('Viking Keeper — Game Loop Running', 20, 40);
  ctx.font = '16px sans-serif';
  ctx.fillText(`Tick: ${gameState.tick} | Wood: ${gameState.resources.wood} | Iron: ${gameState.resources.iron} | Runes: ${gameState.resources.runes}`, 20, 70);

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
  });
  canvas.addEventListener('mouseenter', () => { mouse.onCanvas = true; });
  canvas.addEventListener('mouseleave', () => { mouse.onCanvas = false; });

  setInterval(gameTick, 1000);
  setInterval(saveGame, 10000); // auto-save every 10s
  requestAnimationFrame(render);
}

init();
