"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const lesson = JSON.parse($("nova-whiteboard-data").textContent);
  const NS = "http://www.w3.org/2000/svg";
  const svg = $("whiteboard"), rowsGroup = $("wb-rows"), defs = $("wb-defs"), pen = $("wb-pen");
  const audio = $("wb-audio"), playButton = $("wb-play"), rateInput = $("wb-rate");
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const recordingNode = $("nova-whiteboard-recordings");
  let recordings = null;
  try {
    const candidate = recordingNode ? JSON.parse(recordingNode.textContent) : null;
    if (candidate && Array.isArray(candidate.durations) && candidate.durations.length === lesson.steps.length &&
        candidate.durations.every((duration, i) => Number.isFinite(duration) && duration > 0 && $("nova-wb-audio-" + i))) {
      recordings = candidate;
    }
  } catch (_) { /* A malformed recording cannot prevent reading the lesson. */ }
  const hasAudio = recordings !== null;
  let current = 0, rate = 1, lines = [], totalWeight = 1, virtualTime = 0;
  let silentPlaying = false, frame = null, lastFrame = null, version = 0, completed = false;
  let canvasWidth = window.innerWidth <= 720 ? 720 : 1200;
  const outline = [];
  const clamp = value => Math.max(0, Math.min(1, value));
  const make = tag => document.createElementNS(NS, tag);
  const isPlaying = () => hasAudio ? !audio.paused && !audio.ended : silentPlaying;

  function publish() {
    window.dispatchEvent(new CustomEvent("nova-whiteboard:state", {
      detail: { step: current + 1, steps: lesson.steps.length, rate, playing: isPlaying(), hasAudio },
    }));
  }

  function refreshButton() {
    playButton.textContent = isPlaying() ? "إيقاف مؤقت" : completed ? "إعادة تشغيل الخطوة" : "تشغيل الخطوة";
    playButton.setAttribute("aria-label", playButton.textContent);
    publish();
  }

  function setStatus(text) {
    if ($("wb-status").textContent !== text) $("wb-status").textContent = text;
  }

  function cancelFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrame = null;
  }

  function duration() {
    if (!hasAudio) return totalWeight;
    return Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : recordings.durations[current];
  }

  function progress() {
    return clamp(hasAudio ? audio.currentTime / duration() : virtualTime / totalWeight);
  }

  function renderProgress(value) {
    const fraction = clamp(value);
    const elapsed = fraction * totalWeight;
    let active = null;
    for (const line of lines) {
      const part = reducedMotion ? (fraction > 0 ? 1 : 0) : clamp((elapsed - line.start) / line.weight);
      const width = (line.box.width + 12) * part;
      line.rect.setAttribute("width", String(width));
      line.rect.setAttribute("x", String(line.rtl ? line.box.x + line.box.width + 6 - width : line.box.x - 6));
      if (part > 0 && part < 1) active = { line, width, part };
    }
    if (active && !reducedMotion) {
      const { line, width, part } = active;
      const x = line.rtl ? line.box.x + line.box.width + 6 - width : line.box.x - 6 + width;
      const y = line.box.y + line.box.height * 0.85 + Math.sin(part * 36) * 2;
      pen.setAttribute("transform", `translate(${x} ${y})`);
      pen.setAttribute("opacity", "1");
    } else pen.setAttribute("opacity", "0");
    $("board-placeholder").hidden = fraction > 0;
    $("position-label").textContent = `${Math.round(fraction * 100)}%`;
    $("writing-status").textContent = fraction >= 1 ? "اكتملت الخطوة" : fraction > 0 ? "نكتب ونتعلّم…" : "السبورة جاهزة";
  }

  function textWidth(node, text) {
    node.textContent = text;
    try {
      const length = node.getComputedTextLength();
      if (Number.isFinite(length) && length > 0) return length;
    } catch (_) { /* Conservative local-font estimate for minimal SVG implementations. */ }
    return Array.from(text).length * 18;
  }

  function splitLongWord(word, measure, maxWidth) {
    const pieces = [];
    let piece = "";
    const units = typeof Intl.Segmenter === "function"
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word), unit => unit.segment)
      : Array.from(word);
    for (const unit of units) {
      if (piece && textWidth(measure, piece + unit) > maxWidth) { pieces.push(piece); piece = ""; }
      piece += unit;
    }
    if (piece) pieces.push(piece);
    return pieces;
  }

  function wrap(text, measure, maxWidth) {
    const words = text.split(/\s+/).filter(Boolean).flatMap(word => splitLongWord(word, measure, maxWidth));
    const result = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (line && textWidth(measure, candidate) > maxWidth) { result.push(line); line = word; }
      else line = candidate;
    }
    if (line) result.push(line);
    return result;
  }

  function layoutStep() {
    canvasWidth = window.innerWidth <= 720 ? 720 : 1200;
    rowsGroup.replaceChildren();
    defs.replaceChildren();
    lines = [];
    totalWeight = 0;
    let y = 80;
    const step = lesson.steps[current];
    const transcript = $("step-transcript");
    transcript.replaceChildren();
    for (const row of step.rows) {
      const rtl = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(row.text);
      const color = row.speaker === 2 ? "#C2410C" : "#2563EB";
      const measure = make("text");
      measure.setAttribute("font-size", "34");
      measure.setAttribute("font-family", rtl ? "'Segoe UI',Tahoma,Arial,sans-serif" : "'Segoe Print','Comic Sans MS','Segoe UI',sans-serif");
      measure.setAttribute("font-weight", "600");
      measure.setAttribute("opacity", "0");
      rowsGroup.append(measure);
      const wrapped = wrap(row.text, measure, canvasWidth - 210);
      const font = measure.getAttribute("font-family");
      measure.remove();
      const rowStart = y;
      for (const content of wrapped) {
        const text = make("text");
        text.textContent = content;
        text.setAttribute("x", rtl ? String(canvasWidth - 100) : "100");
        text.setAttribute("y", String(y));
        text.setAttribute("font-size", "34");
        text.setAttribute("font-family", font);
        text.setAttribute("font-weight", "600");
        text.setAttribute("direction", rtl ? "rtl" : "ltr");
        // For RTL, 'start' is the RIGHT edge of an RTL text run.
        text.setAttribute("text-anchor", "start");
        text.setAttribute("fill", color);
        rowsGroup.append(text);
        let box;
        try { box = text.getBBox(); } catch (_) { /* SVG geometry can be unavailable. */ }
        if (!box || !Number.isFinite(box.width) || box.width <= 0) {
          const width = Array.from(content).length * 18;
          box = { x: rtl ? canvasWidth - 100 - width : 100, y: y - 34, width, height: 44 };
        }
        const clip = make("clipPath"), rect = make("rect");
        clip.id = `wb-clip-${version}-${lines.length}`;
        rect.setAttribute("y", String(box.y - 6));
        rect.setAttribute("height", String(box.height + 12));
        rect.setAttribute("width", "0");
        clip.append(rect);
        defs.append(clip);
        text.setAttribute("clip-path", `url(#${clip.id})`);
        const weight = Math.max(500, Array.from(content).length * 65);
        lines.push({ rect, box, rtl, start: totalWeight, weight });
        totalWeight += weight;
        y += 54;
      }
      const bullet = make("circle");
      bullet.setAttribute("cx", rtl ? String(canvasWidth - 58) : "58");
      bullet.setAttribute("cy", String(rowStart - 12));
      bullet.setAttribute("r", "7");
      bullet.setAttribute("fill", color);
      rowsGroup.append(bullet);
      y += 28;
      const paragraph = document.createElement("p");
      paragraph.className = "transcript-line";
      paragraph.dir = "auto";
      paragraph.dataset.speaker = String(row.speaker);
      paragraph.textContent = row.text;
      transcript.append(paragraph);
    }
    totalWeight = Math.max(1, totalWeight);
    svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${Math.max(430, y + 25)}`);
  }

  function finishStep() {
    if (completed) return;
    completed = true;
    silentPlaying = false;
    cancelFrame();
    renderProgress(1);
    refreshButton();
    setStatus("اكتملت الخطوة. يمكنك إعادتها أو الانتقال إلى التالية.");
    if ($("wb-auto-next").checked && current + 1 < lesson.steps.length) navigate(current + 1, true);
  }

  function tick(timestamp) {
    frame = null;
    if (!isPlaying()) { lastFrame = null; return; }
    if (!hasAudio) {
      if (lastFrame !== null) virtualTime = Math.min(totalWeight, virtualTime + Math.max(0, timestamp - lastFrame) * rate);
      lastFrame = timestamp;
    }
    renderProgress(progress());
    if (!hasAudio && virtualTime >= totalWeight) { finishStep(); return; }
    frame = requestAnimationFrame(tick);
  }

  function startFrame() {
    if (frame === null) { lastFrame = null; frame = requestAnimationFrame(tick); }
  }

  async function play() {
    const ticket = version;
    if (completed) {
      completed = false;
      virtualTime = 0;
      if (hasAudio) audio.currentTime = 0;
      renderProgress(0);
    }
    if (hasAudio) {
      try {
        await audio.play();
        if (ticket === version) { startFrame(); refreshButton(); }
      } catch (_) {
        if (ticket === version) {
          setStatus("لم يبدأ الصوت. اضغط تشغيل داخل مشغّل الصوت أو افتح الملف بمتصفح حديث.");
          refreshButton();
        }
      }
    } else {
      if (reducedMotion) { virtualTime = totalWeight; finishStep(); return; }
      silentPlaying = true;
      startFrame();
      refreshButton();
      setStatus("عرض الكتابة فقط؛ يمكنك إضافة الصوت لاحقًا من الخطوة 2 داخل البرنامج.");
    }
  }

  function pause() {
    if (hasAudio) audio.pause();
    else silentPlaying = false;
    cancelFrame();
    refreshButton();
  }

  function navigate(index, continuePlaying = false) {
    if (index < 0 || index >= lesson.steps.length) return;
    version++;
    cancelFrame();
    if (hasAudio) audio.pause();
    silentPlaying = false;
    completed = false;
    virtualTime = 0;
    current = index;
    $("scene-title").textContent = lesson.steps[index].title;
    $("scene-number").textContent = `الخطوة ${index + 1} من ${lesson.steps.length}`;
    $("wb-previous").disabled = index === 0;
    $("wb-next").disabled = index + 1 === lesson.steps.length;
    outline.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    layoutStep();
    if (hasAudio) {
      const payload = $("nova-wb-audio-" + index);
      audio.src = `data:${payload.dataset.mime};base64,${payload.textContent.trim()}`;
      audio.playbackRate = rate;
      audio.preservesPitch = true;
      audio.webkitPreservesPitch = true;
      setStatus("الصوت مضمّن لهذه الخطوة. تشغيله وتحريك الكتابة يستخدمان ساعة الصوت نفسها؛ المحاذاة داخل الخطوة تقريبية.");
    }
    renderProgress(0);
    refreshButton();
    if (continuePlaying) void play();
  }

  function setRate(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    rate = Math.max(0.5, Math.min(2, number));
    rateInput.value = String(rate);
    $("wb-rate-label").textContent = rate.toFixed(2) + "×";
    if (hasAudio && audio.playbackRate !== rate) audio.playbackRate = rate;
    publish();
  }

  $("lesson-title").textContent = lesson.title;
  $("step-count").textContent = `${lesson.steps.length} خطوات`;
  const list = $("lesson-outline");
  lesson.steps.forEach((step, index) => {
    const item = document.createElement("li"), button = document.createElement("button");
    button.className = "outline-step";
    button.type = "button";
    const number = document.createElement("span"), title = document.createElement("span");
    number.className = "outline-number";
    number.textContent = String(index + 1);
    title.className = "outline-text";
    title.textContent = step.title;
    button.append(number, title);
    button.addEventListener("click", () => navigate(index, isPlaying()));
    item.append(button);
    list.append(item);
    outline.push(button);
  });
  audio.hidden = !hasAudio;
  if (hasAudio) {
    $("audio-badge").textContent = "الصوت مضمّن · لكل خطوة";
    $("audio-badge").classList.add("ready");
  }
  playButton.addEventListener("click", () => isPlaying() ? pause() : void play());
  $("wb-restart").addEventListener("click", () => navigate(current, isPlaying()));
  $("wb-previous").addEventListener("click", () => navigate(current - 1, isPlaying()));
  $("wb-next").addEventListener("click", () => navigate(current + 1, isPlaying()));
  rateInput.addEventListener("input", event => setRate(event.target.value));
  $("wb-reset-rate").addEventListener("click", () => setRate(1));
  if (hasAudio) {
    audio.addEventListener("play", () => {
      completed = false;
      startFrame();
      refreshButton();
    });
    audio.addEventListener("pause", () => { cancelFrame(); renderProgress(progress()); refreshButton(); });
    for (const event of ["timeupdate", "seeked", "loadedmetadata"]) audio.addEventListener(event, () => {
      renderProgress(progress());
      if (progress() < 1) completed = false;
      refreshButton();
    });
    audio.addEventListener("ended", finishStep);
    audio.addEventListener("ratechange", () => setRate(audio.playbackRate));
    audio.addEventListener("error", () => {
      cancelFrame();
      setStatus("تعذّر تشغيل الصوت المضمّن. جرّب متصفحًا حديثًا أو أعد توليده بصيغة MP3/WAV أخرى.");
      refreshButton();
    });
  }
  window.addEventListener("resize", () => {
    if ((window.innerWidth <= 720 ? 720 : 1200) !== canvasWidth) {
      const value = progress();
      layoutStep();
      renderProgress(value);
    }
  });
  document.addEventListener("visibilitychange", () => { lastFrame = null; });
  window.addEventListener("pagehide", () => { version++; pause(); });
  window.addEventListener("keydown", event => {
    const target = event.target;
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat ||
        (target && (target.isContentEditable || target.closest("input,select,textarea,button,audio,summary")))) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); navigate(current + 1, isPlaying()); }
    else if (event.key === "ArrowRight") { event.preventDefault(); navigate(current - 1, isPlaying()); }
    else if (event.key === " ") { event.preventDefault(); if (isPlaying()) pause(); else void play(); }
  });
  // No timer monkey-patching, HTML execution service, Web Speech API or network.
  navigate(0);
  if (recordingNode && !hasAudio) setStatus("بيانات الصوت غير مكتملة. أعد إنشاء نسخة بالصوت من السبورة الأصلية.");
})();
