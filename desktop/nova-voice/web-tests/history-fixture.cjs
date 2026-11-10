"use strict";
// Authored plans and a real production comparison, no service/account/voice calls.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path");
function generate(folder) {
  execFileSync(process.env.NOVA_VOICE_PYTHON || "python", ["-c", `
from pathlib import Path
from dataclasses import replace
import sys,json
from nova_voice.whiteboard import parse_lesson
from nova_voice.scenes import VisualPlan,empty_plan
from nova_voice.scene_history import comparison_html
from nova_voice.lesson_draft import LessonDraft
root=Path(sys.argv[1])
lesson=parse_lesson('# مقارنة مؤلفة وليست نتيجة نموذج'+chr(10)+'## مقدمة'+chr(10)+'[1] A shared first cue.'+chr(10)+'[2] A second first cue.'+chr(10)+'## المشهد المعدل'+chr(10)+'[2] A selected cue.'+chr(10)+'[1] The reviewed explanation.'+chr(10)+'## خاتمة'+chr(10)+'[1] A shared last cue.',dialogue=True)
data=empty_plan(lesson.manifest(),subject='علوم',grade='الثاني الإعدادي')
for i,step in enumerate(data['steps']):
    step['elements']=[dict(kind='circle',row=0,x=180,y=100,r=45,fill='#2563EB',motion=dict(type='move',dx=80,dy=20)),dict(kind='text',row=0,x=500,y=250,text='authored scene '+str(i),size=32)]
    step['description']='Authored explanation '+str(i)
data['steps'][1]['rows']=[dict(index=1,display='Reviewed display',speech='Reviewed spoken text.')]
before=VisualPlan.from_data(data,lesson.manifest())
data['steps'][1]['elements'][0]=dict(kind='rect',row=0,x=260,y=90,w=140,h=85,fill='#FFB000',motion=dict(type='move',dx=80,dy=20))
data['steps'][1]['description']='Only this scene changed.'
after=VisualPlan.from_data(data,lesson.manifest())
(root/'compare.html').write_text(comparison_html(lesson,before,after,before_number=1,after_number=2),encoding='utf-8')
(root/'same.html').write_text(comparison_html(lesson,before,before),encoding='utf-8')
(root/'focus.html').write_text(comparison_html(lesson,before,after,focus_step=2),encoding='utf-8')
(root/'expected.json').write_text(json.dumps(dict(source=lesson.manifest(),before=before.to_data(),after=after.to_data()),ensure_ascii=False),encoding='utf-8')
attack='<img src=https://invalid.example/track onerror="window.PWNED=1">'
injected=parse_lesson('# '+attack+chr(10)+'Literal source '+attack)
p=empty_plan(injected.manifest());p['steps'][0]['description']=attack
p=VisualPlan.from_data(p,injected.manifest())
(root/'attack.html').write_text(comparison_html(injected,p,p),encoding='utf-8')
full=LessonDraft.load(Path('examples/complete-lesson-demo.json')).compile()
p=full.visuals.to_data();p['steps'][1]['elements'][0]['x']+=10
q=VisualPlan.from_data(p,replace(full,visuals=None).manifest())
(root/'expanded.html').write_text(comparison_html(full,full.visuals,q,focus_step=1),encoding='utf-8')
`, folder], { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
  const html = fs.readFileSync(path.join(folder, "compare.html"), "utf8");
  const frames = [...html.matchAll(/<iframe id="(before|after)"[^>]+src="data:text\/html;base64,([A-Za-z0-9+/=]+)"/g)];
  if (frames.length !== 2) throw new Error("Expected two actual comparison frames");
  for (const [, id, payload] of frames) fs.writeFileSync(path.join(folder, id + ".html"), Buffer.from(payload, "base64"));
  return JSON.parse(fs.readFileSync(path.join(folder, "expected.json"), "utf8"));
}
module.exports = { generate };
