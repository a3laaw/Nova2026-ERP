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