"""A short brief -> bounded full lesson + drawings, with a separate review gate.

No keyword/template routing or network here. Untrusted model/manual JSON supplies
pedagogical content and free-form elements; local code builds stable source rows,
computes their fingerprints, and binds the exact original brief to the visual plan.
"""

import argparse
import json
import os
import tempfile
from dataclasses import dataclass, replace
from pathlib import Path

from .dialogue import has_voice_markers
from .language import narration_text
from .lesson_brief import LessonBrief, require, valid_text
from .scenes import (
    MAX_PLAN_BYTES,
    VisualPlan,
    empty_plan,
    load_plan_json,
    review_text,
    validate_element,
)
from .text import ScriptError
from .timing import data_fingerprint

MAX_EXPLANATION_STEPS = 8
MAX_EXPANDED_CHARACTERS = 12000


def _line(value: object, limit: int = 180, *, voiced: bool = True) -> bool:
    return (
        valid_text(value, limit)
        and len(value.splitlines()) == 1
        and not value.startswith("#")
        and not has_voice_markers(value)
        and (not voiced or any(c.isalnum() for c in narration_text(value)))
    )


def _keys(value, expected):
    require(
        isinstance(value, dict) and set(value) == set(expected),
        "مفاتيح مسودة الدرس ناقصة أو غير مدعومة؛ لا كود أو HTML خام.",
    )


