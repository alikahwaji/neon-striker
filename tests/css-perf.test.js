/* CSS performance guards. Measured in Chrome (Intel Arc, DPR 2): one
   infinite @keyframes interpolating text-shadow on the pulsing titles held
   the whole game at 10-16 fps — the glow repaint dragged the blurred
   (backdrop-filter) menu panel with it, on the menu and in gameplay, since
   hidden panels keep animating. Switching it to an opacity pulse: 60-61. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

function keyframes(source) {
  const out = {};
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1, i = re.lastIndex;
    while (depth && i < source.length) { if (source[i] === '{') depth++; else if (source[i] === '}') depth--; i++; }
    out[m[1]] = source.slice(re.lastIndex, i - 1);
  }
  return out;
}

test('no @keyframes animates text-shadow (forces full repaints every frame)', () => {
  const offenders = Object.entries(keyframes(css)).filter(([, body]) => /text-shadow\s*:/.test(body)).map(([name]) => name);
  assert.deepEqual(offenders, [], `animate opacity/transform instead: ${offenders.join(', ')}`);
});

test('the title pulse is an opacity animation', () => {
  const body = keyframes(css)['pulse-glow'];
  assert.ok(body, 'pulse-glow keyframes missing');
  assert.match(body, /opacity/);
});
