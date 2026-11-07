"""Qt worker boundary; the synthesis layer has no dependency on Qt."""

import errno
import logging
from collections.abc import Callable
from threading import Event
from typing import Any

from PySide6.QtCore import QThread, Signal

from .engine import AudioError
from .html_export import HtmlExportError
from .text import ScriptError
from .voices import Cancelled, VoiceError


class TaskWorker(QThread):
    progress = Signal(int)
    succeeded = Signal(object)
    cancelled = Signal()
    failed = Signal(str)

    def __init__(self, task: Callable[[Event, Callable[[int], None]], Any], parent=None):
        super().__init__(parent)
        self.task = task
        self.cancel_event = Event()

    def run(self) -> None:
        try:
            self.succeeded.emit(self.task(self.cancel_event, self.progress.emit))
        except Cancelled:
            self.cancelled.emit()
        except PermissionError:
            self.failed.emit(
                "لا يمكن الكتابة إلى هذا المسار. اختر مجلدًا آخر وأغلق الملف إن كان مفتوحًا."
            )
        except (AudioError, ScriptError, VoiceError, HtmlExportError) as error:
            self.failed.emit(str(error))
        except OSError as error:
            if error.errno == errno.ENOSPC:
                self.failed.emit("لا توجد مساحة كافية على القرص لحفظ الصوت.")
            else:
                self.failed.emit("تعذّر الوصول إلى الملف. تأكد من وجوده ومن صلاحيات المجلد.")
        except Exception:
            logging.getLogger(__name__).exception("Local background operation failed")
            self.failed.emit(
                "تعذّر إتمام العملية. جرّب نموذجًا آخر وراجع سجل التطبيق إذا استمرت المشكلة."
            )
