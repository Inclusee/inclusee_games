# How to update the daily crossword

**Who this is for:** anyone on the activities or support team. No coding, no special software.
**What you need:** a computer with Notepad (or Word), and about ten minutes.

You are editing a plain text file. The game reads that file and builds the grid,
the numbers and the little arrows for you. You never draw a grid and you never
number a clue.

---

## The 30-second version

1. Open the `puzzles` folder.
2. Copy the file called `_template.txt`.
3. Rename the copy to the date you want it to appear, e.g. `2026-10-01.txt`.
4. Open it and replace the clues with your own. One clue per line:

   ```
   The room where you cook the meals = KITCHEN
   ```

5. Save the file. Done.

If the date in the file name is not obvious, remember it is **year-month-day**:
`2026-10-01.txt` is the 1st of October 2026.

---

## Writing a clue

Every line needs three things: **the clue, an equals sign, and the answer.**

```
A pet that purrs = CAT
```

Things you do **not** need to worry about:

| What you write | What the game does |
|---|---|
| `cat`, `Cat` or `CAT` | all fine — it tidies the answer up itself |
| `tea pot` or `TEA-POT` | becomes `TEAPOT` (spaces and hyphens are removed) |
| A line starting with `#` | treated as a note for us, never shown to residents |
| A blank line | skipped |
| `ACROSS` or `DOWN` next to a clue | not needed — the game works out the direction |
| The order of your clues | shuffles them to fit — no need to arrange anything |

The only real rules:

- Answers must be **3 to 15 letters**.
- **8 to 14 clues** per puzzle makes the nicest grid.
- One answer cannot be used twice in the same puzzle.
- Answers should be single words, or two words written as one (`ICECREAM` is fine).

---

## Clue writing tips from the activity team

- **Plain English.** No trick questions, no riddles. Write for a general audience.
- **Mix the lengths.** Two or three longer answers (7–9 letters) plus several short
  ones (3–5 letters) makes a much better grid than twelve long words. Twelve long
  words is also slower for the game to lay out.
- **Keep a clue to about one line** on screen — under roughly 100 characters.
- **Local and everyday subjects go down best:** the garden, the kitchen, the weather,
  places nearby, first names, seasons, food, animals, music.
- **A good clue can be finished on its own.** "Frozen water" beats "H₂O in its solid
  state".
- **Avoid anything that changes with time** — "this year's winner", "the current
  Prime Minister". Puzzles stay on the server, and someone may open an old one.

### Themes to save you thinking

Kitchen and cooking · In the garden · Around the house · Weather and seasons ·
Australian animals · Food and shopping · Music and dancing · Films and television ·
Travel and holidays · The beach · Art and craft · Family and friends

---

## Checking it before you publish

**Double-click `tools\check-puzzle.bat`.** It reads every puzzle in the folder and
tells you two things:

- **✓ Ready to publish** — nothing to do.
- **✗ problems** — it names the line number and what is wrong, for example:

  ```
  line 7: the answer "GARDEN" is already used on line 3
  line 11: no "=" between the clue and the answer
  ```

**In the browser**, add `?staff=1` to the end of the crossword address, for example
`.../crossword/?staff=1`. A box appears at the bottom showing which puzzle file
loaded, how many answers were placed, and a **Fill in every answer** button you can
use to check the whole thing or print an answer key. Residents never see this box —
it only appears when someone deliberately asks for it.

---

## If you make a mistake

Nothing breaks. Bad lines are **skipped**, and the rest of the puzzle still plays.
A note about what was skipped is kept for staff, so residents are never shown a
half-broken puzzle or told off for your typo.

The two things worth checking for after a typo:

- the puzzle has fewer answers than you wrote (a line was skipped);
- an answer you expected is missing.

The checker will point at both.

---

## Titles and dates

You can set the heading residents see. Put these at the very top of the file:

```
#Title: Around the House
#Date: 2026-10-03
```

If you leave the `#Title` line out, the heading is simply "Daily Crossword".

**Careful with `#Date` when copying an old puzzle.** The file *name* decides which day
the puzzle appears, and it always wins. The `#Date` line is only for the heading. If
you copy last week's file and forget to change it, the puzzle still appears on the
right day, but the heading says the old date. The checker warns you about this, and so
does the game's `?staff=1` view.

---

## What happens on a day with no puzzle

The game looks for today's file. If it is not there, it quietly works backwards up to
three weeks and uses the most recent puzzle it can find. If it still finds nothing, it
shows a saved sample puzzle rather than an empty page.

**In practice this means:** if you want to load a fortnight of puzzles before going on
leave, just drop the files in. There is no schedule to maintain, and nothing to switch
on.

---

## Where the puzzle files are kept

The folder that needs to be on the web server:

