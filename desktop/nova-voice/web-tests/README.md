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
