export const camera = {
  x: 0, y: 0,  // world position (top-left of viewport)
  zoom: 1,
  minZoom: 0.5,
  maxZoom: 2,
  dragStart: null,
  isDragging: false,
};

export function screenToWorld(screenX, screenY, tileSize) {
  return {
    wx: (screenX / camera.zoom + camera.x),
    wy: (screenY / camera.zoom + camera.y),
    tileX: Math.floor((screenX / camera.zoom + camera.x) / tileSize),
    tileY: Math.floor((screenY / camera.zoom + camera.y) / tileSize),
  };
}

export function setupCameraControls(canvas) {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2) { // middle or right click to pan
      camera.dragStart = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
      camera.isDragging = true;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (camera.isDragging && camera.dragStart) {
      camera.x = camera.dragStart.camX - (e.clientX - camera.dragStart.x) / camera.zoom;
      camera.y = camera.dragStart.camY - (e.clientY - camera.dragStart.y) / camera.zoom;
    }
  });

  canvas.addEventListener('mouseup', () => {
    camera.isDragging = false;
    camera.dragStart = null;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const oldZoom = camera.zoom;
    camera.zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    camera.zoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom));
    // Zoom toward mouse position
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    camera.x += mx / oldZoom - mx / camera.zoom;
    camera.y += my / oldZoom - my / camera.zoom;
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function centerCamera(tileX, tileY, tileSize, canvasW, canvasH) {
  camera.x = tileX * tileSize - canvasW / (2 * camera.zoom);
  camera.y = tileY * tileSize - canvasH / (2 * camera.zoom);
}
