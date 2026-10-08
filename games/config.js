/* ============================================================================
   Inclusee Games - settings
   ----------------------------------------------------------------------------
   The only file that changes when the puzzles move somewhere else. Everything
   else in the games folder can be left alone.

   puzzleSource
     Where the puzzle files live. A folder path relative to the game, a path on
     this web server, or a full https:// address. Example:
       'puzzles/'
       '/games/crossword/puzzles/'
       'https://example.org/games/puzzles/'

   puzzleSourceTemplate
     Use this instead of puzzleSource when the full address of each file cannot
     simply be the folder plus the file name - for example when the files are
     held in a system that needs a suffix on the end. Two words are replaced:
       {name}  the whole file name, e.g. 2026-09-25.txt
       {date}  just the date,        e.g. 2026-09-25
     Example:
       'https://example.org/puzzles/{date}.txt?download=1'

   Leave puzzleSourceTemplate as null to use puzzleSource.
   ========================================================================== */
window.INCLUSEE_CONFIG = {

  // --------------------------------------------------------------------------
  // HubSpot is where the puzzle files live. Verified 2026-10-02: HubSpot sends
  // "Access-Control-Allow-Origin: *", so the game can read these files even
  // though the game itself is served from a different address. This is the one
  // and only place the puzzle location is set.
  //
  // Staff: normal editing happens in HubSpot, not here. See the staff guide.
  // --------------------------------------------------------------------------
  // Case-sensitive too: this folder really is lower case, unlike the word search.
  puzzleSource: 'https://6860964.fs1.hubspotusercontent-ap1.net/hubfs/6860964/Inclusee%20Theme%202025/Games/crossword/puzzles/',

  // Use this instead of puzzleSource when the full address of each file is not
  // simply the folder plus the file name. {name} = 2026-09-25.txt,
  // {date} = 2026-09-25. Example:
  //   'https://example.org/download.aspx?path={date}.txt'
  puzzleSourceTemplate: null,

  // --------------------------------------------------------------------------
  // The word search keeps its word lists in the same HubSpot area, in its own
  // folder. Create the folder there and upload the .txt files from
  // games/wordsearch/words/. Until it exists, the game quietly uses the copies
  // that ship beside it, so the page is never empty.
  // --------------------------------------------------------------------------
  // NOTE: HubSpot file paths are case-sensitive. This is the exact spelling of
  // the folder as it exists there ("Wordsearch/Words", not "wordsearch/words").
  // A path in the wrong case does not error - it 404s, and the game quietly
  // falls back to the copy that ships beside it, so a typo here looks like
  // "staff edits are not appearing" rather than "the folder name is wrong".
  wordSearchSource: 'https://6860964.fs1.hubspotusercontent-ap1.net/hubfs/6860964/Inclusee%20Theme%202025/Games/Wordsearch/Words/',

  // Optional, same idea as puzzleSourceTemplate above.
  wordSearchTemplate: null
};
