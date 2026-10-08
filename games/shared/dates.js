/* ============================================================================
   Inclusee Games - dates
   ----------------------------------------------------------------------------
   The three date jobs every game needs: what day is it, what date is it so many
   days before that, and how do we write that date out in words.

   Dates are handled as plain "2026-10-02" text throughout, never as Date
   objects, so a puzzle cannot change day depending on the device's timezone.

   Kept out of the crossword's own reader because the word search needs exactly
   these and nothing else from it.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeDates = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayISO(now) {
    var d = now ? new Date(now) : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function shiftISO(iso, days) {
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  /** "2026-10-02" -> "Friday 2 October 2026" */
  function prettyDate(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(iso || '');
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DAYS[d.getUTCDay()] + ' ' + (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1];
  }

  return { todayISO: todayISO, shiftISO: shiftISO, prettyDate: prettyDate };
}));
