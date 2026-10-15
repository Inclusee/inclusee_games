/* ============================================================================
   Inclusee Games - quiz file and quiz maker

     node --test tests/

   Two reasons:
     1. the format has to survive how a real support worker types quizzes, so
        numbered choices, hash-numbered choices, and missing blank lines are all
        expected rather than treated as errors;
     2. the same file must always produce the same quiz, so a resident who
        reloads the page finds the same question waiting for them.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const quizList = require('../games/quiz/js/quiz-list.js');
const quizMaker = require('../games/quiz/js/quiz-maker.js');

const COMBINED = [
  'What is the capital city of Australia?',
  'Canberra',
  'Sydney',
  'Melbourne',
  '',
  'How many days in a week?',
  'Seven',
  'Six',
  'Eight',
  '',
  'Which animal carries its young in a pouch?',
  'Kangaroo',
  'Elephant',
  'Zebra'
].join('\n');

const QUESTIONS = [
  { question: 'What is the capital city of Australia?', correct: 'CANBERRA', others: ['SYDNEY', 'MELBOURNE'] },
  { question: 'How many days in a week?', correct: 'SEVEN', others: ['SIX', 'EIGHT'] },
  { question: 'Which animal carries its young in a pouch?', correct: 'KANGAROO', others: ['ELEPHANT', 'ZEBRA'] },
  { question: 'What colour is the Inclusee logo text?', correct: 'WHITE', others: ['GREEN', 'BLUE'] },
  { question: 'How many legs does a spider have?', correct: 'EIGHT', others: ['SIX', 'TEN'] }
];

test('a question and its choices are read, and the FIRST choice is the answer', () => {
  const parsed = quizList.parse(COMBINED);
  assert.equal(parsed.questions.length, 3, JSON.stringify(parsed.problems));
  assert.equal(parsed.questions[0].correct, 'Canberra');
  assert.deepEqual(parsed.questions[0].others, ['Sydney', 'Melbourne']);
  assert.equal(parsed.problems.length, 0);
});

test('a choice written with numbers, letters or a hash is still read as a choice', () => {
  for (const style of ['Seven', '1) Seven', '1. Seven', 'a) Seven', 'A. Seven', '#1 Seven']) {
    const parsed = quizList.parse('How many days in a week?\n' + style + '\nSix\nEight\n');
    assert.equal(parsed.questions.length, 1, 'with choice line "' + style + '"');
    assert.equal(parsed.questions[0].correct, 'Seven', 'with choice line "' + style + '"');
    assert.deepEqual(parsed.questions[0].others, ['Six', 'Eight'], 'with choice line "' + style + '"');
    assert.deepEqual(parsed.problems, [], 'with choice line "' + style + '": ' + JSON.stringify(parsed.problems));
  }
});

test('a choice line with nothing in it is reported, not silently turned into an answer', () => {
  const parsed = quizList.parse('How many days in a week?\n1) Seven\n2) Six\n3) Eight');
  assert.equal(parsed.questions.length, 1, JSON.stringify(parsed.problems));
});

test('a question with no choices is reported with a line number and a helpful explanation', () => {
  const parsed = quizList.parse('What is the capital city of Australia?\n');
  assert.equal(parsed.questions.length, 0);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].line, 1);
  assert.match(parsed.problems[0].why, /no choices under/);
  assert.match(parsed.problems[0].why, /FIRST choice being the right one/);
});

test('two choices make a playable question, one choice is reported as too much of a stretch', () => {
  const two = quizList.parse('How many days in a week?\nSeven\nSix\n');
  assert.equal(two.questions.length, 1);
  assert.equal(two.questions[0].others.length, 1, 'a two-choice question plays');

  const one = quizList.parse('How many days in a week?\nSeven\n');
  assert.equal(one.questions.length, 0);
  assert.equal(one.problems.length, 1);
  assert.match(one.problems[0].why, /only 1 choice/);
  assert.match(one.problems[0].why, /add 1 more without it/, 'it names what to do about it');
});

test('a question repeated is named with the line it first appeared on', () => {
  const parsed = quizList.parse(COMBINED + '\n\n' + 'How many days in a week?\nSeven\nSix\n');
  const whys = parsed.problems.map(p => p.why);
  assert.equal(parsed.questions.length, 3, 'the repeat does not play twice');
  assert.ok(whys.some(w => /already in the list on line 6/.test(w)), JSON.stringify(whys));
});

test('a choice appearing twice in one question is reported and not offered to players', () => {
  const parsed = quizList.parse('How many days in a week?\nSeven\nSeven\nSix\n');
  const whys = parsed.problems.map(p => p.why);
  assert.ok(whys.some(w => /appears twice/.test(w)), JSON.stringify(whys));
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].correct, 'Seven');
  assert.deepEqual(parsed.questions[0].others, ['Six'], JSON.stringify(parsed.questions[0]));
});

test('more than five choices is too many for one screen, and the extras are dropped with a reason', () => {
  const sevenChoices = ['What is the capital city of Austria?', 'Vienna', 'Salzburg', 'Innsbruck', 'Graz', 'Linz', 'Bregenz'].join('\n');
  const parsed = quizList.parse(sevenChoices);
  assert.equal(parsed.questions[0].others.length, 4, 'five choices in total: ' + JSON.stringify(parsed.questions[0]));
  assert.ok(parsed.problems.map(p => p.why).some(w => /dropped/.test(w)), 'the file should say how many were dropped');
});

test('#Take decides how much of the file is used, and is clamped to what exists', () => {
  const file = [
    '#Title: Big quiz',
    '#Take: 3',
    '',
    'Question one?',
    'One',
    'Two',
    'Three',
    '',
    'Question two?',
    'Four',
    'Five',
    'Six',
    '',
    'Question three?',
    'Seven',
    'Eight',
    'Nine',
    '',
    'Question four?',
    'Ten',
    'Eleven',
    'Twelve'
  ].join('\n');
  const parsed = quizList.parse(file);
  assert.equal(parsed.questions.length, 4);
  assert.equal(parsed.meta.take, 3);
  assert.equal(quizList.describeTake(parsed.meta, parsed.questions.length), 'showing 3 of 4');

  const big = quizList.parse(file.replace('#Take: 3', '#Take: 99'));
  assert.equal(quizList.describeTake(big.meta, big.questions.length), 'showing 4 of 4', 'take is clamped to the list');
});

test('#Title and #Date are read the same way the other files are', () => {
  const parsed = quizList.parse('#Title: Trivia Corner\n#Date: 2026-10-08\n\n' + COMBINED);
  assert.equal(parsed.meta.title, 'Trivia Corner');
  assert.equal(parsed.meta.date, '2026-10-08');
});

/* ------------------------------------------------------------- the maker */

