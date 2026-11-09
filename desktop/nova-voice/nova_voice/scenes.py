"""Bounded, declarative visual plans. Never execute generated SVG, HTML or code.

A plan is bound to the exact schema-1 source lesson. Schema-2 lessons retain that
source and attach an explicitly reviewed plan; old lessons remain byte-compatible.
"""

import json
import math
import os
import re
import tempfile
from dataclasses import dataclass
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

from .dialogue import has_voice_markers
from .language import narration_text
from .lesson_brief import validate_origin
from .text import MAX_CHARACTERS, ScriptError
from .timing import data_fingerprint

MAX_PLAN_BYTES = 512 * 1024
MAX_ELEMENTS = 600
MAX_STEP_ELEMENTS = 60
WIDTH, HEIGHT = 1000, 420
ICONS = ("apple", "ball", "block", "leaf", "star", "sun", "cloud", "drop", "book", "person")
POLICIES = ("general", "sacred")
MOTION_TYPES = ("draw", "move", "pulse", "none", "path", "rotate", "curve", "sequence")
EASING_TYPES = ("linear", "smooth")
KINDS = (
    "rect",
    "circle",
    "ellipse",
    "line",
    "arrow",
    "polygon",
    "polyline",
    "path",
    "text",
    "icons",
    "right_triangle",
    "calculation",
    "group",
    "sector",
    "sphere",
    "asset",
)
COMMON = {
    "kind",
    "row",
    "until",
    "x",
    "y",
    "fill",
    "stroke",
    "line_width",
    "dx",
    "dy",
    "motion",
    "name",
    "gradient",
}
EXTRA = {
    "rect": {"w", "h", "radius"},
    "circle": {"r"},
    "ellipse": {"rx", "ry"},
    "line": {"x2", "y2"},
    "arrow": {"x2", "y2"},
    "polygon": {"points"},
    "polyline": {"points"},
    "path": {"d"},
    "text": {"text", "size", "align", "direction"},
    "icons": {"icon", "count", "columns", "size"},
    "right_triangle": {"a", "b", "w", "h", "unit"},
    "calculation": {"a", "b", "op", "size"},
    "group": {"children"},
    "sector": {"r", "inner", "start", "sweep"},
    "sphere": {"r", "longitude", "tilt", "grid", "patches"},
    "asset": {"asset_id", "w", "h", "fallback"},
}
COLOR = re.compile(r"#[0-9a-fA-F]{6}\Z")
PATH = re.compile(r"[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+\Z")
NUMBER = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")


class SceneError(ScriptError):
    """A recoverable plan/import error, safe to show without provider/key data."""


def _require(condition: bool, message: str = "خطة المشاهد غير صالحة. راجع الدليل والقيم.") -> None:
    if not condition:
        raise SceneError(message)


def _keys(data: object, allowed: set[str], required: set[str] | None = None) -> None:
    _require(isinstance(data, dict))
    _require(set(data).issubset(allowed) and (required or allowed).issubset(data))


def _integer(value: object, low: int, high: int) -> bool:
    return type(value) is int and low <= value <= high


def _text(value: object, limit: int, *, empty: bool = False) -> bool:
    return (
        isinstance(value, str)
        and (empty or bool(value.strip()))
        and len(value) <= limit
        and not any(
            (ord(char) < 32 and char not in "\n\t") or 0xD800 <= ord(char) <= 0xDFFF
            for char in value
        )
    )


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise SceneError("مفتاح JSON مكرر في خطة المشاهد.")
        result[key] = value
    return result


def load_plan_json(text: str) -> dict:
    """Strict JSON, optionally one whole fenced JSON block copied from a chat."""
    _require(
        isinstance(text, str)
        and len(text) <= MAX_PLAN_BYTES
        and not any(0xD800 <= ord(char) <= 0xDFFF for char in text)
        and len(text.encode("utf-8")) <= MAX_PLAN_BYTES,
        "خطة المشاهد أكبر من 512 KiB أو ليست نصًا.",
    )
    text = text.lstrip("\ufeff").strip()
    if text.startswith("```json\n") and text.endswith("```"):
        text = text[8:-3].strip()
    try:
        value = json.loads(
            text,
            object_pairs_hook=_unique,
            parse_constant=lambda _: (_ for _ in ()).throw(
                SceneError("أرقام غير منتهية في الخطة.")
            ),
        )
        _require(isinstance(value, dict))
        return value
    except (ValueError, TypeError, RecursionError) as error:
        raise SceneError("تعذّر قراءة JSON الخطة. لا تُلصق كود HTML/SVG أو شرحًا خارجه.") from error


