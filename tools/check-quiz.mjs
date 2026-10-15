#!/usr/bin/env node
/* ============================================================================
   Inclusee Games - quiz checker
   ----------------------------------------------------------------------------
   Run this over any quiz file (or the whole questions folder) before publishing.
   It uses the same reader and maker the game uses, so if this says OK, the game
   will look right. It prints the quiz with the right answer marked.

     node tools/check-quiz.mjs games/quiz/questions/2026-10-08.txt
     node tools/check-quiz.mjs games/quiz/questions/

   Exit code 0 = all good, 1 = something needs fixing.
   ========================================================================== */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const quizList = require('../games/quiz/js/quiz-list.js');
const quizMaker = require('../games/quiz/js/quiz-maker.js');

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m';

function collectFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) return [target];
  return readdirSync(target)
    .filter(f => extname(f).toLowerCase() === '.txt')
    .filter(f => !basename(f).startsWith('_') && basename(f).toLowerCase() !== 'index.txt')
    .sort()
    .map(f => join(target, f));
}

function checkFile(file) {
  const name = basename(file);
  const raw = readFileSync(file, 'utf8');
  const parsed = quizList.parse(raw);
  const nameDate = (name.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
  const seed = nameDate || parsed.meta.date || name.replace(/\.txt$/i, '');

  console.log(`\n${BOLD}${name}${OFF} ${DIM}(seed: ${seed})${OFF}`);

  if (!parsed.questions.length) {
    console.log(`  ${RED}No usable questions found.${OFF}`);
    for (const p of parsed.problems) console.log(`    line ${p.line}: ${p.why}`);
    return false;
  }

  let quiz;
  try {
    quiz = quizMaker.build(parsed.questions, { seed, take: parsed.meta.take });
  } catch (err) {
    console.log(`  ${RED}Could not build a quiz: ${err.message}${OFF}`);
    return false;
  }

  const problems = [];
  for (const p of parsed.problems) problems.push(`line ${p.line}: ${p.why}  ->  "${p.text}"`);

  const warnings = [];
  if (quiz.shown < 6) warnings.push(`only ${quiz.shown} question${quiz.shown === 1 ? '' : 's'} are shown - 6 to 12 makes a better session`);
  if (quiz.shown > 12) warnings.push(`${quiz.shown} questions is a lot for one sitting`);
  for (const q of parsed.questions) {
    if (q.question.length > 110) warnings.push(`the question on line ${q.line} is very long (${q.question.length} characters)`);
    for (const option of [q.correct, ...q.others]) {
      if (option.length > 60) warnings.push(`a choice on line ${q.line} is long (${option.length} characters)`);
    }
    if (q.question.indexOf('?') === -1 && q.question.indexOf(':') === -1) {
      warnings.push(`the question on line ${q.line} does not end in ? or : - worth a look`);
    }
  }
  if (nameDate && parsed.meta.date && nameDate !== parsed.meta.date) {
    warnings.push('the file is named ' + nameDate + ' but its #Date line says ' + parsed.meta.date +
      ' - the file name wins, so change the #Date line or the file name');
  }

  console.log(`  ${quiz.shown} question${quiz.shown === 1 ? '' : 's'} shown` +
    (parsed.meta.take ? ` (of ${parsed.questions.length} in the file)` : '') +
    ' · ' + (parsed.meta.take ? quizList.describeTake(parsed.meta, parsed.questions.length) : 'every question plays'));

  for (const q of quiz.questions) {
    const parsedOne = parsed.questions.find(x => x.question === q.question);
    console.log(`  ${BOLD}${q.question}${OFF}`);
    q.choices.forEach((c, i) => {
      const isAnswer = i === q.answer;
      console.log(`    ${isAnswer ? GREEN + '→' : OFF} ${c} ${isAnswer ? DIM + '(the right answer, from your first line)' : OFF}`);
    });
  }

  if (warnings.length) {
    console.log(`  ${YELLOW}Notes (not errors):${OFF}`);
    for (const w of warnings) console.log(`    ${YELLOW}-${OFF} ${w}`);
  }

  if (problems.length) {
    console.log(`  ${RED}${problems.length} problem${problems.length > 1 ? 's' : ''}:${OFF}`);
    for (const p of problems) console.log(`    ${RED}-${OFF} ${p}`);
    return false;
  }

  console.log(`  ${GREEN}Ready to publish${OFF}`);
  return true;
}

const targets = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!targets.length) {
  console.log('Usage: node tools/check-quiz.mjs <quiz.txt | questions-folder> [more...]');
  process.exit(1);
}

let files = [];
for (const t of targets) {
  try { files.push(...collectFiles(t)); }
  catch (err) { console.log(`${RED}Cannot read ${t}: ${err.message}${OFF}`); }
}

let ok = true;
for (const f of files) ok = checkFile(f) && ok;

console.log(`\n${files.length} file${files.length === 1 ? '' : 's'} checked - ${ok ? GREEN + 'all good' : RED + 'needs attention'}${OFF}\n`);
process.exit(ok ? 0 : 1);