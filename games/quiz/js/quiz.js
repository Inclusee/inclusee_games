/* ============================================================================
   Inclusee Games - Quiz
   ----------------------------------------------------------------------------
   A gentle multiple-choice quiz. Three principles, the same as every Inclusee
   game:

     - the moment is clear: tap an answer, see what the answer was, move on;
     - being wrong is information, never a punishment - "Not quite. The answer
       is Canberra" carries on the same way as a right answer;
     - it saves as you go, and a resident who closes the page mid-quiz comes
       back to the question they were on.

   The questions come from a plain text file staff edit. Nothing here needs
   changing to publish a quiz.
   ========================================================================== */
(function (root) {
  'use strict';

  var SAVE_KEY = 'inclusee.quiz.save';

  var state = {
    loaded: null,
    puzzle: null,
    puzzleDate: '',
    index: 0,             // which question is on screen
    answered: [],         // { question, picked, correct } in the order played
    finished: false,
    prefs: { scale: 0, dark: false }
  };

  var el = {};

  function $(sel) { return document.querySelector(sel); }

  /* ------------------------------------------------------------- settings */

  function loadPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem('inclusee.prefs.v1') || '{}');
      if (typeof raw.scale === 'number') state.prefs.scale = raw.scale;
      if (typeof raw.dark === 'boolean') state.prefs.dark = raw.dark;
    } catch (err) { /* first visit */ }
  }

  function savePrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem('inclusee.prefs.v1') || '{}');
      raw.scale = state.prefs.scale;
      raw.dark = state.prefs.dark;
      localStorage.setItem('inclusee.prefs.v1', JSON.stringify(raw));
    } catch (err) { /* private browsing */ }
  }

  function applyPrefs() {
    var SCALES = [1, 1.15, 1.3, 1.5];
    document.documentElement.style.setProperty('--scale', String(SCALES[state.prefs.scale]));
    document.body.classList.toggle('dark', !!state.prefs.dark);
  }

  /* -------------------------------------------------------------- rendering */

  function buildQuestion() {
    var question = state.puzzle.questions[state.index];
    var answeredYet = state.answered.find(function (a) { return a.index === state.index; });

    el.question.innerHTML = '';
    el.question.appendChild(document.createTextNode(question.question));
    el.question.setAttribute('aria-label', (state.index + 1) + ' of ' + state.puzzle.questions.length + ': ' + question.question);

    el.choices.innerHTML = '';
    for (var i = 0; i < question.choices.length; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.dataset.index = String(i);
      var key = document.createElement('span');
      key.className = 'choice-key';
      key.textContent = String(i + 1);
      var text = document.createElement('span');
      text.className = 'choice-text';
      text.textContent = question.choices[i];
      button.appendChild(key);
      button.appendChild(text);
      if (answeredYet) {
        button.disabled = true;
        if (i === question.answer) button.classList.add('was-right');
        else if (answeredYet.picked === i) button.classList.add('was-picked');
      }
      el.choices.appendChild(button);
    }

    el.progress.textContent = 'Question ' + (state.index + 1) + ' of ' + state.puzzle.questions.length;
    if (el.progressFill) {
      el.progressFill.style.width = Math.round((state.answered.length / state.puzzle.questions.length) * 100) + '%';
    }
    el.next.hidden = true;
    el.feedback.hidden = true;
    el.feedback.className = '';
    el.firstChoice = el.choices.querySelector('.choice');
  }

  function answer(picked) {
    var question = state.puzzle.questions[state.index];
    var pickedText = question.choices[picked];
    var right = picked === question.answer;

    var buttons = el.choices.querySelectorAll('.choice');
    for (var b = 0; b < buttons.length; b++) buttons[b].disabled = true;

    for (var i = 0; i < buttons.length; i++) {
      var btnIndex = Number(buttons[i].dataset.index);
      if (btnIndex === question.answer) buttons[i].classList.add('was-right');
      if (btnIndex === picked && picked !== question.answer) buttons[i].classList.add('was-picked');
    }

    state.answered.push({
      index: state.index,
      question: question.question,
      picked: picked,
      correct: right
    });

    el.feedback.hidden = false;
    if (right) {
      var praise = state.answered.filter(function (a) { return !a.correct; }).length === 0
        ? ' Correct again.' : ' Well done.';
      el.feedback.className += 'right';
      el.feedback.textContent = 'The answer is ' + question.choices[question.answer] + '.' + praise;
      announce('' + 'Right. ' + el.feedback.textContent);
    } else {
      el.feedback.className += 'not-quite';
      el.feedback.textContent = 'Not quite. The answer is ' + question.choices[question.answer] + '.';
      announce('Not quite. ' + el.feedback.textContent);
    }
    el.next.hidden = false;
    el.next.textContent = state.index + 1 >= state.puzzle.questions.length
      ? 'See how you went'
      : 'Next question';
    el.next.focus();
    save();
  }

  function next() {
    if (state.index + 1 >= state.puzzle.questions.length) { finish(); return; }
    state.index++;
    buildQuestion();
    save();
    if (el.firstChoice) el.firstChoice.focus();
  }

  function progressSentence() {
    var right = state.answered.filter(function (a) { return a.correct; }).length;
    return right + ' of ' + state.puzzle.questions.length + ' correct';
  }

  /** The score is a thing a quiz owes you at the end, in the same warm tone the
   *  other games use for "all done". It is never shown while the quiz is running,
   *  when a resident cannot act on it. */
  function finish() {
    state.finished = true;
    save();
    IncluseeProfile.recordCompletion(panel ? panel.name() : '', state.puzzleDate);
    var summary = panel ? panel.refresh() : null;
    showEndPanel(summary);
  }

  function showEndPanel(summary) {
    var right = state.answered.filter(function (a) { return a.correct; }).length;
    var total = state.puzzle.questions.length;
    var who = (summary && summary.displayName) ? summary.displayName + ', you' : 'You';

    var headline = '';
    if (right === total) headline = 'Every answer right - a perfect quiz.';
    else if (right >= total / 2) headline = 'Most of them right.';
    else headline = 'The more you play, the more you remember.';

    el.endHead.textContent = headline;
    el.endMessage.textContent = who + ' answered ' + right + ' of ' + total +
      ' right. Well done for having a go.';
    el.endPanel.hidden = false;
    el.endPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    announce('Quiz finished. ' + headline + ' ' + el.endMessage.textContent);
  }

  /** "Play again" - the questions reshuffle, so the second go is a fresh quiz. */
  function again() {
    var seed = state.loaded.date + '#' + (state.answered.length + 1);
    state.puzzle = IncluseeQuiz.build(state.rawQuestions, { seed: seed, take: state.loaded.take });
    state.index = 0;
    state.answered = [];
    state.finished = false;
    el.endPanel.hidden = true;
    buildQuestion();
    save();
    announce('Same questions, new order.');
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
      localStorage.setItem(saveKey(), JSON.stringify(IncluseeSaveState.createRecord(state.puzzleDate, {
        index: state.index,
        answered: state.answered.filter(function (a) { return true; }),
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
    if (typeof read.details.index !== 'number') return false;

    state.index = read.details.index;
    state.answered = (read.details.answered || []).filter(function (a) {
      return a && typeof a.index === 'number';
    });
    state.finished = !!read.details.finished;
    return true;
  }

  /* ------------------------------------------------------------------- wire */

  function wire() {
    el.choices.addEventListener('click', function (ev) {
      var button = ev.target.closest('.choice');
      var puzzle = state.puzzle;
      if (!button) return;
      if (state.answered.find(function (a) { return a.index === state.index; })) {
        flashStatus('You have already answered this one. Use Next question.');
        return;
      }
      answer(Number(button.dataset.index));
    });

    el.next.addEventListener('click', next);

    document.addEventListener('keydown', function (ev) {
      // 1 to 5 answer the question on screen, like a quiz sheet on paper.
      var n = Number(ev.key);
      if (n >= 1 && n <= (state.puzzle ? state.puzzle.questions[state.index].choices.length : 0)) {
        var buttons = el.choices.querySelectorAll('.choice:not(:disabled)');
        if (buttons.length) { ev.preventDefault(); answer(Number(buttons[n - 1].dataset.index)); }
      }
    });

    el.bigger.addEventListener('click', function () {
      var SCALES = [1, 1.15, 1.3, 1.5];
      state.prefs.scale = (state.prefs.scale + 1) % SCALES.length;
      savePrefs();
      applyPrefs();
    });
    el.darkToggle.addEventListener('click', function () {
      state.prefs.dark = !state.prefs.dark;
      savePrefs();
      applyPrefs();
    });
    el.again.addEventListener('click', again);
    el.print.addEventListener('click', function () { window.print(); });
  }

  function flashStatus(text) {
    el.status.textContent = text;
    el.status.classList.add('show');
    clearTimeout(flashStatus.timer);
    flashStatus.timer = setTimeout(function () { el.status.classList.remove('show'); }, 7000);
  }

  /* ------------------------------------------------------------------- boot */
  var lastProblems = [];

  async function loadQuiz() {
    var config = root.INCLUSEE_CONFIG || {};
    var today = IncluseeDates.todayISO();
    var query = new URLSearchParams(window.location.search);

    var sources = sourceList(config, window.location.search, IncluseePuzzleLoader.makeUrlFor);

    for (var i = 0; i < sources.length; i++) {
      var found = await IncluseePuzzleLoader.loadPuzzleText({ urlFor: sources[i].urlFor, today: today });
      if (!found) continue;
      var parsed = IncluseeQuizList.parse(found.text);
      if (!parsed.questions.length) continue;

      var resolved = IncluseePuzzleLoader.resolveDate(found, parsed.meta, today);
      var quiz = IncluseeQuiz.build(parsed.questions, { seed: resolved.date, take: parsed.meta.take });
      if (!quiz.questions.length) continue;

      return {
        puzzle: quiz,
        rawQuestions: parsed.questions,
        problems: parsed.problems,
        meta: parsed.meta,
        date: resolved.date,
        dateMismatch: resolved.dateMismatch,
        source: found.source,
        usedShippedCopy: sources[i].kind === 'shipped',
        configuredSource: config.quizSource || null,
        isSample: !!found.fallback,
        daysOld: found.daysOld || 0,
        fetchProblems: [],
        take: parsed.meta.take,
        available: parsed.questions.length
      };
    }
    return null;
  }

  function sourceList(config, queryString, makeUrlFor) {
    var query = new URLSearchParams(queryString || '');
    var sources = [];
    if (query.get('source') || query.get('template')) {
      sources.push({ kind: 'query', urlFor: makeUrlFor(query.get('source'), query.get('template')) });
    }
    if (config.quizSource || config.quizTemplate) {
      sources.push({ kind: 'configured', urlFor: makeUrlFor(config.quizSource, config.quizTemplate) });
    }
    sources.push({ kind: 'shipped', urlFor: makeUrlFor('questions/', null) });
    return sources;
  }

  async function boot() {
    el.grid = null;
    el.question = $('#question');
    el.choices = $('#choices');
    el.feedback = $('#feedback');
    el.next = $('#next');
    el.progress = $('#progress');
    el.progressFill = $('#progress-fill');
    el.status = $('#status');
    el.live = $('#live');
    el.endPanel = $('#end-panel');
    el.endHead = $('#end-head');
    el.endMessage = $('#end-message');
    el.bigger = $('#bigger');
    el.darkToggle = $('#dark');
    el.again = $('#again');
    el.print = $('#print');
    el.staffNotes = $('#staff-notes');
    el.title = $('#puzzle-title');
    el.dateLine = $('#puzzle-date');
    el.loading = $('#loading');
    el.error = $('#error');
    el.game = $('#game');

    loadPrefs();
    applyPrefs();
    wire();

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
        if (!state.puzzle) return;
        // Each name keeps their own run of answers, so switching names gives
        // that person their own quiz, not a half-and-half mixture.
        restoreVisible(true);
      }
    });

    var loaded = await loadQuiz();
    el.loading.hidden = true;

    if (!loaded) {
      el.error.hidden = false;
      el.error.innerHTML = '<h2>Today\u2019s quiz isn\u2019t available just yet</h2>' +
        '<p>We could not fetch a question list. Please try again later, or ask a staff member to where the quiz files are kept.</p>';
      return;
    }

    lastProblems = loaded.problems;
    state.loaded = loaded;
    state.puzzleDate = loaded.date;
    state.puzzle = loaded.puzzle;
    state.rawQuestions = loaded.rawQuestions;

    if (el.game) el.game.hidden = false;
    buildQuestion();

    el.title.textContent = loaded.meta.title || 'Quiz';
    document.title = el.title.textContent + ' - Inclusee Games';
    el.dateLine.textContent = IncluseeDates.prettyDate(loaded.date) +
      (loaded.isSample ? ' (sample quiz)' : (loaded.daysOld ? ' (most recent quiz)' : ''));

    panel.init(loaded.date);
    if (restored) { buildQuestion(); }
    refreshProgress();

    var notes = [];
    for (var i = 0; i < loaded.problems.length; i++) {
      notes.push('Line ' + loaded.problems[i].line + ': ' + loaded.problems[i].why + '  \u2192  "' + loaded.problems[i].text + '"');
    }
    if (loaded.dateMismatch) {
      notes.push('This file is named ' + loaded.dateMismatch.file + ' but its #Date line says ' +
        loaded.dateMismatch.header + '. The file name is being used.');
    }
    if (loaded.usedShippedCopy) {
      notes.push('The staff quiz folder could not be read, so the copy that ships with the game is ' +
        'being shown instead. Check the folder name: HubSpot paths are case-sensitive. ' +
        'Configured: ' + loaded.configuredSource);
    }
    for (var f = 0; f < (loaded.fetchProblems || []).length; f++) {
      notes.push('Could not fetch ' + loaded.fetchProblems[f].path + ' \u2014 ' + loaded.fetchProblems[f].why);
    }

    if (staff) {
      el.staffNotes.hidden = false;
      el.staffNotes.innerHTML = '<h3>Staff notes (only visible with ?staff=1)</h3>' +
        '<p>Loaded from <code>' + loaded.source + '</code> \u00b7 seed <code>' + loaded.puzzle.stats.seed + '</code> \u00b7 ' +
        IncluseeQuizList.describeTake(loaded.meta, loaded.available) + ' \u00b7 ' +
        loaded.puzzle.questions.length + ' shown</p>' +
        (notes.length ? '<ul>' + notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>'
                      : '<p>No problems found in the question list.</p>');
    } else if (notes.length) {
      console.warn('Inclusee quiz: ' + notes.length + ' issue(s) in ' + loaded.source, notes);
    }

    announce(el.title.textContent + ' loaded. ' + state.puzzle.questions.length + ' questions.');
  }

  /** Showing whoever typed their name takes over mid-quiz. */
  function restoreVisible(letme) {
    if (!state.puzzle) return;
    state.index = 0;
    state.answered = [];
    state.finished = false;
    el.endPanel.hidden = true;
    restore();
    buildQuestion();
  }

  function refreshProgress() {
    if (!state.puzzle) return;
    var done = state.answered.length;
    el.progress.textContent = 'Question ' + Math.min(state.index + 1, state.puzzle.questions.length) +
      ' of ' + state.puzzle.questions.length;
    if (el.progressFill) el.progressFill.style.width = Math.round((done / state.puzzle.questions.length) * 100) + '%';
  }

  var panel = null;

  root.IncluseeQuizGame = {
    state: function () { return state; },
    answer: answer,
    next: next,
    again: again,
    sourceList: sourceList
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}(typeof self !== 'undefined' ? self : this));