def validate_element(item: dict, rows: int, *, _depth: int = 0, _budget=None) -> None:
    from .scene_graph import (
        MAX_CHILDREN,
        MAX_DEPTH,
        MAX_SPHERES,
        validate_geometry,
        validate_motion,
        validate_style,
    )

    budget = _budget if _budget is not None else [0, 0]
    budget[0] += 1
    _require(
        _depth <= MAX_DEPTH and budget[0] <= MAX_STEP_ELEMENTS,
        "المشهد المركّب يتجاوز عمق الأجزاء أو حد 60 عقدة في الخطوة.",
    )
    _require(isinstance(item, dict) and isinstance(item.get("kind"), str))
    kind = item["kind"]
    _require(kind in KINDS, "نوع رسم غير مدعوم؛ لا يُسمح بتنفيذ كود أو استيراد روابط.")
    _keys(item, COMMON | EXTRA[kind], {"kind", "row", "x", "y"})
    _require(_integer(item["row"], 0, rows - 1))
    _require(_integer(item.get("until", rows), item["row"] + 1, rows))
    _require(_integer(item["x"], 0, WIDTH) and _integer(item["y"], 0, HEIGHT))
    for key in ("dx", "dy"):
        _require(_integer(item.get(key, 0), -1000, 1000))
    if "motion" in item:
        motion = item["motion"]
        _require(isinstance(motion, dict))
        mode = motion.get("type")
        _require(mode in MOTION_TYPES, "نوع حركة الرسم غير مدعوم.")
        if mode in ("curve", "sequence"):
            validate_motion(item, rows)
        else:
            if mode in ("move", "path", "rotate"):
                fields = (
                    {"dx", "dy"}
                    if mode == "move"
                    else {"points"}
                    if mode == "path"
                    else {"degrees", "cx", "cy"}
                )
                _keys(motion, {"type", "ease"} | fields, {"type"} | fields)
                _require(motion.get("ease", "linear") in EASING_TYPES)
            if mode == "move":
                _require(_integer(motion["dx"], -300, 300) and _integer(motion["dy"], -180, 180))
            elif mode == "path":
                points = motion["points"]
                _require(isinstance(points, list) and 2 <= len(points) <= 12)
                for index, point in enumerate(points):
                    _require(
                        isinstance(point, list)
                        and len(point) == 2
                        and _integer(point[0], -300, 300)
                        and _integer(point[1], -180, 180)
                    )
                    _require(point == [0, 0] if index == 0 else point != points[index - 1])
            elif mode == "rotate":
                _require(_integer(motion["degrees"], -360, 360) and motion["degrees"] != 0)
                _require(_integer(motion["cx"], 0, WIDTH) and _integer(motion["cy"], 0, HEIGHT))
            elif mode == "pulse":
                _keys(motion, {"type", "cycles"})
                _require(_integer(motion["cycles"], 1, 4))
            else:
                _keys(motion, {"type"})
    for key in ("fill", "stroke"):
        color = item.get(key, "none")
        _require(isinstance(color, str) and (color == "none" or bool(COLOR.fullmatch(color))))
    _require(_integer(item.get("line_width", 3), 1, 12))

    def integer(key, low, high, default=None):
        _require(_integer(item.get(key, default), low, high), f"قيمة {key} غير صالحة في الرسم.")

    if kind == "rect":
        integer("w", 1, WIDTH - item["x"])
        integer("h", 1, HEIGHT - item["y"])
        integer("radius", 0, 60, 0)
    elif kind == "circle":
        integer("r", 1, 200)
    elif kind == "ellipse":
        integer("rx", 1, 400)
        integer("ry", 1, 200)
    elif kind in ("line", "arrow"):
        integer("x2", 0, WIDTH)
        integer("y2", 0, HEIGHT)
    elif kind in ("polygon", "polyline"):
        points = item.get("points")
        _require(isinstance(points, list) and (3 if kind == "polygon" else 2) <= len(points) <= 40)
        for point in points:
            _require(
                isinstance(point, list)
                and len(point) == 2
                and _integer(point[0], 0, WIDTH)
                and _integer(point[1], 0, HEIGHT)
            )
    elif kind == "path":
        path = item.get("d")
        _require(isinstance(path, str) and 1 <= len(path) <= 2000 and bool(PATH.fullmatch(path)))
        _require(path.lstrip().startswith(("M", "m")))
        for token in NUMBER.findall(path):
            _require(math.isfinite(float(token)) and abs(float(token)) <= 5000)
        _require(len(NUMBER.findall(path)) <= 400)
    elif kind == "text":
        _require(_text(item.get("text"), 120))
        integer("size", 12, 64, 28)
        _require(item.get("align", "middle") in ("start", "middle", "end"))
        _require(item.get("direction", "auto") in ("auto", "rtl", "ltr"))
    elif kind == "icons":
        _require(item.get("icon") in ICONS)
        integer("count", 0, 20)
        integer("columns", 1, 10)
        integer("size", 24, 100)
        count, columns, size = item["count"], item["columns"], item["size"]
        _require(item["x"] + min(count, columns) * size <= WIDTH)
        _require(item["y"] + math.ceil(count / columns) * size <= HEIGHT)
    elif kind == "right_triangle":
        integer("a", 1, 100)
        integer("b", 1, 100)
        integer("w", 40, WIDTH - item["x"])
        integer("h", 40, HEIGHT - item["y"] - 50)
        _require(item["x"] >= 90, "اترك هامشًا يسار المثلث لقياسات الضلع.")
        _require(_text(item.get("unit", ""), 12, empty=True))
    elif kind == "calculation":
        integer("a", -1000, 1000)
        integer("b", -1000, 1000)
        integer("size", 16, 60, 36)
        _require(item.get("op") in ("+", "-", "*", "/"))
        _require(item["op"] != "/" or item["b"] != 0, "لا قسمة على صفر.")

    validate_style(item)
    if kind == "group":
        children = item.get("children")
        _require(isinstance(children, list) and 1 <= len(children) <= MAX_CHILDREN)
        _require(_text(item.get("name"), 80), "سمّ المجموعة بوصف أجزائها للمراجعة، لا قالب درس.")
        for child in children:
            validate_element(child, item.get("until", rows), _depth=_depth + 1, _budget=budget)
            _require(item["row"] <= child["row"] < item.get("until", rows))
    elif kind == "asset":
        from .secondary_assets import validate_asset_box

        validate_asset_box(item)
        for child in item["fallback"]:
            validate_element(child, item.get("until", rows), _depth=_depth + 1, _budget=budget)
    elif kind in ("sector", "sphere"):
        validate_geometry(item)
        if kind == "sphere":
            budget[1] += 1
            _require(budget[1] <= MAX_SPHERES, "حد الأجسام الكروية في الخطوة ثلاثة.")


