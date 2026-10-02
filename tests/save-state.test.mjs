/* ============================================================================
   Inclusee Games — saved-progress tests

     node --test tests/

   Two bugs these exist for, both of which quietly ate a resident's work:
     1. joining a row into a string drops its trailing blanks, so the grid came
        back with letters missing off the right-hand side of every row;
     2. the writer and the reader disagreed about the name of the rows field, so
        nothing restored at all and the puzzle came back empty.
   The game now only calls createSave() and readSave(), and these tests hold
   that contract in place.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const saveState = require('../games/shared/save-state.js');

const throughStorage = (save) => JSON.parse(JSON.stringify(save));   // what localStorage does

test('a full round trip keeps every letter and every blank', () => {
  const letters = [
    ['M', '', '', 'C', 'A', 'T'],
    ['O', '', 'T', 'E', 'A', ''],
    ['W', '', 'R', '', '', ''],
    ['E', '', '', '', '', '']
  ];
  const save = saveState.createSave('2026-09-25', letters, { revealed: 3, finished: false });
  assert.equal(save.rows[2].length, 6, 'row widths are padded, not trimmed');
  assert.equal(save.rows[3].length, 6, 'even a row of blanks keeps its width');

  const back = saveState.readSave(throughStorage(save), '2026-09-25', 4, 6);
  assert.equal(back.accepted, true);
  assert.deepEqual(back.letters, letters);
  assert.equal(back.revealed, 3);
  assert.equal(back.finished, false);
});

test('the writer and reader agree on the field names', () => {
  // The regression this guards: the save wrote `letters` and the reader looked
  // for `rows`, so every restored puzzle came back empty.
  const save = saveState.createSave('2026-09-25', saveState.blank(11, 11).map((row, r) => row.map((ch, c) => (r === 0 && c === 0 ? 'A' : ''))), {});
  const back = saveState.readSave(throughStorage(save), '2026-09-25', 11, 11);
  assert.equal(back.accepted, true, 'a save we just wrote must always be accepted');
  assert.equal(back.letters[0][0], 'A');
});

test('a save from another day is not applied to today\u2019s puzzle', () => {
  const save = saveState.createSave('2026-09-24', [['A', 'B']], {});
  const back = saveState.readSave(throughStorage(save), '2026-09-25', 1, 2);
  assert.equal(back.accepted, false);
  assert.deepEqual(back.letters, [['', '']]);
});

test('a save from an older, lossy format is ignored instead of half-applied', () => {
  const legacy = { version: 1, date: '2026-09-25', letters: ['M', 'O', 'TEAWCAT'] };
  const back = saveState.readSave(legacy, '2026-09-25', 3, 11);
  assert.equal(back.accepted, false);
  assert.deepEqual(back.letters, saveState.blank(3, 11));
});

test('junk in storage cannot corrupt the grid', () => {
  const junk = saveState.createSave('2026-09-25', [['A', '', ''], ['', '', '']], {});
  junk.rows[0] = 'A1!';
  junk.rows[1] = null;
  const back = saveState.readSave(junk, '2026-09-25', 2, 3);
  assert.deepEqual(back.letters, [['A', '', ''], ['', '', '']]);
  assert.equal(saveState.readSave(null, '2026-09-25', 1, 1).accepted, false);
  assert.equal(saveState.readSave('nonsense', '2026-09-25', 1, 1).accepted, false);
  assert.equal(saveState.readSave({}, '2026-09-25', 1, 1).accepted, false);
});

test('a save from a bigger grid cannot overflow a smaller one', () => {
  const save = saveState.createSave('2026-09-25', [['A', 'B', 'C', 'D', 'E'], ['', '', '', '', '']], {});
  const back = saveState.readSave(save, '2026-09-25', 2, 3);
  assert.deepEqual(back.letters, [['A', 'B', 'C'], ['', '', '']]);
});

test('lowercase letters are normalised on the way in', () => {
  const save = saveState.createSave('2026-09-25', [['t', 'e', 'a']], {});
  assert.deepEqual(saveState.readSave(save, '2026-09-25', 1, 3).letters, [['T', 'E', 'A']]);
});

test('extra details survive, and unknown ones are dropped', () => {
  const save = saveState.createSave('2026-09-25', [['A']], { revealed: 1, finished: true, source: 'puzzles/2026-09-25.txt', nonsense: 'ignore me' });
  const back = saveState.readSave(save, '2026-09-25', 1, 1);
  assert.equal(back.finished, true);
  assert.equal(back.source, 'puzzles/2026-09-25.txt');
  assert.equal(save.nonsense, undefined);
});