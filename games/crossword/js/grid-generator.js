/* ============================================================================
   Inclusee Games — Crossword grid generator
   ----------------------------------------------------------------------------
   Takes a list of {clue, answer} pairs and builds a crossword grid, numbering
   and all. No dependencies, no network, no randomness we can't reproduce.

   Deterministic: the same words + the same seed always produce the same grid,
   so the "daily" puzzle looks identical for every resident and every reload.

   Runs in the browser (window.IncluseeCrosswordGenerator) and in Node
   (require('./grid-generator.js')) so tools/check-puzzle.mjs can simulate a
   puzzle before staff publish it.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeCrosswordGenerator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_WORD = 3;
  var MAX_WORD = 15;      // longer answers make unreadable, sprawling grids
  var MAX_SIZE = 25;      // hard ceiling on the working canvas

  /* ---------------------------------------------------------------- random */

  // xmur3 string hash -> mulberry32 PRNG. Small, fast, good enough, and
  // reproducible across browsers and Node (no Math.random anywhere).
  function stringHash(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function makeRng(seed) {
    var next = stringHash(String(seed));
    var a = next();
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Random-start deterministic shuffle (Fisher-Yates).
  function shuffle(list, rng) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /* ----------------------------------------------------------------- board */

  function Board(size) {
    this.size = size;
    this.cells = new Array(size * size).fill(null);
  }

  Board.prototype.get = function (r, c) {
    if (r < 0 || c < 0 || r >= this.size || c >= this.size) return undefined;
    return this.cells[r * this.size + c];
  };

  Board.prototype.letterCount = function () {
    var n = 0;
    for (var i = 0; i < this.cells.length; i++) if (this.cells[i]) n++;
    return n;
  };

  // Bounding box of the filled cells, or null when the board is empty.
  Board.prototype.bounds = function () {
    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (var r = 0; r < this.size; r++) {
      for (var c = 0; c < this.size; c++) {
        if (this.cells[r * this.size + c]) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }
    if (minR === Infinity) return null;
    return { minR: minR, maxR: maxR, minC: minC, maxC: maxC };
  };

  function delta(dir) {
    return dir === 'down' ? { dr: 1, dc: 0 } : { dr: 0, dc: 1 };
  }

  /* ------------------------------------------------------------ placement */

  /**
   * Can `word` sit at (r,c) going `dir`?
   * Returns the number of crossings (letters shared with existing words), or
   * -1 when the placement is illegal. Standard crossword neatness rules:
   *   - the cell before the first letter and after the last must be empty,
   *     so words never run into each other;
   *   - a newly filled cell may not sit beside another word (that would
   *     silently create a two-letter "word" nobody clued);
   *   - existing letters must match, and are counted as crossings.
   */
  function placementCrossings(board, word, r, c, dir) {
    var d = delta(dir), dr = d.dr, dc = d.dc, len = word.length, i;

    if (board.get(r - dr, c - dc)) return -1;
    if (board.get(r + dr * len, c + dc * len)) return -1;

    var crossings = 0;
    for (i = 0; i < len; i++) {
      var rr = r + dr * i, cc = c + dc * i;
      if (rr < 0 || cc < 0 || rr >= board.size || cc >= board.size) return -1;
      var cur = board.cells[rr * board.size + cc];
      if (cur === null) {
        if (dir === 'across') {
          if (board.get(rr - 1, cc) || board.get(rr + 1, cc)) return -1;
        } else {
          if (board.get(rr, cc - 1) || board.get(rr, cc + 1)) return -1;
        }
      } else if (cur === word[i]) {
        crossings++;
      } else {
        return -1;
      }
    }
    return crossings;
  }

  function writeWord(board, word, r, c, dir) {
    var d = delta(dir), dr = d.dr, dc = d.dc;
    var endR = r + dr * (word.length - 1), endC = c + dc * (word.length - 1);
    // Refuse rather than wrap: writing past a row's end would spill into the
    // next row and silently invent letters nobody clued.
    if (r < 0 || c < 0 || endR >= board.size || endC >= board.size) return false;
    for (var i = 0; i < word.length; i++) {
      board.cells[(r + dr * i) * board.size + (c + dc * i)] = word[i];
    }
    return true;
  }

  /** Every legal placement of `word` that crosses at least one existing word. */
  function findPlacements(board, word) {
    var out = [];
    for (var r = 0; r < board.size; r++) {
      for (var c = 0; c < board.size; c++) {
        var across = placementCrossings(board, word, r, c, 'across');
        if (across > 0) out.push({ r: r, c: c, dir: 'across', crossings: across });
        var down = placementCrossings(board, word, r, c, 'down');
        if (down > 0) out.push({ r: r, c: c, dir: 'down', crossings: down });
      }
    }
    return out;
  }

  /**
   * Two tiers, because a tidy crossword is what residents will actually read:
   *   1. many crossings (a well-woven grid),
   *   2. then near the middle and closer to square (compact, no long empty arms).
   */
  function scorePlacement(board, word, spot, rng) {
    var d = delta(spot.dir);
    var endR = spot.r + d.dr * (word.length - 1);
    var endC = spot.c + d.dc * (word.length - 1);
    var b = board.bounds() || { minR: 0, maxR: 0, minC: 0, maxC: 0 };
    var minR = Math.min(b.minR, spot.r), maxR = Math.max(b.maxR, endR);
    var minC = Math.min(b.minC, spot.c), maxC = Math.max(b.maxC, endC);
    var w = maxC - minC + 1, h = maxR - minR + 1;
    var centreR = (minR + maxR) / 2, centreC = (minC + maxC) / 2;
    var mid = (board.size - 1) / 2;
    var offCentre = Math.abs(centreR - mid) + Math.abs(centreC - mid);
    var oblong = Math.abs(w - h);

    return spot.crossings * 1000 - oblong * 12 - offCentre * 6 + rng() * 20;
  }

  function startSize(words) {
    var longest = 0, letters = 0;
    for (var i = 0; i < words.length; i++) {
      longest = Math.max(longest, words[i].answer.length);
      letters += words[i].answer.length;
    }
    // Roughly the area the words need, plus room for the weave, never smaller
    // than the longest word with a one-cell margin.
    var fromArea = Math.ceil(Math.sqrt(letters * 1.8)) + 2;
    return Math.min(MAX_SIZE, Math.max(longest + 3, fromArea, 9));
  }

  /** One full generation attempt: longest word first, then weave in the rest. */
  function attempt(words, size, rng) {
    var board = new Board(size);
    var queue = shuffle(words.slice(), rng).sort(function (a, b) {
      return b.answer.length - a.answer.length;
    });

    var first = queue.shift();
    var row = Math.floor(size / 2);
    var col = Math.max(0, Math.floor((size - first.answer.length) / 2));
    if (!writeWord(board, first.answer, row, col, 'across')) {
      // Only possible if the canvas somehow cannot hold the longest word;
      // start again from the top-left corner rather than give up.
      writeWord(board, first.answer, 0, 0, 'across');
    }
    var placed = [first];
    var pending = queue;

    // Keep sweeping until a pass places nothing new — words that can't be
    // woven in stay pending and are dealt with separately.
    var moved = true;
    while (pending.length && moved) {
      moved = false;
      var stillPending = [];
      for (var i = 0; i < pending.length; i++) {
        var item = pending[i];
        var spots = findPlacements(board, item.answer);
        if (!spots.length) { stillPending.push(item); continue; }
        // Score every option once (deterministic), then take one of the best
        // three so repeated puzzles don't all look alike.
        for (var s = 0; s < spots.length; s++) {
          spots[s].score = scorePlacement(board, item.answer, spots[s], rng);
        }
        spots.sort(function (a, b) { return b.score - a.score; });
        var pick = spots[Math.min(spots.length - 1, Math.floor(rng() * Math.min(3, spots.length)))];
        if (!writeWord(board, item.answer, pick.r, pick.c, pick.dir)) {
          stillPending.push(item);
          continue;
        }
        placed.push(item);
        moved = true;
      }
      pending = stillPending;
    }

    return { board: board, placed: placed, pending: pending, size: size };
  }

  function attemptScore(res) {
    var b = res.board.bounds();
    var w = b ? b.maxC - b.minC + 1 : 0;
    var h = b ? b.maxR - b.minR + 1 : 0;
    return res.placed.length * 10000 - Math.abs(w - h) * 20 - (w * h) * 0.5;
  }

  /**
   * Last resort for a word that could not be woven in: park it on its own with
   * a one-cell moat. A disconnected corner still reads fine and, crucially,
   * every clue staff wrote is still in the puzzle. Grows the canvas if needed.
   */
  function parkWord(board, word) {
    for (var grow = 0; grow <= 3; grow++) {
      var size = board.size + grow * (word.length + 2);
      if (grow > 0) {
        if (size > MAX_SIZE + word.length + 2) break;
        growBoard(board, size);
      }
      var spot = findParkSpot(board, word);
      if (spot && writeWord(board, word, spot.r, spot.c, spot.dir)) return true;
    }
    return false;
  }

  function growBoard(board, newSize) {
    var old = board.cells, oldSize = board.size;
    var cells = new Array(newSize * newSize).fill(null);
    for (var r = 0; r < oldSize; r++) {
      for (var c = 0; c < oldSize; c++) {
        cells[r * newSize + c] = old[r * oldSize + c];
      }
    }
    board.size = newSize;
    board.cells = cells;
  }

  /** The first spot with a full one-cell moat. Rows/columns are searched from
   *  the top-left with a one-cell margin, so a parked word can never be
   *  written half-off the canvas — that wraps into the next row and corrupts
   *  the grid with letters nobody clued. */
  function findParkSpot(board, word) {
    var dir = 'across';
    var lastRow = board.size - 2;
    var lastCol = board.size - word.length - 1;
    for (var r = 1; r <= lastRow; r++) {
      for (var c = 1; c <= lastCol; c++) {
        if (hasMoat(board, word, r, c, dir)) return { r: r, c: c, dir: dir };
      }
    }
    return null;
  }

  /** A parked word needs one empty cell all round it, plus empty ends. */
  function hasMoat(board, word, r, c, dir) {
    var d = delta(dir);
    var dr = d.dr, dc = d.dc;
    for (var i = -1; i <= word.length; i++) {
      var rr = r + dr * i, cc = c + dc * i;
      for (var s = -1; s <= 1; s++) {
        var nr = rr + (dir === 'across' ? s : 0);
        var nc = cc + (dir === 'across' ? 0 : s);
        if (nr < 0 || nc < 0 || nr >= board.size || nc >= board.size) continue;
        if (board.cells[nr * board.size + nc]) return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------ trim + numbering */

  /**
   * Crop the working canvas down to the words, plus nothing else. A crossword
   * is usually wider than it is tall, so the cropped grid is rectangular and
   * carries its own row/column counts rather than reusing the square canvas.
   */
  function trim(board) {
    var b = board.bounds();
    var rows = b.maxR - b.minR + 1;
    var cols = b.maxC - b.minC + 1;
    var cells = new Array(rows * cols).fill(null);
    for (var r = b.minR; r <= b.maxR; r++) {
      for (var c = b.minC; c <= b.maxC; c++) {
        cells[(r - b.minR) * cols + (c - b.minC)] = board.get(r, c) || null;
      }
    }
    return {
      rows: rows,
      cols: cols,
      cells: cells,
      at: function (r, c) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) return undefined;
        return cells[r * cols + c];
      }
    };
  }

  var ACROSS = 'across', DOWN = 'down';

  /** Standard crossword numbering: left-to-right, top-to-bottom, one pass. */
  function numberGrid(grid) {
    var numbers = new Array(grid.rows * grid.cols).fill(null);
    var entries = [];
    var next = 1;

    function isLetter(r, c) { return !!grid.at(r, c); }

    for (var r = 0; r < grid.rows; r++) {
      for (var c = 0; c < grid.cols; c++) {
        if (!isLetter(r, c)) continue;
        var startsAcross = !isLetter(r, c - 1) && isLetter(r, c + 1);
        var startsDown = !isLetter(r - 1, c) && isLetter(r + 1, c);
        if (!startsAcross && !startsDown) continue;

        numbers[r * grid.cols + c] = next;
        if (startsAcross) entries.push(makeEntry(grid, r, c, ACROSS, next));
        if (startsDown) entries.push(makeEntry(grid, r, c, DOWN, next));
        next++;
      }
    }
    return { numbers: numbers, entries: entries, cellCount: next - 1 };
  }

  function makeEntry(grid, r, c, dir, number) {
    var d = delta(dir), dr = d.dr, dc = d.dc;
    var cells = [], answer = '';
    var i = 0;
    while (true) {
      var rr = r + dr * i, cc = c + dc * i;
      var ch = grid.at(rr, cc);
      if (!ch) break;
      cells.push([rr, cc]);
      answer += ch;
      i++;
    }
    return { number: number, direction: dir, row: r, col: c, cells: cells, answer: answer };
  }

  /* ------------------------------------------------------------------ API */

  /**
   * generate(words, options) -> puzzle
   *
   * words   : [{ clue: 'The room where you cook meals', answer: 'KITCHEN' }]
   * options : { seed: '2026-09-25', attempts: 80 }
   *
   * puzzle  : { rows, cols, grid[][], numbers[][], entries[], unplaced[], stats }
   *           grid     — letter per cell, or null for a blocked cell
   *           numbers  — clue number per cell, or null
   *           entries  — one per across/down answer, cells in reading order
   *           unplaced — clues we could not fit (the game reports these to
   *                      staff, never to the resident)
   */
  function generate(words, options) {
    options = options || {};
    var seed = options.seed || 'inclusee';
    var attemptsWanted = options.attempts || 80;

    // Normalise + validate. Duplicates by answer are dropped (the same word
    // twice would clash horribly in the grid).
    var cleaned = [], seen = {}, rejected = [];
    for (var i = 0; i < words.length; i++) {
      var clue = String(words[i].clue || '').trim();
      var answer = String(words[i].answer || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!clue || !answer) { rejected.push({ clue: clue, answer: answer, why: 'missing clue or answer' }); continue; }
      if (answer.length < MIN_WORD) { rejected.push({ clue: clue, answer: answer, why: 'answer is shorter than ' + MIN_WORD + ' letters' }); continue; }
      if (answer.length > MAX_WORD) { rejected.push({ clue: clue, answer: answer, why: 'answer is longer than ' + MAX_WORD + ' letters' }); continue; }
      if (seen[answer]) { rejected.push({ clue: clue, answer: answer, why: 'the same answer already appears in this puzzle' }); continue; }
      seen[answer] = true;
      cleaned.push({ clue: clue, answer: answer });
    }
    if (!cleaned.length) {
      throw new Error('No usable clues: every line needs a clue and an answer of ' + MIN_WORD + '-' + MAX_WORD + ' letters.');
    }

    var size = startSize(cleaned);
    var best = null;
    for (var a = 0; a < attemptsWanted; a++) {
      var rng = makeRng(seed + '#' + a);
      var res = attempt(cleaned, size, rng);
      if (res.pending.length === 0) { best = res; break; }        // perfect weave
      if (!best || attemptScore(res) > attemptScore(best)) best = res;
    }

    // Park anything the weave could not absorb, so no clue is ever lost.
    var unplaced = [];
    for (var p = 0; p < best.pending.length; p++) {
      var item = best.pending[p];
      if (!parkWord(best.board, item.answer)) unplaced.push(item);
    }

    var trimmed = trim(best.board);
    var numbered = numberGrid(trimmed);

    // Attach the clue text.
    var byAnswer = {};
    for (var k = 0; k < cleaned.length; k++) byAnswer[cleaned[k].answer] = cleaned[k].clue;
    var entries = numbered.entries.map(function (e) {
      return {
        number: e.number,
        direction: e.direction,
        row: e.row,
        col: e.col,
        cells: e.cells,
        answer: e.answer,
        clue: byAnswer[e.answer] || ''
      };
    });

    var grid = [], numbers = [];
    for (var r2 = 0; r2 < trimmed.rows; r2++) {
      var gridRow = [], numRow = [];
      for (var c2 = 0; c2 < trimmed.cols; c2++) {
        gridRow.push(trimmed.at(r2, c2) || null);
        numRow.push(numbered.numbers[r2 * trimmed.cols + c2]);
      }
      grid.push(gridRow);
      numbers.push(numRow);
    }

    return {
      rows: trimmed.rows,
      cols: trimmed.cols,
      grid: grid,
      numbers: numbers,
      entries: entries,
      unplaced: unplaced,
      rejected: rejected,
      stats: {
        requested: words.length,
        placed: entries.length,
        seed: seed,
        words: cleaned.map(function (w) { return w.answer; })
      }
    };
  }

  return {
    generate: generate,
    makeRng: makeRng,
    minWordLength: MIN_WORD,
    maxWordLength: MAX_WORD
  };
}));
