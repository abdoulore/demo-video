// Assembles clips, voice lines and a music bed into the finished videos: node mix.cjs <workdir>
// Writes <out.dir>/<out.name>.mp4 (narrated) and, with music on, <out.name>-music-only.mp4.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { load, findFfmpeg } = require("./lib.cjs");

const { dir, cfg, scenes } = load(process.argv[2]);
const FF = findFfmpeg();
const OUT = cfg.out?.dir ?? path.join(dir, "out");
const NAME = cfg.out?.name ?? "demo";
const MUSIC = cfg.music !== false;
const SEGS = path.join(dir, "segs");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SEGS, { recursive: true });
const timeline = JSON.parse(fs.readFileSync(path.join(dir, "timeline.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(dir, "tts", "meta.json"), "utf8"));
const run = (args) => execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

// 1. One H.264 segment per scene, trimmed to its planned length
let offset = 0;
const placements = [];
const list = [];
scenes.forEach((s, i) => {
  const t = timeline[s.id];
  if (!t) throw new Error(`missing clip for ${s.id}; run shoot.cjs`);
  const d = t.total / 1000;
  const vf = ["fps=30", "tpad=stop_mode=clone:stop_duration=2", "format=yuv420p"];
  if (i === 0) vf.push("fade=t=in:st=0:d=0.6");
  if (i === scenes.length - 1) vf.push(`fade=t=out:st=${(d - 1.4).toFixed(2)}:d=1.4`);
  const seg = path.join(SEGS, `${s.id}.mp4`);
  run(["-i", path.join(dir, "clips", `${s.id}.webm`), "-vf", vf.join(","), "-t", d.toFixed(3), "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-an", seg]);
  list.push(`file '${seg.replace(/\\/g, "/")}'`);
  for (const l of t.lines) placements.push({ file: path.join(dir, "tts", meta.lines[l.id].file), at: offset + l.start / 1000 });
  offset += d;
  console.log(`segment ${s.id} ${d.toFixed(1)}s`);
});
const total = offset;
fs.writeFileSync(path.join(SEGS, "list.txt"), list.join("\n"));
const video = path.join(SEGS, "video.mp4");
run(["-f", "concat", "-safe", "0", "-i", path.join(SEGS, "list.txt"), "-c", "copy", video]);

// 2. Music: a soft pad over a four-chord loop, two layers crossfading so the level stays even.
// Frequencies switch only while a layer is silent, so there are no clicks. Default loop: C, Am, F, G.
const chords = cfg.chords ?? [
  [130.81, 196.0, 246.94, 329.63],
  [110.0, 164.81, 196.0, 261.63],
  [87.31, 130.81, 164.81, 220.0],
  [98.0, 146.83, 196.0, 246.94],
];
const F = (C, n) => `if(eq(${C},0),${chords[0][n]},if(eq(${C},1),${chords[1][n]},if(eq(${C},2),${chords[2][n]},${chords[3][n]})))`;
const tones = (C) => [0, 1, 2, 3].map((n) => `(sin(2*PI*${F(C, n)}*t)+0.5*sin(2*PI*(${F(C, n)}+0.37)*t))`).join("+");
const expr = `st(0,floor(mod(t,32)/8));st(1,floor(mod(t+4,32)/8));st(2,pow(sin(PI*mod(t,8)/8),2));0.05*(ld(2)*(${tones("ld(0)")})+(1-ld(2))*(${tones("ld(1)")}))`;
const music = path.join(SEGS, "music.wav");
if (MUSIC)
  run([
    "-f", "lavfi", "-i", `aevalsrc='${expr}':s=44100:d=${(total + 1).toFixed(2)}`,
    "-af", `lowpass=f=1900,highpass=f=70,aecho=0.8:0.55:45|110:0.25|0.15,aformat=channel_layouts=stereo,afade=t=in:d=2.5,afade=t=out:st=${(total - 3.5).toFixed(2)}:d=3.5,atrim=0:${total.toFixed(3)}`,
    music,
  ]);

// 3. Voice: every line placed at its scene time
const voice = path.join(SEGS, "voice.wav");
const inputs = placements.flatMap((p) => ["-i", p.file]);
const chains = placements.map((p, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${Math.round(p.at * 1000)}|${Math.round(p.at * 1000)}[a${i}]`);
const mixIn = placements.map((_, i) => `[a${i}]`).join("");
run([...inputs, "-filter_complex", `${chains.join(";")};${mixIn}amix=inputs=${placements.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)}[v]`, "-map", "[v]", voice]);

// 4. Final videos, loudness-normalized: narrated (music ducks under the voice) and music-only
const enc = ["-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", total.toFixed(3)];
const narrated = path.join(OUT, `${NAME}.mp4`);
if (MUSIC)
  run(["-i", video, "-i", voice, "-i", music, "-filter_complex", "[2:a]volume=0.5[m];[m][1:a]sidechaincompress=threshold=0.015:ratio=8:attack=30:release=500[duck];[1:a][duck]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]", ...enc, narrated]);
else run(["-i", video, "-i", voice, "-filter_complex", "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]", ...enc, narrated]);
const outs = [narrated];
if (MUSIC) {
  const musicOnly = path.join(OUT, `${NAME}-music-only.mp4`);
  run(["-i", video, "-i", music, "-filter_complex", "[1:a]loudnorm=I=-18:TP=-1.5:LRA=11[a]", ...enc, musicOnly]);
  outs.push(musicOnly);
}
console.log(`\ndone: ${total.toFixed(1)}s${total > 140 ? "  (over 2:20: too long for a standard X account)" : ""}\n  ${outs.join("\n  ")}`);
