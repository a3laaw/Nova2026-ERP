@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Please run Setup-Windows.bat first.
    pause
    exit /b 1
)
echo This is an OPTIONAL one-time ONLINE English voice setup from the official Piper repository.
echo The desktop app never runs this downloader automatically.
echo Downloading Lessac for English narration or a bilingual dialogue...
".venv\Scripts\python.exe" tools\download_voice.py en_US-lessac-medium --output voices
if errorlevel 1 goto failed
echo.
choice /C YN /M "Download Amy too (a second English voice for an English-only dialogue)?"
if errorlevel 2 goto done
".venv\Scripts\python.exe" tools\download_voice.py en_US-amy-medium --output voices
if errorlevel 1 goto failed
:done
echo Read each MODEL_CARD before using or redistributing the voice.
pause
exit /b 0
:failed
pause
exit /b 1
