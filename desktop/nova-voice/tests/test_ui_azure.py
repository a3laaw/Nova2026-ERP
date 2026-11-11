"""Native Azure controls/gates; skip honestly when host Qt libraries cannot load."""

import os
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)

import test_ui as native  # noqa: E402
from PySide6.QtTest import QSignalSpy  # noqa: E402
from PySide6.QtWidgets import (  # noqa: E402
    QApplication,
    QDialog,
    QFileDialog,
    QLineEdit,
    QMessageBox,
)
from test_azure_speech import KEY, PCM, SALMA, SONIA, NoWait, speech  # noqa: E402
from test_ui_lesson_draft import adopt  # noqa: E402

from nova_voice.azure_picker import AzureConsentDialog  # noqa: E402
from nova_voice.azure_speech import AzureError, AzureJob, AzurePlan  # noqa: E402
from nova_voice.ui import MainWindow  # noqa: E402
from nova_voice.whiteboard import WhiteboardPage  # noqa: E402

qapp, window = native.qapp, native.window


def enable_azure(window):
    window.provider_combo.setCurrentIndex(window.provider_combo.findData("azure"))
    picker = window.azure_picker
    picker.key_edit.setText(KEY)
    picker.region_edit.setText("eastus")
    picker.f0_check.setChecked(True)
    return picker


def consent_dialog(monkeypatch, *, allow=True, checkbox=True, during=None):
    plans = []

    class Dialog:
        def __init__(self, plan, region, parent):
            self.plan = plan
            self.review_check = SimpleNamespace(isChecked=lambda: checkbox)
            plans.append((plan, region))

        def exec(self):
            if during:
                during()
            return QDialog.DialogCode.Accepted if allow else QDialog.DialogCode.Rejected

    monkeypatch.setattr("nova_voice.ui.AzureConsentDialog", Dialog)
    return plans


def fake_azure(monkeypatch):
    sent, jobs = [], []

    def make_job(*args, **kwargs):
        job = AzureJob(
            *args,
            **kwargs,
            _transport=lambda req, event: sent.append(req) or PCM,
            _limiter=NoWait(),
        )
        jobs.append(job)
        return job

    monkeypatch.setattr("nova_voice.ui.AzureJob", make_job)
    return sent, jobs


def finish(window):
    worker = window.worker
    assert worker is not None
    spy = QSignalSpy(worker.finished)
    assert not worker.isRunning() or spy.count() > 0 or spy.wait(30000)
    QApplication.processEvents()
    assert window.worker is None and window._active_azure_job is None


def test_local_is_default_key_blank_and_existing_pick_selections_are_not_replaced(
    window, voice_files
):
    native.add_test_voice(window, voice_files)
    local = window.selected_voice()
    assert window.provider_combo.currentData() == "local"
    assert window.azure_picker.isHidden() and not window.azure_picker.key_edit.text()
    assert not window.azure_picker.f0_check.isChecked()
    picker = enable_azure(window)
    assert window.voice_tabs.isHidden() and not picker.isHidden()
    assert window._cast()[1].voice == SALMA and window._cast()[2].voice == SONIA
    assert window.selected_voice() == local
    window.provider_combo.setCurrentIndex(0)
    assert not picker.key_edit.text() and not picker.f0_check.isChecked()
    assert window.selected_voice() == local and not window.voice_tabs.isHidden()


def test_password_key_and_region_require_f0_confirmation_and_changes_reset_it(window):
    picker = enable_azure(window)
    window.editor.setPlainText("مرحبًا.")
    assert picker.key_edit.echoMode() == QLineEdit.EchoMode.Password
    assert window.preview_button.isEnabled() and window.generate_button.isEnabled()
    assert picker.first_voice.maxVisibleItems() == 8
    assert picker.first_voice.view().maximumHeight() <= 300
    picker.region_edit.setText("westeurope")
    assert not picker.f0_check.isChecked() and not window.preview_button.isEnabled()
    picker.f0_check.setChecked(True)
    assert window.preview_button.isEnabled()
    picker.key_edit.setText(KEY + "x")
    assert not picker.f0_check.isChecked()
    picker.f0_check.setChecked(True)
    picker.region_edit.setText("https://attacker.example")
    picker.f0_check.setChecked(True)
    assert not picker.ready() and not window.preview_button.isEnabled()
    assert window.worker is None


def test_voice_roles_are_independent_no_toggling_or_settings_sends_anything(window):
    picker = enable_azure(window)
    window.mode_combo.setCurrentIndex(1)
    picker.first_voice.setCurrentIndex(1)
    picker.second_voice.setCurrentIndex(3)
    window.editor.setPlainText("[1] أهلًا.[/1][2] Hello.[/2]")
    window.speed_slider.setValue(85)
    assert not picker.second_voice.isHidden()
    assert window._cast()[1].voice.voice_id == "ar-EG-ShakirNeural"
    assert window._cast()[2].voice.voice_id == "en-GB-RyanNeural"
    assert window._options().speed == 0.85 and window._options().speaker_id == 0
    assert window.worker is None and window._active_azure_job is None


