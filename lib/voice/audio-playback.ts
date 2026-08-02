// Talk mode TTS playback — raw headerless PCM (24kHz mono 16-bit) can't go
// through decodeAudioData or an <audio> tag, so chunks are manually decoded
// and gapless-scheduled on the Web Audio API using a running play-time cursor.

export type AudioPlayback = {
  enqueueBase64Chunk: (base64: string) => void;
  /** Record that the NEXT chunk enqueued starts a new sentence, labeled `text`.
   *  Call this before enqueuing that sentence's first chunk — it stamps the
   *  boundary with wherever the gapless queue currently ends, i.e. exactly
   *  when this sentence's audio will actually start sounding. */
  markSentenceBoundary: (text: string) => void;
  /** Whichever sentence's audio is actually sounding right now, by the real
   *  playback clock — not whichever sentence the server most recently sent
   *  (that arrives well ahead of its audio actually starting/finishing, since
   *  TTS synthesis+download is usually faster than real-time playback). */
  getCurrentSentenceText: () => string;
  stopAll: () => void;
  /** Live RMS level of what's actually audible right now, 0..1 — feed this into
   *  mascot-voice's `level` prop for real lipsync instead of its synthesized guess. */
  getLevel: () => number;
  /** True iff there is currently scheduled audio still sounding. This is the only
   *  reliable "is the agent actually talking" signal — the server's ai-transcript/
   *  turn-complete events fire on send/generate timing, not on real playback timing,
   *  so driving UI state off them instead of this leads it to visibly desync from TTS. */
  isPlaying: () => boolean;
};

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

export function createAudioPlayback(): AudioPlayback {
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let analyserData: Uint8Array<ArrayBuffer> | null = null;
  let nextPlayTime = 0;
  const activeSources = new Set<AudioBufferSourceNode>();
  let boundaries: { startAt: number; text: string }[] = [];

  function getContext(): { ctx: AudioContext; analyser: AnalyserNode } {
    if (!ctx || !analyser) {
      ctx = new AudioContext({ sampleRate: 24000 });
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      analyser.connect(ctx.destination);
      analyserData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      nextPlayTime = 0;
    }
    return { ctx, analyser };
  }

  function enqueueBase64Chunk(base64: string) {
    const { ctx: audioCtx, analyser: an } = getContext();
    const int16 = base64ToInt16(base64);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(an);

    const startAt = Math.max(nextPlayTime, audioCtx.currentTime);
    source.start(startAt);
    nextPlayTime = startAt + buffer.duration;

    activeSources.add(source);
    source.onended = () => activeSources.delete(source);
  }

  function markSentenceBoundary(text: string) {
    const { ctx: audioCtx } = getContext();
    const startAt = Math.max(nextPlayTime, audioCtx.currentTime);
    boundaries.push({ startAt, text });
  }

  function getCurrentSentenceText(): string {
    if (!ctx || !isPlaying()) return "";
    const now = ctx.currentTime;
    let current = "";
    for (const b of boundaries) {
      if (b.startAt > now) break;
      current = b.text;
    }
    return current;
  }

  function getLevel(): number {
    if (!ctx || !analyser || !analyserData) return 0;
    analyser.getByteTimeDomainData(analyserData);
    let sum = 0;
    for (let i = 0; i < analyserData.length; i++) {
      const x = (analyserData[i] - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / analyserData.length) * 4.2);
  }

  function isPlaying(): boolean {
    return !!ctx && ctx.currentTime < nextPlayTime;
  }

  function stopAll() {
    for (const source of activeSources) {
      try {
        source.stop();
      } catch {
        // already stopped/ended
      }
    }
    activeSources.clear();
    boundaries = [];
    nextPlayTime = 0;
    if (ctx) nextPlayTime = ctx.currentTime;
  }

  return { enqueueBase64Chunk, markSentenceBoundary, getCurrentSentenceText, stopAll, getLevel, isPlaying };
}
