@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Please run Setup-Windows.bat first.
    pause
    exit /b 1
)
set "PIP_SOURCE="
if exist "wheelhouse\*.whl" set "PIP_SOURCE=--no-index --find-links=wheelhouse"
".venv\Scripts\python.exe" -m pip install %PIP_SOURCE% -r requirements-dev.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m pytest
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m PyInstaller --noconfirm NovaVoice.spec
if errorlevel 1 goto failed
echo.
echo Built: dist\NovaVoice\NovaVoice.exe
echo Keep the WHOLE NovaVoice folder, not only the EXE.
echo Copy the voice model folder into dist\NovaVoice\voices for a ready-offline bundle.
echo Review the voice MODEL_CARD and all license notices before redistributing.
echo.
set "ISCC="
where iscc >nul 2>nul && set "ISCC=iscc"
if not defined ISCC if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if defined ISCC (
    echo Inno Setup found - building the installer...
    "%ISCC%" installer\NovaVoice.iss
    if errorlevel 1 (
        echo Installer build FAILED; the portable dist\NovaVoice folder is still valid.
    ) else (
        echo Built: dist\NovaVoice-Setup-v0.17.0.dev1.exe
        echo Per-user installer, no admin needed; uninstall keeps your voices and library.
    )
) else (
    echo Inno Setup 6 not found - skipping the Setup.exe step.
    echo Install it once via: winget install --id JRSoftware.InnoSetup -e
    echo Then rerun this file; or double-click installer\NovaVoice.iss to build the installer.
    echo The portable app in dist\NovaVoice works without it.
)
pause
exit /b 0
:failed
echo Build failed. Check the error above.
pause
exit /b 1
