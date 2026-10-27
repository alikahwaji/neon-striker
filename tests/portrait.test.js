/* Portrait playfield (600x800 world on portrait touch screens):
   setPlayfieldSize in render.js, updateTouchLayout in touch.js. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const PORTRAIT = { width: 600, height: 800 };

function startLevel(T, levelNum, lvl) {
  T.setDiff('hero');
  T.startGame();
  T.setLevel(levelNum);
  T.setActiveLevel(lvl);
  T.resetWaves(lvl);
  T.enemies = [];
  T.spawnCampaignForces(lvl);
  T.setGameActive(true);
  T.setInShop(true);   // keep the run on this level
  T.setInIntro(false);
}

function allLevels(T) {
  const out = [];
  for (let n = 1; n <= 20; n++) out.push([n, T.LEVEL_DATABASE[n]]);
  for (const n of [25, 35]) out.push([n, T.generateEndlessLevel(n)]);
  T.BOSS_RUSH_SEQUENCE.forEach((lv, i) => out.push([i + 1, lv]));
  return out;
}

test('setPlayfieldSize switches the world and keeps things where they were relative to it', () => {
  const { T } = loadGame();
  startLevel(T, 1, T.LEVEL_DATABASE[1]);
  T.setPlayer();
  const e = T.enemies[0];
  const cx = (e.x + e.width / 2) / T.CONFIG.width;
  const cy = (e.y + e.height / 2) / T.CONFIG.height;
  assert.equal(T.evalInGame('setPlayfieldSize(PLAYFIELD_PORTRAIT)'), true);
  assert.equal(T.CONFIG.width, 600);
  assert.equal(T.CONFIG.height, 800);
  assert.ok(Math.abs((e.x + e.width / 2) / 600 - cx) < 1e-9);
  assert.ok(Math.abs((e.y + e.height / 2) / 800 - cy) < 1e-9);
  assert.ok(T.player.x >= 0 && T.player.x + T.player.width <= 600);
  assert.equal(T.evalInGame('setPlayfieldSize(PLAYFIELD_PORTRAIT)'), false, 'same size is a no-op');
  T.evalInGame('setPlayfieldSize(PLAYFIELD_LANDSCAPE)');
  assert.ok(Math.abs((e.x + e.width / 2) / 800 - cx) < 1e-9, 'round trip drifted');
});

test('every formation and boss fits inside the 600-wide portrait field', () => {
  const { T } = loadGame();
  T.evalInGame('setPlayfieldSize(PLAYFIELD_PORTRAIT)');
  for (const [n, lvl] of allLevels(T)) {
    startLevel(T, n, lvl);
    // Every wave of the level, not just the first.
    for (let w = 0; w < T.waveCount; w++) {
      if (w > 0) {
        T.waveIndex = w;
        T.enemies = [];
        T.spawnCampaignForces(lvl);
      }
      for (const e of T.enemies) {
        assert.ok(e.x >= 0 && e.x + e.width <= PORTRAIT.width,
          `${lvl.subtitle || n} wave ${w + 1}: ${e.type} at x=${e.x.toFixed(0)} w=${e.width}`);
      }
    }
  }
});

test('trench walls and the ship clamp scale with the field', () => {
  const { T } = loadGame();
  T.evalInGame('setPlayfieldSize(PLAYFIELD_PORTRAIT)');
  const trench = allLevels(T).find(([, l]) => l.trenchWalls);
  startLevel(T, trench[0], trench[1]);
  T.setPlayer();
  assert.equal(T.evalInGame('trenchLeft()'), 150);
  assert.equal(T.evalInGame('trenchRight()'), 450);
  T.player.x = 0;
  T.player.update(16.667);
  assert.ok(T.player.x >= 150, `ship escaped the trench: x=${T.player.x}`);
  T.player.x = 600;
  T.player.update(16.667);
  assert.ok(T.player.x + T.player.width <= 450, `ship escaped the trench: x=${T.player.x}`);
});

test('rotating mid-run switches the world and pauses; menus just switch', () => {
  const { T, ctx } = loadGame();
  T.touchEnabled = true;
  ctx.innerWidth = 440; ctx.innerHeight = 956;
  T.updateTouchLayout();
  assert.equal(T.CONFIG.width, 600);
  assert.equal(T.gamePaused, false, 'no run in progress, nothing to pause');

  startLevel(T, 1, T.LEVEL_DATABASE[1]);
  T.setInShop(false);
  ctx.innerWidth = 956; ctx.innerHeight = 440;
  T.updateTouchLayout();
  assert.equal(T.CONFIG.width, 800);
  assert.equal(T.gamePaused, true);
});

test('portrait phones get the 3:4 world only when it draws the game bigger', () => {
  const { T } = loadGame();
  const CHROME = 58 + 46 + 170;  // HUD strips + minimum control area (styles.css)
  // Tall screen (iPhone Pro Max, toolbars hidden): 3:4 view, ships ~1.33x bigger.
  let v = T.portraitPlayView(430, 932, CHROME);
  assert.equal(v.world.width, 600);
  assert.ok(v.width <= 430 && v.height <= 932 - CHROME);
  assert.ok(v.width / 600 > (430 / 800) * 1.3, `scale ${v.width / 600}`);
  // Short screen (small iPhone, toolbars showing): keep the 4:3 strip.
  v = T.portraitPlayView(375, 560, CHROME);
  assert.equal(v.world.width, 800);
  assert.equal(v.width, 375);
  assert.equal(v.height, 281);
  // Whatever it picks, it never draws smaller than the strip would.
  for (const [w, h] of [[360, 640], [390, 664], [393, 760], [414, 896], [430, 740], [768, 1024]]) {
    v = T.portraitPlayView(w, h, CHROME);
    assert.ok(v.width / v.world.width >= w / 800 - 1e-9, `${w}x${h} shrank the game`);
  }
});

test('every level runs 10 s in the portrait world without errors', () => {
  const names = allLevels(loadGame().T).length;
  for (let i = 0; i < names; i++) {
    const game = loadGame({ seed: 3 });
    const { T, run } = game;
    T.evalInGame('setPlayfieldSize(PLAYFIELD_PORTRAIT)');
    const [n, lvl] = allLevels(T)[i];
    startLevel(T, n, lvl);
    for (let f = 0; f < 600; f++) {
      try {
        run('__t.updateGame(16.667); __t.drawGame();', 2000);
      } catch (e) {
        assert.fail(`${lvl.subtitle || n} frame ${f}: ${e && e.message}`);
      }
    }
    assert.ok(Number.isFinite(T.score));
  }
});
