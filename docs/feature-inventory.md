# خريطة ميزات نظام NovaFlow ERP السيادية 🇸🇦

هذا المستند يمثل الحصر الشامل لكافة الوظائف والميزات الموجودة في النظام، ويعتبر المرجع الأساسي والوحيد لسياسة "عدم التراجع".

## 1. مسارات الصفحات الفعلية (App Router Routes)

| المسار (Route) | الملف المصدري (File Path) | الوصف |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | بوابة التوجيه الرئيسية |
| `/login` | `src/app/login/page.tsx` | بوابة الدخول الموحدة |
| `/register` | `src/app/register/page.tsx` | تسجيل المنشآت الجديدة |
| `/dashboard` | `src/app/dashboard/page.tsx` | لوحة تحكم العمليات والإحصائيات |
| `/dashboard/crm` | `src/app/dashboard/crm/page.tsx` | إدارة الفرص والمبيعات |
| `/dashboard/clients` | `src/app/dashboard/clients/page.tsx` | قاعدة بيانات العملاء |
| `/dashboard/clients/new` | `src/app/dashboard/clients/new/page.tsx` | تسجيل عميل جديد |
| `/dashboard/clients/[id]` | `src/app/dashboard/clients/[id]/page.tsx` | ملف العميل ورادار الموقع |
| `/dashboard/clients/[id]/edit` | `src/app/dashboard/clients/[id]/edit/page.tsx` | تعديل بيانات العميل |
| `/dashboard/clients/[id]/transactions/new` | `src/app/dashboard/clients/[id]/transactions/new/page.tsx` | فتح معاملة فنية جديدة |
| `/dashboard/clients/[id]/transactions/[tId]` | `src/app/dashboard/clients/[id]/transactions/[tId]/page.tsx` | رادار المسار الميداني (War Room) |
| `/dashboard/clients/[id]/transactions/[tId]/boq` | `src/app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` | هندسة المقايسة التنفيذية |
| `/dashboard/projects` | `src/app/dashboard/projects/page.tsx` | رادار المشاريع الموحد (Eagle Eye) |
| `/dashboard/projects/boqs` | `src/app/dashboard/projects/boqs/page.tsx` | مستكشف المقايسات العالمي |
| `/dashboard/hr` | `src/app/dashboard/hr/page.tsx` | لوحة الموارد البشرية والامتثال |
| `/dashboard/hr/employees` | `src/app/dashboard/hr/employees/page.tsx` | سجل الموظفين الشامل |
| `/dashboard/hr/employees/new` | `src/app/dashboard/hr/employees/new/page.tsx` | إضافة موظف جديد |
| `/dashboard/hr/employees/[id]` | `src/app/dashboard/hr/employees/[id]/page.tsx` | ملف الموظف وسجل التدقيق |
| `/dashboard/hr/payroll` | `src/app/dashboard/hr/payroll/page.tsx` | إدارة مسيرات الرواتب |
| `/dashboard/hr/payroll/new` | `src/app/dashboard/hr/payroll/new/page.tsx` | توليد الرواتب الذكي |
| `/dashboard/hr/payroll/[id]` | `src/app/dashboard/hr/payroll/[id]/page.tsx` | تفاصيل كشف الرواتب |
| `/dashboard/hr/gratuity-calculator` | `src/app/dashboard/hr/gratuity-calculator/page.tsx` | حاسبة نهاية الخدمة (قانون العمل) |
| `/dashboard/hr/legal-guide` | `src/app/dashboard/hr/legal-guide/page.tsx` | دليل الامتثال القانوني الكويتي |
| `/dashboard/hr/leaves` | `src/app/dashboard/hr/leaves/page.tsx` | سجل طلبات الإجازات |
| `/dashboard/hr/leaves/new` | `src/app/dashboard/hr/leaves/new/page.tsx` | تقديم طلب إجازة جديد |
| `/dashboard/hr/leaves/[id]` | `src/app/dashboard/hr/leaves/[id]/page.tsx` | معالجة طلب الإجازة |
| `/dashboard/hr/permissions` | `src/app/dashboard/hr/permissions/page.tsx` | سجل طلبات الاستئذان |
| `/dashboard/hr/permissions/new` | `src/app/dashboard/hr/permissions/new/page.tsx` | تقديم طلب استئذان جديد |
| `/dashboard/hr/permissions/[id]` | `src/app/dashboard/hr/permissions/[id]/page.tsx` | معالجة طلب الاستئذان |
| `/dashboard/hr/attendance/import` | `src/app/dashboard/hr/attendance/import/page.tsx` | استيراد البصمة (XLSX) |
| `/dashboard/hr/reports` | `src/app/dashboard/hr/reports/page.tsx` | مركز تقارير HR |
| `/dashboard/hr/reports/attendance` | `src/app/dashboard/hr/reports/attendance/page.tsx` | تحليل حضور القوى العاملة |
| `/dashboard/hr/reports/attendance/individual/[id]` | `src/app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` | تحليل انضباط موظف |
| `/dashboard/hr/reports/leaves` | `src/app/dashboard/hr/reports/leaves/page.tsx` | تقرير أرصدة الإجازات |
| `/dashboard/hr/reports/leaves/statement/[id]` | `src/app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` | كشف حركة رصيد الإجازات |
| `/dashboard/hr/reports/payroll` | `src/app/dashboard/hr/reports/payroll/page.tsx` | ملخص مصروفات الرواتب |
| `/dashboard/hr/reports/payroll/individual/[id]` | `src/app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` | كشف السجل المالي لموظف |
| `/dashboard/hr/reports/dossier` | `src/app/dashboard/hr/reports/dossier/page.tsx` | بحث ملف الموظف الشامل |
| `/dashboard/hr/reports/dossier/[id]` | `src/app/dashboard/hr/reports/dossier/[id]/page.tsx` | ملف الموظف الشامل (Dossier) |
| `/dashboard/hr/recruitment` | `src/app/dashboard/hr/recruitment/page.tsx` | إدارة التوظيف والمواهب |
| `/dashboard/procurement` | `src/app/dashboard/procurement/page.tsx` | لوحة المشتريات والتوريد |
| `/dashboard/procurement/suppliers` | `src/app/dashboard/procurement/suppliers/page.tsx` | قاعدة بيانات الموردين |
| `/dashboard/procurement/orders` | `src/app/dashboard/procurement/orders/page.tsx` | سجل أوامر الشراء (POs) |
| `/dashboard/procurement/orders/new` | `src/app/dashboard/procurement/orders/new/page.tsx` | إصدار أمر شراء جديد |
| `/dashboard/accounting` | `src/app/dashboard/accounting/page.tsx` | المطابقة البنكية الذكية |
| `/dashboard/inventory` | `src/app/dashboard/inventory/page.tsx` | المخازن والعهد الميدانية |
| `/dashboard/ai` | `src/app/dashboard/ai/page.tsx` | مركز ذكاء Nova |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | محطة الإعدادات المركزية |
| `/dashboard/settings/company` | `src/app/dashboard/settings/company/page.tsx` | هوية وبيانات المنشأة |
| `/dashboard/settings/users` | `src/app/dashboard/settings/users/page.tsx` | إدارة مستخدمي النظام |
| `/dashboard/settings/profile` | `src/app/dashboard/settings/profile/page.tsx` | الملف الشخصي للمستخدم |
| `/dashboard/settings/roles` | `src/app/dashboard/settings/roles/page.tsx` | مصفوفة الصلاحيات والأدوار |
| `/dashboard/settings/work-hours` | `src/app/dashboard/settings/work-hours/page.tsx` | إعدادات مواعيد العمل |
| `/dashboard/settings/checklists` | `src/app/dashboard/settings/checklists/page.tsx` | إدارة الدستور التشغيلي |
| `/dashboard/settings/templates` | `src/app/dashboard/settings/templates/page.tsx` | مكتبة القوالب المركزية |
| `/developer` | `src/app/developer/page.tsx` | كونسول المطور (Tenants Control) |
| `/apply/[companyId]` | `src/app/apply/[companyId]/page.tsx` | بوابة التوظيف العامة |
| `/join/[companyId]/[inviteId]` | `src/app/join/[companyId]/[inviteId]/page.tsx` | تفعيل حساب الموظف |

