/**
 * BattleManager – pure game-logic core.
 * No PixiJS dependency; reads and writes Fighter data only.
 *
 * Phases:
 *   READY  – armies in formation, waiting for start()
 *   MARCH  – fighters advance and fight
 *   DONE   – one side wiped out, onVictory callback fired
 */
import { CONFIG }    from '../config.js';
import { TILE_TYPE } from '../map/IsometricMap.js';

const { BATTLE } = CONFIG;
const CELL = BATTLE.CELL_SIZE;

// ── Helpers ───────────────────────────────────────────────────────────────────
function dist2(a, b) {
  const dc = a.col - b.col;
  const dr = a.row - b.row;
  return dc * dc + dr * dr;
}

function centroid(list) {
  let sc = 0, sr = 0;
  for (const f of list) { sc += f.col; sr += f.row; }
  return { col: sc / list.length, row: sr / list.length };
}

// ── BattleManager ─────────────────────────────────────────────────────────────
export class BattleManager {
  /**
   * @param {import('../units/Fighter.js').Fighter[]} fighters
   * @param {import('../map/IsometricMap.js').IsometricMap} isoMap
   * @param {(winner: 'roman'|'barbarian') => void} onVictory
   */
  constructor(fighters, isoMap, onVictory) {
    this.fighters   = fighters;
    this.map        = isoMap;
    this._onVictory = onVictory;
    this.phase      = 'READY';

    // O(1) survivor counts; decremented on each death.
    this._counts = {
      roman:     fighters.filter(f => f.team === 'roman').length,
      barbarian: fighters.filter(f => f.team === 'barbarian').length,
    };

    this._grid = new Map();   // spatial hash: "cx,cy" → Fighter[]
  }

  get counts() { return this._counts; }

  start() {
    for (const f of this.fighters) f.state = 'march';
    this.phase = 'MARCH';
  }

  /**
   * Advance simulation by one frame.
   * @param {number} dt  seconds since last frame
   */
  update(dt) {
    if (this.phase !== 'MARCH') return;

    this._buildGrid();

    // Enemy centroids computed once; all fighters of a team aim at the same point.
    const romans     = this.fighters.filter(f => f.team === 'roman'     && f.alive);
    const barbarians = this.fighters.filter(f => f.team === 'barbarian' && f.alive);
    const romanCtr      = romans.length     ? centroid(romans)     : null;
    const barbarianCtr  = barbarians.length ? centroid(barbarians) : null;

    for (const f of this.fighters) {
      if (!f.alive) continue;

      const enemyCtr = f.team === 'roman' ? barbarianCtr : romanCtr;
      if (!enemyCtr) continue;

      if      (f.state === 'march')  this._doMarch(f, enemyCtr, dt);
      else if (f.state === 'combat') this._doCombat(f, dt);
    }

    this._checkVictory();
  }

  // ── Spatial grid ──────────────────────────────────────────────────────────

