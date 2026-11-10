"""Bounded, volatile scene versions and a network-free visual comparison.

Only validated plans and owned labels are stored. No keys, feedback, approval,
recordings, filenames or service requests; no implicit disk persistence. Restoring
returns a plan, never authority to narrate/export. The native UI re-reviews it.
"""

import base64
from dataclasses import dataclass, field, replace
from html import escape

from .scenes import SceneError, VisualPlan, _require
from .timing import data_fingerprint
from .whiteboard import Lesson, whiteboard_html

MAX_HISTORY_ENTRIES = 12
MAX_HISTORY_BYTES = 4 * 1024 * 1024
MAX_COMPARE_BYTES = 16 * 1024 * 1024


def _context(plan: VisualPlan, source: dict) -> str:
    data = plan.to_data()
    return data_fingerprint(
        {k: data.get(k) for k in ("source_fingerprint", "subject", "grade", "policy", "origin")}
        | {
            "source": source["fingerprint"],
            "reviewed_rows": [s["rows"] for s in data["steps"]],
        }
    )


@dataclass(frozen=True)
class HistoryEntry:
    number: int
    label: str
    plan: VisualPlan = field(repr=False)


class PlanHistory:
    def __init__(self):
        self._entries: list[HistoryEntry] = []
        self._cursor = -1
        self._serial = 0
        self._context = ""

    @property
    def entries(self) -> tuple[HistoryEntry, ...]:
        return tuple(self._entries)

    @property
    def current(self) -> HistoryEntry | None:
        return self._entries[self._cursor] if 0 <= self._cursor < len(self._entries) else None

    @property
    def can_undo(self) -> bool:
        return self._cursor > 0

    @property
    def can_redo(self) -> bool:
        return 0 <= self._cursor < len(self._entries) - 1

    def clear(self):
        self._entries.clear()
        self._cursor, self._context = -1, ""
        # Keep serials monotonic: a stale combo/request cannot identify a new entry.

    def record(self, plan: VisualPlan, source: dict, label: str = "مسودة مشاهد") -> HistoryEntry:
        plan = VisualPlan.from_data(plan.to_data(), source)
        _require(
            isinstance(label, str)
            and 0 < len(label) <= 80
            and not any(ord(c) < 32 or 0xD800 <= ord(c) <= 0xDFFF for c in label),
            "اسم نسخة المراجعة غير صالح.",
        )
        context = _context(plan, source)
        if context != self._context:
            self.clear()
            self._context = context
        if self.current and self.current.plan == plan:
            return self.current
        self._serial += 1
        entry = HistoryEntry(self._serial, label, plan)
        self._entries.append(entry)
        while len(self._entries) > 1 and (
            len(self._entries) > MAX_HISTORY_ENTRIES
            or sum(len(e.plan.payload_json.encode()) for e in self._entries) > MAX_HISTORY_BYTES
        ):
            self._entries.pop(0)
        self._cursor = len(self._entries) - 1
        return entry

    def find(self, number: int, source: dict, current: VisualPlan) -> HistoryEntry:
        current = VisualPlan.from_data(current.to_data(), source)
        _require(
            type(number) is int and self._context == _context(current, source),
            "السجل يخص مصدرًا أو وصفًا أو نطقًا مراجعًا أو سياسة أخرى؛ لم تُستعد نسخة قديمة.",
        )
        for entry in self._entries:
            if entry.number == number:
                VisualPlan.from_data(entry.plan.to_data(), source)
                return entry
        raise SceneError("النسخة لم تعد في سجل الجلسة؛ ربما مُسحت أو خرجت من الحد.")

    def restore(self, number: int, source: dict, current: VisualPlan) -> VisualPlan:
        entry = self.find(number, source, current)
        self._cursor = self._entries.index(entry)
        return VisualPlan.from_data(entry.plan.to_data(), source)

    def previous_number(self, *, forward: bool = False) -> int:
        _require(self.can_redo if forward else self.can_undo, "لا نسخة أخرى في هذا الاتجاه.")
        return self._entries[self._cursor + (1 if forward else -1)].number


def changed_steps(before: VisualPlan, after: VisualPlan) -> tuple[int, ...]:
    old, new = before.to_data(), after.to_data()
    resources_old = {r["id"]: r for r in old.get("resources", [])}
    resources_new = {r["id"]: r for r in new.get("resources", [])}
    from .secondary_assets import referenced_ids

    changed = []
    for i, (a, b) in enumerate(zip(old["steps"], new["steps"], strict=True)):
        ids = set(referenced_ids([a])) | set(referenced_ids([b]))
        if a != b or any(resources_old.get(k) != resources_new.get(k) for k in ids):
            changed.append(i)
    return tuple(changed)


