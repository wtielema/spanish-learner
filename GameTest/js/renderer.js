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
