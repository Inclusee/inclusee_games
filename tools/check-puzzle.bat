@echo off
title Inclusee crossword checker
cd /d "%~dp0.."
echo.
echo   Checking every crossword puzzle in games\crossword\puzzles\ ...
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo   This checker needs Node.js, which is not installed on this computer.
  echo   You can still check a puzzle in the browser by adding ?staff=1 to the
  echo   crossword web address.
  echo.
  pause
  exit /b 1
)
node tools\check-puzzle.mjs games\crossword\puzzles\
echo.
echo   Scroll up to read the result. "Ready to publish" means you are done.
echo.
pause
