# HTML player controller tests

These isolated DOM tests use jsdom. They do not install dependencies in the ERP,
and Node is **not** needed by the desktop application or exported HTML.

```sh
npm ci --ignore-scripts
npm test
```

Set `NOVA_VOICE_PYTHON` to the Python executable with access to this source if
`python` is not the desired executable. Media/SVG geometry/encoding are mocked in
JSDOM. The current suite has **237 passing DOM cases**, including27 output and46
route/rotation cases. These are not listening, browser-codec, native Windows, or 4 GB tests.

## Current 0.9 motion/conversion checks

`npm test` includes **237 DOM cases** (27 output +46 route/rotation cases).
JSDOM simulates media: no encoder/listening/native claims. Shared strict motion
vectors are in `tests/fixtures/motion-cases.json`; no runtime Node dependency.

Optional real QA (supply your own local tools; never auto-downloaded):

```sh
NOVA_VOICE_PYTHON=/path/to/python \
NOVA_CHROMIUM=/path/to/chromium \
NOVA_FFMPEG=/path/to/trusted-ffmpeg \
NOVA_BROWSER_OUTPUT=/local/qa-output \
node browser-motion.cjs
```

Requires separately installed `playwright-core`. The 13 basic checks cover real
SVG/controller motion at360/768/1366px,20 static phase figures/all16 rows,PDF,
Blob→Python→offline reopen/fresh review,WAV reverse seek,actual WebM→CLI H.264
Main3.1/AAC-LC/faststart with full decode and encoded-timestamp440/660Hz alignment,
deliberate600ms main-thread stall cancellation and reduced motion. Tones, not speech.
Set `NOVA_OUTPUT_DELIVERABLES` to an explicit output directory to create the full
10-page A4 PDF and complete silent H.264 lesson sample (14 checks,~100s). The
filenames are0.9-only and do not overwrite published0.8 samples.

Python safety/metadata tests run without FFmpeg; real conversion/cancellation/limit
cases require explicit `NOVA_FFMPEG`. Full run with it:770passed/3Qt modules skipped.
The new Qt panel tests remain skipped here; compilation is not native evidence.
H.264/AAC metadata and full decode are verified; no phone/Windows playback claim.
No live AI, human voice/4GB/curriculum validation, EXE/Actions or ERP changes.

A parallel stress regression initially failed tone timestamps; it is recorded in
VIDEO-MOTION-AR.md, not counted as a pass. VP8 preference and a350ms frame/clock
lag guard were added; serial output regression and explicit stall-abort checks
pass. They do not prove the absence of all encoder underruns on all hardware.


## Existing controller coverage

- `player.test.cjs`, `exported.test.cjs`: arbitrary saved HTML audio wiring,
  playback/rates/opt-in animation linking, safe local restoration and fallback.
- `whiteboard.test.cjs`: writing, navigation, colors, six passive characters,
  bilingual layout, native disclosures, eraser, downloads and offline Python
  round trips. The fourth local shortcut leads to the new print/video section.
- `whiteboard-timing.test.cjs`: deliberately unequal controlled PCM rows, gaps,
  sample-clock seeking/rates, wrapping, reduced motion, dialogue roles, exact
  canonical SHA-256 consistency and invalid-timing behavior. MP3 decoder trimming
  is separately measured by Python/development-only miniaudio, not by JSDOM.
- `whiteboard-scenes.test.cjs`, `whiteboard-science.test.cjs`: bounded untrusted
  primitives, free-form authored examples (not keyword-routed templates), row
  onsets/until/entrance, sacred policy and literal text. No live model request.
- `whiteboard-full-lesson.test.cjs`: 20 cases for the authored ten-step complete
  lesson: exact non-narrated brief, strict schema-2 origin/hints/hashes, row cues,
  separate questions/answers, measured seeking and customized HTML -> Python ->
  offline reopen. Controlled PCM is silence, not human speech.

## Printing, animation and video contracts (0.8.0.dev1)

`whiteboard-output.test.cjs` adds **25 cases**:
- Fresh default-off review; whole-lesson printing/preview with all narration,
  display overrides, questions and separate answers; temporary diagram states,
  completed motion endpoints, ink mode and Ctrl+P notice before review.
- No source/manifest mutation or playback seeking; literal text insertion;
  invalid motion fails closed for both playback and output; saved customized HTML
  strips print DOM and review/progress state before Python import/offline reopen.
