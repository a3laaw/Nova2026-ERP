"""Source-grounded coverage/format/safety tests; no live model or Ministry data."""

import ast
import copy
import inspect
import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

import pytest

from nova_voice import inference
from nova_voice.appearance import CHARACTERS, LAYOUTS
from nova_voice.dialogue import has_voice_markers, parse_dialogue
from nova_voice.inference import (
    LIMITS,
    GuideFields,
    InferenceError,
    build_drawing,
    build_prompt,
    capability,
    load_catalog,
    render_guide,
    search_catalog,
)
from nova_voice.lesson_brief import LessonBrief
from nova_voice.scenes import EASING_TYPES, ICONS, KINDS, MOTION_TYPES, validate_element
from nova_voice.text import validate_text
from nova_voice.whiteboard import MAX_STEPS, MAX_TITLE, ROWS_PER_STEP, parse_lesson

ROOT = Path(__file__).resolve().parents[1]
CATALOG = load_catalog()
ENTRIES = CATALOG["entries"]


class Inspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.controls = set()
        self.scripts = []
        self.external = []
        self.ids = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        identifier = attrs.get("id", "")
        if identifier:
            self.ids.append(identifier)
        if tag in ("button", "input", "select", "audio") and identifier.startswith("wb-"):
            self.controls.add("control:" + identifier)
        if tag == "script":
            self.scripts.append(attrs)
        if tag in ("script", "link", "iframe", "img", "object", "embed"):
            self.external.extend(attrs[key] for key in ("src", "href", "data") if key in attrs)


def covered(prefix):
    return {
        value.removeprefix(prefix)
        for entry in ENTRIES
        for value in entry["covers"]
        if value.startswith(prefix)
    }


def test_catalog_covers_engine_vocabulary_and_all_example_elements_validate():
    assert covered("shape:") == set(KINDS)
    assert covered("motion:") >= set(MOTION_TYPES)
    assert covered("ease:") == set(EASING_TYPES)
    assert covered("icon:") == set(ICONS)
    assert covered("character:") == {"none", *(item[0] for item in CHARACTERS)}
    assert covered("layout:") == set(LAYOUTS)
    assert {e["element"]["kind"] for e in ENTRIES if e["element"]} == set(KINDS)
    for entry in ENTRIES:
        if entry["element"] is not None:
            validate_element(entry["element"], rows=2)


def test_catalog_covers_every_existing_browser_control():
    parser = Inspector()
    parser.feed((ROOT / "assets/whiteboard.html").read_text())
    actual = {value for e in ENTRIES for value in e["covers"] if value.startswith("control:")}
    assert len(parser.controls) == 29
    assert actual == parser.controls  # A new/missing control must update the guide.


def native_buttons():
    buttons = set()
    for name in ("ui", "appearance_picker", "scene_picker", "lesson_picker", "video_picker"):
        tree = ast.parse((ROOT / f"nova_voice/{name}.py").read_text())
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Assign)
                and isinstance(node.value, ast.Call)
                and isinstance(node.value.func, ast.Name)
                and node.value.func.id == "button"
            ):
                for target in node.targets:
                    if isinstance(target, ast.Attribute) and ast.unparse(target.value) == "self":
                        buttons.add(f"{name}.{target.attr}")
    # The lesson picker installs these three through a named setattr loop.
    buttons.update(
        f"lesson_picker.{name}" for name in ("import_button", "prompt_button", "example_button")
    )
    return buttons


def test_catalog_covers_all_named_native_action_buttons_and_has_no_stale_names():
    assert covered("native:") == native_buttons()


def test_catalog_is_free_form_complete_and_references_real_owned_sources():
    assert len(ENTRIES) == 86
    assert len(CATALOG["categories"]) == 8
    assert len({entry["id"] for entry in ENTRIES}) == len(ENTRIES)
    assert {entry["category"] for entry in ENTRIES} == {c["id"] for c in CATALOG["categories"]}
    for entry in ENTRIES:
        assert entry["summary"] and entry["result"] and entry["steps"] and entry["limits"]
        assert entry["example"]["source"] and entry["example"]["output"]
        assert entry["target"] in CATALOG["targets"]
        assert bool(entry["request"]) == (entry["kind"] != "local")
        assert entry["kind"] != "local" or not entry["drawing"]
    for source in CATALOG["source_files"]:
        assert (ROOT / source).is_file()
    assert (MAX_STEPS, ROWS_PER_STEP, MAX_TITLE) == (120, 6, 120)
    assert LIMITS == CATALOG["field_limits"]
    # The grade/subject fields stay free text, not a fixed subject/grade list.
    prompt = build_prompt(
        "whiteboard",
        GuideFields(subject="موضوع جديد", grade="الثاني الإعدادي", source="مصدر مؤلف للمراجعة."),
    )
    assert "موضوع جديد" in prompt and "الثاني الإعدادي" in prompt


