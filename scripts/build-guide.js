#!/usr/bin/env node
/**
 * مولّد «الدليل الكامل» — NovaFlow ERP 📕
 *
 * يدمج وثيقتي التوثيق في ملف واحد قابل للتنزيل/الطباعة، ويولّد نسخة HTML
 * مستقلة تعرض مخططات Mermaid في المتصفح.
 *
 * الاستخدام:
 *   node scripts/build-guide.js              # يولّد MD + HTML
 *   node scripts/build-guide.js --md         # Markdown فقط
 *   node scripts/build-guide.js --check      # يقارن بالموجود ولا يكتب
 *
 * المصادر (المحرّرة يدوياً):
 *   docs/verticals.md      — شرح النظام مقسّماً إلى موديولات
 *   docs/relationships.md  — خريطة العلاقات المرجعية الكاملة
 * المخرجات (مولّدة — لا تُحرَّر):
 *   docs/NovaFlow-Guide-AR.md
 *   docs/NovaFlow-Guide-AR.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = [
  { file: 'docs/verticals.md', part: 'الجزء الأول', title: 'الموديولات: الاستشارات · المقاولات · D&B · الموارد البشرية · اللب المشترك' },
  { file: 'docs/relationships.md', part: 'الجزء الثاني', title: 'خريطة العلاقات المرجعية: المجموعات، المفاتيح الأجنبية، خطوط الأنابيب، الفجوات' },
  { file: 'docs/migration-runbook.md', part: 'ملحق تشغيلي', title: 'دليل النقل: الخروج الآمن من منصة مغلقة (بيانات، مستخدمون، فهارس، استضافة)' },
];
const OUT_MD = path.join(ROOT, 'docs/NovaFlow-Guide-AR.md');
const OUT_HTML = path.join(ROOT, 'docs/NovaFlow-Guide-AR.html');

const args = process.argv.slice(2);
const ONLY_MD = args.includes('--md');
const CHECK = args.includes('--check');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function demote(md, offset = 1) {
  // يهوي مستوى العناوين درجة، مع تجاهل ما داخل أكواد fenced
  const lines = md.split('\n');
  let inFence = false;
  return lines
    .map((l) => {
      if (l.trim().startsWith('```')) inFence = !inFence;
      if (inFence) return l;
      return l.replace(/^(#{1,5})(\s)/, '#'.repeat(offset) + '$1$2');
    })
    .join('\n');
}

function slug(s) {
  return s
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

function tocOf(md) {
  const out = [];
  let inFence = false;
  for (const l of md.split('\n')) {
    if (l.trim().startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = l.match(/^(#{2,4})\s+(.*)$/);
    if (!m) continue;
    const level = m[1].length - 2;
    const text = m[2].replace(/`/g, '').trim();
    out.push(`${'  '.repeat(level)}- [${text}](#${slug(text)})`);
  }
  return out.join('\n');
}

function build() {
  const parts = SOURCES.map((s) => {
    const full = path.join(ROOT, s.file);
    if (!fs.existsSync(full)) {
      console.error(`❌ المصدر مفقود: ${s.file}`);
      process.exit(1);
    }
    const raw = fs.readFileSync(full, 'utf8');
    const body = raw.replace(/^#\s+.*\n+/, ''); // نزيل عنوان المصدر (نضع عنوان الجزء بدلاً منه)
    return { ...s, body: demote(body, 1), toc: tocOf(demote(body, 1)) };
  });

  const stats = { collections: 0, edges: 0, gaps: 0, verticals: 0 };
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/relations.json'), 'utf8'));
    stats.collections = Object.keys(reg.collections || {}).length;
    stats.verticals = (reg.verticals && reg.verticals.items ? reg.verticals.items.length : 0);
    stats.gaps = (reg.gaps || []).length;
    const gen = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/relations.generated.json'), 'utf8'));
    stats.edges = (gen.edges || []).length;
  } catch (e) {
    console.warn(`⚠️ تعذّر قراءة الإحصاءات: ${e.message}`);
  }

  const L = [];
  L.push('# NovaFlow ERP — الدليل الكامل للنظام وموديولاته');
  L.push('');
  L.push('> **ملف مُولَّد آلياً** من `docs/verticals.md` + `docs/relationships.md` — لا تُحرِّره يدوياً.');
  L.push(`> للإصلاح أو الإضافة عدّل المصدرين ثم نفّذ: \`npm run docs:guide\`.`);
  L.push('>');
  L.push(`> **محتوى هذا الملف**: ${stats.verticals} موديولات · ${stats.collections} مجموعة بيانات · ${stats.edges} علاقة مُشتقة من الكود · ${stats.gaps} فجوة موثّقة.`);
  L.push('> **تاريخ التوليد**: ' + new Date().toISOString().slice(0, 10));
  L.push('');
  L.push('---');
  L.push('');
  L.push('## الفهرس العام');
  L.push('');
  parts.forEach((p, i) => {
    L.push(`### ${p.part}: ${p.title}`);
    L.push('');
    L.push(p.toc || '- (بدون عناوين فرعية)');
    L.push('');
  });
  L.push('---');
  L.push('');
  L.push('# القراءة السريعة: 12 سطرًا تختصر النظام كله');
  L.push('');
  L.push([
    '1. كل شيء تحت **مستأجر واحد**: `companies/{companyId}/…`، والعزل تفرضه `firestore.rules` عبر `belongsToCompany()`.',
    '2. **الهوية عالمية والصلاحية محلية**: `global_users/{uid}` → `companyId` + `roleId` + `employeeId` + `departmentId`، ومرآة في `companies/{c}/users/{uid}`.',
    '3. **لا توجد مجموعة مشاريع**: «المشروع» = معاملة (`transactions`) مصفّاة نصياً، وكل `projectId` يحمل `transactionId` فعلياً.',
    '4. **المعاملة هي محور كل رابط**: الوثائق، المقايسات، المراحل، التنفيذ، الفوترة، التكاليف، المواعيد، الزيارات — كلها `transactionId` واحد.',
    '5. **الشجرة الفنية تُنشئ والنسخة تُنفَّذ**: `technicalStages` (قالب) ← `transactionStages` (نسخة قابلة للتعديل والحقن).',
    '6. **القاموس الموحد**: `boqReferenceNodes` مصدر كود/وصف/وحدة/سعر/مرحلة لكل بنود الأعمال.',
    '7. **التنفيذ عدّادات**: `executions` تزيد `boqItems.executedQuantity` و`stageInstances.currentCount`؛ والـ VO يضيف `approvedVariationQty` ولا يمسّ الأصل.',
    '8. **المال يُولَّد من الحدث**: إتمام مرحلة ← `milestone → due` ← `ipcs` ← `vouchers` ← `journalEntries`؛ والزيارة ← قيد WIP؛ والمسير ← قيد رواتب.',
    '9. **أبعاد حتمية المعرّف**: `cc_{transactionId}` و`pc_{transactionId}` وحساب WIP بـ `referenceId=transactionId` — تكرار آمن للأتمتة.',
    '10. **كل مرجع مُجمَّد لحظة الكتابة**: `xxxName` مرآة، و`hourlyCostRef → actualCost` نسخة سعر اللحظة.',
    '11. **الموديولات رأسية بالبيانات لا بالكود**: `activityType` + `pricingMode` + `measurementMode` + `isTimed/isNumeric` + profile ساعات العمل.',
    '12. **الفصل الحالي نصي وهشّ**: 5 مواضع مطابقة نصية (وثّقت كـ G11)، وأخطر ما كشفه الفحص: G1 (تحليل انحراف المواد معطّل) وG8 (عقد بلا معاملة لا يُفوتر بصمت).',
  ].join('\n'));
  L.push('');
  L.push('---');
  L.push('');
  parts.forEach((p) => {
    L.push(`# ${p.part}: ${p.title}`);
    L.push('');
    L.push(p.body.trim());
    L.push('');
    L.push('---');
    L.push('');
  });
  L.push('*نهاية الدليل — المصادر: `src/firebase/multi-tenant.ts`، `src/types/*.ts`، `src/services/*.ts`، `firestore.rules`.*');
  L.push('');

  const md = L.join('\n');

  if (CHECK) {
    const same = fs.existsSync(OUT_MD) && fs.readFileSync(OUT_MD, 'utf8').includes(md.split('\n')[6]);
    console.log(same ? '✅ الدليل المولّد مطابق للمصدر.' : '⚠️ الدليل المولّد أقدم من المصدر — نفّذ: npm run docs:guide');
    process.exit(same ? 0 : 1);
  }

  fs.writeFileSync(OUT_MD, md);
  console.log(`📕 ${rel(OUT_MD)} (${(md.length / 1024).toFixed(1)} KB)`);

  if (!ONLY_MD) {
    const html = renderHtml(md, parts.length);
    fs.writeFileSync(OUT_HTML, html);
    console.log(`🌐 ${rel(OUT_HTML)} (${(html.length / 1024).toFixed(1)} KB)`);
  }
}

function renderHtml(md, partCount) {
  // تهريب آمن للنص داخل <pre> — يحمي الصفحة من أي </script> أو وسوم في المحتوى
  const safe = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>NovaFlow ERP — الدليل الكامل (${partCount} أجزاء)</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  :root { --ink:#1e293b; --soft:#475569; --line:#e2e8f0; --accent:#e87c24; --bg:#fdfaf3; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--ink);
    font:15px/1.95 "PT Sans","Segoe UI",Tahoma,sans-serif; }
  main { max-width:1180px; margin:0 auto; padding:40px 26px 120px; }
  h1,h2,h3,h4 { font-family:"Space Grotesk","Segoe UI",Tahoma,sans-serif; line-height:1.5; margin:1.9em 0 .6em; }
  h1 { font-size:2.05em; border-bottom:4px solid var(--accent); padding-bottom:.35em; }
  h2 { font-size:1.5em; border-bottom:1px solid var(--line); padding-bottom:.25em; color:#1e1b4b }
  h3 { font-size:1.2em; color:#334155 } h4 { font-size:1.05em }
  blockquote { margin:1.2em 0; padding:.7em 1.1em; background:#fff8ec;
    border-inline-start:4px solid var(--accent); border-radius:0 14px 14px 0; color:var(--soft) }
  code { background:#f1f5f9; padding:.14em .42em; border-radius:6px; font-size:.86em;
    font-family:ui-monospace,"Cascadia Mono",Consolas,monospace; direction:ltr; unicode-bidi:embed }
  pre { background:#0f172a; color:#e2e8f0; padding:16px 18px; border-radius:14px; overflow:auto;
    direction:ltr; unicode-bidi:embed }
  pre code { background:none; color:inherit; padding:0 }
  pre.mermaid, .mermaid { background:#fff; color:var(--ink); direction:ltr; unicode-bidi:normal;
    border:2px solid var(--line); border-radius:18px; padding:18px; overflow:auto }
  table { border-collapse:collapse; width:100%; margin:1.3em 0; background:#fff;
    border-radius:14px; overflow:hidden; box-shadow:0 1px 0 var(--line); font-size:.92em }
  th,td { border:1px solid var(--line); padding:9px 12px; text-align:right; vertical-align:top }
  th { background:#fff3e0; font-weight:700; color:#7c2d12 }
  tr:nth-child(even) td { background:#fcfbf8 }
  a { color:#2563eb; text-decoration:none } a:hover { text-decoration:underline }
  hr { border:none; border-top:1px dashed var(--line); margin:2.4em 0 }
  ul,ol { padding-inline-start:1.6em } li { margin:.32em 0 }
  .bar { position:sticky; top:0; z-index:9; background:#1e1b4b; color:#fff; padding:10px 22px;
    display:flex; gap:14px; align-items:center; justify-content:space-between; font-size:13px }
  .bar b { font-weight:600 } .bar button { background:var(--accent); color:#fff; border:0;
    padding:7px 14px; border-radius:10px; cursor:pointer; font:inherit; font-weight:700 }
  @media print { .bar{display:none} body{background:#fff} main{max-width:none; padding:0}
    table,pre,blockquote{page-break-inside:avoid} h1{page-break-before:always} }
</style>
</head>
<body>
<div class="bar">
  <b>NovaFlow ERP — الدليل الكامل للنظام وموديولاته</b>
  <span>ملف مُولَّد من docs/verticals.md + docs/relationships.md</span>
  <button onclick="window.print()">طباعة / PDF</button>
</div>
<main id="app"><pre id="raw">${safe}</pre></main>
<script>
(function () {
  var src = document.getElementById('raw').textContent;
  if (!window.marked) { return; } // بدون إنترنت: يبقى النص الخام مقروءاً
  marked.setOptions({ gfm: true, breaks: false });
  var app = document.getElementById('app');
  app.innerHTML = marked.parse(src);
  // تحويل كتل mermaid من pre/code إلى div.mermaid قبل تشغيل الرسم
  var diagrams = [];
  app.querySelectorAll('pre > code.language-mermaid').forEach(function (code) {
    var pre = code.parentElement;
    var div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    pre.replaceWith(div);
    diagrams.push(div);
  });
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose',
      flowchart: { htmlLabels: true, curve: 'basis' } });
    mermaid.run({ nodes: diagrams }).catch(function () { /* مخطط واحد فاشل لا يُسقط الصفحة */ });
  }
  // مرساة عربية آمنة
  app.querySelectorAll('h1,h2,h3,h4').forEach(function (h) {
    h.id = h.textContent.trim().replace(/[^\\p{L}\\p{N}\\s-]/gu, '').replace(/\\s+/g, '-').replace(/-{2,}/g, '-').toLowerCase();
  });
})();
</script>
</body>
</html>
`;
}

build();
