# -*- mode: python ; coding: utf-8 -*-
"""Build on Windows x64; PyInstaller cannot cross-compile a Windows EXE on Linux."""

import shutil
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, copy_metadata

root = Path(SPECPATH)
documents = ("README.md", "START-HERE.txt", "RUN-FIRST-AR.html", "HTML-GUIDE.md", "WHITEBOARD-GUIDE.md", "KIDS-GUIDE-AR.md", "EGYPTIAN-VOICES-AR.md", "BRITISH-ENGLISH-AR.md", "FINAL-RELEASE-AR.md", "UI-ORGANIZATION-AR.md", "LICENSE", "THIRD_PARTY.md")
datas = [(str(root / "assets"), "assets")]
datas += [(str(root / filename), ".") for filename in documents]
# Include the bundled Arabic diacritizer, eSpeak dictionaries and their notices.
# Do not collect Piper's training stack or language data requiring extra downloads.
datas += collect_data_files(
    "piper", excludes=["train/**", "hebrew/**", "templates/**", "img/**"]
)
for distribution in (
    "piper-tts", "lameenc", "PySide6", "PySide6_Essentials", "PySide6_Addons",
    "shiboken6", "onnxruntime", "numpy", "pathvalidate", "flatbuffers", "protobuf", "packaging", "soxr",
):
    datas += copy_metadata(distribution)

analysis = Analysis(
    [str(root / "run.py")],
    pathex=[str(root)],
    binaries=collect_dynamic_libs("piper") + collect_dynamic_libs("soxr"),
    datas=datas,
    hiddenimports=["piper.espeakbridge", "piper.tashkeel", "lameenc"],
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "tkinter", "piper.train", "piper.http_server", "piper.download_voices",
        "piper.phonemize_chinese", "piper.g2pw_onnx", "piper.phonemize_hebrew",
        "piper.phonemize_japanese", "piper.phonemize_thai",
        "PySide6.QtWebEngineCore", "PySide6.QtWebEngineWidgets",
    ],
    noarchive=False,
)
archive = PYZ(analysis.pure)
exe = EXE(
    archive,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="NovaVoice",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon=str(root / "assets" / "icon.ico"),
)
collection = COLLECT(
    exe, analysis.binaries, analysis.datas, strip=False, upx=False, name="NovaVoice",
)
# Keep documentation, voice import location, and this app's corresponding source
# visible next to the EXE (not hidden only inside PyInstaller's _internal folder).
output = Path(DISTPATH) / "NovaVoice"
for filename in documents:
    shutil.copy2(root / filename, output / filename)
(output / "voices").mkdir(exist_ok=True)
shutil.copy2(root / "voices" / "README.md", output / "voices" / "README.md")
source = output / "source"
source.mkdir(exist_ok=True)
for directory in ("nova_voice", "tools", "assets", "tests", "examples", "web-tests"):
    shutil.copytree(
        root / directory,
        source / directory,
        ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", ".ruff_cache", "node_modules"),
        dirs_exist_ok=True,
    )
for filename in (
    "run.py", "pyproject.toml", "requirements.txt", "requirements-dev.txt", "NovaVoice.spec",
    "EGYPTIAN-VOICES-AR.md", "UI-ORGANIZATION-AR.md",
    "README.md", "START-HERE.txt", "RUN-FIRST-AR.html", "HTML-GUIDE.md", "WHITEBOARD-GUIDE.md", "KIDS-GUIDE-AR.md", "LICENSE", "THIRD_PARTY.md", "Setup-Windows.bat",
    "Run-Windows.bat", "Download-Arabic-Voice.bat", "Download-English-Voice.bat", "Build-Windows.bat",
):
    shutil.copy2(root / filename, source / filename)
(source / "voices").mkdir(exist_ok=True)
shutil.copy2(root / "voices" / "README.md", source / "voices" / "README.md")