def calculation_result(a: int, b: int, op: str) -> str:
    """Only the four declared operators, never eval or generated executable code."""
    if op == "+":
        return str(a + b)
    if op == "-":
        return str(a - b)
    if op == "*":
        return str(a * b)
    if op == "/" and b:
        return str(Fraction(a, b))
    raise SceneError("عملية حساب غير صالحة.")


@lru_cache(maxsize=4)
def _row_overrides(payload: str) -> dict:
    return {
        (step["index"], row["index"]): (row["display"], row["speech"])
        for step in json.loads(payload)["steps"]
        for row in step["rows"]
    }


@dataclass(frozen=True)
class VisualPlan:
    # A canonical JSON string provides an immutable worker snapshot. Accessors
    # return copies; editor changes cannot mutate an in-flight export.
    payload_json: str

    def to_data(self) -> dict:
        return json.loads(self.payload_json)

    def to_json(self, *, pretty: bool = True) -> str:
        text = (
            json.dumps(self.to_data(), ensure_ascii=False, indent=2)
            if pretty
            else self.payload_json
        )
        # Pretty whitespace can exceed the import limit even when the canonical
        # snapshot fits. Our own exports must always be importable again.
        return text if len(text.encode("utf-8")) <= MAX_PLAN_BYTES else self.payload_json

    def save(self, path: Path) -> None:
        if path.suffix.lower() != ".json":
            raise SceneError("احفظ خطة المشاهد بامتداد JSON.")
        path = path.expanduser().absolute()
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, name = tempfile.mkstemp(prefix=".nova-scene-plan-", dir=path.parent)
        temporary = Path(name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                stream.write(self.to_json())
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)

    @classmethod
    def from_data(cls, data: dict, source: dict) -> "VisualPlan":
        _require(isinstance(data, dict))
        extended = type(data.get("schema")) is int and data["schema"] == 2
        fields = {"schema", "source_fingerprint", "subject", "grade", "policy", "notes", "steps"}
        required = fields | ({"origin"} if extended else set())
        _keys(data, required | {"resources"}, required)
        _require(type(data["schema"]) is int and data["schema"] in (1, 2))
        if extended:
            _require(data["policy"] == "general", "توسيع النصوص المقدسة غير مدعوم.")
            try:
                validate_origin(data["origin"], source.get("fingerprint"))
                _require(
                    data["origin"]["brief"]["subject"] == data["subject"]
                    and data["origin"]["brief"]["grade"] == data["grade"]
                )
            except ScriptError as error:
                raise SceneError(str(error)) from None
        _require(
            data["source_fingerprint"] == source.get("fingerprint") and source.get("schema") == 1,
            "الخطة تخص سكريبتًا أو وضع أصوات مختلفًا. أعد التخطيط أو استخدم النص الأصلي.",
        )
        _require(_text(data["subject"], 80, empty=True) and _text(data["grade"], 80, empty=True))
        _require(data["policy"] in POLICIES)
        _require(
            isinstance(data["notes"], list)
            and len(data["notes"]) <= 12
            and all(_text(note, 400) for note in data["notes"])
        )
        steps = data["steps"]
        _require(isinstance(steps, list) and len(steps) == len(source["steps"]))
        elements = 0
        spoken = sum(len(row["text"]) for step in source["steps"] for row in step["rows"])
        for index, step in enumerate(steps):
            _keys(step, {"index", "description", "rows", "elements"})
            _require(type(step["index"]) is int and step["index"] == index)
            _require(_text(step["description"], 400))
            rows = source["steps"][index]["rows"]
            _require(isinstance(step["rows"], list) and len(step["rows"]) <= len(rows))
            seen = set()
            for override in step["rows"]:
                _keys(override, {"index", "display", "speech"})
                row = override["index"]
                _require(_integer(row, 0, len(rows) - 1) and row not in seen)
                seen.add(row)
                _require(_text(override["display"], 180) and _text(override["speech"], 480))
                _require(
                    not has_voice_markers(override["speech"]),
                    "نص النطق بلا وسوم أصوات؛ الدور محفوظ من السكريبت الأصلي.",
                )
                _require(
                    any(char.isalnum() for char in narration_text(override["speech"])),
                    "كل سطر يحتاج نطقًا بكلمات أو أرقام، لا رموز صامتة فقط.",
                )
                spoken += len(override["speech"]) - len(rows[row]["text"])
            _require(
                isinstance(step["elements"], list) and len(step["elements"]) <= MAX_STEP_ELEMENTS
            )
            from .scene_graph import validate_elements

            elements += validate_elements(step["elements"], len(rows))
            if data["policy"] == "sacred":
                _require(
                    step["description"] == source["steps"][index]["title"],
                    "وصف النص المقدس يبقى عنوان المصدر، لا تعليقًا مولّدًا أو اقتباسًا جديدًا.",
                )
                _require(
                    not step["rows"] and not step["elements"],
                    (
                        "النصوص المقدسة: لا إعادة صياغة أو رسوم آلية. استخدم النص المراجع "
                        "والتسجيل المعتمد."
                    ),
                )
        _require(elements <= MAX_ELEMENTS and 0 < spoken <= MAX_CHARACTERS)
        from .secondary_assets import validate_plan_resources

        validate_plan_resources(data)
        try:
            encoded = json.dumps(
                data, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False
            )
            _require(len(encoded.encode()) <= MAX_PLAN_BYTES)
            return cls(encoded)
        except (ValueError, TypeError, RecursionError) as error:
            raise SceneError("خطة المشاهد غير صالحة.") from error

    @classmethod
    def from_json(cls, text: str, source: dict) -> "VisualPlan":
        return cls.from_data(load_plan_json(text), source)

    @classmethod
    def load(cls, path: Path, source: dict) -> "VisualPlan":
        _require(path.stat().st_size <= MAX_PLAN_BYTES, "خطة المشاهد أكبر من 512 KiB.")
        return cls.from_json(path.read_text(encoding="utf-8-sig"), source)

    def row_text(self, step: int, row: int, original: str, *, speech: bool = False) -> str:
        override = _row_overrides(self.payload_json).get((step, row))
        return override[1 if speech else 0] if override is not None else original


