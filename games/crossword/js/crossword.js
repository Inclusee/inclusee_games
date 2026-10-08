/* ============================================================================
   Inclusee Games — Daily Crossword
   ----------------------------------------------------------------------------
   Designed for a first-time tablet user: no timers, no scores, no losing.
   Large type, big targets, one clear action at a time, and everything is
   saved automatically so the page can be closed and come back to later.

   The grid is built from the clue file on the web server. Nothing in here
   needs changing to publish a new puzzle — see staff/HOW-TO-... for that.
   ========================================================================== */
(function (root) {
  'use strict';

  var SAVE_KEY = 'inclusee.crossword.save';
  var PREF_KEY = 'inclusee.prefs.v1';
  var SCALES = [1, 1.15, 1.3, 1.5];
  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  var state = {
    loaded: null,
    puzzle: null,
    letters: [],          // [row][col] -> letter or ''
    wrong: {},            // "r,c" -> true after a check
    revealed: 0,
    entries: {},          // "r,c,dir" -> {…, complete:false}
    byKey: {},            // "r,c" -> { across, down, number }
    selected: null,       // { r, c, dir }
    prefs: { scale: 0, dark: false, keyboard: null },
    finished: false
  };

  var el = {};

  /* ----------------------------------------------------------------- setup */

  function $(sel) { return document.querySelector(sel); }
  function cellKey(r, c) { return r + ',' + c; }
  function entryKey(e) { return e.row + ',' + e.col + ',' + e.direction; }
  function entryDirectionLabel(e) { return e.direction === 'across' ? 'across' : 'down'; }

  function loadPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      if (typeof raw.scale === 'number') state.prefs.scale = raw.scale;
      if (typeof raw.dark === 'boolean') state.prefs.dark = raw.dark;
      if (typeof raw.keyboard === 'boolean') state.prefs.keyboard = raw.keyboard;
    } catch (err) { /* first visit */ }
    if (state.prefs.keyboard === null) {
      state.prefs.keyboard = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    }
  }

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); } catch (err) { /* private mode */ }
  }

  function applyPrefs() {
    document.documentElement.style.setProperty('--scale', String(SCALES[state.prefs.scale]));
    document.body.classList.toggle('dark', !!state.prefs.dark);
    document.body.classList.toggle('show-keyboard', !!state.prefs.keyboard);
    el.bigger.setAttribute('aria-pressed', String(state.prefs.scale > 0));
    el.darkToggle.setAttribute('aria-pressed', String(!!state.prefs.dark));
    el.keyboardToggle.setAttribute('aria-pressed', String(!!state.prefs.keyboard));
    el.darkToggle.textContent = state.prefs.dark ? 'Light screen' : 'Dark screen';
    el.bigger.textContent = state.prefs.scale < SCALES.length - 1 ? 'Bigger text' : 'Reset text size';
    el.keyboardToggle.textContent = state.prefs.keyboard ? 'Hide letter buttons' : 'Letter buttons';
  }

  /* ----------------------------------------------------------- build model */

  function buildModel(puzzle) {
    state.puzzle = puzzle;
    state.letters = [];
    for (var r = 0; r < puzzle.rows; r++) {
      var row = [];
      for (var c = 0; c < puzzle.cols; c++) row.push('');
      state.letters.push(row);
    }

    state.byKey = {};
    for (var i = 0; i < puzzle.entries.length; i++) {
      var e = puzzle.entries[i];
      e.complete = false;
      state.entries[entryKey(e)] = e;
      for (var k = 0; k < e.cells.length; k++) {
        var key = cellKey(e.cells[k][0], e.cells[k][1]);
        if (!state.byKey[key]) state.byKey[key] = { across: null, down: null, number: puzzle.numbers[e.cells[k][0]][e.cells[k][1]] };
        state.byKey[key][e.direction] = e;
      }
    }
  }

  /* -------------------------------------------------------------- rendering */

  function buildGrid() {
    var puzzle = state.puzzle;
    el.grid.innerHTML = '';
    el.grid.style.setProperty('--cols', String(puzzle.cols));
    el.grid.setAttribute('role', 'group');
    el.grid.setAttribute('aria-label', 'Crossword grid, ' + puzzle.rows + ' rows by ' + puzzle.cols + ' columns');

    for (var r = 0; r < puzzle.rows; r++) {
      for (var c = 0; c < puzzle.cols; c++) {
        if (!puzzle.grid[r][c]) continue;

        var info = state.byKey[cellKey(r, c)] || { across: null, down: null, number: puzzle.numbers[r][c] };
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.gridColumn = String(c + 1);
        cell.style.gridRow = String(r + 1);
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);

        if (info.number) {
          var num = document.createElement('span');
          num.className = 'cell-number';
          num.textContent = String(info.number);
          num.setAttribute('aria-hidden', 'true');
          cell.appendChild(num);
        }

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'letter';
        input.maxLength = 1;
        input.autocomplete = 'off';
        input.autocorrect = 'off';
        input.spellcheck = false;
        input.inputMode = 'text';
        input.setAttribute('enterkeyhint', 'next');
        input.dataset.r = String(r);
        input.dataset.c = String(c);
        input.setAttribute('aria-label', cellLabel(r, c));
        cell.appendChild(input);

        el.grid.appendChild(cell);
      }
    }
  }

  /** What a screen reader says for one square: which answer it belongs to. */
  function cellLabel(r, c) {
    var info = state.byKey[cellKey(r, c)];
    if (!info) return 'Square';
    var e = info.across || info.down;
    var index = 0;
    for (var i = 0; i < e.cells.length; i++) {
      if (e.cells[i][0] === r && e.cells[i][1] === c) { index = i; break; }
    }
    return e.number + ' ' + entryDirectionLabel(e) + ', letter ' + (index + 1) + ' of ' + e.cells.length;
  }

  function buildClues() {
    var across = [], down = [];
    for (var i = 0; i < state.puzzle.entries.length; i++) {
      var e = state.puzzle.entries[i];
      (e.direction === 'across' ? across : down).push(e);
    }
    across.sort(function (a, b) { return a.number - b.number; });
    down.sort(function (a, b) { return a.number - b.number; });

    renderClueList(el.acrossList, across, 'Across');
    renderClueList(el.downList, down, 'Down');
  }

  function renderClueList(container, entries, heading) {
    container.innerHTML = '';
    if (!entries.length) return;
    var h = document.createElement('h3');
    h.textContent = heading;
    container.appendChild(h);

    var list = document.createElement('ul');
    list.className = 'clue-list';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clue';
      btn.dataset.key = entryKey(e);
      btn.innerHTML = '<span class="clue-number">' + e.number + '</span><span class="clue-text"></span>';
      btn.querySelector('.clue-text').textContent = e.clue;
      btn.addEventListener('click', (function (entry) {
        return function () { selectEntry(entry); };
      }(e)));
      li.appendChild(btn);
      list.appendChild(li);
      e.button = btn;
    }
    container.appendChild(list);
  }

  function buildKeyboard() {
    el.keyboard.innerHTML = '';
    var back = keyboardButton('⌫ Delete', function () { deleteAtCursor(); });
    back.classList.add('wide');

    for (var i = 0; i < ALPHABET.length; i++) {
      el.keyboard.appendChild(keyboardButton(ALPHABET[i], (function (ch) {
        return function () { typeLetter(ch); };
      }(ALPHABET[i]))));
    }
    el.keyboard.appendChild(back);
  }

  function keyboardButton(label, handler) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    b.textContent = label;
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      handler();
      if (state.selected) focusCell(state.selected.r, state.selected.c);
    });
    return b;
  }

  /* ------------------------------------------------------------ interaction */

  function inputAt(r, c) {
    return el.grid.querySelector('input[data-r="' + r + '"][data-c="' + c + '"]');
  }

  /** Marks a letter as needing another look. The class goes on the square as
   *  well as the letter box, so the styling does not depend on support for the
   *  :has() selector in older in-app browsers. */
  function markWrong(input, isWrong) {
    if (!input) return;
    input.classList.toggle('wrong', isWrong);
    var cell = input.closest('.cell');
    if (cell) cell.classList.toggle('wrong', isWrong);
  }

  function focusCell(r, c) {
    var input = inputAt(r, c);
    if (input) input.focus({ preventScroll: false });
  }

  /**
   * Selection. Clicking a square that is already selected flips between the
   * across and down answer running through it — the behaviour people know
   * from paper crosswords, without needing to learn a shift-click.
   */
  function selectCell(r, c, forceDir, flip) {
    var info = state.byKey[cellKey(r, c)];
    if (!info) return;

    var dir = forceDir;
    if (!dir) {
      if (flip && state.selected && state.selected.r === r && state.selected.c === c) {
        dir = state.selected.dir === 'across' ? 'down' : 'across';
      } else {
        dir = state.selected && state.selected.dir === 'down' && info.down ? 'down' : (info.across ? 'across' : 'down');
      }
    }
    if (!info[dir]) dir = dir === 'across' ? 'down' : 'across';
    if (!info[dir]) dir = info.across ? 'across' : 'down';

    state.selected = { r: r, c: c, dir: dir };
    paintSelection();
  }

  function selectEntry(entry, preferEmpty) {
    var target = entry.cells[0];
    if (preferEmpty !== false) {
      for (var i = 0; i < entry.cells.length; i++) {
        var cell = entry.cells[i];
        if (!state.letters[cell[0]][cell[1]]) { target = cell; break; }
      }
    }
    state.selected = { r: target[0], c: target[1], dir: entry.direction };
    paintSelection();
    focusCell(target[0], target[1]);
  }

  function currentEntry() {
    if (!state.selected) return null;
    var info = state.byKey[cellKey(state.selected.r, state.selected.c)];
    return info ? info[state.selected.dir] : null;
  }

  function paintSelection() {
    var info = state.selected ? state.byKey[cellKey(state.selected.r, state.selected.c)] : null;
    var active = info ? info[state.selected.dir] : null;
    var activeKey = active ? entryKey(active) : null;

    var cells = el.grid.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      var cellInfo = state.byKey[cellKey(r, c)] || {};
      var inEntry = false;
      if (active) {
        for (var k = 0; k < active.cells.length; k++) {
          if (active.cells[k][0] === r && active.cells[k][1] === c) { inEntry = true; break; }
        }
      }
      cell.classList.toggle('in-entry', inEntry);
      cell.classList.toggle('is-selected', !!(state.selected && state.selected.r === r && state.selected.c === c));
    }

    var buttons = document.querySelectorAll('.clue');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].classList.toggle('is-active', buttons[j].dataset.key === activeKey);
    }

    if (active) {
      el.currentClue.innerHTML = '';
      var strong = document.createElement('strong');
      strong.textContent = active.number + ' ' + entryDirectionLabel(active) + ' — ';
      el.currentClue.appendChild(strong);
      el.currentClue.appendChild(document.createTextNode(active.clue));
      el.currentClue.classList.remove('empty');
    } else {
      el.currentClue.textContent = 'Tap a square to start.';
      el.currentClue.classList.add('empty');
    }
  }

  function typeLetter(ch) {
    if (!state.selected) return;
    var r = state.selected.r, c = state.selected.c;
    var info = state.byKey[cellKey(r, c)];
    if (!info) return;
    var entry = info[state.selected.dir];
    var input = inputAt(r, c);
    if (input) input.value = ch;

    state.letters[r][c] = ch;
    delete state.wrong[cellKey(r, c)];
    markWrong(input, false);
    refreshEntryStates();
    save();
    advance(1);
    checkCompletion();
  }

  function deleteAtCursor() {
    if (!state.selected) return;
    var r = state.selected.r, c = state.selected.c;
    if (state.letters[r][c]) {
      clearCell(r, c);
    } else {
      var back = step(-1);
      if (back) { selectCell(back[0], back[1], state.selected.dir); clearCell(back[0], back[1]); }
    }
    refreshEntryStates();
    save();
  }

  function clearCell(r, c) {
    state.letters[r][c] = '';
    var input = inputAt(r, c);
    if (input) input.value = '';
    markWrong(input, false);
    delete state.wrong[cellKey(r, c)];
  }

  /** The next letter square in the current answer, or null at its end. */
  function step(delta) {
    var entry = currentEntry();
    if (!entry) return null;
    for (var i = 0; i < entry.cells.length; i++) {
      if (entry.cells[i][0] === state.selected.r && entry.cells[i][1] === state.selected.c) {
        var next = entry.cells[i + delta];
        return next ? next : null;
      }
    }
    return null;
  }

  function advance(delta) {
    var next = step(delta);
    if (next) selectCell(next[0], next[1], state.selected.dir);
  }

  /**
   * Arrow keys walk the grid itself rather than only the current answer, so a
   * resident can look around the whole puzzle the same way as on paper.
   */
  function moveArrow(dr, dc) {
    if (!state.selected) return;
    var puzzle = state.puzzle;
    var r = state.selected.r, c = state.selected.c;
    var dir = dc ? 'across' : 'down';
    while (true) {
      r += dr; c += dc;
      if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) return;
      if (puzzle.grid[r][c]) break;
    }
    selectCell(r, c, dir);
    focusCell(r, c);
  }

  /* ------------------------------------------------------------- game state */

  function entryIsFilled(entry) {
    for (var i = 0; i < entry.cells.length; i++) {
      if (!state.letters[entry.cells[i][0]][entry.cells[i][1]]) return false;
    }
    return true;
  }

  function entryIsCorrect(entry) {
    for (var i = 0; i < entry.cells.length; i++) {
      if (state.letters[entry.cells[i][0]][entry.cells[i][1]] !== entry.answer[i]) return false;
    }
    return true;
  }

  function refreshEntryStates() {
    var finished = 0, correct = 0;
    for (var i = 0; i < state.puzzle.entries.length; i++) {
      var e = state.puzzle.entries[i];
      e.complete = entryIsFilled(e);
      e.correct = e.complete && entryIsCorrect(e);
      if (e.complete) finished++;
      if (e.correct) correct++;
      if (e.button) {
        e.button.classList.toggle('done', e.complete);
        e.button.classList.toggle('solved', e.correct);
      }
    }
    el.progress.textContent = correct + ' of ' + state.puzzle.entries.length + ' answers finished';
    if (el.progressFill) {
      el.progressFill.style.width = Math.round((correct / state.puzzle.entries.length) * 100) + '%';
    }
    return { finished: finished, correct: correct };
  }

  function hintForUnfinishedEntry() {
    var best = null;
    for (var i = 0; i < state.puzzle.entries.length; i++) {
      var e = state.puzzle.entries[i];
      if (e.complete && !e.correct) return e;      // a filled-but-wrong answer
      if (!e.complete && !best) best = e;
    }
    return best;
  }

  function checkCompletion() {
    var total = state.puzzle.entries.length;
    var solved = 0;
    for (var i = 0; i < total; i++) if (entryIsCorrect(state.puzzle.entries[i])) solved++;

    if (solved === total && !state.finished) {
      state.finished = true;
      save();
      IncluseeProfile.recordCompletion(state.playerName, state.loaded.date);
      var summary = refreshStreak();
      showEndPanel(summary);
      return;
    }
    if (solved === total) return;

    var filledEverything = true;
    for (var r = 0; r < state.puzzle.rows; r++) {
      for (var c = 0; c < state.puzzle.cols; c++) {
        if (state.puzzle.grid[r][c] && !state.letters[r][c]) filledEverything = false;
      }
    }
    if (filledEverything) announce('All the squares are filled, but not every answer is right yet. Use Check answers when you are ready.');
  }

  function showEndPanel(summary) {
    el.endPanel.hidden = false;
    var who = (summary && summary.displayName) ? summary.displayName + ', you' : 'You';
    var message = who + ' finished the crossword. Well done.';
    if (state.revealed > 0) {
      message = who + ' finished the crossword, using ' + state.revealed + ' hint' +
        (state.revealed === 1 ? '' : 's') + '. Well done.';
    }
    if (summary && summary.finishedToday) message += ' ' + summary.text;
    el.endMessage.textContent = message;
    announce('Crossword complete. ' + message);
    el.endPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function announce(text) {
    el.live.textContent = text;
  }

  /* ------------------------------------------------------------ saving work */

  /** Letters and streaks are kept per name, so a shared tablet does not mix two
   *  residents' work together. With no name, the old shared key is used. */
  function saveKey() {
    var id = IncluseeProfile.slug(state.playerName || '');
    return SAVE_KEY + (id ? '.' + id : '');
  }

  function save() {
    if (!state.puzzle) return;
    try {
      localStorage.setItem(saveKey(), JSON.stringify(IncluseeSaveState.createSave(state.loaded.date, state.letters, {
        source: state.loaded.source,
        revealed: state.revealed,
        finished: state.finished
      })));
    } catch (err) { /* private browsing — progress simply isn't kept */ }
  }

  function restore() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(saveKey()) || 'null'); } catch (err) { raw = null; }

    var saved = IncluseeSaveState.readSave(raw, state.loaded.date, state.puzzle.rows, state.puzzle.cols);
    if (!saved.accepted) return false;

    for (var r = 0; r < saved.letters.length; r++) {
      for (var c = 0; c < saved.letters[r].length; c++) {
        var ch = saved.letters[r][c];
        if (!ch) continue;
        state.letters[r][c] = ch;
        var input = inputAt(r, c);
        if (input) input.value = ch;
      }
    }
    state.revealed = saved.revealed;
    state.finished = false;   // let the win panel show again if they come back
    refreshEntryStates();
    return true;
  }

  /* --------------------------------------------------------------- actions */

  function checkAnswers() {
    var wrongCells = {};
    var wrongCount = 0, checked = 0, checkedCells = {};
    for (var i = 0; i < state.puzzle.entries.length; i++) {
      var e = state.puzzle.entries[i];
      for (var k = 0; k < e.cells.length; k++) {
        var r = e.cells[k][0], c = e.cells[k][1];
        var letter = state.letters[r][c];
        if (!letter) continue;
        var key = cellKey(r, c);
        // A square where an across and a down answer cross is visited twice, so
        // count each square once — otherwise "5 letters to look at" when there
        // are only four looks careless to the person reading it.
        if (!checkedCells[key]) { checkedCells[key] = true; checked++; }
        var input = inputAt(r, c);
        if (letter !== e.answer[k]) {
          if (!wrongCells[key]) { wrongCells[key] = true; wrongCount++; }
          state.wrong[key] = true;
          markWrong(input, true);
        } else {
          markWrong(input, false);
          delete state.wrong[key];
        }
      }
    }
    if (!checked) {
      announce('There is nothing to check yet.');
      flashStatus('Nothing to check yet — pop a few letters in first.');
      return;
    }
    var message = wrongCount === 0
      ? 'All good so far — every letter is in the right place.'
      : (wrongCount === 1
          ? '1 letter needs another look. It is circled in red.'
          : wrongCount + ' letters need another look. They are circled in red.');
    if (wrongCount === 0) {
      announce('Every letter you have written so far is right.');
    } else {
      announce(wrongCount === 1 ? 'One letter needs another look.' : wrongCount + ' letters need another look.');
    }
    flashStatus(message);
    checkCompletion();
  }

  function revealLetter() {
    if (!state.selected) return;
    var r = state.selected.r, c = state.selected.c;
    var info = state.byKey[cellKey(r, c)];
    var entry = info[state.selected.dir] || info.across || info.down;
    var letter = state.puzzle.grid[r][c];
    for (var i = 0; i < entry.cells.length; i++) {
      if (entry.cells[i][0] === r && entry.cells[i][1] === c) { letter = entry.answer[i]; break; }
    }
    var input = inputAt(r, c);
    state.letters[r][c] = letter;
    if (input) input.value = letter;
    markWrong(input, false);
    delete state.wrong[cellKey(r, c)];
    state.revealed++;
    refreshEntryStates();
    save();
    announce('Letter revealed: ' + letter);
    advance(1);
    checkCompletion();
  }

  function revealEntry() {
    var entry = currentEntry();
    if (!entry) return;
    for (var i = 0; i < entry.cells.length; i++) {
      var r = entry.cells[i][0], c = entry.cells[i][1];
      state.letters[r][c] = entry.answer[i];
      var input = inputAt(r, c);
      if (input) input.value = entry.answer[i];
      markWrong(input, false);
      delete state.wrong[cellKey(r, c)];
    }
    state.revealed++;
    refreshEntryStates();
    save();
    announce('Answer shown: ' + entry.answer.toLowerCase());
    checkCompletion();
  }

  function clearAll() {
    if (!window.confirm('Clear every letter and start this crossword again?')) return;
    for (var r = 0; r < state.puzzle.rows; r++) {
      for (var c = 0; c < state.puzzle.cols; c++) clearCell(r, c);
    }
    state.revealed = 0;
    state.finished = false;
    el.endPanel.hidden = true;
    refreshEntryStates();
    save();
    flashStatus('Cleared. Start again whenever you like.');
  }

  /** Staff mode only: fills in the whole grid, for checking a puzzle or making
   *  a printed answer key. */
  function fillEverything() {
    for (var i = 0; i < state.puzzle.entries.length; i++) {
      var e = state.puzzle.entries[i];
      for (var k = 0; k < e.cells.length; k++) {
        var r = e.cells[k][0], c = e.cells[k][1];
        state.letters[r][c] = e.answer[k];
        var input = inputAt(r, c);
        if (input) input.value = e.answer[k];
        markWrong(input, false);
      }
    }
    delete state.__filledByStaff;
    state.__filledByStaff = true;
    refreshEntryStates();
    checkCompletion();
  }

  function flashStatus(text) {
    el.status.textContent = text;
    el.status.classList.add('show');
    clearTimeout(flashStatus.timer);
    flashStatus.timer = setTimeout(function () { el.status.classList.remove('show'); }, 6000);
  }

  /* ------------------------------------------------------------------- wiring */

  function wireCellEvents() {
    el.grid.addEventListener('focusin', function (ev) {
      var input = ev.target.closest('input.letter');
      if (!input) return;
      selectCell(Number(input.dataset.r), Number(input.dataset.c));
    });

    el.grid.addEventListener('mousedown', function (ev) {
      var input = ev.target.closest('input.letter');
      if (!input) return;
      selectCell(Number(input.dataset.r), Number(input.dataset.c), null, true);
    });

    el.grid.addEventListener('input', function (ev) {
      var input = ev.target.closest('input.letter');
      if (!input) return;
      var raw = (input.value || '').toUpperCase();
      var matches = raw.match(/[A-Z]/g);
      if (!matches) {
        input.value = '';
        state.letters[Number(input.dataset.r)][Number(input.dataset.c)] = '';
        return;
      }
      var ch = matches[matches.length - 1];
      input.value = ch;
      // Put the letter in the model and move on, without re-selecting first.
      var r = Number(input.dataset.r), c = Number(input.dataset.c);
      state.letters[r][c] = ch;
      delete state.wrong[cellKey(r, c)];
      markWrong(input, false);
      if (!state.selected || state.selected.r !== r || state.selected.c !== c) {
        selectCell(r, c, state.selected ? state.selected.dir : null);
      }
      refreshEntryStates();
      save();
      advance(1);
      // Move the cursor on, otherwise the next letter typed lands in this box
      // again and the answer never fills in.
      if (state.selected) focusCell(state.selected.r, state.selected.c);
      checkCompletion();
    });

    el.grid.addEventListener('keydown', function (ev) {
      var input = ev.target.closest('input.letter');
      if (!input) return;
      var r = Number(input.dataset.r), c = Number(input.dataset.c);

      switch (ev.key) {
        case 'ArrowLeft': ev.preventDefault(); moveArrow(0, -1); return;
        case 'ArrowRight': ev.preventDefault(); moveArrow(0, 1); return;
        case 'ArrowUp': ev.preventDefault(); moveArrow(-1, 0); return;
        case 'ArrowDown': ev.preventDefault(); moveArrow(1, 0); return;
        case ' ': ev.preventDefault(); selectCell(r, c, null, true); return;
        case 'Backspace': case 'Delete':
          ev.preventDefault();
          if (state.letters[r][c]) { clearCell(r, c); }
          else { deleteAtCursor(); }
          refreshEntryStates(); save();
          return;
        default: break;
      }
    });
  }

  function wireChrome() {
    el.bigger.addEventListener('click', function () {
      state.prefs.scale = (state.prefs.scale + 1) % SCALES.length;
      savePrefs();
      applyPrefs();
      announce('Text size ' + (state.prefs.scale === 0 ? 'back to normal' : 'set to ' + (state.prefs.scale + 1) + ' of ' + (SCALES.length - 1)));
    });
    el.darkToggle.addEventListener('click', function () {
      state.prefs.dark = !state.prefs.dark;
      savePrefs();
      applyPrefs();
    });
    el.keyboardToggle.addEventListener('click', function () {
      state.prefs.keyboard = !state.prefs.keyboard;
      savePrefs();
      applyPrefs();
      if (state.prefs.keyboard && state.selected) focusCell(state.selected.r, state.selected.c);
    });
    el.check.addEventListener('click', checkAnswers);
    el.revealLetter.addEventListener('click', revealLetter);
    el.revealWord.addEventListener('click', revealEntry);
    el.clear.addEventListener('click', clearAll);
    el.print.addEventListener('click', function () { window.print(); });

    el.whoSave.addEventListener('click', saveName);
    el.who.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); saveName(); }
    });
    el.who.addEventListener('blur', function () {
      // Saving on the way out means nobody loses a name they typed and forgot to
      // save, which a first-time user is very likely to do.
      if (IncluseeProfile.cleanName(el.who.value) !== IncluseeProfile.getUser()) saveName();
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && state.selected) {
        var input = inputAt(state.selected.r, state.selected.c);
        if (input) input.blur();
      }
    });
  }

  /* ------------------------------------------------------- name and streak */

  function saveName() {
    var typed = IncluseeProfile.cleanName(el.who.value);
    var previous = IncluseeProfile.getUser();

    IncluseeProfile.setUser(typed);
    el.who.value = typed;
    state.playerName = typed;

    // Each name keeps its own letters, so switching names loads that person's
    // own puzzle instead of a half-and-half mixture of two people's work.
    // Nothing is lost: the other person's letters stay saved under their name.
    clearGridWithoutSaving();
    restore();
    refreshEntryStates();
    paintSelection();

    // Finished before typing a name? Credit them for it now.
    if (allEntriesCorrect()) {
      IncluseeProfile.recordCompletion(typed, state.loaded.date);
      showEndPanel(refreshStreak());
      return;
    }

    refreshStreak(typed
      ? 'Playing as ' + (IncluseeProfile.displayName(typed) || 'this player') + '.'
      : 'Name cleared. The crossword still works without one.');
  }

  function allEntriesCorrect() {
    if (!state.puzzle) return false;
    for (var i = 0; i < state.puzzle.entries.length; i++) {
      if (!entryIsCorrect(state.puzzle.entries[i])) return false;
    }
    return true;
  }

  /** Empties the grid WITHOUT writing to storage. Used when switching names,
   *  where that name's own saved letters are about to be loaded instead - saving
   *  an empty grid first would wipe the very progress we are about to restore. */
  function clearGridWithoutSaving() {
    for (var r = 0; r < state.puzzle.rows; r++) {
      for (var c = 0; c < state.puzzle.cols; c++) clearCell(r, c);
    }
    state.revealed = 0;
    state.finished = false;
    el.endPanel.hidden = true;
    refreshEntryStates();
  }

  function refreshStreak(spoken) {
    var name = state.playerName || '';
    var summary = IncluseeProfile.summary(name, state.loaded.date);
    state.streak = summary;

    if (!name) {
      el.streak.textContent = summary.finished
        ? 'Playing without a name. ' + summary.finished + ' crossword' + (summary.finished === 1 ? '' : 's') + ' finished on this device.'
        : 'Add your name to keep a run of days going.';
    } else {
      el.streak.textContent = summary.text;
    }

    // Seven dots for the last seven days, today on the right.
    el.streakDays.innerHTML = '';
    var has = {};
    for (var i = 0; i < summary.dates.length; i++) has[summary.dates[i]] = true;
    for (var back = 6; back >= 0; back--) {
      var date = IncluseePuzzleText.shiftISO(state.loaded.date, -back);
      var dot = document.createElement('span');
      dot.className = 'day' + (has[date] ? ' done' : '') + (back === 0 ? ' today' : '');
      dot.title = IncluseePuzzleText.prettyDate(date) + (has[date] ? ' - finished' : '');
      el.streakDays.appendChild(dot);
    }

    if (spoken) announce(spoken + ' ' + el.streak.textContent);
    return summary;
  }

  /* ------------------------------------------------------------------- boot */

  async function boot() {
    el.grid = $('#grid');
    el.acrossList = $('#across');
    el.downList = $('#down');
    el.currentClue = $('#current-clue');
    el.progress = $('#progress');
    el.progressFill = $('#progress-fill');
    el.status = $('#status');
    el.live = $('#live');
    el.keyboard = $('#keyboard');
    el.endPanel = $('#end-panel');
    el.endMessage = $('#end-message');
    el.bigger = $('#bigger');
    el.darkToggle = $('#dark');
    el.keyboardToggle = $('#keys');
    el.check = $('#check');
    el.revealLetter = $('#reveal-letter');
    el.revealWord = $('#reveal-word');
    el.clear = $('#clear');
    el.print = $('#print');
    el.staffNotes = $('#staff-notes');
    el.who = $('#who');
    el.whoSave = $('#who-save');
    el.streak = $('#streak');
    el.streakDays = $('#streak-days');
    el.title = $('#puzzle-title');
    el.dateLine = $('#puzzle-date');
    el.loading = $('#loading');
    el.error = $('#error');

    loadPrefs();
    applyPrefs();
    wireChrome();
    buildKeyboard();

    var params = new URLSearchParams(window.location.search);
    if (params.get('embed')) document.body.classList.add('embed');
    var staff = params.get('staff') === '1';

    var loaded = await IncluseePuzzleLoader.loadPuzzle();
    el.loading.hidden = true;

    if (!loaded || loaded.failed) {
      el.error.hidden = false;
      el.error.innerHTML = '<h2>Today\u2019s crossword isn\u2019t available just yet</h2>' +
        '<p>We could not fetch a puzzle file. Please try again later, or ask a staff member to check where the puzzle files are kept.</p>' +
        (staff ? '<div id="fetch-notes"></div>' : '');
      if (staff && loaded && loaded.problems) {
        var box = document.getElementById('fetch-notes');
        if (box) {
          box.innerHTML = '<p>Addresses tried:</p><ul>' + loaded.problems.map(function (p) {
            return '<li><code>' + p.path + '</code> \u2014 ' + p.why + '</li>';
          }).join('') + '</ul><p>A message mentioning CORS means the other server is refusing to hand files to this page. See the staff notes on hosting.</p>';
        }
      }
      return;
    }

    state.loaded = loaded;
    buildModel(loaded.puzzle);
    buildGrid();
    buildClues();
    wireCellEvents();

    var title = loaded.meta.title || 'Daily Crossword';
    el.title.textContent = title;
    document.title = title + ' — Inclusee Games';
    el.dateLine.textContent = IncluseePuzzleText.prettyDate(loaded.date) +
      (loaded.isSample ? ' (sample puzzle)' : (loaded.daysOld ? ' (most recent puzzle)' : ''));

    state.playerName = IncluseeProfile.getUser();
    if (state.playerName) el.who.value = state.playerName;

    var restored = restore();
    refreshEntryStates();
    paintSelection();
    refreshStreak();
    if (state.playerName) {
      var hello = IncluseeProfile.displayName(state.playerName);
      if (loaded.meta && loaded.meta.title) document.title = hello + ' - ' + loaded.meta.title;
    }
    if (restored) checkCompletion();

    // Anything staff should know about the clue file: only visible with
    // ?staff=1, so residents never see a semi-broken puzzle get explained.
    var notes = [];
    for (var i = 0; i < loaded.problems.length; i++) {
      var p = loaded.problems[i];
      notes.push('Line ' + p.line + ': ' + p.why + '  \u2192  "' + p.text + '"');
    }
    for (var j = 0; j < loaded.puzzle.unplaced.length; j++) {
      notes.push('Could not fit the answer "' + loaded.puzzle.unplaced[j].answer + '" into the grid');
    }
    if (loaded.dateMismatch) {
      notes.push('This file is named ' + loaded.dateMismatch.file + ' but its #Date line says ' +
        loaded.dateMismatch.header + '. The file name is being used. Check the #Date line.');
    }
    for (var f = 0; f < (loaded.fetchProblems || []).length; f++) {
      notes.push('Could not fetch ' + loaded.fetchProblems[f].path + ' \u2014 ' + loaded.fetchProblems[f].why);
    }
    if (staff) {
      el.staffNotes.hidden = false;
      el.staffNotes.innerHTML = '<h3>Staff notes (only visible with ?staff=1)</h3>' +
        '<p>Loaded from <code>' + loaded.source + '</code> \u00b7 seed <code>' + loaded.puzzle.stats.seed + '</code> \u00b7 ' +
        loaded.puzzle.entries.length + ' answers placed \u00b7 grid ' + loaded.puzzle.rows + '\u00d7' + loaded.puzzle.cols + '</p>' +
        (notes.length ? '<ul>' + notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>'
                      : '<p>No problems found in the clue file.</p>') +
        '<p><button type="button" id="staff-fill" class="secondary">Fill in every answer (answer key)</button></p>';
      var fillBtn = $('#staff-fill');
      if (fillBtn) fillBtn.addEventListener('click', fillEverything);
    } else if (notes.length) {
      // Never silent about it: log for whoever is looking, without alarming residents.
      console.warn('Inclusee crossword: ' + notes.length + ' issue(s) in ' + loaded.source, notes);
    }

    announce(title + ' loaded. ' + loaded.puzzle.entries.length + ' answers.');
  }

  /* A small surface for automated checks while we build the games. */
  root.IncluseeCrossword = {
    state: state,
    check: checkAnswers,
    revealWord: revealEntry,
    revealLetter: revealLetter,
    clearAll: clearAll,
    fillEverything: fillEverything,
    selectEntry: selectEntry,
    selectCell: selectCell,
    typeLetter: typeLetter,
    saveName: saveName,
    refreshStreak: refreshStreak
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(typeof self !== 'undefined' ? self : this));