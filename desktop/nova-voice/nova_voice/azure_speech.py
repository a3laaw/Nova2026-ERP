"""Explicit-consent, bounded real-time Azure TTS. No SDK, persistence or paid fallback.

A Speech key cannot prove the resource's SKU. F0 is a user attestation, never a
billing guarantee. Tests inject transport; this module never connects on import.
"""

import math
import re
import ssl
import time
from collections import deque
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from threading import Event, Lock, RLock
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from xml.sax.saxutils import escape

from .text import MAX_CHARACTERS
from .voices import Cancelled, VoiceError, check_cancelled

KEY_TTL_SECONDS = 30 * 60
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
MAX_REQUEST_CHARACTERS = 480
TIMEOUT_SECONDS = 15
RESPONSE_DEADLINE_SECONDS = 45
VOICE_DATA = {
    "ar-EG-SalmaNeural": ("سلمى · مصر", "ar-EG", "العربية"),
    "ar-EG-ShakirNeural": ("شاكر · مصر", "ar-EG", "العربية"),
    "en-GB-SoniaNeural": ("Sonia · UK", "en-GB", "English"),
    "en-GB-RyanNeural": ("Ryan · UK", "en-GB", "English"),
}


class AzureError(VoiceError):
    """Sanitized user message; never include a key, HTTP body or inner exception."""


@dataclass(frozen=True)
class AzureVoice:
    voice_id: str

    def __post_init__(self):
        if not isinstance(self.voice_id, str) or self.voice_id not in VOICE_DATA:
            raise AzureError("اختر صوت Azure Neural عاديًا من القائمة المراجعة.")

    @property
    def language_code(self) -> str:
        return VOICE_DATA[self.voice_id][1]

    @property
    def language_family(self) -> str:
        return self.language_code.split("-")[0]

    @property
    def language(self) -> str:
        return VOICE_DATA[self.voice_id][2]

    @property
    def label(self) -> str:
        return f"{VOICE_DATA[self.voice_id][0]} · Azure Neural · سحابي"

    @property
    def sample_rate(self) -> int:
        return 24000

    @property
    def num_speakers(self) -> int:
        return 1


AZURE_VOICES = tuple(AzureVoice(name) for name in VOICE_DATA)


def validate_region(value: str) -> str:
    if not isinstance(value, str):
        raise AzureError("اكتب رمز منطقة مورد Speech، مثل eastus، وليس رابطًا.")
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z][a-z0-9]{2,39}", value):
        raise AzureError("اكتب رمز المنطقة كما يظهر في Azure؛ لا رابط أو مسار أو مسافات.")
    return value


@dataclass(frozen=True)
class AzureCredentials:
    key: str = field(repr=False)
    region: str
    f0_confirmed: bool
    expires_at: float = field(default_factory=lambda: time.monotonic() + KEY_TTL_SECONDS)

    def __post_init__(self):
        if not isinstance(self.key, str) or not re.fullmatch(r"[A-Za-z0-9_+/=-]{32,256}", self.key):
            raise AzureError("أدخل مفتاح مورد Speech الصحيح محليًا؛ لا تلصقه في السكريبت.")
        object.__setattr__(self, "region", validate_region(self.region))
        if self.f0_confirmed is not True:
            raise AzureError("تحقق من أن مورد Speech هو Free F0 وأكّد ذلك؛ المفتاح لا يثبت الفئة.")
        if type(self.expires_at) not in (int, float) or not math.isfinite(self.expires_at):
            raise AzureError("جلسة مفتاح Azure غير صالحة.")

    @property
    def endpoint(self) -> str:
        return f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"


@dataclass(frozen=True)
class CloudRequest:
    voice: AzureVoice
    text: str = field(repr=False)
    speed: float = 1.0

    def __post_init__(self):
        if not isinstance(self.voice, AzureVoice):
            raise AzureError("صوت Azure غير صالح.")
        if (
            not isinstance(self.text, str)
            or not self.text.strip()
            or len(self.text) > MAX_REQUEST_CHARACTERS
            or not any(c.isalnum() for c in self.text)
            or any(ord(c) < 32 and c not in "\n\t\r" for c in self.text)
            or any(0xD800 <= ord(c) <= 0xDFFF or ord(c) in (0xFFFE, 0xFFFF) for c in self.text)
        ):
            raise AzureError("مقطع Azure فارغ أو غير صالح أو تجاوز الحد الآمن.")
        if type(self.speed) not in (int, float) or not 0.6 <= self.speed <= 1.6:
            raise AzureError("اختر سرعة بين 0.60 و1.60.")

    def ssml(self) -> bytes:
        percent = f"{(self.speed - 1) * 100:+.6f}".rstrip("0").rstrip(".")
        return (
            '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
            f'xml:lang="{self.voice.language_code}"><voice name="{self.voice.voice_id}">'
            f'<prosody rate="{percent}%">{escape(self.text)}</prosody></voice></speak>'
        ).encode()


