/**
 * <mascot-hello> — transparent-background mascot "Hello" wave loop.
 * Drop-in custom element, no dependencies. Assets: hi-body.png, hi-arm.png.
 *
 *   <script type="module" src="/mascot-hello/mascot-hello.js"></script>
 *   <mascot-hello size="360" greeting="Hello!" warmth="1"
 *                 assets="/mascot-hello/"></mascot-hello>
 *
 * Attributes (all optional):
 *   size      px width/height of the square stage (default 360)
 *   greeting  speech copy, "" to hide (default "Hello!")
 *   warmth    0–1.4 intensity of the warm halo/sparkles (default 1)
 *   assets    base path for the two PNGs (default "./")
 *   paused    present = hold the first frame
 * Honors prefers-reduced-motion (holds a settled frame).
 */

const D = 1080;                       // design box
const SCALE = 3.96;
const BODY = { w: 123 * SCALE, h: 202 * SCALE };
const BODY_L = 540 - BODY.w / 2, BODY_T = D - 90 - BODY.h;
const ARM = { w: 30 * SCALE, h: 64 * SCALE, px: 24 * SCALE, py: 9 * SCALE };
const PIV = { x: BODY_L + 24 * SCALE, y: BODY_T + 127 * SCALE };
const SCENES = [['settle', 1.4], ['wave', 3.4], ['hold', 1.6]];
const TOTAL = SCENES.reduce((a, s) => a + s[1], 0);

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (t) => t * t * (3 - 2 * t);
const arcE = (t) => Math.sin(Math.PI * clamp01(t));
const pop = (t) => Math.sin(t * Math.PI * 2.2) * Math.pow(1 - t, 2.2);
const breathe = (p, c) => (1 - Math.cos(Math.PI * 2 * c * p)) / 2;

const WARM = ['#ffc78f', '#ffb07a', '#ffdcc0', '#ffe0a6'];
const MOTES = [
  { x: 230, y: 300, s: 26, n: 1.0, c: 0 },
  { x: 855, y: 380, s: 20, n: 1.6, c: 1 },
  { x: 740, y: 205, s: 15, n: 2.2, c: 3 },
  { x: 165, y: 605, s: 18, n: 1.3, c: 2 },
  { x: 905, y: 690, s: 22, n: 0.8, c: 0 },
  { x: 395, y: 160, s: 13, n: 2.6, c: 1 },
];

function sparkleEl(color) {
  const el = document.createElement('div');
  el.className = 'spk';
  el.innerHTML =
    `<i style="background:radial-gradient(closest-side,${color},rgba(255,255,255,0))"></i>` +
    `<u style="background:radial-gradient(closest-side,${color},rgba(255,255,255,0))"></u>`;
  return el;
}

// choreography -> a flat pose object, driven only by elapsed time
function pose(t) {
  let name = 'settle', p = 0, acc = 0;
  for (const [n, dur] of SCENES) {
    if (t < acc + dur || n === 'hold') { name = n; p = clamp01((t - acc) / dur); break; }
    acc += dur;
  }
  if (name === 'settle') {
    const b = breathe(p, 1);
    return { p, lift: 12 * b, sx: 1 - 0.012 * b, sy: 1 + 0.018 * b, lean: 0, arm: 0, glow: 0.45 * b, hi: 0, burst: 0 };
  }
  if (name === 'wave') {
    const b = breathe(p, 2.5);
    const up = ease(seg(p, 0.06, 0.26)) * (1 - ease(seg(p, 0.78, 0.94)));
    const osc = Math.sin(Math.PI * 2 * 3 * seg(p, 0.24, 0.80));
    const swing = osc * 15 * arcE(seg(p, 0.20, 0.84));
    return {
      p, lift: 14 * b + 10 * up, sx: 1 - 0.02 * b, sy: 1 + 0.028 * b,
      lean: -2.4 * up + 0.6 * osc * up,
      arm: 118 * up + swing * up + 7 * pop(seg(p, 0.20, 0.55)),
      glow: 0.35 * b + 0.6 * up,
      hi: ease(seg(p, 0.24, 0.38)) * (1 - ease(seg(p, 0.80, 0.94))),
      burst: arcE(seg(p, 0.28, 0.80)) * 0.85,
    };
  }
  const b = breathe(p, 1.5);
  return { p, lift: 10 * b, sx: 1 - 0.01 * b, sy: 1 + 0.014 * b, lean: Math.sin(Math.PI * 2 * p) * 1.4, arm: 0, glow: 0.4 * b, hi: 0, burst: 0 };
}

