/* ============================================================================
   Inclusee Games - which folder the word search reads

     node --test tests/

   Why this exists: HubSpot file paths are case-sensitive, and a folder name in
   the wrong case does not error - it 404s, the game quietly falls back to the
   copy that ships with it, and staff see "my edits are not appearing" with no
   explanation. So which folder won has to be knowable, and reported.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Load the game script in a sandbox, without running it. */
function loadGame() {
  const sandbox = {
    URLSearchParams,
    Math, Date, JSON, console: { warn() {}, log() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: { readyState: 'loading', addEventListener() {}, querySelector: () => null,
                querySelectorAll: () => [], getElementById: () => null },
    INCLUSEE_CONFIG: {}
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, 'games/wordsearch/js/wordsearch.js'), 'utf8'), context,
    { filename: 'wordsearch.js' });
  return sandbox.IncluseeWordSearchGame;
}

/** Stands in for the loader's address builder. */
const makeUrlFor = (source, template) => (name) => 'FROM:' + (source || template || 'none') + name;

const HUBSPOT = 'https://example.sharepoint-cdn.test/Games/Wordsearch/Words/';

/** The kinds, as a plain string: arrays from inside the sandbox belong to a
 *  different realm, so comparing them directly gives a confusing prototype error. */
function kinds(sources) {
  return Array.prototype.map.call(sources, (s) => s.kind).join(',');
}

test('the staff folder is tried before the copy that ships with the game', () => {
  const game = loadGame();
  const sources = game.sourceList({ wordSearchSource: HUBSPOT }, '', makeUrlFor);
  assert.equal(kinds(sources), 'configured,shipped');
  assert.equal(String(sources[0].urlFor('sample.txt')), 'FROM:' + HUBSPOT + 'sample.txt');
  assert.equal(String(sources[1].urlFor('sample.txt')), 'FROM:words/sample.txt');
});

test('a folder given in the address is tried first, for demos and testing', () => {
  const game = loadGame();
  const sources = game.sourceList({ wordSearchSource: HUBSPOT }, '?source=/tmp/other/', makeUrlFor);
  assert.equal(kinds(sources), 'query,configured,shipped');
});

test('with no staff folder set, only the shipped copy is used', () => {
  const game = loadGame();
  const sources = game.sourceList({}, '', makeUrlFor);
  assert.equal(kinds(sources), 'shipped');
});

test('an empty staff setting is not treated as a folder to try', () => {
  const game = loadGame();
  for (const value of [undefined, null, '']) {
    const sources = game.sourceList({ wordSearchSource: value }, '', makeUrlFor);
    assert.equal(kinds(sources), 'shipped',
      'an empty setting should not add a folder that can only 404');
  }
});

test('the address of the folder given in the address wins over the staff setting', () => {
  const game = loadGame();
  const sources = game.sourceList({ wordSearchSource: HUBSPOT }, '?template=https://x.test/{date}.txt', makeUrlFor);
  assert.equal(String(sources[0].kind), 'query');
  assert.equal(sources[0].urlFor('2026-10-02.txt'), 'FROM:https://x.test/{date}.txt2026-10-02.txt');
  assert.equal(String(sources[1].kind), 'configured');
});
