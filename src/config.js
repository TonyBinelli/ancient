/**
 * Central configuration for the battle simulation.
 * All balancing values, map dimensions and terrain layout live here.
 */
export const CONFIG = {

  SCREEN: {
    WIDTH:  window.innerWidth,
    HEIGHT: window.innerHeight,
  },

  MAP: {
    COLS:   40,   // number of tile columns
    ROWS:   30,   // number of tile rows
    TILE_W: 64,   // screen width  of one isometric tile (local coords)
    TILE_H: 32,   // screen height of one isometric tile (= TILE_W / 2)
  },

  // --- Terrain layout ---
  // Romans deploy near rows 0-4 (top), Barbarians near rows 25-29 (bottom).
  // Forests provide natural cover on both flanks.
  // The pond sits at the bottom-left edge as impassable water.
  TERRAIN: {
    // Forest clusters: { col, row, cols, rows }
    FORESTS: [
      { col:  3, row:  3, cols: 5, rows: 3 },   // top-left  (near Roman lines)
      { col:  9, row: 13, cols: 3, rows: 4 },   // center-left flank
      { col: 28, row:  3, cols: 5, rows: 3 },   // top-right (near Roman lines)
      { col: 26, row: 19, cols: 4, rows: 4 },   // center-right flank
      { col: 19, row:  9, cols: 3, rows: 2 },   // center obstacle
    ],
    // Pond: { col, row, cols, rows }
    POND: { col: 1, row: 22, cols: 7, rows: 6 },
  },

  // ── Starting formations ──────────────────────────────────────────────────
  // Fighters are placed in a rectangular grid: COUNT fighters,
  // COLS wide, spaced SPACING tile-units apart.
  // Romans deploy near rows 1–7 (top), Barbarians near rows 22–28 (bottom).
  // The centre of each formation is aligned on col ≈ 20 (map centre-x).
  // ── Combat tuning ────────────────────────────────────────────────────────
  BATTLE: {
    MARCH_SPEED:     2.2,   // tile-units per second while marching / closing gap
    SEP_RADIUS:      0.85,  // tile-units – personal-space bubble between fighters
    SEP_FORCE:       0.6,   // blend weight: separation vs. seek
    ENGAGE_RANGE:    1.0,   // tile-units – switch from march→combat on contact
    ATTACK_RANGE:    0.9,   // tile-units – melee strike reach
    ATTACK_COOLDOWN: 1.3,   // seconds between successive attacks
    MIN_DAMAGE:      18,    // HP lost per hit (inclusive range)
    MAX_DAMAGE:      28,
    CELL_SIZE:       1.5,   // spatial-grid cell size in tile-units
    HIT_FLASH:       0.15,  // seconds of red tint on a hit
    DEATH_FADE:      0.6,   // seconds for a dead fighter to fade to invisible
  },

  UNITS: {
    ROMAN: {
      COUNT:   200,
      COLS:    25,      // fighters per row
      SPACING: 0.75,    // tile-units between fighters
      START:   { col: 11.0, row: 1.0 },
    },
    BARBARIAN: {
      COUNT:   200,
      COLS:    27,
      SPACING: 0.75,
      START:   { col: 10.0, row: 22.5 },
    },
  },

};
