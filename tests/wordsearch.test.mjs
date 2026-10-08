/* ============================================================================
   Inclusee Games - word search tests

     node --test tests/

   Two things matter here and neither is visible by eye: that every word staff
   listed is genuinely hidden in the grid (not silently dropped), and that the
   same file always produces the same grid, because the tools preview a grid that
   the game must then reproduce exactly.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gridMaker = require('../games/wordsearch/js/grid-maker.js');
const wordList = require('../games/wordsearch/js/word-list.js');

const WORDS = ['ROSEMARY', 'MULCH', 'TROWEL', 'GARDEN', 'SEEDS', 'WATERING', 'SUNLIGHT', 'COMPOST',
               'FLOWERS', 'WEEDS', 'GLOVES', 'SPADE', 'POT', 'HOSE', 'BLOOM', 'HERBS'];

/** Read the grid along a placement to prove the word really is there. */
function lettersAlong(puzzle, placement) {
  let out = '';
  for (const [r, c] of placement.cells) out += puzzle.grid[r][c];
  return out;
}

function checkPuzzle(puzzle, expected, label) {
  assert.equal(puzzle.rows, puzzle.cols, label + ': the grid should be square');
  // Every placement matches the grid underneath it.
  for (const placement of puzzle.placements) {
    assert.equal(lettersAlong(puzzle, placement), placement.word,
      label + ': ' + placement.word + ' does not read correctly in the grid');
    for (const [r, c] of placement.cells) {
      assert.ok(r >= 0 && c >= 0 && r < puzzle.rows && c < puzzle.cols,
        label + ': ' + placement.word + ' runs off the grid');
    }
  }
  // No letter left empty.
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      assert.match(puzzle.grid[r][c], /^[A-Z]$/, label + ': empty square at ' + r + ',' + c);
    }
  }
  // Every word staff listed is hidden and solvable.
  assert.deepEqual(puzzle.unplaced, [], label + ': a word was dropped: ' + JSON.stringify(puzzle.unplaced));
  const found = puzzle.placements.map((p) => p.word).sort();
  assert.deepEqual(found, expected.slice().sort(), label + ': the hidden words do not match the list');
}

test('a normal word list builds a solvable grid', () => {
  const puzzle = gridMaker.build(WORDS.slice(0, 10), { seed: 'garden-2026' });
  checkPuzzle(puzzle, WORDS.slice(0, 10), 'garden');
  assert.ok(puzzle.rows >= 8 && puzzle.rows <= 16, 'grid size ' + puzzle.rows + ' is out of range');
});

test('a long word forces a wider grid than the starting size', () => {
  // 12 letters is the cap we accept: beyond that the grid has to be so wide that
  // the letters become too small to read comfortably.
  const puzzle = gridMaker.build(['WATERINGCAN'], { seed: 'long' });
  assert.ok(puzzle.rows >= 11, 'an 11 letter word needs a grid at least that wide, got ' + puzzle.rows);
  checkPuzzle(puzzle, ['WATERINGCAN'], 'long');
});

test('a word longer than the cap is refused with a reason, not silently dropped', () => {
  const parsed = wordList.parse(['EXTRAORDINARY', 'ROSEMARY'].join('\n'));
  assert.deepEqual(parsed.words.map((w) => w.word), ['ROSEMARY']);
  assert.equal(parsed.problems.length, 1);
  assert.match(parsed.problems[0].why, /13 letters long/);
  assert.match(parsed.problems[0].why, /longest word we can fit is 12/);
});

test('many words still all fit, by growing the grid', () => {
  const puzzle = gridMaker.build(WORDS, { seed: 'all-sixteen', attempts: 25 });
  checkPuzzle(puzzle, WORDS, 'sixteen');
  assert.ok(puzzle.rows <= gridMaker.maxSize, 'grid grew past the readable limit');
});

test('the same file always produces the same grid', () => {
  const a = gridMaker.build(WORDS.slice(0, 8), { seed: 'steady' });
  const b = gridMaker.build(WORDS.slice(0, 8), { seed: 'steady' });
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.placements, b.placements);
});

test('a different day produces a different grid', () => {
  const a = gridMaker.build(WORDS.slice(0, 8), { seed: '2026-10-01' });
  const b = gridMaker.build(WORDS.slice(0, 8), { seed: '2026-10-02' });
  assert.notDeepEqual(a.grid, b.grid);
});

test('the easy setting never uses diagonals or backwards words', () => {
  const puzzle = gridMaker.build(WORDS.slice(0, 10), { seed: 'easy', directions: 'easy' });
  for (const placement of puzzle.placements) {
    const dr = placement.dr, dc = placement.dc;
    assert.ok((dr === 0 && dc === 1) || (dr === 1 && dc === 0),
      'easy mode placed ' + placement.word + ' as ' + placement.direction);
  }
});

test('the normal setting adds diagonals but still nothing backwards', () => {
  const puzzle = gridMaker.build(WORDS.slice(0, 12), { seed: 'normal', directions: 'normal' });
  for (const placement of puzzle.placements) {
    assert.ok(!placement.direction.includes('backwards') && placement.direction !== 'up',
      'normal mode placed ' + placement.word + ' as ' + placement.direction);
  }
});

