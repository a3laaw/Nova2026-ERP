"""Small, local whiteboard presentation settings; never part of spoken text."""

import re
from dataclasses import asdict, dataclass
from html import escape
from pathlib import Path
from xml.etree import ElementTree

STYLE_ID = "nova-whiteboard-appearance"
CATALOG_ID = "nova-character-catalog"
CHARACTERS = (
    ("adam", "آدم", "boy"),
    ("omar", "عمر", "boy"),
    ("youssef", "يوسف", "boy"),
    ("layla", "ليلى", "girl"),
    ("nour", "نور", "girl"),
    ("salma", "سلمى", "girl"),
)
CHARACTER_IDS = frozenset({"none", *(item[0] for item in CHARACTERS)})
_COLOR = re.compile(r"#[0-9a-fA-F]{6}\Z")
MAX_ROW_COLORS = 720


class AppearanceError(ValueError):
    """An invalid local presentation setting, not a speech-engine error."""


def color_value(value: object) -> str:
    if not isinstance(value, str) or not _COLOR.fullmatch(value):
        raise AppearanceError("اختر لونًا سداسيًا صالحًا، مثل #2563EB، دون أكواد أو روابط.")
    return value.upper()


@dataclass(frozen=True)
class RowColor:
    step: int
    row: int
    color: str


@dataclass(frozen=True)
class BoardAppearance:
    first_color: str = "#2563EB"
    second_color: str = "#C2410C"
    first_character: str = "none"
    second_character: str = "none"
    animate_characters: bool = True
    row_colors: tuple[RowColor, ...] = ()
    layout: str = "stacked"

    def to_data(self) -> dict:
        return {"version": 1, **asdict(self)} | {
            "row_colors": [asdict(item) for item in self.row_colors]
        }

    @classmethod
    def from_data(cls, data: object, row_counts: tuple[int, ...]) -> "BoardAppearance":
        if isinstance(data, dict) and "layout" not in data:
            data = data | {"layout": "script"}  # Existing color-only HTML keeps its layout.
        if not isinstance(data, dict) or set(data) != set(cls().to_data()):
            raise AppearanceError("بيانات ألوان السبورة والشخصيات ناقصة أو غير مدعومة.")
        if type(data["version"]) is not int or data["version"] != 1:
            raise AppearanceError("إصدار تخصيص السبورة غير مدعوم.")
        if data["layout"] not in ("stacked", "columns", "script"):
            raise AppearanceError("اختر ترتيبًا مدعومًا للغتين: تحت بعض أو عمودان أو ترتيب السكريبت.")
        for name in ("first_character", "second_character"):
            if not isinstance(data[name], str) or data[name] not in CHARACTER_IDS:
                raise AppearanceError("اختر شخصية من المكتبة المحلية فقط.")
        if type(data["animate_characters"]) is not bool:
            raise AppearanceError("إعداد حركة الشخصيات غير صالح.")
        items = data["row_colors"]
        if not isinstance(items, list) or len(items) > MAX_ROW_COLORS:
            raise AppearanceError("عدد تخصيصات ألوان الجمل أكبر من الحد المدعوم.")
        colors = []
        seen = set()
        for item in items:
            if not isinstance(item, dict) or set(item) != {"step", "row", "color"}:
                raise AppearanceError("إعداد لون إحدى الجمل غير صالح.")
            step, row = item["step"], item["row"]
            if (
                type(step) is not int
                or type(row) is not int
                or not 0 <= step < len(row_counts)
                or not 0 <= row < row_counts[step]
                or (step, row) in seen
            ):
                raise AppearanceError("لون الجملة لا يطابق خطوات هذه السبورة أو مكرر.")
            seen.add((step, row))
            colors.append(RowColor(step, row, color_value(item["color"])))
        return cls(
            color_value(data["first_color"]),
            color_value(data["second_color"]),
            data["first_character"],
            data["second_character"],
            data["animate_characters"],
            tuple(colors),
            data["layout"],
        )

    def validated(self, row_counts: tuple[int, ...]) -> "BoardAppearance":
        return self.from_data(self.to_data(), row_counts)


def character_catalog() -> list[dict[str, str]]:
    return [{"id": key, "name": name, "kind": kind} for key, name, kind in CHARACTERS]


def character_templates(assets: Path) -> str:
    """Bundle only our six fixed, passive SVG assets; never accept user SVG/URLs."""
    parts = []
    ns = "{http://www.w3.org/2000/svg}"
    allowed = {ns + tag for tag in ("svg", "g", "path", "circle", "ellipse", "rect")}
    allowed_attributes = {
        "viewBox",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "class",
        "transform",
        "d",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "x",
        "y",
        "width",
        "height",
        "aria-hidden",
        "focusable",
    }
    for key, name, _ in CHARACTERS:
        source = (assets / "characters" / f"{key}.svg").read_text(encoding="utf-8")
        if len(source) > 20_000 or "<!" in source:
            raise AppearanceError("ملف إحدى الشخصيات غير صالح. استخدم حزمة البرنامج كاملة.")
        try:
            root = ElementTree.fromstring(source)
        except ElementTree.ParseError as error:
            raise AppearanceError("ملف SVG للشخصية تالف.") from error
        if root.tag != ns + "svg":
            raise AppearanceError("الشخصية ليست SVG محليًا مدعومًا.")
        for node in root.iter():
            if node.tag not in allowed or set(node.attrib) - allowed_attributes:
                raise AppearanceError("الشخصيات لا تسمح بأكواد أو صور أو روابط خارجية.")
            if any("url(" in value.lower() for value in node.attrib.values()):
                raise AppearanceError("الشخصيات لا تسمح بموارد خارجية.")
        parts.append(
            f'<template id="nova-character-{key}" data-name="{escape(name, quote=True)}">'
            + source
            + "</template>"
        )
    return "\n".join(parts)
