// Film kit, injected into every page we record: a CSS camera on <body> (zoom, pan, floating-screen frame),
// plus overlays on <html> (outside the camera) for the cursor, spotlight, labels and captions.
// Theme comes from window.__KIT_THEME (set by shoot.cjs from the video config) with sensible defaults.
(() => {
  if (window.__kit) return;
  const html = document.documentElement;
  const body = document.body;
  const EASE = "cubic-bezier(.65,0,.35,1)";
  const T = Object.assign({ canvas: "#0b0d12", accent: "#2456e8", accent2: "#6a8cf7", font: "Geist" }, window.__KIT_THEME || {});
  const CANVAS = T.canvas;
  const rgb = (hex) => {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };
  const ACC = T.accent, ACC_RGB = rgb(T.accent), ACC2_RGB = rgb(T.accent2);
  const FONT = `"${T.font}", "Segoe UI", system-ui, sans-serif`;

  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = T.fontUrl || `https://fonts.googleapis.com/css2?family=${encodeURIComponent(T.font)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(font);

  // Keep the page's own background on <body> so the canvas behind it can be dark.
  const pick = (el) => {
    const c = getComputedStyle(el).backgroundColor;
    return c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent" ? c : null;
  };
  const pageBg = pick(body) || pick(html) || "#ffffff";

  const style = document.createElement("style");
  style.textContent = `
    html.kit { background: ${CANVAS} !important; scrollbar-width: none; }
    html.kit::-webkit-scrollbar { display: none; }
    html.kit body { background: ${pageBg} !important; transform-origin: 0 0; will-change: transform; min-height: 100vh; }
    .kit-l { position: fixed; pointer-events: none; font-family: ${FONT}; }
    .kit-shadow { z-index: -1; border-radius: 18px; box-shadow: 0 40px 120px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06); opacity: 0; }
    .kit-spot { z-index: 2147483600; border-radius: 14px; box-shadow: 0 0 0 200vmax rgba(8,10,16,.58); opacity: 0; transition: opacity .45s ease, left .6s ${EASE}, top .6s ${EASE}, width .6s ${EASE}, height .6s ${EASE}; outline: 2px solid rgba(${ACC2_RGB},.9); outline-offset: 4px; }
    .kit-label { z-index: 2147483610; padding: 10px 16px; border-radius: 12px; background: ${ACC}; color: #fff; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap;
      box-shadow: 0 12px 32px rgba(${ACC_RGB},.35); transform: translateY(10px) scale(.92); opacity: 0; transition: transform .45s cubic-bezier(.2,1.4,.4,1), opacity .3s ease; }
    .kit-label.dark { background: #11141b; box-shadow: 0 12px 32px rgba(0,0,0,.35); }
    .kit-label.in { transform: none; opacity: 1; }
    .kit-cursor { z-index: 2147483640; left: 0; top: 0; width: 34px; height: 34px; transform: translate(2100px, 1200px); opacity: 0; filter: drop-shadow(0 4px 10px rgba(0,0,0,.35)); }
    .kit-ripple { z-index: 2147483630; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 999px; border: 3px solid ${ACC}; animation: kit-rip .6s ease-out forwards; }
    @keyframes kit-rip { from { transform: scale(.4); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }
    .kit-cap { z-index: 2147483620; left: 50%; bottom: 56px; max-width: 1240px; padding: 16px 28px; border-radius: 16px; background: rgba(11,13,18,.82); backdrop-filter: blur(10px);
      color: #fff; font-size: 32px; line-height: 1.3; font-weight: 550; letter-spacing: -0.01em; text-align: center; transform: translate(-50%, 16px); opacity: 0;
      transition: transform .4s ${EASE}, opacity .3s ease; box-shadow: 0 16px 48px rgba(0,0,0,.3); }
    .kit-cap.in { transform: translate(-50%, 0); opacity: 1; }
    .kit-cap span { opacity: .28; transition: opacity .18s ease; }
    .kit-cap span.on { opacity: 1; }
  `;
  document.head.appendChild(style);
  html.classList.add("kit");

  const layer = (cls) => {
    const d = document.createElement("div");
    d.className = `kit-l ${cls}`;
    html.appendChild(d);
    return d;
  };
  const shadow = layer("kit-shadow");
  const spot = layer("kit-spot");
  const cap = layer("kit-cap");
  const cursor = layer("kit-cursor");
  cursor.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2.5l15.5 9.3-6.9 1.4 3.9 7.2-2.7 1.4-3.9-7.2-5 4.9z" fill="#fff" stroke="#11141b" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const vw = () => innerWidth;
  const vh = () => innerHeight;
  let cam = { s: 1, tx: 0, ty: 0 };

  function find(q) {
    if (typeof q === "string") return document.querySelector(q);
    const all = [...document.querySelectorAll(q.sel)];
    const hit = all.filter((e) => (q.text === undefined ? true : e.innerText.includes(q.text)));
    return hit[q.nth ?? 0] || null;
  }
  // Screen rect -> document point in body coordinates (undoing the current camera).
  function toDoc(x, y) {
    return { x: (x + scrollX - cam.tx) / cam.s, y: (y + scrollY - cam.ty) / cam.s };
  }
  /** Where a target is on screen now. {rect:[x,y,w,h]} is in unzoomed screen pixels at the current scroll. */
  function rectOf(q) {
    if (q && q.rect) {
      const [x, y, w, h] = q.rect;
      return { left: cam.tx + cam.s * (x + scrollX) - scrollX, top: cam.ty + cam.s * (y + scrollY) - scrollY, width: w * cam.s, height: h * cam.s };
    }
    const el = find(q);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function docRect(q) {
    const r = rectOf(q);
    if (!r) return null;
    const a = toDoc(r.left, r.top);
    return { x: a.x, y: a.y, w: r.width / cam.s, h: r.height / cam.s };
  }
  function apply(ms, extra = "") {
    body.style.transition = ms ? `transform ${ms}ms ${EASE}${extra}` : "none";
    body.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`;
  }
  function clampCam() {
    const W = body.scrollWidth, H = Math.max(body.scrollHeight, vh());
    const minX = vw() + scrollX - cam.s * W, maxX = scrollX;
    const minY = vh() + scrollY - cam.s * H, maxY = scrollY;
    if (cam.s >= 1) {
      cam.tx = Math.min(maxX, Math.max(minX, cam.tx));
      cam.ty = Math.min(maxY, Math.max(minY, cam.ty));
    }
  }

  const kit = {
    sleep,
    find,
    /** Push the camera in on an element (fits it with padding unless a scale is given). */
    async zoomTo(q, { scale, ms = 1100, fit = 0.72, max = 2.4, dx = 0, dy = 0 } = {}) {
      const r = docRect(q);
      if (!r) return console.warn("kit: no target", JSON.stringify(q));
      const s = scale ?? Math.min(max, (vw() * fit) / r.w, (vh() * fit) / r.h);
      // Where the cursor sits on the target now, so it can ride along with the camera.
      const cx = +cursor.dataset.x, cy = +cursor.dataset.y;
      const onDoc = cursor.style.opacity === "1" ? toDoc(cx, cy) : null;
      cam = { s, tx: vw() / 2 + scrollX - s * (r.x + r.w / 2 + dx), ty: vh() / 2 + scrollY - s * (r.y + r.h / 2 + dy) };
      clampCam();
      apply(ms);
      if (onDoc) {
        const x = cam.tx + cam.s * onDoc.x - scrollX, y = cam.ty + cam.s * onDoc.y - scrollY;
        cursor.style.transition = `transform ${ms}ms ${EASE}, opacity .3s ease`;
        cursor.style.transform = `translate(${x - 4}px, ${y - 3}px)`;
        cursor.dataset.x = x;
        cursor.dataset.y = y;
      }
      await sleep(ms);
    },
    /** Back to the full page. */
    async zoomOut(ms = 1000) {
      cam = { s: 1, tx: 0, ty: 0 };
      apply(ms);
      await sleep(ms);
      body.style.transition = "none";
      body.style.transform = "none";
    },
    /** Floating screen on the dark canvas: set instantly (framed) or animate between framed and full. */
    async frame(on, ms = 900, s0 = 0.82) {
      const H = Math.max(body.offsetHeight, body.scrollHeight);
      const clipAt = (r) => `inset(${scrollY}px 0px ${Math.max(0, H - scrollY - vh())}px 0px round ${r}px)`;
      const framed = { s: s0, tx: (vw() * (1 - s0)) / 2 + scrollX * (1 - s0) + 0, ty: (vh() * (1 - s0)) / 2 + scrollY * (1 - s0) };
      const set = (c, r, sh, t) => {
        cam = c;
        body.style.transition = t ? `transform ${t}ms ${EASE}, clip-path ${t}ms ${EASE}` : "none";
        body.style.clipPath = clipAt(r);
        body.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
        const w = vw() * c.s, h = vh() * c.s;
        shadow.style.transition = t ? `all ${t}ms ${EASE}` : "none";
        Object.assign(shadow.style, { left: `${(vw() - w) / 2}px`, top: `${(vh() - h) / 2}px`, width: `${w}px`, height: `${h}px`, opacity: sh, borderRadius: `${r * c.s}px` });
      };
      if (on === "framed") return set(framed, 22 / s0, 1, 0);
      if (on === "in") {
        set(framed, 22 / s0, 1, 0);
        await sleep(30);
        set({ s: 1, tx: 0, ty: 0 }, 0, 0, ms);
        await sleep(ms);
        body.style.transition = "none";
        body.style.transform = "none";
        body.style.clipPath = "none";
        return;
      }
      // out: pull back from wherever the camera is (zoomed or not) to the floating screen
      cursor.style.opacity = 0;
      spot.style.opacity = 0;
      body.style.transition = "none";
      body.style.clipPath = clipAt(0);
      await sleep(30);
      set(framed, 22 / s0, 1, ms);
      await sleep(ms);
    },
    /** Smooth scroll so an element (or y) sits at a given fraction of the viewport. Camera must be at rest. */
    async scrollTo(q, { ms = 1400, at = 0.18 } = {}) {
      const y0 = scrollY;
      let y1 = typeof q === "number" ? q : (() => {
        const el = find(q);
        return el ? el.getBoundingClientRect().top + scrollY - vh() * at : y0;
      })();
      y1 = Math.max(0, Math.min(y1, document.documentElement.scrollHeight - vh()));
      const t0 = performance.now();
      await new Promise((done) => {
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          scrollTo(0, y0 + (y1 - y0) * e);
          k < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      });
    },
    async cursorTo(q, { ms = 700, dx = 0, dy = 0 } = {}) {
      let x, y;
      if (q && typeof q === "object" && "x" in q) ({ x, y } = q);
      else {
        const r = rectOf(q);
        if (!r) return console.warn("kit: no target", JSON.stringify(q));
        x = r.left + r.width / 2 + dx;
        y = r.top + r.height / 2 + dy;
      }
      cursor.style.opacity = 1;
      cursor.style.transition = `transform ${ms}ms ${EASE}, opacity .3s ease`;
      cursor.style.transform = `translate(${x - 4}px, ${y - 3}px)`;
      cursor.dataset.x = x;
      cursor.dataset.y = y;
      await sleep(ms);
    },
    async click(q, opts = {}) {
      await kit.cursorTo(q, opts);
      const d = layer("kit-ripple");
      d.style.left = `${cursor.dataset.x}px`;
      d.style.top = `${cursor.dataset.y}px`;
      setTimeout(() => d.remove(), 700);
      cursor.animate([{ scale: 1 }, { scale: 0.85 }, { scale: 1 }], { duration: 220 });
      const el = q && q.rect ? null : find(q);
      if (el) (el.closest("summary") || el).click();
      await sleep(250);
    },
    cursorHide() {
      cursor.style.opacity = 0;
    },
    spotlight(q, { pad = 10, radius = 14 } = {}) {
      const r = rectOf(q);
      if (!r) return console.warn("kit: no target", JSON.stringify(q));
      Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: `${radius}px`, opacity: 1 });
    },
    spotOff() {
      spot.style.opacity = 0;
    },
    label(q, text, { side = "top", dark = false, gap = 16 } = {}) {
      const r0 = rectOf(q);
      if (!r0) return console.warn("kit: no target", JSON.stringify(q));
      const r = { ...r0, right: r0.left + r0.width, bottom: r0.top + r0.height };
      const l = layer(`kit-label${dark ? " dark" : ""}`);
      l.textContent = text;
      const w = l.offsetWidth, h = l.offsetHeight;
      const pos = {
        top: [r.left + r.width / 2 - w / 2, r.top - h - gap],
        bottom: [r.left + r.width / 2 - w / 2, r.bottom + gap],
        right: [r.right + gap, r.top + r.height / 2 - h / 2],
        left: [r.left - w - gap, r.top + r.height / 2 - h / 2],
      }[side];
      l.style.left = `${Math.max(24, Math.min(vw() - w - 24, pos[0]))}px`;
      l.style.top = `${Math.max(24, pos[1])}px`;
      requestAnimationFrame(() => requestAnimationFrame(() => l.classList.add("in")));
    },
    labelsOff() {
      for (const l of document.querySelectorAll(".kit-label")) {
        l.classList.remove("in");
        setTimeout(() => l.remove(), 400);
      }
    },
    /** Caption in short chunks that advance with the voice; words light up at their spoken times (ms from now). */
    caption(text, times) {
      const words = text.split(" ");
      const t = (i) => times?.[i] ?? 0;
      const chunks = [];
      let cur = [];
      let len = 0;
      words.forEach((w, i) => {
        cur.push(i);
        len += w.length + 1;
        const left = words.length - 1 - i;
        if (left >= 3 && (len > 64 || (/[,.:;]$/.test(w) && len > 30))) {
          chunks.push(cur);
          cur = [];
          len = 0;
        }
      });
      if (cur.length) chunks.push(cur);
      const token = (kit._cap = (kit._cap || 0) + 1);
      const esc = (w) => w.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      chunks.forEach((c, ci) => {
        const t0 = ci === 0 ? 0 : t(c[0]);
        setTimeout(() => {
          if (kit._cap !== token) return;
          cap.innerHTML = c.map((i) => `<span>${esc(words[i])}</span>`).join(" ");
          cap.classList.add("in");
          [...cap.querySelectorAll("span")].forEach((s, k) =>
            setTimeout(() => kit._cap === token && s.classList.add("on"), Math.max(0, t(c[k]) - t0)),
          );
        }, t0);
      });
    },
    captionOff() {
      cap.classList.remove("in");
    },
  };
  window.__kit = kit;
})();
