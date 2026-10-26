/* Graphics / game-feel effects: hit-stop, impact rings, hit flash, boss
   intro banner, animated HUD score. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function play(levelNum) {
  const game = loadGame();
  const { T } = game;
  T.setDiff('hero');
  T.startGame();
  T.setLevel(levelNum);
  const lvl = T.LEVEL_DATABASE[levelNum];
  T.setActiveLevel(lvl);
  T.resetWaves(lvl);
  T.enemies = [];
  T.spawnCampaignForces(lvl);
  T.setGameActive(true);
  T.setInShop(true);
  T.setInIntro(false);
  return game;
}

test('hit-stop freezes the simulation (not drawing) and the longest stop wins', () => {
  const { T } = play(1);
  const e = T.enemies[0];
  T.gameTick(1000);                  // first tick sets lastTime
  T.hitStop(60);
  T.hitStop(30);                     // shorter request doesn't shorten it
  assert.equal(T.hitStopTimer, 60);
  const y0 = e.y;
  T.gameTick(1016);                  // 16 ms into the stop
  assert.equal(e.y, y0, 'world moved during hit-stop');
  for (let t = 1032; t <= 1100; t += 16) T.gameTick(t);
  assert.ok(T.hitStopTimer <= 0);
  T.gameTick(1116);
  assert.notEqual(e.y, y0, 'world should resume after the stop');
});

test('a boss kill triggers hit-stop; routine kills do not', () => {
  const { T } = play(1);
  T.hitStopTimer = 0;
  const scout = T.enemies[0];
  T.destroyEnemy(scout, 0);
  assert.equal(T.hitStopTimer, 0, 'routine kill stuttered the game');
  const boss = new T.Enemy(300, 100, 'boss');
  T.enemies = [boss];
  T.destroyEnemy(boss, 0);
  assert.ok(T.hitStopTimer >= 100);
});

test('kills spawn an impact ring that expires; rings are capped', () => {
  const { T } = play(1);
  T.impactRings = [];
  T.destroyEnemy(T.enemies[0], 0);
  assert.equal(T.impactRings.length, 1);
  for (let i = 0; i < 30; i++) T.updateGame(16.667);
  assert.equal(T.impactRings.length, 0, 'ring never expired');
  for (let i = 0; i < 100; i++) T.spawnImpactBurst(100, 100, '#fff', 30);
  assert.ok(T.impactRings.length <= 24, `uncapped: ${T.impactRings.length}`);
});

test('a non-lethal hit flashes the enemy white, then it fades', () => {
  const { T } = play(1);
  const boss = new T.Enemy(300, 100, 'boss');
  boss.takeDamage(1);
  assert.ok(boss.hitFlash > 0);
  for (let i = 0; i < 10; i++) boss.update(16.667);
  assert.ok(!(boss.hitFlash > 0), 'flash should wear off');
  const color = boss.color;
  boss.hitFlash = 50;
  boss.draw();
  assert.equal(boss.color, color, 'draw must restore the real colour');
});

test('boss levels open with a WARNING banner naming the boss', () => {
  const { T } = play(20);
  assert.ok(T.bossIntroTimer > 0);
  assert.equal(T.bossIntroName, String(T.LEVEL_DATABASE[20].subtitle).toUpperCase());
  T.setPaused(true);
  const left = T.bossIntroTimer;
  T.gameTick(1); T.gameTick(500);      // paused: updateGame doesn't run
  assert.equal(T.bossIntroTimer, left, 'banner counted down while paused');
  T.setPaused(false);
  for (let i = 0; i < 200; i++) T.updateGame(16.667);
  assert.equal(T.bossIntroTimer, 0);
  // Regular waves don't show it
  const { T: T2 } = play(1);
  assert.equal(T2.bossIntroTimer, 0);
});

test('HUD score counts up to the real score and snaps on reset', () => {
  const { T } = play(1);
  T.score = 0; T.updateHud(16.667);
  T.score = 5000;
  T.updateHud(16.667);
  const first = T.hudLast.score;
  assert.ok(first > 0 && first < 5000, `should be mid-count, got ${first}`);
  for (let i = 0; i < 60; i++) T.updateHud(16.667);
  assert.equal(T.hudLast.score, 5000, 'count-up must land exactly');
  T.score = 0;                         // new run
  T.updateHud(16.667);
  assert.equal(T.hudLast.score, 0);
});
