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

// --- Tile color variation using a simple hash function ---

/** Simple hash for tile coordinates, returns 0-1 */
function tileHash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed || 0)) ^ 0x5bf03635;
  h = ((h >> 13) ^ h) * 1274126177;
  h = (h >> 16) ^ h;
  return (h & 0xffff) / 0xffff;
}

/** Parse hex color string to [r, g, b] */
function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Convert [r, g, b] to hex string */
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Cache for varied tile colors keyed by "baseHex:x:y" */
const colorVariationCache = new Map();
const CACHE_MAX = 10000;

/** Get a varied color for a tile at (x, y) based on a base hex color. Varies RGB by +/-12 */
function getVariedColor(baseHex, x, y) {
  const key = `${baseHex}:${x}:${y}`;
  if (colorVariationCache.has(key)) return colorVariationCache.get(key);

  const [r, g, b] = hexToRGB(baseHex);
  const variation = 12;
  const vr = Math.round((tileHash(x, y, 1) - 0.5) * 2 * variation);
  const vg = Math.round((tileHash(x, y, 2) - 0.5) * 2 * variation);
  const vb = Math.round((tileHash(x, y, 3) - 0.5) * 2 * variation);
  const result = rgbToHex(
    Math.max(0, Math.min(255, r + vr)),
    Math.max(0, Math.min(255, g + vg)),
    Math.max(0, Math.min(255, b + vb))
  );

  if (colorVariationCache.size > CACHE_MAX) colorVariationCache.clear();
  colorVariationCache.set(key, result);
  return result;
}

// --- Room icon drawing functions ---

function drawMeadHallIcon(ctx, cx, cy, size) {
  // Simple cup/horn shape
  const s = size * 0.35;
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Cup body
  ctx.moveTo(cx - s, cy - s * 0.6);
  ctx.lineTo(cx - s * 0.7, cy + s * 0.8);
  ctx.lineTo(cx + s * 0.7, cy + s * 0.8);
  ctx.lineTo(cx + s, cy - s * 0.6);
  // Rim
  ctx.closePath();
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.arc(cx + s * 1.1, cy + s * 0.1, s * 0.35, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
}

function drawMineIcon(ctx, cx, cy, size) {
  // Pickaxe shape
  const s = size * 0.35;
  ctx.strokeStyle = 'rgba(180, 200, 220, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Handle (diagonal)
  ctx.moveTo(cx - s * 0.8, cy + s * 0.8);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.5);
  ctx.stroke();
  // Pick head
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s * 0.9);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.9, cy - s * 0.1);
  ctx.stroke();
}

function drawLumberYardIcon(ctx, cx, cy, size) {
  // Axe shape
  const s = size * 0.35;
  ctx.strokeStyle = 'rgba(140, 200, 100, 0.5)';
  ctx.lineWidth = 1.5;
  // Handle
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, cy + s * 0.8);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.4);
  ctx.stroke();
  // Axe head (filled)
  ctx.fillStyle = 'rgba(140, 200, 100, 0.3)';
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.4, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.9, cy - s * 0.8);
  ctx.lineTo(cx + s * 0.8, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBarracksIcon(ctx, cx, cy, size) {
  // Sword shape
  const s = size * 0.38;
  ctx.strokeStyle = 'rgba(220, 140, 140, 0.5)';
  ctx.lineWidth = 1.5;
  // Blade
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s * 0.4);
  ctx.stroke();
  // Point
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy - s * 0.7);
  ctx.lineTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.2, cy - s * 0.7);
  ctx.stroke();
  // Crossguard
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.4);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.4);
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.4);
  ctx.lineTo(cx, cy + s * 0.8);
  ctx.stroke();
  // Pommel
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.9, s * 0.12, 0, Math.PI * 2);
  ctx.stroke();
}

function drawShrineIcon(ctx, cx, cy, size) {
  // Rune symbol (simplified Elder Futhark "Ansuz" / a-like rune)
  const s = size * 0.35;
  ctx.strokeStyle = 'rgba(140, 160, 220, 0.5)';
  ctx.lineWidth = 1.5;
  // Vertical stave
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s);
  ctx.stroke();
  // Two diagonal branches
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.6, cy - s * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.6, cy - s * 0.3);
  ctx.stroke();
}

