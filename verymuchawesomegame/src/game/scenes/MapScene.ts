import Phaser from 'phaser';
import {
  axialToIso, isoToAxial, isoHexVertices, getBiomeColor, getBiomeFogColor, HEX_SIZE,
  darkenColor, hexDepth, getVisibleWallEdges, WALL_HEIGHT, ELEVATION_UNIT, BIOME_ELEVATION,
  WALL_SHADING, ISO_Y_RATIO,
} from '../hex';
import type { Hex, Player } from '@/lib/types';
import { BIOMES } from '@/lib/constants';

const PLAYER_COLORS = [
  0x00ff88, 0xff6666, 0x66ccff, 0xffaa00, 0xff66ff,
  0x66ff66, 0xff8844, 0x44ffcc, 0xcc88ff, 0xffff66,
];

interface HexSprite {
  q: number;
  r: number;
  graphics: Phaser.GameObjects.Graphics;
  icons: Phaser.GameObjects.GameObject[];
  elevation: number;
}

export class MapScene extends Phaser.Scene {
  private hexSprites: Map<string, HexSprite> = new Map();
  private playerGroup: Phaser.GameObjects.Container | null = null;
  private otherPlayerGroups: Map<string, Phaser.GameObjects.Container> = new Map();
  private selectedHexKey: string | null = null;
  private selectionOutline: Phaser.GameObjects.Graphics | null = null;
  private selectionTween: Phaser.Tweens.Tween | null = null;
  private hullPulse: Phaser.Tweens.Tween | null = null;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    // Camera controls: drag to pan
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = false;
      this.dragStart.x = pointer.x;
      this.dragStart.y = pointer.y;
      this.camStart.x = this.cameras.main.scrollX;
      this.camStart.y = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this.isDragging = true;
      }
      if (this.isDragging) {
        this.cameras.main.scrollX = this.camStart.x - dx;
        this.cameras.main.scrollY = this.camStart.y - dy;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        this.handleClick(pointer);
      }
      this.isDragging = false;
    });

    // Scroll to zoom
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], _gw: number, _event: WheelEvent, deltaY: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.5, 3);
      cam.setZoom(newZoom);
    });

    // Initial render from registry data if available
    const hexes = this.registry.get('hexes') as Hex[] | undefined;
    const player = this.registry.get('player') as Player | undefined;
    const visibleHexKeys = this.registry.get('visibleHexKeys') as Set<string> | undefined;
    const otherPlayers = this.registry.get('otherPlayers') as Player[] | undefined;

    if (hexes) {
      this.renderHexes(hexes, visibleHexKeys);
    }
    if (player) {
      this.renderPlayer(player);
      this.centerOnPlayer(player);
    }
    if (otherPlayers) {
      this.renderOtherPlayers(otherPlayers);
    }

    // Listen for state updates from React
    this.registry.events.on('changedata-hexes', () => {
      const h = this.registry.get('hexes') as Hex[];
      const v = this.registry.get('visibleHexKeys') as Set<string> | undefined;
      this.renderHexes(h, v);
    });

    this.registry.events.on('changedata-player', () => {
      const p = this.registry.get('player') as Player;
      this.renderPlayer(p);
    });

    this.registry.events.on('changedata-otherPlayers', () => {
      const op = this.registry.get('otherPlayers') as Player[];
      this.renderOtherPlayers(op);
    });
  }

  private hexKey(q: number, r: number): string {
    return `${q},${r}`;
  }

  private renderHexPrism(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    color: number, alpha: number,
    strokeColor: number, strokeAlpha: number,
  ) {
    const verts = isoHexVertices(HEX_SIZE - 1);
    const wallEdges = getVisibleWallEdges();
    const shadings = [WALL_SHADING.right, WALL_SHADING.front, WALL_SHADING.left];

    // Draw wall faces (behind top face)
    wallEdges.forEach(([i, j], idx) => {
      const wallColor = darkenColor(color, shadings[idx]);
      g.fillStyle(wallColor, alpha);
      g.beginPath();
      g.moveTo(cx + verts[i].x, cy + verts[i].y);
      g.lineTo(cx + verts[j].x, cy + verts[j].y);
      g.lineTo(cx + verts[j].x, cy + verts[j].y + WALL_HEIGHT);
      g.lineTo(cx + verts[i].x, cy + verts[i].y + WALL_HEIGHT);
      g.closePath();
      g.fillPath();

      // Stroke wall edges
      g.lineStyle(1, strokeColor, strokeAlpha);
      g.strokePath();
    });

    // Draw top face
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(cx + verts[0].x, cy + verts[0].y);
    for (let i = 1; i < 6; i++) {
      g.lineTo(cx + verts[i].x, cy + verts[i].y);
    }
    g.closePath();
    g.fillPath();

    // Stroke top face
    g.lineStyle(1, strokeColor, strokeAlpha);
    g.strokePath();
  }

  renderHexes(hexes: Hex[], visibleHexKeys?: Set<string>) {
    // Clear existing
    for (const sprite of this.hexSprites.values()) {
      sprite.graphics.destroy();
      sprite.icons.forEach(i => i.destroy());
    }
    this.hexSprites.clear();
    if (this.hullPulse) {
      this.hullPulse.destroy();
      this.hullPulse = null;
    }

    // Sort hexes back-to-front for proper depth ordering
    const sortedHexes = [...hexes].sort((a, b) => {
      const elevA = BIOME_ELEVATION[a.biome] ?? 0;
      const elevB = BIOME_ELEVATION[b.biome] ?? 0;
      return hexDepth(a.q, a.r, elevA) - hexDepth(b.q, b.r, elevB);
    });

    for (const hex of sortedHexes) {
      const { x, y: baseY } = axialToIso(hex.q, hex.r);
      const elev = BIOME_ELEVATION[hex.biome] ?? 0;
      const y = baseY - elev * ELEVATION_UNIT;
      const depth = hexDepth(hex.q, hex.r, elev);
      const isVisible = !visibleHexKeys || visibleHexKeys.has(this.hexKey(hex.q, hex.r));
      const color = isVisible ? getBiomeColor(hex.biome) : getBiomeFogColor();
      const alpha = isVisible ? 0.85 : 0.3;
      const strokeColor = isVisible ? 0x444466 : 0x222233;
      const strokeAlpha = 0.5;

      const g = this.add.graphics();
      g.setDepth(depth);
      this.renderHexPrism(g, x, y, color, alpha, strokeColor, strokeAlpha);

      const icons: Phaser.GameObjects.GameObject[] = [];

      if (isVisible) {
        // Biome pattern overlay (subtle inner detail)
        this.addBiomePattern(x, y, hex.biome, icons, depth + 1);

        // Ship part indicator with glow
        if (hex.ship_part) {
          const partGlow = this.add.circle(x, y + 8 * ISO_Y_RATIO, 6, 0xffaa00, 0.2);
          partGlow.setDepth(depth + 5);
          icons.push(partGlow);
          const partIcon = this.add.text(x, y + 8 * ISO_Y_RATIO, '\u2726', {
            fontSize: '12px',
            color: '#ffaa00',
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(depth + 5);
          icons.push(partIcon);

          // Subtle glow animation
          this.tweens.add({
            targets: partGlow,
            alpha: { from: 0.1, to: 0.35 },
            scaleX: { from: 1, to: 1.3 },
            scaleY: { from: 1, to: 1.3 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }

        // Hull indicator (pulsing ring)
        const isHull = hex.q === (this.registry.get('hullQ') ?? 0) &&
                       hex.r === (this.registry.get('hullR') ?? 0);
        if (isHull) {
          // Inner glow
          const hullGlow = this.add.circle(x, y, HEX_SIZE * 0.65, 0x00ff88, 0.1);
          hullGlow.setStrokeStyle(2, 0x00ff88, 0.5);
          hullGlow.setDepth(depth + 2);
          icons.push(hullGlow);

          // Label
          const hullLabel = this.add.text(x, y - 14 * ISO_Y_RATIO, 'MERIDIAN', {
            fontSize: '7px',
            color: '#00ff88',
            fontStyle: 'bold',
            letterSpacing: 2,
          }).setOrigin(0.5).setDepth(depth + 5).setAlpha(0.7);
          icons.push(hullLabel);

          this.hullPulse = this.tweens.add({
            targets: hullGlow,
            alpha: { from: 0.1, to: 0.35 },
            scaleX: { from: 1, to: 1.12 },
            scaleY: { from: 1, to: 1.12 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }

        // Biome label
        if (!isHull) {
          const biomeDef = BIOMES[hex.biome];
          if (biomeDef) {
            const label = this.add.text(x, y - 12 * ISO_Y_RATIO, biomeDef.name, {
              fontSize: '7px',
              color: '#ffffff',
            }).setOrigin(0.5).setAlpha(0.35).setDepth(depth + 3);
            icons.push(label);
          }
        }

        // Ruins loot indicator
        if (hex.ruins_loot && hex.ruins_loot.length > 0) {
          const lootIcon = this.add.text(x + 12, y - 12 * ISO_Y_RATIO, '\u2620', {
            fontSize: '10px',
          }).setOrigin(0.5).setDepth(depth + 5).setAlpha(0.6);
          icons.push(lootIcon);
        }
      }

      this.hexSprites.set(this.hexKey(hex.q, hex.r), {
        q: hex.q,
        r: hex.r,
        graphics: g,
        icons,
        elevation: elev,
      });
    }
  }

  private addBiomePattern(x: number, y: number, biome: string, icons: Phaser.GameObjects.GameObject[], depth: number) {
    const g = this.add.graphics();
    g.setDepth(depth);

    switch (biome) {
      case 'biolume_forest': {
        // Small glowing dots
        for (let i = 0; i < 5; i++) {
          const dx = (Math.random() - 0.5) * HEX_SIZE * 0.8;
          const dy = (Math.random() - 0.5) * HEX_SIZE * 0.6 * ISO_Y_RATIO;
          g.fillStyle(0x00ff88, 0.15 + Math.random() * 0.15);
          g.fillCircle(x + dx, y + dy, 1.5 + Math.random());
        }
        break;
      }
      case 'fungal_marsh': {
        // Spore dots
        for (let i = 0; i < 4; i++) {
          const dx = (Math.random() - 0.5) * HEX_SIZE * 0.7;
          const dy = (Math.random() - 0.5) * HEX_SIZE * 0.5 * ISO_Y_RATIO;
          g.fillStyle(0xcc66ff, 0.12);
          g.fillCircle(x + dx, y + dy, 2 + Math.random() * 2);
        }
        break;
      }
      case 'crystal_ridge': {
        // Crystal shards (small lines)
        g.lineStyle(1, 0x66ddff, 0.2);
        for (let i = 0; i < 3; i++) {
          const dx = (Math.random() - 0.5) * HEX_SIZE * 0.6;
          const dy = (Math.random() - 0.5) * HEX_SIZE * 0.4 * ISO_Y_RATIO;
          const angle = Math.random() * Math.PI;
          const len = 3 + Math.random() * 4;
          g.lineBetween(
            x + dx - Math.cos(angle) * len,
            y + dy - Math.sin(angle) * len * ISO_Y_RATIO,
            x + dx + Math.cos(angle) * len,
            y + dy + Math.sin(angle) * len * ISO_Y_RATIO,
          );
        }
        break;
      }
      case 'vent_fields': {
        // Heat waves (concentric arcs)
        g.lineStyle(1, 0xff6600, 0.1);
        for (let i = 0; i < 2; i++) {
          const r = 6 + i * 5;
          g.arc(x, y + 5 * ISO_Y_RATIO, r, -0.8, 0.8, false);
          g.strokePath();
        }
        break;
      }
      case 'ruin': {
        // Geometric fragments
        g.lineStyle(1, 0xdaa520, 0.15);
        const rx = x - 5;
        const ry = y - 3 * ISO_Y_RATIO;
        g.strokeRect(rx, ry, 8, 6 * ISO_Y_RATIO);
        g.lineBetween(rx + 4, ry, rx + 4, ry + 6 * ISO_Y_RATIO);
        break;
      }
      case 'chasm': {
        // Dark cracks
        g.lineStyle(1, 0x000000, 0.3);
        g.lineBetween(x - 8, y - 3 * ISO_Y_RATIO, x + 5, y + 4 * ISO_Y_RATIO);
        g.lineBetween(x - 3, y - 6 * ISO_Y_RATIO, x + 2, y + 7 * ISO_Y_RATIO);
        break;
      }
    }

    icons.push(g);
  }

  renderPlayer(player: Player) {
    if (player.position_q == null || player.position_r == null) return;

    const { x, y: baseY } = axialToIso(player.position_q, player.position_r);
    const key = this.hexKey(player.position_q, player.position_r);
    const sprite = this.hexSprites.get(key);
    const elev = sprite?.elevation ?? 0;
    const y = baseY - elev * ELEVATION_UNIT;
    const depth = hexDepth(player.position_q, player.position_r, elev) + 50;

    if (this.playerGroup) {
      this.playerGroup.setPosition(x, y);
      this.playerGroup.setDepth(depth);
      return;
    }

    // Create player avatar: colored circle with initial letter
    const container = this.add.container(x, y);
    container.setDepth(depth);

    // Outer glow ring
    const glow = this.add.circle(0, 0, 14, 0x00ff88, 0.15);
    container.add(glow);

    // Main circle
    const circle = this.add.circle(0, 0, 11, 0x00ff88, 0.9);
    circle.setStrokeStyle(2, 0xffffff, 0.9);
    container.add(circle);

    // Initial letter
    const initial = player.name.charAt(0).toUpperCase();
    const text = this.add.text(0, 0, initial, {
      fontSize: '12px',
      color: '#0a0a0a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(text);

    // Name label below
    const label = this.add.text(0, 18, player.name, {
      fontSize: '9px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.8);
    container.add(label);

    // Subtle breathing animation
    this.tweens.add({
      targets: glow,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      alpha: { from: 0.15, to: 0.05 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.playerGroup = container;
  }

  renderOtherPlayers(players: Player[]) {
    // Remove old markers
    for (const group of this.otherPlayerGroups.values()) {
      group.destroy();
    }
    this.otherPlayerGroups.clear();

    players.forEach((p, index) => {
      if (p.position_q == null || p.position_r == null || !p.is_alive) return;

      const { x, y: baseY } = axialToIso(p.position_q, p.position_r);
      const key = this.hexKey(p.position_q, p.position_r);
      const spriteData = this.hexSprites.get(key);
      const elev = spriteData?.elevation ?? 0;
      const y = baseY - elev * ELEVATION_UNIT;
      const depth = hexDepth(p.position_q, p.position_r, elev) + 45;
      const color = PLAYER_COLORS[(index + 1) % PLAYER_COLORS.length];

      const container = this.add.container(x, y);
      container.setDepth(depth);

      // Circle
      const circle = this.add.circle(0, 0, 7, color, 0.8);
      circle.setStrokeStyle(1, 0xffffff, 0.5);
      container.add(circle);

      // Initial
      const initial = p.name.charAt(0).toUpperCase();
      const text = this.add.text(0, 0, initial, {
        fontSize: '9px',
        color: '#0a0a0a',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(text);

      // Name
      const label = this.add.text(0, 12, p.name, {
        fontSize: '7px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.6);
      container.add(label);

      this.otherPlayerGroups.set(p.id, container);
    });
  }

  centerOnPlayer(player: Player) {
    if (player.position_q == null || player.position_r == null) return;
    const { x, y: baseY } = axialToIso(player.position_q, player.position_r);
    const key = this.hexKey(player.position_q, player.position_r);
    const sprite = this.hexSprites.get(key);
    const elev = sprite?.elevation ?? 0;
    this.cameras.main.centerOn(x, baseY - elev * ELEVATION_UNIT);
  }

  private handleClick(pointer: Phaser.Input.Pointer) {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    const { q, r } = isoToAxial(worldX, worldY);
    const key = this.hexKey(q, r);

    // Check if hex exists
    if (!this.hexSprites.has(key)) return;

    // Clear previous selection
    if (this.selectionOutline) {
      this.selectionOutline.destroy();
      this.selectionOutline = null;
    }
    if (this.selectionTween) {
      this.selectionTween.destroy();
      this.selectionTween = null;
    }

    // Select new hex
    this.selectedHexKey = key;
    const spriteData = this.hexSprites.get(key)!;
    const { x, y: baseY } = axialToIso(q, r);
    const y = baseY - spriteData.elevation * ELEVATION_UNIT;

    // Draw isometric selection outline
    const outlineVerts = isoHexVertices(HEX_SIZE + 2);
    this.selectionOutline = this.add.graphics();
    this.selectionOutline.setDepth(hexDepth(q, r, spriteData.elevation) + 20);
    this.selectionOutline.lineStyle(2, 0x00ff88, 0.9);
    this.selectionOutline.beginPath();
    this.selectionOutline.moveTo(x + outlineVerts[0].x, y + outlineVerts[0].y);
    for (let i = 1; i < 6; i++) {
      this.selectionOutline.lineTo(x + outlineVerts[i].x, y + outlineVerts[i].y);
    }
    this.selectionOutline.closePath();
    this.selectionOutline.strokePath();

    // Selection pulse animation
    this.selectionTween = this.tweens.add({
      targets: this.selectionOutline,
      alpha: { from: 0.9, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Emit event to React layer
    this.events.emit('hex-selected', { q, r });
  }
}