@dataclass(frozen=True)
class AzurePlan:
    requests: tuple[CloudRequest, ...] = field(repr=False)

    def __post_init__(self):
        if (
            type(self.requests) is not tuple
            or not self.requests
            or len(self.requests) > 1000
            or any(not isinstance(request, CloudRequest) for request in self.requests)
            or self.characters > MAX_CHARACTERS
        ):
            raise AzureError("خطة إرسال Azure غير صالحة أو كبيرة جدًا.")

    @property
    def characters(self) -> int:
        return sum(len(request.text) for request in self.requests)

    @property
    def review_text(self) -> str:
        return "\n\n".join(
            f"{index} · {request.voice.label} · سرعة {request.speed:.2f}×\n{request.text}"
            for index, request in enumerate(self.requests, 1)
        )


class RateLimiter:
    """20 attempted requests / 60 seconds in this process, not an account quota meter."""

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self.attempts: deque[float] = deque()
        self.lock = Lock()

    def wait(self, cancel: Event) -> None:
        while True:
            check_cancelled(cancel)
            with self.lock:
                now = self.clock()
                while self.attempts and self.attempts[0] <= now - 60:
                    self.attempts.popleft()
                if len(self.attempts) < 20:
                    self.attempts.append(now)
                    return
                delay = max(0.01, min(0.2, 60 - now + self.attempts[0]))
            cancel.wait(delay)


_RATE_LIMITER = RateLimiter()


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise HTTPError(request.full_url, code, "Redirect refused", headers, fp)


def _http_message(code: int) -> str:
    if code in (401, 403):
        return "رفض Azure المفتاح أو المورد أو المنطقة؛ راجع إعدادات F0. لا تحويل مدفوع."
    if code == 429:
        return "بلغ Azure حد معدل الطلبات أو الحصة؛ توقفت العملية بلا إعادة تلقائية أو ترقية."
    if code in (301, 302, 303, 307, 308):
        return "رفض البرنامج إعادة توجيه طلب Azure لحماية المفتاح."
    return "لم يقبل Azure طلب الصوت؛ توقفت العملية دون إعادة أو تحويل إلى مزود آخر."


def _post(request: Request, cancel: Event) -> bytes:
    """Microsoft HTTPS only; no proxy, redirect, retry or response-body logging.

    read1 returns after one buffered/socket read, so a slow trickle cannot keep a
    full read(n) alive indefinitely. Cancellation/deadline checks are between reads;
    an in-flight socket operation can still take the 15-second I/O timeout.
    """
    from urllib.request import HTTPSHandler

    check_cancelled(cancel)
    endpoint = urlsplit(request.full_url)
    if (
        endpoint.scheme != "https"
        or not re.fullmatch(r"[a-z][a-z0-9]{2,39}\.tts\.speech\.microsoft\.com", endpoint.netloc)
        or endpoint.path != "/cognitiveservices/v1"
        or endpoint.query
        or endpoint.fragment
    ):
        raise AzureError("عنوان Azure غير مسموح؛ لم يُرسل المفتاح.")
    try:
        opener = build_opener(
            ProxyHandler({}), _NoRedirect(), HTTPSHandler(context=ssl.create_default_context())
        )
        deadline = time.monotonic() + RESPONSE_DEADLINE_SECONDS
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise AzureError(_http_message(response.status))
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if not (
                content_type.startswith("audio/") or content_type == "application/octet-stream"
            ):
                raise AzureError("لم يُعد Azure تنسيق صوت صالحًا؛ لم تُستخدم الاستجابة.")
            length = response.headers.get("Content-Length")
            if length is not None and (
                not re.fullmatch(r"[0-9]{1,10}", length.strip()) or int(length) > MAX_RESPONSE_BYTES
            ):
                raise AzureError("حجم استجابة Azure غير صالح أو تجاوز الحد الآمن.")
            parts = []
            total = 0
            while True:
                check_cancelled(cancel)
                if time.monotonic() >= deadline:
                    raise AzureError("انتهت مهلة قراءة صوت Azure؛ لا إعادة تلقائية.")
                piece = response.read1(min(65536, MAX_RESPONSE_BYTES + 1 - total))
                check_cancelled(cancel)
                if time.monotonic() >= deadline:
                    raise AzureError("انتهت مهلة قراءة صوت Azure؛ لا إعادة تلقائية.")
                if not piece:
                    break
                total += len(piece)
                if total > MAX_RESPONSE_BYTES:
                    raise AzureError("تجاوزت استجابة Azure حد الصوت الآمن؛ لم تُستخدم.")
                parts.append(piece)
            if length is not None and total != int(length):
                raise AzureError("لم تكتمل استجابة صوت Azure؛ لم تُستخدم.")
            return b"".join(parts)
    except HTTPError as error:
        code = error.code
        error.close()
        raise AzureError(_http_message(code)) from None
    except (AzureError, Cancelled):
        raise
    except Exception:
        check_cancelled(cancel)
        raise AzureError("تعذر الاتصال الآمن بـAzure أو انتهت المهلة؛ لا إعادة تلقائية.") from None


