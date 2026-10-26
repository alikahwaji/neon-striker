/* ----------------------------------------------------
   NEON STRIKER - Touch Controls
   On-screen controls for phones / tablets, built lazily the first time
   the device reports touch (coarse pointer or a touchstart), so desktop
   players never get the extra DOM.

     Left half      floating thumbstick: appears under the thumb, analog
                    -1..1 per axis (touchMoveX / touchMoveY, read by
                    PlayerShip just like the gamepad stick)
     FIRE           hold to fire (keys.TouchFire)
     EMP            one-shot EMP (keysPressed.TouchEMP); shown once the
                    EMP upgrade is owned, dimmed while recharging
     ⏱ (Matrix)     hold for bullet time (keys.TouchBulletTime)
     Pause          the HUD's existing PAUSE button (stays tappable: the
                    touch layer sits under the HUD at z-index 2)

   The layer is only visible during active gameplay; menus, the hangar
   and game over use ordinary taps on their HTML buttons. Uses pointer
   events, so multi-touch (move + fire) works and each control tracks its
   own finger via pointer capture.
   ---------------------------------------------------- */

const TOUCH_STICK_DEADZONE = 0.12;

let touchEnabled = false;
let touchMoveX = 0;
let touchMoveY = 0;
let touchUi = null;          // { layer, zone, base, knob, fire, emp, bt }
let touchStickPointer = null;
let touchStickOrigin = null; // { x, y } in layer-local CSS px
let touchLayerShown = false;

function enableTouchControls() {
  if (touchEnabled) return;
  touchEnabled = true;
  buildTouchControls();
}

function buildTouchControls() {
  const container = document.getElementById('game-container');
  if (!container || touchUi) return;

  const layer = document.createElement('div');
  layer.id = 'touch-controls';
  layer.className = 'touch-controls hidden';
  layer.innerHTML = `
    <div class="touch-stick-zone" aria-label="Move: drag anywhere on the left half">
      <div class="touch-stick-base hidden"><div class="touch-stick-knob"></div></div>
    </div>
    <div class="touch-buttons">
      <div class="touch-btn touch-bt hidden" role="button" aria-label="Bullet time">⏱</div>
      <div class="touch-btn touch-emp hidden" role="button" aria-label="EMP">EMP</div>
      <div class="touch-btn touch-fire" role="button" aria-label="Fire">FIRE</div>
    </div>`;
  // Directly after the canvas so it stacks under the HUD and overlays.
  const canvasEl = document.getElementById('gameCanvas');
  container.insertBefore(layer, canvasEl ? canvasEl.nextSibling : container.firstChild);

  touchUi = {
    layer,
    zone: layer.querySelector('.touch-stick-zone'),
    base: layer.querySelector('.touch-stick-base'),
    knob: layer.querySelector('.touch-stick-knob'),
    fire: layer.querySelector('.touch-fire'),
    emp: layer.querySelector('.touch-emp'),
    bt: layer.querySelector('.touch-bt')
  };

  // No long-press menus / text selection on the controls.
  layer.addEventListener('contextmenu', e => e.preventDefault());

  wireTouchStick();
  wireHoldButton(touchUi.fire, 'TouchFire');
  wireHoldButton(touchUi.bt, 'TouchBulletTime');
  touchUi.emp.addEventListener('pointerdown', e => {
    e.preventDefault();
    keysPressed.TouchEMP = true;
    touchUi.emp.classList.add('active');
  });
  const empUp = () => touchUi.emp.classList.remove('active');
  touchUi.emp.addEventListener('pointerup', empUp);
  touchUi.emp.addEventListener('pointercancel', empUp);
  touchUi.emp.addEventListener('pointerleave', empUp);
}

// Pointer capture keeps a control's events flowing to it if the finger
// slides off. It's only an enhancement: setPointerCapture throws when the
// pointer is no longer active (very quick taps, some browsers), and an
// exception there would abort the handler before the input was set.
function capturePointer(el, pointerId) {
  try {
    if (el.setPointerCapture) el.setPointerCapture(pointerId);
  } catch (e) { /* pointer already gone — the control still works */ }
}

