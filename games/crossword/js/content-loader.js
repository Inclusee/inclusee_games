/* ============================================================================
   Inclusee Games — puzzle file loader
   ----------------------------------------------------------------------------
   Finds the right clue file for today and hands the text to the game. Staff
   only ever add a file; nobody edits this to publish a puzzle.

   Where the files come from is set in games/config.js (see that file). This
   loader never hard-codes a location, so moving the puzzles is a one-line
   change there rather than an edit here.

   Where it looks, in order:
     1. ?source= (a folder) or ?template= (an address pattern) — for testing
     2. puzzles/<today>.txt
     3. puzzles/<today - 1>.txt ... back 21 days, so a missed day still plays
     4. puzzles/index.txt, a list of dates; newest one on or before today wins
     5. puzzles/sample.txt, so the page is never empty

   Every step is a plain file request. Reading files from another web address
   only works if that server sends the header that allows it
   (Access-Control-Allow-Origin) — see staff notes.
   ========================================================================== */
(function (root, factory) {
  // Browser: attaches to the page. Node: exports, so the address building can
  // be tested without a browser.
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseePuzzleLoader = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOOKBACK_DAYS = 21;
  var DEFAULT_SOURCE = 'puzzles/';

  // In the browser these are other scripts on the page. In Node they are
  // required, so the loader can be tested without a browser.
  function helpers() {
    if (typeof IncluseePuzzleText !== 'undefined' && typeof IncluseeCrosswordGenerator !== 'undefined') {
      return { text: IncluseePuzzleText, grid: IncluseeCrosswordGenerator };
    }
    if (typeof require === 'function') {
      return {
        text: require('./puzzle-text.js'),
        grid: require('./grid-generator.js')
      };
    }
    throw new Error('The puzzle reader and grid builder must be loaded first.');
  }

  var h = helpers();

  function settings() {
    return (typeof window !== 'undefined' && window.INCLUSEE_CONFIG) || {};
  }

  /**
   * makeUrlFor(source, template) -> function(fileName) -> address
   *
   * Pure, so it can be tested without a browser. The template may contain
   * {name} (the whole file name) and/or {date} (the date without ".txt"). A
   * template with neither is treated as a folder path, because that is the
   * mistake someone is most likely to make.
   */
  function makeUrlFor(source, template) {
    if (template) {
      return function (name) {
        if (template.indexOf('{name}') === -1 && template.indexOf('{date}') === -1) {
          return template + name;
        }
        return template
          .replace(/\{name\}/g, name)
          .replace(/\{date\}/g, name.replace(/\.txt$/i, ''));
      };
    }
    return function (name) { return (source || DEFAULT_SOURCE) + name; };
  }

  /** The address builder this page should use, after settings and overrides. */
  function activeUrlFor() {
    var query = new URLSearchParams(window.location.search);
    var config = settings();
    return makeUrlFor(
      query.get('source') || config.puzzleSource,
      query.get('template') || config.puzzleSourceTemplate
    );
  }

  var fetchProblems = [];
  var unreachable = 0;

  /**
   * fetchText(path) -> { text, unreachable }
   *
   * Two different kinds of "no" are handled differently:
   *   - the server answered, but the file isn't there (a normal 404): keep
   *     looking further back, because that is just a day with no puzzle yet;
   *   - the request never got an answer at all (offline, blocked, or another
   *     server refusing to hand files to this page): stop almost immediately,
   *     because all twenty-two days would fail in exactly the same way. Without
   *     this the game sat for forty seconds before telling anyone.
   */
  async function fetchText(path) {
    try {
      var res = await fetch(path, { cache: 'default' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          recordProblem(path, 'the server said "not allowed" (HTTP ' + res.status + ') \u2014 the file is probably not shared publicly');
          return { text: null, unreachable: true };
        }
        return { text: null, unreachable: false };   // simply not there yet
      }
      var text = (await res.text()).trim();
      return { text: text || null, unreachable: false };
    } catch (err) {
      recordProblem(path, 'the address could not be reached at all (' +
        ((err && err.message) ? err.message : String(err)) +
        ') \u2014 see the staff notes on hosting');
      return { text: null, unreachable: true };
    }
  }

  function recordProblem(path, why) {
    fetchProblems.push({ path: path, why: why });
  }

  /** Reads index.txt: one date per line, anything after the date is the title. */
  function parseIndex(text) {
    var out = [];
    var lines = text.replace(/\r\n?/g, '\n').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '#') continue;
      var m = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      out.push({ date: m[1], title: line.replace(m[1], '').replace(/^[\s\-\u2013:]+/, '').trim() });
    }
    return out;
  }

  async function loadPuzzleText(options) {
    options = options || {};
    fetchProblems = [];
    unreachable = 0;
    var today = options.today || h.text.todayISO();
    var query = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    var wantedDate = query.get('date');
    var wantedPuzzle = query.get('puzzle');

    // An explicit file, for a demo link or a specific puzzle.
    var urlFor = options.urlFor || activeUrlFor();
    if (wantedPuzzle) {
      var clean = wantedPuzzle.replace(/[^A-Za-z0-9_.\-]/g, '');
      var named = await fetchText(urlFor(clean));
      if (named.text) return { text: named.text, source: urlFor(clean), requested: clean, exact: true };
    }
    if (wantedDate) {
      var exact = await fetchText(urlFor(wantedDate + '.txt'));
      if (exact.text) return { text: exact.text, source: urlFor(wantedDate + '.txt'), date: wantedDate, exact: true };
      unreachable += exact.unreachable ? 1 : 0;
      if (!exact.text && !exact.unreachable) warnMissing(wantedDate + '.txt');
    }

    // Today, then back day by day. Abandon the search as soon as the source
    // proves unreachable, rather than repeating the same failure three weeks over.
    if (!wantedDate && unreachable < 2) {
      for (var back = 0; back <= LOOKBACK_DAYS; back++) {
        var date = h.text.shiftISO(today, -back);
        var path = urlFor(date + '.txt');
        var found = await fetchText(path);
        if (found.text) return { text: found.text, source: path, date: date, exact: back === 0, daysOld: back };
        if (found.unreachable) {
          unreachable++;
          if (unreachable >= 2) break;   // the whole source is unreachable
        }
      }
    }

    // The index file, if staff keep one.
    var indexText = null;
    if (unreachable < 2) {
      var indexResult = await fetchText(urlFor('index.txt'));
      indexText = indexResult.text;
      if (indexResult.unreachable) unreachable++;
    }
    if (indexText) {
      var entries = parseIndex(indexText);
      var usable = entries.filter(function (e) { return e.date <= today; });
      // If every listed puzzle is still in the future (staff loaded the month
      // ahead and nothing has been reached yet), show the soonest one rather
      // than dropping residents into the sample puzzle.
      if (!usable.length) {
        usable = entries.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 1);
      }
      usable.sort(function (a, b) { return a.date < b.date ? 1 : -1; });   // newest first
      if (usable.length) {
        var pick = usable[0];
        var fromIndex = await fetchText(urlFor(pick.date + '.txt'));
        if (fromIndex.text) return { text: fromIndex.text, source: urlFor(pick.date + '.txt'), date: pick.date, fromIndex: true };
      }
    }

    // Never show an empty page — but do not keep hammering a source that has
    // already proved unreachable.
    if (unreachable < 2) {
      var sample = await fetchText(urlFor('sample.txt'));
      if (sample.text) return { text: sample.text, source: urlFor('sample.txt'), fallback: true };
    }
    return null;
  }

  function warnMissing(name) {
    recordProblem(name, 'the requested puzzle file is not there');
  }

  /** Loads, reads and builds a playable puzzle in one step. */
  async function loadPuzzle(options) {
    options = options || {};
    var found = await loadPuzzleText(options);
    if (!found) {
      return { failed: true, unreachable: unreachable >= 2, problems: fetchProblems.slice() };
    }

    var parsed = h.text.parse(found.text);

    // The file NAME decides which puzzle this is, not a #Date line inside it.
    // Staff copy last week's puzzle as a starting point and often forget to
    // change the header, and a stale date would both mislabel the puzzle and
    // let one day's saved progress leak into another day's grid.
    var date = found.date || parsed.meta.date || options.today || h.text.todayISO();
    var dateMismatch = (found.date && parsed.meta.date && found.date !== parsed.meta.date)
      ? { file: found.date, header: parsed.meta.date }
      : null;

    return {
      puzzle: h.grid.generate(parsed.clues, { seed: date }),
      problems: parsed.problems,
      fetchProblems: fetchProblems.slice(),
      meta: parsed.meta,
      date: date,
      dateMismatch: dateMismatch,
      today: options.today || h.text.todayISO(),
      source: found.source,
      isSample: !!found.fallback,
      daysOld: found.daysOld || 0
    };
  }

  return {
    loadPuzzle: loadPuzzle,
    loadPuzzleText: loadPuzzleText,
    parseIndex: parseIndex,
    makeUrlFor: makeUrlFor,
    lookbackDays: LOOKBACK_DAYS
  };
}));
