/* ----------------------------------------------------
   NEON STRIKER - Gamepad Support
   Standard-mapping controllers (Xbox / PlayStation / most USB pads) via
   the Gamepad API. Polled once per rAF tick from gameTick, before
   updateGame, and translated into the same input state the keyboard
   feeds:
     - padMoveX / padMoveY: analog movement (-1..1), read by PlayerShip
     - keys.PadFire / keys.PadBulletTime: held buttons
     - keysPressed.PadEMP: one-shot edge (cleared by updateGame)
   Dedicated Pad* codes (instead of faking Space / E) keep the pad from
   clobbering keyboard state, and let EMP be a separate button from
   bullet time (on the keyboard, E / Shift drive both).

   Mapping (W3C "standard" layout):
     Left stick / D-pad  move (stick is analog)
     A (0) / RT (7)      fire
     B (1) / LB (4)      EMP
     RB (5) / LT (6)     bullet time (Matrix level)
     Start (9)           pause / resume
   Menus (any visible overlay panel): D-pad / stick moves between buttons,
   A presses the highlighted one.
   ---------------------------------------------------- */

const PAD_DEADZONE = 0.2;
const PAD_MENU_REPEAT_FIRST_MS = 320; // hold-to-repeat when navigating menus
const PAD_MENU_REPEAT_MS = 140;

const PAD_BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

let padMoveX = 0;
let padMoveY = 0;
let padIndex = null;         // index of the controller we're reading
let padPrevButtons = [];     // pressed state last tick, for edge detection
let padMenuDir = 0;          // -1 / 0 / 1 currently held menu direction
let padMenuRepeatAt = 0;     // frameNow when the held direction repeats
let padFocusedEl = null;

function padPressed(pad, i) {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

// Rescale past the deadzone so small stick drift reads as 0 and full tilt
// still reaches 1.
function padAxis(v) {
  const a = Math.abs(v);
  if (a < PAD_DEADZONE) return 0;
  return Math.sign(v) * Math.min(1, (a - PAD_DEADZONE) / (1 - PAD_DEADZONE));
}

function getActivePad() {
  if (!navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  if (padIndex !== null && pads[padIndex] && pads[padIndex].connected) return pads[padIndex];
  // Adopt the first connected pad (covers browsers that never fire
  // gamepadconnected until a button is pressed).
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] && pads[i].connected) { padIndex = i; return pads[i]; }
  }
  padIndex = null;
  return null;
}

function releasePadInput() {
  padMoveX = 0;
  padMoveY = 0;
  keys.PadFire = false;
  keys.PadBulletTime = false;
  padPrevButtons = [];
  padMenuDir = 0;
}

// Called every rAF tick (gameTick). Cheap when no pad is connected.
function pollGamepad() {
  const pad = getActivePad();
  if (!pad) {
    if (padPrevButtons.length) releasePadInput();
    return;
  }

  const now = pad.buttons.map((_, i) => padPressed(pad, i));
  const edge = i => now[i] && !padPrevButtons[i];

  const dpadX = (now[PAD_BTN.RIGHT] ? 1 : 0) - (now[PAD_BTN.LEFT] ? 1 : 0);
  const dpadY = (now[PAD_BTN.DOWN] ? 1 : 0) - (now[PAD_BTN.UP] ? 1 : 0);
  const stickX = padAxis(pad.axes[0] || 0);
  const stickY = padAxis(pad.axes[1] || 0);

  if (edge(PAD_BTN.START)) togglePause();

  const inMenu = !gameActive || gamePaused || inShop;
  if (inMenu) {
    // No ship control while a menu is up; drive the menu instead.
    padMoveX = 0;
    padMoveY = 0;
    keys.PadFire = false;
    keys.PadBulletTime = false;
    // One direction at a time: D-pad first, else the stick's dominant axis.
    let mx = 0, my = 0;
    if (dpadX || dpadY) { if (dpadY) my = dpadY; else mx = dpadX; }
    else if (Math.abs(stickY) >= Math.abs(stickX)) my = Math.sign(stickY);
    else mx = Math.sign(stickX);
    padMenuNavigate(mx, my);
    if (edge(PAD_BTN.A)) padMenuActivate();
    else if (edge(PAD_BTN.B)) padMenuBack();
  } else {
    clearPadFocus();
    padMoveX = dpadX || stickX;
    padMoveY = dpadY || stickY;
    keys.PadFire = now[PAD_BTN.A] || now[PAD_BTN.RT];
    keys.PadBulletTime = now[PAD_BTN.RB] || now[PAD_BTN.LT];
    if (edge(PAD_BTN.B) || edge(PAD_BTN.LB)) keysPressed.PadEMP = true;
  }

  padPrevButtons = now;
}

/* ---------- menu navigation ---------- */

function visiblePanelButtons() {
  // Only one overlay panel is shown at a time; take the last visible one
  // (later in the DOM = drawn on top) in case two ever overlap.
  const panels = document.querySelectorAll('.overlay-panel:not(.hidden)');
  const panel = panels[panels.length - 1];
  if (!panel) return [];
  return Array.from(panel.querySelectorAll('button')).filter(
    b => !b.disabled && b.offsetParent !== null
  );
}

function setPadFocus(el) {
  if (padFocusedEl === el) return;
  clearPadFocus();
  padFocusedEl = el;
  if (el) {
    el.classList.add('pad-focus');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }
}

function clearPadFocus() {
  if (padFocusedEl) padFocusedEl.classList.remove('pad-focus');
  padFocusedEl = null;
}

