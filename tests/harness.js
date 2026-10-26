/* ----------------------------------------------------
   NEON STRIKER - Headless test harness
   Loads the shipped game.bundle.js into a Node VM with a minimal fake
   browser, so gameplay logic can be exercised without a real DOM/canvas.

   The bundle wraps everything in an IIFE (anti-cheat: nothing is reachable
   from DevTools), so we splice a test hook in just before the closing
   `})();` that exposes the internals the tests need on globalThis.__t.
   If build.js ever changes the wrapper, update HOOK / loadGame together.
   ---------------------------------------------------- */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BUNDLE_PATH = path.join(__dirname, '..', 'game.bundle.js');

// Universal DOM/canvas stub: every property is a callable stub and numbers
// coerce to 0. A few properties mimic real-DOM values that game code loops
// or branches on (firstChild must become null, or `while (host.firstChild)
// host.removeChild(...)` spins forever).
function stub(name = 'stub') {
  const fn = function () { return stub(name + '()'); };
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k in t) return t[k];
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (k === 'style') return {};
      if (k === 'firstChild' || k === 'lastChild' || k === 'parentNode') return null;
      if (k === 'value' || k === 'innerText' || k === 'textContent' || k === 'innerHTML') return '';
      t[k] = stub(name + '.' + String(k));
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

// Deterministic PRNG (mulberry32) so loop tests are reproducible in CI.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOOK = `
;globalThis.__t = {
  get score() { return score; }, set score(v) { score = v; },
  get enemies() { return enemies; }, set enemies(v) { enemies = v; },
  get maxHealth() { return maxHealth; }, get health() { return health; },
  get player() { return player; },
  get bossRushIndex() { return bossRushIndex; }, set bossRushIndex(v) { bossRushIndex = v; },
  get bossRushMode() { return bossRushMode; }, get dailyMode() { return dailyMode; },
  get gamePaused() { return gamePaused; },
  get traumaLevel() { return traumaLevel; }, set traumaLevel(v) { traumaLevel = v; },
  get renderScale() { return renderScale; },
  CONFIG,
  setDiff(d) { selectedDifficulty = d; }, setLevel(n) { currentLevel = n; },
  setGameActive(v) { gameActive = v; }, setInShop(v) { inShop = v; }, setInIntro(v) { inIntro = v; },
  setPaused(v) { gamePaused = v; },
  setActiveLevel(l) { activeLevelData = l; },
  setPlayer() { player = new PlayerShip(); },
  setBossRush(v) { bossRushMode = v; },
  setCtx(v) { ctx = v; }, setCanvas(v) { canvas = v; },
  rand() { return Math.random(); },
  Enemy, HatchingPod, PlayerShip, Asteroid, EMPShockwave, BOSS_ENEMY_TYPES, BOSS_RUSH_SEQUENCE, LEVEL_DATABASE,
  generateEndlessLevel, spawnCampaignForces, destroyEnemy, applyPowerUp, getLeaderboard,
  bestPerPilot, saveHighScore,
  startGame, startBossRushRun, startDailyRun, frameMult, frameChance, updateGame, drawGame,
  triggerScreenShake, autoPauseIfPlaying, resizeCanvasToDisplay,
  pollGamepad, padRumble,
  get padMoveX() { return padMoveX; }, get padMoveY() { return padMoveY; },
  get keys() { return keys; }, get keysPressed() { return keysPressed; },
  clearKeysPressed() { keysPressed = {}; },
  set frameNow(v) { frameNow = v; },
  setStickVector, updateTouchControls, releaseTouchInput, touchHaptic, wireHoldButton, updateTouchLayout,
  get touchMoveX() { return touchMoveX; }, get touchMoveY() { return touchMoveY; },
  set touchUi(v) { touchUi = v; }, set touchEnabled(v) { touchEnabled = v; },
  setUpgrade(k, v) { playerUpgrades[k] = v; }, set empCooldownTimer(v) { empCooldownTimer = v; }, get empCooldownTimer() { return empCooldownTimer; },
  get empShockwaveCount() { return empShockwaves.length; },
  get bulletTimeActive() { return bulletTimeActive; },
  setCheatMatrix(v) { cheatMatrix = v; }
};
`;

let cachedBundle = null;

/**
 * Load a fresh, isolated copy of the game.
 * @param {{seed?: number}} [opts] seed for the context's Math.random.
 * @returns {{T: object, ctx: object, listeners: object, store: object, run: Function}}
 *   T = exposed internals; listeners = window.addEventListener registrations;
 *   store = backing object of the fake localStorage;
 *   run(code, timeoutMs) = evaluate code in the game context with a hard
 *   timeout, so an infinite loop fails the test instead of hanging CI.
 */
function loadGame(opts = {}) {
  if (cachedBundle === null) cachedBundle = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const bundle = cachedBundle;
  const cut = bundle.lastIndexOf('})();');
  if (cut < 0) throw new Error('game.bundle.js: closing IIFE not found — update tests/harness.js');

  const store = {};
  const listeners = {};
  // Own Math object per context: the game (and the daily seed) reassign
  // Math.random, which must not leak between tests or into the runner.
  const ctxMath = Object.create(Math);
  ctxMath.random = seededRandom(opts.seed == null ? 1 : opts.seed);

  const ctx = {
    console, Math: ctxMath, Date, JSON,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    document: stub('document'),
    navigator: {},
    performance: { now: () => Date.now() },
    devicePixelRatio: 1,
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    AudioContext: undefined
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(bundle.slice(0, cut) + HOOK + bundle.slice(cut), ctx, { filename: 'game.bundle.js' });

  const T = ctx.__t;
  T.setCtx(stub('ctx2d'));
  const run = (code, timeoutMs = 2000) => vm.runInContext(code, ctx, { timeout: timeoutMs });
  return { T, ctx, listeners, store, run, stub };
}

module.exports = { loadGame, stub };
