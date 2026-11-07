# AGENTS.md — دستور العمل لأي وكيل/مبرمج على هذا المستودع

> هذا الملف هو **النسخة المحمولة** من قواعد المشروع. `GEMINI.md` صار مرجعاً له فقط.
> اقرأه كاملاً قبل كتابة أي سطر. القواعد ليست اقتراحات.

**المشروع**: NovaFlow ERP — نظام إدارة هندسي/محاسبي متعدد المستأجرين (Next.js 15 + Firebase Firestore + Genkit).
**الحجم الحالي**: 293 ملف TS/TSX · ~48,400 سطر · 76 مجموعة بيانات · 132 علاقة مشتقة.
**حالة مهمة**: المشروع نُقل من منصة تطوير أُغلقت؛ كل ما هو مرتبط ببيئة يجب أن يكون قابلاً للتبديل عبر متغيرات البيئة. راجع `docs/migration-runbook.md`.

---

## 0. الأصول التي لا تُكسر (اقرأها أولاً)

| الأصل | الملف | كيف تتحقق |
| :--- | :--- | :--- |
| خريطة العلاقات والمسارات | `docs/relationships.md` | `npm run check:relations` |
| السجل المرجعي الآلي | `docs/relations.json` | نفس الأمر |
| تقسيم الموديولات (استشارات/مقاولات/D&B/HR/مشترك) | `docs/verticals.md` | وسم `verticals` لكل مجموعة |
| الدليل المجمّع | `docs/NovaFlow-Guide-AR.md` | `npm run docs:guide:check` |

**لا تكتب من ذاكرتك**: أي تعديل على نموذج البيانات يبدأ من هذه الملفات، وينتهي بها.

## 1. قواعد البيانات والنموذج (الأهم)

1. كل مسار Firestore يوجد في `src/firebase/multi-tenant.ts` عبر `paths.*`. **يُمنع** كتابة `companies/${companyId}/...` نصياً في أي صفحة أو خدمة.
2. كل مستند يجب أن يحمل `companyId` — بدونه لا يستطيع أحد قراءته (قواعد `collection-group` تعتمد `resource.data.companyId`).
3. أي حقل جديد ينتهي بـ `Id` / `Ids` يحتاج هدفاً في `docs/relations.json → aliases`، وإلا يفشل `npm run check:relations`.
4. لكل `xxxId` أضف مرآة `xxxName` (اتفاقية النظام لعرض بلا JOIN).
5. أي مجموعة جديدة أو محذوفة أو متغيّر استخدامها ⇒ حدّث `docs/relations.json` (الحقل `status`) + جدول §1.1 في `docs/relationships.md` + وسم `verticals`.
6. **يُمنع** لأي خدمة جديدة أن تكتب مباشرة في `journalEntries` — مرّ عبر `AccountingService.createJournalEntry` / `createVoucher` (حارس توازن القيد `|debit-credit| ≤ 0.001` يوجد هناك وحده).
7. التكاليف **تُجمَّد** وقت الكتابة (`hourlyCostRef → actualCost`) — لا تعِد قراءة `costRateCards` لحساب تكلفة ماضية.
8. الأرقام التجارية تُولَّد من `companies/{c}/counters/{key}` عبر `nextSequential()` — لا `Math.random` ولا `length+1`.

## 2. البنية والاستضافة (بعد النقل)

1. **لا قيم ثابتة لأي مشروع** — كل معرفات Firebase من `NEXT_PUBLIC_FIREBASE_*` (انظر `src/firebase/config.ts` و`.env.example`).
2. النشر عبر `firebase.json` + `firestore.rules` + `firestore.indexes.json` في المستودع. **لا تعدّل القواعد من الكونسول** — لن يصدقها أحد لاحقاً.
3. مسارات API للكتابة الحساسة مالياً يجب أن تنتقل إلى خادم (`src/app/api/**/route.ts` بـ `firebase-admin`) تدريجياً؛ لا تضف كتابة مالية جديدة من المتصفح.
4. متغيرات البيئة: `npm run emulator` يعمل محلياً بالإيموليتر؛ لا تعتمد على خدمات المنصة (App Hosting env, IDX ports).

