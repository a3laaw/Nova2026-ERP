#!/usr/bin/env node
/**
 * اختبارات ذاتية بلا شبكة ولا اعتماديات خارجية — `npm run selftest`
 *
 * الهدف: ما يخصّ النقل (تحويل الأنواع، المشي على المجموعات الفرعية، وسائط الأمر،
 * حارس المشروع المحتضَر) يعمل فعلياً، لا نظرياً. كل فحص هنا يستدعي كود
 * `scripts/db-transfer.js` الحقيقي.
 *
 * الاستخدام: node scripts/selftest.js   (خروج 0 = نجح كل شيء، 1 = هناك انكسار)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable } = require('stream');

const ROOT = path.join(__dirname, '..');

const { parseArgs, needsLegacyOverride, makeCodecs, walkExport, UNKNOWN_TYPES, LEGACY_PROJECT } =
  require(path.join(ROOT, 'scripts', 'db-transfer.js'));

let pass = 0;
const fails = [];
function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') throw new Error('استخدم testAsync للأوامر غير المتزامنة');
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    fails.push(`${name} — ${e.message}`);
    console.log(`  ❌ ${name}\n       ${e.message.split('\n')[0]}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    fails.push(`${name} — ${e.message}`);
    console.log(`  ❌ ${name}\n       ${e.message.split('\n')[0]}`);
  }
}

// ---------- أدوات محاكاة Firestore ----------
// نفس الأصناف الحقيقية التي يراها السكربت في التشغيل الفعلي (بدون شبكة).
function realClasses() {
  const candidates = ['@google-cloud/firestore', 'firebase-admin/firestore'];
  for (const m of candidates) {
    try {
      const mod = require(m);
      if (mod.Timestamp && mod.GeoPoint) return mod;
    } catch (e) { /* متابعة المصدر التالي */ }
  }
  return null;
}

const GCF = realClasses();
const Timestamp = GCF && GCF.Timestamp;
const GeoPoint = GCF && GCF.GeoPoint;

// إن غاب الحزمة (بيئة بلا node_modules) نستخدم بدائل تكفي لاختبار المنطق النصي.
const Shim = {
  Timestamp: class Timestamp {
    constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
    toDate() { return new Date(this.seconds * 1000 + this.nanoseconds / 1e6); }
  },
  GeoPoint: class GeoPoint {
    constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; }
  },
};
const TS = Timestamp || Shim.Timestamp;
const GP = GeoPoint || Shim.GeoPoint;

/** admin وهمي بنفس شكل الحقيقي: `admin.firestore` دالة تحمل الأصناف. */
function fakeAdmin() {
  const ns = function firestore() {
    return { doc: (p) => ({ path: p, firestore: true }) };
  };
  ns.Timestamp = TS;
  ns.GeoPoint = GP;
  return { firestore: ns };
}

