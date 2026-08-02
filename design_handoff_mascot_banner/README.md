# `<mascot-banner>` — mascot holding a sign, with live sign copy

A dependency-free custom element. The sign face in the artwork is blank; the text you see
is real HTML drawn on top of it, so the copy is yours to change at runtime, from a CMS, or
straight in the markup.

```
design_handoff_mascot_banner/
  mascot-banner.js   the custom element (ES module, no dependencies, no build step)
  mascot-sign.png    553x416 sprite — background removed, sign face blanked
  demo.html          runnable example, including live copy editing
  README.md
```

Open `demo.html` first — it has a text field wired to the sign so you can see the copy
swap in real time.

---

## Use

```html
<script type="module" src="/mascot-banner/mascot-banner.js"></script>

<mascot-banner size="480" assets="/mascot-banner/">
  <span>Start adding to the Wish list!</span>
  <span>It’s a bit empty in here</span>
  <span>Tap the heart on anything you like</span>
</mascot-banner>
```

`assets` is the folder holding `mascot-sign.png`. It defaults to `./`, resolved against the
*document*, so set it explicitly unless both sit at the site root.

## Changing the sign copy — four ways

Pick whichever fits your stack; they're all equivalent.

```html
<!-- 1. child elements: one message per child. Easiest to hand to a content author. -->
<mascot-banner><span>First line</span><span>Second line</span></mascot-banner>

<!-- 2. attribute, split on | -->
<mascot-banner messages="First line | Second line | Third"></mascot-banner>

<!-- 3. a single static line, no cycling -->
<mascot-banner message="Your cart is empty"></mascot-banner>
```

```js
// 4. property — an array, set any time
el.messages = ['First line', 'Second line'];
el.message  = 'Just this one';        // collapses to a single line
```

The child-element form is watched with a `MutationObserver`, so a framework re-render or a
CMS swap updates the sign with no extra call. Multiple messages cycle on each sign-shake;
`cycle="0"` holds on the current one.

### Styling the copy

Set these on the element (or any ancestor):

```css
mascot-banner {
  --banner-color: #7357b5;                    /* text colour */
  --banner-font: 'Baloo 2', system-ui;        /* rounded fonts suit the art */
  --banner-size: 23px;                        /* in sprite space — scales with `size` */
  --banner-weight: 700;
}
```

`--banner-size` is measured against the 553px-wide artwork, so it scales with `size`
automatically — 23px stays visually correct at any width. Long copy wraps to two lines
inside the sign; three is the practical maximum before it gets tight.

## Attributes

| name | default | what it does |
|---|---|---|
| `size` | `553` | rendered width in px. Height follows (`size × 0.752`). |
| `assets` | `./` | folder containing `mascot-sign.png`. |
| `messages` | — | `\|`-separated copy. |
| `message` | — | a single line; overrides `messages`. |
| `cycle` | `6.5` | seconds between sign-shakes. `0` shakes but never changes the line. |
| `motion` | `1` | 0–2 global motion amplitude. `0` = still pose, no entrance. |

## Methods and events

- `el.shake()` — run the beat now (wiggle, squint, sparkles, next message). Good on a CTA
  click, or when the user does something you want acknowledged.
- `el.showMessage(n)` — jump to message `n` (0-based) with the swap transition.
- `message` event — fires after the copy changes. `detail = { index, text }`.
- `shake` event — fires at the start of each beat.

## What it does on its own

- **Entrance** — the sign rises from below the fold and overshoots once, then settles.
- **Idle** — a slow sway and bob, as if the sign has a little weight to it.
- **Eyes** — track the pointer; when nobody has moved for a few seconds the mascot glances
  down at its own sign, then back up. Blinks on a random interval, occasionally twice.
- **The beat** (every `cycle` seconds) — a double wiggle of the sign, the eyes pop wide and
  then squeeze into happy arcs, four sparkles pop, and the copy flips to the next line.

Honours `prefers-reduced-motion`: no entrance, no sway, no wiggle; the eyes and the copy
swap still work.

## Implementation notes

- The eyes are **drawn over** the baked art on a matched patch fill (`#f9edfa → #f0e1f7`),
  which is the only reason they can blink, track and squint. If you swap the sprite, the
  eye and sign rectangles at the top of `mascot-banner.js` (`EYE_L`, `EYE_R`, `SIGN`, in
  plain 553×416 sprite px) need remeasuring.
- The sprite's background was flood-removed and its shadow kept as soft translucency, so it
  sits on any light background. On a dark background you'll see a faint lavender halo —
  re-cut the sprite if you need that case.
- The rig is decorative and carries no accessible text of its own: the sign copy lives in
  the element's light DOM, so screen readers read it from there. Keep using the child-element
  form if that matters to you.