test('the all setting is allowed to use every direction', () => {
  const puzzle = gridMaker.build(WORDS.slice(0, 14), { seed: 'everything', directions: 'all' });
  checkPuzzle(puzzle, WORDS.slice(0, 14), 'all directions');
});

test('an unknown direction setting falls back to the easiest one', () => {
  const puzzle = gridMaker.build(WORDS.slice(0, 8), { seed: 'typo', directions: 'diagonalish' });
  for (const placement of puzzle.placements) {
    assert.ok((placement.dr === 0 && placement.dc === 1) || (placement.dr === 1 && placement.dc === 0),
      'should have fallen back to across and down only');
  }
});

test('words are placed with as few crossings as a grid this size allows', () => {
  // Crossing letters are what make a grid look like noise. With plenty of room
  // there is no reason for any word to share a letter.
  const puzzle = gridMaker.build(['CAT', 'DOG', 'BIRD', 'FISH'], { seed: 'roomy' });
  assert.equal(puzzle.stats.crossings, 0, 'four short words in a roomy grid should not overlap');
});

test('rubbish in the word list is reported, and the good words still play', () => {
  const parsed = wordList.parse([
    '#Title: Mixed bag',
    'ROSEMARY',
    'this = that',

    'XYZ',
    'ROSEMARY',
    'A',
    'TOOLONGWORDHERE'
  ].join('\n'));
  assert.deepEqual(parsed.words.map((w) => w.word), ['ROSEMARY', 'XYZ']);
  assert.equal(parsed.problems.length, 4);
  assert.match(parsed.problems[0].why, /crossword line/, 'the crossword-style mistake gets explained');
  assert.equal(parsed.meta.title, 'Mixed bag');

  const puzzle = gridMaker.build(parsed.words.map((w) => w.word), { seed: 'mixed' });
  checkPuzzle(puzzle, ['ROSEMARY', 'XYZ'], 'mixed');
});

test('the word list reader copes with how staff actually type things', () => {
  const parsed = wordList.parse(['tea pot', 'TEA-POT', 'TeaPot', '  roseMary  '].join('\n'));
  assert.deepEqual(parsed.words.map((w) => w.word), ['TEAPOT', 'ROSEMARY']);
  assert.equal(parsed.problems.length, 2, 'the duplicates are reported, not silently dropped');
});

test('the direction setting is read from the file, and a wrong value is ignored', () => {
  assert.equal(wordList.parse('#Directions: all\nROSEMARY').meta.directions, 'all');
  assert.equal(wordList.parse('#Directions: NORMAL\nROSEMARY').meta.directions, 'normal');
  assert.equal(wordList.parse('ROSEMARY').meta.directions, 'easy', 'the easiest setting is the default');
  assert.equal(wordList.parse('#Directions: sideways\nROSEMARY').meta.directions, 'easy');
});

test('the directions are described in plain words, for the staff view', () => {
  assert.match(wordList.describeDirections('easy'), /across and down/);
  assert.match(wordList.describeDirections('all'), /backwards/);
});

test('a grid is never smaller than it needs to be to hold the longest word', () => {
  for (const word of ['CAT', 'SEVENCH', 'WATERINGCAN']) {
    const puzzle = gridMaker.build([word, 'DOG', 'BIRD'], { seed: 'size-' + word });
    assert.ok(puzzle.rows >= word.length, word + ' does not fit in a ' + puzzle.rows + ' wide grid');
  }
});

test('the words run in a mix of directions, not all the same way', () => {
  // Left to itself the generator hides nearly every word downwards, which is
  // much harder to scan across than a mixed grid.
  for (const seed of ['balance-1', 'balance-2', 'balance-3', '2026-10-02']) {
    const puzzle = gridMaker.build(WORDS.slice(0, 10), { seed, directions: 'easy' });
    const mix = puzzle.stats.directionMix;
    assert.ok(mix.across >= 2, seed + ': only ' + mix.across + ' words run across');
    assert.ok(mix.down >= 2, seed + ': only ' + mix.down + ' words run down');
    assert.equal(mix.across + mix.down, 10, seed + ': every word should be accounted for');
  }
});

test('a normal word list stays in a grid small enough to read', () => {
  // Grid size decides letter size, and ten words do not need a big grid: a
  // sprawling grid is the difference between readable and not for this audience.
  for (const seed of ['readable-1', 'readable-2', '2026-10-02']) {
    const puzzle = gridMaker.build(WORDS.slice(0, 10), { seed });
    assert.ok(puzzle.rows <= 12, seed + ': ten words produced a ' + puzzle.rows + ' wide grid');
  }
  const twelve = gridMaker.build(WORDS.slice(0, 12), { seed: 'readable-3' });
  assert.ok(twelve.rows <= 14, 'twelve words produced a ' + twelve.rows + ' wide grid');
});

test('the words are still spread across a range of squares, not packed into a corner', () => {
  const puzzle = gridMaker.build(WORDS.slice(0, 10), { seed: 'spread' });
  const used = new Set();
  for (const placement of puzzle.placements) {
    for (const [r, c] of placement.cells) used.add(r + ',' + c);
  }
  // Words fill a good share of the grid, which is what makes them findable.
  assert.ok(used.size / (puzzle.rows * puzzle.cols) > 0.3,
    'words only occupy ' + Math.round(100 * used.size / (puzzle.rows * puzzle.cols)) + '% of the grid');
});
