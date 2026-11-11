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
