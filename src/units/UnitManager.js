import * as PIXI from 'pixi.js';
import { CONFIG }  from '../config.js';
import { Fighter } from './Fighter.js';

// ── Per-team visual style ────────────────────────────────────────────────────
const TEAM_STYLE = {
  roman: {
    fill:      0xcc1e1e,
    outline:   0x7a0808,
    highlight: 0xff8080,
  },
  barbarian: {
    fill:      0x2244cc,
    outline:   0x0c1e77,
    highlight: 0x88aaff,
  },
};

// ── UnitManager ──────────────────────────────────────────────────────────────
export class UnitManager {
  /**
   * @param {import('../map/IsometricMap.js').IsometricMap} isoMap
   * @param {PIXI.Renderer} renderer
   */
  constructor(isoMap, renderer) {
    this.map      = isoMap;
    this.renderer = renderer;

    /** All Fighter instances. */
    this.fighters = [];

    /** PixiJS container added to the world by main.js. */
    this.container = new PIXI.Container();
    // Enable PixiJS auto-sort by sprite.zIndex each render frame.
    this.container.sortableChildren = true;

    this._tex = {};  // { roman: RenderTexture, barbarian: RenderTexture }

    this._buildTextures();
    this._spawnAll();
    this._buildSprites();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Sync every sprite's position, z-order, tint, and alpha from fighter data.
   * Call once per frame after BattleManager.update().
   *
   *   • Position / depth  (fighters that moved)
   *   • Hit-flash tint    (brief red blink on damage)
   *   • Death fade-out    (alpha → 0 over DEATH_FADE seconds, then hidden)
   *
   * @param {number} dt  seconds since last frame
   */
  syncSprites(dt) {
    const { TILE_H }     = CONFIG.MAP;
    const { DEATH_FADE } = CONFIG.BATTLE;

    for (const f of this.fighters) {
      const spr = f.sprite;
      if (!spr) continue;

      // Dead fighter: fade out then hide.
      if (!f.alive) {
        if (f.deathTimer > 0) {
          f.deathTimer -= dt;
          spr.alpha = Math.max(0, f.deathTimer / DEATH_FADE);
          if (f.deathTimer <= 0) spr.visible = false;
        }
        continue;
      }

      // Alive fighter: sync position and depth.
      const { x, y } = this.map.tilePosToScreen(f.col, f.row);
      spr.x      = x;
      spr.y      = y + TILE_H / 2;
      spr.zIndex = f.depth;

      // Hit-flash tint: red → white.
      if (f.hitFlash > 0) {
        f.hitFlash -= dt;
        spr.tint = f.hitFlash > 0 ? 0xff4444 : 0xffffff;
      }
    }
  }

  // ── Private: textures ──────────────────────────────────────────────────────

  _buildTextures() {
    for (const team of ['roman', 'barbarian']) {
      this._tex[team] = this._makeTexture(team);
    }
  }

  /**
   * Render a small fighter icon into a RenderTexture.
   *
   * Layout (W=20, H=24):
   *   • Shadow ellipse at y≈21 (ground level)
   *   • Body circle   centred at (10, 9)
   *   • Highlight dot at (7, 6)
   *
   * Sprite anchor will be set to (0.5, ~0.88) so that the shadow
   * sits exactly on the tile's ground-centre point.
   */
  _makeTexture(team) {
    const { fill, outline, highlight } = TEAM_STYLE[team];
    const W = 20, H = 24;
    const CX = 10, CY = 9, R = 8;

    const g = new PIXI.Graphics();

    // Drop-shadow on the tile surface
    g.beginFill(0x000000, 0.22);
    g.drawEllipse(CX, H - 3, R * 0.85, R * 0.28);
    g.endFill();

    // Body
    g.lineStyle(1.5, outline, 0.9);
    g.beginFill(fill);
    g.drawCircle(CX, CY, R);
    g.endFill();

    // Specular highlight
    g.lineStyle(0);
    g.beginFill(highlight, 0.38);
    g.drawCircle(CX - 2, CY - 2, 3);
    g.endFill();

    // Render into a fixed-size texture so bounds are deterministic.
    const rt = PIXI.RenderTexture.create({ width: W, height: H });
    this.renderer.render(g, { renderTexture: rt });
    g.destroy();
    return rt;
  }

  // ── Private: spawning ──────────────────────────────────────────────────────

  _spawnAll() {
    this._spawnFormation('roman',     CONFIG.UNITS.ROMAN);
    this._spawnFormation('barbarian', CONFIG.UNITS.BARBARIAN);
  }

  /**
   * Place fighters in a rectangular grid formation.
   * Fighters are spaced SPACING tile-units apart, laid out row-first.
   */
  _spawnFormation(team, cfg) {
    const { COUNT, COLS, SPACING, START } = cfg;
    for (let i = 0; i < COUNT; i++) {
      const fc = i % COLS;
      const fr = Math.floor(i / COLS);
      this.fighters.push(new Fighter({
        id:  this.fighters.length,
        col: START.col + fc * SPACING,
        row: START.row + fr * SPACING,
        team,
      }));
    }
  }

  // ── Private: sprites ───────────────────────────────────────────────────────

  _buildSprites() {
    const { TILE_H } = CONFIG.MAP;

    for (const f of this.fighters) {
      const spr = new PIXI.Sprite(this._tex[f.team]);

      // Anchor: horizontal centre, and 88 % down so the shadow sits
      // on the tile's ground-centre (= tilePosToScreen + TILE_H/2).
      spr.anchor.set(0.5, 0.88);

      const { x, y } = this.map.tilePosToScreen(f.col, f.row);
      spr.x = x;
      spr.y = y + TILE_H / 2;   // ground-centre of the tile

      spr.zIndex = f.depth;

      f.sprite = spr;
      this.container.addChild(spr);
    }
  }
}
