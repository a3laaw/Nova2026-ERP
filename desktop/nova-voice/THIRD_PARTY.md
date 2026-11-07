# Licenses and redistribution

The **standalone desktop app in this directory only** is GPL-3.0-or-later because it
uses the GPL version of Piper. This does not change the ERP's licensing. See `LICENSE`.
No warranty is provided. Corresponding app source and build scripts accompany the
portable application in `source/`.

Runtime components (also see each installed distribution's license files):

| Component | Version | License / source |
| --- | --- | --- |
| Piper | 1.8.0 | GPL-3.0-or-later — https://github.com/OHF-Voice/piper1-gpl/tree/v1.8.0 |
| eSpeak NG (embedded by Piper) | Piper wheel's version | GPL-3.0-or-later — https://github.com/espeak-ng/espeak-ng |
| libtashkeel Arabic diacritizer (bundled by Piper) | Piper wheel's version | MIT — https://github.com/mush42/libtashkeel |
| PySide6, Qt and Shiboken | 6.10.2 | LGPL-3.0 / GPL as applicable; additional Qt module notices apply — https://github.com/pyside/pyside-setup/tree/v6.10.2 and https://github.com/qt/qt5/tree/v6.10.2 |
| lameenc / LAME | 1.9.0 / bundled version | LGPL-3.0-or-later / LGPL-2.0-or-later — https://github.com/chrisstaite/lameenc/tree/v1.9.0 |
| ONNX Runtime | 1.31.1 | MIT — https://github.com/microsoft/onnxruntime |
| NumPy | 2.4.6 | BSD-3-Clause and bundled-library notices — https://github.com/numpy/numpy |
| python-soxr / libsoxr | 1.0.0 / bundled version | LGPL-2.1-or-later — https://github.com/dofuuz/python-soxr |
| pathvalidate | 3.3.1 | MIT — https://github.com/thombashi/pathvalidate |
| FlatBuffers | 25.12.19 | Apache-2.0 — https://github.com/google/flatbuffers |
| Protocol Buffers | 7.36.2 | BSD-3-Clause — https://github.com/protocolbuffers/protobuf |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause — https://github.com/pypa/packaging |
| Python | Build environment's Python 3.11–3.13 | PSF license — https://github.com/python/cpython |

Qt's media backend can include FFmpeg. Review the license files shipped with the
PySide6 wheels for those libraries and codecs. PyInstaller is a build-time tool
(GPL with a bootloader exception); see https://github.com/pyinstaller/pyinstaller.

The `.spec` includes installed distribution metadata/license files and Piper's
resource notices. For redistribution, retain those notices and satisfy all
applicable corresponding-source and LGPL/GPL obligations for bundled native
libraries, including modified versions. Package source distributions for the exact
versions can be obtained from https://pypi.org; Qt/eSpeak and other bundled native
components may need their corresponding upstream sources too. A list of links
alone is not a substitute for any source-delivery obligations.

## Voice models

No trained voice model is bundled in Git or in the default EXE artifact. Model
licenses are separate from Piper. Inspect each voice's **MODEL_CARD** before
personal/commercial use or redistribution. The optional setup downloader saves the
model card with the verified model/config pair; importing a voice preserves an
adjacent MODEL_CARD when present. The app does not claim that all voices are
commercially usable and does not clone voices.

## Tiny test fixture

`tests/fixtures/test_voice.onnx` generates silence, not speech. Its provenance and
GPL license are documented in `tests/fixtures/README.md`.
