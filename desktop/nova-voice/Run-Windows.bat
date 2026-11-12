@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Please run Setup-Windows.bat first. See START-HERE.txt.
    pause
    exit /b 1
)
rem Deliberately no pip, downloads or update checks during normal startup.
".venv\Scripts\python.exe" run.py
if errorlevel 1 (
    echo See %%LOCALAPPDATA%%\NovaVoice\app.log for details.
    pause
    exit /b 1
)
exit /b 0
