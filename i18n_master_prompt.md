# البرومبت الخارق الشامل لكافة مفاتيح وكلمات النظام (100% Full Uncut Dictionary & Prompt Spec)
**النظام**: Nova2026-ERP
**الأسلوب**: أسلوب أودو المحاسبي والتنفيذي البسيط (Odoo ERP Standard)
**تعديل المسميات**: خالي تماماً من كلمة "السيادي" والتكلف اللغوي للذكاء الاصطناعي.

---

## 🎯 التعليمات الشاملة للمطور / للوكيل البرمجي (Master Prompt Instructions)

أنت مهندس أنظمة واجهات متقدم (Enterprise Frontend Architect). مهمتك هي تطهير كود نظام **Nova2026-ERP** بالكامل من جميع النصوص العربية والإنجليزية الصلبة (Hardcoded Strings)، وإلغاء كافة الشروط الثنائية المباشرة `isRtl ? '...' : '...'` البالغ عددها 1,371 تعبيراً، وتثبيت مفاتيح القاموس الموحد `t('key')` في جميع المكونات والشاشات الـ 13 بدون استثناء أي صفحة أو زر أو رأس جدول.

---

## 📚 الدليل الكامل والشامل لجميع مفاتيح وكلمات النظام (Complete Uncut Dictionary Specs)


