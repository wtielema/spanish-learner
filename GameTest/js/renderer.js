import { TILE, TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, isRock } from './grid.js';
import { camera } from './camera.js';
import { getRoomDefs } from './rooms.js';

const COLORS = {
  rock: '#2d2d44',
  rockEdge: '#3d3d55',
  floor: '#4a4a3a',
  floorGrid: '#555544',
  wall: '#6b6b5a',
  meadHall: '#8b7332',
  mine: '#5a5a6a',
  lumberYard: '#4a6a3a',
  barracks: '#6a3a3a',
  shrine: '#3a4a6a',
  forge: '#6a4a2a',
};

export function renderGrid(ctx, grid, canvasW, canvasH) {
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Calculate visible tile range (only render what's on screen)
  const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
  const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE) - 1);
  const endX = Math.min(GRID_WIDTH, Math.ceil((camera.x + canvasW / camera.zoom) / TILE_SIZE) + 1);
  const endY = Math.min(GRID_HEIGHT, Math.ceil((camera.y + canvasH / camera.zoom) / TILE_SIZE) + 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = grid[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (tile.type === TILE.ROCK) {
        ctx.fillStyle = COLORS.rock;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        // Highlight rock edges adjacent to floor
        if (!isRock(grid, x-1, y) || !isRock(grid, x+1, y) || !isRock(grid, x, y-1) || !isRock(grid, x, y+1)) {
          ctx.fillStyle = COLORS.rockEdge;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      } else {
        // Floor tile — use room color if assigned, otherwise default floor
        ctx.fillStyle = tile.roomId ? (COLORS[tile.roomColor] || COLORS.floor) : COLORS.floor;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        // Grid lines on floor tiles
        ctx.strokeStyle = COLORS.floorGrid;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  ctx.restore();
}

export function renderHoverTile(ctx, tileX, tileY, canDig) {
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  ctx.strokeStyle = canDig ? '#ffcc00' : '#ff4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);

  ctx.restore();
}

/** Draw room name labels centered on each placed room */
export function renderRoomLabels(ctx, rooms, canvasW, canvasH) {
  if (rooms.length === 0) return;
  const defs = getRoomDefs();

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  for (const room of rooms) {
    const def = defs.find(d => d.id === room.type);
    if (!def) continue;

    const [w, h] = def.size;
    const cx = (room.x + w / 2) * TILE_SIZE;
    const cy = (room.y + h / 2) * TILE_SIZE;

    // Only draw if on screen (rough check)
    const screenX = (cx - camera.x) * camera.zoom;
    const screenY = (cy - camera.y) * camera.zoom;
    if (screenX < -200 || screenX > canvasW + 200 || screenY < -200 || screenY > canvasH + 200) continue;

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Drop shadow for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(def.name, cx + 1, cy + 1);

    ctx.fillStyle = '#fff';
    ctx.fillText(def.name, cx, cy);

    // Level indicator below name
    if (room.level > 1 || def.maxLevel > 1) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText(`Lv ${room.level}`, cx, cy + 14);
    }
  }

  ctx.restore();
}

// Unit type colors and initials for rendering
const UNIT_COLORS = {
  thrall:    '#a0a080',
  karl:      '#cc6644',
  berserker: '#cc3333',
  seer:      '#6688cc',
  valkyrie:  '#cc88ff',
};

const UNIT_INITIALS = {
  thrall:    'T',
  karl:      'K',
  berserker: 'B',
  seer:      'S',
  valkyrie:  'V',
};

/** Draw all units on the grid as colored circles with type initials.
 *  selectedUnitId (optional) — if set, draw a golden highlight ring around that unit. */
export function renderUnits(ctx, units, canvasW, canvasH, selectedUnitId) {
  if (!units || units.length === 0) return;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  const radius = TILE_SIZE * 0.35;

  for (const unit of units) {
    const px = (unit.position.x + 0.5) * TILE_SIZE;
    const py = (unit.position.y + 0.5) * TILE_SIZE;

    // Skip if off-screen (rough check)
    const screenX = (px - camera.x) * camera.zoom;
    const screenY = (py - camera.y) * camera.zoom;
    if (screenX < -50 || screenX > canvasW + 50 || screenY < -50 || screenY > canvasH + 50) continue;

    const color = UNIT_COLORS[unit.type] || '#888888';
    const initial = UNIT_INITIALS[unit.type] || '?';
    const isSelected = unit.id === selectedUnitId;

    // Selection highlight: golden pulsing ring behind the unit
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(px, py, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Soft golden glow
      ctx.beginPath();
      ctx.arc(px, py, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 204, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Filled circle
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Dark outline for contrast (or golden for selected)
    ctx.strokeStyle = isSelected ? '#ffcc00' : 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.stroke();

    // Letter initial
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(initial, px, py);

    // Small assignment indicator below the unit
    if (unit.assignment === 'working') {
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#88ff88';
      ctx.fillText('\u2692', px, py + radius + 8); // hammer and pick symbol
    }
  }

  ctx.restore();
}

/** Draw a semi-transparent room preview at the given tile position */
export function renderRoomPreview(ctx, roomDef, tileX, tileY, isValid) {
  if (!roomDef) return;
  const [w, h] = roomDef.size;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  const px = tileX * TILE_SIZE;
  const py = tileY * TILE_SIZE;
  const pw = w * TILE_SIZE;
  const ph = h * TILE_SIZE;

  // Fill with green or red depending on validity
  ctx.fillStyle = isValid ? 'rgba(0, 200, 0, 0.3)' : 'rgba(200, 0, 0, 0.3)';
  ctx.fillRect(px, py, pw, ph);

  // Outline
  ctx.strokeStyle = isValid ? '#00cc00' : '#cc0000';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  // Room name in the center
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isValid ? '#00ff00' : '#ff4444';
  ctx.fillText(roomDef.name, px + pw / 2, py + ph / 2);

  ctx.restore();
}
