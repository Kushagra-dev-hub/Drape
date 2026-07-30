# Handoff: Login page companion mascot

## Overview
A login page where the mascot ("Pip") behaves like a companion rather than decoration:
it floats and breathes while idle, turns toward the email field, **politely closes its eyes
and looks away while the password is typed**, leans in when the login button is hovered,
hops with a sparkle burst on submit, celebrates a success with a wave, and answers a
failure with a curious head-tilt. Split layout: mascot panel at 25% width, form on the right.

## About the design files
`mascot-companion.js` is a **production-ready drop-in**, not a mock: a dependency-free
custom element that owns the rig, the pose table and the animation loop. You drive it with
one property — `el.state = 'email' | 'password' | …`. `demo.html` is the reference
integration (panel styling + the ~25 lines that map form events onto states) — copy from it.
`reference/Login Companion.dc.html` is the original design prototype; reference only, do not ship.

## Fidelity
**High fidelity.** Poses, timings, easing and colors below are final. The one deliberate
deviation from the brief: the character art has no scarf, so the lagging secondary motion
comes from the aura, the tail-following body sway and the drifting sparkles instead.

## Install
```
public/mascot-companion/
  mascot-companion.js
  base.png    123×202  mascot with the face erased (eyes/mouth are live DOM, not art)
  arm.png     30×64    the hinged paw; sprite pivot (24,9) = shoulder at body (24,127)
```
```html
<script type="module" src="/mascot-companion/mascot-companion.js"></script>
<mascot-companion id="pip" size="300" state="idle" assets="/mascot-companion/"></mascot-companion>
```
React: `import '/mascot-companion/mascot-companion.js'` once, then
`<mascot-companion ref={r} size={300} state={state} assets="/mascot-companion/" />`
(pass `state` as a plain string attribute — it is observed). Next.js: client component only.

### API
| | |
|---|---|
| `state` | attribute **and** property: `idle`, `email`, `typing`, `password`, `hover`, `submit`, `success`, `error` |
| `size` | px width; height follows the 332×546 design box |
| `assets` | base path for the two PNGs |
| `motion` | 0–2 amplitude multiplier for the ambient float/hop (default 1) |
| `blink()` | force a blink |
| `settled` event | fires when a timed beat (`success` 1.9s, `error` 1.4s) ends and the state returns to `idle` |

`submit` holds (hop + sparkles) until you change it — set it on submit, then set `success`
or `error` when your auth call resolves. `prefers-reduced-motion: reduce` drops the float and
hop and keeps gaze, blink and expression.

### Wiring (the whole integration)
```js
email.onfocus = () => pip.state = 'email';
pw.onfocus    = () => pip.state = 'password';   // the signature beat
email.oninput = () => { pip.state = 'typing'; debounceBackTo('email', 1100); };
btn.onmouseenter = () => pip.state = 'hover';
form.onsubmit = async () => { pip.state = 'submit'; pip.state = await login() ? 'success' : 'error'; };
```

## Rig
The face is **not** part of the artwork. `base.png` is the mascot with eyes and mouth
diffusion-inpainted out; the component draws them as DOM so they can blink, gaze and morph:
- design box 332×546 = art px × 2.7; body rotates about `166px 546px` (the feet)
- left eye box `20.25, 203.85, 32.4×70.2`; right eye `133.65, 201.15, 54×75.6`
- eye fill `linear-gradient(178deg,#1a1338,#0a0718 42%,#3a2a63 76%,#9d75cb)` + white
  highlight at 15%/11% (35%×23%) and a `#e7d8ff` bottom bounce at 40% opacity
- closed/happy eyes are separate arc SVGs cross-faded against the ellipses (`arc` channel);
  blinking is `scaleY` on the ellipse, so a blink never fights a closed-eye pose
- mouth SVG at `70.2, 261.9, 43.2×32.4` (viewBox `0 0 16 12`), three cross-faded shapes:
  smile (stroke `#bda7d6`), open smile (fill `#a07dc6`), curious dot (fill `#ab8bce`)
- paw img `81×172.8` at `0, 318.6`, `transform-origin 64.8px 24.3px`, **behind** the body
- **the rig is mirrored** (`scaleX(-1)`) so the mascot faces the form; pose values stay in
  "toward the form" terms and `rot`/`fx`/`gx` are negated at apply time

## Motion system
Every state is a single pose in the `POSE` table; springs (`x += (v += (target-x)*k) * d`)
supply all easing, lag and overlap — nothing is keyframed, so states can be interrupted at
any moment and nothing stops moving at the same instant. Per-channel stiffness/damping:
face `.12/.78`, gaze `.16/.74`, eyelids `.14/.72`, arm `.22/.62`, hop `.30/.55`, aura `.06/.82`
(deliberately slowest, so the glow trails the body).

Pose channels: `rot` body lean · `fx/fy` face offset (this is what reads as a head turn at
this scale) · `gx/gy` eye aim · `arc` eyes-closed · `wide` eye widen · `mouth` shape index.

| state | reads as |
|---|---|
| idle | float 7px @4.6s, breath @3.1s, sway @7.3s, random blink every 2.4–6.6s |
| email / typing | lean +2.4°, face +5px and eyes +4/+3.5 toward the field; typing adds ±1.4px @9Hz micro-adjustments |
| password | lean −3°, face −7px away, eyes close to arcs, smile held |
| hover | lean +3.6°, eyes widen 30% |
| submit | 26px hop, eyes 14% wider, open smile, 6-sparkle burst |
| success | double hop (30px + 16px), happy arc eyes, paw to 112° with a 3-cycle wave, sparkles — settles at 1.9s |
| error | tilt −3.6°, one forced blink, curious dot mouth — settles at 1.4s |

## Design tokens
- Panel `linear-gradient(168deg,#cdb8f0,#b295e4 52%,#9573d4)`; floor veil `rgba(84,52,143,.3)`; rings `rgba(255,255,255,.42)`
- Aura `radial-gradient(closest-side,rgba(255,255,255,.92),rgba(233,222,252,.42) 52%,transparent 74%)`
- Contact shadow `rgba(69,38,124,.62)`; mascot art gets `saturate(1.22) contrast(1.05)` so it doesn't wash out
- Form: bg `#fdfcff`, ink `#241b3d`, muted `#6f6486`, border `#e6e0f2`, accent `#8b62dd` → button `linear-gradient(180deg,#7c56d3,#6842c2)`, error `#a34158` on `#fdf2f4`
- Type: Plus Jakarta Sans (400–700) for UI; Quicksand 600 for the mascot caption
- Caption `#f0e7ff`, 12.5px, `letter-spacing .14em`, uppercase

## Notes for implementation
- Panel is 25% wide (min 320, max 430); the mascot renders at `size="300"` centred at 52% height.
- The ambient panel sparkles and the caption belong to the page, not the component — see `demo.html`.
- Rive was suggested in the brief. This ships the same state machine in ~300 lines of plain JS with
  no runtime; if you still want Rive, `POSE` + the beat table map 1:1 onto rig inputs.

## Files
- `mascot-companion.js`, `base.png`, `arm.png` — ship these
- `demo.html` — reference integration, copy the panel CSS and the event wiring
- `reference/Login Companion.dc.html` — original prototype (reference only)
