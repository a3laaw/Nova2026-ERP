"""Hand-authored local demonstration, NOT represented as a live AI result."""

from .scenes import VisualPlan, empty_plan

VISUAL_EXAMPLE = """# أعداد وأشكال وطبيعة
## جمع التفاح
لدينا تفاحتان.
نضيف ثلاث تفاحات.
أصبح المجموع خمس تفاحات.
## المثلث القائم
مثلث قائم ضلعاه المتعامدان ثلاثة وأربعة سنتيمترات.
مساحته ستة سنتيمترات مربعة.
## الجبل والوادي
هذا رسم توضيحي لجبل وواديه، وليس خريطة مكان حقيقي.
يمر النهر في الوادي بين الجبال.
"""


def example_plan(source: dict) -> VisualPlan:
    if source["script"].strip() != VISUAL_EXAMPLE.strip() or source["dialogue"]:
        raise ValueError("The demonstration needs its original single-narrator script")
    data = empty_plan(
        source, subject="رياضيات وطبيعة · مثال محلي", grade="مثال توضيحي، لا منهج محدد"
    )
    data["notes"] = [
        "خطة كُتبت محليًا لاختبار المحرك؛ ليست نتيجة استدعاء ذكاء اصطناعي.",
        "الرسم الطبيعي توضيحي وغير مقياسي. راجع المحتوى والمواضع قبل الاستخدام.",
    ]
    data["steps"][0].update(
        {
            "description": (
                "تفاحتان تظهران أولًا، ثم تدخل ثلاث تفاحات مع السطر الثاني؛ مع "
                "الثالث تظهر نتيجة الجمع المحسوبة محليًا."
            ),
            "rows": [
                {"index": 0, "display": "2", "speech": "لدينا تفاحتان."},
                {"index": 1, "display": "+ 3", "speech": "نضيف ثلاث تفاحات."},
                {"index": 2, "display": "= 5", "speech": "أصبح المجموع خمس تفاحات."},
            ],
            "elements": [
                {
                    "kind": "icons",
                    "row": 0,
                    "x": 70,
                    "y": 100,
                    "icon": "apple",
                    "count": 2,
                    "columns": 2,
                    "size": 100,
                },
                {"kind": "text", "row": 1, "x": 340, "y": 160, "text": "+", "size": 60},
                {
                    "kind": "icons",
                    "row": 1,
                    "x": 420,
                    "y": 100,
                    "icon": "apple",
                    "count": 3,
                    "columns": 3,
                    "size": 100,
                    "dx": 120,
                },
                {
                    "kind": "calculation",
                    "row": 2,
                    "x": 500,
                    "y": 325,
                    "a": 2,
                    "b": 3,
                    "op": "+",
                    "size": 60,
                },
            ],
        }
    )
    data["steps"][1].update(
        {
            "description": (
                "مثلث قائم بضلعي طول ثلاثة وأربعة، مرسوم بنسبة طول صحيحة وعلامة "
                "الزاوية القائمة. المساحة ستة كما في السكريبت."
            ),
            "elements": [
                {
                    "kind": "right_triangle",
                    "row": 0,
                    "x": 230,
                    "y": 30,
                    "a": 3,
                    "b": 4,
                    "w": 500,
                    "h": 280,
                    "unit": "سم",
                    "fill": "#DBEAFE",
                },
                {
                    "kind": "text",
                    "row": 1,
                    "x": 760,
                    "y": 180,
                    "text": "المساحة = 6 سم²",
                    "direction": "rtl",
                    "size": 42,
                },
            ],
        }
    )
    data["steps"][2].update(
        {
            "description": (
                "رسم توضيحي غير مقياسي لجبلين ووادي بينهما، مع شمس ونهر أزرق يظهر "
                "مع السطر الثاني. لا يمثل خريطة موثقة."
            ),
            "elements": [
                {
                    "kind": "icons",
                    "row": 0,
                    "x": 790,
                    "y": 15,
                    "icon": "sun",
                    "count": 1,
                    "columns": 1,
                    "size": 80,
                },
                {
                    "kind": "path",
                    "row": 0,
                    "x": 0,
                    "y": 0,
                    "d": "M40 340L250 70L460 340L680 90L960 340Z",
                    "fill": "#E2E8F0",
                    "stroke": "#475569",
                },
                {
                    "kind": "path",
                    "row": 0,
                    "x": 0,
                    "y": 0,
                    "d": "M180 160L250 70L322 162L275 145L250 170L225 145Z",
                    "fill": "#F8FAFC",
                    "stroke": "#94A3B8",
                },
                {
                    "kind": "text",
                    "row": 0,
                    "x": 170,
                    "y": 45,
                    "text": "قمة",
                    "direction": "rtl",
                    "size": 44,
                },
                {
                    "kind": "path",
                    "row": 1,
                    "x": 0,
                    "y": 0,
                    "d": "M460 320C500 340 400 365 460 380C500 400 540 390 550 415",
                    "stroke": "#2563EB",
                    "line_width": 12,
                },
                {
                    "kind": "text",
                    "row": 1,
                    "x": 650,
                    "y": 395,
                    "text": "وادٍ ونهر",
                    "direction": "rtl",
                    "size": 44,
                },
            ],
        }
    )
    return VisualPlan.from_data(data, source)
