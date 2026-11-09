"use strict";
(() => {
  // Reusable parts, not actor/animal/cell templates. Pure row-clock poses only;
  // no script interpretation, generated code, network, assets or animation loop.
  const NS = "http://www.w3.org/2000/svg";
  const check = value => { if (!value) throw new Error("Invalid scene graph"); };
  const int = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
  const color = value => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  const keys = (value, allowed, required = allowed) => {
    check(value && typeof value === "object" && !Array.isArray(value));
    check(Object.keys(value).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(value, k)));
  };
  const name = value => typeof value === "string" && !!value.trim() && Array.from(value).length <= 80 && !/[\u0000-\u0008\u000b-\u001f]/.test(value) && !Array.from(value).some(c => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff);
  const clamp = v => Math.max(0, Math.min(1, v));
  const number = v => String(Math.abs(v) < 0.00005 ? 0 : Math.round(v * 10000) / 10000);
  const defaults = { dx: 0, dy: 0, angle: 0, scale: 100, opacity: 100, spin: 0 };
  const props = ["dx", "dy", "angle", "scale", "opacity", "fill", "spin"];
  const node = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  };
  let serial = 0;
  function validateStyle(e) {
    if (Object.hasOwn(e, "name")) check(name(e.name));
    if (Object.hasOwn(e, "gradient")) {
      keys(e.gradient, ["color", "axis"]);
      check(!["group", "icons", "calculation"].includes(e.kind) && color(e.fill) && color(e.gradient.color));
      check(["horizontal", "vertical", "radial"].includes(e.gradient.axis));
    }
  }
  function validateMotion(e, rows) {
    const m = e.motion;
    if (m.type === "curve") {
      keys(m, ["type", "points", "ease"], ["type", "points"]);
      check(Array.isArray(m.points) && [3, 4].includes(m.points.length));
      m.points.forEach(p => check(Array.isArray(p) && p.length === 2 && int(p[0], -300, 300) && int(p[1], -180, 180)));
      check(m.points[0][0] === 0 && m.points[0][1] === 0 && m.points.slice(1).some(p => p[0] || p[1]));
      check(["linear", "smooth"].includes(m.ease ?? "linear") && m.ease !== null);
      return;
    }
    keys(m, ["type", "frames", "repeat", "span", "cx", "cy", "ease"], ["type", "frames"]);
    const repeat = m.repeat ?? 1;
    check(int(repeat, 1, 6) && int(m.span ?? 1, 1, (e.until ?? rows) - e.row));
    check(int(m.cx ?? 0, 0, 1000) && int(m.cy ?? 0, 0, 420));
    check(["linear", "smooth"].includes(m.ease ?? "linear"));
    check(Object.values(m).every(v => v !== null));
    check(Array.isArray(m.frames) && m.frames.length >= 2 && m.frames.length <= 8);
    let previous = -1, fields = null;
    m.frames.forEach(f => {
      keys(f, ["at", ...props], ["at"]);
      const current = Object.keys(f).filter(k => k !== "at").sort();
      check(current.length > 0 && (fields === null || current.join() === fields.join())); fields = current;
      check(int(f.at, 0, 1000) && f.at > previous); previous = f.at;
      for (const [k, lo, hi] of [["dx", -300, 300], ["dy", -180, 180], ["angle", -720, 720], ["scale", 25, 200], ["opacity", 0, 100], ["spin", -720, 720]]) if (Object.hasOwn(f, k)) check(int(f[k], lo, hi));
      if (Object.hasOwn(f, "spin")) check(e.kind === "sphere");
      if (Object.hasOwn(f, "fill")) check(!["group", "icons", "calculation"].includes(e.kind) && !Object.hasOwn(e, "gradient") && color(e.fill) && color(f.fill));
    });
    check(m.frames[0].at === 0 && m.frames[m.frames.length - 1].at === 1000);
    if (repeat > 1) {
      check(!fields.includes("fill") && !fields.includes("opacity"));
      fields.forEach(k => { const diff = m.frames[m.frames.length - 1][k] - m.frames[0][k]; check(["angle", "spin"].includes(k) ? diff % 360 === 0 : diff === 0); });
    }
  }
  function validateGeometry(e) {
    if (e.kind === "sector") {
      check(int(e.r, 1, 200) && int(e.inner ?? 0, 0, e.r - 1) && int(e.start, -360, 360) && int(e.sweep, 1, 360));
    } else if (e.kind === "sphere") {
      check(int(e.r, 20, 180) && int(e.longitude ?? 0, -180, 180) && int(e.tilt ?? 0, -45, 45));
      check(typeof (e.grid ?? true) === "boolean");
      const patches = e.patches ?? []; check(Array.isArray(patches) && patches.length <= 8);
      patches.forEach(patch => {
        keys(patch, ["points", "fill"]); check(color(patch.fill));
        const points = patch.points; check(Array.isArray(points) && points.length >= 3 && points.length <= 24);
        points.forEach(p => check(Array.isArray(p) && p.length === 2 && int(p[0], -180, 180) && int(p[1], -85, 85)));
        const span = axis => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]));
        check(span(0) <= 120 && span(1) <= 120 && new Set(points.map(p => p.join())).size >= 3);
      });
    }
  }
  function curvePosition(points, fraction) {
    let work = points.map(p => p.slice()); const t = clamp(fraction);
    while (work.length > 1) work = work.slice(1).map((right, i) => right.map((v, axis) => work[i][axis] + (v - work[i][axis]) * t));
    return work[0];
  }
  function sequenceState(m, fraction) {
    const repeated = clamp(fraction) * (m.repeat ?? 1), local = fraction >= 1 ? 1 : repeated - Math.floor(repeated), at = local * 1000;
    let [a, b] = m.frames.slice(-2);
    for (let i = 1; i < m.frames.length; i++) if (at <= m.frames[i].at) { a = m.frames[i - 1]; b = m.frames[i]; break; }
    let t = clamp((at - a.at) / (b.at - a.at)); if (m.ease === "smooth") t = t * t * (3 - 2 * t);
    const state = { ...defaults };
    Object.keys(a).filter(k => k !== "at").forEach(k => {
      state[k] = k === "fill" ? "#" + [1, 3, 5].map(offset => Math.round(parseInt(a[k].slice(offset, offset + 2), 16) + (parseInt(b[k].slice(offset, offset + 2), 16) - parseInt(a[k].slice(offset, offset + 2), 16)) * t).toString(16).padStart(2, "0")).join("").toUpperCase() : a[k] + (b[k] - a[k]) * t;
    });
    return state;
  }
  function spherePoint(lon, lat, spin = 0, tilt = 0) {
    const rad = Math.PI / 180, l = (lon + spin) * rad, p = lat * rad, z = tilt * rad;
    const x = Math.cos(p) * Math.sin(l), y = -Math.sin(p);
    return [x * Math.cos(z) - y * Math.sin(z), x * Math.sin(z) + y * Math.cos(z), Math.cos(p) * Math.cos(l)];
  }
  function sectorPath(e) {
    const point = (r, at) => [e.x + r * Math.cos(at * Math.PI / 180), e.y + r * Math.sin(at * Math.PI / 180)].map(number).join(" ");
    const arc = (r, start, sweep, reverse = false) => {
      let d = ""; const n = Math.ceil(sweep / 180), delta = sweep / n;
      for (let i = 1; i <= n; i++) d += `A${r} ${r} 0 0 ${reverse ? 0 : 1} ${point(r, start + (reverse ? -1 : 1) * delta * i)}`;
      return d;
    };
    let d = "M" + point(e.r, e.start) + arc(e.r, e.start, e.sweep);
    if (e.inner) d += "L" + point(e.inner, e.start + e.sweep) + arc(e.inner, e.start + e.sweep, e.sweep, true);
    else if (e.sweep < 360) d += `L${e.x} ${e.y}`;
    return d + "Z";
  }
  function gradient(defs, from, to, axis = "radial", stops = null) {
    const id = "nova-graph-paint-" + (++serial);
    const g = node(axis === "radial" ? "radialGradient" : "linearGradient", axis === "radial" ? { id, cx: "32%", cy: "28%", r: "80%" } : { id, x1: "0%", y1: "0%", x2: axis === "horizontal" ? "100%" : "0%", y2: axis === "vertical" ? "100%" : "0%" });
    for (const [offset, fill, opacity] of stops || [["0%", from, 1], ["100%", to, 1]]) g.append(node("stop", { offset, "stop-color": fill, "stop-opacity": opacity }));
    defs.append(g); return `url(#${id})`;
  }
  function decorate(e, paints, defs) {
    if (e.gradient) { const fill = gradient(defs, e.fill, e.gradient.color, e.gradient.axis); paints.forEach(shape => shape.setAttribute("fill", fill)); }
  }
  const normal = v => { const n = Math.hypot(...v); return v.map(value => value / n); };
  function sphere(parent, e, defs) {
    const base = node("circle", { cx: e.x, cy: e.y, r: e.r, fill: e.fill ?? "#2563EB", "data-sphere-base": "true" }); parent.append(base);
    const patches = (e.patches ?? []).map(patch => {
      const samples = [];
      patch.points.forEach((p, i) => {
        const a = spherePoint(...p), b = spherePoint(...patch.points[(i + 1) % patch.points.length]);
        const angle = Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, axis) => sum + value * b[axis], 0))));
        const count = Math.max(1, Math.ceil(angle / (Math.PI / 36)));
        for (let k = 0; k < count; k++) samples.push(normal(a.map((v, axis) => v + (b[axis] - v) * k / count)));
      });
      const path = node("path", { fill: patch.fill, stroke: "none", "data-sphere-patch": "true" }); parent.append(path); return { samples, path };
    });
    const lines = [];
    if (e.grid ?? true) {
      for (const lat of [-60, -30, 0, 30, 60]) lines.push(Array.from({ length: 61 }, (_, i) => spherePoint(-180 + i * 6, lat)));
      for (let lon = -150; lon <= 180; lon += 30) lines.push(Array.from({ length: 31 }, (_, i) => spherePoint(lon, -90 + i * 6)));
    }
    const grid = node("path", { fill: "none", stroke: "#FFFFFF", "stroke-width": 1, opacity: 0.38, "data-sphere-grid": "true" }); parent.append(grid);
    const shine = gradient(defs, "#FFFFFF", "#334155", "radial", [["0%", "#FFFFFF", 0.30], ["48%", "#FFFFFF", 0], ["100%", "#334155", 0.45]]);
    parent.append(node("circle", { cx: e.x, cy: e.y, r: e.r, fill: shine, stroke: e.stroke ?? "#2563EB", "stroke-width": e.line_width ?? 3 }));
    let previous = null;
    function update(spin) {
      if (spin === previous) return; previous = spin;
      const turn = ((e.longitude ?? 0) + spin) * Math.PI / 180, tilt = (e.tilt ?? 0) * Math.PI / 180;
      const rotate = p => {
        const x = p[0] * Math.cos(turn) + p[2] * Math.sin(turn), y = p[1], z = -p[0] * Math.sin(turn) + p[2] * Math.cos(turn);
        return [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt), z];
      };
      const xy = p => [e.x + p[0] * e.r, e.y + p[1] * e.r];
      const point = p => xy(p).map(number).join(" ");
      for (const { samples, path } of patches) {
        const transformed = samples.map(rotate), visible = [];
        let last = transformed[transformed.length - 1];
        for (const current of transformed) {
          const a = last[2] >= 0, b = current[2] >= 0;
          if (a !== b) {
            const t = last[2] / (last[2] - current[2]), edge = normal(last.map((v, i) => v + (current[i] - v) * t));
            visible.push({ p: edge, rim: b });
          }
          if (b) visible.push({ p: current, rim: false });
          last = current;
        }
        let d = "";
        if (visible.length >= 3) {
          d = "M" + point(visible[0].p);
          for (let i = 1; i <= visible.length; i++) {
            const a = visible[(i - 1) % visible.length], b = visible[i % visible.length];
            if (b.rim) {
              const from = Math.atan2(a.p[1], a.p[0]), to = Math.atan2(b.p[1], b.p[0]);
              const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
              d += `A${e.r} ${e.r} 0 0 ${delta >= 0 ? 1 : 0} ${point(b.p)}`;
            } else d += "L" + point(b.p);
          }
          d += "Z";
        }
        path.setAttribute("d", d);
      }
      grid.setAttribute("d", lines.map(line => {
        let d = "", continuing = false;
        line.map(rotate).forEach(p => { if (p[2] >= -0.00000001) { d += (continuing ? "L" : "M") + point(p); continuing = true; } else continuing = false; });
        return d;
      }).join(""));
      parent.dataset.surfaceSpin = number(spin);
    }
    update(0); return { update, paints: [base] };
  }
  function printInfo(elements, row, rows, bounds = null) {
    bounds = bounds || Array.from({ length: rows }, (_, i) => ({ start: i, end: i + 1 }));
    const visible = [], motions = []; let composed = false;
    function visit(items, path = "", parentVisible = true) {
      items.forEach((e, i) => {
        const id = path + i, shown = parentVisible && e.row <= row && (e.until ?? rows) > row;
        if (!shown) return;
        if (e.kind === "group") { composed = true; visit(e.children, id + ".", shown); }
        else visible.push(id);
        if (["group", "sphere", "sector"].includes(e.kind)) composed = true;
        const m = e.motion;
        if (m && (m.type === "sequence" ? row < e.row + (m.span ?? 1) : row === e.row)) motions.push({ e, m });
      });
    }
    visit(elements);
    const advanced = motions.some(({ m }) => ["sequence", "curve"].includes(m.type));
    const moving = advanced || motions.some(({ m }) => ["path", "rotate"].includes(m.type));
    const poses = new Set(moving ? advanced ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1] : [1]);
    for (const { e, m } of motions) if (m.type === "sequence") {
      const start = bounds[e.row].start, finish = bounds[e.row + (m.span ?? 1) - 1].end;
      const rowStart = bounds[row].start, rowLength = bounds[row].end - rowStart;
      const cycleLength = (finish - start) / (m.repeat ?? 1);
      // Include one representative cycle, even when uniform quarter-row
      // samples would alias a repeated gait to an apparently stationary pose.
      const cycle = Math.min((m.repeat ?? 1) - 1, Math.ceil((rowStart - start) / cycleLength));
      const times = m.frames.map(f => f.at / 1000);
      const sample = times.concat(times.slice(1).map((v, i) => (v + times[i]) / 2));
      for (const loop of new Set([Math.max(0, cycle - 1), Math.max(0, cycle)])) for (const v of sample) {
        const at = (start + (loop + v) * cycleLength - rowStart) / rowLength;
        if (at >= 0 && at <= 1) poses.add(at);
      }
    }
    let selected = [...poses].sort((a, b) => a - b);
    if (selected.length > 8) selected = Array.from({ length: 8 }, (_, i) => selected[Math.floor(i * (selected.length - 1) / 7)]);
    return { visible: visible.length, key: visible.join(",") + ((composed || advanced) && moving ? "@" + row : ""), poses: selected, advanced };
  }
  window.novaSceneGraph = { validateStyle, validateMotion, validateGeometry, name, number, curvePosition, sequenceState, spherePoint, sectorPath, decorate, sphere, printInfo };
})();
