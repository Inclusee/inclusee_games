/* ============================================================================
   Inclusee Games — loader behaviour when the puzzle source cannot be reached

     node --test tests/

   Why this exists: pointed at a folder that refuses to hand over files (which is
   exactly what SharePoint does), the loader tried twenty-two dates in a row and
   left the page hanging for forty seconds before admitting defeat. It must give
   up after a couple of failed attempts and let the game say so straight away.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loader = require('../games/crossword/js/content-loader.js');

/** Stands in for fetch during a test. `respond` decides what each request does. */
function installFetch(respond) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const outcome = respond(url, calls.length);
    if (outcome === 'network-fail') throw new TypeError('Failed to fetch');
    if (outcome === 'forbidden') return { ok: false, status: 403, text: async () => '' };
    if (outcome === 'missing') return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => outcome };
  };
  return calls;
}

const PUZZLE = [
  '#Title: Test',
  'A hot drink made from dried leaves = TEA',
  'The room where you cook the meals = KITCHEN',
  'Where you grow flowers and vegetables = GARDEN'
].join('\n');

const urlFor = (name) => 'https://example.org/puzzles/' + name;

test('a source that refuses every request is abandoned after a couple of tries', async () => {
  const calls = installFetch(() => 'network-fail');
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.equal(result.failed, true);
  assert.equal(result.unreachable, true, 'the game needs to know it was unreachable, not just missing');
  assert.ok(calls.length <= 4, 'gave up after ' + calls.length + ' attempts; should be a handful, not twenty-two');
  assert.ok(result.problems.length > 0, 'the reason must be recorded for the staff view');
});

test('a server that answers "not allowed" is also abandoned quickly', async () => {
  const calls = installFetch(() => 'forbidden');
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.equal(result.failed, true);
  assert.equal(result.unreachable, true);
  assert.ok(calls.length <= 4, 'gave up after ' + calls.length + ' attempts');
  assert.match(result.problems[0].why, /not allowed/);
});

test('a missing file only steps back one day at a time, it does not give up', async () => {
  // Today's puzzle simply has not been written yet: keep the walk-back going.
  const calls = installFetch((url) => (url.includes('2026-09-30')
    ? ['#Date: 2026-09-30', '', PUZZLE].join('\n')
    : 'missing'));
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.ok(!result.failed);
  assert.equal(result.date, '2026-09-30');
  assert.equal(result.puzzle.entries.length, 3);
  assert.ok(calls.length >= 3, 'it looked at each day in turn');
});

test('the bundled sample is used when nothing is published yet, and the source is reachable', async () => {
  const calls = installFetch((url) => (url.endsWith('sample.txt') ? ['#Date: 2026-01-01', '', PUZZLE].join('\n') : 'missing'));
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.ok(!result.failed);
  assert.equal(result.isSample, true);
});

test('an unreachable source does not keep reaching for the sample as well', async () => {
  const calls = installFetch(() => 'network-fail');
  await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.ok(!calls.some((u) => u.endsWith('sample.txt')),
    'no point asking the same unreachable server for another file');
});

test('today\u2019s puzzle is used when it is there', async () => {
  const calls = installFetch(() => ['#Date: 2026-10-02', '', PUZZLE].join('\n'));
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.equal(result.date, '2026-10-02');
  assert.equal(result.daysOld, 0);
  assert.equal(calls.length, 1, 'one request is enough when today\u2019s file exists');
});

test('the file name decides the date, not a stale #Date line inside the file', async () => {
  // Happened for real: 2026-10-02.txt was copied from the 25th and the #Date
  // line was left behind. Trusting the header would mislabel today's puzzle and
  // let one day's saved progress appear in another day's grid.
  const stale = ['#Title: Around the House', '#Date: 2026-09-25', '', PUZZLE].join('\n');
  const calls = installFetch(() => stale);
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.equal(result.date, '2026-10-02', 'the file name wins');
  assert.deepEqual(result.dateMismatch, { file: '2026-10-02', header: '2026-09-25' },
    'the disagreement is reported so staff can fix the header');
});

test('a matching #Date line raises nothing', async () => {
  const matching = ['#Title: Around the House', '#Date: 2026-10-02', '', PUZZLE].join('\n');
  const calls = installFetch(() => matching);
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.equal(result.date, '2026-10-02');
  assert.equal(result.dateMismatch, null);
});

test('a file with no #Date line still works off the file name', async () => {
  const noHeader = ['#Title: Around the House', '', PUZZLE].join('\n');
  const calls = installFetch(() => noHeader);
  const result = await loader.loadPuzzle({ today: '2026-10-02', urlFor });
  assert.equal(result.date, '2026-10-02');
  assert.equal(result.dateMismatch, null);
});
