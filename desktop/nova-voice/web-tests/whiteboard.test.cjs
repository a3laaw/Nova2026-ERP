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
inline = parse_lesson(Path('examples/greetings-inline-dialogue.txt').read_text(encoding='utf-8'), dialogue=True)
save_whiteboard(inline, root / 'inline.html')
paired = parse_lesson(chr(10).join(['# Paired lesson', '## Greetings', '[2] Hello، everyone.[/2][1] مرحبًا بكم.[/1]', '[2] How are you?[/2][1] كيف حالك؟[/1]']), dialogue=True)
save_whiteboard(paired, root / 'pairs.html')
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
  const downloads = [];
  const media = new WeakMap();
  const state = element => {
    if (!media.has(element)) media.set(element, { paused: true, ended: false, time: 0, duration: 1 });
    return media.get(element);
  };
  const dom = new JSDOM(fs.readFileSync(path.join(folder, file), "utf8"), {
    runScripts: "dangerously", url: "file:///lesson.html", pretendToBeVisual: true,
    beforeParse(window) {
      if (options.captureDownloads) {
        const OriginalBlob = window.Blob;
        window.Blob = class extends OriginalBlob {
          constructor(parts, configuration) { super(parts, configuration); this.parts = parts; }
        };
        window.URL.createObjectURL = blob => { downloads.push(blob.parts.join("")); return "blob:nova-test"; };
        window.URL.revokeObjectURL = () => {};
        window.HTMLAnchorElement.prototype.click = function () {};
      }
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
    dom, window, document, audio, downloads,
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


for (const width of [720, 1200]) {
  test(`inline paired tags never appear in the board, transcript or fallback at ${width}px`, () => {
    const app = mount("inline.html", { width });
    try {
      const marker = /\[\/?[12]\]/;
      assert.equal(app.get("lesson-title").textContent, "التحيات والتعارف");
      assert.equal(app.get("lesson-outline").children.length, 2);
      assert.deepEqual(
        Array.from(app.get("step-transcript").children, node => node.dataset.speaker),
        ["1", "2", "1"],
      );
      assert.match(app.get("step-transcript").textContent, /Greetings and Introductions/);
      assert.doesNotMatch(app.get("step-transcript").textContent, marker);
      assert.doesNotMatch(app.get("wb-rows").textContent, marker);
      assert.doesNotMatch(app.document.querySelector("noscript").textContent, marker);
      app.get("wb-next").click();
      assert.equal(app.get("scene-title").textContent, "التحيات");
      assert.deepEqual(
        Array.from(app.get("step-transcript").children, node => [node.dataset.speaker, node.textContent]),
        [["2", "Hello!"], ["1", "مرحبًا!"], ["2", "Good morning!"], ["1", "صباح الخير!"]],
      );
      assert.doesNotMatch(app.get("step-transcript").textContent, marker);
      assert.doesNotMatch(app.get("wb-rows").textContent, marker);
      assert.equal(app.networkCalls, 0);
      assert.equal(app.playCalls, 0);
    } finally { app.close(); }
  });
}


function input(app, id, value, event = "input") {
  app.get(id).value = value;
  app.get(id).dispatchEvent(new app.window.Event(event));
}
function chooseCharacter(app, id, role = 1) {
  input(app, "wb-character-role", String(role), "change");
  input(app, "wb-character-filter", "all", "change");
  app.document.querySelector(`#wb-character-library [data-character="${id}"]`).click();
}
function appearance(app) {
  return JSON.parse(app.get("nova-whiteboard-appearance").textContent);
}

test("the local library has three boys, three girls and an explicit hide choice", () => {
  const app = mount();
  try {
    assert.equal(app.get("wb-character-library").children.length, 7);
    input(app, "wb-character-filter", "boy", "change");
    assert.equal(app.get("wb-character-library").children.length, 4);
    assert.ok(app.document.querySelector('[data-character="adam"]'));
    input(app, "wb-character-filter", "girl", "change");
    assert.equal(app.get("wb-character-library").children.length, 4);
    assert.ok(app.document.querySelector('[data-character="salma"]'));
    assert.equal(app.get("character-stage").hidden, true);
    assert.equal(app.frames, 0);
    assert.equal(app.networkCalls, 0);
  } finally { app.close(); }
});

test("each dialogue role can choose a child character without changing words or voices", () => {
  const app = mount("inline.html");
  try {
    const original = app.get("nova-whiteboard-data").textContent;
    chooseCharacter(app, "adam", 1);
    chooseCharacter(app, "nour", 2);
    assert.equal(app.get("character-stage").hidden, false);
    assert.equal(app.get("character-role-1").dataset.character, "adam");
    assert.equal(app.get("character-role-2").dataset.character, "nour");
    assert.equal(app.get("character-role-1").querySelectorAll("svg").length, 1);
    assert.equal(app.get("nova-whiteboard-data").textContent, original);
    assert.equal(appearance(app).first_character, "adam");
    assert.equal(appearance(app).second_character, "nour");
    assert.equal(app.playCalls, 0);
    assert.equal(app.networkCalls, 0);
  } finally { app.close(); }
});

test("character motion follows the current row while playing and stops on pause or hide", () => {
  const app = mount("inline.html");
  try {
    chooseCharacter(app, "adam", 1);
    chooseCharacter(app, "layla", 2);
    app.get("wb-play").click();
    assert.equal(app.get("character-role-1").classList.contains("is-moving"), true);
    app.get("wb-play").click();
    assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    app.get("wb-next").click(); // The next step begins with English, role 2.
    app.get("wb-play").click();
    assert.equal(app.get("character-role-2").classList.contains("is-moving"), true);
    assert.equal(app.get("character-role-1").classList.contains("is-moving"), false);
    chooseCharacter(app, "none", 2);
    assert.equal(app.get("character-role-2").hidden, true);
    assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    assert.equal(app.frames, 1); // Only the existing board clock, no character loop.
  } finally { app.close(); }
});

test("motion can be disabled and reduced-motion is respected even while audio plays", async () => {
  const app = mount("audio.html", { reducedMotion: true });
  try {
    chooseCharacter(app, "salma");
    app.get("wb-play").click();
    await Promise.resolve();
    assert.equal(app.audio.paused, false);
    assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    app.get("wb-character-motion").checked = false;
    app.get("wb-character-motion").dispatchEvent(new app.window.Event("change"));
    assert.equal(appearance(app).animate_characters, false);
    assert.equal(app.audio.paused, false);
  } finally { app.close(); }
});

test("turning motion off and pagehide stop the active character without another timer", () => {
  const app = mount();
  try {
    chooseCharacter(app, "omar");
    app.get("wb-play").click();
    assert.equal(app.get("character-role-1").classList.contains("is-moving"), true);
    app.get("wb-character-motion").checked = false;
    app.get("wb-character-motion").dispatchEvent(new app.window.Event("change"));
    assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    app.get("wb-character-motion").checked = true;
    app.get("wb-character-motion").dispatchEvent(new app.window.Event("change"));
    assert.equal(app.get("character-role-1").classList.contains("is-moving"), true);
    app.window.dispatchEvent(new app.window.Event("pagehide"));
    assert.equal(app.document.querySelectorAll(".is-moving").length, 0);
    assert.equal(app.frames, 0);
  } finally { app.close(); }
});

test("role colors update SVG and readable text without resetting or replaying audio", async () => {
  const app = mount("audio.html");
  try {
    app.get("wb-play").click();
    await Promise.resolve();
    app.position(0.5);
    const plays = app.playCalls;
    input(app, "wb-color-1", "#475569");
    assert.equal(appearance(app).first_color, "#475569");
    assert.equal(app.get("wb-rows").querySelector("text").getAttribute("fill"), "#475569");
    assert.equal(app.get("step-transcript").firstElementChild.style.color, "rgb(71, 85, 105)");
    assert.equal(app.audio.currentTime, 0.5);
    assert.equal(app.get("position-label").textContent, "50%");
    assert.equal(app.audio.paused, false);
    assert.equal(app.playCalls, plays);
    assert.equal(app.frames, 1);
  } finally { app.close(); }
});

test("a sentence override stays independent of its role and other steps and can be reset", () => {
  const app = mount("inline.html");
  try {
    input(app, "wb-sentence", "1", "change"); // English sentence on first step.
    input(app, "wb-sentence-color", "#475569");
    assert.deepEqual(appearance(app).row_colors, [{ step: 0, row: 1, color: "#475569" }]);
    input(app, "wb-color-2", "#2563eb");
    assert.equal(app.get("step-transcript").children[1].style.color, "rgb(71, 85, 105)");
    app.get("wb-next").click();
    assert.equal(app.get("step-transcript").children[0].style.color, "rgb(37, 99, 235)");
    app.get("wb-previous").click();
    input(app, "wb-sentence", "1", "change");
    app.get("wb-clear-sentence-color").click();
    assert.deepEqual(appearance(app).row_colors, []);
    assert.equal(app.get("step-transcript").children[1].style.color, "rgb(37, 99, 235)");
  } finally { app.close(); }
});

test("resetting appearance restores safe colors and removes characters without changing the lesson", () => {
  const app = mount();
  try {
    const original = app.get("nova-whiteboard-data").textContent;
    chooseCharacter(app, "youssef");
    input(app, "wb-sentence-color", "#475569");
    app.get("wb-reset-appearance").click();
    assert.equal(app.get("character-stage").hidden, true);
    assert.equal(appearance(app).first_color, "#2563EB");
    assert.deepEqual(appearance(app).row_colors, []);
    assert.equal(app.get("nova-whiteboard-data").textContent, original);
  } finally { app.close(); }
});

test("a browser-customized silent file reloads in Python and keeps its appearance during narration", () => {
  const app = mount("silent.html", { captureDownloads: true });
  try {
    chooseCharacter(app, "adam");
    input(app, "wb-sentence-color", "#475569");
    input(app, "wb-language-layout", "columns", "change");
    app.get("wb-save-customized").click();
    assert.equal(app.downloads.length, 1);
    const saved = path.join(folder, "browser-customized.html");
    fs.writeFileSync(saved, app.downloads[0]);
    execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
import sys, json, re
from nova_voice.whiteboard import WhiteboardPage, render_whiteboard_audio
from nova_voice.engine import SpeechEngine, DialogueVoice, RenderOptions
from nova_voice.voices import VoiceSpec
source=Path(sys.argv[1])
board=WhiteboardPage.load(source)
assert board.appearance.first_character == 'adam'
assert board.appearance.layout == 'columns'
assert board.appearance.row_colors[0].color == '#475569'
assert board.lesson.steps[0].rows[0].text == 'Hello world.'
voice=VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx'))
output=source.with_name('browser-customized-audio.html')
render_whiteboard_audio(SpeechEngine(),source,{1:DialogueVoice(voice)},output,RenderOptions(),audio_format='wav')
metadata=re.search(r'<script id="nova-whiteboard-appearance" type="application/json">(.*?)</script>',output.read_text(encoding='utf-8-sig'),re.S)
assert json.loads(metadata[1])['first_character'] == 'adam'
assert json.loads(metadata[1])['layout'] == 'columns'
`, saved], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    const reopened = mount("browser-customized.html");
    try {
      assert.equal(reopened.get("character-role-1").dataset.character, "adam");
      assert.equal(reopened.get("wb-language-layout").value, "columns");
      assert.equal(reopened.get("wb-rows").querySelector("text").getAttribute("fill"), "#475569");
      assert.equal(reopened.playCalls, 0);
      assert.equal(reopened.get("lesson-outline").children.length, 2);
    } finally { reopened.close(); }
  } finally { app.close(); }
});

test("saving an already narrated page keeps its recordings but does not duplicate the live audio src", () => {
  const app = mount("audio.html", { captureDownloads: true });
  try {
    chooseCharacter(app, "nour");
    app.get("wb-next").click();
    app.get("wb-save-customized").click();
    const copy = new JSDOM(app.downloads[0]);
    try {
      assert.equal(copy.window.document.getElementById("wb-audio").hasAttribute("src"), false);
      assert.ok(copy.window.document.getElementById("nova-whiteboard-recordings"));
      assert.ok(copy.window.document.getElementById("nova-wb-audio-1"));
      assert.equal(JSON.parse(copy.window.document.getElementById("nova-whiteboard-appearance").textContent).first_character, "nour");
    } finally { copy.window.close(); }
    fs.writeFileSync(path.join(folder, "narrated-custom.html"), app.downloads[0]);
    const reopened = mount("narrated-custom.html");
    try {
      assert.equal(reopened.get("scene-title").textContent, "First step");
      assert.equal(reopened.audio.hidden, false);
      assert.equal(reopened.audio.src.startsWith("data:audio/wav;base64,"), true);
      assert.equal(reopened.playCalls, 0);
      assert.equal(reopened.get("lesson-outline").children.length, 2);
    } finally { reopened.close(); }
  } finally { app.close(); }
});

test("unsupported browser downloads are reported without pretending a file was saved", () => {
  const app = mount();
  try {
    app.get("wb-save-customized").click();
    assert.match(app.get("wb-customization-status").textContent, /لم يبدأ تنزيل/);
  } finally { app.close(); }
});

test("English stays LTR despite an Arabic comma and appears above its RTL Arabic counterpart", () => {
  const app = mount("pairs.html");
  try {
    assert.equal(app.get("wb-language-layout").value, "stacked");
    const pairs = app.get("wb-rows").querySelectorAll(".bilingual-pair");
    assert.equal(pairs.length, 2);
    const [english, arabic] = pairs[0].querySelectorAll("text");
    assert.equal(english.getAttribute("direction"), "ltr");
    assert.equal(arabic.getAttribute("direction"), "rtl");
    assert.ok(Number(english.getAttribute("y")) < Number(arabic.getAttribute("y")));
    assert.equal(english.textContent, "Hello، everyone.");
    assert.equal(arabic.textContent, "مرحبًا بكم.");
    const paragraphs = app.get("step-transcript").children;
    assert.equal(paragraphs[0].dir, "ltr");
    assert.equal(paragraphs[0].style.textAlign, "left");
    assert.equal(paragraphs[1].dir, "rtl");
    assert.equal(paragraphs[1].style.textAlign, "right");
    assert.equal(app.networkCalls, 0);
  } finally { app.close(); }
});

test("columns put English on the left and Arabic on the right without changing lesson data", () => {
  const app = mount("pairs.html", { width: 1200 });
  try {
    const manifest = app.get("nova-whiteboard-data").textContent;
    input(app, "wb-language-layout", "columns", "change");
    const pair = app.get("wb-rows").querySelector(".bilingual-pair");
    assert.equal(pair.dataset.layout, "columns");
    const [english, arabic] = pair.querySelectorAll("text");
    assert.equal(english.getAttribute("y"), arabic.getAttribute("y"));
    assert.ok(Number(english.getAttribute("x")) < Number(arabic.getAttribute("x")));
    assert.equal(app.get("step-transcript").dataset.layout, "columns");
    assert.equal(app.get("nova-whiteboard-data").textContent, manifest);
    assert.equal(appearance(app).layout, "columns");
    assert.equal(app.playCalls, 0);
  } finally { app.close(); }
});

test("column preference stacks on narrow screens then restores columns after resize", () => {
  const app = mount("pairs.html", { width: 720 });
  try {
    input(app, "wb-language-layout", "columns", "change");
    let pair = app.get("wb-rows").querySelector(".bilingual-pair");
    assert.equal(pair.dataset.layout, "stacked");
    let [english, arabic] = pair.querySelectorAll("text");
    assert.ok(Number(english.getAttribute("y")) < Number(arabic.getAttribute("y")));
    assert.equal(appearance(app).layout, "columns");
    app.window.innerWidth = 1200;
    app.window.dispatchEvent(new app.window.Event("resize"));
    pair = app.get("wb-rows").querySelector(".bilingual-pair");
    assert.equal(pair.dataset.layout, "columns");
    [english, arabic] = pair.querySelectorAll("text");
    assert.equal(english.getAttribute("y"), arabic.getAttribute("y"));
  } finally { app.close(); }
});

test("script order disables presentation pairing and sentence colors still address original rows", () => {
  const app = mount("pairs.html");
  try {
    input(app, "wb-language-layout", "script", "change");
    assert.equal(app.get("wb-rows").querySelectorAll(".bilingual-pair").length, 0);
    input(app, "wb-sentence", "1", "change");
    input(app, "wb-sentence-color", "#475569");
    input(app, "wb-language-layout", "columns", "change");
    assert.equal(app.get("wb-rows").querySelector('text[data-row="1"]').getAttribute("fill"), "#475569");
    assert.notEqual(app.get("wb-rows").querySelector('text[data-row="0"]').getAttribute("fill"), "#475569");
    assert.equal(app.get("step-transcript").children[1].textContent, "مرحبًا بكم.");
  } finally { app.close(); }
});

test("layout changes during narration preserve the audio position and playback state", async () => {
  const app = mount("audio.html");
  try {
    app.get("wb-play").click();
    await Promise.resolve();
    app.position(0.6);
    const plays = app.playCalls;
    input(app, "wb-language-layout", "columns", "change");
    assert.equal(app.audio.currentTime, 0.6);
    assert.equal(app.audio.paused, false);
    assert.equal(app.get("position-label").textContent, "60%");
    assert.equal(app.playCalls, plays);
    assert.equal(app.frames, 1);
  } finally { app.close(); }
});
