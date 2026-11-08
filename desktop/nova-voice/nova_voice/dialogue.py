"""Two-speaker script syntax. Markers choose voices; they are never spoken."""

import re
from dataclasses import dataclass
from itertools import groupby

from .text import ScriptError, preview_text, validate_text

# Bracket markers are reserved anywhere, including pasted, adjacent inline spans.
# Colon aliases stay line-initial so times and ordinary prose remain untouched.
MARKER = re.compile(r"^\s*(?:\[(?P<bracket>[12١٢ABab])\]|(?P<colon>[12١٢ABab])\s*[:：])\s*")
_MARKERS = re.compile(
    r"(?:^[ \t]*)?\[(?P<closing>/)?(?P<bracket>[12١٢ABab])\]"
    r"|(?P<unknown_inline>\[[ \t]*(?:/[^\]\n]*|[0-9٠-٩]+[^\]\n]*)(?:\]|$))"
    r"|^[ \t]*(?:(?P<colon>[12١٢ABab])[ \t]*[:：]"
    r"|(?P<unknown_line>\[[^\]\n]*\]|(?:[0-9٠-٩]+|[A-Za-z])[ \t]*[:：]))",
    re.MULTILINE,
)
SPEAKERS = {"1": 1, "١": 1, "a": 1, "2": 2, "٢": 2, "b": 2}

BILINGUAL_EXAMPLE = """[1] مرحبًا، كيف يمكنني مساعدتك اليوم؟
[2] Hello! I would like to learn more about this program.
[1] بالتأكيد، يحوّل البرنامج الحوار المكتوب إلى ملف صوتي واحد.
[2] Great! One voice asks a question, and the other voice replies."""


@dataclass(frozen=True)
class DialogueTurn:
    speaker: int
    text: str


def has_voice_markers(script: str) -> bool:
    """Guard single-voice paths against opening, closing or invalid role markers."""
    return _MARKERS.search(script) is not None


def parse_dialogue(script: str) -> list[DialogueTurn]:
    """Parse line tags or inline spans; closing tags are optional, never nested.

    A new opening marker ends the preceding turn. An explicit closing marker
    must match the current role and ends its ownership of subsequent text.
    Unassigned prose, empty turns and malformed role markers fail before speech
    or whiteboard generation; we never guess a voice or discard spoken words.
    """
    script = validate_text(script)
    # A numbered exercise prefix immediately before an explicit opening marker
    # belongs to that same role. Do not guess ownership of arbitrary prose.
    script = re.sub(
        r"(?m)^([ \t]*)([0-9٠-٩]+[.)])[ \t]+(\[[12١٢ABab]\])[ \t]*",
        r"\1\3 \2 ",
        script,
    )
    turns: list[DialogueTurn] = []
    speaker: int | None = None
    parts: list[str] = []
    start_line = 1
    line_number = 1
    position = 0

    def append_content(content: str) -> None:
        if speaker is None and content.strip():
            leading = len(content) - len(content.lstrip())
            number = line_number + content[:leading].count("\n")
            raise ScriptError(f"حدّد صاحب الكلام في السطر {number} بإضافة [1] أو [2] قبله.")
        if speaker is not None:
            parts.append(content)

    def finish_turn() -> None:
        if speaker is None:
            return
        try:
            content = validate_text("".join(parts))
        except ScriptError as error:
            raise ScriptError(
                f"مقطع الصوت {speaker} الذي يبدأ في السطر {start_line} فارغ أو غير صالح."
            ) from error
        turns.append(DialogueTurn(speaker, content))

    for match in _MARKERS.finditer(script):
        content = script[position : match.start()]
        append_content(content)
        line_number += content.count("\n")
        if match.group("unknown_inline") or match.group("unknown_line"):
            raise ScriptError(
                f"وسم متحدث غير معروف في السطر {line_number}. استخدم [1] أو [2]، "
                "واستخدم [/1] أو [/2] للإغلاق الاختياري فقط."
            )
        role = SPEAKERS[(match.group("bracket") or match.group("colon")).lower()]
        if match.group("closing"):
            if speaker is None:
                raise ScriptError(
                    f"وسم الإغلاق [/{role}] في السطر {line_number} بلا مقطع مفتوح. "
                    f"ابدأ كلام الصوت {role} بوسم [{role}]، وليس [/{role}]."
                )
            if speaker != role:
                raise ScriptError(
                    f"وسم الإغلاق [/{role}] في السطر {line_number} لا يطابق الصوت "
                    f"الحالي؛ استخدم [/{speaker}] أو احذف وسم الإغلاق الاختياري."
                )
            finish_turn()
            speaker = None
        else:
            finish_turn()
            speaker = role
            start_line = line_number
        parts = []
        position = match.end()
    append_content(script[position:])
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
    """Reassign the first turn, keeping later roles and removing stale closers."""
    if speaker not in (1, 2):
        raise ValueError("Dialogue speakers must be 1 or 2")
    if not has_voice_markers(line):
        return f"[{speaker}] {line}"
    # Normalize paired spans before changing a role, rather than leaving [/old]
    # behind. Inline turns after the first keep their existing assignments.
    turns = parse_dialogue(line if MARKER.match(line) else f"[{speaker}] {line}")
    return "\n".join(
        f"[{speaker if index == 0 else turn.speaker}] {turn.text}"
        for index, turn in enumerate(turns)
    )


def merge_turns(turns: list[DialogueTurn]) -> list[DialogueTurn]:
    """A repeated role marker is not a new person or an artificial reply gap."""
    return [
        DialogueTurn(speaker, " ".join(turn.text for turn in group))
        for speaker, group in groupby(turns, key=lambda turn: turn.speaker)
    ]
