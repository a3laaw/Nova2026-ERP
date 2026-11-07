"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { JSDOM } = require("jsdom");

let folder;
before(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-whiteboard-tests-"));
  execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
import sys, wave
from nova_voice.whiteboard import parse_lesson, save_whiteboard, render_whiteboard_audio
from nova_voice.engine import DialogueVoice, RenderOptions, RenderResult
from nova_voice.voices import VoiceSpec
root = Path(sys.argv[1])
lesson = parse_lesson('# Timing lesson\\n## First step\\nHello world.\\n## Second step\\nNext sentence.')
source = root / 'silent.html'
save_whiteboard(lesson, source)
voice = VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx'))
class Engine:
    count = 0
    def render(self, text, voice, target, options, cancel, progress):
        self.count += 1
        with wave.open(str(target), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(22050)
            wav.writeframes(bytes([self.count]) * 44100)
        progress(100)
        return RenderResult(target, 1.0, len(text))
render_whiteboard_audio(Engine(), source, {1: DialogueVoice(voice)}, root/'audio.html', RenderOptions(), audio_format='wav')
attack = '</script><img src=x onerror="window.pwned=1">'
save_whiteboard(parse_lesson('# Safe ' + attack + '\\n## العربية\\n[1] مرحبًا.\\n[2] ' + attack, dialogue=True), root/'safe.html')
`, folder], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));

function mount(file = "silent.html", options = {}) {
  const callbacks = new Map();
  let nextId = 0, networkCalls = 0, playCalls = 0;
  const media = new WeakMap();
  const state = element => {
    if (!media.has(element)) media.set(element, { paused: true, ended: false, time: 0, duration: 1 });
    return media.get(element);
  };
  const dom = new JSDOM(fs.readFileSync(path.join(folder, file), "utf8"), {
    runScripts: "dangerously", url: "file:///lesson.html", pretendToBeVisual: true,
    beforeParse(window) {
      if (options.width) window.innerWidth = options.width;
      window.matchMedia = () => ({ matches: !!options.reducedMotion });
      window.fetch = () => { networkCalls++; throw new Error("No network permitted"); };
      window.requestAnimationFrame = callback => { const id = ++nextId; callbacks.set(id, callback); return id; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      const prototype = window.HTMLMediaElement.prototype;
      Object.defineProperties(prototype, {
        paused: { configurable: true, get() { return state(this).paused; } },
        ended: { configurable: true, get() { return state(this).ended; } },
        duration: { configurable: true, get() { return state(this).duration; } },
        currentTime: {
          configurable: true, get() { return state(this).time; },
          set(value) { state(this).time = Number(value); state(this).ended = false; },
        },
        src: {
          configurable: true, get() { return this.getAttribute("src") || ""; },
          set(value) { this.setAttribute("src", value); state(this).time = 0; state(this).ended = false; },
        },
      });
      prototype.play = function () {
        playCalls++;
        if (options.rejectPlay) return Promise.reject(new Error("Autoplay blocked"));
        state(this).paused = false;
        state(this).ended = false;
        this.dispatchEvent(new window.Event("play"));
        return Promise.resolve();
      };
      prototype.pause = function () {
        state(this).paused = true;
        this.dispatchEvent(new window.Event("pause"));
      };
    },
  });
  const window = dom.window, document = window.document;
  const audio = document.getElementById("wb-audio");
  return {
    dom, window, document, audio,
    get(id) { return document.getElementById(id); },
    get playCalls() { return playCalls; },
    get networkCalls() { return networkCalls; },
    get frames() { return callbacks.size; },
    advance(time) { const current = Array.from(callbacks.values()); callbacks.clear(); current.forEach(callback => callback(time)); },
    position(time, event = "timeupdate") { audio.currentTime = time; audio.dispatchEvent(new window.Event(event)); },
    ended() { state(audio).time = state(audio).duration; state(audio).paused = true; state(audio).ended = true; audio.dispatchEvent(new window.Event("ended")); },
    close() { window.dispatchEvent(new window.Event("pagehide")); window.close(); },
  };
}

test("a generated silent board runs without voice models, external files or autoplay", () => {
  const app = mount();
  try {
    assert.equal(app.get("lesson-title").textContent, "Timing lesson");
    assert.equal(app.get("lesson-outline").children.length, 2);
    assert.equal(app.get("wb-previous").disabled, true);
    assert.equal(app.audio.hidden, true);
    assert.equal(app.get("wb-auto-next").checked, false);
    assert.equal(app.get("position-label").textContent, "0%");
    assert.equal(app.frames, 0);
    assert.equal(app.playCalls, 0);
    assert.equal(app.networkCalls, 0);
  } finally { app.close(); }
});

test("silent writing uses the chosen rate, pauses and resumes without time jumping", () => {
  const app = mount();
  try {
    const slider = app.get("wb-rate");
    slider.value = "0.5";
    slider.dispatchEvent(new app.window.Event("input"));
    app.get("wb-play").click();
    app.advance(0);
    app.advance(400);
    // Hello world. is 12 characters -> 780 ms at 1x; 200 ms virtual have elapsed.
    assert.equal(app.get("position-label").textContent, "26%");
    assert.equal(app.get("wb-rate-label").textContent, "0.50×");
    app.get("wb-play").click();
    assert.equal(app.frames, 0);
    app.advance(10000);
    assert.equal(app.get("position-label").textContent, "26%");
    app.get("wb-play").click();
    app.advance(20000);
    assert.equal(app.get("position-label").textContent, "26%");
    app.advance(20400);
    assert.equal(app.get("position-label").textContent, "51%");
  } finally { app.close(); }
});

test("next, previous and restarting clear old SVG clips and keep step text intact", () => {
  const app = mount();
  try {
    app.get("wb-next").click();
    assert.equal(app.get("scene-title").textContent, "Second step");
    assert.equal(app.get("wb-next").disabled, true);
    assert.equal(app.get("wb-previous").disabled, false);
    assert.match(app.get("step-transcript").textContent, /Next sentence/);
    assert.doesNotMatch(app.get("step-transcript").textContent, /Hello/);
    app.get("wb-play").click();
    app.advance(0); app.advance(100);
    const oldId = app.get("wb-defs").firstElementChild.id;
    app.get("wb-restart").click();
    assert.equal(app.get("position-label").textContent, "0%");
    assert.notEqual(app.get("wb-defs").firstElementChild.id, oldId);
    app.get("wb-previous").click();
    assert.equal(app.get("scene-title").textContent, "First step");
  } finally { app.close(); }
});

test("the narrated page has one local clip per step and does not start on load", () => {
  const app = mount("audio.html");
  try {
    assert.equal(app.audio.hidden, false);
    assert.ok(app.audio.src.startsWith("data:audio/wav;base64,"));
    assert.equal(Buffer.from(app.audio.src.split(",")[1], "base64").toString("ascii", 0, 4), "RIFF");
    assert.equal(app.audio.autoplay, false);
    assert.equal(app.audio.preservesPitch, true);
    assert.equal(app.playCalls, 0);
    assert.equal(app.frames, 0);
    assert.equal(app.networkCalls, 0);
    const first = app.audio.src;
    app.get("wb-next").click();
    assert.notEqual(app.audio.src, first);
    assert.equal(app.audio.currentTime, 0);
    assert.equal(app.playCalls, 0);
  } finally { app.close(); }
});

test("audio time, not wall-clock timers, drives writing and seeking in narrated steps", async () => {
  const app = mount("audio.html");
  try {
    app.get("wb-play").click();
    await Promise.resolve();
    app.position(0.5);
    app.advance(999999);
    assert.equal(app.get("position-label").textContent, "50%");
    app.get("wb-rate").value = "0.5";
    app.get("wb-rate").dispatchEvent(new app.window.Event("input"));
    assert.equal(app.audio.playbackRate, 0.5);
    app.advance(9999999);
    assert.equal(app.get("position-label").textContent, "50%");
    app.position(0.2, "seeked");
    assert.equal(app.get("position-label").textContent, "20%");
    app.get("wb-play").click();
    assert.equal(app.frames, 0);
    app.advance(99999999);
    assert.equal(app.get("position-label").textContent, "20%");
  } finally { app.close(); }
});

test("finishing a step keeps the answer hidden unless automatic progression was selected", async () => {
  const app = mount("audio.html");
  try {
    app.get("wb-play").click(); await Promise.resolve();
    app.ended();
    assert.equal(app.get("position-label").textContent, "100%");
    assert.equal(app.get("scene-title").textContent, "First step");
    assert.match(app.get("wb-play").textContent, /إعادة/);
    app.get("wb-auto-next").checked = true;
    app.get("wb-play").click(); await Promise.resolve();
    app.ended(); await Promise.resolve();
    assert.equal(app.get("scene-title").textContent, "Second step");
    assert.equal(app.get("position-label").textContent, "0%");
    assert.equal(app.audio.paused, false);
  } finally { app.close(); }
});

test("script tags, HTML and voice labels in lesson content cannot become executable DOM", () => {
  const app = mount("safe.html");
  try {
    assert.equal(app.window.pwned, undefined);
    assert.equal(app.document.querySelectorAll("img").length, 0);
    assert.match(app.get("lesson-title").textContent, /<img/);
    assert.match(app.get("step-transcript").textContent, /<img/);
    assert.doesNotMatch(app.get("step-transcript").textContent, /\[1\]|\[2\]/);
    assert.match(app.get("wb-rows").textContent, /مرحبًا/);
  } finally { app.close(); }
});

test("reduced-motion mode displays silent writing immediately and keeps the pen hidden", () => {
  const app = mount("silent.html", { reducedMotion: true });
  try {
    app.get("wb-play").click();
    assert.equal(app.get("position-label").textContent, "100%");
    assert.equal(app.get("wb-pen").getAttribute("opacity"), "0");
    assert.equal(app.frames, 0);
  } finally { app.close(); }
});

test("arrow keys navigate but do not hijack speed-slider keyboard controls", () => {
  const app = mount();
  try {
    app.get("wb-rate").dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    assert.equal(app.get("scene-title").textContent, "First step");
    app.document.body.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    assert.equal(app.get("scene-title").textContent, "Second step");
    app.document.body.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(app.get("scene-title").textContent, "First step");
  } finally { app.close(); }
});

test("a blocked audio play is reported without pretending to play or animate", async () => {
  const app = mount("audio.html", { rejectPlay: true });
  try {
    app.get("wb-play").click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(app.get("wb-status").textContent, /لم يبدأ الصوت/);
    assert.equal(app.audio.paused, true);
    assert.equal(app.get("position-label").textContent, "0%");
    assert.equal(app.frames, 0);
  } finally { app.close(); }
});


test("narrow screens reflow the SVG instead of shrinking desktop text, preserving audio position", () => {
  const app = mount("audio.html", { width: 600 });
  try {
    assert.match(app.get("whiteboard").getAttribute("viewBox"), /^0 0 720 /);
    app.position(0.4, "seeked");
    app.window.innerWidth = 1100;
    app.window.dispatchEvent(new app.window.Event("resize"));
    assert.match(app.get("whiteboard").getAttribute("viewBox"), /^0 0 1200 /);
    assert.equal(app.get("position-label").textContent, "40%");
    assert.equal(app.audio.currentTime, 0.4);
  } finally { app.close(); }
});
