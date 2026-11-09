# HTML player controller tests

These isolated DOM tests use jsdom. They do not install dependencies in the ERP,
and Node is **not** needed by the desktop application or the exported HTML.

```sh
npm ci --ignore-scripts
npm test
```

Audio and Web Animations are mocked because jsdom does not decode audio or render
animations. Tests check control wiring, native audio rate changes, restoration of
original animation rates, opt-in pause/play linking, new animations, fallback and
accessibility. They do **not** substitute for a real-browser listening/visual test.
The Python suite separately verifies the actual embedded WAV/MP3 bytes and HTML
export. `examples/animated-page.html` can be used for a manual browser test after
installing a real voice model.

## Whiteboard pipeline

`whiteboard.test.cjs` creates real silent/narrated lesson pages with the Python
exporter, then checks SVG writing, pause/resume, step navigation, audio-clock
seeking, half speed, opt-in progression, safe text insertion, inline dialogue tags, reduced motion,
blocked playback, and narrow-screen reflow. Audio and SVG metrics are mocked:
these are controller/integration tests, not a listening or screenshot review.

Set `NOVA_VOICE_PYTHON` to the Python executable with access to this source tree
if `python` is not the desired executable. Node is a development-only dependency;
exported HTML has no npm, CDN, server or Web Speech dependency.


## Local appearance and child-character library

The whiteboard tests also cover role/sentence colors, the six passive SVG
characters and filters, play/pause/reduced-motion behavior, and no additional
animation frame loop or network. Browser-customized downloads are reloaded by
Python, narrated through the local pipeline, and re-opened without duplicating
live audio or outline nodes. Media and layout remain mocked, not real listening
or screenshot/performance validation on Windows.

Bilingual layout regressions cover explicit LTR/RTL (ignoring Arabic punctuation),
English-above-Arabic grouping, two columns, narrow-screen fallback, unchanged lesson
manifests and audio position, original-row color targeting, and a browser-downloaded
layout surviving Python reimport and offline narration. Geometry is simulated by
jsdom; these tests do not replace real-browser visual or Windows listening tests.


## Measured per-line timing (0.5.0)

`whiteboard-timing.test.cjs` uses the actual Python streaming writer with
controlled PCM chunks and deliberately unequal row durations. It checks Python/JS
canonical SHA-256 (including Arabic, emoji and all 120 step keys), row onset and
reveal, measured reply gaps, seek both ways, pause/replay, slider and native
ratechange at 0.5x/2x, resize and within-row wrapping, reduced motion, speaker
motion and browser-customized round trips back through Python integrity checks.
Missing, malformed, partial or inconsistent timing falls back to the old
whole-step weighting without console errors. MP3 tests check metadata semantics,
**not actual browser decoder trimming**. The Python codec test separately decodes
and correlates real MP3 files with development-only miniaudio. No real-browser,
Windows, natural-voice or 4 GB hardware test is implied.


The measured-timing suite also creates a page with the one-click combined
exporter and reopens it offline, checking embedded audio, row boundaries and
seeking. The combined path reuses the saved-lesson exporter; it does not introduce
a second browser controller. Native Qt button tests are separate Python tests
and require the system Qt dependencies (not provided by jsdom).


## Organized layout

Four further DOM cases check unique IDs and local shortcuts, transport before the
children, independent native outline disclosures, visible transport/audio/rate
and live status outside optional playback settings, and three named appearance
groups without changes to lesson JSON. No controller or clock implementation is
replaced. See `UI-ORGANIZATION-AR.md` for the separate Linux Chromium responsive
and offline embedded-WAV smoke checks and unrun native Windows/Qt checks.

## Complete lessons from a short brief (0.7.0.dev1 source preview)

`whiteboard-full-lesson.test.cjs` uses the clearly authored complete-lesson fixture:
10 steps, 16 rows, objectives, four staged diagrams, questions/separate answers,
and summary. Twenty DOM cases cover schema-2 origin validation (including wrong
brief/source/hints, missing provenance and wrong digest types), literal description
text, row cues, questions not showing their answers in the same step, measured
sample-clock seeking, and customized HTML -> Python -> offline reopening. Controlled
PCM is silence. These tests never contact a model or certify scientific/voice quality.

### Optional real Chromium QA (not npm test)

`browser-full-lesson.cjs` uses separately installed **playwright-core** and a Chromium
executable. It never downloads them or changes desktop runtime dependencies. For
example, with those development tools already available:

```sh
NODE_PATH=/path/to/development/node_modules \
NOVA_CHROMIUM=/path/to/chromium \
NOVA_VOICE_PYTHON=/path/to/source-environment/python \
NOVA_BROWSER_OUTPUT=/path/to/ignored/scratch \
node browser-full-lesson.cjs
```

If `NOVA_CHROMIUM` is omitted, it can use a separately installed
`@sparticuz/chromium` with its local executable. Platform system libraries may
also need to be configured. `NOVA_BROWSER_OUTPUT` is optional: without it the
scratch folder is cleaned automatically. Do not put generated PCM/models or
screenshots into Git. No Windows/4GB or native Qt test is implied.

The script performs real SVG/font/layout checks at 360/768/1366px, including
in-bounds/non-overlapping labels in **this fixture**, cue visibility, pause/rate,
question/answer separation, reduced motion, actual Blob download during an eraser
transition, Python import, and offline reopen. It also uses the existing 1602-byte
ONNX test model to generate **silence**, checks actual WAV decode/play/pause and
measured seek at 0.5x/1x/2x, then saves/reimports/reopens it. This is not a listening
or live-AI quality test. The recorded development run used Playwright 1.65.0 and
Linux Chromium 153.0.8010.0: 36 checks, zero page/console errors or external HTTP
requests. All content in the example was authored locally, not generated by a service.
