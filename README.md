# NovaFlow ERP - دليل المطور والرفع إلى GitHub 🚀

## ابدأ هنا — خريطة مساحة العمل

| المكان | المحتوى |
| --- | --- |
| **[deliverables/nova-voice](deliverables/nova-voice/README.md)** | **حزمة Nova Voice الحالية الجاهزة للتنزيل وشرح التشغيل** |
| [desktop/nova-voice](desktop/nova-voice/README.md) | كود برنامج Windows وملفات التشغيل والأمثلة والاختبارات |
| [deliverables/archive](deliverables/archive/README.md) | النسخ السابقة، منفصلة عن التسليم الحالي |
| `src/` و`docs/` وملفات Next.js | مشروع ERP الأصلي؛ لم يُنقل أو يُغيّر هيكله |

**الملف المطلوب:** [NovaVoice-Source-v0.5.0.rar](deliverables/nova-voice/NovaVoice-Source-v0.5.0.rar)
**شرح التشغيل:** [RUN-FIRST-AR.html](deliverables/nova-voice/RUN-FIRST-AR.html)

الحزمة الحالية مصدر وملفات تشغيل، وليست EXE جاهزًا. ملف RAR موجود داخل المستودع
بمسار واضح وغير مستثنى من Git؛ لا يعتمد العثور عليه على رابط المعاينة المؤقت.

---

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

---
**NovaFlow ERP** - نظام إدارة هندسي متكامل ممتثل لقانون العمل الكويتي.

## تطبيق Nova Voice المستقل للكمبيوتر

أداة Windows محلية لتحويل السكريبت إلى MP3/WAV دون إنترنت بعد تجهيز المحرك
والنماذج الصوتية أول مرة، مع العربية وEnglish ووضع حوار بين صوتين،
وواجهة عربية ومعاينة وضبط السرعة. يدعم أيضًا إضافة الصوت إلى نسخة HTML جديدة
مع التحكم بسرعة الصوت وحركات الصفحة المدعومة، دون تغيير الأصل. ويوفّر مسارًا من خطوتين: سكريبت إلى سبورة تفاعلية HTML،
ثم توليد الصوت لكل خطوة من النص المحفوظ فيها، دون إعادة إدخاله.
التطبيق منفصل عن ERP ولا يغيّر إعدادات Next.js أو Firebase.

- [دليل التشغيل والبناء](desktop/nova-voice/README.md)
- [البداية السريعة](desktop/nova-voice/START-HERE.txt)
- [السكريبت إلى سبورة ثم صوت](desktop/nova-voice/WHITEBOARD-GUIDE.md)
