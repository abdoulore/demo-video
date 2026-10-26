# Voices one line with Microsoft Edge TTS: python edge_tts_line.py <voice> <rate> <out.mp3>  (text on stdin)
# Prints JSON: {"dur": ms, "words": [[word, start_ms], ...]}. Needs: pip install edge-tts
import asyncio, json, sys
import edge_tts

async def main():
    voice, rate, out = sys.argv[1], sys.argv[2], sys.argv[3]
    text = sys.stdin.read().strip()
    c = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    audio, words = bytearray(), []
    async for ch in c.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append([ch["text"], round(ch["offset"] / 1e4)])
    with open(out, "wb") as f:
        f.write(audio)
    # The stream is 24 kHz, 48 kbit/s mono MP3: 6000 bytes per second.
    print(json.dumps({"dur": round(len(audio) / 6), "words": words}))

asyncio.run(main())
