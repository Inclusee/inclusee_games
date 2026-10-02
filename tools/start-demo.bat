@echo off
title Inclusee Games - demo
cd /d "%~dp0.."
echo.
echo   Starting the Inclusee Games demo. Your browser will open in a moment.
echo   To stop the demo, close this window (or press Ctrl+C).
echo.
start "" http://127.0.0.1:8777/games/
python -m http.server 8777 --bind 127.0.0.1
pause