def empty_plan(source: dict, *, subject: str = "", grade: str = "") -> dict:
    return {
        "schema": 1,
        "source_fingerprint": source["fingerprint"],
        "subject": subject,
        "grade": grade,
        "policy": "general",
        "notes": [],
        "steps": [
            {"index": index, "description": step["title"], "rows": [], "elements": []}
            for index, step in enumerate(source["steps"])
        ],
    }


def source_manifest(lesson) -> dict:
    """Remove only the reviewed extension, not source script/rows/speakers."""
    manifest = lesson.manifest()
    if manifest["schema"] == 1:
        return manifest
    payload = {
        key: value for key, value in manifest.items() if key not in ("visuals", "fingerprint")
    }
    payload["schema"] = 1
    return payload | {"fingerprint": data_fingerprint(payload)}


def review_text(plan: VisualPlan, source: dict) -> str:
    """Plain text, including EVERY proposed narration change, never rich HTML."""
    plan = VisualPlan.from_data(plan.to_data(), source)
    data = plan.to_data()
    lines = [
        "مقترح يحتاج مراجعة بشرية؛ التحقق البنيوي ليس توثيقًا علميًا أو دينيًا.",
        f"المادة: {data['subject'] or 'غير محددة'} · الصف: {data['grade'] or 'غير محدد'}",
        f"السياسة: {data['policy']} · الأصل محفوظ بلا تغيير.",
    ]
    if data["schema"] == 2:
        lines.extend(
            (
                "الوصف الأصلي محفوظ ولا يُنطق:",
                data["origin"]["brief"]["text"],
                "بصمة المسودة للتحقق من الاتساق فقط، لا إثبات مصدر أو صحة: "
                + data["origin"]["draft_fingerprint"],
            )
        )
    lines.extend("تنبيه: " + note for note in data["notes"])
    from .secondary_assets import asset_info, credits

    for credit in credits(plan):
        lines += [
            "نسبة مورد مضمّن: " + credit["title"] + " · " + credit["attribution"],
            credit["source"],
            credit["license"] + " · " + credit["license_url"],
            "التغييرات: " + credit["changes"],
        ]
    embedded = {r["id"] for r in data.get("resources", [])}
    for step in data["steps"]:
        index = step["index"]
        lines += [
            "",
            f"{index + 1}. {source['steps'][index]['title']}",
            "وصف المشهد: " + step["description"],
        ]
        for row_index, row in enumerate(source["steps"][index]["rows"]):
            lines += [
                f"سطر {row_index + 1} · دور {row['speaker']} · الأصل: {row['text']}",
                "العرض: " + plan.row_text(index, row_index, row["text"]),
                "النطق: " + plan.row_text(index, row_index, row["text"], speech=True),
            ]
        from .scene_graph import walk_parts

        fallback_parents = {
            path for path, item in walk_parts(step["elements"]) if item["kind"] == "asset"
        }
        for path, item in walk_parts(step["elements"]):
            suffix = " · " + item["name"] if "name" in item else ""
            motion = item.get("motion", {})
            if motion:
                suffix += " · حركة " + motion["type"]
                if motion["type"] == "sequence":
                    suffix += f" ({len(motion['frames'])} مفاتيح، {motion.get('repeat', 1)} دورات)"
                    finish = item["row"] + motion.get("span", 1)
                    suffix += f" · يستمر حتى نهاية السطر {finish}"
                    suffix += " · خصائص: " + ", ".join(sorted(motion["frames"][0].keys() - {"at"}))
            if "gradient" in item:
                suffix += " · تدرج لوني"
            if item["kind"] == "sphere":
                suffix += " · إسقاط كروي توضيحي 2.5D، لا خريطة معتمدة"
            if item["kind"] == "asset":
                entry = asset_info(item["asset_id"])
                suffix += " · " + item["asset_id"] + " · " + entry["label_ar"]
                suffix += (
                    " · مورد مضمّن مدقق"
                    if item["asset_id"] in embedded
                    else " · بديل محلي أصلي؛ لا تنزيل تلقائي"
                )
                suffix += " · صورة ظلية ثابتة لا مفاصل أو توثيق علمي"
            if item["kind"] == "icons":
                suffix += f" · {item['count']} × {item['icon']}"
            elif item["kind"] == "text":
                suffix += " · " + item["text"]
            elif item["kind"] == "calculation":
                suffix += f" · {item['a']} {item['op']} {item['b']} = " + calculation_result(
                    item["a"], item["b"], item["op"]
                )
            elif item["kind"] == "right_triangle":
                suffix += f" · ضلعان {item['a']} و{item['b']} {item.get('unit', '')}؛ قائم ومقياسي"
            if item["kind"] == "group":
                suffix += f" · {len(item['children'])} أجزاء مباشرة بإحداثيات محلية"
            if path[:-1] in fallback_parents:
                suffix += " · جزء من البديل المحلي الأصلي، لا مفاصل المورد الخارجي"
            part = ".".join(map(str, path))
            lines.append(
                f"{'  ' * (len(path) - 1)}جزء {part} · رسم {item['kind']}"
                f" · يبدأ مع السطر {item['row'] + 1}{suffix}"
            )
    return "\n".join(lines)
