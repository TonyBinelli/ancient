/**
 * Central configuration for the battle simulation.
 */
export const CONFIG = {

  SCREEN: {
    WIDTH:  window.innerWidth,
    HEIGHT: window.innerHeight,
  },

  MAP: {
    COLS:   40,
    ROWS:   30,
    TILE_W: 64,
    TILE_H: 32,
  },

  TERRAIN: {
    FORESTS: [
      { col:  3, row:  3, cols: 5, rows: 3 },
      { col:  9, row: 13, cols: 3, rows: 4 },
      { col: 28, row:  3, cols: 5, rows: 3 },
      { col: 26, row: 19, cols: 4, rows: 4 },
      { col: 19, row:  9, cols: 3, rows: 2 },
    ],
    POND: { col: 1, row: 22, cols: 7, rows: 6 },
  },

  // ── Combat tuning ────────────────────────────────────────────────────────
  BATTLE: {
    SEP_RADIUS:   0.85,
    SEP_FORCE:    0.6,
    ENGAGE_RANGE: 1.0,   // for melee engage detection
    CELL_SIZE:    1.5,
    HIT_FLASH:    0.15,
    DEATH_FADE:   0.6,
  },

  // ── Per unit-type stats ──────────────────────────────────────────────────
  UNIT_STATS: {
    infantry: { hp: 100, speed: 2.2, attackRange: 0.9, cooldown: 1.3, damageMin: 18, damageMax: 28, attackType: 'melee'  },
    cavalry:  { hp: 120, speed: 4.0, attackRange: 1.0, cooldown: 1.0, damageMin: 20, damageMax: 32, attackType: 'melee'  },
    archer:   { hp:  70, speed: 1.8, attackRange: 4.5, cooldown: 2.0, damageMin: 10, damageMax: 18, attackType: 'ranged' },
    catapult: { hp: 200, speed: 0.8, attackRange: 7.0, cooldown: 5.0, damageMin: 50, damageMax: 80, attackType: 'splash', splashRadius: 1.8 },
  },

  // ── Visual style per team + type ─────────────────────────────────────────
  UNIT_STYLE: {
    roman: {
      infantry: { fill: 0x1a3a8f, outline: 0x0a1e5c, highlight: 0x6699ff },
      cavalry:  { fill: 0x2266cc, outline: 0x0e2d6a, highlight: 0x88bbff },
      archer:   { fill: 0x336699, outline: 0x1a3355, highlight: 0x77ccdd },
      catapult: { fill: 0x4455aa, outline: 0x222c66, highlight: 0x99bbee },
    },
    barbarian: {
      infantry: { fill: 0xcc1e1e, outline: 0x7a0808, highlight: 0xff8080 },
    },
  },

  // ── Roman formations (hold by default, player-controlled) ───────────────
  // 5 fighters wide, 1.2-tile spacing → 4 rows for 20 fighters
  ROMAN_FORMATIONS: [
    { id: 'rom-inf', label: 'Legionäre',     team: 'roman', type: 'infantry', count: 20, cols: 5, spacing: 1.2, start: { col:  2, row: 1 } },
    { id: 'rom-cav', label: 'Reiter',         team: 'roman', type: 'cavalry',  count: 20, cols: 5, spacing: 1.2, start: { col: 10, row: 1 } },
    { id: 'rom-arc', label: 'Bogenschützen',  team: 'roman', type: 'archer',   count: 20, cols: 5, spacing: 1.2, start: { col: 19, row: 1 } },
    { id: 'rom-cat', label: 'Katapulte',      team: 'roman', type: 'catapult', count:  5, cols: 5, spacing: 2.0, start: { col: 30, row: 1 } },
  ],

  // ── Barbarian formations (always advance) ────────────────────────────────
  // Start at row 24, col 9+ to avoid pond (cols 1-7, rows 22-27)
  BARBARIAN_FORMATIONS: [
    { id: 'barb-1', label: 'Krieger I',   team: 'barbarian', type: 'infantry', count: 20, cols: 5, spacing: 1.2, start: { col:  9, row: 24 } },
    { id: 'barb-2', label: 'Krieger II',  team: 'barbarian', type: 'infantry', count: 20, cols: 5, spacing: 1.2, start: { col: 17, row: 24 } },
    { id: 'barb-3', label: 'Krieger III', team: 'barbarian', type: 'infantry', count: 20, cols: 5, spacing: 1.2, start: { col: 25, row: 24 } },
    { id: 'barb-4', label: 'Krieger IV',  team: 'barbarian', type: 'infantry', count: 20, cols: 5, spacing: 1.2, start: { col: 33, row: 24 } },
  ],
};
