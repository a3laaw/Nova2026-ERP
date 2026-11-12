"""Python/JS conformance vectors; authored text only, no models or network."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from nova_voice.inference import (  # noqa: E402
    LIMITS,
    GuideFields,
    InferenceError,
    build_drawing,
    build_prompt,
    load_catalog,
    search_catalog,
)

catalog = load_catalog()
cases = []


def add(identifier, fields=None, policy="general"):
    fields = fields or {}
    case = {"id": identifier, "fields": fields, "policy": policy}
    try:
        case["expected"] = build_prompt(identifier, GuideFields(**fields), policy=policy)
    except InferenceError as error:
        case["error"] = str(error)
    cases.append(case)


for entry in catalog["entries"]:
    add(
        entry["id"],
        {"source": entry["example"]["source"], "subject": "موضوع حر", "grade": "الإعدادي"},
    )
    add(entry["id"], {"source": "PRIVATE\x00", "notes": "PRIVATE-note"}, "sacred")
for name, limit in LIMITS.items():
    add("whiteboard", {"source": "مصدر مؤلف.", name: "ن" * limit})
    add("whiteboard", {"source": "مصدر مؤلف.", name: "ن" * (limit + 1)})
for bad in ("", "   ", "؟!!", "ن\x00", "ن\x01", "ن\ud800", "ن\udfff"):
    add("whiteboard", {"source": bad})
add(
    "whiteboard",
    {
        "source": "\u0085 نص\r\nمؤلف 😀 \u0085",
        "notes": '</script> & <img src=x onerror="alert(1)">',
        "title": "عنوان 😀",
    },
)
add("whiteboard", {"source": "\ufeffمصدر\ufeff", "notes": "\u2028\u2029"})
add("whiteboard", {"source": "مصدر", "subject": "علوم\nهندسة"})
add("whiteboard", {"source": 123})
add("whiteboard", {"source": "مصدر"}, "automatic")
add("nonexistent", {"source": "مصدر"})
add("whiteboard", {"source": "ن" + "😀" * 11999})
add("voice-models", {"source": "PRIVATE\x00" + "s" * 15000, "notes": "PRIVATE"})
drawings = []
for entry in catalog["entries"]:
    for policy in ("general", "sacred"):
        case = {"id": entry["id"], "policy": policy}
        try:
            case["expected"] = build_drawing(entry["id"], policy=policy)
        except InferenceError as error:
            case["error"] = str(error)
        drawings.append(case)
searches = []
for query, category, mode in (
    ("", "all", "all"),
    ("دَوَران", "all", "all"),
    ("أصوات", "all", "all"),
    ("motion path", "all", "all"),
    ("لَون", "appearance", "all"),
    ("", "all", "local"),
    ("", "all", "prompt"),
    ("PDF", "prepare", "all"),
    ("not-a-capability-xz", "all", "all"),
):
    searches.append(
        {
            "query": query,
            "category": category,
            "mode": mode,
            "expected": [
                e["id"] for e in search_catalog(catalog, query, category=category, mode=mode)
            ],
        }
    )
print(json.dumps({"cases": cases, "drawings": drawings, "searches": searches}))
