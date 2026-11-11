import json
from threading import Event

import pytest

from nova_voice.voices import Cancelled, VoiceError, VoiceLibrary, VoiceSpec


def test_model_discovery_and_bad_files_are_isolated(tmp_path, voice_files):
    model, _ = voice_files
    (model.parent / "broken.onnx").write_bytes(b"bad")
    library = VoiceLibrary(model.parent, tmp_path / "none")
    voices, warnings = library.scan()
    assert len(voices) == 1
    assert voices[0].model_path == model.resolve()
    assert len(warnings) == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("phoneme_type", "pinyin"),
        ("num_symbols", -1),
        ("num_speakers", 0),
        ("phoneme_id_map", {}),
        ("speaker_id_map", {"bad": 999999}),
    ],
)
def test_invalid_or_non_offline_model_config(voice_files, field, value):
    model, config = voice_files
    data = json.loads(config.read_text(encoding="utf-8"))
    data[field] = value
    config.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(VoiceError):
        VoiceSpec.from_path(model)


def test_missing_and_empty_files(voice_files):
    model, config = voice_files
    config.unlink()
    with pytest.raises(VoiceError, match="مفقود"):
        VoiceSpec.from_path(model)
    model.write_bytes(b"")
    with pytest.raises(VoiceError, match="فارغ"):
        VoiceSpec.from_path(model)


def test_atomic_import_preserves_originals_and_licenses(tmp_path, voice_files):
    model, config = voice_files
    (model.parent / "MODEL_CARD").write_text("Test license", encoding="utf-8")
    original = model.read_bytes()
    library = VoiceLibrary(tmp_path / "imported", tmp_path / "none")
    progress = []
    imported = library.import_voice(model, config, Event(), progress.append)
    assert model.read_bytes() == original
    assert imported.model_path.read_bytes() == original
    assert imported.config_path.is_file()
    assert (imported.model_path.parent / "MODEL_CARD").read_text(encoding="utf-8") == "Test license"
    assert progress[-1] == 100
    # The same original can be imported again without replacing an earlier copy.
    second = library.import_voice(model, config, Event(), lambda _: None)
    assert second.model_path != imported.model_path
    assert len(library.scan()[0]) == 2


def test_cancelled_import_leaves_no_partial_model(tmp_path, voice_files):
    library = VoiceLibrary(tmp_path / "imported", tmp_path / "none")
    event = Event()
    with pytest.raises(Cancelled):
        library.import_voice(*voice_files, event, lambda _: event.set())
    assert list(library.user_root.iterdir()) == []


def test_staging_directories_are_not_discovered(tmp_path, voice_files):
    library = VoiceLibrary(tmp_path, tmp_path / "none")
    hidden = tmp_path / ".import-interrupted"
    hidden.mkdir()
    (hidden / "bad.onnx").write_bytes(b"not ready")
    assert not any("bad.onnx" in warning for warning in library.scan()[1])


def test_arabic_and_english_family_codes_support_language_filters(bilingual_cast):
    arabic = bilingual_cast[1].voice
    english = bilingual_cast[2].voice
    assert arabic.language_family == "ar"
    assert english.language_family == "en"
    assert arabic.language_code == "ar_JO"


@pytest.mark.parametrize(
    "code,expected",
    [
        ("en_GB", "UK · بريطاني"),
        ("en-GB-x-rp", "UK · بريطاني"),
        ("en_US", "US · أمريكي"),
        ("en-us", "US · أمريكي"),
        ("en", ""),
        ("en_AU", ""),
        ("ar_JO", ""),
    ],
)
def test_voice_locale_labels_do_not_rename_or_relabel_the_model(voice_spec, code, expected):
    from dataclasses import replace

    voice = replace(voice_spec, language_code=code)
    assert voice.locale_label == expected
    assert voice.name == voice_spec.name and voice.model_path == voice_spec.model_path
    assert voice.language_code == code
    assert (
        (expected in voice.label) if expected else voice.label == f"{voice.name} · {voice.language}"
    )
    assert "RP" not in voice.label
