/* ============================================================================
   Inclusee Games — crossword generator tests

     node --test tests/

   These guard the two things that quietly ruin a puzzle: a grid that invents an
   answer nobody clued (two words merging into one run), and a clue that goes
   missing because the generator could not fit it in.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const generator = require('../games/crossword/js/grid-generator.js');
const puzzleText = require('../games/crossword/js/puzzle-text.js');

const WORDS = `KITCHEN TEA ARMCHAIR GARDEN KNIFE ICE CAT CLOCK BED MOWER SINK TOMORROW
SPRING BUTTER SEVEN ICECREAM SLIPPERS WHALE WINDOW TEABAG BARBIE DRIZZLE BENCH
APPLE BISCUIT PILLOW LETTER SUNSHINE KETTLE RADIO CURTAIN TEAPOT BAKE BIRD
SEASIDE UMBRELLA POSTBOX ROSEMARY LEMON PANCAKE JUKEBOX LADDER BASKET SUNDAY
CHOCOLATE LANTERN PANTRY HAMMOCK APRON BICYCLE PUZZLE CANDLE MIRROR AVENUE
PICNIC ORCHARD HONEY MARMALADE TRACTOR RIBBON MUG SAUCEPAN VASE NEWSPAPER
GLOVES SCARF MONDAY HOLIDAY BEACH ALBUM SCISSORS POETRY DOORWAY CUSHION
`.trim().split(/\s+/);

function rng(seed) { return generator.makeRng(seed); }

/** Every run of 2+ letters must be an entry the player can actually solve. */
function strayRuns(puzzle) {
  const starts = new Set(puzzle.entries.map(e => e.row + ',' + e.col + ',' + e.direction));
  const grid = puzzle.grid, rows = puzzle.rows, cols = puzzle.cols;
  const strays = [];
  const runLen = (r, c, dr, dc) => {
    let n = 0;
    while (r + dr * n >= 0 && r + dr * n < rows && c + dc * n >= 0 && c + dc * n < cols && grid[r + dr * n][c + dc * n]) n++;
    return n;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const aStart = !(c > 0 && grid[r][c - 1]);
      if (aStart && runLen(r, c, 0, 1) >= 2 && !starts.has(r + ',' + c + ',across')) strays.push({ r, c, dir: 'across' });
      const dStart = !(r > 0 && grid[r - 1][c]);
      if (dStart && runLen(r, c, 1, 0) >= 2 && !starts.has(r + ',' + c + ',down')) strays.push({ r, c, dir: 'down' });
    }
  }
  return strays;
}

function checkInvariants(puzzle, expectedAnswers, label) {
  // 1. every entry agrees with the grid underneath it
  for (const e of puzzle.entries) {
    e.cells.forEach(([r, c], i) => {
      assert.equal(puzzle.grid[r][c], e.answer[i], label + ': entry ' + e.number + ' ' + e.direction + ' "' + e.answer + '" disagrees with the grid');
    });
  }
  // 2. no accidental words
  assert.deepEqual(strayRuns(puzzle), [], label + ': grid contains an unclued word');
  // 3. every clue staff wrote is in the puzzle
  assert.deepEqual(puzzle.unplaced, [], label + ': a clue could not be placed');
  const answers = puzzle.entries.map(e => e.answer).sort();
  assert.deepEqual(answers, expectedAnswers.slice().sort(), label + ': placed answers differ from the requested clues');
  // 4. clues travelled with their answers
  for (const e of puzzle.entries) {
    assert.ok(e.clue && e.clue.length > 0, label + ': entry ' + e.answer + ' lost its clue');
  }
  // 5. nothing silly in the geometry
  assert.ok(puzzle.rows >= 3 && puzzle.cols >= 3, label + ': grid too small');
  assert.ok(puzzle.rows <= 40 && puzzle.cols <= 40, label + ': grid far too large');
}

