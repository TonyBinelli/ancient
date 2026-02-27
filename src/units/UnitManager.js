import * as PIXI from 'pixi.js';
import { CONFIG }    from '../config.js';
import { Fighter }   from './Fighter.js';
import { Formation } from './Formation.js';

// ── UnitManager ──────────────────────────────────────────────────────────────
export class UnitManager {
  /**
   * @param {import('../map/IsometricMap.js').IsometricMap} isoMap
   * @param {PIXI.Renderer} renderer
   */
  constructor(isoMap, renderer) {
    this.map      = isoMap;
    this.renderer = renderer;

    this.fighters   = [];
    this.formations = [];

    this.container = new PIXI.Container();
    this.container.sortableChildren = true;

    this._tex = {};   // keyed by  `${team}-${type}`

    this._buildTextures();
    this._spawnFormations();
    this._buildSprites();
  }

  // ── Per-frame sync ──────────────────────────────────────────────────────────

  syncSprites(dt) {
    const { TILE_H }   = CONFIG.MAP;
    const { DEATH_FADE } = CONFIG.BATTLE;

    for (const f of this.fighters) {
      const spr = f.sprite;
      if (!spr) continue;

      if (!f.alive) {
        if (f.deathTimer > 0) {
          f.deathTimer -= dt;
          spr.alpha = Math.max(0, f.deathTimer / DEATH_FADE);
          if (f.deathTimer <= 0) spr.visible = false;
        }
        continue;
      }

      const { x, y } = this.map.tilePosToScreen(f.col, f.row);
      spr.x      = x;
      spr.y      = y + TILE_H / 2;
      spr.zIndex = f.depth;

      if (f.hitFlash > 0) {
        f.hitFlash -= dt;
        spr.tint = f.hitFlash > 0 ? 0xff4444 : 0xffffff;
      }
    }
  }

  // ── Texture building ────────────────────────────────────────────────────────

  _buildTextures() {
    const allCfgs = [...CONFIG.ROMAN_FORMATIONS, ...CONFIG.BARBARIAN_FORMATIONS];
    for (const cfg of allCfgs) {
      const key = `${cfg.team}-${cfg.type}`;
      if (!this._tex[key]) {
        this._tex[key] = this._makeTexture(cfg.team, cfg.type);
      }
    }
  }

  /**
   * Render a small fighter icon into a RenderTexture.
   * Each unit type has a distinct silhouette:
   *   infantry  – filled circle
   *   cavalry   – wide ellipse
   *   archer    – smaller circle + arrow marker
   *   catapult  – rounded rectangle (siege machine)
   */
  _makeTexture(team, type) {
    const style = CONFIG.UNIT_STYLE[team][type] ?? CONFIG.UNIT_STYLE[team]['infantry'];
    const { fill, outline, highlight } = style;

    const W = 22, H = 26;
    const CX = 11, CY = 10, R = 8;

    const g = new PIXI.Graphics();

    // Drop-shadow on the tile surface
    g.beginFill(0x000000, 0.25);
    g.drawEllipse(CX, H - 3, R * 0.9, R * 0.3);
    g.endFill();

    g.lineStyle(1.5, outline, 0.9);
    g.beginFill(fill);

    if (type === 'catapult') {
      // Rounded rectangle – looks like a siege machine
      g.drawRoundedRect(CX - R, CY - R + 1, R * 2, R * 2 - 2, 3);
    } else if (type === 'cavalry') {
      // Wide ellipse – suggests a horse-mounted figure
      g.drawEllipse(CX, CY, R, R * 0.7);
    } else if (type === 'archer') {
      // Slightly smaller circle
      g.drawCircle(CX, CY, R - 1);
    } else {
      // Infantry: standard circle
      g.drawCircle(CX, CY, R);
    }
    g.endFill();

    // Specular highlight dot
    g.lineStyle(0);
    g.beginFill(highlight, 0.42);
    g.drawCircle(CX - 2, CY - 2, 3);
    g.endFill();

    // Archer: tiny arrow indicator
    if (type === 'archer') {
      g.lineStyle(1.5, highlight, 0.85);
      g.moveTo(CX - 4, CY + 1);
      g.lineTo(CX + 3, CY + 1);
      g.moveTo(CX + 1, CY - 1);
      g.lineTo(CX + 3, CY + 1);
      g.lineTo(CX + 1, CY + 3);
    }

    // Catapult: small wheel dots
    if (type === 'catapult') {
      g.lineStyle(0);
      g.beginFill(highlight, 0.6);
      g.drawCircle(CX - R + 3, CY + R - 4, 2);
      g.drawCircle(CX + R - 3, CY + R - 4, 2);
      g.endFill();
    }

    const rt = PIXI.RenderTexture.create({ width: W, height: H });
    this.renderer.render(g, { renderTexture: rt });
    g.destroy();
    return rt;
  }

  // ── Formation spawning ──────────────────────────────────────────────────────

  _spawnFormations() {
    const allCfgs = [...CONFIG.ROMAN_FORMATIONS, ...CONFIG.BARBARIAN_FORMATIONS];
    for (const cfg of allCfgs) {
      const fighters = [];
      for (let i = 0; i < cfg.count; i++) {
        const fc = i % cfg.cols;
        const fr = Math.floor(i / cfg.cols);
        const f  = new Fighter({
          id:          this.fighters.length,
          col:         cfg.start.col + fc * cfg.spacing,
          row:         cfg.start.row + fr * cfg.spacing,
          team:        cfg.team,
          unitType:    cfg.type,
          formationId: cfg.id,
        });
        this.fighters.push(f);
        fighters.push(f);
      }
      this.formations.push(new Formation({
        id:       cfg.id,
        label:    cfg.label,
        team:     cfg.team,
        type:     cfg.type,
        fighters,
      }));
    }
  }

  // ── Sprite building ─────────────────────────────────────────────────────────

  _buildSprites() {
    const { TILE_H } = CONFIG.MAP;
    for (const f of this.fighters) {
      const key = `${f.team}-${f.unitType}`;
      const spr = new PIXI.Sprite(this._tex[key]);
      spr.anchor.set(0.5, 0.88);
      const { x, y } = this.map.tilePosToScreen(f.col, f.row);
      spr.x      = x;
      spr.y      = y + TILE_H / 2;
      spr.zIndex = f.depth;
      f.sprite   = spr;
      this.container.addChild(spr);
    }
  }
}
