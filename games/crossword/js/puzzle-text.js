/* ============================================================================
   Inclusee Games — puzzle text reader
   ----------------------------------------------------------------------------
   Reads the plain-text clue files that staff edit. One clue per line:

       The room where you cook meals = KITCHEN

   Deliberately forgiving, because the person editing this file is a support
   worker with Notepad open, not a programmer:

     - '=', ':', '-' or a tab can separate the clue from the answer
     - the answer may be typed in any case, with spaces or hyphens
     - blank lines are skipped, and so is anything starting with '#'
     - two optional instructions at the top of the file set the title/date:
           #Title: Around the House
           #Date: 2026-09-25
     - anything the reader can't use is reported in `problems`, never thrown,
       so the game can still play the clues that are fine and quietly warn
       staff about the rest.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseePuzzleText = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_WORD = 3;
  var MAX_WORD = 15;
  var SEPARATOR = /\s*(?:=>|=|:|\t|\s-\s)\s*/;   // first match wins

  function cleanAnswer(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  function readDirective(line) {
    var m = line.match(/^#\s*(title|date|by|clues?)\s*[:=]\s*(.+)$/i);
    if (!m) return null;
    var key = m[1].toLowerCase();
    if (key === 'clues' || key === 'clue') key = 'title'; // forgiving
    return { key: key, value: m[2].trim() };
  }

  /**
   * parse(text) -> {
   *   clues:    [{ clue, answer, line }],
   *   problems: [{ line, why, text }],
   *   meta:     { title, date }
   * }
   */
  function parse(text) {
    var clues = [], problems = [], meta = {};
    var seen = {};
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');

    for (var i = 0; i < lines.length; i++) {
      var lineNumber = i + 1;
      var line = lines[i].trim();
      if (!line) continue;

      if (line.charAt(0) === '#') {
        var directive = readDirective(line);
        if (directive) meta[directive.key] = directive.value;
        continue;
      }

      var parts = line.split(SEPARATOR);
      if (parts.length < 2) {
        problems.push({ line: lineNumber, text: line, why: 'no "=" between the clue and the answer' });
        continue;
      }

      var clue = parts[0].trim().replace(/\s*[.,;]$/, '');
      var answer = cleanAnswer(parts.slice(1).join(''));

      if (!clue) {
        problems.push({ line: lineNumber, text: line, why: 'the clue is empty' });
        continue;
      }
      if (!answer) {
        problems.push({ line: lineNumber, text: line, why: 'the answer has no letters in it' });
        continue;
      }
      if (answer.length < MIN_WORD) {
        problems.push({ line: lineNumber, text: line, why: 'the answer "' + answer + '" is shorter than ' + MIN_WORD + ' letters' });
        continue;
      }
      if (answer.length > MAX_WORD) {
        problems.push({ line: lineNumber, text: line, why: 'the answer "' + answer + '" is longer than ' + MAX_WORD + ' letters' });
        continue;
      }
      if (seen[answer]) {
        problems.push({ line: lineNumber, text: line, why: 'the answer "' + answer + '" is already used on line ' + seen[answer] });
        continue;
      }
      seen[answer] = lineNumber;
      clues.push({ clue: clue, answer: answer, line: lineNumber });
    }

    return { clues: clues, problems: problems, meta: meta };
  }

  // Dates live in the shared module, because the word search needs them too.
  function dates() {
    if (typeof IncluseeDates !== 'undefined') return IncluseeDates;
    if (typeof require === 'function') return require('../../shared/dates.js');
    throw new Error('The date helper must be loaded first.');
  }

  return {
    parse: parse,
    cleanAnswer: cleanAnswer,
    prettyDate: function (iso) { return dates().prettyDate(iso); },
    todayISO: function (now) { return dates().todayISO(now); },
    shiftISO: function (iso, days) { return dates().shiftISO(iso, days); },
    minWordLength: MIN_WORD,
    maxWordLength: MAX_WORD
  };
}));