def comparison_html(
    lesson: Lesson,
    before: VisualPlan,
    after: VisualPlan,
    *,
    focus_step: int | None = None,
    before_number: int | None = None,
    after_number: int | None = None,
) -> str:
    source = replace(lesson, visuals=None).manifest()
    before = VisualPlan.from_data(before.to_data(), source)
    after = VisualPlan.from_data(after.to_data(), source)
    _require(
        _context(before, source) == _context(after, source),
        "لا مقارنة بين مصدرين أو سياقين أو نصي نطق مختلفين.",
    )
    changed = changed_steps(before, after)
    focus_step = focus_step if focus_step is not None else (changed[0] if changed else 0)
    _require(
        type(focus_step) is int and 0 <= focus_step < len(lesson.steps), "مشهد المقارنة غير صالح."
    )
    for number in (before_number, after_number):
        _require(
            number is None or (type(number) is int and number > 0), "رقم نسخة المقارنة غير صالح."
        )
    panels = []
    for name, title, plan in (
        ("before", "النسخة المختارة من السجل", before),
        ("after", "المقترح الحالي", after),
    ):
        number = before_number if name == "before" else after_number
        if number is not None:
            title += f" · نسخة {number}"
        child = whiteboard_html(replace(lesson, visuals=plan))
        child = child.replace(
            "</head>",
            "<style>#wb-output,#wb-customization,.lesson-shortcuts{display:none!important}</style></head>",
        )
        # Owned integer only. The child never talks to its parent or the desktop.
        child = child.replace(
            "</body>",
            '<script>const target=document.querySelectorAll("#lesson-outline button")['
            + str(focus_step)
            + "];if(target)target.click();</script></body>",
        )
        encoded = base64.b64encode(child.encode()).decode()
        panels.append(
            '<section class="panel"><h2>'
            + escape(title)
            + '</h2><iframe id="'
            + name
            + '" title="'
            + escape(title)
            + '" sandbox="allow-scripts" src="data:text/html;base64,'
            + encoded
            + '"></iframe></section>'
        )
    report = ", ".join(str(i + 1) for i in changed) or "لا تغيير في المشاهد"
    page = (
        """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src data:;
script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none';
img-src data:; media-src 'none'; base-uri 'none'; form-action 'none'">
<title>مقارنة نسخ المشاهد</title><style>
*{box-sizing:border-box}body{margin:0;background:#F8FAFC;color:#1E293B;overflow-wrap:anywhere;
font:15px/1.9 'Segoe UI',Tahoma,Arial,sans-serif}
main{width:100%;max-width:1600px;margin:auto;padding:20px}
h1{font-size:24px}h2{font-size:18px;margin:0 0 12px}
.notice{background:#FFF1C2;border:2px solid #FFB000;border-radius:24px;padding:14px 20px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}
.panel{min-width:0;background:#FCE4EC;border:2px solid #E2E8F0;border-radius:24px;padding:14px}
iframe{width:100%;height:1050px;border:0;border-radius:16px;background:#F8FAFC}
@media(max-width:1100px){.grid{grid-template-columns:minmax(0,1fr)}main{padding:12px}}a{color:#2563EB}
</style></head><body><main><h1>مقارنة مرئية صامتة — """
        + escape(lesson.title)
        + """</h1>
<p class="notice">معاينة فقط: لا اعتماد أو نطق أو تنزيل موارد أو تصدير. 
ارجع للتطبيق لاستعادة نسخة ثم راجع واعتمد من جديد.
 المصدر والأصوات لم يتغيرا. المقارنة لا تثبت صحة علمية أو جودة استدلال.</p>
<p id="changes">المشاهد المختلفة: """
        + escape(report)
        + """</p><p>التركيز على المشهد """
        + str(focus_step + 1)
        + """ — """
        + escape(lesson.steps[focus_step].title)
        + """. تشغيل كل جانب مستقل، ولا يبدأ تلقائيًا.</p><div class="grid">"""
        + "".join(panels)
        + "</div></main></body></html>"
    )
    _require(len(page.encode()) <= MAX_COMPARE_BYTES, "المقارنة كبيرة؛ قارن خطة أبسط.")
    return page