function drawForgeIcon(ctx, cx, cy, size) {
  // Anvil + hammer shape
  const s = size * 0.35;
  ctx.strokeStyle = 'rgba(220, 160, 100, 0.5)';
  ctx.fillStyle = 'rgba(220, 160, 100, 0.25)';
  ctx.lineWidth = 1.5;
  // Anvil body
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.8, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.5, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.7, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.9, cy + s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Anvil base
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.6);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.6);
  ctx.lineTo(cx + s * 0.6, cy + s * 0.1);
  ctx.stroke();
  // Hammer (small, above anvil)
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy - s * 0.3);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.8);
  ctx.stroke();
  ctx.fillRect(cx - s * 0.35, cy - s * 1.0, s * 0.5, s * 0.25);
  ctx.strokeRect(cx - s * 0.35, cy - s * 1.0, s * 0.5, s * 0.25);
}

const ROOM_ICON_DRAWERS = {
  meadHall: drawMeadHallIcon,
  mine: drawMineIcon,
  lumberYard: drawLumberYardIcon,
  barracks: drawBarracksIcon,
  shrine: drawShrineIcon,
  forge: drawForgeIcon,
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
        const isEdge = !isRock(grid, x-1, y) || !isRock(grid, x+1, y) || !isRock(grid, x, y-1) || !isRock(grid, x, y+1);
        const baseColor = isEdge ? COLORS.rockEdge : COLORS.rock;
        ctx.fillStyle = getVariedColor(baseColor, x, y);
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      } else {
        // Floor tile -- use room color if assigned, otherwise default floor
        const baseColor = tile.roomId ? (COLORS[tile.roomColor] || COLORS.floor) : COLORS.floor;
        ctx.fillStyle = getVariedColor(baseColor, x, y);
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Room inner border: subtle glow on room edge tiles
        if (tile.roomId) {
          const isEdgeLeft = x === 0 || grid[y][x - 1].roomId !== tile.roomId;
          const isEdgeRight = x === GRID_WIDTH - 1 || grid[y][x + 1].roomId !== tile.roomId;
          const isEdgeTop = y === 0 || grid[y - 1][x].roomId !== tile.roomId;
          const isEdgeBot = y === GRID_HEIGHT - 1 || grid[y + 1][x].roomId !== tile.roomId;

          if (isEdgeLeft || isEdgeRight || isEdgeTop || isEdgeBot) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            // Draw inner border lines only on the room-edge sides
            ctx.beginPath();
            if (isEdgeTop) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + TILE_SIZE, py + 0.5); }
            if (isEdgeBot) { ctx.moveTo(px, py + TILE_SIZE - 0.5); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE - 0.5); }
            if (isEdgeLeft) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + TILE_SIZE); }
            if (isEdgeRight) { ctx.moveTo(px + TILE_SIZE - 0.5, py); ctx.lineTo(px + TILE_SIZE - 0.5, py + TILE_SIZE); }
            ctx.stroke();
          }
        }

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

/** Draw room name labels centered on each placed room, with room icons above */
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

    // Draw room icon above center
    const iconDrawer = ROOM_ICON_DRAWERS[room.type];
    if (iconDrawer) {
      const iconSize = Math.min(w, h) * TILE_SIZE;
      iconDrawer(ctx, cx, cy - 10, iconSize);
    }

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Build label text: include level for rooms that can be upgraded
    const level = room.level || 1;
    const label = (def.maxLevel && def.maxLevel > 1)
      ? `${def.name} Lv.${level}`
      : def.name;

    // Position label below center (to make room for icon)
    const labelY = cy + 8;

    // Drop shadow for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(label, cx + 1, labelY + 1);

    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, labelY);
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
 *  selectedUnitId (optional) -- if set, draw a golden highlight ring around that unit. */
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