function wireHoldButton(el, keyCode) {
  const down = e => {
    e.preventDefault();
    keys[keyCode] = true;
    capturePointer(el, e.pointerId);
    el.classList.add('active');
  };
  const up = () => {
    keys[keyCode] = false;
    el.classList.remove('active');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

function stickRadius() {
  // Scales with the playfield so the throw feels the same on any screen.
  return Math.max(32, touchUi.layer.clientHeight * 0.12);
}

function wireTouchStick() {
  const { zone, base, knob, layer } = touchUi;

  zone.addEventListener('pointerdown', e => {
    if (touchStickPointer !== null) return; // one thumb steers
    e.preventDefault();
    touchStickPointer = e.pointerId;
    capturePointer(zone, e.pointerId);
    const r = layer.getBoundingClientRect();
    touchStickOrigin = { x: e.clientX - r.left, y: e.clientY - r.top };
    base.style.left = `${touchStickOrigin.x}px`;
    base.style.top = `${touchStickOrigin.y}px`;
    base.classList.remove('hidden');
    setStickVector(0, 0);
  });

  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== touchStickPointer) return;
    const r = layer.getBoundingClientRect();
    setStickVector(e.clientX - r.left - touchStickOrigin.x, e.clientY - r.top - touchStickOrigin.y);
  });

  const end = e => {
    if (e.pointerId !== touchStickPointer) return;
    releaseTouchStick();
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
}

// dx / dy: thumb offset from the stick origin in CSS px.
function setStickVector(dx, dy) {
  const R = stickRadius();
  const len = Math.hypot(dx, dy);
  const k = len > R ? R / len : 1; // clamp the knob to the base rim
  const kx = dx * k, ky = dy * k;
  touchUi.knob.style.transform = `translate(${kx}px, ${ky}px)`;

  const mag = Math.min(1, len / R);
  if (mag < TOUCH_STICK_DEADZONE) {
    touchMoveX = 0;
    touchMoveY = 0;
    return;
  }
  // Rescale past the deadzone so full deflection still reaches 1.
  const scaled = (mag - TOUCH_STICK_DEADZONE) / (1 - TOUCH_STICK_DEADZONE);
  touchMoveX = (dx / len) * scaled;
  touchMoveY = (dy / len) * scaled;
}

function releaseTouchStick() {
  touchStickPointer = null;
  touchMoveX = 0;
  touchMoveY = 0;
  if (touchUi) {
    touchUi.base.classList.add('hidden');
    touchUi.knob.style.transform = '';
  }
}

function releaseTouchInput() {
  releaseTouchStick();
  keys.TouchFire = false;
  keys.TouchBulletTime = false;
  if (touchUi) {
    touchUi.fire.classList.remove('active');
    touchUi.bt.classList.remove('active');
  }
}

// Called every rAF tick from gameTick: show the layer only in active
// gameplay (so menu taps reach their buttons) and keep the contextual
// EMP / bullet-time buttons in sync.
function updateTouchControls() {
  if (!touchUi) return;
  const show = gameActive && !gamePaused && !inShop && !inIntro;
  if (show !== touchLayerShown) {
    touchLayerShown = show;
    touchUi.layer.classList.toggle('hidden', !show);
    // Fingers lifted on a menu never send pointerup to a hidden layer;
    // drop all held input so nothing is stuck when play resumes.
    if (!show) releaseTouchInput();
  }
  if (!show) return;

  const hasEmp = playerUpgrades.emp > 0;
  touchUi.emp.classList.toggle('hidden', !hasEmp);
  if (hasEmp) touchUi.emp.classList.toggle('cooldown', empCooldownTimer > 0);

  const lvl = activeLevelData || {};
  touchUi.bt.classList.toggle('hidden', !(lvl.theme === 'matrix' || cheatMatrix));
}

// Short haptic buzz on phones that support it (Android Chrome; iOS Safari
// has no Vibration API). Same SCREEN VIBRATION gate as controller rumble.
function touchHaptic(durationMs) {
  if (!touchEnabled || !CONFIG.shakeEnabled || !navigator.vibrate) return;
  try { navigator.vibrate(Math.round(durationMs)); } catch (e) { /* blocked */ }
}

// Turn the controls on for touch devices: coarse primary pointer at load,
// or the first real touch (covers touch laptops / tablets with a mouse).
window.addEventListener('load', () => {
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) enableTouchControls();
});
window.addEventListener('touchstart', enableTouchControls, { passive: true, once: true });
