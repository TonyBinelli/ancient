/**
 * Formation – a named group of fighters that share a tactical order.
 * Romans start on 'hold'; Barbarians start on 'advance'.
 */
export class Formation {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.label        display name
   * @param {'roman'|'barbarian'} opts.team
   * @param {string} opts.type         unit type key
   * @param {import('./Fighter.js').Fighter[]} opts.fighters
   */
  constructor({ id, label, team, type, fighters }) {
    this.id       = id;
    this.label    = label;
    this.team     = team;
    this.type     = type;
    this.fighters = fighters;

    /** 'hold' = stay in place (fight back); 'advance' = march toward enemy. */
    this.order = team === 'roman' ? 'hold' : 'advance';
  }

  get aliveFighters() {
    return this.fighters.filter(f => f.alive);
  }

  get count() {
    return this.aliveFighters.length;
  }

  get isAlive() {
    return this.count > 0;
  }

  /** Average tile position of surviving fighters. */
  get centroid() {
    const alive = this.aliveFighters;
    if (alive.length === 0) return null;
    const col = alive.reduce((s, f) => s + f.col, 0) / alive.length;
    const row = alive.reduce((s, f) => s + f.row, 0) / alive.length;
    return { col, row };
  }
}
