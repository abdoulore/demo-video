// Shared helpers: load the video config from a work dir, and find Chrome and ffmpeg.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SKILL = path.resolve(__dirname, "..");

function load(workdir) {
  if (!workdir) throw new Error("usage: node <script> <workdir>  (the folder holding video.config.cjs)");
  const dir = path.resolve(workdir);
  const file = path.join(dir, "video.config.cjs");
  if (!fs.existsSync(file)) throw new Error(`no video.config.cjs in ${dir} (copy templates/video.config.cjs there)`);
  delete require.cache[require.resolve(file)];
  const cfg = require(file);
  const scenes = typeof cfg.scenes === "function" ? cfg.scenes(cfg.vars ?? {}) : cfg.scenes;
  return { dir, cfg, scenes };
}

/** Reads KEY from process.env, else from the .env file the config points at. Never prints it. */
function secret(cfg, key) {
  if (process.env[key]) return process.env[key].trim();
  if (!cfg.env || !fs.existsSync(cfg.env)) return "";
  const line = fs
    .readFileSync(cfg.env, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

function findChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const root = path.join(SKILL, ".browsers");
  const walk = (d, depth = 0) => {
    if (!fs.existsSync(d) || depth > 5) return null;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isFile() && /^chrome-headless-shell(\.exe)?$/.test(e.name)) return p;
      if (e.isDirectory()) {
        const hit = walk(p, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };
  const hit = walk(root);
  if (hit) return hit;
  throw new Error("No Chrome found. Set CHROME, or run: npx @puppeteer/browsers install chrome-headless-shell@stable --path " + root);
}

function findFfmpeg() {
  const candidates = [process.env.FFMPEG, "ffmpeg"].filter(Boolean);
  for (const c of candidates) {
    try {
      execFileSync(c, ["-hide_banner", "-version"], { stdio: "ignore" });
      return c;
    } catch {
      /* try the next one */
    }
  }
  throw new Error("No ffmpeg found. Put it on PATH or set FFMPEG.");
}

module.exports = { SKILL, load, secret, findChrome, findFfmpeg };
