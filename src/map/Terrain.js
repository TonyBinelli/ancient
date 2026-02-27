import * as PIXI from 'pixi.js';
import { CONFIG } from '../config.js';
import { TILE_TYPE } from './IsometricMap.js';

const { COLS, ROWS, TILE_W, TILE_H } = CONFIG.MAP;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export class Terrain {
  /**
   * @param {import('./IsometricMap.js').IsometricMap} isoMap
   */
  constructor(isoMap) {
    this.map = isoMap;
    // Separate container so decorations draw above the tile layer.
    this.container = new PIXI.Container();
    this._placeTiles();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Build decoration graphics (trees, water ripples).
   * Must be called AFTER isoMap.build() so it renders on top.
   * Respects the same diagonal (Painter's Algorithm) draw order.
   */
  buildDecorations() {
    this.container.removeChildren();
    const g = new PIXI.Graphics();

    for (let d = 0; d < COLS + ROWS - 1; d++) {
      const colMin = Math.max(0, d - ROWS + 1);
      const colMax = Math.min(d, COLS - 1);
      for (let col = colMin; col <= colMax; col++) {
        const row  = d - col;
        const type = this.map.getTile(col, row);
        const { x, y } = this.map.tilePosToScreen(col, row);

        if (type === TILE_TYPE.FOREST) {
          // cy = visual "ground centre" of the tile
          this._drawTree(g, x, y + HH, col, row);
        } else if (type === TILE_TYPE.WATER) {
          this._drawWaterDetail(g, x, y);
        }
      }
    }

    this.container.addChild(g);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Write terrain tile types into the map grid. */
  _placeTiles() {
    for (const f of CONFIG.TERRAIN.FORESTS) {
      for (let dc = 0; dc < f.cols; dc++) {
        for (let dr = 0; dr < f.rows; dr++) {
          this.map.setTile(f.col + dc, f.row + dr, TILE_TYPE.FOREST);
        }
      }
    }

    const p = CONFIG.TERRAIN.POND;
    for (let dc = 0; dc < p.cols; dc++) {
      for (let dr = 0; dr < p.rows; dr++) {
        this.map.setTile(p.col + dc, p.row + dr, TILE_TYPE.WATER);
      }
    }
  }

  /**
   * Draw a stylised isometric tree centred at (cx, cy).
   * Slight size and colour variation is derived deterministically from
   * the tile's grid position so the forest looks organic.
   *
   * @param {PIXI.Graphics} g
   * @param {number} cx  - centre-x of the tile (top corner x)
   * @param {number} cy  - ground-centre-y of the tile  (top-y + HH)
   */
  _drawTree(g, cx, cy, col, row) {
    // Cheap deterministic hash for visual variation
    const hash      = (col * 1234 + row * 5678) & 0xffff;
    const trunkH    = 14 + (hash % 6);          // 14–19 px
    const canopyRx  = 16 + ((hash >> 4) % 5);   // 16–20 px
    const canopyRy  = Math.round(canopyRx * 0.68);

    // Soft drop-shadow
    g.lineStyle(0);
    g.beginFill(0x000000, 0.18);
    g.drawEllipse(cx, cy + 1, canopyRx * 0.75, canopyRx * 0.28);
    g.endFill();

    // Trunk
    g.beginFill(0x6b4226);
    g.drawRect(cx - 3, cy - trunkH, 6, trunkH);
    g.endFill();

    // Lower canopy (darkest)
    g.beginFill(0x2a6010);
    g.drawEllipse(cx, cy - trunkH - canopyRy * 0.5, canopyRx, canopyRy);
    g.endFill();

    // Middle canopy
    g.beginFill(0x3a7a18);
    g.drawEllipse(cx, cy - trunkH - canopyRy * 1.3, canopyRx * 0.78, canopyRy * 0.78);
    g.endFill();

    // Top canopy (lightest, smallest)
    g.beginFill(0x4c9422);
    g.drawEllipse(cx, cy - trunkH - canopyRy * 2.0, canopyRx * 0.55, canopyRy * 0.55);
    g.endFill();

    // Specular highlight
    g.beginFill(0x78c040, 0.35);
    g.drawEllipse(cx - 3, cy - trunkH - canopyRy * 2.2, canopyRx * 0.22, canopyRy * 0.22);
    g.endFill();
  }

  /**
   * Draw subtle ripple lines on a water tile.
   * @param {PIXI.Graphics} g
   * @param {number} x  - top corner x of the tile
   * @param {number} y  - top corner y of the tile
   */
  _drawWaterDetail(g, x, y) {
    const cx = x;
    const cy = y + HH;   // vertical centre of the tile

    // Two small horizontal squiggles suggesting a reflection
    g.lineStyle(1, 0x70c0e0, 0.45);
    g.moveTo(cx - 8, cy - 3);
    g.lineTo(cx + 8, cy - 3);

    g.moveTo(cx - 5, cy + 3);
    g.lineTo(cx + 5, cy + 3);

    g.lineStyle(0);
  }
}
