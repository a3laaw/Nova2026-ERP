"use strict";
// Optional real Chromium/Canvas QA, not live language-model inference or an audition.
// All artwork is pinned and the lesson is explicitly authored. No tool downloads.
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { execFileSync } = require("node:child_process"), { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");
const project = path.resolve(__dirname, ".."), python = process.env.NOVA_VOICE_PYTHON || "python";
const retained = !!process.env.NOVA_BROWSER_OUTPUT;
const out = retained ? path.resolve(process.env.NOVA_BROWSER_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), "nova-resources-browser-"));
fs.mkdirSync(out, { recursive: true });
const example = path.join(project, "examples/secondary-source-demo.html"), results = [], errors = [], requests = [];
const py = (code, ...args) => execFileSync(python, ["-c", code, ...args], { cwd: project, encoding: "utf8", stdio: "pipe" });
const checked = (name, extra = {}) => results.push({ case: name, ...extra });
function watch(p) {
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  p.on("request", r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
}
async function tools(p) { await p.locator("#wb-output").evaluate(n => n.open = true); await p.locator("#wb-output-review").check(); }
py(`from pathlib import Path
from dataclasses import replace
import sys
from nova_voice.whiteboard import WhiteboardPage,save_whiteboard
from nova_voice.secondary_assets import use_local_fallbacks
p=WhiteboardPage.load(Path('examples/secondary-source-demo.html'))
s=replace(p.lesson,visuals=None)
save_whiteboard(replace(s,visuals=use_local_fallbacks(p.lesson.visuals,s.manifest())),Path(sys.argv[1])/'fallback.html')
import math,struct,copy
from types import SimpleNamespace
from nova_voice.whiteboard import parse_lesson,render_whiteboard_with_audio
from nova_voice.scenes import empty_plan,VisualPlan
from nova_voice.secondary_assets import normalize_svg,asset_info
from nova_voice.engine import SpeechEngine,DialogueVoice,RenderOptions
from nova_voice.voices import VoiceSpec
lesson=parse_lesson('# Authored artwork/audio diagnostic, NOT narration'+chr(10)+'First diagnostic tone.'+chr(10)+'Second diagnostic tone.')
data=empty_plan(lesson.manifest())
e=copy.deepcopy(p.lesson.visuals.to_data()['steps'][0]['elements'][0]);e['asset_id']='gi-water-drop'
data['steps'][0]['elements']=[e]
data['resources']=[normalize_svg((Path('tests/fixtures/secondary-raw')/asset_info('gi-water-drop')['upstream_path']).read_bytes(),'gi-water-drop')]
lesson=replace(lesson,visuals=VisualPlan.from_data(data,lesson.manifest()))
voice=replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')),sample_rate=8000)
class Tone(SpeechEngine):
 def _load(self,spec):
  def synthesize(text,syn_config):
   hz=440 if text.startswith('First') else 660
   pcm=b''.join(struct.pack('<h',int(5000*math.sin(2*math.pi*hz*i/8000))) for i in range(4000))
   yield SimpleNamespace(sample_rate=8000,sample_width=2,sample_channels=1,audio_int16_bytes=pcm)
  return SimpleNamespace(config=SimpleNamespace(sample_rate=8000,length_scale=1),synthesize=synthesize)
render_whiteboard_with_audio(Tone(),lesson,{1:DialogueVoice(voice)},Path(sys.argv[1])/'artwork-tone.html',RenderOptions(),audio_format='wav')
`, out);
(async () => {
  assert.ok(process.env.NOVA_CHROMIUM && process.env.NOVA_FFMPEG, "Explicit NOVA_CHROMIUM and NOVA_FFMPEG paths required.");
  const browser = await chromium.launch({ executablePath: process.env.NOVA_CHROMIUM, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  try {
    for (const width of [360, 768, 1366]) {
      const c = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true }); await c.setOffline(true);
      const p = await c.newPage(); watch(p); await p.goto(pathToFileURL(example).href);
      assert.ok(await p.locator("#wb-play").isEnabled());
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await p.locator("audio[src]").count(), 0);
      assert.equal(await p.locator("#wb-output-review").isChecked(), false);
      assert.equal(await p.locator('[data-secondary-state="embedded"]').count(), 1);
      assert.equal(await p.locator('[data-secondary-state="fallback"]').count(), 1);
      assert.equal(await p.locator("#whiteboard image,#whiteboard use,#whiteboard foreignObject").count(), 0);
      checked("offline responsive silent opening with embedded symbol and original fallback", { width });
      await p.locator("#wb-play").click(); await p.waitForTimeout(500); await p.locator("#wb-play").click();
      await p.screenshot({ path: path.join(out, "resources-" + width + ".png"), fullPage: true });
      checked("real SVG renders safe silhouette, no autoplay or remote imagery", { width });
      await c.close();
    }
    const c = await browser.newContext({ viewport: { width: 1366, height: 1000 }, acceptDownloads: true }); await c.setOffline(true);
    const p = await c.newPage(); watch(p); await p.goto(pathToFileURL(example).href);
    await tools(p); await p.locator("#wb-print-preview").click();
    assert.equal(await p.locator("[data-resource-credit]").count(), 2);
    assert.equal(await p.locator(".print-step").count(), 2); assert.equal(await p.locator(".print-cue").count(), 4);
    const pdf = path.join(out, "secondary-a4.pdf"); await p.emulateMedia({ media: "print" }); await p.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true }); await p.emulateMedia({ media: "screen" });
    const pdfInfo = JSON.parse(py(`from pypdf import PdfReader
import sys,json
r=PdfReader(sys.argv[1]);t=''.join(''.join(p.extract_text().split()) for p in r.pages)
for marker in ['IconsmadebyLorc','creativecommons.org/licenses/by/3.0/','Backgroundremoved;','magnifying-glass.svg','open-book.svg']:
 assert marker in t,marker
print(json.dumps({'pages':len(r.pages),'a4':all(abs(float(p.mediabox.width)-595.28)<2 and abs(float(p.mediabox.height)-841.89)<2 for p in r.pages)}))`, pdf));
    assert.ok(pdfInfo.a4); checked("real A4 PDF retains all source rows, illustrations, attribution, source, licence and changes", pdfInfo);
    await p.locator("#wb-print-close").click();
    const creditDOM = await p.evaluate(() => {
      const data = JSON.parse(document.getElementById("nova-whiteboard-data").textContent), plan = window.novaWhiteboardScenes.read(data);
      const credits = window.novaSecondaryAssets.creditsFor(plan, [0]);
      return credits;
    });
    assert.equal(creditDOM.length, 1); assert.equal(creditDOM[0].id, "gi-magnifying-glass");
    checked("step-scoped credits exclude unused second-step art and unprepared fallback", { ids: creditDOM.map(c => c.id) });
    await p.locator("#wb-customization").evaluate(n => n.open = true);
    const [customized] = await Promise.all([p.waitForEvent("download"), p.locator("#wb-save-customized").click()]);
    const saved = path.join(out, "customized.html"); await customized.saveAs(saved);
    const verify = await c.newPage(); watch(verify); await verify.goto(pathToFileURL(saved).href);
    assert.ok(await verify.locator("#wb-play").isEnabled()); assert.equal(await verify.locator("#wb-output-review").isChecked(), false);
    assert.ok((await verify.locator("#wb-secondary-credits").textContent()).includes("Icons made by Lorc")); await verify.close();
    checked("actual customized HTML download reopens offline with artwork/credits and no saved approval");
    await p.bringToFront();
    await p.locator("#wb-video-format").selectOption("webm"); await p.locator("#wb-video-scope").selectOption("current");
    const [download] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.locator("#wb-video").click()]);
    const webm = path.join(out, "secondary-step.webm"), mp4 = path.join(out, "secondary-step-h264.mp4"); await download.saveAs(webm);
    await p.waitForFunction(() => !document.body.dataset.novaExporting);
    const png = await p.locator("#wb-video-canvas").evaluate(n => n.toDataURL("image/png").split(",")[1]); fs.writeFileSync(path.join(out, "final-canvas.png"), Buffer.from(png, "base64"));
    const conversion = execFileSync(python, ["tools/convert_video.py", webm, mp4, "--ffmpeg", process.env.NOVA_FFMPEG, "--reviewed", "--overwrite"], { cwd: project, encoding: "utf8", timeout: 120000 });
    assert.ok(conversion.includes("H.264 Main 3.1") && conversion.includes("entire output decoded"));
    const info = JSON.parse(py("from pathlib import Path\nfrom dataclasses import asdict\nfrom nova_voice.video import inspect_mp4\nimport sys,json\nr=asdict(inspect_mp4(Path(sys.argv[1])));r['path']=str(r['path']);print(json.dumps(r))", mp4));
    assert.equal(info.width, 1280); assert.equal(info.height, 720); assert.equal(info.has_audio, false); assert.ok(info.duration_seconds >= 9 && info.duration_seconds < 18);
    checked("actual silent Canvas WebM with 7-second mandatory credit → H.264, faststart and full decode", info);
    execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-ss", String(info.duration_seconds - 0.5), "-i", mp4, "-frames:v", "1", "-y", path.join(out, "final-video.png")]);
    execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-ss", "0.4", "-i", mp4, "-frames:v", "1", "-y", path.join(out, "first-video.png")]);
    const rgb = file => execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-i", path.join(out, file), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 4 * 1024 * 1024 });
    const a = rgb("final-canvas.png"), b = rgb("final-video.png"), first = rgb("first-video.png");
    assert.equal(a.length, 1280 * 720 * 3); assert.equal(a.length, b.length); assert.equal(a.length, first.length);
    let endError = 0, changed = 0, blue = 0;
    for (let i = 0; i < a.length; i++) { endError += Math.abs(a[i] - b[i]); changed += Math.abs(first[i] - b[i]); }
    for (let y = 170; y < 430; y++) for (let x = 270; x < 560; x++) {
      const i = (y * 1280 + x) * 3, r = first[i], g = first[i + 1], v = first[i + 2];
      if (v > 120 && v > r * 1.4 && v > g * 1.1) blue++;
    }
    const pixels = { endCardMeanPixelError: endError / a.length, firstVsCreditDifference: changed / a.length, pinnedSymbolBluePixels: blue };
    assert.ok(pixels.endCardMeanPixelError < 8 && pixels.firstVsCreditDifference > 5 && blue > 500, JSON.stringify(pixels));
    checked("decoded video contains the pinned symbol, and final card matches Canvas source/licence pixels after conversion", pixels);
    await p.goto(pathToFileURL(path.join(out, "artwork-tone.html")).href); await tools(p); await p.bringToFront();
    const clip = await p.evaluate(() => JSON.parse(document.getElementById("nova-whiteboard-timings").textContent).steps["0"]);
    await p.locator("#wb-video-format").selectOption("webm"); await p.locator("#wb-video-scope").selectOption("all");
    const [toneDownload] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.locator("#wb-video").click()]);
    const toneWebm = path.join(out, "artwork-tone.webm"), toneMp4 = path.join(out, "artwork-tone-h264.mp4"); await toneDownload.saveAs(toneWebm);
    await p.waitForFunction(() => !document.body.dataset.novaExporting);
    execFileSync(python, ["tools/convert_video.py", toneWebm, toneMp4, "--ffmpeg", process.env.NOVA_FFMPEG, "--reviewed", "--overwrite"], { cwd: project, encoding: "utf8", timeout: 120000 });
    const toneInfo = JSON.parse(py("from pathlib import Path\nfrom dataclasses import asdict\nfrom nova_voice.video import inspect_mp4\nimport sys,json\nr=asdict(inspect_mp4(Path(sys.argv[1])));r['path']=str(r['path']);print(json.dumps(r))", toneMp4));
    assert.ok(toneInfo.has_audio && toneInfo.duration_seconds > 8);
    const pcm = execFileSync(process.env.NOVA_FFMPEG, ["-v", "error", "-i", toneMp4, "-map", "0:a:0", "-ac", "1", "-ar", "8000", "-af", "aresample=async=1:first_pts=0", "-f", "s16le", "pipe:1"]);
    function strength(hz, at) { let a = 0, b = 0; for (let j = 0; j < 600; j++) { const v = pcm.readInt16LE((Math.round(at * 8000) + j) * 2); a += v * Math.cos(2 * Math.PI * hz * j / 8000); b += v * Math.sin(2 * Math.PI * hz * j / 8000); } return Math.hypot(a, b); }
    const t0 = clip.lines[0].end_sample / clip.sample_rate / 2, t1 = (clip.lines[1].start_sample + clip.lines[1].end_sample) / clip.sample_rate / 2;
    assert.ok(strength(440, t0) > strength(660, t0) * 8); assert.ok(strength(660, t1) > strength(440, t1) * 8);
    checked("actual artwork/audio Canvas → H.264/AAC retains measured source-row diagnostic tones before the credit", toneInfo);
    let square = 0; const tail = Math.min(8000, pcm.length / 2); for (let i = 1; i <= tail; i++) square += pcm.readInt16LE(pcm.length - i * 2) ** 2;
    const tailRms = Math.sqrt(square / tail); assert.ok(tailRms < 30, String(tailRms));
    checked("mandatory artwork credit is silent rather than extra narration; AAC final-second RMS", { tailRms });
    await p.goto(pathToFileURL(path.join(out, "fallback.html")).href);
    assert.equal(await p.locator("#wb-secondary-credits").count(), 0); assert.equal(await p.locator('[data-secondary-state="embedded"]').count(), 0);
    assert.equal(await p.locator('[data-secondary-state="fallback"]').count(), 2);
    checked("fallback-only offline HTML has original drawings and no reused-art credit card");
    await c.close();
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ browser: await browser.version(), results, errors, httpRequests: requests, caveat: "Authored content and pinned static artwork only; no live semantic inference, native Qt/Windows/4GB or scientific/voice certification." }, null, 2));
    console.log(JSON.stringify({ passed: results.length, out, results }, null, 2));
  } finally { await browser.close(); if (!retained) fs.rmSync(out, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
