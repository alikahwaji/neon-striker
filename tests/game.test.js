/* Behaviour tests for gameplay / UI logic, run against the shipped bundle.
   Each test loads its own isolated game instance (see harness.js). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

// Fire the page's window 'load' handler (ui.js wiring) in a loaded game.
function boot(game) {
  for (const fn of game.listeners.load || []) fn({});
  return game;
}

test('killing a Level 12 egg pod keeps the score finite', () => {
  const { T } = loadGame();
  T.setPlayer();
  T.score = 1000;
  const pod = new T.HatchingPod(100, 100);
  T.enemies = [pod];
  T.destroyEnemy(pod, 0);
  assert.ok(Number.isFinite(T.score) && T.score > 1000, `score ${T.score}`);
  assert.equal(typeof pod.id, 'number');
});

test('boss types map correctly for campaign, Boss Rush and Endless', () => {
  const { T } = loadGame();
  const typeFor = lv => { T.enemies = []; T.spawnCampaignForces(lv); return T.enemies[0] && T.enemies[0].type; };
  assert.equal(typeFor(T.LEVEL_DATABASE[20]), 'unicron');
  // Array.from: values built inside the VM realm have a different Array
  // prototype, which deepStrictEqual treats as a mismatch.
  assert.deepEqual(Array.from(T.BOSS_RUSH_SEQUENCE, typeFor), ['boss', 'boss2', 'sandworm', 'unicron']);
  const endless = [25, 30, 35, 40].map(n => typeFor(T.generateEndlessLevel(n)));
  assert.equal(new Set(endless).size, 4, `endless bosses: ${endless}`);
});

test('Unicron can update, shoot and draw through both phases', () => {
  const { T } = loadGame();
  T.setGameActive(true);
  const u = new T.Enemy(300, -120, 'unicron');
  for (let i = 0; i < 400; i++) u.update(16.667);
  u.health = 10; // force phase 2 (gravity pull)
  T.setPlayer();
  for (let i = 0; i < 200; i++) u.update(16.667);
  u.shoot();
  u.draw();
});

test('late-level boss fire delay is floored (no volley every frame)', () => {
  const { T } = loadGame();
  T.setGameActive(true);
  T.setLevel(25);
  T.setDiff('hero');
  const b = new T.Enemy(300, 100, 'boss');
  b.y = 100;
  b.shootTimer = 0;
  b.update(16.667);
  assert.ok(b.shootTimer >= 600 - 17, `shootTimer ${b.shootTimer}`);
});

test('Cadet starts with 200 max HP, Hero with 100', () => {
  const { T } = loadGame();
  T.setDiff('cadet'); T.startGame();
  assert.equal(T.maxHealth, 200);
  assert.equal(T.health, 200);
  T.setDiff('hero'); T.startGame();
  assert.equal(T.maxHealth, 100);
});

test('local leaderboard survives corrupt storage and drops non-finite rows', () => {
  const { T, ctx } = loadGame();
  ctx.localStorage.setItem('neon_striker_high_scores', '{');
  assert.equal(T.getLeaderboard().length, 5); // falls back to the seeded defaults
  ctx.localStorage.setItem('neon_striker_high_scores',
    JSON.stringify([{ name: 'A', score: null }, { name: 'B', score: 500 }]));
  assert.deepEqual(Array.from(T.getLeaderboard(), r => r.score), [500]);
});

test('a BOMB that drops a boss to 0 HP kills it', () => {
  const { T } = loadGame();
  T.setPlayer();
  const boss = new T.Enemy(300, 100, 'boss');
  boss.health = 20;
  T.enemies = [boss];
  const before = T.score;
  T.applyPowerUp('BOMB');
  assert.equal(T.enemies.length, 0);
  assert.ok(T.score > before);
});

test('movement is refresh-rate independent (60 Hz vs 144 Hz)', () => {
  const { T } = loadGame();
  const coast = hz => {
    T.setPlayer();
    const p = T.player;
    p.x = 100; p.vx = 5;
    for (let i = 0; i < hz; i++) p.update(1000 / hz);
    return p.x;
  };
  assert.ok(Math.abs(coast(60) - coast(144)) < 3, 'player coast distance differs');

  const descend = hz => {
    const e = new T.Enemy(300, 0, 'scout');
    e.shootTimer = 1e9;
    for (let i = 0; i < hz; i++) e.update(1000 / hz);
    return e.y;
  };
  const y60 = descend(60), y144 = descend(144);
  assert.ok(Math.abs(y60 - y144) / y60 < 0.03, `scout ${y60} vs ${y144}`);

  assert.ok(Math.abs(T.frameChance(0.01, 1) - 0.01) < 1e-12);
  assert.ok(Math.abs(T.frameChance(0.01, 2.4) - (1 - Math.pow(0.99, 2.4))) < 1e-12);
});

test('page load wiring runs and Space is only blocked outside text fields', () => {
  const game = boot(loadGame());
  assert.ok((game.listeners.load || []).length > 0, 'no load handler');
  const keydown = game.listeners.keydown || [];
  assert.ok(keydown.length > 0, 'no keydown handler');
  let prevented = 0;
  const ev = tag => ({ code: 'Space', target: { tagName: tag }, repeat: false, preventDefault() { prevented++; } });
  keydown.forEach(fn => fn(ev('INPUT')));
  assert.equal(prevented, 0, 'Space blocked while typing');
  keydown.forEach(fn => fn(ev('CANVAS')));
  assert.equal(prevented, 1, 'Space not blocked during play');
});

test('Boss Rush restart resets to boss 1 (even after a full clear)', () => {
  const { T } = loadGame();
  T.setBossRush(true);
  T.bossRushIndex = 4;
  T.startBossRushRun();
  assert.equal(T.bossRushIndex, 0);
  assert.ok(T.bossRushMode);
});

test('Daily Challenge retry is re-seeded with the same sequence', () => {
  const { T } = loadGame();
  T.startDailyRun();
  const first = [T.rand(), T.rand(), T.rand()];
  T.startDailyRun();
  const second = [T.rand(), T.rand(), T.rand()];
  assert.ok(T.dailyMode);
  assert.deepEqual(second, first);
});

test('Reduced Motion disables screen shake', () => {
  const { T } = loadGame();
  T.traumaLevel = 0;
  T.CONFIG.reducedMotion = false;
  T.triggerScreenShake(0.5);
  assert.ok(T.traumaLevel > 0, 'shake should apply normally');
  T.traumaLevel = 0;
  T.CONFIG.reducedMotion = true;
  T.triggerScreenShake(0.5);
  assert.equal(T.traumaLevel, 0);
});

test('auto-pause only pauses active gameplay and never un-pauses', () => {
  const { T } = loadGame();
  const state = (active, shop, intro, paused) => {
    T.setGameActive(active); T.setInShop(shop); T.setInIntro(intro); T.setPaused(paused);
  };
  state(true, false, false, false);
  T.autoPauseIfPlaying();
  assert.equal(T.gamePaused, true, 'should pause mid-fight');
  T.autoPauseIfPlaying();
  assert.equal(T.gamePaused, true, 'second blur must not resume');
  for (const [label, s] of [['intro', [true, false, true, false]], ['hangar', [true, true, false, false]], ['menu', [false, false, false, false]]]) {
    state(...s);
    T.autoPauseIfPlaying();
    assert.equal(T.gamePaused, false, `paused during ${label}`);
  }
});

test('high-DPI canvas: backing store follows display size x DPR', () => {
  const { T, ctx } = loadGame();
  const canvas = { clientWidth: 884, width: 0, height: 0 };
  T.setCanvas(canvas);
  ctx.devicePixelRatio = 2;
  T.resizeCanvasToDisplay();
  assert.deepEqual([canvas.width, canvas.height], [1768, 1326]);
  assert.ok(Math.abs(T.renderScale - 2.21) < 0.001);

  ctx.devicePixelRatio = 3; // capped at 2x
  canvas.clientWidth = 1600; // 1600 * 2 = 3200 > 2400 cap
  T.resizeCanvasToDisplay();
  assert.equal(canvas.width, 2400);

  canvas.clientWidth = 0; // not laid out -> plain 800x600
  T.resizeCanvasToDisplay();
  assert.deepEqual([canvas.width, canvas.height], [800, 600]);
});
