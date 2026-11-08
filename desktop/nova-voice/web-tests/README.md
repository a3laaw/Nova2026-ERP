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
