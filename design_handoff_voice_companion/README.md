# VoiceMascot — speaking & listening rig

A single React component that makes the mascot read as **listening**, **thinking**,
**speaking**, or **asking a question**. No dependencies beyond React.

    design_handoff_voice_companion/
      VoiceMascot.jsx    the component (plain JS + React.createElement, no build step needed)
      hi-body.png        the 123x202 mascot sprite it draws on
      demo.html          runnable example (open it directly in a browser)
      README.md

Open `demo.html` in a browser to see it running before you wire anything up.

---

## Install

Drop `VoiceMascot.jsx` and `hi-body.png` into your app. The file has no imports — it
reads `window.React` and exports via both `module.exports` and `window.VoiceMascot`,
so it works with a bundler, with a plain `<script>`, or renamed to `.js`.

With a bundler, change the top line to `import React from 'react'` and the bottom to
`export { VoiceMascot }`. Nothing else needs touching.

```jsx
import { VoiceMascot } from './VoiceMascot';
import sprite from './hi-body.png';

<VoiceMascot state={state} text={text} amplitude={level} spriteSrc={sprite} />
```

## Props

| prop | type | default | what it does |
|---|---|---|---|
| `state` | `'idle' \| 'listening' \| 'thinking' \| 'speaking' \| 'asking'` | `'idle'` | the posture. Changing it cross-fades over ~190ms. |
| `text` | string | `''` | live transcript while listening; the line being spoken while speaking/asking. Drives caption + synthesised lipsync. |
| `amplitude` | number 0–1 \| null | `null` | live audio level. When null, the rig fakes an envelope from `text`. |
| `scale` | number | `1.9` | sprite scale. `1.9` → 234×384px. |
| `spriteSrc` | string | `'hi-body.png'` | path/URL to the sprite. |
| `showAura` | bool | `true` | the concentric listening rings + glow. |
| `showCaption` | bool | `true` | status pill + caption line. Turn off if your app renders its own transcript. |
| `showMeter` | bool | `true` | the 20-bar level meter. |
| `onStateEnter` | `(state) => void` | — | fires when a state begins. |

Imperative alternative, if you'd rather not re-render on every state change:

```js
const ref = useRef();
<VoiceMascot ref={ref} />
ref.current.setState_('speaking', 'Here is what I found.');
ref.current.setAmplitude(0.62);
```

---

## Wiring STT

Set `listening` when recognition starts, feed it the interim transcript, and hand it a
real mic level so the rings and nods track the user's voice.

```js
const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
rec.interimResults = true;
rec.continuous = true;

rec.onstart  = () => setState('listening');
rec.onresult = (e) => {
  let t = '';
  for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
  setText(t);
  if (e.results[e.results.length - 1].isFinal) { setState('thinking'); send(t); }
};
rec.onend = () => setState('idle');
```

Mic level (worth doing — the listening state is much more alive with it):

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const ac  = new AudioContext();
const an  = ac.createAnalyser();
an.fftSize = 512; an.smoothingTimeConstant = 0.7;
ac.createMediaStreamSource(stream).connect(an);

const buf = new Uint8Array(an.frequencyBinCount);
(function tick() {
  an.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
  setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5.2));  // 5.2 = gain, tune to your mic
  requestAnimationFrame(tick);
})();
```

## Wiring TTS

Use `asking` instead of `speaking` whenever the reply ends in a question — that's what
triggers the head tip-back, the brow lift and the "?" bubble. A one-line heuristic is
usually enough:

```js
const isQuestion = /\?\s*$/.test(reply);
setState(isQuestion ? 'asking' : 'speaking');
setText(reply);
```

### Browser SpeechSynthesis (no analyser available)

```js
const u = new SpeechSynthesisUtterance(reply);
u.onend = () => setState('listening');
speechSynthesis.speak(u);
```

Leave `amplitude` at `null` here — SpeechSynthesis gives you no audio node, so the rig
falls back to its text-derived envelope. It's synthetic but reads correctly, and the
caption reveal stays in step with the mouth.

### Streaming audio TTS (ElevenLabs, OpenAI, Cartesia…)

Route the audio element through an analyser and feed the same RMS as above:

```js
const audio = new Audio(url);
const ac = new AudioContext();
const an = ac.createAnalyser();
an.fftSize = 512; an.smoothingTimeConstant = 0.7;
ac.createMediaElementSource(audio).connect(an);
an.connect(ac.destination);            // don't forget, or playback is silent
audio.onended = () => setState('listening');
audio.play();
```

With a real analyser the mouth is genuinely lipsynced to the audio.

---

## Tuning

Everything lives at the top of `VoiceMascot.jsx`:

- **`POSE`** — the target pose per state (lean, ear cock, eye scale, gaze, brow, glow).
  Edit a number and that state changes; the spring between states is uniform.
- **`utterance()`** — the fake-speech generator. Syllable length `140 + rnd()*120`,
  inter-syllable gap `22 + rnd()*34`, punctuation pause `280`. Raise all three to slow
  speech down, lower to speed it up.
- **`ACCENT`** — per-state colour used by the status dot, thinking dots and ear-wave arcs.

Two implementation notes worth knowing before you edit the rig:

1. The sprite is drawn as **two clipped copies** of `hi-body.png` — an ears layer
   (`y < 65`) over a body layer (`y >= 65`) — so the ears can twitch independently.
   The ear transform is `skewX` + `scaleY` about the seam line, *never* `rotate`:
   both leave the cut edge exactly in place, so the seam stays invisible. A rotation
   there visibly splits the skull.
2. Eyes and mouth are **drawn over** the baked-in art with a matched patch fill
   (`#faf1fc → #efe1f7`), which is why they can blink, track gaze and lipsync at all.
   If you swap the sprite, the face coordinates in `render()` (sprite-space px,
   123×202) need remeasuring.

## Accessibility

The rig is decorative; the caption carries the content. If you hide the caption
(`showCaption={false}`), make sure your own transcript is in the DOM and announced —
and consider gating the motion behind `prefers-reduced-motion` by leaving `state` at
`'idle'` and `showAura={false}`.
