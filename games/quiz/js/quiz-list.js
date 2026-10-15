/* ============================================================================
   Inclusee Games - quiz question list
   ----------------------------------------------------------------------------
   Reads the plain-text quiz file staff edit. The format could not be simpler:

       What is the capital city of Australia?
       Canberra
       Sydney
       Melbourne

       Which of these animals carries its young in a pouch?
       Kangaroo
       Elephant
       Zebra

   The rule that makes this safe to author: the FIRST choice under each question
   is the right one. There is no way to mis-type a question and accidentally mark
   the wrong answer, and the game shuffles the choices so players cannot work the
   pattern out.

   Deliberately forgiving, because the person editing this is a support worker
   with notepad open, not a programmer:

     - blank lines separate questions, so the file may be laid out freely
     - lines starting with '#' are notes: #Title, #Date and #Take set things
     - a choice numbered with a hash ("#1 Canberra") still counts as a choice,
       because the member of staff who writes their options that way must not
       lose one silently
     - "1) Canberra" and "a) Canberra" lose their numbering, because the number
       is decoration, and keeping it would make two questions with the same
       choices
     - anything unusable is listed in `problems` with a line number and a
       plain-English reason, and the game plays the questions that are fine
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeQuizList = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MIN_CHOICES = 2;
  var MAX_CHOICES = 5;

  var OPTION_NUMBER = /^(?:\d+[.)]|[a-fA-F][.)])\s+/;   // "1)", "2.", "a)", "B."

  function cleanText(raw) {
    return String(raw || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  }

  function readDirective(line) {
    var m = line.match(/^#\s*([a-z]+)\s*[:=]\s*(.+)$/i);
    if (!m) return null;
    var key = m[1].toLowerCase();
    if (key === 'quiz' || key === 'name') key = 'title';
    return { key: key, value: m[2].trim() };
  }

  /**
   * A line starting with a hash reads as a note UNLESS a choice number follows
   * it, because staff sometimes write their options that way and silently
   * dropping one would produce a question nobody can answer.
   */
  function isNote(line) {
    if (line.charAt(0) !== '#') return false;
    // "#1 Canberra" or "#1) Canberra" is a choice; "# 7 tips for today" is a
    // note. The tell is a digit DIRECTLY after the hash, with no space.
    return !/^\d/.test(line.slice(1).replace(/^\s*/g, '')) ||
           /^\s/.test(line.slice(1));
  }

  function stripOptionNumber(text) {
    return text.replace(OPTION_NUMBER, '');
  }

  /**
   * parse(text) -> {
   *   questions: [{ question, correct, others: [], optionLines: [], line }],
   *   problems:  [{ line, why, text }],
   *   meta:      { title, date, take }
   * }
   *
   * `correct` is the right answer exactly as staff typed it, so the maker never
   * has to trust a colour or a letter to know which one it is.
   */
  function parse(text) {
    var questions = [], problems = [], meta = {};
    var seen = {};

    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');

    /* --------------------------------------------------------------- groups */

    /**
     * lines -> [{ startLine, lines: [{ lineNumber, text }] }], one per question.
     *
     * A blank line ends a question. A '#'-line is a note and is skipped without
     * breaking the question in half - except "#1 Canberra", which is choice one.
     * Choice numbering like "1)" is stripped here too.
     */
    function group() {
      var grouped = [];
      var block = null;

      for (var i = 0; i < lines.length; i++) {
        var line = cleanText(lines[i]);
        var lineNumber = i + 1;

        if (!line) { if (block) { grouped.push(block); block = null; } continue; }

        if (line.charAt(0) === '#') {
          var directive = readDirective(line);
          if (directive) meta[directive.key] = directive.value;
          if (isNote(line)) continue;
          // Staff numbering an option with a hash ("#1 Canberra") is what makes
          // the number theirs; strip the whole label, because the answer text
          // has to match what the player sees on screen. Without this the right
          // answer would read as "1 Canberra".
          var wasHashNumbered = /^\s*#\s*\d/.test(line);
          line = line.replace(/^\s*#/, '');
          if (wasHashNumbered) line = line.replace(/^\s*\d+[.)]?\s*/, '');
        }

        if (!block) block = { startLine: lineNumber, lines: [] };
        block.lines.push({ lineNumber: lineNumber, text: line });
      }
      if (block) grouped.push(block);
      return grouped;
    }

    var groups = group();

    for (var g = 0; g < groups.length; g++) {
      var block = groups[g];
      var questionText = block.lines[0].text;
      var start = block.startLine;

      if (!questionText) {
        problems.push({ line: start, text: '', why: 'a question needs words in it' });
        continue;
      }
      if (block.lines.length === 1) {
        problems.push({
          line: start, text: questionText,
          why: 'no choices under the question "' + questionText + '". A question is the question line, ' +
               'then each choice on its own line, with the FIRST choice being the right one'
        });
        continue;
      }
      if (seen[questionText]) {
        problems.push({
          line: start, text: questionText,
          why: 'the question "' + questionText + '" is already in the list on line ' + seen[questionText]
        });
        continue;
      }

      // Choices keep the line numbers they came from, because that is what staff
      // will want to look at when one of them is wrong.
      var choiceTexts = [], allChoiceLines = [];
      for (var c = 1; c < block.lines.length; c++) {
        var raw = cleanText(block.lines[c].text);
        var choice = cleanText(stripOptionNumber(raw));
        if (!choice) {
          problems.push({ line: block.lines[c].lineNumber, text: raw, why: 'this choice has no words in it' });
          continue;
        }
        choiceTexts.push(choice);
        allChoiceLines.push(block.lines[c].lineNumber);
      }

      if (choiceTexts.length < MIN_CHOICES) {
        problems.push({
          line: start, text: questionText,
          why: 'only ' + choiceTexts.length + ' choice' + (choiceTexts.length === 1 ? '' : 's') +
               ' under "' + questionText + '", and a question is not much of a question with ' +
               'fewer than ' + MIN_CHOICES + '. The first one is the right answer, so add ' +
               (MIN_CHOICES - choiceTexts.length) + ' more without it'
        });
        continue;
      }
      seen[questionText] = start;

      var options = [], optionLines = [], used = {};
      for (var o = 0; o < choiceTexts.length && options.length < MAX_CHOICES; o++) {
        if (used[choiceTexts[o]]) {
          problems.push({
            line: allChoiceLines[o], text: choiceTexts[o],
            why: 'the choice "' + choiceTexts[o] + '" appears twice in this question - a quiz with the ' +
                 'same choice twice is not a choice'
          });
          continue;
        }
        used[choiceTexts[o]] = true;
        options.push(choiceTexts[o]);
        optionLines.push(allChoiceLines[o]);
      }
      if (choiceTexts.length > MAX_CHOICES) {
        problems.push({
          line: start, text: questionText,
          why: (choiceTexts.length - MAX_CHOICES) + ' dropped from "' + questionText + '" - the most a screen ' +
               'shows comfortably is ' + MAX_CHOICES + ' choices'
        });
      }

      questions.push({
        question: questionText,
        correct: options[0],             // staff rule: first choice is always correct
        others: options.slice(1),
        optionLines: optionLines,
        line: start
      });
    }

    var take = null;
    if (meta.take && /^\d+$/.test(String(meta.take))) take = Math.max(1, parseInt(meta.take, 10));
    delete meta.take;
    meta.take = take;

    return { questions: questions, problems: problems, meta: meta };
  }

  function describeTake(meta, available) {
    if (meta && meta.take) return 'showing ' + Math.min(meta.take, available) + ' of ' + available;
    return 'showing all ' + available;
  }

  return {
    parse: parse,
    cleanText: cleanText,
    stripOptionNumber: stripOptionNumber,
    describeTake: describeTake,
    minChoices: MIN_CHOICES,
    maxChoices: MAX_CHOICES
  };
}));
