/**
 * <mascot-banner> — the mascot holding up a sign, with live, changeable sign copy.
 * Dependency-free custom element. Asset: mascot-sign.png (553x416, background removed,
 * sign face blanked — the text you see is real HTML drawn on top).
 *
 *   <script type="module" src="/mascot-banner/mascot-banner.js"></script>
 *   <mascot-banner size="480" assets="/mascot-banner/">
 *     Start adding to the Wish list!
 *     <span>It’s a bit empty in here</span>
 *     <span>Tap the heart on anything you like</span>
 *   </mascot-banner>
 *
 * THE SIGN COPY — four ways, pick whichever suits your stack:
 *   1. child elements (above)      — each child is one message, edits live
 *   2. el.messages = ['a', 'b']    — array property
 *   3. messages="a | b | c"        — attribute, split on |
 *   4. message="just this one"     — a single static line
 *
 * It cycles through the messages on each sign-shake; set cycle="0" to hold on one.
 * Styling hooks (set on the element): --banner-color, --banner-font, --banner-size,
 * --banner-weight.
 */

const BOX = { w: 553, h: 416 };
const SIGN = { x: 186, y: 257, w: 194, h: 78 };        // the blank face of the sign
const EYE_L = { x: 216, y: 163, w: 40, h: 54, px: 5, py: 4, pw: 30, ph: 46 };
const EYE_R = { x: 301, y: 178, w: 46, h: 55, px: 5, py: 3, pw: 36, ph: 48 };
const SPARKS = [
  { x: 120, y: 132, s: 26 }, { x: 432, y: 176, s: 20 },
  { x: 104, y: 296, s: 15 }, { x: 456, y: 322, s: 17 }
];
const STAR = 'polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%)';
const PUPIL = 'linear-gradient(178deg,#251a4c 0%,#100a24 44%,#3f2d6b 78%,#a37ccf 100%)';
const SOCKET = 'linear-gradient(180deg,#f9edfa 0%,#f6e9f9 56%,#f0e1f7 100%)';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const bell = (p) => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p));
const ease = (t) => t * t * (3 - 2 * t);

class MascotBanner extends HTMLElement {
  static observedAttributes = ['size', 'assets', 'messages', 'message', 'cycle', 'motion'];

