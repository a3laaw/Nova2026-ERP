"use strict";
// Media/geometry/encoding are stubbed here; real-browser QA is separate.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { mount, jsonFrom, replaceJSON, resign } = require("./scene-harness.cjs");
const DATA = "nova-whiteboard-data", TIMINGS = "nova-whiteboard-timings";
let folder;
before(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-output-"));
  execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys
from nova_voice.whiteboard import parse_lesson, save_whiteboard, render_whiteboard_with_audio
from nova_voice.scenes import VisualPlan, empty_plan
from nova_voice.engine import SpeechEngine, DialogueVoice, RenderOptions
from nova_voice.voices import VoiceSpec
root=Path(sys.argv[1])
lesson=parse_lesson('# Output test'+chr(10)+'## Temporary arrow'+chr(10)+'First cue.'+chr(10)+'Second cue.'+chr(10)+'## Formula'+chr(10)+'Two plus three.'+chr(10)+'## Question'+chr(10)+'What is the result?'+chr(10)+'## Separate answer'+chr(10)+'Five.')
p=empty_plan(lesson.manifest(),subject='Free-form data',grade='Any grade')
p['steps'][0]['elements']=[dict(kind='arrow',row=0,until=1,x=100,y=200,x2=450,y2=200,motion=dict(type='draw')),dict(kind='icons',row=1,x=550,y=100,icon='drop',count=2,columns=2,size=80,motion=dict(type='move',dx=20,dy=100))]
p['steps'][1]['elements']=[dict(kind='calculation',row=0,x=500,y=210,a=2,b=3,op='+',motion=dict(type='pulse',cycles=2))]
p['steps'][1]['rows']=[dict(index=0,display='2 + 3 = 5',speech='Two plus three equals five.')]
p['notes']=['Authored technical fixture, not live AI or a voice audition.']
visual=replace(lesson,visuals=VisualPlan.from_data(p,lesson.manifest()))
save_whiteboard(visual,root/'silent.html')
save_whiteboard(lesson,root/'plain.html')
sacred=empty_plan(lesson.manifest()); sacred['policy']='sacred'
save_whiteboard(replace(lesson,visuals=VisualPlan.from_data(sacred,lesson.manifest())),root/'sacred.html')
class Silence(SpeechEngine):
    def _load(self,spec):
        def synthesize(text,syn_config):
            yield SimpleNamespace(sample_rate=8000,sample_width=2,sample_channels=1,audio_int16_bytes=bytes(16000))
        return SimpleNamespace(config=SimpleNamespace(sample_rate=8000,length_scale=1.0),synthesize=synthesize)
voice=replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')),sample_rate=8000)
render_whiteboard_with_audio(Silence(),visual,{1:DialogueVoice(voice)},root/'audio.html',RenderOptions(),audio_format='wav')
`, folder], { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));
function app(options = {}) { return mount(folder, { file: "silent.html", ...options }); }
function approve(a) { a.get("wb-output-review").checked = true; a.get("wb-output-review").dispatchEvent(new a.window.Event("change")); }
function preview(a) { approve(a); a.get("wb-print-preview").click(); }
function alter(html, edit) { const data = jsonFrom(html, DATA); edit(data); resign(data); return replaceJSON(html, DATA, data); }
async function until(check) {
  for (let i = 0; i < 150 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(check(), "expected asynchronous output state");
}

test("outputs require a fresh review and do not allocate or animate on page load", () => {
  const a = app();
  try {
    assert.equal(a.get("wb-output-review").checked, false);
    for (const id of ["wb-print", "wb-print-preview", "wb-video"]) assert.equal(a.get(id).disabled, true);
    assert.equal(a.get("wb-video-canvas").hidden, true); assert.equal(a.frames, 0);
    a.window.dispatchEvent(new a.window.Event("beforeprint"));
    assert.equal(a.document.querySelectorAll(".print-step").length, 0);
    assert.ok(a.get("wb-print-root").textContent.includes("لم يُؤكَّد"));
    approve(a); assert.equal(a.get("wb-print").disabled, false);
    assert.equal(a.get("wb-video").disabled, true); // jsdom has no recorder/canvas stream.
    assert.ok(a.get("wb-video-support").textContent.includes("لا يدعم"));
  } finally { a.close(); }
});

test("full print contains every narration row, separate answers and temporary diagram states", () => {
  const a = app();
  try {
    preview(a);
    const root = a.get("wb-print-root"), source = jsonFrom(fs.readFileSync(path.join(folder, "silent.html"), "utf8"), DATA);
    assert.equal(root.querySelectorAll(".print-step").length, 4);
    assert.deepEqual([...root.querySelectorAll(".print-speech")].map(n => n.textContent), ["First cue.", "Second cue.", "Two plus three equals five.", "What is the result?", "Five."]);
    assert.ok(root.querySelector(".print-display").textContent.includes("2 + 3 = 5"));
    const figures = root.querySelector(".print-step").querySelectorAll("figure"); assert.equal(figures.length, 2);
    assert.equal(figures[0].querySelector('[data-scene-element="0"]').getAttribute("opacity"), "1");
    assert.equal(figures[1].querySelector('[data-scene-element="0"]').getAttribute("opacity"), "0");
    assert.equal(figures[1].querySelector('[data-scene-element="1"]').getAttribute("transform"), "translate(20 100)");
    assert.equal(figures[0].querySelector("[stroke-dasharray]"), null); // Whole static drawing.
    assert.deepEqual(jsonFrom(a.document.documentElement.outerHTML, DATA), source);
    assert.equal(root.dataset.preview, "true");
  } finally { a.close(); }
});

test("printing pauses without navigating, seeking, auto-next or changing the main diagram", () => {
  let printCalls = 0;
  const a = app({ file: "audio.html", beforeParse: w => { w.print = () => { printCalls++; w.dispatchEvent(new w.Event("beforeprint")); }; } });
  try {
    a.position(0.35); a.get("wb-play").click();
    const before = a.get("wb-rows").outerHTML, time = a.audio.currentTime, title = a.get("scene-title").textContent;
    approve(a); a.get("wb-print").click();
    assert.equal(printCalls, 1); assert.equal(a.audio.paused, true); assert.equal(a.audio.currentTime, time);
    assert.equal(a.get("wb-rows").outerHTML, before); assert.equal(a.get("scene-title").textContent, title);
    assert.equal(a.get("wb-auto-next").checked, false); assert.equal(a.frames, 0);
  } finally { a.close(); }
});

test("ink saving, preview rebuild, closing and revoking review do not mutate the lesson", () => {
  const a = app();
  try {
    const manifest = a.get(DATA).textContent; preview(a);
    a.get("wb-print-ink").checked = true; a.get("wb-print-ink").dispatchEvent(new a.window.Event("change"));
    assert.equal(a.get("wb-print-root").dataset.ink, "true");
    assert.equal(a.document.querySelectorAll(".print-step").length, 4);
    a.get("wb-print-close").click(); assert.equal(a.get("wb-print-root").childNodes.length, 0);
    preview(a); a.get("wb-output-review").checked = false; a.get("wb-output-review").dispatchEvent(new a.window.Event("change"));
    assert.equal(a.get("wb-print-root").childNodes.length, 0); assert.equal(a.get("wb-print").disabled, true);
    assert.equal(a.get(DATA).textContent, manifest);
  } finally { a.close(); }
});

for (const file of ["plain.html", "sacred.html"]) test(`full text print works without graphics or automatic recitation: ${file}`, () => {
  const a = app({ file });
  try {
    preview(a); assert.equal(a.get("wb-print-root").querySelectorAll(".print-step").length, 4);
    assert.equal(a.get("wb-print-root").querySelectorAll("svg").length, 0);
    assert.equal(a.audio.hidden, true); assert.equal(a.frames, 0);
    if (file === "sacred.html") assert.equal(a.get("wb-video").disabled, true);
  } finally { a.close(); }
});

test("print descriptions, narration and labels are literal text, never HTML or URLs", () => {
  const hostile = '<img src=x onerror="window.outputHacked=1">';
  const a = app({ transform: h => alter(h, d => {
    d.visuals.steps[0].description = hostile;
    d.visuals.steps[0].rows = [{ index: 0, display: hostile, speech: hostile }];
  }) });
  try {
    preview(a); assert.ok(a.get("wb-print-root").textContent.includes(hostile));
    assert.equal(a.document.querySelectorAll("img,iframe,object").length, 0);
    assert.equal(a.window.outputHacked, undefined);
  } finally { a.close(); }
});

for (const motion of [null, { type: "move", dx: 301, dy: 0 }, { type: "pulse", cycles: 5 }, { type: "draw", code: "alert(1)" }]) {
  test(`invalid motion fails closed for playback AND all outputs: ${JSON.stringify(motion)}`, () => {
    const a = app({ transform: h => alter(h, d => { d.visuals.steps[0].elements[0].motion = motion; }) });
    try {
      approve(a);
      for (const id of ["wb-play", "wb-print", "wb-print-preview", "wb-video"]) assert.equal(a.get(id).disabled, true);
      assert.equal(a.document.querySelectorAll(".print-step,[data-scene-element]").length, 0);
    } finally { a.close(); }
  });
}

test("drawing, translation and pulse use row samples with deterministic reverse seek and pause", () => {
  const a = app({ file: "audio.html" });
  try {
    const clip = jsonFrom(fs.readFileSync(path.join(folder, "audio.html"), "utf8"), TIMINGS).steps["0"];
    a.position(0.3);
    const arrow = a.document.querySelector('[data-scene-element="0"] line');
    assert.ok(Number(arrow.getAttribute("stroke-dashoffset")) > 0 && Number(arrow.getAttribute("stroke-dashoffset")) < 100);
    const before = arrow.getAttribute("stroke-dashoffset");
    a.position(0.9); assert.equal(arrow.getAttribute("stroke-dashoffset"), "0");
    a.position(0.3, "seeked"); assert.equal(arrow.getAttribute("stroke-dashoffset"), before);
    const onset = clip.lines[1].start_sample / clip.sample_rate;
    for (const rate of [0.5, 1, 2]) {
      a.audio.playbackRate = rate; a.position(onset + 0.5);
      assert.equal(a.document.querySelector('[data-scene-element="1"]').getAttribute("transform"), "translate(10 50)");
    }
    assert.equal(a.frames, 0);
    a.get("wb-next").click(); a.finishErase(); a.position(0.25);
    const calculation = a.document.querySelector('[data-scene-element="0"] text');
    assert.equal(calculation.getAttribute("opacity"), "0.78");
    a.position(0.5); assert.equal(calculation.getAttribute("opacity"), "1");
    a.position(0.25, "seeked"); assert.equal(calculation.getAttribute("opacity"), "0.78");
  } finally { a.close(); }
});

test("explicit none also disables legacy entrance offsets, while default icons reveal in order", () => {
  const a = app();
  try {
    const parent = a.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const step = { elements: [
      { kind: "circle", row: 0, x: 100, y: 100, r: 30, dx: 120, dy: 40, motion: { type: "none" } },
      { kind: "icons", row: 0, x: 200, y: 100, icon: "apple", count: 4, columns: 4, size: 60 },
    ] };
    const view = a.window.novaWhiteboardScenes.mount(parent, step, 1000, 0, "test");
    view.update([{ start: 0, end: 1000 }], 100, false);
    assert.equal(parent.querySelector('[data-scene-element="0"]').getAttribute("transform"), "translate(0 0)");
    assert.equal(parent.querySelector('[data-scene-element="0"] [stroke-dasharray]'), null);
    const icons = parent.querySelector('[data-scene-element="1"]');
    assert.deepEqual([...icons.children].map(n => n.getAttribute("opacity")), ["1", "0", "0", "0"]);
    view.update([{ start: 0, end: 1000 }], 700, false);
    assert.deepEqual([...icons.children].map(n => n.getAttribute("opacity")), ["1", "1", "1", "1"]);
  } finally { a.close(); }
});

for (const reducedMotion of [false, true]) test(`motion off/reduced-motion leaves row cues but no tracing or movement: ${reducedMotion}`, () => {
  const a = app({ file: "audio.html", reducedMotion });
  try {
    if (!reducedMotion) { a.get("wb-scene-motion").checked = false; a.get("wb-scene-motion").dispatchEvent(new a.window.Event("change")); }
    a.position(1.5);
    const second = a.document.querySelector('[data-scene-element="1"]');
    assert.equal(second.getAttribute("opacity"), "1"); assert.equal(second.getAttribute("transform"), "translate(0 0)");
    assert.equal(a.document.querySelector("[stroke-dasharray]"), null);
  } finally { a.close(); }
});

test("customized save strips full print DOM and transient review/progress state", () => {
  const a = app({ captureDownloads: true }); let saved;
  try {
    preview(a); assert.equal(a.document.querySelectorAll(".print-step").length, 4);
    a.get("wb-save-customized").click(); saved = a.downloads[0];
    assert.ok(!saved.includes('data-print-step="')); assert.ok(!saved.includes('data-scene-element="'));
    assert.ok(!saved.includes('data-preview="true"')); assert.ok(!saved.includes('id="wb-output-review" type="checkbox" checked'));
    fs.writeFileSync(path.join(folder, "customized.html"), saved);
    execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", "from pathlib import Path; import sys; from nova_voice.whiteboard import WhiteboardPage; assert WhiteboardPage.load(Path(sys.argv[1])).lesson == WhiteboardPage.load(Path(sys.argv[2])).lesson", path.join(folder, "silent.html"), path.join(folder, "customized.html")], { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
  } finally { a.close(); }
  const b = app({ transform: () => saved });
  try { assert.equal(b.get("wb-output-review").checked, false); assert.equal(b.get("wb-print").disabled, true); } finally { b.close(); }
});

// Controlled browser API simulation. The fake bytes are NOT encoded video.
function videoAPIs(options = {}) {
  const state = { downloads: [], blobs: new Map(), tracks: [], contexts: [], recorders: [], draws: 0, decodes: 0 };
  state.install = w => {
    const realTimeout = w.setTimeout.bind(w); let now = 0, id = 0;
    w.setTimeout = (fn, ms) => realTimeout(() => { if (ms <= 1000) now += Math.max(1, ms); fn(); }, ms <= 1000 ? 0 : ms);
    Object.defineProperty(w.performance, "now", { value: () => now });
    w.Blob = Blob;
    w.URL.createObjectURL = blob => { const url = "blob:output-" + ++id; state.blobs.set(url, blob); return url; };
    w.URL.revokeObjectURL = url => state.blobs.delete(url);
    w.HTMLAnchorElement.prototype.click = function () { state.downloads.push({ filename: this.download, blob: state.blobs.get(this.href) }); };
    const track = kind => { const t = { kind, stopped: false, requestFrame() {}, stop() { this.stopped = true; } }; state.tracks.push(t); return t; };
    w.MediaStream = class {
      constructor(tracks = [track("video")]) { this.tracks = tracks; }
      getTracks() { return this.tracks; } getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
      getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); } addTrack(t) { this.tracks.push(t); }
    };
    w.HTMLCanvasElement.prototype.captureStream = () => new w.MediaStream();
    w.HTMLCanvasElement.prototype.getContext = () => ({ measureText: text => ({ width: Array.from(text).length * 9 }), drawImage() { state.draws++; } });
    w.Image = class { set src(value) { if (value) queueMicrotask(() => {
      if (options.stallFrame && state.draws === 2) now += 500;
      if (this.onload) this.onload();
    }); } };
    w.AudioContext = class {
      constructor() { this.state = "suspended"; this.time = 0; state.contexts.push(this); }
      get currentTime() { return now / 1000 * (options.clockDrift ? 0.1 : 1); }
      resume() { this.state = "running"; return Promise.resolve(); }
      close() { this.state = "closed"; return Promise.resolve(); }
      decodeAudioData() { state.decodes++; return options.hangDecode ? new Promise(() => {}) : Promise.resolve({ duration: 0.3, length: 2400, numberOfChannels: 1 }); }
      createMediaStreamDestination() { return { stream: new w.MediaStream([track("audio")]) }; }
      createConstantSource() { return { offset: { value: 1 }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
      createBufferSource() { return { connect() {}, start() {}, stop() {}, disconnect() {} }; }
    };
    w.MediaRecorder = class {
      static isTypeSupported(type) { return type.startsWith("video/webm") || !!options.mp4; }
      constructor(stream, config) { this.mimeType = options.badContainer ? "video/mp4" : config.mimeType; this.state = "inactive"; state.recorders.push(this); }
      start() { this.state = "recording"; if (options.recorderError) queueMicrotask(() => this.onerror()); }
      stop() {
        this.state = "inactive";
        queueMicrotask(() => {
          this.ondataavailable({ data: options.tooLarge ? { size: 128 * 1024 * 1024 + 1 } : new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])], { type: this.mimeType }) });
          this.onstop();
        });
      }
    };
  };
  return state;
}

test("silent video has no audio context, locks controls, validates the real container type and cleans tracks", async () => {
  const fake = videoAPIs(), a = app({ beforeParse: fake.install });
  try {
    approve(a); assert.equal(a.get("wb-video").disabled, false);
    a.get("wb-video-scope").value = "current"; a.get("wb-video").click();
    assert.equal(a.get("wb-next").disabled, true); assert.equal(a.get("wb-output-review").disabled, true);
    a.window.dispatchEvent(new a.window.KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await until(() => !a.document.body.dataset.novaExporting);
    assert.equal(fake.downloads.length, 1); assert.match(fake.downloads[0].filename, /^NovaVoice-step-1-[a-f0-9]+\.webm$/);
    assert.equal(fake.contexts.length, 0); assert.ok(fake.draws > 0); assert.ok(fake.tracks.every(t => t.stopped));
    assert.equal(a.get("scene-title").textContent, "Temporary arrow"); assert.equal(a.get("wb-next").disabled, false);
    assert.equal(a.get("wb-video-cancel").disabled, true); assert.equal(a.get("wb-video-canvas").hidden, true);
    assert.ok(a.get("wb-output-status").textContent.includes("صامت"));
  } finally { a.close(); }
});

test("narrated video decodes one embedded clip per step, records its audio track and closes the context", async () => {
  const fake = videoAPIs(), a = app({ file: "audio.html", beforeParse: fake.install });
  try {
    approve(a); a.get("wb-video").click(); await until(() => !a.document.body.dataset.novaExporting);
    assert.equal(fake.downloads.length, 1); assert.equal(fake.decodes, 4);
    assert.equal(fake.contexts[0].state, "closed"); assert.ok(fake.tracks.some(t => t.kind === "audio"));
    assert.ok(fake.tracks.every(t => t.stopped)); assert.equal(a.audio.paused, true);
    assert.ok(a.get("wb-output-status").textContent.includes("بالصوت المضمّن"));
  } finally { a.close(); }
});

for (const [name, options] of [["stalled frame", { stallFrame: true }], ["audio/wall clock drift", { clockDrift: true }]]) {
  test(`${name} aborts without publishing an unchecked out-of-sync video`, async () => {
    const fake = videoAPIs(options), a = app({ file: "audio.html", beforeParse: fake.install });
    try {
      approve(a); a.get("wb-video").click(); await until(() => !a.document.body.dataset.novaExporting);
      assert.equal(fake.downloads.length, 0); assert.ok(a.get("wb-output-status").textContent.includes("الجهاز مشغول"));
      assert.equal(fake.contexts[0].state, "closed"); assert.ok(fake.tracks.every(t => t.stopped));
      assert.equal(a.get("wb-video").disabled, false);
    } finally { a.close(); }
  });
}

test("cancel during a pending audio decode is bounded, cleans resources and never downloads partial data", async () => {
  const fake = videoAPIs({ hangDecode: true }), a = app({ file: "audio.html", beforeParse: fake.install });
  try {
    approve(a); a.get("wb-video").click(); await until(() => fake.decodes > 0); a.get("wb-video-cancel").click();
    await until(() => !a.document.body.dataset.novaExporting);
    assert.equal(fake.downloads.length, 0); assert.equal(fake.contexts[0].state, "closed");
    assert.ok(fake.tracks.every(t => t.stopped)); assert.ok(a.get("wb-output-status").textContent.includes("أُلغي"));
    assert.equal(a.get("wb-video").disabled, false);
  } finally { a.close(); }
});

for (const [name, options] of [["encoder error", { recorderError: true }], ["mismatched MP4 container", { badContainer: true }], ["memory cap", { tooLarge: true }]]) {
  test(`${name} fails without a misleading or partial video download`, async () => {
    const fake = videoAPIs(options), a = app({ beforeParse: fake.install });
    try {
      approve(a); a.get("wb-video-scope").value = "current"; a.get("wb-video").click();
      await until(() => !a.document.body.dataset.novaExporting);
      assert.equal(fake.downloads.length, 0); assert.ok(fake.tracks.every(t => t.stopped));
      assert.equal(a.get("wb-video").disabled, false); assert.equal(a.get("wb-video-cancel").disabled, true);
      assert.ok(!a.get("wb-output-status").textContent.includes("طُلب تنزيل"));
    } finally { a.close(); }
  });
}

test("opening print during export cancels it rather than recording a blocked print dialog", async () => {
  const fake = videoAPIs({ hangDecode: true }), a = app({ file: "audio.html", beforeParse: fake.install });
  try {
    approve(a); a.get("wb-video").click(); await until(() => fake.decodes > 0);
    a.window.dispatchEvent(new a.window.Event("beforeprint")); await until(() => !a.document.body.dataset.novaExporting);
    assert.equal(fake.downloads.length, 0); assert.equal(a.get("wb-print-root").querySelectorAll(".print-step").length, 0);
    assert.ok(a.get("wb-output-status").textContent.includes("الطباعة"));
  } finally { a.close(); }
});

test("hidden-page cancellation also interrupts pending decoding, not just active frame recording", async () => {
  const fake = videoAPIs({ hangDecode: true }), a = app({ file: "audio.html", beforeParse: fake.install });
  try {
    approve(a); a.get("wb-video").click(); await until(() => fake.decodes > 0);
    Object.defineProperty(a.document, "hidden", { configurable: true, value: true });
    a.document.dispatchEvent(new a.window.Event("visibilitychange"));
    await until(() => !a.document.body.dataset.novaExporting);
    assert.equal(fake.downloads.length, 0); assert.equal(fake.contexts[0].state, "closed");
    assert.ok(fake.tracks.every(t => t.stopped)); assert.ok(a.get("wb-output-status").textContent.includes("مخفية"));
  } finally { a.close(); }
});

test("WebM duration finalization changes exactly seven metadata bytes, never cluster offsets", async () => {
  const a = app({ beforeParse: w => { w.Blob = Blob; } });
  try {
    const bytes = new Uint8Array([0x1a,0x45,0xdf,0xa3,0x80, 0x18,0x53,0x80,0x67,0xff, 0x15,0x49,0xa9,0x66,0x87, 0x2a,0xd7,0xb1,0x83,0x0f,0x42,0x40, 0x1f,0x43,0xb6,0x75,0x80]);
    const input = new Blob([bytes], { type: "video/webm" });
    const output = await a.window.novaWhiteboardOutput.webmDuration(input, 2.5), changed = new Uint8Array(await output.arrayBuffer());
    assert.equal(output.size, input.size); assert.deepEqual(changed.slice(0, 15), bytes.slice(0, 15));
    assert.deepEqual(changed.slice(22), bytes.slice(22)); assert.deepEqual([...changed.slice(15, 18)], [0x44, 0x89, 0x84]);
    assert.equal(new DataView(changed.buffer).getFloat32(18, false), 2500);
    assert.equal(await a.window.novaWhiteboardOutput.webmDuration(input, Infinity), input);
    assert.equal(await a.window.novaWhiteboardOutput.webmDuration(new Blob(["unknown"], { type: "video/webm" }), 2).then(b => b.size), 7);
    assert.equal(await a.window.novaWhiteboardOutput.containerExtension(output), "webm");
  } finally { a.close(); }
});