### 📁 1. الهيكل العام والشريط الجانبي (Layout, Sidebar & Navigation)
**عدد المفاتيح والكلمات المستخرجة**: 45 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.profile.link.failed` | **تعذر تحميل ملف الصلاحيات** | Profile Link Failed | `app/dashboard/layout.tsx` |
| `inline.account.frozen` | **المنشأة مجمدة مؤقتاً** | Account Frozen | `app/dashboard/layout.tsx` |
| `inline.awaiting.activation` | **بانتظار تفعيل المنشأة** | Awaiting Activation | `app/dashboard/layout.tsx` |
| `inline.subscription.expired` | **انتهت صلاحية الوصول** | Subscription Expired | `app/dashboard/layout.tsx` |
| `logout` | **مترجم عبر logout** | Translated via logout | `app/dashboard/layout.tsx` |
| `inline.rotate.0` | **rotate-180** | rotate-0 | `app/dashboard/layout.tsx` |
| `inline.end` | **start** | end | `components/layout/user-nav.tsx` |
| `devConsole` | **مترجم عبر devConsole** | Translated via devConsole | `app/developer/layout.tsx` |
| `inline.flex.row` | **flex-row-reverse** | flex-row | `components/layout/dashboard-sidebar.tsx` |
| `dashboard` | **مترجم عبر dashboard** | Translated via dashboard | `components/layout/breadcrumb-nav.tsx` |
| `clients` | **مترجم عبر clients** | Translated via clients | `components/layout/breadcrumb-nav.tsx` |
| `projects` | **مترجم عبر projects** | Translated via projects | `components/layout/breadcrumb-nav.tsx` |
| `inventory` | **مترجم عبر inventory** | Translated via inventory | `components/layout/breadcrumb-nav.tsx` |
| `rolesPermissions` | **مترجم عبر rolesPermissions** | Translated via rolesPermissions | `components/layout/breadcrumb-nav.tsx` |
| `details` | **مترجم عبر details** | Translated via details | `components/layout/breadcrumb-nav.tsx` |
| `transactions` | **مترجم عبر transactions** | Translated via transactions | `components/layout/breadcrumb-nav.tsx` |
| `leaveRequests` | **مترجم عبر leaveRequests** | Translated via leaveRequests | `components/layout/breadcrumb-nav.tsx` |
| `payrollBatches` | **مترجم عبر payrollBatches** | Translated via payrollBatches | `components/layout/breadcrumb-nav.tsx` |
| `chartOfAccounts` | **مترجم عبر chartOfAccounts** | Translated via chartOfAccounts | `components/layout/breadcrumb-nav.tsx` |
| `receiptVouchers` | **مترجم عبر receiptVouchers** | Translated via receiptVouchers | `components/layout/breadcrumb-nav.tsx` |
| `journalEntries` | **مترجم عبر journalEntries** | Translated via journalEntries | `components/layout/breadcrumb-nav.tsx` |
| `boqExplorer` | **مترجم عبر boqExplorer** | Translated via boqExplorer | `components/layout/breadcrumb-nav.tsx` |
| `purchaseOrders` | **مترجم عبر purchaseOrders** | Translated via purchaseOrders | `components/layout/breadcrumb-nav.tsx` |
| `usersManagement` | **مترجم عبر usersManagement** | Translated via usersManagement | `components/layout/breadcrumb-nav.tsx` |
| `leads` | **مترجم عبر leads** | Translated via leads | `components/layout/dashboard-sidebar.tsx` |
| `appointments` | **مترجم عبر appointments** | Translated via appointments | `components/layout/dashboard-sidebar.tsx` |
| `visitsDossier` | **مترجم عبر visitsDossier** | Translated via visitsDossier | `components/layout/dashboard-sidebar.tsx` |
| `activeProjects` | **مترجم عبر activeProjects** | Translated via activeProjects | `components/layout/dashboard-sidebar.tsx` |
| `reports` | **مترجم عبر reports** | Translated via reports | `components/layout/dashboard-sidebar.tsx` |
| `construction` | **مترجم عبر construction** | Translated via construction | `components/layout/dashboard-sidebar.tsx` |
| `fieldRadar` | **مترجم عبر fieldRadar** | Translated via fieldRadar | `components/layout/dashboard-sidebar.tsx` |
| `workGroups` | **مترجم عبر workGroups** | Translated via workGroups | `components/layout/dashboard-sidebar.tsx` |
| `equipment` | **مترجم عبر equipment** | Translated via equipment | `components/layout/dashboard-sidebar.tsx` |
| `fieldLogs` | **مترجم عبر fieldLogs** | Translated via fieldLogs | `components/layout/dashboard-sidebar.tsx` |
| `aiAnalysis` | **مترجم عبر aiAnalysis** | Translated via aiAnalysis | `components/layout/dashboard-sidebar.tsx` |
| `inline.personal.workspace` | **شؤوني الوظيفية** | Personal Workspace | `components/layout/dashboard-sidebar.tsx` |
| `paymentVouchers` | **مترجم عبر paymentVouchers** | Translated via paymentVouchers | `components/layout/dashboard-sidebar.tsx` |
| `financialReports` | **مترجم عبر financialReports** | Translated via financialReports | `components/layout/dashboard-sidebar.tsx` |
| `userProfile` | **مترجم عبر userProfile** | Translated via userProfile | `components/layout/dashboard-sidebar.tsx` |
| `inline.left` | **right** | left | `components/layout/dashboard-sidebar.tsx` |
| `inline.left.full.ml.3` | **right-full mr-3** | left-full ml-3 | `components/layout/dashboard-sidebar.tsx` |
| `inline.right` | **left** | right | `components/layout/dashboard-sidebar.tsx` |
| `inline.tax...reg.no` | **الرقم الضريبي / السجل:** | TAX / REG NO: | `components/layout/print-wrapper.tsx` |
| `inline.generated.on` | **تاريخ الاستخراج** | Generated On | `components/layout/print-wrapper.tsx` |
| `inline.text.left` | **text-right** | text-left | `components/layout/user-nav.tsx` |

### 📁 2. المبيعات والعملاء والفرص (CRM & Contacts)
**عدد المفاتيح والكلمات المستخرجة**: 149 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.edit` | **تعديل** | Edit | `app/dashboard/clients/[id]/page.tsx` |
| `clients.title` | **مترجم عبر clients.title** | Translated via clients.title | `app/dashboard/clients/page.tsx` |
| `inline.isolated.view` | **عرض معزول** | Isolated View | `app/dashboard/clients/page.tsx` |
| `inline.your.assigned.files.only` | **تظهر ملفاتك المنسوبة فقط** | Your assigned files only | `app/dashboard/clients/page.tsx` |
| `clients.addNew` | **مترجم عبر clients.addNew** | Translated via clients.addNew | `app/dashboard/clients/page.tsx` |
| `common.search` | **مترجم عبر common.search** | Translated via common.search | `app/dashboard/clients/page.tsx` |
| `common.filter` | **مترجم عبر common.filter** | Translated via common.filter | `app/dashboard/clients/page.tsx` |
| `clients.table.profile` | **مترجم عبر clients.table.profile** | Translated via clients.table.profile | `app/dashboard/clients/page.tsx` |
| `clients.table.staff` | **مترجم عبر clients.table.staff** | Translated via clients.table.staff | `app/dashboard/clients/page.tsx` |
| `clients.table.contact` | **مترجم عبر clients.table.contact** | Translated via clients.table.contact | `app/dashboard/clients/page.tsx` |
| `clients.table.status` | **مترجم عبر clients.table.status** | Translated via clients.table.status | `app/dashboard/clients/page.tsx` |
| `inline.no.matching.clients.found` | **لا يوجد عملاء مطابقين للبحث.** | No matching clients found. | `app/dashboard/clients/page.tsx` |
| `inline.new.trans` | **فتح معاملة** | New Trans | `app/dashboard/clients/[id]/page.tsx` |
| `clients.details.transactions` | **مترجم عبر clients.details.transactions** | Translated via clients.details.transactions | `app/dashboard/clients/[id]/page.tsx` |
| `clients.details.location` | **مترجم عبر clients.details.location** | Translated via clients.details.location | `app/dashboard/clients/[id]/page.tsx` |
| `clients.details.history` | **مترجم عبر clients.details.history** | Translated via clients.details.history | `app/dashboard/clients/[id]/page.tsx` |
| `inline.left.6` | **right-6** | left-6 | `app/dashboard/clients/[id]/page.tsx` |
| `inline.left...4px` | **right-[-4px]** | left-[-4px] | `app/dashboard/clients/[id]/page.tsx` |
| `inline.milestone.mismatch` | **خطأ في توزيع الدفعات** | Milestone Mismatch | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.contract.approved...saved` | **تم اعتماد وحفظ العقد بنجاح** | Contract Approved & Saved | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.contract.not.found` | **العقد غير موجود** | Contract not found | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.official.engineering.contract` | **عقد خدمات هندسية رسمي** | Official Engineering Contract | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.commit...save` | **اعتماد وحفظ عرض السعر** | Commit & Save | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.edit.contract` | **تعديل البنود** | Edit Contract | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.engineering.services.agreement` | **عقد اتفاق خدمات هندسية** | Engineering Services Agreement | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `pricingMode` | **مترجم عبر pricingMode** | Translated via pricingMode | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `itemized` | **مترجم عبر itemized** | Translated via itemized | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `fixed` | **مترجم عبر fixed** | Translated via fixed | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `percentage` | **مترجم عبر percentage** | Translated via percentage | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.first.party` | **الطرف الأول (العميل)** | First Party: | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.subject` | **الموضوع /** | Subject: | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.payment.milestones...stages` | **جدول الدفعات والمراحل الفنية** | Payment Milestones & Stages | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.timing` | **التوقيت** | Timing | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.technical.link` | **الارتباط الفني** | Technical Link | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.contract.signing` | **توقيع العقد** | Contract Signing | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `at` | **مترجم عبر at** | Translated via at | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `before` | **مترجم عبر before** | Translated via before | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `during` | **مترجم عبر during** | Translated via during | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `after` | **مترجم عبر after** | Translated via after | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.signing` | **عند التوقيع** | Signing | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.field.stage` | **مرحلة ميدانية** | Field Stage | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.legal.clauses...obligations` | **البنود والالتزامات القانونية** | Legal Clauses & Obligations | `app/dashboard/clients/[id]/contracts/[cId]/page.tsx` |
| `inline.client.data.updated.successfully` | **تم تحديث بيانات العميل بنجاح.** | Client data updated successfully. | `app/dashboard/clients/[id]/edit/page.tsx` |
| `inline.unauthorized.to.edit.clients` | **لا تملك صلاحية تعديل بيانات العملاء.** | Unauthorized to edit clients. | `app/dashboard/clients/[id]/edit/page.tsx` |
| `inline.client.not.found` | **العميل غير موجود** | Client not found | `app/dashboard/clients/[id]/edit/page.tsx` |
| `inline.edit.client.profile` | **تعديل بيانات العميل** | Edit Client Profile | `app/dashboard/clients/[id]/edit/page.tsx` |
| `inline.budget.mismatch` | **خطأ في الميزانية** | Budget Mismatch | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.quotation.saved...committed` | **تم اعتماد وحفظ العرض بنجاح** | Quotation Saved & Committed | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.quotation.converted.to.contract` | **تم تحويل العرض إلى عقد رسمي** | Quotation converted to Contract | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.quotation.not.found` | **المستند غير موجود** | Quotation not found | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.official.quotation` | **عرض سعر رسمي** | Official Quotation | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `convertToContract` | **مترجم عبر convertToContract** | Translated via convertToContract | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.edit.template` | **تعديل البنود** | Edit Template | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.technical...financial.proposal` | **عرض سعر فني ومالي** | Technical & Financial Proposal | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.to` | **السادة المحترمون /** | To: | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.pricing...payments` | **جدول بنود التسعير والدفعات** | Pricing & Payments | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `inline.add.detail` | **وصف إضافي...** | Add detail... | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `contractSigning` | **مترجم عبر contractSigning** | Translated via contractSigning | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `totalQuoteValue` | **مترجم عبر totalQuoteValue** | Translated via totalQuoteValue | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `defaultTerms` | **مترجم عبر defaultTerms** | Translated via defaultTerms | `app/dashboard/clients/[id]/quotations/[qId]/page.tsx` |
| `tab` | **مترجم عبر tab** | Translated via tab | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `common.active` | **مترجم عبر common.active** | Translated via common.active | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `common.completed` | **مترجم عبر common.completed** | Translated via common.completed | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.reason.for.reverting.stage` | **سبب التراجع عن اكتمال المرحلة:** | Reason for reverting stage: | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.reverted` | **تم التراجع** | Reverted | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `common.saved` | **مترجم عبر common.saved** | Translated via common.saved | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.boq` | **المقايسة المعتمدة** | BOQ | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.create.boq` | **إنشاء مقايسة** | Create BOQ | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `projects.details.radar` | **مترجم عبر projects.details.radar** | Translated via projects.details.radar | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `projects.details.finance` | **مترجم عبر projects.details.finance** | Translated via projects.details.finance | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `projects.details.locked` | **مترجم عبر projects.details.locked** | Translated via projects.details.locked | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.contracts` | **إصدار العقد** | Contracts | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.boq.baseline` | **اعتماد المقايسة** | BOQ Baseline | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.awaiting.launch` | **بانتظار إطلاق المسار** | Awaiting Launch | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.launch.path` | **تفعيل المسار** | Launch Path | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.finish` | **إنهاء** | Finish | `app/dashboard/clients/[id]/transactions/[tId]/page.tsx` |
| `inline.activate.boq.template` | **تنشيط المقايسة المرجعية** | Activate BOQ Template | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.select.template` | **اختر القالب الهندسي** | Select Template | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.instantiate...start.study` | **تنشيط وبدء الدراسة** | Instantiate & Start Study | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.boq.study` | **دراسة الكميات** | BOQ Study | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `projects.boqExplorer.noBoqs` | **مترجم عبر projects.boqExplorer.noBoqs** | Translated via projects.boqExplorer.noBoqs | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.please.activate.a.boq.template.for.this.project.to.start.tracking.site.progress` | **يرجى تفعيل المقايسة المرجعية لهذا المشروع لبدء تتبع الإنجاز الميداني والارتباط المالي.** | Please activate a BOQ template for this project to start tracking site progress. | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.activate.new.boq` | **تنشيط مقايسة جديدة** | Activate New BOQ | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.registry` | **القاموس الهندسي** | Registry | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.sovereign.registry` | **القاموس الهندسي الموحد** | Sovereign Registry | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `common.close` | **مترجم عبر common.close** | Translated via common.close | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `common.confirm` | **مترجم عبر common.confirm** | Translated via common.confirm | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.new.vo` | **أمر تغييري** | New VO | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `common.order` | **مترجم عبر common.order** | Translated via common.order | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `common.code` | **مترجم عبر common.code** | Translated via common.code | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.work.item` | **بند العمل** | Work Item | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `common.unit` | **مترجم عبر common.unit** | Translated via common.unit | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.planned` | **المخطط** | Planned | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.prev` | **سابق** | Prev | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.curr` | **حالي** | Curr | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `common.all` | **مترجم عبر common.all** | Translated via common.all | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.rate` | **الفئة** | Rate | `app/dashboard/clients/[id]/transactions/[tId]/boq/page.tsx` |
| `inline.technical.transaction.opened` | **تم فتح المسار الفني بنجاح** | Technical Transaction Opened | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.redirecting.to.tracking.radar` | **جاري تحويلك لرادار المتابعة...** | Redirecting to tracking radar... | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.transaction.failed` | **فشل فتح المعاملة** | Transaction Failed | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.an.unexpected.error.occurred` | **حدث خطأ غير متوقع.** | An unexpected error occurred. | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.new.technical.transaction` | **فتح معاملة فنية جديدة** | New Technical Transaction | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.technical.path...assignment` | **تحديد المسار الفني والمهندس** | Technical Path & Assignment | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.target.department` | **القسم المسؤول** | Target Department | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.select.department` | **اختر القسم أولاً...** | Select Department... | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.assigned.engineer` | **المهندس المختص** | Assigned Engineer | `components/clients/client-form.tsx` |
| `inline.assign.engineer` | **تحديد المهندس...** | Assign Engineer... | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.search.engineer` | **بحث بالاسم أو الرقم...** | Search engineer... | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.confirm...open` | **فتح المسار الآن** | Confirm & Open | `app/dashboard/clients/[id]/transactions/new/page.tsx` |
| `inline.register.new.client` | **تسجيل عميل جديد** | Register New Client | `app/dashboard/clients/new/page.tsx` |
| `inline.open.new.commercial.file` | **فتح ملف تجاري جديد لربطه بالمعاملات الفنية** | Open new commercial file | `app/dashboard/clients/new/page.tsx` |
| `crm` | **مترجم عبر crm** | Translated via crm | `app/dashboard/crm/page.tsx` |
| `inline.manage.leads...sales` | **إدارة الفرص والمبيعات** | Manage Leads & Sales | `app/dashboard/crm/page.tsx` |
| `addLead` | **مترجم عبر addLead** | Translated via addLead | `app/dashboard/crm/page.tsx` |
| `company` | **مترجم عبر company** | Translated via company | `app/dashboard/crm/page.tsx` |
| `inline.create.lead` | **إضافة الفرصة** | Create Lead | `app/dashboard/crm/page.tsx` |
| `inline.filter.results` | **تصفية النتائج** | Filter Results | `app/dashboard/crm/page.tsx` |
| `status` | **مترجم عبر status** | Translated via status | `app/dashboard/crm/page.tsx` |
| `inline.no.results.found` | **لا يوجد نتائج.** | No results found. | `app/dashboard/crm/page.tsx` |
| `inline.date...time` | **التاريخ والوقت** | Date & Time | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.visit.type` | **نوع الزيارة** | Visit Type | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.details...technical.outputs` | **التفاصيل والمخرجات الفنية** | Details & Technical Outputs | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.responsible.staff` | **المسؤول الموثق** | Responsible Staff | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.hall.session` | **اجتماع قاعة** | Hall Session | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.arch.visit` | **زيارة معمارية** | Arch Visit | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.field.report` | **تقرير ميداني** | Field Report | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.site.progress.log` | **توثيق إنجاز ميداني** | Site Progress Log | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.no.specialized.records.found` | **لا يوجد سجلات في هذا القسم.** | No specialized records found. | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.universal.client.dossier` | **سجل تفاعل العملاء الشامل** | Universal Client Dossier | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `: ` | **مترجم عبر : ** | Translated via :  | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.universal.client.dossier.statement` | **كشف سجل تفاعل العميل الشامل** | Universal Client Dossier Statement | `app/dashboard/projects/reports/client-visits/page.tsx` |
| `inline.identity...legal` | **البيانات الأساسية والقانونية** | Identity & Legal | `components/clients/client-form.tsx` |
| `inline.client.access.scope.assignment` | **تحديد المسؤولية المعلوماتية للعميل** | Client Access Scope Assignment | `components/clients/client-form.tsx` |
| `inline.assign.responsible.engineer` | **اختر المهندس المسؤول...** | Assign responsible engineer... | `components/clients/client-form.tsx` |
| `inline.auto.assigned` | **ربط تلقائي بالمسؤول** | Auto-Assigned | `components/clients/client-form.tsx` |
| `inline.smart.location.radar` | **رادار الموقع والعنوان الذكي** | Smart Location Radar | `components/clients/client-form.tsx` |
| `inline.google.maps.link` | **رابط الموقع (GOOGLE MAPS)** | Google Maps Link | `components/clients/client-form.tsx` |
| `inline.open.map...search` | **فتح الخريطة والبحث** | Open Map & Search | `components/clients/client-form.tsx` |
| `inline.update.global.record` | **تحديث السجل المرجعي** | Update Global Record | `components/clients/client-form.tsx` |
| `inline.confirm.registration` | **حفظ ملف العميل** | Confirm Registration | `components/clients/client-form.tsx` |
| `./map-view` | **مترجم عبر ./map-view** | Translated via ./map-view | `components/clients/location-picker-dialog.tsx` |
| `inline.coordinates.detected` | **تم اكتشاف إحداثيات مباشرة** | Coordinates Detected | `components/clients/location-picker-dialog.tsx` |
| `inline.location.found` | **تم العثور على الموقع** | Location Found | `components/clients/location-picker-dialog.tsx` |
| `inline.location.not.found` | **لم يتم العثور على الموقع** | Location Not Found | `components/clients/location-picker-dialog.tsx` |
| `inline.try.adding.area.and.block.details` | **حاول كتابة اسم المنطقة والقطعة بشكل أوضح.** | Try adding area and block details. | `components/clients/location-picker-dialog.tsx` |
| `inline.search.engine.failure` | **fشل محرك البحث** | Search Engine Failure | `components/clients/location-picker-dialog.tsx` |
| `inline.location.fixed` | **تم تحديد موقعك الحالي** | Location Fixed | `components/clients/location-picker-dialog.tsx` |
| `inline.gps.access.denied` | **تم رفض الوصول للموقع** | GPS Access Denied | `components/clients/location-picker-dialog.tsx` |
| `inline.e.g..rawda.block.2..or.29.3..47.9` | **مثال: الروضة قطعة 2، أو 29.3, 47.9** | e.g. Rawda Block 2, or 29.3, 47.9 | `components/clients/location-picker-dialog.tsx` |

### 📁 3. المشاريع وجداول الكميات وأوامر التغيير (Projects, BOQ & Change Orders)
**عدد المفاتيح والكلمات المستخرجة**: 152 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.back` | **العودة للقائمة** | Back | `app/dashboard/accounting/vouchers/receipt/page.tsx` |
| `inline.payment.vouchers` | **سندات الصرف** | Payment Vouchers | `app/dashboard/accounting/vouchers/payment/page.tsx` |
| `inline.new.payment` | **سند صرف جديد** | New Payment | `app/dashboard/accounting/vouchers/payment/page.tsx` |
| `inline.issue.payment` | **إصدار سند صرف ذكي** | Issue Payment | `app/dashboard/accounting/vouchers/payment/page.tsx` |
| `inline.receipt.vouchers` | **سندات القبض** | Receipt Vouchers | `app/dashboard/accounting/vouchers/receipt/page.tsx` |
| `inline.new.receipt` | **سند جديد** | New Receipt | `app/dashboard/accounting/vouchers/receipt/page.tsx` |
| `inline.issue.receipt` | **إصدار سند قبض ذكي** | Issue Receipt | `app/dashboard/accounting/vouchers/receipt/page.tsx` |
| `inline.add` | **إضافة** | Add | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.qty` | **الكمية** | Qty | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.payment.confirmed` | **تم توثيق السداد** | Payment Confirmed | `components/transactions/transaction-documents-view.tsx` |
| `inline.mark.paid` | **توثيق سداد** | Mark Paid | `components/transactions/transaction-documents-view.tsx` |
| `inline.progress` | **إنجاز** | Progress | `components/transactions/comment-section.tsx` |
| `inline.en.us` | **ar-KW** | en-US | `components/transactions/comment-section.tsx` |
| `inline.search` | **بحث...** | Search... | `components/settings/checklists/boq-reference/boq-reference-selector.tsx` |
| `inline.items` | **بند** | Items | `app/dashboard/settings/templates/boq/page.tsx` |
| `inline.paid` | **دفع** | Paid | `components/transactions/document-manager-dialog.tsx` |
| `projects.title` | **مترجم عبر projects.title** | Translated via projects.title | `app/dashboard/projects/page.tsx` |
| `projects.radar` | **مترجم عبر projects.radar** | Translated via projects.radar | `app/dashboard/projects/page.tsx` |
| `projects.contracting` | **مترجم عبر projects.contracting** | Translated via projects.contracting | `app/dashboard/projects/page.tsx` |
| `projects.stats.portfolio` | **مترجم عبر projects.stats.portfolio** | Translated via projects.stats.portfolio | `app/dashboard/projects/page.tsx` |
| `projects.stats.claims` | **مترجم عبر projects.stats.claims** | Translated via projects.stats.claims | `app/dashboard/projects/page.tsx` |
| `projects.stats.collection` | **مترجم عبر projects.stats.collection** | Translated via projects.stats.collection | `app/dashboard/projects/page.tsx` |
| `projects.table.project` | **مترجم عبر projects.table.project** | Translated via projects.table.project | `app/dashboard/projects/page.tsx` |
| `projects.table.progress` | **مترجم عبر projects.table.progress** | Translated via projects.table.progress | `app/dashboard/projects/page.tsx` |
| `projects.table.billing` | **مترجم عبر projects.table.billing** | Translated via projects.table.billing | `app/dashboard/projects/page.tsx` |
| `projects.table.status` | **مترجم عبر projects.table.status** | Translated via projects.table.status | `app/dashboard/projects/page.tsx` |
| `inline.no.active.projects` | **لا يوجد مشاريع جارية.** | No active projects. | `app/dashboard/projects/page.tsx` |
| `common.confirmDelete` | **مترجم عبر common.confirmDelete** | Translated via common.confirmDelete | `app/dashboard/projects/boqs/page.tsx` |
| `common.deleted` | **مترجم عبر common.deleted** | Translated via common.deleted | `app/dashboard/projects/boqs/page.tsx` |
| `projects.boqExplorer` | **مترجم عبر projects.boqExplorer** | Translated via projects.boqExplorer | `app/dashboard/projects/boqs/page.tsx` |
| `inline.manage.bill.of.quantities.and.baseline.budgets` | **إدارة واعتماد جداول الكميات والميزانيات المرجعية** | Manage bill of quantities and baseline budgets | `app/dashboard/projects/boqs/page.tsx` |
| `projects.boqNumber` | **مترجم عبر projects.boqNumber** | Translated via projects.boqNumber | `app/dashboard/projects/boqs/page.tsx` |
| `projects.clientName` | **مترجم عبر projects.clientName** | Translated via projects.clientName | `app/dashboard/projects/boqs/page.tsx` |
| `projects.budget` | **مترجم عبر projects.budget** | Translated via projects.budget | `app/dashboard/projects/boqs/page.tsx` |
| `projects.status` | **مترجم عبر projects.status** | Translated via projects.status | `app/dashboard/projects/boqs/page.tsx` |
| `inline.no.boqs.registered.yet` | **لا يوجد مقايسات مسجلة حالياً.** | No BOQs registered yet. | `app/dashboard/projects/boqs/page.tsx` |
| `inline.alert` | **تنبيه** | Alert | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.unit.type.is.required.for.executable.items` | **يجب اختيار وحدة قياس للبند التنفيذي** | Unit type is required for executable items | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.activity..service..and.sub.service.must.be.set` | **يجب اكتمال النشاط والخدمة والمسار الفني أولاً** | Activity, Service, and Sub-Service must be set | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.at.least.one.technical.stage.is.required.for.field.logs` | **يجب اختيار مرحلة فنية واحدة على الأقل لتمكين المهندس من تسجيل الإنجاز** | At least one technical stage is required for field logs | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.sovereign.reference.tree` | **شجرة بنود الأعمال المرجعية** | Sovereign Reference Tree | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.add.root.node` | **إضافة قسم رئيسي** | Add Root Node | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.registry.is.empty` | **القاموس فارغ حالياً** | Registry is Empty | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.edit.registry.node` | **تعديل بيانات العقدة** | Edit Registry Node | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.add.new.node` | **إضافة عقدة جديدة** | Add New Node | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.node.professional.title` | **المسمى الهندسي / التجاري** | Node Professional Title | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.operational.context.inheritance` | **الارتباط التشغيلي الموروث** | Operational Context Inheritance | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.stages.linked` | **مرحلة مرتبطة** | Stages Linked | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.click.to.review.edit.stages` | **اضغط لعرض/تعديل المراحل** | Click to review/edit stages | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.select.execution.stages` | **--- اختر مراحل التنفيذ لهذا البند ---** | --- Select execution stages --- | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.search.stage` | **ابحث باسم المرحلة (مثلاً: حفر، قواعد)...** | Search stage... | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.no.stages.found.in.this.technical.path` | **لم يتم العثور على مراحل في هذا المسار الفني** | No stages found in this technical path | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.clear.all.links` | **إلغاء كافة الروابط** | Clear All Links | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.default.target.stage` | **مرحلة الربط الافتراضية** | Default Target Stage | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.used.as.primary.choice.in.field.logs` | **سيتم استخدامها كخيار أول في سجلات المهندس** | Used as primary choice in field logs | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.this.node.has.no.linked.technical.path..link.parent.to.a.sub.service.to.assign.execution.stages` | **هذا البند غير تابع لمسار فني (SubService). يرجى ربط العقدة الأب بمسار محدد أولاً لتتمكن من تعيين مراحل التنفيذ.** | This node has no linked Technical Path. Link parent to a sub-service to assign execution stages. | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.reference.unit.price..kwd` | **سعر الوحدة المرجعي (KWD)** | Reference Unit Price (KWD) | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.standard.technical.specification` | **المواصفة الفنية القياسية** | Standard Technical Specification | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.executable.item` | **بند تنفيذي (Item)** | Executable Item | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `isActive` | **مترجم عبر isActive** | Translated via isActive | `app/dashboard/settings/checklists/boq-nodes/page.tsx` |
| `inline.confirm.delete` | **تأكيد حذف المستند** | Confirm Delete | `components/transactions/transaction-documents-view.tsx` |
| `inline.delete.now` | **نعم، احذف نهائياً** | Delete Now | `components/transactions/transaction-documents-view.tsx` |
| `inline.name.required` | **الاسم مطلوب** | Name required | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.technical.path.required` | **يجب اختيار المسار الفني المباشر للربط** | Technical Path required | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.item.already.added` | **البند موجود مسبقاً** | Item already added | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.item.added.successfully` | **تمت إضافة البند بنجاح** | Item added successfully | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.added` | **مضاف** | Added | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.spec` | **المواصفة...** | Spec... | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.financial.link` | **اختيار المرحلة المالية** | Financial Link | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.unassigned..technical.only` | **--- بدون تعيين مالي ---** | --- Unassigned (Technical Only) --- | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.boq.template.engineering` | **هندسة القوالب الشجرية** | BOQ Template Engineering | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.current.sum` | **إجمالي البنود الحالية** | Current Sum | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.direct.matching.key` | **المطابقة والربط المباشر** | Direct Matching Key | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.activity.type` | **النشاط الرئيسي** | Activity Type | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.main.service` | **الخدمة الأساسية** | Main Service | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.specific.technical.path` | **المسار الفني الدقيق** | Specific Technical Path | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.boq.work.items.grid` | **بنود وجداول الأعمال المعتمدة** | BOQ Work Items Grid | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.registry.explorer` | **مستكشف القاموس السيادي** | Registry Explorer | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.sovereign.reference.registry` | **القاموس الهندسي الموحد** | Sovereign Reference Registry | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.search.registry` | **ابحث بالاسم أو الكود المرجعي...** | Search registry... | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.syncing.links` | **جاري تحديث الروابط...** | Syncing links... | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.sync.complete` | **تمت المزامنة** | Sync complete | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.sync` | **مزامنة** | Sync | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.work.item.description` | **وصف بند العمل** | Work Item Description | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.technical.specification` | **المواصفة الفنية** | Technical Specification | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.financial.trigger` | **الارتباط المالي** | Financial Trigger | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.unit` | **الوحدة** | Unit | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.rate..kwd` | **الفئة (د.ك)** | Rate (KWD) | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.subtotal` | **الإجمالي** | Subtotal | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.grid.is.empty` | **المقايسة فارغة** | Grid is Empty | `app/dashboard/settings/templates/boq/boq-template-form.tsx` |
| `inline.manage.standard.work.items.and.reference.quantities.for.projects` | **إدارة بنود الأعمال القياسية والكميات المرجعية للمشاريع.** | Manage standard work items and reference quantities for projects. | `app/dashboard/settings/templates/boq/page.tsx` |
| `inline.new.boq.template` | **قالب BOQ جديد** | New BOQ Template | `app/dashboard/settings/templates/boq/page.tsx` |
| `inline.template...code` | **القالب / الكود** | Template / Code | `app/dashboard/settings/templates/boq/page.tsx` |
| `inline.sections` | **الأقسام** | Sections | `app/dashboard/settings/templates/boq/page.tsx` |
| `inline.no.boq.templates.found` | **لا يوجد قوالب BOQ مسجلة.** | No BOQ templates found. | `app/dashboard/settings/templates/boq/page.tsx` |
| `inline.active` | **النشاط** | Active | `components/transactions/comment-section.tsx` |
| `inline.new` | **إصدار جديد** | New | `components/transactions/transaction-documents-view.tsx` |
| `inline.root.reference.section` | **القسم المرجعي الرئيسي** | Root Reference Section | `components/settings/checklists/boq-reference/boq-reference-selector.tsx` |
| `inline.select.section` | **--- اختر القسم ---** | --- Select Section --- | `components/settings/checklists/boq-reference/boq-reference-selector.tsx` |
| `inline.available.work.items` | **البنود والتعريفات المتاحة** | Available Work Items | `components/settings/checklists/boq-reference/boq-reference-selector.tsx` |
| `inline.search.item` | **--- ابحث عن بند ---** | --- Search Item --- | `components/settings/checklists/boq-reference/boq-reference-selector.tsx` |
| `inline.search.by.name.or.code` | **بحث بالاسم أو الكود...** | Search by name or code... | `components/settings/checklists/boq-reference/boq-reference-selector.tsx` |
| `inline.war.room` | **غرفة العمليات** | War Room | `components/transactions/comment-section.tsx` |
| `inline.view.all` | **عرض الكل** | View All | `components/transactions/comment-section.tsx` |
| `inline.timeline` | **الزمني** | Timeline | `components/transactions/comment-section.tsx` |
| `inline.archive` | **الأرشيف** | Archive | `components/transactions/comment-section.tsx` |
| `inline.time` | **الوقت** | Time | `components/transactions/comment-section.tsx` |
| `inline.awaiting.notes` | **بانتظار الملاحظات الفنية** | Awaiting notes... | `components/transactions/comment-section.tsx` |
| `inline.write.a.technical.note` | **اكتب تعليقاً في سجل المتابعة...** | Write a technical note... | `components/transactions/comment-section.tsx` |
| `inline.engineer` | **مهندس** | Engineer | `components/transactions/comment-section.tsx` |
| `inline.revision` | **تعديل مسار** | Revision | `components/transactions/comment-section.tsx` |
| `inline.quotation` | **عرض سعر** | Quotation | `components/transactions/transaction-documents-view.tsx` |
| `inline.contract` | **عقد** | Contract | `components/transactions/transaction-documents-view.tsx` |
| `inline.draft.ready` | **تم تجهيز المسودة** | Draft Ready | `components/transactions/transaction-documents-view.tsx` |
| `inline.document.deleted` | **تم حذف المستند بنجاح** | Document deleted | `components/transactions/document-manager-dialog.tsx` |
| `inline.quotations` | **عروض الأسعار والمناقصات** | Quotations | `components/transactions/transaction-documents-view.tsx` |
| `inline.formal.contracts` | **العقود الرسمية والملاحق** | Formal Contracts | `components/transactions/transaction-documents-view.tsx` |
| `inline.new.draft.issuance` | **إصدار مسودة جديدة** | New Draft Issuance | `components/transactions/document-manager-dialog.tsx` |
| `inline.generate...design` | **تجهيز المسودة للمراجعة** | Generate & Design | `components/transactions/document-manager-dialog.tsx` |
| `inline.document.history` | **الأرشيف المستندي** | Document History | `components/transactions/document-manager-dialog.tsx` |
| `inline.no.historical.documents.found` | **لا يوجد سجلات سابقة.** | No historical documents found. | `components/transactions/document-manager-dialog.tsx` |
| `inline.confirm.deletion` | **نعم، احذف المستند** | Confirm Deletion | `components/transactions/document-manager-dialog.tsx` |
| `inline.deleted` | **تم الحذف بنجاح** | Deleted | `components/transactions/transaction-documents-view.tsx` |
| `inline.records` | **سجلات** | Records | `components/transactions/transaction-documents-view.tsx` |
| `inline.no.documents.yet` | **لا يوجد مستندات حالياً.** | No documents yet. | `components/transactions/transaction-documents-view.tsx` |
| `inline.issue.quote` | **إصدار عرض سعر** | Issue Quote | `components/transactions/transaction-documents-view.tsx` |
| `inline.issue.contract` | **إصدار عقد جديد** | Issue Contract | `components/transactions/transaction-documents-view.tsx` |
| `inline.create.draft` | **تجهيز المسودة الآن** | Create Draft | `components/transactions/transaction-documents-view.tsx` |
| `inline.are.you.sure..this.document.will.be.permanently.removed.from.the.archive` | **هل أنت متأكد؟ سيتم حذف المستند نهائياً من الأرشيف ولا يمكن التراجع.** | Are you sure? This document will be permanently removed from the archive. | `components/transactions/transaction-documents-view.tsx` |
| `projects.boqExplorer.sections` | **مترجم عبر projects.boqExplorer.sections** | Translated via projects.boqExplorer.sections | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.voTitle` | **مترجم عبر projects.voManager.voTitle** | Translated via projects.voManager.voTitle | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.addAdjustment` | **مترجم عبر projects.voManager.addAdjustment** | Translated via projects.voManager.addAdjustment | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.title` | **مترجم عبر projects.voManager.title** | Translated via projects.voManager.title | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.reason` | **مترجم عبر projects.voManager.reason** | Translated via projects.voManager.reason | `components/transactions/vo-manager-dialog.tsx` |
| `projects.boqExplorer.voSummary` | **مترجم عبر projects.boqExplorer.voSummary** | Translated via projects.boqExplorer.voSummary | `components/transactions/vo-manager-dialog.tsx` |
| `projects.boqExplorer.action` | **مترجم عبر projects.boqExplorer.action** | Translated via projects.boqExplorer.action | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.increase` | **مترجم عبر projects.voManager.increase** | Translated via projects.voManager.increase | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.decrease` | **مترجم عبر projects.voManager.decrease** | Translated via projects.voManager.decrease | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.omit` | **مترجم عبر projects.voManager.omit** | Translated via projects.voManager.omit | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.newItem` | **مترجم عبر projects.voManager.newItem** | Translated via projects.voManager.newItem | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.targetItem` | **مترجم عبر projects.voManager.targetItem** | Translated via projects.voManager.targetItem | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.deltaQty` | **مترجم عبر projects.voManager.deltaQty** | Translated via projects.voManager.deltaQty | `components/transactions/vo-manager-dialog.tsx` |
| `projects.boqExplorer.rate` | **مترجم عبر projects.boqExplorer.rate** | Translated via projects.boqExplorer.rate | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.financialSection` | **مترجم عبر projects.voManager.financialSection** | Translated via projects.voManager.financialSection | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.executionPath` | **مترجم عبر projects.voManager.executionPath** | Translated via projects.voManager.executionPath | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.linkExisting` | **مترجم عبر projects.voManager.linkExisting** | Translated via projects.voManager.linkExisting | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.injectNew` | **مترجم عبر projects.voManager.injectNew** | Translated via projects.voManager.injectNew | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.stageName` | **مترجم عبر projects.voManager.stageName** | Translated via projects.voManager.stageName | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.stageCode` | **مترجم عبر projects.voManager.stageCode** | Translated via projects.voManager.stageCode | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.insertAfter` | **مترجم عبر projects.voManager.insertAfter** | Translated via projects.voManager.insertAfter | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.parallel` | **مترجم عبر projects.voManager.parallel** | Translated via projects.voManager.parallel | `components/transactions/vo-manager-dialog.tsx` |
| `projects.voManager.confirmVO` | **مترجم عبر projects.voManager.confirmVO** | Translated via projects.voManager.confirmVO | `components/transactions/vo-manager-dialog.tsx` |

### 📁 4. العمليات الميدانية والموقع (Field Operations & Visits)
**عدد المفاتيح والكلمات المستخرجة**: 35 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.total` | **إجمالي اليوم** | Total | `components/construction/construction-bookings-view.tsx` |
| `construction.radar` | **مترجم عبر construction.radar** | Translated via construction.radar | `app/dashboard/construction/bookings/page.tsx` |
| `inline.coordinate.site.engineers.and.work.crews.in.construction.project.sites` | **إدارة وتنسيق أطقم العمل والمهندسين في مواقع المشاريع الإنشائية.** | Coordinate site engineers and work crews in construction project sites. | `app/dashboard/construction/bookings/page.tsx` |
| `inline.print.field.radar` | **طباعة الرادار الميداني** | Print Field Radar | `app/dashboard/construction/bookings/page.tsx` |
| `construction.reports` | **مترجم عبر construction.reports** | Translated via construction.reports | `app/dashboard/construction/field-visits/page.tsx` |
| `inline.archive.of.field.logs.and.resources` | **أرشيف تقارير الإنجاز الميداني الموثقة بالموارد.** | Archive of field logs and resources. | `app/dashboard/construction/field-visits/page.tsx` |
| `inline.new.report` | **تقرير جديد** | New Report | `app/dashboard/construction/field-visits/page.tsx` |
| `inline.engineer.responses.saved` | **تم تسجيل ردود المسؤول بنجاح** | Engineer Responses Saved | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `inline.progress.verified` | **تم اعتماد الإنجاز** | Progress Verified | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `inline.field.log` | **سجل إنجاز ميداني** | Field Log | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `inline.verify` | **اعتماد للاستحقاق** | Verify | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `inline.response` | **رد المسؤول** | Response | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `inline.save` | **حفظ الطاقم** | Save | `app/dashboard/construction/groups/page.tsx` |
| `inline.field.progress.statement` | **سجل إنجاز ميداني** | Field Progress Statement | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `inline.technical.progress` | **تحليل الإنجاز الفني** | Technical Progress | `app/dashboard/construction/field-visits/[id]/page.tsx` |
| `cloneId` | **مترجم عبر cloneId** | Translated via cloneId | `app/dashboard/construction/field-visits/new/page.tsx` |
| `inline.photos.uploaded` | **تم رفع الصور** | Photos uploaded | `app/dashboard/construction/field-visits/new/page.tsx` |
| `common.saveReport` | **مترجم عبر common.saveReport** | Translated via common.saveReport | `app/dashboard/construction/field-visits/new/page.tsx` |
| `construction.context` | **مترجم عبر construction.context** | Translated via construction.context | `app/dashboard/construction/field-visits/new/page.tsx` |
| `common.clients` | **مترجم عبر common.clients** | Translated via common.clients | `app/dashboard/construction/field-visits/new/page.tsx` |
| `common.projects` | **مترجم عبر common.projects** | Translated via common.projects | `app/dashboard/construction/field-visits/new/page.tsx` |
| `common.date` | **مترجم عبر common.date** | Translated via common.date | `app/dashboard/construction/field-visits/new/page.tsx` |
| `construction.siteProgress` | **مترجم عبر construction.siteProgress** | Translated via construction.siteProgress | `app/dashboard/construction/field-visits/new/page.tsx` |
| `common.photos` | **مترجم عبر common.photos** | Translated via common.photos | `app/dashboard/construction/field-visits/new/page.tsx` |
| `construction.groups` | **مترجم عبر construction.groups** | Translated via construction.groups | `app/dashboard/construction/groups/page.tsx` |
| `inline.field.crew.management` | **إدارة أطقم الميدان والتخصصات.** | Field crew management. | `app/dashboard/construction/groups/page.tsx` |
| `inline.new.group` | **تكوين طاقم عمل** | New Group | `app/dashboard/construction/groups/page.tsx` |
| `inline.setup.crew` | **إعداد طاقم جديد** | Setup Crew | `app/dashboard/construction/groups/page.tsx` |
| `inline.morning.session` | **الفترة الصباحية ☀️** | Morning Session | `components/construction/construction-bookings-view.tsx` |
| `inline.evening.session` | **الفترة المسائية 🌆** | Evening Session | `components/construction/construction-bookings-view.tsx` |
| `inline.leave` | **إجازة** | Leave | `components/construction/construction-bookings-view.tsx` |
| `inline.absent` | **غائب** | Absent | `components/construction/construction-bookings-view.tsx` |
| `inline.perm` | **استئذان** | Perm | `components/construction/construction-bookings-view.tsx` |
| `inline.done` | **مكتملة** | Done | `components/construction/construction-bookings-view.tsx` |
| `inline.engineers` | **المهندسين** | Engineers | `components/construction/construction-bookings-view.tsx` |

### 📁 5. المعدات والآليات (Equipment & Fleet)
**عدد المفاتيح والكلمات المستخرجة**: 9 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `construction.equipment` | **مترجم عبر construction.equipment** | Translated via construction.equipment | `app/dashboard/equipment/page.tsx` |
| `inline.manage.owned.and.rented.assets` | **إدارة سجل الأصول والمعدات المملوكة والمستأجرة.** | Manage owned and rented assets. | `app/dashboard/equipment/page.tsx` |
| `inline.new.asset` | **إضافة أصل جديد** | New Asset | `app/dashboard/equipment/page.tsx` |
| `inline.edit.asset.details` | **تعديل بيانات الأصل** | Edit Asset Details | `app/dashboard/equipment/[id]/edit/page.tsx` |
| `inline.register.new.asset` | **تسجيل أصل تشغيلي جديد** | Register New Asset | `app/dashboard/equipment/new/page.tsx` |
| `inline.register.owned.or.rented.equipment` | **إدراج معدة مملوكة أو مستأجرة وتحديد مسارها المالي.** | Register owned or rented equipment. | `app/dashboard/equipment/new/page.tsx` |
| `inline.asset.identity` | **بيانات الأصل** | Asset Identity | `components/equipment/equipment-form.tsx` |
| `inline.financial.metrics` | **المعطيات المالية** | Financial Metrics | `components/equipment/equipment-form.tsx` |
| `inline.save.details` | **حفظ البيانات** | Save Details | `components/equipment/equipment-form.tsx` |

### 📁 6. المشتريات والموردون وأوامر الشراء (Purchasing & Vendors)
**عدد المفاتيح والكلمات المستخرجة**: 74 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.quote.analyzer` | **محلل عروض الأسعار** | Quote Analyzer | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.finance` | **الحالة المالية** | Finance | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.amount` | **الإجمالي** | Amount | `app/dashboard/procurement/orders/page.tsx` |
| `inline.add.item` | **إضافة صنف** | Add Item | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.pending` | **بانتظار السداد** | PENDING | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.date` | **التاريخ** | Date | `app/dashboard/procurement/orders/page.tsx` |
| `inline.confirm...save` | **تأكيد وحفظ الطلب** | Confirm & Save | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.analyze.now` | **تحليل ومقارنة العروض** | Analyze Now | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.filter` | **تصفية** | Filter | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.missing.data` | **بيانات ناقصة** | Missing Data | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.active.suppliers` | **الموردين النشطين** | Active Suppliers | `app/dashboard/procurement/page.tsx` |
| `inline.purchase.orders` | **أوامر الشراء (POs)** | Purchase Orders | `app/dashboard/procurement/orders/page.tsx` |
| `inline.total.spend` | **إجمالي المشتريات** | Total Spend | `app/dashboard/procurement/page.tsx` |
| `inline.pending.quotes` | **عروض قيد التحليل** | Pending Quotes | `app/dashboard/procurement/page.tsx` |
| `inline.ai.quote.analysis` | **تحليل عرض سعر ذكي** | AI Quote Analysis | `app/dashboard/procurement/page.tsx` |
| `inline.ai.price.comparison` | **مقارنة العروض بالذكاء الاصطناعي** | AI Price comparison | `app/dashboard/procurement/page.tsx` |
| `inline.new.purchase.order` | **إصدار أمر شراء** | New Purchase Order | `app/dashboard/procurement/page.tsx` |
| `inline.issue.official.po` | **إنشاء أمر توريد رسمي لمورد** | Issue official PO | `app/dashboard/procurement/page.tsx` |
| `inline.orders.history` | **سجل الأوامر** | Orders History | `app/dashboard/procurement/page.tsx` |
| `inline.view.all.purchase.history` | **عرض ومتابعة كافة الطلبات** | View all purchase history | `app/dashboard/procurement/page.tsx` |
| `procurement` | **مترجم عبر procurement** | Translated via procurement | `app/dashboard/procurement/page.tsx` |
| `inline.smart.supply.chain.management.and.procurement.analytics` | **إدارة سلسلة التوريد الذكية والتحليلات المالية للمشتريات** | Smart supply chain management and procurement analytics | `app/dashboard/procurement/page.tsx` |
| `inline.get.started` | **ابدأ الآن** | Get Started | `app/dashboard/procurement/page.tsx` |
| `inline.recent.pos` | **آخر أوامر الشراء** | Recent POs | `app/dashboard/procurement/page.tsx` |
| `inline.no.active.purchase.orders.found` | **لا يوجد أوامر شراء نشطة حالياً.** | No active purchase orders found. | `app/dashboard/procurement/page.tsx` |
| `inline.spending.by.category` | **تحليل الإنفاق حسب التصنيف** | Spending by Category | `app/dashboard/procurement/page.tsx` |
| `inline.analytics.charts.coming.soon` | **سيتم عرض المخططات البيانية قريباً.** | Analytics charts coming soon. | `app/dashboard/procurement/page.tsx` |
| `contracts` | **مترجم عبر contracts** | Translated via contracts | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.unified.view.of.all.formal.client.agreements` | **عرض شامل لكافة العقود الرسمية المبرمة مع العملاء.** | Unified view of all formal client agreements. | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.issue.new.contract` | **إصدار عقد لعميل** | Issue New Contract | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.active..paid` | **عقود مفعلة (مدفوعة)** | Active (Paid) | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.pending.payment` | **بانتظار السداد** | Pending Payment | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.total.count` | **إجمالي السجلات** | Total Count | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.search.contracts` | **بحث باسم العقد أو العميل...** | Search contracts... | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.contract...client` | **العقد / العميل المالك** | Contract / Client | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.total.amount` | **القيمة الإجمالية** | Total Amount | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.no.contracts.found` | **لا يوجد عقود مسجلة.** | No contracts found. | `app/dashboard/procurement/contracts/page.tsx` |
| `inline.track.supply.orders..approvals..and.field.delivery.status` | **تتبع طلبات التوريد، الاعتمادات، وحالة الاستلام الميداني.** | Track supply orders, approvals, and field delivery status. | `app/dashboard/procurement/orders/page.tsx` |
| `inline.new.order` | **أمر شراء جديد** | New Order | `app/dashboard/procurement/orders/page.tsx` |
| `inline.search.by.po.number.or.supplier` | **بحث برقم الأمر أو المورد...** | Search by PO number or supplier... | `app/dashboard/procurement/orders/page.tsx` |
| `inline.po.....supplier` | **رقم الأمر / المورد** | PO # / Supplier | `app/dashboard/procurement/orders/page.tsx` |
| `inline.no.purchase.orders.found` | **لا يوجد أوامر شراء.** | No purchase orders found. | `app/dashboard/procurement/orders/page.tsx` |
| `projectId` | **مترجم عبر projectId** | Translated via projectId | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.purchase.order.created` | **تم إنشاء أمر الشراء بنجاح** | Purchase Order Created | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.create.smart.po` | **إصدار أمر شراء ذكي** | Create Smart PO | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.supplier.link` | **بيانات المورد** | Supplier Link | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.verified.supplier` | **المورد المعتمد** | Verified Supplier | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.link.to.boq` | **ربط التكلفة بالمقايسة** | Link to BOQ | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.select.boq` | **اختر المقايسة...** | Select BOQ... | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.order.date` | **تاريخ الأمر** | Order Date | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.supply.items.grid` | **بنود أمر التوريد** | Supply Items Grid | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.warehouse.item` | **الصنف المرجعي** | Warehouse Item | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.unit.rate` | **سعر الوحدة** | Unit Rate | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.total.net.purchase` | **إجمالي قيمة أمر الشراء** | Total Net Purchase | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.values.will.be.posted.to.ledger.automatically.upon.approval` | **سيتم ترحيل هذه القيم لدفتر الأستاذ فور اعتماد المدير للأمر.** | Values will be posted to ledger automatically upon approval. | `app/dashboard/procurement/orders/new/page.tsx` |
| `inline.analysis.complete` | **تم التحليل بنجاح** | Analysis Complete | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.genai` | **ذكاء اصطناعي** | GenAI | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.quote.data` | **بيانات العرض** | Quote Data | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.add.quote` | **إضافة عرض مورد** | Add Quote | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.ai.analysis` | **توصية Nova AI** | AI Analysis | `app/dashboard/procurement/quotes/page.tsx` |
| `inline.waiting.for.quotes` | **بانتظار المدخلات** | Waiting for Quotes | `app/dashboard/procurement/quotes/page.tsx` |
| `suppliers` | **مترجم عبر suppliers** | Translated via suppliers | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.manage.supplier.database.and.performance` | **إدارة قاعدة بيانات الموردين وتقييم الأداء.** | Manage supplier database and performance. | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.new.supplier` | **مورد جديد** | New Supplier | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.add.new.supplier` | **إضافة مورد معتمد** | Add New Supplier | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.register.supplier` | **حفظ المورد** | Register Supplier | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.suppliers` | **إجمالي الموردين** | Suppliers | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.active.orders` | **طلبات نشطة** | Active Orders | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.search.suppliers` | **بحث...** | Search suppliers... | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.supplier` | **المورد** | Supplier | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.category` | **التصنيف** | Category | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.contact` | **الاتصال** | Contact | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.rating` | **التقييم** | Rating | `app/dashboard/procurement/suppliers/page.tsx` |
| `inline.no.suppliers.found` | **لا يوجد موردين.** | No suppliers found. | `app/dashboard/procurement/suppliers/page.tsx` |

### 📁 7. المحاسبة وشجرة الحسابات والقيود والسندات (Accounting, COA & Vouchers)
**عدد المفاتيح والكلمات المستخرجة**: 18 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `saved` | **مترجم عبر saved** | Translated via saved | `app/dashboard/accounting/page.tsx` |
| `inline.smart.recon` | **مطابقة ذكية** | Smart Recon | `app/dashboard/accounting/page.tsx` |
| `inline.coa.initialized` | **تمت تهيئة الدليل بنجاح** | COA Initialized | `app/dashboard/accounting/coa/page.tsx` |
| `error` | **مترجم عبر error** | Translated via error | `app/dashboard/accounting/coa/page.tsx` |
| `inline.sovereign.coa` | **دليل الحسابات السيادي** | Sovereign COA | `app/dashboard/accounting/coa/page.tsx` |
| `inline.init.construction.coa` | **تهيئة الدليل الإنشائي** | Init Construction COA | `app/dashboard/accounting/coa/page.tsx` |
| `inline.add.root.account` | **حساب رئيسي** | Add Root Account | `app/dashboard/accounting/coa/page.tsx` |
| `search` | **مترجم عبر search** | Translated via search | `app/dashboard/accounting/coa/page.tsx` |
| `inline.coa.is.empty` | **الدليل المحاسبي فارغ** | COA is Empty | `app/dashboard/accounting/coa/page.tsx` |
| `inline.activate.construction.coa` | **تفعيل الدليل الإنشائي** | Activate Construction COA | `app/dashboard/accounting/coa/page.tsx` |
| `inline.add.new.account` | **إضافة حساب جديد** | Add New Account | `app/dashboard/accounting/coa/page.tsx` |
| `code` | **مترجم عبر code** | Translated via code | `app/dashboard/accounting/coa/page.tsx` |
| `inline.is.it.a.group` | **حساب مجموعة؟** | Is it a Group? | `app/dashboard/accounting/coa/page.tsx` |
| `inline.enable.to.allow.children.accounts` | **تفعيل هذا الخيار يسمح بإضافة حسابات فرعية تحته.** | Enable to allow children accounts. | `app/dashboard/accounting/coa/page.tsx` |
| `inline.commit.account` | **اعتماد الحساب** | Commit Account | `app/dashboard/accounting/coa/page.tsx` |
| `T` | **مترجم عبر T** | Translated via T | `app/dashboard/accounting/journals/page.tsx` |
| `inline.journal.entries` | **قيود اليومية** | Journal Entries | `app/dashboard/accounting/journals/page.tsx` |
| `inline.new.entry` | **قيد يدوي جديد** | New Entry | `app/dashboard/accounting/journals/page.tsx` |

### 📁 8. الموظفون والرواتب والإجازات والحضور (Employees, Payroll & Time Off)
**عدد المفاتيح والكلمات المستخرجة**: 338 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.type` | **نوع الاستئذان** | Type | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.name..en` | **الاسم بالإنجليزية** | Name (EN) | `components/hr/employee-form.tsx` |
| `inline.print` | **طباعة المستند** | Print | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.start` | **وقت البداية** | Start | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.request.processed` | **تمت معالجة الطلب** | Request Processed | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.employee.leaves` | **إجازات الموظفين** | Employee Leaves | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.view.your.own.requests.and.status` | **عرض سجلاتك الشخصية وحالة طلباتك** | View your own requests and status | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.manage.and.approve.team.leaves` | **إدارة واعتماد إجازات فريق العمل** | Manage and approve team leaves | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.apply` | **تقديم إجازة** | Apply | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.period` | **الفترة** | Period | `app/dashboard/hr/payroll/page.tsx` |
| `inline.work.days` | **يوم عمل** | Work Days | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.process` | **معالجة** | Process | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.admin.decision...correction` | **قرار الإدارة وتصحيح البيانات** | Admin Decision & Correction | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.departmental.overlap.warning` | **تحذير تداخل تخصصي** | Departmental Overlap Warning | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.approve.start.date` | **تاريخ البدء المعتمد** | Approve Start Date | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.approve.return.date` | **تاريخ العودة المعتمد** | Approve Return Date | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.actual.days.to.deduct` | **أيام الخصم الفعلي (بعد المراجعة)** | Actual Days to Deduct | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.internal.notes...reason` | **ملاحظات الإدارة أو سبب الرفض** | Internal Notes / Reason | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.enter.feedback` | **اكتب هنا ملاحظاتك للموظف...** | Enter feedback... | `app/dashboard/hr/leaves-manager.tsx` |
| `inline.reject` | **رفض الطلب** | Reject | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.approve` | **اعتماد وصرف** | Approve | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `hr` | **مترجم عبر hr** | Translated via hr | `app/dashboard/hr/page.tsx` |
| `inline.workforce...compliance` | **إدارة القوى العاملة والامتثال** | Workforce & Compliance | `app/dashboard/hr/page.tsx` |
| `inline.payroll` | **الرواتب** | Payroll | `app/dashboard/hr/page.tsx` |
| `inline.hire` | **تعيين** | Hire | `app/dashboard/hr/page.tsx` |
| `inline.employeenum` | **رقم_الموظف** | EmployeeNum | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.checkin1` | **دخول_صباحي** | CheckIn1 | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.checkout1` | **خروج_صباحي** | CheckOut1 | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.checkin2` | **دخول_مسائي** | CheckIn2 | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.checkout2` | **خروج_مسائي** | CheckOut2 | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.novaflow.attendance.xlsx` | **نموذج_حضور_نوفا.xlsx** | NovaFlow_Attendance.xlsx | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.file.is.empty.or.invalid` | **الملف فارغ أو غير صالح.** | File is empty or invalid. | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.import.warnings` | **تنبيهات في البيانات** | Import Warnings | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.import.successful` | **تم الاستيراد بنجاح.** | Import successful. | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.smart.attendance.import` | **استيراد الحضور الذكي (XLSX)** | Smart Attendance Import | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.please.select.target.period.before.upload.for.data.accuracy` | **يرجى تحديد الفترة المستهدفة قبل رفع الملف لضمان دقة البيانات.** | Please select target period before upload for data accuracy. | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.download.template` | **تحميل نموذج إكسيل** | Download Template | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.target.month` | **اختيار الشهر** | Target Month | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.fiscal.year` | **السنة المالية** | Fiscal Year | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.upload.spreadsheet` | **رفع ملف البصمة** | Upload Spreadsheet | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.select.the.excel.file.containing.fingerprints.for.the.selected.period` | **اختر ملف الإكسيل الذي يحتوي على بصمات الموظفين للفترة المحددة.** | Select the Excel file containing fingerprints for the selected period. | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.select...process.file` | **اختيار ومعالجة الملف** | Select & Process File | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.cancel...reset` | **إلغاء وإعادة اختيار** | Cancel & Reset | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.file.errors...warnings` | **أخطاء وتنبيهات في الملف** | File Errors & Warnings | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.total.late` | **إجمالي التأخير** | Total Late | `app/dashboard/hr/attendance/import/page.tsx` |
| `inline.min` | **دقيقة** | min | `app/dashboard/hr/attendance/import/page.tsx` |
| `staffRecords` | **مترجم عبر staffRecords** | Translated via staffRecords | `app/dashboard/hr/employees/page.tsx` |
| `inline.new.hire` | **توظيف جديد** | New Hire | `app/dashboard/hr/employees/page.tsx` |
| `inline.service.terminated` | **تم إنهاء الخدمة** | Service Terminated | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.employee.not.found` | **الموظف غير موجود** | Employee not found | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.emp` | **رقم الموظف** | Emp # | `components/hr/employee-form.tsx` |
| `inline.terminate` | **إنهاء الخدمة** | Terminate | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.confirm.termination` | **تأكيد الإنهاء النهائي** | Confirm Termination | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.warning..payroll.and.system.access.will.be.disabled.immediately` | **تنبيه: سيتم إيقاف صرف الرواتب وتعطيل وصول الموظف للنظام فوراً.** | Warning: Payroll and system access will be disabled immediately. | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.effective.date` | **تاريخ الإنهاء** | Effective Date | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.reason` | **السبب** | Reason | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.audit.history` | **سجل التدقيق (Audit)** | Audit History | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.no.audit.logs.found` | **لا يوجد تغييرات مسجلة.** | No audit logs found. | `app/dashboard/hr/employees/[id]/page.tsx` |
| `inline.changed` | **تغيير في** | Changed | `app/dashboard/hr/employees/[id]/page.tsx` |
| `entryAdded` | **مترجم عبر entryAdded** | Translated via entryAdded | `app/dashboard/hr/employees/new/page.tsx` |
| `inline.add.new.employee` | **إضافة موظف جديد** | Add New Employee | `app/dashboard/hr/employees/new/page.tsx` |
| `inline.create.integrated.profile.and.financial.record` | **إنشاء ملف تعريفي ومالي متكامل للموظف** | Create integrated profile and financial record | `app/dashboard/hr/employees/new/page.tsx` |
| `inline.kuwait.labor.law.engine` | **محرك الامتثال لقانون العمل الكويتي** | Kuwait Labor Law Engine | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.gratuity...indemnity.calc` | **حاسبة المستحقات النهائية** | Gratuity & Indemnity Calc | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.strict.application.of.art.41..44..51..and.53` | **تطبيق دقيق للمواد 41، 44، 51، و53 من قانون العمل.** | Strict application of Art 41, 44, 51, and 53. | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.print.legal.report` | **طباعة التقرير القانوني** | Print Legal Report | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.service...salary.data` | **بيانات الخدمة والراتب** | Service & Salary Data | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.target.employee` | **الموظف المستهدف** | Target Employee | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.select.employee` | **اختر موظفاً...** | Select employee... | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.hire.date` | **تاريخ التعيين** | Hire Date | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.end.date` | **تاريخ الانتهاء** | End Date | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.gross.salary..read.only` | **الراتب الشامل (للقراءة فقط)** | Gross Salary (Read-only) | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.legal.exit.reason` | **السبب القانوني للترك** | Legal Exit Reason | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.resignation` | **استقالة** | Resignation | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.employer.termination` | **إنهاء خدمات (إقالة)** | Employer Termination | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.retirement` | **تقاعد** | Retirement | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.misconduct` | **فصل تأديبي (مادة 41)** | Misconduct | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.notice.period` | **فترة الإنذار** | Notice Period | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.notice.served` | **استيفاء فترة الإنذار (عمل)** | Notice Served | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.immediate..pay` | **إنهاء فوري (استحقاق بدل)** | Immediate (Pay) | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.immediate..deduct` | **ترك فوري (خصم بدل)** | Immediate (Deduct) | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.final.net.amount` | **صافي المبلغ المصروف** | Final Net Amount | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.service.years` | **مدة الخدمة الفعلية** | Service Years | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.y` | **سنة** | Y | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.m` | **شهر** | M | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.resignation.factor` | **استحقاق الاستقالة** | Resignation Factor | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.breakdown` | **تفصيل المستحقات القانونية** | Breakdown | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.itemized.analysis` | **تحليل البنود وفقاً لقانون العمل** | Itemized analysis | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.gratuity` | **مكافأة الخدمة (المواد 51-53)** | Gratuity | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.base` | **رصيد المكافأة المتراكم** | Base | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.factor` | **عامل التدرج** | Factor | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.net` | **الصافي** | Net | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.indemnities` | **التسويات النقدية** | Indemnities | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.leave.balance` | **بدل الإجازات المستحق** | Leave Balance | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.notice` | **بدل الإنذار** | Notice | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.legal.notes` | **ملاحظات التدقيق القانوني** | Legal Notes | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.waiting.for.inputs` | **بانتظار المدخلات** | Waiting for Inputs | `app/dashboard/hr/gratuity/page.tsx` |
| `inline.please.select.an.employee` | **يرجى اختيار موظف أولاً** | Please select an employee | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.employee.has.no.hire.date.recorded` | **الموظف ليس له تاريخ تعيين مسجل** | Employee has no hire date recorded | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.employee.salary.must.be.configured` | **يجب ضبط راتب الموظف قبل الحساب** | Employee salary must be configured | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.legal.analysis.complete` | **تم التحليل القانوني بنجاح** | Legal Analysis Complete | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.nova.flow.employee.settlement.engine` | **محرك تسوية حقوق الموظفين - Nova Flow** | Nova Flow Employee Settlement Engine | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.final.settlement.calculator` | **حاسبة مستحقات نهاية الخدمة** | Final Settlement Calculator | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.precise.calculation.of.gratuity..leaves..and.notice.based.on.kuwait.labor.law` | **حساب دقيق للمكافآت، الإجازات، وبدلات الإنذار وفق قانون العمل الكويتي.** | Precise calculation of gratuity, leaves, and notice based on Kuwait Labor Law. | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.employee...exit.data` | **بيانات الموظف والترك** | Employee & Exit Data | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.select.from.list` | **اختر موظفاً من القائمة** | Select from list | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.gross.salary` | **الراتب الشامل** | Gross Salary | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.notice.start.date` | **تاريخ بدء الإخطار** | Notice Start Date | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.notice.handling` | **التعامل مع فترة الإنذار** | Notice Handling | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.work.during.notice` | **استيفاء فترة الإنذار (عمل)** | Work during notice | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.indemnity.payout` | **إنهاء فوري (صرف بدل)** | Indemnity payout | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.waived.period` | **تنازل متبادل عن المدة** | Waived period | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.termination.reason` | **السبب القانوني للترك** | Termination Reason | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.termination` | **إنهاء خدمات (صاحب عمل)** | Termination | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.contract.end` | **انتهاء عقد** | Contract End | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.note..calculation.uses.26.day.policy.and.gross.salary.including.all.allowances` | **تنبيه: يتم الحساب بناءً على سياسة الـ 26 يوماً المعتمدة في Nova ERP والراتب الشامل متضمناً كافة البدلات.** | Note: Calculation uses 26-day policy and Gross Salary including all allowances. | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.waiting.for.selection` | **بانتظار تحديد الموظف** | Waiting for Selection | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.select.an.employee.and.notice.type.to.start.the.legal.simulation` | **قم باختيار الموظف ونوع الإنذار من القائمة الجانبية لبدء المحاكاة القانونية للمستحقات.** | Select an employee and notice type to start the legal simulation. | `app/dashboard/hr/gratuity-calculator/page.tsx` |
| `inline.leave.requests` | **طلبات الإجازات** | Leave Requests | `app/dashboard/hr/leaves/page.tsx` |
| `inline.viewing.your.own.records.only` | **عرض سجلاتك الشخصية فقط** | Viewing your own records only | `app/dashboard/hr/permissions/page.tsx` |
| `inline.manage.absences.and.balances` | **إدارة الغيابات والأرصدة** | Manage absences and balances | `app/dashboard/hr/leaves/page.tsx` |
| `inline.new.request` | **طلب استئذان جديد** | New Request | `app/dashboard/hr/permissions/page.tsx` |
| `inline.no.requests.found` | **لا يوجد طلبات.** | No requests found. | `app/dashboard/hr/permissions/page.tsx` |
| `inline.request.not.found` | **الطلب غير موجود** | Request not found | `app/dashboard/hr/permissions/[id]/page.tsx` |
| `inline.leave.request.status` | **حالة طلب الإجازة** | Leave Request Status | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.official.leave.authorization` | **إقرار إجازة رسمية** | Official Leave Authorization | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.operational.conflict.warning` | **تنبيه: تداخل تخصصي حرج** | Operational Conflict Warning | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.other.department.staff.are.away.during.this.period` | **يوجد موظفون آخرون من نفس القسم لديهم إجازات في نفس الفترة.** | Other department staff are away during this period. | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.review.department.schedule.before.approval.to.prevent.downtime` | **يرجى مراجعة الجدول الزمني للقسم قبل اتمام الموافقة لتجنب توقف العمل.** | Review department schedule before approval to prevent downtime. | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.admin.decision` | **قرار الإدارة وتصحيح البيانات** | Admin Decision | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.approve.start` | **تاريخ البدء المعتمد** | Approve Start | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.approve.return` | **تاريخ العودة المعتمد** | Approve Return | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.deduction.days` | **أيام الخصم الفعلي (للمحاسبة)** | Deduction Days | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.internal.notes` | **ملاحظات الإدارة** | Internal Notes | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.request.details` | **بيانات طلب الإجازة** | Request Details | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.calendar.days` | **أيام التقويم:** | Calendar Days: | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.net.deduction` | **الخصم الفعلي** | Net Deduction | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.start.date` | **تاريخ المباشرة** | Start Date | `components/hr/employee-form.tsx` |
| `inline.return.date` | **تاريخ العودة** | Return Date | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.reason...justification` | **المبررات والأسباب** | Reason / Justification | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.audit.trail` | **سجل الحركات (Audit)** | Audit Trail | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.request.created` | **تقديم الطلب** | Request Created | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.approved` | **تم الاعتماد** | Approved | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.rejected` | **تم الرفض** | Rejected | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.art.70..leave.requires.admin.approval..manager.can.adjust.dates.to.suit.operational.needs.and.department.continuity` | **بناءً على مادة 70: لا يحق للموظف القيام بالإجازة إلا بموافقة الإدارة. يحق للمدير تعديل تواريخ الإجازة بما يتناسب مع مصلحة العمل وضمان استمرارية القسم.** | Art 70: Leave requires admin approval. Manager can adjust dates to suit operational needs and department continuity. | `app/dashboard/hr/leaves/[id]/page.tsx` |
| `inline.ineligible` | **غير مؤهل** | Ineligible | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.request.submitted` | **تم تقديم الطلب بنجاح** | Request submitted | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.service...delegation` | **بوابة الخدمة والانتساب** | Service & Delegation | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.submit.leave.request` | **تقديم طلب إجازة** | Submit Leave Request | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.remaining.balance` | **الرصيد المتبقي للموظف** | Remaining Balance | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.apply.on.behalf.of` | **تقديم بالنيابة عن موظف** | Apply on behalf of | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.search...select.employee` | **بحث واختيار الموظف** | Search & Select Employee | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.search.name.or.id` | **بحث بالاسم أو الرقم...** | Search name or ID... | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.note..as.admin..you.can.override.the.6.month.rule.if.needed` | **تنبيه: كمدير، يمكنك تجاوز قيد الـ 6 أشهر عند الضرورة.** | Note: As Admin, you can override the 6-month rule if needed. | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.field.calculation` | **تحليل الاحتساب الميداني** | Field Calculation | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.net.balance.deduction` | **خصم الرصيد الفعلي:** | Net Balance Deduction: | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.art.70..holidays.weekends.are.not.deducted.from.balance` | **قانون العمل: لا تحسب الجمعة والعطلات الرسمية ضمن الإجازة السنوية (مادة 70).** | Art 70: Holidays/Weekends are not deducted from balance. | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.leave.type` | **نوع الإجازة المطلوبة** | Leave Type | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.annual.leave` | **إجازة سنوية** | Annual Leave | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.sick.leave` | **إجازة مرضية** | Sick Leave | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.emergency` | **إجازة اضطرارية** | Emergency | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.unpaid.leave` | **إجازة بدون راتب** | Unpaid Leave | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.effective.start.date` | **تاريخ بداية الإجازة** | Effective Start Date | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.return.to.work.date` | **تاريخ العودة للعمل** | Return to Work Date | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.reason...notes` | **سبب الإجازة / ملاحظات** | Reason / Notes | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.submit.for.approval` | **إرسال الطلب للاعتماد** | Submit for Approval | `app/dashboard/hr/leaves/new/page.tsx` |
| `inline.operational.compliance.reference` | **مرجع الامتثال التشغيلي** | Operational Compliance Reference | `app/dashboard/hr/legal-guide/page.tsx` |
| `inline.access.restricted` | **وصول محجوب** | Access Restricted | `app/dashboard/hr/payroll/page.tsx` |
| `inline.you.lack.permissions.to.view.payroll.batches` | **لا تملك صلاحية عرض مسيرات الرواتب.** | You lack permissions to view payroll batches. | `app/dashboard/hr/payroll/page.tsx` |
| `payroll` | **مترجم عبر payroll** | Translated via payroll | `app/dashboard/hr/payroll/page.tsx` |
| `inline.manage.financial.entitlements.and.operational.deductions` | **إدارة المستحقات المالية والخصومات التشغيلية** | Manage financial entitlements and operational deductions | `app/dashboard/hr/payroll/page.tsx` |
| `inline.new.payroll.batch` | **توليد كشف جديد** | New Payroll Batch | `app/dashboard/hr/payroll/page.tsx` |
| `inline.total.net.paid` | **إجمالي الصافي المصروف** | Total Net Paid | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.total.deductions` | **إجمالي الاستقطاعات** | Total Deductions | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.batch.count` | **عدد الدفعات** | Batch Count | `app/dashboard/hr/payroll/page.tsx` |
| `inline.employees` | **الموظفين** | Employees | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.net.amount` | **الصافي** | Net Amount | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.no.payroll.batches.found` | **لا توجد كشوف رواتب معتمدة.** | No payroll batches found. | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.batch.not.found` | **الكشف غير موجود** | Batch not found | `app/dashboard/hr/payroll/[id]/page.tsx` |
| `inline.payroll.batch.details` | **تفاصيل كشف الرواتب** | Payroll Batch Details | `app/dashboard/hr/payroll/[id]/page.tsx` |
| `inline.cycle` | **الشهر / السنة** | Cycle | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.print.list` | **طباعة الكشف** | Print List | `app/dashboard/hr/payroll/[id]/page.tsx` |
| `inline.mark.reviewed` | **إرسال للمراجعة** | Mark Reviewed | `app/dashboard/hr/payroll/[id]/page.tsx` |
| `inline.net.salary` | **صافي الرواتب** | Net Salary | `app/dashboard/hr/payroll/[id]/page.tsx` |
| `inline.deductions` | **الاستقطاعات** | Deductions | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.gross` | **إجمالي المستحق** | Gross | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.draft.batch.generated` | **تم توليد مسودة الرواتب** | Draft Batch Generated | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.payroll.batch.saved` | **تم اعتماد وحفظ كشف الرواتب.** | Payroll batch saved. | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.smart.payroll.generator` | **توليد الرواتب الذكي** | Smart Payroll Generator | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.integrate.attendance.data.into.precise.financial.batch` | **نظام دمج بيانات الحضور والغياب في كشوف مالية دقيقة** | Integrate attendance data into precise financial batch | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.net.total` | **صافي المستحق** | Net Total | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.staff.count` | **موظف مدرج** | Staff Count | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.review.calculations.before.final.commit` | **مراجعة بيانات الرواتب قبل الاعتماد النهائي** | Review calculations before final commit | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.basic` | **الأساسي** | Basic | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.unjustified` | **غياب غير مبرر** | Unjustified | `app/dashboard/hr/payroll/new/page.tsx` |
| `inline.permission.requests` | **طلبات الاستئذان** | Permission Requests | `app/dashboard/hr/permissions/page.tsx` |
| `inline.manage.late.arrivals.and.early.departures` | **إدارة التأخيرات والانصراف المبكر** | Manage late arrivals and early departures | `app/dashboard/hr/permissions/page.tsx` |
| `inline.duration` | **المدة** | Duration | `app/dashboard/hr/permissions/page.tsx` |
| `inline.permission.details` | **تفاصيل الاستئذان** | Permission Details | `app/dashboard/hr/permissions/[id]/page.tsx` |
| `inline.authorized.hr.permission` | **استئذان إداري معتمد** | Authorized HR Permission | `app/dashboard/hr/permissions/[id]/page.tsx` |
| `inline.employee...time.info` | **بيانات الموظف والوقت** | Employee & Time Info | `app/dashboard/hr/permissions/[id]/page.tsx` |
| `inline.employee.name` | **اسم الموظف** | Employee Name | `app/dashboard/hr/permissions/[id]/page.tsx` |
| `inline.approve.request` | **اعتماد الاستئذان** | Approve Request | `app/dashboard/hr/permissions/[id]/page.tsx` |
| `inline.request.submitted.successfully` | **تم تقديم طلب الاستئذان بنجاح.** | Request submitted successfully. | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.hr.portal` | **بوابة الخدمات الإدارية** | HR Portal | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.new.permission` | **طلب استئذان جديد** | New Permission | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.quota.metrics` | **مؤشرات الرصيد** | Quota Metrics | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.requested` | **المدة المطلوبة:** | Requested: | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.month.used` | **رصيد الشهر:** | Month Used: | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.limit..3h.per.request..12h.per.month` | **الحد الأقصى 3 ساعات للطلب، والشهري 12 ساعة.** | Limit: 3h per request, 12h per month. | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.late.arrival` | **حضور متأخر** | Late Arrival | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.early.departure` | **انصراف مبكر** | Early Departure | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.submit.permission` | **إرسال الطلب** | Submit Permission | `app/dashboard/hr/permissions/new/page.tsx` |
| `inline.employee.dossier` | **ملف الموظف الشامل** | Employee Dossier | `app/dashboard/hr/reports/page.tsx` |
| `inline.complete.historical.record..attendance..leaves..and.payroll` | **سجل تاريخي كامل: حضور، إجازات، ورواتب.** | Complete historical record: attendance, leaves, and payroll. | `app/dashboard/hr/reports/page.tsx` |
| `inline.attendance.analysis` | **تحليل الحضور والغياب** | Attendance Analysis | `app/dashboard/hr/reports/page.tsx` |
| `inline.total.late.minutes.and.absence.summary.report` | **تقرير إجمالي التأخير والغياب لفترة محددة.** | Total late minutes and absence summary report. | `app/dashboard/hr/reports/page.tsx` |
| `inline.payroll.summary` | **كشوف الرواتب الموحدة** | Payroll Summary | `app/dashboard/hr/reports/page.tsx` |
| `inline.financial.summary.of.monthly.payments.and.deductions` | **ملخص مالي للمدفوعات والخصومات الشهرية.** | Financial summary of monthly payments and deductions. | `app/dashboard/hr/reports/page.tsx` |
| `inline.hr.analytics.hub` | **مركز تقارير HR والرقابة** | HR Analytics Hub | `app/dashboard/hr/reports/page.tsx` |
| `inline.workforce.analysis.and.compliance` | **تحليل القوى العاملة والامتثال والإنتاجية الميدانية** | Workforce analysis and compliance | `app/dashboard/hr/reports/page.tsx` |
| `inline.total.employees` | **إجمالي الموظفين** | Total Employees | `app/dashboard/hr/reports/page.tsx` |
| `inline.active.now` | **نشط ميدانياً** | Active Now | `app/dashboard/hr/reports/page.tsx` |
| `inline.on.leave` | **في إجازة** | On Leave | `app/dashboard/hr/reports/page.tsx` |
| `inline.retention.rate` | **معدل التواجد** | Retention Rate | `app/dashboard/hr/reports/page.tsx` |
| `inline.attendance.analysis.report` | **تحليل حضور القوى العاملة** | Attendance Analysis Report | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.track.discipline..late.minutes..and.workforce.absences` | **تتبع الانضباط، التأخير، والغياب لفريق العمل.** | Track discipline, late minutes, and workforce absences. | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.report.load.failed` | **تعذر تحميل التقرير** | Report Load Failed | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.retry` | **إعادة المحاولة** | Retry | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.total.logs` | **إجمالي السجلات** | Total Logs | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.present` | **حالات الحضور** | Present | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.late` | **حالات التأخير** | Late | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.total.late.mins` | **إجمالي دقائق التأخير** | Total Late Mins | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.in...out` | **دخول / خروج** | In / Out | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.late..m` | **التأخير** | Late (m) | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.no.records.for.this.period` | **لا يوجد سجلات لهذه الفترة.** | No records for this period. | `app/dashboard/hr/reports/attendance/page.tsx` |
| `inline.punctuality.analysis` | **تحليل انضباط الموظف** | Punctuality Analysis | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.print.analysis` | **طباعة التحليل** | Print Analysis | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.attendance.discipline.report` | **تقرير الانضباط السلوكي والحضور** | Attendance Discipline Report | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.punctuality.rate` | **معدل الانضباط** | Punctuality Rate | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.total.presence` | **أيام الحضور** | Total Presence | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.absences` | **حالات الغياب** | Absences | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.detailed.attendance.logs` | **سجل الحركات التفصيلي** | Detailed Attendance Logs | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.in` | **الدخول** | In | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.out` | **الخروج** | Out | `app/dashboard/hr/reports/attendance/individual/[id]/page.tsx` |
| `inline.no.permission.for.reports` | **لا تملك صلاحية عرض التقارير** | No Permission for Reports | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.please.ask.admin.to.enable..hr....view..in.your.role.matrix` | **يرجى مراجعة الإدارة لتفعيل صلاحية (HR -> View) في ملف دورك الوظيفي.** | Please ask Admin to enable (HR -> View) in your role matrix. | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.redirecting.to.your.dossier` | **جاري توجيهك لملفك الشخصي...** | Redirecting to your dossier... | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.employee.dossier.search` | **ملف الموظف الشامل (Dossier)** | Employee Dossier Search | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.search.for.an.employee.to.view.their.full.institutional.history` | **ابحث عن الموظف لعرض تاريخه الكامل في المنشأة.** | Search for an employee to view their full institutional history. | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.search.by.name..civil.id..or.number` | **بحث باسم الموظف، الرقم المدني، أو رقم الملف...** | Search by name, civil id, or number... | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.fetching.employees` | **جاري جلب سجل الموظفين...** | Fetching employees... | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.error.fetching.data` | **حدث خطأ أثناء جلب البيانات** | Error Fetching Data | `app/dashboard/hr/reports/dossier/page.tsx` |
| `inline.access.denied` | **وصول محجوب** | Access Denied | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.you.lack.permissions.to.view.this.dossier` | **لا تملك صلاحية عرض هذا الملف الفني.** | You lack permissions to view this dossier. | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.open.report` | **فتح التقرير** | Open Report | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.employee.analytics.center` | **مركز تقارير الموظف** | Employee Analytics Center | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.print.full.dossier` | **طباعة الملف كاملاً** | Print Full Dossier | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.self.service.reports` | **التقارير الذاتية (ERP)** | Self-Service Reports | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.leave.ledger` | **كشف حركة الرصيد** | Leave Ledger | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.detailed.financial.analysis.of.leave.accruals` | **تحليل مالي مفصل لاستحقاق وخصم الإجازات.** | Detailed financial analysis of leave accruals. | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.discipline.analysis` | **تحليل الانضباط** | Discipline Analysis | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.lateness.logs..absences..and.consistency.rate` | **سجل التأخير والغياب ونسبة الالتزام الشهرية.** | Lateness logs, absences, and consistency rate. | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.payroll.ledger` | **سجل الرواتب** | Payroll Ledger | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.historical.archive.of.all.payments.and.deductions` | **أرشيف تاريخي لكافة الدفعات المالية والخصومات.** | Historical archive of all payments and deductions. | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.asset.statement` | **بيان العهد** | Asset Statement | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.list.of.tools.and.equipment.currently.in.possession` | **قائمة المعدات والأدوات المسجلة بعهدة الموظف.** | List of tools and equipment currently in possession. | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.current.balance` | **رصيد الإجازات الحالي** | Current Balance | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.accrued.days` | **يوم مستحق** | Accrued Days | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.civil.id` | **الرقم المدني** | Civil ID | `components/hr/employee-form.tsx` |
| `inline.mobile` | **رقم الهاتف** | Mobile | `components/hr/employee-form.tsx` |
| `inline.active.field.assets` | **العهد الميدانية النشطة** | Active Field Assets | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.no.active.assets.assigned` | **لا يوجد عهد مسجلة حالياً.** | No active assets assigned. | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.recent.attendance` | **آخر عمليات الحضور** | Recent Attendance | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.punch.in` | **الدخول** | Punch In | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.punch.out` | **الخروج** | Punch Out | `app/dashboard/hr/reports/dossier/[id]/page.tsx` |
| `inline.leave.balance.audit.report` | **تقرير أرصدة الإجازات السنوية** | Leave Balance Audit Report | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.audit.remaining.balances.for.each.employee.and.entitlement.dates` | **مراجعة الأرصدة المتبقية لكل موظف وتاريخ الاستحقاق.** | Audit remaining balances for each employee and entitlement dates. | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.failed.to.fetch.employees` | **فشل جلب سجلات الموظفين** | Failed to fetch employees | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.total.entitled` | **الرصيد الكلي** | Total Entitled | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.remaining` | **الرصيد المتبقي** | Remaining | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.no.employees.found` | **لا يوجد موظفين مسجلين.** | No employees found. | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.low.balance` | **رصيد منخفض** | Low Balance | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.healthy` | **سليم** | Healthy | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.statement` | **كشف تفصيلي** | Statement | `app/dashboard/hr/reports/leaves/page.tsx` |
| `inline.art..70..2.5d.mo` | **المادة 70 (2.5 يوم/شهر)** | Art. 70 (2.5d/mo) | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.detailed.leave.ledger` | **كشف حركة رصيد الإجازات** | Detailed Leave Ledger | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.legal.statutory.report..art..70` | **تقرير مالي قانوني (المادة 70)** | Legal Statutory Report (Art. 70) | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.print.official.ledger` | **طباعة الكشف الرسمي** | Print Official Ledger | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.statement.of.annual.leave.balance` | **كشف حساب رصيد الإجازات السنوية** | Statement of Annual Leave Balance | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.transaction` | **نوع العملية / الوصف** | Transaction | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.change` | **الحركة** | Change | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.balance` | **الرصيد التراكمي** | Balance | `app/dashboard/hr/reports/leaves/statement/[id]/page.tsx` |
| `inline.payroll.expenditure.summary` | **ملخص مصروفات الرواتب** | Payroll Expenditure Summary | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.overview.of.institution.wide.payments.and.deductions` | **عرض إجمالي المدفوعات والخصومات على مستوى المنشأة.** | Overview of institution-wide payments and deductions. | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.failed.to.load.payroll.data` | **فشل تحميل بيانات الرواتب** | Failed to load payroll data | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.cycles` | **عدد الدورات** | Cycles | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.payroll.cycle` | **الدورة المالية** | Payroll Cycle | `app/dashboard/hr/reports/payroll/page.tsx` |
| `inline.individual.payroll.ledger` | **كشف السجل المالي** | Individual Payroll Ledger | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.print.ledger` | **طباعة كشف الرواتب** | Print Ledger | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.official.payroll.ledger.statement` | **كشف حساب المستحقات والرواتب** | Official Payroll Ledger Statement | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.contracted.salary` | **الراتب المعتمد** | Contracted Salary | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.payment.mode` | **طريقة الصرف** | Payment Mode | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.account.iban` | **رقم الحساب** | Account/IBAN | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.historical.payment.record` | **سجل الدفعات التاريخي** | Historical Payment Record | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.net.paid` | **صافي المبلغ** | Net Paid | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.no.payroll.history.available` | **لا يوجد سجل رواتب متاح حالياً.** | No payroll history available. | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.financial.disclaimer` | **إبراء ذمة مالي** | Financial Disclaimer | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `inline.this.statement.is.an.official.document.of.all.amounts.paid.to.the.employee..any.financial.grievance.must.be.reported.to.the.accounting.department.within.5.days.of.salary.receipt` | **يعتبر هذا الكشف مستنداً رسمياً يوضح كافة المبالغ المصروفة للموظف. في حال وجود أي تظلم مالي، يرجى مراجعة قسم المحاسبة في موعد أقصاه 5 أيام من تاريخ استلام الراتب.** | This statement is an official document of all amounts paid to the employee. Any financial grievance must be reported to the accounting department within 5 days of salary receipt. | `app/dashboard/hr/reports/payroll/individual/[id]/page.tsx` |
| `active` | **مترجم عبر active** | Translated via active | `components/hr/employee-form.tsx` |
| `inline.this.profile.is.read.only` | **هذا الملف معلق للعرض فقط.** | This profile is read-only. | `components/hr/employee-form.tsx` |
| `inline.internal.staff` | **موظف داخلي (رسمي)** | Internal Staff | `components/hr/employee-form.tsx` |
| `inline.external.labor` | **عامل خارجي (ميداني)** | External Labor | `components/hr/employee-form.tsx` |
| `inline.personal.identity` | **بيانات الهوية** | Personal Identity | `components/hr/employee-form.tsx` |
| `inline.full.name` | **الاسم الكامل** | Full Name | `components/hr/employee-form.tsx` |
| `inline.email` | **البريد الإلكتروني** | Email | `components/hr/employee-form.tsx` |
| `inline.work.context...roles` | **البيانات الوظيفية والصلاحيات** | Work Context & Roles | `components/hr/employee-form.tsx` |
| `inline.official.job.title` | **المسمى الوظيفي (المهنة المرجعية)** | Official Job Title | `components/hr/employee-form.tsx` |
| `inline.security.access.role` | **الدور الأمني (صلاحيات النظام)** | Security Access Role | `components/hr/employee-form.tsx` |
| `inline.no.system.access..field.only` | **--- لا يوجد وصول للنظام (ميداني فقط) ---** | --- No System Access (Field only) --- | `components/hr/employee-form.tsx` |
| `inline.assigning.a.role.enables.system.login.for.this.employee` | *** تعيين دور هنا يسمح للموظف بالدخول للنظام لاحقاً.** | * Assigning a role enables system login for this employee. | `components/hr/employee-form.tsx` |
| `inline.residency.expiry` | **تاريخ انتهاء الإقامة** | Residency Expiry | `components/hr/employee-form.tsx` |
| `inline.monthly` | **راتب شهري** | Monthly | `components/hr/employee-form.tsx` |
| `inline.daily` | **يومية** | Daily | `components/hr/employee-form.tsx` |
| `inline.financial.terms` | **الاتفاق المالي** | Financial Terms | `components/hr/employee-form.tsx` |
| `inline.monthly.rate` | **قيمة الراتب (د.ك)** | Monthly Rate | `components/hr/employee-form.tsx` |
| `inline.daily.rate` | **قيمة اليومية (د.ك)** | Daily Rate | `components/hr/employee-form.tsx` |
| `inline.payout.method` | **طريقة صرف المستحقات** | Payout Method | `components/hr/employee-form.tsx` |
| `inline.cash` | **نقدي (كاش)** | Cash | `components/hr/employee-form.tsx` |
| `inline.site.petty.cash` | **عهدة الموقع** | Site Petty Cash | `components/hr/employee-form.tsx` |
| `inline.check` | **شيك** | Check | `components/hr/employee-form.tsx` |
| `inline.bank.payroll` | **تحويل راتب رسمي** | Bank Payroll | `components/hr/employee-form.tsx` |
| `inline.bank` | **اسم البنك** | Bank | `components/hr/employee-form.tsx` |
| `inline.iban` | **رقم الحساب (IBAN)** | IBAN | `components/hr/employee-form.tsx` |
| `inline.update.profile` | **تحديث البيانات** | Update Profile | `components/hr/employee-form.tsx` |
| `inline.commit.registration` | **اعتماد التوظيف** | Commit Registration | `components/hr/employee-form.tsx` |
| `periodStart` | **مترجم عبر periodStart** | Translated via periodStart | `components/hr/reports/report-filters.tsx` |
| `periodEnd` | **مترجم عبر periodEnd** | Translated via periodEnd | `components/hr/reports/report-filters.tsx` |

### 📁 9. المخزون والعهد (Inventory & Stock)
**عدد المفاتيح والكلمات المستخرجة**: 10 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.employee` | **الموظف** | Employee | `app/dashboard/inventory/page.tsx` |
| `inline.asset.assigned` | **تم صرف العهدة** | Asset Assigned | `app/dashboard/inventory/page.tsx` |
| `inline.inventory...assets` | **المخازن والعهد** | Inventory & Assets | `app/dashboard/inventory/page.tsx` |
| `inline.track.stock.and.field.assignments` | **تتبع المخزون والعهد الميدانية** | Track stock and field assignments | `app/dashboard/inventory/page.tsx` |
| `inline.assign.asset` | **صرف عهدة** | Assign Asset | `app/dashboard/inventory/page.tsx` |
| `inline.new.assignment` | **صرف عهدة جديدة** | New Assignment | `app/dashboard/inventory/page.tsx` |
| `inline.item` | **الصنف** | Item | `app/dashboard/inventory/page.tsx` |
| `inline.low.stock` | **تنبيهات نقص** | Low Stock | `app/dashboard/inventory/page.tsx` |
| `inline.stock.balance` | **رصيد المستودع** | Stock Balance | `app/dashboard/inventory/page.tsx` |
| `inline.stock.is.empty` | **المخزن فارغ.** | Stock is empty. | `app/dashboard/inventory/page.tsx` |

### 📁 10. الاجتماعات والقاعات والمواعيد (Meetings & Appointments)
**عدد المفاتيح والكلمات المستخرجة**: 65 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `inline.appointments.radar` | **رادار المواعيد والزيارات** | Appointments Radar | `app/dashboard/appointments/page.tsx` |
| `inline.schedule.client.meetings.and.site.visits` | **جدولة اللقاءات مع العملاء والزيارات الميدانية.** | Schedule client meetings and site visits. | `app/dashboard/appointments/page.tsx` |
| `inline.print.schedule` | **طباعة الجدول** | Print Schedule | `app/dashboard/appointments/page.tsx` |
| `inline.progress...resources.logged` | **تم تسجيل الإنجاز والموارد بنجاح** | Progress & Resources Logged | `app/dashboard/appointments/[id]/page.tsx` |
| `common.error` | **مترجم عبر common.error** | Translated via common.error | `app/dashboard/appointments/[id]/page.tsx` |
| `inline.log.site.resources` | **توثيق الموارد والإنجاز** | Log Site Resources | `app/dashboard/appointments/[id]/page.tsx` |
| `inline.execution.pipeline` | **مراحل التنفيذ** | Execution Pipeline | `app/dashboard/appointments/[id]/page.tsx` |
| `inline.log.resources...progress` | **توثيق الإنجاز والموارد** | Log Resources & Progress | `app/dashboard/appointments/[id]/page.tsx` |
| `inline.boq.work.progress` | **كميات الإنجاز (BOQ)** | BOQ Work Progress | `app/dashboard/appointments/[id]/page.tsx` |
| `common.addLabel` | **مترجم عبر common.addLabel** | Translated via common.addLabel | `app/dashboard/appointments/[id]/page.tsx` |
| `common.quantity` | **مترجم عبر common.quantity** | Translated via common.quantity | `app/dashboard/appointments/[id]/page.tsx` |
| `common.notes` | **مترجم عبر common.notes** | Translated via common.notes | `app/dashboard/appointments/[id]/page.tsx` |
| `common.labor` | **مترجم عبر common.labor** | Translated via common.labor | `app/dashboard/appointments/[id]/page.tsx` |
| `common.loadFromGroup` | **مترجم عبر common.loadFromGroup** | Translated via common.loadFromGroup | `app/dashboard/appointments/[id]/page.tsx` |
| `common.equipment` | **مترجم عبر common.equipment** | Translated via common.equipment | `app/dashboard/appointments/[id]/page.tsx` |
| `common.cancel` | **مترجم عبر common.cancel** | Translated via common.cancel | `app/dashboard/appointments/[id]/page.tsx` |
| `inline.commit.site.resources` | **اعتماد التوثيق الميداني** | Commit Site Resources | `app/dashboard/appointments/[id]/page.tsx` |
| `inline.cancel` | **إلغاء** | Cancel | `components/meetings/meeting-rooms-view.tsx` |
| `inline.delete` | **حذف** | Delete | `components/meetings/meeting-rooms-view.tsx` |
| `inline.department` | **القسم المسؤول** | Department | `components/meetings/meeting-rooms-view.tsx` |
| `inline.confirm` | **تأكيد الحجز** | Confirm | `components/meetings/meeting-rooms-view.tsx` |
| `inline.meeting.halls.radar` | **رادار حجز القاعات** | Meeting Halls Radar | `app/dashboard/meetings/page.tsx` |
| `inline.organize.meeting.rooms.and.workshops` | **تنظيم إشغال قاعات الاجتماعات والورش الفنية.** | Organize meeting rooms and workshops. | `app/dashboard/meetings/page.tsx` |
| `inline.print.occupancy` | **طباعة تقرير الإشغال** | Print Occupancy | `app/dashboard/meetings/page.tsx` |
| `inline.deleted.successfully` | **تم الحذف بنجاح** | Deleted Successfully | `components/meetings/meeting-rooms-view.tsx` |
| `inline.follow` | **متابعة** | Follow | `components/appointments/architectural-appointments-view.tsx` |
| `inline.contracted` | **متعاقدون** | Contracted | `components/appointments/architectural-appointments-view.tsx` |
| `inline.permanent.deletion` | **حذف الموعد نهائياً** | Permanent Deletion | `components/appointments/architectural-appointments-view.tsx` |
| `inline.are.you.sure..this.appointment.will.be.removed.from.all.reports.and.radar..action.cannot.be.undone` | **هل أنت متأكد؟ سيتم إزالة هذا الموعد من كافة التقارير والرادار الزمني ولا يمكن التراجع.** | Are you sure? This appointment will be removed from all reports and radar. Action cannot be undone. | `components/appointments/architectural-appointments-view.tsx` |
| `inline.busy` | **مشغول** | BUSY | `components/appointments/architectural-appointments-view.tsx` |
| `inline.view.radar` | **عرض الرادار** | View Radar | `components/appointments/architectural-appointments-view.tsx` |
| `inline.edit.booking` | **تعديل حجز القاعة** | Edit Booking | `components/meetings/meeting-rooms-view.tsx` |
| `inline.alert..cannot.book.in.the.past` | **تنبيه: لا يمكن الحجز في وقت سابق** | Alert: Cannot book in the past | `components/meetings/meeting-rooms-view.tsx` |
| `inline.client.conflict` | **تعارض للعميل** | Client Conflict | `components/meetings/meeting-rooms-view.tsx` |
| `inline.engineer.conflict` | **تعارض للمهندس** | Engineer Conflict | `components/meetings/meeting-rooms-view.tsx` |
| `inline.site.visit` | **زيارة ميدانية** | Site Visit | `components/appointments/architectural-appointments-view.tsx` |
| `inline.edit.visit` | **تعديل بيانات الزيارة** | Edit Visit | `components/appointments/architectural-appointments-view.tsx` |
| `inline.new.site.visit` | **حجز موعد ميداني جديد** | New Site Visit | `components/appointments/architectural-appointments-view.tsx` |
| `inline.confirmed.date` | **تاريخ الموعد المؤكد** | Confirmed Date | `components/appointments/architectural-appointments-view.tsx` |
| `inline.start.time` | **وقت البدء** | Start Time | `components/appointments/architectural-appointments-view.tsx` |
| `inline.new.client` | **عميل جديد؟** | New Client? | `components/appointments/architectural-appointments-view.tsx` |
| `inline.assign.department` | **القسم المختص بالزيارة** | Assign Department | `components/appointments/architectural-appointments-view.tsx` |
| `inline.select.arch.specialty` | **تحديد التخصص المعماري...** | Select arch specialty... | `components/appointments/architectural-appointments-view.tsx` |
| `inline.choose.client` | **تحديد العميل...** | Choose client... | `components/appointments/architectural-appointments-view.tsx` |
| `inline.search.client` | **بحث بالاسم أو الهاتف...** | Search client... | `components/appointments/architectural-appointments-view.tsx` |
| `inline.link.to.technical.path` | **ربط بالمسار الفني (المشروع)** | Link to Technical Path | `components/appointments/architectural-appointments-view.tsx` |
| `inline.select.project` | **اختر المشروع المفتوح...** | Select Project... | `components/appointments/architectural-appointments-view.tsx` |
| `inline.lead.engineer` | **المهندس المسؤول** | Lead Engineer | `components/meetings/meeting-rooms-view.tsx` |
| `inline.daily.meetings` | **إجمالي اجتماعات اليوم** | Daily Meetings | `components/meetings/meeting-rooms-view.tsx` |
| `inline.room.occupancy` | **إشغال القاعات** | Room Occupancy | `components/meetings/meeting-rooms-view.tsx` |
| `inline.in.progress` | **قيد التنفيذ** | In Progress | `components/meetings/meeting-rooms-view.tsx` |
| `inline.active.halls` | **قاعات مفعلة** | Active Halls | `components/meetings/meeting-rooms-view.tsx` |
| `inline.halls.schedule` | **فترة الدوام الرسمي 🏛️** | Halls Schedule | `components/meetings/meeting-rooms-view.tsx` |
| `inline.cancel.hall.booking` | **حذف حجز القاعة** | Cancel Hall Booking | `components/meetings/meeting-rooms-view.tsx` |
| `inline.are.you.sure..this.meeting.will.be.permanently.removed.from.the.halls.radar..this.cannot.be.undone` | **هل أنت متأكد؟ سيتم إزالة هذا الاجتماع من رادار القاعات نهائياً. لا يمكن التراجع عن هذا الإجراء.** | Are you sure? This meeting will be permanently removed from the halls radar. This cannot be undone. | `components/meetings/meeting-rooms-view.tsx` |
| `inline.view.tech.radar` | **عرض الرادار الفني** | View Tech Radar | `components/meetings/meeting-rooms-view.tsx` |
| `inline.cancel.booking` | **حذف وإلغاء الحجز** | Cancel Booking | `components/meetings/meeting-rooms-view.tsx` |
| `inline.hall.busy` | **القاعة مشغولة** | Hall Busy | `components/meetings/meeting-rooms-view.tsx` |
| `inline.professional.meeting` | **اجتماع فني** | Professional Meeting | `components/meetings/meeting-rooms-view.tsx` |
| `inline.room.booking` | **حجز قاعة اجتماع** | Room Booking | `components/meetings/meeting-rooms-view.tsx` |
| `inline.client` | **العميل المالك** | Client | `components/meetings/meeting-rooms-view.tsx` |
| `inline.meeting.activity` | **نوع نشاط الاجتماع** | Meeting Activity | `components/meetings/meeting-rooms-view.tsx` |
| `inline.select.specialty` | **تحديد التخصص...** | Select specialty... | `components/meetings/meeting-rooms-view.tsx` |
| `inline.no.projects.for.this.specialty` | **لا يوجد معاملات لهذا التخصص** | No projects for this specialty | `components/meetings/meeting-rooms-view.tsx` |
| `inline.supporting.team` | **مهندسين مشاركين** | Supporting Team | `components/meetings/meeting-rooms-view.tsx` |

### 📁 11. الإعدادات وقواعد العمل والصلاحيات (Settings, Rules & Permissions)
**عدد المفاتيح والكلمات المستخرجة**: 351 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `dashboard.stats.revenue` | **مترجم عبر dashboard.stats.revenue** | Translated via dashboard.stats.revenue | `app/dashboard/page.tsx` |
| `dashboard.stats.activeProjects` | **مترجم عبر dashboard.stats.activeProjects** | Translated via dashboard.stats.activeProjects | `app/dashboard/page.tsx` |
| `dashboard.stats.workforce` | **مترجم عبر dashboard.stats.workforce** | Translated via dashboard.stats.workforce | `app/dashboard/page.tsx` |
| `dashboard.stats.completion` | **مترجم عبر dashboard.stats.completion** | Translated via dashboard.stats.completion | `app/dashboard/page.tsx` |
| `dashboard.title` | **مترجم عبر dashboard.title** | Translated via dashboard.title | `app/dashboard/page.tsx` |
| `dashboard.export` | **مترجم عبر dashboard.export** | Translated via dashboard.export | `app/dashboard/page.tsx` |
| `projects.addNew` | **مترجم عبر projects.addNew** | Translated via projects.addNew | `app/dashboard/page.tsx` |
| `dashboard.missions` | **مترجم عبر dashboard.missions** | Translated via dashboard.missions | `app/dashboard/page.tsx` |
| `common.pending` | **مترجم عبر common.pending** | Translated via common.pending | `app/dashboard/page.tsx` |
| `inline.days` | **عدد الأيام المستهدفة** | Days | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `accounting` | **مترجم عبر accounting** | Translated via accounting | `app/dashboard/page.tsx` |
| `dashboard.recent` | **مترجم عبر dashboard.recent** | Translated via dashboard.recent | `app/dashboard/page.tsx` |
| `common.viewAll` | **مترجم عبر common.viewAll** | Translated via common.viewAll | `app/dashboard/page.tsx` |
| `inline.name..ar` | **الاسم بالعربي** | Name (AR) | `app/dashboard/settings/checklists/halls/page.tsx` |
| `checklists` | **مترجم عبر checklists** | Translated via checklists | `app/dashboard/checklists/page.tsx` |
| `inline.manage.operational.constitution.and.system.references` | **إدارة الدستور التشغيلي والقواعد المرجعية للنظام** | Manage operational constitution and system references | `app/dashboard/checklists/page.tsx` |
| `orgRef` | **مترجم عبر orgRef** | Translated via orgRef | `app/dashboard/checklists/page.tsx` |
| `techRef` | **مترجم عبر techRef** | Translated via techRef | `app/dashboard/checklists/page.tsx` |
| `geoRef` | **مترجم عبر geoRef** | Translated via geoRef | `app/dashboard/checklists/page.tsx` |
| `systemSetup` | **مترجم عبر systemSetup** | Translated via systemSetup | `app/dashboard/checklists/page.tsx` |
| `inline.existing.data.found..proceeding.might.duplicate.records..continue` | **تم العثور على بيانات سابقة. هل تريد إضافة المزيد؟ قد يتسبب ذلك في تكرار السجلات.** | Existing data found. Proceeding might duplicate records. Continue? | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.system.initialized` | **تمت تهيئة النظام** | System Initialized | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.all.reference.data.injected.successfully` | **تم ضخ كافة البيانات المرجعية بنجاح.** | All reference data injected successfully. | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `saveFailed` | **مترجم عبر saveFailed** | Translated via saveFailed | `app/dashboard/checklists/seed-tool.tsx` |
| `inline.warning..all.appointments.will.be.permanently.deleted..proceed` | **تنبيه: سيتم حذف كافة المواعيد (المجدولة والمكتملة) نهائياً. هل أنت متأكد؟** | Warning: All appointments will be permanently deleted. Proceed? | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.appointments.purged` | **تم تطهير سجل المواعيد** | Appointments Purged | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.reference.factory.initialization` | **تهيئة المصنع المرجعي** | Reference Factory Initialization | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.inject.geography..organization..and.technical.paths.for.nova.erp` | **ضخ القواعد الجغرافية، التنظيمية، والفنية الموحدة لنظام Nova ERP** | Inject geography, organization, and technical paths for Nova ERP | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.secure.data` | **بيانات آمنة** | Secure Data | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.data.is.fully.isolated.within.your.company.scope` | **يتم عزل البيانات بالكامل داخل نطاق شركتك فقط.** | Data is fully isolated within your company scope. | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.instant.setup` | **تجهيز فوري** | Instant Setup | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.create.departments..governorates..and.paths.in.seconds` | **إنشاء الأقسام، المحافظات، والمسارات الفنية في ثوانٍ.** | Create departments, governorates, and paths in seconds. | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.warning..only.run.this.process.during.the.initial.company.setup` | **تنبيه: لا تقم بتشغيل هذه العملية إلا عند إعداد الشركة لأول مرة.** | Warning: Only run this process during the initial company setup. | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.injecting.data` | **جاري ضخ البيانات...** | Injecting Data... | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.system.ready` | **تمت التهيئة بنجاح** | System Ready | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.run.initialization.engine` | **تشغيل محرك التهيئة الآن** | Run Initialization Engine | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.data.maintenance.tools` | **أدوات سلامة وصيانة البيانات** | Data Maintenance Tools | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.purge.all.appointments` | **تطهير سجل المواعيد** | Purge All Appointments | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.wipe.all.appointment.logs.to.start.clean..transactions.and.clients.are.safe` | **حذف كافة المواعيد المسجلة (المجدولة والمكتملة) للعمل على سجل نظيف. لن تتأثر المعاملات أو العملاء.** | Wipe all appointment logs to start clean. Transactions and clients are safe. | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.purge.logs` | **حذف كافة المواعيد** | Purge Logs | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.organizational.structure` | **الهيكل التنظيمي والمهن** | Organizational Structure | `app/dashboard/settings/checklists/departments/page.tsx` |
| `newDept` | **مترجم عبر newDept** | Translated via newDept | `app/dashboard/checklists/departments/page.tsx` |
| `edit` | **مترجم عبر edit** | Translated via edit | `app/dashboard/checklists/departments/page.tsx` |
| `name` | **مترجم عبر name** | Translated via name | `app/dashboard/checklists/departments/page.tsx` |
| `inline.description` | **الوصف** | Description | `app/dashboard/settings/roles/role-form.tsx` |
| `save` | **مترجم عبر save** | Translated via save | `app/dashboard/checklists/departments/page.tsx` |
| `inline.job.titles` | **الوظائف** | Job Titles | `app/dashboard/checklists/departments/page.tsx` |
| `inline.add.job` | **إضافة وظيفة/مهنة** | Add Job | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.geographic.data` | **البيانات الجغرافية** | Geographic Data | `app/dashboard/settings/checklists/geo/page.tsx` |
| `newGov` | **مترجم عبر newGov** | Translated via newGov | `app/dashboard/checklists/geo/page.tsx` |
| `inline.areas` | **المناطق** | Areas | `app/dashboard/settings/checklists/geo/page.tsx` |
| `inline.add.area` | **إضافة منطقة** | Add Area | `app/dashboard/settings/checklists/geo/page.tsx` |
| `deleted` | **مترجم عبر deleted** | Translated via deleted | `app/dashboard/checklists/service-types/page.tsx` |
| `inline.service.types` | **أنشطة الأعمال** | Service Types | `app/dashboard/checklists/service-types/page.tsx` |
| `inline.new.activity` | **نشاط جديد** | New Activity | `app/dashboard/settings/checklists/technical-paths/page.tsx` |
| `inline.order` | **الترتيب** | Order | `app/dashboard/checklists/service-types/page.tsx` |
| `inline.color` | **اللون** | Color | `app/dashboard/checklists/service-types/page.tsx` |
| `confirmDelete` | **مترجم عبر confirmDelete** | Translated via confirmDelete | `app/dashboard/checklists/service-types/page.tsx` |
| `inline.this.will.permanently.delete.this.activity.from.the.database` | **سيؤدي هذا لحذف النشاط بشكل نهائي من قاعدة البيانات.** | This will permanently delete this activity from the database. | `app/dashboard/checklists/service-types/page.tsx` |
| `inline.technical.path.engineering` | **هندسة المسارات الفنية** | Technical Path Engineering | `app/dashboard/settings/checklists/technical-paths/page.tsx` |
| `inline.activities` | **الأنشطة** | Activities | `app/dashboard/settings/checklists/technical-paths/page.tsx` |
| `inline.services` | **الخدمات** | Services | `app/dashboard/settings/checklists/technical-paths/page.tsx` |
| `inline.sub.services` | **المسارات** | Sub-Services | `app/dashboard/settings/checklists/technical-paths/page.tsx` |
| `newActivity` | **مترجم عبر newActivity** | Translated via newActivity | `app/dashboard/checklists/technical-paths/page.tsx` |
| `newService` | **مترجم عبر newService** | Translated via newService | `app/dashboard/checklists/technical-paths/page.tsx` |
| `newPath` | **مترجم عبر newPath** | Translated via newPath | `app/dashboard/checklists/technical-paths/page.tsx` |
| `inline.this.will.permanently.delete.all.sub.items.and.services.linked.to.this.path` | **سيؤدي هذا لحذف كافة العناصر والخدمات التابعة لهذا المسار بشكل نهائي.** | This will permanently delete all sub-items and services linked to this path. | `app/dashboard/settings/checklists/technical-paths/page.tsx` |
| `inline.work.stages.engineering` | **هندسة مراحل العمل** | Work Stages Engineering | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.add.stage` | **إضافة مرحلة** | Add Stage | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.target` | **مستهدف:** | Target: | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `editStage` | **مترجم عبر editStage** | Translated via editStage | `app/dashboard/checklists/technical-paths/technical-stages-manager.tsx` |
| `addStage` | **مترجم عبر addStage** | Translated via addStage | `app/dashboard/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.time.tracking` | **تتبع زمني** | Time Tracking | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.numeric.tracking` | **تتبع عددي** | Numeric Tracking | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `nextStages` | **مترجم عبر nextStages** | Translated via nextStages | `app/dashboard/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.linked` | **المراحل المربوطة** | Linked | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.installment` | **الدفعة** | Installment | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.save.changes` | **حفظ التغييرات** | Save Changes | `app/dashboard/settings/users/page.tsx` |
| `inline.target.budget` | **الميزانية المستهدفة** | Target Budget | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.add.payment` | **إضافة دفعة** | Add Payment | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.milestone.name` | **مسمى الدفعة** | Milestone Name | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.total.contract.value` | **إجمالي قيمة العقد** | Total Contract Value | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.link.stage` | **ربط فني...** | Link Stage... | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.no.link` | **بدون ربط** | No Link | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.status` | **الحالة** | Status | `app/dashboard/settings/users/page.tsx` |
| `inline.view.detailed.report` | **عرض التقرير المفصل** | View Detailed Report | `app/dashboard/reports/page.tsx` |
| `inline.total.portfolio.value` | **إجمالي المحفظة المالية** | Total Portfolio Value | `app/dashboard/reports/analytics/page.tsx` |
| `inline.global.executive.report` | **التقرير التنفيذي الشامل** | Global Executive Report | `app/dashboard/reports/page.tsx` |
| `inline.unified.business.intelligence.summary.covering.crm..projects..finance.and.hr` | **ملخص ذكاء أعمال موحد يشمل CRM والمشاريع والمالية والـ HR في شاشة واحدة.** | Unified business intelligence summary covering CRM, Projects, Finance and HR. | `app/dashboard/reports/page.tsx` |
| `inline.financial.performance.radar` | **رادار الأداء المالي والإنتاجي** | Financial Performance Radar | `app/dashboard/reports/page.tsx` |
| `inline.smart.analysis.linking.boq.budgets.to.actual.spending.and.progress` | **تحليل ذكي لربط ميزانيات المقايسات بالمصروفات الفعلية ونسب الإنجاز.** | Smart analysis linking BOQ budgets to actual spending and progress. | `app/dashboard/reports/page.tsx` |
| `inline.client.visit.dossier` | **سجل تفاعل العملاء والزيارات** | Client Visit Dossier | `app/dashboard/reports/page.tsx` |
| `inline.visit.by.visit.audit.of.technical.progress.and.site.notes` | **تحليل تاريخي لكل زيارة: الإنجاز الفني الموثق والملاحظات الميدانية.** | Visit-by-visit audit of technical progress and site notes. | `app/dashboard/reports/page.tsx` |
| `inline.engineering.reports.hub` | **مركز التقارير والرقابة الهندسية** | Engineering Reports Hub | `app/dashboard/reports/page.tsx` |
| `inline.advanced.analytics.linking.field.logs.to.financial.center` | **أدوات تحليلية متقدمة لربط الميدان بالمركز المالي والإداري.** | Advanced analytics linking field logs to financial center. | `app/dashboard/reports/page.tsx` |
| `inline.nova.ai.custom.reporting` | **ذكاء Nova للتقارير المخصصة** | Nova AI Custom Reporting | `app/dashboard/reports/page.tsx` |
| `inline.nova.analytics.intelligence` | **ذكاء Nova التحليلي** | Nova Analytics Intelligence | `app/dashboard/reports/analytics/page.tsx` |
| `inline.operational...financial.radar` | **رادار الأداء التشغيلي والمالي** | Operational & Financial Radar | `app/dashboard/reports/analytics/page.tsx` |
| `inline.export.report` | **تصدير التقرير** | Export Report | `app/dashboard/reports/analytics/page.tsx` |
| `inline.actual.approved.spend` | **المصروف الفعلي (المعتمد)** | Actual Approved Spend | `app/dashboard/reports/analytics/page.tsx` |
| `inline.unspent.balance` | **الوفر / المتبقي المالي** | Unspent Balance | `app/dashboard/reports/analytics/page.tsx` |
| `inline.budget.vs..spent.analysis` | **مقارنة الميزانية بالمصروف** | Budget vs. Spent Analysis | `app/dashboard/reports/analytics/page.tsx` |
| `inline.budget` | **الميزانية** | Budget | `app/dashboard/reports/executive/page.tsx` |
| `inline.spent` | **المصروف** | Spent | `app/dashboard/reports/executive/page.tsx` |
| `inline.budget.distribution` | **توزيع الميزانية عبر المسارات** | Budget Distribution | `app/dashboard/reports/analytics/page.tsx` |
| `inline.detailed.performance.ledger` | **كشف الأداء المالي التفصيلي (Ledger)** | Detailed Performance Ledger | `app/dashboard/reports/analytics/page.tsx` |
| `inline.project...client` | **المشروع / العميل** | Project / Client | `app/dashboard/reports/analytics/page.tsx` |
| `inline.variance` | **الانحراف** | Variance | `app/dashboard/reports/analytics/page.tsx` |
| `inline.construction` | **مقاولات** | Construction | `app/dashboard/reports/executive/page.tsx` |
| `inline.consulting` | **استشارات** | Consulting | `app/dashboard/reports/executive/page.tsx` |
| `inline.unified.executive.report` | **التقرير السيادي الشامل** | Unified Executive Report | `app/dashboard/reports/executive/page.tsx` |
| `inline.enterprise.performance.summary` | **ملخص الأداء العام للمنشأة** | Enterprise Performance Summary | `app/dashboard/reports/executive/page.tsx` |
| `inline.print.official.report` | **استخراج التقرير الرسمي** | Print Official Report | `app/dashboard/reports/executive/page.tsx` |
| `inline.annual.executive.performance.report` | **التقرير التنفيذي السنوي الشامل** | Annual Executive Performance Report | `app/dashboard/reports/executive/page.tsx` |
| `inline.portfolio.value` | **إجمالي المحفظة** | Portfolio Value | `app/dashboard/reports/executive/page.tsx` |
| `inline.active.projects` | **المشاريع الجارية** | Active Projects | `app/dashboard/reports/executive/page.tsx` |
| `inline.total.staff` | **القوى العاملة** | Total Staff | `app/dashboard/reports/executive/page.tsx` |
| `inline.attendance` | **انضباط الحضور** | Attendance | `app/dashboard/reports/executive/page.tsx` |
| `inline.budget.vs.expenses` | **تحليل الميزانية vs المصروفات** | Budget vs Expenses | `app/dashboard/reports/executive/page.tsx` |
| `inline.portfolio.by.activity` | **توزيع المحفظة حسب النشاط** | Portfolio by Activity | `app/dashboard/reports/executive/page.tsx` |
| `inline.cloud.data.integrity` | **شهادة صحة البيانات السحابية** | Cloud Data Integrity | `app/dashboard/reports/executive/page.tsx` |
| `companyIdentity` | **مترجم عبر companyIdentity** | Translated via companyIdentity | `app/dashboard/settings/page.tsx` |
| `manageCompanyData` | **مترجم عبر manageCompanyData** | Translated via manageCompanyData | `app/dashboard/settings/page.tsx` |
| `inline.users.management` | **إدارة المستخدمين** | Users Management | `app/dashboard/settings/page.tsx` |
| `inline.manage.login.accounts..assign.roles..and.activate.users` | **إدارة حسابات الدخول، تعيين الأدوار، وتفعيل الحسابات** | Manage login accounts, assign roles, and activate users | `app/dashboard/settings/page.tsx` |
| `inline.manage.operational.constitution..reference.lists..and.technical.paths` | **إدارة الدستور التشغيلي والقوائم المرجعية والمسارات الفنية** | Manage operational constitution, reference lists, and technical paths | `app/dashboard/settings/page.tsx` |
| `templates` | **مترجم عبر templates** | Translated via templates | `app/dashboard/settings/page.tsx` |
| `templatesDesc` | **مترجم عبر templatesDesc** | Translated via templatesDesc | `app/dashboard/settings/page.tsx` |
| `rolesRef` | **مترجم عبر rolesRef** | Translated via rolesRef | `app/dashboard/settings/page.tsx` |
| `inline.manage.roles.and.access.permissions.for.employees` | **إدارة الأدوار وصلاحيات الوصول للموظفين** | Manage roles and access permissions for employees | `app/dashboard/settings/page.tsx` |
| `workHours` | **مترجم عبر workHours** | Translated via workHours | `app/dashboard/settings/page.tsx` |
| `workHoursDesc` | **مترجم عبر workHoursDesc** | Translated via workHoursDesc | `app/dashboard/settings/page.tsx` |
| `profile` | **مترجم عبر profile** | Translated via profile | `app/dashboard/settings/page.tsx` |
| `inline.edit.personal.profile.and.password` | **تعديل بيانات الحساب الشخصي وكلمة المرور** | Edit personal profile and password | `app/dashboard/settings/page.tsx` |
| `settings` | **مترجم عبر settings** | Translated via settings | `app/dashboard/settings/page.tsx` |
| `inline.manage.system.preferences.and.organization.settings` | **إدارة تفضيلات النظام وإعدادات المنشأة** | Manage system preferences and organization settings | `app/dashboard/settings/page.tsx` |
| `inline.go.to.settings` | **الانتقال للضبط** | Go to settings | `app/dashboard/settings/page.tsx` |
| `settings.checklists` | **مترجم عبر settings.checklists** | Translated via settings.checklists | `app/dashboard/settings/checklists/page.tsx` |
| `inline.manage.operational.constitution.and.unified.system.references` | **إدارة الدستور التشغيلي والقواعد المرجعية الموحدة للنظام** | Manage operational constitution and unified system references | `app/dashboard/settings/checklists/page.tsx` |
| `referenceLists` | **مترجم عبر referenceLists** | Translated via referenceLists | `app/dashboard/settings/checklists/page.tsx` |
| `boqMasterTree` | **مترجم عبر boqMasterTree** | Translated via boqMasterTree | `app/dashboard/settings/checklists/page.tsx` |
| `halls` | **مترجم عبر halls** | Translated via halls | `app/dashboard/settings/checklists/page.tsx` |
| `inline.identity.migration.complete` | **اكتملت هجرة الهوية** | Identity Migration Complete | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.identity.standardization` | **توحيد هويات النظام** | Identity Standardization | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.fix.permission.variances.and.unify.role.codes.for.all.users` | **إصلاح تباين الصلاحيات وتوحيد الأكواد المرجعية لكافة المستخدمين.** | Fix permission variances and unify role codes for all users. | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.run.identity.fix` | **بدء الهوية السيادية** | Run Identity Fix | `app/dashboard/settings/checklists/seed-tool.tsx` |
| `inline.display.order` | **ترتيب العرض** | Display Order | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.add.new.area` | **إضافة منطقة سكنية** | Add New Area | `app/dashboard/settings/checklists/geo/page.tsx` |
| `inline.please.select.a.governorate` | **يرجى اختيار محافظة من القائمة.** | Please select a governorate. | `app/dashboard/settings/checklists/geo/page.tsx` |
| `inline.this.will.permanently.delete.the.record` | **هل أنت متأكد؟ سيتم حذف السجل نهائياً.** | This will permanently delete the record. | `app/dashboard/settings/checklists/geo/page.tsx` |
| `inline.job.titles...trades` | **الوظائف والمهن المعتمدة** | Job Titles & Trades | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.edit.job` | **تعديل بيانات الوظيفة** | Edit Job | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.add.new.job` | **إضافة وظيفة للقسم** | Add New Job | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.reference.hourly.rate` | **تعرفة الساعة المرجعية (KWD)** | Reference Hourly Rate | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.system.access.role` | **ربط صلاحيات الوصول للنظام** | System Access Role | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.no.access..field.trade.only` | **--- بدون وصول (مهنة ميدانية فقط) ---** | --- No Access (Field Trade Only) --- | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.commit.job` | **اعتماد الوظيفة** | Commit Job | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.please.select.a.department` | **يرجى اختيار قسم من القائمة لإدارة المهن.** | Please select a department. | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.field.only` | **ميدانية فقط** | Field Only | `app/dashboard/settings/checklists/departments/page.tsx` |
| `inline.are.you.sure..this.will.permanently.delete.the.record.from.organizational.structure` | **هل أنت متأكد؟ سيتم حذف هذا السجل نهائياً من الهيكل التنظيمي ولا يمكن التراجع.** | Are you sure? This will permanently delete the record from organizational structure. | `app/dashboard/settings/checklists/departments/page.tsx` |
| `unitTypes` | **مترجم عبر unitTypes** | Translated via unitTypes | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `paymentMethods` | **مترجم عبر paymentMethods** | Translated via paymentMethods | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `paymentConditionTypes` | **مترجم عبر paymentConditionTypes** | Translated via paymentConditionTypes | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `milestoneTimingTypes` | **مترجم عبر milestoneTimingTypes** | Translated via milestoneTimingTypes | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `itemCategories` | **مترجم عبر itemCategories** | Translated via itemCategories | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `costTypeCategories` | **مترجم عبر costTypeCategories** | Translated via costTypeCategories | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.main.lists` | **القوائم الأساسية** | Main Lists | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.new.main.list` | **قائمة مرجعية جديدة** | New Main List | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.new.reference.list` | **إنشاء قائمة مرجعية جديدة** | New Reference List | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.create.list` | **إنشاء القائمة** | Create List | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.add.entry` | **إضافة بند** | Add Entry | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `order` | **مترجم عبر order** | Translated via order | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.actions` | **إجراءات** | Actions | `app/dashboard/settings/templates/quotations/page.tsx` |
| `inline.edit.entry` | **تعديل بند** | Edit Entry | `app/dashboard/settings/checklists/general-lists/page.tsx` |
| `inline.meeting.rooms.registry` | **إدارة قاعات الاجتماعات** | Meeting Rooms Registry | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.add.new.room` | **إضافة قاعة جديدة** | Add New Room | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.capacity` | **السعة الاستيعابية** | Capacity | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.no.rooms.found` | **لا توجد قاعات مسجلة.** | No rooms found. | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.edit.room` | **تعديل بيانات القاعة** | Edit Room | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.add.room` | **إضافة قاعة جديدة** | Add Room | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.make.room.available.in.radar` | **إتاحة القاعة للاستخدام في الرادار.** | Make room available in radar. | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.this.will.permanently.delete.the.hall..which.may.affect.historical.bookings` | **سيتم حذف القاعة نهائياً من النظام، مما قد يؤدي لإزالة المواعيد التاريخية المرتبطة بها.** | This will permanently delete the hall, which may affect historical bookings. | `app/dashboard/settings/checklists/halls/page.tsx` |
| `inline.order.updated` | **تم تحديث ترتيب المسار** | Order Updated | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.responsible.departments` | **الأقسام المسؤولة عن التنفيذ** | Responsible Departments | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.selected` | **صلاحية مختارة** | Selected | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.select.departments` | **--- اختر الأقسام المعنية ---** | --- Select Departments --- | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.search.departments` | **بحث في الأقسام...** | Search departments... | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.clear` | **تصفير** | Clear | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.if.no.departments.are.selected..the.stage.will.be.visible.to.everyone` | *** في حال عدم اختيار أي قسم، ستظهر المرحلة لكافة الموظفين تلقائياً.** | * If no departments are selected, the stage will be visible to everyone. | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.target.qty` | **الكمية المستهدفة** | Target Qty | `app/dashboard/settings/checklists/technical-paths/technical-stages-manager.tsx` |
| `inline.file.too.large` | **حجم الملف كبير جداً** | File too large | `app/dashboard/settings/company/page.tsx` |
| `inline.please.upload.an.image.smaller.than.1mb` | **يرجى رفع صورة أقل من 1 ميجابايت لضمان الأداء.** | Please upload an image smaller than 1MB. | `app/dashboard/settings/company/page.tsx` |
| `inline.upload` | **رفع صورة** | Upload | `app/dashboard/settings/company/page.tsx` |
| `inline.url` | **رابط** | URL | `app/dashboard/settings/company/page.tsx` |
| `inline.text` | **نص** | Text | `app/dashboard/settings/company/page.tsx` |
| `inline.remove` | **حذف** | Remove | `app/dashboard/settings/company/page.tsx` |
| `inline.click.to.upload..max.1mb` | **اضغط للرفع (1MB كحد أقصى)** | Click to Upload (Max 1MB) | `app/dashboard/settings/company/page.tsx` |
| `inline.type.text.here` | **اكتب النص هنا...** | Type text here... | `app/dashboard/settings/company/page.tsx` |
| `companyProfile` | **مترجم عبر companyProfile** | Translated via companyProfile | `app/dashboard/settings/company/page.tsx` |
| `commercialRegistry` | **مترجم عبر commercialRegistry** | Translated via commercialRegistry | `app/dashboard/settings/company/page.tsx` |
| `inline.branding...assets` | **المظهر والهوية البصرية** | Branding & Assets | `app/dashboard/settings/company/page.tsx` |
| `logo` | **مترجم عبر logo** | Translated via logo | `app/dashboard/settings/company/page.tsx` |
| `inline.header` | **الهيدر (الرأس)** | Header | `app/dashboard/settings/company/page.tsx` |
| `inline.footer` | **الفوتر (التذييل)** | Footer | `app/dashboard/settings/company/page.tsx` |
| `inline.image.too.large` | **حجم الصورة كبير** | Image too large | `app/dashboard/settings/profile/page.tsx` |
| `inline.max.1mb` | **يرجى اختيار صورة أقل من 1 ميجابايت.** | Max 1MB | `app/dashboard/settings/profile/page.tsx` |
| `inline.manage.your.technical.identity.and.profile.data` | **إدارة هويتك الفنية وبياناتك الشخصية** | Manage your technical identity and profile data | `app/dashboard/settings/profile/page.tsx` |
| `inline.full.name.is.used.in.all.official.communications.and.field.reports.instead.of.email` | **يتم استخدام الاسم الكامل في كافة المراسلات الرسمية والتقارير الميدانية بدلاً من البريد الإلكتروني.** | Full name is used in all official communications and field reports instead of email. | `app/dashboard/settings/profile/page.tsx` |
| `personalInfo` | **مترجم عبر personalInfo** | Translated via personalInfo | `app/dashboard/settings/profile/page.tsx` |
| `inline.official.full.name` | **الاسم الكامل المعتمد** | Official Full Name | `app/dashboard/settings/profile/page.tsx` |
| `username` | **مترجم عبر username** | Translated via username | `app/dashboard/settings/profile/page.tsx` |
| `saveChanges` | **مترجم عبر saveChanges** | Translated via saveChanges | `app/dashboard/settings/profile/page.tsx` |
| `inline.customize.reference.dictionaries.and.operational.units` | **تخصيص القواميس المرجعية والوحدات التشغيلية للمنظمة.** | Customize reference dictionaries and operational units. | `app/dashboard/settings/reference-lists/page.tsx` |
| `addNewItem` | **مترجم عبر addNewItem** | Translated via addNewItem | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.system.guard` | **الرقابة النظامية** | System Guard | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.no.items.found` | **لا توجد نتائج مطابقة.** | No items found. | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.edit.reference` | **تعديل عنصر مرجعي** | Edit Reference | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.add.reference` | **إضافة عنصر مرجعي** | Add Reference | `app/dashboard/settings/reference-lists/page.tsx` |
| `symbol` | **مترجم عبر symbol** | Translated via symbol | `app/dashboard/settings/reference-lists/page.tsx` |
| `category` | **مترجم عبر category** | Translated via category | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.make.item.available.in.select.lists` | **إتاحة العنصر للاستخدام في القوائم.** | Make item available in select lists. | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.are.you.sure..deleting.this.item.may.affect.historical.records.linked.to.it` | **هل أنت متأكد من حذف هذا العنصر؟ قد يؤثر ذلك على البيانات التاريخية المرتبطة به.** | Are you sure? Deleting this item may affect historical records linked to it. | `app/dashboard/settings/reference-lists/page.tsx` |
| `inline.admin.access.required` | **صلاحيات إدارية مطلوبة** | Admin Access Required | `app/dashboard/settings/roles/page.tsx` |
| `inline.insufficient.permissions.to.manage.roles` | **لا تملك تصريحاً كافياً للتحكم في مصفوفة الأدوار.** | Insufficient permissions to manage roles. | `app/dashboard/settings/roles/page.tsx` |
| `inline.back.to.dashboard` | **العودة للرئيسية** | Back to Dashboard | `app/dashboard/settings/roles/page.tsx` |
| `inline.roles...permissions` | **إدارة الصلاحيات** | Roles & Permissions | `app/dashboard/settings/roles/page.tsx` |
| `inline.access.control...responsibility.matrix` | **تعيين حدود الوصول وتوزيع المسؤوليات** | Access Control & Responsibility Matrix | `app/dashboard/settings/roles/page.tsx` |
| `inline.templates` | **قوالب الصلاحيات** | Templates | `app/dashboard/settings/roles/page.tsx` |
| `inline.new.role` | **إضافة دور جديد** | New Role | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.guide` | **دليل الربط** | Guide | `app/dashboard/settings/roles/page.tsx` |
| `inline.select.a.role.to.edit` | **اختر دوراً للتعديل** | Select a role to edit | `app/dashboard/settings/roles/page.tsx` |
| `inline.edit.role` | **تعديل دور** | Edit Role | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.define.access.scope.and.work.permissions` | **تحديد نطاق الوصول وصلاحيات العمل** | Define access scope and work permissions | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.role.name..arabic` | **اسم الدور (عربي)** | Role Name (Arabic) | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.role.name..english` | **اسم الدور (English)** | Role Name (English) | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.role.status` | **حالة الدور** | Role Status | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.enable.or.disable.this.role` | **تفعيل أو تعطيل هذا الدور للموظفين** | Enable or disable this role | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.permissions.matrix` | **مصفوفة الصلاحيات** | Permissions Matrix | `app/dashboard/settings/roles/role-form.tsx` |
| `inline.save.role.settings` | **حفظ إعدادات الدور** | Save Role Settings | `app/dashboard/settings/roles/role-form.tsx` |
| `scopeNone` | **مترجم عبر scopeNone** | Translated via scopeNone | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `scopeOwn` | **مترجم عبر scopeOwn** | Translated via scopeOwn | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `scopeDept` | **مترجم عبر scopeDept** | Translated via scopeDept | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `scopeAll` | **مترجم عبر scopeAll** | Translated via scopeAll | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `inline.permission.matrix` | **مصفوفة الصلاحيات الميدانية** | Permission Matrix | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `inline.module` | **المورد** | Module | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `inline.actions...scopes` | **العمليات والنطاق** | Actions & Scopes | `app/dashboard/settings/roles/role-matrix-form.tsx` |
| `quotationTemplates` | **مترجم عبر quotationTemplates** | Translated via quotationTemplates | `app/dashboard/settings/templates/page.tsx` |
| `inline.build.flexible.pricing.templates.with.validity.and.payment.terms` | **بناء قوالب تسعير مرنة مع صلاحيات العرض وشروط الدفع.** | Build flexible pricing templates with validity and payment terms. | `app/dashboard/settings/templates/page.tsx` |
| `inline.8.active` | **8 نشط** | 8 Active | `app/dashboard/settings/templates/page.tsx` |
| `contractTemplates` | **مترجم عبر contractTemplates** | Translated via contractTemplates | `app/dashboard/settings/templates/page.tsx` |
| `inline.draft.legal.contracts.and.link.installments.to.technical.stages` | **صياغة العقود القانونية وربط الدفعات المالية بالمراحل الفنية.** | Draft legal contracts and link installments to technical stages. | `app/dashboard/settings/templates/page.tsx` |
| `inline.5.legal` | **5 قانوني** | 5 Legal | `app/dashboard/settings/templates/page.tsx` |
| `boqTemplates` | **مترجم عبر boqTemplates** | Translated via boqTemplates | `app/dashboard/settings/templates/page.tsx` |
| `inline.define.engineering.work.items..quantities..and.reference.rates` | **توصيف بنود الأعمال الهندسية، الكميات، والأسعار المرجعية.** | Define engineering work items, quantities, and reference rates. | `app/dashboard/settings/templates/page.tsx` |
| `inline.12.estim` | **12 مقايسة** | 12 Estim. | `app/dashboard/settings/templates/page.tsx` |
| `inline.manage.library` | **إدارة المكتبة** | Manage Library | `app/dashboard/settings/templates/page.tsx` |
| `inline.default` | **افتراضي** | Default | `app/dashboard/settings/templates/quotations/page.tsx` |
| `inline.associated.path` | **المسار المرتبط** | Associated Path | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.1st.installment` | **الدفعة الأولى** | 1st Installment | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.sovereign.contract.engineering` | **هندسة قوالب العقود السيادية** | Sovereign Contract Engineering | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `common.save` | **مترجم عبر common.save** | Translated via common.save | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `common.name` | **مترجم عبر common.name** | Translated via common.name | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `introText` | **مترجم عبر introText** | Translated via introText | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.payment.milestones...pipeline` | **جدول الدفعات والربط الفني** | Payment Milestones & Pipeline | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `milestoneTiming` | **مترجم عبر milestoneTiming** | Translated via milestoneTiming | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `technicalLink` | **مترجم عبر technicalLink** | Translated via technicalLink | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `amount` | **مترجم عبر amount** | Translated via amount | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `legalText` | **مترجم عبر legalText** | Translated via legalText | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.operational.context` | **الارتباط التشغيلي السيادي** | Operational Context | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.template.status` | **حالة القالب** | Template Status | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `common.isActive` | **مترجم عبر common.isActive** | Translated via common.isActive | `app/dashboard/settings/templates/contracts/contract-template-form.tsx` |
| `inline.legal.document.library` | **مكتبة الوثائق القانونية** | Legal Document Library | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.manage.contract.forms.and.approved.payment.structures` | **إدارة النماذج التعاقدية وهياكل الدفعات المعتمدة.** | Manage contract forms and approved payment structures. | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.new.template` | **قالب عقد جديد** | New Template | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.search.contract.templates` | **بحث باسم العقد...** | Search contract templates... | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.template.name` | **مسمى القالب** | Template Name | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.milestones` | **الدفعات** | Milestones | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.est..value` | **القيمة** | Est. Value | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.no.contract.templates.found` | **لا توجد قوالب عقود مسجلة.** | No contract templates found. | `app/dashboard/settings/templates/contracts/page.tsx` |
| `inline.manage.reference.templates.for.quotes.and.tenders` | **إدارة النماذج المرجعية لعروض الأسعار والمناقصات** | Manage reference templates for quotes and tenders | `app/dashboard/settings/templates/quotations/page.tsx` |
| `newTemplate` | **مترجم عبر newTemplate** | Translated via newTemplate | `app/dashboard/settings/templates/quotations/page.tsx` |
| `inline.linked.service` | **الخدمة المرتبطة** | Linked Service | `app/dashboard/settings/templates/quotations/page.tsx` |
| `inline.no.templates.found` | **لا يوجد قوالب مسجلة.** | No templates found. | `app/dashboard/settings/templates/quotations/page.tsx` |
| `inline.registry.item.linked` | **تم ربط البند المرجعي** | Registry Item Linked | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.quotation.template.design` | **هندسة قوالب عروض الأسعار** | Quotation Template Design | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.pricing.items...pipeline.links` | **بنود التسعير والارتباط الفني** | Pricing Items & Pipeline Links | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.registry.link` | **القاموس السيادي** | Registry Link | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.link.offer.items.to.registry` | **ربط بنود العرض بالقاموس الموحد** | Link Offer Items to Registry | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.manual.item` | **بند يدوي** | Manual Item | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.item.label` | **مسمى البند / الدفعة** | Item Label | `app/dashboard/settings/templates/quotations/quotation-template-form.tsx` |
| `inline.account.created.successfully` | **تم إنشاء الحساب بنجاح** | Account Created Successfully | `app/dashboard/settings/users/page.tsx` |
| `inline.user.management` | **إدارة مستخدمي النظام** | User Management | `app/dashboard/settings/users/page.tsx` |
| `inline.control.accounts..permissions..and.field.admin.roles` | **التحكم في حسابات الدخول والصلاحيات الميدانية والادارية.** | Control accounts, permissions, and field/admin roles. | `app/dashboard/settings/users/page.tsx` |
| `inline.create.user` | **إنشاء حساب موظف** | Create User | `app/dashboard/settings/users/page.tsx` |
| `inline.setup.login.account` | **إعداد حساب دخول جديد** | Setup Login Account | `app/dashboard/settings/users/page.tsx` |
| `inline.select.eligible.employee` | **اختر الموظف (المرتبط بدور)** | Select Eligible Employee | `app/dashboard/settings/users/page.tsx` |
| `inline.choose.staff` | **اختيار الموظف...** | Choose staff... | `app/dashboard/settings/users/page.tsx` |
| `inline.username` | **اسم المستخدم (معرف الدخول)** | Username | `app/dashboard/settings/users/page.tsx` |
| `inline.optional..default.emp` | **اختياري (الافتراضي الرقم الوظيفي)** | Optional (Default Emp #) | `app/dashboard/settings/users/page.tsx` |
| `inline.override.role` | **تعديل الدور الأمني** | Override Role | `app/dashboard/settings/users/page.tsx` |
| `inline.login.email` | **البريد الإلكتروني للدخول** | Login Email | `app/dashboard/settings/users/page.tsx` |
| `inline.initial.password` | **كلمة المرور المبدئية** | Initial Password | `app/dashboard/settings/users/page.tsx` |
| `inline.create.account.now` | **إنشاء الحساب الآن** | Create Account Now | `app/dashboard/settings/users/page.tsx` |
| `inline.search.by.name.or.email` | **بحث باسم المستخدم أو البريد...** | Search by name or email... | `app/dashboard/settings/users/page.tsx` |
| `inline.user` | **المستخدم** | User | `app/dashboard/settings/users/page.tsx` |
| `inline.role` | **الدور الأمني (الصلاحيات)** | Role | `app/dashboard/settings/users/page.tsx` |
| `inline.auth` | **كلمة المرور** | Auth | `app/dashboard/settings/users/page.tsx` |
| `inline.suspended` | **موقوف** | Suspended | `app/dashboard/settings/users/page.tsx` |
| `inline.edit.user.account` | **تعديل حساب المستخدم** | Edit User Account | `app/dashboard/settings/users/page.tsx` |
| `inline.display.name` | **الاسم المعروض** | Display Name | `app/dashboard/settings/users/page.tsx` |
| `inline.reset.password` | **إعادة تعيين كلمة المرور** | Reset Password | `app/dashboard/settings/users/page.tsx` |
| `inline.new.password..will.send.link.to.email` | **كلمة مرور جديدة (سيتم إرسال رابط للبريد)** | New Password (Will send link to email) | `app/dashboard/settings/users/page.tsx` |
| `inline.type.anything.to.trigger.link` | **اكتب أي شيء لإرسال الرابط** | Type anything to trigger link | `app/dashboard/settings/users/page.tsx` |
| `inline.identity.fixed` | **تم إصلاح الهويات** | Identity Fixed | `app/developer/page.tsx` |
| `inline.sovereign.dev.console` | **لوحة تحكم المطور السيادية** | Sovereign Dev Console | `app/developer/page.tsx` |
| `inline.fix.identities` | **إصلاح الهويات** | Fix Identities | `app/developer/page.tsx` |
| `shiftDetectMsg` | **مترجم عبر shiftDetectMsg** | Translated via shiftDetectMsg | `components/settings/work-hours-manager.tsx` |
| `singleShiftMsg` | **مترجم عبر singleShiftMsg** | Translated via singleShiftMsg | `components/settings/work-hours-manager.tsx` |
| `inline.double` | **فترتين** | Double | `components/settings/work-hours-manager.tsx` |
| `inline.single` | **فترة واحدة** | Single | `components/settings/work-hours-manager.tsx` |
| `doubleShift` | **مترجم عبر doubleShift** | Translated via doubleShift | `components/settings/work-hours-manager.tsx` |
| `morningShift` | **مترجم عبر morningShift** | Translated via morningShift | `components/settings/work-hours-manager.tsx` |
| `checkInTime` | **مترجم عبر checkInTime** | Translated via checkInTime | `components/settings/work-hours-manager.tsx` |
| `checkOutTime` | **مترجم عبر checkOutTime** | Translated via checkOutTime | `components/settings/work-hours-manager.tsx` |
| `eveningShift` | **مترجم عبر eveningShift** | Translated via eveningShift | `components/settings/work-hours-manager.tsx` |
| `singleShiftActiveMsg` | **مترجم عبر singleShiftActiveMsg** | Translated via singleShiftActiveMsg | `components/settings/work-hours-manager.tsx` |
| `gracePeriod` | **مترجم عبر gracePeriod** | Translated via gracePeriod | `components/settings/work-hours-manager.tsx` |
| `restDuration` | **مترجم عبر restDuration** | Translated via restDuration | `components/settings/work-hours-manager.tsx` |
| `smartDetectHint` | **مترجم عبر smartDetectHint** | Translated via smartDetectHint | `components/settings/work-hours-manager.tsx` |
| `saveAllRules` | **مترجم عبر saveAllRules** | Translated via saveAllRules | `components/settings/work-hours-manager.tsx` |
| `architecturalWorkingHours` | **مترجم عبر architecturalWorkingHours** | Translated via architecturalWorkingHours | `components/settings/work-hours-manager.tsx` |
| `meetingRoomsWorkingHours` | **مترجم عبر meetingRoomsWorkingHours** | Translated via meetingRoomsWorkingHours | `components/settings/work-hours-manager.tsx` |
| `fieldWorkWorkingHours` | **مترجم عبر fieldWorkWorkingHours** | Translated via fieldWorkWorkingHours | `components/settings/work-hours-manager.tsx` |
| `halfDayRule` | **مترجم عبر halfDayRule** | Translated via halfDayRule | `components/settings/work-hours-manager.tsx` |
| `inline.set.a.specific.weekday.with.reduced.hours` | **تخصيص يوم في الأسبوع بنظام دوام مخفف.** | Set a specific weekday with reduced hours. | `components/settings/work-hours-manager.tsx` |
| `selectDay` | **مترجم عبر selectDay** | Translated via selectDay | `components/settings/work-hours-manager.tsx` |
| `halfDayMode` | **مترجم عبر halfDayMode** | Translated via halfDayMode | `components/settings/work-hours-manager.tsx` |
| `morningOnly` | **مترجم عبر morningOnly** | Translated via morningOnly | `components/settings/work-hours-manager.tsx` |
| `eveningOnly` | **مترجم عبر eveningOnly** | Translated via eveningOnly | `components/settings/work-hours-manager.tsx` |
| `customEndTime` | **مترجم عبر customEndTime** | Translated via customEndTime | `components/settings/work-hours-manager.tsx` |
| `holidays` | **مترجم عبر holidays** | Translated via holidays | `components/settings/work-hours-manager.tsx` |
| `inline.manage.weekly.and.public.holidays` | **إدارة العطلات الأسبوعية والرسمية.** | Manage weekly and public holidays. | `components/settings/work-hours-manager.tsx` |
| `weeklyHolidaysStatic` | **مترجم عبر weeklyHolidaysStatic** | Translated via weeklyHolidaysStatic | `components/settings/work-hours-manager.tsx` |
| `scheduledPublicHolidays` | **مترجم عبر scheduledPublicHolidays** | Translated via scheduledPublicHolidays | `components/settings/work-hours-manager.tsx` |
| `addHolidayManually` | **مترجم عبر addHolidayManually** | Translated via addHolidayManually | `components/settings/work-hours-manager.tsx` |
| `holidayNameAr` | **مترجم عبر holidayNameAr** | Translated via holidayNameAr | `components/settings/work-hours-manager.tsx` |
| `holidayNameEn` | **مترجم عبر holidayNameEn** | Translated via holidayNameEn | `components/settings/work-hours-manager.tsx` |
| `addEntry` | **مترجم عبر addEntry** | Translated via addEntry | `components/settings/work-hours-manager.tsx` |
| `inline.no.scheduled.holidays` | **لا يوجد عطلات مجدولة.** | No scheduled holidays. | `components/settings/work-hours-manager.tsx` |
| `-` | **مترجم عبر -** | Translated via - | `components/ui/smart-date-input.tsx` |
| `.` | **مترجم عبر .** | Translated via . | `context/language-context.tsx` |

### 📁 12. المساعد الذكي (AI Assistant)
**عدد المفاتيح والكلمات المستخرجة**: 15 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
| `ai.hub` | **مترجم عبر ai.hub** | Translated via ai.hub | `app/dashboard/ai/page.tsx` |
| `ai.desc` | **مترجم عبر ai.desc** | Translated via ai.desc | `app/dashboard/ai/page.tsx` |
| `inline.accounting.assistant` | **مساعد محاسبي** | Accounting Assistant | `app/dashboard/ai/page.tsx` |
| `inline.draft.journal.entries.or.get.expert.advice` | **صياغة قيود اليومية أو الحصول على استشارات محاسبية ذكية.** | Draft journal entries or get expert advice. | `app/dashboard/ai/page.tsx` |
| `inline.upload.quotes.and.compare.technically.financially` | **رفع عروض الموردين وتحليلها والمقارنة الفنية والمالية.** | Upload quotes and compare technically/financially. | `app/dashboard/ai/page.tsx` |
| `inline.cash.flow.forecast` | **توقع السيولة** | Cash Flow Forecast | `app/dashboard/ai/page.tsx` |
| `inline.project.liquidity.based.on.boq.progress` | **تحليل التدفقات النقدية بناءً على إنجاز المقايسات.** | Project liquidity based on BOQ progress. | `app/dashboard/ai/page.tsx` |
| `inline.accounting.intelligence.terminal` | **محطة الذكاء المحاسبي** | Accounting Intelligence Terminal | `app/dashboard/ai/page.tsx` |
| `inline.describe.a.transaction.in.natural.language.to.generate.entries` | **صف العملية المالية بلغة طبيعية (مثلاً: استلمنا دفعة 5,000 من العميل أ كدفعة مقدمة).** | Describe a transaction in natural language to generate entries. | `app/dashboard/ai/page.tsx` |
| `inline.enter.transaction.description` | **اكتب هنا تفاصيل العملية...** | Enter transaction description... | `app/dashboard/ai/page.tsx` |
| `inline.analyze...draft.entry` | **تحليل وتوليد القيد** | Analyze & Draft Entry | `app/dashboard/ai/page.tsx` |
| `inline.proposed.journal.entry` | **القيد المحاسبي المقترح** | Proposed Journal Entry | `app/dashboard/ai/page.tsx` |
| `inline.account.name` | **الحساب** | Account Name | `app/dashboard/ai/page.tsx` |
| `inline.debit` | **مدين ($)** | Debit ($) | `app/dashboard/ai/page.tsx` |
| `inline.credit` | **دائن ($)** | Credit ($) | `app/dashboard/ai/page.tsx` |

### 📁 13. الدخول والتسجيل والتقديم (Auth, Login & Registration)
**عدد المفاتيح والكلمات المستخرجة**: 0 مفتاحاً/كلمة.

| المفتاح البرمجي (Key) | المسمى العربي الرشيق (Odoo Style) | English Odoo Name | الملف المصدر |
| :--- | :--- | :--- | :--- |