- Progressive SVG strokes, ordered icons, move and gentle pulse on the row sample
  clock; deterministic reverse seek/rates; explicit `none` and reduced motion.
- Stubbed MediaRecorder/Canvas/AudioContext: one-step/all-step export, silent mode,
  audio-track wiring, locking/restoration, bounded cancellation during hung decode,
  recorder errors, actual-type/container disagreement, output size cap, printing
  during export and hidden-page cancellation. No partial download after failure.
- Equal-length WebM duration metadata finalization without shifting any cluster.

**The fake video bytes in these tests are NOT encoded video.** Actual browser
encoding/decoding is covered by the optional script below. The HTML requires no
npm/CDN/server/Web Speech API or network at runtime.

## Optional real Chromium QA (not npm test)

Install **playwright-core** and a Chromium executable separately for development;
these scripts never download them and they are not desktop dependencies. Missing
system libraries must be configured by the development environment. No Windows
or native Qt claim follows from Linux Chromium passing.

### Existing complete-lesson QA

```sh
NODE_PATH=/path/to/development/node_modules \
NOVA_CHROMIUM=/path/to/chromium \
NOVA_VOICE_PYTHON=/path/to/source-environment/python \
NOVA_BROWSER_OUTPUT=/path/to/ignored/scratch \
node browser-full-lesson.cjs
```

`browser-full-lesson.cjs`: **36 checks**, authored example, 360/768/1366px real
SVG/font/layout and label bounds/non-overlap, row cues/pause/rates, separate
questions/answers, reduced motion, actual Blob download during erasure -> Python
-> offline reopen. Actual WAV decode/play/seek/save uses the existing 1602-byte
ONNX test model, which generates **silence**, not natural voice. If NOVA_CHROMIUM is
omitted the existing script can use a separately installed @sparticuz/chromium.
GPU is disabled in executable-path mode for this headless sandbox.

### New print / motion / actual video QA

```sh
NODE_PATH=/path/to/development/node_modules \
NOVA_CHROMIUM=/path/to/chromium \
NOVA_VOICE_PYTHON=/path/to/source-environment/python \
NOVA_BROWSER_OUTPUT=/path/to/ignored/output-scratch \
NOVA_FFMPEG=/optional/path/to/development/ffmpeg \
node browser-output.cjs
```

`browser-output.cjs` requires NOVA_CHROMIUM, and checks real SVG motion and pause,
responsive output UI, ten steps/sixteen rows/eight print snapshots and the exact
original brief, full A4 and ink PDFs, actual Blob/Python/offline reopen with fresh
review, PCM reverse seeking, temporary drawing snapshots, actual 720p WebM and
MP4 (only if the browser supports it) downloads, browser decode/seek/play, silent
video, real cancellation/no partial file, native reduced motion and unreviewed
Ctrl+P notice. It uses **440/660 Hz diagnostic tones**, never a human voice.

NOVA_FFMPEG is optional: an explicitly provided local development decoder verifies
full video decode and tone retention/alignment at row times on encoded timestamps,
preserving gaps with `aresample=async=1:first_pts=0`. Nothing installs or invokes
FFmpeg in the desktop app/browser exporter. MP4 from the tested browser contained
VP9/Opus; a genuine MP4 container is **not** a guarantee of H.264/AAC/device support.

Optional `NOVA_OUTPUT_DELIVERABLES=/path/to/requested/deliverables` additionally
creates the authored complete lesson's **A4 PDF and full silent WebM sample** via
the real browser workflow. This takes roughly the lesson's 71-second real-time
length; do not mistake a short diagnostic clip for the full lesson. The recorded
run with that option has **23 checks** (22 without it), Linux Chromium
153.0.8010.0, zero page/console errors or external HTTP requests. The earlier
complete-lesson 36-check regression also passed after this update.

If NOVA_BROWSER_OUTPUT is omitted, scratch is removed automatically. Put retained
screenshots, generated audio, PCM and diagnostic videos outside Git. The requested
PDF/video samples are deliberate delivery outputs, not source-archive members;
packaging excludes movie extensions as well as WAV/MP3/environments/node_modules.

See [LESSON-OUTPUT-AR.md](../LESSON-OUTPUT-AR.md) for Arabic operation, format,
resource/review/privacy and unverified native/live-model/voice limitations.
