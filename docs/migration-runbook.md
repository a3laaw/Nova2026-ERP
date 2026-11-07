# دليل النقل — الخروج من منصة أُغلقت قبل مارس 🚚

> **الخطر الحقيقي ليس على كودك** (مستودع GitHub آمن، ورفعتُ عليه كل ما يخصّ النموذج) —
> **الخطر على ثلاثة أشياء ليست في Git: بيانات Firestore، مستخدمو المصادقة، وملفات `.env`/المفاتيح.**
> هذه الوثيقة هي خطة العمل مرتّبة حسب الأثر، مع أوامر جاهزة.

---

## 0. حدّد أولاً: ما الذي سيموت بالضبط؟ (3 طبقات منفصلة)

| الطبقة | محتواها | مصيرها عند إغلاق المنصة | كيف تتأكد في 10 دقائق |
| :--- | :--- | :--- | :--- |
| **١. بيئة التطوير** | مساحة العمل، `node_modules`، **`.env`**، `.idx/dev.nix`، المنافذ، معاينات | **تموت معها قطعياً** | افتح مساحة العمل وشغّل `cat .env*` — إن اختفت المساحة اختفت المفاتيح |
| **٢. مشروع Firebase** `studio-2485061478-24bde` | Firestore (بياناتك الفعلية)، Auth (كلمات سر المستخدمين)، Storage، App Hosting | **يعتمد على الملكية** | `console.firebase.google.com/project-lists` + `gcloud projects list` — هل المشروع باسمك؟ هل تستطيع ربط Billing account؟ |
| **٣. المستودع** | الكود، `firestore.rules`، `docs/`، `scripts/` | **آمن** (GitHub) | `git log` ✓ |

**القرار يتفرع من الطبقة ٢:**
- **الحالة (أ) — المشروع مملوك لك**: الخسارة محدودة. تنشئ بيئة تطوير جديدة، وتُبقي نفس المشروع (أو تنقل البيانات مشروعاً إلى مشروع). يوم إلى ثلاثة.
- **الحالة (ب) — المشروع مُدار من برنامج المنصة** (لا يظهر في قائمتك، أو لا تتحكم بالـ billing): **نقل كامل إلزامي**، والعدّاد يعمل. بياناتك في مشروع قد يُحذف مع المنصة.

> **اختبار قاطع للملكية**: افتح المشروع في الكونسول → Settings → Resources → حاول «unlink/relink billing account». لو الزر معطّل أو الرسالة «managed by your organization/program» ⇒ أنت في الحالة (ب).

---

## 1. الخطوة صفر — اعملها الليلة (قبل أي قرار، ~45 دقيقة)

كل بند مما يلي **ليس في Git** وسيضيع مع المنصة:

| # | ما تخرجه | الأمر / الطريقة | لماذا هو عاجل |
| :-- | :--- | :--- | :--- |
| 1 | ملفات البيئة والمفاتيح | `cat .env .env.local` → انسخها في مدير كلمات سر | `GOOGLE_GENAI_API_KEY` ومفاتيح أي تكامل تعيش هنا فقط (`.env*` مستثناة من Git بحكم `.gitignore`) |
| 2 | إعدادات تطبيق الويب | الكونسول → Project settings → Your apps → Web config | بدونها لا يمكن ربط مشروع جديد |
| 3 | **الفهارس** | `npm run db:indexes` → يُحدَّث `firestore.indexes.json` | الفهارس كانت معرّفة داخل المشروع فقط؛ فقدناها = كل `where+orderBy` يسقط بعد النقل |
| 4 | **المستخدمون** | `firebase auth:export users.csv` | كلمات السر لا تُصدَّر إلا بهذه الطريقة، ومن Firebase إلى Firebase فقط |
| 5 | **البيانات** | `npm run db:export` (أو الكونسول → Firestore → Export Data) | إن صار المشروع read-only فجأة، لا تستطيع أن تقول «سأصدرها غداً» |
| 6 | مرفقات Storage (صور الزيارات/العقود) | `gsutil -m cp -r gs://<bucket> ./storage-backup` | الكود يخزّن `photoUrls`؛ تحقق من وجودها قبل أن تفقد الصور |
| 7 | مفاتيح حساب الخدمة / الدومين / Webhooks / التنبيهات | من الكونسول وCloud Console | DNS والـ SSL غالباً مرتبطان بمشروع الاستضافة |
| 8 | `firestore.rules` المنشورة فعلاً | قارن `firestore.rules` في Git بما في الكونسول | لا يوجد `firebase.json` قبل اليوم ⇒ القواعد كانت تُعدَّل يدوياً، والنسخة المنشورة قد تختلف عن النسخة في المستودع |

