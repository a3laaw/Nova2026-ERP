"""Native: wheel never changes Nova option controls (owner-reported Piper←Azure flip)."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("PySide6.QtWidgets", exc_type=ImportError)
pytest.importorskip("PySide6.QtGui")

from PySide6.QtCore import QPoint, QPointF, Qt  # noqa: E402
from PySide6.QtGui import QWheelEvent  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from nova_voice.controls import NoWheelComboBox, NoWheelSlider, NoWheelSpinBox, combo  # noqa: E402


@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance() or QApplication([])
    yield app


def wheel(widget):
    position = QPointF(widget.rect().center()).toPoint()
    event = QWheelEvent(
        QPointF(position),
        QPointF(position),
        QPoint(0, 0),
        QPoint(0, 120),
        Qt.MouseButton.NoButton,
        Qt.KeyboardModifier.NoModifier,
        Qt.ScrollPhase.NoScrollPhase,
        False,
    )
    widget.wheelEvent(event)


def test_combo_factory_ignores_wheel(qapp):
    widget = combo()
    widget.addItem("محلي", "local")
    widget.addItem("أزور", "azure")
    assert widget.currentData() == "local"
    wheel(widget)
    assert widget.currentData() == "local"


def test_combo_class_ignores_wheel_even_with_focus_like_parents(qapp):
    widget = NoWheelComboBox()
    for label in ("أ", "ب", "ج"):
        widget.addItem(label)
    widget.setCurrentIndex(0)
    wheel(widget)
    wheel(widget)
    assert widget.currentIndex() == 0


def test_spin_box_ignores_wheel(qapp):
    widget = NoWheelSpinBox()
    widget.setRange(0, 1000)
    widget.setValue(250)
    wheel(widget)
    assert widget.value() == 250


def test_slider_ignores_wheel(qapp):
    widget = NoWheelSlider(Qt.Orientation.Horizontal)
    widget.setRange(60, 160)
    widget.setValue(100)
    wheel(widget)
    assert widget.value() == 100
