/* Runs the real updateGame + drawGame loop on every campaign level, a few
   endless sectors and every Boss Rush stage, at 60 Hz and 144 Hz.
   Catches runtime errors, NaN scores and infinite loops (each frame runs
   under a hard VM timeout). Random rolls are seeded for reproducibility;
   several seeds per level widen coverage of rare branches. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const FRAMES = 600;          // ~10 s of game time at 60 Hz
const SEEDS = [1, 2];
const FRAME_TIMEOUT_MS = 2000;

function levels(T) {
  const out = [];
  for (let n = 1; n <= 20; n++) out.push([`level ${n}`, n, T.LEVEL_DATABASE[n]]);
  for (const n of [25, 27, 35]) out.push([`endless ${n}`, n, T.generateEndlessLevel(n)]);
  T.BOSS_RUSH_SEQUENCE.forEach((lv, i) => out.push([`boss rush ${i + 1}`, i + 1, lv]));
  return out;
}

const names = levels(loadGame().T).map(([name]) => name);

for (const [i, name] of names.entries()) {
  test(`game loop: ${name}`, () => {
    for (const seed of SEEDS) {
      for (const hz of [60, 144]) {
        const game = loadGame({ seed });
        const { T, ctx, run } = game;
        const [, levelNum, lvl] = levels(T)[i];
        T.setDiff('hero');
        T.startGame();
        T.setLevel(levelNum);
        T.setActiveLevel(lvl);
        T.resetWaves(lvl);
        T.enemies = [];
        T.spawnCampaignForces(lvl);
        T.setGameActive(true);
        // Keep the run on this level: inShop blocks triggerLevelClear.
        T.setInShop(true);
        T.setInIntro(false);
        ctx.__dt = 1000 / hz;
        for (let f = 0; f < FRAMES; f++) {
          try {
            run('__t.updateGame(__dt); __t.drawGame();', FRAME_TIMEOUT_MS);
          } catch (e) {
            assert.fail(`${name} seed ${seed} @${hz}Hz frame ${f}: ${e && e.message}`);
          }
        }
        assert.ok(Number.isFinite(T.score), `${name} seed ${seed} @${hz}Hz: score ${T.score}`);
      }
    }
  });
}
