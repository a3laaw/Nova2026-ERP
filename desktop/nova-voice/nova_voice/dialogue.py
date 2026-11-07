"""Two-speaker script syntax. Markers choose voices; they are never spoken."""

import re
from dataclasses import dataclass

from .text import ScriptError, preview_text, validate_text

# Canonical form is [1] / [2]. Colon aliases and Arabic digits are convenient
# when pasting a dialogue from a document. A/B always map to speakers 1/2.
MARKER = re.compile(r"^\s*(?:\[(?P<bracket>[12١٢ABab])\]|(?P<colon>[12١٢ABab])\s*[:：])\s*")
UNKNOWN_MARKER = re.compile(r"^\s*(?:\[[^\]]+\]|(?:[0-9٠-٩]+|[A-Za-z])\s*[:：])")
SPEAKERS = {"1": 1, "١": 1, "a": 1, "2": 2, "٢": 2, "b": 2}

BILINGUAL_EXAMPLE = """[1] مرحبًا، كيف يمكنني مساعدتك اليوم؟
[2] Hello! I would like to learn more about this program.
[1] بالتأكيد، يحوّل البرنامج الحوار المكتوب إلى ملف صوتي واحد.
[2] Great! One voice asks a question, and the other voice replies."""


@dataclass(frozen=True)
class DialogueTurn:
    speaker: int
    text: str


def parse_dialogue(script: str) -> list[DialogueTurn]:
    script = validate_text(script)
    turns: list[DialogueTurn] = []
    speaker: int | None = None
    lines: list[str] = []
    start_line = 1

    def finish_turn() -> None:
        if speaker is None:
            return
        content = "\n".join(lines).strip()
        try:
            content = validate_text(content)
        except ScriptError as error:
            raise ScriptError(
                f"مقطع الصوت {speaker} الذي يبدأ في السطر {start_line} فارغ أو غير صالح."
            ) from error
        turns.append(DialogueTurn(speaker, content))

    for number, line in enumerate(script.splitlines(), start=1):
        match = MARKER.match(line)
        if match:
            finish_turn()
            speaker = SPEAKERS[(match.group("bracket") or match.group("colon")).lower()]
            start_line = number
            lines = [line[match.end() :]]
        elif UNKNOWN_MARKER.match(line):
            raise ScriptError(
                f"وسم متحدث غير معروف في السطر {number}. استخدم [1] أو [2] في بداية السطر."
            )
        elif line.strip() and speaker is None:
            raise ScriptError(f"حدّد صاحب الكلام في السطر {number} بإضافة [1] أو [2] قبله.")
        elif speaker is not None:
            # Untagged continuation lines/paragraphs belong to the current speaker.
            lines.append(line)
    finish_turn()
    return turns


def preview_dialogue(script: str, limit: int = 400) -> str:
    """Trim spoken content, not raw tags; preserve the cast and the original order."""
    if limit < 16:
        raise ValueError("Preview limit must be at least 16")
    turns = parse_dialogue(script)
    selected: list[str] = []
    remaining = limit
    for turn in turns:
        if remaining <= 0 or (selected and remaining < 16):
            break
        content = turn.text
        if len(content) > remaining:
            # Tiny leftover budgets can contain just punctuation/whitespace.
            content = preview_text(content, remaining)
            if not any(char.isalnum() for char in content):
                break
        selected.append(f"[{turn.speaker}] {content}")
        remaining -= len(content)
    return "\n".join(selected)


def tag_line(line: str, speaker: int) -> str:
    """Mark/reassign a paragraph without stacking or speaking old voice labels."""
    if speaker not in (1, 2):
        raise ValueError("Dialogue speakers must be 1 or 2")
    match = MARKER.match(line)
    content = line[match.end() :] if match else line
    return f"[{speaker}] {content}"
