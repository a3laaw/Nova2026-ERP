"use strict";
(() => {
  // Small, synchronous SHA-256 for our ASCII-only timing schema. Works on file://
  // and in jsdom without WebCrypto, a server, libraries, network or async clocks.
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const rotate = (word, bits) => (word >>> bits) | (word << (32 - bits));
  function sha256ASCII(text) {
    const size = Math.ceil((text.length + 9) / 64) * 64;
    const bytes = new Uint8Array(size);
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code > 127) throw new Error("Timing canonical JSON must be ASCII");
      bytes[index] = code;
    }
    bytes[text.length] = 0x80;
    const view = new DataView(bytes.buffer);
    view.setUint32(size - 8, Math.floor(text.length * 8 / 4294967296));
    view.setUint32(size - 4, text.length * 8 >>> 0);
    const hash = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const words = new Uint32Array(64);
    for (let offset = 0; offset < size; offset += 64) {
      for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4);
      for (let index = 16; index < 64; index++) {
        const a = words[index - 15], b = words[index - 2];
        const first = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
        const second = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
        words[index] = words[index - 16] + first + words[index - 7] + second;
      }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let index = 0; index < 64; index++) {
        const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
        const choose = (e & f) ^ (~e & g);
        const first = (h + sum1 + choose + constants[index] + words[index]) >>> 0;
        const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const second = (sum0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + first) >>> 0;
        d = c; c = b; b = a; a = (first + second) >>> 0;
      }
      const state = [a,b,c,d,e,f,g,h];
      for (let index = 0; index < 8; index++) hash[index] += state[index];
    }
    return Array.from(hash, word => word.toString(16).padStart(8, "0")).join("");
  }
  function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => canonical(key) + ":" + canonical(value[key])).join(",") + "}";
    const encoded = JSON.stringify(value);
    // Python ensure_ascii=True also escapes DEL, BMP characters and each
    // surrogate of a non-BMP code point. Preserve its existing lesson hashes.
    return encoded.replace(/[\u007f-\uffff]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
  }
  const fingerprint = value => sha256ASCII(canonical(value));
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const hex256 = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value) && value.length === 64;
  function keys(value, expected) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort(), wanted = expected.slice().sort();
    return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
  }
  function validate(data, lesson, recordings) {
    try {
      if (!keys(data, ["schema_version", "lesson_fingerprint", "steps", "fingerprint"]) ||
          data.schema_version !== 1 || !hex256(data.lesson_fingerprint) ||
          data.lesson_fingerprint !== lesson.fingerprint || !hex256(data.fingerprint) ||
          !Array.isArray(lesson.steps) || !Array.isArray(recordings.durations) ||
          lesson.steps.length < 1 || lesson.steps.length > 120 || recordings.durations.length !== lesson.steps.length ||
          !keys(data.steps, lesson.steps.map((_, index) => String(index)))) return null;
      for (let index = 0; index < lesson.steps.length; index++) {
        const clip = data.steps[String(index)], rows = lesson.steps[index].rows;
        if (!keys(clip, ["sample_rate", "total_samples", "audio_format", "clock", "encoder_delay_samples", "lines"]) ||
            !integer(clip.sample_rate) || clip.sample_rate < 8000 || clip.sample_rate > 48000 ||
            !integer(clip.total_samples) || clip.total_samples === 0 || clip.clock !== "pcm" ||
            !["mp3", "wav"].includes(clip.audio_format) ||
            (clip.audio_format === "wav" ? clip.encoder_delay_samples !== 0 : clip.encoder_delay_samples !== null) ||
            !Array.isArray(rows) || rows.length < 1 || rows.length > 6 ||
            !Array.isArray(clip.lines) || clip.lines.length !== rows.length ||
            !Number.isFinite(recordings.durations[index]) || recordings.durations[index] <= 0 ||
            Math.abs(recordings.durations[index] * clip.sample_rate - clip.total_samples) > 1) return null;
        const payload = document.getElementById("nova-wb-audio-" + index);
        if (!payload || payload.type !== "application/x-nova-audio" || document.querySelectorAll(`[id="nova-wb-audio-${index}"]`).length !== 1 || payload.dataset.mime !== (clip.audio_format === "wav" ? "audio/wav" : "audio/mpeg")) return null;
        let cursor = 0;
        for (let row = 0; row < rows.length; row++) {
          const line = clip.lines[row];
          if (!keys(line, ["line_id", "speaker", "start_sample", "end_sample", "pause_after_samples"]) ||
              !Object.values(line).every(integer) || line.line_id !== row ||
              ![1, 2].includes(line.speaker) || line.speaker !== rows[row].speaker ||
              line.start_sample !== cursor || line.end_sample <= cursor || line.end_sample > clip.total_samples) return null;
          cursor = line.end_sample + line.pause_after_samples;
          if (!integer(cursor)) return null;
        }
        if (cursor !== clip.total_samples || clip.lines[clip.lines.length - 1].pause_after_samples !== 0) return null;
      }
      const payload = { schema_version: data.schema_version, lesson_fingerprint: data.lesson_fingerprint, steps: data.steps };
      const lessonPayload = Object.fromEntries(Object.entries(lesson).filter(([key]) => key !== "fingerprint"));
      return fingerprint(payload) === data.fingerprint && fingerprint(lessonPayload) === lesson.fingerprint ? data : null;
    } catch (_) { return null; } // Malformed optional metadata must never break a lesson.
  }
  function read(node, lesson, recordings) {
    try {
      if (!node || node.type !== "application/json" || node.textContent.length > 250000 ||
          document.querySelectorAll('[id="nova-whiteboard-timings"]').length !== 1) return null;
      return validate(JSON.parse(node.textContent), lesson, recordings);
    } catch (_) { return null; }
  }
  window.novaWhiteboardTiming = { read, validate, fingerprint, sha256ASCII };
})();