@dataclass(frozen=True)
class LessonDraft:
    """Canonical bundle is an immutable snapshot; saved approval/credentials do not exist."""

    payload_json: str

    @classmethod
    def from_response(cls, data: dict, brief: LessonBrief):
        brief = LessonBrief.from_data(brief.to_data())
        _keys(
            data,
            (
                "schema",
                "brief_fingerprint",
                "title",
                "objectives",
                "steps",
                "questions",
                "summary",
                "notes",
            ),
        )
        require(type(data["schema"]) is int and data["schema"] == 1)
        require(
            data["brief_fingerprint"] == brief.fingerprint,
            "المسودة تخص وصفًا مختلفًا؛ لم تُطبق على الوصف الحالي.",
        )
        require(_line(data["title"], 120))
        for key, low, high in (("objectives", 2, 6), ("summary", 1, 4)):
            require(
                isinstance(data[key], list)
                and low <= len(data[key]) <= high
                and all(_line(value) for value in data[key])
            )
        require(
            isinstance(data["notes"], list)
            and len(data["notes"]) <= 8
            and all(valid_text(note, 400) for note in data["notes"])
        )
        steps = data["steps"]
        require(
            isinstance(steps, list) and 2 <= len(steps) <= MAX_EXPLANATION_STEPS,
            "الدرس الكامل يحتاج مرحلتي شرح إلى ثماني مراحل؛ لا صفًا واحدًا فقط.",
        )
        elements, illustrated, rows = 0, 0, 0
        for step in steps:
            _keys(step, ("title", "description", "rows", "elements"))
            require(_line(step["title"], 100) and valid_text(step["description"], 400))
            require(isinstance(step["rows"], list) and 1 <= len(step["rows"]) <= 6)
            for row in step["rows"]:
                _keys(row, ("display", "speech"))
                require(
                    _line(row["display"], voiced=False) and _line(row["speech"]),
                    "كل سطر يحتاج عرضًا ونطقًا واضحين، بلا عناوين أو وسوم، حتى 180 حرفًا.",
                )
            require(
                isinstance(step["elements"], list) and 1 <= len(step["elements"]) <= 60,
                "كل مرحلة شرح تحتاج رسمًا وصفيًا واحدًا على الأقل.",
            )
            for element in step["elements"]:
                validate_element(element, len(step["rows"]))
            elements += len(step["elements"])
            illustrated += bool(step["elements"])
            rows += len(step["rows"])
        require(
            elements <= 180 and illustrated >= 2 and rows >= 4,
            "المسودة تحتاج أربع سطور شرح على الأقل ورسومًا في مرحلتين، حتى 180 عنصرًا.",
        )
        require(isinstance(data["questions"], list) and 1 <= len(data["questions"]) <= 4)
        for question in data["questions"]:
            _keys(question, ("question", "answer"))
            require(_line(question["question"]) and _line(question["answer"]))
        bundle = {"schema": 1, "brief": brief.to_data(), "draft": data}
        bundle["fingerprint"] = data_fingerprint(bundle)
        text = json.dumps(
            bundle, ensure_ascii=True, sort_keys=True, separators=(",", ":"), allow_nan=False
        )
        require(len(text.encode()) <= MAX_PLAN_BYTES, "حزمة المسودة أكبر من 512 KiB.")
        result = cls(text)
        result.compile()  # Fail closed on parser pagination, voice or source/geometry mismatch.
        return result

    @classmethod
    def from_data(cls, data: dict, expected_brief: LessonBrief | None = None):
        _keys(data, ("schema", "brief", "draft", "fingerprint"))
        require(type(data["schema"]) is int and data["schema"] == 1)
        brief = LessonBrief.from_data(data["brief"])
        require(
            expected_brief is None or brief == expected_brief,
            "الوصف/المادة/الصف تغير؛ لا يمكن استخدام مسودة لطلب آخر دون مراجعته.",
        )
        result = cls.from_response(data["draft"], brief)
        require(result.to_data() == data, "تغيّرت حزمة المسودة أو بصمتها؛ أعد استيراد نسخة سليمة.")
        return result

    @classmethod
    def from_json(cls, text: str, expected_brief: LessonBrief | None = None):
        data = load_plan_json(text)
        if expected_brief is not None and "brief_fingerprint" in data:
            return cls.from_response(data, expected_brief)
        return cls.from_data(data, expected_brief)

    @classmethod
    def load(cls, path: Path, expected_brief: LessonBrief | None = None):
        require(path.stat().st_size <= MAX_PLAN_BYTES, "حزمة المسودة أكبر من 512 KiB.")
        return cls.from_json(path.read_text(encoding="utf-8-sig"), expected_brief)

    def to_data(self) -> dict:
        return json.loads(self.payload_json)

    def to_json(self) -> str:
        pretty = json.dumps(self.to_data(), ensure_ascii=False, indent=2, sort_keys=True)
        return pretty if len(pretty.encode("utf-8")) <= MAX_PLAN_BYTES else self.payload_json

    def response_json(self) -> str:
        """Editable raw content; saved bundles still require their exact fingerprints."""
        data = self.to_data()["draft"]
        pretty = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
        if len(pretty.encode("utf-8")) <= MAX_PLAN_BYTES:
            return pretty
        return json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(",", ":"))

    @property
    def brief(self) -> LessonBrief:
        return LessonBrief.from_data(self.to_data()["brief"])

    def save(self, path: Path):
        require(path.suffix.lower() == ".json", "احفظ المسودة بامتداد JSON.")
        path = path.expanduser().absolute()
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, name = tempfile.mkstemp(prefix=".nova-lesson-draft-", dir=path.parent)
        temporary = Path(name)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                stream.write(self.to_json())
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)

    def compile(self):
        """Locally construct the full source + visual plan. No generated hashes trusted."""
        from .whiteboard import parse_lesson

        bundle = self.to_data()
        data, brief = bundle["draft"], bundle["brief"]
        sections = [("أهداف الدرس", data["objectives"])]
        sections += [
            (step["title"], [row["speech"] for row in step["rows"]]) for step in data["steps"]
        ]
        for question in data["questions"]:
            sections += [
                ("فكّر قبل الإجابة", [question["question"]]),
                ("راجع إجابتك", [question["answer"]]),
            ]
        sections += [("خلاصة الدرس", data["summary"])]
        script = (
            "# "
            + data["title"]
            + "\n"
            + "\n".join("## " + title + "\n" + "\n".join(rows) for title, rows in sections)
        )
        require(len(script) <= MAX_EXPANDED_CHARACTERS, "النص الموسع أكبر من 12000 حرف؛ قسّم الدرس.")
        lesson = parse_lesson(script)
        require(len(lesson.steps) == len(sections))
        for step, (_, rows) in zip(lesson.steps, sections, strict=True):
            require(
                [row.text for row in step.rows] == rows,
                "تقسيم السطور لا يطابق الرسم؛ اختصر النطق في كل سطر إلى 180 حرفًا.",
            )
        source = lesson.manifest()
        plan = empty_plan(source, subject=brief["subject"], grade=brief["grade"])
        plan["schema"] = 2
        plan["origin"] = {
            "kind": "expanded-lesson",
            "brief": brief,
            "draft_fingerprint": bundle["fingerprint"],
            "source_fingerprint": source["fingerprint"],
        }
        plan["notes"] = [
            "مسودة درس موسع من وصف، لا شهادة صحة أو مطابقة منهج؛ راجع النص والرسوم والإجابات."
        ] + data["notes"]
        for index, step in enumerate(data["steps"], 1):
            plan["steps"][index].update(
                description=step["description"],
                elements=step["elements"],
                rows=[
                    {"index": row, "display": item["display"], "speech": item["speech"]}
                    for row, item in enumerate(step["rows"])
                ],
            )
        return replace(lesson, visuals=VisualPlan.from_data(plan, source))

    def bind_plan(self, plan: VisualPlan, source):
        """Keep the exact original brief when an expanded script's drawings are revised."""
        compiled = self.compile()
        expected = replace(compiled, visuals=None).manifest()
        require(
            source.manifest() == expected,
            "النص/وضع الراوي تغيّر عن المسودة؛ راجعها مجددًا أو افصل الارتباط صراحة.",
        )
        data = plan.to_data()
        origin = compiled.visuals.to_data()["origin"]
        brief = self.brief.to_data()
        require(
            data["policy"] == "general"
            and data["subject"] == brief["subject"]
            and data["grade"] == brief["grade"],
            "سياسة الخطة أو المادة/الصف لا تطابق الوصف المعتمد؛ راجع المسودة أولًا.",
        )
        require(
            data["schema"] == 1 or data["origin"] == origin,
            "الخطة محفوظة بارتباط وصف آخر؛ لا يُستبدل أصلها بصمت.",
        )
        require(
            all(
                data["steps"][index]["elements"]
                for index in range(1, 1 + len(self.to_data()["draft"]["steps"]))
            )
            and sum(len(step["elements"]) for step in data["steps"]) <= 180,
            "أبقِ رسمًا في كل مرحلة شرح للدرس الكامل، حتى 180 عنصرًا إجمالًا.",
        )
        data.update(schema=2, origin=origin)
        return VisualPlan.from_data(data, expected)

    def review_text(self) -> str:
        lesson = self.compile()
        brief = self.brief.to_data()
        return (
            "مسودة تحتاج مراجعتك واعتمادك؛ لا توثيق علمي/ديني ولا تشغيل صوت تلقائي.\n\n"
            + "الوصف الأصلي حرفيًا (لا يُنطق):\n"
            + brief["text"]
            + "\n\nالنص الموسع المقترح:\n"
            + lesson.script
            + "\n\n"
            + review_text(lesson.visuals, replace(lesson, visuals=None).manifest())
        )


def main():
    from .whiteboard import save_whiteboard

    parser = argparse.ArgumentParser(description="استيراد مسودة درس محليًا، بلا API أو Qt.")
    parser.add_argument("draft", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--approve-lesson", action="store_true")
    args = parser.parse_args()
    try:
        draft = LessonDraft.load(args.draft)
        print(draft.review_text())
        if not args.approve_lesson:
            parser.error("لم يُكتب ملف. راجع المسودة ثم أضف --approve-lesson صراحة.")
        require(args.draft.resolve() != args.output.resolve(), "لا تستبدل حزمة المسودة بملف HTML.")
        save_whiteboard(draft.compile(), args.output)
    except (OSError, ScriptError, UnicodeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
