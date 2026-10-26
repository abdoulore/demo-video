// Contact sheets for review, one PNG per clip (a frame every 2 s): node sheets.cjs <workdir> [scene ids]
// Also reports recorded vs planned length, which is how you catch drift between picture and voice.
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { load, findFfmpeg } = require("./lib.cjs");

const { dir, scenes } = load(process.argv[2]);
const only = process.argv[3]?.split(",");
const FF = findFfmpeg();
const out = path.join(dir, "sheets");
fs.mkdirSync(out, { recursive: true });
const timeline = JSON.parse(fs.readFileSync(path.join(dir, "timeline.json"), "utf8"));

for (const s of scenes) {
  if (only && !only.includes(s.id)) continue;
  const clip = path.join(dir, "clips", `${s.id}.webm`);
  if (!fs.existsSync(clip)) continue;
  const every = s.kind === "card" ? 1 : 2;
  execFileSync(FF, ["-v", "error", "-y", "-i", clip, "-vf", `fps=1/${every},scale=640:-1,tile=3x4:padding=6:color=white`, "-frames:v", "1", path.join(out, `${s.id}.png`)]);
  // ffmpeg reports progress on stderr; the last time= is the decoded length.
  const probe = spawnSync(FF, ["-hide_banner", "-i", clip, "-f", "null", "-"], { encoding: "utf8" });
  const t = [...(probe.stderr || "").matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop();
  const secs = t ? +t[1] * 3600 + +t[2] * 60 + +t[3] : NaN;
  const planned = (timeline[s.id]?.total ?? 0) / 1000 + 0.25;
  console.log(`${s.id.padEnd(18)} planned ${planned.toFixed(2)}s  recorded ${secs.toFixed(2)}s  ${Math.abs(secs - planned) > 0.3 ? "CHECK" : "ok"}  -> sheets/${s.id}.png`);
}
