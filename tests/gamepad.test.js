/* Gamepad input tests, using a fake navigator.getGamepads() pad. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

// Standard-mapping pad: 17 buttons, 4 axes. press(i) / release(i), stick(x, y).
function fakePad(index = 0) {
  const pad = {
    index, connected: true, mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    rumbles: [],
    vibrationActuator: { playEffect(type, params) { pad.rumbles.push({ type, ...params }); return Promise.resolve('complete'); } }
  };
  pad.press = i => { pad.buttons[i] = { pressed: true, value: 1 }; };
  pad.release = i => { pad.buttons[i] = { pressed: false, value: 0 }; };
  pad.stick = (x, y) => { pad.axes[0] = x; pad.axes[1] = y; };
  return pad;
}

const BTN = { A: 0, B: 1, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

function setup({ playing = true } = {}) {
  const game = loadGame();
  const pad = fakePad();
  game.ctx.navigator.getGamepads = () => [pad];
  const { T } = game;
  T.setPlayer();
  T.setGameActive(playing);
  T.setPaused(false);
  T.setInShop(false);
  T.setInIntro(false);
  return { ...game, pad };
}

test('no controller connected: polling is a no-op', () => {
  const { T, ctx } = loadGame();
  ctx.navigator.getGamepads = () => [null, null];
  T.pollGamepad();
  assert.equal(T.padMoveX, 0);
  assert.equal(T.padMoveY, 0);
});

test('left stick is analog with a deadzone', () => {
  const { T, pad } = setup();
  pad.stick(0.15, -0.1); // drift inside the deadzone
  T.pollGamepad();
  assert.equal(T.padMoveX, 0);
  assert.equal(T.padMoveY, 0);

  pad.stick(0.6, 1);
  T.pollGamepad();
  assert.ok(Math.abs(T.padMoveX - 0.5) < 1e-9, `x ${T.padMoveX}`); // (0.6 - 0.2) / 0.8
  assert.equal(T.padMoveY, 1);
});

test('half stick tilt accelerates the ship half as much as full', () => {
  const accelFor = x => {
    const { T, pad } = setup();
    pad.stick(x, 0);
    T.pollGamepad();
    const p = T.player;
    p.x = 300; p.vx = 0;
    p.update(16.667);
    return p.vx;
  };
  const full = accelFor(1), half = accelFor(0.6);
  assert.ok(full > 0);
  assert.ok(Math.abs(half / full - 0.5) < 1e-6, `half/full = ${half / full}`);
});

test('D-pad moves at full speed and overrides the stick', () => {
  const { T, pad } = setup();
  pad.stick(0.6, 0);
  pad.press(BTN.LEFT);
  pad.press(BTN.UP);
  T.pollGamepad();
  assert.equal(T.padMoveX, -1);
  assert.equal(T.padMoveY, -1);
});

test('A / RT fire while held; RB / LT drive bullet time', () => {
  const { T, pad } = setup();
  pad.press(BTN.A);
  T.pollGamepad();
  assert.equal(T.keys.PadFire, true);
  pad.release(BTN.A);
  pad.press(BTN.RT);
  T.pollGamepad();
  assert.equal(T.keys.PadFire, true, 'RT should fire');
  pad.release(BTN.RT);
  T.pollGamepad();
  assert.equal(T.keys.PadFire, false);

  pad.press(BTN.RB);
  T.pollGamepad();
  assert.equal(T.keys.PadBulletTime, true);
});

test('B triggers EMP once per press, not every frame while held', () => {
  const { T, pad } = setup();
  pad.press(BTN.B);
  T.pollGamepad();
  assert.equal(T.keysPressed.PadEMP, true);
  T.clearKeysPressed(); // updateGame consumes edges each frame
  T.pollGamepad();      // still held
  assert.ok(!T.keysPressed.PadEMP, 'held B re-fired EMP');
  pad.release(BTN.B);
  T.pollGamepad();
  pad.press(BTN.LB);    // LB is the alternate EMP button
  T.pollGamepad();
  assert.equal(T.keysPressed.PadEMP, true);
});

test('Start pauses and resumes', () => {
  const { T, pad } = setup();
  pad.press(BTN.START);
  T.pollGamepad();
  assert.equal(T.gamePaused, true);
  T.pollGamepad(); // held — no toggle
  assert.equal(T.gamePaused, true);
  pad.release(BTN.START);
  T.pollGamepad();
  pad.press(BTN.START);
  T.pollGamepad();
  assert.equal(T.gamePaused, false);
});

test('in menus the pad navigates buttons instead of flying the ship', () => {
  const { T, ctx, pad } = setup({ playing: false });
  const clicked = [];
  const mkButton = (name, i) => {
    const classes = new Set();
    return {
      name, disabled: false, offsetParent: {},
      getBoundingClientRect: () => ({ left: 100, top: 100 + i * 60, width: 200, height: 40 }), // stacked vertically
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), has: c => classes.has(c) },
      focus() {}, scrollIntoView() {}, click() { clicked.push(name); }
    };
  };
  const buttons = ['start', 'daily', 'bossrush'].map(mkButton);
  const panel = { querySelectorAll: () => buttons };
  ctx.document.querySelectorAll = sel => (sel.includes('overlay-panel') ? [panel] : []);

  pad.stick(1, 0);
  T.pollGamepad();                        // stick right: highlights the first button
  assert.equal(T.padMoveX, 0, 'ship input leaked into the menu');
  pad.stick(0, 0);
  T.pollGamepad();                        // stick back to centre
  for (const b of buttons) b.classList.remove('pad-focus');
  pad.press(BTN.UP); T.pollGamepad();     // from start, nothing above: wraps to bossrush
  pad.release(BTN.UP); T.pollGamepad();
  pad.press(BTN.DOWN); T.pollGamepad();   // wraps forward -> start
  pad.release(BTN.DOWN); T.pollGamepad();
  pad.press(BTN.DOWN); T.pollGamepad();   // -> daily
  pad.release(BTN.DOWN); T.pollGamepad();
  assert.ok(buttons[1].classList.has('pad-focus'), 'daily not highlighted');
  assert.ok(!buttons[0].classList.has('pad-focus'));

  pad.press(BTN.UP); T.pollGamepad();     // back to start
  pad.release(BTN.UP); T.pollGamepad();
  pad.press(BTN.UP); T.pollGamepad();     // wraps to bossrush
  pad.release(BTN.UP); T.pollGamepad();
  pad.press(BTN.A); T.pollGamepad();
  assert.deepEqual(clicked, ['bossrush']);
});

test('first A on a screen only highlights, so a carried-over press cannot click', () => {
  const { T, ctx, pad } = setup({ playing: false });
  const clicked = [];
  const b = { disabled: false, offsetParent: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }), classList: { add() {}, remove() {} }, focus() {}, scrollIntoView() {}, click() { clicked.push('x'); } };
  ctx.document.querySelectorAll = sel => (sel.includes('overlay-panel') ? [{ querySelectorAll: () => [b] }] : []);
  pad.press(BTN.A); T.pollGamepad();
  assert.deepEqual(clicked, []);
  pad.release(BTN.A); T.pollGamepad();
  pad.press(BTN.A); T.pollGamepad();
  assert.deepEqual(clicked, ['x']);
});

test('rumble plays on the active pad and respects SCREEN VIBRATION', () => {
  const { T, pad } = setup();
  T.pollGamepad(); // adopt the pad
  T.padRumble(0.8, 0.5, 180);
  assert.equal(pad.rumbles.length, 1);
  assert.equal(pad.rumbles[0].type, 'dual-rumble');
  assert.equal(pad.rumbles[0].duration, 180);

  T.CONFIG.shakeEnabled = false;
  T.padRumble(1, 1, 400);
  assert.equal(pad.rumbles.length, 1, 'rumbled with vibration off');
});

test('disconnecting mid-fight releases input and auto-pauses', () => {
  const { T, pad, listeners } = setup();
  pad.press(BTN.A);
  pad.stick(1, 0);
  T.pollGamepad();
  assert.equal(T.keys.PadFire, true);
  for (const fn of listeners.gamepaddisconnected || []) fn({ gamepad: pad });
  assert.equal(T.keys.PadFire, false);
  assert.equal(T.padMoveX, 0);
  assert.equal(T.gamePaused, true);
});

// Fake menu with buttons at given (col, row) grid positions.
function gridMenu(ctx, layout, panelId = 'start-menu') {
  const clicked = [];
  const buttons = layout.map(([name, col, row]) => {
    const classes = new Set();
    return {
      name, id: name, disabled: false, offsetParent: {},
      getBoundingClientRect: () => ({ left: 100 + col * 220, top: 100 + row * 70, width: 200, height: 50 }),
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), has: c => classes.has(c) },
      focus() {}, scrollIntoView() {}, click() { clicked.push(name); }
    };
  });
  const panel = { id: panelId, querySelectorAll: () => buttons };
  ctx.document.querySelectorAll = sel => (sel.includes('overlay-panel') ? [panel] : []);
  const focused = () => (buttons.find(b => b.classList.has('pad-focus')) || {}).name;
  return { buttons, clicked, focused };
}

test('menu D-pad moves spatially through a grid (start menu 3 x 2)', () => {
  const { T, ctx, pad } = setup({ playing: false });
  const menu = gridMenu(ctx, [
    ['start', 0, 0], ['daily', 1, 0], ['bossrush', 2, 0],
    ['settings', 0, 1], ['scores', 1, 1], ['achievements', 2, 1]
  ]);
  const tap = b => { pad.press(b); T.pollGamepad(); pad.release(b); T.pollGamepad(); };
  tap(BTN.DOWN);                 // first press highlights the first button
  assert.equal(menu.focused(), 'start');
  tap(BTN.DOWN);
  assert.equal(menu.focused(), 'settings', 'down should go to the button below, not the next in page order');
  tap(BTN.RIGHT);
  assert.equal(menu.focused(), 'scores');
  tap(BTN.UP);
  assert.equal(menu.focused(), 'daily');
  tap(BTN.RIGHT);
  tap(BTN.RIGHT);                // nothing further right: falls back to page order (wraps)
  assert.equal(menu.focused(), 'settings');
});

test('B goes back on settings / leaderboard / pause, but not on game over', () => {
  for (const [panelId, backId] of [['settings-menu', 'btn-settings-back'], ['leaderboard-menu', 'btn-scores-back'], ['pause-screen', 'btn-pause-resume']]) {
    const { T, ctx, pad } = setup({ playing: false });
    gridMenu(ctx, [['other', 0, 0]], panelId);
    const clicked = [];
    ctx.document.getElementById = id => ({ click: () => clicked.push(id) });
    pad.press(BTN.B); T.pollGamepad();
    assert.deepEqual(clicked, [backId], panelId);
  }
  const { T, ctx, pad } = setup({ playing: false });
  gridMenu(ctx, [['submit', 0, 0]], 'game-over-screen');
  const clicked = [];
  ctx.document.getElementById = id => ({ click: () => clicked.push(id) });
  pad.press(BTN.B); T.pollGamepad();
  assert.deepEqual(clicked, [], 'B must not leave the game-over screen');
});

test('B still fires EMP during gameplay (not Back)', () => {
  const { T, pad } = setup({ playing: true });
  pad.press(BTN.B); T.pollGamepad();
  assert.equal(T.keysPressed.PadEMP, true);
});

test('menu navigation on the start-menu layout (measured in Chrome)', () => {
  const { T, ctx, pad } = setup({ playing: false });
  // [name, left, top, width, height]: start-menu layout at 1440px, rebuilt
  // from button centres / sizes measured in Chrome (approximate).
  const rects = [
    ['diff-cadet', 575, 322, 103, 31], ['diff-hero', 678, 322, 92, 31], ['diff-elite', 770, 322, 103, 31],
    ['start', 280, 380, 286, 48], ['daily', 577, 380, 286, 48], ['bossrush', 874, 380, 286, 48],
    ['settings', 280, 447, 286, 41], ['scores', 577, 447, 286, 41], ['achievements', 874, 447, 286, 41]
  ];
  const buttons = rects.map(([name, left, top, width, height]) => {
    const classes = new Set();
    return { name, disabled: false, offsetParent: {}, getBoundingClientRect: () => ({ left, top, width, height }),
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), has: c => classes.has(c) },
      focus() {}, scrollIntoView() {}, click() {} };
  });
  ctx.document.querySelectorAll = sel => (sel.includes('overlay-panel') ? [{ querySelectorAll: () => buttons }] : []);
  const focused = () => buttons.find(b => b.classList.has('pad-focus')).name;
  const tap = b => { pad.press(b); T.pollGamepad(); pad.release(b); T.pollGamepad(); };
  const go = (b, expected) => { tap(b); assert.equal(focused(), expected); };
  tap(BTN.DOWN);              // highlights the first button (CADET)
  go(BTN.DOWN, 'daily');      // CADET sits above part of DAILY
  go(BTN.LEFT, 'start');      // stays in the row (used to jump up to CADET)
  go(BTN.RIGHT, 'daily');     // used to jump up to CADET
  go(BTN.RIGHT, 'bossrush');
  go(BTN.DOWN, 'achievements');
  go(BTN.LEFT, 'scores');
  go(BTN.LEFT, 'settings');
  go(BTN.UP, 'start');
  go(BTN.UP, 'diff-cadet');
});
