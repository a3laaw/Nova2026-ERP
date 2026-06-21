# NovaFlow ERP - دليل الرفع إلى GitHub 🚀

هذا المشروع مبني باستخدام **NextJS**, **Firebase**, و **Genkit AI**. لرفع الكود الخاص بك إلى GitHub، اتبع الخطوات التالية:

### 1. الإعداد الأولي (لأول مرة فقط)
افتح الـ Terminal في المجلد الرئيسي للمشروع ونفذ الأوامر التالية:

```bash
# تهيئة Git في المشروع
git init

# إضافة كافة الملفات للتجهيز
git add .

# تسجيل أول "Commit" للتغييرات
git commit -m "Initial commit: NovaFlow ERP with HR and Payroll Engine"
```

### 2. الربط مع GitHub
اذهب إلى حسابك في GitHub، أنشئ مستودعاً جديداً (New Repository)، ثم انسخ الرابط الخاص به ونفذ:

```bash
# ربط المشروع المحلي بالمستودع السحابي (استبدل الرابط برابط مستودعك)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# تسمية الفرع الرئيسي
git branch -M main
```

### 3. رفع الكود (Push)
الآن ارفع الملفات فعلياً:

```bash
git push -u origin main
```

### 💡 ملاحظات هامة:
*   **الملفات الحساسة**: تم إعداد ملف `.gitignore` تلقائياً لمنع رفع مجلد `node_modules` والملفات المؤقتة.
*   **التحديثات القادمة**: في كل مرة تريد فيها رفع تغييرات جديدة، استخدم:
    ```bash
    git add .
    git commit -m "وصف التعديل الجديد"
    git push
    ```

---
**NovaFlow ERP** - نظام إدارة هندسي متكامل ممتثل لقانون العمل الكويتي.