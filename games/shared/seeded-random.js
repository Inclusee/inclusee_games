/* ============================================================================
   Inclusee Games - repeatable randomness
   ----------------------------------------------------------------------------
   Every puzzle is built from a seed (usually the puzzle's date), so that the
   same file produces the same grid for every resident, on every device, on every
   visit. Math.random() would give everyone a different puzzle and a resident
   would lose their place on a reload.

   xmur3 turns a string into a seed, mulberry32 turns that into a predictable
   sequence of numbers. Both are tiny and behave identically in every browser and
   in Node, which matters because the tools preview a grid that the game must
   then reproduce exactly.

   Shared by the crossword and the word search so there is one implementation to
   trust rather than two that can drift apart.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IncluseeSeededRandom = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** A string -> seed function. */
  function stringHash(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  /** makeRng(seed) -> function returning 0..1, always the same sequence. */
  function makeRng(seed) {
    var next = stringHash(String(seed));
    var a = next();
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** A seeded shuffle. */
  function shuffle(list, rng) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  /** A whole number from 0 up to but not including `limit`. */
  function intBelow(rng, limit) {
    return Math.floor(rng() * limit);
  }

  return { makeRng: makeRng, shuffle: shuffle, intBelow: intBelow };
}));