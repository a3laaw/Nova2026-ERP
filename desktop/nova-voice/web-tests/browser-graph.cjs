"use strict";
// Optional REAL browser/export checks. All diagrams are explicitly authored;
// diagnostic tones are not speech and this never contacts an inference service.
// Supply existing Playwright, Chromium, Python and FFmpeg. No tool downloads.
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { execFileSync } = require("node:child_process"), { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const project = path.resolve(__dirname, ".."), python = process.env.NOVA_VOICE_PYTHON || "python";
const retained = !!process.env.NOVA_BROWSER_OUTPUT;
const out = retained ? path.resolve(process.env.NOVA_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), "nova-graph-browser-"));
fs.mkdirSync(out, { recursive: true });
const example = path.join(project, "examples/composition-demo.html"), results = [], errors = [], requests = [];
const readData = filename => JSON.parse(fs.readFileSync(filename, "utf8").match(/<script id="nova-whiteboard-data" type="application\/json">(.*?)<\/script>/s)[1]);
const data = readData(example);
const py = (code, ...args) => execFileSync(python, ["-c", code, ...args], { cwd: project, encoding: "utf8", stdio: "pipe" });
function watch(page) {
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
}
async function tools(p) { await p.locator("#wb-output").evaluate(n => n.open = true); await p.locator("#wb-output-review").check(); }
async function seek(p, now) {
  await p.locator("#wb-audio").evaluate((a, t) => { a.currentTime = t; }, now);
  await p.waitForFunction(() => !document.getElementById("wb-audio").seeking);
}
py(`from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys,math,struct,copy
from nova_voice.whiteboard import parse_lesson,render_whiteboard_with_audio
from nova_voice.scenes import empty_plan,VisualPlan
from nova_voice.engine import SpeechEngine,DialogueVoice,RenderOptions
from nova_voice.voices import VoiceSpec
p=Path(sys.argv[1]); example=Path('examples/composition-demo.json')
import json
original=json.loads(example.read_text(encoding='utf-8'))
lesson=parse_lesson('# Authored composition diagnostic, NOT narration'+chr(10)+'First diagnostic tone.'+chr(10)+'Second diagnostic tone.')
plan=empty_plan(lesson.manifest()); actor=copy.deepcopy(original['steps'][0]['elements'][1]);actor.update(x=50,y=70)
actor['motion']=dict(type='sequence',span=2,frames=[dict(at=0,dx=0,scale=65),dict(at=1000,dx=160,scale=65)])
sphere=copy.deepcopy(original['steps'][1]['elements'][0]);sphere.update(x=680,y=200,r=120,fill='#2563EB',gradient=dict(color='#64748B',axis='vertical'))
plan['steps'][0]['elements']=[actor,sphere,dict(kind='sector',row=0,x=480,y=110,r=55,inner=30,start=-90,sweep=90,fill='#FFB000',gradient=dict(color='#FF5722',axis='radial')),dict(kind='circle',row=0,x=100,y=350,r=15,fill='#2563EB',motion=dict(type='curve',points=[[0,0],[80,-120],[160,0]],ease='smooth')),dict(kind='circle',row=1,x=480,y=250,r=25,fill='#2563EB',motion=dict(type='sequence',frames=[dict(at=0,fill='#2563EB'),dict(at=1000,fill='#FF5722')]))]
plan['notes']=['Authored diagnostic geometry and tones, not a model answer or speech.']
lesson=replace(lesson,visuals=VisualPlan.from_data(plan,lesson.manifest()))
voice=replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')),sample_rate=8000)
class Tone(SpeechEngine):
 def _load(self,spec):
  def synthesize(text,syn_config):
   hz=440 if text.startswith('First') else 660
   count=8000 if text.startswith('First') else 4800
   pcm=b''.join(struct.pack('<h',int(5000*math.sin(2*math.pi*hz*i/8000))) for i in range(count))
   yield SimpleNamespace(sample_rate=8000,sample_width=2,sample_channels=1,audio_int16_bytes=pcm)
  return SimpleNamespace(config=SimpleNamespace(sample_rate=8000,length_scale=1),synthesize=synthesize)
render_whiteboard_with_audio(Tone(),lesson,{1:DialogueVoice(voice)},p/'composition-tone.html',RenderOptions(),audio_format='wav')
`, out);
(async () => {
  assert.ok(process.env.NOVA_CHROMIUM && process.env.NOVA_FFMPEG, "Explicit NOVA_CHROMIUM and NOVA_FFMPEG paths required.");
  const browser = await chromium.launch({ executablePath: process.env.NOVA_CHROMIUM, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  try {
    for (const width of [360, 768, 1366]) {
      const c = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true }); await c.setOffline(true);
      const p = await c.newPage(); watch(p); await p.goto(pathToFileURL(example).href); await p.evaluate(() => document.fonts.ready);
      await p.clock.install(); await p.clock.pauseAt(await p.evaluate(() => Date.now() + 100));
      await p.locator("#wb-play").evaluate(n => n.click()); await p.clock.runFor(900);
      const joint = p.locator('#wb-rows [data-scene-name="طرف 1"]'), body = p.locator('#wb-rows [data-scene-name="جسم ذو أطراف مترابطة"]');
      const firstJoint = await joint.getAttribute("transform"), firstBody = await body.getAttribute("transform");
      await p.clock.runFor(800);
      assert.notEqual(await joint.getAttribute("transform"), firstJoint); assert.notEqual(await body.getAttribute("transform"), firstBody);
      await p.locator("#wb-play").evaluate(n => n.click()); const paused = await p.locator("#wb-rows").evaluate(n => n.outerHTML);
      await p.clock.runFor(1100); assert.equal(await p.locator("#wb-rows").evaluate(n => n.outerHTML), paused);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.locator("#whiteboard").screenshot({ path: path.join(out, `parts-${width}.png`) });
      results.push({ case: "articulated parts AND moving body on source clock, deterministic pause, no horizontal clipping", width });
      await p.locator("#lesson-outline button").nth(1).evaluate(n => n.click()); await p.clock.runFor(650);
      await p.locator("#wb-play").evaluate(n => n.click()); await p.clock.runFor(900);
      const grid = p.locator("#wb-rows [data-sphere-grid]"), before = await grid.getAttribute("d");
      await p.clock.runFor(800); assert.notEqual(await grid.getAttribute("d"), before);
      assert.ok(!/NaN|Infinity/.test(await p.locator("#wb-rows").evaluate(n => n.outerHTML)));
      await p.locator("#wb-play").evaluate(n => n.click());
      await p.locator("#whiteboard").screenshot({ path: path.join(out, `sphere-${width}.png`) });
      results.push({ case: "changing projected sphere surface, stable outline/shading, finite paths", width });
      await tools(p); await p.locator("#wb-print-preview").evaluate(n => n.click());
      assert.deepEqual(await p.locator(".print-speech").allTextContents(), data.steps.flatMap(s => s.rows.map(r => r.text)));
      assert.equal(await p.locator(".print-step").count(), 4);
      assert.ok(await p.locator('figcaption').count() >= 15); assert.equal(await p.locator("#wb-print-root [stroke-dasharray]").count(), 0);
      const counts = await p.locator(".print-cue").evaluateAll(nodes => nodes.map(n => n.querySelectorAll("figure").length)); assert.ok(counts.every(n => n <= 8));
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 1366) await p.pdf({ path: path.join(out, "composition-a4.pdf"), preferCSSPageSize: true, printBackground: true });
      await p.locator('.print-step[data-print-step="2"]').screenshot({ path: path.join(out, `reveal-${width}.png`) });
      results.push({ case: "all nine original narration rows; bounded multi-row/repeated motion stills and nested reveal", width, snapshots: await p.locator("figcaption").count() });
      const waiting = p.waitForEvent("download"); await p.locator("#wb-save-customized").evaluate(n => n.click());
      const saved = path.join(out, `saved-${width}.html`); await (await waiting).saveAs(saved);
      py("from nova_voice.whiteboard import WhiteboardPage\nfrom pathlib import Path\nimport sys\nassert WhiteboardPage.load(Path(sys.argv[1])).lesson==WhiteboardPage.load(Path(sys.argv[2])).lesson", example, saved);
      await p.goto(pathToFileURL(saved).href); assert.equal(await p.locator("#wb-output-review").isChecked(), false); assert.equal(await p.locator("#wb-print").isDisabled(), true);
      results.push({ case: "real saved Blob preserves bound source/parts and requires fresh review", width }); await c.close();
    }
    const quiet = await browser.newContext({ reducedMotion: "reduce" }); await quiet.setOffline(true);
    const q = await quiet.newPage(); watch(q); await q.goto(pathToFileURL(example).href); await q.clock.install(); await q.clock.pauseAt(await q.evaluate(() => Date.now() + 100));
    await q.locator("#wb-play").evaluate(n => n.click()); await q.clock.runFor(800);
    const transform = await q.locator('#wb-rows [data-scene-name="طرف 1"]').getAttribute("transform");
    await q.clock.runFor(900); assert.equal(await q.locator('#wb-rows [data-scene-name="طرف 1"]').getAttribute("transform"), transform);
    results.push({ case: "actual prefers-reduced-motion keeps static joint pose" }); await quiet.close();

    const c = await browser.newContext({ acceptDownloads: true }); await c.setOffline(true);
    const p = await c.newPage(); watch(p); const diagnostic = path.join(out, "composition-tone.html"); await p.goto(pathToFileURL(diagnostic).href); await tools(p);
    const clip = await p.locator("#nova-whiteboard-timings").evaluate(n => JSON.parse(n.textContent).steps["0"]);
    await p.waitForFunction(() => Number.isFinite(document.getElementById("wb-audio").duration));
    await seek(p, 0.25); const early = await p.locator("#wb-rows").evaluate(n => n.outerHTML);
    await seek(p, 0.75); assert.notEqual(await p.locator("#wb-rows").evaluate(n => n.outerHTML), early);
    await seek(p, 0.25); assert.equal(await p.locator("#wb-rows").evaluate(n => n.outerHTML), early);
    results.push({ case: "actual WAV seek restores exact nested pose/gradient/sphere paths, not just data" });
    await p.locator("#wb-print-preview").evaluate(n => n.click());
    const printed = await p.locator('.print-cue[data-print-row="1"] figure').first().locator('[data-scene-element="0"]').getAttribute("transform");
    const expected = Math.round(160 * (clip.lines[1].start_sample - clip.lines[0].start_sample) / (clip.lines[1].end_sample - clip.lines[0].start_sample) * 10000) / 10000;
    assert.ok(printed.includes(`translate(${expected} 0)`), printed + " expected " + expected);
    results.push({ case: "print multi-row poses use measured uneven source-row timings" });
    await p.locator("#wb-print-close").click();
    await p.locator("#wb-video-format").selectOption("webm"); await p.locator("#wb-video-scope").selectOption("all");
    const waiting = p.waitForEvent("download", { timeout: 30000 }); await p.locator("#wb-video").click();
    const webm = path.join(out, "composition-tone.webm"), mp4 = path.join(out, "composition-tone-h264.mp4"); await (await waiting).saveAs(webm);
    await p.waitForFunction(() => !document.body.dataset.novaExporting);
    const converted = execFileSync(python, ["tools/convert_video.py", webm, mp4, "--ffmpeg", process.env.NOVA_FFMPEG, "--reviewed", "--overwrite"], { cwd: project, encoding: "utf8", timeout: 120000 });
    assert.ok(converted.includes("H.264 Main 3.1") && converted.includes("entire output decoded"));
    const info = JSON.parse(py("from pathlib import Path\nfrom dataclasses import asdict\nfrom nova_voice.video import inspect_mp4\nimport sys,json\nr=asdict(inspect_mp4(Path(sys.argv[1])));r['path']=str(r['path']);print(json.dumps(r))", mp4));
    assert.equal(info.width, 1280); assert.equal(info.height, 720); assert.equal(info.has_audio, true);
    const decoded = execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-i", mp4, "-map", "0:a:0", "-ac", "1", "-ar", "8000", "-af", "aresample=async=1:first_pts=0", "-f", "s16le", "pipe:1"]);
    function strength(hz, at) { let a = 0, b = 0; for (let j = 0; j < 800; j++) { const value = decoded.readInt16LE((Math.round(at * 8000) + j) * 2); a += value * Math.cos(2 * Math.PI * hz * j / 8000); b += value * Math.sin(2 * Math.PI * hz * j / 8000); } return Math.hypot(a, b); }
    const firstTime = clip.lines[0].end_sample / clip.sample_rate / 2, secondTime = (clip.lines[1].start_sample + clip.lines[1].end_sample) / clip.sample_rate / 2;
    assert.ok(strength(440, firstTime) > strength(660, firstTime) * 8);
    assert.ok(strength(660, secondTime) > strength(440, secondTime) * 8);
    results.push({ case: "REAL Canvas → WebM → H.264 Main/AAC-LC/faststart; full decode and measured-time diagnostic tone alignment", ...info });
    const frame = (at, crop) => execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-ss", String(at), "-i", mp4, "-vf", "crop=" + crop, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
    for (const [area, crop] of [["spherical surface", "180:180:710:210"], ["articulated body/parts", "280:200:220:210"]]) {
      const first = frame(firstTime, crop), second = frame(secondTime, crop); assert.equal(first.length, second.length);
      let changed = 0; for (let i = 0; i < first.length; i++) if (Math.abs(first[i] - second[i]) > 15) changed++;
      assert.ok(changed / first.length > 0.015, area + " must visibly change in the encoded video, not just in DOM");
      results.push({ case: "decoded video visibly changes " + area, changedChannels: changed, channels: first.length });
    }
    for (const [name, at] of [["encoded-first", firstTime], ["encoded-second", secondTime]]) execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-ss", String(at), "-i", mp4, "-frames:v", "1", "-y", path.join(out, name + ".png")]);
    await c.close();
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ browser: await browser.version(), results, errors, httpRequests: requests, caveat: "Authored scenes/diagnostic tones only; no live inference, native Qt/Windows/4GB or scientific/voice certification." }, null, 2));
    console.log(JSON.stringify({ passed: results.length, out, results }, null, 2));
  } finally { await browser.close(); if (!retained) fs.rmSync(out, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
