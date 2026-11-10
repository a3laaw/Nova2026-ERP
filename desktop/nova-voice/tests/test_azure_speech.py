"""Offline Azure contract tests; dummy keys and injected HTTP, never real Azure."""

import io
import ssl
import time
from dataclasses import replace
from threading import Event, Thread
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.request import Request
from xml.etree import ElementTree

import pytest

from nova_voice import azure_speech as azure
from nova_voice.azure_speech import (
    AZURE_VOICES,
    KEY_TTL_SECONDS,
    MAX_REQUEST_CHARACTERS,
    MAX_RESPONSE_BYTES,
    AzureCredentials,
    AzureError,
    AzureJob,
    AzurePlan,
    AzureVoice,
    CloudRequest,
    RateLimiter,
    validate_region,
)
from nova_voice.voices import Cancelled

KEY = "TEST_ONLY_" + "x" * 40
SALMA, SHAKIR, SONIA, RYAN = AZURE_VOICES
PCM = b"\x10\x27\xf0\xd8" * 1200  # Diagnostic square wave, not synthesized speech.


class NoWait:
    def wait(self, cancel):
        assert not cancel.is_set()


def make_job(requests, **kwargs):
    return AzureJob(
        AzurePlan(tuple(requests)),
        kwargs.pop("credentials", AzureCredentials(KEY, "eastus", True)),
        consent=kwargs.pop("consent", True),
        _transport=kwargs.pop("_transport", lambda request, cancel: PCM),
        _limiter=kwargs.pop("_limiter", NoWait()),
        **kwargs,
    )


def speech(text="مرحبًا.", voice=SALMA, speed=1.0):
    return CloudRequest(voice, text, speed)


def test_curated_ordinary_neural_voices_are_not_fake_piper_paths():
    assert [v.voice_id for v in AZURE_VOICES] == [
        "ar-EG-SalmaNeural",
        "ar-EG-ShakirNeural",
        "en-GB-SoniaNeural",
        "en-GB-RyanNeural",
    ]
    assert [v.language_family for v in AZURE_VOICES] == ["ar", "ar", "en", "en"]
    for voice in AZURE_VOICES:
        assert voice.sample_rate == 24000 and voice.num_speakers == 1
        assert "Azure" in voice.label and not hasattr(voice, "model_path")


@pytest.mark.parametrize("bad", [None, [], "", "ar-JO-kareem", "ar-EG-Salma:HDNeural", 'x"/>'])
def test_unknown_or_hd_voice_is_rejected(bad):
    with pytest.raises(AzureError):
        AzureVoice(bad)


@pytest.mark.parametrize("region", ["eastus", "westeurope", "uaenorth", "uksouth", "centralindia"])
def test_only_normalized_regional_microsoft_https_endpoint_is_constructed(region):
    credentials = AzureCredentials(KEY, " " + region.upper() + " ", True)
    assert credentials.region == region
    assert credentials.endpoint == (
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    )


@pytest.mark.parametrize(
    "bad",
    [
        None,
        "",
        "ab",
        "123",
        "east us",
        "eastus.evil.example",
        "https://eastus",
        "../eastus",
        "eastus/",
        "eastus?x=1",
        "eastus@attacker",
        "eastus\r\nX: bad",
        "عربي",
        "a" * 41,
    ],
)
def test_region_cannot_supply_a_host_url_path_or_header(bad):
    with pytest.raises(AzureError):
        validate_region(bad)


@pytest.mark.parametrize("bad", [None, "", "x" * 31, "x" * 257, KEY + "\r\nHeader: x", KEY + " "])
def test_invalid_key_is_not_echoed_or_accepted(bad):
    with pytest.raises(AzureError) as captured:
        AzureCredentials(bad, "eastus", True)
    assert KEY not in str(captured.value)


@pytest.mark.parametrize("confirmed", [False, None, 0, 1, "F0"])
def test_f0_is_explicit_user_attestation_not_an_inferred_key_property(confirmed):
    with pytest.raises(AzureError, match="F0"):
        AzureCredentials(KEY, "eastus", confirmed)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), None, True])
def test_expiration_is_a_finite_monotonic_time(bad):
    with pytest.raises(AzureError):
        AzureCredentials(KEY, "eastus", True, bad)


