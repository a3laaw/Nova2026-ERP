"""Offline capability guide and prompt preparation, not an inference client.

The native tab and standalone HTML use one authored catalog. Nothing here reads
PDFs, sends requests, invents plan fingerprints, mutates a lesson, or stores input.
"""

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .storage import resource_dir
from .text import ScriptError

MODES = ("board", "board-dialogue", "bilingual", "speech", "speech-dialogue", "brief", "local")
LIMITS = {"subject": 80, "grade": 80, "title": 120, "source": 12000, "notes": 2000}
FIELD_NAMES = {
    "subject": "المادة",
    "grade": "الصف",
    "title": "العنوان المقترح",
    "source": "النص المصدر",
    "notes": "متطلبات إضافية",
}


class InferenceError(ScriptError):
    """A recoverable guide error; never includes user input in its message."""


def load_catalog(path: Path | None = None) -> dict:
    """Load owned static data only, never a user-supplied plan or executable code."""
    path = path or resource_dir() / "assets" / "inference-catalog.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != 1 or data.get("field_limits") != LIMITS:
        raise InferenceError("نسخة دليل استدلال غير متوافقة؛ أعد تجهيز المصدر كاملًا.")
    ids, categories = set(), {c["id"] for c in data["categories"]}
    for entry in data["entries"]:
        if (
            entry["id"] in ids
            or not re.fullmatch(r"[a-z][a-z0-9-]*", entry["id"])
            or entry["kind"] not in MODES
            or entry["category"] not in categories
            or entry["target"] not in data["targets"]
        ):
            raise InferenceError("فهرس دليل استدلال غير متوافق؛ أعد تجهيز المصدر كاملًا.")
        ids.add(entry["id"])
    return data


def capability(catalog: dict, identifier: str) -> dict:
    for entry in catalog["entries"]:
        if entry["id"] == identifier:
            return entry
    raise InferenceError("اختر قدرة متاحة من الفهرس أولًا.")


def _clean(value: str, name: str) -> str:
    if not isinstance(value, str) or any(
        (ord(char) < 32 and char not in "\r\n\t") or 0xD800 <= ord(char) <= 0xDFFF for char in value
    ):
        raise InferenceError("أحد الحقول يحتوي على محارف غير صالحة؛ استخدم نصًا عاديًا.")
    value = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if len(value) > LIMITS[name]:
        raise InferenceError(f"حد {FIELD_NAMES[name]} {LIMITS[name]} حرف؛ قسّم النص دون حذفه.")
    if name in ("subject", "grade", "title") and "\n" in value:
        raise InferenceError("المادة والصف والعنوان حقول من سطر واحد.")
    return value


@dataclass(frozen=True)
class GuideFields:
    # Do not expose pasted content in repr/logging or persist it in preferences.
    subject: str = field(default="", repr=False)
    grade: str = field(default="", repr=False)
    title: str = field(default="", repr=False)
    source: str = field(default="", repr=False)
    notes: str = field(default="", repr=False)

    def normalized(self) -> dict[str, str]:
        return {name: _clean(value, name) for name, value in asdict(self).items()}


def _policy(policy: str) -> None:
    if policy not in ("general", "sacred"):
        raise InferenceError("اختر سياسة محتوى معروفة قبل إعداد الطلب.")


def local_instructions(catalog: dict, entry: dict) -> str:
    return "\n\n".join(
        (
            catalog["shared"]["local_intro"],
            entry["title"],
            "المكان: " + catalog["targets"][entry["target"]],
            "\n".join(f"{i}. {step}" for i, step in enumerate(entry["steps"], 1)),
            "الناتج: " + entry["result"],
            "الحدود:\n" + "\n".join("• " + value for value in entry["limits"]),
        )
    )