## 2. عناصر القائمة الجانبية (Sidebar Items)

- **الرئيسية**: `/dashboard`
- **CRM**:
  - الفرص البيعية: `/dashboard/crm`
  - العملاء: `/dashboard/clients`
- **المشاريع**:
  - المشاريع الجارية: `/dashboard/projects`
  - مستكشف المقايسات: `/dashboard/projects/boqs`
  - التقارير: `/dashboard/reports`
- **المشتريات**:
  - الموردين: `/dashboard/procurement/suppliers`
  - تحليل العروض (AI): `/dashboard/ai`
- **الموارد البشرية**:
  - ملفي الوظيفي: `/dashboard/hr/reports/dossier/[id]`
  - سجل الموظفين: `/dashboard/hr/employees`
  - الإجازات: `/dashboard/hr/leaves`
  - الرواتب: `/dashboard/hr/payroll`
- **المحاسبة**:
  - المطابقة البنكية: `/dashboard/accounting`
- **المخازن**:
  - المستودعات: `/dashboard/inventory`
- **الإعدادات**:
  - المستخدمين: `/dashboard/settings/users`
  - هوية المنشأة: `/dashboard/settings/company`
  - الدستور التشغيلي: `/dashboard/settings/checklists`
  - الصلاحيات: `/dashboard/settings/roles`
  - مواعيد العمل: `/dashboard/settings/work-hours`
  - الملف الشخصي: `/dashboard/settings/profile`

