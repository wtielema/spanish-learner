export const TILE = {
  ROCK: 'rock',
  FLOOR: 'floor',
};

export const TILE_SIZE = 32; // pixels
export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 40;

export function createGrid() {
  const grid = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y] = [];
    for (let x = 0; x < GRID_WIDTH; x++) {
      grid[y][x] = { type: TILE.ROCK, roomId: null };
    }
  }
  // Carve out starting area (7x7 center) for Mead Hall
  const cx = Math.floor(GRID_WIDTH / 2);
  const cy = Math.floor(GRID_HEIGHT / 2);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      grid[cy + dy][cx + dx].type = TILE.FLOOR;
    }
  }
  return grid;
}

export function digTile(grid, x, y) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
  if (grid[y][x].type !== TILE.ROCK) return false;
  // Only dig if adjacent to a floor tile
  const neighbors = [
    [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
  ];
  const hasFloorNeighbor = neighbors.some(([nx, ny]) =>
    nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && grid[ny][nx].type === TILE.FLOOR
  );
  if (!hasFloorNeighbor) return false;
  grid[y][x].type = TILE.FLOOR;
  return true;
}

export function isRock(grid, x, y) {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true;
  return grid[y][x].type === TILE.ROCK;
}