@pytest.mark.parametrize("entry", ENTRIES, ids=lambda e: e["id"])
def test_every_authored_example_matches_a_real_parser_and_a_buildable_request(entry):
    output = entry["example"]["output"]
    mode = entry["kind"]
    prompt = build_prompt(entry["id"], GuideFields(source=entry["example"]["source"]))
    assert entry["title"] in prompt
    assert "المكان:" in prompt if mode == "local" else "شكل الناتج المطلوب:" in prompt
    if mode in ("board", "board-dialogue", "bilingual"):
        lesson = parse_lesson(output, dialogue=mode != "board")
        assert lesson.title and lesson.steps
        assert len(lesson.steps) <= MAX_STEPS
        assert all(len(step.rows) <= ROWS_PER_STEP for step in lesson.steps)
        assert all(len(row.text) <= 180 for step in lesson.steps for row in step.rows)
        if mode != "board":
            assert lesson.speakers == {1, 2}
    elif mode == "speech-dialogue":
        assert {turn.speaker for turn in parse_dialogue(output)} == {1, 2}
        assert not re.search(r"^#", output, re.M)
    elif mode == "speech":
        assert validate_text(output) == output
        assert not has_voice_markers(output) and not re.search(r"^#", output, re.M)
    elif mode == "brief":
        assert LessonBrief.create(output, "علوم", "الإعدادي", "general").to_data()["text"] == output


@pytest.mark.parametrize("entry", ENTRIES, ids=lambda e: e["id"])
def test_sacred_mode_never_incorporates_fields_or_allows_drawing(entry):
    private = "PRIVATE_SOURCE_SENTINEL_123"
    fields = GuideFields(private, private, private, private, private)
    assert build_prompt(entry["id"], fields, policy="sacred") == CATALOG["shared"]["sacred"]
    assert private not in build_prompt(entry["id"], fields, policy="sacred")
    with pytest.raises(InferenceError):
        build_drawing(entry["id"], policy="sacred")


def test_local_instructions_ignore_even_invalid_source_fields_without_copying_them():
    fields = GuideFields(source="PRIVATE\x00" + "s" * 15000, notes="PRIVATE-notes")
    for entry in ENTRIES:
        if entry["kind"] == "local":
            text = build_prompt(entry["id"], fields)
            assert "PRIVATE" not in text and text == build_prompt(entry["id"])


@pytest.mark.parametrize("name", LIMITS)
def test_each_field_accepts_exact_codepoint_bound_and_rejects_one_more(name):
    values = {"source": "مصدر مؤلف."}
    values[name] = "ن" * LIMITS[name]
    assert len(GuideFields(**values).normalized()[name]) == LIMITS[name]
    assert build_prompt("whiteboard", GuideFields(**values))
    values[name] += "ن"
    with pytest.raises(InferenceError, match=str(LIMITS[name])):
        build_prompt("whiteboard", GuideFields(**values))


@pytest.mark.parametrize("bad", ("", "   ", "؟!!", "\x00أ", "أ\x01", "أ\ud800", "أ\udfff"))
def test_empty_or_invalid_source_is_rejected_without_echoing_input(bad):
    with pytest.raises(InferenceError) as captured:
        build_prompt("whiteboard", GuideFields(source=bad))
    assert not bad or bad not in str(captured.value)


def test_normalization_crlf_unicode_bounds_json_and_nonpersisted_repr():
    fields = GuideFields(
        subject=" علوم ",
        grade=" إعدادي ",
        title="عنوان 😀",
        source="\u0085 المصدر\r\nسطر آخر 😀 \u0085",
        notes='ملاحظة "مقتبسة" </script> & <img src=x onerror=alert(1)>',
    )
    values = fields.normalized()
    assert values["source"] == "المصدر\nسطر آخر 😀"
    prompt = build_prompt("whiteboard", fields)
    data = prompt.split("بيانات الإعداد (JSON نصي للسياق، وليس خطة للاستيراد):\n", 1)[1].split(
        "\n\nبعد الرد", 1
    )[0]
    assert json.loads(data)["النص المصدر"] == values["source"]
    assert json.loads(data)["متطلبات إضافية"] == values["notes"]
    assert "المصدر" not in repr(fields) and "مقتبسة" not in repr(fields)
    with pytest.raises(InferenceError, match="سطر واحد"):
        build_prompt("whiteboard", GuideFields(subject="علوم\nهندسة", source="مصدر"))