  /** The sign copy. Read or replace at any time: el.messages = ['one', 'two'] */
  get messages() { return this.lines && this.lines.length ? this.lines : ['']; }
  set messages(v) { this.lines = (Array.isArray(v) ? v : [String(v)]).map((s) => String(s).trim()).filter(Boolean); this.#paint(); }
  get message() { return this.messages[this.idx] || ''; }
  set message(v) { this.messages = [v]; }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.a = { gx: 0, gy: 0, wide: 0, squint: 0, wig: 0 };
    this.v = {};
    this.T = 0; this.t0 = 0;
    this.px = 0; this.py = 0; this.pointerAt = 0;
    this.blinkAt = -9; this.blinkNext = 2.6; this.dbl = false;
    this.idx = 0; this.was = 0; this.swapAt = -9; this.popAt = -9;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#readLines();
    this.#build();
    this.#size();
    this.#paint();

    this.onMove = (e) => {
      const b = this.getBoundingClientRect();
      if (!b.width) return;
      this.px = clamp(((e.clientX - b.left) / b.width - .5) * 2.6, -1, 1);
      this.py = clamp(((e.clientY - b.top) / b.height - .44) * 2.2, -1, 1);
      this.pointerAt = this.T;
    };
    window.addEventListener('pointermove', this.onMove);
    // authors editing the light DOM (a CMS, a framework re-render) get picked up live
    this.mo = new MutationObserver(() => { this.#readLines(); this.#paint(); });
    this.mo.observe(this, { childList: true, characterData: true, subtree: true });

    const loop = () => {
      if (!this.isConnected) return;
      this.raf = requestAnimationFrame(loop);
      this.last = performance.now() / 1000;
      this.#safeTick(this.last);
    };
    this.raf = requestAnimationFrame(loop);
    this.iv = setInterval(() => { const t = performance.now() / 1000; if (t - (this.last || 0) > .12) this.#safeTick(t); }, 33);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.raf); clearInterval(this.iv);
    window.removeEventListener('pointermove', this.onMove);
    this.mo && this.mo.disconnect();
  }

  attributeChangedCallback(name, was, now) {
    if (!this.shadowRoot || was === now) return;
    if (name === 'size') return this.#size();
    if (name === 'assets') { this.#build(); this.#size(); return this.#paint(); }
    if (name === 'messages' || name === 'message') { this.#readLines(); return this.#paint(); }
  }

  /** Shake the sign now (the same beat that runs on a timer). */
  shake() { this.popAt = this.T; this.#advance(); }
  /** Show message n (0-based) without waiting for the cycle. */
  showMessage(n) { this.was = this.idx; this.idx = ((n | 0) % this.messages.length + this.messages.length) % this.messages.length; this.swapAt = this.T; this.#paint(); }

  #advance() {
    const secs = this.getAttribute('cycle');
    if (secs === '0' || this.messages.length < 2) return;
    this.showMessage(this.idx + 1);
    this.dispatchEvent(new CustomEvent('message', { detail: { index: this.idx, text: this.message } }));
  }

  #readLines() {
    const attr = this.getAttribute('messages');
    const one = this.getAttribute('message');
    if (one) { this.lines = [one]; }
    else if (attr) { this.lines = attr.split('|').map((s) => s.trim()).filter(Boolean); }
    else {
      const kids = [...this.children].map((n) => n.textContent.trim()).filter(Boolean);
      const bare = [...this.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean);
      this.lines = kids.length ? kids : bare;
    }
    if (!this.lines || !this.lines.length) this.lines = ['Nothing here yet'];
    if (this.idx >= this.lines.length) { this.idx = 0; this.was = 0; }
  }

  #build() {
    const base = this.getAttribute('assets') || './';
    const eye = (e, tag) => `
      <div style="position:absolute;left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;border-radius:50%;background:${SOCKET};overflow:hidden">
        <div data-${tag} style="position:absolute;left:${e.px}px;top:${e.py}px;width:${e.pw}px;height:${e.ph}px;transform-origin:50% 50%">
          <div style="position:absolute;inset:0;border-radius:50%;background:${PUPIL}">
            <div style="position:absolute;left:15%;top:10%;width:38%;height:23%;border-radius:50%;background:#fff;opacity:.97"></div>
            <div style="position:absolute;left:52%;top:70%;width:26%;height:14%;border-radius:50%;background:#e7d8ff;opacity:.36"></div>
          </div>
        </div>
      </div>`;
    const spark = (s, i) => `<div data-spark style="position:absolute;left:${s.x}px;top:${s.y}px;width:${s.s}px;height:${s.s}px;background:radial-gradient(closest-side,#fff,#d9c2f7);clip-path:${STAR};opacity:0"></div>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host{display:inline-block;position:relative;line-height:0}
        .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
        .msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;
             font-family:var(--banner-font,'Baloo 2',system-ui,sans-serif);
             font-weight:var(--banner-weight,700);
             font-size:var(--banner-size,23px);
             color:var(--banner-color,#7357b5);
             line-height:1.14;letter-spacing:-.005em;text-wrap:balance;opacity:0}
      </style>
      <div class="sr"><slot></slot></div>
      <div data-stage style="position:absolute;left:0;top:0;width:${BOX.w}px;height:${BOX.h}px;transform-origin:0 0">
        ${SPARKS.map(spark).join('')}
        <div data-floor style="position:absolute;left:50%;bottom:14px;width:210px;height:26px;margin-left:-105px;border-radius:50%;background:radial-gradient(closest-side,rgba(84,48,142,.22),rgba(84,48,142,0))"></div>
        <div data-rig style="position:absolute;left:0;top:0;width:${BOX.w}px;height:${BOX.h}px;transform-origin:50% 95%">
          <img src="${base}mascot-sign.png" alt="Mascot holding up a sign" style="position:absolute;left:0;top:0;width:${BOX.w}px;height:${BOX.h}px">
          ${eye(EYE_L, 'pl')}${eye(EYE_R, 'pr')}
          <svg data-arcs viewBox="0 0 ${BOX.w} ${BOX.h}" style="position:absolute;left:0;top:0;width:${BOX.w}px;height:${BOX.h}px;opacity:0">
            <path d="M220 199 Q236 179 252 199" fill="none" stroke="#2f2258" stroke-width="7" stroke-linecap="round"></path>
            <path d="M306 215 Q325 193 344 215" fill="none" stroke="#2f2258" stroke-width="7" stroke-linecap="round"></path>
          </svg>
          <div data-sign style="position:absolute;left:${SIGN.x}px;top:${SIGN.y}px;width:${SIGN.w}px;height:${SIGN.h}px;overflow:hidden"></div>
        </div>
      </div>`;
    const q = (s) => this.shadowRoot.querySelector(s);
    this.el = {
      stage: q('[data-stage]'), rig: q('[data-rig]'), pl: q('[data-pl]'), pr: q('[data-pr]'),
      arcs: q('[data-arcs]'), sign: q('[data-sign]'), floor: q('[data-floor]'),
      sparks: this.shadowRoot.querySelectorAll('[data-spark]')
    };
  }

  /** Rebuild the sign's message layers. Cheap — only runs when the copy changes. */
  #paint() {
    if (!this.el || !this.el.sign) return;
    this.el.sign.innerHTML = this.messages.map((t) => '<div class="msg"></div>').join('');
    this.msgEls = [...this.el.sign.children];
    this.msgEls.forEach((el, i) => { el.textContent = this.messages[i]; if (i === this.idx) el.style.opacity = '1'; });
  }

  #size() {
    const size = parseFloat(this.getAttribute('size') || BOX.w);
    const k = size / BOX.w;
    this.style.width = size + 'px';
    this.style.height = BOX.h * k + 'px';
    this.el.stage.style.transform = 'scale(' + k + ')';
  }

  #step(k, target, kp, d) {
    this.v[k] = ((this.v[k] || 0) + (target - this.a[k]) * kp) * d;
    this.a[k] += this.v[k];
  }

  #safeTick(t) {
    try { this.#tick(t); }
    catch (e) { if (!this.warned) { this.warned = true; console.error('<mascot-banner> frame error', e); } }
  }

  #tick(now) {
    if (!this.t0) this.t0 = now;
    const t = this.T = now - this.t0;
    const a = this.a, E = this.el;
    const amp = this.reduce ? 0 : clamp(parseFloat(this.getAttribute('motion') || 1), 0, 2);
    const every = clamp(parseFloat(this.getAttribute('cycle') || 6.5) || 6.5, 3, 30);

    // entrance: the sign rises from below and overshoots once
    const rise = amp ? (1 - ease(clamp(t / 1.05, 0, 1))) * 175 - bell(clamp((t - .62) / .8, 0, 1)) * 13 : 0;
    const inRot = amp ? (1 - ease(clamp(t / .9, 0, 1))) * -5 : 0;
    E.rig.style.opacity = amp ? clamp(t / .3, 0, 1).toFixed(3) : 1;

    // the beat: a double wiggle of the sign, a happy squint, sparkles, next message
    const beat = t > 2.2 ? (t - 2.2) % every : -1;
    if (beat >= 0 && beat < .05 && this.popAt < t - 1) {
      this.popAt = t;
      this.#advance();
      this.dispatchEvent(new CustomEvent('shake'));
    }
    const wig = beat >= 0 && beat < .8 && amp ? Math.sin(beat / .8 * Math.PI * 3) * (1 - beat / .8) * 3.6 : 0;
    const squintT = beat > .12 && beat < .62 ? 1 : 0;
    const wideT = beat >= 0 && beat <= .12 ? 1 : 0;

    const popP = clamp((t - this.popAt) / 1.1, 0, 1);
    const popV = popP > 0 && popP < 1 ? bell(popP) : 0;

    const live = clamp(1 - (t - this.pointerAt - 1.4) / 2.6, 0, 1);
    const glance = live < .05 && (t % every) > 3.1 && (t % every) < 4.2 ? 1 : 0;

    this.#step('gx', live * this.px, .13, .74);
    this.#step('gy', live * this.py + glance * .7, .13, .74);
    this.#step('wide', wideT, .2, .66);
    this.#step('squint', squintT, .22, .64);
    this.#step('wig', wig, .3, .55);

    if (t > this.blinkNext) { this.blinkAt = t; this.dbl = Math.random() < .18; this.blinkNext = t + 2.8 + Math.random() * 3.6; }
    const bp = (t - this.blinkAt) / (this.dbl ? .4 : .2);
    const blink = bp > 0 && bp < 1 ? (this.dbl ? Math.max(bell(bp / .46), bell((bp - .53) / .46)) : bell(bp)) : 0;

    const sway = Math.sin(t * 2 * Math.PI / 5.4) * 1.1 * amp;
    const bob = Math.sin(t * 2 * Math.PI / 3.6) * 3.2 * amp;
    const y = rise + bob - popV * 10;
    E.rig.style.transform = 'translateY(' + y.toFixed(2) + 'px) rotate(' + (sway + a.wig + inRot).toFixed(2) + 'deg) scale(' + (1 + popV * .012).toFixed(4) + ')';

    const openY = clamp((1 + a.wide * .14) * (1 - blink * .95) * (1 - a.squint * .96), .02, 1.3);
    const eyeT = 'translate(' + (a.gx * 4).toFixed(2) + 'px,' + (a.gy * 4.5).toFixed(2) + 'px) scale(' + (1 + a.wide * .05).toFixed(3) + ',' + openY.toFixed(3) + ')';
    E.pl.style.transform = eyeT; E.pr.style.transform = eyeT;
    E.arcs.style.opacity = clamp(Math.max(a.squint, (blink - .5) / .5), 0, 1).toFixed(3);

    // message swap: the old line lifts out, the new one rises in
    const sp = clamp((t - this.swapAt) / .42, 0, 1);
    if (this.msgEls) for (let i = 0; i < this.msgEls.length; i++) {
      const el = this.msgEls[i];
      if (i === this.idx) {
        el.style.opacity = ease(sp).toFixed(3);
        el.style.transform = 'translateY(' + ((1 - ease(sp)) * 16).toFixed(2) + 'px)';
      } else if (i === this.was && sp < 1) {
        el.style.opacity = (1 - ease(sp)).toFixed(3);
        el.style.transform = 'translateY(' + (-ease(sp) * 16).toFixed(2) + 'px)';
      } else el.style.opacity = '0';
    }

    E.sparks.forEach((el, i) => {
      const p = clamp((popP - i * .07) / .8, 0, 1);
      const b = p > 0 && p < 1 ? bell(p) : 0;
      el.style.opacity = (b * .95).toFixed(3);
      el.style.transform = 'translateY(' + (-b * 9).toFixed(2) + 'px) rotate(' + (b * 40 * (i % 2 ? -1 : 1)).toFixed(1) + 'deg) scale(' + (.4 + b * .7).toFixed(3) + ')';
    });

    E.floor.style.transform = 'scale(' + (1 - y * .0016).toFixed(3) + ')';
    E.floor.style.opacity = clamp(1 - rise / 175 - y * .004, 0, 1).toFixed(3);
  }
}

customElements.define('mascot-banner', MascotBanner);
export { MascotBanner };