تحقّق من الحجم أولاً حتى تعرف إن كان التصدير سينجح:

```bash
npm i -D firebase-admin
export FIREBASE_PROJECT_ID=studio-2485061478-24bde
export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
npm run db:counts        # جرد: كم مستند في كل منشأة وكل مجموعة فرعية
npm run db:export        # ← backups/2026-11-XX/  (انسخه خارج المنصة فوراً)
```

---

## 2. قرار الوجهة — المقارنة الصادقة

| الخيار | الوصف | زمن النقل | ما ينكسر | ما يبقى كما هو |درجة التوصية |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | **مشروع Firebase تملكه** + استضافة أمامية (Vercel / Cloud Run / Firebase App Hosting على مشروعك) | **1–3 أيام** | لا شيء جوهري: القواعد، المجموعات، الأنواع، الخدمات، الاختبارات كلها تعمل | **كل شيء** (76 مجموعة، 132 علاقة، قواعد الأمان، `paths`، كل الخدمات) | ⭐⭐⭐⭐⭐ |
| **B** | **Supabase** (Postgres + RLS + Auth + Storage) | 2–5 أسابيع | إعادة نمذجة كاملة: 76 مجموعة → ~76 جدولاً، `increment` → `UPDATE … SET x = x + 1`، الأشجار → `ltree/parent_id`، القواعد → RLS policies، `counter` → `sequence` | `src/types/*.ts` (مع تحويل بسيط)، الـ UI ~90%، كل منطق الحسابات (gratuity/retention/WIP) قابل للنقل كما هو، و**`docs/relations.json` يعيد توليد الـ schema** | ⭐⭐⭐ (فقط إن كان السبب تجارياً: تحتاج SQL، تقارير ثقيلة، أو تريد تجنّب Firestore) |
| **C** | **استضافة ذاتية** (Node/Postgres/S3/Docker) | 6–10 أسابيع | كما B + DevOps/نسخ احتياطي/شهادات عليك وحدك | — | ⭐ (فريقك الحالي شخص + وكلاء؛ هذا خيار انتحاري تشغيلياً) |

### سببان حاسمان للبقاء على Firebase الآن

1. **كلمات السر**: `firebase auth:export` يعطيك `passwordHash + salt + signerKey + memoryCost + rounds` بصيغة SCRYPT، و`auth:import --hash-algorithm=SCRYPT` يستوردها **إلى مشروع Firebase آخر فقط**. أي انتقال إلى Postgres/Supabase ⇒ **كل المستخدمين يعيدون تعيين كلمة السر** (بريد جماعي، تذمّر، ودعم).
2. **معرّفات المستندات الحتمية**: الأتمتة المالية عندك مبنية على docId مشتق (`cc_{transactionId}`، `pc_{transactionId}`، وحسابات `referenceId=clientId/transactionId`، و`counters/{key}`). أي إعادة كتابة IDs أثناء النقل **تكسر** مطابقة الأبعاد والتحليلات. سكربت `db-transfer.js` الذي أضفناه يكتب بـ `setDoc(docPath)` بالمسار الأصلي تحديداً لهذه الغاية.

**وحتى في الخيار B، الخريطة التي بنيناها هي ما يجعل النقل ممكناً**: `docs/relations.json` + `relations.generated.json` (132 علاقة) تتحوّل إلى مولّد `CREATE TABLE` — وهذا موضوع §6.

---

## 3. خطة النقل (الخيار A) — 7 مراحل، كل واحدة قابلة للتحقق

