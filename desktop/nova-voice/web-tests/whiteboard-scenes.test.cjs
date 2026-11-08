"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { mount: createApp, jsonFrom, replaceJSON, resign } = require("./scene-harness.cjs");
let folder;
const DATA = "nova-whiteboard-data", TIMINGS = "nova-whiteboard-timings";
before(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "nova-visual-scenes-"));
  execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
import sys
from nova_voice.whiteboard import parse_lesson, save_whiteboard, render_whiteboard_with_audio
from nova_voice.engine import DialogueVoice, RenderOptions, SpeechEngine
from nova_voice.voices import VoiceSpec
from nova_voice.scenes import VisualPlan, empty_plan
from nova_voice.scene_examples import VISUAL_EXAMPLE, example_plan
root = Path(sys.argv[1])
voice = replace(VoiceSpec.from_path(Path('tests/fixtures/test_voice.onnx')), sample_rate=8000)
cast = {1: DialogueVoice(voice), 2: DialogueVoice(replace(voice, model_path=root/'second-model.onnx'))}
lesson = parse_lesson(chr(10).join(['# مشاهد 😀', '## Addition', '[1] 2', '[2] + 3', '[1] = 5', '## Triangle', '[1] A right triangle.', '## Nature', '[1] A mountain and a valley.']), dialogue=True)
data = empty_plan(lesson.manifest(), subject='Math and nature', grade='Preparatory or primary')
data['steps'][0].update(description='Two apples, three more, then a locally computed total.', rows=[{'index':0,'display':'2','speech':'Two apples.'},{'index':1,'display':'+ 3','speech':'Add three apples.'},{'index':2,'display':'= 5','speech':'Five apples.'}], elements=[
{'kind':'icons','row':0,'x':100,'y':100,'icon':'apple','count':2,'columns':2,'size':80},
{'kind':'icons','row':1,'x':400,'y':100,'icon':'apple','count':3,'columns':3,'size':80,'dx':120},
{'kind':'calculation','row':2,'x':500,'y':330,'a':2,'b':3,'op':'+','size':50},
{'kind':'arrow','row':0,'until':1,'x':300,'y':150,'x2':380,'y2':150}])
data['steps'][1]['elements'] = [{'kind':'right_triangle','row':0,'x':200,'y':30,'a':3,'b':4,'w':500,'h':280,'unit':'cm'}]
data['steps'][2]['elements'] = [{'kind':'path','row':0,'x':0,'y':0,'d':'M50 350L300 50L550 350L750 80L950 350Z','fill':'#E2E8F0'}, {'kind':'text','row':0,'x':500,'y':400,'text':'Illustration, not a verified map','size':36}]
visual = replace(lesson, visuals=VisualPlan.from_data(data, lesson.manifest()))
save_whiteboard(visual, root/'silent.html')
class MeasuredEngine(SpeechEngine):
    def _load(self, spec):
        def synthesize(text, syn_config):
            seconds = 8 if text.startswith('Two') else 1 if text.startswith('Add') else 3 if text.startswith('Five') else 4
            for _ in range(seconds*4):
                yield SimpleNamespace(sample_rate=8000, sample_width=2, sample_channels=1, audio_int16_bytes=bytes(4000))
        return SimpleNamespace(config=SimpleNamespace(sample_rate=8000, length_scale=1.0), synthesize=synthesize)
for ext in ('wav','mp3'):
    render_whiteboard_with_audio(MeasuredEngine(), visual, cast, root/('timed.'+ext+'.html'), RenderOptions(), audio_format=ext)