def test_default_key_lifetime_and_repr_do_not_expose_key_or_text():
    start = time.monotonic()
    credentials = AzureCredentials(KEY, "eastus", True)
    assert start + KEY_TTL_SECONDS <= credentials.expires_at <= time.monotonic() + KEY_TTL_SECONDS
    request = speech("PRIVATE_TEXT_SENTINEL", SONIA)
    assert KEY not in repr(credentials)
    assert "PRIVATE_TEXT_SENTINEL" not in repr(request) + repr(AzurePlan((request,)))


@pytest.mark.parametrize(
    "speed, expected", [(0.6, "-40%"), (0.85, "-15%"), (1, "+0%"), (1.6, "+60%")]
)
def test_ssml_escapes_literal_text_and_uses_exact_voice_locale_and_rate(speed, expected):
    text = 'Hello & <voice name="bad">literal</voice> "quotes".'
    request = speech(text, SONIA, speed)
    root = ElementTree.fromstring(request.ssml())
    ns = "{http://www.w3.org/2001/10/synthesis}"
    assert root.attrib["{http://www.w3.org/XML/1998/namespace}lang"] == "en-GB"
    voice = root.find(ns + "voice")
    assert voice.attrib == {"name": "en-GB-SoniaNeural"}
    prosody = voice.find(ns + "prosody")
    assert prosody.attrib == {"rate": expected} and prosody.text == text
    assert len(list(prosody)) == 0 and b"&amp;" in request.ssml()


@pytest.mark.parametrize(
    "bad",
    [
        None,
        "",
        "  ",
        "؟!",
        "x" * (MAX_REQUEST_CHARACTERS + 1),
        "abc\x00",
        "abc\x01",
        "a\ud800",
        "a\udfff",
        "a\ufffe",
        "a\uffff",
    ],
)
def test_bad_cloud_text_is_rejected_before_transport(bad):
    with pytest.raises(AzureError):
        speech(bad)


@pytest.mark.parametrize("bad", [False, True, "1", None, 0.59, 1.61, float("nan"), float("inf")])
def test_bad_cloud_speed_is_rejected_before_transport(bad):
    with pytest.raises(AzureError):
        speech(speed=bad)


def test_plan_is_nonempty_bounded_immutable_and_review_text_is_not_ssml():
    request = speech()
    plan = AzurePlan((request, speech("أهلًا.", SHAKIR)))
    assert plan.characters == len("مرحبًا.أهلًا.")
    assert "سلمى" in plan.review_text and "شاكر" in plan.review_text
    assert "مرحبًا." in plan.review_text and "<speak" not in plan.review_text
    for bad in (None, [], (), (None,), (request,) * 1001, (speech("a" * 480),) * 209):
        with pytest.raises(AzureError):
            AzurePlan(bad)


@pytest.mark.parametrize(
    "consent, policy",
    [(False, "general"), (None, "general"), (1, "general"), (True, "sacred"), (True, "unknown")],
)
def test_consent_defaults_to_denied_and_sacred_cannot_send(consent, policy):
    with pytest.raises(AzureError):
        make_job([speech()], consent=consent, policy=policy)
    with pytest.raises(AzureError):
        AzureJob(AzurePlan((speech(),)), AzureCredentials(KEY, "eastus", True))


def test_key_pasted_into_spoken_text_is_blocked_without_echoing_it():
    with pytest.raises(AzureError) as captured:
        make_job([speech("Do not send " + KEY, SONIA)])
    assert KEY not in str(captured.value)


@pytest.mark.parametrize("change", ["text", "voice", "speed", "order", "shorter", "extra"])
def test_ordered_ledger_binds_every_reviewed_payload_before_any_dispatch(change):
    first, second = speech(), speech("ثانيًا.", SHAKIR)
    requests = (first, second)
    job = make_job(requests)
    changed = {
        "text": (replace(first, text="نص مختلف."), second),
        "voice": (replace(first, voice=SHAKIR), second),
        "speed": (replace(first, speed=0.85), second),
        "order": (second, first),
        "shorter": (first,),
        "extra": (first, second, first),
    }[change]
    with pytest.raises(AzureError, match="تغير"):
        job.preflight(changed, complete=True)
    assert job._index == 0
    job.preflight(requests, complete=True)
    job.close()


