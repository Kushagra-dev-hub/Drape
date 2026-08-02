// Talk mode TTS playback — raw headerless PCM (24kHz mono 16-bit) can't go
// through decodeAudioData or an <audio> tag, so chunks are manually decoded
// and gapless-scheduled on the Web Audio API using a running play-time cursor.

export type AudioPlayback = {
  enqueueBase64Chunk: (base64: string) => void;
  stopAll: () => void;
};

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

export function createAudioPlayback(): AudioPlayback {
  let ctx: AudioContext | null = null;
  let nextPlayTime = 0;
  const activeSources = new Set<AudioBufferSourceNode>();

  function getContext(): AudioContext {
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: 24000 });
      nextPlayTime = 0;
    }
    return ctx;
  }

  function enqueueBase64Chunk(base64: string) {
    const audioCtx = getContext();
    const int16 = base64ToInt16(base64);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    const startAt = Math.max(nextPlayTime, audioCtx.currentTime);
    source.start(startAt);
    nextPlayTime = startAt + buffer.duration;

    activeSources.add(source);
    source.onended = () => activeSources.delete(source);
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
    nextPlayTime = 0;
    if (ctx) nextPlayTime = ctx.currentTime;
  }

  return { enqueueBase64Chunk, stopAll };
}
