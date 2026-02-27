/**
 * BattleManager – pure game-logic core.
 * No PixiJS dependency; reads and writes Fighter / Formation data only.
 *
 * Phases:
 *   READY  – armies in formation, waiting for start()
 *   MARCH  – fighters advance and fight
 *   DONE   – one side wiped out, onVictory callback fired
 *
 * Formation orders:
 *   'hold'    – fighter stands still; attacks any enemy that enters range
 *   'advance' – fighter marches toward the enemy; switches to combat on contact
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
   * @param {import('../units/Formation.js').Formation[]} formations
   * @param {import('../map/IsometricMap.js').IsometricMap} isoMap
   * @param {(winner: 'roman'|'barbarian') => void} onVictory
   */
  constructor(formations, isoMap, onVictory) {
    this.formations = formations;
    this.fighters   = formations.flatMap(fm => fm.fighters);
    this.map        = isoMap;
    this._onVictory = onVictory;
    this.phase      = 'READY';

    // O(1) formation lookup by id
    this._formMap = new Map(formations.map(fm => [fm.id, fm]));

    // Survivor counts, decremented on each death
    this._counts = {
      roman:     this.fighters.filter(f => f.team === 'roman').length,
      barbarian: this.fighters.filter(f => f.team === 'barbarian').length,
    };

    this._grid = new Map();
  }

  get counts() { return this._counts; }

  start() {
    for (const f of this.fighters) f.state = 'march';
    this.phase = 'MARCH';
  }

  update(dt) {
    if (this.phase !== 'MARCH') return;

    this._buildGrid();

    const romans     = this.fighters.filter(f => f.team === 'roman'     && f.alive);
    const barbarians = this.fighters.filter(f => f.team === 'barbarian' && f.alive);
    const romanCtr      = romans.length     ? centroid(romans)     : null;
    const barbarianCtr  = barbarians.length ? centroid(barbarians) : null;

    for (const f of this.fighters) {
      if (!f.alive) continue;

      const enemyCtr  = f.team === 'roman' ? barbarianCtr : romanCtr;
      const formation = this._formMap.get(f.formationId);
      const isHolding = formation?.order === 'hold';

      if (f.state === 'combat') {
        this._doCombat(f, dt, isHolding);
      } else {
        // 'march' or 'idle' – either march or hold in place
        if (isHolding) {
          this._doHold(f, dt);
        } else {
          if (enemyCtr) this._doMarch(f, enemyCtr, dt);
        }
      }
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

  // ── Hold (stand still, fight back) ───────────────────────────────────────

  _doHold(f, dt) {
    // Tick attack timer even while holding
    f.attackTimer -= dt;

    // Look for an enemy that wandered into attack range
    const target = this._nearestEnemy(f, f.attackRange * 1.5);
    if (target) {
      f.state        = 'combat';
      f.combatTarget = target;
      // Stagger first attack
      if (f.attackTimer > 0) f.attackTimer = Math.random() * f.cooldown * 0.5;
    }
  }

  // ── March ─────────────────────────────────────────────────────────────────

  _doMarch(f, enemyCtr, dt) {
    // Seek toward enemy centroid
    let seekDc = enemyCtr.col - f.col;
    let seekDr = enemyCtr.row - f.row;
    const seekLen = Math.sqrt(seekDc * seekDc + seekDr * seekDr);
    if (seekLen > 0) { seekDc /= seekLen; seekDr /= seekLen; }

    // Separation + engagement detection
    const maxR = Math.max(BATTLE.SEP_RADIUS, f.attackRange);
    let sepDc = 0, sepDr = 0;
    let closestEnemy = null;
    let closestD2    = f.attackRange * f.attackRange;   // per-unit range

    for (const o of this._getNearby(f, maxR)) {
      if (!o.alive) continue;
      const ddc = f.col - o.col;
      const ddr = f.row - o.row;
      const d2  = ddc * ddc + ddr * ddr;

      // Separation from all nearby fighters
      if (d2 < BATTLE.SEP_RADIUS * BATTLE.SEP_RADIUS && d2 > 0) {
        const d = Math.sqrt(d2);
        const w = 1.0 - d / BATTLE.SEP_RADIUS;
        sepDc += (ddc / d) * w;
        sepDr += (ddr / d) * w;
      }

      // Nearest enemy within this unit's attack range
      if (o.team !== f.team && d2 < closestD2) {
        closestD2    = d2;
        closestEnemy = o;
      }
    }

    // Blend seek + separation
    let vx = seekDc + sepDc * BATTLE.SEP_FORCE;
    let vy = seekDr + sepDr * BATTLE.SEP_FORCE;
    const vlen = Math.sqrt(vx * vx + vy * vy);
    if (vlen > 0) { vx /= vlen; vy /= vlen; }

    // Terrain-aware step (skip water)
    const nc = f.col + vx * f.speed * dt;
    const nr = f.row + vy * f.speed * dt;
    if (this.map.getTile(Math.round(nc), Math.round(nr)) !== TILE_TYPE.WATER) {
      f.col = nc;
      f.row = nr;
    }

    // Switch to combat if enemy detected in range
    if (closestEnemy) {
      f.state        = 'combat';
      f.combatTarget = closestEnemy;
      f.attackTimer  = Math.random() * f.cooldown * 0.5;
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────────

  _doCombat(f, dt, isHolding) {
    // Refresh stale or dead target
    if (!f.combatTarget?.alive) {
      f.combatTarget = this._nearestEnemy(f, f.attackRange * 2.0);
      if (!f.combatTarget) {
        f.state = 'march';
        return;
      }
    }

    const e  = f.combatTarget;
    const dc = e.col - f.col;
    const dr = e.row - f.row;
    const d  = Math.sqrt(dc * dc + dr * dr);

    // Melee units close the gap; ranged/splash units stand still
    if (f.attackType === 'melee' && !isHolding && d > f.attackRange) {
      const s = f.speed * 0.55 * dt / d;
      f.col += dc * s;
      f.row += dr * s;
    }

    // If target drifted out of maximum range, release it
    if (d > f.attackRange * 2.5) {
      f.combatTarget = null;
      f.state = 'march';
      return;
    }

    // Attack tick
    f.attackTimer -= dt;
    if (f.attackTimer <= 0 && d <= f.attackRange) {
      f.attackTimer = f.cooldown;

      if (f.attackType === 'splash') {
        this._doSplashAttack(f, e);
      } else {
        this._doHit(f, e);
      }
    }
  }

  // ── Attack helpers ────────────────────────────────────────────────────────

  _doHit(attacker, target) {
    const dmg = attacker.damageMin
              + Math.random() * (attacker.damageMax - attacker.damageMin);
    target.hp      -= dmg;
    target.hitFlash = BATTLE.HIT_FLASH;
    if (target.hp <= 0) this._kill(target, attacker);
  }

  /** Catapult splash: damages all enemies within splashRadius of the target. */
  _doSplashAttack(attacker, target) {
    const r2 = attacker.splashRadius * attacker.splashRadius;
    for (const victim of this._getNearby(target, attacker.splashRadius + 1)) {
      if (victim.team === attacker.team || !victim.alive) continue;
      if (dist2(victim, target) > r2) continue;
      const dmg = attacker.damageMin
                + Math.random() * (attacker.damageMax - attacker.damageMin);
      victim.hp      -= dmg;
      victim.hitFlash = BATTLE.HIT_FLASH * 2;
      if (victim.hp <= 0) this._kill(victim, attacker);
    }
  }

  _kill(fighter, attacker) {
    fighter.alive        = false;
    fighter.hp           = 0;
    fighter.hitFlash     = 0;
    fighter.deathTimer   = BATTLE.DEATH_FADE;
    if (attacker.combatTarget === fighter) attacker.combatTarget = null;
    this._counts[fighter.team]--;
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