### المرحلة 1 · مشروع Firebase جديد (15 دقيقة)
1. `console.firebase.google.com` → Add project (اسم إنتاجي مثل `novaflow-erp`، **لا تسمّه باسم منصة**).
2. Firestore Database → **اختر المنطقة ولا تغيّرها لاحقاً**: لعملائك في الخليج `me-west1` (Belgium `europe-west1` هو الأقوى توفراً؛ `us-central` أبعد) — قرّر بناءً على مكان عملائك وقيّد نفسك بتوثيق القرار.
3. Authentication → Sign-in method → Email/Password مفعّل (كما في المشروع الحالي).
4. Add app → Web app → انسخ الـ config (لا تلصقه في الكود — اذهب للمرحلة 2).
5. ربط Billing (Blaze) — المشروع المجاني Spark **لا يكفي**: قواعد `get()`/`exists()` في `firestore.rules` وCollection Group queries تحتاج Blaze؟ (القواعد تعمل على Spark، لكن التصدير/الاستيراد الضخم وApp Hosting يحتاجان Blaze).

### المرحلة 2 · ربط المستودع بالمشروع الجديد
```bash
# .firebaserc
{ "projects": { "default": "novaflow-erp" } }

# .env.local  (من .env.example)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=novaflow-erp
NEXT_PUBLIC_FIREBASE_API_KEY=...
# ...بقية المفاتيح
GOOGLE_GENAI_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```
الكود **لا يحتاج أي تعديل**: `src/firebase/config.ts` صار يقرأ من البيئة (عدّلته اليوم)، و`firebaseConfig.projectId` هو المصدر الوحيد.

### المرحلة 3 · الفهارس والقواعد أولاً (قبل البيانات)
```bash
npm run deploy:config      # firestore.rules + firestore.indexes.json
```
- ضع محتوى `firestore.indexes.json` المستخرَج في الخطوة 0.
- **فرصة مؤجلة يجب اقتناصها الآن**: أزل ثغرة `global_users` (انظر §5) قبل أن تستورد بيانات حقيقية — النقل هو التبرير المثالي لتقعيد القواعد.

### المرحلة 4 · البيانات
```bash
FIREBASE_PROJECT_ID=novaflow-erp npm run db:import -- backups/2026-11-XX
FIREBASE_PROJECT_ID=novaflow-erp npm run db:import -- backups/2026-11-XX --dry-run   # قبلها
npm run db:counts   # في المشروعين: القارن رقم `totalDocs` وcounts لكل منشأة
```
المتطلبات: `setDoc` بنفس المسار (✓ في السكربت)، batches ≤ 500 (نستخدم 450 ✓)، أنواع خاصة مُحاوَلة (Timestamp/GeoPoint/Blob ✓).

### المرحلة 5 · المستخدمون
```bash
firebase auth:export users.csv --project studio-2485061478-24bde
firebase auth:import users.csv --hash-algorithm=SCRYPT --project novaflow-erp
```
تحقّق: عدد الصفوف في `users.csv` = عدد مستندات `global_users` في المشروع الجديد. بما أن `global_users/{uid}` يستخدم الـ uid كمعرّف مستند، و`auth:import` يحافظ على `localId` ⇒ كل الروابط (employeeId/roleId/companyId) تبقى صحيحة تلقائياً.

### المرحلة 6 · الاستضافة والأمام
| المنصة | ما تفعله | ملاحظات |
| :--- | :--- | :--- |
| **Vercel** (الأسرع) | اربط المستودع ← اضبط `NEXT_PUBLIC_*` + `GOOGLE_GENAI_API_KEY` في Environment Variables ← Deploy | لا يحتاج `hosting.json`؛ Next.js native؛ اربط الدومين وSSL آلي |
| **Firebase App Hosting** | `firebase apphosting:novaflow create` ثم اربط GitHub؛ انسخ `apphosting.yaml` وأضف بلوك `env` بنفس المتغيرات | يبقى كل شيء في Google Cloud — أبسط للفوترة والدعم |
| **Cloud Run + Docker** | Dockerfile بسيط (node:22، `npm run build`، `next start -p $PORT`) + `--allow-unauthenticated` | أعطاك تحكماً، عليك buildpacks/images |

**⚠️ قبل أول Deploy على المنصة الجديدة**: `next.config.ts` فيه `typescript.ignoreBuildErrors: true` و`eslint.ignoreDuringBuilds: true`. كانت المنصة القديمة تتسامح؛ الآن البناء سينجح **و يخفي** أي أخطاء أنواع. اجعل أول build حقيقي لك: `npm run build` محلياً بلا flag، أو `npx tsc --noEmit` (الأمر موجود: `npm run typecheck`) ثم أزل الاستثناءات.

