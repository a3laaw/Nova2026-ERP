#!/usr/bin/env node
/**
 * نقل قاعدة البيانات — NovaFlow ERP 🚚
 *
 * يصدّر بيانات Firestore (مع كل المجموعات الفرعية) إلى ملفات JSONL قابلة للاستيراد
 * في أي مشروع Firebase آخر، مع الحفاظ على معرّفات المستندات ومسارات التداخل.
 *
 * الاستخدام:
 *   node scripts/db-transfer.js counts                        # جرد سريع قبل الحذف
 *   node scripts/db-transfer.js export                        # تصدير كامل ← backups/<تاريخ>/
 *   node scripts/db-transfer.js export --only=companies       # مجموعة جذرية محددة
 *   node scripts/db-transfer.js import backups/2026-11-07 --dry-run
 *   node scripts/db-transfer.js import backups/2026-11-07
 *   node scripts/db-transfer.js indexes                       # استخراج الفهارس عبر Firebase CLI
 *
 * المطلوب:
 *   npm i -D firebase-admin
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json     (مفتاح حساب الخدمة)
 *   FIREBASE_PROJECT_ID=مشروعك                                 (اختياري لكن موصّى به)
 *
 * ⚠️ كلمات المرور لا تنتقل بهذا السكربت — استخدم (يعمل بين مشاريع Firebase فقط):
 *   firebase auth:export users.csv
 *   firebase auth:import users.csv --hash-algorithm=SCRYPT
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
for (const f of ['.env.local', '.env']) {
  try { require('dotenv').config({ path: path.join(ROOT, f) }); } catch (e) { /* dotenv اختياري */ }
}

const LEGACY_PROJECT = 'studio-2485061478-24bde';
const DEFAULT_ROOTS = 'companies,global_users,company_requests';

/** تحليل وسائط السطر الأوامر — معزول ليكون قابلاً للاختبار (npm run selftest) */
function parseArgs(argv) {
  const args = argv.slice();
  const cmd = args[0];
  const has = (flag) => args.includes('--' + flag);
  const opt = (name, dflt) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    if (hit) return hit.slice(name.length + 3);
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
  };
  return { cmd, has, opt };
}

/** هل ممنوع الاستيراد إلى مشروع المنصة المحتضَر؟ (شرط نقي قابل للاختبار) */
function needsLegacyOverride(cmd, projectId, yes) {
  return cmd === 'import' && projectId === LEGACY_PROJECT && !yes;
}

const { cmd, has, opt } = parseArgs(process.argv.slice(2));

