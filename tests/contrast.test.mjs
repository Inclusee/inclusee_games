/* ============================================================================
   Inclusee Games - colour contrast tests

     node --test tests/

   The brand palette has two bright colours that cannot carry text: green is
   2.26:1 against white and yellow is 1.50:1. They are lovely as decoration and
   unreadable as words, and the difference is invisible unless you measure it.

   These tests read the real stylesheet, pull the actual colour values out of it,
   and check every pair the pages rely on. Change a colour and this fails
   instead of a resident with poor vision discovering it.

   Targets: 4.5:1 for normal text, 3:1 for large text and for the edges of
   interface controls (WCAG 2.2 AA), 7:1 for body text (AAA, what we aim for).
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const rawCss = readFileSync(join(here, '..', 'games', 'shared', 'inclusee-theme.css'), 'utf8');
// Comments are stripped before reading values: the palette notes mention token
// names in prose ("never --paper: ..."), and a parser that reads those picks up
// a sentence as if it were a colour.
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
const crosswordCss = readFileSync(join(here, '..', 'games', 'crossword', 'css', 'crossword.css'), 'utf8');

/* --------------------------------------------------------------- colour maths */

function parseHex(value) {
  const m = String(value).trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminance(rgb) {
  const parts = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------- stylesheet read */

/** The colour tokens declared in one block of the stylesheet. */
function tokensIn(blockStart, blockEnd) {
  const start = css.indexOf(blockStart);
  assert.notEqual(start, -1, 'could not find ' + blockStart + ' in the stylesheet');
  const end = blockEnd ? css.indexOf(blockEnd, start) : css.length;
  const block = css.slice(start, end === -1 ? css.length : end);
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block)) !== null) out[m[1]] = m[2].trim();
  return out;
}

const light = tokensIn(':root {', 'body.dark');
const dark = tokensIn('body.dark {', '* { box-sizing');

function hex(tokens, name) {
  const raw = tokens[name];
  assert.ok(raw, 'token ' + name + ' is missing');
  const rgb = parseHex(raw);
  assert.ok(rgb, 'token ' + name + ' is not a plain hex colour: ' + raw + ' (a resident cannot be shown a broken colour)');
  return rgb;
}

/** [description, foreground token, background token, minimum ratio] */
function pairsFor(tokens, mode) {
  const brandTextIsTeal = mode === 'light';
  return [
    ['body text on the page', '--ink', '--paper', 7],
    ['secondary text on the page', '--ink-soft', '--paper', 4.5],
    ['body text on the page wash', '--ink', '--paper-soft', 7],
    ['letters in a crossword square', '--ink', '--paper', 7],
    ['letters in the answer being worked on', '--ink', '--entry-fill', 7],
    ['letters in the selected square', '--ink', '--select-fill', 7],
    ['letters in a wrong square', '--bad', '--bad-tint', 4.5],
    ['clue numbers', '--brand-text', '--paper', 4.5],
    ['finished clues', '--green-text', '--paper', 4.5],
    ['streak dots that are done', '--green-text', '--paper', 3],
    ['staff notes and messages', '--ink', '--yellow-tint', 7],
  ];
}

/* ------------------------------------------------------------------ the tests */

test('every colour the pages use is a usable hex value', () => {
  for (const name of ['--ink', '--ink-soft', '--line', '--line-strong', '--grid-line', '--paper',
                      '--paper-soft', '--brand', '--brand-deep', '--brand-text', '--brand-tint',
                      '--entry-fill', '--select-fill', '--green', '--green-text', '--yellow',
                      '--yellow-tint', '--bad', '--bad-tint', '--warn', '--good']) {
    hex(light, name);
    hex(dark, name);
  }
});

test('light screen: text meets AA, and body text meets AAA', () => {
  const checks = [
    ['body text', '--ink', '--paper', 7],
    ['secondary text', '--ink-soft', '--paper', 4.5],
    ['body text on the page wash', '--ink', '--paper-soft', 7],
    ['letters in a square', '--ink', '--paper', 7],
    ['letters in the answer being worked on', '--ink', '--entry-fill', 7],
    ['letters in the selected square', '--select-ink', '--select-fill', 7],
    ['wrong letters', '--bad', '--bad-tint', 4.5],
    ['clue numbers', '--brand-text', '--paper', 4.5],
    ['finished clues', '--green-text', '--paper', 4.5],
    ['staff notes', '--ink', '--yellow-tint', 7],
    ['status messages', '--ink', '--warn-tint', 7],
    ['the clue banner text', '--on-dark', '--brand-deep', 7],
  ];
  for (const [what, fg, bg, min] of checks) {
    const ratio = contrast(hex(light, fg), hex(light, bg));
    assert.ok(ratio >= min, what + ': ' + ratio.toFixed(2) + ':1, needs ' + min + ':1');
  }
});

