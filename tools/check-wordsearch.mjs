#!/usr/bin/env node
/* ============================================================================
   Inclusee Games - word search checker
   ----------------------------------------------------------------------------
   Run this over any word list (or the whole words folder) before publishing it.
   It uses the same reader and grid builder the game uses, so if this says OK,
   the game will look right.

     node tools/check-wordsearch.mjs games/wordsearch/words/2026-10-02.txt
     node tools/check-wordsearch.mjs games/wordsearch/words/     # whole folder

   Exit code 0 = all good, 1 = something needs fixing.
   ========================================================================== */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gridMaker = require('../games/wordsearch/js/grid-maker.js');
const wordList = require('../games/wordsearch/js/word-list.js');

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

/** Read a placement back out of the grid: the word must really be there. */
function readPlacement(puzzle, placement) {
  return placement.cells.map(([r, c]) => puzzle.grid[r][c]).join('');
}

function findProblems(puzzle) {
  const problems = [];
  for (const placement of puzzle.placements) {
    if (readPlacement(puzzle, placement) !== placement.word) {
      problems.push('the word ' + placement.word + ' does not read correctly in the grid');
    }
    for (const [r, c] of placement.cells) {
      if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) {
        problems.push('the word ' + placement.word + ' runs off the edge of the grid');
      }
    }
  }
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (!/^[A-Z]$/.test(puzzle.grid[r][c] || '')) problems.push('empty square at row ' + (r + 1) + ', column ' + (c + 1));
    }
  }
  for (const dropped of puzzle.unplaced) {
    problems.push('could not fit the word "' + dropped.word + '" into the grid');
  }
  return problems;
}

function preview(puzzle) {
  const lines = [];
  for (let r = 0; r < puzzle.rows; r++) {
    lines.push('  ' + DIM + puzzle.grid[r].join(' ') + OFF);
  }
  return lines.join('\n');
}

function checkFile(file) {
  const name = basename(file);
  const raw = readFileSync(file, 'utf8');
  const parsed = wordList.parse(raw);
  const nameDate = (name.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
  const seed = nameDate || parsed.meta.date || name.replace(/\.txt$/i, '');

  console.log(`\n${BOLD}${name}${OFF} ${DIM}(seed: ${seed})${OFF}`);

  if (!parsed.words.length) {
    console.log(`  ${RED}✗ No usable words found.${OFF}`);
    for (const p of parsed.problems) console.log(`    line ${p.line}: ${p.why}`);
    return false;
  }

  let puzzle;
  try {
    puzzle = gridMaker.build(parsed.words.map(w => w.word), {
      seed,
      directions: parsed.meta.directions
    });
  } catch (err) {
    console.log(`  ${RED}✗ Could not build a grid: ${err.message}${OFF}`);
    return false;
  }

  const problems = [];
  for (const p of parsed.problems) problems.push(`line ${p.line}: ${p.why}  ->  "${p.text}"`);
  problems.push(...findProblems(puzzle));

  const warnings = [];
  const count = puzzle.placements.length;
  if (count < 6) warnings.push(`only ${count} words - 8 to 12 makes the nicest grid`);
  if (count > 12) warnings.push(`${count} words will make the letters small`);
  if (nameDate && parsed.meta.date && nameDate !== parsed.meta.date) {
    warnings.push('the file is named ' + nameDate + ' but its #Date line says ' + parsed.meta.date +
      ' - the file name wins, so change the #Date line or the file name');
  }
  const mix = puzzle.stats.directionMix || {};
  if (count >= 6 && Object.keys(mix).length === 1) {
    warnings.push('every word runs the same way - the generator should have mixed these up, please report this');
  }
  const lookAlike = [];
  const words = puzzle.placements.map(p => p.word);
  for (const word of words) {
    for (const other of words) {
      if (word !== other && other.startsWith(word)) lookAlike.push(word + ' / ' + other);
    }
  }
  if (lookAlike.length) {
    warnings.push('these words start the same way, which is hard to tell apart once letters are mixed in: ' +
      [...new Set(lookAlike)].join(', '));
  }

  console.log(`  ${puzzle.rows} x ${puzzle.cols} grid · ${count} words hidden · directions: ${wordList.describeDirections(parsed.meta.directions)}`);
  console.log(`  ${puzzle.stats.crossings === 0 ? 'no words overlap, so the grid stays clear to read' : puzzle.stats.crossings + ' letters are shared between words'}`);
  console.log(preview(puzzle));

  console.log('  ' + puzzle.placements.map(p => p.word + ' (' + p.direction + ')').join('\n  '));

  if (warnings.length) {
    console.log(`  ${YELLOW}Notes (not errors):${OFF}`);
    for (const w of warnings) console.log(`    ${YELLOW}•${OFF} ${w}`);
  }

  if (problems.length) {
    console.log(`  ${RED}✗ ${problems.length} problem${problems.length > 1 ? 's' : ''}:${OFF}`);
    for (const p of problems) console.log(`    ${RED}•${OFF} ${p}`);
    return false;
  }

  console.log(`  ${GREEN}✓ Ready to publish${OFF}`);
  return true;
}

const targets = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!targets.length) {
  console.log('Usage: node tools/check-wordsearch.mjs <words.txt | words-folder> [more...]');
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