async function main() {
// ---------- 1) تحويل الأنواع ----------
console.log('\n▸ محوّل الأنواع (serialize / deserialize)');
const { serialize, deserialize } = makeCodecs(fakeAdmin());

test('Timestamp ←→ JSON (ثوانٍ + نانوثانية)', () => {
  const t = new TS(1730000000, 123456789);
  const back = deserialize(serialize(t));
  assert.strictEqual(back.seconds, 1730000000);
  assert.strictEqual(back.nanoseconds, 123456789);
});

test('GeoPoint ←→ JSON', () => {
  const back = deserialize(serialize(new GP(29.9913, 31.2477)));
  assert.strictEqual(back.latitude, 29.9913);
  assert.strictEqual(back.longitude, 31.2477);
});

test('bytes (Uint8Array) ←→ base64 — لا Blob في firebase-admin v13', () => {
  const raw = new Uint8Array([0, 1, 255, 128, 7]);
  const json = serialize(raw);
  assert.strictEqual(json['@type'], 'bytes');
  const back = deserialize(json);
  assert.ok(Buffer.compare(Buffer.from(raw), Buffer.from(back)) === 0, 'البايتلات تغيّرت');
});

test('NaN / Infinity لا تتحول null بصمت', () => {
  assert.ok(Number.isNaN(deserialize(serialize(NaN))));
  assert.strictEqual(deserialize(serialize(Infinity)), Infinity);
  assert.strictEqual(deserialize(serialize(-Infinity)), -Infinity);
});

test('Date ←→ timestamp', () => {
  const d = new Date('2026-03-01T12:34:56.789Z');
  const back = deserialize(serialize(d));
  const ms = back.toDate ? back.toDate().getTime() : back.seconds * 1000 + back.nanoseconds / 1e6;
  assert.strictEqual(new Date(ms).toISOString(), d.toISOString());
});

test('DocumentReference ←→ مسار', () => {
  const ref = { path: 'companies/c1/journals/j1', firestore: true };
  const json = serialize(ref);
  assert.strictEqual(json['@type'], 'ref');
  assert.strictEqual(deserialize(json).path, 'companies/c1/journals/j1');
});

test('وثيقة قيد يومية واقعية بالعربي: round-trip كامل', () => {
  const doc = {
    description: 'قيد يومية — صندوق المشروع',
    company: 'شركة ألف للمقاولات',
    date: new TS(1730000000, 0),
    totalDebit: '1205.500',
    lines: [
      { accountCode: '1101', debit: 1205.5, credit: 0, notes: 'دفعة نقدية' },
      { accountCode: '4101', debit: 0, credit: 1205.5, notes: 'إيراد مقاولات' },
    ],
    site: new GP(29.3754, 47.9773),
    attachmentBytes: new Uint8Array([137, 80, 78, 71]),
    attachments: [{ path: 'companies/c1/attachments/att_1', firestore: true }],
    isPosted: true,
    reversalId: null,
  };
  const json = JSON.parse(JSON.stringify(serialize(doc)));
  const back = deserialize(json);
  assert.strictEqual(back.description, doc.description);
  assert.strictEqual(back.lines.length, 2);
  assert.strictEqual(back.lines[1].accountCode, '4101');
  assert.strictEqual(String(back.lines[0].credit), '0');
  assert.strictEqual(back.date.seconds, 1730000000);
  assert.strictEqual(back.site.latitude, 29.3754);
  assert.strictEqual(back.reversalId, null);
  assert.strictEqual(back.isPosted, true);
  assert.ok(Buffer.compare(Buffer.from(doc.attachmentBytes), Buffer.from(back.attachmentBytes)) === 0);
  // توازن القيد يجب أن يبقى صحيحاً بعد المرور بـ JSON (this is the money invariant)
  const sum = (k) => back.lines.reduce((a, l) => a + l[k], 0);
  assert.ok(Math.abs(sum('debit') - sum('credit')) < 1e-9, 'توازن القيد انكسر بعد النقل!');
});

test('حقل بحقل undefined لا ينشئ مفتاحاً كاذباً', () => {
  const json = serialize({ a: 1, b: undefined });
  assert.ok(!('b' in json), 'undefined تسرّبت إلى المخرجات');
  assert.strictEqual(json.a, 1);
});

test('مصفوفة متداخلة داخل كائن داخل مصفوفة', () => {
  const src = { matrix: [[{ v: new TS(1, 2) }, { v: null }], []] };
  const back = deserialize(JSON.parse(JSON.stringify(serialize(src))));
  assert.strictEqual(back.matrix[0][0].v.seconds, 1);
  assert.strictEqual(back.matrix[0][1].v, null);
  assert.strictEqual(back.matrix[1].length, 0);
});

// ---------- 2) المشي على المجموعات الفرعية ----------
console.log('\n▸ تصدير متقاطع للمجموعات الفرعية (walkExport)');

  function fakeDb(tree) {
  return {
    collection(colPath) {
      const parts = colPath.split('/');
      let level = tree;
      for (let i = 0; i < parts.length; i += 2) {
        const coll = level[parts[i]];
        if (!coll) return { get: async () => ({ docs: [], size: 0 }) };
        let docs = coll;
        const id = parts[i + 1];
        if (id === undefined) {
          const self = docs;
          return {
            get: async () => ({
              size: self.length,
              docs: self.map((d) => ({
                id: d.id,
                data: () => d.data,
                ref: {
                  path: colPath + '/' + d.id,
                  listCollections: async () => Object.keys(d.subs || {}).map((k) => ({ id: k })),
                },
              })),
            }),
          };
        }
        const found = docs.find((d) => d.id === id);
        if (!found) return { get: async () => ({ docs: [], size: 0 }) };
        level = found.subs || {};
      }
      return { get: async () => ({ docs: [], size: 0 }) };
    },
  };
}

const TREE = {
  companies: [
    {
      id: 'c1',
      data: { name: 'شركة ألف' },
      subs: {
        journals: [
          { id: 'j1', data: { debit: 100 }, subs: {} },
          { id: 'j2', data: { credit: 100 }, subs: {} },
        ],
        projects: [
          {
            id: 'p1',
            data: { title: 'عمارة إدارية' },
            subs: { stages: [{ id: 's1', data: { progress: 0.5 }, subs: { executions: [{ id: 'e1', data: { qty: 12 }, subs: {} }] } }] },
          },
        ],
      },
    },
    { id: 'c2', data: { name: 'شركة باء' }, subs: {} },
  ],
};

async function runWalkTests() {
  const lines = [];
  const ws = new Writable({ write(c, e, cb) { lines.push(c.toString()); cb(); } });
  const stats = { docs: 0, byPath: {} };
  const db = fakeDb(TREE);
  const codecs = makeCodecs(fakeAdmin());
  try {
    await walkExport(fakeAdmin(), db, codecs.serialize, 'companies', ws, stats);
  } catch (e) {
    fails.push(`walkExport — ${e.message}`);
    console.log(`  ❌ walkExport يعمل على مجموعة متداخلة\n       ${e.message.split('\n')[0]}`);
  }
  test('كل المستندات (الجذر + 4 مستويات فرعية) خرجت', () => {
    // c1, j1, j2, p1, s1, e1, c2 = 7
    assert.strictEqual(stats.docs, 7, `العدد = ${stats.docs} والمتوقع 7`);
  });
  test('المسارات مكتوبة كاملة وقابلة للاستيراد بـ setDoc(path)', () => {
    const paths = lines.map((l) => JSON.parse(l).path).sort();
    assert.deepStrictEqual(paths, [
      'companies/c1',
      'companies/c1/journals/j1',
      'companies/c1/journals/j2',
      'companies/c1/projects/p1',
      'companies/c1/projects/p1/stages/s1',
      'companies/c1/projects/p1/stages/s1/executions/e1',
      'companies/c2',
    ]);
  });
  test('عدّاد كل مجموعة مسجّل في manifest', () => {
    assert.strictEqual(stats.byPath['companies'], 2);
    assert.strictEqual(stats.byPath['companies/c1/journals'], 2);
    assert.strictEqual(stats.byPath['companies/c1/projects/p1/stages/s1/executions'], 1);
  });
  test('المعرّف الأصلي محفوظ في المسار (cc_/pc_/counters تعتمد عليه)', () => {
    const e1 = lines.map(JSON.parse).find((l) => l.path.endsWith('/executions/e1'));
    assert.strictEqual(e1.path.split('/').pop(), 'e1');
    assert.strictEqual(e1.data.qty, 12);
  });
}

  await runWalkTests().catch((e) => { fails.push('walkExport — ' + e.message); console.log('  ❌ walkExport: ' + e.message.split('\n')[0]); });

// ---------- 3) وسائط الأمر ----------
console.log('\n▸ تحليل وسائط الأمر وحارس المشروع المحتضَر');
test('`--flag` بدون قيمة + `--key=value` + `--key value`', () => {
  const { cmd, has, opt } = parseArgs(['export', '--dry-run', '--only=companies,global_users', '--company', 'c1']);
  assert.strictEqual(cmd, 'export');
  assert.strictEqual(has('dry-run'), true);
  assert.strictEqual(has('yes'), false);
  assert.strictEqual(opt('only', 'x'), 'companies,global_users');
  assert.strictEqual(opt('company', null), 'c1');
  assert.strictEqual(opt('missing', 'dflt'), 'dflt');
});
test('مسار الملف بعد `import` لا يُبلع كقيمة وسيط', () => {
  const { cmd, opt } = parseArgs(['import', 'backups/2026-11-07']);
  assert.strictEqual(cmd, 'import');
  assert.strictEqual(opt('out', undefined), undefined);
});
test('الحارس: استيراد للمشروع القديم ممنوع بغير --yes', () => {
  assert.strictEqual(needsLegacyOverride('import', LEGACY_PROJECT, false), true);
  assert.strictEqual(needsLegacyOverride('import', LEGACY_PROJECT, true), false);
  assert.strictEqual(needsLegacyOverride('import', 'my-new-project', false), false);
  assert.strictEqual(needsLegacyOverride('export', LEGACY_PROJECT, false), false, 'التصدير من المشروع القديم واجب لا ممنوع');
});

// ---------- 4) تحذير الأصناف المجهولة ----------
console.log('\n▸ الشفافية: صنف غير معروف لا يمر بصمت');
test('صنف خارج قائمة المدعوم يسجّل تحذيراً', () => {
  UNKNOWN_TYPES.clear();
  class FieldValueLike { constructor() { this.foo = 1; } }
  serialize(new FieldValueLike());
  assert.ok(UNKNOWN_TYPES.has('FieldValueLike'), 'لم يُسجَّل الصنف المجهول');
  UNKNOWN_TYPES.clear();
});

// ---------- 5) فحص البيئة عند غيبة الحزم ----------
console.log('\n▸ سلوك السكربت بلا اعتماديات/بيانات (فشل نظيف لا انهيار)');
test('`counts` بدون حساب خدمة → رسالة واضحة وخروج 1', () => {
  const res = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'db-transfer.js'), 'counts'], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: '', FIREBASE_PROJECT_ID: '', NEXT_PUBLIC_FIREBASE_PROJECT_ID: '' },
  });
  assert.strictEqual(res.status, 1, `status=${res.status}`);
  assert.ok(/حساب الخدمة|firebase-admin/.test(res.stderr + res.stdout), 'لا رسالة إرشادية: ' + (res.stderr || res.stdout).slice(0, 120));
  assert.ok(!/TypeError|at Object\.|undefined/.test(res.stderr), 'انهيار غير مُعالَج: ' + res.stderr.slice(0, 200));
});

test('الحزم الحقيقية مثبتة؟ (معلومات)', () => {
  console.log(`       ${GCF ? '✅ @google-cloud/firestore متاح — الأصناف حقيقية' : '⚠️  الحزم غير مثبتة — استُخدمت بدائل لاختبار المنطق'}`);
});

// ---------- الخلاصة ----------
console.log('\n' + '─'.repeat(58));
if (fails.length) {
  console.log(`❌ ${fails.length} فحص فشل (ونجح ${pass}):`);
  fails.forEach((f) => console.log('   • ' + f));
  process.exit(1);
}
console.log(`✅ كل الفحوص نجحت (${pass}). أدوات النقل صالحة للاستخدام قبل ليلة النقل.`);
console.log('   ملاحظة: هذا لا يغطي الاتصال الفعلي بـ Firestore — لذلك ابدأ بـ npm run db:counts.');
}

main().catch((e) => { console.error('❌ fatal:', e.message); process.exit(1); });
