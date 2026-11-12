import json

from nova_voice.storage import Preferences, load_preferences, save_preferences


def test_round_trip_and_no_script_contents(tmp_path):
    prefs = Preferences(
        voice_path="C:/voices/arabic.onnx", speed=1.2, pause_ms=500, audio_format="wav"
    )
    save_preferences(tmp_path, prefs)
    assert load_preferences(tmp_path) == prefs
    assert set(json.loads((tmp_path / "settings.json").read_text(encoding="utf-8"))) == {
        "voice_path",
        "speed",
        "pause_ms",
        "audio_format",
        "output_dir",
        "mode",
        "language",
        "speaker_id",
        "second_voice_path",
        "second_language",
        "second_speaker_id",
        "turn_pause_ms",
        "library_root",
    }
    assert list(tmp_path.glob(".settings-*")) == []


def test_missing_corrupt_and_out_of_range_preferences(tmp_path):
    assert load_preferences(tmp_path) == Preferences()
    path = tmp_path / "settings.json"
    for content in ("broken", "[]", '{"speed": null}'):
        path.write_text(content, encoding="utf-8")
        assert load_preferences(tmp_path) == Preferences()
    path.write_text('{"speed": 99, "pause_ms": -2, "audio_format": "exe"}', encoding="utf-8")
    prefs = load_preferences(tmp_path)
    assert prefs.speed == 1.6
    assert prefs.pause_ms == 0
    assert prefs.audio_format == "mp3"


def test_legacy_settings_migrate_and_dialogue_cast_round_trips(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text('{"voice_path":"old.onnx", "speed":1.25}', encoding="utf-8")
    legacy = load_preferences(tmp_path)
    assert legacy.voice_path == "old.onnx"
    assert legacy.mode == "single"
    assert legacy.second_language == "en"
    dialogue = Preferences(
        voice_path="arabic.onnx",
        language="ar",
        mode="dialogue",
        second_voice_path="english.onnx",
        second_language="en",
        second_speaker_id=2,
        turn_pause_ms=500,
    )
    save_preferences(tmp_path, dialogue)
    assert load_preferences(tmp_path) == dialogue


def test_bad_dialogue_settings_are_clamped_or_defaulted(tmp_path):
    (tmp_path / "settings.json").write_text(
        '{"mode":"unknown","language":"zz","second_language":"zz",'
        '"speaker_id":-3,"second_speaker_id":5000,"turn_pause_ms":9000}'
    , encoding="utf-8")
    prefs = load_preferences(tmp_path)
    assert (prefs.mode, prefs.language, prefs.second_language) == ("single", "all", "en")
    assert (prefs.speaker_id, prefs.second_speaker_id, prefs.turn_pause_ms) == (0, 999, 2000)


def test_library_root_preference_round_trips_and_resolves(tmp_path):
    from nova_voice.storage import (
        library_organized_dir,
        resolve_organized_root,
    )

    prefs = load_preferences(tmp_path)  # no settings yet
    assert prefs.library_root == ""
    assert resolve_organized_root(prefs, base=tmp_path) == library_organized_dir(tmp_path)

    custom = tmp_path / "مكتبة-خاصة"
    prefs.library_root = str(custom)
    save_preferences(tmp_path, prefs)
    loaded = load_preferences(tmp_path)
    assert loaded.library_root == str(custom)
    assert resolve_organized_root(loaded, base=tmp_path) == custom

    # Relative values never escape the default; the app stays on safe ground.
    loaded.library_root = "relative/subdir"
    assert resolve_organized_root(loaded, base=tmp_path) == library_organized_dir(tmp_path)
    loaded.library_root = ""
    assert resolve_organized_root(loaded, base=tmp_path) == library_organized_dir(tmp_path)


def test_ensure_writable_dir_creates_and_verifies(tmp_path):
    from nova_voice.storage import ensure_writable_dir

    target = tmp_path / "deep" / "nested" / "organizer"
    assert ensure_writable_dir(target) == target
    assert target.is_dir()
    assert list(target.iterdir()) == []