### المرحلة 7 · بيئة التطوير والوكلاء (نفسها)
- احذف/استبدل `.idx/dev.nix` بـ `.devcontainer/devcontainer.yml` (node:22 + `npm i` + `firebase emulators:start`) — فيصبح أي محرر (Cursor، Claude Code، VS Code remote) قادراً على تشغيل نفس البيئة بلا منصة.
- القواعد انتقلت من `GEMINI.md` إلى **`AGENTS.md`** (يقرأه أي وكيل؛ `GEMINI.md` صار مؤشراً له فقط) — فلا تفقد «دستور المشروع» مع المنصة.
- `npm run emulator` الآن يعمل من المستودع (`firebase.json` + `firestore.indexes.json` أُضيفا اليوم) بدل الاعتماد على محاكي المنصة.
- أضف GitHub Actions يشغّل `typecheck + check:relations + tests` — لا ثقة بدون CI (المنصة كانت تؤدّي هذا ضمنيّاً).

---

## 4. قائمة تحقق «تم النقل فعلاً» (لا تنتقل قبل إكمالها)

- [ ] `db:counts`: عدد المستندات متطابق في المشروعين لكل منشأة (وثّق الرقم).
- [ ] تسجيل دخول بمستخدم **قديم** وبكلمة سره القديمة بدون إعادة تعيين.
- [ ] الأدمن يرى `companies/{c}/…` كلها؛ مستخدم عادي **لا يرى** منشأة أخرى (جرّب بـ token من شركة أخرى).
- [ ] شاشة المشاريع تعرض نفس المعاملات، وشاشة المقايسة تعرض نفس العدّادات الست.
- [ ] قيد يدوي غير متوازن يُرفض (`القيد غير متوازن` من `AccountingService`) — دليل أن الخدمات تعمل على المشروع الجديد.
- [ ] إنشاء عميل جديد يأخذ `fileNumber` التالي **بدون تعارض** (`counters` نُقلت؛ لو نسخت `counters` خطأ ستبدأ أرقامك بالتصادم مع أرقام قديمة → هذا من أخطر الأخطاء الصامتة).
- [ ] مستخلص IPC يدوي: `retention` = 5% من `totalAmount` كما في العقد المنقول.
- [ ] صورة/مرفق واحد يفتح من الرابط الجديد (Storage bucket تغيّر ⇒ الروابط القديمة تحتاج إعادة كتابة أو bucket موحّد).
- [ ] `npm run check:relations` ✅ و`npm run typecheck` ✅ على الفرع الجديد.
- [ ] المشروع القديم read-only لمدة أسبوعين قبل حذفه (ولا تحذفه في يوم الانتقال).

---

## 5. ثغرة يجب إغلاقها **أثناء** النقل (سطران، وحان وقتها)

```
match /global_users/{uid} {
  // ❌ الحالي: أي مستخدم يرفع roleCode إلى ADMIN لنفسه، أو يغيّر companyId ويقفز لمستأجر آخر
  allow update: if isAuthenticated() && (request.auth.uid == uid || isGlobalAdmin());

  // ✅ المطلوب: منع تعديل حقول الهوية الحساسة ذاتياً
  allow update: if isAuthenticated() && (
    isSovereignDev() ||
    (request.auth.uid == uid
      && request.resource.data.roleCode == resource.data.roleCode
      && request.resource.data.role == resource.data.role
      && request.resource.data.companyId == resource.data.companyId)
  );
}
```
وبما أنك ستنشر القواعد من المستودع (`npm run deploy:rules`) بدلاً من الكونسول، فهذا الإصلاح **يصبح حقيقياً وقابلاً للمراجعة** لأول مرة.

---

## 6. إن اخترت B (Postgres/Supabase) — المسار الأقصر

الخريطة التي بنيناها تجعل هذا ممكناً بدل أن يكون مغامرة. الترتيب المقترح:

1. توليد `schema.sql` من `docs/relations.generated.json` (المسارات + 132 علاقة): كل مجموعة → جدول، `companyId` → `tenant_id uuid not null references companies(id) on delete cascade`، كل `xxxId` → FK، `parentId/ancestorIds` → `parent_id` + عمود `path ltree`.
2. `subcollections` حقيقية (`stageInstances`, `timeline`, `comments`, `items`, `auditLogs`, `records`) → جداول بعلاقات `on delete cascade`؛ والباقي → `jsonb` للعمود المرن مع `GIN` index حيث يلزم.
3. `counters` → `sequence` لكل (tenant, key) — يختفي سباق `writeBatch` وتصبح الأرقام مضمونة.
4. `increment` على العدّادات → `trigger AFTER INSERT ON executions` يحدّث `boq_items.executed_quantity` (نفس الدلالة، لكن **في القاعدة** لا في المتصفح — ينفّض 70% من دين الاستمرارية).
5. `firestore.rules` → Supabase RLS policy واحدة عامة: `tenant_id = (select auth.jwt()->>'tenantId')` + سياسات أدوار مولّدة من `roles.matrix`.
6. اترك `src/types/*.ts` كما هو وأضف طبقة ترجمة (`Row ↔ Domain`) — 90% من 48 ألف سطر لا يلمسه النقل.
7. **لا تفعل هذا بلا اختبارات**: بعد كل جدول، اختبار integrity (FK + unique + counter consistency) قبل الانتقال للتالي.

وإن أردت هذا الخيار، أقترح أن نبدأ بمولّد `schema.sql` من الخريطة (يوم عمل واحد بوساطة) بدل «إعادة كتابة النظام».

---

## 7. جدول زمني حتى مارس (~17 أسبوعاً)

| الأسبوع | الهدف | مخرَج ملموس |
| :--- | :--- | :--- |
| 1 (الآن) | الإخراج + تقرير الملكية + القرار | `.env` وusers.csv وindexes وbackups/ في مكان آمن؛ قرار A/B |
| 2 | مشروع جديد + قواعد + فهارس + نقل تجريبي لبيانات منشأة واحدة | `db:counts` مطابق لمنشأة واحدة |
| 3 | نقل كامل + المستخدمون + استضافة + دومين | موقع حيّ على المنصة الجديدة |
| 4 | إغلاق الثغرات الثلاث + `typecheck` نظيف + اختبارات المعادلات | rules tests + 4 اختبارات حسابية |
| 5–8 | تشغيل توأم (التسجيلات على الجديد، قراءة من القديم) أو read-only على القديم | لا اعتماد على منصة ميتة |
| قبل الحذف بأسبوعين | تصدير أخير + توقيع قائمة التحقق §4 | أرشيف نهائي في مكانين |

---

## 8. إن صارت المنصة read-only أو اختفت قبل أن تكمل

1. **الكود آمن**: `git clone` من GitHub (عليه كل الوثائق والأدوات).
2. **البيانات**: إن تعذّر `db:export`، اعمل Export من كونسول Firebase إلى Cloud Storage (إن كان الوصول للكونسول متاح) — هذه الطريقة لا تمر بالمنصة.
3. **إن فُقد كل شيء**: لا يمكن استرجاع Firestore؛ لكن خريطة النموذج (`docs/relations.json` + `default-coa.ts` + `seed-data.ts`) تسمح بإعادة بناء **الهيكل والمرجعيات** في ساعة، وخسارة البيانات هي خسارة سجلات العملاء — ولهذا البند رقم 5 في §1 هو الأهم في هذه الوثيقة كلها.

---

## 9. قرارات تحتاجها مني / منك

| سؤال | إن اخترت… سأفعل… |
| :--- | :--- |
| هل مشروع Firebase مملوك لك؟ | (نعم) أكتب لك `.firebaserc` الجديد وأعدّل `apphosting.yaml` · (لا) أولّد لك مولّد `schema.sql` لخيار B |
| الوجهة A أم B؟ | A: تنفيذ المراحل 1–7 كاملة · B: مولّد schema + طبقة ترجمة + RLS |
| هل تريد CI؟ | ملف GitHub Actions يشغّل `typecheck + check:relations + tests` |
| أهم شيء الآن | **`npm run db:export` الليلة** — كل ما عداه يمكن أن ينتظر، التصدير لا ينتظر |