def test_sequential_clips_are_allowed_once_each_and_headers_do_not_contain_text():
    first, second = speech(), speech("Hello.", SONIA, 0.85)
    sent = []
    job = make_job([first, second], _transport=lambda request, cancel: sent.append(request) or PCM)
    job.preflight((first, second), complete=True)
    assert b"".join(c.audio_int16_bytes for c in job.synthesize(first, Event())) == PCM
    job.preflight((second,), complete=True)
    assert b"".join(c.audio_int16_bytes for c in job.synthesize(second, Event())) == PCM
    assert len(sent) == 2
    headers = {k.lower(): v for k, v in sent[0].header_items()}
    assert headers["ocp-apim-subscription-key"] == KEY
    assert headers["x-microsoft-outputformat"] == "raw-24khz-16bit-mono-pcm"
    assert headers["content-type"] == "application/ssml+xml; charset=utf-8"
    assert "مرحبًا" not in repr(headers) and KEY.encode() not in sent[0].data
    with pytest.raises(AzureError):
        list(job.synthesize(second, Event()))
    assert len(sent) == 2 and job._credentials is None


def test_expiry_is_rechecked_before_each_request_and_after_response():
    now = [10.0]
    request = speech()
    calls = []
    credentials = AzureCredentials(KEY, "eastus", True, 20)
    job = make_job([request], credentials=credentials, _clock=lambda: now[0])
    now[0] = 20
    with pytest.raises(AzureError, match="انتهت"):
        list(job.synthesize(request, Event()))
    assert job._credentials is None

    def late_response(request, cancel):
        calls.append(request)
        now[0] = 20
        return PCM

    now[0] = 10
    job = make_job(
        [request], credentials=credentials, _clock=lambda: now[0], _transport=late_response
    )
    with pytest.raises(AzureError, match="انتهت"):
        list(job.synthesize(request, Event()))
    assert len(calls) == 1 and job._plan is None


@pytest.mark.parametrize(
    "data", [b"", b"a", bytes(24), b"x" * (MAX_RESPONSE_BYTES + 2), None, bytearray(PCM)]
)
def test_empty_silent_odd_unbounded_or_nonbytes_audio_is_not_published(data):
    job = make_job([speech()], _transport=lambda *args: data)
    with pytest.raises(AzureError):
        list(job.synthesize(speech(), Event()))
    assert job._credentials is None


@pytest.mark.parametrize("prefix", [b"RIFF", b"{", b'{"error"', b"<html", b"<!DOCTYPE"])
def test_raw_pcm_has_no_magic_and_valid_byte_prefixes_are_not_falsely_rejected(prefix):
    data = prefix + PCM
    data += b"\x01" if len(data) % 2 else b""
    chunks = list(make_job([speech()], _transport=lambda *args: data).synthesize(speech(), Event()))
    assert b"".join(chunk.audio_int16_bytes for chunk in chunks) == data


def test_bounded_pcm_chunks_keep_bytes_and_cancellation_between_chunks():
    data = PCM * 40
    job = make_job([speech()], _transport=lambda *args: data)
    cancel = Event()
    iterator = job.synthesize(speech(), cancel)
    first = next(iterator)
    assert len(first.audio_int16_bytes) == 65536
    assert (first.sample_rate, first.sample_width, first.sample_channels) == (24000, 2, 1)
    cancel.set()
    with pytest.raises(Cancelled):
        next(iterator)
    assert job._plan is None


def test_pre_cancel_and_transport_error_never_retry_or_reuse_credentials():
    calls = []

    def broken(request, cancel):
        calls.append(request)
        raise URLError(KEY + " PRIVATE_HTTP_BODY")

    job = make_job([speech(), speech("أهلًا.")], _transport=broken)
    with pytest.raises(AzureError) as captured:
        list(job.synthesize(speech(), Event()))
    assert KEY not in str(captured.value) and "PRIVATE_HTTP_BODY" not in str(captured.value)
    assert captured.value.__suppress_context__
    with pytest.raises(AzureError):
        list(job.synthesize(speech(), Event()))
    assert len(calls) == 1
    cancel = Event()
    cancel.set()
    job = make_job([speech()], _transport=broken)
    with pytest.raises(Cancelled):
        list(job.synthesize(speech(), cancel))
    assert len(calls) == 1


