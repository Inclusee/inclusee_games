/* ============================================================================
   Inclusee Games - page wiring tests

     node --test tests/

   What these exist for: the crossword page was missing one script tag after a
   refactor that made the grid builder depend on a shared helper. Every Node test
   still passed, because Node resolves the dependency through require() - but in a
   browser the script threw on load, the grid builder never appeared, and
   residents got two red errors instead of a crossword.

   A passing test suite said nothing about whether the page actually boots. So
   these tests read each page's script tags, load those files in that exact order
   in a browser-like sandbox, and fail if anything throws.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const PAGES = [
  'games/crossword/index.html',
  'games/wordsearch/index.html'
];

/** A minimal stand-in for the browser bits the games touch while loading. */
function makeSandbox() {
  const element = () => ({
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: { setProperty() {} },
    dataset: {},
    hidden: false,
    textContent: '',
    innerHTML: '',
    value: '',
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus() {},
    blur() {},
    scrollIntoView() {}
  });

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URLSearchParams,
    Math,
    Date,
    JSON,
    document: {
      readyState: 'loading',            // stays "loading", so boot waits for the event
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: element,
      body: element()
    }
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  return sandbox;
}

/** The <script src> tags on a page, in the order the browser runs them. */
function scriptTags(pageRelPath) {
  const html = readFileSync(join(root, pageRelPath), 'utf8');
  return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
}

function checkPage(pageRelPath) {
  const scripts = scriptTags(pageRelPath);
  assert.ok(scripts.length > 0, pageRelPath + ' has no script tags at all');

  const sandbox = makeSandbox();
  const context = vm.createContext(sandbox);
  const loaded = [];

  for (const src of scripts) {
    const file = resolve(join(root, dirname(pageRelPath)), src);
    assert.ok(existsSync(file),
      pageRelPath + ' loads ' + src + ', which does not exist on disk');

    const code = readFileSync(file, 'utf8');
    try {
      vm.runInContext(code, context, { filename: file });
    } catch (err) {
      assert.fail(
        pageRelPath + '\n  ' + src + ' threw while loading: ' + err.message +
        '\n  (loaded fine before it: ' + (loaded.join(', ') || 'nothing') + ')' +
        '\n  This is what a resident would see as a broken page.');
    }
    loaded.push(src);
  }
  return { scripts, context };
}

for (const page of PAGES) {
  test(page + ' loads every one of its scripts without an error', () => {
    checkPage(page);
  });
}

test('the crossword page loads the shared random helper before the grid builder', () => {
  // The exact regression: the grid builder uses the shared helper at load time,
  // so it must come first. A bare "is it on the page" check is not enough.
  const scripts = scriptTags('games/crossword/index.html');
  const helper = scripts.findIndex((s) => s.includes('seeded-random.js'));
  const builder = scripts.findIndex((s) => s.includes('grid-generator.js'));
  assert.notEqual(helper, -1, 'the crossword page does not load shared/seeded-random.js');
  assert.ok(helper < builder, 'seeded-random.js must be loaded before grid-generator.js');
});

test('every shared module the games rely on is actually loaded by their pages', () => {
  // Reads the files rather than a hand-written list, so a rename cannot slip past.
  for (const page of PAGES) {
    const scripts = scriptTags(page);
    const loaded = scripts.join(' ');
    for (const dependency of ['shared/dates.js', 'shared/save-state.js', 'shared/profile.js']) {
      assert.ok(loaded.includes(dependency.split('/')[1]),
        page + ' does not load ' + dependency);
    }
  }
});

test('no page loads a script that is missing from disk', () => {
  for (const page of PAGES) {
    for (const src of scriptTags(page)) {
      const file = resolve(join(root, dirname(page)), src);
      assert.ok(existsSync(file), page + ' -> ' + src + ' is missing');
    }
  }
});

test('the games and the shared modules they use all attach a global in a browser', () => {
  // A module that only exports through require() works in Node and silently
  // breaks in the browser, which is how the word search page failed to boot.
  for (const page of PAGES) {
    const sandbox = makeSandbox();
    const context = vm.createContext(sandbox);
    for (const src of scriptTags(page)) {
      const file = resolve(join(root, dirname(page)), src);
      vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
    }
    const globals = Object.keys(sandbox).filter((k) => k.startsWith('Inclusee'));
    assert.ok(globals.length >= 4,
      page + ' only provided ' + globals.length + ' Inclusee globals: ' + globals.join(', '));
  }
});