class MascotHello extends HTMLElement {
  static observedAttributes = ['size', 'greeting', 'warmth', 'assets', 'paused'];

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.#build();
    this.#resize();
    this.start = performance.now();
    this.#apply(pose(0));   // paint a settled frame before the first rAF tick
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now) => {
      if (!this.isConnected) return;
      const held = reduce || this.hasAttribute('paused');
      this.#apply(pose(held ? 0.35 : ((now - this.start) / 1000) % TOTAL));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  disconnectedCallback() { cancelAnimationFrame(this.raf); }

  attributeChangedCallback() {
    if (this.shadowRoot && this.shadowRoot.childNodes.length) { this.#build(); this.#resize(); }
  }

  #build() {
    const base = this.getAttribute('assets') || './';
    const greeting = this.getAttribute('greeting') ?? 'Hello!';
    const r = this.shadowRoot;
    r.innerHTML = `
      <style>
        :host { display: inline-block; position: relative; overflow: hidden; line-height: 0; }
        .stage { position: absolute; left: 0; top: 0; width: ${D}px; height: ${D}px; transform-origin: 0 0; overflow: hidden; }
        .halo { position: absolute; left: 70px; top: 90px; width: 940px; height: 940px; border-radius: 50%;
          background: radial-gradient(closest-side, rgba(255,186,132,.95) 0%, rgba(255,204,168,.4) 44%, rgba(255,214,180,0) 72%); }
        .shadow { position: absolute; left: 345px; width: 390px; height: 60px; border-radius: 50%;
          background: radial-gradient(closest-side, rgba(168,124,90,.85), rgba(168,124,90,0)); }
        .rig { position: absolute; inset: 0; }
        .rig img { position: absolute; image-rendering: auto; }
        .body { left: ${BODY_L}px; top: ${BODY_T}px; width: ${BODY.w}px; height: ${BODY.h}px; }
        .arm { left: ${PIV.x - ARM.px}px; top: ${PIV.y - ARM.py}px; width: ${ARM.w}px; height: ${ARM.h}px;
          transform-origin: ${ARM.px}px ${ARM.py}px; }
        .spk { position: absolute; }
        .spk i, .spk u { position: absolute; border-radius: 50%; }
        .hi { position: absolute; left: 120px; top: 210px; transform-origin: 15% 85%;
          font: 700 118px/1 Quicksand, ui-rounded, "Segoe UI Rounded", system-ui, sans-serif;
          letter-spacing: -.02em; color: #c9855a; text-shadow: 0 6px 18px rgba(201,133,90,.2); white-space: nowrap; }
      </style>
      <div class="stage">
        <div class="halo"></div>
        <div class="motes"></div>
        <div class="burst"></div>
        <div class="shadow"></div>
        <div class="rig">
          <img class="arm" src="${base}hi-arm.png" alt="">
          <img class="body" src="${base}hi-body.png" alt="Mascot waving hello">
        </div>
        <div class="hi">${greeting.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</div>
      </div>`;
    this.el = {
      stage: r.querySelector('.stage'), halo: r.querySelector('.halo'),
      shadow: r.querySelector('.shadow'), rig: r.querySelector('.rig'),
      arm: r.querySelector('.arm'), hi: r.querySelector('.hi'),
    };
    const motes = r.querySelector('.motes'), burst = r.querySelector('.burst');
    this.motes = MOTES.map((m) => { const e = sparkleEl(WARM[m.c]); motes.appendChild(e); return e; });
    this.burst = [0, 1, 2, 3].map((i) => { const e = sparkleEl(WARM[i % 4]); burst.appendChild(e); return e; });
    if (!greeting) this.el.hi.style.display = 'none';
  }

  #resize() {
    const size = parseFloat(this.getAttribute('size') || 360);
    this.style.width = this.style.height = size + 'px';
    this.el.stage.style.transform = `scale(${size / D})`;
  }

  #apply(s) {
    const w = Math.max(0, parseFloat(this.getAttribute('warmth') ?? 1));
    const E = this.el;
    E.halo.style.opacity = (0.16 + 0.15 * s.glow) * w;
    E.halo.style.transform = `translateY(${-s.lift * 0.3}px) scale(${1 + 0.05 * s.glow})`;
    E.shadow.style.top = `${D - 108 - s.lift * 0.3}px`;
    E.shadow.style.opacity = (0.22 - s.lift * 0.002) * w;
    E.rig.style.transformOrigin = `540px ${D - 90}px`;
    E.rig.style.transform = `translateY(${-s.lift}px) rotate(${s.lean}deg) scale(${s.sx}, ${s.sy})`;
    E.rig.style.filter = `drop-shadow(0 ${12 + s.lift * 0.05}px 20px rgba(163,116,84,${0.16 * w}))`;
    E.arm.style.transform = `rotate(${s.arm}deg)`;

    this.motes.forEach((el, i) => {
      const m = MOTES[i], ph = Math.PI * 2 * m.n * s.p;
      const drift = Math.sin(ph + i * 1.7);
      place(el, m.x + drift * 15, m.y - drift * 20, m.s,
        (0.28 + 0.45 * (0.5 + 0.5 * Math.sin(ph + i))) * w, i * 22 + drift * 18);
    });

    const rad = (s.arm - 90) * Math.PI / 180;
    const hx = PIV.x - Math.sin(rad) * 200, hy = PIV.y + Math.cos(rad) * 200 - s.lift;
    this.burst.forEach((el, i) => {
      if (s.burst <= 0.01) { el.style.opacity = 0; return; }
      const a = (i / 4) * Math.PI * 2 + 0.5, r = 70 + 60 * s.burst;
      place(el, hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.85,
        13 + 13 * s.burst, s.burst * 0.95 * w, i * 30);
    });

    E.hi.style.opacity = s.hi;
    E.hi.style.transform =
      `translateY(${(1 - s.hi) * 24}px) rotate(${-7 + s.lean * 0.6}deg) scale(${0.72 + 0.28 * s.hi + 0.05 * Math.sin(s.hi * Math.PI)})`;
  }
}

function place(el, x, y, s, o, rot) {
  el.style.cssText = `position:absolute;left:${x - s}px;top:${y - s}px;width:${s * 2}px;height:${s * 2}px;opacity:${Math.max(0, o)};transform:rotate(${rot}deg)`;
  const i = el.firstElementChild, u = el.lastElementChild;
  i.style.left = '50%'; i.style.top = '0'; i.style.width = s * 0.28 + 'px'; i.style.height = '100%'; i.style.marginLeft = -s * 0.14 + 'px';
  u.style.top = '50%'; u.style.left = '0'; u.style.height = s * 0.28 + 'px'; u.style.width = '100%'; u.style.marginTop = -s * 0.14 + 'px';
}

customElements.define('mascot-hello', MascotHello);
export { MascotHello };
