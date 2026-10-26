/* Shield-drain and hitbox regression tests (Level 2 report: "my shield
   keeps dropping even when I'm not being hit"). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function play(levelNum, seed = 1) {
  const game = loadGame({ seed });
  const { T } = game;
  T.setDiff('hero');
  T.startGame();
  T.setLevel(levelNum);
  const lvl = T.LEVEL_DATABASE[levelNum];
  T.setActiveLevel(lvl);
  T.enemies = [];
  T.spawnCampaignForces(lvl);
  T.setGameActive(true);
  T.setInShop(false);
  T.setInIntro(false);
  return { ...game, lvl };
}

test('asteroid storm stops spawning once every enemy is destroyed', () => {
  const { T } = play(2);
  T.setActiveLevel({ asteroidChance: 1 }); // guaranteed roll every frame
  T.asteroids = [];
  T.setInShop(true);                         // keep the level from clearing
  T.updateGame(16.667);
  assert.ok(T.asteroids.length > 0, 'storm should spawn while enemies remain');
  T.enemies = [];
  T.asteroids = [];
  T.updateGame(16.667);
  assert.equal(T.asteroids.length, 0, 'spawned after the last enemy died');
});

test('Level 2 ends within seconds of the last kill (no endless storm)', () => {
  for (const seed of [1, 2, 3, 4]) {
    const { T } = play(2, seed);
    T.setInShop(true);                         // 20 s of fighting first
    for (let f = 0; f < 60 * 20; f++) T.updateGame(16.667);
    T.enemies = [];
    T.setInShop(false);
    let f = 0;
    for (; f < 60 * 30 && T.evalInGame('gameActive'); f++) T.updateGame(16.667);
    assert.ok(f < 60 * 15, `seed ${seed}: level still running ${(f / 60).toFixed(0)}s after the last kill`);
  }
});

test('escaping asteroids: untouched ones cost 10, shot fragments are free', () => {
  const { T } = play(2);
  T.setActiveLevel({}); // no new spawns, isolate the escape rule
  const escape = ast => {
    T.setHealth(100);
    T.player.invulnFrames = 0;
    ast.y = 700;        // past the bottom (height + 40)
    T.asteroids = [ast];
    T.updateGame(16.667);
    return 100 - T.health;
  };
  assert.equal(escape(new T.Asteroid(400, 0, 'large')), 10);
  const fragment = new T.Asteroid(400, 0, 'medium');
  fragment.isFragment = true;
  assert.equal(escape(fragment), 0, 'a piece of a rock you shot cost shield');
  T.enemies = [];       // wave cleared: the last rocks leave for free
  assert.equal(escape(new T.Asteroid(400, 0, 'large')), 0);
});

test('splitting marks fragments and small rocks drop scrap (laser or missile)', () => {
  const { T } = play(2);
  T.asteroids = [];
  T.splitAsteroid(new T.Asteroid(300, 200, 'large'));
  assert.deepEqual(Array.from(T.asteroids, a => a.size), ['medium', 'medium']);
  assert.ok(T.asteroids.every(a => a.isFragment));
  const scrap = T.scrapCount;
  T.splitAsteroid(new T.Asteroid(300, 200, 'small'));
  assert.equal(T.scrapCount, scrap + 1);
});

test('enemy lasers hit the ship triangle, not the empty corners beside the nose', () => {
  const { T } = play(1);
  const p = T.player;
  p.x = 300; p.y = 400;                       // ship 44 x 36: nose (322, 400), wings (300|344, 436)
  const at = (x, y) => new T.Laser(x, y, 0, 6, '#f00'); // drawn 4 x 16, centred
  assert.ok(T.laserHitsShip(at(322, 418), p), 'centre of the hull');
  assert.ok(T.laserHitsShip(at(302, 432), p), 'left wing tip');
  assert.ok(!T.laserHitsShip(at(304, 404), p), 'top-left corner beside the nose is empty space');
  assert.ok(!T.laserHitsShip(at(296, 418), p), '4px left of the hull side');
  assert.ok(!T.laserHitsShip(at(322, 380), p), 'just above the nose');
});

test('asteroid-ship collision uses the drawn rock size', () => {
  const crash = gapPx => {
    const { T } = play(1);
    T.setActiveLevel({});
    T.enemies = [new T.Enemy(0, -500, 'scout')];
    const p = T.player;
    p.x = 300; p.y = 400; p.invulnFrames = 0;
    T.setHealth(100);
    // Rock centred to the right of the ship centre (322, 418). Drawn edge
    // ~0.8 * 35 = 28px from the rock centre; ship reach 18px.
    const rock = new T.Asteroid(322 + 18 + 28 + gapPx, 418, 'large');
    rock.vx = 0; rock.vy = 0;
    T.asteroids = [rock];
    T.handleCollisions();
    return T.health < 100;
  };
  assert.ok(crash(-4), 'overlapping rock should hit');
  assert.ok(!crash(4), 'rock 4px from the drawn edge hit (old full-radius test reached 7px further)');
});

test('collision pass: a laser grazing past the nose does not cost shield', () => {
  const shot = (x, y) => {
    const { T } = play(1);
    T.setActiveLevel({});
    T.asteroids = [];
    const p = T.player;
    p.x = 300; p.y = 400; p.invulnFrames = 0;
    T.setHealth(100);
    T.enemyLasers = [new T.Laser(x, y, 0, 6, '#f00')];
    T.handleCollisions();
    return 100 - T.health;
  };
  assert.equal(shot(304, 404), 0, 'empty corner beside the nose');
  assert.equal(shot(296, 418), 0, 'just outside the hull side');
  assert.equal(shot(322, 418), 15, 'a real hit still lands');
});

test('sentries descend into view so Level 18 can be cleared', () => {
  const { T } = play(18);
  const sentries = () => Array.from(T.enemies).filter(e => e.type === 'sentry');
  assert.ok(sentries().length > 0);
  assert.ok(sentries().every(s => s.y < 0), 'sentries should spawn above the screen');
  T.setInShop(true);
  for (let f = 0; f < 60 * 5; f++) T.updateGame(16.667);
  for (const s of sentries()) {
    assert.ok(s.y >= 0 && s.y + s.height <= 600, `sentry stuck off-screen at y=${s.y}`);
  }
});

test('BOMB kills count as kills for stats and achievements (without combo)', () => {
  const { T, ctx } = play(1);
  const before = ctx.Stats.getSnapshot().totalKills;
  const combo = T.evalInGame('comboKills');
  const n = Array.from(T.enemies).filter(e => !e.isBoss).length;
  assert.ok(n > 0);
  T.applyPowerUp('BOMB');
  assert.equal(ctx.Stats.getSnapshot().totalKills, before + n);
  assert.equal(T.evalInGame('comboKills'), combo, 'bomb advanced the combo');
});

test('scoring audit: every point on Level 9 is explained by a scoring rule', () => {
  const { T } = play(9);
  T.evalInGame(`
    cheatGod = true; globalThis.__exp = 0;
    const _de = destroyEnemy; destroyEnemy = function (enemy, i) { _de(enemy, i); __exp += enemy.scoreValue * getComboMultiplier(); };
    const _sa = splitAsteroid; splitAsteroid = function (a) { __exp += a.scoreValue; _sa(a); };
    const _ap = applyPowerUp; applyPowerUp = function (t) { if (t === 'BOMB') for (const e of enemies) if (!e.isBoss) __exp += e.scoreValue; _ap(t); };
    const _tl = triggerLevelClear; triggerLevelClear = function () { if (!levelDamageTaken) __exp += 500; _tl(); };`);
  let prev = 0;
  for (let f = 0; f < 60 * 40 && T.evalInGame('gameActive'); f++) {
    const p = T.player, cx = p.x + p.width / 2;
    let target = null;
    for (const e of T.enemies) if (!target || e.y > target.y) target = e;
    const tx = target ? target.x + target.width / 2 : 400;
    T.keys.ArrowLeft = tx < cx - 6; T.keys.ArrowRight = tx > cx + 6; T.keys.Space = true;
    T.frameNow = 1e6 + f * 16.667;
    T.updateGame(16.667);
    assert.ok(Number.isInteger(T.score), `non-integer score ${T.score}`);
    assert.ok(T.score >= prev, 'score went down');
    assert.equal(T.score, T.evalInGame('__exp'), `unexplained points at frame ${f}`);
    prev = T.score;
  }
  assert.ok(T.score > 0, 'autopilot scored nothing');
});