def test_forgetting_key_cancels_an_inflight_response_and_prevents_all_future_dispatch():
    entered, release = Event(), Event()
    outcomes = []

    def transport(request, cancel):
        entered.set()
        assert release.wait(2)
        return PCM

    job = make_job([speech(), speech("التالي.")], _transport=transport)

    def run():
        try:
            outcomes.extend(job.synthesize(speech(), Event()))
        except Cancelled:
            outcomes.append("cancelled")

    thread = Thread(target=run)
    thread.start()
    assert entered.wait(2)
    job.close()  # Must return immediately without holding the network lock.
    release.set()
    thread.join(2)
    assert not thread.is_alive() and outcomes == ["cancelled"]
    with pytest.raises(AzureError):
        job.preflight((speech("التالي."),))


def test_forgetting_key_interrupts_rate_wait_without_sending_a_request():
    waiting = Event()

    class WaitingLimiter:
        def wait(self, cancel):
            waiting.set()
            while not cancel.wait(0.1):
                pass
            raise Cancelled()

    outcomes = []
    job = make_job([speech()], _limiter=WaitingLimiter())

    def run():
        try:
            list(job.synthesize(speech(), Event()))
        except Cancelled:
            outcomes.append("cancelled")

    thread = Thread(target=run)
    thread.start()
    assert waiting.wait(2)
    job.close()
    thread.join(2)
    assert not thread.is_alive() and job._index == 0 and outcomes == ["cancelled"]


def test_process_limiter_counts_attempts_uses_sliding_window_and_cancellable_wait():
    now = [0.0]
    waits = []
    limiter = RateLimiter(lambda: now[0])

    class ClockEvent:
        def is_set(self):
            return False

        def wait(self, delay):
            waits.append(delay)
            now[0] += delay

    event = ClockEvent()
    for _ in range(20):
        limiter.wait(event)
    assert len(limiter.attempts) == 20 and not waits
    limiter.wait(event)
    assert now[0] >= 60 and len(limiter.attempts) == 1
    for _ in range(19):
        limiter.wait(event)
    cancel = Event()
    cancel.set()
    with pytest.raises(Cancelled):
        limiter.wait(cancel)
    assert len(limiter.attempts) == 20


class FakeResponse:
    def __init__(self, data=PCM, content_type="audio/x-wav", length=None, status=200):
        self.data = io.BytesIO(data)
        self.status = status
        self.headers = {"Content-Type": content_type}
        if length is not None:
            self.headers["Content-Length"] = length
        self.sizes = []
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def read1(self, size):
        self.sizes.append(size)
        return self.data.read(size)


def http_response(monkeypatch, response):
    calls = []

    def build(*handlers):
        calls.append(("handlers", handlers))

        def open(request, timeout):
            calls.append(("open", request, timeout))
            return response

        return SimpleNamespace(open=open)

    monkeypatch.setattr(azure, "build_opener", build)
    return calls


def test_https_transport_disables_proxies_redirects_and_verifies_certificates(monkeypatch):
    response = FakeResponse(content_type="Audio/X-Wav; charset=binary", length=str(len(PCM)))
    calls = http_response(monkeypatch, response)
    request = Request(AzureCredentials(KEY, "eastus", True).endpoint, data=speech().ssml())
    assert azure._post(request, Event()) == PCM
    handlers = calls[0][1]
    assert handlers[0].proxies == {} and isinstance(handlers[1], azure._NoRedirect)
    context = handlers[2]._context
    assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
    assert len(calls) == 2 and calls[1][2] == 15
    assert response.closed and max(response.sizes) <= 65536
    with pytest.raises(HTTPError):
        handlers[1].redirect_request(request, None, 302, KEY, {}, "https://attacker.example")


@pytest.mark.parametrize("mime", ["application/json", "text/html", "", "text/plain"])
def test_wrong_response_mime_is_rejected_without_reading_or_echoing_body(monkeypatch, mime):
    response = FakeResponse(data=(KEY + " private").encode(), content_type=mime)
    http_response(monkeypatch, response)
    with pytest.raises(AzureError) as captured:
        azure._post(Request(AzureCredentials(KEY, "eastus", True).endpoint), Event())
    assert not response.sizes and response.closed and KEY not in str(captured.value)


