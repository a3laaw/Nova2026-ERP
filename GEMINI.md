> **⚠️ هذا الملف أصبح مؤشراً فقط.** دستور المشروع انتقل إلى **[`AGENTS.md`](AGENTS.md)** ليصمد مع أي منصة تطوير (كان `GEMINI.md` تُقرأ من أدوات Google وحدها، وهي جزء مما يُمحى مع إغلاق المنصة).
> عدّل `AGENTS.md` وأبقِ هذا الملف لادوات Gemini. للانتقال إلى منصة جديدة راجع **[`docs/migration-runbook.md`](docs/migration-runbook.md)**.

Project AI Instructions (Strict Workspace Rules)
You are an expert software engineer working on the NovaFlow ERP system.You MUST strictly follow these rules when writing or modifying code. Do not argue with these rules, just apply them:

1. Dropdowns & Searchable Pickers (CRITICAL)
DO NOT use Popover, DropdownMenu, or Select from Shadcn UI for searchable lists, especially inside Dialog components, as they cause Focus Trap conflicts.
You MUST use the custom component <SearchableDropdown> from @/components/ui/searchable-dropdown for any searchable dropdown (single or multi-select).
2. Localization (i18n) (CRITICAL)
DO NOT rewrite, delete, or replace the file src/context/language-context.tsx. It is locked.
If you need a new key, append it at the end of the ar and en objects. Do not delete existing keys.
Use tSafe('inline.unique.key', 'النص العربي', 'English Text') for all new strings.
DO NOT use isRtl ? 'ar' : 'en' inline conditionals.
3. UI/UX & Icons
Use Tailwind CSS and Shadcn UI for basic components.
Ensure the UI supports RTL and uses lucide-react icons.
4. Color Palette & UI Theme (CRITICAL)
You MUST strictly use the following custom colors for the UI. يُمنع منعاً باتاً استخدام اللون الأسود القاسي (black, bg-black, text-black). استخدم بدلاً منه slate-800 للنصوص إذا لزم الأمر.

Primary Color (Bright Orange): bg-[#FFB000], text-[#FFB000], border-[#FFB000].
Secondary Color (Orange-Red): bg-[#FF5722], text-[#FF5722] (استخدمه للأزرار الثانوية أو التدرجات).
Accent Color (Bright Yellow): bg-[#FFD600], text-[#FFD600] (استخدمه للتنبيهات أو الأيقونات البارزة).
Info Color (Royal Blue): bg-[#2563EB], text-[#2563EB] (استخدمه للروابط أو إشارات الحالة المعلوماتية).
Soft Background Color (Light Pink): bg-[#FCE4EC] (استخدمه للخلفيات الفاتحة أو البطاقات المميزة بدلاً من الأبيض الكئيب).
Text & Neutral Colors:
للعناوين: text-slate-800
للنصوص العادية: text-slate-600
للنصوص الباهتة: text-slate-400
UI Styling (Shapes & Shadows):
Use heavily rounded corners: rounded-[2rem] or rounded-[2.5rem] for main cards, rounded-xl or rounded-2xl for buttons and inputs.
Use thick borders for emphasis: border-2 border-slate-100.
Buttons must have a bottom border shadow effect using the secondary color: border-b-4 border-[#FF5722].
5. UI Sizing & Layout Standards (CRITICAL)
Full-Width Layouts: Forms and pages MUST utilize the full width of the screen. Avoid restrictive containers like max-w-md or max-w-2xl for main page layouts. Use w-full or max-w-[1600px] mx-auto.
Print Wrapper: The PrintWrapper component must expand to fullWidth when used in contract/quotation pages.
Dropdowns & Selects: SelectContent and PopoverContent MUST have a max-height constraint. Always use max-h-[300px] and overflow-y-auto for any list containing more than 3 items.
Buttons: Standard buttons MUST be h-10. Primary CTAs (Save) can be h-12. NEVER use h-14, h-16, or larger. Font size must be text-sm or text-xs. NEVER text-xl.
Inputs: Standard inputs MUST be h-10. NEVER use h-14 for standard inputs.

6. Data Model & Relationships (CRITICAL)
Every Firestore collection path lives in `src/firebase/multi-tenant.ts` (`paths.*`). Do NOT hardcode `companies/${companyId}/...` paths in pages or services.
The full relationship map is documented in `docs/relationships.md` and machine-readable in `docs/relations.json`.
Whenever you add a collection, rename a path, or add an `xxxId` field in `src/types/*.ts`, you MUST:
   a. add/update the entry in `docs/relations.json` (`collections`, `aliases` for the new FK field, and `verticals` tags: consulting / construction / hybrid / hr / core),
   b. add the corresponding row in `docs/relationships.md` (§1.1 for collections, §4 tables for edges),
   c. run `npm run check:relations -- --write` and make it pass (exit code 0).
Module boundaries (consulting vs construction vs HR) are data-derived, not code-split — read `docs/verticals.md` before adding any "new module": it is usually just a new `activityType` + `pricingMode`/`measurementMode` combination. Do not add new string matching on `activityTypeName`/`departmentName` (tracked as G11); extend `docs/relations.json` tags instead.
This guard is what keeps the ERP's referential map honest — skipping it fails the repo check.
Never write directly to `journalEntries` from a new service; go through `AccountingService.createJournalEntry` / `createVoucher` (the double-entry balance guard lives there).