function loadAdmin() {
  let admin;
  try { admin = require('firebase-admin'); }
  catch (e) {
    console.error('❌ الحزمة firebase-admin غير مثبتة.  نفّذ:  npm i -D firebase-admin');
    process.exit(1);
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const init = { projectId };
  if (creds && creds.trim().startsWith('{')) init.credential = admin.credential.cert(JSON.parse(creds));
  else if (creds && fs.existsSync(path.resolve(ROOT, creds))) init.credential = admin.credential.cert(path.resolve(ROOT, creds));
  else {
    console.error('❌ حدّد مفتاح حساب الخدمة عبر GOOGLE_APPLICATION_CREDENTIALS (مسار ملف JSON أو محتواه).');
    process.exit(1);
  }
  if (admin.apps.length === 0) admin.initializeApp(init);
  return { admin, projectId: admin.apps[0].options.projectId };
}

/**
 * محوّل أنواع Firestore ←→ JSON.
 * ⚠️ ملاحظة مثبتة بالاختبار (npm run selftest): في firebase-admin v13 /
 * @google-cloud/firestore v7 **لا يوجد صنف Blob إطلاقاً** — القيم الثنائية تُقرأ
 * كـ Uint8Array. أي `instanceof FS.Blob` هنا كان سيسقط السكربت عند أول مستند.
 * الأنواع المدعومة: Timestamp · Date · GeoPoint · bytes (Uint8Array/Buffer) ·
 * DocumentReference · NaN/Infinity · الكائنات والمصفوفات المتداخلة.
 */
const UNKNOWN_TYPES = new Set();

function makeCodecs(admin) {
  const FS = admin.firestore || {};
  const Timestamp = FS.Timestamp;
  const GeoPoint = FS.GeoPoint;
  const Blob = FS.Blob; // قد تكون undefined حسب الإصدار — لا نفترضها
  const kindOf = (v) => (v && v.constructor && v.constructor.name) || '';
  const isInstance = (v, C) => !!C && (v instanceof C || kindOf(v) === C.name);

  const serialize = (value) => {
    if (value === undefined) return undefined; // يُسقط المفتاح — Firestore يفرّق بين «غير موجود» و«null»
    if (value === null) return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return { '@type': 'number', special: String(value) };
    if (value instanceof Date) {
      const ms = value.getTime();
      return { '@type': 'timestamp', seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
    }
    if (isInstance(value, Timestamp) || (kindOf(value) === 'Timestamp' && typeof value.seconds === 'number')) {
      return { '@type': 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
    }
    if (isInstance(value, GeoPoint) || kindOf(value) === 'GeoPoint') {
      return { '@type': 'geopoint', latitude: value.latitude, longitude: value.longitude };
    }
    if (Blob && value instanceof Blob) return { '@type': 'blob', base64: value.toBase64() };
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { '@type': 'bytes', base64: Buffer.from(value).toString('base64') };
    if (value && typeof value === 'object' && value.firestore && typeof value.path === 'string') return { '@type': 'ref', path: value.path };
    if (Array.isArray(value)) return value.map(serialize);
    if (typeof value === 'object') {
      const k = kindOf(value);
      if (k && k !== 'Object') UNKNOWN_TYPES.add(k); // صنف غير معروف: نحتفظ بمحتواه ونُنبّه بدل الصمت
      const out = {};
      for (const [key, v] of Object.entries(value)) { const sv = serialize(v); if (sv !== undefined) out[key] = sv; }
      return out;
    }
    return value;
  };

  const deserialize = (value) => {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.map(deserialize);
    if (typeof value === 'object' && value['@type']) {
      switch (value['@type']) {
        case 'number': return value.special === 'Infinity' ? Infinity : value.special === '-Infinity' ? -Infinity : NaN;
        case 'timestamp':
          if (!Timestamp) throw new Error('صنف Timestamp غير متوفر في firebase-admin المثبّت');
          return new Timestamp(value.seconds, value.nanoseconds);
        case 'geopoint':
          if (!GeoPoint) throw new Error('صنف GeoPoint غير متوفر في firebase-admin المثبّت');
          return new GeoPoint(value.latitude, value.longitude);
        case 'blob': return Blob ? Blob.fromBase64String(value.base64) : Buffer.from(value.base64, 'base64');
        case 'bytes': return Buffer.from(value.base64, 'base64'); // تُقبل كـ Uint8Array
        case 'ref': return admin.firestore().doc(value.path);
      }
    }
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = deserialize(v);
      return out;
    }
    return value;
  };
  return { serialize, deserialize };
}

/** مشي recursi­ve على مجموعة ومجموعاتها الفرعية، وكتابة كل مستند كسطر JSONL */
async function walkExport(admin, db, serialize, collectionPath, ws, stats) {
  const snap = await db.collection(collectionPath).get();
  for (const d of snap.docs) {
    ws.write(JSON.stringify({ path: d.ref.path, data: serialize(d.data()) }) + '\n');
    stats.docs++;
    const subs = await d.ref.listCollections();
    for (const s of subs) await walkExport(admin, db, serialize, `${d.ref.path}/${s.id}`, ws, stats);
  }
  stats.byPath[collectionPath] = snap.size;
}

const closeStream = (ws) => new Promise((r) => ws.end(r));

async function main() {
  if (!cmd || !['export', 'import', 'counts', 'indexes'].includes(cmd)) {
    const help = fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].split('\n').slice(1, -1).map((l) => l.replace(/^\s*\*?\s?/, '')).join('\n');
    console.log(help);
    process.exit(cmd ? 1 : 0);
  }

  const { admin, projectId } = loadAdmin();
  const db = admin.firestore();
  const codecs = makeCodecs(admin);
  console.log(`🔥 المشروع: ${projectId}${projectId === LEGACY_PROJECT ? '  ⚠️ (مشروع المنصة القديم)' : ''}`);

  if (needsLegacyOverride(cmd, projectId, has('yes'))) {
    console.error('🚫 ممنوع الاستيراد إلى مشروع المنصة القديم (قد يُحذف في مارس). حدّد FIREBASE_PROJECT_ID الجديد، أو أضف --yes إن كان مقصوداً.');
    process.exit(1);
  }

  if (cmd === 'counts') {
    for (const root of opt('only', DEFAULT_ROOTS).split(',')) {
      const name = root.trim();
      const top = (await db.collection(name).count().get()).data().count;
      console.log(`\n▸ ${name}: ${top} مستند جذري`);
      const snap = await db.collection(name).limit(25).get();
      for (const d of snap.docs) {
        const subs = await d.ref.listCollections();
        const parts = [];
        for (const s of subs) parts.push(`${s.id}=${(await db.collection(`${d.ref.path}/${s.id}`).count().get()).data().count}`);
        console.log(`   ${d.id}${parts.length ? '  · ' + parts.join(' · ') : ''}`);
      }
      if (snap.empty) console.log('   (فارغ)');
    }
    return;
  }

  if (cmd === 'indexes') {
    try {
      const out = execFileSync('firebase', ['firestore:indexes', '--project', projectId], { encoding: 'utf8', cwd: ROOT });
      const parsed = JSON.parse(out);
      const manual = (parsed.indexes || []).filter((i) => i.apiScope !== 'READ_WRITE' || i.queryScope === 'ANY');
      const file = {
        indexes: (parsed.indexes || []).map((i) => ({
          collectionGroup: i.collectionGroup,
          queryScope: i.queryScope || 'ANY',
          fields: (i.fields || []).map((f) => ({ fieldPath: f.fieldPath, order: f.order, arrayConfig: f.arrayConfig })),
        })),
        fieldOverrides: parsed.fieldOverrides || [],
      };
      fs.writeFileSync(path.join(ROOT, 'firestore.indexes.json'), JSON.stringify(file, null, 2) + '\n');
      console.log(`✅ ${file.indexes.length} فهرساً (${manual.length} منها يدوي) → firestore.indexes.json`);
    } catch (e) {
      console.error('❌ تعذّر التشغيل عبر Firebase CLI. ثبّته ثم أعد المحاولة:  npm i -g firebase-tools && firebase login');
      console.error('   أو يدوياً:  firebase firestore:indexes --project ' + projectId + ' > firestore.indexes.json');
      process.exit(1);
    }
    return;
  }

  if (cmd === 'export') {
    const roots = opt('only', DEFAULT_ROOTS).split(',').map((s) => s.trim());
    const stamp = new Date().toISOString().slice(0, 10);
    const dir = path.join(ROOT, 'backups', stamp);
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    let total = 0;

    for (const root of roots) {
      if (root === 'companies') {
        const comps = await db.collection('companies').get();
        console.log(`▸ companies: ${comps.size} منشأة`);
        for (const c of comps.docs) {
          const stats = { docs: 0, byPath: {} };
          const file = `companies__${c.id}.jsonl`;
          const ws = fs.createWriteStream(path.join(dir, file));
          await walkExport(admin, db, codecs.serialize, `companies/${c.id}`, ws, stats);
          await closeStream(ws);
          files.push({ file, docs: stats.docs, byPath: stats.byPath });
          total += stats.docs;
          console.log(`   ${c.id}: ${stats.docs} مستند`);
        }
      } else {
        const stats = { docs: 0, byPath: {} };
        const file = `${root}.jsonl`;
        const ws = fs.createWriteStream(path.join(dir, file));
        await walkExport(admin, db, codecs.serialize, root, ws, stats);
        await closeStream(ws);
        files.push({ file, docs: stats.docs, byPath: stats.byPath });
        total += stats.docs;
        console.log(`▸ ${root}: ${stats.docs} مستند`);
      }
    }

    const manifest = {
      sourceProject: projectId,
      exportedAt: new Date().toISOString(),
      totalDocs: total,
      files,
      note: 'كل سطر = {path, data}. الاستيراد يحافظ على المعرّفات. مصاديق Timestamp/GeoPoint/Blob مشفّرة بحقول @type.',
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const kb = (fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) / 1024).toFixed(0);
    console.log(`\n✅ ${total} مستند · ${kb} KB · ${path.relative(ROOT, dir)}/`);
    console.log('   ⚠️ انسخ هذا المجلد الآن إلى خارج مساحة العمل (Google Drive / مستودع خاص / قرص محلي).');
    return;
  }

  if (cmd === 'import') {
    const dirArg = argv.find((a, i) => i > 0 && !a.startsWith('--'));
    if (!dirArg) { console.error('❌ حدّد مجلد النسخة: node scripts/db-transfer.js import backups/2026-11-07'); process.exit(1); }
    const abs = path.resolve(ROOT, dirArg);
    const manifest = JSON.parse(fs.readFileSync(path.join(abs, 'manifest.json'), 'utf8'));
    const dry = has('dry-run');
    console.log(`📦 المصدر: ${manifest.sourceProject} · ${manifest.totalDocs} مستند · ${manifest.files.length} ملف${dry ? ' · (محاكاة)' : ''}`);

    let batch = db.batch();
    let pending = 0, done = 0;
    for (const entry of manifest.files) {
      const f = typeof entry === 'string' ? entry : entry.file;
      const lines = fs.readFileSync(path.join(abs, f), 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        const rec = JSON.parse(line);
        if (dry) { done++; continue; }
        batch.set(db.doc(rec.path), codecs.deserialize(rec.data), { merge: true });
        done++; pending++;
        if (pending === 450) { await batch.commit(); batch = db.batch(); pending = 0; process.stdout.write(`\r   ${done}/${manifest.totalDocs}…`); }
      }
      console.log(`   ✓ ${f}: ${lines.length} سطر`);
    }
    if (!dry && pending) await batch.commit();
    console.log(`\n✅ ${dry ? 'تحقّق' : 'استيراد'} ${done} مستند → ${projectId}`);
    console.log('   الخطوة التالية: node scripts/db-transfer.js counts  (قارن بالأعداد قبل النقل)');
    console.log('   ولا تنسَ: firebase auth:export/import + نشر القواعد npm run deploy:rules');
    return;
  }
}

module.exports = { parseArgs, needsLegacyOverride, makeCodecs, walkExport, UNKNOWN_TYPES, LEGACY_PROJECT, DEFAULT_ROOTS };

if (require.main === module) {
  main().catch((e) => { console.error('❌ فشل:', e.message); if (process.env.DEBUG) console.error(e.stack); process.exit(1); });
}
