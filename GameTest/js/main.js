import { gameState, setState, createInitialState } from './state.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

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

  // TODO: draw grid, rooms, units
  // Placeholder text
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
  setInterval(gameTick, 1000);
  setInterval(saveGame, 10000); // auto-save every 10s
  requestAnimationFrame(render);
}

init();
