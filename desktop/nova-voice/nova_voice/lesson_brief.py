"""Exact author intent and provenance data; never narration or network credentials."""

import json
import re
from dataclasses import dataclass

from .text import ScriptError
from .timing import data_fingerprint

MAX_BRIEF_CHARACTERS = 4000
HEX = re.compile(r"[0-9a-f]{64}\Z")


def valid_text(value: object, limit: int, *, empty: bool = False) -> bool:
    return (
        isinstance(value, str)
        and (empty or bool(value.strip()))
        and len(value) <= limit
        and not any((ord(c) < 32 and c not in "\n\t") or 0xD800 <= ord(c) <= 0xDFFF for c in value)
    )


def require(condition: bool, message: str = "بيانات وصف الدرس أو ارتباطه غير صالحة.") -> None:
    if not condition:
        raise ScriptError(message)


@dataclass(frozen=True)
class LessonBrief:
    """Immutable exact description, including deliberate whitespace. No inferred subject."""

    payload_json: str

    @classmethod
    def create(cls, text: str, subject: str = "", grade: str = "", policy: str = "general"):
        require(
            valid_text(text, MAX_BRIEF_CHARACTERS), "اكتب وصفًا من 1 إلى 4000 حرف بلا بيانات حساسة."
        )
        require(valid_text(subject, 80, empty=True) and valid_text(grade, 80, empty=True))
        require(
            policy == "general", "توسيع النصوص المقدسة أو توليد تلاوة غير مدعوم؛ استخدم نصًا مراجعًا."
        )
        data = {"text": text, "subject": subject, "grade": grade, "policy": policy}
        data["fingerprint"] = data_fingerprint(data)
        return cls(json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(",", ":")))

    @classmethod
    def from_data(cls, data: dict):
        require(
            isinstance(data, dict)
            and set(data) == {"text", "subject", "grade", "policy", "fingerprint"}
        )
        brief = cls.create(data["text"], data["subject"], data["grade"], data["policy"])
        require(brief.to_data() == data, "الوصف أو بصمته تغيّرا؛ لا يُستبدل الوصف الأصلي بالتخمين.")
        return brief

    def to_data(self) -> dict:
        return json.loads(self.payload_json)

    @property
    def fingerprint(self) -> str:
        return self.to_data()["fingerprint"]


def validate_origin(data: dict, source_fingerprint: str) -> None:
    require(
        isinstance(data, dict)
        and set(data) == {"kind", "brief", "draft_fingerprint", "source_fingerprint"}
    )
    require(data["kind"] == "expanded-lesson")
    LessonBrief.from_data(data["brief"])
    require(
        isinstance(data["draft_fingerprint"], str)
        and bool(HEX.fullmatch(data["draft_fingerprint"]))
    )
    require(
        data["source_fingerprint"] == source_fingerprint,
        "ارتباط الوصف بالنص الموسّع تغيّر؛ أعد مراجعة المسودة واعتمادها.",
    )
