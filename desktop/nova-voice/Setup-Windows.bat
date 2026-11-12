@echo off
setlocal
cd /d "%~dp0"
echo Nova Voice - first-time setup (Windows x64)
echo Internet is needed unless you prepared the wheelhouse folder.
echo.
if exist ".venv\Scripts\python.exe" goto install
where py >nul 2>nul
if errorlevel 1 goto no_python
for %%V in (3.12 3.11 3.13) do (
    py -%%V -c "import struct; assert struct.calcsize('P') == 8" >nul 2>nul
    if not errorlevel 1 (
        py -%%V -m venv .venv
        if errorlevel 1 goto failed
        goto install
    )
)
:no_python
echo Install Python 3.12 64-bit with the Python launcher, then run this file again.
echo https://www.python.org/downloads/windows/
pause
exit /b 1
:install
set "PIP_SOURCE="
if exist "wheelhouse\*.whl" set "PIP_SOURCE=--no-index --find-links=wheelhouse"
".venv\Scripts\python.exe" -m pip install %PIP_SOURCE% --only-binary=:all: -r requirements.txt
if errorlevel 1 goto failed
echo.
echo Setup complete.
echo 1. Run Download-Arabic-Voice.bat and/or Download-English-Voice.bat ONCE online.
echo    Alternatively, import voice files from USB. Each dialogue role needs a matching voice.
echo 2. Run Run-Windows.bat. Conversion then works without internet.
pause
exit /b 0
:failed
echo.
echo Setup failed. Check the error above and try again.
pause
exit /b 1
