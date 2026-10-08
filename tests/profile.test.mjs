/* ============================================================================
   Inclusee Games - name and streak tests

     node --test tests/

   Streaks are the kind of thing that looks obviously right and is subtly wrong,
   so the edge cases are spelled out: today not done yet, a day skipped, the same
   day finished twice, and a brand new player.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const profile = require('../games/shared/profile.js');

const TODAY = '2026-10-02';

test('a brand new player has no streak', () => {
  assert.equal(profile.currentStreak([], TODAY), 0);
  assert.equal(profile.bestStreak([]), 0);
  const s = profile.summary('', TODAY, profile.memoryStore());
  assert.equal(s.current, 0);
  assert.equal(s.finishedToday, false);
  assert.match(s.text, /Finish today\u2019s puzzle to start a run/);
});

test('one day finished today is a run of one', () => {
  assert.equal(profile.currentStreak([TODAY], TODAY), 1);
  const s = profile.summary('Margaret', TODAY, profile.memoryStore());
  assert.equal(s.current, 0, 'nothing recorded yet');
});

test('consecutive days count up', () => {
  const dates = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
  assert.equal(profile.currentStreak(dates, TODAY), 5);
  assert.equal(profile.bestStreak(dates), 5);
});

test('today not done yet does not break the run', () => {
  // A resident part-way through today must still see what they have built.
  const dates = ['2026-09-30', '2026-10-01'];
  assert.equal(profile.currentStreak(dates, TODAY), 2);
});

test('a missed day ends the run', () => {
  // Last finished two days ago: yesterday and today both empty.
  assert.equal(profile.currentStreak(['2026-09-29', '2026-09-30'], TODAY), 0);
});

test('only the most recent run counts as current', () => {
  const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-01', '2026-10-02'];
  assert.equal(profile.currentStreak(dates, TODAY), 2);
  assert.equal(profile.bestStreak(dates), 3, 'the earlier longer run is still the best');
});

test('finishing the same day twice does not inflate anything', () => {
  const store = profile.memoryStore();
  profile.recordCompletion('Margaret', TODAY, store);
  profile.recordCompletion('Margaret', TODAY, store);
  profile.recordCompletion('Margaret', TODAY, store);
  const s = profile.summary('Margaret', TODAY, store);
  assert.equal(s.current, 1);
  assert.equal(s.finished, 1);
});

test('a run builds up day by day and is remembered', () => {
  const store = profile.memoryStore();
  profile.recordCompletion('Margaret', '2026-09-30', store);
  profile.recordCompletion('Margaret', '2026-10-01', store);
  profile.recordCompletion('Margaret', TODAY, store);
  const s = profile.summary('Margaret', TODAY, store);
  assert.equal(s.current, 3);
  assert.equal(s.best, 3);
  assert.equal(s.finishedToday, true);
  assert.match(s.text, /3 days in a row/);

  // Next day: today's run still shows until they either play or skip.
  const tomorrow = profile.summary('Margaret', '2026-10-03', store);
  assert.equal(tomorrow.current, 3, 'run survives into tomorrow, waiting to be extended');
  assert.equal(tomorrow.finishedToday, false);
  assert.match(tomorrow.text, /keep your run/);
});

test('the best run is kept after a run is broken', () => {
  const store = profile.memoryStore();
  for (const d of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']) {
    profile.recordCompletion('Margaret', d, store);
  }
  profile.recordCompletion('Margaret', TODAY, store);
  const s = profile.summary('Margaret', TODAY, store);
  assert.equal(s.current, 1, 'starting again');
  assert.equal(s.best, 4, 'the old run is not forgotten');
  assert.match(s.text, /Your best is 4 days/);
});

test('a whole week gets a warmer message', () => {
  const dates = ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', TODAY];
  const s = profile.summary('Margaret', TODAY, { getItem: () => null, setItem: () => {} });
  assert.equal(profile.currentStreak(dates, TODAY), 7);
});

test('two people keep separate streaks on the same device', () => {
  const store = profile.memoryStore();
  profile.recordCompletion('Margaret', '2026-10-01', store);
  profile.recordCompletion('Margaret', TODAY, store);
  profile.recordCompletion('Ron', TODAY, store);
  assert.equal(profile.summary('Margaret', TODAY, store).current, 2);
  assert.equal(profile.summary('Ron', TODAY, store).current, 1);
});

test('names are matched regardless of capitals and spacing', () => {
  const store = profile.memoryStore();
  profile.recordCompletion('margaret', '2026-10-01', store);
  profile.recordCompletion('  MARGARET  ', TODAY, store);
  assert.equal(profile.summary('Margaret', TODAY, store).current, 2);
  assert.equal(profile.slug('Margaret'), 'margaret');
  assert.equal(profile.slug('Mary Anne'), 'mary-anne');
});

test('the name is tidied up and made presentable', () => {
  assert.equal(profile.cleanName('   Margaret   '), 'Margaret');
  assert.equal(profile.cleanName('Mary   Anne'), 'Mary Anne');
  assert.equal(profile.cleanName('a'.repeat(50)).length, profile.maxNameLength);
  assert.equal(profile.displayName('margaret'), 'Margaret');
  assert.equal(profile.displayName('mary anne'), 'Mary Anne');
  assert.equal(profile.cleanName('Margaret\u0000'), 'Margaret');
});

test('an unnamed player still works and is kept separate from named ones', () => {
  const store = profile.memoryStore();
  profile.recordCompletion('', TODAY, store);
  profile.recordCompletion('Margaret', TODAY, store);
  assert.equal(profile.summary('', TODAY, store).current, 1);
  assert.equal(profile.userKey(''), 'inclusee.user.guest');
  assert.equal(profile.userKey('Margaret'), 'inclusee.user.margaret');
});

test('the name is remembered on the device', () => {
  const store = profile.memoryStore();
  assert.equal(profile.getUser(store), '');
  profile.setUser('  Margaret  ', store);
  assert.equal(profile.getUser(store), 'Margaret');
  profile.setUser('', store);
  assert.equal(profile.getUser(store), '', 'clearing the name clears it');
});

test('a damaged saved record does not break anything', () => {
  const store = profile.memoryStore();
  store.setItem(profile.userKey('Margaret'), 'not json at all');
  const s = profile.summary('Margaret', TODAY, store);
  assert.equal(s.current, 0);
  assert.equal(s.finished, 0);

  store.setItem(profile.userKey('Ron'), JSON.stringify({ dates: ['nonsense', null, 42, '2026-10-02'] }));
  assert.equal(profile.summary('Ron', TODAY, store).current, 1);
  assert.deepEqual(profile.userRecord('Ron', store).dates, ['2026-10-02']);
});

test('dates are normalised and de-duplicated', () => {
  assert.deepEqual(
    profile.normaliseDates(['2026-10-02', '2026-10-01', '2026-10-02', '', null, '13/10/2026']),
    ['2026-10-01', '2026-10-02']
  );
});

test('a streak crossing a month and a year boundary counts correctly', () => {
  assert.equal(profile.currentStreak(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01'), 3);
  assert.equal(profile.bestStreak(['2027-02-27', '2027-02-28', '2027-03-01']), 3, '2027 is not a leap year');
});

test('a very long streak is reported plainly', () => {
  const dates = [];
  for (let i = 0; i < 100; i++) {
    dates.push(new Date(Date.UTC(2026, 6, 1) + i * 86400000).toISOString().slice(0, 10));
  }
  const last = dates[dates.length - 1];
  assert.equal(profile.currentStreak(dates, last), 100);
  assert.equal(profile.bestStreak(dates), 100);
  assert.match(profile.describeStreak(100, 100, true), /100 days in a row/);
});

test('the streak wording does not assume which game it is', () => {
  // Shared by the crossword and the word search, so it must not say "crossword"
  // on a word search screen.
  for (const [current, best, today] of [[0, 0, false], [3, 5, true], [3, 5, false], [1, 1, true]]) {
    const text = profile.describeStreak(current, best, today);
    assert.doesNotMatch(text, /crossword/i, 'streak message says crossword: ' + text);
    assert.doesNotMatch(text, /word search/i, 'streak message says word search: ' + text);
  }
});
