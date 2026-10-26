---
name: demo-video
description: Produce a polished product demo or pitch video from a live web app, with no screen recording by hand. Films real pages in headless Chrome with a CSS camera (floating-screen push-ins, zooms, pans, spotlights, labels, a moving cursor), adds animated title cards, an ElevenLabs voice, word-by-word captions and a music bed, and exports 1080p MP4s. Use when the user asks for a demo video, pitch video, product walkthrough or launch video of a web app.
---

# Demo video

Turns a script into a finished 1080p video of a real, live web app. Everything on screen is the actual product and real data; the "production" is a camera and overlays injected into the page.

What it produces (`<out.dir>/<out.name>.mp4` and `…-music-only.mp4`):
- Logo intro, animated title cards between sections, an end card with links
- App scenes that open as a floating screen on a dark canvas, push in, zoom and pan onto details, then pull back out
- A cursor that moves, clicks (with ripples) and rides along with the camera; spotlights; pop-in labels
- Captions in two-line chunks, words lighting up as they are spoken
- ElevenLabs narration, a soft generated music bed that ducks under the voice, loudness-normalized (-16 LUFS)

## Setup (once per machine)

The skill folder has its own `node_modules` (puppeteer-core) and `.browsers/` (chrome-headless-shell). If either is missing:
```
cd ~/.claude/skills/demo-video && npm install
npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.claude/skills/demo-video/.browsers
```
ffmpeg must be on PATH, or set `FFMPEG`. Voice needs `ELEVENLABS_API_KEY` in the environment or in the `.env` file the config names. Without it, `tts.cjs` falls back to the Windows voice, which is fine for timing a draft but not for delivery. Never print the key.

## Workflow

Work in a folder outside the repo (the session scratchpad is ideal); it fills with clips, audio and sheets. `S` = `~/.claude/skills/demo-video/scripts`.

1. **Script first.** Agree the narration with the user before shooting. Structure for pitch videos (judges ask "could real people use this?"):
   who/what (1 line) → the problem people feel → the idea, as a title card → the working product (2 to 3 scenes) → proof (a real transaction, metric or user) → why this platform → close with where to try it.
   Aim for 2:00 to 2:20. **X caps video at 2:20 for accounts without Premium.** Read any live numbers (prices, counts) right before shooting and pass them in `vars`.
2. **Config.** Copy `templates/video.config.cjs` into the work folder. It documents scene kinds, the line format and the camera API. `examples/tandem/video.config.cjs` is a complete, proven 11-scene video. Crib from it.
3. **Voice:** `node $S/tts.cjs <work>`. Prints each line's length. Lines are cached, so edits only re-voice what changed.
4. **Shoot:** `node $S/shoot.cjs <work> [scene,ids]`. About a minute per scene; run it in the background for a full shoot. Watch for `actions ran past the scene` and `kit: no target` warnings.
5. **Review:** `node $S/sheets.cjs <work>`, then Read the PNGs in `<work>/sheets/`. Also check that planned and recorded lengths match (drift means captions and voice slip). Look for: ads or clutter, test data, a zoom that misses, labels in odd places, captions covering what the line is about. Reshoot only the scenes that need it by passing their ids to `shoot.cjs`.
6. **Mix:** `node $S/mix.cjs <work>`. Then spot-check a few frames of the final MP4.
7. **Deliver:** give the paths, the length and what's in it. Say plainly what you changed on screen (hidden ads, hidden test entries) and that you cannot hear audio, so the user should watch it once with sound, especially the voice and the music.

## Craft rules

- **Real product, real data.** Never fake numbers, never mock screens. It is fine to hide third-party ads, cookie banners and the user's own test clutter in `setup()`. Say that you did.
- **One idea per line, one camera move per idea.** Push in on the thing the line talks about, while it's being said. Pan between zoom targets (a second `zoomTo`) rather than zooming out and in again.
- **Keep acts shorter than their line.** If a scene overruns, trim the act or split the line. Lines of 3 to 8 s read best; very long sentences make long caption chunks.
- **Target elements, not coordinates.** On third-party pages, tag targets in `setup()` (`el.setAttribute("data-kit", "fee")`) and zoom to `[data-kit=fee]`. Ads and banners shift layouts between loads, so `{rect}` targets drift.
- **Alternate cards and pages.** A title card every one or two page scenes keeps rhythm and gives the eye a rest.
- **Captions are on for pages and off for cards**, where the card is the text. Use `say` when spoken and written forms differ (URLs, tickers, "A.I.").
- Match the product's brand in `theme` and `stage` (accent color, font, logo SVG). The canvas stays dark so the light app pops.

## Gotchas already solved (don't relearn them)

- The camera transforms `<body>`; overlays live on `<html>` so they don't scale. `position: fixed` inside body behaves like absolute while zoomed. That's fine, because nothing scrolls while zoomed.
- `frame("out")` pulls back from the current zoom in one move. Don't `zoomOut()` at the end of a scene.
- Scroll-reveal animations need about 1.5 s to settle after the start scroll (built into `shoot.cjs`).
- ElevenLabs free tier: only `mp3_44100_128`, and requests hit `429 system_busy` at peak times (retried automatically). `with-timestamps` gives character timings for the word-by-word captions; `previous_text`/`next_text` keep the delivery consistent across lines.
- The screencast `quality` is a VP9 CRF (lower is better, 12 is used); final encode is x264 CRF 16.
- Some wallets or apps list data by a localStorage id: preset it with `browser.localStorage` to show a real account's records without connecting a wallet.
- Don't chain `sleep` in the shell to wait for a shoot. Run it in the background and read its log when notified.
