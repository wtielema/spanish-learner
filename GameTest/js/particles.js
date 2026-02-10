/**
 * Lightweight particle system for visual polish.
 * Supports mining sparks, resource sparkles, and combat flashes.
 */

import { camera } from './camera.js';

const particles = [];
const MAX_PARTICLES = 300;

/**
 * Create a particle at world coordinates.
 * @param {number} x - World x position
 * @param {number} y - World y position
 * @param {object} options
 * @param {string} options.color - CSS color string
 * @param {number} options.size - Radius in pixels (default 2)
 * @param {number} options.lifetime - Seconds to live (default 0.5)
 * @param {number} options.vx - Horizontal velocity in px/s
 * @param {number} options.vy - Vertical velocity in px/s
 * @param {number} options.gravity - Downward acceleration px/s^2 (default 0)
 * @param {number} options.fadeOut - If true, alpha decreases over lifetime (default true)
 */
export function createParticle(x, y, options = {}) {
  if (particles.length >= MAX_PARTICLES) return;

  particles.push({
    x,
    y,
    vx: options.vx || 0,
    vy: options.vy || 0,
    gravity: options.gravity || 0,
    color: options.color || '#fff',
    size: options.size || 2,
    lifetime: options.lifetime || 0.5,
    maxLifetime: options.lifetime || 0.5,
    fadeOut: options.fadeOut !== undefined ? options.fadeOut : true,
  });
}

/**
 * Spawn a burst of mining spark particles at world position.
 * Yellow/orange sparks that fly outward and fade.
 */
export function spawnMiningSparks(worldX, worldY) {
  const count = 8 + Math.floor(Math.random() * 6); // 8-13 sparks
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    const hue = Math.random() > 0.4 ? '#f0b830' : '#e08020'; // yellow or orange
    createParticle(worldX, worldY, {
      color: hue,
      size: 1 + Math.random() * 2,
      lifetime: 0.3 + Math.random() * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 60,
      fadeOut: true,
    });
  }
}

/**
 * Spawn resource sparkle particles floating upward from a world position.
 * Color depends on resource type.
 */
export function spawnResourceSparkle(worldX, worldY, resource) {
  const colorMap = {
    wood: ['#80c060', '#60a040'],
    iron: ['#a0b8d0', '#8098b0'],
    runes: ['#b080e0', '#9060c0'],
  };
  const colors = colorMap[resource] || ['#aaa', '#888'];
  const count = 3 + Math.floor(Math.random() * 3); // 3-5 particles

  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    createParticle(worldX + (Math.random() - 0.5) * 20, worldY + (Math.random() - 0.5) * 10, {
      color,
      size: 1 + Math.random() * 1.5,
      lifetime: 0.8 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 15,
      vy: -(15 + Math.random() * 25),
      gravity: -5,
      fadeOut: true,
    });
  }
}

/**
 * Spawn combat flash particles — red bursts.
 */
export function spawnCombatFlash(worldX, worldY) {
  const count = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    const color = Math.random() > 0.5 ? '#e03030' : '#ff6040';
    createParticle(worldX, worldY, {
      color,
      size: 1.5 + Math.random() * 2.5,
      lifetime: 0.3 + Math.random() * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 30,
      fadeOut: true,
    });
  }
}

/**
 * Update all particles. Call once per frame.
 * @param {number} dt - Delta time in seconds
 */
export function tickParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.lifetime -= dt;
    if (p.lifetime <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

/**
 * Render all active particles within the camera transform.
 * Call between grid rendering and HUD rendering.
 */
export function renderParticles(ctx) {
  if (particles.length === 0) return;

  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  for (const p of particles) {
    const alpha = p.fadeOut ? (p.lifetime / p.maxLifetime) : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