test('a realistic puzzle builds cleanly', () => {
  const raw = [
    '#Title: Around the House',
    '#Date: 2026-09-25',
    '',
    'The room where you cook the meals = KITCHEN',
    'A hot drink = TEA',
    'Where you grow flowers = GARDEN',
    'You use this to slice bread = KNIFE',
    'A pet that purrs = CAT',
    'It hangs on the wall = CLOCK',
    'A machine for cutting the grass = MOWER',
    ''
  ].join('\n');

  const parsed = puzzleText.parse(raw);
  assert.equal(parsed.problems.length, 0);
  const puzzle = generator.generate(parsed.clues, { seed: '2026-09-25' });
  checkInvariants(puzzle, parsed.clues.map(c => c.answer), 'around-the-house');
});

test('the same seed always produces the same grid', () => {
  const clues = WORDS.slice(0, 12).map((answer, i) => ({ clue: 'Clue number ' + (i + 1), answer }));
  const a = generator.generate(clues, { seed: 'steady-2026' });
  const b = generator.generate(clues, { seed: 'steady-2026' });
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.numbers, b.numbers);
});

test('hundreds of random puzzles all satisfy the invariants', () => {
  let worst = { rows: 0, cols: 0 };
  let biggest = 0;
  for (let i = 0; i < 250; i++) {
    const r = rng('stress-' + i);
    const count = 8 + Math.floor(r() * 7);          // 8..14 clues
    const pool = WORDS.slice();
    for (let j = pool.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [pool[j], pool[k]] = [pool[k], pool[j]]; }
    // Bias towards a realistic mix: a couple of long answers, mostly short ones.
    const picked = pool.slice(0, count);
    const clues = picked.map((answer, n) => ({ clue: 'Definition of word ' + (n + 1), answer }));
    const puzzle = generator.generate(clues, { seed: 'stress-' + i, attempts: 30 });
    checkInvariants(puzzle, picked, 'stress-' + i);
    worst = { rows: Math.max(worst.rows, puzzle.rows), cols: Math.max(worst.cols, puzzle.cols) };
    biggest = Math.max(biggest, puzzle.rows * puzzle.cols);
  }
  assert.ok(worst.rows <= 24 && worst.cols <= 24, 'unexpectedly large grid: ' + worst.rows + 'x' + worst.cols);
  assert.ok(biggest <= 400, 'puzzle used ' + biggest + ' cells, which will not fit on a tablet screen');
});

test('bad lines are reported, not thrown, and the good ones still play', () => {
  const parsed = puzzleText.parse([
    '#Title: Mixed bag',
    'A perfectly good clue = GARDEN',
    'this line has no separator at all',
    'A clue with a two letter answer = OX',
    'Another good clue = MOWER',
    'Repeating the garden clue = garden',
    'This answer is ridiculously long = ANTIDISESTABLISHMENTARIANISM'
  ].join('\n'));
  assert.equal(parsed.clues.length, 2);
  assert.equal(parsed.problems.length, 4);
  assert.equal(parsed.meta.title, 'Mixed bag');
  const puzzle = generator.generate(parsed.clues, { seed: 'mixed' });
  checkInvariants(puzzle, ['GARDEN', 'MOWER'], 'mixed');
});

test('the reader is forgiving about how staff type the answer', () => {
  const parsed = puzzleText.parse('A cup of tea needs one of these = tea bag\nA place to sit = bench');
  assert.deepEqual(parsed.clues.map(c => c.answer), ['TEABAG', 'BENCH']);
});

test('longer puzzles do not explode the grid size', () => {
  const clues = WORDS.slice(0, 20).map((answer, i) => ({ clue: 'Clue ' + i, answer }));
  const puzzle = generator.generate(clues, { seed: 'twenty', attempts: 40 });
  assert.ok(puzzle.unplaced.length <= 2, 'too many clues dropped from a 20-clue puzzle');
  assert.ok(puzzle.rows * puzzle.cols <= 625, 'grid grew beyond a sensible size');
});
