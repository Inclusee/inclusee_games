import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const generator = require('../games/crossword/js/grid-generator.js');

const WORDS = `KITCHEN TEA ARMCHAIR GARDEN KNIFE ICE CAT CLOCK BED MOWER SINK TOMORROW
SPRING BUTTER SEVEN ICECREAM SLIPPERS WHALE WINDOW TEABAG BARBIE DRIZZLE BENCH
APPLE BISCUIT PILLOW LETTER SUNSHINE KETTLE RADIO CURTAIN TEAPOT BAKE BIRD
SEASIDE UMBRELLA POSTBOX ROSEMARY LEMON PANCAKE JUKEBOX LADDER BASKET SUNDAY
CHOCOLATE LANTERN PANTRY HAMMOCK APRON BICYCLE PUZZLE CANDLE MIRROR AVENUE
PICNIC ORCHARD HONEY MARMALADE TRACTOR RIBBON MUG SAUCEPAN VASE NEWSPAPER
GLOVES SCARF MONDAY HOLIDAY BEACH ALBUM SCISSORS POETRY DOORWAY CUSHION`.trim().split(/\s+/);

const seed = process.argv[2] || 'stress-2';
const r = generator.makeRng(seed);
const count = 8 + Math.floor(r() * 7);
const pool = WORDS.slice();
for (let j = pool.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [pool[j], pool[k]] = [pool[k], pool[j]]; }
const picked = pool.slice(0, count);
const clues = picked.map((answer, n) => ({ clue: 'Definition of word ' + (n + 1), answer }));
const p = generator.generate(clues, { seed, attempts: 30 });

console.log('requested:', picked.join(' '));
console.log('placed   :', p.entries.map(e => e.number + (e.direction === 'across' ? 'A' : 'D') + '=' + e.answer).join(' '));
console.log('unplaced :', p.unplaced.map(u => u.answer).join(' ') || '(none)');
console.log(p.rows + ' x ' + p.cols);
for (let row = 0; row < p.rows; row++) {
  console.log(String(row).padStart(2) + ' ' + p.grid[row].map(ch => ch || '·').join(' '));
}
console.log('entries:');
for (const e of p.entries) console.log('  ', e.number, e.direction, e.answer, 'at', e.row + ',' + e.col, 'clue=' + e.clue);