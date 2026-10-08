/* ============================================================================
   Inclusee Games - Word Search
   ----------------------------------------------------------------------------
   Find the hidden words. Built for people who find hunting through letters hard:

     - tap the first letter then the last, or drag between them - whichever comes
       naturally;
     - tapping in the wrong order is never a mistake, it just moves the starting
       point;
     - a word counts whichever way round it is picked, because choosing the wrong
       direction is a very easy thing to do;
     - found words stay washed green, so the grid records progress visibly;
     - no timer, no score, nothing to lose, and it saves as you go.

   The words come from a plain text file staff edit - see staff/HOW-TO-... for
   that, and note that nothing here needs changing to publish a new puzzle.
   ========================================================================== */
(function (root) {
  'use strict';

  var SAVE_KEY = 'inclusee.wordsearch.save';

  var state = {
    loaded: null,
    puzzle: null,
    puzzleDate: '',
    found: {},            // word -> true
    anchor: null,         // { r, c } the first letter picked
    preview: [],          // cell keys being picked right now
    prefs: { scale: 0, dark: false },
    finished: false
  };

  var el = {};
  var panel = null;
  var SCALES = [1, 1.15, 1.3, 1.5];

  function $(sel) { return document.querySelector(sel); }
  function key(r, c) { return r + ',' + c; }

  /* -------------------------------------------------------------- settings */

  function loadPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem('inclusee.prefs.v1') || '{}');
      if (typeof raw.scale === 'number') state.prefs.scale = raw.scale;
      if (typeof raw.dark === 'boolean') state.prefs.dark = raw.dark;
    } catch (err) { /* first visit */ }
  }

  function savePrefs() {
    try {
      // Deliberately the same key the crossword uses, so "bigger text" carries
      // from one game to the other.
      var raw = JSON.parse(localStorage.getItem('inclusee.prefs.v1') || '{}');
      raw.scale = state.prefs.scale;
      raw.dark = state.prefs.dark;
      localStorage.setItem('inclusee.prefs.v1', JSON.stringify(raw));
    } catch (err) { /* private browsing */ }
  }

  function applyPrefs() {
    document.documentElement.style.setProperty('--scale', String(SCALES[state.prefs.scale]));
    document.body.classList.toggle('dark', !!state.prefs.dark);
    el.bigger.setAttribute('aria-pressed', String(state.prefs.scale > 0));
    el.darkToggle.setAttribute('aria-pressed', String(!!state.prefs.dark));
    el.darkToggle.textContent = state.prefs.dark ? 'Light screen' : 'Dark screen';
    el.bigger.textContent = state.prefs.scale < SCALES.length - 1 ? 'Bigger text' : 'Reset text size';
  }

  /* ------------------------------------------------------------------ grid */

  function buildGrid() {
    var puzzle = state.puzzle;
    var container = el.grid;
    container.innerHTML = '';
    container.style.setProperty('--cols', String(puzzle.cols));
    container.setAttribute('aria-label', 'Letter grid, ' + puzzle.rows + ' rows by ' + puzzle.cols + ' columns');

    for (var r = 0; r < puzzle.rows; r++) {
      for (var c = 0; c < puzzle.cols; c++) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'cell';
        if (c === puzzle.cols - 1) button.classList.add('edge-right');
        if (r === puzzle.rows - 1) button.classList.add('edge-bottom');
        button.textContent = puzzle.grid[r][c];
        button.dataset.r = String(r);
        button.dataset.c = String(c);
        button.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1) + ', letter ' + puzzle.grid[r][c]);
        button.tabIndex = (r === 0 && c === 0) ? 0 : -1;
        container.appendChild(button);
      }
    }
    fitLetters();
  }

  /**
   * Size the letters from the squares that hold them.
   *
   * The squares are sized by the panel, so the letters follow the panel too.
   * That is what keeps a large grid readable without ever letting it grow wider
   * than the space it has been given.
   */
  function fitLetters() {
    var first = el.grid.querySelector('.cell');
    if (!first) return;
    var width = first.getBoundingClientRect().width;
    if (!width) return;                       // not on screen yet

    var size = Math.max(15, Math.min(width * 0.52, 32));
    el.grid.style.setProperty('--letter', size.toFixed(1) + 'px');
  }

  /**
   * Measure once the browser has actually laid the grid out.
   *
   * A hidden panel reports a width of zero, so measuring too early silently
   * leaves the letters at whatever size they started at. Repeating the
   * measurement across a few frames covers the panel being revealed, a font
   * arriving, and the word list changing height.
   */
  function measureSoon() {
    fitLetters();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fitLetters);
    setTimeout(fitLetters, 60);
    setTimeout(fitLetters, 400);
  }

  function cellAt(r, c) {
    return el.grid.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function buildWordList() {
    el.wordList.innerHTML = '';
    for (var i = 0; i < state.puzzle.placements.length; i++) {
      var placement = state.puzzle.placements[i];
      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'word';
      button.dataset.word = placement.word;
      button.innerHTML = '<span class="letters"></span><span class="tick" hidden>&#10003; found</span>';
      button.querySelector('.letters').textContent = placement.word;
      button.addEventListener('click', (function (word) {
        return function () { showMe(word); };
      }(placement.word)));
      li.appendChild(button);
      el.wordList.appendChild(li);
      placement.button = button;
    }
  }

  /* --------------------------------------------------------------- picking */

  /** The straight line of cells between two squares, or null if there isn't one. */
  function lineBetween(from, to) {
    var dr = Math.sign(to.r - from.r);
    var dc = Math.sign(to.c - from.c);
    var rowSpan = Math.abs(to.r - from.r);
    var colSpan = Math.abs(to.c - from.c);

    // A straight line means the same distance across as down, or no movement on
    // one of the two axes. That covers across, down and the diagonals.
    if (rowSpan !== 0 && colSpan !== 0 && rowSpan !== colSpan) return null;

    var steps = Math.max(rowSpan, colSpan);
    var cells = [];
    for (var i = 0; i <= steps; i++) cells.push({ r: from.r + dr * i, c: from.c + dc * i });
    return cells;
  }

  function paintPreview() {
    var cells = el.grid.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('preview', 'anchor');
    for (var p = 0; p < state.preview.length; p++) {
      var cell = cellAt(state.preview[p].r, state.preview[p].c);
      if (cell) cell.classList.add('preview');
    }
    if (state.anchor) {
      var anchorCell = cellAt(state.anchor.r, state.anchor.c);
      if (anchorCell) anchorCell.classList.add('anchor');
    }
  }

  function pickCell(r, c) {
    // First tap: this is the beginning of the word.
    if (!state.anchor) {
      state.anchor = { r: r, c: c };
      state.preview = [{ r: r, c: c }];
      paintPreview();
      announce('Starting at row ' + (r + 1) + ', column ' + (c + 1) + '. Now tap the last letter.');
      el.instruction.textContent = 'Now tap the last letter of the word.';
      return;
    }

    var line = lineBetween(state.anchor, { r: r, c: c });

    // Not in a straight line from the start: treat it as a fresh start rather
    // than telling anyone off for a mistake they did not know they made.
    if (!line) {
      state.anchor = { r: r, c: c };
      state.preview = [{ r: r, c: c }];
      paintPreview();
      el.instruction.textContent = 'Now tap the last letter of the word.';
      flashStatus('Pick letters in a straight line - across, down or diagonally. Starting again from here.');
      return;
    }

    // A single square tapped twice: nothing to check yet.
    if (line.length === 1) return;

    state.preview = line;
    paintPreview();
    completeSelection(line);
  }

  function selectionText(line) {
    var text = '';
    for (var i = 0; i < line.length; i++) {
      var cell = cellAt(line[i].r, line[i].c);
      if (!cell) return '';
      text += cell.textContent;
    }
    return text;
  }

  function completeSelection(line) {
    var text = selectionText(line);
    var reversed = text.split('').reverse().join('');

    var match = null;
    for (var i = 0; i < state.puzzle.placements.length; i++) {
      var placement = state.puzzle.placements[i];
      if (state.found[placement.word]) continue;
      if (placement.word === text || placement.word === reversed) { match = placement; break; }
    }

    if (match) {
      markFound(match, line);
      return;
    }

    // Already found? Say so kindly rather than "wrong".
    var already = null;
    for (var j = 0; j < state.puzzle.placements.length; j++) {
      var other = state.puzzle.placements[j];
      if (!state.found[other.word]) continue;
      if (other.word === text || other.word === reversed) { already = other; break; }
    }

    state.anchor = null;
    state.preview = [];
    paintPreview();
    el.instruction.textContent = 'Tap a letter to start, then tap the last letter of the word.';

    if (already) {
      flashStatus('You have already found ' + already.word + '. ' + progressSentence());
    } else {
      flashStatus('That is not one of the words. Have another go - there is no rush.');
      announce('Not one of the words.');
    }
  }

  function markFound(placement, line) {
    state.found[placement.word] = true;
    for (var i = 0; i < line.length; i++) {
      var cell = cellAt(line[i].r, line[i].c);
      if (cell) {
        cell.classList.add('found');
        cell.classList.remove('preview', 'anchor');
      }
    }
    if (placement.button) {
      placement.button.classList.add('done');
      var tick = placement.button.querySelector('.tick');
      if (tick) tick.hidden = false;
    }

    state.anchor = null;
    state.preview = [];
    paintPreview();
    el.instruction.textContent = 'Tap a letter to start, then tap the last letter of the word.';
    refreshProgress();
    save();

    var remaining = state.puzzle.placements.filter(function (p) { return !state.found[p.word]; }).length;
    flashStatus('Found ' + placement.word + '! ' + progressSentence());
    announce('Found ' + placement.word + '. ' + progressSentence());

    if (remaining === 0) finish();
  }

  function progressSentence() {
    var total = state.puzzle.placements.length;
    var done = foundCount();
    var left = total - done;
    if (left === 0) return 'That is all of them.';
    return done + ' of ' + total + ' found, ' + left + ' to go.';
  }

  function foundCount() {
    var n = 0;
    for (var i = 0; i < state.puzzle.placements.length; i++) {
      if (state.found[state.puzzle.placements[i].word]) n++;
    }
    return n;
  }

  function refreshProgress() {
    var total = state.puzzle.placements.length;
    var done = foundCount();
    el.progress.textContent = done + ' of ' + total + ' words found';
    if (el.progressFill) el.progressFill.style.width = Math.round((done / total) * 100) + '%';
  }

  function finish() {
    state.finished = true;
    save();
    IncluseeProfile.recordCompletion(panel ? panel.name() : '', state.puzzleDate);
    var summary = panel ? panel.refresh() : null;
    showEndPanel(summary);
  }

  function showEndPanel(summary) {
    el.endPanel.hidden = false;
    var who = (summary && summary.displayName) ? summary.displayName + ', you' : 'You';
    var used = state.hintsUsed || 0;
    var message = who + ' found every word. Well done.';
    if (used > 0) {
      message = who + ' found every word, with ' + used + ' hint' + (used === 1 ? '' : 's') + '. Well done.';
    }
    if (summary && summary.finishedToday) message += ' ' + summary.text;
    el.endMessage.textContent = message;
    announce('All words found. ' + message);
    el.endPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showMe(word) {
    for (var i = 0; i < state.puzzle.placements.length; i++) {
      var placement = state.puzzle.placements[i];
      if (placement.word !== word || state.found[word]) continue;
      state.hintsUsed = (state.hintsUsed || 0) + 1;
      markFound(placement, placement.cells.map(function (cell) { return { r: cell[0], c: cell[1] }; }));
      return;
    }
    // Nothing to reveal: the word asked for is already found.
    if (state.found[word]) flashStatus(word + ' is already found. ' + progressSentence());
  }

  function startAgain() {
    state.found = {};
    state.anchor = null;
    state.preview = [];
    state.finished = false;
    state.hintsUsed = 0;
    el.endPanel.hidden = true;
    refreshProgress();
    save();
    for (var i = 0; i < state.puzzle.placements.length; i++) {
      var placement = state.puzzle.placements[i];
      if (placement.button) {
        placement.button.classList.remove('done');
        var tick = placement.button.querySelector('.tick');
        if (tick) tick.hidden = true;
      }
      for (var c = 0; c < placement.cells.length; c++) {
        var cell = cellAt(placement.cells[c][0], placement.cells[c][1]);
        if (cell) cell.classList.remove('found');
      }
    }
    flashStatus('Cleared. Start again whenever you like.');
    announce('Cleared.');
  }

  function flashStatus(text) {
    el.status.textContent = text;
    el.status.classList.add('show');
    clearTimeout(flashStatus.timer);
    flashStatus.timer = setTimeout(function () { el.status.classList.remove('show'); }, 7000);
  }

  function announce(text) { el.live.textContent = text; }

  /* ----------------------------------------------------------- saving work */

  function saveKey() {
    var id = IncluseeProfile.slug(panel ? panel.name() : '');
    return SAVE_KEY + (id ? '.' + id : '');
  }

  function save() {
    if (!state.puzzle) return;
    try {
      var words = [];
      for (var i = 0; i < state.puzzle.placements.length; i++) {
        if (state.found[state.puzzle.placements[i].word]) words.push(state.puzzle.placements[i].word);
      }
      localStorage.setItem(saveKey(), JSON.stringify(IncluseeSaveState.createRecord(state.puzzleDate, {
        found: words,
        hintsUsed: state.hintsUsed || 0,
        finished: state.finished,
        source: state.loaded ? state.loaded.source : null
      })));
    } catch (err) { /* private browsing - progress simply is not kept */ }
  }

  function restore() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(saveKey()) || 'null'); } catch (err) { raw = null; }

    var read = IncluseeSaveState.readRecord(raw, state.puzzleDate);
    if (!read.accepted) return false;

    var saved = read.details.found || [];
    state.hintsUsed = read.details.hintsUsed || 0;
    for (var i = 0; i < saved.length; i++) {
      for (var p = 0; p < state.puzzle.placements.length; p++) {
        var placement = state.puzzle.placements[p];
        if (placement.word !== saved[i]) continue;
        state.found[placement.word] = true;
        for (var c = 0; c < placement.cells.length; c++) {
          var cell = cellAt(placement.cells[c][0], placement.cells[c][1]);
          if (cell) cell.classList.add('found');
        }
        if (placement.button) {
          placement.button.classList.add('done');
          var tick = placement.button.querySelector('.tick');
          if (tick) tick.hidden = false;
        }
      }
    }
    refreshProgress();
    return true;
  }

  /* ----------------------------------------------------------------- events */

  function wireGrid() {
    // Tap and click both come through as clicks, which keeps the simple path
    // simple: real dragging is handled by the pointer events below.
    el.grid.addEventListener('click', function (ev) {
      var cell = ev.target.closest('.cell');
      if (cell) pickCell(Number(cell.dataset.r), Number(cell.dataset.c));
    });

    var dragging = false;
    el.grid.addEventListener('pointerdown', function (ev) {
      var cell = ev.target.closest('.cell');
      if (!cell) return;
      dragging = true;
      pickCell(Number(cell.dataset.r), Number(cell.dataset.c));
    });

    el.grid.addEventListener('pointermove', function (ev) {
      if (!dragging || !state.anchor) return;
      var over = document.elementFromPoint(ev.clientX, ev.clientY);
      var cell = over && over.closest ? over.closest('.cell') : null;
      if (!cell) return;
      var line = lineBetween(state.anchor, { r: Number(cell.dataset.r), c: Number(cell.dataset.c) });
      if (!line) return;
      state.preview = line;
      paintPreview();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      el.grid.addEventListener(type, function () {
        if (!dragging) return;
        dragging = false;
        if (state.anchor && state.preview.length > 1) completeSelection(state.preview);
      });
    });

    // Keyboard: arrows move, space picks the first and last letter.
    el.grid.addEventListener('keydown', function (ev) {
      var cell = ev.target.closest('.cell');
      if (!cell) return;
      var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      var moved = null;

      if (ev.key === 'ArrowUp') moved = { r: r - 1, c: c };
      else if (ev.key === 'ArrowDown') moved = { r: r + 1, c: c };
      else if (ev.key === 'ArrowLeft') moved = { r: r, c: c - 1 };
      else if (ev.key === 'ArrowRight') moved = { r: r, c: c + 1 };
      else if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        pickCell(r, c);
        return;
      } else if (ev.key === 'Escape') {
        state.anchor = null;
        state.preview = [];
        paintPreview();
        el.instruction.textContent = 'Tap a letter to start, then tap the last letter of the word.';
        return;
      }

      if (!moved) return;
      if (moved.r < 0 || moved.c < 0 || moved.r >= state.puzzle.rows || moved.c >= state.puzzle.cols) return;
      ev.preventDefault();
      cell.tabIndex = -1;
      var next = cellAt(moved.r, moved.c);
      if (next) { next.tabIndex = 0; next.focus(); }
    });
  }

  function wireChrome() {
    el.bigger.addEventListener('click', function () {
      state.prefs.scale = (state.prefs.scale + 1) % SCALES.length;
      savePrefs();
      applyPrefs();
      fitLetters();
    });
    el.darkToggle.addEventListener('click', function () {
      state.prefs.dark = !state.prefs.dark;
      savePrefs();
      applyPrefs();
    });
    el.clear.addEventListener('click', function () {
      if (window.confirm('Clear the words you have found and start this word search again?')) startAgain();
    });
    el.print.addEventListener('click', function () { window.print(); });
  }

  /* ------------------------------------------------------------------- boot */

  async function boot() {
    el.grid = $('#ws-grid');
    el.wordList = $('#word-list');
    el.instruction = $('#instruction');
    el.progress = $('#progress');
    el.progressFill = $('#progress-fill');
    el.status = $('#status');
    el.live = $('#live');
    el.endPanel = $('#end-panel');
    el.endMessage = $('#end-message');
    el.bigger = $('#bigger');
    el.darkToggle = $('#dark');
    el.clear = $('#clear');
    el.print = $('#print');
    el.staffNotes = $('#staff-notes');
    el.title = $('#puzzle-title');
    el.dateLine = $('#puzzle-date');
    el.loading = $('#loading');
    el.error = $('#error');
    el.game = $('#game');

    loadPrefs();
    applyPrefs();
    wireChrome();

    // The grid is sized from its panel, so it has to be re-measured whenever the
    // shape of the page changes.
    var remeasure = function () { measureSoon(); };
    window.addEventListener('resize', remeasure);
    if (el.game) {
      // A ResizeObserver on the panel itself fires when the layout changes for
      // any reason, including the browser window being resized or rotated.
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(remeasure).observe(el.game);
    }
    window.addEventListener('orientationchange', remeasure);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(remeasure).observe(el.grid.parentNode || el.grid);
    }

    var params = new URLSearchParams(window.location.search);
    if (params.get('embed')) document.body.classList.add('embed');
    var staff = params.get('staff') === '1';

    panel = IncluseePlayerPanel.create({
      input: $('#who'),
      saveButton: $('#who-save'),
      streakLine: $('#streak'),
      daysContainer: $('#streak-days'),
      announce: announce,
      shiftISO: IncluseeDates.shiftISO,
      prettyDate: IncluseeDates.prettyDate,
      onChange: function () {
        // Each name keeps its own words, so switching names shows that person's
        // own progress rather than a half-and-half mixture of two people's work.
        rebuildForPlayer();
      }
    });

    var loaded = await loadWords();
    el.loading.hidden = true;

    if (!loaded) {
      el.error.hidden = false;
      el.error.innerHTML = '<h2>Today\u2019s word search isn\u2019t available just yet</h2>' +
        '<p>We could not fetch a word list. Please try again later, or ask a staff member to check where the word files are kept.</p>' +
        (staff ? '<div id="fetch-notes"></div>' : '');
      if (staff && loaded !== undefined) {
        var box = document.getElementById('fetch-notes');
        if (box && lastProblems.length) {
          box.innerHTML = '<p>Addresses tried:</p><ul>' + lastProblems.map(function (p) {
            return '<li><code>' + p.path + '</code> \u2014 ' + p.why + '</li>';
          }).join('') + '</ul>';
        }
      }
      return;
    }

    state.loaded = loaded;
    state.puzzleDate = loaded.date;
    state.puzzle = loaded.puzzle;
    state.hintsUsed = 0;

    buildGrid();
    buildWordList();
    wireGrid();

    if (el.game) el.game.hidden = false;
    measureSoon();

    el.title.textContent = loaded.meta.title || 'Word Search';
    document.title = el.title.textContent + ' - Inclusee Games';
    el.dateLine.textContent = IncluseeDates.prettyDate(loaded.date) +
      (loaded.isSample ? ' (sample word search)' : (loaded.daysOld ? ' (most recent word search)' : ''));
    el.instruction.textContent = 'Tap a letter to start, then tap the last letter of the word.';

    panel.init(loaded.date);
    restore();
    refreshProgress();

    var notes = [];
    for (var i = 0; i < loaded.problems.length; i++) {
      notes.push('Line ' + loaded.problems[i].line + ': ' + loaded.problems[i].why + '  \u2192  "' + loaded.problems[i].text + '"');
    }
    for (var u = 0; u < loaded.puzzle.unplaced.length; u++) {
      notes.push('Could not fit the word "' + loaded.puzzle.unplaced[u].word + '" into the grid');
    }
    if (loaded.dateMismatch) {
      notes.push('This file is named ' + loaded.dateMismatch.file + ' but its #Date line says ' +
        loaded.dateMismatch.header + '. The file name is being used.');
    }
    for (var f = 0; f < (loaded.fetchProblems || []).length; f++) {
      notes.push('Could not fetch ' + loaded.fetchProblems[f].path + ' \u2014 ' + loaded.fetchProblems[f].why);
    }
    if (loaded.usedShippedCopy) {
      notes.push('The staff word list folder could not be read, so the copy that ships with ' +
        'the game is being shown instead. Check the folder name: HubSpot paths are ' +
        'case-sensitive. Configured: ' + loaded.configuredSource);
    }

    if (staff) {
      el.staffNotes.hidden = false;
      el.staffNotes.innerHTML = '<h3>Staff notes (only visible with ?staff=1)</h3>' +
        '<p>Loaded from <code>' + loaded.source + '</code> \u00b7 seed <code>' + loaded.puzzle.stats.seed + '</code> \u00b7 ' +
        loaded.puzzle.stats.words + ' words in ' + loaded.puzzle.rows + '\u00d7' + loaded.puzzle.cols +
        ' \u00b7 directions: ' + IncluseeWordList.describeDirections(loaded.directions) +
        ' \u00b7 ' + (loaded.puzzle.stats.crossings === 0 ? 'no words overlap' : loaded.puzzle.stats.crossings + ' overlapping letters') +
        '</p>' +
        (notes.length ? '<ul>' + notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>'
                      : '<p>No problems found in the word list.</p>');
    } else if (notes.length) {
      console.warn('Inclusee word search: ' + notes.length + ' issue(s) in ' + loaded.source, notes);
    }

    announce(el.title.textContent + ' loaded. ' + state.puzzle.placements.length + ' words to find.');
  }

  /**
   * sourceList(config, queryString, makeUrlFor) -> [{ kind, urlFor }]
   *
   * Which folders to try, in order:
   *   'query'      a folder given in the address - for demos and testing
   *   'configured' the staff folder on HubSpot (config.wordSearchSource)
   *   'shipped'    the copy that travels with the game
   *
   * Knowing WHICH one won is what lets the staff view say "the staff folder could
   * not be read, this is the shipped copy" instead of leaving a wrong folder name
   * looking like "my edits are not appearing". Pure, so it can be tested without
   * a browser.
   */
  function sourceList(config, queryString, makeUrlFor) {
    var query = new URLSearchParams(queryString || '');
    var sources = [];

    if (query.get('source') || query.get('template')) {
      sources.push({ kind: 'query', urlFor: makeUrlFor(query.get('source'), query.get('template')) });
    }
    if (config.wordSearchSource || config.wordSearchTemplate) {
      sources.push({ kind: 'configured', urlFor: makeUrlFor(config.wordSearchSource, config.wordSearchTemplate) });
    }
    sources.push({ kind: 'shipped', urlFor: makeUrlFor('words/', null) });
    return sources;
  }

  /** Loads the word file: the staff folder first, then the copy that ships with the game. */
  var lastProblems = [];
  async function loadWords() {
    var config = root.INCLUSEE_CONFIG || {};
    var today = IncluseeDates.todayISO();

    var sources = sourceList(config, window.location.search, IncluseePuzzleLoader.makeUrlFor);

    for (var i = 0; i < sources.length; i++) {
      var found = await IncluseePuzzleLoader.loadPuzzleText({ urlFor: sources[i].urlFor, today: today });
      if (!found) continue;

      var parsed = IncluseeWordList.parse(found.text);
      if (!parsed.words.length) continue;

      var resolved = IncluseePuzzleLoader.resolveDate(found, parsed.meta, today);
      return {
        // Only true when the copy shipped with the game is what is on screen,
        // which means the staff folder could not be read at all.
        usedShippedCopy: sources[i].kind === 'shipped',
        configuredSource: config.wordSearchSource || null,
        puzzle: IncluseeWordSearch.build(parsed.words.map(function (w) { return w.word; }), {
          seed: resolved.date,
          directions: parsed.meta.directions
        }),
        problems: parsed.problems,
        meta: parsed.meta,
        directions: parsed.meta.directions,
        date: resolved.date,
        dateMismatch: resolved.dateMismatch,
        source: found.source,
        isSample: !!found.fallback,
        daysOld: found.daysOld || 0,
        fetchProblems: []
      };
    }
    return null;
  }

  /** Wipes what is on screen when somebody else takes over the device. */
  function rebuildForPlayer() {
    if (!state.puzzle) return;
    state.found = {};
    state.anchor = null;
    state.preview = [];
    state.finished = false;
    state.hintsUsed = 0;
    el.endPanel.hidden = true;
    for (var i = 0; i < state.puzzle.placements.length; i++) {
      var placement = state.puzzle.placements[i];
      if (placement.button) {
        placement.button.classList.remove('done');
        var tick = placement.button.querySelector('.tick');
        if (tick) tick.hidden = true;
      }
      for (var c = 0; c < placement.cells.length; c++) {
        var cell = cellAt(placement.cells[c][0], placement.cells[c][1]);
        if (cell) cell.classList.remove('found', 'preview', 'anchor');
      }
    }
    restore();
    refreshProgress();
  }

  root.IncluseeWordSearchGame = {
    state: function () { return state; },
    sourceList: sourceList,
    fitLetters: fitLetters,
    measureSoon: measureSoon,
    pickCell: pickCell,
    showMe: showMe,
    startAgain: startAgain,
    foundCount: foundCount
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(typeof self !== 'undefined' ? self : this));