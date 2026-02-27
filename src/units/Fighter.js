/**
 * Fighter – data model for a single combatant.
 * Pure data; no PixiJS dependency.
 */
import { CONFIG } from '../config.js';

export class Fighter {
  /**
   * @param {object} opts
   * @param {number} opts.id
   * @param {number} opts.col
   * @param {number} opts.row
   * @param {'roman'|'barbarian'} opts.team
   * @param {'infantry'|'cavalry'|'archer'|'catapult'} opts.unitType
   * @param {string} opts.formationId
   */
  constructor({ id, col, row, team, unitType = 'infantry', formationId = null }) {
    this.id          = id;
    this.col         = col;
    this.row         = row;
    this.team        = team;
    this.unitType    = unitType;
    this.formationId = formationId;

    // ── Per-type stats from config ───────────────────────────────────────────
    const s = CONFIG.UNIT_STATS[unitType];
    this.maxHp       = s.hp;
    this.hp          = s.hp;
    this.speed       = s.speed;
    this.attackRange = s.attackRange;
    this.cooldown    = s.cooldown;
    this.damageMin   = s.damageMin;
    this.damageMax   = s.damageMax;
    this.attackType  = s.attackType;          // 'melee' | 'ranged' | 'splash'
    this.splashRadius = s.splashRadius ?? 0;

    // ── Battle state ─────────────────────────────────────────────────────────
    this.alive        = true;
    this.state        = 'idle';               // 'idle' | 'march' | 'combat'
    this.combatTarget = null;
    this.attackTimer  = 0;

    // ── Visual signals (read by UnitManager.syncSprites) ────────────────────
    this.hitFlash   = 0;
    this.deathTimer = 0;
    this.sprite     = null;
  }

  get depth() { return this.col + this.row; }
}
