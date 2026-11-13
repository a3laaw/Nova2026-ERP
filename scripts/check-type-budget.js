#!/usr/bin/env node
/**
 * راصد ميزان أخطاء الأنواع (typecheck budget / ratchet) — `npm run typecheck:gate`
 *
 * لماذا يوجد: `next.config.ts` ضبطُه `ignoreBuildErrors: true`، فلم يشغّل أحد
 * `tsc` على هذا المستودع قط. أول تشغيل فعلي (2026-11) وجد **202 خطأ**، منها استدعاءات
 * لدوال غير موجودة إطلاقاً (أعطال وقت التشغيل). إصلاح الـ 202 ليس شرطاً للنقل،
 * لكن **زيادة** العدد يجب أن تُكسر فوراً — لذلك هذا السكربت بوابة، لا تقرير.
 *
 * الاستخدام:
 *   node scripts/check-type-budget.js            # يفحص مقابل docs/typecheck-budget.json
 *   node scripts/check-type-budget.js --write    # يعتمد العدد الحالي كميزانية جديدة (بعد تحسين مقصود)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUDGET_FILE = path.join(ROOT, 'docs', 'typecheck-budget.json');
const writeMode = process.argv.includes('--write');

const tscBin = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tscBin)) {
  console.error('❌ typescript غير مثبتة. نفّذ:  npm install');
  process.exit(1);
}

const run = spawnSync(process.execPath, [tscBin, '--noEmit'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const out = (run.stdout || '') + (run.stderr || '');

const errors = out.split('\n').filter((l) => /error TS\d+/.test(l));
const perCode = {};
const perFile = {};
for (const line of errors) {
  const code = (line.match(/error (TS\d+)/) || [])[1] || 'TS?';
  const file = (line.match(/^(^[^(]+)/) || [])[1] || line.split('(')[0];
  perCode[code] = (perCode[code] || 0) + 1;
  perFile[file] = (perFile[file] || 0) + 1;
}

const snap = {
  total: errors.length,
  perCode,
  perFile: Object.fromEntries(Object.entries(perFile).sort((a, b) => b[1] - a[1]).slice(0, 25)),
  note: 'ميزانية قصوى لا للزيادة. 157 خطأ منها مفاتيح مكررة في src/context/language-context.tsx (قوامير المغلق) — انقلها إلى end-service لا إلى هنا قبل تعديلها.',
};

if (writeMode) {
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(snap, null, 2) + '\n');
  console.log(`✅ الميزانية الجديدة معتمدة: ${snap.total} خطأ ← docs/typecheck-budget.json`);
  return;
}

if (!fs.existsSync(BUDGET_FILE)) {
  console.log('⚠️  لا توجد ميزانية. أنشئها:  npm run typecheck:budget:write');
  console.log(`   الحالي: ${snap.total} خطأ في ${Object.keys(perFile).length} ملفاً`);
  process.exit(1);
}

const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
console.log(`الأنواع: ${snap.total} خطأ (الميزانية ${budget.total}) · الملفات المتأثرة ${Object.keys(snap.perFile).length}`);
console.log('   ' + Object.entries(snap.perCode).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · '));

if (snap.total > budget.total) {
  console.error(`\n🚫 انكسرت الميزانية: +${snap.total - budget.total} خطأ جديد.`);
  const before = budget.perFile || {};
  const news = Object.entries(snap.perFile)
    .filter(([f, n]) => n > (before[f] || 0))
    .sort((a, b) => b[1] - a[1]);
  if (news.length) {
    console.error('   الملفات التي زاد أخطاؤها:');
    news.slice(0, 10).forEach(([f, n]) => console.error(`     ${f}: ${before[f] || 0} → ${n}`));
  }
  console.error('   الأصل أن يُصلح الخطأ لا أن تُرفع الميزانية. `next.config.ts` يتجاهل الأخطاء — هذه البوابة هي الرادار الوحيد.');
  process.exit(1);
}
if (snap.total < budget.total) {
  console.log(`✅ تحسّن ${budget.total - snap.total} خطأ. حدّث الميزانية:  npm run typecheck:budget:write`);
  return;
}
console.log('✅ السجل المرجعي للأنواع ضمن الميزانية.');
