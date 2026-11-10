"""Build one offline listening HTML from already-generated WAVs. No model/runtime bundling.

SPDX-License-Identifier: GPL-3.0-or-later
"""

import base64
import hashlib
import html
import json
import re
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
report = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
assert len(report["clips"]) == 3
cards = []
for index, clip in enumerate(report["clips"], 1):
    assert re.fullmatch(r"[A-Za-z-]+\.wav", clip["file"])
    data = (ROOT / clip["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == clip["sha256"]
    with wave.open(str(ROOT / clip["file"]), "rb") as audio:
        assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
        assert audio.getframerate() == 24000
        assert audio.getnframes() == clip["sampleFrames"]
    escaped = {
        key: html.escape(clip[key], quote=True) for key in ("title", "purpose", "text")
    }
    encoded = base64.b64encode(data).decode("ascii")
    duration = f"{clip['seconds']:.3f}".rstrip("0").rstrip(".")
    cards.append(
        f'<article aria-labelledby="title-{index}"><div class="card-top">'
        f'<span class="number">{index}</span><span class="tag">{duration} ثانية</span></div>'
        f'<h2 id="title-{index}">{escaped["title"]}</h2><p>{escaped["purpose"]}</p>'
        f'<audio aria-label="{escaped["title"]}" controls preload="none" '
        f'src="data:audio/wav;base64,{encoded}">متصفحك لا يدعم تشغيل WAV.</audio>'
        f"<details><summary>النص المنطوق</summary><blockquote>{escaped['text']}</blockquote>"
        f'</details><details class="integrity"><summary>بصمة ملف WAV الأصلي</summary>'
        f'<code dir="ltr">{clip["sha256"]}</code></details></article>'
    )

page = """<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>تجربة استماع Nabra — ثلاث عينات فعلية</title>
<style>
:root{color-scheme:light;font-family:Tahoma,"Segoe UI",Arial,sans-serif;color:#1e293b;background:#fff7ed;line-height:1.9}
*{box-sizing:border-box}body{margin:0}main{width:100%;max-width:1600px;margin:auto;padding:clamp(14px,4vw,48px)}
.hero{background:#fce4ec;border:2px solid #f1f5f9;border-bottom:4px solid #ff5722;border-radius:2rem;padding:clamp(20px,4vw,42px)}
.eyebrow{margin:0;color:#475569;font-size:14px;font-weight:bold}h1{font-size:clamp(25px,4vw,40px);line-height:1.5;margin:8px 0 16px}
h2{font-size:20px;line-height:1.7;margin:18px 0 8px}p{color:#475569;margin:8px 0}a{color:#2563eb;text-underline-offset:4px;overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.chip{background:#ffb000;color:#1e293b;border:2px solid #f1f5f9;border-radius:1rem;padding:4px 13px;font-size:14px;font-weight:bold}
.notice{background:#fff9c4;border-right:5px solid #ffd600;border-radius:1rem;padding:18px 22px;margin:24px 0;color:#1e293b}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}article{min-width:0;background:#f8fafc;border:2px solid #e2e8f0;border-radius:2rem;padding:24px}
.card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.number{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:1rem;background:#ffb000;color:#1e293b;font-weight:bold}
.tag{color:#475569;font-size:14px}audio{display:block;width:100%;margin:24px 0 18px}details{margin:12px 0}summary{cursor:pointer;color:#2563eb;min-height:40px;padding:6px 0}
blockquote{margin:10px 0;padding:14px 18px;border-right:3px solid #ffb000;background:#fce4ec;border-radius:1rem;line-height:2.2;overflow-wrap:anywhere}
code{font-size:12px;display:block;overflow-wrap:anywhere;user-select:all;color:#475569}.integrity{font-size:13px}.steps{padding-right:24px;color:#475569}footer{margin-top:24px;border-top:2px solid #e2e8f0;padding-top:18px;font-size:14px}
@media(max-width:1000px){.grid{grid-template-columns:1fr 1fr}.grid article:last-child{grid-column:1/-1}}
@media(max-width:620px){.grid{grid-template-columns:1fr}article{padding:18px}.notice{padding:14px}.grid article:last-child{grid-column:auto}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
</head>
<body><main>
<header class="hero">
<p class="eyebrow">نبرة · Nabra-7M-Distill / af_msa</p>
<h1>اسمع الصوت قبل أن نغيّر البرنامج</h1>
<p>ثلاث عينات من نموذج Nabra الذي وفّرته. الصوت مُضمّن داخل هذا الملف: لا تثبيت، ولا رفع ملفات، ولا إنترنت لتشغيل العينات بعد تنزيل هذه الصفحة.</p>
<div class="chips"><span class="chip">توليد صوتي فعلي</span><span class="chip">فصحى · صوت واحد</span><span class="chip">WAV · 24 kHz · Mono</span></div>
</header>
<aside class="notice"><strong>نجاح التوليد لا يعني تفوّق الجودة.</strong> لم يُستبدل كريم أو يُدمج Nabra في Nova Voice. لم يُختبر التوليد على Windows أو جهاز 4GB، ولم يُعتمد النطق لغويًا. افتح النص وقارن بالسمع.</aside>
<section class="grid" aria-label="عينات الاستماع">
@@CARDS@@
</section>
<section aria-labelledby="how"><h2 id="how">كيف تقارن؟</h2>
<ol class="steps"><li>شغّل عينة واحدة في كل مرة، عند مستوى صوت مريح ومتقارب.</li>
<li>قارن الدرس دون تشكيل بالدرس المشكول: الحروف والكلمات والترقيم متماثلة، والاختلاف في العلامات فقط.</li>
<li>راقب وضوح الحاء والخاء والعين، والتمييز بين القاف والكاف، والوقفات ونبرة السؤال.</li>
<li>لمقارنة كريم، شغّل نفس النص لديه بسرعة افتراضية ودون موسيقى أو مؤثرات. لا توجد عينة كريم داخل هذه الصفحة، ولا تدّعي هذه العينات نتيجة مقارنة معه.</li></ol>
<p>السرعة هنا 1.0، دون تشكيل آلي أو تطبيع للنص أو معالجة صوتية إضافية. الاختبار لنصوص قصيرة فقط؛ المشروع الأصلي لديه حد لطول الرموز الصوتية.</p>
</section>
<footer><p>ملف استماع مستقل، لا يشغّل النموذج ولا يقرأ ملفات جهازك. لا سكريبتات أو طلبات شبكة تلقائية، ولا ميكروفون أو تشغيل تلقائي.</p>
<p>المصدر: <a href="https://github.com/Oddadmix/nabra-tts/tree/16b5281ce61993df3526740990cf845a3f3036f4" rel="noreferrer noopener" target="_blank">Oddadmix/nabra-tts · المصدر المثبّت</a>. بصمات النموذج والعينات وإعدادات التشغيل موثقة في manifest.json المرافق داخل مستودع التسليم، وليست شهادة أصالة أو صحة نطق.</p>
</footer></main></body></html>
"""
(ROOT / "Nabra-Voice-Trial-AR.html").write_text(
    page.replace("@@CARDS@@", "\n".join(cards)), encoding="utf-8"
)
print(
    "Built one self-contained HTML with 3 exact embedded WAVs; no model/runtime/network."
)
