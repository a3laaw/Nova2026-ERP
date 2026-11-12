"""Nova's warm palette, adapted to native desktop widgets."""

STYLESHEET = """
QMainWindow, QScrollArea, QWidget#canvas { background: #F8FAFC; color: #1E293B; }
QWidget { font-family: 'Segoe UI', 'Tahoma', sans-serif; font-size: 13px; color: #1E293B; }
QLabel { background: transparent; }
QLabel#title { font-size: 24px; font-weight: 700; }
QLabel#headline { font-size: 19px; font-weight: 600; }
QLabel#section { font-size: 15px; font-weight: 600; }
QLabel#muted { color: #64748B; }
QLabel#privacy { color: #2563EB; background: #EFF6FF; border-radius: 12px; padding: 9px 14px; }
QLabel#setup { background: #FCE4EC; color: #475569; padding: 14px; border-radius: 16px; }
QFrame#card { background: #FFFFFF; border: 2px solid #F1F5F9; border-radius: 24px; }
QPlainTextEdit { background: #F8FAFC; border: 2px solid #F1F5F9; border-radius: 16px;
  padding: 14px; selection-background-color: #FFE2A3; font-size: 16px; }
QPlainTextEdit:focus { border-color: #FFB000; }
QPushButton { min-height: 36px; padding: 0 14px; background: #FFFFFF; border: 2px solid #E2E8F0;
  border-radius: 12px; font-size: 13px; font-weight: 600; }
QPushButton:hover { background: #FFF7E0; border-color: #FFB000; }
QPushButton:focus { border-color: #FF5722; }
QPushButton:pressed { background: #FCE4EC; }
QPushButton:disabled { color: #94A3B8; background: #F1F5F9; border-color: #E2E8F0; }
QPushButton#primary { background: #FFB000; border: 0; border-bottom: 4px solid #FF5722;
  color: #1E293B; font-weight: 700; }
QPushButton#primary:hover { background: #FFC137; }
QPushButton#primary:focus { border-bottom-color: #C2410C; }
QPushButton#primary:disabled { background: #F1F5F9; border-bottom-color: #E2E8F0; color: #94A3B8; }
QPushButton#cancel { border-color: #FF5722; color: #C2410C; }
QPushButton#scene-toggle { background: #FFB000; border: 0; border-bottom: 5px solid #FF5722;
  border-radius: 16px; color: #1E293B; font-weight: 800; font-size: 17px; min-height: 54px; }
QPushButton#scene-toggle:hover { background: #FFC137; }
QPushButton#scene-toggle:checked { background: #FF5722; color: #FFFFFF;
  border-bottom-color: #C2410C; }
QPushButton#disclosure-toggle { background: #F8FAFC; color: #475569; text-align: right; }
QPushButton#disclosure-toggle:checked { background: #FFF7E0; border-color: #FFB000; }
QFrame#disclosure { background: transparent; border: none; }
QComboBox, QSpinBox, QLineEdit { min-height: 36px; background: #F8FAFC; border: 2px solid #E2E8F0;
  border-radius: 12px; padding: 0 10px;
  selection-background-color: #FFE2A3; selection-color: #1E293B; }
QComboBox:focus, QSpinBox:focus, QLineEdit:focus { border-color: #FFB000; }
QComboBox QAbstractItemView { background: #FFFFFF; selection-background-color: #FFF1C2;
  selection-color: #1E293B; border: 1px solid #E2E8F0; padding: 6px; }
QCheckBox { spacing: 8px; min-height: 28px; padding: 2px 0; }
QSlider::groove:horizontal { height: 6px; background: #E2E8F0; border-radius: 3px; }
QSlider::sub-page:horizontal { background: #FFB000; border-radius: 3px; }
QSlider::handle:horizontal { width: 16px; height: 16px; margin: -5px 0;
  background: #FFB000; border: 2px solid #FF5722; border-radius: 9px; }
QTabWidget::pane { border: none; background: transparent; }
QTabBar::tab { background: #F1F5F9; color: #475569; padding: 8px 14px; margin: 2px;
  border-radius: 10px; }
QTabBar::tab:selected { background: #FFB000; color: #1E293B; }
QProgressBar { background: #F1F5F9; border: none; border-radius: 6px;
  text-align: center; min-height: 14px; font-size: 11px; }
QProgressBar::chunk { background: #FFB000; border-radius: 6px; }
QToolTip { background: #FFF7E0; color: #1E293B; border: 1px solid #FFB000; padding: 6px; }
QTableWidget { background: #FFFFFF; border: 2px solid #F1F5F9; border-radius: 16px;
  gridline-color: #F1F5F9; selection-background-color: #FFF1C2; selection-color: #1E293B;
  font-size: 13px; padding: 4px; }
QTableWidget::item { padding: 6px 10px; }
QHeaderView::section { background: #FFF7E0; color: #1E293B; border: 0;
  border-bottom: 2px solid #F1F5F9;
  padding: 8px 10px; font-size: 12px; font-weight: 700; }
QHeaderView::section:hover { background: #FFE9B8; }
QTableCornerButton::section { background: #FFF7E0; border: 0; border-bottom: 2px solid #F1F5F9; }
QScrollBar:vertical { background: transparent; width: 12px; margin: 4px 0; }
QScrollBar::handle:vertical { background: #E2E8F0; border-radius: 6px; min-height: 24px; }
QScrollBar::handle:vertical:hover { background: #CBD5E1; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
QMessageBox, QFileDialog { background: #F8FAFC; }
"""