def test_key_ttl_is_from_entry_not_usage_and_forget_is_explicit(window, monkeypatch):
    now = [time.monotonic()]
    monkeypatch.setattr("nova_voice.azure_picker.time", SimpleNamespace(monotonic=lambda: now[0]))
    picker = enable_azure(window)
    expiry = picker.credentials().expires_at
    for _ in range(3):
        now[0] += 20
        assert picker.ready() and picker.credentials().expires_at == expiry
    now[0] = expiry
    picker.expire()
    assert not picker.key_edit.text() and not picker.ready()
    assert not picker.f0_check.isChecked()
    picker = enable_azure(window)
    picker.forget_button.click()
    assert not picker.key_edit.text() and not picker.ready()
    assert window._active_azure_job is None


def test_consent_has_readonly_exact_text_speed_no_key_unchecked_box_and_default_cancel(qapp):
    plan = AzurePlan((speech("مرحبًا.", speed=0.85),))
    dialog = AzureConsentDialog(plan, "eastus")
    assert dialog.spoken_text.isReadOnly() and dialog.spoken_text.toPlainText() == plan.review_text
    assert (
        "0.85" in dialog.spoken_text.toPlainText() and KEY not in dialog.spoken_text.toPlainText()
    )
    assert not dialog.review_check.isChecked() and not dialog.allow_button.isEnabled()
    assert dialog.cancel_button.isDefault()
    dialog.accept()
    assert dialog.result() != QDialog.DialogCode.Accepted
    dialog.review_check.setChecked(True)
    assert dialog.allow_button.isEnabled()
    dialog.allow_button.click()
    assert dialog.result() == QDialog.DialogCode.Accepted
    dialog.close()


@pytest.mark.parametrize("allow, checkbox", [(False, False), (False, True), (True, False)])
def test_declining_or_unchecked_even_with_accepted_code_cannot_start_a_cloud_job(
    window, monkeypatch, allow, checkbox
):
    enable_azure(window)
    window.editor.setPlainText("مرحبًا.")
    plans = consent_dialog(monkeypatch, allow=allow, checkbox=checkbox)
    sent, jobs = fake_azure(monkeypatch)
    window.preview()
    assert len(plans) == 1 and not sent and not jobs and window.worker is None
    assert not list(Path(window._preview_directory.name).glob("*.wav"))
    assert window._active_azure_job is None


@pytest.mark.parametrize("operation", ["preview", "audio", "combined"])
def test_every_audio_entrypoint_gets_new_consent_and_publishes_without_a_key(
    window, monkeypatch, tmp_path, operation
):
    enable_azure(window)
    window.format_combo.setCurrentIndex(window.format_combo.findData("wav"))
    plans = consent_dialog(monkeypatch)
    sent, jobs = fake_azure(monkeypatch)
    warnings = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: warnings.append(args[-1]))
    monkeypatch.setattr(QMessageBox, "question", lambda *args: QMessageBox.StandardButton.Yes)
    window.editor.setPlainText("مرحبًا.")
    output = tmp_path / ("voice.wav" if operation == "audio" else "with-voice.html")
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *args: (str(output), ""))
    if operation == "preview":
        monkeypatch.setattr(window.player, "play", lambda: None)
        window.preview()
    elif operation == "audio":
        window.generate()
    else:
        window.editor.setPlainText("# UNREAD_HEADING\n## UNREAD_STEP\nمرحبًا.")
        window.generate_whiteboard_with_audio()
    finish(window)
    assert len(plans) == 1 and len(jobs) == 1 and len(sent) == 1 and not warnings
    assert [r.text for r in plans[0][0].requests] == ["مرحبًا."]
    assert plans[0][1] == "eastus" and jobs[0]._credentials is None
    assert all(
        b"PRIVATE_SENTINEL" not in req.data and b"UNREAD_HEADING" not in req.data for req in sent
    )
    if operation != "preview":
        assert output.exists() and KEY.encode() not in output.read_bytes()
    if operation == "combined":
        assert WhiteboardPage.load(output, allow_recordings=True).timing is not None
    assert window.azure_picker.key_edit.text() == KEY  # Session only, not a saved setting.


def test_repeated_preview_cannot_reuse_old_consent_or_request_ledger(window, monkeypatch):
    enable_azure(window)
    window.editor.setPlainText("مرحبًا.")
    monkeypatch.setattr(window.player, "play", lambda: None)
    plans = consent_dialog(monkeypatch)
    sent, jobs = fake_azure(monkeypatch)
    for _ in range(2):
        window.preview()
        finish(window)
    assert len(plans) == len(jobs) == len(sent) == 2
    assert jobs[0] is not jobs[1] and all(job._credentials is None for job in jobs)


