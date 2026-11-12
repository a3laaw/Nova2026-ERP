"""Shared native controls, with a bounded model picker and plain-text labels."""

from PySide6.QtCore import Qt
from PySide6.QtGui import QWheelEvent
from PySide6.QtWidgets import QComboBox, QFrame, QLabel, QPushButton, QSlider, QSpinBox, QVBoxLayout


class NoWheelComboBox(QComboBox):
    """Combo that never changes value through the mouse wheel (only click/keys)."""

    def wheelEvent(self, event: QWheelEvent) -> None:
        event.ignore()


class NoWheelSpinBox(QSpinBox):
    """Spin box that never changes value through the mouse wheel."""

    def wheelEvent(self, event: QWheelEvent) -> None:
        event.ignore()


class NoWheelSlider(QSlider):
    """Slider that never changes value through the mouse wheel."""

    def wheelEvent(self, event: QWheelEvent) -> None:
        event.ignore()


def label(text: str, role: str = "", wrap: bool = False) -> QLabel:
    widget = QLabel(text)
    widget.setTextFormat(Qt.TextFormat.PlainText)
    if role:
        widget.setObjectName(role)
    widget.setWordWrap(wrap)
    return widget


def button(text: str, role: str = "") -> QPushButton:
    widget = QPushButton(text)
    widget.setFixedHeight(48 if role == "primary" else 40)
    widget.setCursor(Qt.CursorShape.PointingHandCursor)
    if role:
        widget.setObjectName(role)
    return widget


def card() -> tuple[QFrame, QVBoxLayout]:
    frame = QFrame()
    frame.setObjectName("card")
    layout = QVBoxLayout(frame)
    layout.setContentsMargins(22, 22, 22, 22)
    layout.setSpacing(14)
    return frame, layout


def combo() -> QComboBox:
    widget = NoWheelComboBox()
    widget.setMaxVisibleItems(8)
    widget.view().setMaximumHeight(300)
    widget.setMinimumContentsLength(10)
    widget.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
    return widget


def clock(milliseconds: int) -> str:
    seconds = max(0, milliseconds // 1000)
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


class Disclosure(QFrame):
    """Keyboard-accessible native disclosure; hiding never resets its controls."""

    def __init__(self, title: str, parent=None):
        super().__init__(parent)
        self.setObjectName("disclosure")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)
        self.toggle_button = button(title, "disclosure-toggle")
        self.toggle_button.setCheckable(True)
        self.toggle_button.setAccessibleName(title)
        layout.addWidget(self.toggle_button)
        self.content = QFrame()
        self.content_layout = QVBoxLayout(self.content)
        self.content_layout.setContentsMargins(4, 6, 4, 4)
        self.content_layout.setSpacing(12)
        layout.addWidget(self.content)
        self.content.hide()
        self.toggle_button.toggled.connect(self.content.setVisible)

    def set_expanded(self, expanded: bool) -> None:
        self.toggle_button.setChecked(expanded)
