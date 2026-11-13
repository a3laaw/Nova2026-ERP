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

### المرحلة 7 · بيئة التطوير والوكلاء — ✅ **تم تنفيذها في هذا المستودع**
- **`.devcontainer/Dockerfile` + `.devcontainer/devcontainer.json`**: node 20 + `firebase-tools` + `npm install` عند التهيئة + `npm run dev` عند التشغيل، ومنافذ 3000/4000/8080/9099 مفتوحة. أي محرر يدعم Dev Containers (VS Code، Cursor، Windsurf، JetBrains، GitHub Codespaces) يشغّل نفس البيئة بلا منصة.
- **CI بوظيفتين** — الملف مكتوب في **`.ci/github-actions/ci.yml`** ولا ينتقل إلى `.github/workflows/` إلا بخطوة واحدة (اقرأ `.ci/github-actions/README.md`): تطبيق GitHub المستخدم هنا لا يملك صلاحية `workflows`، فيرفض GitHub دفع ملف workflow من وكيل. نفّذ `git mv .ci/github-actions/ci.yml .github/workflows/ci.yml` من حسابك أو امنح التطبيق الصلاحية:
  - `quality`: `selftest` → `typecheck:gate` (ميزانية أخطاء الأنواع) → `check:relations` → `docs:guide:check` → فحص صيغة `firebase.json`/`firestore.indexes.json` → `npm run build`.
  - `firestore-emulator`: يُقلع إيميليتر Firestore/Auth — وهو **أول تحقق آلي من صياغة `firestore.rules`** (لم يكن موجوداً قط؛ خطأ إملائي واحد في القواعد كان يصل إلى الإنتاج بصمت).
- **`AGENTS.md`**: دستور الوكيل صار في المستودع، و`GEMINI.md` أصبح مؤشراً له — فلا تضيع قواعد العمل مع أدوات المنصة.
- **`.idx/dev.nix`** تُرك كما هو مع تعليق تحذيري أعلى الملف (حذفه الآن قد يعطّل ما تبقّى من البيئة القديمة؛ احذفه بعد انتقالك نهائياً).
- ملاحظة أمانة: `npm run lint` في `package.json` هو `next lint` بدون أي إعداد ESLint مثبّت — لن ينجح إلا بعد `npm i -D eslint eslint-config-next`، لذلك CI لا يعتمد عليه.

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
| هل تريد CI؟ | جاهز في `.ci/github-actions/ci.yml` — ينقل بخطوة واحدة إلى `.github/workflows/` |
| أهم شيء الآن | **`npm run db:export` الليلة** — كل ما عداه يمكن أن ينتظر، التصدير لا ينتظر |

---

## 10. ما شُغِّل فعلاً في هذه البيئة — أدلة، لا ادعاءات (2026-11)

لا يوجد في تاريخ المستودع أي سجل تشغيل (commit واحد، بلا CI سابق). لذلك هذا هو أول سجل «ما تم تنفيذه حرفياً» و«ما لم يستطع أحد تنفيذه هنا»:

| الأمر | الحالة | النتيجة الحرفية |
|---|---|---|
| `npm install` | ✅ نُفّذ | 1301 حزمة في 53s — وظهر أن **`package-lock.json` غير متزامن** مع `package.json` (كان سيكسر `npm ci`)؛ حُدِّث الـ lock في هذا الفرع |
| `npm run selftest` | ✅ نُفّذ | **19/19 نجحت** — اختبارات حقيقية لمنطق النقل (انظر §10.2) |
| `npm run typecheck` | ✅ نُفّذ لأول مرة | **202 خطأ أنواع** في 22 ملفاً — صارت «ميزانية» محكومة لا تُزاد (`npm run typecheck:gate`) |
| `npm run check:relations` | ✅ نُفّذ | `✅ السجل المرجعي مطابق للكود` |
| `npm run docs:guide:check` | ✅ نُفّذ | `✅ الدليل المولّد مطابق للمصدر` |
| `npm run dev` + طلب الصفحات | ✅ نُفّذ | الخادم أقلع، و`/` و`/login` و`/dashboard` و`/dashboard/accounting` رجّعت **HTTP 200** مع HTML عربي (`<title>NovaFlow ERP - نظام إدارة هندسي متكامل</title>`). أي **الواجهة تعمل**، والتحميل الفعلي للبيانات عميل-جانبي فلن يظهر هنا (لا شبكة Firestore في هذه البيئة) |
| `npm run build` (إنتاج) | ⚠️ تعذّر | ليس عيب الكود: هذه البيئة تحجب `fonts.googleapis.com`، و`next/font` يجلب `Cairo` و`IBM Plex Sans Arabic` وقت البناء. على CI/Vercel (شبكة مفتوحة) يكمل |
| إقلاع إيميليتر Firestore | ⛔ غير ممكن هنا | لا يوجد `java` في البيئة — لهذا الفحص وُضع في `firestore-emulator` على GitHub Actions |
| `npm run db:counts / db:export / db:import / db:indexes` | ⛔ **لا يمكن تنفيذها من هنا إطلاقاً** | تحتاج حساب خدمة + بيانات Firestore داخل المشروع الجاري إغلاقه. **هذا عملك أنت من داخل المنصة، وهو سبب استعجال §1** |

