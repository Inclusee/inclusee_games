/* ============================================================================
   Inclusee Games — saved progress
   ----------------------------------------------------------------------------
   Owns the whole shape of a saved game: what goes into browser storage, and
   what comes back out. The game only ever calls createSave() and readSave(),
   so the writer and the reader cannot drift apart — which is exactly what
   happened when the writer used one key name and the reader another, and every
   resident's puzzle came back empty.

   Rows are stored as arrays of single characters. Joining a row into a string
   would drop its trailing blanks (Array.join trims them), so the grid used to
   come back with letters missing off the right-hand side.

   Kept separate from the game so it can be tested without a browser, and so the
   other games can reuse the same approach.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeSaveState = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 2;
  var BLANK = ' ';
  var KEYS = ['revealed', 'finished', 'source'];

  function isArray(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  }

  /** An empty grid of the right shape, as letters and ''. */
  function blank(rowCount, colCount) {
    var letters = [];
    for (var r = 0; r < rowCount; r++) {
      var row = [];
      for (var c = 0; c < colCount; c++) row.push('');
      letters.push(row);
    }
    return letters;
  }

  /**
   * createSave(date, letters, details) -> the object to hand to JSON.stringify.
   * `details` carries anything extra the game wants to remember (hints used,
   * whether the puzzle was finished, where the puzzle came from).
   */
  function createSave(date, letters, details) {
    var save = {
      version: VERSION,
      date: String(date || ''),
      rows: letters.map(function (row) {
        return row.map(function (ch) { return ch || BLANK; }).join('');
      })
    };
    details = details || {};
    for (var i = 0; i < KEYS.length; i++) {
      if (details[KEYS[i]] !== undefined) save[KEYS[i]] = details[KEYS[i]];
    }
    return save;
  }

  /**
   * readSave(saved, date, rowCount, colCount) ->
   *   { accepted, letters, revealed, finished, source }
   *
   * `accepted` is false for anything that isn't a save from this game version
   * for this puzzle: a different day's puzzle, an older lossy format, or junk.
   * A rejected save yields a clean grid rather than a half-restored one, which
   * would look complete while quietly missing letters.
   */
  function readSave(saved, date, rowCount, colCount) {
    var result = { accepted: false, letters: blank(rowCount, colCount), revealed: 0, finished: false, source: null };
    if (!saved || saved.version !== VERSION || !isArray(saved.rows) || saved.date !== String(date || '')) {
      return result;
    }

    result.accepted = true;
    for (var r = 0; r < rowCount && r < saved.rows.length; r++) {
      var row = saved.rows[r];
      if (typeof row !== 'string') continue;
      for (var c = 0; c < colCount && c < row.length; c++) {
        var ch = row.charAt(c).toUpperCase();
        if (/^[A-Z]$/.test(ch)) result.letters[r][c] = ch;
      }
    }
    result.revealed = typeof saved.revealed === 'number' ? saved.revealed : 0;
    result.finished = !!saved.finished;
    result.source = saved.source || null;
    return result;
  }

  /**
   * createRecord(date, details) / readRecord(saved, date)
   *
   * The same idea as a save, for games that do not store a grid of letters - the
   * word search stores which words have been found. Sharing the version and date
   * gate means one place decides what "this save belongs to this puzzle" means.
   */
  function createRecord(date, details) {
    var record = { version: VERSION, date: String(date || '') };
    details = details || {};
    for (var key in details) {
      if (Object.prototype.hasOwnProperty.call(details, key)) record[key] = details[key];
    }
    return record;
  }

  function readRecord(saved, date) {
    if (!saved || saved.version !== VERSION || saved.date !== String(date || '')) {
      return { accepted: false };
    }
    return { accepted: true, details: saved };
  }

  return {
    createSave: createSave,
    readSave: readSave,
    createRecord: createRecord,
    readRecord: readRecord,
    blank: blank,
    version: VERSION,
    blankCharacter: BLANK
  };
}));