def build_prompt(
    identifier: str,
    fields: GuideFields | None = None,
    *,
    policy: str = "general",
    catalog: dict | None = None,
) -> str:
    """Prepare text for an explicit copy; no model output or automatic adoption.

    Sacred/local paths deliberately do not even normalize supplied fields: their
    contents (including accidentally pasted sacred text) must never be included.
    """
    catalog = catalog if catalog is not None else load_catalog()
    entry = capability(catalog, identifier)
    _policy(policy)
    if policy == "sacred":
        return catalog["shared"]["sacred"]
    if entry["kind"] == "local":
        return local_instructions(catalog, entry)
    values = (fields or GuideFields()).normalized()
    if not values["source"] or not any(char.isalnum() for char in values["source"]):
        raise InferenceError("ألصق نصًا مصدرًا مقروءًا أولًا، أو استخدم المثال المؤلف للتجربة.")
    parts = [
        catalog["shared"]["intro"],
        "القدرة المطلوبة: " + entry["title"] + "\n" + entry["request"],
        "أمانة المصدر:\n" + catalog["shared"]["source_rules"],
        "شكل الناتج المطلوب:\n" + catalog["contracts"][entry["kind"]],
    ]
    if entry["drawing"]:
        parts.append(catalog["shared"]["visual_rules"])
    parts.extend(
        (
            catalog["shared"]["data_rules"],
            "بيانات الإعداد (JSON نصي للسياق، وليس خطة للاستيراد):\n"
            + json.dumps(
                {FIELD_NAMES[name]: value for name, value in values.items()},
                ensure_ascii=False,
                indent=2,
            ),
            "بعد الرد سأراجعه يدويًا قبل النقل أو اعتماد الرسوم أو النطق أو التصدير. "
            "لا تشغّل إعدادًا ولا تزعم أن الرد معتمد.",
        )
    )
    return "\n\n".join(parts)


def build_drawing(identifier: str, *, policy: str = "general", catalog: dict | None = None) -> str:
    """A separate addendum to the app's real bound prompt, never a plan root."""
    catalog = catalog if catalog is not None else load_catalog()
    entry = capability(catalog, identifier)
    _policy(policy)
    if policy != "general" or not entry["drawing"]:
        raise InferenceError("متطلبات الرسم غير متاحة لهذه القدرة أو لسياسة النصوص المقدسة.")
    parts = [catalog["shared"]["drawing_intro"], entry["title"], entry["drawing"]]
    if entry["element"] is not None:
        parts.append(
            catalog["shared"]["element_note"]
            + "\n"
            + json.dumps(entry["element"], ensure_ascii=False, indent=2)
        )
    parts.append(catalog["shared"]["drawing_rules"])
    return "\n\n".join(parts)


def search_key(text: str) -> str:
    """Arabic diacritics/tatweel tolerant, with Latin kind/control names too."""
    return (
        re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)
        .lower()
        .translate(str.maketrans("أإآى", "اااي"))
    )


def search_catalog(
    catalog: dict, query: str = "", *, category: str = "all", mode: str = "all"
) -> list[dict]:
    terms = search_key(query).split()
    result = []
    for entry in catalog["entries"]:
        if category != "all" and entry["category"] != category:
            continue
        if mode == "local" and entry["kind"] != "local":
            continue
        if mode == "prompt" and entry["kind"] == "local":
            continue
        haystack = search_key(
            " ".join(
                [entry["id"], entry["title"], entry["summary"], entry["request"], entry["drawing"]]
                + entry["steps"]
                + entry["limits"]
                + entry["covers"]
            )
        )
        if all(term in haystack for term in terms):
            result.append(entry)
    return result


def render_guide() -> str:
    """Build a self-contained file that works on file://, without fetch/storage."""
    assets = resource_dir() / "assets"
    catalog = load_catalog()
    raw = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
    # A script[type=json] is still HTML raw text; stop </script>/markup breakouts.
    for original, escaped in (
        ("&", "\\u0026"),
        ("<", "\\u003c"),
        (">", "\\u003e"),
        ("\u2028", "\\u2028"),
        ("\u2029", "\\u2029"),
    ):
        raw = raw.replace(original, escaped)
    content = (assets / "inference.html").read_text(encoding="utf-8")
    for token, value in (
        ("/*INFERENCE_CSS*/", (assets / "inference.css").read_text(encoding="utf-8")),
        ("INFERENCE_CATALOG_JSON", raw),
        ("/*INFERENCE_JS*/", (assets / "inference.js").read_text(encoding="utf-8")),
    ):
        if content.count(token) != 1:
            raise InferenceError("قالب استدلال غير متوافق؛ أعد تجهيز المصدر كاملًا.")
        content = content.replace(token, value)
    return content