local = parse_lesson(VISUAL_EXAMPLE)
save_whiteboard(replace(local, visuals=example_plan(local.manifest())), root/'demo.html')
# Exercise every permitted kind and all local icon symbols, not fixed subject templates.
gallery = parse_lesson('# All primitives'+chr(10)+'One row of examples.')
g = empty_plan(gallery.manifest())
extras = [dict(kind='rect',w=50,h=60),dict(kind='circle',r=20),dict(kind='ellipse',rx=30,ry=15),dict(kind='line',x2=500,y2=100),dict(kind='arrow',x2=500,y2=100),dict(kind='polygon',points=[[100,20],[300,20],[200,100]]),dict(kind='polyline',points=[[100,20],[300,100]]),dict(kind='path',d='M100 20Q200 70 300 100'),dict(kind='text',text='a < b & 😀'),dict(kind='right_triangle',a=3,b=4,w=200,h=200),dict(kind='calculation',a=2,b=3,op='/')]
g['steps'][0]['elements'] = [dict(row=0,x=100,y=100,**e) for e in extras] + [dict(kind='icons',row=0,x=100,y=100,icon=name,count=1,columns=1,size=50) for name in ('apple','ball','block','leaf','star','sun','cloud','drop','book','person')]
save_whiteboard(replace(gallery, visuals=VisualPlan.from_data(g,gallery.manifest())), root/'gallery.html')
`, folder], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
});
after(() => fs.rmSync(folder, { recursive: true, force: true }));
const mount = options => createApp(folder, options);
const elements = app => Array.from(app.document.querySelectorAll('[data-scene-element]'));
const visible = node => node.getAttribute("opacity") === "1";
function alterPlan(html, edit) {
  const data = jsonFrom(html, DATA); edit(data.visuals, data); resign(data);
  return replaceJSON(html, DATA, data);
}

test("reviewed visual plan preserves raw rows and separately exposes approved narration", () => {
  const app = mount();
  try {
    assert.equal(app.get("whiteboard").dataset.visuals, "validated");
    assert.equal(app.mode, "measured");
    assert.equal(app.frames, 0);
    const data = JSON.parse(app.get(DATA).textContent);
    assert.equal(data.steps[0].rows[0].text, "2");
    assert.equal(data.visuals.steps[0].rows[0].speech, "Two apples.");
    assert.ok(app.get("step-transcript").textContent.includes("النطق المعتمد: Two apples."));
    assert.equal(app.document.querySelector('.visual-description').textContent, data.visuals.steps[0].description);
    assert.equal(elements(app).length, 4);
    assert.equal(app.document.querySelectorAll('[data-icon="apple"]').length, 5);
    assert.equal(app.audio.paused, true);
  } finally { app.close(); }
});

test("elements appear at measured row onsets, gaps do not start the next cue", () => {
  const app = mount();
  try {
    const [two, three, total, arrow] = elements(app);
    app.position(0);
    assert.ok(visible(two)); assert.ok(!visible(three)); assert.ok(!visible(total)); assert.ok(visible(arrow));
    app.position(8.2); // first 350ms inter-speaker gap
    assert.ok(visible(arrow)); assert.ok(!visible(three));
    app.position(8.35);
    assert.ok(visible(three)); assert.ok(!visible(arrow));
    assert.equal(three.getAttribute("transform"), "translate(120 0)");
    app.position(8.65);
    const halfway = three.getAttribute("transform");
    assert.ok(/^translate\(59\./.test(halfway) || /^translate\(60/.test(halfway));
    app.position(9.5); // second gap, final answer is not yet visible
    assert.ok(!visible(total));
    app.position(9.7);
    assert.ok(visible(total)); assert.equal(total.dataset.result, "5");
  } finally { app.close(); }
});

test("seeking backwards while paused restores visibility and entrance position deterministically", () => {
  const app = mount();
  try {
    app.position(9.7); assert.ok(visible(elements(app)[2]));
    app.position(8.65, "seeking");
    const middle = elements(app)[1].getAttribute("transform");
    assert.ok(!visible(elements(app)[2]));
    app.position(0, "seeked"); assert.ok(!visible(elements(app)[1]));
    app.position(8.65, "seeked"); assert.equal(elements(app)[1].getAttribute("transform"), middle);
    assert.equal(app.frames, 0);
  } finally { app.close(); }
});

for (const rate of [0.5,1,2]) test(`scene cues use samples, not playback-rate multiplication (${rate}x)`, () => {
  const app = mount();
  try {
    app.audio.playbackRate = rate;
    app.position(8.4);
    assert.ok(visible(elements(app)[1]) && !visible(elements(app)[2]));
    const transform = elements(app)[1].getAttribute("transform");
    app.duration = 9999; app.position(8.4);
    assert.equal(elements(app)[1].getAttribute("transform"), transform);
  } finally { app.close(); }
});

test("reduced motion keeps row cues and hides future answers without translating objects", () => {
  const app = mount({ reducedMotion:true });
  try {
    app.position(8.36);
    assert.ok(visible(elements(app)[1]));
    assert.equal(elements(app)[1].getAttribute("transform"), "translate(0 0)");
    assert.ok(!visible(elements(app)[2]));
  } finally { app.close(); }
});

test("silent preview animates on the existing virtual clock without audio or networking", async () => {
  const app = mount({file:"silent.html"});
  try {
    assert.equal(app.mode, "silent"); assert.equal(app.audio.hidden, true);
    app.get("wb-play").click(); await Promise.resolve();
    app.advance(0); app.advance(1100);
    assert.ok(visible(elements(app)[1]));
    assert.ok(!visible(elements(app)[2]));
    app.get("wb-play").click();
    const stopped = elements(app)[1].getAttribute("transform");
    app.advance(20000);
    assert.equal(elements(app)[1].getAttribute("transform"), stopped);
  } finally { app.close(); }
});

test("scene graphics share the text eraser group and old-frame events cannot repaint them", () => {
  const app = mount();
  try {
    app.position(9.8); const old = app.document.querySelector('[data-visual-scene]');
    assert.equal(old.parentNode.id, "wb-rows");
    app.get("wb-next").click();
    assert.equal(app.get("whiteboard").dataset.transition, "erasing");
    app.position(0);
    assert.equal(old.parentNode.id, "wb-rows");
    app.finishErase();
    assert.ok(!old.isConnected);
    assert.equal(elements(app).length, 1);
    assert.ok(elements(app)[0].querySelector("path"));
    assert.equal(app.get("whiteboard").dataset.transition, "idle");
  } finally { app.close(); }
});

test("right triangle is uniformly scaled, with a correct right angle and leg ratio", () => {
  const app = mount({reducedMotion:true});
  try {
    app.get("wb-next").click();
    const d = elements(app)[0].querySelector("path").getAttribute("d");
    assert.equal(d, "M200 30v280h210Z");
    assert.equal(210/280, 3/4);
    assert.ok(elements(app)[0].textContent.includes("3 cm"));
    assert.ok(elements(app)[0].textContent.includes("4 cm"));
  } finally { app.close(); }
});

test("all allowed primitives and ten local icons render using SVG nodes only", () => {
  const app = mount({file:"gallery.html"});
  try {
    assert.equal(elements(app).length, 21);
    assert.equal(app.document.querySelectorAll('[data-icon]').length, 10);
    assert.equal(app.document.querySelectorAll('foreignObject,image,iframe,animate,animateTransform').length, 0);
    assert.ok(app.get("wb-rows").textContent.includes("a < b & 😀"));
    assert.ok(app.get("wb-rows").textContent.includes("2 ÷ 3 = 2/3"));
    assert.equal(app.window.novaWhiteboardScenes.calculation(3,-6,"/"), "-1/2");
  } finally { app.close(); }
});

for (const width of [360,768,1366]) test(`visual scene fits the responsive SVG without overlap with text (${width}px)`, () => {
  const app = mount({file:"demo.html", width});
  try {
    const svg = app.get("whiteboard"), frame = app.document.querySelector('[data-visual-scene]');
    const view = svg.getAttribute("viewBox").split(" ").map(Number);
    assert.ok(Number(frame.getAttribute("x"))+Number(frame.getAttribute("width")) <= view[2]);
    const bottom = Number(frame.getAttribute("y"))+Number(frame.getAttribute("height"));
    const firstRow = app.document.querySelector('#wb-rows text[data-row="0"]');
    assert.ok(Number(firstRow.getAttribute("y")) > bottom);
    assert.ok(view[3] > bottom);
  } finally { app.close(); }
});

const invalid = {
  "unknown code field": p => { p.code = "alert(1)"; },
  "external image kind": p => { p.steps[0].elements[0].kind = "image"; },
  "URL paint": p => { p.steps[0].elements[0].fill = "url(https://example.invalid)"; },
  "event handler": p => { p.steps[0].elements[0].onclick = "alert(1)"; },
  "fractional geometry": p => { p.steps[0].elements[0].x = 1.5; },
  "null optional geometry": p => { p.steps[0].elements[0].dx = null; },
  "too many icons": p => { p.steps[0].elements[0].count = 21; },
  "outside geometry": p => { p.steps[0].elements[0].x = 1001; },
  "invalid row cue": p => { p.steps[0].elements[0].row = 6; },
  "changed source binding": p => { p.source_fingerprint = "a".repeat(64); },
  "empty narration": p => { p.steps[0].rows[0].speech = ""; },
  "speaker override": p => { p.steps[0].rows[0].speaker = 2; },
  "sacred with rewriting": p => { p.policy = "sacred"; },
  "unpaired surrogate": p => { p.steps[0].rows[0].speech = "\ud800"; },
  "SVG markup path": p => { p.steps[0].elements[0] = {kind:"path",row:0,x:0,y:0,d:"<svg onload=alert(1)>"}; },
};
for (const [name,edit] of Object.entries(invalid)) test(`invalid scene rejected even with a new checksum: ${name}`, () => {
  const app = mount({transform:html => alterPlan(html,edit)});
  try {
    assert.equal(app.get("wb-play").disabled, true);
    assert.equal(app.audio.hidden, true);
    assert.equal(app.audio.getAttribute("src"), null);
    assert.ok(app.get("wb-status").textContent.includes("غير صالح"));
    assert.equal(elements(app).length, 0);
  } finally { app.close(); }
});

for (const change of ["missing","changed","another lesson"]) test(`new visual audio cannot silently use guessed timing: ${change}`, () => {
  const app = mount({transform(html) {
    if (change === "missing") return html.replace(/<script id="nova-whiteboard-timings"[^>]*>.*?<\/script>/s, "");
    const data = jsonFrom(html,TIMINGS);
    if (change === "changed") data.steps["0"].lines[0].end_sample++;
    else { data.lesson_fingerprint = "a".repeat(64); resign(data); }
    return replaceJSON(html,TIMINGS,data);
  }});
  try {
    assert.equal(app.get("wb-play").disabled, true);
    assert.equal(app.audio.hidden, true);
    assert.ok(app.get("wb-status").textContent.includes("توقيت"));
    assert.equal(app.audio.getAttribute("src"), null);
  } finally { app.close(); }
});

test("untrusted text is literal textContent, not markup, IDs, handlers or links", () => {
  const hostile = '</script><img src=x onerror="window.hacked=1">';
  const app = mount({file:"silent.html",transform:html => alterPlan(html,p => {
    p.steps[0].description = hostile;
    p.steps[0].rows[0].display = hostile;
    p.steps[0].elements.push({kind:"text",row:0,x:500,y:400,text:hostile});
  })});
  try {
    assert.ok(app.get("step-transcript").textContent.includes(hostile));
    assert.equal(app.document.querySelectorAll("img,iframe").length,0);
    assert.equal(app.window.hacked, undefined);
    assert.ok(app.get("wb-rows").textContent.includes(hostile));
  } finally { app.close(); }
});

test("customized save strips live graphics but preserves approved plan, raw script and timings", () => {
  const app = mount({captureDownloads:true});
  let html;
  try {
    app.position(9.8);
    app.get("wb-color-1").value = "#556677";
    app.get("wb-color-1").dispatchEvent(new app.window.Event("input"));
    app.get("wb-save-customized").click();
    assert.equal(app.downloads.length,1); html = app.downloads[0];
    assert.equal(jsonFrom(html, DATA).fingerprint,jsonFrom(fs.readFileSync(path.join(folder,"timed.wav.html"),"utf8"),DATA).fingerprint);
    assert.ok(!html.includes('data-scene-element="'));
    assert.ok(!html.includes('src="data:audio/'));
  } finally { app.close(); }
  const restored = mount({transform:() => html});
  try {
    assert.equal(restored.mode,"measured");
    assert.equal(elements(restored).length,4);
    restored.position(9.8); assert.ok(visible(elements(restored)[2]));
    assert.equal(restored.get("wb-color-1").value,"#556677");
  } finally { restored.close(); }
});

test("MP3 scenes retain the measured clock and explicit codec-delay caveat", () => {
  const app = mount({file:"timed.mp3.html"});
  try {
    assert.equal(app.mode,"measured"); app.position(8.4);
    assert.ok(visible(elements(app)[1]) && !visible(elements(app)[2]));
    assert.ok(app.get("wb-status").textContent.includes("MP3"));
  } finally { app.close(); }
});


test("a visible diagram is erased even before any text has been written, without autoplay", () => {
  const app = mount();
  try {
    assert.ok(visible(elements(app)[0]));
    assert.equal(app.row(0), 0);
    const old = app.document.querySelector('[data-visual-scene]');
    app.get("wb-next").click();
    assert.equal(app.get("whiteboard").dataset.transition, "erasing");
    assert.ok(old.isConnected);
    assert.equal(app.audio.paused, true);
    app.finishErase();
    assert.ok(!old.isConnected);
    assert.equal(app.audio.paused, true);
    assert.equal(elements(app).length, 1);
  } finally { app.close(); }
});


function protect(html) {
  return alterPlan(html,(p,data)=>{
    p.policy="sacred";
    p.steps.forEach((step,i)=>{step.rows=[];step.elements=[];step.description=data.steps[i].title;});
  });
}

test("protected text stays readable in a local silent lesson without generated drawings", () => {
  const app=mount({file:"silent.html",transform:protect});
  try {
    assert.equal(app.get("whiteboard").dataset.visuals,"validated");
    assert.equal(elements(app).length,0);
    assert.equal(app.audio.hidden,true);
    assert.equal(app.get("wb-play").disabled,false);
    assert.ok(app.get("wb-visual-note").textContent.includes("لا توثيق"));
    assert.ok(app.get("step-transcript").textContent.includes("2"));
  } finally {app.close();}
});

test("protected mode refuses audio even if someone rebinds a structurally valid recording map", () => {
  const app=mount({transform(html){
    html=protect(html);
    const lesson=jsonFrom(html,DATA),timing=jsonFrom(html,TIMINGS);
    timing.lesson_fingerprint=lesson.fingerprint;resign(timing);
    return replaceJSON(html,TIMINGS,timing);
  }});
  try {
    assert.equal(app.get("wb-play").disabled,true);
    assert.equal(app.audio.hidden,true);
    assert.ok(app.get("wb-status").textContent.includes("النصوص المقدسة"));
    assert.equal(app.audio.getAttribute("src"),null);
  } finally {app.close();}
});
