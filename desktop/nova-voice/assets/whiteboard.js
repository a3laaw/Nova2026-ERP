"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const lesson = JSON.parse($("nova-whiteboard-data").textContent);
  const NS = "http://www.w3.org/2000/svg";
  const sceneEngine = window.novaWhiteboardScenes;
  let visualPlan = null;
  function rejectVisualPlayback(message) {
    ["wb-play", "wb-restart", "wb-previous", "wb-next", "wb-save-customized"].forEach(id => { $(id).disabled = true; });
    $("wb-audio").hidden = true;
    $("wb-status").textContent = message;
    $("board-placeholder").textContent = "تعذّر التحقق من بيانات المشاهد";
    $("step-transcript").textContent = lesson.script;
  }
  try {
    if (!sceneEngine && lesson.schema !== 1) throw new Error("Missing scenes controller");
    visualPlan = sceneEngine ? sceneEngine.read(lesson) : null;
  } catch (_) {
    rejectVisualPlayback("خطة المشاهد أو ارتباطها بالنص غير صالح. أعد التصدير من Nova؛ لم يبدأ أي صوت.");
    return;
  }
  const appearance = window.novaWhiteboardAppearance;
  const svg = $("whiteboard"), rowsGroup = $("wb-rows"), defs = $("wb-defs"), pen = $("wb-pen");
  const audio = $("wb-audio"), playButton = $("wb-play"), rateInput = $("wb-rate");
  const motionQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let reducedMotion = !!(motionQuery && motionQuery.matches);
  const eraser = $("wb-eraser");
  const ERASE_MS = 560;
  let transition = null;
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
  const timing = hasAudio && window.novaWhiteboardTiming
    ? window.novaWhiteboardTiming.read($("nova-whiteboard-timings"), lesson, recordings) : null;
  if (visualPlan && visualPlan.policy === "sacred" && recordingNode) {
    rejectVisualPlayback("الصوت في وضع النصوص المقدسة غير مدعوم في هذه النسخة؛ لا تلاوة آلية أو تسجيل موثّق هنا.");
    return;
  }
  if (visualPlan && recordingNode && (!hasAudio || !timing)) {
    rejectVisualPlayback("هذه المشاهد تحتاج خريطة توقيت سليمة مرتبطة بالنص والنطق المعتمدين. أعد توليد الصوت؛ لم يبدأ التشغيل.");
    return;
  }
  svg.dataset.timing = timing ? "measured" : hasAudio ? "weighted" : "silent";
  svg.dataset.visuals = visualPlan ? "validated" : "none";
  if (visualPlan) {
    const note = $("wb-visual-note");
    note.hidden = false;
    note.textContent = visualPlan.policy === "sacred"
      ? "نص للمراجعة كما أدخله المُعدّ؛ لا توثيق آلي للآيات أو أحكام التجويد، ولا تلاوة مولّدة في هذا الوضع."
      : "مشاهد توضيحية؛ المحرك لا يوثّق الخرائط أو الحقائق العلمية. راجع المحتوى والنطق قبل التدريس.";
  }
  let sceneView = null, rowBounds = [];
  let current = 0, rate = 1, lines = [], totalWeight = 1, virtualTime = 0;
  let silentPlaying = false, frame = null, lastFrame = null, version = 0, completed = false;
  let canvasWidth = window.innerWidth <= 720 ? 720 : 1200;
  const outline = [];
  const clamp = value => Math.max(0, Math.min(1, value));
  const make = tag => document.createElementNS(NS, tag);
  const isPlaying = () => !transition && (hasAudio ? !audio.paused && !audio.ended : silentPlaying);
  const continueAfterNavigation = () => transition ? transition.resume : isPlaying();
  const navigationIndex = () => transition ? transition.index : current;

  function publish() {
    window.dispatchEvent(new CustomEvent("nova-whiteboard:state", {
      detail: { step: current + 1, steps: lesson.steps.length, rate, playing: isPlaying(), hasAudio },
    }));
    // The transport state remains true during a measured gap; child motion
    // must nevertheless follow the current speech cue, not the last speaker.
    if (timing && appearance) {
      const clip = timing.steps[String(current)], samples = audio.currentTime * clip.sample_rate;
      const cue = clip.lines.find(line => samples >= line.start_sample && samples < line.end_sample);
      appearance.setActiveSpeaker(cue ? cue.speaker : 1, !!cue && isPlaying());
    }
  }

  function refreshButton() {
    playButton.textContent = transition ? "نمسح السبورة…" : isPlaying() ? "إيقاف مؤقت" : completed ? "إعادة تشغيل الخطوة" : "تشغيل الخطوة";
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

  function renderProgress(value, finished = false) {
    if (transition) return; // Never repaint/reveal old speech while its board is being erased.
    const fraction = clamp(value);
    const elapsed = fraction * totalWeight;
    const clip = timing ? timing.steps[String(current)] : null;
    // No elapsed wall time, playbackRate multiplier or whole-clip stretching.
    // Only ended may force the final reveal (MP3 can trim/pad its PCM clock).
    const samples = clip ? (finished ? clip.total_samples : audio.currentTime * clip.sample_rate) : 0;
    if (sceneView) {
      const bounds = clip ? clip.lines.map(cue => ({ start: cue.start_sample, end: cue.end_sample })) : rowBounds;
      sceneView.update(bounds, clip ? samples : elapsed, reducedMotion);
    }
    let active = null;
    for (const line of lines) {
      let part;
      if (clip || visualPlan) {
        const cue = clip ? clip.lines[line.row] : rowBounds[line.row];
        const now = clip ? samples : elapsed;
        const start = clip ? cue.start_sample : cue.start, end = clip ? cue.end_sample : cue.end;
        const rowPart = clamp((now - start) / (end - start));
        // Text weights are confined to visual wrapping INSIDE this source row.
        part = reducedMotion ? (rowPart > 0 ? 1 : 0) : clamp((rowPart * line.rowWeight - line.rowStart) / line.weight);
      } else part = reducedMotion ? (fraction > 0 ? 1 : 0) : clamp((elapsed - line.start) / line.weight);
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
    const cue = clip ? clip.lines.find(line => samples >= line.start_sample && samples < line.end_sample) : null;
    const silentRow = visualPlan ? rowBounds.findIndex(bound => elapsed >= bound.start && elapsed < bound.end) : -1;
    const activeLine = clip ? (cue ? lines.find(line => line.row === cue.line_id) : null)
      : visualPlan ? lines.find(line => line.row === silentRow)
      : active ? active.line : lines.find(line => elapsed < line.start + line.weight) || lines[lines.length - 1];
    if (appearance) appearance.setActiveSpeaker(activeLine ? activeLine.speaker : 1, !!activeLine && isPlaying() && !finished && (clip ? samples < clip.total_samples : fraction < 1));
    $("board-placeholder").hidden = fraction > 0 || !!sceneView;
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

  function directionOf(text) {
    // Punctuation, including the Arabic comma, is not a language signal.
    const letters = Array.from(text).filter(char => /\p{Letter}/u.test(char));
    const arabic = letters.filter(char => /\p{Script=Arabic}/u.test(char)).length;
    const latin = letters.filter(char => /\p{Script=Latin}/u.test(char)).length;
    return arabic > latin || (arabic > 0 && arabic === latin && /\p{Script=Arabic}/u.test(letters[0])) ? "rtl" : "ltr";
  }

  function layoutStep() {
    canvasWidth = window.innerWidth <= 720 ? 720 : 1200;
    rowsGroup.replaceChildren();
    defs.replaceChildren();
    lines = [];
    totalWeight = 0;
    let y = 80;
    const originalStep = lesson.steps[current];
    const step = { ...originalStep, rows: originalStep.rows.map((row, i) => ({ ...row,
      text: visualPlan ? sceneEngine.rowText(visualPlan, current, i, row.text) : row.text })) };
    sceneView = null;
    if (visualPlan && visualPlan.steps[current].elements.length) {
      sceneView = sceneEngine.mount(rowsGroup, visualPlan.steps[current], canvasWidth, 25, version);
      y = sceneView.bottom;
    }
    const selected = appearance && appearance.layout ? appearance.layout() : "script";
    const columns = selected === "columns" && canvasWidth > 720;
    const transcript = $("step-transcript");
    transcript.replaceChildren();
    transcript.dataset.layout = columns ? "columns" : selected === "script" ? "script" : "stacked";
    const blocks = [];
    const entries = step.rows.map((row, index) => ({ row, index, rtl: directionOf(row.text) === "rtl" }));
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      // Adjacent English -> Arabic entries are presentation pairs, not an AI
      // translation or permission to reorder unrelated utterances.
      if (selected !== "script" && !entry.rtl && entries[index + 1] && entries[index + 1].rtl) {
        blocks.push([entry, entries[++index]]);
      } else blocks.push([entry]);
    }
    for (const [blockIndex, block] of blocks.entries()) {
      const group = make("g");
      group.classList.add(block.length === 2 ? "bilingual-pair" : "board-entry");
      group.dataset.layout = columns && block.length === 2 ? "columns" : "stacked";
      group.dataset.pair = String(blockIndex);
      rowsGroup.append(group);
      const start = y;
      let bottom = y;
      let background = null;
      if (block.length === 2) {
        background = make("rect");
        for (const [key, value] of Object.entries({ x: 35, y: y - 48, width: canvasWidth - 70, rx: 20, fill: "#F8FAFC", stroke: "#E2E8F0" })) background.setAttribute(key, String(value));
        group.append(background);
      }
      for (const { row, index: rowIndex, rtl } of block) {
        let rowY = columns && block.length === 2 ? start : bottom;
        const color = appearance ? appearance.colorFor(current, rowIndex, row.speaker) : row.speaker === 2 ? "#C2410C" : "#2563EB";
        const measure = make("text");
        measure.setAttribute("font-size", "34");
        measure.setAttribute("font-family", rtl ? "'Segoe UI',Tahoma,Arial,sans-serif" : "'Segoe Print','Comic Sans MS','Segoe UI',sans-serif");
        measure.setAttribute("font-weight", "600");
        measure.setAttribute("opacity", "0");
        rowsGroup.append(measure);
        const wrapped = wrap(row.text, measure, columns && block.length === 2 ? (canvasWidth - 280) / 2 : canvasWidth - 210);
        const font = measure.getAttribute("font-family");
        measure.remove();
        const rowStart = rowY;
        const rowWeight = wrapped.reduce((sum, content) => sum + Math.max(500, Array.from(content).length * 65), 0);
        let withinRow = 0;
        for (const content of wrapped) {
          const text = make("text");
          text.textContent = content;
          text.dataset.row = String(rowIndex);
          text.dataset.language = rtl ? "ar" : "en";
          text.setAttribute("x", rtl ? String(canvasWidth - 100) : "100");
          text.setAttribute("y", String(rowY));
          text.setAttribute("font-size", "34");
          text.setAttribute("font-family", font);
          text.setAttribute("font-weight", "600");
          text.setAttribute("direction", rtl ? "rtl" : "ltr");
          text.setAttribute("unicode-bidi", "plaintext");
          text.setAttribute("text-anchor", "start");
          text.setAttribute("fill", color);
          group.append(text);
          let box;
          try { box = text.getBBox(); } catch (_) { /* Geometry may be unavailable. */ }
          if (!box || !Number.isFinite(box.width) || box.width <= 0) {
            const width = Array.from(content).length * 18;
            box = { x: rtl ? canvasWidth - 100 - width : 100, y: rowY - 34, width, height: 44 };
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
          lines.push({ rect, box, rtl, speaker: row.speaker, row: rowIndex,
            start: totalWeight, weight, rowStart: withinRow, rowWeight });
          withinRow += weight;
          totalWeight += weight;
          rowY += 54;
        }
        const bullet = make("circle");
        bullet.setAttribute("cx", rtl ? String(canvasWidth - 58) : "58");
        bullet.setAttribute("cy", String(rowStart - 12));
        bullet.setAttribute("r", "7");
        bullet.setAttribute("fill", color);
        group.append(bullet);
        bottom = Math.max(bottom, rowY + 28);
        const paragraph = document.createElement("p");
        paragraph.className = "transcript-line";
        paragraph.dir = rtl ? "rtl" : "ltr";
        paragraph.dataset.speaker = String(row.speaker);
        paragraph.dataset.pair = String(blockIndex);
        paragraph.dataset.unpaired = String(block.length === 1);
        paragraph.style.textAlign = rtl ? "right" : "left";
        paragraph.style.borderInlineStartColor = color;
        paragraph.style.color = color;
        paragraph.textContent = row.text;
        transcript.append(paragraph);
      }
      if (background) background.setAttribute("height", String(bottom - start + 30));
      y = bottom + (background ? 16 : 0);
    }
    totalWeight = Math.max(1, totalWeight);
    rowBounds = originalStep.rows.map((_, row) => {
      const parts = lines.filter(line => line.row === row);
      return { start: Math.min(...parts.map(line => line.start)), end: Math.max(...parts.map(line => line.start + line.weight)) };
    });
    if (visualPlan) {
      // Silent reviews have no recording. Estimate their row clock from the
      // approved narration, not a one-character formula on the board. Measured
      // audio still uses PCM cues exclusively, never these estimated bounds.
      let cursor = 0;
      rowBounds = originalStep.rows.map((row, i) => {
        const speech = sceneEngine.rowText(visualPlan, current, i, row.text, true);
        const weight = Math.max(1000, Array.from(speech).length * 65);
        const bound = { start: cursor, end: cursor + weight }; cursor += weight; return bound;
      });
      totalWeight = cursor;
      if (visualPlan.origin) {
        const original = document.createElement("details"), heading = document.createElement("summary"), body = document.createElement("p");
        original.className = "visual-brief";
        heading.textContent = "الوصف الأصلي · محفوظ ولا يُنطق";
        body.textContent = visualPlan.origin.brief.text; body.dir = "auto";
        original.append(heading, body); transcript.append(original);
      }
      const description = document.createElement("p");
      description.className = "visual-description";
      description.textContent = visualPlan.steps[current].description;
      description.setAttribute("dir", "auto");
      transcript.prepend(description);
      originalStep.rows.forEach((row, i) => {
        const display = sceneEngine.rowText(visualPlan, current, i, row.text);
        const speech = sceneEngine.rowText(visualPlan, current, i, row.text, true);
        if (display !== speech) {
          const note = document.createElement("p"); note.dir = "auto";
          note.className = "visual-speech"; note.textContent = `${i + 1}. النطق المعتمد: ${speech}`;
          transcript.append(note);
        }
      });
      const original = document.createElement("details"), summary = document.createElement("summary"), raw = document.createElement("pre");
      original.className = "visual-source";
      summary.textContent = "النص الأصلي لهذه الخطوة";
      raw.dir = "auto";
      raw.textContent = originalStep.rows.map(row => lesson.dialogue ? `[${row.speaker}] ${row.text}` : row.text).join("\n");
      original.append(summary, raw); transcript.append(original);
    }
    svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${Math.max(430, y + 25)}`);
  }

  window.addEventListener("nova-whiteboard:appearance", () => {
    if (transition) { finishErase(); return; }
    const fraction = progress();
    layoutStep();
    if (!hasAudio) virtualTime = fraction * totalWeight;
    renderProgress(fraction);
    refreshButton();
  });

  function finishStep() {
    if (transition) return; // Ignore a late ended event from the outgoing clip.
    if (completed) return;
    completed = true;
    silentPlaying = false;
    cancelFrame();
    renderProgress(1, true);
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
    queueFrame();
  }

  function queueFrame() {
    const ticket = version;
    const id = requestAnimationFrame(timestamp => {
      if (ticket === version && frame === id) tick(timestamp);
    });
    frame = id;
  }

  function startFrame() {
    if (frame === null) { lastFrame = null; queueFrame(); }
  }

  async function play() {
    if (transition) return;
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

  function updateNavigation(index) {
    $("wb-previous").disabled = index === 0;
    $("wb-next").disabled = index + 1 === lesson.steps.length;
  }

  function clearErase() {
    const job = transition;
    if (!job) return null;
    transition = null;
    if (job.frame !== null) cancelAnimationFrame(job.frame);
    clearTimeout(job.timeout);
    rowsGroup.removeAttribute("clip-path");
    job.clip.remove();
    eraser.setAttribute("opacity", "0");
    eraser.removeAttribute("transform");
    svg.dataset.transition = "idle";
    svg.setAttribute("aria-busy", "false");
    playButton.disabled = false;
    $("wb-restart").disabled = false;
    return job;
  }

  function finishErase() {
    const job = clearErase();
    if (job) showStep(job.index, job.resume);
  }

  function drawErase(job, fraction) {
    const phase = fraction * 3, band = Math.min(2, Math.floor(phase));
    const local = clamp(phase - band), smooth = local * local * (3 - 2 * local);
    const x = job.width * (band % 2 ? smooth : 1 - smooth);
    job.rects.forEach((rect, index) => {
      const remaining = index < band ? 0 : index > band ? job.width : band % 2 ? job.width - x : x;
      rect.setAttribute("x", String(index === band && band % 2 ? x : 0));
      rect.setAttribute("width", String(remaining));
    });
    eraser.setAttribute("transform", `translate(${x} ${(band + 0.5) * job.height / 3}) rotate(${band % 2 ? 8 : -8})`);
  }

  function eraseFrame(job, timestamp) {
    if (transition !== job) return;
    job.frame = null;
    if (job.started === null) job.started = timestamp;
    const fraction = clamp((timestamp - job.started) / ERASE_MS);
    drawErase(job, fraction);
    if (fraction >= 1) finishErase();
    else job.frame = requestAnimationFrame(next => eraseFrame(job, next));
  }

  function navigate(index, continuePlaying = false) {
    if (!Number.isInteger(index) || index < 0 || index >= lesson.steps.length) return;
    if (transition) {
      // One bounded wipe, latest requested destination wins. No stacked delays.
      transition.index = index;
      transition.resume = continuePlaying;
      updateNavigation(index);
      return;
    }
    const visible = lines.some(line => Number(line.rect.getAttribute("width")) > 0) ||
      !!(sceneView && sceneView.hasVisibleContent());
    const viewBox = svg.getAttribute("viewBox").trim().split(/\s+/).map(Number);
    const [, , width, height] = viewBox;
    if (index === current || !visible || reducedMotion || document.hidden || !eraser ||
        !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      showStep(index, continuePlaying);
      return;
    }
    version++; // Invalidate a pending play promise BEFORE pausing the outgoing clip.
    const clip = make("clipPath"), rects = [];
    clip.id = "wb-erase-clip";
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");
    for (let band = 0; band < 3; band++) {
      const rect = make("rect");
      rect.setAttribute("x", "0"); rect.setAttribute("y", String(band * height / 3));
      rect.setAttribute("width", String(width)); rect.setAttribute("height", String(height / 3 + 0.5));
      clip.append(rect); rects.push(rect);
    }
    transition = { index, resume: continuePlaying, clip, rects, width, height, started: null, frame: null, timeout: null };
    cancelFrame();
    silentPlaying = false;
    if (hasAudio) audio.pause();
    defs.append(clip);
    rowsGroup.setAttribute("clip-path", "url(#wb-erase-clip)");
    const felt = $("wb-eraser-felt");
    felt.setAttribute("y", String(-height / 6 - 6));
    felt.setAttribute("height", String(height / 3 + 12));
    eraser.setAttribute("opacity", "1");
    pen.setAttribute("opacity", "0");
    $("board-placeholder").hidden = true;
    svg.dataset.transition = "erasing";
    svg.setAttribute("aria-busy", "true");
    playButton.disabled = true;
    $("wb-restart").disabled = true;
    $("writing-status").textContent = "نمسح السبورة للخطوة التالية…";
    updateNavigation(index);
    refreshButton();
    drawErase(transition, 0);
    // UI-only clock: never advances/offsets media time or the measured PCM map.
    const job = transition;
    job.frame = requestAnimationFrame(timestamp => eraseFrame(job, timestamp));
    job.timeout = setTimeout(() => { if (transition === job) finishErase(); }, 1000); // Throttled frame fallback.
  }

  function showStep(index, continuePlaying = false) {
    version++;
    cancelFrame();
    if (hasAudio) audio.pause();
    silentPlaying = false;
    completed = false;
    virtualTime = 0;
    current = index;
    $("scene-title").textContent = lesson.steps[index].title;
    $("scene-number").textContent = `الخطوة ${index + 1} من ${lesson.steps.length}`;
    updateNavigation(index);
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
      setStatus(timing
        ? "توقيت فعلي لكل سطر من عينات الصوت؛ الكتابة داخل السطر تقريبية." + (timing.steps[String(index)].audio_format === "mp3" ? " قد يضيف MP3 تأخيرًا صغيرًا؛ WAV أدق." : "")
        : "الصوت مضمّن لهذه الخطوة. تشغيله وتحريك الكتابة يستخدمان ساعة الصوت نفسها؛ المحاذاة داخل الخطوة تقريبية.");
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
  list.replaceChildren();
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
    button.addEventListener("click", () => navigate(index, continueAfterNavigation()));
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
  $("wb-restart").addEventListener("click", () => navigate(current, continueAfterNavigation()));
  $("wb-previous").addEventListener("click", () => navigate(navigationIndex() - 1, continueAfterNavigation()));
  $("wb-next").addEventListener("click", () => navigate(navigationIndex() + 1, continueAfterNavigation()));
  rateInput.addEventListener("input", event => setRate(event.target.value));
  $("wb-reset-rate").addEventListener("click", () => setRate(1));
  if (hasAudio) {
    audio.addEventListener("play", () => {
      if (transition) { audio.pause(); return; }
      completed = false;
      startFrame();
      refreshButton();
    });
    audio.addEventListener("pause", () => { cancelFrame(); renderProgress(progress()); refreshButton(); });
    for (const event of ["timeupdate", "seeking", "seeked", "loadedmetadata"]) audio.addEventListener(event, () => {
      if (transition) return;
      renderProgress(progress());
      if (progress() < 1) completed = false;
      refreshButton();
    });
    audio.addEventListener("ended", finishStep);
    audio.addEventListener("ratechange", () => setRate(audio.playbackRate));
    audio.addEventListener("error", () => {
      if (transition) return;
      cancelFrame();
      setStatus("تعذّر تشغيل الصوت المضمّن. جرّب متصفحًا حديثًا أو أعد توليده بصيغة MP3/WAV أخرى.");
      refreshButton();
    });
  }
  window.addEventListener("resize", () => {
    if ((window.innerWidth <= 720 ? 720 : 1200) !== canvasWidth) {
      if (transition) { finishErase(); return; }
      const value = progress();
      layoutStep();
      renderProgress(value);
    }
  });
  document.addEventListener("visibilitychange", () => {
    lastFrame = null;
    if (document.hidden && transition) finishErase();
  });
  if (motionQuery && typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", event => {
    reducedMotion = event.matches;
    if (reducedMotion && transition) finishErase();
    else renderProgress(progress(), completed);
  });
  window.addEventListener("pagehide", () => { version++; clearErase(); pause(); });
  window.addEventListener("keydown", event => {
    const target = event.target;
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat ||
        (target && (target.isContentEditable || target.closest("input,select,textarea,button,audio,summary")))) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); navigate(navigationIndex() + 1, continueAfterNavigation()); }
    else if (event.key === "ArrowRight") { event.preventDefault(); navigate(navigationIndex() - 1, continueAfterNavigation()); }
    else if (event.key === " ") { event.preventDefault(); if (isPlaying()) pause(); else void play(); }
  });
  // No timer monkey-patching, HTML execution service, Web Speech API or network.
  svg.dataset.transition = "idle";
  svg.setAttribute("aria-busy", "false");
  navigate(0);
  if (recordingNode && !hasAudio) setStatus("بيانات الصوت غير مكتملة. أعد إنشاء نسخة بالصوت من السبورة الأصلية.");
})();