  _buildGrid() {
    this._grid.clear();
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const key = `${(f.col / CELL) | 0},${(f.row / CELL) | 0}`;
      let cell = this._grid.get(key);
      if (!cell) { cell = []; this._grid.set(key, cell); }
      cell.push(f);
    }
  }

  _getNearby(f, radius) {
    const cr = (radius / CELL + 1) | 0;
    const cx = (f.col  / CELL) | 0;
    const cy = (f.row  / CELL) | 0;
    const out = [];
    for (let dx = -cr; dx <= cr; dx++) {
      for (let dy = -cr; dy <= cr; dy++) {
        const cell = this._grid.get(`${cx + dx},${cy + dy}`);
        if (cell) for (const o of cell) if (o !== f) out.push(o);
      }
    }
    return out;
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  _doMarch(f, enemyCtr, dt) {
    // Seek toward enemy centroid (unit vector).
    let seekDc = enemyCtr.col - f.col;
    let seekDr = enemyCtr.row - f.row;
    const seekLen = Math.sqrt(seekDc * seekDc + seekDr * seekDr);
    if (seekLen > 0) { seekDc /= seekLen; seekDr /= seekLen; }

    // One neighbour pass: separation + engagement detection.
    const maxR = Math.max(BATTLE.SEP_RADIUS, BATTLE.ENGAGE_RANGE);
    let sepDc = 0, sepDr = 0;
    let closestEnemy = null;
    let closestD2    = BATTLE.ENGAGE_RANGE * BATTLE.ENGAGE_RANGE;

    for (const o of this._getNearby(f, maxR)) {
      if (!o.alive) continue;
      const ddc = f.col - o.col;
      const ddr = f.row - o.row;
      const d2  = ddc * ddc + ddr * ddr;

      // Separation from ALL nearby fighters.
      if (d2 < BATTLE.SEP_RADIUS * BATTLE.SEP_RADIUS && d2 > 0) {
        const d = Math.sqrt(d2);
        const w = 1.0 - d / BATTLE.SEP_RADIUS;
        sepDc += (ddc / d) * w;
        sepDr += (ddr / d) * w;
      }

      // Nearest enemy within engage range.
      if (o.team !== f.team && d2 < closestD2) {
        closestD2    = d2;
        closestEnemy = o;
      }
    }

    // Blend seek + separation, then normalise to constant speed.
    let vx = seekDc + sepDc * BATTLE.SEP_FORCE;
    let vy = seekDr + sepDr * BATTLE.SEP_FORCE;
    const vlen = Math.sqrt(vx * vx + vy * vy);
    if (vlen > 0) { vx /= vlen; vy /= vlen; }

    // Terrain-aware step: skip water tiles.
    const nc = f.col + vx * BATTLE.MARCH_SPEED * dt;
    const nr = f.row + vy * BATTLE.MARCH_SPEED * dt;
    if (this.map.getTile(Math.round(nc), Math.round(nr)) !== TILE_TYPE.WATER) {
      f.col = nc;
      f.row = nr;
    }

    // Engage if an enemy is in range.
    if (closestEnemy) {
      f.state        = 'combat';
      f.combatTarget = closestEnemy;
      // Stagger first attack so not everyone swings at the same instant.
      f.attackTimer  = Math.random() * BATTLE.ATTACK_COOLDOWN * 0.5;
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────────

  _doCombat(f, dt) {
    // Refresh stale or dead target.
    if (!f.combatTarget?.alive) {
      f.combatTarget = this._nearestEnemy(f, BATTLE.ENGAGE_RANGE * 2.5);
      if (!f.combatTarget) { f.state = 'march'; return; }
    }

    const e  = f.combatTarget;
    const dc = e.col - f.col;
    const dr = e.row - f.row;
    const d  = Math.sqrt(dc * dc + dr * dr);

    // Close the gap if target drifted out of attack range.
    if (d > BATTLE.ATTACK_RANGE) {
      const s = BATTLE.MARCH_SPEED * 0.55 * dt / d;
      f.col += dc * s;
      f.row += dr * s;
    }

    // Attack tick.
    f.attackTimer -= dt;
    if (f.attackTimer <= 0 && d <= BATTLE.ATTACK_RANGE) {
      f.attackTimer = BATTLE.ATTACK_COOLDOWN;

      const dmg  = BATTLE.MIN_DAMAGE
                 + Math.random() * (BATTLE.MAX_DAMAGE - BATTLE.MIN_DAMAGE);
      e.hp      -= dmg;
      e.hitFlash = BATTLE.HIT_FLASH;

      if (e.hp <= 0) {
        e.alive        = false;
        e.hp           = 0;
        e.hitFlash     = 0;          // clear flash so death-fade is clean
        e.deathTimer   = BATTLE.DEATH_FADE;
        f.combatTarget = null;
        this._counts[e.team]--;
      }
    }
  }

  _nearestEnemy(f, maxRange) {
    let best = null, bestD2 = maxRange * maxRange;
    for (const o of this._getNearby(f, maxRange)) {
      if (o.team === f.team || !o.alive) continue;
      const d2 = dist2(f, o);
      if (d2 < bestD2) { bestD2 = d2; best = o; }
    }
    return best;
  }

  // ── Victory ───────────────────────────────────────────────────────────────

  _checkVictory() {
    if (this._counts.roman <= 0 || this._counts.barbarian <= 0) {
      this.phase = 'DONE';
      const winner = this._counts.roman > 0 ? 'roman' : 'barbarian';
      this._onVictory?.(winner);
    }
  }
}
