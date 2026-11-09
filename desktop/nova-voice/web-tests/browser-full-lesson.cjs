"use strict";
// Optional real-browser QA, NOT part of npm test or a desktop/runtime dependency.
// Requires separately installed playwright-core + a Chromium executable (or @sparticuz/chromium).
// All pages are local/offline. Content is authored; audio is tiny-ONNX synthetic SILENCE.
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright-core");
const project = path.resolve(__dirname, "..");
const file = path.join(project, "examples", "complete-lesson-demo.html");
const source = JSON.parse(fs.readFileSync(file, "utf8").match(/<script id="nova-whiteboard-data" type="application\/json">(.*?)<\/script>/s)[1]);
const python = process.env.NOVA_VOICE_PYTHON || "python";
const retained = !!process.env.NOVA_BROWSER_OUTPUT;
const output = retained ? path.resolve(process.env.NOVA_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), "nova-full-browser-"));
fs.mkdirSync(output, { recursive: true });
const results = [], errors = [], requests = [];
function runPython(code, ...args) {
  execFileSync(python, ["-c", code, ...args], { cwd: project, stdio: "pipe" });
}
function track(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
}
async function phase(page, index, row) {
  const values = await page.locator("[data-scene-element]").evaluateAll(nodes => nodes.map(n => n.getAttribute("opacity")));
  assert.equal(values.length, source.visuals.steps[index].elements.length);
  values.forEach((v, i) => assert.equal(v, source.visuals.steps[index].elements[i].row <= row ? "1" : "0", `step ${index}, row ${row}, element ${i}`));
}
async function navigate(page, index, controlled = true) {
  await page.locator("#lesson-outline button").nth(index).evaluate(n => n.click());
  if (controlled) await page.clock.runFor(650);
  else await page.waitForFunction(title => document.querySelector("#scene-title").textContent === title, source.steps[index].title);
  assert.equal(await page.locator("#scene-title").textContent(), source.steps[index].title);
}
async function brief(page) {
  assert.equal(await page.locator(".visual-brief p").textContent(), source.visuals.origin.brief.text);
  assert.equal(await page.locator(".visual-brief p").evaluate(n => getComputedStyle(n).whiteSpace), "pre-wrap");
}
async function save(page, name, recordings = false) {
  const pending = page.waitForEvent("download");
  await page.locator("#wb-save-customized").evaluate(n => n.click());
  const downloaded = await pending, destination = path.join(output, name);
  await downloaded.saveAs(destination);
  runPython(`from pathlib import Path
import sys
from nova_voice.whiteboard import WhiteboardPage
a=WhiteboardPage.load(Path(sys.argv[1]),allow_recordings=${recordings ? "True" : "False"})
b=WhiteboardPage.load(Path(sys.argv[2]),allow_recordings=${recordings ? "True" : "False"})
assert a.lesson==b.lesson and a.timing==b.timing
`, recordings ? path.join(output, "synthetic-audio.html") : file, destination);
  return destination;
}
async function geometry(page, width, index) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const g = await page.evaluate(() => {
    const scene = document.querySelector("[data-visual-scene]"), frame = scene.getBoundingClientRect();
    return { width: frame.width, height: frame.height, texts: [...scene.querySelectorAll("text")].map(n => {
      const b = n.getBoundingClientRect();
      return { text: n.textContent, left: b.left - frame.left, right: b.right - frame.left, top: b.top - frame.top, bottom: b.bottom - frame.top };
    }) };
  });
  for (const t of g.texts) assert.ok(t.left >= -1 && t.right <= g.width + 1 && t.top >= -1 && t.bottom <= g.height + 1, JSON.stringify({ width, index, g, t }));
  for (let a = 0; a < g.texts.length; a++) for (let b = a + 1; b < g.texts.length; b++) {
    const x = g.texts[a], y = g.texts[b];
    assert.ok(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top, JSON.stringify({ labelCollision: [x, y], width, index }));
  }
  results.push({ case: "real SVG label bounds, non-overlap and page width", width, step: index });
}
(async () => {
  let config = { args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true };
  if (process.env.NOVA_CHROMIUM) config.executablePath = process.env.NOVA_CHROMIUM;
  else {
    const local = require("@sparticuz/chromium").default;
    config = { ...config, executablePath: await local.executablePath(), args: local.args.filter(a => a !== "--single-process") };
  }
  const browser = await chromium.launch(config);
  try {
    for (const width of [360, 768, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "no-preference", acceptDownloads: true });
      await context.setOffline(true);
      const page = await context.newPage(); track(page);
      await page.clock.install(); await page.goto(pathToFileURL(file).href); await page.evaluate(() => document.fonts.ready);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      assert.equal(await page.locator("#whiteboard").getAttribute("data-visuals"), "validated");
      assert.equal(await page.locator("#whiteboard").getAttribute("data-timing"), "silent");
      assert.equal(await page.locator("#wb-audio").evaluate(n => n.hidden && n.paused), true);
      assert.equal(await page.locator("#lesson-outline button").count(), 10);
      assert.equal(await page.locator("#wb-auto-next").isChecked(), false);
      await brief(page); results.push({ case: "offline paused objectives and exact non-narrated brief", width });
      await page.locator("#wb-rate").evaluate(n => { n.value = "2"; n.dispatchEvent(new Event("input", { bubbles: true })); });
      for (const index of [1, 2, 3, 4]) {
        await navigate(page, index); await phase(page, index, 0); await brief(page);
        await geometry(page, width, index);
        const weights = source.steps[index].rows.map(r => Math.max(1000, Array.from(r.text).length * 65));
        await page.locator("#wb-play").evaluate(n => n.click()); await page.clock.runFor(50);
        await page.clock.runFor(Math.ceil(weights[0] / 2) + 20); await phase(page, index, 1);
        await page.locator("#wb-play").evaluate(n => n.click());
        const before = await page.locator("#wb-rows").evaluate(n => n.outerHTML);
        await page.clock.runFor(1000); assert.equal(await page.locator("#wb-rows").evaluate(n => n.outerHTML), before);
        await page.locator("#wb-play").evaluate(n => n.click()); await page.clock.runFor(Math.ceil(weights[1] / 2) + 100);
        assert.equal(await page.locator("#position-label").textContent(), "100%");
        assert.equal(await page.locator("#scene-title").textContent(), source.steps[index].title);
        results.push({ case: "staged row cues at 2x, pause/resume and no automatic next", width, step: index });
      }
      await page.locator("#board-paper").screenshot({ path: path.join(output, `full-lesson-${width}.png`) });
      await navigate(page, 5);
      assert.ok(!(await page.locator("#step-transcript").textContent()).includes(source.steps[6].rows[0].text));
      await page.locator("#wb-next").evaluate(n => n.click()); await page.clock.runFor(650);
      assert.ok((await page.locator("#step-transcript").textContent()).includes(source.steps[6].rows[0].text));
      await navigate(page, 9); assert.equal(await page.locator("#wb-next").isDisabled(), true);
      results.push({ case: "question without answer, explicit separate answer, final summary", width });
      // Download while an outgoing, already-written board is being erased.
      await navigate(page, 4); await page.locator("#wb-play").evaluate(n => n.click()); await page.clock.runFor(1000);
      await page.locator("#lesson-outline button").nth(1).evaluate(n => n.click());
      assert.equal(await page.locator("#whiteboard").getAttribute("data-transition"), "erasing");
      const saved = await save(page, `customized-${width}.html`);
      await page.goto(pathToFileURL(saved).href); await navigate(page, 1); await phase(page, 1, 0); await brief(page);
      assert.equal(await page.locator("#wb-audio").evaluate(n => n.hidden && n.paused), true);
      results.push({ case: "actual Blob save during erase, Python import and offline reopen", width });
      await context.close();
    }
    // No tracing/animated transitions under reduced motion, but row cues are retained.
    const reduced = await browser.newContext({ viewport: { width: 768, height: 1000 }, reducedMotion: "reduce" });
    await reduced.setOffline(true); const page = await reduced.newPage(); track(page);
    await page.goto(pathToFileURL(file).href);
    await navigate(page, 2, false); await phase(page, 2, 0);
    assert.notEqual(await page.locator("#whiteboard").getAttribute("data-transition"), "erasing");
    await brief(page); results.push({ case: "reduced motion retains cues and original brief" });
    await reduced.close();
    // Exercise actual browser WAV decoding/seek with the existing 1602-byte ONNX
    // fixture. It generates SILENCE; this says nothing about natural Arabic voice quality.
    runPython(`import json, shutil, sys
from pathlib import Path
from nova_voice.lesson_draft import LessonDraft
from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.voices import VoiceSpec
from nova_voice.whiteboard import render_whiteboard_with_audio
root=Path(sys.argv[1]); voice_root=root/'synthetic-voice'; voice_root.mkdir(exist_ok=True)
model=voice_root/'ar-synthetic.onnx'; config=model.with_suffix('.onnx.json')
shutil.copyfile('tests/fixtures/test_voice.onnx',model)
data=json.loads(Path('tests/fixtures/test_voice.onnx.json').read_text())
data['espeak']['voice']='ar'; data['language']={'code':'ar_JO','name_native':'العربية'}
config.write_text(json.dumps(data),encoding='utf-8')
lesson=LessonDraft.load(Path('examples/complete-lesson-demo.json')).compile()
render_whiteboard_with_audio(SpeechEngine(),lesson,{1:DialogueVoice(VoiceSpec.from_path(model))},root/'synthetic-audio.html',RenderOptions(),audio_format='wav')
`, output);
    const audioContext = await browser.newContext({ viewport: { width: 1366, height: 1000 }, acceptDownloads: true });
    await audioContext.setOffline(true); const audioPage = await audioContext.newPage(); track(audioPage);
    await audioPage.goto(pathToFileURL(path.join(output, "synthetic-audio.html")).href);
    await navigate(audioPage, 1, false);
    await audioPage.waitForFunction(() => document.querySelector("#wb-audio").readyState >= 1);
    assert.equal(await audioPage.locator("#whiteboard").getAttribute("data-timing"), "measured");
    const clip = await audioPage.locator("#nova-whiteboard-timings").evaluate(n => JSON.parse(n.textContent).steps["1"]);
    const onset = clip.lines[1].start_sample / clip.sample_rate;
    for (const rate of [0.5, 1, 2]) {
      await audioPage.locator("#wb-rate").evaluate((n, r) => { n.value = String(r); n.dispatchEvent(new Event("input", { bubbles: true })); }, rate);
      assert.equal(await audioPage.locator("#wb-audio").evaluate(n => n.playbackRate), rate);
      for (const row of [0, 1, 0]) {
        await audioPage.locator("#wb-audio").evaluate((n, time) => { n.currentTime = time; }, row ? onset + 0.05 : 0);
        await audioPage.waitForFunction(() => !document.querySelector("#wb-audio").seeking);
        await phase(audioPage, 1, row);
      }
    }
    await audioPage.locator("#wb-audio").evaluate(n => { n.muted = true; });
    await audioPage.locator("#wb-play").click();
    await audioPage.waitForFunction(() => document.querySelector("#wb-audio").currentTime > 0.05);
    await audioPage.locator("#wb-play").click();
    assert.equal(await audioPage.locator("#wb-audio").evaluate(n => n.paused), true);
    await brief(audioPage); results.push({ case: "actual WAV decode/play/pause and measured seek at 0.5x/1x/2x", audio: "synthetic silence only" });
    const audioSaved = await save(audioPage, "customized-with-synthetic-audio.html", true);
    await audioPage.goto(pathToFileURL(audioSaved).href);
    assert.equal(await audioPage.locator("#whiteboard").getAttribute("data-visuals"), "validated");
    assert.equal(await audioPage.locator("#whiteboard").getAttribute("data-timing"), "measured");
    await brief(audioPage); results.push({ case: "actual measured Blob save, Python timing reimport and offline reopen" });
    await audioContext.close();
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    const report = { browser: browser.version(), results, errors, externalRequests: requests, liveAI: false, authoredFixture: true,
      syntheticPcmOnly: true, actualBrowserWavDecode: true, realVoiceQualityTest: false, nativeQtTest: false,
      clock: "controlled browser clock for silent SVG; actual media clock for synthetic WAV" };
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, results: results.length, output: retained ? output : "temporary, cleaned" }, null, 2));
  } finally { await browser.close(); if (!retained) fs.rmSync(output, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exit(1); });
