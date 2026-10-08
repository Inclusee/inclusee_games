/* ============================================================================
   Inclusee Games - word search grid maker
   ----------------------------------------------------------------------------
   Turns a list of words into a letter grid with the words hidden in it. Staff
   never draw a grid and never say where a word goes.

   Designed for people who find searching hard:

     - words are placed with as FEW crossings as possible, because letters
       stacked on top of each other are what makes a grid look like a wall of
       noise rather than a puzzle;
     - the direction set is chosen by the staff file, and the default is the
       easiest one (across and down, no diagonals, nothing backwards);
     - the same file always produces the same grid, so a resident who reloads
       the page finds the word where they left it.

   Runs in the browser and in Node, so the checker can preview a grid before it
   is published.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeWordSearch = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [row step, column step]
  var DIRECTION_SETS = {
    easy: [[0, 1], [1, 0]],                                            // across, down
    normal: [[0, 1], [1, 0], [1, 1], [1, -1]],                          // + diagonals
    all: [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]]
  };

  var MIN_SIZE = 8;
  var MAX_SIZE = 16;          // bigger than this and the letters get too small
  var FILLER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function sharedRandom() {
    if (typeof IncluseeSeededRandom !== 'undefined') return IncluseeSeededRandom;
    if (typeof require === 'function') return require('../../shared/seeded-random.js');
    throw new Error('The random number helper must be loaded first.');
  }

  var rngTools = sharedRandom();

  function emptyGrid(size) {
    var grid = [];
    for (var r = 0; r < size; r++) {
      var row = [];
      for (var c = 0; c < size; c++) row.push(null);
      grid.push(row);
    }
    return grid;
  }

  function fits(grid, word, row, col, dr, dc) {
    var size = grid.length;
    for (var i = 0; i < word.length; i++) {
      var r = row + dr * i, c = col + dc * i;
      if (r < 0 || c < 0 || r >= size || c >= size) return -1;
      var existing = grid[r][c];
      if (existing !== null && existing !== word[i]) return -1;
    }
    return 0;
  }

  /** How many letters this placement would share with what is already there. */
  function crossings(grid, word, row, col, dr, dc) {
    var n = 0;
    for (var i = 0; i < word.length; i++) {
      if (grid[row + dr * i][col + dc * i] !== null) n++;
    }
    return n;
  }

  function startSize(words) {
    var longest = 0, letters = 0;
    for (var i = 0; i < words.length; i++) {
      longest = Math.max(longest, words[i].word.length);
      letters += words[i].word.length;
    }
    // Deliberately tight. The grid is as small as the words allow, because a
    // smaller grid means bigger letters, and letter size is the thing that
    // decides whether someone with poor vision can read the puzzle at all.
    // Measured: ten words in a 10x10 grid still need no overlapping letters, so
    // there is nothing to gain from spreading them out over a larger one.
    var fromArea = Math.ceil(Math.sqrt(letters * 1.4)) + 1;
    return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.max(longest, fromArea)));
  }

  /**
   * One attempt at a given grid size: longest word first, then each word goes
   * wherever it touches the fewest existing letters.
   */
  /** Which way a placement runs, for keeping the mix balanced. */
  function axisOf(dr, dc) {
    if (dr === 0) return 'across';
    if (dc === 0) return 'down';
    return 'diagonal';
  }

  function attempt(words, size, directions, rng) {
    var grid = emptyGrid(size);
    var placements = [];
    var usedAxes = { across: 0, down: 0, diagonal: 0 };
    var queue = rngTools.shuffle(words.slice(), rng).sort(function (a, b) {
      return b.word.length - a.word.length;
    });

    for (var i = 0; i < queue.length; i++) {
      var entry = queue[i];
      var options = [];

      for (var d = 0; d < directions.length; d++) {
        var dr = directions[d][0], dc = directions[d][1];
        for (var row = 0; row < size; row++) {
          for (var col = 0; col < size; col++) {
            if (fits(grid, entry.word, row, col, dr, dc) === -1) continue;
            options.push({
              row: row, col: col, dr: dr, dc: dc,
              crossings: crossings(grid, entry.word, row, col, dr, dc)
            });
          }
        }
      }

      if (!options.length) return { ok: false, grid: grid, placements: placements };

      // Two things, in order:
      //   1. the fewest shared letters, because crossings are what turn a grid
      //      into a wall of noise;
      //   2. whichever direction has been used least so far. Without this the
      //      generator happily hides twelve words all running downwards, which
      //      is far harder to scan across than a mixed grid.
      for (var s2 = 0; s2 < options.length; s2++) {
        options[s2].score = options[s2].crossings * 100 + usedAxes[axisOf(options[s2].dr, options[s2].dc)];
      }
      var lowest = options[0].score;
      for (var o = 1; o < options.length; o++) {
        if (options[o].score < lowest) lowest = options[o].score;
      }
      var clean = options.filter(function (option) { return option.score === lowest; });
      var chosen = clean[rngTools.intBelow(rng, clean.length)];
      usedAxes[axisOf(chosen.dr, chosen.dc)]++;

      for (var k = 0; k < entry.word.length; k++) {
        grid[chosen.row + chosen.dr * k][chosen.col + chosen.dc * k] = entry.word[k];
      }
      placements.push({
        word: entry.word,
        row: chosen.row,
        col: chosen.col,
        dr: chosen.dr,
        dc: chosen.dc,
        direction: describeDirection(chosen.dr, chosen.dc),
        cells: cellsOf(entry.word, chosen.row, chosen.col, chosen.dr, chosen.dc)
      });
    }

    return { ok: true, grid: grid, placements: placements };
  }

  function cellsOf(word, row, col, dr, dc) {
    var cells = [];
    for (var i = 0; i < word.length; i++) cells.push([row + dr * i, col + dc * i]);
    return cells;
  }

  function describeDirection(dr, dc) {
    if (dr === 0 && dc === 1) return 'across';
    if (dr === 0 && dc === -1) return 'across (backwards)';
    if (dr === 1 && dc === 0) return 'down';
    if (dr === -1 && dc === 0) return 'up';
    if (dr === 1 && dc === 1) return 'diagonal down-right';
    if (dr === 1 && dc === -1) return 'diagonal down-left';
    if (dr === -1 && dc === 1) return 'diagonal up-right';
    return 'diagonal up-left';
  }

  function totalCrossings(placements) {
    var letters = 0, span = 0;
    for (var i = 0; i < placements.length; i++) {
      letters += placements[i].word.length;
      span += placements[i].word.length;
    }
    var cells = {};
    for (var p = 0; p < placements.length; p++) {
      for (var c = 0; c < placements[p].cells.length; c++) {
        cells[placements[p].cells[c].join(',')] = true;
      }
    }
    var unique = Object.keys(cells).length;
    return { letters: letters, unique: unique, crossings: letters - unique };
  }

  /**
   * build(words, options) -> {
   *   rows, cols, grid[][], placements[], unplaced[], stats
   * }
   *
   * words   : ['ROSEMARY', ...] or [{ word: 'ROSEMARY' }, ...]
   * options : { seed, directions: 'easy' | 'normal' | 'all', attempts }
   */
  function build(words, options) {
    options = options || {};
    var seed = options.seed || 'inclusee';
    var wanted = DIRECTION_SETS[options.directions] || DIRECTION_SETS.easy;

    var cleaned = [], seen = {}, rejected = [];
    for (var i = 0; i < words.length; i++) {
      var raw = typeof words[i] === 'string' ? words[i] : (words[i] && words[i].word);
      var word = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!word || word.length < 3 || word.length > 12) { rejected.push(String(raw || '')); continue; }
      if (seen[word]) { rejected.push(word); continue; }
      seen[word] = true;
      cleaned.push({ word: word });
    }
    if (!cleaned.length) {
      throw new Error('No usable words: each line needs one word of 3 to 12 letters.');
    }

    var size = startSize(cleaned);
    var best = null;

    while (size <= MAX_SIZE) {
      for (var a = 0; a < (options.attempts || 40); a++) {
        var attemptResult = attempt(cleaned, size, wanted, rngTools.makeRng(seed + '#' + size + '#' + a));
        if (!attemptResult.ok) continue;
        var spread = totalCrossings(attemptResult.placements);
        var score = -spread.crossings * 10 - size;      // fewest crossings, then smallest grid
        if (!best || score > best.score) {
          best = { size: size, result: attemptResult, score: score, spread: spread };
        }
      }
      if (best) break;              // found a size that fits every word
      size++;                       // otherwise try a slightly bigger one
    }

    if (!best) {
      // Cannot happen with sensible word lists, but never leave the page blank.
      throw new Error('These words will not fit in a grid. Try fewer words, or shorter ones.');
    }

    // Fill the gaps with letters. Seeded, so the filler is stable too.
    var fillerRng = rngTools.makeRng(seed + '#filler');
    var grid = best.result.grid;
    for (var r = 0; r < best.size; r++) {
      for (var c = 0; c < best.size; c++) {
        if (grid[r][c] === null) {
          grid[r][c] = FILLER[rngTools.intBelow(fillerRng, FILLER.length)];
        }
      }
    }

    var placed = {};
    for (var p = 0; p < best.result.placements.length; p++) placed[best.result.placements[p].word] = true;
    var unplaced = [];
    for (var w = 0; w < cleaned.length; w++) {
      if (!placed[cleaned[w].word]) unplaced.push({ word: cleaned[w].word });
    }

    return {
      rows: best.size,
      cols: best.size,
      grid: grid,
      placements: best.result.placements,
      unplaced: unplaced,
      rejected: rejected,
      stats: {
        words: cleaned.length,
        placed: best.result.placements.length,
        directionMix: best.result.placements.reduce(function (acc, p) {
          var axis = axisOf(p.dr, p.dc);
          acc[axis] = (acc[axis] || 0) + 1;
          return acc;
        }, {}),
        crossings: best.spread.crossings,
        direction: options.directions || 'easy',
        seed: seed
      }
    };
  }

  return {
    build: build,
    directionSets: DIRECTION_SETS,
    describeDirection: describeDirection,
    minSize: MIN_SIZE,
    maxSize: MAX_SIZE
  };
}));