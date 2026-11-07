#!/usr/bin/env node
/**
 * رقيب العلاقات السيادي — NovaFlow ERP 🕸️
 *
 * يشتق خريطة البيانات من الكود فعلياً ثم يقارنها بالسجل المرجعي docs/relations.json،
 * فيمنع أي انحراف بين «ما هو موجود في الكود» و«ما هو موثّق في docs/relationships.md».
 *
 * الاستخدام:
 *   node scripts/check-relations.js            # فحص فقط (يخرج بكود 1 عند وجود أخطاء)
 *   node scripts/check-relations.js --write    # الفحص + إعادة توليد docs/relations.generated.json
 *   node scripts/check-relations.js --json     # طباعة التقرير كـ JSON (للأدلة الآلية)
 *
 * يفحص ستة أمور:
 *  1) تطابق مفاتيح src/firebase/multi-tenant.ts مع سجل docs/relations.json (في الاتجاهين).
 *  2) سلامة كل مفتاح أجنبي (xxxId / xxxIds) في src/types/*.ts: لا بد أن له هدف محلول
 *     في سجل aliases، أو أن يكون مسجلاً كحقل غير مرجعي (nonRelationalIdFields).
 *  3) تطابق حالة الاستخدام (active / declared-unused) مع الواقع في الكود.
 *  4) كل مسار نصي companies/{c}/<collection> يجب أن يكون مسجلاً — يكتشف المجموعات الشبح.
 *  5) سلامة التسلسل الهرمي (parent) لكل مجموعة مقابل مسارها المشتق.
 *  6) كل مجموعة وكل خط أنابيب وكل فجوة في السجل يجب أن مذكورة نصياً في docs/relationships.md.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'docs/relations.json');
const GENERATED_FILE = path.join(ROOT, 'docs/relations.generated.json');
const PATHS_FILE = path.join(ROOT, 'src/firebase/multi-tenant.ts');
const DOC_FILE = path.join(ROOT, 'docs/relationships.md');
const TYPES_DIR = path.join(ROOT, 'src/types');
const SRC_DIR = path.join(ROOT, 'src');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const AS_JSON = args.includes('--json');

const errors = [];
const warnings = [];
const infos = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const info = (m) => infos.push(m);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name) && !full.includes('.backup.')) files.push(full);
  }
  return files;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');

/* ------------------------------------------------------------------ *
 * 1) اشتقاق المسارات من src/firebase/multi-tenant.ts
 * ------------------------------------------------------------------ */
