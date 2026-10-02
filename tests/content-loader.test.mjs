/* ============================================================================
   Inclusee Games — puzzle address builder tests

     node --test tests/

   Where the puzzle files live is a one-line setting, so getting the address
   wrong must be obvious rather than mysterious. These cover the folder form and
   the address-template form, including the mistake people actually make:
   putting a template in the folder setting or vice versa.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loader = require('../games/crossword/js/content-loader.js');

test('a folder setting simply has the file name added', () => {
  const urlFor = loader.makeUrlFor('puzzles/', null);
  assert.equal(urlFor('2026-09-25.txt'), 'puzzles/2026-09-25.txt');
  assert.equal(urlFor('index.txt'), 'puzzles/index.txt');
});

test('a full web address works as a folder too', () => {
  const urlFor = loader.makeUrlFor('https://example.org/shared/puzzles/', null);
  assert.equal(urlFor('2026-09-25.txt'), 'https://example.org/shared/puzzles/2026-09-25.txt');
});

test('the SharePoint-style folder path keeps its spaces and punctuation', () => {
  const folder = 'https://nundahactivitycentre.sharepoint.com/sites/AurousAdmin/Shared%20Documents/puzzles/crossword/';
  const urlFor = loader.makeUrlFor(folder, null);
  assert.equal(urlFor('2026-09-25.txt'), folder + '2026-09-25.txt');
});

test('a template fills in the whole file name', () => {
  const urlFor = loader.makeUrlFor(null, 'https://example.org/file.aspx?path={name}&download=1');
  assert.equal(urlFor('2026-09-25.txt'), 'https://example.org/file.aspx?path=2026-09-25.txt&download=1');
});

test('a template fills in just the date', () => {
  const urlFor = loader.makeUrlFor(null, 'https://example.org/sites/x/documents/{date}.txt?csf=1&web=1');
  assert.equal(urlFor('2026-09-25.txt'), 'https://example.org/sites/x/documents/2026-09-25.txt?csf=1&web=1');
});

test('a template may use name and date together', () => {
  const urlFor = loader.makeUrlFor(null, 'https://example.org/{date}?file={name}');
  assert.equal(urlFor('2026-09-25.txt'), 'https://example.org/2026-09-25?file=2026-09-25.txt');
});

test('a template with no placeholder is treated as a folder, not a broken address', () => {
  // The likely mistake: pasting a folder into the template setting.
  const urlFor = loader.makeUrlFor(null, 'https://example.org/games/puzzles/');
  assert.equal(urlFor('2026-09-25.txt'), 'https://example.org/games/puzzles/2026-09-25.txt');
});

test('a missing setting falls back to the bundled puzzles folder', () => {
  assert.equal(loader.makeUrlFor(undefined, null)('sample.txt'), 'puzzles/sample.txt');
  assert.equal(loader.makeUrlFor('', undefined)('sample.txt'), 'puzzles/sample.txt');
});

test('index.txt lines are read as dates, with or without a title', () => {
  const entries = loader.parseIndex([
    '# a comment',
    '2026-09-25  Around the House',
    '2026-10-01',
    'nonsense with no date'
  ].join('\n'));
  assert.deepEqual(entries, [
    { date: '2026-09-25', title: 'Around the House' },
    { date: '2026-10-01', title: '' }
  ]);
});