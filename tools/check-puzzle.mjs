#!/usr/bin/env node
/* ============================================================================
   Inclusee Games — crossword puzzle checker
   ----------------------------------------------------------------------------
   Run this over any clue file (or the whole puzzles folder) before you publish
   it. It uses the exact same reader and grid builder the game uses, so if this
   says OK, the game will look right.

     node tools/check-puzzle.mjs games/crossword/puzzles/2026-09-25.txt
     node tools/check-puzzle.mjs games/crossword/puzzles/          # whole folder

   Exit code 0 = all good, 1 = something needs fixing.
   ========================================================================== */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const generator = require('../games/crossword/js/grid-generator.js');
const puzzleText = require('../games/crossword/js/puzzle-text.js');

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

/** Every across/down run of 2+ letters in the grid must be a real entry.
 *  This is the check that catches ugly accidental words. */
function findStrayRuns(puzzle) {
  const { grid, rows, cols, entries } = puzzle;
  const key = (r, c, dir) => r + ',' + c + ',' + dir;
  const starts = new Set(entries.map(e => key(e.row, e.col, e.direction)));
  const stray = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      const acrossStart = !(c > 0 && grid[r][c - 1]);
      const acrossLen = (() => { let n = 0; while (c + n < cols && grid[r][c + n]) n++; return n; })();
      if (acrossStart && acrossLen >= 2 && !starts.has(key(r, c, 'across'))) {
        stray.push({ r, c, dir: 'across', len: acrossLen });
      }
      const downStart = !(r > 0 && grid[r - 1][c]);
      const downLen = (() => { let n = 0; while (r + n < rows && grid[r + n][c]) n++; return n; })();
      if (downStart && downLen >= 2 && !starts.has(key(r, c, 'down'))) {
        stray.push({ r, c, dir: 'down', len: downLen });
      }
    }
  }
  return stray;
}

function checkEntryLettersMatchGrid(puzzle) {
  const problems = [];
  for (const e of puzzle.entries) {
    e.cells.forEach(([r, c], i) => {
      if (puzzle.grid[r][c] !== e.answer[i]) {
        problems.push(`${e.number} ${e.direction} ("${e.answer}") does not match the grid at row ${r + 1}, column ${c + 1}`);
      }
    });
  }
  return problems;
}

function preview(puzzle) {
  const pad = String(puzzle.rows).length;
  const lines = [];
  for (let r = 0; r < puzzle.rows; r++) {
    let line = ' '.repeat(pad) + ' ';
    for (let c = 0; c < puzzle.cols; c++) {
      line += puzzle.grid[r][c] ? puzzle.grid[r][c] + ' ' : '· ';
    }
    lines.push(line);
  }
  const header = ' '.repeat(pad + 1) + Array.from({ length: puzzle.cols }, (_, i) => ((i + 1) % 10) + ' ').join('');
  return [header, ...lines].join('\n');
}

function checkFile(file) {
  const name = basename(file);
  const raw = readFileSync(file, 'utf8');
  const parsed = puzzleText.parse(raw);
  const seed = parsed.meta.date || name.replace(/\.txt$/i, '');

  console.log(`\n${BOLD}${name}${OFF} ${DIM}(seed: ${seed})${OFF}`);

  if (!parsed.clues.length) {
    console.log(`  ${RED}✗ No usable clues found.${OFF}`);
    for (const p of parsed.problems) console.log(`    line ${p.line}: ${p.why}`);
    return false;
  }

  let puzzle;
  try {
    puzzle = generator.generate(parsed.clues, { seed });
  } catch (err) {
    console.log(`  ${RED}✗ Could not build a grid: ${err.message}${OFF}`);
    return false;
  }

  const problems = [];
  for (const p of parsed.problems) problems.push(`line ${p.line}: ${p.why}  →  "${p.text}"`);
  for (const u of puzzle.unplaced) problems.push(`could not fit the answer "${u.answer}" (${u.clue}) into the grid`);
  for (const s of findStrayRuns(puzzle)) problems.push(`the grid has an unintended ${s.dir} word at row ${s.r + 1}, column ${s.c + 1} (${s.len} letters)`);
  problems.push(...checkEntryLettersMatchGrid(puzzle));

  // Warnings are cosmetic; they don't fail the build.
  const warnings = [];
  const clueCount = puzzle.entries.length;
  if (clueCount < 8) warnings.push(`only ${clueCount} clues — 8 to 14 makes the nicest grid`);
  if (clueCount > 16) warnings.push(`${clueCount} clues is a lot for one sitting`);
  for (const e of puzzle.entries) {
    if (e.clue.length > 110) warnings.push(`the clue for ${e.number} ${e.direction} is very long (${e.clue.length} characters)`);
  }
  const across = puzzle.entries.filter(e => e.direction === 'across').length;
  const down = puzzle.entries.filter(e => e.direction === 'down').length;
  if (across && down && (across === 1 || down === 1)) warnings.push('nearly every answer runs the same way — add some longer and shorter words');

  console.log(`  ${puzzle.rows} rows × ${puzzle.cols} columns · ${clueCount} answers (${across} across, ${down} down)`);
  console.log(preview(puzzle).split('\n').map(l => '  ' + DIM + l + OFF).join('\n'));

  console.log('  ' + puzzle.entries
    .map(e => `${e.number}${e.direction === 'across' ? 'A' : 'D'}:${e.answer}`)
    .join('  '));

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
  console.log('Usage: node tools/check-puzzle.mjs <puzzle.txt | puzzles-folder> [more...]');
  process.exit(1);
}

let files = [];
for (const t of targets) {
  try { files.push(...collectFiles(t)); }
  catch (err) { console.log(`${RED}Cannot read ${t}: ${err.message}${OFF}`); }
}

let ok = true;
for (const f of files) ok = checkFile(f) && ok;

console.log(`\n${files.length} file${files.length === 1 ? '' : 's'} checked — ${ok ? GREEN + 'all good' : RED + 'needs attention'}${OFF}\n`);
process.exit(ok ? 0 : 1);
