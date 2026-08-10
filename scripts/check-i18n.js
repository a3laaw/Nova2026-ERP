#!/usr/bin/env node
/**
 * أداة فحص تلقائي لملف الترجمة — تكتشف أي رجوع للخلف (فقدان مفاتيح) فوراً.
 *
 * طريقة الاستخدام:
 *   node scripts/check-i18n.js
 *
 * تقارن:
 * 1. كل مفتاح t('...') مستخدم فعلياً بالكود مقابل الموجود بالقاموس.
 * 2. تطابق مفاتيح ar مع en (كل مفتاح لازم يكون بالاثنين).
 * 3. تحفظ "لقطة" (baseline) بعدد المفاتيح، وتحذّر لو العدد نقص عن آخر مرة
 *    (يعني حد استبدل الملف بدل ما يضيف عليه).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LANG_FILE = path.join(ROOT, 'src/context/language-context.tsx');
const BASELINE_FILE = path.join(__dirname, '.i18n-baseline.json');

function walk(dir, exts, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, exts, files);
    } else if (exts.some(e => entry.name.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

function collectUsedKeys() {
  const files = [
    ...walk(path.join(ROOT, 'src/app'), ['.tsx', '.ts']),
    ...walk(path.join(ROOT, 'src/components'), ['.tsx', '.ts']),
  ];
  const used = new Set();
  const keyRegex = /\bt\(\s*'([^']+)'\s*\)/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let m;
    while ((m = keyRegex.exec(content))) {
      used.add(m[1]);
    }
  }
  return used;
}

function collectHardcodedTernaries() {
  const files = walk(path.join(ROOT, 'src/app/dashboard'), ['.tsx']);
  const offenders = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (/isRtl\s*\?\s*'/.test(content)) {
      offenders.push(path.relative(ROOT, file));
    }
  }
  return offenders;
}

function extractDict(content, lang) {
  const startMarker = `${lang}: {`;
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find '${lang}: {' block`);
  const otherLang = lang === 'ar' ? 'en' : 'ar';
  const endMarker = `\n  ${otherLang}: {`;
  let end = content.indexOf(endMarker, start);
  let block;
  if (end !== -1 && lang === 'ar') {
    block = content.slice(start + startMarker.length, end);
  } else {
    // en block: goes from start to the closing "\n  };" of the translations object
    const closeMarker = '\n};';
    end = content.indexOf(closeMarker, start);
    block = content.slice(start + startMarker.length, end);
  }
  const keys = new Set();
  const keyRegex = /^\s*'([^']+)'\s*:/gm;
  let m;
  while ((m = keyRegex.exec(block))) keys.add(m[1]);
  return keys;
}

function extractDictWithValues(content, lang) {
  const startMarker = `${lang}: {`;
  const start = content.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find '${lang}: {' block`);
  let depth = 0, i = start + startMarker.length - 1;
  for (; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const block = content.slice(start + startMarker.length, i);
  const result = {};
  const pairRegex = /^\s*'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'/gm;
  let m2;
  while ((m2 = pairRegex.exec(block))) result[m2[1]] = m2[2];
  return result;
}

function main() {
  const content = fs.readFileSync(LANG_FILE, 'utf-8');
  const arKeys = extractDict(content, 'ar');
  const enKeys = extractDict(content, 'en');
  const usedKeys = collectUsedKeys();
  const ternaryFiles = collectHardcodedTernaries();

  console.log('====================================');
  console.log(' تقرير فحص الترجمة (i18n)');
  console.log('====================================\n');

  console.log(`مفاتيح translations.ar: ${arKeys.size}`);
  console.log(`مفاتيح translations.en: ${enKeys.size}`);
  console.log(`مفاتيح t('...') مستخدمة فعلياً بالكود: ${usedKeys.size}\n`);

  const missingFromEn = [...arKeys].filter(k => !enKeys.has(k));
  const missingFromAr = [...enKeys].filter(k => !arKeys.has(k));
  const usedButMissing = [...usedKeys].filter(k => !arKeys.has(k) || !enKeys.has(k));

  let hasProblem = false;

  if (missingFromEn.length) {
    hasProblem = true;
    console.log(`🔴 مفاتيح موجودة بـ ar وغائبة عن en (${missingFromEn.length}):`);
    missingFromEn.slice(0, 20).forEach(k => console.log('   -', k));
    if (missingFromEn.length > 20) console.log(`   ... و ${missingFromEn.length - 20} أخرى`);
    console.log();
  }

  if (missingFromAr.length) {
    hasProblem = true;
    console.log(`🔴 مفاتيح موجودة بـ en وغائبة عن ar (${missingFromAr.length}):`);
    missingFromAr.slice(0, 20).forEach(k => console.log('   -', k));
    console.log();
  }

  if (usedButMissing.length) {
    hasProblem = true;
    console.log(`🔴 مفاتيح تُستخدم بالكود (t('key')) لكنها غير معرّفة بكلا اللغتين (${usedButMissing.length}):`);
    usedButMissing.slice(0, 30).forEach(k => console.log('   -', k));
    if (usedButMissing.length > 30) console.log(`   ... و ${usedButMissing.length - 30} أخرى`);
    console.log();
  }

  // فحص إضافي: مفاتيح بقاموس ar لكن قيمتها إنجليزية فعلياً (غش شائع لإرضاء عدّاد المفاتيح)
  const arDict = extractDictWithValues(content, 'ar');
  const englishInArabic = [];
  const asciiOnly = /^[A-Za-z0-9 .,:;&()/_\-'!?%+#@]+$/;
  for (const [key, val] of Object.entries(arDict)) {
    if (val && val.length > 1 && asciiOnly.test(val)) {
      englishInArabic.push([key, val]);
    }
  }
  if (englishInArabic.length) {
    hasProblem = true;
    console.log(`🔴🔴 تحذير خطير: ${englishInArabic.length} مفتاح بقاموس ar قيمته إنجليزية فعلياً (مو مترجمة):`);
    englishInArabic.slice(0, 20).forEach(([k, v]) => console.log(`   - ${k} -> "${v}"`));
    if (englishInArabic.length > 20) console.log(`   ... و ${englishInArabic.length - 20} أخرى`);
    console.log('   هذا يعني القيم اتنسخت بدون ترجمة فعلية لمجرد إرضاء عدّاد المفاتيح.\n');
  }

  if (ternaryFiles.length) {
    console.log(`🟡 ملفات لسا فيها النمط القديم isRtl ? '...' : '...' (${ternaryFiles.length}):`);
    ternaryFiles.slice(0, 15).forEach(f => console.log('   -', f));
    if (ternaryFiles.length > 15) console.log(`   ... و ${ternaryFiles.length - 15} أخرى`);
    console.log();
  }

  // Regression check against baseline
  let baseline = null;
  if (fs.existsSync(BASELINE_FILE)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8'));
    console.log('--- مقارنة بآخر فحص محفوظ ---');
    console.log(`آخر مرة: ar=${baseline.arKeys}, en=${baseline.enKeys}`);
    console.log(`الآن:     ar=${arKeys.size}, en=${enKeys.size}`);
    if (arKeys.size < baseline.arKeys || enKeys.size < baseline.enKeys) {
      hasProblem = true;
      console.log('\n🔴🔴🔴 تحذير: عدد المفاتيح نقص عن آخر مرة! هذا يعني حد استبدل');
      console.log('    الملف بدل ما يضيف عليه، وضاع شغل سابق. لا تثق بأي تقرير');
      console.log('    يقول "تم الإنجاز" قبل ما تشغّل هذا السكربت وتتأكد بنفسك.\n');
    } else {
      console.log('✅ لا يوجد رجوع للخلف مقارنة بآخر فحص.\n');
    }
  } else {
    console.log('(لا توجد لقطة سابقة — سيتم إنشاء واحدة الآن كنقطة مرجعية)\n');
  }

  fs.writeFileSync(BASELINE_FILE, JSON.stringify({
    arKeys: arKeys.size,
    enKeys: enKeys.size,
    date: new Date().toISOString()
  }, null, 2));

  console.log('====================================');
  console.log(hasProblem ? '❌ يوجد مشاكل يجب حلها (انظر أعلاه)' : '✅ كل شيء سليم');
  console.log('====================================');

  process.exit(hasProblem ? 1 : 0);
}

main();