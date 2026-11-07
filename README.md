# NovaFlow ERP - دليل المطور والرفع إلى GitHub 🚀

هذا المشروع مبني باستخدام **NextJS**, **Firebase**, و **Genkit AI**. اتبع هذه التعليمات لإدارة الكود الخاص بك بكفاءة سيادية.

## ⚠️ حل مشكلة تعارض الملفات (Git Conflict Resolution)
إذا ظهر لك خطأ `Committing is not possible because you have unmerged files` في السجلات، نفذ الأوامر التالية في الـ Terminal بالترتيب:

```bash
# 1. إضافة كافة الملفات بعد الإصلاح الآلي
git add .

# 2. إتمام عملية الدمج/التعديل برسالة واضحة
git commit -m "Fix: Resolve conflicts and apply Odoo-style dictionary"

# 3. الرفع للسحاب
git push origin main
```

## 1. الإعداد الأولي (لأول مرة فقط)
افتح الـ Terminal في المجلد الرئيسي للمشروع ونفذ الأوامر التالية:

```bash
git init
git add .
git commit -m "Initial commit: NovaFlow ERP with Sovereign Core"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## 2. رفع التعديلات الجديدة (Push)
```bash
git add .
git commit -m "وصف التعديل الجديد"
git push origin main
```

## 3. جلب التحديثات من GitHub (Pull)
```bash
git pull origin main
```

## 🕸️ خريطة العلاقات (Data Model)

- **المرجع البصري والنصي الكامل**: [`docs/relationships.md`](docs/relationships.md) — كل مجموعة، كل مفتاح أجنبي، كل خط أنابيب تشغيلي←مالي، وكل فجوة معروفة.
- **السجل الآلي**: [`docs/relations.json`](docs/relations.json) (يدوي) + [`docs/relations.generated.json`](docs/relations.generated.json) (مُولَّد).
- **التقسيم إلى موديولات**: [`docs/verticals.md`](docs/verticals.md) — الاستشارات الهندسية / المقاولات والإنشاءات / التصميم والتنفيذ / الموارد البشرية / اللب المشترك، مع خطة فصل نظيفة.
- **🛟 دليل النقل من المنصة المغلقة**: [`docs/migration-runbook.md`](docs/migration-runbook.md) — إخراج البيانات والمستخدمين والمفاتيح والفهارس، ومقارنة الوجهات، وخطة 7 مراحل بأوامر جاهزة. أدواته: `npm run db:counts | db:export | db:import | db:indexes` و`npm run emulator` و`npm run deploy:config`.
- **🤖 دستور الوكيل المحمول**: [`AGENTS.md`](AGENTS.md) (و`GEMINI.md` صار مؤشراً له) + بيئة عمل مستقلة في [`.devcontainer/`](.devcontainer) ووبوابات CI جاهزة في [`.ci/github-actions/ci.yml`](.ci/github-actions/ci.yml) (نقلها خطوة واحدة — راجع README بجانبها).
- **📕 ملف واحد قابل للتنزيل**: [`docs/NovaFlow-Guide-AR.md`](docs/NovaFlow-Guide-AR.md) (نسخة HTML معروضة بالمخططات: [`docs/NovaFlow-Guide-AR.html`](docs/NovaFlow-Guide-AR.html)) — يُوَلَّد من الوثيقتين أعلاه بواسطة `npm run docs:guide`.
- **الحارس**: `npm run check:relations` (٧ فحوصات) يقارن الكود بالتوثيق ويفشل عند أي انحراف — بما فيها وسوم الموديولات.

```bash
npm run check:relations            # فحص: هل الخريطة مطابقة للكود؟
npm run check:relations -- --write # تحديث اللقطة المولّدة بعد أي تعديل على paths أو الأنواع
```

---
**NovaFlow ERP** - نظام إدارة هندسي متكامل ممتثل لقانون العمل الكويتي.
