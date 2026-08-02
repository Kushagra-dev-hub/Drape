// Microphone capture for talk mode — 16kHz mono PCM via AudioWorklet, with a
// ScriptProcessor fallback for browsers without AudioWorklet support.

export type AudioCapture = {
  start: (onChunk: (buf: ArrayBuffer) => void) => Promise<boolean>;
  stop: () => void;
  setMuted: (muted: boolean) => void;
};

export function createAudioCapture(): AudioCapture {
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;
  let muted = false;

  function stop() {
    if (workletNode) {
      workletNode.disconnect();
      workletNode.port.close();
      workletNode = null;
    }
    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor.onaudioprocess = null;
      scriptProcessor = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  }

  async function start(onChunk: (buf: ArrayBuffer) => void): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStream = stream;

      const ctx = new AudioContext({ sampleRate: 16000, latencyHint: "interactive" });
      audioContext = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      let useWorklet = typeof ctx.audioWorklet !== "undefined";

      if (useWorklet) {
        try {
          await ctx.audioWorklet.addModule("/audio-worklet-processor.js");
          const node = new AudioWorkletNode(ctx, "pcm-capture-processor");
          workletNode = node;
          node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
            if (muted) return;
            onChunk(e.data);
          };
          source.connect(node);
        } catch {
          useWorklet = false;
        }
      }

      if (!useWorklet) {
        const processor = ctx.createScriptProcessor(2048, 1, 1);
        scriptProcessor = processor;
        processor.onaudioprocess = (e) => {
          if (muted) return;
          const input = e.inputBuffer.getChannelData(0);
          const buffer = new ArrayBuffer(input.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          }
          onChunk(buffer);
        };
        source.connect(processor);
        processor.connect(ctx.destination);
      }

      return true;
    } catch (err) {
      console.error("[TalkMode] Microphone access failed", err);
      stop();
      return false;
    }
  }

  return {
    start,
    stop,
    setMuted: (m: boolean) => {
      muted = m;
    },
  };
}
