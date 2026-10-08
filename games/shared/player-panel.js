/* ============================================================================
   Inclusee Games - the "who is playing" panel
   ----------------------------------------------------------------------------
   The name box, the streak sentence and the seven day dots. Shared by every
   game so they cannot drift apart, and so a fix here fixes it everywhere.

   A game supplies the elements and gets told when the name changes, so it can
   load that person's own progress. Nothing typed here leaves the device.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseePlayerPanel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * create({ input, saveButton, streakLine, daysContainer, announce, onChange })
   *
   *   onChange(newName, previousName)  - the game swaps that person's progress
   *   refresh()                        - returns the streak summary
   *   setDate(isoDate)                 - the puzzle's date, for the dots
   */
  function create(options) {
    var profile = options.profile || (typeof IncluseeProfile !== 'undefined' ? IncluseeProfile : null);
    var shiftISO = options.shiftISO;
    var prettyDate = options.prettyDate || function (d) { return d; };
    var announce = options.announce || function () {};
    var onChange = options.onChange || function () {};

    var name = '';
    var date = '';
    var summary = null;

    function wire() {
      if (options.saveButton) options.saveButton.addEventListener('click', save);
      if (!options.input) return;
      options.input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
      });
      // Saving on the way out means nobody loses a name they typed and forgot
      // to save, which a first-time user is very likely to do.
      options.input.addEventListener('blur', function () {
        if (profile.cleanName(options.input.value) !== profile.getUser()) save();
      });
    }

    function save() {
      var typed = profile.cleanName(options.input ? options.input.value : '');
      var previous = profile.getUser();
      profile.setUser(typed);
      if (options.input) options.input.value = typed;
      name = typed;
      onChange(typed, previous);
      var updated = refresh(typed
        ? 'Playing as ' + (profile.displayName(typed) || 'this player') + '.'
        : 'Name cleared. The game still works without one.');
      return updated;
    }

    /** Reads the streak back and redraws the sentence and the dots. */
    function refresh(spoken) {
      if (!name) name = profile.getUser();
      if (!date) return null;

      summary = profile.summary(name, date);

      if (options.streakLine) {
        if (!name) {
          options.streakLine.textContent = summary.finished
            ? 'Playing without a name. ' + summary.finished + ' ' +
              (summary.finished === 1 ? 'day' : 'days') + ' finished on this device.'
            : 'Add your name to keep a run of days going.';
        } else {
          options.streakLine.textContent = summary.text;
        }
      }

      if (options.daysContainer && shiftISO) {
        var has = {};
        for (var i = 0; i < summary.dates.length; i++) has[summary.dates[i]] = true;
        options.daysContainer.innerHTML = '';
        for (var back = 6; back >= 0; back--) {
          var day = shiftISO(date, -back);
          var dot = document.createElement('span');
          dot.className = 'day' + (has[day] ? ' done' : '') + (back === 0 ? ' today' : '');
          dot.title = prettyDate(day) + (has[day] ? ' - finished' : '');
          options.daysContainer.appendChild(dot);
        }
      }

      if (spoken) announce(spoken + ' ' + (options.streakLine ? options.streakLine.textContent : ''));
      return summary;
    }

    wire();

    return {
      init: function (isoDate) {
        date = isoDate;
        name = profile.getUser();
        if (options.input) options.input.value = name;
        return refresh();
      },
      setDate: function (isoDate) { date = isoDate; return refresh(); },
      save: save,
      refresh: refresh,
      name: function () { return name; },
      summary: function () { return summary; }
    };
  }

  return { create: create };
}));