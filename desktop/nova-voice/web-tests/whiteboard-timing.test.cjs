"use strict";
// Real Python-produced PCM counts + actual exported controller; jsdom media is
// stubbed deliberately. These tests do not claim browser decoding/listening.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const TIMINGS = "nova-whiteboard-timings";
let folder;

before(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-measured-board-"));
  execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys
from nova_voice.whiteboard import parse_lesson, save_whiteboard, render_whiteboard_audio
from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.voices import VoiceSpec
root = Path(sys.argv[1])
voice = replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')), sample_rate=8000)
cast = {1: DialogueVoice(voice), 2: DialogueVoice(replace(voice, model_path=root/'second-model.onnx'))}
long_row = 'This much longer source row wraps across several visual lines yet its measured audio is only one second, not proportional to its number of characters.'
lesson = parse_lesson(chr(10).join(['# العربية Timing 😀', '## First', '[1] Short.[/1][2] ' + long_row + '[/2][1] Last.[/1]', '## Second', '[2] Another step.[/2]']), dialogue=True)
source = root/'silent.html'
save_whiteboard(lesson, source)
class MeasuredEngine(SpeechEngine):
    def _load(self, spec):
        def synthesize(text, syn_config):
            seconds = 8 if text.startswith('Short') else 1 if text.startswith('This') else 3 if text.startswith('Last') else 4
            # Yield several bounded chunks into ONE stream, never one row file.
            for _ in range(seconds * 4):
                yield SimpleNamespace(sample_rate=8000, sample_width=2, sample_channels=1, audio_int16_bytes=bytes(4000))
        return SimpleNamespace(config=SimpleNamespace(sample_rate=8000, length_scale=1.0), synthesize=synthesize)
engine = MeasuredEngine()
for ext in ('wav', 'mp3'):
    render_whiteboard_audio(engine, source, cast, root/('timed.' + ext + '.html'), RenderOptions(), audio_format=ext)
class TinyEngine(SpeechEngine):
    def _load(self, spec):
        return SimpleNamespace(config=SimpleNamespace(sample_rate=8000, length_scale=1.0), synthesize=lambda *args, **kwargs: iter([SimpleNamespace(sample_rate=8000, sample_width=2, sample_channels=1, audio_int16_bytes=bytes(160))]))
many = parse_lesson('# All steps' + ''.join(chr(10) + '## Step ' + str(index) + chr(10) + 'Hello.' for index in range(120)))
save_whiteboard(many, root/'many-silent.html')
render_whiteboard_audio(TinyEngine(), root/'many-silent.html', cast, root/'many.html', RenderOptions(), audio_format='wav')
`, folder], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));

function jsonFrom(html, id) {
  return JSON.parse(html.match(new RegExp('<script id="' + id + '" type="application/json">(.*?)</script>', "s"))[1]);
}
function replaceJSON(html, id, data) {
  return html.replace(new RegExp('(<script id="' + id + '" type="application/json">).*?(</script>)', "s"),
    (_, start, end) => start + JSON.stringify(data).replace(/</g, "\\u003c").replace(/&/g, "\\u0026") + end);
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => canonical(key) + ":" + canonical(value[key])).join(",") + "}";
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}
function resign(data) {
  const payload = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "fingerprint"));
  data.fingerprint = crypto.createHash("sha256").update(canonical(payload), "ascii").digest("hex");
  return data;
}

function mount(options = {}) {
  const callbacks = new Map(), errors = [], downloads = [];
  let id = 0, networkCalls = 0;
  const media = new WeakMap();
  const state = element => {
    if (!media.has(element)) media.set(element, { paused: true, ended: false, time: 0, duration: 12.7, rate: 1 });
    return media.get(element);
  };
  let html = fs.readFileSync(path.join(folder, options.file || "timed.wav.html"), "utf8");
  if (options.transform) html = options.transform(html);
  const console = new VirtualConsole();
  console.on("jsdomError", error => errors.push(error));
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url: "file:///measured-lesson.html", pretendToBeVisual: true, virtualConsole: console,
    beforeParse(window) {
      if (options.captureDownloads) {
        const OriginalBlob = window.Blob;
        window.Blob = class extends OriginalBlob {
          constructor(parts, configuration) { super(parts, configuration); this.parts = parts; }
        };
        window.URL.createObjectURL = blob => { downloads.push(blob.parts.join("")); return "blob:nova-timing-test"; };
        window.URL.revokeObjectURL = () => {};
        window.HTMLAnchorElement.prototype.click = function () {};
      }
      if (options.width) window.innerWidth = options.width;
      window.matchMedia = () => ({ matches: !!options.reducedMotion });
      window.fetch = () => { networkCalls++; throw new Error("No network allowed"); };
      window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => callbacks.delete(key);
      const prototype = window.HTMLMediaElement.prototype;
      Object.defineProperties(prototype, {
        paused: { configurable: true, get() { return state(this).paused; } },
        ended: { configurable: true, get() { return state(this).ended; } },
        duration: { configurable: true, get() { return state(this).duration; } },
        currentTime: { configurable: true, get() { return state(this).time; }, set(value) { state(this).time = Number(value); state(this).ended = false; } },
        src: { configurable: true, get() { return this.getAttribute("src") || ""; }, set(value) { this.setAttribute("src", value); state(this).time = 0; state(this).ended = false; } },
        playbackRate: { configurable: true, get() { return state(this).rate; }, set(value) {
          const previous = state(this).rate;
          state(this).rate = Number(value);
          if (previous !== Number(value)) this.dispatchEvent(new window.Event("ratechange"));
        } },
      });
      prototype.play = function () { state(this).paused = false; state(this).ended = false; this.dispatchEvent(new window.Event("play")); return Promise.resolve(); };
      prototype.pause = function () { state(this).paused = true; this.dispatchEvent(new window.Event("pause")); };
    },
  });
  const window = dom.window, document = window.document;
  const audio = document.getElementById("wb-audio");
  return {
    window, document, audio, errors, downloads,
    get(id) { return document.getElementById(id); },
    get mode() { return document.getElementById("whiteboard").dataset.timing; },
    get networkCalls() { return networkCalls; },
    get frames() { return callbacks.size; },
    set duration(value) { state(audio).duration = value; },
    position(time, event = "timeupdate") { audio.currentTime = time; audio.dispatchEvent(new window.Event(event)); },
    advance(time) { const pending = Array.from(callbacks.values()); callbacks.clear(); pending.forEach(callback => callback(time)); },
    finish() { state(audio).time = state(audio).duration; state(audio).paused = true; state(audio).ended = true; audio.dispatchEvent(new window.Event("ended")); },
    pieces(row) {
      return Array.from(document.querySelectorAll('#wb-rows text[data-row="' + row + '"]'), text => {
        const clip = text.getAttribute("clip-path").slice(5, -1);
        const rect = document.getElementById(clip).firstElementChild;
        return { part: Number(rect.getAttribute("width")) / (Array.from(text.textContent).length * 18 + 12), weight: Math.max(500, Array.from(text.textContent).length * 65) };
      });
    },
    row(row) { const pieces = this.pieces(row); return pieces.reduce((sum, piece) => sum + piece.part * piece.weight, 0) / pieces.reduce((sum, piece) => sum + piece.weight, 0); },
    close() {
      window.dispatchEvent(new window.Event("pagehide")); window.close();
      assert.equal(networkCalls, 0);
      assert.deepEqual(errors.map(error => error.message), []);
    },
  };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test("Python timing SHA-256 validates in offline JS including the Arabic/emoji lesson fingerprint", () => {
  const app = mount();
  try {
    assert.equal(app.mode, "measured");
    const helper = app.window.novaWhiteboardTiming;
    for (const value of ["", "abc", "a".repeat(300)]) assert.equal(helper.sha256ASCII(value), crypto.createHash("sha256").update(value).digest("hex"));
    const metadata = JSON.parse(app.get(TIMINGS).textContent), clip = metadata.steps["0"];
    assert.equal(clip.sample_rate, 8000);
    assert.equal(clip.total_samples, 101600);
    assert.equal(clip.lines[1].start_sample, 66800);
    const wav = Buffer.from(app.audio.src.split(",")[1], "base64");
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.readUInt32LE(40) / 2, clip.total_samples);
    const unicode = { x: "العربية 😀\u007f\n" };
    assert.equal(helper.fingerprint(unicode), crypto.createHash("sha256").update(canonical(unicode), "ascii").digest("hex"));
    assert.equal(app.audio.paused, true);
    assert.equal(app.frames, 0);
  } finally { app.close(); }
});

test("actual row starts override character weighting and preserve both measured reply gaps", () => {
  const app = mount();
  try {
    app.position(1); near(app.row(0), 1 / 8); near(app.row(1), 0); near(app.row(2), 0);
    app.position(8.1); near(app.row(0), 1); near(app.row(1), 0);
    assert.equal(app.get("wb-pen").getAttribute("opacity"), "0");
    app.position(8.349); near(app.row(1), 0);
    app.position(8.35); near(app.row(1), 0);
    app.position(8.6); near(app.row(1), 0.25); near(app.row(2), 0);
    app.position(9.5); near(app.row(0), 1); near(app.row(1), 1); near(app.row(2), 0);
    app.position(9.8); near(app.row(2), 0.1 / 3);
  } finally { app.close(); }
});

test("seeking forward completes previous rows immediately and seeking backwards hides later rows", () => {
  const app = mount();
  try {
    app.position(11.2, "seeking"); near(app.row(0), 1); near(app.row(1), 1); near(app.row(2), 0.5);
    app.position(1, "seeked"); near(app.row(0), 0.125); near(app.row(1), 0); near(app.row(2), 0);
    app.position(0, "seeking"); near(app.row(0), 0); near(app.row(1), 0); near(app.row(2), 0);
  } finally { app.close(); }
});

test("pause/resume and arbitrarily large frame timestamps never advance measured rows without audio time", async () => {
  const app = mount();
  try {
    app.get("wb-play").click(); await Promise.resolve();
    app.position(8.85); near(app.row(1), 0.5);
    app.advance(0); app.advance(999999999); near(app.row(1), 0.5);
    app.get("wb-play").click();
    assert.equal(app.frames, 0);
    app.advance(1999999999); near(app.row(1), 0.5);
    app.get("wb-play").click(); await Promise.resolve();
    app.advance(2999999999); near(app.row(1), 0.5);
    app.position(9.1); near(app.row(1), 0.75);
    app.get("wb-restart").click();
    near(app.row(0), 0); near(app.row(1), 0); near(app.row(2), 0);
    assert.equal(app.audio.currentTime, 0);
  } finally { app.close(); }
});

for (const control of ["slider", "native"]) for (const rate of [0.5, 2]) {
  test(`${control} ${rate}x changes playback speed but never rescales the sample boundaries`, async () => {
    const app = mount();
    try {
      app.position(8.6); near(app.row(1), 0.25);
      if (control === "native") app.audio.playbackRate = rate;
      else { app.get("wb-rate").value = String(rate); app.get("wb-rate").dispatchEvent(new app.window.Event("input")); }
      assert.equal(app.audio.playbackRate, rate);
      assert.equal(app.get("wb-rate").value, String(rate));
      assert.equal(app.get("wb-rate-label").textContent, rate.toFixed(2) + "×");
      app.get("wb-play").click(); await Promise.resolve();
      app.advance(0); app.advance(999999); near(app.row(1), 0.25);
      app.position(9); near(app.row(1), 0.65); near(app.row(0), 1); near(app.row(2), 0);
    } finally { app.close(); }
  });
}

test("wrapping and resize reweight only within one source row without shifting its audio start/end", () => {
  const app = mount();
  try {
    assert.ok(app.pieces(1).length > 1);
    app.position(8.85); near(app.row(1), 0.5);
    const previous = app.pieces(1).length;
    app.window.innerWidth = 480; app.window.dispatchEvent(new app.window.Event("resize"));
    assert.ok(app.pieces(1).length > previous);
    near(app.row(0), 1); near(app.row(1), 0.5); near(app.row(2), 0);
    for (const layout of ["script", "columns", "stacked"]) {
      app.get("wb-language-layout").value = layout;
      app.get("wb-language-layout").dispatchEvent(new app.window.Event("change"));
      near(app.row(1), 0.5); assert.equal(app.audio.currentTime, 8.85);
    }
    app.position(9.35); near(app.row(1), 1); near(app.row(2), 0);
  } finally { app.close(); }
});

test("a different media duration cannot stretch or shrink measured row boundaries", () => {
  const app = mount();
  try {
    for (const duration of [10, 20, NaN]) {
      app.duration = duration; app.position(8.85, "loadedmetadata");
      near(app.row(0), 1); near(app.row(1), 0.5); near(app.row(2), 0);
    }
  } finally { app.close(); }
});

test("ended completes the last row, replay resets it, and step navigation selects a new sample map", async () => {
  const app = mount();
  try {
    app.position(11.2); near(app.row(2), 0.5);
    app.finish(); near(app.row(2), 1);
    assert.equal(app.get("wb-pen").getAttribute("opacity"), "0");
    app.get("wb-play").click(); await Promise.resolve(); near(app.row(0), 0);
    app.get("wb-next").click(); app.duration = 4;
    assert.equal(app.get("scene-title").textContent, "Second");
    app.position(1); near(app.row(0), 0.25);
    app.get("wb-previous").click(); app.duration = 12.7;
    app.position(1); near(app.row(0), 0.125); near(app.row(1), 0);
  } finally { app.close(); }
});

test("reduced motion reveals complete rows at their own onsets, not all future rows at once", () => {
  const app = mount({ reducedMotion: true });
  try {
    app.position(1); near(app.row(0), 1); near(app.row(1), 0); near(app.row(2), 0);
    app.position(8.1); near(app.row(1), 0);
    app.position(8.6); near(app.row(1), 1); near(app.row(2), 0);
    assert.equal(app.get("wb-pen").getAttribute("opacity"), "0");
    app.position(1, "seeked"); near(app.row(1), 0);
  } finally { app.close(); }
});

test("MP3 explicitly keeps the uncompensated PCM clock; ended handles decoder padding/trimming", () => {
  const app = mount({ file: "timed.mp3.html" });
  try {
    assert.equal(app.mode, "measured");
    assert.equal(JSON.parse(app.get(TIMINGS).textContent).steps["0"].encoder_delay_samples, null);
    assert.match(app.get("wb-status").textContent, /MP3/);
    app.position(8.6); near(app.row(1), 0.25);
    app.duration = 12.6; app.finish(); near(app.row(2), 1);
  } finally { app.close(); }
});

for (const problem of ["absent", "malformed", "duplicate", "wrong-type", "checksum", "lesson-checksum", "other-lesson", "partial-map", "missing-row", "wrong-role", "negative", "fractional", "unsafe-integer", "boolean", "overlap", "clock", "delay", "schema", "unknown-field", "duration", "mime"]) {
  test(`${problem} optional timing quietly falls back to the unchanged whole-step weighting`, () => {
    const app = mount({ transform(html) {
      const pattern = new RegExp('<script id="' + TIMINGS + '".*?</script>', "s");
      if (problem === "absent") return html.replace(pattern, "");
      if (problem === "malformed") return html.replace(pattern, '<script id="' + TIMINGS + '" type="application/json">{broken</script>');
      if (problem === "duplicate") return html.replace(pattern, match => match + match);
      if (problem === "wrong-type") return html.replace('id="' + TIMINGS + '" type="application/json"', 'id="' + TIMINGS + '" type="application/x-invalid"');
      if (problem === "lesson-checksum") {
        const lesson = jsonFrom(html, "nova-whiteboard-data"); lesson.steps[0].rows[0].text = "Edited.";
        return replaceJSON(html, "nova-whiteboard-data", lesson);
      }
      if (problem === "duration") { const recordings = jsonFrom(html, "nova-whiteboard-recordings"); recordings.durations[0] += 1; return replaceJSON(html, "nova-whiteboard-recordings", recordings); }
      if (problem === "mime") return html.replace('id="nova-wb-audio-0" type="application/x-nova-audio" data-mime="audio/wav"', 'id="nova-wb-audio-0" type="application/x-nova-audio" data-mime="audio/mpeg"');
      const data = jsonFrom(html, TIMINGS), clip = data.steps["0"], first = clip.lines[0];
      if (problem === "checksum") { first.end_sample++; first.pause_after_samples--; return replaceJSON(html, TIMINGS, data); }
      if (problem === "other-lesson") data.lesson_fingerprint = "0".repeat(64);
      if (problem === "partial-map") delete data.steps["1"];
      if (problem === "missing-row") clip.lines.pop();
      if (problem === "wrong-role") first.speaker = 2;
      if (problem === "negative") first.start_sample = -1;
      if (problem === "fractional") first.end_sample += 0.5;
      if (problem === "unsafe-integer") clip.total_samples = 2 ** 53;
      if (problem === "boolean") first.start_sample = false;
      if (problem === "overlap") clip.lines[1].start_sample--;
      if (problem === "clock") clip.clock = "wall-time";
      if (problem === "delay") clip.encoder_delay_samples = 1105;
      if (problem === "schema") data.schema_version = 2;
      if (problem === "unknown-field") first.model_path = "not allowed";
      return replaceJSON(html, TIMINGS, resign(data));
    } });
    try {
      assert.equal(app.mode, "weighted");
      app.position(1);
      // In the old estimator the six-character row is already complete at one
      // second; the real map instead gives it an eight-second span (12.5%).
      near(app.row(0), 1);
      assert.equal(app.get("position-label").textContent, "8%");
    } finally { app.close(); }
  });
}

test("the silent local clock ignores audio metadata and remains available without timing", () => {
  const app = mount({ file: "silent.html" });
  try {
    assert.equal(app.mode, "silent");
    assert.equal(app.audio.hidden, true);
    app.get("wb-play").click(); app.advance(0); app.advance(1000);
    near(app.row(0), 1);
    app.get("wb-play").click(); assert.equal(app.frames, 0);
  } finally { app.close(); }
});

test("all 120 step keys validate across canonical lexical sorting, including step 119", () => {
  const app = mount({ file: "many.html" });
  try {
    assert.equal(app.mode, "measured");
    app.get("lesson-outline").querySelectorAll("button")[119].click();
    app.duration = 0.01; app.position(0.005); near(app.row(0), 0.5);
    assert.equal(app.get("scene-title").textContent, "Step 119");
  } finally { app.close(); }
});

test("measured speaker motion follows row changes and stops during reply gaps without a second clock", async () => {
  const app = mount();
  try {
    for (const [role, character] of [[1, "adam"], [2, "layla"]]) {
      app.get("wb-character-role").value = String(role);
      app.get("wb-character-role").dispatchEvent(new app.window.Event("change"));
      app.document.querySelector('#wb-character-library button[data-character="' + character + '"]').click();
    }
    app.get("wb-play").click(); await Promise.resolve();
    app.position(1); assert.equal(app.get("character-role-1").classList.contains("is-moving"), true);
    app.position(8.1); assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    app.position(8.85); assert.equal(app.get("character-role-2").classList.contains("is-moving"), true);
    assert.equal(app.get("character-role-1").classList.contains("is-moving"), false);
    app.get("wb-play").click(); assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    assert.equal(app.frames, 0);
  } finally { app.close(); }
});

test("customized narrated downloads keep the measured map, pass Python integrity and reopen at the same cues", () => {
  const app = mount({ captureDownloads: true });
  try {
    const metadata = app.get(TIMINGS).textContent;
    app.position(8.85);
    app.get("wb-color-1").value = "#475569"; app.get("wb-color-1").dispatchEvent(new app.window.Event("input"));
    near(app.row(1), 0.5);
    app.get("wb-save-customized").click();
    assert.equal(app.downloads.length, 1);
    fs.writeFileSync(path.join(folder, "custom-timed.html"), app.downloads[0]);
    execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", "from pathlib import Path; import sys; from nova_voice.whiteboard import WhiteboardPage; p = WhiteboardPage.load(Path(sys.argv[1]), allow_recordings=True); assert p.timing is not None; assert p.appearance.first_color == '#475569'", path.join(folder, "custom-timed.html")], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    const reopened = mount({ file: "custom-timed.html" });
    try {
      assert.equal(reopened.mode, "measured"); assert.equal(reopened.get(TIMINGS).textContent, metadata);
      reopened.position(8.85); near(reopened.row(1), 0.5);
      assert.equal(reopened.audio.paused, true);
    } finally { reopened.close(); }
  } finally { app.close(); }
});
