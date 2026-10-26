// Copy into a work folder outside the repo (e.g. the session scratchpad) and fill in.
//
// Scene kinds
//   card: a title card on the dark stage.   card: ["intro"] | ["end"] | ["title", { kicker, title, sub }]
//         (in titles, *word* is drawn in the accent color). Cards show no captions; the card is the text.
//   page: a real web page, filmed live.     url, ready (selector to wait for), scroll + scrollAt (start
//         position), setup() (runs in the page first: hide ads/clutter, tag targets), external (dismiss
//         cookie banner), captions (default true)
//
// Every line is spoken and captioned:  { id, text, say?, act?(k, page) }
//   id: unique, stable (the voice cache keys on it). say: spoken form when it differs from the caption
//   (e.g. "tandem dot moonrider dot online"). act: camera moves, run when the line starts.
//   Keep each act shorter than its line; shoot.cjs warns when a scene overruns.
//
// Camera kit (k) inside act/end:
//   k.zoomTo(q, { fit=.72, max=2.4, scale, ms=1100, dx, dy })  push in on a target (pans if already zoomed)
//   k.zoomOut(ms)                                               back to the full page
//   k.scrollTo(q | y, { ms=1400, at=.18 })                      smooth scroll, only when not zoomed
//   k.cursorTo(q, { ms=700, dx, dy }), k.click(q), k.cursorHide()
//   k.spotlight(q, { pad=10, radius=14 }), k.spotOff()          dim everything else
//   k.label(q, "text", { side: "top"|"bottom"|"left"|"right", dark }), k.labelsOff()
//   k.sleep(ms)
//   Targets q: "css selector" | { sel, text, nth } (first element under sel containing text) |
//              { rect: [x, y, w, h] } (unzoomed screen pixels at the current scroll; last resort)
//   The pull-back at the end of a page scene is automatic, from wherever the camera is.

const BASE = "https://example.com";

module.exports = {
  out: { dir: "./out", name: "Example-pitch" },
  env: "C:/path/to/project/.env", // where ELEVENLABS_API_KEY lives (process.env wins)
  voice: { prefer: ["Brian", "Eric", "Chris"] }, // or { id: "<voice id>" }; free tier: keep format mp3_44100_128
  music: true,
  theme: { canvas: "#0b0d12", accent: "#2456e8", accent2: "#6a8cf7", font: "Geist" },
  stage: {
    name: "Example",
    tagline: "One line that says what it does.",
    logo: "", // inline <svg viewBox=...>; parts with class a, b, c assemble one by one
    end: { line: "Try it free. No sign-up needed.", links: [["Live app", "example.com"], ["Code", "github.com/you/example"]] },
  },
  browser: { localStorage: {} }, // preset keys before any page script runs
  vars: {}, // passed to scenes(); e.g. live numbers you read just before shooting
  scenes: (v) => [
    { id: "s00-intro", kind: "card", card: ["intro"], min: 4600, lines: [{ id: "L00", text: "This is Example." }] },
    {
      id: "s01-home",
      kind: "page",
      url: `${BASE}/`,
      ready: "main",
      lines: [
        {
          id: "L01",
          text: "Say the problem in one sentence people feel.",
          async act(k) {
            await k.sleep(800);
            await k.cursorTo("h1", { ms: 900 });
            await k.zoomTo("h1", { fit: 0.8, max: 1.6 });
          },
        },
      ],
    },
    { id: "s02-fix", kind: "card", card: ["title", { kicker: "The fix", title: "The *one* idea." }], min: 3600, lines: [{ id: "L02", text: "Name the idea." }] },
    {
      id: "s09-end",
      kind: "card",
      card: ["end"],
      min: 6500,
      lines: [{ id: "L09", text: "Try it at example.com.", say: "Try it at example dot com." }],
    },
  ],
};