// Spatial menu navigation: move to the nearest button in the pressed
// direction (menus are grids — page order made "down" step sideways).
//   along  = how far the target is in the pressed direction (centres)
//   across = 0 if the two buttons overlap sideways (CADET sits directly
//            above part of the much wider DAILY CHALLENGE button even
//            though their centres differ), else the sideways centre offset
// 1) prefer targets within 45 deg of the direction, scored along + 5*across;
// 2) else the best target anywhere in that direction;
// 3) else fall back to page order (with wrap) so nothing is unreachable.
// Tuned against the real start-menu layout.
function padMenuNavigate(mx, my) {
  const dirKey = mx || my ? `${mx},${my}` : 0;
  if (dirKey === 0) { padMenuDir = 0; return; }
  // Step on first press, then auto-repeat while held.
  if (dirKey === padMenuDir && frameNow < padMenuRepeatAt) return;
  padMenuRepeatAt = frameNow + (dirKey === padMenuDir ? PAD_MENU_REPEAT_MS : PAD_MENU_REPEAT_FIRST_MS);
  padMenuDir = dirKey;

  const buttons = visiblePanelButtons();
  if (!buttons.length) return;
  const i = buttons.indexOf(padFocusedEl);
  if (i < 0) { setPadFocus(buttons[0]); return; }

  const best = nearestButtonInDirection(padFocusedEl, buttons, mx, my, true) ||
               nearestButtonInDirection(padFocusedEl, buttons, mx, my, false) ||
               buttons[(i + ((mx || my) > 0 ? 1 : -1) + buttons.length) % buttons.length];
  setPadFocus(best);
}

function nearestButtonInDirection(fromEl, buttons, mx, my, coneOnly) {
  const f = fromEl.getBoundingClientRect();
  const fx = f.left + f.width / 2, fy = f.top + f.height / 2;
  let best = null, bestScore = Infinity;
  for (const b of buttons) {
    if (b === fromEl) continue;
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const along = (cx - fx) * mx + (cy - fy) * my;
    if (along <= 4) continue; // not in the pressed direction
    const overlaps = my
      ? r.left < f.left + f.width && f.left < r.left + r.width   // same column
      : r.top < f.top + f.height && f.top < r.top + r.height;    // same row
    const across = overlaps ? 0 : (my ? Math.abs(cx - fx) : Math.abs(cy - fy));
    if (coneOnly && across > along) continue;
    const score = along + across * 5;
    if (score < bestScore) { bestScore = score; best = b; }
  }
  return best;
}

// B = Back on screens that have one. Deliberately not on game over (an
// accidental B mustn't skip submitting a high score) or in the hangar.
const PAD_BACK_BUTTONS = {
  'settings-menu': 'btn-settings-back',
  'achievements-menu': 'btn-achievements-back',
  'leaderboard-menu': 'btn-scores-back',
  'pause-screen': 'btn-pause-resume'
};

function padMenuBack() {
  const panels = document.querySelectorAll('.overlay-panel:not(.hidden)');
  const panel = panels[panels.length - 1];
  const backId = panel && PAD_BACK_BUTTONS[panel.id];
  const btn = backId && document.getElementById(backId);
  if (!btn) return;
  clearPadFocus();
  btn.click();
}

function padMenuActivate() {
  const buttons = visiblePanelButtons();
  if (!buttons.length) return;
  if (!padFocusedEl || !buttons.includes(padFocusedEl)) {
    // First A press on a fresh screen just highlights the first button,
    // so a press carried over from gameplay can't fire a menu action.
    setPadFocus(buttons[0]);
    return;
  }
  const el = padFocusedEl;
  clearPadFocus(); // the click usually swaps screens
  el.click();
}

/* ---------- rumble ---------- */

// Short dual-motor rumble on the active pad. Gated by the SCREEN VIBRATION
// setting (the game's one "vibration" switch). No-op on pads / browsers
// without vibrationActuator.
function padRumble(strong, weak, durationMs) {
  // Phones get a matching buzz via the Vibration API (touch.js).
  if (typeof touchHaptic === 'function') touchHaptic(durationMs * Math.max(strong, weak));
  if (!CONFIG.shakeEnabled || padIndex === null || !navigator.getGamepads) return;
  const pad = navigator.getGamepads()[padIndex];
  const act = pad && pad.vibrationActuator;
  if (!act || typeof act.playEffect !== 'function') return;
  try {
    const p = act.playEffect('dual-rumble', {
      duration: durationMs, strongMagnitude: strong, weakMagnitude: weak
    });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* unsupported effect type — ignore */ }
}

/* ---------- connect / disconnect ---------- */

window.addEventListener('gamepadconnected', e => {
  if (padIndex === null) padIndex = e.gamepad.index;
  // Lets on-screen hints switch to controller wording (styles.css).
  document.documentElement.classList.add('pad-connected');
  if (typeof showBonusToast === 'function') {
    showBonusToast('🎮', 'CONTROLLER CONNECTED', 'INPUT', 2500);
  }
});

window.addEventListener('gamepaddisconnected', e => {
  if (e.gamepad.index !== padIndex) return;
  padIndex = null;
  document.documentElement.classList.remove('pad-connected');
  releasePadInput();
  clearPadFocus();
  // Losing the controller mid-fight shouldn't leave the ship undefended.
  if (typeof autoPauseIfPlaying === 'function') autoPauseIfPlaying();
});
