# `<mascot-voice>` — a mascot that listens, thinks, speaks and asks

A dependency-free custom element for a voice interface. Four postures the mascot moves
between while a conversation runs, plus a mouth that lipsyncs to real audio.

```
design_handoff_mascot_voice/
  mascot-voice.js    the custom element (ES module, no dependencies, no build step)
  hi-body.png        the 123x202 mascot sprite it draws on
  demo.html          runnable example: looping conversation, state chips, live microphone
  README.md
```

Open `demo.html` in a browser before wiring anything up — it exercises every state and
includes a working mic hookup you can copy verbatim.

---

## Use

```html
<script type="module" src="/mascot-voice/mascot-voice.js"></script>
<mascot-voice id="m" size="240" assets="/mascot-voice/"></mascot-voice>
```

```js
const m = document.getElementById('m');
m.state = 'listening';                     // 'idle' | 'listening' | 'thinking' | 'speaking' | 'asking'
m.text  = 'What can I help with?';         // the line being spoken, or the live transcript
m.level = 0.42;                            // live audio level, 0..1, set every frame
```

`assets` is the folder holding `hi-body.png`. It defaults to `./`, which is relative to
the *document*, not the script — set it explicitly unless both sit at the site root.

### Attributes / properties

| name | type | default | what it does |
|---|---|---|---|
| `state` | see above | `idle` | the posture. Transitions are sprung, ~250ms. |
| `text` | string | `''` | live transcript while listening; the line being spoken while speaking/asking. Also drives the synthesised lipsync. |
| `level` | 0–1 | — | live audio level. **Property only** in practice — set it every frame from an analyser. Decays after 400ms of no updates and hands back to the synthesised envelope. |
| `size` | px | `234` | rendered width. Height follows the sprite ratio (`size × 1.642`). |
| `assets` | path | `./` | folder containing `hi-body.png`. |
| `motion` | 0–2 | `1` | global amplitude on breath, bob, rings and nods. `0` = pose only. |

### Read-only

| name | what it gives you |
|---|---|
| `spokenChars` | how many characters of `text` have been "said" — drive your caption reveal from it |
| `busy` | `true` while a speaking/asking line is still playing out |

### Methods and events

- `m.blink()` — force a blink.
- `spoken` event — fires once when a speaking/asking line finishes. `detail` is the text.
  Use it to advance your turn-taking (`m.addEventListener('spoken', () => m.state = 'listening')`).

Everything holds until you change it: there are no timed states that snap back on their
own except the internal beats of a spoken line.

---

## Wiring STT

```js
const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
rec.interimResults = true;
rec.continuous = true;

rec.onstart  = () => { m.state = 'listening'; };
rec.onresult = (e) => {
  let t = '';
  for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
  m.text = t;                                       // shows as the live transcript
  if (e.results[e.results.length - 1].isFinal) { m.state = 'thinking'; send(t); }
};
rec.onend = () => { m.state = 'idle'; };
```

Feeding a real mic level is worth the twenty lines — the listening state is much more
alive when the rings, the ear cock and the nods track the user's actual voice:

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const ac = new AudioContext();
const an = ac.createAnalyser();
an.fftSize = 512; an.smoothingTimeConstant = 0.7;
ac.createMediaStreamSource(stream).connect(an);

const buf = new Uint8Array(an.frequencyBinCount);
(function pump() {
  requestAnimationFrame(pump);
  an.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
  m.level = Math.min(1, Math.sqrt(sum / buf.length) * 5.2);   // 5.2 = gain, tune to your mic
})();
```

`demo.html` also shows silence detection (1.1s under 0.07 → hand off to `thinking`),
which is usually enough if you aren't using a VAD.

## Wiring TTS

Use **`asking`** instead of `speaking` whenever the reply ends in a question. That's the
state that tips the head back, lifts the brows, widens the eyes, floats the `?` bubble,
and leaves the mouth open on an "o" instead of closing it. A one-liner covers it:

```js
m.state = /\?\s*$/.test(reply) ? 'asking' : 'speaking';
m.text  = reply;
```

**Browser SpeechSynthesis** (no audio node available):

```js
const u = new SpeechSynthesisUtterance(reply);
u.onend = () => { m.state = 'listening'; };
speechSynthesis.speak(u);
```

Don't set `level` here — the rig falls back to an envelope synthesised from `text`. It's
not true lipsync, but the rhythm reads correctly and `spokenChars` stays in step with the
mouth, so your caption reveal still matches.

**Streaming audio TTS** (ElevenLabs, OpenAI, Cartesia…) — route it through an analyser
and the mouth is genuinely lipsynced:

```js
const audio = new Audio(url);
const ac = new AudioContext();
const an = ac.createAnalyser();
an.fftSize = 512; an.smoothingTimeConstant = 0.7;
ac.createMediaElementSource(audio).connect(an);
an.connect(ac.destination);              // required, or playback is silent
audio.onended = () => { m.state = 'listening'; };
audio.play();
// then the same pump() loop as above, feeding m.level
```

---

## What each state actually does

- **listening** — leans in 3.4°, ear cocks toward the user, eyes widen 9% and hold gaze
  down at them; concentric rings pulse on the live level and the head nods on loud
  syllables. A green ear-wave arc marks the ear as the active organ.
- **thinking** — gaze breaks contact and drifts up-left, lids drop to 78%, body cants 8°,
  three amber dots cycle. The one moment it isn't looking at the user.
- **speaking** — mouth height follows the level, width opens on vowels, and a syllable
  bob rocks the body ±1.5° so the rhythm isn't only in the jaw.
- **asking** — same lipsync, but the last third of the line rises: head back, brows up,
  eyes wider, `?` bubble in, mouth settling open.

## Tuning

Everything lives in the first 60 lines of `mascot-voice.js`:

- **`POSE`** — the target pose per state. Edit a number, that state changes; the spring
  between states is uniform, so nothing else needs adjusting.
- **`utterance()`** — the synthesised-speech generator. Syllable length `.14 + rnd()*.12`,
  inter-syllable gap `.022 + rnd()*.034`, punctuation pause `.28` (all seconds). Raise all
  three to slow speech down.
- **`ACCENT`** — per-state colour, used by the `?` bubble, thinking dots and ear-wave arcs.
  Match these to your own status UI (the demo reuses them for its status dot).

Two implementation notes before you edit the rig itself:

1. The sprite is drawn as **two clipped copies** of `hi-body.png` — an ears layer
   (`y < 65`) over a body layer (`y ≥ 65`) — so the ears can move independently. The ear
   transform is `skewX` + `scaleY` about the seam line, **never `rotate`**: both of those
   leave the cut edge exactly in place, so the seam stays invisible. A rotation there
   visibly splits the skull.
2. Eyes and mouth are **drawn over** the baked-in art with a matched patch fill
   (`#faf1fc → #efe1f7`), which is the only reason they can blink, track gaze and lipsync.
   If you swap the sprite, the face coordinates in `#build()` (plain sprite px, 123×202)
   need remeasuring.

## Accessibility

The rig is decorative — it carries no text. Render the transcript and the reply in your
own DOM (the demo does; drive the reveal from `spokenChars`) and announce it in a live
region. The element honours `prefers-reduced-motion` by dropping breath, bob, hop and
rings while keeping gaze, blink and mouth; you can go further with `motion="0"`.
