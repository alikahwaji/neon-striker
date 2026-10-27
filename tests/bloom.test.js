/* Bloom post-process (render.js applyBloom) and its settings toggle. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, stub } = require('./harness');

// 2D context that records drawImage calls with the composite mode in effect.
function recordingCtx(draws) {
  const base = stub('ctx2d');
  let op = 'source-over';
  return new Proxy(base, {
    get(t, k) {
      if (k === 'globalCompositeOperation') return op;
      if (k === 'drawImage') return (img, ...args) => draws.push({ img, op, args });
      if (k === 'save' || k === 'restore') return () => { if (k === 'restore') op = 'source-over'; };
      return t[k];
    },
    set(t, k, v) { if (k === 'globalCompositeOperation') op = v; else t[k] = v; return true; }
  });
}

function setup(bloomOn) {
  const game = loadGame();
  const { T } = game;
  const draws = [];
  T.setCanvas({ width: 1600, height: 1200, clientWidth: 800 });
  T.setCtx(recordingCtx(draws));
  T.CONFIG.bloom = bloomOn;
  T.setDiff('hero');
  T.startGame();
  return { T, draws };
}

test('bloom adds a low-res buffer over the frame with additive blending', () => {
  const { T, draws } = setup(true);
  T.drawGame();
  const added = draws.filter(d => d.op === 'lighter');
  assert.equal(added.length, 1, 'expected exactly one additive bloom composite');
  assert.deepEqual(added[0].args, [0, 0, T.CONFIG.width, T.CONFIG.height]);
});

test('bloom off: no additive composite', () => {
  const { T, draws } = setup(false);
  T.drawGame();
  assert.equal(draws.filter(d => d.op === 'lighter').length, 0);
});

test('bloom setting persists and restores', () => {
  const game = loadGame();
  const { T, store } = game;
  T.evalInGame('setBloomEnabled(false); persistSettings();');
  const saved = JSON.parse(store.neon_striker_settings_v1);
  assert.equal(saved.bloom, false);
  T.evalInGame('setBloomEnabled(true); applyPersistedSettings({ bloom: false });');
  assert.equal(T.CONFIG.bloom, false);
});
