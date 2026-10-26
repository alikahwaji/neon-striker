/* Multi-wave levels: regular levels play several formations; bosses one. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function start(levelNum, { inShop = false } = {}) {
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
  T.setInShop(inShop);
  T.setInIntro(false);
  return { ...game, lvl };
}

const tick = (T, ms) => { for (let t = 0; t < ms; t += 16.667) T.updateGame(16.667); };

test('regular levels have 3 waves, each bigger than the last; bosses have 1', () => {
  const { T } = start(1);
  for (let n = 1; n <= 20; n++) {
    const lvl = T.LEVEL_DATABASE[n];
    const grids = T.levelWaveGrids(lvl);
    if (lvl.bossType) { assert.equal(grids, null, `L${n} boss should be a single wave`); continue; }
    assert.equal(grids.length, 3, `L${n}`);
    const size = g => g.rows * g.cols;
    assert.ok(size(grids[1]) >= size(grids[0]) && size(grids[2]) >= size(grids[1]), `L${n} waves should not shrink`);
    assert.ok(size(grids[2]) > size(grids[0]), `L${n} final wave should be bigger than the first`);
  }
});

test('clearing a wave announces and spawns the next one after a short break', () => {
  const { T } = start(1);
  assert.equal(T.waveCount, 3);
  const firstWave = T.enemies.length;
  T.enemies = [];                 // wave 1 destroyed
  T.updateGame(16.667);
  assert.ok(Array.from(T.floatingTexts).some(t => t.text === 'WAVE 2/3'), 'no WAVE 2/3 announcement');
  assert.equal(T.enemies.length, 0, 'next wave should wait for the breather');
  assert.ok(T.evalInGame('gameActive'), 'level ended after wave 1');
  tick(T, 1600);
  assert.equal(T.waveIndex, 1);
  assert.ok(T.enemies.length > firstWave, 'wave 2 should be bigger');
});

test('the level only clears after the final wave', () => {
  const { T } = start(1);
  for (let w = 0; w < 3; w++) {
    assert.ok(T.evalInGame('gameActive'), `level ended before wave ${w + 1} was cleared`);
    T.enemies = [];
    tick(T, 1700);
  }
  assert.equal(T.evalInGame('gameActive'), false, 'level should clear after wave 3');
});

test('boss levels clear as soon as the boss is destroyed', () => {
  const { T } = start(5);
  assert.equal(T.waveCount, 1);
  T.enemies = [];
  T.updateGame(16.667);
  assert.equal(T.evalInGame('gameActive'), false);
});

test('a level can define its own waves', () => {
  const { T } = start(1);
  const custom = { enemyGrid: { rows: 1, cols: 2, scouts: true }, waves: [{ rows: 1, cols: 2, scouts: true }, { rows: 1, cols: 4, scouts: true }] };
  assert.equal(T.levelWaveGrids(custom).length, 2);
  T.setActiveLevel(custom);
  T.resetWaves(custom);
  assert.equal(T.waveCount, 2);
});
