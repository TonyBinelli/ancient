import * as PIXI from 'pixi.js';
import { CONFIG } from '../config.js';

const { COLS, ROWS, TILE_W, TILE_H } = CONFIG.MAP;
const HW = TILE_W / 2;   // half tile width  (32 px)
const HH = TILE_H / 2;   // half tile height (16 px)

// ── Tile type constants ──────────────────────────────────────────────────────
export const TILE_TYPE = Object.freeze({ GRASS: 0, FOREST: 1, WATER: 2 });

// ── Isometric coordinate helpers ─────────────────────────────────────────────
/**
 * Convert tile grid position to local screen position (top corner of diamond).
 * ox / oy are the map's origin offset (top tile at col=0, row=0).
 */
export function tileToScreen(col, row, ox, oy) {
  return {
    x: (col - row) * HW + ox,
    y: (col + row) * HH + oy,
  };
}

/**
 * Inverse: screen → fractional tile position (for mouse picking).
 */
export function screenToTile(sx, sy, ox, oy) {
  const dx = (sx - ox) / HW;
  const dy = (sy - oy) / HH;
  return { col: (dx + dy) / 2, row: (dy - dx) / 2 };
}

// ── Tile appearance ──────────────────────────────────────────────────────────
// Three slightly different grass shades for organic-looking ground variation.
const GRASS_VARIANTS = [0x72b444, 0x6aaa3c, 0x7cbc4c];

const TILE_STYLE = {
  [TILE_TYPE.GRASS]:  { line: 0x4a8a24 },
  [TILE_TYPE.FOREST]: { fill: 0x3a6818, line: 0x284e10 },
  [TILE_TYPE.WATER]:  { fill: 0x3888b8, line: 0x2668a0 },
};

// ── IsometricMap ─────────────────────────────────────────────────────────────
export class IsometricMap {
  constructor() {
    // Container that main.js will add to the world.
    this.container = new PIXI.Container();

    // Origin: tile (0,0) top-corner at (ox, oy) in local space.
    // Setting ox = ROWS * HW ensures the leftmost tile edge starts at x ≈ 0.
    this.ox = ROWS * HW;  // 30 × 32 = 960
    this.oy = 0;

    // Tile type grid  [row][col]
    this.grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setTile(col, row, type) {
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      this.grid[row][col] = type;
    }
  }

  getTile(col, row) {
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      return this.grid[row][col];
    }
    return -1;
  }

  /** Screen position of a tile's top corner (in IsometricMap local space). */
  tilePosToScreen(col, row) {
    return tileToScreen(col, row, this.ox, this.oy);
  }

  /**
   * (Re-)build the tile graphics.
   * Call once after all tile types have been set via setTile().
   * Uses the Painter's Algorithm: tiles are drawn diagonal-by-diagonal,
   * back to front, so that overlapping decorations render correctly.
   */
  build() {
    this.container.removeChildren();

    const g = new PIXI.Graphics();

    // d = col + row  (depth layer; 0 = back, max = front)
    for (let d = 0; d < COLS + ROWS - 1; d++) {
      const colMin = Math.max(0, d - ROWS + 1);
      const colMax = Math.min(d, COLS - 1);
      for (let col = colMin; col <= colMax; col++) {
        const row = d - col;
        const { x, y } = this.tilePosToScreen(col, row);
        this._drawTile(g, x, y, this.grid[row][col], col, row);
      }
    }

    this.container.addChild(g);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawTile(g, x, y, type, col, row) {
    let fill, line;

    if (type === TILE_TYPE.GRASS) {
      // Deterministic variation so neighbouring tiles differ slightly.
      fill = GRASS_VARIANTS[(col * 3 + row * 7) % GRASS_VARIANTS.length];
      line = TILE_STYLE[TILE_TYPE.GRASS].line;
    } else {
      ({ fill, line } = TILE_STYLE[type]);
    }

    g.lineStyle(1, line, 0.55);
    g.beginFill(fill);
    g.moveTo(x,      y);           // top
    g.lineTo(x + HW, y + HH);     // right
    g.lineTo(x,      y + TILE_H); // bottom
    g.lineTo(x - HW, y + HH);     // left
    g.closePath();
    g.endFill();
  }
}
