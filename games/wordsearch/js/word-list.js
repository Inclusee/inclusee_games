/* ============================================================================
   Inclusee Games - word search word list
   ----------------------------------------------------------------------------
   Reads the plain-text file staff edit. The whole file is a title and a list of
   words - there is no grid to draw, because the game works the grid out:

       #Title: In the Garden
       #Date: 2026-10-03
       #Directions: easy

       ROSEMARY
       MULCH
       TROWEL

   Deliberately forgiving, because the person editing this is a support worker
   with Notepad open, not a programmer:

     - blank lines and anything starting with '#' are skipped
     - the word is tidied up: any case, spaces and hyphens removed, so
       "tea pot", "TEA-POT" and "TeaPot" are all TEAPOT
     - a line that looks like it came from the crossword clue file is reported
       with a plain-English explanation rather than silently becoming a
       forty-letter "word"
     - anything unusable is listed in `problems` and never thrown, so the game
       still plays the words that are fine
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeWordList = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_WORD = 3;
  var MAX_WORD = 12;          // longer answers cannot be read at a glance
  var DIRECTIONS = ['easy', 'normal', 'all'];
  var DEFAULT_DIRECTIONS = 'easy';

  function cleanWord(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  function readDirective(line) {
    var m = line.match(/^#\s*([a-z]+)\s*[:=]\s*(.+)$/i);
    if (!m) return null;
    var key = m[1].toLowerCase();
    if (key === 'words' || key === 'title' || key === 'name') key = 'title';
    return { key: key, value: m[2].trim() };
  }

  /**
   * parse(text) -> {
   *   words:      [{ word, line }],
   *   problems:   [{ line, why, text }],
   *   meta:       { title, date, directions }
   * }
   */
  function parse(text) {
    var words = [], problems = [], meta = {};
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

      // A crossword-style line ("clue = ANSWER") is the mistake staff are most
      // likely to make, having just edited the crossword. Say so plainly.
      if (line.indexOf('=') !== -1) {
        var afterEquals = cleanWord(line.split('=')[1] || '');
        if (afterEquals.length >= MIN_WORD && afterEquals.length <= MAX_WORD) {
          problems.push({
            line: lineNumber, text: line,
            why: 'this looks like a crossword line (clue = ANSWER). For a word search, list just the word, so write "' + afterEquals + '" on its own'
          });
          continue;
        }
      }

      var word = cleanWord(line);
      if (!word) {
        problems.push({ line: lineNumber, text: line, why: 'there are no letters in this line' });
        continue;
      }
      if (word.length < MIN_WORD) {
        problems.push({ line: lineNumber, text: line, why: '"' + word + '" is shorter than ' + MIN_WORD + ' letters' });
        continue;
      }
      if (word.length > MAX_WORD) {
        problems.push({
          line: lineNumber, text: line,
          why: 'the word "' + word + '" is ' + word.length + ' letters long, and the longest word we can fit is ' + MAX_WORD
        });
        continue;
      }
      if (seen[word]) {
        problems.push({ line: lineNumber, text: line, why: '"' + word + '" is already in the list on line ' + seen[word] });
        continue;
      }
      seen[word] = lineNumber;
      words.push({ word: word, line: lineNumber });
    }

    meta.directions = DIRECTIONS.indexOf(String(meta.directions || '').toLowerCase()) === -1
      ? DEFAULT_DIRECTIONS
      : String(meta.directions).toLowerCase();

    return { words: words, problems: problems, meta: meta };
  }

  /** How the words may be hidden, in plain words for the staff view. */
  function describeDirections(name) {
    if (name === 'all') return 'across, down, diagonally and backwards';
    if (name === 'normal') return 'across, down and diagonally';
    return 'across and down only (easiest)';
  }

  return {
    parse: parse,
    cleanWord: cleanWord,
    describeDirections: describeDirections,
    directions: DIRECTIONS,
    defaultDirections: DEFAULT_DIRECTIONS,
    minWordLength: MIN_WORD,
    maxWordLength: MAX_WORD
  };
}));