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
  backgroundColor: 0x2a4a18,
  antialias:       true,
  resolution:      window.devicePixelRatio || 1,
  autoDensity:     true,
});
document.body.appendChild(app.view);

// ── World container ──────────────────────────────────────────────────────────
const world = new PIXI.Container();
app.stage.addChild(world);

// ── Build map ────────────────────────────────────────────────────────────────
const isoMap  = new IsometricMap();
const terrain = new Terrain(isoMap);

isoMap.build();
terrain.buildDecorations();

world.addChild(isoMap.container);
world.addChild(terrain.container);

// ── Spawn fighters ────────────────────────────────────────────────────────────
const unitMgr = new UnitManager(isoMap, app.renderer);
world.addChild(unitMgr.container);

// ── Battle manager ────────────────────────────────────────────────────────────
const onVictory = (winner) => {
  const label     = winner === 'roman' ? 'Roma Victoria!' : 'Die Barbaren triumphieren!';
  const survivors = battleMgr.counts[winner];
  const overlay   = document.getElementById('overlay');
  overlay.querySelector('h1').textContent = label;
  overlay.querySelector('p').textContent  = `${survivors} Überlebende`;
  const btn = overlay.querySelector('button');
  btn.textContent = 'Neustart';
  btn.onclick     = () => location.reload();
  overlay.style.display = 'flex';
};

// BattleManager now receives formations (not raw fighters)
const battleMgr = new BattleManager(unitMgr.formations, isoMap, onVictory);

// ── Initial camera: fit the whole battlefield ────────────────────────────────
const { COLS, ROWS, TILE_W, TILE_H } = CONFIG.MAP;
const mapLocalW    = (COLS + ROWS) * (TILE_W / 2);
const mapLocalH    = (COLS + ROWS) * (TILE_H / 2);
const localCentreX = mapLocalW / 2;
const localCentreY = mapLocalH / 2;

const initScale = Math.min(
  CONFIG.SCREEN.WIDTH  / mapLocalW,
  CONFIG.SCREEN.HEIGHT / mapLocalH,
) * 0.92;

world.scale.set(initScale);
world.x = CONFIG.SCREEN.WIDTH  / 2 - localCentreX * initScale;
world.y = CONFIG.SCREEN.HEIGHT / 2 - localCentreY * initScale;

// ── Drag to pan ───────────────────────────────────────────────────────────────
let drag = null;

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
  const mx = e.clientX, my = e.clientY;
  const wx = (mx - world.x) / world.scale.x;
  const wy = (my - world.y) / world.scale.y;
  world.scale.set(newScale);
  world.x = mx - wx * newScale;
  world.y = my - wy * newScale;
}, { passive: false });

// ── HUD ───────────────────────────────────────────────────────────────────────
// Roman formations list (with order-toggle buttons)
const romanFms = unitMgr.formations.filter(fm => fm.team === 'roman');
const barbFms  = unitMgr.formations.filter(fm => fm.team === 'barbarian');

function fmRowHtml(fm) {
  const isRoman = fm.team === 'roman';
  const btnId   = `btn-${fm.id}`;
  const cntId   = `cnt-${fm.id}`;
  const btnHtml = isRoman
    ? `<button id="${btnId}" class="order-btn hold" onclick="window.toggleOrder('${fm.id}')">Halten</button>`
    : '';
  return `
    <div class="fm-row">
      <span class="fm-label">${fm.label}</span>
      <span class="fm-count" id="${cntId}">${fm.count}</span>
      ${btnHtml}
    </div>`;
}

document.getElementById('hud').innerHTML = `
  <div class="hud-section">
    <div class="hud-title roman-color">Romer</div>
    ${romanFms.map(fmRowHtml).join('')}
  </div>
  <div class="hud-divider"></div>
  <div class="hud-section">
    <div class="hud-title barb-color">Barbaren</div>
    ${barbFms.map(fmRowHtml).join('')}
  </div>
  <div class="hud-hint">Zug + Mausrad: Kamera</div>
`;

// Cache count spans to avoid repeated DOM queries
const countSpans = new Map();
for (const fm of unitMgr.formations) {
  countSpans.set(fm.id, document.getElementById(`cnt-${fm.id}`));
}
const prevCounts = new Map(unitMgr.formations.map(fm => [fm.id, fm.count]));

// Toggle Roman formation order
window.toggleOrder = (id) => {
  const fm  = unitMgr.formations.find(f => f.id === id);
  const btn = document.getElementById(`btn-${id}`);
  if (!fm || !btn) return;
  fm.order = fm.order === 'hold' ? 'advance' : 'hold';
  btn.textContent = fm.order === 'hold' ? 'Halten' : 'Vorrücken';
  btn.className   = `order-btn ${fm.order}`;
};

// ── Start button ──────────────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  battleMgr.start();
});

// ── Game loop ─────────────────────────────────────────────────────────────────
app.ticker.add(() => {
  const dt = app.ticker.deltaMS / 1000;

  battleMgr.update(dt);
  unitMgr.syncSprites(dt);

  // Update formation count spans only when a death occurs
  for (const fm of unitMgr.formations) {
    const cur = fm.count;
    if (cur !== prevCounts.get(fm.id)) {
      const span = countSpans.get(fm.id);
      if (span) span.textContent = cur;
      prevCounts.set(fm.id, cur);
    }
  }
});

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  app.stage.hitArea = app.screen;
});
