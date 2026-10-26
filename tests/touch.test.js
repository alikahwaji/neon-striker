/* Touch-control logic tests (touch.js) with a fake control layer. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function fakeEl(extra = {}) {
  const classes = new Set(extra.classes || []);
  return {
    style: {},
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c), has: c => classes.has(c),
      toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : on; if (v) classes.add(c); else classes.delete(c); return v; }
    },
    ...extra
  };
}

function setup({ playing = true, layerHeight = 600 } = {}) {
  const game = loadGame();
  const { T } = game;
  const ui = {
    layer: fakeEl({ clientHeight: layerHeight, classes: ['hidden'] }),
    zone: fakeEl(), base: fakeEl({ classes: ['hidden'] }), knob: fakeEl(),
    fire: fakeEl(), emp: fakeEl({ classes: ['hidden'] }), bt: fakeEl({ classes: ['hidden'] })
  };
  T.touchUi = ui;
  T.touchEnabled = true;
  T.setPlayer();
  T.setGameActive(playing);
  T.setPaused(false);
  T.setInShop(false);
  T.setInIntro(false);
  T.setActiveLevel({});
  return { ...game, ui };
}

test('thumbstick: full throw = 1, half throw is scaled past the deadzone, drift = 0', () => {
  const { T } = setup({ layerHeight: 600 }); // radius = 0.12 * 600 = 72 px
  T.setStickVector(72, 0);
  assert.ok(Math.abs(T.touchMoveX - 1) < 1e-9);
  assert.equal(T.touchMoveY, 0);

  T.setStickVector(0, -36); // half throw upward
  assert.ok(Math.abs(T.touchMoveY - -(0.5 - 0.12) / 0.88) < 1e-9, `y ${T.touchMoveY}`);

  T.setStickVector(5, 3); // inside the 12% deadzone
  assert.equal(T.touchMoveX, 0);
  assert.equal(T.touchMoveY, 0);
});

test('thumbstick: dragging past the rim clamps output and the knob', () => {
  const { T, ui } = setup({ layerHeight: 600 });
  T.setStickVector(300, 400); // 500 px away, direction (0.6, 0.8)
  assert.ok(Math.abs(Math.hypot(T.touchMoveX, T.touchMoveY) - 1) < 1e-9);
  assert.ok(Math.abs(T.touchMoveX - 0.6) < 1e-9);
  // knob translated to the rim (72 px), not to the finger
  const [kx, ky] = ui.knob.style.transform.match(/-?[\d.]+/g).map(Number);
  assert.ok(Math.abs(kx - 0.6 * 72) < 1e-9 && Math.abs(ky - 0.8 * 72) < 1e-9, ui.knob.style.transform);
});

test('thumbstick radius has a minimum on tiny screens', () => {
  const { T } = setup({ layerHeight: 100 }); // 0.12 * 100 = 12 -> floored to 32
  T.setStickVector(32, 0);
  assert.ok(Math.abs(T.touchMoveX - 1) < 1e-9);
});

test('touch stick drives the ship like an analog stick', () => {
  const accelFor = dx => {
    const { T } = setup({ layerHeight: 600 });
    T.setStickVector(dx, 0);
    const p = T.player;
    p.x = 300; p.vx = 0;
    p.update(16.667);
    return { vx: p.vx, input: T.touchMoveX };
  };
  const full = accelFor(72), part = accelFor(40);
  assert.ok(full.vx > 0);
  assert.ok(Math.abs(part.vx / full.vx - part.input) < 1e-6);
});

test('layer shows only during active play and releases held input when hidden', () => {
  const { T, ui } = setup();
  T.updateTouchControls();
  assert.ok(!ui.layer.classList.has('hidden'), 'hidden during play');

  T.keys.TouchFire = true;
  T.setStickVector(72, 0);
  T.setPaused(true);
  T.updateTouchControls();
  assert.ok(ui.layer.classList.has('hidden'), 'visible while paused');
  assert.equal(T.keys.TouchFire, false, 'fire stuck on after pause');
  assert.equal(T.touchMoveX, 0, 'stick stuck after pause');

  for (const [label, set] of [['hangar', () => { T.setPaused(false); T.setInShop(true); }],
                              ['intro', () => { T.setInShop(false); T.setInIntro(true); }],
                              ['menu', () => { T.setInIntro(false); T.setGameActive(false); }]]) {
    set();
    T.updateTouchControls();
    assert.ok(ui.layer.classList.has('hidden'), `visible in ${label}`);
  }
});

test('EMP button appears with the upgrade and dims while recharging', () => {
  const { T, ui } = setup();
  T.setUpgrade('emp', 0);
  T.updateTouchControls();
  assert.ok(ui.emp.classList.has('hidden'), 'EMP shown without the upgrade');

  T.setUpgrade('emp', 1);
  T.empCooldownTimer = 3000;
  T.updateTouchControls();
  assert.ok(!ui.emp.classList.has('hidden'));
  assert.ok(ui.emp.classList.has('cooldown'));

  T.empCooldownTimer = 0;
  T.updateTouchControls();
  assert.ok(!ui.emp.classList.has('cooldown'));
});

test('bullet-time button only on the Matrix level (or matrix cheat)', () => {
  const { T, ui } = setup();
  T.updateTouchControls();
  assert.ok(ui.bt.classList.has('hidden'));
  T.setActiveLevel({ theme: 'matrix' });
  T.updateTouchControls();
  assert.ok(!ui.bt.classList.has('hidden'));
  T.setActiveLevel({});
  T.setCheatMatrix(true);
  T.updateTouchControls();
  assert.ok(!ui.bt.classList.has('hidden'));
});

test('touch EMP fires through the game loop and respects the cooldown', () => {
  const { T } = setup();
  T.setUpgrade('emp', 1);
  T.empCooldownTimer = 0;
  T.keysPressed.TouchEMP = true;
  T.updateGame(16.667);
  assert.equal(T.empShockwaveCount, 1, 'touch EMP did not fire');
  assert.ok(T.empCooldownTimer > 0, 'no cooldown after EMP');
  T.keysPressed.TouchEMP = true; // tapping again while recharging
  T.updateGame(16.667);
  assert.equal(T.empShockwaveCount, 1, 'EMP fired during cooldown');
});

test('touch bullet time activates only on the Matrix level', () => {
  const { T } = setup();
  T.keys.TouchBulletTime = true;
  T.setActiveLevel({ theme: 'matrix' });
  T.updateGame(16.667);
  assert.equal(T.bulletTimeActive, true);
  T.keys.TouchBulletTime = false;
  T.updateGame(16.667);
  assert.equal(T.bulletTimeActive, false);
  T.keys.TouchBulletTime = true;
  T.setActiveLevel({ theme: 'standard' });
  T.updateGame(16.667);
  assert.equal(T.bulletTimeActive, false, 'bullet time outside the Matrix level');
});

test('phone haptics follow touch mode and the vibration setting', () => {
  const { T, ctx } = setup();
  const buzzes = [];
  ctx.navigator.vibrate = ms => { buzzes.push(ms); return true; };
  T.touchHaptic(180);
  assert.deepEqual(buzzes, [180]);

  T.CONFIG.shakeEnabled = false;
  T.touchHaptic(180);
  assert.deepEqual(buzzes, [180], 'buzzed with vibration off');

  T.CONFIG.shakeEnabled = true;
  T.touchEnabled = false; // desktop: never buzz
  T.touchHaptic(180);
  assert.deepEqual(buzzes, [180]);

  T.touchEnabled = true;
  T.padRumble(0.8, 0.5, 180); // gameplay rumble also buzzes the phone
  assert.deepEqual(buzzes, [180, 144]);
});

test('a hold button still works when pointer capture throws', () => {
  const { T } = setup();
  const handlers = {};
  const btn = fakeEl({
    addEventListener: (type, fn) => { handlers[type] = fn; },
    setPointerCapture() { throw new Error('NotFoundError: No active pointer'); }
  });
  T.wireHoldButton(btn, 'TouchFire');
  handlers.pointerdown({ pointerId: 7, preventDefault() {} });
  assert.equal(T.keys.TouchFire, true, 'capture failure stopped FIRE');
  assert.ok(btn.classList.has('active'));
  handlers.pointerup({ pointerId: 7 });
  assert.equal(T.keys.TouchFire, false);
});

test('portrait layout class follows orientation, only in touch mode', () => {
  const { T, ctx } = setup();
  const root = fakeEl();
  ctx.document.documentElement = root;
  ctx.innerWidth = 440; ctx.innerHeight = 956;      // iPhone portrait
  T.updateTouchLayout();
  assert.ok(root.classList.has('touch-portrait'));
  ctx.innerWidth = 956; ctx.innerHeight = 440;      // rotated to landscape
  T.updateTouchLayout();
  assert.ok(!root.classList.has('touch-portrait'));
  T.touchEnabled = false;                           // desktop: never
  ctx.innerWidth = 440; ctx.innerHeight = 956;
  T.updateTouchLayout();
  assert.ok(!root.classList.has('touch-portrait'));
});