test('the right answer is present exactly once and it is never always in the same slot', () => {
  const quiz = quizMaker.build(QUESTIONS, { seed: 'quiz-day' });
  assert.equal(quiz.shown, QUESTIONS.length);
  const slots = new Set();
  for (const q of quiz.questions) {
    const original = QUESTIONS.find(x => x.question === q.question);
    const text = original.correct;
    const at = q.choices.indexOf(text);
    assert.notEqual(at, -1, q.question + ': the right answer went missing');
    assert.equal(q.answer, at, q.question + ': the answer index disagrees with the choices');
    assert.equal(q.choices.filter(c => c === text).length, 1, q.question + ': the answer appears twice');
    slots.add(at);
  }
  assert.ok(slots.size >= 2, 'the answer sat in the same slot for every question - the shuffle is broken');
});

test('the same file always produces the same quiz, and a different day does not', () => {
  const a = quizMaker.build(QUESTIONS, { seed: '2026-10-08' });
  const b = quizMaker.build(QUESTIONS, { seed: '2026-10-08' });
  assert.deepEqual(a.questions, b.questions);

  const c = quizMaker.build(QUESTIONS, { seed: '2026-10-09' });
  assert.notDeepEqual(a.questions, c.questions);
});

test('#Take limits how many are shown, and never goes above the list', () => {
  const quiz = quizMaker.build(QUESTIONS, { seed: 'take', take: 3 });
  assert.equal(quiz.totalAvailable, QUESTIONS.length);
  assert.equal(quiz.shown, 3);
  assert.equal(quiz.questions.length, 3);

  const huge = quizMaker.build(QUESTIONS, { seed: 'take-huge', take: 99 });
  assert.equal(huge.shown, QUESTIONS.length, 'a take larger than the list is clamped');
});

test('shuffling only borrows choices from the question they belong to', () => {
  const quiz = quizMaker.build(QUESTIONS, { seed: 'mixing' });
  for (const q of quiz.questions) {
    const original = QUESTIONS.find(x => x.question === q.question);
    for (const choice of q.choices) {
      assert.ok([original.correct, ...original.others].includes(choice),
        'the choice "' + choice + '" in "' + q.question + '" belongs to another question');
    }
  }
});

test('a file with one good and one broken question plays the good one and reports the other', () => {
  const parsed = quizList.parse('What is the capital city?\nCanberra\nSydney\n\nBroken question with no choices\n');
  assert.equal(parsed.questions.length, 1, JSON.stringify(parsed.problems));
  assert.equal(parsed.problems.length, 1);

  const quiz = quizMaker.build(parsed.questions, { seed: 'bad' });
  assert.equal(quiz.shown, 1);
  assert.equal(quiz.rejected.length, 0);
});

test('a file with nothing usable throws with a message a staff member can follow', () => {
  assert.throws(() => quizMaker.build([], { seed: 'x' }), /each one needs a question line/);
  assert.throws(() => quizMaker.build([{ question: 'Only this?', correct: 'X', others: [] }], { seed: 'x' }),
    /at least 2 choices/, 'a question with a single choice cannot be a puzzle');
});
