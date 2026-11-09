"use strict";
(() => {
  // Declarative primitives only. No innerHTML, generated code, external URLs,
  // images, SMIL, animation timers or document-wide element IDs from the plan.
  const NS = "http://www.w3.org/2000/svg";
  const kinds = {
    rect: ["w", "h", "radius"], circle: ["r"], ellipse: ["rx", "ry"],
    line: ["x2", "y2"], arrow: ["x2", "y2"], polygon: ["points"], polyline: ["points"],
    path: ["d"], text: ["text", "size", "align", "direction"],
    icons: ["icon", "count", "columns", "size"],
    right_triangle: ["a", "b", "w", "h", "unit"], calculation: ["a", "b", "op", "size"],
  };
  const icons = ["apple", "ball", "block", "leaf", "star", "sun", "cloud", "drop", "book", "person"];
  const common = ["kind", "row", "until", "x", "y", "fill", "stroke", "line_width", "dx", "dy"];
  const integer = (v, a, b) => Number.isSafeInteger(v) && v >= a && v <= b;
  const text = (v, n, empty = false) => typeof v === "string" && (empty || !!v.trim()) && Array.from(v).length <= n && !/[\u0000-\u0008\u000b-\u001f]/.test(v) && !Array.from(v).some(c => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff);
  const check = condition => { if (!condition) throw new Error("Invalid visual plan"); };
  function keys(value, allowed, required = allowed) {
    check(value && typeof value === "object" && !Array.isArray(value));
    check(Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.prototype.hasOwnProperty.call(value, key)));
  }
  function validateElement(e, rows) {
    check(e && typeof e.kind === "string" && Object.prototype.hasOwnProperty.call(kinds, e.kind));
    keys(e, common.concat(kinds[e.kind]), ["kind", "row", "x", "y"]);
    check(Object.values(e).every(value => value !== null));
    check(integer(e.row, 0, rows - 1) && integer(e.until ?? rows, e.row + 1, rows));
    check(integer(e.x, 0, 1000) && integer(e.y, 0, 420));
    for (const key of ["dx", "dy"]) check(integer(e[key] ?? 0, -1000, 1000));
    for (const key of ["fill", "stroke"]) check(typeof (e[key] ?? "none") === "string" && /^(none|#[0-9a-fA-F]{6})$/.test(e[key] ?? "none"));
    check(integer(e.line_width ?? 3, 1, 12));
    const n = (key, a, b, fallback) => check(integer(e[key] ?? fallback, a, b));
    switch (e.kind) {
      case "rect": n("w", 1, 1000 - e.x); n("h", 1, 420 - e.y); n("radius", 0, 60, 0); break;
      case "circle": n("r", 1, 200); break;
      case "ellipse": n("rx", 1, 400); n("ry", 1, 200); break;
      case "arrow": case "line": n("x2", 0, 1000); n("y2", 0, 420); break;
      case "polygon": case "polyline":
        check(Array.isArray(e.points) && e.points.length >= (e.kind === "polygon" ? 3 : 2) && e.points.length <= 40);
        e.points.forEach(p => check(Array.isArray(p) && p.length === 2 && integer(p[0], 0, 1000) && integer(p[1], 0, 420))); break;
      case "path": {
        check(typeof e.d === "string" && e.d.length > 0 && e.d.length <= 2000 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(e.d) && /^[Mm]/.test(e.d.trimStart()));
        const numbers = e.d.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
        check(numbers.length <= 400 && numbers.every(v => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 5000)); break;
      }
      case "text":
        check(text(e.text, 120)); n("size", 12, 64, 28);
        check(["start", "middle", "end"].includes(e.align ?? "middle") && ["auto", "rtl", "ltr"].includes(e.direction ?? "auto")); break;
      case "icons":
        check(icons.includes(e.icon)); n("count", 0, 20); n("columns", 1, 10); n("size", 24, 100);
        check(e.x + Math.min(e.count, e.columns) * e.size <= 1000 && e.y + Math.ceil(e.count / e.columns) * e.size <= 420); break;
      case "right_triangle":
        n("a", 1, 100); n("b", 1, 100); n("w", 40, 1000 - e.x); n("h", 40, 370 - e.y); check(e.x >= 90);
        check(text(e.unit ?? "", 12, true)); break;
      case "calculation":
        n("a", -1000, 1000); n("b", -1000, 1000); n("size", 16, 60, 36);
        check(["+", "-", "*", "/"].includes(e.op) && !(e.op === "/" && e.b === 0)); break;
    }
  }
  function read(lesson) {
    if (lesson.schema === 1 && !Object.prototype.hasOwnProperty.call(lesson, "visuals")) return null;
    keys(lesson, ["schema", "script", "title", "dialogue", "steps", "visuals", "fingerprint"]);
    check(lesson.schema === 2 && typeof lesson.dialogue === "boolean" && text(lesson.script, 100000) && text(lesson.title, 120));
    check(Array.isArray(lesson.steps) && lesson.steps.length > 0 && lesson.steps.length <= 120);
    lesson.steps.forEach(step => {
      keys(step, ["title", "rows"]); check(text(step.title, 140) && Array.isArray(step.rows) && step.rows.length > 0 && step.rows.length <= 6);
      step.rows.forEach(row => { keys(row, ["speaker", "text"]); check([1, 2].includes(row.speaker) && text(row.text, 180)); });
    });
    const p = lesson.visuals;
    keys(p, ["schema", "source_fingerprint", "subject", "grade", "policy", "notes", "steps", ...(p.schema === 2 ? ["origin"] : [])]);
    check([1, 2].includes(p.schema) && text(p.subject, 80, true) && text(p.grade, 80, true) && ["general", "sacred"].includes(p.policy));
    check(Array.isArray(p.notes) && p.notes.length <= 12 && p.notes.every(n => text(n, 400)));
    check(Array.isArray(p.steps) && p.steps.length === lesson.steps.length && JSON.stringify(p).length <= 524288);
    let count = 0, spoken = lesson.steps.reduce((sum, step) => sum + step.rows.reduce((n, r) => n + Array.from(r.text).length, 0), 0);
    p.steps.forEach((step, index) => {
      keys(step, ["index", "description", "rows", "elements"]);
      check(step.index === index && text(step.description, 400) && Array.isArray(step.rows) && step.rows.length <= lesson.steps[index].rows.length);
      const seen = new Set();
      step.rows.forEach(row => {
        keys(row, ["index", "display", "speech"]);
        check(integer(row.index, 0, lesson.steps[index].rows.length - 1) && !seen.has(row.index) && text(row.display, 180) && text(row.speech, 480));
        check(/[\p{L}\p{N}]/u.test(row.speech) && !/\[[ \t]*(?:[12١٢ABab]\]|\/|[0-9٠-٩])|^[ \t]*(?:[12١٢ABab][ \t]*[:：]|\[[^\]\n]*\]|(?:[0-9٠-٩]+|[A-Za-z])[ \t]*[:：])/m.test(row.speech));
        seen.add(row.index); spoken += Array.from(row.speech).length - Array.from(lesson.steps[index].rows[row.index].text).length;
      });
      check(Array.isArray(step.elements) && step.elements.length <= 60);
      step.elements.forEach(e => validateElement(e, lesson.steps[index].rows.length)); count += step.elements.length;
      if (p.policy === "sacred") check(step.elements.length === 0 && step.rows.length === 0 && step.description === lesson.steps[index].title);
    });
    check(count <= 600 && spoken > 0 && spoken <= 100000);
    const fingerprint = window.novaWhiteboardTiming.fingerprint;
    const source = { schema: 1, script: lesson.script, title: lesson.title, dialogue: lesson.dialogue, steps: lesson.steps };
    check(fingerprint(source) === p.source_fingerprint);
    if (p.schema === 2) {
      check(p.policy === "general");
      const origin = p.origin; keys(origin, ["kind", "brief", "draft_fingerprint", "source_fingerprint"]);
      check(origin.kind === "expanded-lesson" && origin.source_fingerprint === p.source_fingerprint && typeof origin.draft_fingerprint === "string" && /^[0-9a-f]{64}$/.test(origin.draft_fingerprint));
      const b = origin.brief; keys(b, ["text", "subject", "grade", "policy", "fingerprint"]);
      check(text(b.text, 4000) && text(b.subject, 80, true) && text(b.grade, 80, true) && b.policy === "general");
      check(b.subject === p.subject && b.grade === p.grade);
      check(fingerprint({text:b.text, subject:b.subject, grade:b.grade, policy:b.policy}) === b.fingerprint);
    }
    const payload = Object.fromEntries(Object.entries(lesson).filter(([key]) => key !== "fingerprint"));
    check(fingerprint(payload) === lesson.fingerprint);
    return p;
  }
  function rowText(plan, step, row, original, speech = false) {
    const override = plan && plan.steps[step].rows.find(r => r.index === row);
    return override ? override[speech ? "speech" : "display"] : original;
  }
  function node(tag, attrs = {}, content) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (content !== undefined) el.textContent = String(content);
    return el;
  }
  function label(parent, x, y, value, size = 28, anchor = "middle", direction = "ltr") {
    parent.append(node("text", { x, y, "font-size": size, "text-anchor": anchor, direction, "unicode-bidi": "plaintext", "font-family": "'Segoe UI',Tahoma,Arial,sans-serif", fill: "#334155", stroke: "none", "font-weight": 600 }, value));
  }
  function icon(parent, name) {
    // Original local vector symbols. Their IDs/markup never come from a model.
    const p = (d, fill, stroke = "#475569") => parent.append(node("path", { d, fill, stroke, "stroke-width": 2.5, "stroke-linejoin": "round" }));
    if (name === "apple") { p("M50 28C22 10 9 45 23 75C32 95 45 84 50 86C56 84 69 95 79 74C93 44 78 9 50 28Z", "#FF5722"); p("M50 28Q46 10 57 6M53 20Q62 3 78 10Q70 25 53 20", "#65A30D"); }
    else if (name === "ball") { parent.append(node("circle", { cx: 50, cy: 50, r: 38, fill: "#FFB000", stroke: "#C2410C", "stroke-width": 3 })); p("M12 50H88M50 12Q25 50 50 88M50 12Q75 50 50 88", "none"); }
    else if (name === "block") { p("M15 25L68 12L88 35L35 49Z", "#93C5FD"); p("M15 25V76L35 92V49Z", "#2563EB"); p("M35 49L88 35V78L35 92Z", "#FFB000"); }
    else if (name === "leaf") { p("M18 85Q1 18 86 12Q100 82 18 85Z", "#65A30D"); p("M18 85L76 24M35 68L31 43M52 52L74 54", "none"); }
    else if (name === "star") p("M50 8L62 35L92 38L69 59L75 90L50 74L25 90L31 59L8 38L38 35Z", "#FFB000");
    else if (name === "sun") { p("M50 4V16M50 84V96M4 50H16M84 50H96M17 17L26 26M74 74L83 83M17 83L26 74M74 26L83 17", "none", "#C2410C"); parent.append(node("circle", { cx: 50, cy: 50, r: 28, fill: "#FFB000", stroke: "#C2410C", "stroke-width": 3 })); }
    else if (name === "cloud") p("M24 76C0 75 0 43 23 40C23 8 71 5 77 37C104 34 108 75 80 76Z", "#E2E8F0");
    else if (name === "drop") p("M50 6C48 28 16 43 20 65C25 103 81 103 83 65C84 45 56 25 50 6Z", "#38BDF8");
    else if (name === "book") { p("M50 25Q25 12 8 20V80Q30 72 50 88Q71 72 92 80V20Q74 12 50 25Z", "#DBEAFE"); p("M50 25V88M18 35L39 41M18 49L39 55M62 41L82 35M62 55L82 49", "none", "#2563EB"); }
    else if (name === "person") { parent.append(node("circle", { cx: 50, cy: 22, r: 14, fill: "#F5D0A9", stroke: "#475569", "stroke-width": 2 })); p("M28 84V56Q29 38 50 38Q71 38 72 56V84Z", "#2563EB"); p("M39 84V98M61 84V98", "none"); }
  }
  function calculation(a, b, op) {
    check(integer(a, -1000, 1000) && integer(b, -1000, 1000) && ["+", "-", "*", "/"].includes(op) && !(op === "/" && b === 0));
    if (op === "+") return String(a + b);
    if (op === "-") return String(a - b);
    if (op === "*") return String(a * b);
    const gcd = (x, y) => y ? gcd(y, x % y) : x;
    const g = gcd(Math.abs(a), Math.abs(b));
    const top = (b < 0 ? -a : a) / g, bottom = Math.abs(b) / g;
    return bottom === 1 ? String(top) : `${top}/${bottom}`;
  }
  function draw(group, e) {
    const style = { fill: e.fill ?? "none", stroke: e.stroke ?? "#2563EB", "stroke-width": e.line_width ?? 3, "stroke-linejoin": "round", "stroke-linecap": "round" };
    const xy = { x: e.x, y: e.y };
    switch (e.kind) {
      case "rect": group.append(node("rect", { ...style, ...xy, width: e.w, height: e.h, rx: e.radius ?? 0 })); break;
      case "circle": group.append(node("circle", { ...style, cx: e.x, cy: e.y, r: e.r })); break;
      case "ellipse": group.append(node("ellipse", { ...style, cx: e.x, cy: e.y, rx: e.rx, ry: e.ry })); break;
      case "line": case "arrow": {
        group.append(node("line", { ...style, x1: e.x, y1: e.y, x2: e.x2, y2: e.y2 }));
        if (e.kind === "arrow") {
          const angle = Math.atan2(e.y2 - e.y, e.x2 - e.x), a = Math.PI / 6;
          const x = e.x2, y = e.y2;
          group.append(node("path", { ...style, d: `M${x - 14 * Math.cos(angle - a)} ${y - 14 * Math.sin(angle - a)}L${x} ${y}L${x - 14 * Math.cos(angle + a)} ${y - 14 * Math.sin(angle + a)}` }));
        } break;
      }
      case "polygon": case "polyline": group.append(node(e.kind, { ...style, points: e.points.map(p => p.join(",")).join(" ") })); break;
      case "path": group.append(node("path", { ...style, d: e.d })); break;
      case "text": {
        const direction = e.direction === "auto" || !e.direction ? (/\p{Script=Arabic}/u.test(e.text) ? "rtl" : "ltr") : e.direction;
        label(group, e.x, e.y, e.text, e.size ?? 28, e.align ?? "middle", direction);
        group.lastChild.setAttribute("fill", e.fill && e.fill !== "none" ? e.fill : "#334155"); break;
      }
      case "icons":
        for (let i = 0; i < e.count; i++) {
          const item = node("g", { transform: `translate(${e.x + (i % e.columns) * e.size} ${e.y + Math.floor(i / e.columns) * e.size}) scale(${e.size / 100})`, "data-icon": e.icon });
          icon(item, e.icon); group.append(item);
        } break;
      case "right_triangle": {
        // Uniform scale keeps both leg lengths and the right angle correct.
        const scale = Math.min(e.w / e.a, e.h / e.b), w = e.a * scale, h = e.b * scale;
        group.append(node("path", { ...style, fill: e.fill ?? "#DBEAFE", d: `M${e.x} ${e.y}v${h}h${w}Z` }));
        const corner = Math.min(20, w / 4, h / 4);
        group.append(node("path", { ...style, fill: "none", d: `M${e.x} ${e.y + h - corner}h${corner}v${corner}` }));
        label(group, e.x + w / 2, e.y + h + 40, `${e.a} ${e.unit ?? ""}`, 40);
        label(group, Math.max(20, e.x - 80), e.y + h / 2, `${e.b} ${e.unit ?? ""}`, 40); break;
      }
      case "calculation": {
        const op = { "+": "+", "-": "−", "*": "×", "/": "÷" }[e.op];
        const result = calculation(e.a, e.b, e.op);
        label(group, e.x, e.y, `${e.a} ${op} ${e.b} = ${result}`, e.size ?? 36);
        group.dataset.result = result; break;
      }
    }
  }
  function mount(parent, step, width, top, version) {
    const frame = node("svg", { x: 35, y: top, width: width - 70, height: (width - 70) * 420 / 1000, viewBox: "0 0 1000 420", overflow: "hidden", "data-visual-scene": String(version), "aria-hidden": "true", "pointer-events": "none" });
    frame.append(node("rect", { x: 0, y: 0, width: 1000, height: 420, rx: 18, fill: "#F8FAFC", stroke: "#E2E8F0", "stroke-width": 2 }));
    const groups = step.elements.map((e, i) => {
      const g = node("g", { opacity: 0, "data-scene-element": i }); draw(g, e); frame.append(g); return { e, g };
    });
    parent.append(frame);
    return {
      bottom: top + (width - 70) * 420 / 1000 + 55,
      hasVisibleContent: () => groups.some(({ g }) => g.childNodes.length > 0 && g.getAttribute("opacity") === "1"),
      update(bounds, now, reduced) {
        groups.forEach(({ e, g }) => {
          const start = bounds[e.row].start, end = bounds[e.row].end;
          const until = e.until ?? bounds.length;
          const visible = now >= start && (until === bounds.length || now < bounds[until].start);
          const part = reduced ? 1 : Math.max(0, Math.min(1, (now - start) / Math.max(1, (end - start) * 0.6)));
          g.setAttribute("opacity", visible ? "1" : "0");
          g.setAttribute("transform", `translate(${(e.dx ?? 0) * (1 - part)} ${(e.dy ?? 0) * (1 - part)})`);
        });
      },
    };
  }
  window.novaWhiteboardScenes = { read, rowText, mount, calculation };
})();
