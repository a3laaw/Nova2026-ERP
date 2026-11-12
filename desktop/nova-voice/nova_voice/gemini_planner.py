"""Optional, consent-only text planning via Google AI Studio (Gemini free tier).

This is the «Google Gemini» provider of «مشاهد ذكية», next to the enforced
zero-cost/ZDR OpenRouter path. It exists because teachers asked for Google's
free tier — not because it is privacy-equal. Read the difference before using:

- The OpenRouter path is pinned to a free model with server-enforced
  ``data_collection: deny`` and ``zdr: True``, and the reply must attest
  ``usage.cost == 0`` (anything else is rejected).
- The Gemini free tier has no client-side ZDR switch: **Google may use free-tier
  prompts and responses to improve its products, and human reviewers may read
  them.** There is no cost field in the response to verify; the free quota is
  account-side (per AI Studio, currently gemini-2.5-flash, roughly 10–15 RPM and
  a few hundred requests/day — it changes). If the user's Google project has
  billing enabled, their own account terms apply; the app never asks for or
  enables billing, never retries, and never falls back to any paid model.

Per-request consent + adult eligibility + ``policy == "general"`` are required
before any network call, like the OpenRouter path. Keys live in session memory
only. Rendering, speech, preview and export never use this module.
Never put credentials in prompts, settings, exceptions or exported data.
"""

import json
import re
import time
from collections.abc import Callable
from threading import Event
from urllib.error import HTTPError
from urllib.request import Request

from .scene_planner import NETWORK_TIMEOUT, TOTAL_READ_SECONDS, _open, prompt_parts
from .scenes import MAX_PLAN_BYTES, SceneError, VisualPlan, _unique
from .voices import Cancelled, check_cancelled

ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)
MODEL = "gemini-2.5-flash"
MAX_RESPONSE_BYTES = MAX_PLAN_BYTES + 65536
MAX_CLOUD_CHARACTERS = 12000
MAX_CLOUD_STEPS = 12



def manual_prompt(
    source: dict, subject: str = "", grade: str = "", *, secondary_assets: bool = False
) -> str:
    """Provider-agnostic manual prompt (same as the OpenRouter one)."""
    from .scene_planner import manual_prompt as _manual_prompt

    return _manual_prompt(source, subject, grade, secondary_assets=secondary_assets)


def _authorize(key: str, cancel: Event, *, consent: bool, adult: bool, policy: str):
    check_cancelled(cancel)
    if consent is not True or adult is not True:
        raise SceneError("يلزم إذن إرسال هذا الدرس وتأكيد أهلية حساب المعلم البالغ أولًا.")
    if policy != "general":
        raise SceneError("وضع النصوص المقدسة محلي فقط في هذه النسخة؛ لا إرسال أو إعادة صياغة آلية.")
    if (
        not isinstance(key, str)
        or not 10 <= len(key) <= 512
        or not re.fullmatch(r"[A-Za-z0-9_.-]+", key)
    ):
        raise SceneError("أدخل مفتاح Google AI Studio في خانته داخل البرنامج، لا داخل السكريبت.")