## 3. محركات الذكاء الاصطناعي (AI Flows)

- `accounting-assistant-flow`: توليد قيود اليومية وتقديم استشارات محاسبية.
- `analyze-supplier-quotes-flow`: تحليل ومقارنة عروض أسعار الموردين.
- `analyzeEmployeeDoc`: استخراج البيانات من وثائق الموظفين (ID, Passport).
- `cash-flow-projection-flow`: توقعات التدفق المالي بناءً على BOQ.
- `fetch-holidays-flow`: جلب العطلات الرسمية لدولة الكويت.
- `reconcile-bank-statement-flow`: المطابقة الذكية بين كشف البنك ودفتر الأستاذ.
- `translate-flow`: الترجمة الهندسية الاحترافية.

## 4. الخدمات البرمجية (Services)

- `AccountingIntegrationService`: الربط بين الرواتب والقيود المحاسبية.
- `AttendanceImportService`: محرك معالجة ملفات البصمة XLSX.
- `BOQExecutionService`: تتبع الإنجاز الميداني والكميات.
- `BOQReferenceService`: إدارة القاموس الهندسي الشجري السيادي.
- `ClientService`: إدارة سجلات العملاء وأرقام الملفات.
- `CommentService`: غرفة العمليات (War Room) والتعليقات.
- `DepartmentService`: الهيكل التنظيمي والوظائف.
- `DocumentService`: استنساخ المقايسات واعتماد الميزانيات.
- `EndOfServiceCalculator`: محرك حساب مستحقات نهاية الخدمة.
- `HRService`: إدارة شؤون الموظفين والتدقيق.
- `InventoryService`: المخازن والعهد الميدانية.
- `LeaveService`: محرك حساب أيام العمل الفعلية وإدارة الإجازات.
- `PayrollService`: توليد الرواتب الذكي ودمج البصمة.
- `PermissionService`: إدارة الاستئذانات وفحص التداخل.
- `ProcurementService`: أوامر الشراء والربط المالي بالمقايسة.
- `RoleService`: مصفوفة الصلاحيات والأدوار.
- `TechnicalPathService`: هندسة المسارات الفنية والمراحل.
- `WorkHoursService`: قواعد الدوام والورديات.

## 5. قواعد عدم التراجع (Non-Regression Rules)

**هام جداً للمبرمج:**
1. لا يجوز حذف أي صفحة (Page) أو مكون (Component) أو عنصر قائمة (Sidebar Item) مذكور في هذه الخريطة.
2. لا يجوز إخفاء أي ميزة باستخدام CSS أو تغيير شروط الظهور البرمجية إلا بموافقة صريحة.
3. أي إصلاح تقني (Bug Fix) يجب أن يحافظ على كامل الوظيفة الأصلية للميزة.
4. يعتبر هذا الملف هو "العهد الوظيفي" لنظام NovaFlow ERP؛ أي تعديل يكسر هذه الخريطة يعتبر فشلاً تقنياً.

---
*تم توليد هذا الحصر آلياً لضمان السيادة الوظيفية للمشروع.*
