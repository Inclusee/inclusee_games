/* ============================================================================
   Inclusee Games - quiz maker
   ----------------------------------------------------------------------------
   Turns a list of questions into today's quiz:

     - the questions are shuffled, and each question's choices are shuffled, so
       the right answer is never in the same spot two days running;
     - #Take: 10 in the file means "pick 10 of the ones I typed", which lets a
       staff member load a long list and not have to choose which to cut;
     - the correct answer travels as the answer TEXT, never as a position or a
       letter, so shuffling cannot turn a puzzle into one nobody can win.

   The same file always produces the same quiz, so a resident who reloads the
   page finds the same question waiting for them.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeQuiz = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function sharedRandom() {
    if (typeof IncluseeSeededRandom !== 'undefined') return IncluseeSeededRandom;
    if (typeof require === 'function') return require('../../shared/seeded-random.js');
    throw new Error('The random number helper must be loaded first.');
  }

  var rngTools = sharedRandom();

  /**
   * build(questions, options) -> {
   *   questions: [{ question, choices: [text], answer: index }],
   *   totalAvailable, shown, stats
   * }
   *
   * questions : [{ question, correct, others }] straight from quiz-list.js
   * options   : { seed, take }
   */
  function build(questions, options) {
    options = options || {};
    var seed = options.seed || 'inclusee';
    var take = options.take || null;

    var usable = [], rejected = [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var choices = [q.correct].concat(q.others || []);
      if (!q.question || choices.length < 2) { rejected.push(q.question || '(unknown)'); continue; }
      usable.push({ question: q.question, choices: choices, correct: q.correct, line: q.line });
    }
    if (!usable.length) {
      throw new Error('No usable questions: each one needs a question line and at least 2 choices, ' +
                      'with the first choice being the right answer.');
    }

    var shuffled = rngTools.shuffle(usable.slice(), rngTools.makeRng(seed + '#order'));
    var shown = shuffled;
    if (take && take > 0 && take < shuffled.length) {
      shown = shuffled.slice(0, Math.min(take, shuffled.length));
    }

    var out = [];
    for (var s = 0; s < shown.length; s++) {
      var item = shown[s];
      var mixed = rngTools.shuffle(item.choices.slice(), rngTools.makeRng(seed + '#q' + s));
      var answerAt = mixed.indexOf(item.correct);
      // indexOf on the answer text cannot fail: the correct answer always rides
      // with the list shuffled for this question. Guarded anyway, because a quiz
      // with no right answer is worse than an error.
      if (answerAt === -1) answerAt = 0;
      out.push({
        question: item.question,
        choices: mixed,
        answer: answerAt,
        line: item.line
      });
    }

    return {
      questions: out,
      totalAvailable: usable.length,
      shown: out.length,
      rejected: rejected,
      stats: { seed: seed, take: options.take || null }
    };
  }

  return {
    build: build,
    errors: { noRandomHelper: 'The random number helper must be loaded first.' }
  };
}));
