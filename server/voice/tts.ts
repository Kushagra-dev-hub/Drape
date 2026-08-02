const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const XAI_TTS_VOICE = "rex";
const AUDIO_CHUNK_SIZE = 8192; // ~170ms at 24kHz 16-bit mono

// Momento calls this once on a complete final reply, not repeatedly against
// a growing stream — so unlike a "consume as it grows" extractor, a trailing
// fragment with no closing punctuation (a short warm reply, say) must still
// come out as its own sentence rather than being silently dropped.
export function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]*[.!?]+(?:\s|$)/g);
  const sentences = (matches ?? []).map((s) => s.trim()).filter(Boolean);
  const consumed = matches?.join("") ?? "";
  const remainder = text.slice(consumed.length).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

export async function synthesizeSpeech(
  text: string,
  signal: AbortSignal,
  onChunk: (base64: string) => void
): Promise<void> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not configured");

  const response = await fetch(XAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: XAI_TTS_VOICE,
      language: "en",
      output_format: { codec: "pcm", sample_rate: 24000 },
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errText = await response.text().catch(() => "");
    throw new Error(`xAI TTS failed (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  let leftover = new Uint8Array(0);

  while (true) {
    if (signal.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const combined = new Uint8Array(leftover.length + value.length);
    combined.set(leftover, 0);
    combined.set(value, leftover.length);

    let offset = 0;
    while (combined.length - offset >= AUDIO_CHUNK_SIZE) {
      if (signal.aborted) return;
      const chunk = combined.subarray(offset, offset + AUDIO_CHUNK_SIZE);
      onChunk(Buffer.from(chunk).toString("base64"));
      offset += AUDIO_CHUNK_SIZE;
    }
    leftover = combined.subarray(offset);
  }

  if (!signal.aborted && leftover.length > 0) {
    onChunk(Buffer.from(leftover).toString("base64"));
  }
}