@pytest.mark.parametrize("length", ["-1", "secret", str(MAX_RESPONSE_BYTES + 1), "999999999999"])
def test_invalid_or_large_content_length_is_rejected_before_read(monkeypatch, length):
    response = FakeResponse(length=length)
    http_response(monkeypatch, response)
    with pytest.raises(AzureError):
        azure._post(Request(AzureCredentials(KEY, "eastus", True).endpoint), Event())
    assert not response.sizes and response.closed


def test_truncated_or_lengthless_oversized_response_fails_without_retry(monkeypatch):
    for response in (
        FakeResponse(length=str(len(PCM) + 1)),
        FakeResponse(b"x" * (MAX_RESPONSE_BYTES + 1)),
    ):
        calls = http_response(monkeypatch, response)
        with pytest.raises(AzureError):
            azure._post(Request(AzureCredentials(KEY, "eastus", True).endpoint), Event())
        assert len(calls) == 2 and response.closed


@pytest.mark.parametrize("code", [301, 302, 303, 307, 308, 400, 401, 403, 404, 429, 500, 503])
def test_http_errors_are_sanitized_closed_and_not_retried(monkeypatch, code):
    body = io.BytesIO((KEY + " private error body").encode())
    calls = []

    def open(*args, **kwargs):
        calls.append(1)
        raise HTTPError("https://eastus.tts.speech.microsoft.com", code, KEY, {}, body)

    monkeypatch.setattr(azure, "build_opener", lambda *args: SimpleNamespace(open=open))
    with pytest.raises(AzureError) as captured:
        azure._post(Request(AzureCredentials(KEY, "eastus", True).endpoint), Event())
    assert KEY not in str(captured.value) and "private error body" not in str(captured.value)
    assert body.closed and len(calls) == 1
    if code == 429:
        assert "الحصة" in str(captured.value) and "بلا إعادة" in str(captured.value)


def test_slow_trickle_response_hits_elapsed_deadline_between_reads(monkeypatch):
    now = [0.0]
    response = FakeResponse()
    original = response.read1

    def slow(size):
        now[0] += 46
        return original(size)

    response.read1 = slow
    http_response(monkeypatch, response)
    monkeypatch.setattr(azure.time, "monotonic", lambda: now[0])
    with pytest.raises(AzureError, match="مهلة"):
        azure._post(Request(AzureCredentials(KEY, "eastus", True).endpoint), Event())
    assert response.closed and len(response.sizes) == 1


@pytest.mark.parametrize(
    "url",
    [
        "http://eastus.tts.speech.microsoft.com/cognitiveservices/v1",
        "https://evil.example/cognitiveservices/v1",
        "https://eastus.tts.speech.microsoft.com.evil.example/cognitiveservices/v1",
        "https://eastus.tts.speech.microsoft.com@evil.example/cognitiveservices/v1",
        "https://eastus.tts.speech.microsoft.com:444/cognitiveservices/v1",
        "https://eastus.tts.speech.microsoft.com/other",
        "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1?key=bad",
        "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1#fragment",
    ],
)
def test_transport_itself_rechecks_microsoft_https_endpoint_before_open(monkeypatch, url):
    monkeypatch.setattr(
        azure, "build_opener", lambda *args: pytest.fail("Forbidden endpoint opened")
    )
    with pytest.raises(AzureError):
        azure._post(Request(url), Event())


def test_key_across_segmentation_boundary_is_not_sent_as_two_fragments():
    middle = len(KEY) // 2
    with pytest.raises(AzureError):
        make_job([speech(KEY[:middle], SONIA), speech(KEY[middle:], SONIA)])


def test_closed_partial_generator_cannot_be_reused_for_later_clips():
    job = make_job([speech(), speech("التالي.")])
    stream = job.synthesize(speech(), Event())
    assert next(stream).audio_int16_bytes
    stream.close()
    assert job._credentials is None
    with pytest.raises(AzureError):
        list(job.synthesize(speech("التالي."), Event()))


def test_socket_and_tls_errors_never_echo_headers_or_body_in_logs(monkeypatch, caplog):
    def failing_ssl():
        raise OSError(KEY + " PRIVATE_BODY")

    monkeypatch.setattr(azure.ssl, "create_default_context", failing_ssl)
    with pytest.raises(AzureError) as captured:
        azure._post(Request(AzureCredentials(KEY, "eastus", True).endpoint), Event())
    assert KEY not in str(captured.value) and "PRIVATE_BODY" not in str(captured.value)
    assert not caplog.records
