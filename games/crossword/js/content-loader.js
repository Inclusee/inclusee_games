/* ============================================================================
   Inclusee Games — puzzle file loader
   ----------------------------------------------------------------------------
   Finds the right clue file on the web server for today and hands the text to
   the game. Staff only ever add a file; nobody edits this to publish a puzzle.

   Where it looks, in order:
     1. ?date=YYYY-MM-DD (or ?puzzle=<name>) — used for demos and testing
     2. puzzles/<today>.txt
     3. puzzles/<today − 1>.txt … back to 21 days, so a missed day still plays
     4. puzzles/index.txt — a list of dates, newest one on or before today wins
     5. puzzles/sample.txt — bundled fallback, so the page is never empty

   Every step is a plain file request, so it works on any static host (IIS,
   Apache, GitHub Pages, an S3 bucket) with no server-side code at all.
   ========================================================================== */
(function (root) {
  'use strict';

  var LOOKBACK_DAYS = 21;

  function url(path) {
    return path + (path.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(document.lastModified || '');
  }

  async function tryFetch(path) {
    try {
      var res = await fetch(path, { cache: 'default' });
      if (!res.ok) return null;
      var text = (await res.text()).trim();
      return text ? text : null;
    } catch (err) {
      return null;   // offline, missing file, or the folder isn't published
    }
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
      out.push({ date: m[1], title: line.replace(m[1], '').replace(/^[\s\-–:]+/, '').trim() });
    }
    return out;
  }

  async function loadPuzzleText(options) {
    options = options || {};
    var base = options.base || 'puzzles/';
    var today = options.today || IncluseePuzzleText.todayISO();
    var query = new URLSearchParams(window.location.search);
    var wantedDate = query.get('date');
    var wantedPuzzle = query.get('puzzle');

    // 1. An explicit request from a demo link or a test.
    if (wantedPuzzle) {
      var named = await tryFetch(base + wantedPuzzle.replace(/[^A-Za-z0-9_.\-]/g, ''));
      if (named) return { text: named, source: base + wantedPuzzle, requested: wantedPuzzle, exact: true };
    }
    if (wantedDate) {
      var exact = await tryFetch(base + wantedDate + '.txt');
      if (exact) return { text: exact, source: base + wantedDate + '.txt', date: wantedDate, exact: true };
    }

    // 2 + 3. Today, then back day by day.
    if (!wantedDate) {
      for (var back = 0; back <= LOOKBACK_DAYS; back++) {
        var date = IncluseePuzzleText.shiftISO(today, -back);
        var path = base + date + '.txt';
        var text = await tryFetch(path);
        if (text) {
          return { text: text, source: path, date: date, exact: back === 0, daysOld: back };
        }
      }
    }

    // 4. The index file, if staff keep one.
    var indexText = await tryFetch(base + 'index.txt');
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
        var fromIndex = await tryFetch(base + pick.date + '.txt');
        if (fromIndex) return { text: fromIndex, source: base + pick.date + '.txt', date: pick.date, fromIndex: true };
      }
    }

    // 5. Never show an empty page.
    var sample = await tryFetch(base + 'sample.txt');
    if (sample) return { text: sample, source: base + 'sample.txt', fallback: true };
    if (indexText === null && !wantedDate && !wantedPuzzle) {
      return null;   // caller decides what to say
    }
    return null;
  }

  /** Loads, reads and builds a playable puzzle in one step. */
  async function loadPuzzle(options) {
    options = options || {};
    var found = await loadPuzzleText(options);
    if (!found) return null;

    var parsed = IncluseePuzzleText.parse(found.text);
    var date = parsed.meta.date || found.date || options.today || IncluseePuzzleText.todayISO();

    var puzzle = IncluseeCrosswordGenerator.generate(parsed.clues, {
      seed: found.exact === true && !options.alwaysFresh ? date : (found.date || date)
    });

    return {
      puzzle: puzzle,
      problems: parsed.problems,
      meta: parsed.meta,
      date: date,
      source: found.source,
      isSample: !!found.fallback,
      daysOld: found.daysOld || 0,
      requestedMissing: !!(options.wantedMissing)
    };
  }

  root.IncluseePuzzleLoader = {
    loadPuzzle: loadPuzzle,
    loadPuzzleText: loadPuzzleText,
    parseIndex: parseIndex,
    lookbackDays: LOOKBACK_DAYS
  };
}(typeof self !== 'undefined' ? self : this));