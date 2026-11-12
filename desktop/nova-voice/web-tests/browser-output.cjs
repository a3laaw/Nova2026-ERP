"use strict";
// Optional local QA, never a runtime dependency and never downloads tools.
// Requires playwright-core + a Chromium executable. FFmpeg, if explicitly given,
// is used ONLY as an independent development decoder. Audio here is a test TONE.
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const project = path.resolve(__dirname, ".."), python = process.env.NOVA_VOICE_PYTHON || "python";
const retained = !!process.env.NOVA_BROWSER_OUTPUT;
const output = retained ? path.resolve(process.env.NOVA_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), "nova-output-browser-"));
fs.mkdirSync(output, { recursive: true });
const results = [], errors = [], requests = [];
const example = path.join(project, "examples/animated-lesson-demo.html");
const manifest = JSON.parse(fs.readFileSync(example, "utf8").match(/<script id="nova-whiteboard-data" type="application\/json">(.*?)<\/script>/s)[1]);
function runPython(code, ...args) { return execFileSync(python, ["-c", code, ...args], { cwd: project, stdio: "pipe" }); }
function track(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
}
async function open(context, file = example) {
  const page = await context.newPage(); track(page); await page.goto(pathToFileURL(file).href); await page.evaluate(() => document.fonts.ready); return page;
}
async function outputTools(page) { await page.locator("#wb-output").evaluate(n => { n.open = true; }); await page.locator("#wb-output-review").evaluate(n => { n.checked = true; n.dispatchEvent(new Event("change", { bubbles: true })); }); }
async function record(page, format, destination, scope = "all", timeout = 45000) {
  await page.locator("#wb-video-format").selectOption(format); await page.locator("#wb-video-scope").selectOption(scope);
  const pending = page.waitForEvent("download", { timeout }); await page.locator("#wb-video").click(); const download = await pending;
  assert.match(download.suggestedFilename(), new RegExp("^NovaVoice-[a-z0-9-]+\\." + format + "$"));
  await download.saveAs(destination); await page.waitForFunction(() => !document.body.dataset.novaExporting);
  assert.ok((await page.locator("#wb-output-status").textContent()).includes(format.toUpperCase()));
  assert.equal(await page.locator("#wb-video-canvas").isHidden(), true);
  return download.suggestedFilename();
}
async function decodeInBrowser(page, filename, expectedAudio) {
  await page.evaluate(file => {
    const old = document.getElementById("qa-decoded-video"); if (old) old.remove();
    const video = document.createElement("video"); video.id = "qa-decoded-video"; video.controls = true; video.src = file; document.body.append(video);
  }, filename);
  await page.waitForFunction(() => document.getElementById("qa-decoded-video").readyState >= 2);
  const info = await page.locator("#qa-decoded-video").evaluate(v => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }));
  assert.equal(info.width, 1280); assert.equal(info.height, 720); assert.ok(Number.isFinite(info.duration) && info.duration > 2);
  await page.locator("#qa-decoded-video").evaluate(v => { v.currentTime = v.duration * 0.6; });
  await page.waitForFunction(() => !document.getElementById("qa-decoded-video").seeking);
  await page.locator("#qa-decoded-video").evaluate(v => v.play()); await page.waitForTimeout(150);
  assert.equal(await page.locator("#qa-decoded-video").evaluate(v => v.paused), false);
  await page.locator("#qa-decoded-video").evaluate(v => { v.pause(); });
  results.push({ case: "real downloaded container decodes, seeks and plays", filename, ...info, expectedAudio });
}
function externalDecode(file, audio) {
  if (!process.env.NOVA_FFMPEG) return;
  const binary = process.env.NOVA_FFMPEG;
  const analysis = execFileSync(binary, ["-hide_banner", "-i", file, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(typeof analysis, "string");
  if (audio) {
    const raw = execFileSync(binary, ["-v", "error", "-i", file, "-map", "0:a:0", "-ac", "1", "-ar", "8000", "-af", "aresample=async=1:first_pts=0", "-f", "s16le", "pipe:1"]);
    const samples = Array.from({ length: raw.length / 2 }, (_, i) => raw.readInt16LE(i * 2));
    assert.ok(samples.length > 20000);
    const tone = hz => {
      let count = 0;
      for (let i = 0; i + 1600 <= samples.length; i += 800) {
        let cos = 0, sin = 0;
        for (let j = 0; j < 1600; j++) { cos += samples[i + j] * Math.cos(2 * Math.PI * hz * j / 8000); sin += samples[i + j] * Math.sin(2 * Math.PI * hz * j / 8000); }
        if (Math.hypot(cos, sin) / 1600 > 500) count++;
      }
      return count;
    };
    assert.ok(tone(440) >= 5 && tone(660) >= 5);
    // Test against the actual encoded timestamp clock, retaining silent gaps.
    function strength(hz, at) {
      const start = Math.round(at * 8000); let cos = 0, sin = 0;
      for (let j = 0; j < 800; j++) { cos += samples[start + j] * Math.cos(2 * Math.PI * hz * j / 8000); sin += samples[start + j] * Math.sin(2 * Math.PI * hz * j / 8000); }
      return Math.hypot(cos, sin);
    }
    for (const [at, hz] of [[0.35, 440], [1.15, 660], [2.55, 440], [3.35, 660]]) assert.ok(strength(hz, at) > strength(hz === 440 ? 660 : 440, at) * 10);
    results.push({ case: "independent FFmpeg full decode + 440/660 Hz cue alignment on encoded timestamps", filename: path.basename(file), samples: samples.length });
  } else results.push({ case: "independent FFmpeg full video decode", filename: path.basename(file) });
}
runPython(`from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys,math,struct
from nova_voice.whiteboard import parse_lesson,save_whiteboard,render_whiteboard_with_audio
from nova_voice.scenes import VisualPlan,empty_plan
from nova_voice.engine import SpeechEngine,DialogueVoice,RenderOptions
from nova_voice.voices import VoiceSpec
out=Path(sys.argv[1])
l=parse_lesson('# اختبار تقني محلي، نغمة لا نطق'+chr(10)+'## سهم ثم قطرات'+chr(10)+'نرسم سهمًا مؤقتًا.'+chr(10)+'تتحرك قطرتان إلى الأسفل.'+chr(10)+'## مراجعة أخيرة'+chr(10)+'الشكل توضيحي وليس محاكاة.'+chr(10)+'نهاية اختبار النغمة الاصطناعية.')
p=empty_plan(l.manifest(),subject='اختبار تقني محلي',grade='لا اعتماد منهجي')
p['steps'][0]['elements']=[dict(kind='arrow',row=0,until=1,x=120,y=200,x2=430,y2=200,line_width=6,motion=dict(type='draw')),dict(kind='icons',row=1,x=540,y=80,count=2,columns=2,size=80,icon='drop',motion=dict(type='move',dx=0,dy=120))]
p['steps'][1]['elements']=[dict(kind='circle',row=0,x=500,y=210,r=100,motion=dict(type='pulse',cycles=2)),dict(kind='text',row=1,x=500,y=210,text='تم الاختبار',direction='rtl',motion=dict(type='none'))]
p['notes']=['مثال تقني مؤلف يدويًا. الصوت نغمة 440/660 هرتز لا صوت بشري أو نطق.']
l=replace(l,visuals=VisualPlan.from_data(p,l.manifest()))
save_whiteboard(l,out/'silent.html')
v=replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')),sample_rate=8000,language_code='ar_JO',language='العربية')
class Tone(SpeechEngine):
 def _load(self,spec):
  def synthesize(text,syn_config):
   hz=440 if text.startswith('نرسم') or text.startswith('الشكل') else 660
   data=b''.join(struct.pack('<h',int(5000*math.sin(2*math.pi*hz*i/8000))) for i in range(6400))
   yield SimpleNamespace(sample_rate=8000,sample_width=2,sample_channels=1,audio_int16_bytes=data)
  return SimpleNamespace(config=SimpleNamespace(sample_rate=8000,length_scale=1.0),synthesize=synthesize)
render_whiteboard_with_audio(Tone(),l,{1:DialogueVoice(v)},out/'tone.html',RenderOptions(),audio_format='wav')
`, output);
(async () => {
  if (!process.env.NOVA_CHROMIUM) throw new Error("Set NOVA_CHROMIUM to a separately installed local Chromium executable.");
  const browser = await chromium.launch({ executablePath: process.env.NOVA_CHROMIUM, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    for (const width of [360, 768, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "no-preference", acceptDownloads: true }); await context.setOffline(true);
      const page = await open(context); await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      assert.equal(await page.locator("#wb-output-review").isChecked(), false); assert.equal(await page.locator("#wb-print").isDisabled(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      results.push({ case: "responsive, paused and output review is fresh", width });
      // Authored rain objects move during their own row, on the normal player clock.
      await page.locator("#lesson-outline button").nth(3).evaluate(n => n.click()); await page.clock.runFor(650);
      await page.locator("#wb-play").evaluate(n => n.click());
      const first = Math.max(1000, Array.from(manifest.steps[3].rows[0].text).length * 65);
      await page.clock.runFor(first + 100); const moved = await page.locator('#wb-rows [data-scene-element]').evaluateAll(nodes => nodes.map(n => n.getAttribute("transform")));
      await page.clock.runFor(650); const later = await page.locator('#wb-rows [data-scene-element]').evaluateAll(nodes => nodes.map(n => n.getAttribute("transform")));
      assert.notDeepEqual(later, moved);
      await page.locator("#wb-play").evaluate(n => n.click()); const paused = await page.locator("#wb-rows").evaluate(n => n.outerHTML);
      await page.clock.runFor(1000); assert.equal(await page.locator("#wb-rows").evaluate(n => n.outerHTML), paused);
      results.push({ case: "real SVG motion changes, pause freezes it", width });
      await outputTools(page);
      const controls = await page.locator("#wb-output button").evaluateAll(ns => ns.filter(n => !n.hidden).map(n => ({ primary: n.classList.contains("primary"), height: n.getBoundingClientRect().height })));
      controls.forEach(c => assert.equal(c.height, c.primary ? 48 : 40));
      await page.locator("#wb-print-preview").evaluate(n => n.click());
      assert.equal(await page.locator(".print-step").count(), 10); assert.equal(await page.locator(".print-speech").count(), 16);
      const speech = await page.locator(".print-speech").allTextContents(); assert.deepEqual(speech, manifest.steps.flatMap(s => s.rows.map(r => r.text)));
      assert.equal(await page.locator("#wb-print-root .print-step figure").count(), 8);
      assert.equal(await page.locator("#wb-print-root .print-brief").last().locator("p").textContent(), manifest.visuals.origin.brief.text);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator("#wb-print-root").screenshot({ path: path.join(output, `print-preview-${width}.png`) });
      if (width === 1366) {
        await page.pdf({ path: path.join(output, "full-lesson-a4.pdf"), preferCSSPageSize: true, printBackground: true });
        await page.locator("#wb-print-ink").evaluate(n => { n.checked = true; n.dispatchEvent(new Event("change", { bubbles: true })); }); await page.pdf({ path: path.join(output, "full-lesson-ink-a4.pdf"), preferCSSPageSize: true, printBackground: true });
      }
      results.push({ case: "full illustrated preview: ten steps, sixteen narration rows, eight snapshots and exact brief", width });
      const pending = page.waitForEvent("download"); await page.locator("#wb-save-customized").evaluate(n => n.click());
      const saved = await pending, file = path.join(output, `customized-${width}.html`); await saved.saveAs(file);
      const raw = fs.readFileSync(file, "utf8"); assert.ok(!raw.includes('data-print-step="')); assert.ok(!raw.includes('data-scene-element="'));
      runPython(`from pathlib import Path
import sys
from nova_voice.whiteboard import WhiteboardPage
assert WhiteboardPage.load(Path(sys.argv[1])).lesson == WhiteboardPage.load(Path(sys.argv[2])).lesson
`, example, file);
      await page.goto(pathToFileURL(file).href); assert.equal(await page.locator("#wb-output-review").isChecked(), false); assert.equal(await page.locator("#wb-print").isDisabled(), true);
      results.push({ case: "real Blob save after printing, Python import and fresh review on offline reopen", width });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, acceptDownloads: true }); await context.setOffline(true);
    const page = await open(context, path.join(output, "tone.html"));
    // Browser PCM time, not a virtual timer, drives the animation.
    await page.locator("#wb-audio").evaluate(a => { a.currentTime = 0.3; }); await page.waitForFunction(() => !document.getElementById("wb-audio").seeking);
    const trace = await page.locator('#wb-rows [data-scene-element="0"] line').getAttribute("stroke-dashoffset"); assert.ok(Number(trace) > 0 && Number(trace) < 100);
    await page.locator("#wb-audio").evaluate(a => { a.currentTime = 0.05; }); await page.waitForFunction(() => !document.getElementById("wb-audio").seeking);
    assert.ok(Number(await page.locator('#wb-rows [data-scene-element="0"] line').getAttribute("stroke-dashoffset")) > Number(trace));
    results.push({ case: "actual WAV decode and reverse seek restores progressive drawing" });
    await outputTools(page); await page.locator("#wb-print-preview").evaluate(n => n.click());
    const figures = page.locator(".print-step").first().locator("figure"); assert.equal(await figures.count(), 2);
    assert.equal(await figures.nth(0).locator('[data-scene-element="0"]').getAttribute("opacity"), "1");
    assert.equal(await figures.nth(1).locator('[data-scene-element="0"]').getAttribute("opacity"), "0");
    results.push({ case: "temporary arrow is printed before disappearing, final moving-object position printed separately" });
    const webm = path.join(output, "narrated.webm"); await record(page, "webm", webm); externalDecode(webm, true);
    await decodeInBrowser(page, "narrated.webm", true); await page.locator("#qa-decoded-video").evaluate(v => v.remove());
    const mp4Option = page.locator('#wb-video-format option[value="mp4"]');
    if (!await mp4Option.isDisabled()) {
      const mp4 = path.join(output, "narrated.mp4"); await record(page, "mp4", mp4); externalDecode(mp4, true); await decodeInBrowser(page, "narrated.mp4", true);
      await page.locator("#qa-decoded-video").evaluate(v => v.remove());
    }
    const downloads = []; page.on("download", d => downloads.push(d));
    await page.locator("#wb-video").click(); await page.waitForFunction(() => document.body.dataset.novaExporting === "true"); await page.locator("#wb-video-cancel").click();
    await page.waitForFunction(() => !document.body.dataset.novaExporting); await page.waitForTimeout(200);
    assert.equal(downloads.length, 0); assert.equal(await page.locator("#wb-video").isDisabled(), false);
    assert.equal(await page.locator("#wb-audio").evaluate(a => a.paused), true);
    results.push({ case: "actual recording cancellation restores controls and downloads no partial video" });
    await context.close();
    const silentContext = await browser.newContext({ acceptDownloads: true }); await silentContext.setOffline(true);
    const silent = await open(silentContext, path.join(output, "silent.html")); await outputTools(silent);
    const silentVideo = path.join(output, "silent-step.webm"); await record(silent, "webm", silentVideo, "current"); externalDecode(silentVideo, false); await decodeInBrowser(silent, "silent-step.webm", false);
    await silentContext.close();
    const reduced = await browser.newContext({ reducedMotion: "reduce" }); await reduced.setOffline(true);
    const quiet = await open(reduced, path.join(output, "tone.html"));
    await quiet.locator("#wb-audio").evaluate(a => { a.currentTime = 1.2; }); await quiet.waitForFunction(() => !document.getElementById("wb-audio").seeking);
    assert.equal(await quiet.locator('[data-scene-element="1"]').getAttribute("transform"), "translate(0 0)"); assert.equal(await quiet.locator("[stroke-dasharray]").count(), 0);
    await quiet.pdf({ path: path.join(output, "not-reviewed.pdf"), preferCSSPageSize: true }); assert.equal(await quiet.locator(".print-step").count(), 0);
    results.push({ case: "native reduced-motion media query, cue-preserving stills and Ctrl+P review notice" }); await reduced.close();
    // Explicit opt-in: create user-requested sample outputs, not fake diagnostic speech.
    if (process.env.NOVA_OUTPUT_DELIVERABLES) {
      const delivery = path.resolve(process.env.NOVA_OUTPUT_DELIVERABLES); fs.mkdirSync(delivery, { recursive: true });
      const c = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 1000 } }); await c.setOffline(true);
      const p = await open(c); await outputTools(p); await p.locator("#wb-print-preview").click();
      await p.pdf({ path: path.join(delivery, "NovaVoice-Lesson-A4-v0.8.0.dev1.pdf"), preferCSSPageSize: true, printBackground: true });
      await record(p, "webm", path.join(delivery, "NovaVoice-Animated-Lesson-v0.8.0.dev1.webm"), "all", 120000);
      results.push({ case: "complete authored lesson: actual A4 PDF + actual silent 720p video deliverables", steps: 10, rows: 16 }); await c.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    const report = { browser: browser.version(), checks: results.length, results, errors, externalRequests: requests, realVoice: false, liveModel: false, nativeWindows: false };
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); if (!retained) fs.rmSync(output, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
