/**
 * Fighter – data model for a single combatant.
 * Pure data; no PixiJS dependency.
 */
export class Fighter {
  /**
   * @param {object} opts
   * @param {number} opts.id
   * @param {number} opts.col   – continuous tile column (float)
   * @param {number} opts.row   – continuous tile row    (float)
   * @param {'roman'|'barbarian'} opts.team
   */
  constructor({ id, col, row, team }) {
    this.id   = id;
    this.col  = col;
    this.row  = row;
    this.team = team;

    // ── Vitals ──────────────────────────────────────────────────────────────
    this.hp    = 100;
    this.maxHp = 100;
    this.alive = true;

    // ── Battle state ─────────────────────────────────────────────────────────
    /** 'idle' | 'march' | 'combat' */
    this.state = 'idle';

    /** Currently targeted enemy Fighter, or null. */
    this.combatTarget = null;

    /** Seconds until next attack is allowed. */
    this.attackTimer = 0;

    // ── Visual signals (read by UnitManager.syncSprites) ────────────────────
    /** Seconds remaining for red hit-flash tint. Set by BattleManager. */
    this.hitFlash = 0;

    /** Seconds remaining for death fade-out. Set by BattleManager on death. */
    this.deathTimer = 0;

    /** PIXI.Sprite – set by UnitManager after sprite creation. */
    this.sprite = null;
  }

  /** Isometric depth: larger = visually in front. Used for z-ordering. */
  get depth() { return this.col + this.row; }
}
