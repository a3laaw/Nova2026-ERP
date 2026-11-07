"""Application entry point; imports of native/GUI dependencies stay here."""

import argparse
import logging
import sys
from logging.handlers import RotatingFileHandler

from .storage import user_data_dir


def smoke_test_resources() -> None:
    """Used by Windows CI to catch missing bundled native libraries/data, offline."""
    import lameenc
    import onnxruntime
    from piper.phonemize_espeak import EspeakPhonemizer
    from piper.tashkeel import TashkeelDiacritizer

    onnxruntime.disable_telemetry_events()
    assert EspeakPhonemizer().phonemize("en-us", "Local speech test.")
    assert TashkeelDiacritizer()("مرحبا بالعالم")
    from .pcm import resample_pcm16

    assert len(resample_pcm16(bytes(4410), 22050, 24000)) == 4800
    from .html_export import _controller_source

    assert "__NOVA_PLAYER_CSS__" not in _controller_source()
    from .whiteboard import parse_lesson, whiteboard_html

    assert "nova-whiteboard-data" in whiteboard_html(parse_lesson("Offline whiteboard test."))
    encoder = lameenc.Encoder()
    encoder.set_in_sample_rate(22050)
    encoder.set_channels(1)
    encoder.silence()
    assert encoder.encode(bytes(4410)) + encoder.flush()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Nova Voice offline desktop")
    parser.add_argument("--smoke-test", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    try:
        data = user_data_dir()
        data.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            data / "app.log", maxBytes=512_000, backupCount=2, encoding="utf-8"
        )
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
        logging.basicConfig(level=logging.WARNING, handlers=[handler])
        from PySide6.QtCore import Qt, QTimer
        from PySide6.QtGui import QFont
        from PySide6.QtWidgets import QApplication

        from .ui import MainWindow

        app = QApplication([sys.argv[0]])
        app.setApplicationName("Nova Voice")
        app.setOrganizationName("NovaVoice")
        app.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        app.setFont(QFont("Segoe UI", 10))
        window = MainWindow(data)
        if args.smoke_test:
            smoke_test_resources()
            QTimer.singleShot(200, window.close)
        window.show()
        return app.exec()
    except Exception:
        logging.getLogger(__name__).exception("Application could not start")
        print(
            "Nova Voice could not start. Check %LOCALAPPDATA%\\NovaVoice\\app.log.", file=sys.stderr
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
