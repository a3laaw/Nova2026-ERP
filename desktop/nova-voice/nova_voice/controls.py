"""Shared native controls, with a bounded model picker and plain-text labels."""

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QComboBox, QFrame, QLabel, QPushButton, QVBoxLayout


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
    widget = QComboBox()
    widget.setMaxVisibleItems(8)
    widget.view().setMaximumHeight(300)
    widget.setMinimumContentsLength(10)
    widget.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
    return widget


def clock(milliseconds: int) -> str:
    seconds = max(0, milliseconds // 1000)
    return f"{seconds // 60:02d}:{seconds % 60:02d}"
