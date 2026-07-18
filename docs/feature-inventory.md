# خريطة ميزات نظام NovaFlow ERP السيادية 🇸🇦

هذا المستند يمثل الحصر الشامل لكافة الوظائف والميزات الموجودة في النظام، ويعتبر المرجع الأساسي لسياسة "عدم التراجع".

## 1. مسارات الصفحات الفعلية (App Router Routes)

| المسار (Route) | الملف المصدري (File Path) | الوصف |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | بوابة التوجيه الرئيسية |
| `/login` | `src/app/login/page.tsx` | بوابة الدخول الموحدة |
| `/register` | `src/app/register/page.tsx` | تسجيل المنشآت الجديدة |
| `/dashboard` | `src/app/dashboard/page.tsx` | لوحة تحكم العمليات |
| `/dashboard/crm` | `src/app/dashboard/crm/page.tsx` | إدارة الفرص والعملاء |
| `/dashboard/clients` | `src/app/dashboard/clients/page.tsx` | قاعدة بيانات العملاء |
| `/dashboard/clients/new` | `src/app/dashboard/clients/new/page.tsx` | تسجيل عميل جديد |
| `/dashboard/clients/[id]` | `src/app/dashboard/clients/[id]/page.tsx` | ملف العميل ورادار الموقع |
| `/dashboard/clients/[id]/edit` | `src/app/dashboard/clients/[id]/edit/page.tsx` | تعديل بيانات العميل |
| `/dashboard/clients/[id]/transactions/new` | `src/app/dashboard/clients/[id]/transactions/new/page.tsx` | فتح معاملة فنية |
| `/dashboard/clients/[id]/transactions/[tId]` | `src/app/dashboard/clients/[id]/transactions/[tId]/page.tsx` | رادار المسار الميداني |
| `/dashboard/clients/[id]/transactions/[tId]/boq` | `src/app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` | هندسة المقايسة التنفيذية |
| `/dashboard/projects` | `src/app/dashboard/projects/page.tsx` | رادار المشاريع الموحد |
| `/dashboard/projects/boqs` | `src/app/dashboard/projects/boqs/page.tsx` | مستكشف المقايسات العالمي |
| `/dashboard/hr` | `src/app/dashboard/hr/page.tsx` | لوحة الموارد البشرية |
| `/dashboard/hr/employees` | `src/app/dashboard/hr/employees/page.tsx` | سجل الموظفين الشامل |
| `/dashboard/hr/payroll` | `src/app/dashboard/hr/payroll/page.tsx` | إدارة مسيرات الرواتب |
| `/dashboard/hr/payroll/new` | `src/app/dashboard/hr/payroll/new/page.tsx` | توليد الرواتب الذكي |
| `/dashboard/hr/gratuity-calculator` | `src/app/dashboard/hr/gratuity-calculator/page.tsx` | حاسبة نهاية الخدمة |
| `/dashboard/hr/legal-guide` | `src/app/dashboard/hr/legal-guide/page.tsx` | دليل الامتثال القانوني |
| `/dashboard/procurement` | `src/app/dashboard/procurement/page.tsx` | لوحة المشتريات |
| `/dashboard/accounting` | `src/app/dashboard/accounting/page.tsx` | المطابقة البنكية الذكية |
| `/dashboard/ai` | `src/app/dashboard/ai/page.tsx` | مركز ذكاء Nova |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | محطة الإعدادات المركزية |
| `/developer` | `src/app/developer/page.tsx` | كونسول المطور (Tenants) |
| `/apply/[companyId]` | `src/app/apply/[companyId]/page.tsx` | بوابة التوظيف العامة |

## 2. عناصر القائمة الجانبية (Sidebar Items)

- **الرئيسية**: `/dashboard`
- **CRM**: الفرص البيعية، العملاء.
- **المشاريع**: المشاريع الجارية، مستكشف المقايسات، التقارير.
- **المشتريات**: الموردين، تحليل العروض (AI).
- **الموارد البشرية**: ملفي الوظيفي، سجل الموظفين، الإجازات، الرواتب.
- **المحاسبة**: المطابقة البنكية.
- **المخازن**: المستودعات.
- **الإعدادات**: المستخدمين، هوية المنشأة، الدستور التشغيلي، الصلاحيات، مواعيد العمل.

## 3. محركات الذكاء الاصطناعي (AI Flows)

- `accounting-assistant-flow`: توليد قيود اليومية.
- `analyze-supplier-quotes-flow`: مقارنة عروض الموردين.
- `analyzeEmployeeDoc`: استخراج بيانات الوثائق.
- `cash-flow-projection-flow`: توقعات التدفق المالي.
- `fetch-holidays-flow`: جلب العطلات الرسمية.
- `reconcile-bank-statement-flow`: المطابقة البنكية.
- `translate-flow`: الترجمة الهندسية الاحترافية.

## 4. الخدمات البرمجية (Services)

- `PayrollService`: محرك حساب الرواتب والخصومات.
- `VariationService`: محرك الأوامر التغييرية وحقن المراحل.
- `DocumentService`: إدارة المقايسات والعقود.
- `HRService`: إدارة شؤون الموظفين والتدقيق.
- `BOQExecutionService`: تتبع الإنجاز الميداني والكميات.
- `EndOfServiceCalculator`: محرك قانون العمل الكويتي.
- `WorkingDaysService`: حساب أيام العمل الفعلية.
- `ReferenceListService`: إدارة القواميس القابلة للتوسعة.

## 5. هياكل البيانات (Types & Interfaces)

- `Employee`: ملف الموظف والبيانات المالية.
- `BOQItem`: بنود المقايسة والارتباطات الفنية.
- `BOQVariation`: سجلات الأوامر التغييرية.
- `StageInstance`: مراحل التنفيذ الميدانية.
- `PurchaseOrder`: أوامر التوريد والمشتريات.
- `RoleMatrix`: مصفوفة الصلاحيات المتقدمة.

## 6. قواعد عدم التراجع (Non-Regression Rules)

**هام جداً:**
1. لا يجوز حذف أي صفحة (Page) أو مكون (Component) أو عنصر قائمة (Sidebar Item) مذكور في هذه الخريطة.
2. لا يجوز إخفاء أي ميزة باستخدام CSS أو تغيير شروط الظهور البرمجية إلا بموافقة صريحة.
3. أي إصلاح تقني (Bug Fix) يجب أن يحافظ على كامل الوظيفة الأصلية للميزة.
4. تعتبر هذه الخريطة هي "العهد الوظيفي" لنظام NovaFlow ERP.

---
*تم توليد هذا الحصر آلياً لضمان السيادة الوظيفية للمشروع.*
