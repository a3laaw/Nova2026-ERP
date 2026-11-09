"use strict";
// Optional real offline browser + explicitly supplied local FFmpeg QA.
// Synthetic tones are diagnostic signals, NOT speech or a live-model result.
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { execFileSync } = require("node:child_process"), { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const project = path.resolve(__dirname, ".."), python = process.env.NOVA_VOICE_PYTHON || "python";
const retained = !!process.env.NOVA_BROWSER_OUTPUT;
const out = retained ? path.resolve(process.env.NOVA_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), "nova-motion-browser-"));
fs.mkdirSync(out, { recursive: true });
const example = path.join(project, "examples/advanced-motion-demo.html");
const data = JSON.parse(fs.readFileSync(example, "utf8").match(/<script id="nova-whiteboard-data" type="application\/json">(.*?)<\/script>/s)[1]);
const results = [], errors = [], requests = [];
function py(code, ...args) { return execFileSync(python, ["-c", code, ...args], { cwd: project, encoding: "utf8", stdio: "pipe" }); }
function watch(page) {
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
}
async function tools(page) { await page.locator("#wb-output").evaluate(n => n.open = true); await page.locator("#wb-output-review").check(); }
async function record(page, destination, timeout = 30000) {
  await page.locator("#wb-video-format").selectOption("webm"); await page.locator("#wb-video-scope").selectOption("all");
  const waiting = page.waitForEvent("download", { timeout }); await page.locator("#wb-video").click();
  await (await waiting).saveAs(destination); await page.waitForFunction(() => !document.body.dataset.novaExporting);
}
function convert(source, destination) {
  const text = execFileSync(python, ["tools/convert_video.py", source, destination, "--ffmpeg", process.env.NOVA_FFMPEG, "--reviewed", "--overwrite"], { cwd: project, encoding: "utf8", timeout: 120000 });
  assert.ok(text.includes("H.264 Main 3.1") && text.includes("entire output decoded"));
  const info = JSON.parse(py("from pathlib import Path\nfrom dataclasses import asdict\nfrom nova_voice.video import inspect_mp4\nimport sys,json\nr=asdict(inspect_mp4(Path(sys.argv[1])));r['path']=str(r['path']);print(json.dumps(r))", destination));
  assert.equal(info.width, 1280); assert.equal(info.height, 720); return info;
}
py(`from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys,math,struct
from nova_voice.whiteboard import parse_lesson,render_whiteboard_with_audio
from nova_voice.scenes import empty_plan,VisualPlan
from nova_voice.engine import SpeechEngine,DialogueVoice,RenderOptions
from nova_voice.voices import VoiceSpec
p=Path(sys.argv[1]); lesson=parse_lesson('# مسارات ودوران — نغمة اختبار لا نطق'+chr(10)+'## مسار القطرة'+chr(10)+'تبدأ القطرة عند موضعها.'+chr(10)+'ثم تسير في مسار توضيحي.'+chr(10)+'## دوران علامة'+chr(10)+'تدور العلامة حول محور ثابت.'+chr(10)+'الحركة رمزية وليست محاكاة.')
plan=empty_plan(lesson.manifest())
plan['steps'][0]['elements']=[dict(kind='icons',row=1,x=350,y=90,icon='drop',count=1,columns=1,size=80,motion=dict(type='path',points=[[0,0],[100,0],[100,100]],ease='smooth'))]
plan['steps'][1]['elements']=[dict(kind='arrow',row=0,x=500,y=210,x2=650,y2=210,motion=dict(type='rotate',degrees=180,cx=500,cy=210,ease='smooth'))]
lesson=replace(lesson,visuals=VisualPlan.from_data(plan,lesson.manifest()))
voice=replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')),sample_rate=8000,language_code='ar_JO',language='العربية')
class Tone(SpeechEngine):
 def _load(self,spec):
  def synthesize(text,syn_config):
   hz=440 if text.startswith(('تبدأ','تدور')) else 660
   pcm=b''.join(struct.pack('<h',int(5000*math.sin(2*math.pi*hz*i/8000))) for i in range(6400))
   yield SimpleNamespace(sample_rate=8000,sample_width=2,sample_channels=1,audio_int16_bytes=pcm)
  return SimpleNamespace(config=SimpleNamespace(sample_rate=8000,length_scale=1),synthesize=synthesize)
render_whiteboard_with_audio(Tone(),lesson,{1:DialogueVoice(voice)},p/'motion-tone.html',RenderOptions(),audio_format='wav')
`, out);
(async () => {
  assert.ok(process.env.NOVA_CHROMIUM && process.env.NOVA_FFMPEG, "Supply local NOVA_CHROMIUM and NOVA_FFMPEG; tools are never downloaded.");
  const browser = await chromium.launch({ executablePath: process.env.NOVA_CHROMIUM, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  try {
    for (const width of [360, 768, 1366]) {
      const c = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true }); await c.setOffline(true);
      const p = await c.newPage(); watch(p); await p.goto(pathToFileURL(example).href); await p.evaluate(() => document.fonts.ready);
      await p.clock.install(); await p.clock.pauseAt(await p.evaluate(() => Date.now() + 100));
      await p.locator("#lesson-outline button").nth(1).evaluate(n => n.click()); await p.clock.runFor(650);
      await p.locator("#wb-play").evaluate(n => n.click()); await p.clock.runFor(700);
      const before = await p.locator('#wb-rows [transform*="rotate("]').getAttribute("transform");
      await p.clock.runFor(500); assert.notEqual(await p.locator('#wb-rows [transform*="rotate("]').getAttribute("transform"), before);
      await p.locator("#wb-play").evaluate(n => n.click()); const paused = await p.locator("#wb-rows").evaluate(n => n.outerHTML);
      await p.clock.runFor(900); assert.equal(await p.locator("#wb-rows").evaluate(n => n.outerHTML), paused);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      results.push({ case: "real controller rotation changes on row clock, pauses and fits viewport", width });
      await tools(p); await p.locator("#wb-print-preview").evaluate(n => n.click());
      assert.deepEqual(await p.locator(".print-speech").allTextContents(), data.steps.flatMap(s => s.rows.map(r => r.text)));
      const captions = await p.locator("figcaption").allTextContents();
      const phases = captions.filter(t => t.includes("بداية الحركة")).length; assert.ok(phases >= 4);
      assert.equal(captions.filter(t => t.includes("منتصف الحركة")).length, phases);
      assert.equal(captions.filter(t => t.includes("نهاية الحركة")).length, phases);
      assert.equal(await p.locator(".print-step").count(), 10); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 1366) await p.pdf({ path: path.join(out, "motion-lesson-a4.pdf"), preferCSSPageSize: true, printBackground: true });
      await p.screenshot({ path: path.join(out, `motion-print-${width}.png`), fullPage: true });
      results.push({ case: "complete sixteen-row print with start/middle/end movement phases", width, snapshots: captions.length, movingRows: phases });
      const waiting = p.waitForEvent("download"); await p.locator("#wb-save-customized").evaluate(n => n.click());
      const file = path.join(out, `saved-${width}.html`); await (await waiting).saveAs(file);
      py("from nova_voice.whiteboard import WhiteboardPage\nfrom pathlib import Path\nimport sys\nassert WhiteboardPage.load(Path(sys.argv[1])).lesson==WhiteboardPage.load(Path(sys.argv[2])).lesson", example, file);
      await p.goto(pathToFileURL(file).href); assert.equal(await p.locator("#wb-output-review").isChecked(), false);
      assert.equal(await p.locator("#wb-print").isDisabled(), true);
      results.push({ case: "real saved Blob passes Python round-trip and offline fresh review", width }); await c.close();
    }
    const c = await browser.newContext({ acceptDownloads: true }); await c.setOffline(true);
    const p = await c.newPage(); watch(p); await p.goto(pathToFileURL(path.join(out, "motion-tone.html")).href); await tools(p);
    await p.locator("#wb-audio").evaluate(a => a.currentTime = 1.2); await p.waitForFunction(() => !document.getElementById("wb-audio").seeking);
    const moved = await p.locator('[data-scene-element="0"]').getAttribute("transform");
    await p.locator("#wb-audio").evaluate(a => a.currentTime = 0.1); await p.waitForFunction(() => !document.getElementById("wb-audio").seeking);
    assert.notEqual(await p.locator('[data-scene-element="0"]').getAttribute("transform"), moved);
    results.push({ case: "actual WAV reverse seek restores route position" });
    const webm = path.join(out, "motion-tone.webm"), mp4 = path.join(out, "motion-tone-h264.mp4");
    await record(p, webm); const info = convert(webm, mp4); assert.equal(info.has_audio, true);
    const decoded = execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-i", mp4, "-map", "0:a:0", "-ac", "1", "-ar", "8000", "-af", "aresample=async=1:first_pts=0", "-f", "s16le", "pipe:1"]);
    function strength(hz, at) { let a = 0, b = 0; for (let j = 0; j < 800; j++) { const value = decoded.readInt16LE((Math.round(at * 8000) + j) * 2); a += value * Math.cos(2 * Math.PI * hz * j / 8000); b += value * Math.sin(2 * Math.PI * hz * j / 8000); } return Math.hypot(a, b); }
    for (const [at, hz] of [[0.35, 440], [1.15, 660], [2.55, 440], [3.35, 660]]) assert.ok(strength(hz, at) > strength(hz === 440 ? 660 : 440, at) * 8);
    results.push({ case: "actual browser WebM → CLI H.264 Main/AAC-LC faststart, full decode and encoded-time tone alignment", ...info });
    const partial = []; p.on("download", d => partial.push(d));
    await p.locator("#wb-video").click();
    await p.waitForFunction(() => document.body.dataset.novaExporting === "true" && document.getElementById("wb-video-progress").value > 0.01);
    await p.evaluate(() => { const until = performance.now() + 600; while (performance.now() < until) { /* Deliberate QA stall, never product code. */ } });
    await p.waitForFunction(() => !document.body.dataset.novaExporting);
    assert.equal(partial.length, 0); assert.ok((await p.locator("#wb-output-status").textContent()).includes("الجهاز مشغول"));
    assert.equal(await p.locator("#wb-video").isDisabled(), false);
    results.push({ case: "deliberate real 600ms main-thread stall aborts without a partial download and restores controls" });
    await c.close();
    const quiet = await browser.newContext({ reducedMotion: "reduce" }); await quiet.setOffline(true);
    const q = await quiet.newPage(); watch(q); await q.goto(pathToFileURL(path.join(out, "motion-tone.html")).href);
    await q.locator("#wb-audio").evaluate(a => a.currentTime = 1.2); await q.waitForFunction(() => !document.getElementById("wb-audio").seeking);
    assert.equal(await q.locator('[data-scene-element="0"]').getAttribute("transform"), "translate(0 0)");
    results.push({ case: "native reduced-motion media query removes path motion" }); await quiet.close();
    if (process.env.NOVA_OUTPUT_DELIVERABLES) {
      const delivery = path.resolve(process.env.NOVA_OUTPUT_DELIVERABLES); fs.mkdirSync(delivery, { recursive: true });
      const cc = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 1000 } }); await cc.setOffline(true);
      const pp = await cc.newPage(); watch(pp); await pp.goto(pathToFileURL(example).href); await pp.evaluate(() => document.fonts.ready); await tools(pp);
      await pp.locator("#wb-print-preview").click(); await pp.pdf({ path: path.join(delivery, "NovaVoice-Motion-A4-v0.9.0.dev1.pdf"), preferCSSPageSize: true, printBackground: true });
      const full = path.join(out, "full-motion.webm"), h264 = path.join(delivery, "NovaVoice-Motion-H264-v0.9.0.dev1.mp4");
      await record(pp, full, 120000); const details = convert(full, h264); assert.equal(details.has_audio, false);
      results.push({ case: "complete authored animated lesson → actual silent H.264 MP4 and A4 phase PDF", ...details }); await cc.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    const report = { browser: browser.version(), checks: results.length, results, errors, externalRequests: requests, realVoice: false, liveModel: false, nativeWindows: false, h264DevicePlaybackVerified: false };
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); if (!retained) fs.rmSync(out, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
