"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const lesson = JSON.parse($("nova-whiteboard-data").textContent);
  const settingsNode = $("nova-whiteboard-appearance");
  const catalog = JSON.parse($("nova-character-catalog").textContent);
  const known = new Set(["none", "adam", "omar", "youssef", "layla", "nour", "salma"]);
  const defaults = () => ({ version: 1, first_color: "#2563EB", second_color: "#C2410C", first_character: "none", second_character: "none", animate_characters: true, row_colors: [], layout: "stacked" });
  const validColor = value => typeof value === "string" && value.length === 7 && /^#[0-9a-f]{6}$/i.test(value);
  const safeJSON = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/&/g, "\\u0026");
  function validated(value) {
    if (!value || value.version !== 1 || !validColor(value.first_color) || !validColor(value.second_color) ||
        !known.has(value.first_character) || !known.has(value.second_character) || typeof value.animate_characters !== "boolean" ||
        !(value.layout === undefined || ["stacked", "columns", "script"].includes(value.layout)) ||
        !Array.isArray(value.row_colors) || value.row_colors.length > 720) return null;
    const seen = new Set();
    for (const item of value.row_colors) {
      if (!item || !Number.isInteger(item.step) || !Number.isInteger(item.row) ||
          !lesson.steps[item.step] || !lesson.steps[item.step].rows[item.row] || !validColor(item.color)) return null;
      const key = `${item.step}:${item.row}`;
      if (seen.has(key)) return null;
      seen.add(key);
    }
    return {
      version: 1, first_color: value.first_color.toUpperCase(), second_color: value.second_color.toUpperCase(),
      first_character: value.first_character, second_character: value.second_character,
      animate_characters: value.animate_characters, layout: value.layout || "script",
      row_colors: value.row_colors.map(item => ({ step: item.step, row: item.row, color: item.color.toUpperCase() })),
    };
  }
  let settings = defaults();
  try { settings = validated(JSON.parse(settingsNode.textContent)) || defaults(); } catch (_) { /* Safe, readable defaults. */ }
  let current = 0, activeRole = 1, playing = false, rate = 1;
  let lastActive = "";
  const motionQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const roleKey = role => role === 2 ? "second_character" : "first_character";
  const baseColor = role => role === 2 ? settings.second_color : settings.first_color;
  const colorFor = (step, row, role) => {
    const custom = settings.row_colors.find(item => item.step === step && item.row === row);
    return custom ? custom.color : baseColor(role);
  };
  const message = text => { $("wb-customization-status").textContent = text; };
  const characterName = key => key === "none" ? "بدون شخصية" : catalog.find(item => item.id === key).name;
  function characterArt(key) {
    const template = $("nova-character-" + key);
    return known.has(key) && template ? template.content.cloneNode(true) : document.createDocumentFragment();
  }
  function updateMotion(force = false) {
    const moving = playing && settings.animate_characters && !(motionQuery && motionQuery.matches) && !document.hidden;
    const stamp = `${moving}:${activeRole}:${rate}`;
    if (!force && stamp === lastActive) return;
    lastActive = stamp;
    for (const role of [1, 2]) {
      const card = $("character-role-" + role);
      const visible = settings[roleKey(role)] !== "none" && (role === 1 || lesson.dialogue);
      card.classList.toggle("is-active", visible && playing && role === activeRole);
      card.classList.toggle("is-moving", visible && moving && role === activeRole);
      card.style.setProperty("--buddy-duration", `${1.8 / Math.max(0.5, rate)}s`);
    }
  }
  function updateStage() {
    for (const role of [1, 2]) {
      const card = $("character-role-" + role);
      const key = settings[roleKey(role)];
      card.hidden = key === "none" || (role === 2 && !lesson.dialogue);
      card.querySelector(".character-art").replaceChildren(characterArt(key));
      card.querySelector(".character-caption").textContent = `الدور ${role} · ${characterName(key)}`;
      card.dataset.character = key;
    }
    $("character-stage").hidden = $("character-role-1").hidden && $("character-role-2").hidden;
    updateMotion(true);
  }
  function syncSentenceColor() {
    const row = Number($("wb-sentence").value);
    if (lesson.steps[current].rows[row]) $("wb-sentence-color").value = colorFor(current, row, lesson.steps[current].rows[row].speaker);
  }
  function updateSentences() {
    const picker = $("wb-sentence");
    picker.replaceChildren();
    lesson.steps[current].rows.forEach((row, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      const display = lesson.visuals && window.novaWhiteboardScenes
        ? window.novaWhiteboardScenes.rowText(lesson.visuals, current, index, row.text) : row.text;
      option.textContent = `${index + 1}. ${display.slice(0, 90)}`;
      picker.append(option);
    });
    syncSentenceColor();
  }
  function updateLibrary() {
    const role = Number($("wb-character-role").value);
    const filter = $("wb-character-filter").value;
    const library = $("wb-character-library");
    library.replaceChildren();
    const items = [{ id: "none", name: "بدون شخصية", kind: "all" }, ...catalog];
    for (const item of items) {
      if (item.id !== "none" && filter !== "all" && item.kind !== filter) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "character-option";
      button.dataset.character = item.id;
      button.setAttribute("aria-pressed", String(settings[roleKey(role)] === item.id));
      button.setAttribute("aria-label", `${item.name} للدور ${role}`);
      const art = document.createElement("span");
      art.className = "character-thumbnail";
      art.setAttribute("aria-hidden", "true");
      if (item.id === "none") art.textContent = "—";
      else art.append(characterArt(item.id));
      const caption = document.createElement("span");
      caption.textContent = item.name;
      button.append(art, caption);
      button.addEventListener("click", () => {
        settings[roleKey(role)] = item.id;
        updateStage(); updateLibrary(); commit(false);
      });
      library.append(button);
    }
  }
  function commit(relayout = true) {
    settingsNode.textContent = safeJSON(settings);
    syncSentenceColor();
    message("تم تطبيق التخصيص في هذه الجلسة. اضغط تنزيل نسخة بالتخصيصات للاحتفاظ به؛ لا تتغير الأصوات.");
    if (relayout) window.dispatchEvent(new CustomEvent("nova-whiteboard:appearance"));
  }
  for (const role of [1, 2]) {
    const input = $("wb-color-" + role);
    input.value = baseColor(role);
    input.addEventListener("input", () => {
      if (!validColor(input.value)) return;
      settings[role === 1 ? "first_color" : "second_color"] = input.value.toUpperCase();
      commit();
    });
  }
  $("wb-language-layout").value = settings.layout;
  $("wb-language-layout").addEventListener("change", event => {
    if (!["stacked", "columns", "script"].includes(event.target.value)) return;
    settings.layout = event.target.value;
    commit();
  });
  $("wb-sentence").addEventListener("change", syncSentenceColor);
  $("wb-sentence-color").addEventListener("input", event => {
    const row = Number($("wb-sentence").value);
    if (!Number.isInteger(row) || !lesson.steps[current].rows[row] || !validColor(event.target.value)) return;
    settings.row_colors = settings.row_colors.filter(item => item.step !== current || item.row !== row);
    settings.row_colors.push({ step: current, row, color: event.target.value.toUpperCase() });
    commit();
  });
  $("wb-clear-sentence-color").addEventListener("click", () => {
    const row = Number($("wb-sentence").value);
    settings.row_colors = settings.row_colors.filter(item => item.step !== current || item.row !== row);
    commit();
  });
  $("wb-character-role").querySelector('option[value="2"]').disabled = !lesson.dialogue;
  $("wb-color-2").disabled = !lesson.dialogue;
  $("wb-character-role").addEventListener("change", updateLibrary);
  $("wb-character-filter").addEventListener("change", updateLibrary);
  $("wb-character-motion").checked = settings.animate_characters;
  $("wb-character-motion").addEventListener("change", event => {
    settings.animate_characters = event.target.checked;
    updateMotion(true); commit(false);
  });
  $("wb-reset-appearance").addEventListener("click", () => {
    settings = defaults();
    $("wb-color-1").value = settings.first_color;
    $("wb-color-2").value = settings.second_color;
    $("wb-character-motion").checked = true;
    $("wb-language-layout").value = settings.layout;
    updateLibrary(); updateStage(); commit();
  });
  $("wb-save-customized").addEventListener("click", () => {
    try {
      if (typeof URL.createObjectURL !== "function") throw new Error("Download API unavailable");
      const copy = document.documentElement.cloneNode(true);
      copy.querySelector("#nova-whiteboard-appearance").textContent = safeJSON(settings);
      // Do not duplicate a live base64 audio src; the original per-step recording
      // nodes are preserved and the controller restores the first clip on load.
      copy.querySelector("#wb-audio").removeAttribute("src");
      copy.querySelector("#wb-rows").replaceChildren();
      copy.querySelector("#wb-rows").removeAttribute("clip-path");
      copy.querySelector("#whiteboard").dataset.transition = "idle";
      copy.querySelector("#whiteboard").setAttribute("aria-busy", "false");
      copy.querySelector("#wb-eraser").setAttribute("opacity", "0");
      copy.querySelector("#wb-eraser").removeAttribute("transform");
      copy.querySelector("#wb-pen").setAttribute("opacity", "0");
      copy.querySelector("#wb-play").disabled = false;
      copy.querySelector("#wb-restart").disabled = false;
      // Review/output state is deliberately ephemeral, not an export credential.
      copy.querySelector("#wb-print-root").replaceChildren();
      copy.querySelector("#wb-print-root").removeAttribute("data-preview");
      copy.querySelector("#wb-print-root").removeAttribute("data-ink");
      copy.querySelector("#wb-output-review").removeAttribute("checked");
      copy.querySelector("#wb-print-close").hidden = true;
      copy.querySelector("#wb-video-canvas").hidden = true;
      copy.querySelector("#wb-video-progress").hidden = true;
      copy.querySelector("#wb-video-progress").value = 0;
      ["wb-print", "wb-print-preview", "wb-video", "wb-video-cancel"].forEach(id => { copy.querySelector("#" + id).disabled = true; });
      copy.querySelector("body").removeAttribute("data-nova-exporting");
      copy.querySelector("#wb-defs").replaceChildren();
      copy.querySelector("#lesson-outline").replaceChildren();
      copy.querySelector("#wb-character-library").replaceChildren();
      copy.querySelector("#wb-sentence").replaceChildren();
      copy.querySelectorAll(".character-art").forEach(node => node.replaceChildren());
      copy.querySelectorAll(".is-moving,.is-active").forEach(node => node.classList.remove("is-moving", "is-active"));
      const blob = new Blob(["\ufeff<!doctype html>\n", copy.outerHTML], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "NovaVoice-" + String(lesson.title).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 70) + "-custom.html";
      document.body.append(link);
      link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("طُلب تنزيل نسخة بالتخصيصات. افتح الملف الجديد للتأكد؛ للسبورة الصامتة اختره في الخطوة 2 لإضافة الصوت بنفس المظهر.");
    } catch (_) {
      message("لم يبدأ تنزيل النسخة. استخدم متصفحًا حديثًا يسمح بتنزيل الملفات المحلية ثم حاول مجددًا.");
    }
  });
  window.addEventListener("nova-whiteboard:state", event => {
    if (Number.isInteger(event.detail.step) && event.detail.step - 1 !== current) {
      current = event.detail.step - 1;
      updateSentences();
    }
    playing = !!event.detail.playing;
    rate = event.detail.rate;
    updateMotion();
  });
  document.addEventListener("visibilitychange", () => updateMotion(true));
  if (motionQuery && typeof motionQuery.addEventListener === "function") motionQuery.addEventListener("change", () => updateMotion(true));
  window.addEventListener("pagehide", () => { playing = false; updateMotion(true); });
  window.novaWhiteboardAppearance = {
    colorFor,
    layout: () => settings.layout,
    setActiveSpeaker(role, moving) { activeRole = role; playing = moving; updateMotion(); },
  };
  updateSentences(); updateStage(); updateLibrary();
})();