@pytest.mark.parametrize("identifier", [e["id"] for e in ENTRIES if e["drawing"]])
def test_drawing_addenda_are_separate_and_never_fake_bound_json(identifier):
    text = build_drawing(identifier)
    assert "ليس JSON جاهزًا للاستيراد" in text
    assert "لا تخمّن" in text and not text.lstrip().startswith("{")
    assert "source_fingerprint" not in text and "brief_fingerprint" not in text
    prepared = build_prompt(identifier, GuideFields(source="مصدر مؤلف."))
    assert "لا تُرجع JSON مشاهد أو بصمات" in prepared
    assert capability(CATALOG, identifier)["drawing"] not in prepared


def test_unknown_identifiers_policy_and_nonvisual_requests_fail_closed():
    for function in (build_prompt, build_drawing):
        with pytest.raises(InferenceError):
            function("nonexistent")
        with pytest.raises(InferenceError):
            function("whiteboard", policy="automatic")
    with pytest.raises(InferenceError):
        build_drawing("voice-models")


def test_search_supports_arabic_diacritics_aliases_multiple_terms_and_empty_results():
    assert {entry["id"] for entry in search_catalog(CATALOG, "دَوَران")} >= {
        "motion-rotate",
        "shape-sphere",
    }
    assert {entry["id"] for entry in search_catalog(CATALOG, "motion path")} == {
        "motion-path",
        "motion-ease",
    }
    assert search_catalog(CATALOG, "لَون", category="appearance")
    assert all(e["kind"] == "local" for e in search_catalog(CATALOG, mode="local"))
    assert all(e["kind"] != "local" for e in search_catalog(CATALOG, mode="prompt"))
    assert search_catalog(CATALOG, "not-a-capability-xz") == []


def test_offline_html_is_deterministic_current_embedded_and_has_unique_ids():
    html = render_guide()
    assert (ROOT / "INFERENCE-GUIDE-AR.html").read_text() == html
    parser = Inspector()
    parser.feed(html)
    assert len(parser.ids) == len(set(parser.ids))
    assert len(parser.scripts) == 2 and parser.external == []
    assert parser.scripts[0] == {"id": "inference-data", "type": "application/json"}
    assert "connect-src 'none'" in html and 'dir="rtl"' in html
    assert "INFERENCE_CATALOG_JSON" not in html and "/*INFERENCE_JS*/" not in html
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools/build_inference_guide.py"), "--check"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_embedded_json_escapes_raw_html_script_breakouts(monkeypatch):
    catalog = copy.deepcopy(CATALOG)
    attack = '</script><script id="injected">window.BAD=1</script> & \u2028\u2029'
    catalog["entries"][0]["title"] = attack
    monkeypatch.setattr(inference, "load_catalog", lambda: catalog)
    html = render_guide()
    assert attack not in html and 'id="injected"' not in html
    payload = re.search(
        r'<script id="inference-data" type="application/json">(.*?)</script>', html, re.S
    )[1]
    assert "<" not in payload and "&" not in payload and "\u2028" not in payload
    assert json.loads(payload)["entries"][0]["title"] == attack
    parser = Inspector()
    parser.feed(html)
    assert len(parser.scripts) == 2


def test_core_and_native_guide_do_not_import_any_provider_or_auto_write_settings():
    for name in ("inference.py", "inference_picker.py"):
        code = (ROOT / "nova_voice" / name).read_text()
        tree = ast.parse(code)
        imported = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                imported.append(node.module or "")
        assert not {
            "urllib",
            "requests",
            "socket",
            "subprocess",
            "scene_planner",
            "lesson_planner",
        }.intersection(imported)
        assert "save_preferences" not in code and "load_preferences" not in code
    assert "open(" not in inspect.getsource(build_prompt)
    assert "write" not in inspect.getsource(build_prompt)


def test_invalid_owned_catalog_fails_with_a_recoverable_message(tmp_path):
    data = copy.deepcopy(CATALOG)
    data["entries"][0]["id"] = data["entries"][1]["id"]
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(data))
    with pytest.raises(InferenceError):
        load_catalog(path)
