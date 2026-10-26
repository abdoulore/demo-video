// Records every scene as its own clip, timed to the narration: node shoot.cjs <workdir> [scene ids, comma separated]
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const { load, findChrome, findFfmpeg } = require("./lib.cjs");

const { dir, cfg, scenes: all } = load(process.argv[2]);
const only = process.argv[3]?.split(",");
const scenes = all.filter((s) => !only || only.includes(s.id));
const KIT = fs.readFileSync(path.join(__dirname, "kit.js"), "utf8");
const STAGE = "file:///" + path.join(__dirname, "stage.html").replace(/\\/g, "/");
const meta = JSON.parse(fs.readFileSync(path.join(dir, "tts", "meta.json"), "utf8"));
const CLIPS = path.join(dir, "clips");
fs.mkdirSync(CLIPS, { recursive: true });
const FFMPEG = findFfmpeg();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lead-in before the first line, gap between lines, and tail after the last (room for the pull-back).
const T = Object.assign({ leadPage: 750, leadCard: 450, gap: 320, tailPage: 1900, tailCard: 700 }, cfg.timing || {});
const VP = Object.assign({ width: 1920, height: 1080 }, cfg.viewport || {});

function plan(scene) {
  const page = scene.kind === "page";
  let t = page ? T.leadPage : T.leadCard;
  const lines = scene.lines.map((l) => {
    const m = meta.lines[l.id];
    if (!m) throw new Error(`no voice for ${l.id}; run tts.cjs first`);
    const start = t;
    t += m.dur + T.gap;
    return { ...l, start, dur: m.dur, words: m.words };
  });
  return { lines, total: Math.max(scene.min ?? 0, t - T.gap + (page ? T.tailPage : T.tailCard)) };
}

const kitFor = (page) =>
  new Proxy({}, { get: (_, name) => (name === "sleep" ? sleep : (...args) => page.evaluate((n, a) => window.__kit[n](...a), name, args)) });

async function prepare(page, s) {
  if (s.kind === "card") {
    if (!page.url().startsWith("file:")) {
      await page.goto(STAGE, { waitUntil: "load" });
      await page.evaluate((c) => window.stageSetup(c), { ...(cfg.stage || {}), theme: cfg.theme });
      await sleep(1500);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelectorAll(".card").forEach((c) => c.classList.remove("on")));
    await sleep(300);
    return;
  }
  await page.goto(s.url, { waitUntil: "networkidle2", timeout: 90_000 });
  if (s.external) {
    // Cookie banners on third-party sites
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^(got it|accept|accept all|ok|i agree)!?$/i.test(b.textContent.trim()))?.click());
    await sleep(2500);
  }
  if (s.ready) await page.waitForSelector(s.ready, { timeout: 60_000 });
  await sleep(1800);
  if (s.setup) await page.evaluate(s.setup);
  await page.evaluate((t) => (window.__KIT_THEME = t), cfg.theme || {});
  await page.evaluate(KIT);
  await page.evaluate(() => document.fonts.ready);
  if (s.scroll)
    await page.evaluate((sel, at) => {
      const el = document.querySelector(sel);
      if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * at);
    }, s.scroll, s.scrollAt ?? 0.1);
  await sleep(1500); // let scroll-reveal animations settle before the first frame
  await kitFor(page).frame("framed");
  await sleep(200);
}

async function record(page, s) {
  const { lines, total } = plan(s);
  const k = kitFor(page);
  const rec = await page.screencast({ path: path.join(CLIPS, `${s.id}.webm`), ffmpegPath: FFMPEG, fps: 30, quality: 12 });
  const t0 = Date.now();
  const at = (ms) => sleep(Math.max(0, t0 + ms - Date.now()));
  let chain = s.kind === "card" ? page.evaluate((a) => window.show(...a), s.card) : k.frame("in", 900);
  for (const l of lines) {
    await at(l.start);
    if (s.kind === "page" && s.captions !== false) k.caption(l.text, l.words).catch(() => {});
    if (l.act) chain = chain.then(() => l.act(k, page)).catch((e) => console.warn(`  ${s.id} ${l.id}: ${e.message.split("\n")[0]}`));
  }
  const last = lines[lines.length - 1];
  await at(last.start + last.dur + 250);
  if (s.kind === "page") {
    k.captionOff().catch(() => {});
    if (s.end) chain = chain.then(() => s.end(k, page));
    const done = await Promise.race([chain.then(() => true), at(total - 950).then(() => false)]);
    if (!done) console.warn(`  ${s.id}: actions ran past the scene; shorten them or give the lines more time`);
    await at(total - 950);
    await k.frame("out", 900);
  }
  await at(total + 250);
  await rec.stop();
  return { id: s.id, total, lines: lines.map((l) => ({ id: l.id, start: l.start })) };
}

(async () => {
  const b = await puppeteer.launch({ executablePath: findChrome(), headless: "shell", args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
  const page = await b.newPage();
  await page.setViewport({ ...VP, deviceScaleFactor: 1 });
  await page.setUserAgent(cfg.browser?.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36");
  if (cfg.browser?.localStorage)
    await page.evaluateOnNewDocument((kv) => {
      try {
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
      } catch {}
    }, cfg.browser.localStorage);
  page.on("console", (m) => m.text().startsWith("kit:") && console.warn("  " + m.text()));
  const tlFile = path.join(dir, "timeline.json");
  const timeline = fs.existsSync(tlFile) ? JSON.parse(fs.readFileSync(tlFile, "utf8")) : {};
  for (const s of scenes) {
    const started = Date.now();
    await prepare(page, s);
    timeline[s.id] = await record(page, s);
    console.log(`${s.id}  ${(timeline[s.id].total / 1000).toFixed(1)}s  (took ${Math.round((Date.now() - started) / 1000)}s)`);
    fs.writeFileSync(tlFile, JSON.stringify(timeline, null, 1));
  }
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