function derivePaths() {
  const src = read(PATHS_FILE);
  const out = {};
  const lines = src.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(\w+):\s*\(([^)]*)\)\s*=>\s*(.*?),?$/);
    if (!m) continue;
    const [, key, params, exprRaw] = m;
    let expr = exprRaw.trim().replace(/,$/, '');
    // getTenantPath(companyId, 'x', 'y')  ->  companies/{companyId}/x/y
    expr = expr.replace(
      /\$\{\s*getTenantPath\(\s*(?:this\.)?companyId\s*,\s*((?:'[^']+'\s*,?\s*)+)\)\s*\}/g,
      (_s, segs) => 'companies/{companyId}/' + segs.split(',').map((s) => s.trim().replace(/'/g, '')).join('/')
    );
    expr = expr.replace(
      /getTenantPath\(\s*(?:this\.)?companyId\s*,\s*((?:'[^']+'\s*,?\s*)+)\)/g,
      (_s, segs) => "'companies/{companyId}/" + segs.split(',').map((s) => s.trim().replace(/'/g, '')).join('/') + "'"
    );
    // المتغيرات الممررة في التوابع: ${deptId} -> {deptId}
    for (const p of params.split(',')) {
      const name = p.trim().split(/[:?\s]/)[0];
      if (!name) continue;
      expr = expr.split('${' + name + '}').join('{' + name + '}');
    }
    expr = expr.split('${companyId}').join('{companyId}');
    expr = expr.replace(/[`'"]/g, '');
    out[key] = expr;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 2) استخراج الحقول المرجعية من src/types/*.ts
 * ------------------------------------------------------------------ */
function parseInterfaces(file) {
  const src = read(file);
  const res = [];
  const re = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w, ]+)?\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const start = re.lastIndex;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    const fields = [];
    for (const line of body.split('\n')) {
      const fm = line.match(/^\s*(\w+)(\??|!\?)\s*:\s*(.+?);?\s*$/);
      if (fm) fields.push({ name: fm[1], type: fm[3].trim(), line: line.trim() });
    }
    res.push({ name, fields, line: src.slice(0, m.index).split('\n').length });
  }
  return res;
}

/* ------------------------------------------------------------------ *
 * 3) فحص مسارات نصية خارج paths
 * ------------------------------------------------------------------ */
function scanRawTenantPaths() {
  const hits = [];
  const roots = {};
  const ROOTS = ['companies', 'global_users', 'company_requests'];
  const files = walk(SRC_DIR).filter((f) => path.basename(f) !== 'multi-tenant.ts');
  for (const f of files) {
    const src = read(f);
    for (const r of ROOTS) {
      const n = (src.match(new RegExp("['\"]" + r + "['\"/]", 'g')) || []).length;
      if (n) (roots[r] = roots[r] || []).push({ file: rel(f), count: n });
    }
    src.split('\n').forEach((line, idx) => {
      let m = line.match(/companies\/\$\{[^}]+\}\/([A-Za-z][\w]*)/);
      if (m) hits.push({ coll: m[1], file: rel(f), line: idx + 1, kind: 'template' });
      m = line.match(/['"]companies['"]\s*,\s*[\w.'"\[\]?-]+\s*,\s*'([A-Za-z][\w]*)'/);
      if (m) hits.push({ coll: m[1], file: rel(f), line: idx + 1, kind: 'args' });
      m = line.match(/^\s*(?:const\s+\w+\s*=\s*)?collection\(\s*[\w.]+\s*,\s*'([a-z][\w]*)'\s*[,)]/);
      if (m && !ROOTS.includes(m[1])) hits.push({ coll: m[1], file: rel(f), line: idx + 1, kind: 'root' });
    });
  }
  return { hits, roots };
}

/* ------------------------------------------------------------------ *
 * MAIN
 * ------------------------------------------------------------------ */
function main() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error('❌ الملف المرجعي docs/relations.json غير موجود.');
    process.exit(1);
  }
  const reg = JSON.parse(read(REGISTRY_FILE));
  const derived = derivePaths();
  const doc = fs.existsSync(DOC_FILE) ? read(DOC_FILE) : '';

  if (!fs.existsSync(DOC_FILE)) err('الملف docs/relationships.md مفقود — السجل بلا وثيقة مقابلة.');

  const registryKeys = Object.keys(reg.collections);
  const codeKeys = Object.keys(derived);

  /* --- 1) تطابق السجل مع الكود --- */
  for (const k of codeKeys) {
    if (!reg.collections[k]) err(`مجموعة '${k}' معرّفة في multi-tenant.ts لكنها غير مسجلة في docs/relations.json`);
  }
  for (const k of registryKeys) {
    const meta = reg.collections[k];
    if (!(k in derived)) {
      if (!meta.rawPath) err(`'${k}' مسجلة في السجل بلا مسار مشتق من الكود وبدون rawPath`);
      continue;
    }
    // لا نخزّن المسار في السجل: المصدر الوحيد هو الكود. نتحقق فقط من عدم التعارض مع rawPath
    if (meta.rawPath && meta.rawPath !== derived[k])
      err(`'${k}': rawPath في السجل (${meta.rawPath}) لا يطابق الكود (${derived[k]})`);
  }

  /* --- 2) سلامة المفاتيح الأجنبية في الأنواع --- */
  const aliases = reg.aliases || {};
  const nonRel = new Set((reg.nonRelationalIdFields || []).map((x) => x.field));
  const entityToColl = {};
  for (const [k, v] of Object.entries(reg.collections)) if (v.entity && v.entity !== '—') entityToColl[v.entity] = k;

  const allCollNames = new Set(codeKeys);
  const derivedByLastSeg = {};
  for (const [k, p] of Object.entries(derived)) derivedByLastSeg[p.split('/').pop()] = k;

  const edges = [];
  const seenFields = new Set();
  for (const file of walk(TYPES_DIR)) {
    for (const iface of parseInterfaces(file)) {
      const owner = entityToColl[iface.name];
      for (const f of iface.fields) {
        const isRef = /Ids?$/.test(f.name) && !/Number$|Code$/.test(f.name);
        if (!isRef) continue;
        if (nonRel.has(f.name)) continue;
        let target = aliases[f.name];
        if (target === 'SELF') target = owner || 'SELF';
        if (!target) {
          const dedupe = `${iface.name}.${f.name}`;
          if (!seenFields.has(dedupe)) {
            seenFields.add(dedupe);
            err(
              `مفتاح أجنبي غير موثّق: ${rel(file)}:${iface.line} — ${iface.name}.${f.name} ` +
                `ليس في aliases ولا في nonRelationalIdFields بسجل docs/relations.json`
            );
          }
          continue;
        }
        if (target !== 'POLYMORPHIC' && !allCollNames.has(target) && !derivedByLastSeg[target])
          err(`aliases['${f.name}'] يشير إلى مجموعة غير معروفة: '${target}'`);
        if (owner && target !== 'POLYMORPHIC') edges.push({ from: owner, field: f.name, to: target, via: iface.name });
      }
    }
  }

  /* --- 3) حالة الاستخدام مقابل الواقع --- */
  const srcFiles = walk(SRC_DIR).filter((f) => !f.endsWith(PATHS_FILE));
  const usage = {};
  for (const k of codeKeys) usage[k] = [];
  for (const f of srcFiles) {
    const src = read(f);
    for (const k of codeKeys) if (src.includes(`paths.${k}(`)) usage[k].push(rel(f));
  }
  const { hits: rawHits, roots: rawRoots } = scanRawTenantPaths();

  const rawUsage = {};
  for (const h of rawHits) (rawUsage[h.coll] ||= []).push(h);
  const rawRootUses = {};

  for (const [k, meta] of Object.entries(reg.collections)) {
    const files = usage[k] || [];
    const rawPathName = meta.rawPath ? meta.rawPath.split('/').filter((x) => !x.startsWith('{')).pop() : null;
    const rawHitsN =
      (rawPathName ? (rawUsage[rawPathName] || []).length : 0) +
      (meta.rawMatch ? srcFiles.filter((f) => read(f).includes(meta.rawMatch)).length : 0);
    const rawRootN = meta.rawRoot && rawRoots[meta.rawRoot] ? rawRoots[meta.rawRoot].reduce((a, b) => a + b.count, 0) : 0;
    const used = files.length > 0 || rawHitsN > 0 || rawRootN > 0;
    if (rawRootN) rawRootUses[k] = rawRootN;
    if (meta.status === 'declared-unused' && files.length > 0)
      err(`'${k}' مسجلة كـ declared-unused لكنها مستخدمة في ${files.length} ملف — حدّث السجل`);
    if (meta.status === 'active' && !used && !meta.rawPath && !meta.rawRoot)
      err(`'${k}' مسجلة كـ active بدون أي استخدام في الكود — انقلها إلى declared-unused أو أضف الاستخدام`);
    if (!used) info(`مجموعة معرّفة بلا استخدام في الكود: ${k}`);
  }

  /* --- 4) المجموعات الشبح: مسارات نصية غير مسجلة --- */
  const legacyRoot = reg.legacyRootCollections || {};
  const registeredLeafs = new Set(['companies', 'global_users', 'company_requests']);
  for (const [k, meta] of Object.entries(reg.collections)) {
    registeredLeafs.add(k);
    if (meta.rawPath) registeredLeafs.add(meta.rawPath.split('/').filter(Boolean).pop());
    const p = derived[k];
    if (p) registeredLeafs.add(p.split('/').pop());
  }
  for (const h of rawHits) {
    if (registeredLeafs.has(h.coll)) continue;
    if (legacyRoot[h.coll]) {
      warn(`مسار مجموعة غير مُدارة عبر paths: '${h.coll}' في ${h.file}:${h.line} — مسجلة كاستثناء في السجل (${legacyRoot[h.coll]})`);
    } else {
      err(`مسار مجموعة غير مُسجّل: '${h.coll}' في ${h.file}:${h.line} — أضفها إلى src/firebase/multi-tenant.ts وإلى docs/relations.json`);
    }
  }

  /* --- 5) سلامة الأب في السجل مقابل المسار المشتق --- */
  for (const [k, meta] of Object.entries(reg.collections)) {
    const p = derived[k];
    if (!p || !meta.parent || meta.parent === 'company') continue;
    const parentPath = derived[meta.parent];
    if (!parentPath) {
      warn(`'${k}': الأب '${meta.parent}' غير موجود في الكود للتحقق من التداخل`);
      continue;
    }
    if (!p.startsWith(parentPath))
      err(`تسلسل هرمي خاطئ: مسار '${k}' (${p}) لا يبدأ بمسار أبيه '${meta.parent}' (${parentPath})`);
  }

  /* --- 6) تغطية التوثيق في docs/relationships.md --- */
  if (doc) {
    for (const k of registryKeys) {
      if (!doc.includes('`' + k + '`')) err(`المجموعة '${k}' غير مذكورة في docs/relationships.md — حدّث الجداول`);
    }
    for (const p of reg.pipelines || []) {
      if (!doc.includes(p.id)) warn(`خط الأنابيب '${p.id}' غير مذكور في docs/relationships.md`);
    }
    for (const g of reg.gaps || []) {
      if (!doc.includes(g.id)) warn(`الفجوة '${g.id}' غير مذكورة في docs/relationships.md`);
    }
  }

  /* --- 7) إحصاءات إضافية (تحذيرات فقط) --- */
  const typesNeeded = registryKeys.filter((k) => reg.collections[k].typesNeeded);
  if (typesNeeded.length)
    info(`مجموعات بلا واجهة TypeScript (تُكتب بحقول حرة): ${typesNeeded.join(', ')}`);

  const missingMirror = [];
  for (const file of walk(TYPES_DIR)) {
    for (const iface of parseInterfaces(file)) {
      const names = new Set(iface.fields.map((f) => f.name));
      for (const f of iface.fields) {
        if (!/Id$/.test(f.name) || f.name.endsWith('Ids')) continue;
        const base = f.name.replace(/Id$/, '');
        if (nonRel.has(f.name) || !aliases[f.name]) continue;
        if (!names.has(base + 'Name') && !names.has(base + 'Number') && !names.has(base + 'Names'))
          missingMirror.push(`${iface.name}.${f.name}`);
      }
    }
  }
  if (missingMirror.length)
    info(`حقول xxxId بلا مرآة xxxName المقابلة (${missingMirror.length}): ${missingMirror.slice(0, 8).join(', ')}${missingMirror.length > 8 ? ' …' : ''}`);

  /* --- 8) الإخراج --- */
  const stats = {
    collectionsInCode: codeKeys.length,
    collectionsInRegistry: registryKeys.length,
    fkEdges: edges.length,
    usageIndex: Object.fromEntries(codeKeys.map((k) => [k, usage[k].length])),
    rawRootUses,
  };

  if (WRITE) {
    const generated = {
      note: 'ملف مُولّد آلياً من scripts/check-relations.js — لا تحرره يدوياً. المصدر: src/firebase/multi-tenant.ts + src/types/*.ts',
      generatedAt: new Date().toISOString(),
      paths: derived,
      edges: edges.sort((a, b) => (a.from + a.field).localeCompare(b.from + b.field)),
      usage,
      rawTenantPaths: rawHits,
      rawRootCollections: rawRoots,
      stats,
    };
    fs.writeFileSync(GENERATED_FILE, JSON.stringify(generated, null, 2));
    console.log(`📦 تم توليد ${rel(GENERATED_FILE)} (${edges.length} علاقة، ${codeKeys.length} مجموعة)`);
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ errors, warnings, infos, stats }, null, 2));
  } else {
    console.log('══════════════════════════════════════════════');
    console.log('  رقيب العلاقات — NovaFlow ERP 🕸️');
    console.log('══════════════════════════════════════════════');
    console.log(`- مجموعات معرّفة في الكود: ${stats.collectionsInCode}`);
    console.log(`- مجموعات في السجل المرجعي: ${stats.collectionsInRegistry}`);
    console.log(`- العلاقات المستخرجة من src/types: ${stats.fkEdges}`);
    console.log(`- مسارات نصية لمجموعات (خارج paths): ${rawHits.length}`);
    console.log('');
    for (const e of errors) console.log('❌ ' + e);
    for (const w of warnings) console.log('⚠️  ' + w);
    for (const i of infos) console.log('ℹ️  ' + i);
    if (!errors.length)
      console.log('\n✅ السجل المرجعي مطابق للكود. العلاقات موثّقة ومحمية من الانحراف.');
    else console.log(`\n🚫 ${errors.length} انحراف بين الكود والتوثيق.`);
  }

  process.exit(errors.length ? 1 : 0);
}

main();
