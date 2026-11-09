"use strict";
// Authored full-lesson content; generated PCM is silence. No live model or audition.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { mount, jsonFrom, replaceJSON, resign } = require("./scene-harness.cjs");
const DATA = "nova-whiteboard-data", TIMINGS = "nova-whiteboard-timings";
const examples = path.resolve(__dirname, "../examples");
const file = "complete-lesson-demo.html";
const original = jsonFrom(fs.readFileSync(path.join(examples, file), "utf8"), DATA);
let folder;
before(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-full-lesson-"));
  execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys
from nova_voice.lesson_draft import LessonDraft
from nova_voice.whiteboard import render_whiteboard_with_audio
from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.voices import VoiceSpec
root=Path(sys.argv[1])
lesson=LessonDraft.load(Path('examples/complete-lesson-demo.json')).compile()
voice=replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')), sample_rate=8000, language_code='ar_JO', language='العربية')
class MeasuredSilence(SpeechEngine):
    def _load(self, spec):
        def synthesize(text, syn_config):
            seconds=2 if text.startswith('تسخن') else 1
            for _ in range(seconds*4):
                yield SimpleNamespace(sample_rate=8000, sample_width=2, sample_channels=1, audio_int16_bytes=bytes(4000))
        return SimpleNamespace(config=SimpleNamespace(sample_rate=8000, length_scale=1.0), synthesize=synthesize)
render_whiteboard_with_audio(MeasuredSilence(), lesson, {1:DialogueVoice(voice)}, root/'measured.html', RenderOptions(), audio_format='wav')
`, folder], { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));
function create(options = {}) { return mount(examples, { file, ...options }); }
function navigate(app, index) {
  app.get("lesson-outline").querySelectorAll("button")[index].click();
  app.finishErase();
  assert.equal(app.get("scene-title").textContent, original.steps[index].title);
}
function phase(app, index, row) {
  const elements = original.visuals.steps[index].elements;
  const nodes = [...app.document.querySelectorAll("[data-scene-element]")];
  assert.equal(nodes.length, elements.length);
  nodes.forEach((node, i) => assert.equal(node.getAttribute("opacity"), elements[i].row <= row ? "1" : "0"));
}
function change(html, update) {
  const data = jsonFrom(html, DATA); update(data); resign(data);
  return replaceJSON(html, DATA, data);
}

test("full lesson starts paused with objectives, separate original brief and ten reviewable steps", () => {
  const app = create();
  try {
    assert.equal(app.get("whiteboard").dataset.visuals, "validated");
    assert.equal(app.mode, "silent");
    assert.equal(app.audio.hidden, true); assert.equal(app.audio.paused, true);
    assert.equal(app.frames, 0); assert.equal(app.get("wb-auto-next").checked, false);
    assert.equal(app.get("lesson-outline").querySelectorAll("button").length, 10);
    assert.equal(original.steps.reduce((n, s) => n + s.rows.length, 0), 16);
    const brief = app.document.querySelector(".visual-brief");
    assert.equal(brief.querySelector("p").textContent, original.visuals.origin.brief.text);
    assert.equal(brief.querySelector("p").dir, "auto");
    assert.equal(brief.open, false);
    assert.ok(!original.script.includes(original.visuals.origin.brief.text));
    assert.ok(app.document.title.includes("مثال محلي لا API"));
  } finally { app.close(); }
});

for (const width of [360, 768, 1366]) test(`four illustrated stages follow their own narration cues in DOM width ${width}`, () => {
  const app = create({ width });
  try {
    for (const index of [1, 2, 3, 4]) {
      navigate(app, index); phase(app, index, 0);
      assert.ok(original.visuals.steps[index].elements.some(e => e.row === 1));
      app.get("wb-play").click(); app.advance(0);
      const weight = Math.max(1000, Array.from(original.steps[index].rows[0].text).length * 65);
      app.advance(weight + 1); phase(app, index, 1);
      app.get("wb-play").click();
      assert.equal(app.document.querySelector(".visual-brief p").textContent, original.visuals.origin.brief.text);
    }
  } finally { app.close(); }
});

test("question and its answer are independent steps, and summary remains a final review step", () => {
  const app = create();
  try {
    const answer = original.steps[6].rows[0].text;
    navigate(app, 5);
    assert.ok(app.get("step-transcript").textContent.includes(original.steps[5].rows[0].text));
    assert.ok(!app.get("step-transcript").textContent.includes(answer));
    assert.equal(app.audio.paused, true);
    app.get("wb-next").click(); app.finishErase();
    assert.ok(app.get("step-transcript").textContent.includes(answer));
    assert.equal(app.audio.paused, true);
    navigate(app, 9);
    assert.equal(app.get("wb-next").disabled, true);
    assert.ok(app.get("step-transcript").textContent.includes(original.steps[9].rows[0].text));
  } finally { app.close(); }
});

for (const changeName of ["missing-origin", "wrong-source", "changed-brief", "brief-hash", "draft-hash",
  "draft-hash-array", "extra-origin", "extra-brief", "subject", "grade", "protected-origin", "protected-plan"]) {
  test(`inconsistent origin is refused even if only the outer lesson hash is recomputed: ${changeName}`, () => {
    const app = create({ transform: html => change(html, data => {
      const p = data.visuals, o = p.origin;
      if (changeName === "missing-origin") delete p.origin;
      else if (changeName === "wrong-source") o.source_fingerprint = "0".repeat(64);
      else if (changeName === "changed-brief") o.brief.text += " changed";
      else if (changeName === "brief-hash") o.brief.fingerprint = "0".repeat(64);
      else if (changeName === "draft-hash") o.draft_fingerprint = "not a fingerprint";
      else if (changeName === "draft-hash-array") o.draft_fingerprint = [o.draft_fingerprint];
      else if (changeName === "extra-origin") o.authorization = true;
      else if (changeName === "extra-brief") o.brief.approved = true;
      else if (changeName === "subject") p.subject = "Another subject";
      else if (changeName === "grade") p.grade = "Another grade";
      else if (changeName === "protected-origin") o.brief.policy = "sacred";
      else p.policy = "sacred";
    }) });
    try {
      assert.equal(app.get("wb-play").disabled, true);
      assert.equal(app.get("wb-save-customized").disabled, true);
      assert.equal(app.audio.getAttribute("src"), null);
      assert.equal(app.document.querySelectorAll("[data-scene-element]").length, 0);
    } finally { app.close(); }
  });
}

test("original brief uses literal textContent, never executable markup or imported links", () => {
  const hostile = '</script><img src=x onerror="window.fullLessonHacked=1">\n  Original description.\n';
  const app = create({ transform: html => change(html, data => {
    data.visuals.origin.brief.text = hostile; resign(data.visuals.origin.brief);
  }) });
  try {
    assert.equal(app.document.querySelector(".visual-brief p").textContent, hostile);
    assert.equal(app.document.querySelectorAll("img,iframe").length, 0);
    assert.equal(app.window.fullLessonHacked, undefined);
    assert.equal(app.get("whiteboard").dataset.visuals, "validated");
    // Fingerprints are consistency checks, not source authentication or safety certification.
  } finally { app.close(); }
});

test("measured full-lesson drawings follow sample cues at any rate and seek backwards without losing the brief", () => {
  const app = mount(folder, { file: "measured.html" });
  try {
    assert.equal(app.mode, "measured");
    navigate(app, 1);
    const timings = jsonFrom(fs.readFileSync(path.join(folder, "measured.html"), "utf8"), TIMINGS);
    const clip = timings.steps["1"], onset = clip.lines[1].start_sample / clip.sample_rate;
    for (const rate of [0.5, 1, 2]) {
      app.audio.playbackRate = rate;
      app.position(onset - 0.01); phase(app, 1, 0);
      app.position(onset + 0.01); phase(app, 1, 1);
      app.position(0, "seeked"); phase(app, 1, 0);
    }
    assert.equal(app.document.querySelector(".visual-brief p").textContent, original.visuals.origin.brief.text);
    assert.equal(app.audio.paused, true);
  } finally { app.close(); }
});

test("customized measured HTML keeps original brief, expanded script, plan and timing through Python reimport", () => {
  const app = mount(folder, { file: "measured.html", captureDownloads: true });
  let saved;
  try {
    navigate(app, 4); app.position(1.1);
    app.get("wb-color-1").value = "#FF5722";
    app.get("wb-color-1").dispatchEvent(new app.window.Event("input"));
    app.get("wb-save-customized").click(); saved = app.downloads[0];
    const input = fs.readFileSync(path.join(folder, "measured.html"), "utf8");
    assert.deepEqual(jsonFrom(saved, DATA), original);
    assert.deepEqual(jsonFrom(saved, TIMINGS), jsonFrom(input, TIMINGS));
    assert.ok(!saved.includes('data-scene-element="'));
    fs.writeFileSync(path.join(folder, "customized.html"), saved);
    execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
import sys
from nova_voice.whiteboard import WhiteboardPage
root=Path(sys.argv[1])
a=WhiteboardPage.load(root/'measured.html',allow_recordings=True)
b=WhiteboardPage.load(root/'customized.html',allow_recordings=True)
assert a.lesson==b.lesson and a.timing==b.timing
assert b.appearance.first_color=='#FF5722'
`, folder], { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
  } finally { app.close(); }
  const restored = mount(folder, { file: "customized.html" });
  try {
    assert.equal(restored.mode, "measured");
    assert.equal(restored.get("wb-color-1").value.toUpperCase(), "#FF5722");
    navigate(restored, 4); phase(restored, 4, 0);
    assert.equal(restored.document.querySelector(".visual-brief p").textContent, original.visuals.origin.brief.text);
  } finally { restored.close(); }
});
