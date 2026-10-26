#!/usr/bin/env node
/* Fails if styles.css changed on this branch but the cache-busting
   `styles.css?v=N` in index.html did not. Without the bump, returning
   players' browsers keep serving the cached stylesheet and new CSS
   silently never loads (this happened with the Reduced Motion rules).

   Usage: node tests/check-css-version.js <base-ref>   (e.g. origin/main)
   Needs the base ref's history available (actions/checkout fetch-depth: 0). */
'use strict';

const { execFileSync } = require('child_process');

const base = process.argv[2];
if (!base) {
  console.error('usage: node tests/check-css-version.js <base-ref>');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const mergeBase = git('merge-base', base, 'HEAD').trim();
const changed = git('diff', '--name-only', mergeBase, 'HEAD').split(/\r?\n/);

if (!changed.includes('styles.css')) {
  console.log('styles.css unchanged — no cache-buster bump needed.');
  process.exit(0);
}

const versionAt = rev => {
  let html;
  try {
    html = git('show', `${rev}:index.html`);
  } catch (e) {
    return null;
  }
  const m = html.match(/styles\.css\?v=([^"'&\s>]+)/);
  return m ? m[1] : null;
};

const before = versionAt(mergeBase);
const after = versionAt('HEAD');

if (after && after !== before) {
  console.log(`styles.css changed and cache-buster bumped (v=${before} -> v=${after}).`);
  process.exit(0);
}

console.error(
  `styles.css changed but index.html still links styles.css?v=${after}.\n` +
  'Bump the ?v= number in index.html so returning players load the new CSS.'
);
process.exit(1);
