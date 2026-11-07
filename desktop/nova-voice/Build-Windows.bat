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
pause
exit /b 0
:failed
echo Build failed. Check the error above.
pause
exit /b 1