@pytest.mark.parametrize(
    "change", ["editor", "key", "region", "voice", "speed", "mode", "policy", "forget"]
)
def test_context_changed_during_cloud_review_invalidates_consent_before_send(
    window, monkeypatch, change
):
    picker = enable_azure(window)
    window.editor.setPlainText("مرحبًا.")
    changes = {
        "editor": lambda: window.editor.setPlainText("نص آخر."),
        "key": lambda: picker.key_edit.setText(KEY + "x"),
        "region": lambda: picker.region_edit.setText("westeurope"),
        "voice": lambda: picker.first_voice.setCurrentIndex(1),
        "speed": lambda: window.speed_slider.setValue(85),
        "mode": lambda: window.mode_combo.setCurrentIndex(1),
        "policy": lambda: window.scene_picker.policy.setCurrentIndex(1),
        "forget": picker.forget,
    }
    plans = consent_dialog(monkeypatch, during=changes[change])
    sent, jobs = fake_azure(monkeypatch)
    warnings = []
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: warnings.append(args[-1]))
    window.preview()
    assert plans and warnings and not sent and not jobs
    assert window.worker is None and window._active_azure_job is None


@pytest.mark.parametrize("operation", ["audio", "combined"])
def test_cancel_save_never_opens_cloud_consent_or_sends(window, monkeypatch, tmp_path, operation):
    enable_azure(window)
    window.editor.setPlainText("مرحبًا.")
    plans = consent_dialog(monkeypatch)
    sent, jobs = fake_azure(monkeypatch)
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *args: ("", ""))
    if operation == "audio":
        window.generate()
    else:
        window.generate_whiteboard_with_audio()
    assert not plans and not sent and not jobs and window.worker is None


def test_sacred_policy_blocks_even_forced_preview_before_consent(window, monkeypatch):
    enable_azure(window)
    window.editor.setPlainText("نص محلي للمراجعة.")
    window.scene_picker.policy.setCurrentIndex(1)
    assert not window.preview_button.isEnabled() and not window.combined_board_button.isEnabled()
    plans = consent_dialog(monkeypatch)
    sent, jobs = fake_azure(monkeypatch)
    monkeypatch.setattr(QMessageBox, "warning", lambda *args: None)
    window.preview()
    assert not plans and not sent and not jobs and window.worker is None


def test_full_lesson_adoption_never_inherits_audio_or_cloud_consent(window, monkeypatch):
    enable_azure(window)
    plans = consent_dialog(monkeypatch)
    sent, jobs = fake_azure(monkeypatch)
    draft = adopt(window, monkeypatch, approve=False)
    assert not window.preview_button.isEnabled() and not window.combined_board_button.isEnabled()
    assert not plans and not sent and not jobs
    window.scene_picker._approve()
    assert window._input()[0] == draft.compile().spoken_script
    assert not plans and not sent and not jobs and window.worker is None


def test_silent_board_export_never_opens_cloud_consent_or_sends(window, monkeypatch, tmp_path):
    enable_azure(window)
    window.editor.setPlainText("# درس\nمرحبًا.")
    output = tmp_path / "silent.html"
    monkeypatch.setattr(QFileDialog, "getSaveFileName", lambda *args: (str(output), ""))
    plans = consent_dialog(monkeypatch)
    sent, jobs = fake_azure(monkeypatch)
    window.generate_whiteboard()
    finish(window)
    assert output.exists() and not plans and not sent and not jobs
    assert WhiteboardPage.load(output).timing is None


def test_local_preferences_keep_local_paths_only_and_restart_is_local(
    window, voice_files, monkeypatch
):
    native.add_test_voice(window, voice_files)
    local = window.selected_voice()
    enable_azure(window)
    directory = window.data_dir
    window.cleanup()
    saved = (directory / "settings.json").read_text(encoding="utf-8")
    assert KEY not in saved and "azure" not in saved.lower() and "eastus" not in saved
    assert window.preferences.voice_path == str(local.model_path)
    assert not window.azure_picker.key_edit.text()
    again = MainWindow(directory)
    assert again.provider_combo.currentData() == "local" and not again.azure_picker.key_edit.text()
    again.close()


def test_bounded_source_hash_rejects_arbitrarily_grown_source_before_consent(
    window, tmp_path, monkeypatch
):
    source = tmp_path / "source.html"
    source.write_bytes(b"x" * 33)
    monkeypatch.setattr("nova_voice.ui.MAX_HTML_BYTES", 32)
    with pytest.raises(AzureError):
        window._cloud_source_hash(source)
