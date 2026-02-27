/**
 * main.js  –  Entry point for the Ancient Battle Simulation.
 *
 * Step 1 scope: isometric map with terrain (grass, forests, pond).
 * Camera: drag to pan, scroll-wheel to zoom.
 */
import * as PIXI from 'pixi.js';
import { CONFIG }        from './config.js';
import { IsometricMap }  from './map/IsometricMap.js';
import { Terrain }       from './map/Terrain.js';
import { UnitManager }   from './units/UnitManager.js';
import { BattleManager } from './battle/BattleManager.js';

// ── PixiJS application ───────────────────────────────────────────────────────
const app = new PIXI.Application({
  width:           CONFIG.SCREEN.WIDTH,
  height:          CONFIG.SCREEN.HEIGHT,
  backgroundColor: 0x2a4a18,   // dark green – visible only outside the map
  antialias:       true,
  resolution:      window.devicePixelRatio || 1,
  autoDensity:     true,
});
document.body.appendChild(app.view);

// ── World container – everything in the game lives here ──────────────────────
const world = new PIXI.Container();
app.stage.addChild(world);

// ── Build map ────────────────────────────────────────────────────────────────
const isoMap  = new IsometricMap();
const terrain = new Terrain(isoMap);   // sets tile types into isoMap.grid

isoMap.build();             // render tiles using Painter's Algorithm
terrain.buildDecorations(); // draw trees / water ripples on top of tiles

world.addChild(isoMap.container);
world.addChild(terrain.container);

// ── Spawn fighters ────────────────────────────────────────────────────────────
const unitMgr = new UnitManager(isoMap, app.renderer);
world.addChild(unitMgr.container);

// ── Battle manager ────────────────────────────────────────────────────────────
const onVictory = (winner) => {
  const label = winner === 'roman' ? 'Roma Victoria!' : 'Die Barbaren triumphieren!';
  const survivors = battleMgr.counts[winner];
  const overlay = document.getElementById('overlay');
  overlay.querySelector('h1').textContent = label;
  overlay.querySelector('p').textContent  = `${survivors} Überlebende`;
  const btn = overlay.querySelector('button');
  btn.textContent = 'Neustart';
  btn.onclick     = () => location.reload();
  overlay.style.display = 'flex';
};

const battleMgr = new BattleManager(unitMgr.fighters, isoMap, onVictory);

// ── Fit whole battlefield into the viewport on startup ───────────────────────
const { COLS, ROWS, TILE_W, TILE_H } = CONFIG.MAP;

// The map's bounding box in local (world) coordinates:
//   width  = (COLS + ROWS) * TILE_W/2   ≈ 2240 px
//   height = (COLS + ROWS) * TILE_H/2   ≈ 1120 px
//   centre = ( width/2,  height/2 )     = (1120, 560)
const mapLocalW   = (COLS + ROWS) * (TILE_W / 2);
const mapLocalH   = (COLS + ROWS) * (TILE_H / 2);
const localCentreX = mapLocalW / 2;
const localCentreY = mapLocalH / 2;

const initScale = Math.min(
  CONFIG.SCREEN.WIDTH  / mapLocalW,
  CONFIG.SCREEN.HEIGHT / mapLocalH,
) * 0.92;   // 8 % margin

world.scale.set(initScale);
world.x = CONFIG.SCREEN.WIDTH  / 2 - localCentreX * initScale;
world.y = CONFIG.SCREEN.HEIGHT / 2 - localCentreY * initScale;

// ── Drag to pan ───────────────────────────────────────────────────────────────
let drag = null;  // { startMouse, startWorld }

app.stage.interactive = true;
app.stage.hitArea = app.screen;

app.stage.on('pointerdown', e => {
  drag = {
    startMouse: { x: e.global.x, y: e.global.y },
    startWorld: { x: world.x,    y: world.y    },
  };
});

app.stage.on('pointermove', e => {
  if (!drag) return;
  world.x = drag.startWorld.x + (e.global.x - drag.startMouse.x);
  world.y = drag.startWorld.y + (e.global.y - drag.startMouse.y);
});

const stopDrag = () => { drag = null; };
app.stage.on('pointerup',        stopDrag);
app.stage.on('pointerupoutside', stopDrag);

// ── Scroll-wheel zoom ─────────────────────────────────────────────────────────
app.view.addEventListener('wheel', e => {
  e.preventDefault();

  const factor   = e.deltaY < 0 ? 1.1 : (1 / 1.1);
  const newScale = Math.max(0.25, Math.min(3.5, world.scale.x * factor));

  // Keep the point under the cursor fixed in world space
  const mx = e.clientX;
  const my = e.clientY;
  const wx = (mx - world.x) / world.scale.x;
  const wy = (my - world.y) / world.scale.y;

  world.scale.set(newScale);
  world.x = mx - wx * newScale;
  world.y = my - wy * newScale;
}, { passive: false });

// ── HUD ───────────────────────────────────────────────────────────────────────
document.getElementById('hud').innerHTML = `
  <b>Antike Schlachtsimulation</b><br>
  <span style="color:#ff8080">Römer: <span id="hud-roman">${CONFIG.UNITS.ROMAN.COUNT}</span></span>
  &nbsp;|&nbsp;
  <span style="color:#88aaff">Barbaren: <span id="hud-barbarian">${CONFIG.UNITS.BARBARIAN.COUNT}</span></span><br>
  <small>Linksklick + Ziehen &nbsp;|&nbsp; Mausrad: Zoom</small>
`;

// Cache span references so the ticker never queries the DOM by id.
const hudRoman     = document.getElementById('hud-roman');
const hudBarbarian = document.getElementById('hud-barbarian');
let   prevRoman    = CONFIG.UNITS.ROMAN.COUNT;
let   prevBarb     = CONFIG.UNITS.BARBARIAN.COUNT;

// ── Start button ──────────────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  battleMgr.start();
});

// ── Game loop ─────────────────────────────────────────────────────────────────
app.ticker.add(() => {
  const dt = app.ticker.deltaMS / 1000;   // real seconds since last frame

  battleMgr.update(dt);       // game logic: move fighters, resolve attacks
  unitMgr.syncSprites(dt);    // visual: position / tint / fade sprites

  // Update HUD counters only when a fighter dies (minimise DOM writes).
  const c = battleMgr.counts;
  if (c.roman !== prevRoman) {
    hudRoman.textContent = c.roman;
    prevRoman = c.roman;
  }
  if (c.barbarian !== prevBarb) {
    hudBarbarian.textContent = c.barbarian;
    prevBarb = c.barbarian;
  }
});

// ── Resize handler ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  app.stage.hitArea = app.screen;
});
