"""Lightweight Arabic/Latin-script checks, not a translator or language model."""

import re
import unicodedata

from .voices import VoiceError


def text_language(text: str) -> str:
    """Only letters decide; Arabic punctuation and digits do not imply Arabic."""
    arabic = latin = False
    for char in text:
        if char == "ـ" or not unicodedata.category(char).startswith("L"):
            continue
        name = unicodedata.name(char, "")
        arabic |= "ARABIC" in name
        latin |= "LATIN" in name
        if arabic and latin:
            return "mixed"
    return "ar" if arabic else "en" if latin else "neutral"


def validate_spoken_language(text: str, family: str, role: int = 1) -> None:
    """Refuse a clearly wrong Arabic/English assignment before loading models.

    Other language families are intentionally not guessed. A mixed Arabic/Latin
    utterance must be explicitly split between suitable roles, not silently
    rerouted to another voice or translated.
    """
    language = text_language(text)
    if family == "en" and language in ("ar", "mixed"):
        raise VoiceError(
            f"الصوت {role} إنجليزي لكن نصه يحتوي كلمات عربية. اختر نموذجًا عربيًا لهذا "
            "الدور، أو انقل العربية إلى دور عربي بوسم مستقل؛ لم يتم توليد صوت خاطئ."
        )
    if family == "ar" and language in ("en", "mixed"):
        raise VoiceError(
            f"الصوت {role} عربي لكن نصه يحتوي حروفًا لاتينية. اختر نموذجًا إنجليزيًا "
            "للنص الإنجليزي أو افصل اللغتين بوسمي الدورين قبل التوليد."
        )


def narration_text(text: str) -> str:
    """Keep blank exercises visible without speaking their repeated symbols.

    No answers, names or ages are invented. Wide trailing dashes used between
    translations are presentation separators, not a spoken word or a new turn.
    """
    text = re.sub(r"_{2,}|\.{4,}", "…", text)
    return re.sub(r"\s+[—–]\s*$", "", text).strip()