def request_answer(
    system: str,
    content: str,
    key: str,
    cancel: Event,
    progress: Callable[[int], None],
    *,
    consent: bool = False,
    adult: bool = False,
    policy: str = "general",
    _transport: Callable = _open,
) -> str:
    """Exactly one bounded request. Any uncertainty/error stops; never retry."""
    _authorize(key, cancel, consent=consent, adult=adult, policy=policy)
    if key in content:
        raise SceneError("يظهر المفتاح داخل بيانات الدرس؛ أزله من النص قبل أي إرسال.")
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": content}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "maxOutputTokens": 8192,
        },
    }
    request = Request(
        ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "x-goog-api-key": key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        },
        method="POST",
    )
    progress(-1)
    chunks, size = [], 0
    deadline = time.monotonic() + TOTAL_READ_SECONDS
    try:
        check_cancelled(cancel)
        with _transport(request, timeout=NETWORK_TIMEOUT) as response:
            check_cancelled(cancel)
            if response.status != 200:
                raise SceneError("المزود رفض الطلب. لم تُجرّب خدمة بديلة أو مدفوعة.")
            if response.headers.get("Content-Encoding", "identity") not in ("identity", ""):
                raise SceneError("صيغة استجابة المزود غير مدعومة؛ توقف الطلب.")
            reader = getattr(response, "read1", response.read)
            while True:
                check_cancelled(cancel)
                if time.monotonic() > deadline:
                    raise SceneError("انتهت مهلة الرد. لا إعادة محاولة تلقائية.")
                block = reader(min(16384, MAX_RESPONSE_BYTES + 1 - size))
                if not block:
                    break
                size += len(block)
                if size > MAX_RESPONSE_BYTES:
                    raise SceneError("استجابة المزود أكبر من الحد المسموح؛ لم تُستخدم.")
                chunks.append(block)
        check_cancelled(cancel)
    except HTTPError as error:
        code = error.code
        error.close()
        check_cancelled(cancel)
        messages = {
            400: "رفض Google الطلب (بيانات غير صالحة). لم تُخفّف القيود ولم يُستخدم بديل.",
            401: "المفتاح غير مقبول. راجعه داخل AI Studio، ولا ترسله في المحادثة.",
            403: "رفض Google الطلب (صلاحية أو سياسة الحساب). لم يُستخدم بديل.",
            429: (
                "استُنفدت الحصة المجانية في Google AI Studio الآن. توقف دون إعادة محاولة أو "
                "تفعيل فوترة؛ راجع aistudio.google.com/apikey أو استخدم الاستيراد المحلي."
            ),
        }
        raise SceneError(
            messages.get(code, "تعذّر الطلب. لا تحويلات أو إعادة محاولة أو بديل مدفوع.")
        ) from None
    except (Cancelled, SceneError):
        raise
    except Exception:
        # Transport exceptions can echo request headers; never let them reach logs.
        check_cancelled(cancel)
        raise SceneError(
            "تعذّر الاتصال الآمن أو انتهت المهلة. لم تُحفظ بيانات الاتصال ولم يُجرّب بديل."
        ) from None
    try:
        data = json.loads(
            b"".join(chunks).decode("utf-8"),
            object_pairs_hook=_unique,
            parse_constant=lambda _: (_ for _ in ()).throw(
                SceneError("استجابة المزود تحتوي أرقامًا غير منتهية؛ لم تُستخدم.")
            ),
        )
        if not isinstance(data, dict) or "error" in data:
            raise SceneError("أعاد المزود خطأ. لم تُعتمد أي خطة أو إعادة محاولة.")
        if data.get("promptFeedback", {}).get("blockReason"):
            raise SceneError("حظرت مرشحات Google هذا الطلب؛ لم تُعتمد أي خطة.")
        candidates = data.get("candidates")
        if (
            not isinstance(candidates, list)
            or len(candidates) != 1
            or candidates[0].get("finishReason") != "STOP"
        ):
            raise SceneError("اقتراح المشاهد غير مكتمل؛ قسّم الدرس أو استخدم خطة محلية.")
        parts = candidates[0].get("content", {}).get("parts")
        if not isinstance(parts, list) or len(parts) != 1:
            raise SceneError("استجابة المزود غير صالحة؛ لم تُستخدم.")
        answer = parts[0].get("text")
        if not isinstance(answer, str) or key in answer:
            raise SceneError("استجابة المزود غير صالحة؛ لم تُستخدم.")
    except SceneError:
        raise
    except (ValueError, KeyError, TypeError, AttributeError, RecursionError, UnicodeError):
        raise SceneError(
            "تعذّر قراءة اقتراح المزود. لم تُعتمد خطة ولم تُرسل محاولة إصلاح تلقائية."
        ) from None
    check_cancelled(cancel)
    return answer


def request_plan(
    source: dict,
    key: str,
    cancel: Event,
    progress: Callable[[int], None],
    *,
    consent: bool = False,
    adult: bool = False,
    subject: str = "",
    grade: str = "",
    policy: str = "general",
    secondary_assets: bool = False,
    _transport: Callable = _open,
) -> VisualPlan:
    """Exactly one bounded request. Any uncertainty/error stops; never retry."""
    _authorize(key, cancel, consent=consent, adult=adult, policy=policy)
    if (
        len(source.get("script", "")) > MAX_CLOUD_CHARACTERS
        or len(source.get("steps", [])) > MAX_CLOUD_STEPS
    ):
        raise SceneError(
            "للطلب المجاني: قسّم الدرس إلى 12 خطوة و12000 حرف كحد أقصى، أو استورد خطة محليًا."
        )
    system, content = prompt_parts(source, subject, grade, secondary_assets=secondary_assets)
    answer = request_answer(
        system,
        content,
        key,
        cancel,
        progress,
        consent=consent,
        adult=adult,
        policy=policy,
        _transport=_transport,
    )
    plan = VisualPlan.from_json(answer, source)
    from .secondary_assets import validate_model_proposal

    validate_model_proposal(plan.to_data(), enabled=secondary_assets)
    if key in json.dumps(plan.to_data(), ensure_ascii=False):
        raise SceneError("استجابة المزود غير صالحة؛ لم تُستخدم.")
    check_cancelled(cancel)
    progress(100)
    return plan

