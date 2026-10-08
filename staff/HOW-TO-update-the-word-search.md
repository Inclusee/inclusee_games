# How to update the word search

**Who this is for:** anyone on the activities or support team. No coding, no special software.
**What you need:** a computer with Notepad (or Word), and about five minutes.

You are editing a plain list of words. The game builds the letter grid around
them. **You never draw a grid and you never say where a word goes.**

---

## The 30-second version

1. Open the `words` folder in HubSpot.
2. Copy the file called `_template.txt`.
3. Rename the copy to the date you want it to appear, e.g. `2026-10-10.txt`.
4. Open it and replace the words in the list. **One word per line.**
5. Save and publish it in HubSpot.

If the date is not obvious, remember it is **year-month-day**: `2026-10-10.txt`
is the 10th of October 2026.

---

## Writing the word list

A word search file is just a title and a list of words:

```
#Title: In the Garden
#Directions: easy

ROSEMARY
MULCH
TROWEL
GARDEN
```

That is the whole format. Things you do **not** need to worry about:

| What you write | What the game does |
|---|---|
| `rosemary`, `Rosemary`, `ROSEMARY` | all fine, it tidies them up |
| `tea pot` or `TEA-POT` | becomes `TEAPOT` |
| A line starting with `#` | treated as a note for us, never shown to players |
| A blank line | skipped |
| The order of the words | shuffles them to fit — no need to arrange anything |

The only real rules:

- **One word per line.** Do not write clues, and do not write `SOMETHING = SOMETHING`.
  (That is the crossword format. If you do it by accident the checker tells you.)
- Words must be **3 to 12 letters**.
- **8 to 12 words** gives the nicest grid.
- Do not use the same word twice.

---

## Tips from the activity team

- **Keep the words short where you can.** 4 to 7 letters is the sweet spot. Long
  words force a wider grid, which makes every letter smaller.
- **Avoid look-alikes.** SEED and SEEDS, or POT and SPOT, are very hard to tell
  apart once they are mixed in with other letters. The checker warns you about
  these.
- **Plenty of words in common.** Garden, kitchen, seasons, animals, local places,
  music, holidays, the news — anything people will recognise instantly.
- **A theme makes it much more enjoyable** than a random list.

---

## How hard the puzzle is

One line in the file controls this:

```
#Directions: easy
```

| Setting | What it means |
|---|---|
| `easy` | Across and down only. **This is the default and the friendliest.** |
| `normal` | Also diagonally |
| `all` | Also words running backwards |

If you leave the line out, or spell it wrong, the game uses `easy`. There is no
way to break it with a typo.

---

## Checking it before you publish

**Double-click `tools\check-puzzle.bat`.** It checks every crossword and every
word search, and shows you the finished grid so you can see it before residents do:

- **✓ Ready to publish** — nothing to do.
- **✗ problems** — it names the line number and what is wrong.
- **Notes (not errors)** — worth reading. It will tell you if there are only a few
  words, or if two words look alike.

**In the browser**, add `?staff=1` to the end of the address. A box appears at the
bottom showing which file loaded, how many words are hidden, how big the grid is,
and whether any words overlap.

---

## If you make a mistake

Nothing breaks. A bad line is **skipped**, and the rest of the puzzle still plays.
A note about what was skipped is kept for staff only, so residents never see a
half-broken puzzle or a complaint about your typo.

---

## What happens on a day with no word search

The game looks for today's file. If it is not there it quietly works backwards up
to three weeks and uses the most recent one. If it still finds nothing, it shows a
saved sample rather than an empty page.

**In practice:** load a fortnight of word searches before you go on leave and they
will appear on the right days. There is no schedule to maintain.

---

## Quick reference

| Task | What to do |
|---|---|
| Add a word search for the 10th of October 2026 | Copy `_template.txt`, rename to `2026-10-10.txt` |
| Change today's word search | Edit today's file and save |
| Give it a heading | Add `#Title: Your heading` at the top |
| Make it easier or harder | `#Directions: easy`, `normal` or `all` |
| Add a note to ourselves | Start the line with `#` |
| Check everything before publishing | Double-click `tools\check-puzzle.bat` |
| See which file loaded | Add `?staff=1` to the game's web address |
| Remove a word search | Delete its file — the game falls back to the previous day's |

---

## One important thing about folder names

**HubSpot file paths are case-sensitive.** `Wordsearch/Words` and `wordsearch/words`
are different folders to HubSpot, and only one of them is the right one.

This matters because nothing visibly breaks if the name is wrong: the game quietly
falls back to the copy that ships with it, so residents still get a puzzle — it is
just not the one you wrote. If your edits are not appearing, this is the first thing
to check.

The correct folders are:

| Game | Folder |
|---|---|
| Crossword | `Games/crossword/puzzles` |
| Word search | `Games/Wordsearch/Words` |

Note they really are different: the crossword folder is lower case, the word search
one is not. Do not rename either folder — the game looks for these exact names.

To check which folder was actually used, add `?staff=1` to the game's web address. If
it says the copy that ships with the game is being shown, the folder name is wrong.

## Common problems

| What you see | What it usually means |
|---|---|
| A word you listed is not in the grid | That line was skipped. Run the checker to see which line and why |
| The grid looks big and the letters small | Too many words, or words that are too long. Aim for 8 to 12 words of 4 to 7 letters |
| "Today's word search isn't available just yet" | No word file was found at all. Check the file is in the `words` folder and the name looks exactly like `2026-10-10.txt` |
| Residents see yesterday's word search | Today's file is missing, or the name has a typo — the game is falling back |
| Two similar words are hard to spot | That is what the checker warns about. Swap one of them |
| A fixed typo will not go away | Give it a few minutes and reload. The games always ask the server for the newest copy, but HubSpot can hold one briefly |
