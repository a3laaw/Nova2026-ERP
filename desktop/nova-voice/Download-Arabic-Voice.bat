@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Please run Setup-Windows.bat first.
    pause
    exit /b 1
)
echo This is an OPTIONAL one-time ONLINE voice download from the official Piper repository.
echo The desktop app never runs this downloader automatically.
".venv\Scripts\python.exe" tools\download_voice.py ar_JO-kareem-medium --output voices
if errorlevel 1 (
    pause
    exit /b 1
)
pause
exit /b 0