class _Cancellation:
    """Observe UI cancellation AND key revocation, without blocking the UI thread."""

    def __init__(self, external: Event, revoked: Event):
        self.external = external
        self.revoked = revoked

    def is_set(self) -> bool:
        return self.external.is_set() or self.revoked.is_set()

    def wait(self, timeout: float) -> bool:
        deadline = time.monotonic() + timeout
        while not self.is_set():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            self.revoked.wait(min(0.1, remaining))
        return self.is_set()


@dataclass(frozen=True)
class AzureChunk:
    audio_int16_bytes: bytes = field(repr=False)
    sample_rate: int = 24000
    sample_width: int = 2
    sample_channels: int = 1


class AzureJob:
    """One ordered consent ledger across all clips/rows of one explicit UI operation."""

    def __init__(
        self,
        plan: AzurePlan,
        credentials: AzureCredentials,
        *,
        consent: bool = False,
        policy: str = "general",
        _transport: Callable = _post,
        _limiter: RateLimiter = _RATE_LIMITER,
        _clock: Callable[[], float] = time.monotonic,
    ):
        if consent is not True or policy != "general":
            raise AzureError("إرسال Azure يحتاج موافقة صريحة، ولا يسمح في وضع النصوص المقدسة.")
        if not isinstance(plan, AzurePlan) or not isinstance(credentials, AzureCredentials):
            raise AzureError("خطة Azure أو بياناتها غير صالحة.")
        self._plan: AzurePlan | None = plan
        self._credentials: AzureCredentials | None = credentials
        self._index = 0
        self._transport = _transport
        self._limiter = _limiter
        self._clock = _clock
        self._lock = RLock()
        self._revoked = Event()
        self._check()
        if credentials.key in "".join(request.text for request in plan.requests):
            self.close()
            raise AzureError("يوجد مفتاح Azure في النص؛ احذفه من السكريبت قبل أي إرسال.")

    def _check(self) -> None:
        if self._revoked.is_set() or self._plan is None or self._credentials is None:
            raise AzureError("انتهى إذن Azure لهذه العملية؛ راجع النص ووافق مجددًا.")
        if self._clock() >= self._credentials.expires_at:
            self.close()
            raise AzureError("انتهت جلسة مفتاح Azure بعد30دقيقة؛ أدخله وراجع الإرسال مجددًا.")

    def preflight(self, requests: tuple[CloudRequest, ...], *, complete: bool = False) -> None:
        with self._lock:
            self._check()
            if (
                not requests
                or self._plan.requests[self._index : self._index + len(requests)] != requests
                or (complete and self._index + len(requests) != len(self._plan.requests))
            ):
                raise AzureError(
                    "تغير النص أو الصوت أو السرعة بعد الموافقة؛ لم يُرسل الطلب المختلف."
                )

    def synthesize(self, request: CloudRequest, cancel: Event) -> Iterator[AzureChunk]:
        combined = _Cancellation(cancel, self._revoked)
        credentials = None
        http_request = None
        try:
            check_cancelled(cancel)
            self.preflight((request,))
            self._limiter.wait(combined)
            check_cancelled(combined)
            with self._lock:
                self.preflight((request,))
                credentials = self._credentials
                # Reservation is the dispatch boundary. Revocation cannot recall
                # an already-dispatched HTTPS request, but cancels its remaining work.
                self._index += 1
            http_request = Request(
                credentials.endpoint,
                data=request.ssml(),
                method="POST",
                headers={
                    "Ocp-Apim-Subscription-Key": credentials.key,
                    "Content-Type": "application/ssml+xml; charset=utf-8",
                    "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm",
                    "User-Agent": "NovaVoice-Optional-Azure-TTS",
                },
            )
            check_cancelled(combined)
            pcm = self._transport(http_request, combined)
            check_cancelled(combined)
            with self._lock:
                self._check()
            # Raw PCM has no magic signature: any byte prefix can be genuine audio.
            # MIME/format negotiation, byte bounds/alignment and non-silence are
            # structural checks, NOT proof of sample rate, speech or pronunciation.
            if (
                not isinstance(pcm, bytes)
                or not pcm
                or len(pcm) % 2
                or len(pcm) > MAX_RESPONSE_BYTES
                or not any(pcm)
            ):
                raise AzureError("أعاد Azure بيانات صوت غير صالحة؛ لم تُنشر النتيجة.")
            for start in range(0, len(pcm), 65536):
                check_cancelled(combined)
                yield AzureChunk(pcm[start : start + 65536])
        except (AzureError, Cancelled):
            self.close()
            raise
        except Exception:
            self.close()
            check_cancelled(cancel)
            raise AzureError("تعذرت عملية Azure؛ لا إعادة تلقائية أو تبديل صوت خفي.") from None
        except GeneratorExit:
            self.close()
            raise
        finally:
            credentials = None
            http_request = None

    def close(self) -> None:
        # Drop references, not a claim of secure memory zeroization. An in-flight
        # HTTPS request may still complete and consume quota; no future request is authorized.
        self._revoked.set()
        with self._lock:
            self._credentials = None
            self._plan = None