### 10.1 ما كشفه `tsc` (وهو أهم من العدد نفسه)
التوزيع: `TS1117=157` (مفاتيح مكررة) · `TS2339=23` (خصائص غير موجودة) · `TS7006=8` · `TS2305=6` (أنواع مستوردة غير معرّفة) · `TS2554=2` (عدد وسائط خاطئ) · `TS2551=1` · `TS2353=1` · `TS2322=1` · `TS2345=1` · `TS2737=1` · `TS2307=1`.

**مواضع مكسورة وقت التشغيل فعلاً** (ليست تحذيرات شكلية — هذه الكود يستدعي شيئاً غير موجود)：

| الموضع | ما يحدث عند الضغط على الزر |
|---|---|
| `src/app/dashboard/clients/[id]/transactions/[tId]/page.tsx:205` | `transactionService.addStageRevision(...)` — الدالة **غير معرّفة في أي مكان في `src/`** → `TypeError` وميزة«إضافة مراجعة مرحلة» ميتة |
| `src/components/appointments/architectural-appointments-view.tsx:830` | `clientService.getNextFileNumber()` — غير معرّفة → ترقيم الملفات في مواعيد المعماري لا يعمل |
| `src/services/field-visit-service.ts:110` | يقرأ `visit.transactionName` بينما النوع `transactionNumber` → يُخزَّن `undefined`، أي **زيارة ميدان تفقد ربطها بالمعاملة** |
| `equipment/page.tsx:40,108` و`equipment/[id]/edit/page.tsx:60` | `Equipment.name` غير معرّف على النوع (3 مواضع) |
| `hr/leaves-manager.tsx:87,90` و`hr/leaves/[id]/page.tsx:73,75` | `LeaveRequest.departmentId` غير معرّف (4 مواضع) → فلترة الإجازات حسب القسم |
| `src/services/variation-service.ts:18` | يستورد `BOQVariation` / `BOQVariationItem` / `VOStageMode` من `@/types/documents` وهي **غير مصدَّرة** |
| `src/services/payroll-service.ts:106,125,126` | `monthlyLeaveProvision` / `monthlyGratuityProvision` مكتوبان لكنهما ليسا في `Partial<PayrollRecord>` → **مخصصات الإجازات والمكافأة نهاية الخدمة تُحسب ولا تُحفظ** |
| `src/context/language-context.tsx` | **126 مفتاحاً مكرراً** (مثال: `status.submitted` معرّف 4 مرات) — آخر تعريف يفوز، فالترجمة عند 3 من المواضع الأربعة ميتة |
| `src/services/accounting-service.ts:61` | حرف `BigInt` مع `target: ES2017` في `tsconfig.json` — يحتاج `ES2020` |

> **لماذا لم يرَ أحد هذا؟** `next.config.ts` يضبط `ignoreBuildErrors: true` و`ignoreDuringBuilds: true`، فلا `tsc` ولا ESLint كان يجرى في أي مكان. لهذا السبب بالضبط أُضيفت ميزانية الأنواع: الخطأ الذي لا يُقاس يتراكم بصمت.
> **ترتيب الإصلاح المقترح بعد النقل** (لا قبله): (1) `payroll-service` المخصصات → (2) `transactionName` في زيارات الميدان → (3) الدالتان المفقودتان → (4) المفاتيح المكررة في القاموس → (5) الباقي على مهل.

### 10.2 ما يُغطّيه `npm run selftest` (19 فحصاً، كلها بلا شبكة)
تحويل `Timestamp` و`GeoPoint` والبايتات والمرجعيات عبر JSON والعودة · **توازن القيد يظل صحيحاً بعد النقل** (`Σdebit = Σcredit`) · `NaN/Infinity` لا تتحول `null` · `undefined` يُسقط المفتاح (فرق «غير موجود» عن «فارغ» في Firestore) · المشي على 4 مستويات من المجموعات الفرعية مع المسارات الكاملة `companies/c1/projects/p1/stages/s1/executions/e1` · الحفاظ على المعرّف الأصلي · تحليل وسائط الأمر · **الحارس الذي يمنع الاستيراد إلى المشروع المحتضَر بلا `--yes`** · والفشل النظيف برسالة إرشادية عند غياب حساب الخدمة.

اكتشف هذا الاختبار عيبين في `scripts/db-transfer.js` وأُصلا في نفس اللحظة:
1. `instanceof FS.Blob` — **صنف `Blob` غير موجود إطلاقاً** في `firebase-admin@13` / `@google-cloud/firestore@7`؛ كان سيسقط التصدير عند أول مستند. تُقرأ القيم الثنائية الآن كـ `Uint8Array`.
2. `undefined` كان يتحول `null` صامتاً في كل الحقول غير الموجودة.
