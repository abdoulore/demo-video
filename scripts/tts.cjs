// Voices every narration line: node tts.cjs <workdir>
// voice.engine "edge" uses Microsoft Edge TTS (free, no key; needs `pip install edge-tts`). Otherwise
// ElevenLabs when ELEVENLABS_API_KEY is available (process.env or the config's .env file), else the
// Windows voice, which is only good for timing a draft. Cached per line, so reruns cost nothing.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { load, secret } = require("./lib.cjs");

const { dir, cfg, scenes } = load(process.argv[2]);
const OUT = path.join(dir, "tts");
fs.mkdirSync(OUT, { recursive: true });
const KEY = secret(cfg, "ELEVENLABS_API_KEY");
const V = Object.assign(
  { prefer: ["Brian", "Eric", "Chris", "Daniel", "George"], model: "eleven_multilingual_v2", format: "mp3_44100_128", settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } },
  cfg.voice || {},
);
const lines = scenes.flatMap((s) => s.lines);
const metaFile = path.join(OUT, "meta.json");
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : { lines: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Word start offsets (ms) for the caption text, from per-character timings of the spoken text.
function wordTimes(text, say, chars, starts) {
  if (say !== text || !chars) return null;
  const words = text.split(" ");
  const out = [];
  let w = 0;
  for (let i = 0; i < chars.length && w < words.length; i++) if (i === 0 || (chars[i - 1] === " " && chars[i] !== " ")) out[w++] = Math.round(starts[i] * 1000);
  while (out.length < words.length) out.push(out[out.length - 1] ?? 0);
  return out;
}
function proportional(text, dur) {
  let at = 0;
  return text.split(" ").map((w) => {
    const t = Math.round((at / text.length) * dur * 0.95);
    at += w.length + 1;
    return t;
  });
}

async function pickVoice() {
  if (V.id) return { voice_id: V.id, name: V.id };
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } });
  if (!res.ok) throw new Error(`ElevenLabs voices: HTTP ${res.status}`);
  const { voices } = await res.json();
  for (const name of V.prefer) {
    const v = voices.find((x) => x.name.split(" ")[0] === name);
    if (v) return v;
  }
  return voices[0];
}

async function elevenOnce(voiceId, line, prev, next, file) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${V.format}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text: line.say ?? line.text, model_id: V.model, previous_text: prev, next_text: next, voice_settings: V.settings }),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  fs.writeFileSync(file, Buffer.from(j.audio_base64, "base64"));
  const a = j.alignment;
  return { chars: a.characters, starts: a.character_start_times_seconds, dur: Math.round(a.character_end_times_seconds.at(-1) * 1000) };
}
// Free-tier requests get "system busy" (429) at peak times; back off and retry.
async function eleven(...args) {
  for (const wait of [4, 8, 15, 25, 40, 60]) {
    try {
      return await elevenOnce(...args);
    } catch (e) {
      if (!/HTTP (429|5\d\d)/.test(e.message)) throw e;
      console.log(`  busy, retrying ${args[1].id} in ${wait}s`);
      await sleep(wait * 1000);
    }
  }
  return elevenOnce(...args);
}

// Edge TTS through a small Python helper. Word timings come from its WordBoundary events.
function edge(text, file) {
  const out = execFileSync(V.python || "python", [path.join(__dirname, "edge_tts_line.py"), V.edgeVoice || "en-US-AndrewMultilingualNeural", V.rate || "+0%", file], { input: text, encoding: "utf8" });
  return JSON.parse(out.trim().split(String.fromCharCode(10)).pop().trim());
}
// Spoken words to caption words: one boundary per caption word when the counts agree.
function edgeWords(caption, spoken, dur) {
  const words = caption.split(" ");
  if (spoken.length === words.length) return spoken.map((w) => w[1]);
  return proportional(caption, dur);
}

function sapi(text, file) {
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${file.replace(/'/g, "''")}'); $s.Speak([Console]::In.ReadToEnd()); $s.Dispose()`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { input: text });
  const buf = fs.readFileSync(file);
  return Math.round(((buf.length - 44) / buf.readUInt32LE(28)) * 1000);
}

(async () => {
  const engine = V.engine === "edge" ? "edge" : KEY ? "eleven" : "sapi";
  const voice = engine === "eleven" ? await pickVoice() : null;
  console.log(
    engine === "eleven" ? `voice: ElevenLabs ${voice.name}`
      : engine === "edge" ? `voice: Edge TTS ${V.edgeVoice || "en-US-AndrewMultilingualNeural"}`
      : "voice: Windows (draft timing only; set ELEVENLABS_API_KEY for the real voice)",
  );
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const say = l.say ?? l.text;
    const c = meta.lines[l.id];
    if (c && c.engine === engine && c.say === say && c.text === l.text && fs.existsSync(path.join(OUT, c.file))) continue;
    const file = `${l.id}.${engine === "sapi" ? "wav" : "mp3"}`;
    let dur, words;
    if (engine === "eleven") {
      const r = await eleven(voice.voice_id, l, lines[i - 1]?.say ?? lines[i - 1]?.text, lines[i + 1]?.say ?? lines[i + 1]?.text, path.join(OUT, file));
      dur = r.dur;
      words = wordTimes(l.text, say, r.chars, r.starts) ?? proportional(l.text, dur);
    } else if (engine === "edge") {
      const r = edge(say, path.join(OUT, file));
      dur = r.dur;
      words = say === l.text ? edgeWords(l.text, r.words, dur) : proportional(l.text, dur);
    } else {
      dur = sapi(say, path.join(OUT, file));
      words = proportional(l.text, dur);
    }
    meta.lines[l.id] = { engine, file, say, text: l.text, dur, words };
    console.log(`${l.id}  ${(dur / 1000).toFixed(1)}s  ${l.text.slice(0, 60)}`);
  }
  meta.voice = voice?.name ?? (engine === "edge" ? V.edgeVoice || "en-US-AndrewMultilingualNeural" : "Windows");
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  const total = lines.reduce((a, l) => a + (meta.lines[l.id]?.dur ?? 0), 0);
  console.log(`total speech ${(total / 1000).toFixed(1)}s`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
