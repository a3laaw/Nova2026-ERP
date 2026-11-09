"use strict";
(() => {
  // Pinned numeric paths only. This module has NO fetch, parser for markup,
  // plugin loader, image URL, local storage, runtime downloader or code evaluation.
  const PIN = "82d948812bfe3f269ef8f731dcdb07b08160edc4";
  const ready = new WeakMap();
  const check = ok => { if (!ok) throw new Error("Invalid secondary artwork"); };
  const integer = (v, a, b) => Number.isSafeInteger(v) && v >= a && v <= b;
  const exact = (v, fields) => check(v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === fields.length && fields.every(k => Object.hasOwn(v, k)));
  let catalogue = null;
  function entries() {
    if (catalogue) return catalogue;
    const payload = document.getElementById("nova-secondary-catalog");
    check(payload && payload.textContent.length <= 65536);
    const data = JSON.parse(payload.textContent);
    check(data.schema === 1 && data.revision === 1 && data.pin === PIN && data.repository === "game-icons/icons" && data.max_selected === 6 && data.max_references === 24);
    check(Array.isArray(data.entries) && data.entries.length > 0 && data.entries.length <= 32);
    const result = new Map();
    for (const e of data.entries) {
      check(typeof e.id === "string" && /^gi-[a-z0-9-]+$/.test(e.id) && !result.has(e.id));
      check(typeof e.upstream_path === "string" && /^[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(e.upstream_path));
      check(typeof e.drawing_fingerprint === "string" && /^[0-9a-f]{64}$/.test(e.drawing_fingerprint));
      const c = e.credit;
      exact(c, ["title", "author", "attribution", "source", "license", "license_url", "changes"]);
      check(Object.values(c).every(v => typeof v === "string" && v.length > 0 && v.length <= 240));
      check(c.source === `https://github.com/game-icons/icons/blob/${PIN}/${e.upstream_path}` && c.license === "CC-BY-3.0" && c.license_url === "https://creativecommons.org/licenses/by/3.0/" && c.attribution === "Icons made by " + c.author);
      result.set(e.id, e);
    }
    catalogue = result;
    return catalogue;
  }
  function info(id) { const e = entries().get(id); check(e); return e; }
  function validateAsset(e) {
    info(e.asset_id);
    check(window.novaSceneGraph.name(e.name));
    check(integer(e.w, 24, Math.min(300, 1000 - e.x)) && integer(e.h, 24, Math.min(300, 420 - e.y)));
    check(typeof e.fill === "string" && /^#[0-9a-fA-F]{6}$/.test(e.fill) && !Object.hasOwn(e, "gradient"));
    check(Array.isArray(e.fallback) && e.fallback.length >= 1 && e.fallback.length <= 8);
    for (const p of e.fallback) {
      check(p && ["rect", "circle", "ellipse", "line", "arrow", "polygon", "polyline", "text", "icons", "sector"].includes(p.kind));
      check(!["until", "motion", "dx", "dy", "gradient"].some(k => Object.hasOwn(p, k)) && p.row === e.row);
      check(integer(p.x, 0, 100) && integer(p.y, 0, 100));
      if (p.kind === "rect") check(integer(p.w, 1, 100 - p.x) && integer(p.h, 1, 100 - p.y));
      if (["circle", "sector"].includes(p.kind)) check(integer(p.r, 1, Math.min(p.x, p.y, 100 - p.x, 100 - p.y)));
      if (p.kind === "ellipse") check(integer(p.rx, 1, Math.min(p.x, 100 - p.x)) && integer(p.ry, 1, Math.min(p.y, 100 - p.y)));
      if (["line", "arrow"].includes(p.kind)) check(integer(p.x2, 0, 100) && integer(p.y2, 0, 100));
      if (["polygon", "polyline"].includes(p.kind)) check(Array.isArray(p.points) && p.points.every(v => Array.isArray(v) && v.length === 2 && v.every(n => integer(n, 0, 100))));
      if (p.kind === "text") check(typeof p.text === "string" && Array.from(p.text).length <= 30 && integer(p.size ?? 28, 12, 32));
      if (p.kind === "icons") {
        check(integer(p.count, 0, 4) && integer(p.columns, 1, 4) && integer(p.size, 24, 100));
        check(p.x + Math.min(p.count, p.columns) * p.size <= 100 && p.y + Math.ceil(p.count / p.columns) * p.size <= 100);
      }
    }
  }
  function references(steps) {
    const refs = [];
    function walk(list) { for (const e of list) { if (e.kind === "asset") refs.push(e.asset_id); if (e.kind === "group") walk(e.children); } }
    steps.forEach(step => walk(step.elements));
    check(refs.length <= 24 && new Set(refs).size <= 6);
    return [...new Set(refs)].sort();
  }
  function validatePlan(plan) {
    const ids = references(plan.steps), resources = plan.resources ?? [];
    check(!Object.hasOwn(plan, "resources") || plan.resources !== null);
    check(Array.isArray(resources) && resources.length <= 6);
    const map = new Map(), fingerprint = window.novaWhiteboardTiming.fingerprint;
    let previous = "";
    for (const r of resources) {
      exact(r, ["id", "paths", "credit"]);
      const entry = info(r.id);
      check(ids.includes(r.id) && r.id > previous); previous = r.id;
      check(fingerprint(r.credit) === fingerprint(entry.credit));
      check(Array.isArray(r.paths) && r.paths.length > 0 && r.paths.length <= 4);
      for (const d of r.paths) {
        check(typeof d === "string" && d.length > 0 && d.length <= 8192 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(d) && /^[Mm]/.test(d.trimStart()));
        const nums = d.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g) || [];
        check(nums.length <= 1600 && nums.every(n => Number.isFinite(Number(n)) && Math.abs(Number(n)) <= 4096));
      }
      check(fingerprint({ view_box: [0, 0, 512, 512], paths: r.paths }) === entry.drawing_fingerprint);
      map.set(r.id, Object.freeze([...r.paths]));
    }
    check(plan.policy === "general" || (!ids.length && !resources.length));
    // No globally active plan: each validated step owns its resolved immutable
    // paths. An unvalidated direct mount can only render its local fallback.
    plan.steps.forEach(step => ready.set(step, map));
  }
  function paths(step, id) { return ready.get(step)?.get(id)?.slice() || null; }
  function creditsFor(plan, indices = null) {
    if (!plan) return [];
    const steps = indices ? indices.map(i => plan.steps[i]) : plan.steps;
    const ids = references(steps);
    return (plan.resources || []).filter(r => ids.includes(r.id)).map(r => ({ id: r.id, ...r.credit }));
  }
  window.novaSecondaryAssets = { validateAsset, validatePlan, paths, creditsFor };
})();
