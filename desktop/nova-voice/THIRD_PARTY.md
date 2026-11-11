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


## Local whiteboard character artwork

The six SVG children under `assets/characters/` are original vector artwork created
for Nova Voice and are distributed under this app's GPL-3.0-or-later license.
They do not use licensed cartoon franchises, remote images, generated video, or
an additional model. Their decorative CSS motion does not represent lip sync or
voice identity. No third-party character/image dependency is introduced.


## Development-only codec measurement

`miniaudio` **1.72** (MIT; https://github.com/irmen/pyminiaudio) is pinned in
`requirements-dev.txt` / the dev extra only. Its installed distribution carries
its own license notices, including those for its bundled decoder components.
It decodes deterministic MP3 test files for `tools/measure_mp3_delay.py` and the
Python tests. Neither the app's rendering pipeline nor its offline HTML imports
it; it is not a new playback backend or runtime dependency.

## Optional scene planning and local symbols (0.6.0)

The ten simple symbols and procedural SVG primitives in `whiteboard-scenes.js`
are original Nova Voice artwork/code under GPL-3.0-or-later, not a third-party
image library. No LLM weights or SDK are bundled. The optional, consent-only
OpenRouter API uses Python's standard library; service/model/provider terms
apply separately (https://openrouter.ai/terms, https://openrouter.ai/privacy).
Free access, output accuracy, downstream licensing and regional/age eligibility
are not guaranteed by this application. Exported HTML never calls that API.

## Optional Google Gemini (AI Studio) planner (0.16 source preview)

Google Gemini via the Gemini API / AI Studio uses Python's standard library;
Google's terms apply separately (https://ai.google.dev/gemini-api/terms,
https://aistudio.google.com). Unlike the OpenRouter path, the app cannot enforce
zero-cost or ZDR on the free tier; Google may use free-tier prompts/responses to
improve its products and human reviewers may read them. No Gemini SDK is bundled.
Free access, output accuracy, regional/age eligibility and AI Studio quotas are
not guaranteed by this application. Exported HTML never calls that API.

## Optional external video converter (0.9 source preview)

The H.264/AAC converter runs an explicitly selected, trusted local FFmpeg executable.
No executable/FFmpeg distribution, libx264, ffprobe, imageio-ffmpeg package or automatic
installer/downloader is bundled or added to the app requirements. Qt's internal
media libraries do not imply an available FFmpeg command-line executable.
Review the license/build options of your chosen FFmpeg and its codecs (including
libx264) before use/redistribution; this source handoff does not redistribute them.
Conversion is offline and optional. Development-only FFmpeg/Playwright/PDF tooling
is not a runtime dependency or proof of native Windows/device/real-voice behavior.


## 0.10.0.dev1 offline capability guide

The Arabic capability catalog, prompt builder, native tab, HTML, CSS and JavaScript
are authored in this project and use its license. No Ministry PDF text, curriculum
assets, live-model output, external fonts/icons, OCR engine, provider SDK or new
runtime dependency is bundled. Examples are authored demonstrations, not source
quotations or evidence of live inference. The standalone guide makes no network
requests or automatic storage; copying to another service is a separate user act.

## Owned composition renderer (0.11)

`whiteboard-graph.js`, `scene_graph.py` and the composition demo are original Nova
Voice procedural code/artwork under this app's GPL-3.0-or-later license. No new
third-party library, LLM/3D weights, external animation, image or texture is added.
The SVG projection is an illustrative 2.5D surface, not GIS data or a scientific
model. Cloud planner/provider terms above remain separate; a renderer is not a
natural-language inference service. Developer Chromium/Playwright/FFmpeg tools,
reports and diagnostic media are not bundled with the application/source handoff.


## Optional Game-icons artwork (0.12 source preview)

This is an **asset collection, not an installed rendering engine**. Konva, Three,
Pixi, Lottie and Spine are NOT dependencies or runtime downloads of this change.
The existing local renderer remains the default. The optional language planner
may select vetted IDs from the script; the teacher does not pick subject/animal
artwork from a catalogue. No unrestricted image search is implemented.

The 16 audited SVG files below are from `game-icons/icons`, pinned commit
`82d948812bfe3f269ef8f731dcdb07b08160edc4` (2026-04-23). Upstream's notice identifies
these authors' work as **Creative Commons Attribution 3.0 (CC BY 3.0)**, not MIT
or the app's GPL. The CC0 exceptions in upstream's general notice are not the
contributors selected here. Keep attribution, original source, licence link and
modification notices with reused artwork, independently of the code licence.

Licence: https://creativecommons.org/licenses/by/3.0/
Upstream notice (also retained verbatim after a source header in
`assets/licenses/game-icons-notice.txt`):
https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/license.txt

| Audited file / original source | Attribution |
| --- | --- |
| [skoll/atom.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/skoll/atom.svg) | Icons made by Skoll |
| [lorc/butterfly.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/butterfly.svg) | Icons made by Lorc |
| [lorc/compass.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/compass.svg) | Icons made by Lorc |
| [caro-asercion/fox.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/caro-asercion/fox.svg) | Icons made by Caro Asercion |
| [lorc/gears.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/gears.svg) | Icons made by Lorc |
| [lorc/hourglass.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/hourglass.svg) | Icons made by Lorc |
| [lorc/magnet.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/magnet.svg) | Icons made by Lorc |
| [lorc/magnifying-glass.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/magnifying-glass.svg) | Icons made by Lorc |
| [lord-berandas/microscope.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lord-berandas/microscope.svg) | Icons made by Lord Berandas |
| [lorc/mountains.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/mountains.svg) | Icons made by Lorc |
| [lorc/open-book.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/open-book.svg) | Icons made by Lorc |
| [lorc/scales.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/scales.svg) | Icons made by Lorc |
| [lorc/sprout.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/sprout.svg) | Icons made by Lorc |
| [delapouite/telescope.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/delapouite/telescope.svg) | Icons made by Delapouite |
| [lorc/test-tubes.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/lorc/test-tubes.svg) | Icons made by Lorc |
| [sbed/water-drop.svg](https://github.com/game-icons/icons/blob/82d948812bfe3f269ef8f731dcdb07b08160edc4/sbed/water-drop.svg) | Icons made by Sbed |

For rendered derivatives, **background removed; foreground recolored and uniformly
scaled by Nova Voice**. Only the pinned numeric foreground paths are used; upstream
markup/scripts/styles are never embedded or executed. Static silhouettes are not
articulated actors or scientifically verified diagrams. The catalogue records raw
file SHA-256/size, Git blob ID and canonical normalized drawing fingerprint.

The two prepared resources in `examples/secondary-source-demo.{json,html}` retain
complete per-resource attribution. The original SVGs in
`tests/fixtures/secondary-raw/` are unmodified audit fixtures, not a runtime cache
or automatically selected/downloaded artwork. Their above source/author/licence
notices apply to redistribution too. Local fallbacks are newly authored original
geometry, not copied/stripped external art. A missing or failed resource never
triggers a paid service or an unknown source.

Prepared plan JSON and offline HTML retain immutable credit metadata; print output
retains a credit section, and Canvas video adds a seven-second silent credit card
for each actually embedded resource in the exported scope. Keep these cards when
redistributing/converting the video. Clearing the local cache does not erase the
credits or artwork already embedded in exported files. The optional public GitHub
GET has separate per-request consent and sends no lesson, audio or API key; no
GitHub authentication is needed. Review [SECONDARY-SOURCES-AR.md](SECONDARY-SOURCES-AR.md)
for the bounded importer, fallback, cache and privacy details.


## Optional Microsoft Azure Speech (0.15 source preview)

The optional real-time standard Neural TTS client uses Python's standard-library
HTTPS/XML facilities, not an Azure SDK, copied voice model, hosted browser API or
new dependency. Microsoft service, account, privacy and output-use terms apply
separately; GPL licensing of this client does not grant a Speech subscription or
certify model/output rights. No cloud voice weights or real Azure-generated sample
is redistributed here. Consult Microsoft's current Speech pricing and responsible-AI
privacy documentation linked from `AZURE-SPEECH-AR.md`.

Piper is still the default and retains its license/notices. A user-entered Speech
key cannot prove SKU/balance. The F0 checkbox is user attestation, not billing
verification: an S0 resource may incur charges even if wrongly attested as F0.
No account creation, billing upgrade, retry or fallback is performed by this client.
Tests inject dummy credentials/PCM; no live cloud or native Windows validation is
claimed. Exported Nova whiteboards contain local audio, never a cloud key/client.