```
games/crossword/
├─ index.html          the game itself
├─ puzzles/            ← the only folder you touch day to day
│  ├─ 2026-09-25.txt       one file per day
│  ├─ sample.txt           fallback, so the page is never empty
│  └─ _template.txt        your copy-me starting point
├─ js/  css/           leave these alone
```

Once a puzzle file is on the server, that is it — no publishing step, no rebuild,
nothing to restart.

### Moving the puzzles somewhere else

The puzzle location is one line in `games/config.js`. Nothing else changes:

```
window.INCLUSEE_CONFIG = {
  puzzleSource: 'puzzles/',
  puzzleSourceTemplate: null
};
```

Set `puzzleSource` to a folder — either a folder on the same website, or a full web
address ending in a slash:

```
puzzleSource: 'https://example.org/shared/puzzles/'
```

If the full address of each file is not simply the folder plus the date, use
`puzzleSourceTemplate` instead and put `{date}` where the date belongs:

```
puzzleSourceTemplate: 'https://example.org/download.aspx?path={date}.txt'
```

`{name}` also works, meaning the whole file name including `.txt`.

### The puzzles live in HubSpot (current arrangement)

The puzzle files are kept in HubSpot, in this folder:

```
Inclusee Theme 2025 / Games / crossword / puzzles
```

Nothing else needs to move. The games themselves stay on the website; only the
puzzles are read from HubSpot. Adding or changing a puzzle in HubSpot is all that is
needed — there is no publishing step on the website side.

**To add or change a puzzle:**

1. In HubSpot, open the folder above and find (or upload) the file for that date.
2. Edit it and publish the change in HubSpot.
3. That is it. Residents see it on the right day.

Two things to know about HubSpot:

- HubSpot remembers a copy of each file for a while. If you fix a typo and residents
  still see the old text, that is why — it clears on its own within a day.
- Upload the file with the date as its name, for example `2026-10-03.txt`. The file
  name is what decides which day the puzzle appears.

### Why not SharePoint

SharePoint cannot be used, and this is not something we can fix in the game. Asking
SharePoint for a file returns "not allowed" (error 403), because files there need a
sign-in, and a web page cannot sign in on a resident's behalf. Opening the folder link
in a browser shows a Microsoft sign-in screen for the same reason.

If the team prefers to keep working in SharePoint, the workable arrangement is to keep
the master copies there and copy the finished file into the HubSpot folder above.

### If residents see "Today's crossword isn't available just yet"

Add `?staff=1` to the crossword address. The box at the bottom lists every address the
game tried and what happened:

- **"could not be reached at all"** — the game could not talk to that server. Usually
  an address is wrong, or the other server is refusing to share its files.
- **"the server said not allowed"** — the file exists but is not shared publicly.
- **nothing listed** — the game reached the folder but found no puzzle. Check the file
  name is exactly `YYYY-MM-DD.txt`.

---

## Quick reference

| Task | What to do |
|---|---|
| Add a puzzle for the 3rd of October 2026 | Copy `_template.txt`, rename to `2026-10-03.txt` |
| Change today's puzzle | Edit today's file and save |
| Give the puzzle a heading | Add `#Title: Your heading` at the top |
| Write a clue | `Your clue text = ANSWER` |
| Write a note to ourselves | Start the line with `#` |
| Check everything before publishing | Double-click `tools\check-puzzle.bat` |
| See a puzzle in detail | Add `?staff=1` to the crossword's web address |
| Remove a puzzle | Delete its file — the game falls back to the previous day's |
| Move the puzzle files somewhere else | Change one line in `games/config.js` |
| Add or edit a puzzle in HubSpot | Edit the file in the folder above and publish it there |
| Find out why no puzzle loaded | Add `?staff=1` to the crossword address |

---

## Common problems

| What you see | What it usually means |
|---|---|
| "Today's crossword isn't available just yet" | No puzzle file was found at all. Check the file is in the `puzzles` folder and the name looks exactly like `2026-10-03.txt` |
| Residents see yesterday's puzzle | Today's file is missing, or the name has a typo — the game is falling back |
| "This page could not fetch a puzzle file" | The puzzle folder is somewhere the page is not allowed to read — check `?staff=1` |
| A fixed typo will not go away | HubSpot is still serving its saved copy — it clears within a day |
| The heading shows the wrong date | The `#Date` line was left over from a copied file. The file name is correct |
| "(sample puzzle)" next to the heading | No dated puzzle could be read, so the bundled sample is showing |
| One of your clues is missing from the puzzle | That line was skipped. Run the checker to see which line and why |
| The grid looks long and thin | Add some shorter answers. A mix of 3–5 letter and 7–9 letter answers gives a tidier square |
| A clue is cut off on a tablet | The clue is too long — aim for under about 100 characters |
| The answer will not fit in the puzzle at all | It is probably longer than 15 letters, or the same answer is already used |
