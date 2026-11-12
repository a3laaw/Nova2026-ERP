/* Nova Voice: no network calls, global timer patches, autoplay, or page-script rewriting. */
(() => {
  "use strict";
  const ownScript = document.currentScript;
  const host = ownScript && ownScript.previousElementSibling;
  if (!host || host.localName !== "nova-voice-player" || host.shadowRoot) return;
  const audio = host.querySelector("audio[data-nova-voice-audio]");
  if (!audio || typeof host.attachShadow !== "function") return; // Native audio remains a fallback.
  // Keep only OUR host usable even if the page has broad rules such as * { position: relative }.
  const hostStyle = {
    all: "initial", display: "block", position: "fixed", right: "16px", bottom: "16px",
    "z-index": "2147483000", width: "380px", "max-width": "calc(100vw - 32px)",
    "font-family": '"Segoe UI", Tahoma, sans-serif', "font-size": "14px", "line-height": "1.5",
    color: "#1e293b", direction: "rtl", "color-scheme": "light", visibility: "visible", opacity: "1",
  };
  for (const [property, value] of Object.entries(hostStyle)) host.style.setProperty(property, value, "important");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = __NOVA_PLAYER_CSS__;
  root.append(style);
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.lang = "ar";
  panel.dir = "rtl";
  panel.setAttribute("aria-label", "مشغّل صوت الصفحة");
  panel.innerHTML = `
    <header>
      <strong>صوت الصفحة · Nova Voice</strong>
      <button type="button" data-action="collapse" aria-expanded="true" aria-controls="nv-body">تصغير</button>
    </header>
    <div class="body" id="nv-body">
      <div data-audio-slot></div>
      <div class="speed-title">
        <label for="nv-speed">سرعة الصوت والحركات المدعومة</label>
        <output for="nv-speed" aria-live="polite">1.00×</output>
        <button type="button" data-action="reset-rate" title="السرعة الطبيعية">1×</button>
      </div>
      <input id="nv-speed" type="range" min="0.5" max="2" step="0.05" value="1"
        aria-label="سرعة التشغيل من نصف السرعة إلى الضعف">
      <label class="option"><input type="checkbox" data-option="animations" checked>
        <span>طبّق السرعة نفسها على حركات الصفحة</span></label>
      <label class="option"><input type="checkbox" data-option="transport">
        <span>اربط إيقاف/تشغيل الحركات بالصوت أيضًا</span></label>
      <p class="note status" data-status role="status"></p>
      <p class="note">التحكم لحركات CSS وWeb Animations فقط؛ مؤقّتات JavaScript الخاصة
        أو مزامنة الجمل بالمشاهد تحتاج ربطًا مخصصًا.</p>
    </div>`;
  root.append(panel);
  panel.querySelector("[data-audio-slot]").append(audio);
  audio.controls = true;
  audio.autoplay = false;
  audio.preservesPitch = true;
  if ("webkitPreservesPitch" in audio) audio.webkitPreservesPitch = true;
  if ("mozPreservesPitch" in audio) audio.mozPreservesPitch = true;

  const speed = panel.querySelector("input[type=range]");
  const output = panel.querySelector("output");
  const animationsEnabled = panel.querySelector("[data-option=animations]");
  const transportEnabled = panel.querySelector("[data-option=transport]");
  const status = panel.querySelector("[data-status]");
  const collapse = panel.querySelector("[data-action=collapse]");
  const managed = new Map();
  const supportsAnimations = typeof document.getAnimations === "function";
  let rate = 1;
  let disposed = false;

  function setStatus(message) {
    if (audio.error) message = "تعذّر تشغيل الصوت في هذا المتصفح. جرّب Chrome أو Edge أو Firefox حديثًا.";
    if (status.textContent !== message) status.textContent = message;
  }

  function setAnimationRate(animation, value) {
    if (Math.abs(animation.playbackRate - value) < 0.00001) return;
    if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(value);
    else animation.playbackRate = value;
  }

  function restore(animation, state) {
    try {
      setAnimationRate(animation, state.originalRate);
      if (state.pausedByUs && animation.playState === "paused") animation.play();
    } catch (_) { /* A removed/cancelled animation must not break the audio controls. */ }
  }

  function releaseAnimations() {
    for (const [animation, state] of managed) restore(animation, state);
    managed.clear();
  }

  function isOurAnimation(animation) {
    const target = animation.effect && animation.effect.target;
    return target && (target === host || host.contains(target) ||
      (typeof target.getRootNode === "function" && target.getRootNode() === root));
  }

  function syncAnimations() {
    if (disposed) return;
    transportEnabled.disabled = !animationsEnabled.checked || !supportsAnimations;
    if (!supportsAnimations) {
      setStatus("الصوت يعمل؛ المتصفح لا يتيح التحكم بحركات الصفحة.");
      return;
    }
    if (!animationsEnabled.checked) {
      releaseAnimations();
      setStatus("التحكم بالسرعة للصوت فقط. حركات الصفحة دون تغيير.");
      return;
    }
    let available;
    try { available = document.getAnimations(); }
    catch (_) {
      setStatus("تعذّر الوصول إلى الحركات؛ التحكم بالصوت ما زال متاحًا.");
      return;
    }
    const active = new Set(available.filter(animation => !isOurAnimation(animation) &&
      animation.playState !== "idle" && animation.playState !== "finished"));
    for (const [animation, state] of managed) {
      if (!active.has(animation)) {
        restore(animation, state);
        managed.delete(animation);
      }
    }
    let controlled = 0;
    for (const animation of active) {
      if (!managed.has(animation)) {
        managed.set(animation, {
          originalRate: Number.isFinite(animation.playbackRate) ? animation.playbackRate : 1,
          pausedByUs: false,
        });
      }
      const state = managed.get(animation);
      try {
        // Always scale the ORIGINAL rate, never repeatedly multiply the new rate.
        setAnimationRate(animation, state.originalRate * rate);
        if (transportEnabled.checked && (audio.paused || audio.ended)) {
          if (animation.playState === "running") {
            animation.pause();
            state.pausedByUs = true;
          }
        } else if (state.pausedByUs) {
          if (animation.playState === "paused") animation.play();
          state.pausedByUs = false;
        }
        controlled += 1;
      } catch (_) { /* Handle non-writable animations individually. */ }
    }
    setStatus(controlled
      ? `حركات متاحة للتحكم: ${controlled}. لا تعني هذه مطابقة الجمل بالمشاهد.`
      : "لا توجد حركة CSS متاحة الآن. مؤقّتات JavaScript لا تتغير تلقائيًا.");
  }

  function publishState() {
    window.dispatchEvent(new CustomEvent("nova-voice:state", { detail: {
      rate,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      playing: !audio.paused && !audio.ended,
      applyToAnimations: animationsEnabled.checked,
      linkTransport: transportEnabled.checked,
    } }));
  }

  function setRate(value) {
    const number = Number(value);
    rate = Number.isFinite(number) ? Math.max(0.5, Math.min(2, number)) : 1;
    speed.value = String(rate);
    output.value = `${rate.toFixed(2)}×`;
    output.textContent = output.value;
    if (Math.abs(audio.playbackRate - rate) > 0.00001) audio.playbackRate = rate;
    syncAnimations();
    publishState();
  }

  speed.addEventListener("input", () => setRate(speed.value));
  panel.querySelector("[data-action=reset-rate]").addEventListener("click", () => setRate(1));
  audio.addEventListener("ratechange", () => setRate(audio.playbackRate));
  for (const event of ["play", "pause", "ended"]) {
    audio.addEventListener(event, () => { syncAnimations(); publishState(); });
  }
  audio.addEventListener("timeupdate", publishState);
  audio.addEventListener("error", () => {
    setStatus("تعذّر تشغيل الصوت في هذا المتصفح. جرّب إصدارًا حديثًا من Chrome أو Edge أو Firefox.");
  });
  for (const checkbox of [animationsEnabled, transportEnabled]) {
    checkbox.addEventListener("change", () => { syncAnimations(); publishState(); });
  }
  collapse.addEventListener("click", () => {
    const collapsed = host.toggleAttribute("data-collapsed");
    host.style.setProperty("width", collapsed ? "auto" : "380px", "important");
    collapse.setAttribute("aria-expanded", String(!collapsed));
    collapse.textContent = collapsed ? "إظهار" : "تصغير";
  });
  // Discover new transitions/animations without patching the page's own timers.
  const interval = window.setInterval(() => {
    if (!document.hidden) syncAnimations();
  }, 700);
  window.addEventListener("pagehide", event => {
    if (event.persisted) return; // Back-forward cache will resume this same controller.
    disposed = true;
    window.clearInterval(interval);
    releaseAnimations();
  });
  setRate(1);
})();
