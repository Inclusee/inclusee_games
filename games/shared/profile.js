/* ============================================================================
   Inclusee Games - who is playing, and how many days in a row
   ----------------------------------------------------------------------------
   A name box and a streak counter, both kept in the browser. There is no
   account, no sign-in and nothing sent anywhere: the name never leaves the
   device, it just lets someone be greeted by name and keep their own run going.

   Shared by every game. Names are matched case-insensitively, so "Margaret" and
   "margaret" are the same person, which is what a resident would expect.

   Kept separate from the games so the streak maths can be tested without a
   browser: currentStreak() and bestStreak() are pure functions of a list of
   dates.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeProfile = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WHO_KEY = 'inclusee.who';
  var USER_PREFIX = 'inclusee.user.';
  var MAX_NAME = 24;
  var DAY = 86400000;

  /* ------------------------------------------------------------ date helpers */

  function isoToDayNumber(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return Math.floor(d / DAY);
  }

  function dayNumberToISO(n) {
    var d = new Date(n * DAY);
    var pad = function (v) { return (v < 10 ? '0' : '') + v; };
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  /** Any list of dates -> unique, valid, oldest first. */
  function normaliseDates(dates) {
    var seen = {}, out = [];
    var list = dates || [];
    for (var i = 0; i < list.length; i++) {
      var iso = String(list[i] || '').trim();
      if (seen[iso] || isoToDayNumber(iso) === null) continue;
      seen[iso] = true;
      out.push(iso);
    }
    out.sort();
    return out;
  }

  /* --------------------------------------------------------------- streak maths */

  /**
   * How many days in a row, counting back from today.
   *
   * Today not being done yet does NOT break the run — a resident part-way
   * through today should still see the streak they have built. The run only
   * ends once a whole day has gone by with nothing finished.
   */
  function currentStreak(dates, today) {
    var list = normaliseDates(dates);
    var has = {};
    for (var i = 0; i < list.length; i++) has[list[i]] = true;

    var t = isoToDayNumber(today);
    if (t === null) return 0;

    var start;
    if (has[dayNumberToISO(t)]) start = t;
    else if (has[dayNumberToISO(t - 1)]) start = t - 1;
    else return 0;

    var count = 0;
    for (var d = start; has[dayNumberToISO(d)]; d--) count++;
    return count;
  }

  /** The longest run of consecutive days ever finished. */
  function bestStreak(dates) {
    var list = normaliseDates(dates);
    var best = 0, run = 0, previous = null;
    for (var i = 0; i < list.length; i++) {
      var day = isoToDayNumber(list[i]);
      run = (previous !== null && day === previous + 1) ? run + 1 : 1;
      if (run > best) best = run;
      previous = day;
    }
    return best;
  }

  /**
   * A sentence to show under the name box. Never scolds anyone for missing a
   * day: a broken run is simply reported as a fresh start.
   */
  function describeStreak(current, best, finishedToday) {
    if (current === 0) {
      // "puzzle", not "crossword": this module is shared with the word search.
      return finishedToday
        ? 'That is your first day. Come back tomorrow to start a run.'
        : 'Finish today\u2019s puzzle to start a run of days.';
    }
    var run = current === 1 ? '1 day in a row' : current + ' days in a row';
    if (finishedToday) {
      var praise = current >= 7 ? 'That is a whole week - well done!' :
                   current >= 3 ? 'Well done!' : 'Nicely done.';
      return run + '. ' + praise + (best > current ? ' Your best is ' + best + ' days.' : '');
    }
    var keep = current >= 2 ? ' of ' + current + ' days' : '';
    return 'Finish today\u2019s puzzle to keep your run' + keep + ' going. Your best is ' +
      Math.max(best, current) + ' days.';
  }

  /* ------------------------------------------------------------------- names */

  /** A safe, lower-case form of a name for use in a storage key. */
  function slug(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  /** Tidies what someone typed: collapsed spaces, no control characters. */
  function cleanName(name) {
    return String(name || '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME);
  }

  /** Display form: "margaret" -> "Margaret", "mary anne" -> "Mary Anne". */
  function displayName(name) {
    var clean = cleanName(name);
    if (!clean) return '';
    return clean.split(' ').map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(' ');
  }

  /* --------------------------------------------------------------- storage */

  function memoryStore() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  function store() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) { /* private browsing */ }
    return memoryStore();
  }

  function readJSON(storeLike, key) {
    try {
      var raw = storeLike.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function writeJSON(storeLike, key, value) {
    try { storeLike.setItem(key, JSON.stringify(value)); return true; }
    catch (err) { return false; }
  }

  /** The name last used on this device, if any. */
  function getUser(storeLike) {
    var s = storeLike || store();
    try { return cleanName(s.getItem(WHO_KEY) || ''); } catch (err) { return ''; }
  }

  /** Remember the name. An empty name means "just playing, no name". */
  function setUser(name, storeLike) {
    var s = storeLike || store();
    var clean = cleanName(name);
    try {
      if (clean) s.setItem(WHO_KEY, clean);
      else s.removeItem(WHO_KEY);
    } catch (err) { /* nothing we can do; the game still works unnamed */ }
    return clean;
  }

  function userKey(name) {
    var id = slug(name);
    return USER_PREFIX + (id || 'guest');
  }

  /** { name, dates: [], best: 0 } for one person. */
  function userRecord(name, storeLike) {
    var s = storeLike || store();
    var saved = readJSON(s, userKey(name));
    var dates = normaliseDates(saved && saved.dates);
    return {
      name: cleanName(name),
      dates: dates,
      best: Math.max((saved && saved.best) || 0, bestStreak(dates))
    };
  }

  /**
   * Note that a puzzle was finished. Doing it twice for the same day changes
   * nothing, so the win panel can safely re-run on a page reload.
   */
  function recordCompletion(name, date, storeLike) {
    var s = storeLike || store();
    var record = userRecord(name, s);
    if (isoToDayNumber(date) === null) return record;

    if (record.dates.indexOf(date) === -1) {
      record.dates.push(date);
      record.dates = normaliseDates(record.dates);
    }
    record.best = Math.max(record.best, bestStreak(record.dates));
    writeJSON(s, userKey(name), { name: record.name, dates: record.dates, best: record.best });
    return record;
  }

  /** Everything the screen needs, in one call. */
  function summary(name, today, storeLike) {
    var record = userRecord(name, storeLike);
    var finishedToday = record.dates.indexOf(today) !== -1;
    var current = currentStreak(record.dates, today);
    var best = Math.max(record.best, bestStreak(record.dates), current);
    return {
      name: record.name,
      displayName: displayName(name),
      dates: record.dates,
      finishedToday: finishedToday,
      finished: record.dates.length,
      current: current,
      best: best,
      text: describeStreak(current, best, finishedToday)
    };
  }

  return {
    getUser: getUser,
    setUser: setUser,
    cleanName: cleanName,
    displayName: displayName,
    slug: slug,
    userKey: userKey,
    userRecord: userRecord,
    recordCompletion: recordCompletion,
    summary: summary,
    currentStreak: currentStreak,
    bestStreak: bestStreak,
    describeStreak: describeStreak,
    normaliseDates: normaliseDates,
    memoryStore: memoryStore,
    maxNameLength: MAX_NAME
  };
}));