## 3. الموديولات: افصل بالبيانات لا بالنص

1. المشروع يخدم ثلاثة رؤوس: `consulting` (استشارات) · `construction` (مقاولات) · `hybrid` (D&B) — والفرق **بياناتي** لا كود.
2. **يُمنع** إضافة مطابقة نصية جديدة على `activityTypeName` أو `departmentName` أو `jobTitle` (الفجوة G11). عند الحاجة لفلترة رأسية استخدم/أضف حلاً مركزياً في `src/lib/verticals.ts` (غير موجود بعد — أنشئه قبل أن تكرّر النص).
3. الفلاتر الرأسية الحالية (ست مواضع معروفة) مبيّنة في `docs/verticals.md §9`.

## 4. القواعد الفنية (ميراث من GEMINI.md — ما زالت سارية)

1. **القوائم القابلة للبحث**: استخدم `<SearchableDropdown>` من `@/components/ui/searchable-dropdown`. **يُمنع** `Popover`/`Select`/`DropdownMenu` داخل `Dialog` (تعارض Focus Trap).
2. **الترجمة**: لا تعد كتابة/حذف `src/context/language-context.tsx` (ملف مقفل — أُتلف مرة بإعادة توليده). المفاتيح الجديدة تُضاف في نهاية `ar` و`en`، وتُستخدم `tSafe('inline.key','عربي','English')`. ممنوع `isRtl ? 'ar' : 'en'` مضمّن.
3. **الألوان**: `#FFB000` أساسي · `#FF5722` ثانوي · `#FFD600` تنبيه · `#2563EB` معلومات · `#FCE4EC` خلفيات. **يُمنع الأسود القاسي** (`black`, `bg-black`, `text-black`) — للنصوص `text-slate-800`.
4. **الأشكال**: بطاقات `rounded-[2rem]`/`rounded-[2.5rem]` · أزرار ومدخلات `rounded-xl`/`rounded-2xl` · حدود `border-2 border-slate-100` · للأزرار الأساسية `border-b-4 border-[#FF5722]`.
5. **المقاسات**: عرض كامل (`w-full` أو `max-w-[1600px] mx-auto`) — ممنوع `max-w-md`/`max-w-2xl` للصفحات. القوائم: `max-h-[300px] overflow-y-auto` لأي قائمة فيها أكثر من 3 عناصر. الأزرار `h-10` (الحفظ `h-12`، ممنوع `h-14+`). المدخلات `h-10`. الخطوط `text-sm`/`text-xs` (ممنوع `text-xl`).
6. **RTL**: كل واجهة جديدة يجب أن تعمل من اليمين لليسار، والأيقونات من `lucide-react`.

## 5. قبل أن تسلّم أي كود

```bash
npm run typecheck          # أنواع
npm run lint               # ستايل
npm run check:relations    # سلامة خريطة العلاقات (إلزامي عند أي تعديل بيانات)
npm run docs:guide         # إعادة توليد الدليل المجمّع إن لمست docs/
```

- أضف/حدّث اختبارات لأي منطق مالي أو قانوني (retention، السلّم المرضي، توازن القيد، نسبة الإنجاز).
- اكتب في رسالة الـ commit أي فجوات من `docs/relations.json → gaps` أثّرت عليها أو أغلقتها.
- **ممنوع** تعطيل فحص أو إضافة `ignoreBuildErrors` إضافي لتجاوز خطأ — الأصل أن يُصلح.

## 6. ما لا يجب أن تفعله الوكيل أبداً

1. لا تحذف/تعيد توليد ملفات كبيرة (قاموس الترجمة، `multi-tenant.ts`) بحجة التنظيف.
2. لا تعدّل `firestore.rules` لتوسيع الصلاحيات «لتشتغل الميزة» — هذا تاريخياً مصدر الدَّين في هذا المستودع (انظر `docs/testing-bypass-log.md`).
3. لا تضف Cloud Function/خادم جديد بلا مفتاح فحص في `check:relations`.
4. لا تخلق مجموعة بيانات جديدة لتجاوز مشكلة فهرس — أضف الفهرس في `firestore.indexes.json`.
