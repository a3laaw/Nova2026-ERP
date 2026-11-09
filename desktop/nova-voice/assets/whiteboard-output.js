"use strict";
(() => {
  // Only the validated player may initialize outputs. No parsing/execution of
  // source HTML, network, screen capture, microphone, service or hidden approval.
  const NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const clamp = n => Math.max(0, Math.min(1, n));
  const MAX_SECONDS = 900, MAX_BYTES = 128 * 1024 * 1024, FPS = 20;
  const node = (tag, attrs = {}, text) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text !== undefined) el.textContent = String(text);
    return el;
  };
  const html = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) { el.textContent = String(text); el.dir = "auto"; }
    return el;
  };
  const stopError = () => new Error("أُلغي التصدير؛ لم يُنزّل فيديو جزئي.");
  const assertActive = job => { if (job.signal.aborted) throw job.failure || stopError(); };
  function wait(ms, job) {
    assertActive(job);
    return new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(job.failure || stopError()); };
      const timer = setTimeout(() => { job.signal.removeEventListener("abort", cancel); resolve(); }, ms);
      job.signal.addEventListener("abort", cancel, { once: true });
    });
  }
  function bounded(promise, job, milliseconds, message) {
    assertActive(job);
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); job.signal.removeEventListener("abort", abort); };
      const abort = () => { cleanup(); reject(job.failure || stopError()); };
      const timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, milliseconds);
      job.signal.addEventListener("abort", abort, { once: true });
      Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    });
  }
  function supported(format, audio) {
    if (typeof MediaRecorder !== "function" || typeof MediaRecorder.isTypeSupported !== "function") return null;
    const types = format === "mp4"
      ? (audio ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"] : ["video/mp4;codecs=avc1.42E01E", "video/mp4"])
      : (audio ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"] : ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"]);
    return types.find(type => { try { return MediaRecorder.isTypeSupported(type); } catch (_) { return false; } }) || null;
  }
  function direction(text) {
    const letters = Array.from(text).filter(c => /\p{Letter}/u.test(c));
    const arabic = letters.filter(c => /\p{Script=Arabic}/u.test(c)).length;
    return arabic > letters.length / 2 || (arabic > 0 && /\p{Script=Arabic}/u.test(letters[0])) ? "rtl" : "ltr";
  }
  function wrap(text, size, width, measure) {
    measure.font = `600 ${size}px 'Segoe UI',Tahoma,Arial,sans-serif`;
    const words = text.split(/\s+/).filter(Boolean), result = [];
    let line = "";
    const add = word => {
      const candidate = line ? line + " " + word : word;
      if (line && measure.measureText(candidate).width > width) { result.push(line); line = word; }
      else line = candidate;
    };
    for (const word of words) {
      if (measure.measureText(word).width <= width) { add(word); continue; }
      const units = typeof Intl.Segmenter === "function"
        ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word), u => u.segment) : Array.from(word);
      let piece = "";
      for (const unit of units) {
        if (piece && measure.measureText(piece + unit).width > width) { add(piece); result.push(line); line = ""; piece = ""; }
        piece += unit;
      }
      if (piece) add(piece);
    }
    if (line) result.push(line);
    return result;
  }
  function textBlock(parent, text, { top, width = 1140, maxLines = 5, size = 28, minSize = 16, color = "#334155", center = false }, measure) {
    let pieces = [];
    for (; size >= minSize; size--) { pieces = wrap(text, size, width, measure); if (pieces.length <= maxLines) break; }
    if (pieces.length > maxLines) throw new Error("نص أحد السطور أطول من مساحة الفيديو. قصّر السطر ثم أعد التصدير؛ لم نحذف أي كلمات.");
    const rtl = direction(text) === "rtl";
    const group = node("g", { "data-movie-text": "true" });
    pieces.forEach((piece, i) => group.append(node("text", {
      x: center ? 640 : rtl ? 1210 : 70, y: top + i * (size + 7), fill: color,
      "font-family": "'Segoe UI',Tahoma,Arial,sans-serif", "font-size": size, "font-weight": 600,
      direction: rtl ? "rtl" : "ltr", "unicode-bidi": "plaintext", "text-anchor": center ? "middle" : "start",
    }, piece)));
    parent.append(group);
    return group;
  }
  function frameImage(svg, context, job) {
    assertActive(job);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
      const cleanup = () => { clearTimeout(timeout); URL.revokeObjectURL(url); job.signal.removeEventListener("abort", abort); image.onload = image.onerror = null; };
      const fail = error => { cleanup(); image.src = ""; reject(error); };
      const abort = () => fail(job.failure || stopError());
      const timeout = setTimeout(() => fail(new Error("تأخر رسم إطار الفيديو. أعد المحاولة بدرس أقصر ومتصفح حديث.")), 5000);
      job.signal.addEventListener("abort", abort, { once: true });
      image.onerror = () => fail(new Error("تعذّر تحويل الرسم المحلي إلى إطار فيديو. جرّب متصفحًا حديثًا."));
      image.onload = () => {
        try { assertActive(job); context.drawImage(image, 0, 0, 1280, 720); cleanup(); resolve(); }
        catch (error) { fail(error); }
      };
      image.src = url;
    });
  }
  async function containerExtension(blob) {
    const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const type = blob.type.split(";")[0].toLowerCase();
    if (type === "video/webm" && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
    if (type === "video/mp4" && String.fromCharCode(...b.slice(4, 8)) === "ftyp") return "mp4";
    throw new Error("خرج مسجّل المتصفح لا يطابق حاوية WebM/MP4 المتوقعة؛ لم يُنزّل ملف بتسمية مضللة.");
  }
  async function webmDuration(blob, seconds) {
    // MediaRecorder WebM often omits duration. Replace a default TimestampScale
    // with an equal-length Float32 Duration (both seven bytes). TimestampScale's
    // Matroska default is exactly 1,000,000 ns. No shifts to clusters/seek offsets,
    // re-encoding, full-file buffer or dependency. Unknown layouts are untouched.
    if (!blob.type.toLowerCase().startsWith("video/webm") || !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SECONDS + 15) return blob;
    const prefix = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
    function element(at) {
      let n = 1; while (n <= 4 && !(prefix[at] & (0x80 >> (n - 1)))) n++;
      if (n > 4 || at + n >= prefix.length) return null;
      let id = 0; for (let j = 0; j < n; j++) id = id * 256 + prefix[at + j];
      let w = 1; while (w <= 8 && !(prefix[at + n] & (0x80 >> (w - 1)))) w++;
      if (w > 8 || at + n + w > prefix.length) return null;
      let size = prefix[at + n] & (0xff >> w); for (let j = 1; j < w; j++) size = size * 256 + prefix[at + n + j];
      return { id, data: at + n + w, end: at + n + w + size, bytes: n + w + size };
    }
    const ebml = element(0); if (!ebml || ebml.id !== 0x1a45dfa3) return blob;
    const segment = element(ebml.end); if (!segment || segment.id !== 0x18538067) return blob;
    for (let at = segment.data; at < prefix.length;) {
      const part = element(at); if (!part || part.id === 0x1f43b675 || part.end > prefix.length || part.id === 0xbf) return blob;
      if (part.id === 0x1549a966) {
        let replace = null;
        for (let offset = part.data; offset < part.end;) {
          const item = element(offset); if (!item || item.end > part.end || item.id === 0xbf) return blob;
          if (item.id === 0x4489) return blob; // A muxer-provided duration takes precedence.
          if (item.id === 0x2ad7b1 && item.bytes === 7 && item.end - item.data === 3 && prefix[item.data] === 15 && prefix[item.data + 1] === 66 && prefix[item.data + 2] === 64) replace = offset;
          offset = item.end;
        }
        if (replace === null) return blob;
        const value = new Uint8Array(7); value.set([0x44, 0x89, 0x84]); new DataView(value.buffer).setFloat32(3, seconds * 1000, false);
        return new Blob([blob.slice(0, replace), value, blob.slice(replace + 7)], { type: blob.type });
      }
      at = part.end;
    }
    return blob;
  }
  function init({ lesson, visualPlan: plan, recordings, timing, pause, currentStep, reducedMotion, sceneMotion, busy }) {
    const scenes = window.novaWhiteboardScenes, appearance = window.novaWhiteboardAppearance;
    const root = $("wb-print-root"), review = $("wb-output-review"), canvas = $("wb-video-canvas");
    const status = text => { $("wb-output-status").textContent = text; };
    const speech = (step, row) => scenes.rowText(plan, step, row, lesson.steps[step].rows[row].text, true);
    const display = (step, row) => scenes.rowText(plan, step, row, lesson.steps[step].rows[row].text);
    const rowColor = (step, row) => appearance ? appearance.colorFor(step, row, lesson.steps[step].rows[row].speaker) : "#2563EB";
    let job = null;
    review.checked = false; // A saved HTML is never a saved review/approval.
    const blockedAudio = !!$("nova-whiteboard-recordings") && !recordings;
    const hasAudio = !!recordings;
    const capture = typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"
      && typeof MediaStream === "function" && typeof URL.createObjectURL === "function";
    const audioContextClass = window.AudioContext || window.webkitAudioContext;
    const formats = { webm: capture && supported("webm", hasAudio), mp4: capture && supported("mp4", hasAudio) };
    const videoAllowed = !blockedAudio && (!plan || plan.policy !== "sacred") && (!hasAudio || !!audioContextClass);
    for (const option of $("wb-video-format").options) option.disabled = !formats[option.value];
    if (!formats.webm && formats.mp4) $("wb-video-format").value = "mp4";
    $("wb-video-support").textContent = !videoAllowed
      ? "الفيديو غير متاح لبيانات صوت غير مكتملة، أو وضع النصوص المقدسة، أو غياب محرك الصوت المحلي في هذا المتصفح. الطباعة النصية تبقى متاحة بعد المراجعة."
      : !formats.webm && !formats.mp4
        ? "المتصفح لا يدعم تصدير Canvas/MediaRecorder هنا. افتح HTML في إصدار حديث من Chrome أو Edge. الطباعة متاحة، ولا توجد خدمة مدفوعة بديلة."
        : `الصيغ التي يعلن المتصفح دعمها: ${[formats.webm ? "WebM" : "", formats.mp4 ? "MP4" : ""].filter(Boolean).join("، ")}. ${hasAudio ? "سيُستخدم الصوت المضمّن؛ راجع نطقه وحقوقه أولًا." : "هذا الملف بلا تسجيل؛ الفيديو سيكون صامتًا."} لا نغيّر امتداد WebM إلى MP4.`;
    function controls() {
      $("wb-print").disabled = $("wb-print-preview").disabled = !review.checked || !!job;
      $("wb-video").disabled = !review.checked || !!job || !videoAllowed || !formats[$("wb-video-format").value];
      $("wb-video-cancel").disabled = !job;
    }
    function clearPreview() {
      root.removeAttribute("data-preview"); root.replaceChildren(); $("wb-print-close").hidden = true;
    }
    function buildPrint() {
      root.replaceChildren(); root.dataset.ink = String($("wb-print-ink").checked);
      if (!review.checked || job) {
        root.append(html("p", "print-note", "لم يُؤكَّد الاطلاع على الدرس أو يجري تصدير فيديو. أوقف التصدير وراجع الدرس ثم فعّل تأكيد المراجعة في «طباعة وفيديو» أولًا."));
        return false;
      }
      root.append(html("h1", "", lesson.title));
      root.append(html("p", "print-note", "Nova Voice · الدرس كاملًا بكل الأسئلة وإجاباتها · الرسوم لقطات ثابتة من مراحل الشرح؛ ليست توثيقًا علميًا أو منهجيًا."));
      if (plan && (plan.subject || plan.grade)) root.append(html("p", "print-note", [plan.subject, plan.grade].filter(Boolean).join(" · ")));
      lesson.steps.forEach((step, index) => {
        const article = html("article", "print-step"); article.dataset.printStep = String(index);
        article.append(html("h2", "", `${index + 1} · ${step.title}`));
        if (plan) article.append(html("p", "print-description", plan.steps[index].description));
        const bounds = step.rows.map((_, row) => ({ start: row, end: row + 1 }));
        let previous = "";
        step.rows.forEach((_, row) => {
          const cue = html("section", "print-cue"); cue.dataset.printRow = String(row);
          const spoken = speech(index, row), shown = display(index, row);
          const paragraph = html("p", "print-speech", spoken); paragraph.style.color = rowColor(index, row); cue.append(paragraph);
          if (spoken !== shown) cue.append(html("p", "print-display", "على السبورة: " + shown));
          const elements = plan ? plan.steps[index].elements : [];
          const visible = elements.map((e, i) => e.row <= row && (e.until ?? step.rows.length) > row ? i : -1).filter(i => i >= 0);
          const key = visible.join(",");
          if (visible.length && key !== previous) {
            const sequence = visible.some(i => elements[i].row === row && ["path", "rotate"].includes(elements[i].motion?.type));
            // A route/rotation cannot be explained by its endpoint alone. Print
            // start/middle/end as separate readable figures, never a live SVG.
            for (const pose of sequence ? [0, 0.5, 1] : [1]) {
              const figure = html("figure");
              const svg = node("svg", { viewBox: "0 0 1070 420", xmlns: NS, role: "img", "aria-label": plan.steps[index].description });
              const view = scenes.mount(svg, plan.steps[index], 1070, 0, `print-${index}-${row}-${pose}`);
              view.update(bounds, row + 0.999999, false, true, pose);
              const phase = sequence ? ["بداية الحركة", "منتصف الحركة", "نهاية الحركة"][pose * 2] : "لقطة ثابتة";
              figure.append(svg, html("figcaption", "", `الرسم في السطر ${row + 1} · ${phase}`)); cue.append(figure);
            }
          }
          previous = key;
          article.append(cue);
        });
        root.append(article);
      });
      if (plan && plan.notes.length) {
        const notes = html("section", "print-brief"); notes.append(html("h2", "", "ملاحظات المُعدّ وحدود الرسم"));
        plan.notes.forEach(note => notes.append(html("p", "", note))); root.append(notes);
      }
      if (plan && plan.origin) {
        const original = html("section", "print-brief"); original.append(html("h2", "", "الوصف الأصلي · مرجع غير منطوق"), html("p", "", plan.origin.brief.text)); root.append(original);
      }
      return true;
    }
    review.addEventListener("change", () => {
      if (!review.checked) { clearPreview(); status("أُلغي تأكيد المراجعة؛ الطباعة والفيديو متوقفان حتى المراجعة مجددًا."); }
      else status("تأكيد المراجعة لهذه الجلسة فقط. يمكنك معاينة كل الدرس، طباعته أو تصدير الفيديو.");
      controls();
    });
    $("wb-video-format").addEventListener("change", controls);
    $("wb-print-ink").addEventListener("change", () => { if (root.dataset.preview === "true") buildPrint(); });
    $("wb-print-close").addEventListener("click", clearPreview);
    $("wb-print-preview").addEventListener("click", () => {
      if (!review.checked || job) return;
      pause();
      if (buildPrint()) { root.dataset.preview = "true"; $("wb-print-close").hidden = false; status(`المعاينة أسفل صفحة الدرس: ${lesson.steps.length} خطوة بكل الأسئلة والإجابات والرسوم المرحلية. لم يُحذف أي سطر.`); }
    });
    $("wb-print").addEventListener("click", () => {
      if (!review.checked || job) return;
      pause();
      if (buildPrint()) {
        try { window.print(); } catch (_) { status("لم تُفتح نافذة الطباعة. استخدم Ctrl+P بعد تفعيل تأكيد المراجعة أو جرّب متصفحًا حديثًا."); }
      }
    });
    window.addEventListener("beforeprint", () => { if (job) cancel("أُلغي تصدير الفيديو عند فتح الطباعة؛ لم يُنزّل ملف جزئي."); pause(); buildPrint(); });
    window.addEventListener("nova-whiteboard:appearance", () => { if (root.dataset.preview === "true") buildPrint(); });

    function clock(index, seconds) {
      const clip = timing && timing.steps[String(index)];
      if (clip) return clip.lines.map(c => ({ start: c.start_sample / clip.sample_rate, end: c.end_sample / clip.sample_rate }));
      let cursor = 0;
      const bounds = lesson.steps[index].rows.map((_, row) => { const start = cursor; cursor += Math.max(1, Array.from(speech(index, row)).length * 0.065); return { start, end: cursor }; });
      return seconds ? bounds.map(b => ({ start: b.start / cursor * seconds, end: b.end / cursor * seconds })) : bounds;
    }
    function movieStage(index, bounds, measure, stillMotion) {
      const svg = node("svg", { viewBox: "0 0 1280 720", width: 1280, height: 720, xmlns: NS });
      svg.append(node("rect", { width: 1280, height: 720, fill: "#FFFFFF" }), node("rect", { x: 0, y: 0, width: 1280, height: 8, fill: "#FFB000" }));
      textBlock(svg, lesson.title, { top: 27, maxLines: 2, size: 18, minSize: 12, color: "#64748B" }, measure);
      textBlock(svg, lesson.steps[index].title, { top: 78, maxLines: 2, size: 24, minSize: 14 }, measure);
      const group = node("g", { transform: "translate(165 125) scale(0.95)" });
      const hasScene = plan && plan.steps[index].elements.length;
      const view = hasScene ? scenes.mount(group, plan.steps[index], 1000, 0, `movie-${index}`) : null;
      if (view) svg.append(group);
      const captions = node("g"); svg.append(captions);
      const position = node("rect", { x: 0, y: 712, height: 8, width: 0, fill: "#2563EB" });
      svg.append(node("text", { x: 70, y: 702, fill: "#64748B", "font-family": "Arial,sans-serif", "font-size": 14 }, `NOVA · ${index + 1} / ${lesson.steps.length} · ${hasAudio ? "" : "Silent"}`), position);
      let lastRow = -1;
      return { svg, update(now, finished) {
        const quiet = stillMotion();
        if (view) view.update(bounds, now, quiet, !!finished && !quiet);
        const found = bounds.findIndex(b => now >= b.start && now < b.end);
        const row = found >= 0 ? found : now >= bounds[bounds.length - 1].end ? bounds.length - 1 : -1;
        if (row !== lastRow) {
          captions.replaceChildren(); lastRow = row;
          if (row >= 0) textBlock(captions, speech(index, row), { top: hasScene ? 541 : 270, maxLines: hasScene ? 5 : 8, size: hasScene ? 28 : 38, color: rowColor(index, row), center: !hasScene }, measure);
        }
        position.setAttribute("width", String(1280 * clamp(now / bounds[bounds.length - 1].end)));
      } };
    }
    async function decode(index, context, active) {
      const payload = $("nova-wb-audio-" + index), text = payload.textContent.trim();
      if (!["audio/wav", "audio/mpeg"].includes(payload.dataset.mime) || text.length > 48 * 1024 * 1024) throw new Error("تسجيل هذه الخطوة غير مدعوم أو كبير جدًا للفيديو المحلي. قسّم الدرس.");
      const raw = atob(text), bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const buffer = await bounded(context.decodeAudioData(bytes.buffer), active, 30000, "تأخر فك الصوت المحلي؛ قسّم الدرس أو أعد توليد التسجيل.");
      assertActive(active);
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 300 || buffer.length * buffer.numberOfChannels * 4 > 64 * 1024 * 1024) throw new Error("مدة/ذاكرة تسجيل الخطوة تتجاوز حد الفيديو التجريبي؛ قسّم الدرس إلى خطوات أقصر.");
      return buffer;
    }
    function cancel(reason) {
      if (!job || job.signal.aborted) return;
      job.failure = new Error(reason || "أُلغي التصدير؛ لم يُنزّل فيديو جزئي."); job.abort.abort();
      if (job.source) { try { job.source.stop(); } catch (_) { /* Already ended. */ } }
      if (job.recorder && job.recorder.state !== "inactive") { try { job.recorder.stop(); } catch (_) { /* Failed recorder. */ } }
      if (job.stream) job.stream.getTracks().forEach(track => track.stop());
      if (job.silence) { try { job.silence.stop(); job.silence.disconnect(); } catch (_) { /* Already stopped. */ } }
      if (job.context && job.context.state !== "closed") { try { void job.context.close().catch(() => {}); } catch (_) { /* Closed during page exit. */ } }
    }
    $("wb-video-cancel").addEventListener("click", () => cancel());
    async function exportVideo() {
      if (job || !review.checked || !videoAllowed || !formats[$("wb-video-format").value]) return;
      const indices = $("wb-video-scope").value === "current" ? [currentStep()] : lesson.steps.map((_, i) => i);
      const estimated = indices.reduce((n, i) => n + (hasAudio ? recordings.durations[i] : clock(i).at(-1).end) + 0.4, 0);
      if (document.hidden || estimated > MAX_SECONDS) { status("اترك الصفحة ظاهرة، واستخدم تصدير الخطوة الحالية أو قسّم الدرس إذا تجاوز 15 دقيقة."); return; }
      pause(); clearPreview();
      const active = { abort: new AbortController(), failure: null, source: null, context: null, stream: null, recorder: null };
      active.signal = active.abort.signal; job = active; busy(true);
      const locked = Array.from(document.querySelectorAll(".lesson-shell button,.lesson-shell input,.lesson-shell select"), el => [el, el.disabled]);
      locked.forEach(([el]) => { el.disabled = el.id !== "wb-video-cancel"; });
      $("wb-video-cancel").disabled = false;
      const audioControls = $("wb-audio").controls; $("wb-audio").controls = false;
      document.body.dataset.novaExporting = "true";
      canvas.hidden = false; $("wb-video-progress").hidden = false; $("wb-video-progress").value = 0;
      let stopped = null, wallTimer = null, recordedStart = 0;
      try {
        // Resume from the initiating user gesture; never request media permissions.
        if (hasAudio) { active.context = new audioContextClass(); await bounded(active.context.resume(), active, 10000, "لم يبدأ محرك الصوت. اضغط التصدير مجددًا في متصفح يسمح بالصوت المحلي."); assertActive(active); }
        if (document.fonts && document.fonts.ready) await bounded(document.fonts.ready, active, 5000, "تأخر تجهيز الخط المحلي؛ أعد المحاولة بمتصفح حديث.");
        assertActive(active);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("محرك رسم Canvas غير متاح في هذا المتصفح.");
        const stream = canvas.captureStream(0); active.stream = stream;
        const videoTrack = stream.getVideoTracks()[0];
        const manualFrames = videoTrack && typeof videoTrack.requestFrame === "function";
        if (!videoTrack) throw new Error("لم يبدأ مسار الفيديو المحلي.");
        if (!manualFrames) { stream.getTracks().forEach(t => t.stop()); active.stream = canvas.captureStream(FPS); }
        const track = active.stream.getVideoTracks()[0];
        let destination = null;
        if (hasAudio) {
          destination = active.context.createMediaStreamDestination();
          destination.stream.getAudioTracks().forEach(t => active.stream.addTrack(t));
          // Keep the audio graph clocking silence between clips; no microphone
          // or speaker output, and no concatenation that could collapse gaps.
          if (typeof active.context.createConstantSource === "function") {
            active.silence = active.context.createConstantSource(); active.silence.offset.value = 0;
            active.silence.connect(destination); active.silence.start();
          }
        }
        const recorder = new MediaRecorder(active.stream, { mimeType: formats[$("wb-video-format").value], videoBitsPerSecond: 2500000, ...(hasAudio ? { audioBitsPerSecond: 128000 } : {}) });
        active.recorder = recorder;
        const chunks = []; let bytes = 0;
        stopped = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.onerror = () => cancel("تعذّر ترميز الفيديو بهذا المتصفح. جرّب WebM أو خطوة أقصر؛ لم يُنزّل فيديو جزئي.");
        recorder.ondataavailable = event => {
          if (!event.data || !event.data.size || active.signal.aborted) return;
          bytes += event.data.size;
          if (bytes > MAX_BYTES) { cancel("تجاوز التسجيل 128 MiB. قسّم الدرس أو صدّر خطوة واحدة؛ لم يُنزّل فيديو جزئي."); return; }
          chunks.push(event.data);
        };
        // Bound stalled/background browser work as well as estimated lesson time.
        wallTimer = setTimeout(() => cancel("تجاوز التصدير حد الوقت التجريبي؛ قسّم الدرس وحاول مجددًا."), (MAX_SECONDS + 15) * 1000);
        let elapsed = 0, clockAnchor = null, lastFrame = null;
        const overloaded = () => new Error("الجهاز مشغول: تأخر إطار أو اختلفت ساعة الصوت بأكثر من 350ms. أُوقف التصدير دون ملف جزئي؛ أغلق الأعمال الثقيلة وجرّب WebM أو خطوة أقصر.");
        function auditFrame() {
          const wall = performance.now();
          if (lastFrame !== null && wall - lastFrame > 350) throw overloaded();
          if (hasAudio && clockAnchor && Math.abs((wall - clockAnchor.wall) / 1000 - (active.context.currentTime - clockAnchor.audio)) > 0.35) throw overloaded();
          lastFrame = wall;
        }
        const noMotion = () => reducedMotion() || !sceneMotion();
        for (const index of indices) {
          assertActive(active);
          const buffer = hasAudio ? await decode(index, active.context, active) : null;
          const seconds = buffer ? buffer.duration : clock(index).at(-1).end;
          if (elapsed + seconds + 0.4 > MAX_SECONDS) throw new Error("مدة الصوت الفعلية تتجاوز حد 15 دقيقة؛ قسّم الدرس.");
          const bounds = clock(index, buffer ? seconds : null), stage = movieStage(index, bounds, context, noMotion);
          stage.update(0, false); await frameImage(stage.svg, context, active);
          lastFrame = null; // Decoding/loading between steps is intentionally silent.
          if (recorder.state === "inactive") {
            recorder.start(1000); recordedStart = performance.now();
            if (hasAudio) clockAnchor = { wall: recordedStart, audio: active.context.currentTime };
          }
          auditFrame();
          if (manualFrames) track.requestFrame();
          const time = () => hasAudio ? active.context.currentTime : performance.now() / 1000;
          const start = time() + 0.1;
          if (buffer) {
            const source = active.context.createBufferSource(); active.source = source; source.buffer = buffer; source.connect(destination); source.start(start);
          }
          while (true) {
            assertActive(active);
            if (recorder.state !== "recording") throw new Error("توقف مسجل الفيديو مبكرًا؛ لم يُنزّل ملف جزئي.");
            if (hasAudio && active.context.state !== "running") throw new Error("توقف محرك الصوت أثناء التصدير؛ لم يُنزّل فيديو غير متزامن.");
            auditFrame();
            const began = performance.now(), now = Math.max(0, time() - start);
            const finished = now >= seconds;
            stage.update(finished ? Math.max(seconds, bounds.at(-1).end) : now, finished);
            await frameImage(stage.svg, context, active);
            auditFrame();
            if (manualFrames) track.requestFrame();
            $("wb-video-progress").value = clamp((elapsed + Math.min(seconds, now)) / estimated);
            status(`جارٍ التصدير محليًا · الخطوة ${index + 1} من ${lesson.steps.length} · ${Math.round($("wb-video-progress").value * 100)}% · اترك الصفحة ظاهرة. الإلغاء لا يحفظ ملفًا جزئيًا.`);
            if (finished) break;
            await wait(Math.max(1, 1000 / FPS - (performance.now() - began)), active);
          }
          if (active.source) { active.source.disconnect(); active.source = null; }
          const holdUntil = time() + 0.4;
          while (time() < holdUntil) {
            await wait(1000 / FPS, active);
            await frameImage(stage.svg, context, active);
            auditFrame();
            if (manualFrames) track.requestFrame();
          }
          elapsed += seconds + 0.4;
        }
        assertActive(active);
        const recordedSeconds = (performance.now() - recordedStart) / 1000;
        recorder.stop(); await bounded(stopped, active, 10000, "لم يُنهِ المتصفح ملف الفيديو. أعد المحاولة بخطوة أقصر."); assertActive(active);
        if (!chunks.length) throw new Error("لم ينتج المتصفح إطارات فيديو. جرّب صيغة أو متصفحًا آخر.");
        const blob = await webmDuration(new Blob(chunks, { type: recorder.mimeType || chunks[0].type }), recordedSeconds);
        const extension = await containerExtension(blob); assertActive(active);
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = "NovaVoice-" + (indices.length === 1 ? `step-${indices[0] + 1}` : "lesson") + "-" + String(lesson.fingerprint || "local").replace(/[^a-z0-9]/gi, "").slice(0, 10) + "." + extension;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        $("wb-video-progress").value = 1;
        status(`طُلب تنزيل فيديو ${extension.toUpperCase()} ${hasAudio ? "بالصوت المضمّن" : "صامت"}. افتحه للتحقق من الصورة والصوت قبل النشر؛ وجود الملف لا يثبت صحة الدرس أو جودة النطق.`);
      } catch (error) {
        status(error instanceof Error ? error.message : "تعذّر التصدير المحلي؛ لم يُنزّل فيديو جزئي.");
      } finally {
        if (wallTimer !== null) clearTimeout(wallTimer);
        if (active.source) { try { active.source.stop(); active.source.disconnect(); } catch (_) { /* Already stopped. */ } }
        if (active.recorder && active.recorder.state !== "inactive") { try { active.recorder.stop(); } catch (_) { /* Already failed. */ } }
        if (active.stream) active.stream.getTracks().forEach(t => t.stop());
        if (active.silence) { try { active.silence.stop(); active.silence.disconnect(); } catch (_) { /* Closed graph. */ } }
        if (active.context) { try { await active.context.close(); } catch (_) { /* Closed by browser. */ } }
        locked.forEach(([el, disabled]) => { el.disabled = disabled; });
        $("wb-audio").controls = audioControls;
        canvas.hidden = true; document.body.removeAttribute("data-nova-exporting");
        job = null; busy(false); controls();
      }
    }
    $("wb-video").addEventListener("click", () => { void exportVideo(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancel("توقف التصدير لأن الصفحة أصبحت مخفية؛ اتركها ظاهرة وأعد المحاولة. لم يُنزّل فيديو جزئي."); });
    window.addEventListener("pagehide", () => cancel());
    controls();
  }
  window.novaWhiteboardOutput = { init, containerExtension, webmDuration };
})();
