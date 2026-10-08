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

  // Date helpers are shared with every game; only the crossword needs the clue
  // reader and grid builder, and those are looked up when a crossword is
  // actually built. Requiring them up front meant the word search page - which
  // has no clue reader - refused to load the loader at all.
  function dates() {
    if (typeof IncluseeDates !== 'undefined') return IncluseeDates;
    if (typeof require === 'function') return require('../../shared/dates.js');
    throw new Error('The date helper must be loaded first.');
  }

  function crosswordTools() {
    if (typeof IncluseePuzzleText !== 'undefined' && typeof IncluseeCrosswordGenerator !== 'undefined') {
      return { text: IncluseePuzzleText, grid: IncluseeCrosswordGenerator };
    }
    if (typeof require === 'function') {
      return {
        text: require('./puzzle-text.js'),
        grid: require('./grid-generator.js')
      };
    }
    throw new Error('The clue reader and grid builder must be loaded first.');
  }

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
      // Always revalidate. HubSpot sends a 14 day cache time on these files, so
      // with the default setting a corrected puzzle - or a newly published one
      // for a date staff edited - could sit unread on a resident's device for
      // two weeks. Revalidating costs one small request and always shows the
      // file that is actually on the server.
      var res = await fetch(path, { cache: 'no-cache' });
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
    var today = options.today || dates().todayISO();
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
        var date = dates().shiftISO(today, -back);
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
    var h = crosswordTools();
    var found = await loadPuzzleText(options);
    if (!found) {
      return { failed: true, unreachable: unreachable >= 2, problems: fetchProblems.slice() };
    }

    var parsed = h.text.parse(found.text);
    var resolved = resolveDate(found, parsed.meta, options.today || dates().todayISO());

    return {
      puzzle: h.grid.generate(parsed.clues, { seed: resolved.date }),
      problems: parsed.problems,
      fetchProblems: fetchProblems.slice(),
      meta: parsed.meta,
      date: resolved.date,
      dateMismatch: resolved.dateMismatch,
      today: options.today || dates().todayISO(),
      source: found.source,
      isSample: !!found.fallback,
      daysOld: found.daysOld || 0
    };
  }

  /**
   * resolveDate(found, meta, today) -> { date, dateMismatch }
   *
   * One shared rule, used by every game: the FILE NAME decides which puzzle this
   * is, never a #Date line inside it. Staff copy last week's file as a starting
   * point and leave the old header behind; trusting it mislabels the puzzle and
   * lets one day's saved progress leak into another day's grid.
   */
  function resolveDate(found, meta, today) {
    var fileDate = found && found.date;
    var headerDate = meta && meta.date;
    return {
      date: fileDate || headerDate || today,
      dateMismatch: (fileDate && headerDate && fileDate !== headerDate)
        ? { file: fileDate, header: headerDate }
        : null
    };
  }

  /** The same rule, with the file's own unreachability explained. */
  function resolveSource(found) {
    return found ? found.source : null;
  }

  return {
    loadPuzzle: loadPuzzle,
    resolveDate: resolveDate,
    resolveSource: resolveSource,
    loadPuzzleText: loadPuzzleText,
    parseIndex: parseIndex,
    makeUrlFor: makeUrlFor,
    lookbackDays: LOOKBACK_DAYS
  };
}));