test('light screen: white text on a button is readable', () => {
  // Buttons use --brand-text as their own background, so the pair to check is
  // white against it.
  const ratio = contrast([255, 255, 255], hex(light, '--brand-text'));
  assert.ok(ratio >= 4.5, 'white on the button colour: ' + ratio.toFixed(2) + ':1, needs 4.5:1');
});

test('dark screen: text meets AA, and body text meets AAA', () => {
  const checks = [
    ['body text', '--ink', '--paper', 7],
    ['secondary text', '--ink-soft', '--paper', 4.5],
    ['body text on the page wash', '--ink', '--paper-soft', 7],
    ['letters in a square', '--ink', '--paper', 7],
    ['letters in the selected square', '--select-ink', '--select-fill', 7],
    ['letters in the answer being worked on', '--ink', '--entry-fill', 7],
    ['wrong letters', '--bad', '--bad-tint', 4.5],
    ['status messages', '--ink', '--warn-tint', 4.5],
    ['clue numbers', '--brand-text', '--paper', 4.5],
    ['finished clues', '--green-text', '--paper', 4.5],
    ['streak dots that are done', '--green-text', '--paper', 3],
    ['the clue banner text', '--on-dark', '--brand-deep', 7],
    ['staff notes', '--ink', '--yellow-tint', 4.5],
  ];
  for (const [what, fg, bg, min] of checks) {
    const ratio = contrast(hex(dark, fg), hex(dark, bg));
    assert.ok(ratio >= min, what + ': ' + ratio.toFixed(2) + ':1, needs ' + min + ':1');
  }
});

test('the crossword square outlines are strongly visible on both screens', () => {
  // Residents told us pale lines between squares were the main problem.
  const lightRatio = contrast(hex(light, '--grid-line'), hex(light, '--paper'));
  const darkRatio = contrast(hex(dark, '--grid-line'), hex(dark, '--paper'));
  assert.ok(lightRatio >= 7, 'light screen grid lines: ' + lightRatio.toFixed(2) + ':1');
  assert.ok(darkRatio >= 7, 'dark screen grid lines: ' + darkRatio.toFixed(2) + ':1');
});

test('interface edges are at least 3:1, as WCAG requires', () => {
  const lightInput = contrast(hex(light, '--line-strong'), hex(light, '--paper'));
  assert.ok(lightInput >= 3, 'input outlines on white: ' + lightInput.toFixed(2) + ':1, needs 3:1');
});

test('the bright brand colours are never used to carry text', () => {
  // Green at 2.26:1 and yellow at 1.50:1 pass no text requirement at all.
  for (const name of ['--green', '--yellow']) {
    const ratio = contrast(hex(light, name), hex(light, '--paper'));
    assert.ok(ratio < 4.5, name + ' has become dark enough to read as text - the stylesheet comments need updating');
  }
  // And the stylesheet must not put text straight onto them.
  const offenders = [];
  const re = /color\s*:\s*var\((--green|--yellow)\)/g;
  let m;
  while ((m = re.exec(crosswordCss + css)) !== null) offenders.push(m[0]);
  assert.deepEqual(offenders, [], 'text is being coloured with a decoration-only colour: ' + offenders.join(', '));
});

test('the yellow highlight keeps navy text readable on it', () => {
  const ratio = contrast(hex(light, '--ink'), hex(light, '--select-fill'));
  assert.ok(ratio >= 7, 'navy on the selected square: ' + ratio.toFixed(2) + ':1');
});

test('the stylesheet records the contrast figures it claims', () => {
  // Cheap guard against the comments drifting away from the values.
  assert.match(rawCss, /#002c40/i, 'the navy token should appear in the palette notes');
  assert.match(rawCss, /14\.64:1/, 'the measured navy contrast should be documented');
});
